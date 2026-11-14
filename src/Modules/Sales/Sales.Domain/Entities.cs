using BuildingBlocks.Domain;
using Catalog.Domain;
using Inventory.Domain;
using Parties.Domain;

namespace Sales.Domain;

#region Sales Quote (Orçamentos Comerciais)

public enum SalesQuoteStatus
{
    Draft = 1,
    Sent = 2,
    Accepted = 3,
    Rejected = 4,
    Expired = 5,
    ConvertedToSale = 6,
    Cancelled = 7
}

public class SalesQuote : TenantEntity
{
    public Guid BranchId { get; private set; }
    public string QuoteNumber { get; private set; }
    public Guid? CustomerPartyId { get; private set; }
    public Guid SellerUserId { get; private set; }
    public SalesQuoteStatus Status { get; private set; }
    public DateTime ValidUntilUtc { get; private set; }
    public string? PaymentTermsExpected { get; private set; }
    public string? Notes { get; private set; }
    public Guid? ConvertedSaleId { get; private set; }

    public decimal Subtotal => _items.Sum(i => i.TotalAmount);
    public decimal DiscountTotal { get; private set; }
    public decimal ShippingTotal { get; private set; }
    public decimal GrandTotal => Math.Max(0, Subtotal + ShippingTotal - DiscountTotal);

    private readonly List<SalesQuoteItem> _items = [];
    public IReadOnlyCollection<SalesQuoteItem> Items => _items.AsReadOnly();

    private SalesQuote() { QuoteNumber = string.Empty; }

    public SalesQuote(
        Guid tenantId,
        Guid branchId,
        string quoteNumber,
        Guid? customerPartyId,
        Guid sellerUserId,
        DateTime validUntilUtc,
        string? paymentTermsExpected = null,
        decimal shippingTotal = 0,
        decimal discountTotal = 0,
        string? notes = null) : base(tenantId)
    {
        if (string.IsNullOrWhiteSpace(quoteNumber))
            throw new ArgumentException("Número do orçamento é obrigatório.", nameof(quoteNumber));
        if (shippingTotal < 0)
            throw new ArgumentException("Frete não pode ser negativo.", nameof(shippingTotal));
        if (discountTotal < 0)
            throw new ArgumentException("Desconto não pode ser negativo.", nameof(discountTotal));

        BranchId = branchId;
        QuoteNumber = quoteNumber.Trim().ToUpperInvariant();
        CustomerPartyId = customerPartyId;
        SellerUserId = sellerUserId;
        ValidUntilUtc = validUntilUtc;
        PaymentTermsExpected = paymentTermsExpected?.Trim();
        ShippingTotal = shippingTotal;
        DiscountTotal = discountTotal;
        Notes = notes?.Trim();
        Status = SalesQuoteStatus.Draft;
    }

    public void AddItem(
        Guid productSkuId,
        string historicalSkuCode,
        string historicalDescription,
        decimal quantity,
        decimal unitPrice,
        decimal discount = 0,
        Guid? inventoryUnitId = null,
        string? serialOrImei = null)
    {
        if (Status != SalesQuoteStatus.Draft)
            throw new InvalidOperationException("Não é possível alterar orçamento que não esteja em rascunho.");

        var item = new SalesQuoteItem(
            TenantId,
            Id,
            productSkuId,
            historicalSkuCode,
            historicalDescription,
            quantity,
            unitPrice,
            discount,
            inventoryUnitId,
            serialOrImei
        );

        _items.Add(item);
    }

    public void MarkSent()
    {
        if (Status != SalesQuoteStatus.Draft)
            throw new InvalidOperationException("Apenas orçamentos em rascunho podem ser enviados.");
        if (_items.Count == 0)
            throw new InvalidOperationException("Orçamento precisa ter ao menos um item para ser enviado.");

        Status = SalesQuoteStatus.Sent;
    }

    public void MarkAccepted()
    {
        if (Status != SalesQuoteStatus.Sent && Status != SalesQuoteStatus.Draft)
            throw new InvalidOperationException("Apenas orçamentos enviados ou em rascunho podem ser aceitos.");
        if (DateTime.UtcNow > ValidUntilUtc)
            throw new InvalidOperationException("O orçamento expirou em sua validade comercial.");

        Status = SalesQuoteStatus.Accepted;
    }

    public void MarkConverted(Guid saleId)
    {
        if (Status != SalesQuoteStatus.Accepted && Status != SalesQuoteStatus.Draft && Status != SalesQuoteStatus.Sent)
            throw new InvalidOperationException("Orçamento em status inválido para conversão.");

        ConvertedSaleId = saleId;
        Status = SalesQuoteStatus.ConvertedToSale;
    }

    public void MarkCancelled(string reason)
    {
        if (Status == SalesQuoteStatus.ConvertedToSale)
            throw new InvalidOperationException("Não é possível cancelar um orçamento já convertido em venda.");

        Status = SalesQuoteStatus.Cancelled;
        Notes = string.IsNullOrWhiteSpace(Notes) ? $"Cancelamento: {reason.Trim()}" : $"{Notes} | Cancelamento: {reason.Trim()}";
    }
}

public class SalesQuoteItem : TenantEntity
{
    public Guid SalesQuoteId { get; private set; }
    public Guid ProductSkuId { get; private set; }
    public string HistoricalSkuCode { get; private set; }
    public string HistoricalDescription { get; private set; }
    public decimal Quantity { get; private set; }
    public decimal UnitPrice { get; private set; }
    public decimal Discount { get; private set; }
    public decimal TotalAmount => Math.Round((Quantity * UnitPrice) - Discount, 2);

    public Guid? InventoryUnitId { get; private set; }
    public string? SerialOrImei { get; private set; }

    private SalesQuoteItem() { HistoricalSkuCode = string.Empty; HistoricalDescription = string.Empty; }

    public SalesQuoteItem(
        Guid tenantId,
        Guid salesQuoteId,
        Guid productSkuId,
        string historicalSkuCode,
        string historicalDescription,
        decimal quantity,
        decimal unitPrice,
        decimal discount = 0,
        Guid? inventoryUnitId = null,
        string? serialOrImei = null) : base(tenantId)
    {
        if (quantity <= 0)
            throw new ArgumentException("Quantidade deve ser maior que zero.", nameof(quantity));
        if (unitPrice < 0)
            throw new ArgumentException("Preço unitário não pode ser negativo.", nameof(unitPrice));
        if (discount < 0)
            throw new ArgumentException("Desconto não pode ser negativo.", nameof(discount));

        SalesQuoteId = salesQuoteId;
        ProductSkuId = productSkuId;
        HistoricalSkuCode = historicalSkuCode.Trim();
        HistoricalDescription = historicalDescription.Trim();
        Quantity = quantity;
        UnitPrice = unitPrice;
        Discount = discount;
        InventoryUnitId = inventoryUnitId;
        SerialOrImei = serialOrImei?.Trim().ToUpperInvariant();
    }
}

#endregion

#region Sale & PDV Aggregate

public enum SaleStatus
{
    Draft = 1,              // Carrinho / Em elaboração no PDV
    Reserved = 2,           // Estoque reservado formalmente pelo checkout
    AwaitingPayment = 3,    // Aguardando liquidação dos meios de pagamento
    Confirmed = 4,          // Pagamento confirmado e venda concretizada
    Fulfilled = 5,          // Mercadoria entregue ao cliente
    Cancelled = 6,          // Venda cancelada
    PartiallyReturned = 7,  // Devolução parcial de itens
    Returned = 8            // Devolução total
}

public enum SalePaymentStatus
{
    NotStarted = 1,         // Nenhum pagamento iniciado
    Pending = 2,            // Cobranças pendentes (Pix gerado, boleto pendente)
    PartiallyConfirmed = 3, // Parte da venda paga (em pagamentos mistos)
    Confirmed = 4,          // 100% dos valores pagos e verificados
    Failed = 5,             // Transação recusada pela adquirente
    RefundPending = 6,      // Estorno solicitado
    Refunded = 7            // Estornado
}

public enum SaleFulfillmentStatus
{
    NotFulfilled = 1,       // Ainda não separado / não entregue
    ReadyForPickup = 2,     // Separado na bancada para retirada balcão
    Fulfilled = 3,          // Entregue / Retirado pelo cliente
    Cancelled = 4           // Cancelado
}

public class Sale : TenantEntity
{
    public Guid BranchId { get; private set; }
    public string SaleNumber { get; private set; } // Ex: "VD-2026-0001"
    public Guid? CustomerPartyId { get; private set; } // Opcional (Venda ao Consumidor Final)
    public Guid SellerUserId { get; private set; }
    public Guid CreatedByUserId { get; private set; }
    public Guid? QuoteId { get; private set; }
    public Guid? StockReservationId { get; private set; } // Vinculada ao MOD-03

    public SaleStatus Status { get; private set; }
    public SalePaymentStatus PaymentStatus { get; private set; }
    public SaleFulfillmentStatus FulfillmentStatus { get; private set; }

    public decimal Subtotal => _items.Sum(i => i.TotalAmount);
    public decimal DiscountTotal { get; private set; }
    public decimal ChargesTotal { get; private set; } // Frete / Acréscimo / Embalagem
    public decimal GrandTotal => Math.Max(0, Subtotal + ChargesTotal - DiscountTotal);

    public decimal PaidTotal => _payments.Where(p => p.Status == PaymentIntentStatus.Confirmed).Sum(p => p.Amount);
    public decimal BalanceRemaining => Math.Max(0, GrandTotal - PaidTotal);

    public string? Observations { get; private set; }
    public string? IdempotencyKey { get; private set; }

    public DateTime? ConfirmedAtUtc { get; private set; }
    public DateTime? FulfilledAtUtc { get; private set; }
    public DateTime? CancelledAtUtc { get; private set; }

    private readonly List<SaleItem> _items = [];
    public IReadOnlyCollection<SaleItem> Items => _items.AsReadOnly();

    private readonly List<SalePaymentIntent> _payments = [];
    public IReadOnlyCollection<SalePaymentIntent> Payments => _payments.AsReadOnly();

    private Sale() { SaleNumber = string.Empty; }

    public Sale(
        Guid tenantId,
        Guid branchId,
        string saleNumber,
        Guid? customerPartyId,
        Guid sellerUserId,
        Guid createdByUserId,
        Guid? quoteId = null,
        decimal chargesTotal = 0,
        decimal discountTotal = 0,
        string? observations = null,
        string? idempotencyKey = null) : base(tenantId)
    {
        if (string.IsNullOrWhiteSpace(saleNumber))
            throw new ArgumentException("Número da venda é obrigatório.", nameof(saleNumber));
        if (chargesTotal < 0)
            throw new ArgumentException("Acréscimos não podem ser negativos.", nameof(chargesTotal));
        if (discountTotal < 0)
            throw new ArgumentException("Desconto não pode ser negativo.", nameof(discountTotal));

        BranchId = branchId;
        SaleNumber = saleNumber.Trim().ToUpperInvariant();
        CustomerPartyId = customerPartyId;
        SellerUserId = sellerUserId;
        CreatedByUserId = createdByUserId;
        QuoteId = quoteId;
        ChargesTotal = chargesTotal;
        DiscountTotal = discountTotal;
        Observations = observations?.Trim();
        IdempotencyKey = idempotencyKey?.Trim();

        Status = SaleStatus.Draft;
        PaymentStatus = SalePaymentStatus.NotStarted;
        FulfillmentStatus = SaleFulfillmentStatus.NotFulfilled;
    }

    public void AddItem(
        Guid productSkuId,
        string historicalSkuCode,
        string historicalDescription,
        ItemCondition itemCondition,
        decimal quantity,
        decimal unitPrice,
        decimal discount = 0,
        decimal unitCost = 0,
        Guid? inventoryUnitId = null,
        string? serialOrImei = null,
        int warrantyDays = 90)
    {
        if (Status != SaleStatus.Draft)
            throw new InvalidOperationException("Não é possível alterar itens de venda já iniciada para checkout ou finalizada.");

        var item = new SaleItem(
            TenantId,
            Id,
            productSkuId,
            historicalSkuCode,
            historicalDescription,
            itemCondition,
            quantity,
            unitPrice,
            discount,
            unitCost,
            inventoryUnitId,
            serialOrImei,
            warrantyDays
        );

        _items.Add(item);
    }

    public void ApplyGlobalDiscount(decimal discount, string? reason = null)
    {
        if (Status != SaleStatus.Draft)
            throw new InvalidOperationException("Apenas vendas em rascunho podem ter desconto alterado.");
        if (discount < 0)
            throw new ArgumentException("Desconto não pode ser negativo.", nameof(discount));
        if (discount > Subtotal + ChargesTotal)
            throw new InvalidOperationException("O desconto não pode ser superior ao valor da venda.");

        DiscountTotal = discount;
        if (!string.IsNullOrWhiteSpace(reason))
        {
            Observations = string.IsNullOrWhiteSpace(Observations) ? $"Desconto: {reason.Trim()}" : $"{Observations} | Desconto: {reason.Trim()}";
        }
    }

    public void AssociateReservation(Guid reservationId)
    {
        StockReservationId = reservationId;
        Status = SaleStatus.Reserved;
    }

    public void ClearReservation()
    {
        StockReservationId = null;
        if (Status == SaleStatus.Reserved)
        {
            Status = SaleStatus.Draft;
        }
    }

    public SalePaymentIntent AddPaymentIntent(
        PaymentMethod method,
        decimal amount,
        string? authorizationCode = null,
        string? transactionReference = null,
        int installments = 1,
        string? notes = null)
    {
        if (Status == SaleStatus.Confirmed || Status == SaleStatus.Fulfilled || Status == SaleStatus.Cancelled)
            throw new InvalidOperationException("Não é possível adicionar pagamentos a uma venda encerrada.");

        if (amount <= 0)
            throw new ArgumentException("Valor do pagamento deve ser estritamente positivo.", nameof(amount));

        var payment = new SalePaymentIntent(
            TenantId,
            Id,
            method,
            amount,
            installments,
            authorizationCode,
            transactionReference,
            notes
        );

        _payments.Add(payment);
        UpdatePaymentProgress();
        return payment;
    }

    public void UpdatePaymentProgress()
    {
        var confirmedAmount = _payments.Where(p => p.Status == PaymentIntentStatus.Confirmed).Sum(p => p.Amount);
        var anyPending = _payments.Any(p => p.Status == PaymentIntentStatus.Pending);

        if (confirmedAmount >= GrandTotal && GrandTotal > 0)
        {
            PaymentStatus = SalePaymentStatus.Confirmed;
        }
        else if (confirmedAmount > 0)
        {
            PaymentStatus = SalePaymentStatus.PartiallyConfirmed;
        }
        else if (anyPending)
        {
            PaymentStatus = SalePaymentStatus.Pending;
        }
        else
        {
            PaymentStatus = SalePaymentStatus.NotStarted;
        }
    }

    public void ConfirmSale()
    {
        if (PaymentStatus != SalePaymentStatus.Confirmed)
            throw new InvalidOperationException($"Não é possível confirmar a venda #{SaleNumber}: o pagamento ainda não está 100% quitado (Pendente: R$ {BalanceRemaining:F2}).");

        if (_items.Count == 0)
            throw new InvalidOperationException("Não é possível confirmar uma venda sem itens.");

        Status = SaleStatus.Confirmed;
        ConfirmedAtUtc = DateTime.UtcNow;
    }

    public void MarkFulfilled()
    {
        if (Status != SaleStatus.Confirmed)
            throw new InvalidOperationException("Apenas vendas com pagamento confirmado podem ter a entrega/retirada de mercadorias concluída.");

        Status = SaleStatus.Fulfilled;
        FulfillmentStatus = SaleFulfillmentStatus.Fulfilled;
        FulfilledAtUtc = DateTime.UtcNow;
    }

    public void Cancel(string reason)
    {
        if (Status == SaleStatus.Fulfilled)
            throw new InvalidOperationException("Venda já entregue não pode ser cancelada; utilize o processo formal de Devolução (SaleReturn).");

        Status = SaleStatus.Cancelled;
        CancelledAtUtc = DateTime.UtcNow;
        Observations = string.IsNullOrWhiteSpace(Observations) ? $"Cancelada: {reason.Trim()}" : $"{Observations} | Cancelada: {reason.Trim()}";
    }
}

public class SaleItem : TenantEntity
{
    public Guid SaleId { get; private set; }
    public Guid ProductSkuId { get; private set; }

    // Snapshots históricos imutáveis da venda
    public string HistoricalSkuCode { get; private set; }
    public string HistoricalDescription { get; private set; }
    public ItemCondition ItemCondition { get; private set; }
    public decimal Quantity { get; private set; }
    public decimal UnitPrice { get; private set; }
    public decimal Discount { get; private set; }
    public decimal TotalAmount => Math.Round((Quantity * UnitPrice) - Discount, 2);

    // Custo efetivo individual de saída no momento da venda (sigiloso)
    public decimal HistoricalUnitCost { get; private set; }
    public decimal TotalCost => Math.Round(Quantity * HistoricalUnitCost, 2);

    // Se serializado (iPhone, Notebook)
    public Guid? InventoryUnitId { get; private set; }
    public string? SerialOrImei { get; private set; }
    public int WarrantyDays { get; private set; }

    private SaleItem() { HistoricalSkuCode = string.Empty; HistoricalDescription = string.Empty; }

    public SaleItem(
        Guid tenantId,
        Guid saleId,
        Guid productSkuId,
        string historicalSkuCode,
        string historicalDescription,
        ItemCondition itemCondition,
        decimal quantity,
        decimal unitPrice,
        decimal discount,
        decimal historicalUnitCost,
        Guid? inventoryUnitId = null,
        string? serialOrImei = null,
        int warrantyDays = 90) : base(tenantId)
    {
        if (quantity <= 0)
            throw new ArgumentException("Quantidade deve ser maior que zero.", nameof(quantity));
        if (unitPrice < 0)
            throw new ArgumentException("Preço unitário não pode ser negativo.", nameof(unitPrice));
        if (discount < 0)
            throw new ArgumentException("Desconto não pode ser negativo.", nameof(discount));
        if (historicalUnitCost < 0)
            throw new ArgumentException("Custo unitário histórico não pode ser negativo.", nameof(historicalUnitCost));

        SaleId = saleId;
        ProductSkuId = productSkuId;
        HistoricalSkuCode = historicalSkuCode.Trim();
        HistoricalDescription = historicalDescription.Trim();
        ItemCondition = itemCondition;
        Quantity = quantity;
        UnitPrice = unitPrice;
        Discount = discount;
        HistoricalUnitCost = historicalUnitCost;
        InventoryUnitId = inventoryUnitId;
        SerialOrImei = serialOrImei?.Trim().ToUpperInvariant();
        WarrantyDays = warrantyDays;
    }
}

#endregion

#region Payments & Verifiable Intents

public enum PaymentMethod
{
    Cash = 1,            // Dinheiro no balcão (registro operacional de caixa)
    Pix = 2,             // Pix (com verificação confiável ou webhook)
    CreditCard = 3,      // Cartão de Crédito
    DebitCard = 4,       // Cartão de Débito
    TradeInCredit = 5    // Recompra de Usado (vinculada a UsedDeviceAcquisition)
}

public enum PaymentIntentStatus
{
    Pending = 1,         // Aguardando confirmação (QR Code gerado ou maquininha processando)
    Confirmed = 2,       // Confirmado com evidência de transação
    Declined = 3,        // Recusado pela operadora
    Cancelled = 4,       // Cancelado pelo operador
    Refunded = 5         // Estornado
}

public class SalePaymentIntent : TenantEntity
{
    public Guid SaleId { get; private set; }
    public PaymentMethod Method { get; private set; }
    public decimal Amount { get; private set; }
    public int Installments { get; private set; }
    public PaymentIntentStatus Status { get; private set; }
    public string? AuthorizationCode { get; private set; }
    public string? TransactionReference { get; private set; } // NSU, E2E Pix ou Hash TEF
    public string? Notes { get; private set; }
    public DateTime? ConfirmedAtUtc { get; private set; }

    private SalePaymentIntent() { }

    public SalePaymentIntent(
        Guid tenantId,
        Guid saleId,
        PaymentMethod method,
        decimal amount,
        int installments = 1,
        string? authorizationCode = null,
        string? transactionReference = null,
        string? notes = null) : base(tenantId)
    {
        if (amount <= 0)
            throw new ArgumentException("Valor deve ser maior que zero.", nameof(amount));

        SaleId = saleId;
        Method = method;
        Amount = amount;
        Installments = Math.Max(1, installments);
        AuthorizationCode = authorizationCode?.Trim();
        TransactionReference = transactionReference?.Trim();
        Notes = notes?.Trim();
        Status = PaymentIntentStatus.Pending;
    }

    public void Confirm(string authorizationCode, string? transactionReference = null)
    {
        if (Status != PaymentIntentStatus.Pending)
            throw new InvalidOperationException("Apenas pagamentos pendentes podem ser confirmados.");

        if (string.IsNullOrWhiteSpace(authorizationCode))
            throw new ArgumentException("Código de autorização ou evidência confiável é obrigatória para confirmação.", nameof(authorizationCode));

        AuthorizationCode = authorizationCode.Trim();
        TransactionReference = transactionReference?.Trim() ?? TransactionReference;
        Status = PaymentIntentStatus.Confirmed;
        ConfirmedAtUtc = DateTime.UtcNow;
    }

    public void Decline(string reason)
    {
        if (Status != PaymentIntentStatus.Pending)
            throw new InvalidOperationException("Apenas pagamentos pendentes podem ser marcados como recusados.");

        Status = PaymentIntentStatus.Declined;
        Notes = string.IsNullOrWhiteSpace(Notes) ? $"Recusado: {reason.Trim()}" : $"{Notes} | Recusado: {reason.Trim()}";
    }

    public void Cancel()
    {
        if (Status == PaymentIntentStatus.Confirmed)
            throw new InvalidOperationException("Não é possível cancelar um pagamento já confirmado; utilize estorno.");

        Status = PaymentIntentStatus.Cancelled;
    }
}

#endregion

#region Sale Return (Devoluções Formais de Venda)

public enum SaleReturnStatus
{
    Requested = 1,
    InspectedAndRestocked = 2,
    Rejected = 3,
    Cancelled = 4
}

public class SaleReturn : TenantEntity
{
    public Guid BranchId { get; private set; }
    public Guid SaleId { get; private set; }
    public string ReturnNumber { get; private set; }
    public string Reason { get; private set; }
    public SaleReturnStatus Status { get; private set; }
    public Guid CreatedByUserId { get; private set; }
    public string? InspectionNotes { get; private set; }
    public decimal TotalRefundAmount => _items.Sum(i => i.RefundAmount);

    private readonly List<SaleReturnItem> _items = [];
    public IReadOnlyCollection<SaleReturnItem> Items => _items.AsReadOnly();

    private SaleReturn() { ReturnNumber = string.Empty; Reason = string.Empty; }

    public SaleReturn(
        Guid tenantId,
        Guid branchId,
        Guid saleId,
        string returnNumber,
        string reason,
        Guid createdByUserId) : base(tenantId)
    {
        if (string.IsNullOrWhiteSpace(returnNumber))
            throw new ArgumentException("Número de devolução é obrigatório.", nameof(returnNumber));
        if (string.IsNullOrWhiteSpace(reason))
            throw new ArgumentException("Motivo da devolução é obrigatório.", nameof(reason));

        BranchId = branchId;
        SaleId = saleId;
        ReturnNumber = returnNumber.Trim().ToUpperInvariant();
        Reason = reason.Trim();
        CreatedByUserId = createdByUserId;
        Status = SaleReturnStatus.Requested;
    }

    public void AddItem(Guid saleItemId, Guid productSkuId, decimal quantity, decimal refundAmount, Guid? inventoryUnitId = null)
    {
        if (Status != SaleReturnStatus.Requested)
            throw new InvalidOperationException("Não é possível alterar itens de devolução encerrada.");

        var item = new SaleReturnItem(TenantId, Id, saleItemId, productSkuId, quantity, refundAmount, inventoryUnitId);
        _items.Add(item);
    }

    public void MarkInspectedAndRestocked(string notes)
    {
        if (Status != SaleReturnStatus.Requested)
            throw new InvalidOperationException("Apenas devoluções solicitadas podem ser aprovadas e reinseridas no estoque.");

        Status = SaleReturnStatus.InspectedAndRestocked;
        InspectionNotes = notes.Trim();
    }
}

public class SaleReturnItem : TenantEntity
{
    public Guid SaleReturnId { get; private set; }
    public Guid SaleItemId { get; private set; }
    public Guid ProductSkuId { get; private set; }
    public decimal Quantity { get; private set; }
    public decimal RefundAmount { get; private set; }
    public Guid? InventoryUnitId { get; private set; }

    private SaleReturnItem() { }

    public SaleReturnItem(
        Guid tenantId,
        Guid saleReturnId,
        Guid saleItemId,
        Guid productSkuId,
        decimal quantity,
        decimal refundAmount,
        Guid? inventoryUnitId = null) : base(tenantId)
    {
        if (quantity <= 0)
            throw new ArgumentException("Quantidade deve ser maior que zero.", nameof(quantity));
        if (refundAmount < 0)
            throw new ArgumentException("Valor de reembolso não pode ser negativo.", nameof(refundAmount));

        SaleReturnId = saleReturnId;
        SaleItemId = saleItemId;
        ProductSkuId = productSkuId;
        Quantity = quantity;
        RefundAmount = refundAmount;
        InventoryUnitId = inventoryUnitId;
    }
}

#endregion
