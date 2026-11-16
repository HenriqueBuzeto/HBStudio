using BuildingBlocks.Domain;
using CRM.Domain.Enums;

namespace CRM.Domain.Entities;

public class CrmLead : BaseEntity, ITenantScoped, IBranchScoped
{
    public Guid TenantId { get; set; }
    public Guid BranchId { get; set; }
    public string Name { get; private set; } = string.Empty;
    public string? Phone { get; private set; }
    public string? Email { get; private set; }
    public string Source { get; private set; } = string.Empty; // ex: "Balcão", "Instagram", "Indicação", "Site"
    public string? MainInterest { get; private set; }
    public Guid? AssignedSellerUserId { get; private set; }
    public LeadStatus Status { get; private set; }
    public string? Notes { get; private set; }
    public DateTime? NextContactAtUtc { get; private set; }
    public Guid? ConvertedPartyId { get; private set; }
    public DateTime CreatedAtUtc { get; private set; }
    public DateTime? ConvertedAtUtc { get; private set; }

    protected CrmLead() { }

    public CrmLead(
        Guid tenantId,
        Guid branchId,
        string name,
        string? phone,
        string? email,
        string source,
        string? mainInterest,
        Guid? assignedSellerUserId,
        string? notes)
    {
        TenantId = tenantId;
        BranchId = branchId;
        Name = string.IsNullOrWhiteSpace(name) ? throw new ArgumentException("Nome do lead é obrigatório.") : name.Trim();
        Phone = phone?.Trim();
        Email = email?.Trim();
        Source = string.IsNullOrWhiteSpace(source) ? "Balcão" : source.Trim();
        MainInterest = mainInterest?.Trim();
        AssignedSellerUserId = assignedSellerUserId;
        Notes = notes?.Trim();
        Status = LeadStatus.New;
        CreatedAtUtc = DateTime.UtcNow;
    }

    public void AssignSeller(Guid sellerUserId)
    {
        AssignedSellerUserId = sellerUserId;
    }

    public void UpdateStatus(LeadStatus status, string? notes = null)
    {
        Status = status;
        if (!string.IsNullOrWhiteSpace(notes))
        {
            Notes = string.IsNullOrWhiteSpace(Notes) ? notes : $"{Notes} | {notes}";
        }
    }

    public void SetNextContact(DateTime? nextContact)
    {
        NextContactAtUtc = nextContact;
    }

    public void ConvertToParty(Guid partyId)
    {
        if (partyId == Guid.Empty) throw new ArgumentException("PartyId inválido para conversão.");
        ConvertedPartyId = partyId;
        Status = LeadStatus.Converted;
        ConvertedAtUtc = DateTime.UtcNow;
    }
}

public class CrmPipeline : BaseEntity, ITenantScoped
{
    public Guid TenantId { get; set; }
    public string Name { get; private set; } = string.Empty;
    public PipelineType PipelineType { get; private set; }
    public bool IsActive { get; private set; }

    private readonly List<CrmPipelineStage> _stages = new();
    public IReadOnlyCollection<CrmPipelineStage> Stages => _stages.AsReadOnly();

    protected CrmPipeline() { }

    public CrmPipeline(Guid tenantId, string name, PipelineType pipelineType)
    {
        TenantId = tenantId;
        Name = string.IsNullOrWhiteSpace(name) ? throw new ArgumentException("Nome do funil é obrigatório.") : name.Trim();
        PipelineType = pipelineType;
        IsActive = true;
    }

    public CrmPipelineStage AddStage(string name, int orderIndex, bool isWonStage = false, bool isLostStage = false)
    {
        var stage = new CrmPipelineStage(TenantId, Id, name, orderIndex, isWonStage, isLostStage);
        _stages.Add(stage);
        return stage;
    }
}

public class CrmPipelineStage : BaseEntity, ITenantScoped
{
    public Guid TenantId { get; set; }
    public Guid PipelineId { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public int OrderIndex { get; private set; }
    public bool IsWonStage { get; private set; }
    public bool IsLostStage { get; private set; }

    protected CrmPipelineStage() { }

    public CrmPipelineStage(Guid tenantId, Guid pipelineId, string name, int orderIndex, bool isWonStage, bool isLostStage)
    {
        TenantId = tenantId;
        PipelineId = pipelineId;
        Name = name.Trim();
        OrderIndex = orderIndex;
        IsWonStage = isWonStage;
        IsLostStage = isLostStage;
    }
}

public class CrmOpportunity : BaseEntity, ITenantScoped, IBranchScoped
{
    public Guid TenantId { get; set; }
    public Guid BranchId { get; set; }
    public Guid? PartyId { get; private set; }
    public Guid? LeadId { get; private set; }
    public Guid PipelineId { get; private set; }
    public Guid StageId { get; private set; }
    public Guid? AssignedSellerUserId { get; private set; }
    public string Title { get; private set; } = string.Empty;
    public string? Description { get; private set; }
    public string Origin { get; private set; } = string.Empty;
    public decimal EstimatedValue { get; private set; }
    public DateTime? ExpectedClosingDate { get; private set; }
    public OpportunityPriority Priority { get; private set; }
    public OpportunityStatus Status { get; private set; }
    public DateTime? ClosedAtUtc { get; private set; }
    public string? LossReason { get; private set; }

    // Relações externas comprovadas (não duplicadas)
    public Guid? ConvertedSalesQuoteId { get; private set; }
    public Guid? ConvertedSaleId { get; private set; }
    public Guid? AssociatedRepairOrderId { get; private set; }
    public Guid? AssociatedPurchaseIntentId { get; private set; }

    public DateTime CreatedAtUtc { get; private set; }

    private readonly List<CrmOpportunityActivity> _activities = new();
    public IReadOnlyCollection<CrmOpportunityActivity> Activities => _activities.AsReadOnly();

    protected CrmOpportunity() { }

    public CrmOpportunity(
        Guid tenantId,
        Guid branchId,
        Guid? partyId,
        Guid? leadId,
        Guid pipelineId,
        Guid stageId,
        Guid? assignedSellerUserId,
        string title,
        decimal estimatedValue,
        OpportunityPriority priority,
        string? description = null,
        string? origin = null,
        DateTime? expectedClosingDate = null)
    {
        if (partyId == null && leadId == null)
            throw new InvalidOperationException("A oportunidade deve estar vinculada a um Lead ou a um Cliente (Party).");

        TenantId = tenantId;
        BranchId = branchId;
        PartyId = partyId;
        LeadId = leadId;
        PipelineId = pipelineId;
        StageId = stageId;
        AssignedSellerUserId = assignedSellerUserId;
        Title = string.IsNullOrWhiteSpace(title) ? throw new ArgumentException("Título da oportunidade é obrigatório.") : title.Trim();
        EstimatedValue = estimatedValue < 0 ? throw new ArgumentException("Valor estimado não pode ser negativo.") : estimatedValue;
        Priority = priority;
        Description = description?.Trim();
        Origin = string.IsNullOrWhiteSpace(origin) ? "Balcão" : origin.Trim();
        ExpectedClosingDate = expectedClosingDate;
        Status = OpportunityStatus.Open;
        CreatedAtUtc = DateTime.UtcNow;
    }

    public void MoveStage(Guid newStageId, bool isWon, bool isLost, string? lossReason = null)
    {
        if (Status != OpportunityStatus.Open && !isWon && !isLost)
            throw new InvalidOperationException("Não é possível alterar a etapa de uma oportunidade encerrada sem reabertura formal.");

        StageId = newStageId;

        if (isWon)
        {
            Status = OpportunityStatus.Won;
            ClosedAtUtc = DateTime.UtcNow;
            LossReason = null;
        }
        else if (isLost)
        {
            Status = OpportunityStatus.Lost;
            ClosedAtUtc = DateTime.UtcNow;
            LossReason = string.IsNullOrWhiteSpace(lossReason) ? "Motivo não informado" : lossReason.Trim();
        }
        else
        {
            Status = OpportunityStatus.Open;
            ClosedAtUtc = null;
            LossReason = null;
        }
    }

    public void LinkPurchaseIntent(Guid purchaseIntentId)
    {
        AssociatedPurchaseIntentId = purchaseIntentId;
    }

    public void LinkRepairOrder(Guid repairOrderId)
    {
        AssociatedRepairOrderId = repairOrderId;
    }

    public void MarkConvertedToQuote(Guid quoteId)
    {
        ConvertedSalesQuoteId = quoteId;
    }

    public void MarkConvertedToSale(Guid saleId)
    {
        ConvertedSaleId = saleId;
        Status = OpportunityStatus.Won;
        ClosedAtUtc = DateTime.UtcNow;
    }

    public CrmOpportunityActivity AddActivity(
        ActivityType type,
        string title,
        string? description,
        DateTime scheduledForUtc,
        Guid? assignedUserId,
        OpportunityPriority priority)
    {
        var activity = new CrmOpportunityActivity(TenantId, BranchId, Id, type, title, description, scheduledForUtc, assignedUserId, priority);
        _activities.Add(activity);
        return activity;
    }
}

public class CrmOpportunityActivity : BaseEntity, ITenantScoped, IBranchScoped
{
    public Guid TenantId { get; set; }
    public Guid BranchId { get; set; }
    public Guid OpportunityId { get; private set; }
    public ActivityType ActivityType { get; private set; }
    public string Title { get; private set; } = string.Empty;
    public string? Description { get; private set; }
    public DateTime ScheduledForUtc { get; private set; }
    public Guid? AssignedUserId { get; private set; }
    public OpportunityPriority Priority { get; private set; }
    public ActivityStatus Status { get; private set; }
    public DateTime? CompletedAtUtc { get; private set; }
    public string? CompletionNotes { get; private set; }
    public DateTime CreatedAtUtc { get; private set; }

    protected CrmOpportunityActivity() { }

    public CrmOpportunityActivity(
        Guid tenantId,
        Guid branchId,
        Guid opportunityId,
        ActivityType activityType,
        string title,
        string? description,
        DateTime scheduledForUtc,
        Guid? assignedUserId,
        OpportunityPriority priority)
    {
        TenantId = tenantId;
        BranchId = branchId;
        OpportunityId = opportunityId;
        ActivityType = activityType;
        Title = string.IsNullOrWhiteSpace(title) ? throw new ArgumentException("Título da atividade é obrigatório.") : title.Trim();
        Description = description?.Trim();
        ScheduledForUtc = scheduledForUtc;
        AssignedUserId = assignedUserId;
        Priority = priority;
        Status = ActivityStatus.Pending;
        CreatedAtUtc = DateTime.UtcNow;
    }

    public void Complete(string? notes)
    {
        Status = ActivityStatus.Completed;
        CompletedAtUtc = DateTime.UtcNow;
        CompletionNotes = notes?.Trim();
    }

    public void Reschedule(DateTime newDateUtc, string? reason)
    {
        ScheduledForUtc = newDateUtc;
        if (!string.IsNullOrWhiteSpace(reason))
        {
            Description = string.IsNullOrWhiteSpace(Description) ? $"Reagendado: {reason}" : $"{Description} | Reagendado: {reason}";
        }
    }

    public void Cancel(string? reason)
    {
        Status = ActivityStatus.Cancelled;
        CompletionNotes = reason?.Trim();
    }
}

public class CrmPurchaseIntent : BaseEntity, ITenantScoped, IBranchScoped
{
    public Guid TenantId { get; set; }
    public Guid BranchId { get; set; }
    public Guid PartyId { get; private set; }
    public Guid? AssignedSellerUserId { get; private set; }

    // Critérios Estruturados Tipados
    public Guid? TargetProductModelId { get; private set; }
    public Guid? TargetProductSkuId { get; private set; }
    public string Category { get; private set; } = string.Empty; // ex: "Smartphones", "Notebooks", "Consoles"
    public string Brand { get; private set; } = string.Empty;    // ex: "Apple", "Samsung", "Sony"
    public string ModelName { get; private set; } = string.Empty; // ex: "iPhone 14 Pro Max"
    public string? DesiredStorageCapacity { get; private set; }  // ex: "256GB"
    public string? DesiredColor { get; private set; }            // ex: "Preto Espacial", ou null se indiferente
    public bool ColorIsFlexible { get; private set; }
    public DesiredCondition Condition { get; private set; }       // Any, New, Used
    public string? MinimumCosmeticGrade { get; private set; }    // ex: "B" (aceita A ou B)
    public int? MinimumBatteryHealthPercentage { get; private set; } // ex: 85 (mínimo 85%)
    public decimal? MaxBudgetPrice { get; private set; }         // ex: 3500.00
    public Guid? PreferredBranchId { get; private set; }

    public DateTime ValidUntilUtc { get; private set; }
    public OpportunityPriority Priority { get; private set; }
    public PurchaseIntentStatus Status { get; private set; }
    public ContactChannel PreferredContactChannel { get; private set; }
    public string? Notes { get; private set; }
    public DateTime CreatedAtUtc { get; private set; }
    public DateTime? ClosedAtUtc { get; private set; }
    public string? CloseReason { get; private set; }

    private readonly List<CrmInventoryMatch> _matches = new();
    public IReadOnlyCollection<CrmInventoryMatch> Matches => _matches.AsReadOnly();

    protected CrmPurchaseIntent() { }

    public CrmPurchaseIntent(
        Guid tenantId,
        Guid branchId,
        Guid partyId,
        Guid? assignedSellerUserId,
        string category,
        string brand,
        string modelName,
        string? desiredStorageCapacity,
        string? desiredColor,
        bool colorIsFlexible,
        DesiredCondition condition,
        string? minimumCosmeticGrade,
        int? minimumBatteryHealthPercentage,
        decimal? maxBudgetPrice,
        Guid? preferredBranchId,
        DateTime validUntilUtc,
        OpportunityPriority priority,
        ContactChannel preferredContactChannel,
        string? notes,
        Guid? targetProductModelId = null,
        Guid? targetProductSkuId = null)
    {
        if (partyId == Guid.Empty) throw new ArgumentException("PartyId do cliente é obrigatório.");
        if (string.IsNullOrWhiteSpace(modelName)) throw new ArgumentException("Nome do modelo pretendido é obrigatório.");
        if (maxBudgetPrice is < 0) throw new ArgumentException("Preço máximo de orçamento não pode ser negativo.");
        if (minimumBatteryHealthPercentage is < 0 or > 100) throw new ArgumentException("Saúde da bateria deve estar entre 0% e 100%.");

        TenantId = tenantId;
        BranchId = branchId;
        PartyId = partyId;
        AssignedSellerUserId = assignedSellerUserId;
        Category = string.IsNullOrWhiteSpace(category) ? "Eletrônicos" : category.Trim();
        Brand = string.IsNullOrWhiteSpace(brand) ? "Geral" : brand.Trim();
        ModelName = modelName.Trim();
        DesiredStorageCapacity = desiredStorageCapacity?.Trim();
        DesiredColor = desiredColor?.Trim();
        ColorIsFlexible = colorIsFlexible;
        Condition = condition;
        MinimumCosmeticGrade = minimumCosmeticGrade?.Trim().ToUpperInvariant();
        MinimumBatteryHealthPercentage = minimumBatteryHealthPercentage;
        MaxBudgetPrice = maxBudgetPrice;
        PreferredBranchId = preferredBranchId;
        ValidUntilUtc = validUntilUtc <= DateTime.UtcNow ? DateTime.UtcNow.AddDays(30) : validUntilUtc;
        Priority = priority;
        PreferredContactChannel = preferredContactChannel;
        Notes = notes?.Trim();
        TargetProductModelId = targetProductModelId;
        TargetProductSkuId = targetProductSkuId;
        Status = PurchaseIntentStatus.Active;
        CreatedAtUtc = DateTime.UtcNow;
    }

    public void MarkMatchFound()
    {
        if (Status == PurchaseIntentStatus.Active)
        {
            Status = PurchaseIntentStatus.MatchFound;
        }
    }

    public void MarkContacted()
    {
        if (Status is PurchaseIntentStatus.MatchFound or PurchaseIntentStatus.UnderReview or PurchaseIntentStatus.CustomerContactPending)
        {
            Status = PurchaseIntentStatus.CustomerContacted;
        }
    }

    public void MarkNegotiating()
    {
        Status = PurchaseIntentStatus.Negotiating;
    }

    public void ConvertToSale()
    {
        Status = PurchaseIntentStatus.Converted;
        ClosedAtUtc = DateTime.UtcNow;
    }

    public void Cancel(string reason)
    {
        Status = PurchaseIntentStatus.Cancelled;
        ClosedAtUtc = DateTime.UtcNow;
        CloseReason = reason.Trim();
    }

    public void Expire()
    {
        Status = PurchaseIntentStatus.Expired;
        ClosedAtUtc = DateTime.UtcNow;
        CloseReason = "Prazo de validade expirado.";
    }

    public CrmInventoryMatch AddMatch(
        Guid skuId,
        Guid? inventoryUnitId,
        decimal unitPrice,
        string details,
        bool isFullMatch)
    {
        var match = new CrmInventoryMatch(
            TenantId,
            BranchId,
            Id,
            skuId,
            inventoryUnitId,
            unitPrice,
            details,
            isFullMatch);

        _matches.Add(match);
        MarkMatchFound();
        return match;
    }
}

public class CrmInventoryMatch : BaseEntity, ITenantScoped, IBranchScoped
{
    public Guid TenantId { get; set; }
    public Guid BranchId { get; set; }
    public Guid PurchaseIntentId { get; private set; }
    public Guid ProductSkuId { get; private set; }
    public Guid? InventoryUnitId { get; private set; }
    public decimal VerifiedPrice { get; private set; }
    public string MatchDetails { get; private set; } = string.Empty;
    public bool IsFullMatch { get; private set; }
    public MatchStatus Status { get; private set; }
    public DateTime EvaluatedAtUtc { get; private set; }
    public DateTime? StatusUpdatedAtUtc { get; private set; }
    public string? RejectionReason { get; private set; }

    protected CrmInventoryMatch() { }

    public CrmInventoryMatch(
        Guid tenantId,
        Guid branchId,
        Guid purchaseIntentId,
        Guid productSkuId,
        Guid? inventoryUnitId,
        decimal verifiedPrice,
        string matchDetails,
        bool isFullMatch)
    {
        TenantId = tenantId;
        BranchId = branchId;
        PurchaseIntentId = purchaseIntentId;
        ProductSkuId = productSkuId;
        InventoryUnitId = inventoryUnitId;
        VerifiedPrice = verifiedPrice;
        MatchDetails = matchDetails;
        IsFullMatch = isFullMatch;
        Status = MatchStatus.CandidateIdentified;
        EvaluatedAtUtc = DateTime.UtcNow;
    }

    public void MarkOffered()
    {
        Status = MatchStatus.OfferedToCustomer;
        StatusUpdatedAtUtc = DateTime.UtcNow;
    }

    public void MarkReserved()
    {
        Status = MatchStatus.Reserved;
        StatusUpdatedAtUtc = DateTime.UtcNow;
    }

    public void MarkConverted()
    {
        Status = MatchStatus.Converted;
        StatusUpdatedAtUtc = DateTime.UtcNow;
    }

    public void Reject(string reason)
    {
        Status = MatchStatus.Rejected;
        StatusUpdatedAtUtc = DateTime.UtcNow;
        RejectionReason = reason.Trim();
    }

    public void InvalidateByStockMove(string reason)
    {
        Status = MatchStatus.InvalidatedByStockMove;
        StatusUpdatedAtUtc = DateTime.UtcNow;
        RejectionReason = reason.Trim();
    }
}
