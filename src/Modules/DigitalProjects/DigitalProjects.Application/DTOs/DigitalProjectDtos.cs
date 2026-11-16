namespace DigitalProjects.Application.DTOs;

public record CreateDigitalProjectRequest(
    string Name,
    string Description,
    int Type,
    int PricingModel,
    Guid CustomerPartyId,
    Guid? CrmOpportunityId,
    Guid? SalesOrderId,
    Guid LeadTechnicianUserId,
    string LeadTechnicianName,
    decimal ContractedPrice,
    decimal EstimatedHours,
    DateTime? PlannedStartDateUtc,
    DateTime? PlannedDeliveryDateUtc
);

public record CreateMilestoneRequest(
    string Title,
    string Description,
    DateTime? TargetDateUtc,
    decimal MilestonePrice,
    bool IsBillable
);

public record CreateProjectTaskRequest(
    Guid? MilestoneId,
    string Title,
    string Description,
    Guid? AssignedUserId,
    string? AssignedUserName,
    decimal EstimatedHours,
    DateTime? DueDateUtc
);

public record CreateTimeEntryRequest(
    Guid TaskId,
    Guid UserId,
    string UserName,
    DateTime WorkDateUtc,
    decimal DurationHours,
    int ActivityType,
    string Description,
    bool IsBillable,
    decimal HistoricalHourlyCost
);

public record CreateDeliverableRequest(
    Guid? MilestoneId,
    string Title,
    int Type,
    string Version,
    string Description,
    string StorageUriOrUrl,
    string? Sha256Hash
);

public record CreateChangeRequestRequest(
    string Title,
    string RequesterName,
    string Reason,
    string ProposedScopeChanges,
    decimal ImpactHours,
    decimal ImpactCost,
    decimal ImpactPrice,
    int ImpactDays
);

public record DigitalProjectDto(
    Guid Id,
    string ProjectCode,
    string Name,
    string Description,
    string Type,
    string PricingModel,
    string Status,
    Guid CustomerPartyId,
    string LeadTechnicianName,
    decimal ContractedPrice,
    decimal EstimatedHours,
    decimal TotalActualLaborCost,
    decimal TotalActualCost,
    decimal InvoicedAmount,
    decimal PaidAmount,
    DateTime CreatedAtUtc
);

public record DigitalProjectDetailsDto(
    Guid Id,
    string ProjectCode,
    string Name,
    string Description,
    string Type,
    string PricingModel,
    string Status,
    Guid CustomerPartyId,
    string LeadTechnicianName,
    decimal ContractedPrice,
    decimal EstimatedHours,
    decimal TotalActualLaborCost,
    decimal TotalActualCost,
    decimal InvoicedAmount,
    decimal PaidAmount,
    string IntellectualPropertyPolicy,
    string LgpdProcessingRole,
    IReadOnlyList<MilestoneDto> Milestones,
    IReadOnlyList<TaskDto> Tasks,
    IReadOnlyList<TimeEntryDto> TimeEntries,
    IReadOnlyList<DeliverableDto> Deliverables,
    IReadOnlyList<ChangeRequestDto> ChangeRequests
);

public record MilestoneDto(
    Guid Id,
    int SequenceOrder,
    string Title,
    string Description,
    DateTime? TargetDateUtc,
    decimal MilestonePrice,
    bool IsBillable,
    string Status,
    DateTime? ApprovedAtUtc,
    bool HasBeenBilled
);

public record TaskDto(
    Guid Id,
    Guid? MilestoneId,
    string Title,
    string Description,
    string? AssignedUserName,
    decimal EstimatedHours,
    DateTime? DueDateUtc,
    string Status
);

public record TimeEntryDto(
    Guid Id,
    Guid TaskId,
    string UserName,
    DateTime WorkDateUtc,
    decimal DurationHours,
    string ActivityType,
    string Description,
    bool IsBillable,
    decimal HistoricalHourlyCost,
    decimal TotalCost,
    bool IsApproved
);

public record DeliverableDto(
    Guid Id,
    string Title,
    string Type,
    string Version,
    string StorageUriOrUrl,
    string? Sha256Hash,
    string Status
);

public record ChangeRequestDto(
    Guid Id,
    string CrNumber,
    string Title,
    string RequesterName,
    decimal ImpactHours,
    decimal ImpactCost,
    decimal ImpactPrice,
    string Status
);
