using CRM.Domain.Enums;

namespace CRM.Application.DTOs;

public record CreateLeadRequest(
    string Name,
    string? Phone,
    string? Email,
    string Source,
    string? MainInterest,
    Guid? AssignedSellerUserId,
    string? Notes);

public record UpdateLeadStatusRequest(
    LeadStatus Status,
    string? Notes);

public record ConvertLeadRequest(
    Guid PartyId);

public record LeadResponse(
    Guid Id,
    Guid TenantId,
    Guid BranchId,
    string Name,
    string? Phone,
    string? Email,
    string Source,
    string? MainInterest,
    Guid? AssignedSellerUserId,
    LeadStatus Status,
    string? Notes,
    DateTime? NextContactAtUtc,
    Guid? ConvertedPartyId,
    DateTime CreatedAtUtc);

public record CreatePipelineRequest(
    string Name,
    PipelineType PipelineType,
    List<CreatePipelineStageRequest> Stages);

public record CreatePipelineStageRequest(
    string Name,
    int OrderIndex,
    bool IsWonStage = false,
    bool IsLostStage = false);

public record PipelineResponse(
    Guid Id,
    string Name,
    PipelineType PipelineType,
    bool IsActive,
    List<PipelineStageResponse> Stages);

public record PipelineStageResponse(
    Guid Id,
    Guid PipelineId,
    string Name,
    int OrderIndex,
    bool IsWonStage,
    bool IsLostStage);

public record CreateOpportunityRequest(
    Guid? PartyId,
    Guid? LeadId,
    Guid PipelineId,
    Guid StageId,
    Guid? AssignedSellerUserId,
    string Title,
    decimal EstimatedValue,
    OpportunityPriority Priority,
    string? Description = null,
    string? Origin = null,
    DateTime? ExpectedClosingDate = null);

public record MoveOpportunityStageRequest(
    Guid NewStageId,
    bool IsWon,
    bool IsLost,
    string? LossReason = null);

public record AddOpportunityActivityRequest(
    ActivityType ActivityType,
    string Title,
    string? Description,
    DateTime ScheduledForUtc,
    Guid? AssignedUserId,
    OpportunityPriority Priority);

public record OpportunityResponse(
    Guid Id,
    Guid TenantId,
    Guid BranchId,
    Guid? PartyId,
    Guid? LeadId,
    Guid PipelineId,
    Guid StageId,
    Guid? AssignedSellerUserId,
    string Title,
    string? Description,
    string Origin,
    decimal EstimatedValue,
    DateTime? ExpectedClosingDate,
    OpportunityPriority Priority,
    OpportunityStatus Status,
    DateTime? ClosedAtUtc,
    string? LossReason,
    Guid? ConvertedSalesQuoteId,
    Guid? ConvertedSaleId,
    Guid? AssociatedRepairOrderId,
    Guid? AssociatedPurchaseIntentId,
    DateTime CreatedAtUtc,
    List<OpportunityActivityResponse> Activities);

public record OpportunityActivityResponse(
    Guid Id,
    Guid OpportunityId,
    ActivityType ActivityType,
    string Title,
    string? Description,
    DateTime ScheduledForUtc,
    Guid? AssignedUserId,
    OpportunityPriority Priority,
    ActivityStatus Status,
    DateTime? CompletedAtUtc,
    string? CompletionNotes,
    DateTime CreatedAtUtc);

public record CreatePurchaseIntentRequest(
    Guid PartyId,
    Guid? AssignedSellerUserId,
    string Category,
    string Brand,
    string ModelName,
    string? DesiredStorageCapacity,
    string? DesiredColor,
    bool ColorIsFlexible,
    DesiredCondition Condition,
    string? MinimumCosmeticGrade,
    int? MinimumBatteryHealthPercentage,
    decimal? MaxBudgetPrice,
    Guid? PreferredBranchId,
    DateTime ValidUntilUtc,
    OpportunityPriority Priority,
    ContactChannel PreferredContactChannel,
    string? Notes,
    Guid? TargetProductModelId = null,
    Guid? TargetProductSkuId = null);

public record PurchaseIntentResponse(
    Guid Id,
    Guid TenantId,
    Guid BranchId,
    Guid PartyId,
    Guid? AssignedSellerUserId,
    string Category,
    string Brand,
    string ModelName,
    string? DesiredStorageCapacity,
    string? DesiredColor,
    bool ColorIsFlexible,
    DesiredCondition Condition,
    string? MinimumCosmeticGrade,
    int? MinimumBatteryHealthPercentage,
    decimal? MaxBudgetPrice,
    Guid? PreferredBranchId,
    DateTime ValidUntilUtc,
    OpportunityPriority Priority,
    PurchaseIntentStatus Status,
    ContactChannel PreferredContactChannel,
    string? Notes,
    DateTime CreatedAtUtc,
    List<InventoryMatchResponse> Matches);

public record InventoryMatchResponse(
    Guid Id,
    Guid PurchaseIntentId,
    Guid ProductSkuId,
    Guid? InventoryUnitId,
    decimal VerifiedPrice,
    string MatchDetails,
    bool IsFullMatch,
    MatchStatus Status,
    DateTime EvaluatedAtUtc,
    DateTime? StatusUpdatedAtUtc,
    string? RejectionReason);

public record RunInventoryMatchingResult(
    int TotalActiveIntentsEvaluated,
    int MatchesFound,
    List<InventoryMatchResponse> NewMatches);

public record ReserveMatchedUnitRequest(
    Guid MatchId,
    string Notes);

public record CrmDashboardMetricsResponse(
    int ActiveLeadsCount,
    int OpenOpportunitiesCount,
    decimal TotalPipelineEstimatedValue,
    int ActivePurchaseIntentsCount,
    int AvailableMatchesCount,
    int PendingActivitiesCount);
