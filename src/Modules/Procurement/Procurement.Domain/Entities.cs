using BuildingBlocks.Domain;
using Catalog.Domain;
using Inventory.Domain;
using Parties.Domain;

namespace Procurement.Domain;

#region Purchase Request (Requisição de Compra)

public enum PurchaseRequestStatus
{
    Draft = 1,
    Submitted = 2,
    Approved = 3,
    Rejected = 4,
    ConvertedToOrder = 5,
    Cancelled = 6
}

public class PurchaseRequest : TenantEntity
{
    public Guid BranchId { get; private set; }
    public string RequestNumber { get; private set; }
    public PurchaseRequestStatus Status { get; private set; }
    public string Justification { get; private set; }
    public DateTime RequiredDateUtc { get; private set; }
    public Guid RequestedByUserId { get; private set; }
    public Guid? ApprovedByUserId { get; private set; }
    public DateTime? DecidedAtUtc { get; private set; }
    public string? DecisionNotes { get; private set; }

    private readonly List<PurchaseRequestItem> _items = [];
    public IReadOnlyCollection<PurchaseRequestItem> Items => _items.AsReadOnly();

    private PurchaseRequest() { RequestNumber = string.Empty; Justification = string.Empty; }

    public PurchaseRequest(
        Guid tenantId,
        Guid branchId,
        string requestNumber,
        string justification,
        DateTime requiredDateUtc,
        Guid requestedByUserId) : base(tenantId)
    {
        if (string.IsNullOrWhiteSpace(requestNumber))
            throw new ArgumentException("Número da requisição é obrigatório.", nameof(requestNumber));
        if (string.IsNullOrWhiteSpace(justification))
            throw new ArgumentException("A justificativa da requisição é obrigatória.", nameof(justification));

        BranchId = branchId;
        RequestNumber = requestNumber.Trim().ToUpperInvariant();
        Justification = justification.Trim();
        RequiredDateUtc = requiredDateUtc;
        RequestedByUserId = requestedByUserId;
        Status = PurchaseRequestStatus.Draft;
    }

    public void AddItem(Guid productSkuId, decimal quantity, decimal estimatedUnitCost, string? notes = null)
    {
        if (Status != PurchaseRequestStatus.Draft)
            throw new InvalidOperationException("Apenas requisições em rascunho podem ter itens adicionados.");

        var item = new PurchaseRequestItem(TenantId, Id, productSkuId, quantity, estimatedUnitCost, notes);
        _items.Add(item);
    }

    public void Submit()
    {
        if (Status != PurchaseRequestStatus.Draft)
            throw new InvalidOperationException("Apenas requisições em rascunho podem ser submetidas.");
        if (_items.Count == 0)
            throw new InvalidOperationException("A requisição precisa ter ao menos um item.");

        Status = PurchaseRequestStatus.Submitted;
    }

    public void Approve(Guid approvedByUserId, string? notes = null)
    {
        if (Status != PurchaseRequestStatus.Submitted)
            throw new InvalidOperationException("Apenas requisições submetidas podem ser aprovadas.");

        Status = PurchaseRequestStatus.Approved;
        ApprovedByUserId = approvedByUserId;
        DecidedAtUtc = DateTime.UtcNow;
        DecisionNotes = notes?.Trim();
    }

    public void Reject(Guid rejectedByUserId, string notes)
    {
        if (Status != PurchaseRequestStatus.Submitted)
            throw new InvalidOperationException("Apenas requisições submetidas podem ser rejeitadas.");
        if (string.IsNullOrWhiteSpace(notes))
            throw new ArgumentException("Justificativa de rejeição é obrigatória.", nameof(notes));

        Status = PurchaseRequestStatus.Rejected;
        ApprovedByUserId = rejectedByUserId;
        DecidedAtUtc = DateTime.UtcNow;
        DecisionNotes = notes.Trim();
    }

    public void MarkConvertedToOrder()
    {
        if (Status != PurchaseRequestStatus.Approved)
            throw new InvalidOperationException("Apenas requisições aprovadas podem ser convertidas em pedido.");

        Status = PurchaseRequestStatus.ConvertedToOrder;
    }

    public void Cancel()
    {
        if (Status == PurchaseRequestStatus.ConvertedToOrder)
            throw new InvalidOperationException("Não é possível cancelar requisição já convertida em pedido.");

        Status = PurchaseRequestStatus.Cancelled;
    }
}

public class PurchaseRequestItem : TenantEntity
{
    public Guid PurchaseRequestId { get; private set; }
    public Guid ProductSkuId { get; private set; }
    public decimal Quantity { get; private set; }
    public decimal EstimatedUnitCost { get; private set; }
    public decimal EstimatedTotalCost => Math.Round(Quantity * EstimatedUnitCost, 2);
    public string? Notes { get; private set; }

    private PurchaseRequestItem() { }

    public PurchaseRequestItem(
        Guid tenantId,
        Guid purchaseRequestId,
        Guid productSkuId,
        decimal quantity,
        decimal estimatedUnitCost,
        string? notes = null) : base(tenantId)
    {
        if (quantity <= 0)
            throw new ArgumentException("A quantidade requisitada deve ser maior que zero.", nameof(quantity));
        if (estimatedUnitCost < 0)
            throw new ArgumentException("O custo estimado não pode ser negativo.", nameof(estimatedUnitCost));

        PurchaseRequestId = purchaseRequestId;
        ProductSkuId = productSkuId;
        Quantity = quantity;
        EstimatedUnitCost = estimatedUnitCost;
        Notes = notes?.Trim();
    }
}

#endregion

#region Supplier Quotation (Cotação com Fornecedores)

public enum QuotationStatus
{
    Open = 1,
    Accepted = 2,
    Rejected = 3,
    Expired = 4
}

public class SupplierQuotation : TenantEntity
{
    public Guid BranchId { get; private set; }
    public Guid SupplierPartyId { get; private set; }
    public string QuotationNumber { get; private set; }
    public QuotationStatus Status { get; private set; }
    public DateTime ValidUntilUtc { get; private set; }
    public int LeadTimeDays { get; private set; }
    public decimal ShippingFee { get; private set; }
    public string? PaymentTerms { get; private set; }
    public string? Notes { get; private set; }
    public Guid CreatedByUserId { get; private set; }

    private readonly List<SupplierQuotationItem> _items = [];
    public IReadOnlyCollection<SupplierQuotationItem> Items => _items.AsReadOnly();

    public decimal ItemsSubtotal => _items.Sum(i => i.TotalAmount);
    public decimal TotalEstimatedCost => ItemsSubtotal + ShippingFee;

    private SupplierQuotation() { QuotationNumber = string.Empty; }

    public SupplierQuotation(
        Guid tenantId,
        Guid branchId,
        Guid supplierPartyId,
        string quotationNumber,
        DateTime validUntilUtc,
        int leadTimeDays,
        decimal shippingFee,
        string? paymentTerms,
        Guid createdByUserId,
        string? notes = null) : base(tenantId)
    {
        if (string.IsNullOrWhiteSpace(quotationNumber))
            throw new ArgumentException("Número da cotação é obrigatório.", nameof(quotationNumber));
        if (leadTimeDays < 0)
            throw new ArgumentException("Prazo de entrega não pode ser negativo.", nameof(leadTimeDays));
        if (shippingFee < 0)
            throw new ArgumentException("Frete estimado não pode ser negativo.", nameof(shippingFee));

        BranchId = branchId;
        SupplierPartyId = supplierPartyId;
        QuotationNumber = quotationNumber.Trim().ToUpperInvariant();
        ValidUntilUtc = validUntilUtc;
        LeadTimeDays = leadTimeDays;
        ShippingFee = shippingFee;
        PaymentTerms = paymentTerms?.Trim();
        CreatedByUserId = createdByUserId;
        Notes = notes?.Trim();
        Status = QuotationStatus.Open;
    }

    public void AddItem(Guid productSkuId, decimal quantity, decimal unitPrice, decimal discountAmount = 0)
    {
        if (Status != QuotationStatus.Open)
            throw new InvalidOperationException("Não é possível adicionar itens a cotação encerrada.");

        var item = new SupplierQuotationItem(TenantId, Id, productSkuId, quantity, unitPrice, discountAmount);
        _items.Add(item);
    }

    public void MarkAccepted()
    {
        if (Status != QuotationStatus.Open)
            throw new InvalidOperationException("Apenas cotações abertas podem ser aceitas.");
        Status = QuotationStatus.Accepted;
    }

    public void MarkRejected()
    {
        if (Status != QuotationStatus.Open)
            throw new InvalidOperationException("Apenas cotações abertas podem ser rejeitadas.");
        Status = QuotationStatus.Rejected;
    }
}

public class SupplierQuotationItem : TenantEntity
{
    public Guid SupplierQuotationId { get; private set; }
    public Guid ProductSkuId { get; private set; }
    public decimal Quantity { get; private set; }
    public decimal UnitPrice { get; private set; }
    public decimal DiscountAmount { get; private set; }
    public decimal TotalAmount => Math.Round((Quantity * UnitPrice) - DiscountAmount, 2);

    private SupplierQuotationItem() { }

    public SupplierQuotationItem(
        Guid tenantId,
        Guid supplierQuotationId,
        Guid productSkuId,
        decimal quantity,
        decimal unitPrice,
        decimal discountAmount = 0) : base(tenantId)
    {
        if (quantity <= 0)
            throw new ArgumentException("Quantidade cotada deve ser maior que zero.", nameof(quantity));
        if (unitPrice < 0)
            throw new ArgumentException("Preço unitário não pode ser negativo.", nameof(unitPrice));
        if (discountAmount < 0)
            throw new ArgumentException("Desconto não pode ser negativo.", nameof(discountAmount));

        SupplierQuotationId = supplierQuotationId;
        ProductSkuId = productSkuId;
        Quantity = quantity;
        UnitPrice = unitPrice;
        DiscountAmount = discountAmount;
    }
}

#endregion

#region Purchase Order (Pedido de Compra)

public enum PurchaseOrderStatus
{
    Draft = 1,
    Submitted = 2,
    Approved = 3,
    Ordered = 4,
    PartiallyReceived = 5,
    Received = 6,
    Closed = 7,
    Cancelled = 8,
    Rejected = 9
}

public class PurchaseOrder : TenantEntity
{
    public Guid BranchId { get; private set; }
    public Guid SupplierPartyId { get; private set; }
    public string OrderNumber { get; private set; }
    public PurchaseOrderStatus Status { get; private set; }
    public DateTime? ExpectedDeliveryDateUtc { get; private set; }
    public string? PaymentTerms { get; private set; }
    public decimal ShippingCost { get; private set; }
    public decimal OtherExpenses { get; private set; }
    public decimal TotalDiscount { get; private set; }
    public string? Notes { get; private set; }
    public Guid CreatedByUserId { get; private set; }
    public Guid? ApprovedByUserId { get; private set; }
    public DateTime? ApprovedAtUtc { get; private set; }

    private readonly List<PurchaseOrderItem> _items = [];
    public IReadOnlyCollection<PurchaseOrderItem> Items => _items.AsReadOnly();

    public decimal ItemsSubtotal => _items.Sum(i => i.TotalAmount);
    public decimal TotalOrderAmount => ItemsSubtotal + ShippingCost + OtherExpenses - TotalDiscount;

    private PurchaseOrder() { OrderNumber = string.Empty; }

    public PurchaseOrder(
        Guid tenantId,
        Guid branchId,
        Guid supplierPartyId,
        string orderNumber,
        Guid createdByUserId,
        DateTime? expectedDeliveryDateUtc = null,
        string? paymentTerms = null,
        decimal shippingCost = 0,
        decimal otherExpenses = 0,
        decimal totalDiscount = 0,
        string? notes = null) : base(tenantId)
    {
        if (string.IsNullOrWhiteSpace(orderNumber))
            throw new ArgumentException("Número do pedido é obrigatório.", nameof(orderNumber));
        if (shippingCost < 0)
            throw new ArgumentException("Custo de frete não pode ser negativo.", nameof(shippingCost));
        if (otherExpenses < 0)
            throw new ArgumentException("Outras despesas não podem ser negativas.", nameof(otherExpenses));
        if (totalDiscount < 0)
            throw new ArgumentException("Desconto não pode ser negativo.", nameof(totalDiscount));

        BranchId = branchId;
        SupplierPartyId = supplierPartyId;
        OrderNumber = orderNumber.Trim().ToUpperInvariant();
        CreatedByUserId = createdByUserId;
        ExpectedDeliveryDateUtc = expectedDeliveryDateUtc;
        PaymentTerms = paymentTerms?.Trim();
        ShippingCost = shippingCost;
        OtherExpenses = otherExpenses;
        TotalDiscount = totalDiscount;
        Notes = notes?.Trim();
        Status = PurchaseOrderStatus.Draft;
    }

    public void AddItem(
        Guid productSkuId,
        string historicalSkuCode,
        string historicalDescription,
        decimal quantityOrdered,
        decimal unitCost,
        decimal discount = 0)
    {
        if (Status != PurchaseOrderStatus.Draft)
            throw new InvalidOperationException("Não é possível adicionar itens a um pedido já submetido ou aprovado.");

        var item = new PurchaseOrderItem(
            TenantId,
            Id,
            productSkuId,
            historicalSkuCode,
            historicalDescription,
            quantityOrdered,
            unitCost,
            discount
        );

        _items.Add(item);
    }

    public void Submit()
    {
        if (Status != PurchaseOrderStatus.Draft)
            throw new InvalidOperationException("Apenas pedidos em rascunho podem ser submetidos para aprovação.");
        if (_items.Count == 0)
            throw new InvalidOperationException("O pedido precisa conter ao menos um item.");

        Status = PurchaseOrderStatus.Submitted;
    }

    public void Approve(Guid approvedByUserId)
    {
        if (Status != PurchaseOrderStatus.Submitted)
            throw new InvalidOperationException("Apenas pedidos submetidos podem ser aprovados.");

        Status = PurchaseOrderStatus.Approved;
        ApprovedByUserId = approvedByUserId;
        ApprovedAtUtc = DateTime.UtcNow;
    }

    public void MarkOrdered()
    {
        if (Status != PurchaseOrderStatus.Approved)
            throw new InvalidOperationException("Apenas pedidos aprovados podem ser transmitidos ao fornecedor.");

        Status = PurchaseOrderStatus.Ordered;
    }

    public void UpdateReceiptProgress()
    {
        var allReceived = _items.All(i => i.QuantityPending <= 0);
        var anyReceived = _items.Any(i => i.QuantityReceived > 0);

        if (allReceived)
        {
            Status = PurchaseOrderStatus.Received;
        }
        else if (anyReceived)
        {
            Status = PurchaseOrderStatus.PartiallyReceived;
        }
    }

    public void Close()
    {
        if (Status == PurchaseOrderStatus.Cancelled)
            throw new InvalidOperationException("Não é possível fechar um pedido cancelado.");

        Status = PurchaseOrderStatus.Closed;
    }

    public void Cancel(string reason)
    {
        if (Status == PurchaseOrderStatus.Received || Status == PurchaseOrderStatus.PartiallyReceived)
            throw new InvalidOperationException("Não é possível cancelar um pedido que já teve itens recebidos.");

        Status = PurchaseOrderStatus.Cancelled;
        Notes = string.IsNullOrWhiteSpace(Notes) ? $"Cancelamento: {reason.Trim()}" : $"{Notes} | Cancelamento: {reason.Trim()}";
    }
}

public class PurchaseOrderItem : TenantEntity
{
    public Guid PurchaseOrderId { get; private set; }
    public Guid ProductSkuId { get; private set; }
    
    // Snapshots históricos imutáveis do momento da emissão do pedido
    public string HistoricalSkuCode { get; private set; }
    public string HistoricalDescription { get; private set; }

    public decimal QuantityOrdered { get; private set; }
    public decimal QuantityReceived { get; private set; }
    public decimal QuantityPending => Math.Max(0, QuantityOrdered - QuantityReceived);

    public decimal UnitCost { get; private set; }
    public decimal Discount { get; private set; }
    public decimal TotalAmount => Math.Round((QuantityOrdered * UnitCost) - Discount, 2);

    private PurchaseOrderItem() { HistoricalSkuCode = string.Empty; HistoricalDescription = string.Empty; }

    public PurchaseOrderItem(
        Guid tenantId,
        Guid purchaseOrderId,
        Guid productSkuId,
        string historicalSkuCode,
        string historicalDescription,
        decimal quantityOrdered,
        decimal unitCost,
        decimal discount = 0) : base(tenantId)
    {
        if (quantityOrdered <= 0)
            throw new ArgumentException("A quantidade do item deve ser maior que zero.", nameof(quantityOrdered));
        if (unitCost < 0)
            throw new ArgumentException("O custo unitário não pode ser negativo.", nameof(unitCost));
        if (discount < 0)
            throw new ArgumentException("O desconto não pode ser negativo.", nameof(discount));

        PurchaseOrderId = purchaseOrderId;
        ProductSkuId = productSkuId;
        HistoricalSkuCode = historicalSkuCode.Trim();
        HistoricalDescription = historicalDescription.Trim();
        QuantityOrdered = quantityOrdered;
        QuantityReceived = 0;
        UnitCost = unitCost;
        Discount = discount;
    }

    public void RegisterReceipt(decimal receivedQty)
    {
        if (receivedQty <= 0)
            throw new ArgumentException("A quantidade recebida deve ser maior que zero.", nameof(receivedQty));

        if (QuantityReceived + receivedQty > QuantityOrdered)
            throw new InvalidOperationException($"Recebimento de {receivedQty} excede o saldo pendente de {QuantityPending} no item {HistoricalSkuCode}.");

        QuantityReceived += receivedQty;
    }
}

#endregion

#region Goods Receipt (Recebimento de Mercadorias e Conferência)

public enum GoodsReceiptStatus
{
    ReceivedInInspection = 1,
    ApprovedAndPosted = 2,
    Rejected = 3
}

public class GoodsReceipt : TenantEntity
{
    public Guid BranchId { get; private set; }
    public Guid WarehouseId { get; private set; }
    public Guid? WarehouseLocationId { get; private set; }
    public Guid? PurchaseOrderId { get; private set; }
    public Guid SupplierPartyId { get; private set; }
    public string ReceiptNumber { get; private set; }
    public string InvoiceOrDocumentNumber { get; private set; }
    public GoodsReceiptStatus Status { get; private set; }
    public string? Notes { get; private set; }
    public string? IdempotencyKey { get; private set; }
    public Guid ReceivedByUserId { get; private set; }

    private readonly List<GoodsReceiptItem> _items = [];
    public IReadOnlyCollection<GoodsReceiptItem> Items => _items.AsReadOnly();

    private GoodsReceipt() { ReceiptNumber = string.Empty; InvoiceOrDocumentNumber = string.Empty; }

    public GoodsReceipt(
        Guid tenantId,
        Guid branchId,
        Guid warehouseId,
        Guid? warehouseLocationId,
        Guid? purchaseOrderId,
        Guid supplierPartyId,
        string receiptNumber,
        string invoiceOrDocumentNumber,
        Guid receivedByUserId,
        string? idempotencyKey = null,
        string? notes = null) : base(tenantId)
    {
        if (string.IsNullOrWhiteSpace(receiptNumber))
            throw new ArgumentException("Número de recebimento é obrigatório.", nameof(receiptNumber));
        if (string.IsNullOrWhiteSpace(invoiceOrDocumentNumber))
            throw new ArgumentException("Número da NF ou documento de entrega é obrigatório.", nameof(invoiceOrDocumentNumber));

        BranchId = branchId;
        WarehouseId = warehouseId;
        WarehouseLocationId = warehouseLocationId;
        PurchaseOrderId = purchaseOrderId;
        SupplierPartyId = supplierPartyId;
        ReceiptNumber = receiptNumber.Trim().ToUpperInvariant();
        InvoiceOrDocumentNumber = invoiceOrDocumentNumber.Trim();
        ReceivedByUserId = receivedByUserId;
        IdempotencyKey = idempotencyKey?.Trim();
        Notes = notes?.Trim();
        Status = GoodsReceiptStatus.ReceivedInInspection;
    }

    public void AddItem(
        Guid productSkuId,
        decimal quantityReceived,
        decimal realUnitCost,
        Guid? inventoryUnitId = null,
        string? serialOrImei = null,
        string? notes = null)
    {
        if (Status != GoodsReceiptStatus.ReceivedInInspection)
            throw new InvalidOperationException("Não é possível adicionar itens a um recebimento já postado ou rejeitado.");

        var item = new GoodsReceiptItem(
            TenantId,
            Id,
            productSkuId,
            quantityReceived,
            realUnitCost,
            inventoryUnitId,
            serialOrImei,
            notes
        );

        _items.Add(item);
    }

    public void MarkApprovedAndPosted()
    {
        if (Status != GoodsReceiptStatus.ReceivedInInspection)
            throw new InvalidOperationException("Apenas recebimentos em inspeção podem ser aprovados e postados no Kardex.");

        Status = GoodsReceiptStatus.ApprovedAndPosted;
    }

    public void MarkRejected(string reason)
    {
        if (Status != GoodsReceiptStatus.ReceivedInInspection)
            throw new InvalidOperationException("Apenas recebimentos em inspeção podem ser rejeitados.");

        Status = GoodsReceiptStatus.Rejected;
        Notes = string.IsNullOrWhiteSpace(Notes) ? $"Rejeitado: {reason.Trim()}" : $"{Notes} | Rejeitado: {reason.Trim()}";
    }
}

public class GoodsReceiptItem : TenantEntity
{
    public Guid GoodsReceiptId { get; private set; }
    public Guid ProductSkuId { get; private set; }
    public decimal QuantityReceived { get; private set; }
    public decimal RealUnitCost { get; private set; }
    public decimal TotalCost => Math.Round(QuantityReceived * RealUnitCost, 2);

    public Guid? InventoryUnitId { get; private set; }
    public string? SerialOrImei { get; private set; }
    public string? Notes { get; private set; }

    private GoodsReceiptItem() { }

    public GoodsReceiptItem(
        Guid tenantId,
        Guid goodsReceiptId,
        Guid productSkuId,
        decimal quantityReceived,
        decimal realUnitCost,
        Guid? inventoryUnitId = null,
        string? serialOrImei = null,
        string? notes = null) : base(tenantId)
    {
        if (quantityReceived <= 0)
            throw new ArgumentException("A quantidade recebida deve ser maior que zero.", nameof(quantityReceived));
        if (realUnitCost < 0)
            throw new ArgumentException("O custo unitário real não pode ser negativo.", nameof(realUnitCost));

        GoodsReceiptId = goodsReceiptId;
        ProductSkuId = productSkuId;
        QuantityReceived = quantityReceived;
        RealUnitCost = realUnitCost;
        InventoryUnitId = inventoryUnitId;
        SerialOrImei = serialOrImei?.Trim().ToUpperInvariant();
        Notes = notes?.Trim();
    }
}

#endregion

#region Used Device Acquisition (Aquisição Balcão de Aparelhos Usados)

public enum UsedDeviceStatus
{
    Evaluating = 1,
    Approved = 2,
    ReceivedInStock = 3,
    Rejected = 4
}

public class UsedDeviceAcquisition : TenantEntity
{
    public Guid BranchId { get; private set; }
    public Guid SellerPartyId { get; private set; } // Cliente ou Fornecedor que vendeu no balcão
    public Guid ProductSkuId { get; private set; }
    public Guid? InventoryUnitId { get; private set; }

    public string AcquisitionNumber { get; private set; }
    public string SerialNumber { get; private set; }
    public string? Imei1 { get; private set; }
    public string? Imei2 { get; private set; }

    public ItemCondition Condition { get; private set; }
    public CosmeticGrade Grade { get; private set; }
    public int? BatteryHealthPercentage { get; private set; }

    public decimal NegotiatedPrice { get; private set; }
    public decimal AttributableExpenses { get; private set; } // Reparo inicial, laudo, peças de bancada
    public decimal TotalAcquisitionCost => NegotiatedPrice + AttributableExpenses;

    public string ChecklistInspectionJson { get; private set; } // Resultado técnico detalhado (Tela, Câmera, Touch, Bateria)
    public UsedDeviceStatus Status { get; private set; }
    public string? Notes { get; private set; }
    public Guid CreatedByUserId { get; private set; }
    public Guid? ApprovedByUserId { get; private set; }

    private UsedDeviceAcquisition() 
    { 
        AcquisitionNumber = string.Empty; 
        SerialNumber = string.Empty; 
        ChecklistInspectionJson = string.Empty; 
    }

    public UsedDeviceAcquisition(
        Guid tenantId,
        Guid branchId,
        Guid sellerPartyId,
        Guid productSkuId,
        string acquisitionNumber,
        string serialNumber,
        string? imei1,
        string? imei2,
        ItemCondition condition,
        CosmeticGrade grade,
        int? batteryHealthPercentage,
        decimal negotiatedPrice,
        decimal attributableExpenses,
        string checklistInspectionJson,
        Guid createdByUserId,
        string? notes = null) : base(tenantId)
    {
        if (string.IsNullOrWhiteSpace(acquisitionNumber))
            throw new ArgumentException("Número da aquisição é obrigatório.", nameof(acquisitionNumber));
        if (negotiatedPrice < 0)
            throw new ArgumentException("Preço negociado não pode ser negativo.", nameof(negotiatedPrice));
        if (attributableExpenses < 0)
            throw new ArgumentException("Despesas atribuíveis não podem ser negativas.", nameof(attributableExpenses));

        BranchId = branchId;
        SellerPartyId = sellerPartyId;
        ProductSkuId = productSkuId;
        AcquisitionNumber = acquisitionNumber.Trim().ToUpperInvariant();
        SerialNumber = serialNumber.Trim();
        Imei1 = string.IsNullOrWhiteSpace(imei1) ? null : imei1.Trim();
        Imei2 = string.IsNullOrWhiteSpace(imei2) ? null : imei2.Trim();
        Condition = condition;
        Grade = grade;
        BatteryHealthPercentage = batteryHealthPercentage;
        NegotiatedPrice = negotiatedPrice;
        AttributableExpenses = attributableExpenses;
        ChecklistInspectionJson = checklistInspectionJson;
        CreatedByUserId = createdByUserId;
        Notes = notes?.Trim();
        Status = UsedDeviceStatus.Evaluating;
    }

    public void Approve(Guid approvedByUserId)
    {
        if (Status != UsedDeviceStatus.Evaluating)
            throw new InvalidOperationException("Apenas aquisições em avaliação podem ser aprovadas.");

        Status = UsedDeviceStatus.Approved;
        ApprovedByUserId = approvedByUserId;
    }

    public void MarkReceivedInStock(Guid inventoryUnitId)
    {
        if (Status != UsedDeviceStatus.Approved)
            throw new InvalidOperationException("Apenas aparelhos aprovados na avaliação técnica podem ser recebidos no estoque.");

        InventoryUnitId = inventoryUnitId;
        Status = UsedDeviceStatus.ReceivedInStock;
    }

    public void Reject(string reason)
    {
        if (Status != UsedDeviceStatus.Evaluating)
            throw new InvalidOperationException("Apenas aquisições em avaliação podem ser rejeitadas.");

        Status = UsedDeviceStatus.Rejected;
        Notes = string.IsNullOrWhiteSpace(Notes) ? $"Rejeitado: {reason.Trim()}" : $"{Notes} | Rejeitado: {reason.Trim()}";
    }
}

#endregion

#region Supplier Return (Devolução de Mercadorias ao Fornecedor)

public enum SupplierReturnStatus
{
    Requested = 1,
    DispatchedAndPosted = 2,
    Cancelled = 3
}

public class SupplierReturn : TenantEntity
{
    public Guid BranchId { get; private set; }
    public Guid WarehouseId { get; private set; }
    public Guid SupplierPartyId { get; private set; }
    public Guid? GoodsReceiptId { get; private set; }
    public string ReturnNumber { get; private set; }
    public string Reason { get; private set; }
    public SupplierReturnStatus Status { get; private set; }
    public string? ReturnInvoiceNumber { get; private set; }
    public Guid CreatedByUserId { get; private set; }

    private readonly List<SupplierReturnItem> _items = [];
    public IReadOnlyCollection<SupplierReturnItem> Items => _items.AsReadOnly();

    public decimal TotalReturnAmount => _items.Sum(i => i.TotalAmount);

    private SupplierReturn() { ReturnNumber = string.Empty; Reason = string.Empty; }

    public SupplierReturn(
        Guid tenantId,
        Guid branchId,
        Guid warehouseId,
        Guid supplierPartyId,
        Guid? goodsReceiptId,
        string returnNumber,
        string reason,
        Guid createdByUserId,
        string? returnInvoiceNumber = null) : base(tenantId)
    {
        if (string.IsNullOrWhiteSpace(returnNumber))
            throw new ArgumentException("Número de devolução é obrigatório.", nameof(returnNumber));
        if (string.IsNullOrWhiteSpace(reason))
            throw new ArgumentException("Motivo da devolução é obrigatório.", nameof(reason));

        BranchId = branchId;
        WarehouseId = warehouseId;
        SupplierPartyId = supplierPartyId;
        GoodsReceiptId = goodsReceiptId;
        ReturnNumber = returnNumber.Trim().ToUpperInvariant();
        Reason = reason.Trim();
        CreatedByUserId = createdByUserId;
        ReturnInvoiceNumber = returnInvoiceNumber?.Trim();
        Status = SupplierReturnStatus.Requested;
    }

    public void AddItem(Guid productSkuId, decimal quantity, decimal unitCost, Guid? inventoryUnitId = null)
    {
        if (Status != SupplierReturnStatus.Requested)
            throw new InvalidOperationException("Não é possível adicionar itens a devoluções já despachadas ou canceladas.");

        var item = new SupplierReturnItem(TenantId, Id, productSkuId, quantity, unitCost, inventoryUnitId);
        _items.Add(item);
    }

    public void DispatchAndPost()
    {
        if (Status != SupplierReturnStatus.Requested)
            throw new InvalidOperationException("Apenas devoluções solicitadas podem ser despachadas.");
        if (_items.Count == 0)
            throw new InvalidOperationException("A devolução precisa conter ao menos um item.");

        Status = SupplierReturnStatus.DispatchedAndPosted;
    }

    public void Cancel()
    {
        if (Status == SupplierReturnStatus.DispatchedAndPosted)
            throw new InvalidOperationException("Não é possível cancelar uma devolução já despachada no estoque.");

        Status = SupplierReturnStatus.Cancelled;
    }
}

public class SupplierReturnItem : TenantEntity
{
    public Guid SupplierReturnId { get; private set; }
    public Guid ProductSkuId { get; private set; }
    public decimal Quantity { get; private set; }
    public decimal UnitCost { get; private set; }
    public decimal TotalAmount => Math.Round(Quantity * UnitCost, 2);
    public Guid? InventoryUnitId { get; private set; }

    private SupplierReturnItem() { }

    public SupplierReturnItem(
        Guid tenantId,
        Guid supplierReturnId,
        Guid productSkuId,
        decimal quantity,
        decimal unitCost,
        Guid? inventoryUnitId = null) : base(tenantId)
    {
        if (quantity <= 0)
            throw new ArgumentException("Quantidade devolvida deve ser maior que zero.", nameof(quantity));
        if (unitCost < 0)
            throw new ArgumentException("Custo unitário não pode ser negativo.", nameof(unitCost));

        SupplierReturnId = supplierReturnId;
        ProductSkuId = productSkuId;
        Quantity = quantity;
        UnitCost = unitCost;
        InventoryUnitId = inventoryUnitId;
    }
}

#endregion
