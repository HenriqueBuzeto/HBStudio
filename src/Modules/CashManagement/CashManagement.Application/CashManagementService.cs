using Microsoft.EntityFrameworkCore;
using BuildingBlocks.Application;
using BuildingBlocks.Infrastructure;
using CashManagement.Domain;
using Sales.Domain;

namespace CashManagement.Application;

public class CashManagementService
{
    private readonly AppDbContext _dbContext;
    private readonly IExecutionContext _executionContext;

    public CashManagementService(AppDbContext dbContext, IExecutionContext executionContext)
    {
        _dbContext = dbContext;
        _executionContext = executionContext;
    }

    #region Terminais de Caixa

    public async Task<IReadOnlyList<CashRegisterResponse>> ListRegistersAsync(Guid? branchId, CancellationToken ct = default)
    {
        var query = _dbContext.CashRegisters.AsNoTracking();
        if (branchId.HasValue) query = query.Where(r => r.BranchId == branchId.Value);

        var list = await query.OrderBy(r => r.Code).ToListAsync(ct);
        return list.Select(r => new CashRegisterResponse(
            r.Id,
            r.BranchId,
            r.Code,
            r.Name,
            r.Status,
            r.Notes,
            r.CreatedAtUtc,
            r.Version
        )).ToList();
    }

    public async Task<CashRegisterResponse> CreateRegisterAsync(CreateCashRegisterDto dto, CancellationToken ct = default)
    {
        var tenantId = _executionContext.TenantId;
        var code = dto.Code.Trim().ToUpperInvariant();

        var exists = await _dbContext.CashRegisters.AnyAsync(r => r.BranchId == dto.BranchId && r.Code == code, ct);
        if (exists)
            throw new InvalidOperationException($"Já existe um terminal de caixa com o código '{code}' nesta filial.");

        var register = new CashRegister(tenantId, dto.BranchId, code, dto.Name, dto.Notes);
        _dbContext.CashRegisters.Add(register);
        await _dbContext.SaveChangesAsync(ct);

        return new CashRegisterResponse(
            register.Id,
            register.BranchId,
            register.Code,
            register.Name,
            register.Status,
            register.Notes,
            register.CreatedAtUtc,
            register.Version
        );
    }

    public async Task<CashRegisterResponse> UpdateRegisterAsync(Guid id, UpdateCashRegisterDto dto, CancellationToken ct = default)
    {
        var register = await _dbContext.CashRegisters.FirstOrDefaultAsync(r => r.Id == id, ct);
        if (register == null) throw new KeyNotFoundException($"Terminal {id} não encontrado.");

        register.Update(dto.Name, dto.Status, dto.Notes);
        await _dbContext.SaveChangesAsync(ct);

        return new CashRegisterResponse(
            register.Id,
            register.BranchId,
            register.Code,
            register.Name,
            register.Status,
            register.Notes,
            register.CreatedAtUtc,
            register.Version
        );
    }

    #endregion

    #region Turnos de Caixa

    public async Task<CashShiftSummaryResponse?> GetActiveShiftForRegisterAsync(Guid registerId, CancellationToken ct = default)
    {
        var shift = await _dbContext.CashShifts
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.CashRegisterId == registerId &&
                (s.Status == CashShiftStatus.Open || s.Status == CashShiftStatus.Closing || s.Status == CashShiftStatus.CountSubmitted), ct);

        if (shift == null) return null;

        var reg = await _dbContext.CashRegisters.AsNoTracking().FirstOrDefaultAsync(r => r.Id == shift.CashRegisterId, ct);
        return MapShiftSummary(shift, reg);
    }

    public async Task<IReadOnlyList<CashShiftSummaryResponse>> ListShiftsAsync(Guid? branchId, CashShiftStatus? status, CancellationToken ct = default)
    {
        var query = _dbContext.CashShifts.AsNoTracking();
        if (branchId.HasValue) query = query.Where(s => s.BranchId == branchId.Value);
        if (status.HasValue) query = query.Where(s => s.Status == status.Value);

        var list = await query.OrderByDescending(s => s.OpenedAtUtc).ToListAsync(ct);
        var regIds = list.Select(s => s.CashRegisterId).Distinct().ToList();
        var registers = await _dbContext.CashRegisters.Where(r => regIds.Contains(r.Id)).ToDictionaryAsync(r => r.Id, ct);

        return list.Select(s => MapShiftSummary(s, registers.GetValueOrDefault(s.CashRegisterId))).ToList();
    }

    public async Task<CashShiftDetailResponse> GetShiftDetailsAsync(Guid id, bool canViewExpectedBalance, CancellationToken ct = default)
    {
        var shift = await _dbContext.CashShifts
            .Include(s => s.Movements)
            .Include(s => s.Denominations)
            .FirstOrDefaultAsync(s => s.Id == id, ct);

        if (shift == null) throw new KeyNotFoundException($"Turno {id} não encontrado.");

        var reg = await _dbContext.CashRegisters.AsNoTracking().FirstOrDefaultAsync(r => r.Id == shift.CashRegisterId, ct);
        return MapShiftDetail(shift, reg, canViewExpectedBalance);
    }

    public async Task<CashShiftDetailResponse> OpenShiftAsync(OpenCashShiftDto dto, CancellationToken ct = default)
    {
        var tenantId = _executionContext.TenantId;
        var userId = _executionContext.UserId;

        // Idempotência
        if (!string.IsNullOrWhiteSpace(dto.IdempotencyKey))
        {
            var existingMovement = await _dbContext.CashMovements
                .FirstOrDefaultAsync(m => m.IdempotencyKey == dto.IdempotencyKey, ct);
            if (existingMovement != null)
            {
                var existingShift = await _dbContext.CashShifts
                    .Include(s => s.Movements)
                    .Include(s => s.Denominations)
                    .FirstOrDefaultAsync(s => s.Id == existingMovement.CashShiftId, ct);
                if (existingShift != null)
                {
                    var regExisting = await _dbContext.CashRegisters.FirstOrDefaultAsync(r => r.Id == existingShift.CashRegisterId, ct);
                    return MapShiftDetail(existingShift, regExisting, canViewExpectedBalance: true);
                }
            }
        }

        var register = await _dbContext.CashRegisters.FirstOrDefaultAsync(r => r.Id == dto.CashRegisterId, ct);
        if (register == null) throw new KeyNotFoundException($"Terminal {dto.CashRegisterId} não encontrado.");
        if (register.Status != CashRegisterStatus.Active)
            throw new InvalidOperationException($"Terminal '{register.Name}' está inativo ou em manutenção.");

        // Validar unicidade: não permitir dois turnos ativos simultaneamente no mesmo terminal
        var hasActiveShift = await _dbContext.CashShifts.AnyAsync(s =>
            s.CashRegisterId == dto.CashRegisterId &&
            (s.Status == CashShiftStatus.Open || s.Status == CashShiftStatus.Closing || s.Status == CashShiftStatus.CountSubmitted), ct);

        if (hasActiveShift)
        {
            throw new InvalidOperationException($"Já existe um turno ativo em andamento para o terminal '{register.Name}'.");
        }

        var shift = new CashShift(
            tenantId,
            dto.BranchId,
            dto.CashRegisterId,
            dto.OperatorUserId,
            userId,
            dto.OpeningFloat,
            dto.OpeningSource,
            dto.OpeningNotes
        );

        _dbContext.CashShifts.Add(shift);
        await _dbContext.SaveChangesAsync(ct);

        return MapShiftDetail(shift, register, canViewExpectedBalance: true);
    }

    public async Task<CashMovementResponse> RecordWithdrawalAsync(Guid shiftId, CreateCashWithdrawalDto dto, CancellationToken ct = default)
    {
        var userId = _executionContext.UserId;

        // Idempotência
        if (!string.IsNullOrWhiteSpace(dto.IdempotencyKey))
        {
            var existing = await _dbContext.CashMovements.FirstOrDefaultAsync(m => m.IdempotencyKey == dto.IdempotencyKey, ct);
            if (existing != null) return MapMovement(existing);
        }

        var shift = await _dbContext.CashShifts
            .Include(s => s.Movements)
            .FirstOrDefaultAsync(s => s.Id == shiftId, ct);

        if (shift == null) throw new KeyNotFoundException($"Turno {shiftId} não encontrado.");

        var movement = shift.AddMovement(
            CashMovementType.CashWithdrawal,
            CashMovementDirection.Out,
            dto.Amount,
            sourceType: "WITHDRAWAL",
            sourceId: shiftId.ToString(),
            documentReference: $"SANGRIA-{DateTime.UtcNow:HHmmss}",
            reason: $"Sangria para {dto.DestinationDeclared}: {dto.Reason}. Recebedor: {dto.ReceiverName ?? "N/A"}",
            userId,
            idempotencyKey: dto.IdempotencyKey
        );

        _dbContext.Entry(movement).State = EntityState.Added;
        await _dbContext.SaveChangesAsync(ct);

        return MapMovement(movement);
    }

    public async Task<CashMovementResponse> RecordSupplyAsync(Guid shiftId, CreateCashSupplyDto dto, CancellationToken ct = default)
    {
        var userId = _executionContext.UserId;

        // Idempotência
        if (!string.IsNullOrWhiteSpace(dto.IdempotencyKey))
        {
            var existing = await _dbContext.CashMovements.FirstOrDefaultAsync(m => m.IdempotencyKey == dto.IdempotencyKey, ct);
            if (existing != null) return MapMovement(existing);
        }

        var shift = await _dbContext.CashShifts
            .Include(s => s.Movements)
            .FirstOrDefaultAsync(s => s.Id == shiftId, ct);

        if (shift == null) throw new KeyNotFoundException($"Turno {shiftId} não encontrado.");

        var movement = shift.AddMovement(
            CashMovementType.CashSupply,
            CashMovementDirection.In,
            dto.Amount,
            sourceType: "SUPPLY",
            sourceId: shiftId.ToString(),
            documentReference: $"SUPRIMENTO-{DateTime.UtcNow:HHmmss}",
            reason: $"Suprimento de {dto.OriginDeclared}: {dto.Reason}",
            userId,
            idempotencyKey: dto.IdempotencyKey
        );

        _dbContext.Entry(movement).State = EntityState.Added;
        await _dbContext.SaveChangesAsync(ct);

        return MapMovement(movement);
    }

    public async Task<CashMovementResponse> RecordCashSaleReceiptAsync(Guid shiftId, RecordCashSaleReceiptDto dto, CancellationToken ct = default)
    {
        var userId = _executionContext.UserId;

        // Validar unicidade da transação comercial para não duplicar entrada de dinheiro
        var existingReceipt = await _dbContext.CashMovements.FirstOrDefaultAsync(m =>
            m.MovementType == CashMovementType.CashSaleReceipt &&
            m.SourceId == dto.SalePaymentIntentId.ToString(), ct);

        if (existingReceipt != null)
        {
            return MapMovement(existingReceipt);
        }

        var shift = await _dbContext.CashShifts
            .Include(s => s.Movements)
            .FirstOrDefaultAsync(s => s.Id == shiftId, ct);

        if (shift == null) throw new KeyNotFoundException($"Turno {shiftId} não encontrado.");

        var movement = shift.AddMovement(
            CashMovementType.CashSaleReceipt,
            CashMovementDirection.In,
            dto.Amount,
            sourceType: "SALE_PAYMENT",
            sourceId: dto.SalePaymentIntentId.ToString(),
            documentReference: dto.DocumentReference,
            reason: $"Recebimento em dinheiro PDV - Venda {dto.SaleId}",
            userId,
            correlationId: dto.SaleId.ToString(),
            idempotencyKey: dto.IdempotencyKey
        );

        _dbContext.Entry(movement).State = EntityState.Added;
        await _dbContext.SaveChangesAsync(ct);

        return MapMovement(movement);
    }

    public async Task StartShiftClosingAsync(Guid shiftId, CancellationToken ct = default)
    {
        var userId = _executionContext.UserId;
        var shift = await _dbContext.CashShifts.FirstOrDefaultAsync(s => s.Id == shiftId, ct);
        if (shift == null) throw new KeyNotFoundException($"Turno {shiftId} não encontrado.");

        shift.StartClosing(userId);
        await _dbContext.SaveChangesAsync(ct);
    }

    public async Task<CashShiftDetailResponse> SubmitBlindCountAsync(Guid shiftId, SubmitBlindCountDto dto, bool canViewExpectedBalance, CancellationToken ct = default)
    {
        var userId = _executionContext.UserId;
        var shift = await _dbContext.CashShifts
            .Include(s => s.Movements)
            .Include(s => s.Denominations)
            .FirstOrDefaultAsync(s => s.Id == shiftId, ct);

        if (shift == null) throw new KeyNotFoundException($"Turno {shiftId} não encontrado.");

        var denoms = (dto.Denominations ?? new List<CashCountItemDto>())
            .Select(d => (d.Denomination, d.Quantity))
            .ToList();

        shift.SubmitBlindCount(userId, dto.CountedTotal, denoms, dto.Notes);

        foreach (var (val, qty) in denoms)
        {
            if (qty > 0)
            {
                var denom = new CashCountDenomination(shift.TenantId, shift.Id, val, qty);
                _dbContext.CashCountDenominations.Add(denom);
            }
        }

        // Se houver divergência, gerar registro formal em CashDiscrepancy
        if (shift.DiscrepancyType.HasValue && shift.DiscrepancyAmount.HasValue && shift.DiscrepancyAmount.Value > 0)
        {
            var disc = new CashDiscrepancy(
                shift.TenantId,
                shift.BranchId,
                shift.Id,
                shift.DiscrepancyType.Value,
                shift.DiscrepancyAmount.Value
            );
            if (!string.IsNullOrWhiteSpace(dto.Notes))
            {
                disc.AddJustification(dto.Notes, userId);
            }
            _dbContext.CashDiscrepancies.Add(disc);
        }

        await _dbContext.SaveChangesAsync(ct);

        var reg = await _dbContext.CashRegisters.FirstOrDefaultAsync(r => r.Id == shift.CashRegisterId, ct);
        return MapShiftDetail(shift, reg, canViewExpectedBalance);
    }

    public async Task<CashShiftDetailResponse> ApproveClosingAsync(Guid shiftId, ApproveCashClosingDto dto, CancellationToken ct = default)
    {
        var approverId = _executionContext.UserId;
        var shift = await _dbContext.CashShifts
            .Include(s => s.Movements)
            .Include(s => s.Denominations)
            .FirstOrDefaultAsync(s => s.Id == shiftId, ct);

        if (shift == null) throw new KeyNotFoundException($"Turno {shiftId} não encontrado.");

        shift.ApproveClosing(approverId, dto.Notes);
        await _dbContext.SaveChangesAsync(ct);

        var reg = await _dbContext.CashRegisters.FirstOrDefaultAsync(r => r.Id == shift.CashRegisterId, ct);
        return MapShiftDetail(shift, reg, canViewExpectedBalance: true);
    }

    public async Task<CashShiftDetailResponse> CloseShiftAsync(Guid shiftId, CancellationToken ct = default)
    {
        var userId = _executionContext.UserId;
        var shift = await _dbContext.CashShifts
            .Include(s => s.Movements)
            .Include(s => s.Denominations)
            .FirstOrDefaultAsync(s => s.Id == shiftId, ct);

        if (shift == null) throw new KeyNotFoundException($"Turno {shiftId} não encontrado.");

        shift.CloseShift(userId);
        await _dbContext.SaveChangesAsync(ct);

        var reg = await _dbContext.CashRegisters.FirstOrDefaultAsync(r => r.Id == shift.CashRegisterId, ct);
        return MapShiftDetail(shift, reg, canViewExpectedBalance: true);
    }

    #endregion

    #region Divergências

    public async Task<IReadOnlyList<CashDiscrepancyResponse>> ListDiscrepanciesAsync(Guid? branchId, CashDiscrepancyStatus? status, CancellationToken ct = default)
    {
        var query = _dbContext.CashDiscrepancies.AsNoTracking();
        if (branchId.HasValue) query = query.Where(d => d.BranchId == branchId.Value);
        if (status.HasValue) query = query.Where(d => d.Status == status.Value);

        var list = await query.OrderByDescending(d => d.CreatedAtUtc).ToListAsync(ct);
        return list.Select(d => new CashDiscrepancyResponse(
            d.Id,
            d.BranchId,
            d.CashShiftId,
            d.DiscrepancyType,
            d.Amount,
            d.Status,
            d.OperatorJustification,
            d.JustifiedByUserId,
            d.JustifiedAtUtc,
            d.ResolutionNotes,
            d.ResolvedByUserId,
            d.ResolvedAtUtc,
            d.CreatedAtUtc
        )).ToList();
    }

    public async Task<CashDiscrepancyResponse> JustifyDiscrepancyAsync(Guid id, JustifyCashDiscrepancyDto dto, CancellationToken ct = default)
    {
        var userId = _executionContext.UserId;
        var disc = await _dbContext.CashDiscrepancies.FirstOrDefaultAsync(d => d.Id == id, ct);
        if (disc == null) throw new KeyNotFoundException($"Divergência {id} não encontrada.");

        disc.AddJustification(dto.Justification, userId);
        await _dbContext.SaveChangesAsync(ct);

        return new CashDiscrepancyResponse(
            disc.Id,
            disc.BranchId,
            disc.CashShiftId,
            disc.DiscrepancyType,
            disc.Amount,
            disc.Status,
            disc.OperatorJustification,
            disc.JustifiedByUserId,
            disc.JustifiedAtUtc,
            disc.ResolutionNotes,
            disc.ResolvedByUserId,
            disc.ResolvedAtUtc,
            disc.CreatedAtUtc
        );
    }

    public async Task<CashDiscrepancyResponse> ResolveDiscrepancyAsync(Guid id, ResolveCashDiscrepancyDto dto, CancellationToken ct = default)
    {
        var approverId = _executionContext.UserId;
        var disc = await _dbContext.CashDiscrepancies.FirstOrDefaultAsync(d => d.Id == id, ct);
        if (disc == null) throw new KeyNotFoundException($"Divergência {id} não encontrada.");

        disc.Resolve(dto.Approved, dto.ResolutionNotes, approverId);
        await _dbContext.SaveChangesAsync(ct);

        return new CashDiscrepancyResponse(
            disc.Id,
            disc.BranchId,
            disc.CashShiftId,
            disc.DiscrepancyType,
            disc.Amount,
            disc.Status,
            disc.OperatorJustification,
            disc.JustifiedByUserId,
            disc.JustifiedAtUtc,
            disc.ResolutionNotes,
            disc.ResolvedByUserId,
            disc.ResolvedAtUtc,
            disc.CreatedAtUtc
        );
    }

    #endregion

    #region Mapeamentos

    private static CashShiftSummaryResponse MapShiftSummary(CashShift s, CashRegister? reg)
    {
        return new CashShiftSummaryResponse(
            s.Id,
            s.BranchId,
            s.CashRegisterId,
            reg?.Code,
            reg?.Name,
            s.OperatorUserId,
            s.OpenedByUserId,
            s.OpenedAtUtc,
            s.OpeningFloat,
            s.Status,
            s.CurrentBalance,
            s.TotalCashIn,
            s.TotalCashOut,
            s.ClosedAtUtc,
            s.ExpectedCashBalance,
            s.CountedCashBalance,
            s.DiscrepancyAmount,
            s.DiscrepancyType,
            s.Version
        );
    }

    private static CashShiftDetailResponse MapShiftDetail(CashShift s, CashRegister? reg, bool canViewExpectedBalance)
    {
        var movements = s.Movements.Select(MapMovement).ToList();
        var denominations = s.Denominations.Select(d => new CashCountDenominationResponse(
            d.Id,
            d.Denomination,
            d.Quantity,
            d.TotalAmount
        )).ToList();

        // Blind count enforcement: se o usuário não tem permissão para ver saldo esperado durante a contagem
        var expected = (canViewExpectedBalance || s.Status >= CashShiftStatus.CountSubmitted)
            ? (s.ExpectedCashBalance ?? s.CurrentBalance)
            : (decimal?)null;

        var discrepancy = (canViewExpectedBalance || s.Status >= CashShiftStatus.CountSubmitted)
            ? s.DiscrepancyAmount
            : null;

        return new CashShiftDetailResponse(
            s.Id,
            s.BranchId,
            s.CashRegisterId,
            reg?.Code,
            reg?.Name,
            s.OperatorUserId,
            s.OpenedByUserId,
            s.OpenedAtUtc,
            s.OpeningFloat,
            s.OpeningSource,
            s.OpeningNotes,
            s.Status,
            (canViewExpectedBalance || s.Status >= CashShiftStatus.CountSubmitted) ? s.CurrentBalance : 0m,
            s.TotalCashIn,
            s.TotalCashOut,
            s.ClosingStartedAtUtc,
            s.ClosedAtUtc,
            s.ClosedByUserId,
            s.ApprovedByUserId,
            s.ClosingNotes,
            expected,
            s.CountedCashBalance,
            discrepancy,
            (canViewExpectedBalance || s.Status >= CashShiftStatus.CountSubmitted) ? s.DiscrepancyType : null,
            movements,
            denominations,
            s.Version
        );
    }

    private static CashMovementResponse MapMovement(CashMovement m)
    {
        return new CashMovementResponse(
            m.Id,
            m.BranchId,
            m.CashRegisterId,
            m.CashShiftId,
            m.MovementType,
            m.Direction,
            m.Amount,
            m.SourceType,
            m.SourceId,
            m.DocumentReference,
            m.Reason,
            m.CreatedByUserId,
            m.CorrelationId,
            m.IdempotencyKey,
            m.CreatedAtUtc
        );
    }

    #endregion
}
