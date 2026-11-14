using Catalog.Domain;
using Sales.Domain;

namespace Sales.Application;

#region Quotes DTOs

public record CreateSalesQuoteItemDto(
    Guid ProductSkuId,
    decimal Quantity,
    decimal UnitPrice,
    decimal Discount = 0,
    Guid? InventoryUnitId = null,
    string? SerialOrImei = null
);

public record CreateSalesQuoteDto(
    Guid BranchId,
    string QuoteNumber,
    Guid? CustomerPartyId,
    DateTime ValidUntilUtc,
    string? PaymentTermsExpected,
    decimal ShippingTotal,
    decimal DiscountTotal,
    List<CreateSalesQuoteItemDto> Items,
    string? Notes = null
);

public record SalesQuoteItemResponse(
    Guid Id,
    Guid ProductSkuId,
    string HistoricalSkuCode,
    string HistoricalDescription,
    decimal Quantity,
    decimal UnitPrice,
    decimal Discount,
    decimal TotalAmount,
    Guid? InventoryUnitId,
    string? SerialOrImei
);

public record SalesQuoteResponse(
    Guid Id,
    Guid BranchId,
    string QuoteNumber,
    Guid? CustomerPartyId,
    string? CustomerName,
    Guid SellerUserId,
    SalesQuoteStatus Status,
    DateTime ValidUntilUtc,
    string? PaymentTermsExpected,
    decimal Subtotal,
    decimal ShippingTotal,
    decimal DiscountTotal,
    decimal GrandTotal,
    string? Notes,
    Guid? ConvertedSaleId,
    List<SalesQuoteItemResponse> Items,
    DateTime CreatedAtUtc,
    uint Version
);

#endregion

#region Sale & PDV DTOs

public record CreateSaleItemDto(
    Guid ProductSkuId,
    decimal Quantity,
    decimal UnitPrice,
    decimal Discount = 0,
    Guid? InventoryUnitId = null,
    string? SerialOrImei = null,
    int WarrantyDays = 90
);

public record CreateSaleDto(
    Guid BranchId,
    Guid? CustomerPartyId,
    string SaleNumber,
    decimal ChargesTotal,
    decimal DiscountTotal,
    List<CreateSaleItemDto> Items,
    string? Observations = null,
    string? IdempotencyKey = null
);

public record SaleItemResponse(
    Guid Id,
    Guid ProductSkuId,
    string HistoricalSkuCode,
    string HistoricalDescription,
    ItemCondition ItemCondition,
    decimal Quantity,
    decimal UnitPrice,
    decimal Discount,
    decimal TotalAmount,
    decimal? HistoricalUnitCost,
    decimal? TotalCost,
    Guid? InventoryUnitId,
    string? SerialOrImei,
    int WarrantyDays
);

public record SalePaymentIntentResponse(
    Guid Id,
    PaymentMethod Method,
    decimal Amount,
    int Installments,
    PaymentIntentStatus Status,
    string? AuthorizationCode,
    string? TransactionReference,
    string? Notes,
    DateTime? ConfirmedAtUtc
);

public record SaleResponse(
    Guid Id,
    Guid BranchId,
    string SaleNumber,
    Guid? CustomerPartyId,
    string? CustomerName,
    Guid SellerUserId,
    Guid CreatedByUserId,
    Guid? QuoteId,
    Guid? StockReservationId,
    SaleStatus Status,
    SalePaymentStatus PaymentStatus,
    SaleFulfillmentStatus FulfillmentStatus,
    decimal Subtotal,
    decimal ChargesTotal,
    decimal DiscountTotal,
    decimal GrandTotal,
    decimal PaidTotal,
    decimal BalanceRemaining,
    decimal? TotalHistoricalCost,
    decimal? EstimatedProfitMargin,
    string? Observations,
    string? IdempotencyKey,
    DateTime? ConfirmedAtUtc,
    DateTime? FulfilledAtUtc,
    DateTime? CancelledAtUtc,
    List<SaleItemResponse> Items,
    List<SalePaymentIntentResponse> Payments,
    DateTime CreatedAtUtc,
    uint Version
);

public record AddPaymentIntentRequest(
    PaymentMethod Method,
    decimal Amount,
    int Installments = 1,
    string? AuthorizationCode = null,
    string? TransactionReference = null,
    string? Notes = null
);

public record ConfirmPaymentIntentRequest(
    string AuthorizationCode,
    string? TransactionReference = null
);

public record CreateSaleReturnItemDto(
    Guid SaleItemId,
    Guid ProductSkuId,
    decimal Quantity,
    decimal RefundAmount,
    Guid? InventoryUnitId = null
);

public record CreateSaleReturnDto(
    Guid BranchId,
    Guid SaleId,
    string ReturnNumber,
    string Reason,
    List<CreateSaleReturnItemDto> Items
);

public record SaleReturnItemResponse(
    Guid Id,
    Guid SaleItemId,
    Guid ProductSkuId,
    string? SkuCode,
    decimal Quantity,
    decimal RefundAmount,
    Guid? InventoryUnitId
);

public record SaleReturnResponse(
    Guid Id,
    Guid BranchId,
    Guid SaleId,
    string ReturnNumber,
    string Reason,
    SaleReturnStatus Status,
    string? InspectionNotes,
    decimal TotalRefundAmount,
    Guid CreatedByUserId,
    List<SaleReturnItemResponse> Items,
    DateTime CreatedAtUtc,
    uint Version
);

#endregion
