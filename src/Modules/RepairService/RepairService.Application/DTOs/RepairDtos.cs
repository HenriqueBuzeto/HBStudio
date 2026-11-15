using RepairService.Domain.Enums;

namespace RepairService.Application.DTOs;

public record CreateRepairOrderRequest(
    Guid BranchId,
    string OrderNumber,
    Guid CustomerId,
    Guid CustomerEquipmentId,
    string ReportedDefect,
    string? PhysicalConditionNotes,
    string? AccessoriesIncluded,
    DateTime? EstimatedCompletionUtc,
    Guid? AssignedTechnicianId = null,
    Guid? OriginalRepairOrderId = null
);

public record AddChecklistItemRequest(
    string Category,
    string ItemName,
    ChecklistItemStatus Status,
    string? Notes,
    bool IsOutputCheck = false
);

public record CompleteDiagnosisRequest(
    string DiagnosticNotes
);

public record AddEstimateItemRequest(
    RepairEstimateItemType ItemType,
    string Description,
    decimal Quantity,
    decimal UnitPrice,
    decimal UnitCost,
    Guid? ProductSkuId = null
);

public record ApproveEstimateRequest(
    string ApprovalChannel,
    string? ApprovalEvidence
);

public record RejectEstimateRequest(
    string Reason
);

public record ReservePartRequest(
    Guid ProductSkuId,
    Guid WarehouseId,
    Guid WarehouseLocationId,
    decimal Quantity,
    Guid? InventoryUnitId = null
);

public record ConsumePartRequest(
    Guid ProductSkuId,
    string PartDescription,
    decimal Quantity,
    decimal ActualUnitCost,
    Guid? InventoryUnitId = null,
    Guid? StockMovementId = null
);

public record CompleteRepairRequest(
    string ResolutionNotes,
    decimal TechnicianLaborCost = 0
);

public record PassQualityCheckRequest(
    string QaNotes
);

public record DeliverRepairOrderRequest(
    string DeliveredToPersonName,
    string? DeliveredToDocumentNumber,
    string? DeliveryNotes,
    int AdditionalWarrantyDays = 0
);

public record CreateWarrantyClaimRequest(
    string DefectDescription,
    DateTime ClaimDateUtc
);

public record DecideWarrantyClaimRequest(
    WarrantyCoverageDecision Decision,
    string Rationale,
    Guid? FollowUpRepairOrderId = null
);

// Respostas
public record RepairOrderResponse(
    Guid Id,
    Guid BranchId,
    string OrderNumber,
    Guid CustomerId,
    Guid CustomerEquipmentId,
    Guid? AssignedTechnicianId,
    RepairOrderStatus Status,
    string ReportedDefect,
    string? PhysicalConditionNotes,
    string? AccessoriesIncluded,
    string? DiagnosticNotes,
    string? ResolutionNotes,
    DateTime ReceivedAtUtc,
    DateTime? EstimatedCompletionUtc,
    DateTime? DiagnosisCompletedAtUtc,
    DateTime? RepairedAtUtc,
    DateTime? QualityCheckedAtUtc,
    DateTime? DeliveredAtUtc,
    Guid? OriginalRepairOrderId,
    int LegalWarrantyDays,
    int AdditionalWarrantyDays,
    DateTime? WarrantyExpiresAtUtc,
    string? DeliveredToPersonName,
    decimal TotalLaborPrice,
    decimal TotalPartsPrice,
    decimal FinalPrice,
    decimal TotalPartsCost,
    decimal TotalLaborCost,
    IReadOnlyList<RepairChecklistItemResponse> Checklist,
    IReadOnlyList<RepairEstimateItemResponse> EstimateItems,
    IReadOnlyList<RepairPartUsageResponse> PartUsages,
    IReadOnlyList<RepairStatusHistoryResponse> StatusHistory,
    IReadOnlyList<RepairWarrantyClaimResponse> WarrantyClaims
);

public record RepairChecklistItemResponse(
    Guid Id,
    string Category,
    string ItemName,
    ChecklistItemStatus Status,
    string? Notes,
    bool IsOutputCheck,
    DateTime CheckedAtUtc
);

public record RepairEstimateItemResponse(
    Guid Id,
    RepairEstimateItemType ItemType,
    string Description,
    decimal Quantity,
    decimal UnitPrice,
    decimal UnitCost,
    Guid? ProductSkuId
);

public record RepairPartUsageResponse(
    Guid Id,
    Guid ProductSkuId,
    string PartDescription,
    decimal Quantity,
    decimal ActualUnitCost,
    Guid? InventoryUnitId,
    Guid? StockMovementId,
    DateTime ConsumedAtUtc
);

public record RepairStatusHistoryResponse(
    Guid Id,
    RepairOrderStatus Status,
    string Description,
    DateTime TimestampUtc
);

public record RepairWarrantyClaimResponse(
    Guid Id,
    string DefectDescription,
    DateTime ClaimDateUtc,
    WarrantyCoverageDecision Decision,
    string? DecisionRationale,
    DateTime? DecisionDateUtc,
    Guid? FollowUpRepairOrderId
);
