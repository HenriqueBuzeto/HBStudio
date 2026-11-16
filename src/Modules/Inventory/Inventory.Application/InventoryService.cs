using Microsoft.EntityFrameworkCore;
using BuildingBlocks.Application;
using BuildingBlocks.Infrastructure;
using Inventory.Domain;
using Catalog.Domain;

namespace Inventory.Application;

public class InventoryService
{
    private readonly AppDbContext _dbContext;
    private readonly IExecutionContext _executionContext;

    public InventoryService(AppDbContext dbContext, IExecutionContext executionContext)
    {
        _dbContext = dbContext;
        _executionContext = executionContext;
    }

    #region Warehouses & Locations

    public async Task<IReadOnlyList<WarehouseResponse>> ListWarehousesAsync(Guid? branchId, CancellationToken ct = default)
    {
        var query = _dbContext.Warehouses.AsNoTracking();
        if (branchId.HasValue)
        {
            query = query.Where(w => w.BranchId == branchId.Value);
        }

        var list = await query.OrderBy(w => w.Code).ToListAsync(ct);
        return list.Select(w => new WarehouseResponse(
            w.Id,
            w.BranchId,
            w.Code,
            w.Name,
            w.Type,
            w.Description,
            w.IsActive,
            w.CreatedAtUtc,
            w.Version
        )).ToList();
    }

    public async Task<WarehouseResponse> CreateWarehouseAsync(CreateWarehouseRequest request, CancellationToken ct = default)
    {
        var tenantId = _executionContext.TenantId;
        var exists = await _dbContext.Warehouses.AnyAsync(w => w.BranchId == request.BranchId && w.Code == request.Code.Trim().ToUpperInvariant(), ct);
        if (exists)
            throw new InvalidOperationException($"Já existe um almoxarifado com código '{request.Code}' nesta filial.");

        var warehouse = new Warehouse(tenantId, request.BranchId, request.Code, request.Name, request.Type, request.Description);
        _dbContext.Warehouses.Add(warehouse);
        await _dbContext.SaveChangesAsync(ct);

        return new WarehouseResponse(warehouse.Id, warehouse.BranchId, warehouse.Code, warehouse.Name, warehouse.Type, warehouse.Description, warehouse.IsActive, warehouse.CreatedAtUtc, warehouse.Version);
    }

    public async Task<IReadOnlyList<WarehouseLocationResponse>> ListLocationsAsync(Guid warehouseId, CancellationToken ct = default)
    {
        var locations = await _dbContext.WarehouseLocations
            .AsNoTracking()
            .Where(l => l.WarehouseId == warehouseId)
            .OrderBy(l => l.Code)
            .ToListAsync(ct);

        return locations.Select(l => new WarehouseLocationResponse(
            l.Id,
            l.WarehouseId,
            l.Code,
            l.Aisle,
            l.Shelf,
            l.Bin,
            l.Description,
            l.IsBlocked,
            l.CreatedAtUtc,
            l.Version
        )).ToList();
    }

    public async Task<WarehouseLocationResponse> AddLocationAsync(Guid warehouseId, CreateWarehouseLocationRequest request, CancellationToken ct = default)
    {
        var warehouse = await _dbContext.Warehouses.FirstOrDefaultAsync(w => w.Id == warehouseId, ct);
        if (warehouse == null)
            throw new KeyNotFoundException($"Almoxarifado {warehouseId} não encontrado.");

        var location = warehouse.AddLocation(request.Aisle, request.Shelf, request.Bin, request.Description);
        _dbContext.WarehouseLocations.Add(location);
        await _dbContext.SaveChangesAsync(ct);

        return new WarehouseLocationResponse(location.Id, location.WarehouseId, location.Code, location.Aisle, location.Shelf, location.Bin, location.Description, location.IsBlocked, location.CreatedAtUtc, location.Version);
    }

    #endregion

    #region Stock Movements & Kardex

    public async Task<StockMovementResponse> RegisterInitialReceiptAsync(InitialStockReceiptRequest request, bool canViewCost, CancellationToken ct = default)
    {
        var tenantId = _executionContext.TenantId;
        var userId = _executionContext.UserId;

        if (request.Quantity <= 0)
            throw new ArgumentException("A quantidade recebida deve ser estritamente positiva.");

        // Idempotência
        if (!string.IsNullOrWhiteSpace(request.IdempotencyKey))
        {
            var existing = await _dbContext.StockMovements
                .Include(m => m.Warehouse)
                .Include(m => m.WarehouseLocation)
                .Include(m => m.ProductSku)
                .Include(m => m.InventoryUnit)
                .FirstOrDefaultAsync(m => m.IdempotencyKey == request.IdempotencyKey.Trim(), ct);

            if (existing != null)
            {
                return MapMovement(existing, canViewCost);
            }
        }

        // Validação do SKU
        var sku = await _dbContext.ProductSkus
            .Include(s => s.ProductModel)
            .FirstOrDefaultAsync(s => s.Id == request.ProductSkuId, ct);

        if (sku == null)
            throw new KeyNotFoundException($"SKU {request.ProductSkuId} não encontrado.");

        // Se for estritamente serializado, a quantidade deve ser 1 e exigir unidade física válida
        if (sku.ProductModel?.SerializationPolicy == SerializationPolicy.StrictSerialized)
        {
            if (request.Quantity != 1)
                throw new ArgumentException("Produtos com serialização rigorosa devem ser movimentados estritamente com quantidade = 1.");
            if (!request.InventoryUnitId.HasValue)
                throw new ArgumentException("Unidade física (InventoryUnitId) é obrigatória para produtos serializados.");

            var unit = await _dbContext.InventoryUnits.FirstOrDefaultAsync(u => u.Id == request.InventoryUnitId.Value, ct);
            if (unit == null)
                throw new KeyNotFoundException($"Unidade física {request.InventoryUnitId.Value} não encontrada.");

            // Criar ou atualizar a posição serial
            var position = await _dbContext.SerialStockPositions.FirstOrDefaultAsync(p => p.InventoryUnitId == unit.Id, ct);
            if (position == null)
            {
                position = new SerialStockPosition(tenantId, unit.Id, sku.Id, request.BranchId, request.WarehouseId, request.WarehouseLocationId);
                _dbContext.SerialStockPositions.Add(position);
            }
            else
            {
                position.Move(request.BranchId, request.WarehouseId, request.WarehouseLocationId);
            }
        }

        // Localizar ou criar a projeção de saldo materializado
        var balance = await _dbContext.StockBalances
            .FirstOrDefaultAsync(b => b.BranchId == request.BranchId &&
                                      b.WarehouseId == request.WarehouseId &&
                                      b.WarehouseLocationId == request.WarehouseLocationId &&
                                      b.ProductSkuId == request.ProductSkuId, ct);

        if (balance == null)
        {
            balance = new StockBalance(tenantId, request.BranchId, request.WarehouseId, request.WarehouseLocationId, request.ProductSkuId);
            _dbContext.StockBalances.Add(balance);
        }

        // Aplica o movimento na projeção de saldo
        balance.ApplyMovement(request.Quantity, request.UnitCost);

        // Cria o registro append-only no Kardex
        var movement = new StockMovement(
            tenantId,
            request.BranchId,
            request.WarehouseId,
            request.WarehouseLocationId,
            request.ProductSkuId,
            request.InventoryUnitId,
            StockMovementType.InitialBalance,
            request.Quantity,
            request.UnitCost,
            balance.OnHandQuantity,
            request.DocumentReference,
            request.Reason,
            correlationId: null,
            request.IdempotencyKey,
            userId
        );

        _dbContext.StockMovements.Add(movement);
        await _dbContext.SaveChangesAsync(ct);

        // Recarrega navegação para o response
        var created = await _dbContext.StockMovements
            .Include(m => m.Warehouse)
            .Include(m => m.WarehouseLocation)
            .Include(m => m.ProductSku)
            .Include(m => m.InventoryUnit)
            .FirstAsync(m => m.Id == movement.Id, ct);

        return MapMovement(created, canViewCost);
    }

    public async Task<IReadOnlyList<StockBalanceResponse>> ListBalancesAsync(
        Guid? branchId,
        Guid? warehouseId,
        Guid? skuId,
        bool canViewCost,
        CancellationToken ct = default)
    {
        var query = _dbContext.StockBalances
            .Include(b => b.Warehouse)
            .Include(b => b.WarehouseLocation)
            .Include(b => b.ProductSku)
            .AsNoTracking();

        if (branchId.HasValue) query = query.Where(b => b.BranchId == branchId.Value);
        if (warehouseId.HasValue) query = query.Where(b => b.WarehouseId == warehouseId.Value);
        if (skuId.HasValue) query = query.Where(b => b.ProductSkuId == skuId.Value);

        var list = await query.OrderBy(b => b.ProductSku!.SkuCode).ToListAsync(ct);

        return list.Select(b => new StockBalanceResponse(
            b.Id,
            b.BranchId,
            b.WarehouseId,
            b.Warehouse?.Name ?? string.Empty,
            b.WarehouseLocationId,
            b.WarehouseLocation?.Code,
            b.ProductSkuId,
            b.ProductSku?.SkuCode ?? string.Empty,
            b.ProductSku?.VariantName ?? string.Empty,
            b.OnHandQuantity,
            b.ReservedQuantity,
            b.BlockedQuantity,
            b.AvailableQuantity,
            canViewCost ? b.AverageCost : null,
            canViewCost ? Math.Round(b.OnHandQuantity * b.AverageCost, 2) : null,
            b.LastMovementAtUtc,
            b.Version
        )).ToList();
    }

    public async Task<IReadOnlyList<StockMovementResponse>> GetKardexAsync(
        Guid? branchId,
        Guid? warehouseId,
        Guid? skuId,
        Guid? inventoryUnitId,
        bool canViewCost,
        CancellationToken ct = default)
    {
        var query = _dbContext.StockMovements
            .Include(m => m.Warehouse)
            .Include(m => m.WarehouseLocation)
            .Include(m => m.ProductSku)
            .Include(m => m.InventoryUnit)
            .AsNoTracking();

        if (branchId.HasValue) query = query.Where(m => m.BranchId == branchId.Value);
        if (warehouseId.HasValue) query = query.Where(m => m.WarehouseId == warehouseId.Value);
        if (skuId.HasValue) query = query.Where(m => m.ProductSkuId == skuId.Value);
        if (inventoryUnitId.HasValue) query = query.Where(m => m.InventoryUnitId == inventoryUnitId.Value);

        var list = await query.OrderByDescending(m => m.CreatedAtUtc).ToListAsync(ct);
        return list.Select(m => MapMovement(m, canViewCost)).ToList();
    }

    #endregion

    #region Reservations

    public async Task<StockReservationResponse> CreateReservationAsync(CreateReservationRequest request, CancellationToken ct = default)
    {
        var tenantId = _executionContext.TenantId;

        // Idempotência
        if (!string.IsNullOrWhiteSpace(request.IdempotencyKey))
        {
            var existing = await _dbContext.StockReservations
                .Include(r => r.Items)
                .FirstOrDefaultAsync(r => r.IdempotencyKey == request.IdempotencyKey.Trim(), ct);

            if (existing != null)
                return MapReservation(existing);
        }

        var existsNumber = await _dbContext.StockReservations.AnyAsync(r => r.ReservationNumber == request.ReservationNumber.Trim().ToUpperInvariant(), ct);
        if (existsNumber)
            throw new InvalidOperationException($"Já existe uma reserva com o número '{request.ReservationNumber}'.");

        var reservation = new StockReservation(
            tenantId,
            request.BranchId,
            request.ReservationNumber,
            request.Reason,
            request.ExpiresAtUtc,
            request.DocumentReference,
            request.IdempotencyKey
        );

        foreach (var itemReq in request.Items)
        {
            // Bloqueio atômico de saldo
            var balance = await _dbContext.StockBalances
                .FirstOrDefaultAsync(b => b.BranchId == request.BranchId &&
                                          b.WarehouseId == itemReq.WarehouseId &&
                                          b.WarehouseLocationId == itemReq.WarehouseLocationId &&
                                          b.ProductSkuId == itemReq.ProductSkuId, ct);

            if (balance == null || balance.AvailableQuantity < itemReq.Quantity)
            {
                throw new InvalidOperationException($"Saldo disponível insuficiente para reservar o SKU {itemReq.ProductSkuId}. Disponível: {balance?.AvailableQuantity ?? 0}, Solicitado: {itemReq.Quantity}");
            }

            balance.Reserve(itemReq.Quantity);

            // Se for serializada, bloquear a posição serial
            if (itemReq.InventoryUnitId.HasValue)
            {
                var serialPos = await _dbContext.SerialStockPositions
                    .FirstOrDefaultAsync(p => p.InventoryUnitId == itemReq.InventoryUnitId.Value, ct);

                if (serialPos == null || !serialPos.IsInStock || serialPos.IsReserved)
                {
                    throw new InvalidOperationException($"Unidade serial {itemReq.InventoryUnitId.Value} indisponível para reserva.");
                }

                serialPos.SetReserved(reservation.Id);
            }

            reservation.AddItem(itemReq.WarehouseId, itemReq.WarehouseLocationId, itemReq.ProductSkuId, itemReq.Quantity, itemReq.InventoryUnitId);
        }

        _dbContext.StockReservations.Add(reservation);
        await _dbContext.SaveChangesAsync(ct);

        return MapReservation(reservation);
    }

    public async Task<StockReservationResponse> ExpireReservationAsync(Guid reservationId, CancellationToken ct = default)
    {
        var reservation = await _dbContext.StockReservations
            .Include(r => r.Items)
            .FirstOrDefaultAsync(r => r.Id == reservationId, ct);

        if (reservation == null)
            throw new KeyNotFoundException($"Reserva {reservationId} não encontrada.");

        reservation.MarkExpired();

        foreach (var item in reservation.Items)
        {
            var balance = await _dbContext.StockBalances
                .FirstOrDefaultAsync(b => b.BranchId == reservation.BranchId &&
                                          b.WarehouseId == item.WarehouseId &&
                                          b.WarehouseLocationId == item.WarehouseLocationId &&
                                          b.ProductSkuId == item.ProductSkuId, ct);

            balance?.ReleaseReservation(item.Quantity);

            if (item.InventoryUnitId.HasValue)
            {
                var serialPos = await _dbContext.SerialStockPositions
                    .FirstOrDefaultAsync(p => p.InventoryUnitId == item.InventoryUnitId.Value, ct);

                serialPos?.ReleaseReservation();
            }
        }

        await _dbContext.SaveChangesAsync(ct);
        return MapReservation(reservation);
    }

    public async Task<StockReservationResponse> ReleaseReservationAsync(Guid reservationId, CancellationToken ct = default)
    {
        var reservation = await _dbContext.StockReservations
            .Include(r => r.Items)
            .FirstOrDefaultAsync(r => r.Id == reservationId, ct);

        if (reservation == null)
            throw new KeyNotFoundException($"Reserva {reservationId} não encontrada.");

        reservation.MarkReleased();

        foreach (var item in reservation.Items)
        {
            var balance = await _dbContext.StockBalances
                .FirstOrDefaultAsync(b => b.BranchId == reservation.BranchId &&
                                          b.WarehouseId == item.WarehouseId &&
                                          b.WarehouseLocationId == item.WarehouseLocationId &&
                                          b.ProductSkuId == item.ProductSkuId, ct);

            balance?.ReleaseReservation(item.Quantity);

            if (item.InventoryUnitId.HasValue)
            {
                var serialPos = await _dbContext.SerialStockPositions
                    .FirstOrDefaultAsync(p => p.InventoryUnitId == item.InventoryUnitId.Value, ct);

                serialPos?.ReleaseReservation();
            }
        }

        await _dbContext.SaveChangesAsync(ct);
        return MapReservation(reservation);
    }

    public async Task<StockReservationResponse> ConsumeReservationAsync(Guid reservationId, CancellationToken ct = default)
    {
        var tenantId = _executionContext.TenantId;
        var userId = _executionContext.UserId;

        var reservation = await _dbContext.StockReservations
            .Include(r => r.Items)
            .FirstOrDefaultAsync(r => r.Id == reservationId, ct);

        if (reservation == null)
            throw new KeyNotFoundException($"Reserva {reservationId} não encontrada.");

        reservation.MarkConsumed();

        foreach (var item in reservation.Items)
        {
            var balance = await _dbContext.StockBalances
                .FirstOrDefaultAsync(b => b.BranchId == reservation.BranchId &&
                                          b.WarehouseId == item.WarehouseId &&
                                          b.WarehouseLocationId == item.WarehouseLocationId &&
                                          b.ProductSkuId == item.ProductSkuId, ct);

            if (balance == null)
                throw new InvalidOperationException($"Saldo não encontrado para consumo da reserva.");

            balance.ConsumeReservation(item.Quantity);

            if (item.InventoryUnitId.HasValue)
            {
                var serialPos = await _dbContext.SerialStockPositions
                    .FirstOrDefaultAsync(p => p.InventoryUnitId == item.InventoryUnitId.Value, ct);

                serialPos?.DispatchSaleOrConsumption();
            }

            // Registrar a baixa no Kardex
            var movement = new StockMovement(
                tenantId,
                reservation.BranchId,
                item.WarehouseId,
                item.WarehouseLocationId,
                item.ProductSkuId,
                item.InventoryUnitId,
                StockMovementType.SaleIssue,
                -item.Quantity,
                balance.AverageCost,
                balance.OnHandQuantity,
                $"RESERVA-{reservation.ReservationNumber}",
                $"Consumo de reserva confirmada ({reservation.Reason})",
                correlationId: reservation.Id,
                idempotencyKey: null,
                userId
            );

            _dbContext.StockMovements.Add(movement);
        }

        await _dbContext.SaveChangesAsync(ct);
        return MapReservation(reservation);
    }

    #endregion

    #region Transfers

    public async Task<StockTransferResponse> CreateTransferAsync(CreateTransferRequest request, CancellationToken ct = default)
    {
        var tenantId = _executionContext.TenantId;
        var userId = _executionContext.UserId;

        var exists = await _dbContext.StockTransfers.AnyAsync(t => t.TransferNumber == request.TransferNumber.Trim().ToUpperInvariant(), ct);
        if (exists)
            throw new InvalidOperationException($"Já existe uma transferência com o número '{request.TransferNumber}'.");

        var transfer = new StockTransfer(
            tenantId,
            request.TransferNumber,
            request.SourceBranchId,
            request.SourceWarehouseId,
            request.TargetBranchId,
            request.TargetWarehouseId,
            userId,
            request.Notes
        );

        foreach (var item in request.Items)
        {
            transfer.AddItem(item.ProductSkuId, item.Quantity, item.InventoryUnitId);
        }

        _dbContext.StockTransfers.Add(transfer);
        await _dbContext.SaveChangesAsync(ct);

        return MapTransfer(transfer);
    }

    public async Task<StockTransferResponse> DispatchTransferAsync(Guid transferId, CancellationToken ct = default)
    {
        var tenantId = _executionContext.TenantId;
        var userId = _executionContext.UserId;

        var transfer = await _dbContext.StockTransfers
            .Include(t => t.Items)
            .FirstOrDefaultAsync(t => t.Id == transferId, ct);

        if (transfer == null)
            throw new KeyNotFoundException($"Transferência {transferId} não encontrada.");

        if (transfer.Status == TransferStatus.Draft)
            transfer.Submit();

        transfer.Dispatch();

        // Baixa do depósito de origem
        foreach (var item in transfer.Items)
        {
            var sourceBalance = await _dbContext.StockBalances
                .FirstOrDefaultAsync(b => b.BranchId == transfer.SourceBranchId &&
                                          b.WarehouseId == transfer.SourceWarehouseId &&
                                          b.ProductSkuId == item.ProductSkuId, ct);

            if (sourceBalance == null || sourceBalance.AvailableQuantity < item.Quantity)
            {
                throw new InvalidOperationException($"Saldo de origem insuficiente para despachar a transferência.");
            }

            var unitCost = sourceBalance.AverageCost;
            sourceBalance.ApplyMovement(-item.Quantity, unitCost);

            // Movimento de saída no Kardex
            var outMovement = new StockMovement(
                tenantId,
                transfer.SourceBranchId,
                transfer.SourceWarehouseId,
                null,
                item.ProductSkuId,
                item.InventoryUnitId,
                StockMovementType.TransferOut,
                -item.Quantity,
                unitCost,
                sourceBalance.OnHandQuantity,
                $"TRANSF-{transfer.TransferNumber}",
                $"Despacho para Depósito {transfer.TargetWarehouseId}",
                correlationId: transfer.Id,
                idempotencyKey: null,
                userId
            );

            _dbContext.StockMovements.Add(outMovement);
        }

        await _dbContext.SaveChangesAsync(ct);
        return MapTransfer(transfer);
    }

    public async Task<StockTransferResponse> ReceiveTransferAsync(Guid transferId, CancellationToken ct = default)
    {
        var tenantId = _executionContext.TenantId;
        var userId = _executionContext.UserId;

        var transfer = await _dbContext.StockTransfers
            .Include(t => t.Items)
            .FirstOrDefaultAsync(t => t.Id == transferId, ct);

        if (transfer == null)
            throw new KeyNotFoundException($"Transferência {transferId} não encontrada.");

        transfer.Receive();

        // Entrada no depósito de destino
        foreach (var item in transfer.Items)
        {
            // Recuperar custo unitário da saída correspondente
            var lastOut = await _dbContext.StockMovements
                .Where(m => m.CorrelationId == transfer.Id && m.ProductSkuId == item.ProductSkuId && m.MovementType == StockMovementType.TransferOut)
                .FirstOrDefaultAsync(ct);

            var unitCost = lastOut?.UnitCost ?? 0;

            var targetBalance = await _dbContext.StockBalances
                .FirstOrDefaultAsync(b => b.BranchId == transfer.TargetBranchId &&
                                          b.WarehouseId == transfer.TargetWarehouseId &&
                                          b.ProductSkuId == item.ProductSkuId, ct);

            if (targetBalance == null)
            {
                targetBalance = new StockBalance(tenantId, transfer.TargetBranchId, transfer.TargetWarehouseId, null, item.ProductSkuId);
                _dbContext.StockBalances.Add(targetBalance);
            }

            targetBalance.ApplyMovement(item.Quantity, unitCost);

            // Mover posição serial se houver
            if (item.InventoryUnitId.HasValue)
            {
                var serialPos = await _dbContext.SerialStockPositions.FirstOrDefaultAsync(p => p.InventoryUnitId == item.InventoryUnitId.Value, ct);
                serialPos?.Move(transfer.TargetBranchId, transfer.TargetWarehouseId, null);
            }

            // Movimento de entrada no Kardex
            var inMovement = new StockMovement(
                tenantId,
                transfer.TargetBranchId,
                transfer.TargetWarehouseId,
                null,
                item.ProductSkuId,
                item.InventoryUnitId,
                StockMovementType.TransferIn,
                item.Quantity,
                unitCost,
                targetBalance.OnHandQuantity,
                $"TRANSF-{transfer.TransferNumber}",
                $"Recebimento do Depósito {transfer.SourceWarehouseId}",
                correlationId: transfer.Id,
                idempotencyKey: null,
                userId
            );

            _dbContext.StockMovements.Add(inMovement);
        }

        await _dbContext.SaveChangesAsync(ct);
        return MapTransfer(transfer);
    }

    #endregion

    #region Inventory Count (Inventário Físico)

    public async Task<InventoryCountResponse> CreateCountAsync(CreateInventoryCountRequest request, CancellationToken ct = default)
    {
        var tenantId = _executionContext.TenantId;
        var userId = _executionContext.UserId;

        var exists = await _dbContext.InventoryCounts.AnyAsync(c => c.CountNumber == request.CountNumber.Trim().ToUpperInvariant(), ct);
        if (exists)
            throw new InvalidOperationException($"Já existe um inventário com o número '{request.CountNumber}'.");

        var count = new InventoryCount(
            tenantId,
            request.BranchId,
            request.WarehouseId,
            request.CountNumber,
            request.Description,
            userId
        );

        count.Start();

        _dbContext.InventoryCounts.Add(count);
        await _dbContext.SaveChangesAsync(ct);

        return MapCount(count);
    }

    public async Task<InventoryCountResponse> RecordCountItemAsync(Guid countId, RecordCountItemRequest request, CancellationToken ct = default)
    {
        var count = await _dbContext.InventoryCounts
            .Include(c => c.Items)
            .FirstOrDefaultAsync(c => c.Id == countId, ct);

        if (count == null)
            throw new KeyNotFoundException($"Inventário {countId} não encontrado.");

        var existing = count.Items.FirstOrDefault(i => i.ProductSkuId == request.ProductSkuId && i.InventoryUnitId == request.InventoryUnitId);
        if (existing != null)
        {
            existing.UpdateCount(request.CountedQuantity, request.Notes);
        }
        else
        {
            var item = new InventoryCountItem(count.TenantId, count.Id, request.ProductSkuId, request.SystemSnapshotQuantity, request.CountedQuantity, request.InventoryUnitId, request.Notes);
            _dbContext.InventoryCountItems.Add(item);
        }

        await _dbContext.SaveChangesAsync(ct);

        return await _dbContext.InventoryCounts
            .Include(c => c.Items)
            .AsNoTracking()
            .Where(c => c.Id == countId)
            .Select(c => MapCount(c))
            .FirstAsync(ct);
    }

    public async Task<InventoryCountResponse> ApproveAndPostCountAsync(Guid countId, CancellationToken ct = default)
    {
        var tenantId = _executionContext.TenantId;
        var userId = _executionContext.UserId;

        var count = await _dbContext.InventoryCounts
            .Include(c => c.Items)
            .FirstOrDefaultAsync(c => c.Id == countId, ct);

        if (count == null)
            throw new KeyNotFoundException($"Inventário {countId} não encontrado.");

        if (count.Status == InventoryCountStatus.InProgress)
            count.SubmitForApproval();

        count.ApproveAndPost(userId);

        foreach (var item in count.Items)
        {
            if (item.VarianceQuantity == 0) continue;

            var balance = await _dbContext.StockBalances
                .FirstOrDefaultAsync(b => b.BranchId == count.BranchId &&
                                          b.WarehouseId == count.WarehouseId &&
                                          b.ProductSkuId == item.ProductSkuId, ct);

            if (balance == null)
            {
                balance = new StockBalance(tenantId, count.BranchId, count.WarehouseId, null, item.ProductSkuId);
                _dbContext.StockBalances.Add(balance);
            }

            var movementType = item.VarianceQuantity > 0 ? StockMovementType.PositiveAdjustment : StockMovementType.NegativeAdjustment;
            var unitCost = balance.AverageCost;

            balance.ApplyMovement(item.VarianceQuantity, unitCost);

            var movement = new StockMovement(
                tenantId,
                count.BranchId,
                count.WarehouseId,
                null,
                item.ProductSkuId,
                item.InventoryUnitId,
                movementType,
                item.VarianceQuantity,
                unitCost,
                balance.OnHandQuantity,
                $"INV-{count.CountNumber}",
                $"Reconciliação de inventário: {item.Notes ?? "Ajuste de saldo físico"}",
                correlationId: count.Id,
                idempotencyKey: null,
                userId
            );

            _dbContext.StockMovements.Add(movement);
        }

        await _dbContext.SaveChangesAsync(ct);
        return MapCount(count);
    }

    #endregion

    #region Helper Mappers

    private static StockMovementResponse MapMovement(StockMovement m, bool canViewCost)
    {
        var serialOrImei = m.InventoryUnit != null
            ? (m.InventoryUnit.Imei1 ?? m.InventoryUnit.SerialNumber)
            : null;

        return new StockMovementResponse(
            m.Id,
            m.BranchId,
            m.WarehouseId,
            m.Warehouse?.Name ?? string.Empty,
            m.WarehouseLocationId,
            m.WarehouseLocation?.Code,
            m.ProductSkuId,
            m.ProductSku?.SkuCode ?? string.Empty,
            m.InventoryUnitId,
            serialOrImei,
            m.MovementType,
            m.Quantity,
            canViewCost ? m.UnitCost : null,
            canViewCost ? m.TotalCost : null,
            m.BalanceAfterQuantity,
            m.DocumentReference,
            m.Reason,
            m.CreatedAtUtc,
            m.CreatedByUserId
        );
    }

    private static StockReservationResponse MapReservation(StockReservation r)
    {
        return new StockReservationResponse(
            r.Id,
            r.BranchId,
            r.ReservationNumber,
            r.Status,
            r.Reason,
            r.DocumentReference,
            r.ExpiresAtUtc,
            r.CreatedAtUtc,
            r.Version,
            r.Items.Select(i => new StockReservationItemResponse(i.Id, i.WarehouseId, i.WarehouseLocationId, i.ProductSkuId, i.Quantity, i.InventoryUnitId)).ToList()
        );
    }

    private static StockTransferResponse MapTransfer(StockTransfer t)
    {
        return new StockTransferResponse(
            t.Id,
            t.TransferNumber,
            t.SourceBranchId,
            t.SourceWarehouseId,
            t.TargetBranchId,
            t.TargetWarehouseId,
            t.Status,
            t.Notes,
            t.DispatchedAtUtc,
            t.ReceivedAtUtc,
            t.CreatedAtUtc,
            t.Version,
            t.Items.Select(i => new StockTransferItemResponse(i.Id, i.ProductSkuId, i.Quantity, i.InventoryUnitId)).ToList()
        );
    }

    private static InventoryCountResponse MapCount(InventoryCount c)
    {
        return new InventoryCountResponse(
            c.Id,
            c.CountNumber,
            c.BranchId,
            c.WarehouseId,
            c.Status,
            c.Description,
            c.PostedAtUtc,
            c.CreatedAtUtc,
            c.Version,
            c.Items.Select(i => new InventoryCountItemResponse(i.Id, i.ProductSkuId, i.InventoryUnitId, i.SystemSnapshotQuantity, i.CountedQuantity, i.VarianceQuantity, i.Notes)).ToList()
        );
    }

    #endregion
}
