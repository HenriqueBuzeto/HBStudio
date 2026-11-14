using Procurement.Domain;

namespace Procurement.Application;

#region Purchase Request DTOs

public record CreatePurchaseRequestItemDto(
    Guid ProductSkuId,
    decimal Quantity,
    decimal EstimatedUnitCost,
    string? Notes = null
);

public record CreatePurchaseRequestDto(
    Guid BranchId,
    string RequestNumber,
    string Justification,
    DateTime RequiredDateUtc,
    List<CreatePurchaseRequestItemDto> Items
);

public record PurchaseRequestItemResponse(
    Guid Id,
    Guid ProductSkuId,
    string? SkuCode,
    string? SkuName,
    decimal Quantity,
    decimal? EstimatedUnitCost,
    decimal? EstimatedTotalCost,
    string? Notes
);

public record PurchaseRequestResponse(
    Guid Id,
    Guid BranchId,
    string RequestNumber,
    PurchaseRequestStatus Status,
    string Justification,
    DateTime RequiredDateUtc,
    Guid RequestedByUserId,
    Guid? ApprovedByUserId,
    DateTime? DecidedAtUtc,
    string? DecisionNotes,
    decimal? TotalEstimatedCost,
    List<PurchaseRequestItemResponse> Items,
    DateTime CreatedAtUtc,
    uint Version
);

#endregion

#region Supplier Quotation DTOs

public record CreateSupplierQuotationItemDto(
    Guid ProductSkuId,
    decimal Quantity,
    decimal UnitPrice,
    decimal DiscountAmount = 0
);

public record CreateSupplierQuotationDto(
    Guid BranchId,
    Guid SupplierPartyId,
    string QuotationNumber,
    DateTime ValidUntilUtc,
    int LeadTimeDays,
    decimal ShippingFee,
    string? PaymentTerms,
    List<CreateSupplierQuotationItemDto> Items,
    string? Notes = null
);

public record SupplierQuotationItemResponse(
    Guid Id,
    Guid ProductSkuId,
    string? SkuCode,
    string? SkuName,
    decimal Quantity,
    decimal? UnitPrice,
    decimal? DiscountAmount,
    decimal? TotalAmount
);

public record SupplierQuotationResponse(
    Guid Id,
    Guid BranchId,
    Guid SupplierPartyId,
    string? SupplierName,
    string QuotationNumber,
    QuotationStatus Status,
    DateTime ValidUntilUtc,
    int LeadTimeDays,
    decimal? ShippingFee,
    decimal? TotalEstimatedCost,
    string? PaymentTerms,
    string? Notes,
    Guid CreatedByUserId,
    List<SupplierQuotationItemResponse> Items,
    DateTime CreatedAtUtc,
    uint Version
);

#endregion

#region Purchase Order DTOs

public record CreatePurchaseOrderItemDto(
    Guid ProductSkuId,
    decimal QuantityOrdered,
    decimal UnitCost,
    decimal Discount = 0
);

public record CreatePurchaseOrderDto(
    Guid BranchId,
    Guid SupplierPartyId,
    string OrderNumber,
    DateTime? ExpectedDeliveryDateUtc,
    string? PaymentTerms,
    decimal ShippingCost,
    decimal OtherExpenses,
    decimal TotalDiscount,
    List<CreatePurchaseOrderItemDto> Items,
    string? Notes = null
);

public record PurchaseOrderItemResponse(
    Guid Id,
    Guid ProductSkuId,
    string HistoricalSkuCode,
    string HistoricalDescription,
    decimal QuantityOrdered,
    decimal QuantityReceived,
    decimal QuantityPending,
    decimal? UnitCost,
    decimal? Discount,
    decimal? TotalAmount
);

public record PurchaseOrderResponse(
    Guid Id,
    Guid BranchId,
    Guid SupplierPartyId,
    string? SupplierName,
    string OrderNumber,
    PurchaseOrderStatus Status,
    DateTime? ExpectedDeliveryDateUtc,
    string? PaymentTerms,
    decimal? ShippingCost,
    decimal? OtherExpenses,
    decimal? TotalDiscount,
    decimal? ItemsSubtotal,
    decimal? TotalOrderAmount,
    string? Notes,
    Guid CreatedByUserId,
    Guid? ApprovedByUserId,
    DateTime? ApprovedAtUtc,
    List<PurchaseOrderItemResponse> Items,
    DateTime CreatedAtUtc,
    uint Version
);

#endregion

#region Goods Receipt DTOs

public record CreateGoodsReceiptItemDto(
    Guid ProductSkuId,
    decimal QuantityReceived,
    decimal RealUnitCost,
    Guid? InventoryUnitId = null,
    string? SerialOrImei = null,
    string? Notes = null
);

public record CreateGoodsReceiptDto(
    Guid BranchId,
    Guid WarehouseId,
    Guid? WarehouseLocationId,
    Guid? PurchaseOrderId,
    Guid SupplierPartyId,
    string ReceiptNumber,
    string InvoiceOrDocumentNumber,
    List<CreateGoodsReceiptItemDto> Items,
    string? IdempotencyKey = null,
    string? Notes = null
);

public record GoodsReceiptItemResponse(
    Guid Id,
    Guid ProductSkuId,
    string? SkuCode,
    string? SkuName,
    decimal QuantityReceived,
    decimal? RealUnitCost,
    decimal? TotalCost,
    Guid? InventoryUnitId,
    string? SerialOrImei,
    string? Notes
);

public record GoodsReceiptResponse(
    Guid Id,
    Guid BranchId,
    Guid WarehouseId,
    string? WarehouseName,
    Guid? WarehouseLocationId,
    string? WarehouseLocationCode,
    Guid? PurchaseOrderId,
    string? OrderNumber,
    Guid SupplierPartyId,
    string? SupplierName,
    string ReceiptNumber,
    string InvoiceOrDocumentNumber,
    GoodsReceiptStatus Status,
    string? IdempotencyKey,
    string? Notes,
    Guid ReceivedByUserId,
    List<GoodsReceiptItemResponse> Items,
    DateTime CreatedAtUtc,
    uint Version
);

#endregion

#region Used Device Acquisition DTOs

public record RegisterUsedDeviceAcquisitionDto(
    Guid BranchId,
    Guid WarehouseId,
    Guid? WarehouseLocationId,
    Guid SellerPartyId,
    Guid ProductSkuId,
    string AcquisitionNumber,
    string SerialNumber,
    string? Imei1,
    string? Imei2,
    Catalog.Domain.ItemCondition Condition,
    Catalog.Domain.CosmeticGrade Grade,
    int? BatteryHealthPercentage,
    decimal NegotiatedPrice,
    decimal AttributableExpenses,
    string ChecklistInspectionJson,
    string? Notes = null
);

public record UsedDeviceAcquisitionResponse(
    Guid Id,
    Guid BranchId,
    Guid SellerPartyId,
    string? SellerName,
    Guid ProductSkuId,
    string? SkuCode,
    string? SkuName,
    Guid? InventoryUnitId,
    string AcquisitionNumber,
    string SerialNumber,
    string? Imei1,
    string? Imei2,
    Catalog.Domain.ItemCondition Condition,
    Catalog.Domain.CosmeticGrade Grade,
    int? BatteryHealthPercentage,
    decimal? NegotiatedPrice,
    decimal? AttributableExpenses,
    decimal? TotalAcquisitionCost,
    string ChecklistInspectionJson,
    UsedDeviceStatus Status,
    string? Notes,
    Guid CreatedByUserId,
    Guid? ApprovedByUserId,
    DateTime CreatedAtUtc,
    uint Version
);

#endregion

#region Supplier Return DTOs

public record CreateSupplierReturnItemDto(
    Guid ProductSkuId,
    decimal Quantity,
    decimal UnitCost,
    Guid? InventoryUnitId = null
);

public record CreateSupplierReturnDto(
    Guid BranchId,
    Guid WarehouseId,
    Guid SupplierPartyId,
    Guid? GoodsReceiptId,
    string ReturnNumber,
    string Reason,
    List<CreateSupplierReturnItemDto> Items,
    string? ReturnInvoiceNumber = null
);

public record SupplierReturnItemResponse(
    Guid Id,
    Guid ProductSkuId,
    string? SkuCode,
    string? SkuName,
    decimal Quantity,
    decimal? UnitCost,
    decimal? TotalAmount,
    Guid? InventoryUnitId
);

public record SupplierReturnResponse(
    Guid Id,
    Guid BranchId,
    Guid WarehouseId,
    string? WarehouseName,
    Guid SupplierPartyId,
    string? SupplierName,
    Guid? GoodsReceiptId,
    string ReturnNumber,
    string Reason,
    SupplierReturnStatus Status,
    string? ReturnInvoiceNumber,
    decimal? TotalReturnAmount,
    Guid CreatedByUserId,
    List<SupplierReturnItemResponse> Items,
    DateTime CreatedAtUtc,
    uint Version
);

#endregion
