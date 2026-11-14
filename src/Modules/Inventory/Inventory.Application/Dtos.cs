using Inventory.Domain;

namespace Inventory.Application;

public record WarehouseResponse(
    Guid Id,
    Guid BranchId,
    string Code,
    string Name,
    WarehouseType Type,
    string? Description,
    bool IsActive,
    DateTime CreatedAtUtc,
    uint Version
);

public record CreateWarehouseRequest(
    Guid BranchId,
    string Code,
    string Name,
    WarehouseType Type,
    string? Description
);

public record WarehouseLocationResponse(
    Guid Id,
    Guid WarehouseId,
    string Code,
    string Aisle,
    string Shelf,
    string Bin,
    string? Description,
    bool IsBlocked,
    DateTime CreatedAtUtc,
    uint Version
);

public record CreateWarehouseLocationRequest(
    string Aisle,
    string Shelf,
    string Bin,
    string? Description
);

public record StockBalanceResponse(
    Guid Id,
    Guid BranchId,
    Guid WarehouseId,
    string WarehouseName,
    Guid? WarehouseLocationId,
    string? LocationCode,
    Guid ProductSkuId,
    string SkuCode,
    string SkuVariantName,
    decimal OnHandQuantity,
    decimal ReservedQuantity,
    decimal BlockedQuantity,
    decimal AvailableQuantity,
    decimal? AverageCost, // Protegido por inventory.cost.view
    decimal? TotalValuedAmount, // Protegido por inventory.cost.view
    DateTime LastMovementAtUtc,
    uint Version
);

public record StockMovementResponse(
    Guid Id,
    Guid BranchId,
    Guid WarehouseId,
    string WarehouseName,
    Guid? WarehouseLocationId,
    string? LocationCode,
    Guid ProductSkuId,
    string SkuCode,
    Guid? InventoryUnitId,
    string? SerialOrImei,
    StockMovementType MovementType,
    decimal Quantity,
    decimal? UnitCost, // Protegido por inventory.cost.view
    decimal? TotalCost, // Protegido por inventory.cost.view
    decimal BalanceAfterQuantity,
    string DocumentReference,
    string? Reason,
    DateTime CreatedAtUtc,
    Guid CreatedByUserId
);

public record InitialStockReceiptRequest(
    Guid BranchId,
    Guid WarehouseId,
    Guid? WarehouseLocationId,
    Guid ProductSkuId,
    decimal Quantity,
    decimal UnitCost,
    string DocumentReference,
    string? Reason,
    Guid? InventoryUnitId = null,
    string? IdempotencyKey = null
);

public record StockReservationResponse(
    Guid Id,
    Guid BranchId,
    string ReservationNumber,
    ReservationStatus Status,
    string Reason,
    string? DocumentReference,
    DateTime ExpiresAtUtc,
    DateTime CreatedAtUtc,
    uint Version,
    IReadOnlyList<StockReservationItemResponse> Items
);

public record StockReservationItemResponse(
    Guid Id,
    Guid WarehouseId,
    Guid? WarehouseLocationId,
    Guid ProductSkuId,
    decimal Quantity,
    Guid? InventoryUnitId
);

public record CreateReservationRequest(
    Guid BranchId,
    string ReservationNumber,
    string Reason,
    DateTime ExpiresAtUtc,
    string? DocumentReference,
    string? IdempotencyKey,
    List<CreateReservationItemRequest> Items
);

public record CreateReservationItemRequest(
    Guid WarehouseId,
    Guid? WarehouseLocationId,
    Guid ProductSkuId,
    decimal Quantity,
    Guid? InventoryUnitId = null
);

public record StockTransferResponse(
    Guid Id,
    string TransferNumber,
    Guid SourceBranchId,
    Guid SourceWarehouseId,
    Guid TargetBranchId,
    Guid TargetWarehouseId,
    TransferStatus Status,
    string? Notes,
    DateTime? DispatchedAtUtc,
    DateTime? ReceivedAtUtc,
    DateTime CreatedAtUtc,
    uint Version,
    IReadOnlyList<StockTransferItemResponse> Items
);

public record StockTransferItemResponse(
    Guid Id,
    Guid ProductSkuId,
    decimal Quantity,
    Guid? InventoryUnitId
);

public record CreateTransferRequest(
    string TransferNumber,
    Guid SourceBranchId,
    Guid SourceWarehouseId,
    Guid TargetBranchId,
    Guid TargetWarehouseId,
    string? Notes,
    List<CreateTransferItemRequest> Items
);

public record CreateTransferItemRequest(
    Guid ProductSkuId,
    decimal Quantity,
    Guid? InventoryUnitId = null
);

public record InventoryCountResponse(
    Guid Id,
    string CountNumber,
    Guid BranchId,
    Guid WarehouseId,
    InventoryCountStatus Status,
    string Description,
    DateTime? PostedAtUtc,
    DateTime CreatedAtUtc,
    uint Version,
    IReadOnlyList<InventoryCountItemResponse> Items
);

public record InventoryCountItemResponse(
    Guid Id,
    Guid ProductSkuId,
    Guid? InventoryUnitId,
    decimal SystemSnapshotQuantity,
    decimal CountedQuantity,
    decimal VarianceQuantity,
    string? Notes
);

public record CreateInventoryCountRequest(
    Guid BranchId,
    Guid WarehouseId,
    string CountNumber,
    string Description
);

public record RecordCountItemRequest(
    Guid ProductSkuId,
    decimal SystemSnapshotQuantity,
    decimal CountedQuantity,
    Guid? InventoryUnitId = null,
    string? Notes = null
);
