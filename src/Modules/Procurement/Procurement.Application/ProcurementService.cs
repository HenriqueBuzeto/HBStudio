using Microsoft.EntityFrameworkCore;
using BuildingBlocks.Application;
using BuildingBlocks.Infrastructure;
using Procurement.Domain;
using Catalog.Domain;
using Inventory.Domain;
using Parties.Domain;

namespace Procurement.Application;

public class ProcurementService
{
    private readonly AppDbContext _dbContext;
    private readonly IExecutionContext _executionContext;

    public ProcurementService(AppDbContext dbContext, IExecutionContext executionContext)
    {
        _dbContext = dbContext;
        _executionContext = executionContext;
    }

    #region Purchase Requests

    public async Task<IReadOnlyList<PurchaseRequestResponse>> ListPurchaseRequestsAsync(
        Guid? branchId,
        PurchaseRequestStatus? status,
        bool canViewCost,
        CancellationToken ct = default)
    {
        var query = _dbContext.PurchaseRequests
            .Include(r => r.Items)
            .AsNoTracking();

        if (branchId.HasValue) query = query.Where(r => r.BranchId == branchId.Value);
        if (status.HasValue) query = query.Where(r => r.Status == status.Value);

        var list = await query.OrderByDescending(r => r.CreatedAtUtc).ToListAsync(ct);

        var skuIds = list.SelectMany(r => r.Items).Select(i => i.ProductSkuId).Distinct().ToList();
        var skus = await _dbContext.ProductSkus
            .Include(s => s.ProductModel)
            .Where(s => skuIds.Contains(s.Id))
            .ToDictionaryAsync(s => s.Id, ct);

        return list.Select(r => MapPurchaseRequest(r, skus, canViewCost)).ToList();
    }

    public async Task<PurchaseRequestResponse> GetPurchaseRequestByIdAsync(Guid id, bool canViewCost, CancellationToken ct = default)
    {
        var request = await _dbContext.PurchaseRequests
            .Include(r => r.Items)
            .FirstOrDefaultAsync(r => r.Id == id, ct);

        if (request == null)
            throw new KeyNotFoundException($"Requisição de compra {id} não encontrada.");

        var skuIds = request.Items.Select(i => i.ProductSkuId).Distinct().ToList();
        var skus = await _dbContext.ProductSkus
            .Include(s => s.ProductModel)
            .Where(s => skuIds.Contains(s.Id))
            .ToDictionaryAsync(s => s.Id, ct);

        return MapPurchaseRequest(request, skus, canViewCost);
    }

    public async Task<PurchaseRequestResponse> CreatePurchaseRequestAsync(CreatePurchaseRequestDto dto, bool canViewCost, CancellationToken ct = default)
    {
        var tenantId = _executionContext.TenantId;
        var userId = _executionContext.UserId;

        var exists = await _dbContext.PurchaseRequests.AnyAsync(r => r.RequestNumber == dto.RequestNumber.Trim().ToUpperInvariant(), ct);
        if (exists)
            throw new InvalidOperationException($"Requisição de compra com número '{dto.RequestNumber}' já existe.");

        var request = new PurchaseRequest(tenantId, dto.BranchId, dto.RequestNumber, dto.Justification, dto.RequiredDateUtc, userId);

        foreach (var item in dto.Items)
        {
            var skuExists = await _dbContext.ProductSkus.AnyAsync(s => s.Id == item.ProductSkuId, ct);
            if (!skuExists)
                throw new KeyNotFoundException($"SKU {item.ProductSkuId} não encontrado.");

            request.AddItem(item.ProductSkuId, item.Quantity, item.EstimatedUnitCost, item.Notes);
        }

        _dbContext.PurchaseRequests.Add(request);
        await _dbContext.SaveChangesAsync(ct);

        return await GetPurchaseRequestByIdAsync(request.Id, canViewCost, ct);
    }

    public async Task<PurchaseRequestResponse> SubmitPurchaseRequestAsync(Guid id, bool canViewCost, CancellationToken ct = default)
    {
        var request = await _dbContext.PurchaseRequests
            .Include(r => r.Items)
            .FirstOrDefaultAsync(r => r.Id == id, ct);

        if (request == null)
            throw new KeyNotFoundException($"Requisição de compra {id} não encontrada.");

        request.Submit();
        await _dbContext.SaveChangesAsync(ct);

        return await GetPurchaseRequestByIdAsync(id, canViewCost, ct);
    }

    public async Task<PurchaseRequestResponse> ApprovePurchaseRequestAsync(Guid id, string? notes, bool canViewCost, CancellationToken ct = default)
    {
        var request = await _dbContext.PurchaseRequests
            .Include(r => r.Items)
            .FirstOrDefaultAsync(r => r.Id == id, ct);

        if (request == null)
            throw new KeyNotFoundException($"Requisição de compra {id} não encontrada.");

        request.Approve(_executionContext.UserId, notes);
        await _dbContext.SaveChangesAsync(ct);

        return await GetPurchaseRequestByIdAsync(id, canViewCost, ct);
    }

    public async Task<PurchaseRequestResponse> RejectPurchaseRequestAsync(Guid id, string notes, bool canViewCost, CancellationToken ct = default)
    {
        var request = await _dbContext.PurchaseRequests
            .Include(r => r.Items)
            .FirstOrDefaultAsync(r => r.Id == id, ct);

        if (request == null)
            throw new KeyNotFoundException($"Requisição de compra {id} não encontrada.");

        request.Reject(_executionContext.UserId, notes);
        await _dbContext.SaveChangesAsync(ct);

        return await GetPurchaseRequestByIdAsync(id, canViewCost, ct);
    }

    private static PurchaseRequestResponse MapPurchaseRequest(PurchaseRequest r, Dictionary<Guid, ProductSku> skus, bool canViewCost)
    {
        var items = r.Items.Select(i =>
        {
            skus.TryGetValue(i.ProductSkuId, out var sku);
            return new PurchaseRequestItemResponse(
                i.Id,
                i.ProductSkuId,
                sku?.SkuCode,
                sku?.VariantName,
                i.Quantity,
                canViewCost ? i.EstimatedUnitCost : null,
                canViewCost ? i.EstimatedTotalCost : null,
                i.Notes
            );
        }).ToList();

        decimal? totalEstimated = canViewCost ? r.Items.Sum(i => i.EstimatedTotalCost) : null;

        return new PurchaseRequestResponse(
            r.Id,
            r.BranchId,
            r.RequestNumber,
            r.Status,
            r.Justification,
            r.RequiredDateUtc,
            r.RequestedByUserId,
            r.ApprovedByUserId,
            r.DecidedAtUtc,
            r.DecisionNotes,
            totalEstimated,
            items,
            r.CreatedAtUtc,
            r.Version
        );
    }

    #endregion

    #region Supplier Quotations

    public async Task<IReadOnlyList<SupplierQuotationResponse>> ListSupplierQuotationsAsync(
        Guid? branchId,
        Guid? supplierPartyId,
        QuotationStatus? status,
        bool canViewCost,
        CancellationToken ct = default)
    {
        var query = _dbContext.SupplierQuotations
            .Include(q => q.Items)
            .AsNoTracking();

        if (branchId.HasValue) query = query.Where(q => q.BranchId == branchId.Value);
        if (supplierPartyId.HasValue) query = query.Where(q => q.SupplierPartyId == supplierPartyId.Value);
        if (status.HasValue) query = query.Where(q => q.Status == status.Value);

        var list = await query.OrderByDescending(q => q.CreatedAtUtc).ToListAsync(ct);

        var supplierIds = list.Select(q => q.SupplierPartyId).Distinct().ToList();
        var suppliers = await _dbContext.Parties.Where(p => supplierIds.Contains(p.Id)).ToDictionaryAsync(p => p.Id, ct);

        var skuIds = list.SelectMany(q => q.Items).Select(i => i.ProductSkuId).Distinct().ToList();
        var skus = await _dbContext.ProductSkus.Where(s => skuIds.Contains(s.Id)).ToDictionaryAsync(s => s.Id, ct);

        return list.Select(q => MapQuotation(q, suppliers, skus, canViewCost)).ToList();
    }

    public async Task<SupplierQuotationResponse> CreateSupplierQuotationAsync(CreateSupplierQuotationDto dto, bool canViewCost, CancellationToken ct = default)
    {
        var tenantId = _executionContext.TenantId;
        var userId = _executionContext.UserId;

        var supplierExists = await _dbContext.Parties.AnyAsync(p => p.Id == dto.SupplierPartyId, ct);
        if (!supplierExists)
            throw new KeyNotFoundException($"Fornecedor {dto.SupplierPartyId} não encontrado.");

        var quotation = new SupplierQuotation(
            tenantId,
            dto.BranchId,
            dto.SupplierPartyId,
            dto.QuotationNumber,
            dto.ValidUntilUtc,
            dto.LeadTimeDays,
            dto.ShippingFee,
            dto.PaymentTerms,
            userId,
            dto.Notes
        );

        foreach (var item in dto.Items)
        {
            var skuExists = await _dbContext.ProductSkus.AnyAsync(s => s.Id == item.ProductSkuId, ct);
            if (!skuExists)
                throw new KeyNotFoundException($"SKU {item.ProductSkuId} não encontrado.");

            quotation.AddItem(item.ProductSkuId, item.Quantity, item.UnitPrice, item.DiscountAmount);
        }

        _dbContext.SupplierQuotations.Add(quotation);
        await _dbContext.SaveChangesAsync(ct);

        return await GetSupplierQuotationByIdAsync(quotation.Id, canViewCost, ct);
    }

    public async Task<SupplierQuotationResponse> GetSupplierQuotationByIdAsync(Guid id, bool canViewCost, CancellationToken ct = default)
    {
        var quotation = await _dbContext.SupplierQuotations
            .Include(q => q.Items)
            .FirstOrDefaultAsync(q => q.Id == id, ct);

        if (quotation == null)
            throw new KeyNotFoundException($"Cotação {id} não encontrada.");

        var suppliers = await _dbContext.Parties.Where(p => p.Id == quotation.SupplierPartyId).ToDictionaryAsync(p => p.Id, ct);
        var skuIds = quotation.Items.Select(i => i.ProductSkuId).Distinct().ToList();
        var skus = await _dbContext.ProductSkus.Where(s => skuIds.Contains(s.Id)).ToDictionaryAsync(s => s.Id, ct);

        return MapQuotation(quotation, suppliers, skus, canViewCost);
    }

    public async Task<SupplierQuotationResponse> AcceptSupplierQuotationAsync(Guid id, bool canViewCost, CancellationToken ct = default)
    {
        var quotation = await _dbContext.SupplierQuotations
            .Include(q => q.Items)
            .FirstOrDefaultAsync(q => q.Id == id, ct);

        if (quotation == null)
            throw new KeyNotFoundException($"Cotação {id} não encontrada.");

        quotation.MarkAccepted();
        await _dbContext.SaveChangesAsync(ct);

        return await GetSupplierQuotationByIdAsync(id, canViewCost, ct);
    }

    private static SupplierQuotationResponse MapQuotation(
        SupplierQuotation q,
        Dictionary<Guid, Party> suppliers,
        Dictionary<Guid, ProductSku> skus,
        bool canViewCost)
    {
        suppliers.TryGetValue(q.SupplierPartyId, out var supplier);

        var items = q.Items.Select(i =>
        {
            skus.TryGetValue(i.ProductSkuId, out var sku);
            return new SupplierQuotationItemResponse(
                i.Id,
                i.ProductSkuId,
                sku?.SkuCode,
                sku?.VariantName,
                i.Quantity,
                canViewCost ? i.UnitPrice : null,
                canViewCost ? i.DiscountAmount : null,
                canViewCost ? i.TotalAmount : null
            );
        }).ToList();

        return new SupplierQuotationResponse(
            q.Id,
            q.BranchId,
            q.SupplierPartyId,
            supplier?.TradeName ?? supplier?.Name,
            q.QuotationNumber,
            q.Status,
            q.ValidUntilUtc,
            q.LeadTimeDays,
            canViewCost ? q.ShippingFee : null,
            canViewCost ? q.TotalEstimatedCost : null,
            q.PaymentTerms,
            q.Notes,
            q.CreatedByUserId,
            items,
            q.CreatedAtUtc,
            q.Version
        );
    }

    #endregion

    #region Purchase Orders

    public async Task<IReadOnlyList<PurchaseOrderResponse>> ListPurchaseOrdersAsync(
        Guid? branchId,
        Guid? supplierPartyId,
        PurchaseOrderStatus? status,
        bool canViewCost,
        CancellationToken ct = default)
    {
        var query = _dbContext.PurchaseOrders
            .Include(o => o.Items)
            .AsNoTracking();

        if (branchId.HasValue) query = query.Where(o => o.BranchId == branchId.Value);
        if (supplierPartyId.HasValue) query = query.Where(o => o.SupplierPartyId == supplierPartyId.Value);
        if (status.HasValue) query = query.Where(o => o.Status == status.Value);

        var list = await query.OrderByDescending(o => o.CreatedAtUtc).ToListAsync(ct);

        var supplierIds = list.Select(o => o.SupplierPartyId).Distinct().ToList();
        var suppliers = await _dbContext.Parties.Where(p => supplierIds.Contains(p.Id)).ToDictionaryAsync(p => p.Id, ct);

        return list.Select(o => MapPurchaseOrder(o, suppliers, canViewCost)).ToList();
    }

    public async Task<PurchaseOrderResponse> GetPurchaseOrderByIdAsync(Guid id, bool canViewCost, CancellationToken ct = default)
    {
        var order = await _dbContext.PurchaseOrders
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.Id == id, ct);

        if (order == null)
            throw new KeyNotFoundException($"Pedido de compra {id} não encontrado.");

        var suppliers = await _dbContext.Parties.Where(p => p.Id == order.SupplierPartyId).ToDictionaryAsync(p => p.Id, ct);

        return MapPurchaseOrder(order, suppliers, canViewCost);
    }

    public async Task<PurchaseOrderResponse> CreatePurchaseOrderAsync(CreatePurchaseOrderDto dto, bool canViewCost, CancellationToken ct = default)
    {
        var tenantId = _executionContext.TenantId;
        var userId = _executionContext.UserId;

        var supplierExists = await _dbContext.Parties.AnyAsync(p => p.Id == dto.SupplierPartyId, ct);
        if (!supplierExists)
            throw new KeyNotFoundException($"Fornecedor {dto.SupplierPartyId} não encontrado.");

        var exists = await _dbContext.PurchaseOrders.AnyAsync(o => o.OrderNumber == dto.OrderNumber.Trim().ToUpperInvariant(), ct);
        if (exists)
            throw new InvalidOperationException($"Pedido de compra com número '{dto.OrderNumber}' já existe.");

        var order = new PurchaseOrder(
            tenantId,
            dto.BranchId,
            dto.SupplierPartyId,
            dto.OrderNumber,
            userId,
            dto.ExpectedDeliveryDateUtc,
            dto.PaymentTerms,
            dto.ShippingCost,
            dto.OtherExpenses,
            dto.TotalDiscount,
            dto.Notes
        );

        foreach (var item in dto.Items)
        {
            var sku = await _dbContext.ProductSkus
                .Include(s => s.ProductModel)
                .FirstOrDefaultAsync(s => s.Id == item.ProductSkuId, ct);

            if (sku == null)
                throw new KeyNotFoundException($"SKU {item.ProductSkuId} não encontrado.");

            var historicalDescription = $"{sku.ProductModel?.Name ?? "Produto"} - {sku.VariantName}";

            order.AddItem(
                sku.Id,
                sku.SkuCode,
                historicalDescription,
                item.QuantityOrdered,
                item.UnitCost,
                item.Discount
            );
        }

        _dbContext.PurchaseOrders.Add(order);
        await _dbContext.SaveChangesAsync(ct);

        return await GetPurchaseOrderByIdAsync(order.Id, canViewCost, ct);
    }

    public async Task<PurchaseOrderResponse> SubmitPurchaseOrderAsync(Guid id, bool canViewCost, CancellationToken ct = default)
    {
        var order = await _dbContext.PurchaseOrders
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.Id == id, ct);

        if (order == null)
            throw new KeyNotFoundException($"Pedido de compra {id} não encontrado.");

        order.Submit();
        await _dbContext.SaveChangesAsync(ct);

        return await GetPurchaseOrderByIdAsync(id, canViewCost, ct);
    }

    public async Task<PurchaseOrderResponse> ApprovePurchaseOrderAsync(Guid id, bool canViewCost, CancellationToken ct = default)
    {
        var order = await _dbContext.PurchaseOrders
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.Id == id, ct);

        if (order == null)
            throw new KeyNotFoundException($"Pedido de compra {id} não encontrado.");

        order.Approve(_executionContext.UserId);
        order.MarkOrdered(); // Transmite ao fornecedor após aprovação
        await _dbContext.SaveChangesAsync(ct);

        return await GetPurchaseOrderByIdAsync(id, canViewCost, ct);
    }

    public async Task<PurchaseOrderResponse> CancelPurchaseOrderAsync(Guid id, string reason, bool canViewCost, CancellationToken ct = default)
    {
        var order = await _dbContext.PurchaseOrders
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.Id == id, ct);

        if (order == null)
            throw new KeyNotFoundException($"Pedido de compra {id} não encontrado.");

        order.Cancel(reason);
        await _dbContext.SaveChangesAsync(ct);

        return await GetPurchaseOrderByIdAsync(id, canViewCost, ct);
    }

    private static PurchaseOrderResponse MapPurchaseOrder(PurchaseOrder o, Dictionary<Guid, Party> suppliers, bool canViewCost)
    {
        suppliers.TryGetValue(o.SupplierPartyId, out var supplier);

        var items = o.Items.Select(i => new PurchaseOrderItemResponse(
            i.Id,
            i.ProductSkuId,
            i.HistoricalSkuCode,
            i.HistoricalDescription,
            i.QuantityOrdered,
            i.QuantityReceived,
            i.QuantityPending,
            canViewCost ? i.UnitCost : null,
            canViewCost ? i.Discount : null,
            canViewCost ? i.TotalAmount : null
        )).ToList();

        return new PurchaseOrderResponse(
            o.Id,
            o.BranchId,
            o.SupplierPartyId,
            supplier?.TradeName ?? supplier?.Name,
            o.OrderNumber,
            o.Status,
            o.ExpectedDeliveryDateUtc,
            o.PaymentTerms,
            canViewCost ? o.ShippingCost : null,
            canViewCost ? o.OtherExpenses : null,
            canViewCost ? o.TotalDiscount : null,
            canViewCost ? o.ItemsSubtotal : null,
            canViewCost ? o.TotalOrderAmount : null,
            o.Notes,
            o.CreatedByUserId,
            o.ApprovedByUserId,
            o.ApprovedAtUtc,
            items,
            o.CreatedAtUtc,
            o.Version
        );
    }

    #endregion

    #region Goods Receipts & Conference (Recebimento e Integração com Kardex)

    public async Task<IReadOnlyList<GoodsReceiptResponse>> ListGoodsReceiptsAsync(
        Guid? branchId,
        Guid? warehouseId,
        GoodsReceiptStatus? status,
        bool canViewCost,
        CancellationToken ct = default)
    {
        var query = _dbContext.GoodsReceipts
            .Include(r => r.Items)
            .AsNoTracking();

        if (branchId.HasValue) query = query.Where(r => r.BranchId == branchId.Value);
        if (warehouseId.HasValue) query = query.Where(r => r.WarehouseId == warehouseId.Value);
        if (status.HasValue) query = query.Where(r => r.Status == status.Value);

        var list = await query.OrderByDescending(r => r.CreatedAtUtc).ToListAsync(ct);

        var warehouseIds = list.Select(r => r.WarehouseId).Distinct().ToList();
        var warehouses = await _dbContext.Warehouses.Where(w => warehouseIds.Contains(w.Id)).ToDictionaryAsync(w => w.Id, ct);

        var orderIds = list.Where(r => r.PurchaseOrderId.HasValue).Select(r => r.PurchaseOrderId!.Value).Distinct().ToList();
        var orders = await _dbContext.PurchaseOrders.Where(o => orderIds.Contains(o.Id)).ToDictionaryAsync(o => o.Id, ct);

        var supplierIds = list.Select(r => r.SupplierPartyId).Distinct().ToList();
        var suppliers = await _dbContext.Parties.Where(p => supplierIds.Contains(p.Id)).ToDictionaryAsync(p => p.Id, ct);

        var skuIds = list.SelectMany(r => r.Items).Select(i => i.ProductSkuId).Distinct().ToList();
        var skus = await _dbContext.ProductSkus.Where(s => skuIds.Contains(s.Id)).ToDictionaryAsync(s => s.Id, ct);

        return list.Select(r => MapGoodsReceipt(r, warehouses, orders, suppliers, skus, canViewCost)).ToList();
    }

    public async Task<GoodsReceiptResponse> GetGoodsReceiptByIdAsync(Guid id, bool canViewCost, CancellationToken ct = default)
    {
        var receipt = await _dbContext.GoodsReceipts
            .Include(r => r.Items)
            .FirstOrDefaultAsync(r => r.Id == id, ct);

        if (receipt == null)
            throw new KeyNotFoundException($"Recebimento {id} não encontrado.");

        var warehouses = await _dbContext.Warehouses.Where(w => w.Id == receipt.WarehouseId).ToDictionaryAsync(w => w.Id, ct);
        var orders = receipt.PurchaseOrderId.HasValue
            ? await _dbContext.PurchaseOrders.Where(o => o.Id == receipt.PurchaseOrderId.Value).ToDictionaryAsync(o => o.Id, ct)
            : new Dictionary<Guid, PurchaseOrder>();
        var suppliers = await _dbContext.Parties.Where(p => p.Id == receipt.SupplierPartyId).ToDictionaryAsync(p => p.Id, ct);

        var skuIds = receipt.Items.Select(i => i.ProductSkuId).Distinct().ToList();
        var skus = await _dbContext.ProductSkus.Where(s => skuIds.Contains(s.Id)).ToDictionaryAsync(s => s.Id, ct);

        return MapGoodsReceipt(receipt, warehouses, orders, suppliers, skus, canViewCost);
    }

    public async Task<GoodsReceiptResponse> CreateAndPostGoodsReceiptAsync(
        CreateGoodsReceiptDto dto,
        bool canViewCost,
        CancellationToken ct = default)
    {
        var tenantId = _executionContext.TenantId;
        var userId = _executionContext.UserId;

        // 1. Idempotência estrita
        if (!string.IsNullOrWhiteSpace(dto.IdempotencyKey))
        {
            var existing = await _dbContext.GoodsReceipts
                .Include(r => r.Items)
                .FirstOrDefaultAsync(r => r.IdempotencyKey == dto.IdempotencyKey.Trim(), ct);

            if (existing != null)
            {
                return await GetGoodsReceiptByIdAsync(existing.Id, canViewCost, ct);
            }
        }

        // 2. Validações prévias
        var warehouse = await _dbContext.Warehouses.FirstOrDefaultAsync(w => w.Id == dto.WarehouseId, ct);
        if (warehouse == null)
            throw new KeyNotFoundException($"Depósito {dto.WarehouseId} não encontrado.");

        var supplier = await _dbContext.Parties.FirstOrDefaultAsync(p => p.Id == dto.SupplierPartyId, ct);
        if (supplier == null)
            throw new KeyNotFoundException($"Fornecedor {dto.SupplierPartyId} não encontrado.");

        PurchaseOrder? order = null;
        if (dto.PurchaseOrderId.HasValue)
        {
            order = await _dbContext.PurchaseOrders
                .Include(o => o.Items)
                .FirstOrDefaultAsync(o => o.Id == dto.PurchaseOrderId.Value, ct);

            if (order == null)
                throw new KeyNotFoundException($"Pedido de compra {dto.PurchaseOrderId.Value} não encontrado.");

            if (order.Status != PurchaseOrderStatus.Approved &&
                order.Status != PurchaseOrderStatus.Ordered &&
                order.Status != PurchaseOrderStatus.PartiallyReceived)
            {
                throw new InvalidOperationException($"O pedido {order.OrderNumber} está em status '{order.Status}', o qual não permite recebimento de mercadorias.");
            }
        }

        // 3. Montar entidade de Recebimento
        var receipt = new GoodsReceipt(
            tenantId,
            dto.BranchId,
            dto.WarehouseId,
            dto.WarehouseLocationId,
            dto.PurchaseOrderId,
            dto.SupplierPartyId,
            dto.ReceiptNumber,
            dto.InvoiceOrDocumentNumber,
            userId,
            dto.IdempotencyKey,
            dto.Notes
        );

        foreach (var itemDto in dto.Items)
        {
            receipt.AddItem(
                itemDto.ProductSkuId,
                itemDto.QuantityReceived,
                itemDto.RealUnitCost,
                itemDto.InventoryUnitId,
                itemDto.SerialOrImei,
                itemDto.Notes
            );
        }

        // 4. Executar transação: Recebimento + Atualização do Pedido + Kardex Imutável + Posições Seriais + Projeção de Saldo
        receipt.MarkApprovedAndPosted();
        _dbContext.GoodsReceipts.Add(receipt);

        var docRef = $"RECEIPT:{receipt.ReceiptNumber} | NF:{receipt.InvoiceOrDocumentNumber}";

        foreach (var item in receipt.Items)
        {
            // Se houver pedido vinculado, abate a quantidade do item correspondente no pedido
            if (order != null)
            {
                var orderItem = order.Items.FirstOrDefault(oi => oi.ProductSkuId == item.ProductSkuId);
                if (orderItem != null)
                {
                    orderItem.RegisterReceipt(item.QuantityReceived);
                }
            }

            // Validação de produto serializado
            var sku = await _dbContext.ProductSkus
                .Include(s => s.ProductModel)
                .FirstAsync(s => s.Id == item.ProductSkuId, ct);

            Guid? assignedUnitId = item.InventoryUnitId;

            if (sku.ProductModel?.SerializationPolicy == SerializationPolicy.StrictSerialized)
            {
                if (item.QuantityReceived != 1)
                    throw new ArgumentException($"Produto serializado {sku.SkuCode} deve ser recebido com quantidade unitária.");

                if (!assignedUnitId.HasValue)
                {
                    if (string.IsNullOrWhiteSpace(item.SerialOrImei))
                        throw new ArgumentException($"Número de série ou IMEI é obrigatório para receber o produto serializado {sku.SkuCode}.");

                    var newUnit = new InventoryUnit(
                        tenantId,
                        sku.Id,
                        ItemCondition.BrandNew,
                        item.RealUnitCost,
                        serialNumber: item.SerialOrImei.Trim(),
                        imei1: null,
                        imei2: null,
                        grade: CosmeticGrade.None,
                        batteryHealthPercentage: null,
                        supplierPartyId: dto.SupplierPartyId,
                        inspectionNotes: "Recebimento Fornecedor NF " + receipt.InvoiceOrDocumentNumber
                    );

                    _dbContext.InventoryUnits.Add(newUnit);
                    assignedUnitId = newUnit.Id;
                }

                // Atualizar posição serial no estoque
                var position = await _dbContext.SerialStockPositions.FirstOrDefaultAsync(p => p.InventoryUnitId == assignedUnitId.Value, ct);
                if (position == null)
                {
                    position = new SerialStockPosition(tenantId, assignedUnitId.Value, sku.Id, dto.BranchId, dto.WarehouseId, dto.WarehouseLocationId);
                    _dbContext.SerialStockPositions.Add(position);
                }
                else
                {
                    position.Move(dto.BranchId, dto.WarehouseId, dto.WarehouseLocationId);
                }
            }

            // Atualizar projeção de saldo de estoque (StockBalance)
            var balance = await _dbContext.StockBalances
                .FirstOrDefaultAsync(b => b.BranchId == dto.BranchId &&
                                          b.WarehouseId == dto.WarehouseId &&
                                          b.WarehouseLocationId == dto.WarehouseLocationId &&
                                          b.ProductSkuId == item.ProductSkuId, ct);

            if (balance == null)
            {
                balance = new StockBalance(tenantId, dto.BranchId, dto.WarehouseId, dto.WarehouseLocationId, item.ProductSkuId);
                _dbContext.StockBalances.Add(balance);
            }

            balance.ApplyMovement(item.QuantityReceived, item.RealUnitCost);

            // Gravar linha oficial append-only no Kardex (StockMovement)
            var movement = new StockMovement(
                tenantId,
                dto.BranchId,
                dto.WarehouseId,
                dto.WarehouseLocationId,
                item.ProductSkuId,
                assignedUnitId,
                StockMovementType.PurchaseReceipt,
                item.QuantityReceived,
                item.RealUnitCost,
                balance.OnHandQuantity,
                docRef,
                $"Recebimento de compra #{receipt.ReceiptNumber} do fornecedor {supplier.TradeName ?? supplier.Name}",
                correlationId: receipt.Id,
                idempotencyKey: dto.IdempotencyKey != null ? $"{dto.IdempotencyKey}_{item.Id}" : null,
                userId
            );

            _dbContext.StockMovements.Add(movement);
        }

        if (order != null)
        {
            order.UpdateReceiptProgress();
        }

        await _dbContext.SaveChangesAsync(ct);

        return await GetGoodsReceiptByIdAsync(receipt.Id, canViewCost, ct);
    }

    private static GoodsReceiptResponse MapGoodsReceipt(
        GoodsReceipt r,
        Dictionary<Guid, Warehouse> warehouses,
        Dictionary<Guid, PurchaseOrder> orders,
        Dictionary<Guid, Party> suppliers,
        Dictionary<Guid, ProductSku> skus,
        bool canViewCost)
    {
        warehouses.TryGetValue(r.WarehouseId, out var warehouse);
        suppliers.TryGetValue(r.SupplierPartyId, out var supplier);
        PurchaseOrder? order = null;
        if (r.PurchaseOrderId.HasValue)
        {
            orders.TryGetValue(r.PurchaseOrderId.Value, out order);
        }

        var items = r.Items.Select(i =>
        {
            skus.TryGetValue(i.ProductSkuId, out var sku);
            return new GoodsReceiptItemResponse(
                i.Id,
                i.ProductSkuId,
                sku?.SkuCode,
                sku?.VariantName,
                i.QuantityReceived,
                canViewCost ? i.RealUnitCost : null,
                canViewCost ? i.TotalCost : null,
                i.InventoryUnitId,
                i.SerialOrImei,
                i.Notes
            );
        }).ToList();

        return new GoodsReceiptResponse(
            r.Id,
            r.BranchId,
            r.WarehouseId,
            warehouse?.Name,
            r.WarehouseLocationId,
            null,
            r.PurchaseOrderId,
            order?.OrderNumber,
            r.SupplierPartyId,
            supplier?.TradeName ?? supplier?.Name,
            r.ReceiptNumber,
            r.InvoiceOrDocumentNumber,
            r.Status,
            r.IdempotencyKey,
            r.Notes,
            r.ReceivedByUserId,
            items,
            r.CreatedAtUtc,
            r.Version
        );
    }

    #endregion

    #region Used Device Acquisitions (Aquisições Balcão de Usados)

    public async Task<IReadOnlyList<UsedDeviceAcquisitionResponse>> ListUsedDeviceAcquisitionsAsync(
        Guid? branchId,
        UsedDeviceStatus? status,
        bool canViewCost,
        CancellationToken ct = default)
    {
        var query = _dbContext.UsedDeviceAcquisitions.AsNoTracking();

        if (branchId.HasValue) query = query.Where(a => a.BranchId == branchId.Value);
        if (status.HasValue) query = query.Where(a => a.Status == status.Value);

        var list = await query.OrderByDescending(a => a.CreatedAtUtc).ToListAsync(ct);

        var sellerIds = list.Select(a => a.SellerPartyId).Distinct().ToList();
        var sellers = await _dbContext.Parties.Where(p => sellerIds.Contains(p.Id)).ToDictionaryAsync(p => p.Id, ct);

        var skuIds = list.Select(a => a.ProductSkuId).Distinct().ToList();
        var skus = await _dbContext.ProductSkus.Where(s => skuIds.Contains(s.Id)).ToDictionaryAsync(s => s.Id, ct);

        return list.Select(a => MapUsedDeviceAcquisition(a, sellers, skus, canViewCost)).ToList();
    }

    public async Task<UsedDeviceAcquisitionResponse> GetUsedDeviceAcquisitionByIdAsync(Guid id, bool canViewCost, CancellationToken ct = default)
    {
        var acquisition = await _dbContext.UsedDeviceAcquisitions.FirstOrDefaultAsync(a => a.Id == id, ct);
        if (acquisition == null)
            throw new KeyNotFoundException($"Aquisição de usado {id} não encontrada.");

        var sellers = await _dbContext.Parties.Where(p => p.Id == acquisition.SellerPartyId).ToDictionaryAsync(p => p.Id, ct);
        var skus = await _dbContext.ProductSkus.Where(s => s.Id == acquisition.ProductSkuId).ToDictionaryAsync(s => s.Id, ct);

        return MapUsedDeviceAcquisition(acquisition, sellers, skus, canViewCost);
    }

    public async Task<UsedDeviceAcquisitionResponse> RegisterUsedDeviceAcquisitionAsync(
        RegisterUsedDeviceAcquisitionDto dto,
        bool canViewCost,
        CancellationToken ct = default)
    {
        var tenantId = _executionContext.TenantId;
        var userId = _executionContext.UserId;

        // 1. Validação de vendedor
        var seller = await _dbContext.Parties.FirstOrDefaultAsync(p => p.Id == dto.SellerPartyId, ct);
        if (seller == null)
            throw new KeyNotFoundException($"Vendedor/Pessoa {dto.SellerPartyId} não encontrado.");

        // 2. Validação de SKU
        var sku = await _dbContext.ProductSkus
            .Include(s => s.ProductModel)
            .FirstOrDefaultAsync(s => s.Id == dto.ProductSkuId, ct);
        if (sku == null)
            throw new KeyNotFoundException($"SKU {dto.ProductSkuId} não encontrado.");

        // 3. Validação central de duplicidade de identificadores (IMEI / Serial)
        if (!string.IsNullOrWhiteSpace(dto.Imei1))
        {
            var cleanImei1 = InventoryUnitIdentifier.Normalize(dto.Imei1);
            var imei1Exists = await _dbContext.InventoryUnitIdentifiers.AnyAsync(i => i.NormalizedValue == cleanImei1, ct);
            if (imei1Exists)
                throw new InvalidOperationException($"O IMEI 1 '{cleanImei1}' já se encontra cadastrado no sistema.");
        }

        if (!string.IsNullOrWhiteSpace(dto.Imei2))
        {
            var cleanImei2 = InventoryUnitIdentifier.Normalize(dto.Imei2);
            var imei2Exists = await _dbContext.InventoryUnitIdentifiers.AnyAsync(i => i.NormalizedValue == cleanImei2, ct);
            if (imei2Exists)
                throw new InvalidOperationException($"O IMEI 2 '{cleanImei2}' já se encontra cadastrado no sistema.");
        }

        var cleanSerial = InventoryUnitIdentifier.Normalize(dto.SerialNumber);
        var serialExists = await _dbContext.InventoryUnitIdentifiers.AnyAsync(i => i.NormalizedValue == cleanSerial, ct);
        if (serialExists)
            throw new InvalidOperationException($"O Serial '{dto.SerialNumber}' já se encontra cadastrado no sistema.");

        // 4. Criação da aquisição
        var acquisition = new UsedDeviceAcquisition(
            tenantId,
            dto.BranchId,
            dto.SellerPartyId,
            dto.ProductSkuId,
            dto.AcquisitionNumber,
            dto.SerialNumber,
            dto.Imei1,
            dto.Imei2,
            dto.Condition,
            dto.Grade,
            dto.BatteryHealthPercentage,
            dto.NegotiatedPrice,
            dto.AttributableExpenses,
            dto.ChecklistInspectionJson,
            userId,
            dto.Notes
        );

        _dbContext.UsedDeviceAcquisitions.Add(acquisition);
        await _dbContext.SaveChangesAsync(ct);

        return await GetUsedDeviceAcquisitionByIdAsync(acquisition.Id, canViewCost, ct);
    }

    public async Task<UsedDeviceAcquisitionResponse> ApproveAndReceiveUsedDeviceInStockAsync(
        Guid id,
        Guid warehouseId,
        Guid? warehouseLocationId,
        bool canViewCost,
        CancellationToken ct = default)
    {
        var tenantId = _executionContext.TenantId;
        var userId = _executionContext.UserId;

        var acquisition = await _dbContext.UsedDeviceAcquisitions.FirstOrDefaultAsync(a => a.Id == id, ct);
        if (acquisition == null)
            throw new KeyNotFoundException($"Aquisição {id} não encontrada.");

        var warehouse = await _dbContext.Warehouses.FirstOrDefaultAsync(w => w.Id == warehouseId, ct);
        if (warehouse == null)
            throw new KeyNotFoundException($"Depósito {warehouseId} não encontrado.");

        var seller = await _dbContext.Parties.FirstAsync(p => p.Id == acquisition.SellerPartyId, ct);

        // 1. Aprova a avaliação técnica
        acquisition.Approve(userId);

        // 2. Cria a unidade física (InventoryUnit) oficial no catálogo (construtor já cria os InventoryUnitIdentifiers internamente)
        var unit = new InventoryUnit(
            tenantId,
            acquisition.ProductSkuId,
            acquisition.Condition,
            acquisition.TotalAcquisitionCost,
            serialNumber: acquisition.SerialNumber,
            imei1: acquisition.Imei1,
            imei2: acquisition.Imei2,
            grade: acquisition.Grade,
            batteryHealthPercentage: acquisition.BatteryHealthPercentage,
            supplierPartyId: acquisition.SellerPartyId,
            inspectionNotes: $"Recompra Balcão: {acquisition.AcquisitionNumber} | Vendedor: {seller.TradeName ?? seller.Name}"
        );

        unit.ApproveForSale("Aprovado em checklist técnico na aquisição");
        _dbContext.InventoryUnits.Add(unit);

        // 3. Marca aquisição como recebida em estoque vinculando a unidade
        acquisition.MarkReceivedInStock(unit.Id);

        // 4. Atualiza posição serial no estoque
        var position = new SerialStockPosition(tenantId, unit.Id, acquisition.ProductSkuId, acquisition.BranchId, warehouseId, warehouseLocationId);
        _dbContext.SerialStockPositions.Add(position);

        // 5. Atualiza saldo de estoque
        var balance = await _dbContext.StockBalances
            .FirstOrDefaultAsync(b => b.BranchId == acquisition.BranchId &&
                                      b.WarehouseId == warehouseId &&
                                      b.WarehouseLocationId == warehouseLocationId &&
                                      b.ProductSkuId == acquisition.ProductSkuId, ct);

        if (balance == null)
        {
            balance = new StockBalance(tenantId, acquisition.BranchId, warehouseId, warehouseLocationId, acquisition.ProductSkuId);
            _dbContext.StockBalances.Add(balance);
        }

        balance.ApplyMovement(1, acquisition.TotalAcquisitionCost);

        // 6. Lançamento append-only no Kardex oficial com tipo CustomerBuyback
        var movement = new StockMovement(
            tenantId,
            acquisition.BranchId,
            warehouseId,
            warehouseLocationId,
            acquisition.ProductSkuId,
            unit.Id,
            StockMovementType.CustomerBuyback,
            quantity: 1,
            unitCost: acquisition.TotalAcquisitionCost,
            balanceAfterQuantity: balance.OnHandQuantity,
            documentReference: $"BUYBACK:{acquisition.AcquisitionNumber}",
            reason: $"Aquisição Balcão de Usado de {seller.TradeName ?? seller.Name} - Bateria: {acquisition.BatteryHealthPercentage}%",
            correlationId: acquisition.Id,
            idempotencyKey: $"BUYBACK_{acquisition.Id}",
            userId
        );

        _dbContext.StockMovements.Add(movement);
        await _dbContext.SaveChangesAsync(ct);

        return await GetUsedDeviceAcquisitionByIdAsync(id, canViewCost, ct);
    }

    private static UsedDeviceAcquisitionResponse MapUsedDeviceAcquisition(
        UsedDeviceAcquisition a,
        Dictionary<Guid, Party> sellers,
        Dictionary<Guid, ProductSku> skus,
        bool canViewCost)
    {
        sellers.TryGetValue(a.SellerPartyId, out var seller);
        skus.TryGetValue(a.ProductSkuId, out var sku);

        return new UsedDeviceAcquisitionResponse(
            a.Id,
            a.BranchId,
            a.SellerPartyId,
            seller?.TradeName ?? seller?.Name,
            a.ProductSkuId,
            sku?.SkuCode,
            sku?.VariantName,
            a.InventoryUnitId,
            a.AcquisitionNumber,
            a.SerialNumber,
            a.Imei1,
            a.Imei2,
            a.Condition,
            a.Grade,
            a.BatteryHealthPercentage,
            canViewCost ? a.NegotiatedPrice : null,
            canViewCost ? a.AttributableExpenses : null,
            canViewCost ? a.TotalAcquisitionCost : null,
            a.ChecklistInspectionJson,
            a.Status,
            a.Notes,
            a.CreatedByUserId,
            a.ApprovedByUserId,
            a.CreatedAtUtc,
            a.Version
        );
    }

    #endregion

    #region Supplier Returns (Devoluções ao Fornecedor)

    public async Task<IReadOnlyList<SupplierReturnResponse>> ListSupplierReturnsAsync(
        Guid? branchId,
        Guid? supplierPartyId,
        SupplierReturnStatus? status,
        bool canViewCost,
        CancellationToken ct = default)
    {
        var query = _dbContext.SupplierReturns
            .Include(r => r.Items)
            .AsNoTracking();

        if (branchId.HasValue) query = query.Where(r => r.BranchId == branchId.Value);
        if (supplierPartyId.HasValue) query = query.Where(r => r.SupplierPartyId == supplierPartyId.Value);
        if (status.HasValue) query = query.Where(r => r.Status == status.Value);

        var list = await query.OrderByDescending(r => r.CreatedAtUtc).ToListAsync(ct);

        var warehouseIds = list.Select(r => r.WarehouseId).Distinct().ToList();
        var warehouses = await _dbContext.Warehouses.Where(w => warehouseIds.Contains(w.Id)).ToDictionaryAsync(w => w.Id, ct);

        var supplierIds = list.Select(r => r.SupplierPartyId).Distinct().ToList();
        var suppliers = await _dbContext.Parties.Where(p => supplierIds.Contains(p.Id)).ToDictionaryAsync(p => p.Id, ct);

        var skuIds = list.SelectMany(r => r.Items).Select(i => i.ProductSkuId).Distinct().ToList();
        var skus = await _dbContext.ProductSkus.Where(s => skuIds.Contains(s.Id)).ToDictionaryAsync(s => s.Id, ct);

        return list.Select(r => MapSupplierReturn(r, warehouses, suppliers, skus, canViewCost)).ToList();
    }

    public async Task<SupplierReturnResponse> GetSupplierReturnByIdAsync(Guid id, bool canViewCost, CancellationToken ct = default)
    {
        var supplierReturn = await _dbContext.SupplierReturns
            .Include(r => r.Items)
            .FirstOrDefaultAsync(r => r.Id == id, ct);

        if (supplierReturn == null)
            throw new KeyNotFoundException($"Devolução {id} não encontrada.");

        var warehouses = await _dbContext.Warehouses.Where(w => w.Id == supplierReturn.WarehouseId).ToDictionaryAsync(w => w.Id, ct);
        var suppliers = await _dbContext.Parties.Where(p => p.Id == supplierReturn.SupplierPartyId).ToDictionaryAsync(p => p.Id, ct);

        var skuIds = supplierReturn.Items.Select(i => i.ProductSkuId).Distinct().ToList();
        var skus = await _dbContext.ProductSkus.Where(s => skuIds.Contains(s.Id)).ToDictionaryAsync(s => s.Id, ct);

        return MapSupplierReturn(supplierReturn, warehouses, suppliers, skus, canViewCost);
    }

    public async Task<SupplierReturnResponse> CreateAndDispatchSupplierReturnAsync(
        CreateSupplierReturnDto dto,
        bool canViewCost,
        CancellationToken ct = default)
    {
        var tenantId = _executionContext.TenantId;
        var userId = _executionContext.UserId;

        var supplierExists = await _dbContext.Parties.AnyAsync(p => p.Id == dto.SupplierPartyId, ct);
        if (!supplierExists)
            throw new KeyNotFoundException($"Fornecedor {dto.SupplierPartyId} não encontrado.");

        var warehouse = await _dbContext.Warehouses.FirstOrDefaultAsync(w => w.Id == dto.WarehouseId, ct);
        if (warehouse == null)
            throw new KeyNotFoundException($"Depósito {dto.WarehouseId} não encontrado.");

        var supplierReturn = new SupplierReturn(
            tenantId,
            dto.BranchId,
            dto.WarehouseId,
            dto.SupplierPartyId,
            dto.GoodsReceiptId,
            dto.ReturnNumber,
            dto.Reason,
            userId,
            dto.ReturnInvoiceNumber
        );

        foreach (var item in dto.Items)
        {
            supplierReturn.AddItem(item.ProductSkuId, item.Quantity, item.UnitCost, item.InventoryUnitId);
        }

        supplierReturn.DispatchAndPost();
        _dbContext.SupplierReturns.Add(supplierReturn);

        // Realizar baixa no Kardex oficial do MOD-03 para cada item
        foreach (var item in supplierReturn.Items)
        {
            var balance = await _dbContext.StockBalances
                .FirstOrDefaultAsync(b => b.BranchId == dto.BranchId &&
                                          b.WarehouseId == dto.WarehouseId &&
                                          b.ProductSkuId == item.ProductSkuId, ct);

            if (balance == null || balance.AvailableQuantity < item.Quantity)
                throw new InvalidOperationException($"Saldo insuficiente para devolver o SKU {item.ProductSkuId}. Disponível: {balance?.AvailableQuantity ?? 0}");

            balance.ApplyMovement(-item.Quantity, item.UnitCost);

            // Se for serializado, coloca a unidade física em quarentena ou vendida/devolvida e remove posição serial
            if (item.InventoryUnitId.HasValue)
            {
                var unit = await _dbContext.InventoryUnits.FirstOrDefaultAsync(u => u.Id == item.InventoryUnitId.Value, ct);
                if (unit != null)
                {
                    unit.MarkQuarantined($"Devolvido ao fornecedor na Devolução #{supplierReturn.ReturnNumber}");
                }

                var position = await _dbContext.SerialStockPositions.FirstOrDefaultAsync(p => p.InventoryUnitId == item.InventoryUnitId.Value, ct);
                if (position != null)
                {
                    _dbContext.SerialStockPositions.Remove(position);
                }
            }

            var movement = new StockMovement(
                tenantId,
                dto.BranchId,
                dto.WarehouseId,
                warehouseLocationId: null,
                item.ProductSkuId,
                item.InventoryUnitId,
                StockMovementType.SaleIssue, // Baixa oficial por saída/devolução
                quantity: -item.Quantity,
                unitCost: item.UnitCost,
                balanceAfterQuantity: balance.OnHandQuantity,
                documentReference: $"RETURN:{supplierReturn.ReturnNumber} | NF:{supplierReturn.ReturnInvoiceNumber ?? "N/A"}",
                reason: $"Devolução a fornecedor: {supplierReturn.Reason}",
                correlationId: supplierReturn.Id,
                idempotencyKey: $"RETURN_{supplierReturn.Id}_{item.Id}",
                userId
            );

            _dbContext.StockMovements.Add(movement);
        }

        await _dbContext.SaveChangesAsync(ct);

        return await GetSupplierReturnByIdAsync(supplierReturn.Id, canViewCost, ct);
    }

    private static SupplierReturnResponse MapSupplierReturn(
        SupplierReturn r,
        Dictionary<Guid, Warehouse> warehouses,
        Dictionary<Guid, Party> suppliers,
        Dictionary<Guid, ProductSku> skus,
        bool canViewCost)
    {
        warehouses.TryGetValue(r.WarehouseId, out var warehouse);
        suppliers.TryGetValue(r.SupplierPartyId, out var supplier);

        var items = r.Items.Select(i =>
        {
            skus.TryGetValue(i.ProductSkuId, out var sku);
            return new SupplierReturnItemResponse(
                i.Id,
                i.ProductSkuId,
                sku?.SkuCode,
                sku?.VariantName,
                i.Quantity,
                canViewCost ? i.UnitCost : null,
                canViewCost ? i.TotalAmount : null,
                i.InventoryUnitId
            );
        }).ToList();

        return new SupplierReturnResponse(
            r.Id,
            r.BranchId,
            r.WarehouseId,
            warehouse?.Name,
            r.SupplierPartyId,
            supplier?.TradeName ?? supplier?.Name,
            r.GoodsReceiptId,
            r.ReturnNumber,
            r.Reason,
            r.Status,
            r.ReturnInvoiceNumber,
            canViewCost ? r.TotalReturnAmount : null,
            r.CreatedByUserId,
            items,
            r.CreatedAtUtc,
            r.Version
        );
    }

    #endregion
}
