using Microsoft.EntityFrameworkCore;
using BuildingBlocks.Application;
using BuildingBlocks.Infrastructure;
using Financial.Domain;

namespace Financial.Application;

public class FinancialService
{
    private readonly AppDbContext _dbContext;
    private readonly IExecutionContext _executionContext;

    public FinancialService(AppDbContext dbContext, IExecutionContext executionContext)
    {
        _dbContext = dbContext;
        _executionContext = executionContext;
    }

    #region Plano de Contas & Centros de Custo

    public async Task<FinancialAccountResponse> CreateAccountAsync(CreateFinancialAccountDto dto, CancellationToken ct = default)
    {
        var tenantId = _executionContext.TenantId;
        var code = dto.Code.Trim().ToUpperInvariant();

        var exists = await _dbContext.FinancialAccounts.AnyAsync(a => a.Code == code, ct);
        if (exists) throw new InvalidOperationException($"Conta contábil com código '{code}' já existe.");

        var account = new FinancialAccount(tenantId, code, dto.Name, dto.Type, dto.ParentAccountId);
        _dbContext.FinancialAccounts.Add(account);
        await _dbContext.SaveChangesAsync(ct);

        return new FinancialAccountResponse(account.Id, account.Code, account.Name, account.Type, account.ParentAccountId, account.IsActive);
    }

    public async Task<IReadOnlyList<FinancialAccountResponse>> ListAccountsAsync(CancellationToken ct = default)
    {
        var list = await _dbContext.FinancialAccounts.AsNoTracking().OrderBy(a => a.Code).ToListAsync(ct);
        return list.Select(a => new FinancialAccountResponse(a.Id, a.Code, a.Name, a.Type, a.ParentAccountId, a.IsActive)).ToList();
    }

    public async Task<FinancialCostCenterResponse> CreateCostCenterAsync(CreateCostCenterDto dto, CancellationToken ct = default)
    {
        var tenantId = _executionContext.TenantId;
        var code = dto.Code.Trim().ToUpperInvariant();

        var exists = await _dbContext.FinancialCostCenters.AnyAsync(c => c.Code == code, ct);
        if (exists) throw new InvalidOperationException($"Centro de custo com código '{code}' já existe.");

        var cc = new FinancialCostCenter(tenantId, code, dto.Name, dto.Description);
        _dbContext.FinancialCostCenters.Add(cc);
        await _dbContext.SaveChangesAsync(ct);

        return new FinancialCostCenterResponse(cc.Id, cc.Code, cc.Name, cc.Description, cc.IsActive);
    }

    public async Task<IReadOnlyList<FinancialCostCenterResponse>> ListCostCentersAsync(CancellationToken ct = default)
    {
        var list = await _dbContext.FinancialCostCenters.AsNoTracking().OrderBy(c => c.Code).ToListAsync(ct);
        return list.Select(c => new FinancialCostCenterResponse(c.Id, c.Code, c.Name, c.Description, c.IsActive)).ToList();
    }

    #endregion

    #region Contas Bancárias

    public async Task<BankAccountResponse> CreateBankAccountAsync(CreateBankAccountDto dto, CancellationToken ct = default)
    {
        var tenantId = _executionContext.TenantId;
        var acc = new BankAccount(tenantId, dto.BranchId, dto.BankName, dto.AgencyNumber, dto.AccountNumber, dto.Type, dto.InitialBalance);
        _dbContext.BankAccounts.Add(acc);
        await _dbContext.SaveChangesAsync(ct);

        return new BankAccountResponse(acc.Id, acc.BranchId, acc.BankName, acc.AgencyNumber, acc.AccountNumber, acc.Type, acc.CurrentBalance, acc.ReconciledBalance, acc.IsActive, acc.Version);
    }

    public async Task<IReadOnlyList<BankAccountResponse>> ListBankAccountsAsync(Guid? branchId, CancellationToken ct = default)
    {
        var query = _dbContext.BankAccounts.AsNoTracking();
        if (branchId.HasValue) query = query.Where(b => b.BranchId == branchId.Value);

        var list = await query.OrderBy(b => b.BankName).ToListAsync(ct);
        return list.Select(b => new BankAccountResponse(b.Id, b.BranchId, b.BankName, b.AgencyNumber, b.AccountNumber, b.Type, b.CurrentBalance, b.ReconciledBalance, b.IsActive, b.Version)).ToList();
    }

    #endregion

    #region Contas a Pagar & Receber

    public async Task<AccountPayableResponse> CreateAccountPayableAsync(CreateAccountPayableDto dto, CancellationToken ct = default)
    {
        var tenantId = _executionContext.TenantId;
        var payable = new AccountPayable(
            tenantId,
            dto.BranchId,
            dto.SupplierPartyId,
            dto.TitleNumber,
            dto.Description,
            dto.IssueDateUtc,
            dto.DueDateUtc,
            dto.OriginalAmount,
            dto.CostCenterId,
            dto.DocumentReference,
            dto.PurchaseOrderId
        );

        _dbContext.AccountsPayable.Add(payable);
        await _dbContext.SaveChangesAsync(ct);

        return MapPayable(payable, null);
    }

    public async Task<AccountPayableResponse> PayTitleAsync(Guid id, PayTitleDto dto, CancellationToken ct = default)
    {
        var userId = _executionContext.UserId;
        var payable = await _dbContext.AccountsPayable
            .Include(p => p.Settlements)
            .FirstOrDefaultAsync(p => p.Id == id, ct);

        if (payable == null) throw new KeyNotFoundException($"Conta a pagar {id} não encontrada.");

        var bank = await _dbContext.BankAccounts.FirstOrDefaultAsync(b => b.Id == dto.BankAccountId, ct);
        if (bank == null) throw new KeyNotFoundException($"Conta bancária {dto.BankAccountId} não encontrada.");

        var settlement = payable.Pay(dto.Amount, dto.BankAccountId, userId, dto.Reference);
        _dbContext.Entry(settlement).State = EntityState.Added;

        // Deduz saldo escriturado da conta bancária
        bank.ApplyMovement(-dto.Amount);

        await _dbContext.SaveChangesAsync(ct);
        return MapPayable(payable, null);
    }

    public async Task<IReadOnlyList<AccountPayableResponse>> ListAccountsPayableAsync(Guid? branchId, PayableStatus? status, CancellationToken ct = default)
    {
        var query = _dbContext.AccountsPayable.AsNoTracking();
        if (branchId.HasValue) query = query.Where(p => p.BranchId == branchId.Value);
        if (status.HasValue) query = query.Where(p => p.Status == status.Value);

        var list = await query.OrderBy(p => p.DueDateUtc).ToListAsync(ct);
        return list.Select(p => MapPayable(p, null)).ToList();
    }

    public async Task<AccountReceivableResponse> CreateAccountReceivableAsync(CreateAccountReceivableDto dto, CancellationToken ct = default)
    {
        var tenantId = _executionContext.TenantId;
        var rec = new AccountReceivable(
            tenantId,
            dto.BranchId,
            dto.CustomerPartyId,
            dto.TitleNumber,
            dto.Description,
            dto.IssueDateUtc,
            dto.DueDateUtc,
            dto.OriginalAmount,
            dto.CostCenterId,
            dto.DocumentReference,
            dto.SaleId
        );

        _dbContext.AccountsReceivable.Add(rec);
        await _dbContext.SaveChangesAsync(ct);

        return MapReceivable(rec, null);
    }

    public async Task<AccountReceivableResponse> ReceiveTitleAsync(Guid id, ReceiveTitleDto dto, CancellationToken ct = default)
    {
        var userId = _executionContext.UserId;
        var rec = await _dbContext.AccountsReceivable
            .Include(r => r.Settlements)
            .FirstOrDefaultAsync(r => r.Id == id, ct);

        if (rec == null) throw new KeyNotFoundException($"Conta a receber {id} não encontrada.");

        var bank = await _dbContext.BankAccounts.FirstOrDefaultAsync(b => b.Id == dto.BankAccountId, ct);
        if (bank == null) throw new KeyNotFoundException($"Conta bancária {dto.BankAccountId} não encontrada.");

        var settlement = rec.Receive(dto.Amount, dto.BankAccountId, userId, dto.Reference);
        _dbContext.Entry(settlement).State = EntityState.Added;

        // Aumenta saldo escriturado da conta bancária
        bank.ApplyMovement(dto.Amount);

        await _dbContext.SaveChangesAsync(ct);
        return MapReceivable(rec, null);
    }

    public async Task<IReadOnlyList<AccountReceivableResponse>> ListAccountsReceivableAsync(Guid? branchId, ReceivableStatus? status, CancellationToken ct = default)
    {
        var query = _dbContext.AccountsReceivable.AsNoTracking();
        if (branchId.HasValue) query = query.Where(r => r.BranchId == branchId.Value);
        if (status.HasValue) query = query.Where(r => r.Status == status.Value);

        var list = await query.OrderBy(r => r.DueDateUtc).ToListAsync(ct);
        return list.Select(r => MapReceivable(r, null)).ToList();
    }

    #endregion

    #region Razão Contábil (Partidas Dobradas)

    public async Task<FinancialJournalEntryResponse> CreateJournalEntryAsync(CreateJournalEntryDto dto, CancellationToken ct = default)
    {
        var tenantId = _executionContext.TenantId;
        var userId = _executionContext.UserId;

        // Idempotência
        if (!string.IsNullOrWhiteSpace(dto.IdempotencyKey))
        {
            var existing = await _dbContext.FinancialJournalEntries
                .Include(j => j.Lines)
                .FirstOrDefaultAsync(j => j.IdempotencyKey == dto.IdempotencyKey, ct);
            if (existing != null) return MapJournalEntry(existing);
        }

        var entry = new FinancialJournalEntry(
            tenantId,
            dto.BranchId,
            dto.CompetenceDateUtc,
            dto.DocumentNumber,
            dto.SourceType,
            dto.SourceId,
            dto.Description,
            userId,
            dto.CorrelationId,
            dto.IdempotencyKey
        );

        foreach (var lineDto in dto.Lines)
        {
            entry.AddLine(lineDto.AccountId, lineDto.Direction, lineDto.Amount, lineDto.CostCenterId, lineDto.Memo);
        }

        // Validação estrita de partidas dobradas (Débitos == Créditos)
        entry.ValidateBalance();

        _dbContext.FinancialJournalEntries.Add(entry);
        await _dbContext.SaveChangesAsync(ct);

        return MapJournalEntry(entry);
    }

    public async Task<IReadOnlyList<FinancialJournalEntryResponse>> ListJournalEntriesAsync(Guid? branchId, CancellationToken ct = default)
    {
        var query = _dbContext.FinancialJournalEntries
            .Include(j => j.Lines)
            .AsNoTracking();

        if (branchId.HasValue) query = query.Where(j => j.BranchId == branchId.Value);

        var list = await query.OrderByDescending(j => j.CompetenceDateUtc).ToListAsync(ct);
        return list.Select(MapJournalEntry).ToList();
    }

    #endregion

    #region Conciliação Bancária

    public async Task<IReadOnlyList<BankTransactionResponse>> ImportStatementAsync(ImportBankStatementDto dto, CancellationToken ct = default)
    {
        var tenantId = _executionContext.TenantId;
        var bank = await _dbContext.BankAccounts.FirstOrDefaultAsync(b => b.Id == dto.BankAccountId, ct);
        if (bank == null) throw new KeyNotFoundException($"Conta bancária {dto.BankAccountId} não encontrada.");

        var result = new List<BankTransaction>();
        foreach (var item in dto.Transactions)
        {
            // Evitar importação duplicada por FitId
            var exists = await _dbContext.BankTransactions.AnyAsync(t => t.BankAccountId == dto.BankAccountId && t.FitId == item.FitId, ct);
            if (!exists)
            {
                var tx = new BankTransaction(tenantId, dto.BankAccountId, item.TransactionDateUtc, item.Amount, item.FitId, item.Memo);
                _dbContext.BankTransactions.Add(tx);
                result.Add(tx);
            }
        }

        await _dbContext.SaveChangesAsync(ct);
        return result.Select(MapBankTransaction).ToList();
    }

    public async Task<BankTransactionResponse> ReconcileTransactionAsync(Guid transactionId, ReconcileTransactionDto dto, CancellationToken ct = default)
    {
        var tx = await _dbContext.BankTransactions.FirstOrDefaultAsync(t => t.Id == transactionId, ct);
        if (tx == null) throw new KeyNotFoundException($"Transação bancária {transactionId} não encontrada.");

        var entry = await _dbContext.FinancialJournalEntries.FirstOrDefaultAsync(j => j.Id == dto.JournalEntryId, ct);
        if (entry == null) throw new KeyNotFoundException($"Lançamento {dto.JournalEntryId} não encontrado para matching.");

        tx.MarkReconciled(entry.Id);

        var bank = await _dbContext.BankAccounts.FirstOrDefaultAsync(b => b.Id == tx.BankAccountId, ct);
        if (bank != null)
        {
            bank.ApplyReconciliation(tx.Amount);
        }

        await _dbContext.SaveChangesAsync(ct);
        return MapBankTransaction(tx);
    }

    public async Task<IReadOnlyList<BankTransactionResponse>> ListTransactionsAsync(Guid bankAccountId, ReconciliationStatus? status, CancellationToken ct = default)
    {
        var query = _dbContext.BankTransactions.AsNoTracking().Where(t => t.BankAccountId == bankAccountId);
        if (status.HasValue) query = query.Where(t => t.Status == status.Value);

        var list = await query.OrderByDescending(t => t.TransactionDateUtc).ToListAsync(ct);
        return list.Select(MapBankTransaction).ToList();
    }

    #endregion

    #region Relatórios DRE & Fluxo de Caixa

    public async Task<DreReportResponse> GetDreReportAsync(DateTime startDateUtc, DateTime endDateUtc, Guid? branchId, CancellationToken ct = default)
    {
        var query = _dbContext.FinancialJournalEntries
            .Include(j => j.Lines)
            .AsNoTracking()
            .Where(j => j.CompetenceDateUtc >= startDateUtc && j.CompetenceDateUtc <= endDateUtc);

        if (branchId.HasValue) query = query.Where(j => j.BranchId == branchId.Value);

        var entries = await query.ToListAsync(ct);
        var accountIds = entries.SelectMany(e => e.Lines).Select(l => l.FinancialAccountId).Distinct().ToList();
        var accounts = await _dbContext.FinancialAccounts.Where(a => accountIds.Contains(a.Id)).ToDictionaryAsync(a => a.Id, ct);

        decimal grossRevenue = 0;
        decimal deductions = 0;
        decimal cmvAndCosts = 0;
        decimal operatingExpenses = 0;

        foreach (var entry in entries)
        {
            foreach (var line in entry.Lines)
            {
                if (!accounts.TryGetValue(line.FinancialAccountId, out var acc)) continue;

                if (acc.Type == FinancialAccountType.Revenue)
                {
                    // Receita aumenta com Crédito
                    if (line.Direction == JournalLineDirection.Credit) grossRevenue += line.Amount;
                    else deductions += line.Amount;
                }
                else if (acc.Type == FinancialAccountType.Expense)
                {
                    // Se for conta de CMV ou Custos Diretos
                    if (acc.Code.StartsWith("3.1") || acc.Code.StartsWith("CMV"))
                    {
                        if (line.Direction == JournalLineDirection.Debit) cmvAndCosts += line.Amount;
                        else cmvAndCosts -= line.Amount;
                    }
                    else
                    {
                        if (line.Direction == JournalLineDirection.Debit) operatingExpenses += line.Amount;
                        else operatingExpenses -= line.Amount;
                    }
                }
            }
        }

        var netRevenue = grossRevenue - deductions;
        var grossProfit = netRevenue - cmvAndCosts;
        var grossMargin = netRevenue > 0 ? Math.Round((grossProfit / netRevenue) * 100, 2) : 0;
        var netResult = grossProfit - operatingExpenses;
        var netMargin = netRevenue > 0 ? Math.Round((netResult / netRevenue) * 100, 2) : 0;

        return new DreReportResponse(
            startDateUtc,
            endDateUtc,
            grossRevenue,
            deductions,
            netRevenue,
            cmvAndCosts,
            grossProfit,
            grossMargin,
            operatingExpenses,
            netResult, // OperatingResult
            netResult, // NetResult
            netMargin,
            new List<DreCostCenterBreakdown>()
        );
    }

    public async Task<CashFlowForecastResponse> GetCashFlowForecastAsync(Guid? branchId, CancellationToken ct = default)
    {
        var bankQuery = _dbContext.BankAccounts.AsNoTracking();
        if (branchId.HasValue) bankQuery = bankQuery.Where(b => b.BranchId == branchId.Value);
        var currentLiquidBalance = await bankQuery.SumAsync(b => b.CurrentBalance, ct);

        var limitDate = DateTime.UtcNow.AddDays(30);

        var recQuery = _dbContext.AccountsReceivable.AsNoTracking().Where(r => r.Status == ReceivableStatus.Open || r.Status == ReceivableStatus.PartiallyReceived);
        if (branchId.HasValue) recQuery = recQuery.Where(r => r.BranchId == branchId.Value);
        var totalReceivablesNext30Days = await recQuery.Where(r => r.DueDateUtc <= limitDate).SumAsync(r => r.OriginalAmount - r.ReceivedAmount, ct);

        var payQuery = _dbContext.AccountsPayable.AsNoTracking().Where(p => p.Status == PayableStatus.Open || p.Status == PayableStatus.PartiallyPaid);
        if (branchId.HasValue) payQuery = payQuery.Where(p => p.BranchId == branchId.Value);
        var totalPayablesNext30Days = await payQuery.Where(p => p.DueDateUtc <= limitDate).SumAsync(p => p.OriginalAmount - p.PaidAmount, ct);

        var projected = currentLiquidBalance + totalReceivablesNext30Days - totalPayablesNext30Days;
        var workingCapitalReq = Math.Max(0, totalPayablesNext30Days - (currentLiquidBalance + totalReceivablesNext30Days));

        return new CashFlowForecastResponse(
            DateTime.UtcNow,
            currentLiquidBalance,
            totalReceivablesNext30Days,
            totalPayablesNext30Days,
            projected,
            workingCapitalReq
        );
    }

    #endregion

    #region Mapeamentos

    private static AccountPayableResponse MapPayable(AccountPayable p, string? supplierName) => new(
        p.Id,
        p.BranchId,
        p.SupplierPartyId,
        supplierName,
        p.TitleNumber,
        p.Description,
        p.FinancialCostCenterId,
        p.IssueDateUtc,
        p.DueDateUtc,
        p.OriginalAmount,
        p.PaidAmount,
        p.BalanceRemaining,
        p.Status,
        p.DocumentReference,
        p.PurchaseOrderId,
        p.CreatedAtUtc,
        p.Version
    );

    private static AccountReceivableResponse MapReceivable(AccountReceivable r, string? customerName) => new(
        r.Id,
        r.BranchId,
        r.CustomerPartyId,
        customerName,
        r.TitleNumber,
        r.Description,
        r.FinancialCostCenterId,
        r.IssueDateUtc,
        r.DueDateUtc,
        r.OriginalAmount,
        r.ReceivedAmount,
        r.BalanceRemaining,
        r.Status,
        r.DocumentReference,
        r.SaleId,
        r.CreatedAtUtc,
        r.Version
    );

    private static FinancialJournalEntryResponse MapJournalEntry(FinancialJournalEntry j) => new(
        j.Id,
        j.BranchId,
        j.CompetenceDateUtc,
        j.DocumentNumber,
        j.SourceType,
        j.SourceId,
        j.Description,
        j.TotalAmount,
        j.Lines.Select(l => new FinancialJournalLineResponse(
            l.Id,
            l.FinancialAccountId,
            null,
            null,
            l.Direction,
            l.Amount,
            l.FinancialCostCenterId,
            l.Memo
        )).ToList(),
        j.CreatedAtUtc,
        j.Version
    );

    private static BankTransactionResponse MapBankTransaction(BankTransaction t) => new(
        t.Id,
        t.BankAccountId,
        t.TransactionDateUtc,
        t.Amount,
        t.FitId,
        t.Memo,
        t.Status,
        t.MatchedJournalEntryId,
        t.ReconciledAtUtc
    );

    #endregion
}
