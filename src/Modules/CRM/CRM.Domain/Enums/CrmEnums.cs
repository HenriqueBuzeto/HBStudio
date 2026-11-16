namespace CRM.Domain.Enums;

public enum LeadStatus
{
    New = 1,
    Contacted = 2,
    Qualified = 3,
    Unqualified = 4,
    Converted = 5,
    Archived = 6
}

public enum PipelineType
{
    ElectronicsSales = 1,
    RepairServices = 2,
    DigitalProjects = 3,
    Custom3DManufacturing = 4,
    General = 5
}

public enum OpportunityStatus
{
    Open = 1,
    Won = 2,
    Lost = 3,
    Abandoned = 4
}

public enum OpportunityPriority
{
    Low = 1,
    Medium = 2,
    High = 3,
    Urgent = 4
}

public enum PurchaseIntentStatus
{
    Active = 1,
    MatchFound = 2,
    UnderReview = 3,
    CustomerContactPending = 4,
    CustomerContacted = 5,
    Negotiating = 6,
    Converted = 7,
    Expired = 8,
    Cancelled = 9,
    Lost = 10
}

public enum DesiredCondition
{
    Any = 0,
    New = 1,
    Used = 2
}

public enum ActivityType
{
    PhoneCall = 1,
    QuoteFollowUp = 2,
    ProductAvailabilityCheck = 3,
    ConfirmInterest = 4,
    ScheduleVisit = 5,
    Negotiation = 6,
    PostSaleFollowUp = 7,
    General = 8
}

public enum ActivityStatus
{
    Pending = 1,
    InProgress = 2,
    Completed = 3,
    Cancelled = 4
}

public enum MatchStatus
{
    CandidateIdentified = 1,
    UnderReview = 2,
    OfferedToCustomer = 3,
    Reserved = 4,
    Converted = 5,
    Rejected = 6,
    InvalidatedByStockMove = 7
}

public enum ContactChannel
{
    Phone = 1,
    WhatsApp = 2,
    Email = 3,
    InPerson = 4
}
