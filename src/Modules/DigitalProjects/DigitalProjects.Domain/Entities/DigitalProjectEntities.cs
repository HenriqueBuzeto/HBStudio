using BuildingBlocks.Domain;

namespace DigitalProjects.Domain.Entities;

public enum DigitalProjectType
{
    CustomSoftware = 1,      // Sistemas sob medida
    InstitutionalWebsite = 2,// Sites institucionais
    LandingPage = 3,         // Landing Pages de alta conversão
    MobileApp = 4,           // Aplicativos móveis
    SystemIntegration = 5,   // Integrações de APIs e ERPs
    SoftwareMaintenance = 6, // Manutenção e sustentação
    HostingAndSupport = 7,   // Hospedagem gerenciada e suporte
    TechConsulting = 8,      // Consultoria de arquitetura / tech
    DigitalDesign = 9,       // UI/UX e identidade digital
    Digital3DModeling = 10   // Modelagem 3D digital sob encomenda
}

public enum PricingModel
{
    FixedPrice = 1,          // Preço Fechado
    TimeAndMaterials = 2,    // Horas Trabalhadas
    RetainerHourPackage = 3, // Pacote de Horas
    RecurringContract = 4,   // Contrato Recorrente / Mensalidade
    Hybrid = 5               // Híbrido (Fixo + Horas adicionais)
}

public enum DigitalProjectStatus
{
    Draft = 1,
    Proposed = 2,
    WaitingContract = 3,
    Approved = 4,
    Planning = 5,
    InProgress = 6,
    OnHold = 7,
    WaitingCustomer = 8,
    UnderReview = 9,
    Completed = 10,
    Closed = 11,
    Cancelled = 12
}

public enum MilestoneStatus
{
    Planned = 1,
    InProgress = 2,
    Submitted = 3,
    UnderReview = 4,
    Accepted = 5,
    Rejected = 6,
    Cancelled = 7
}

public enum ProjectTaskStatus
{
    Todo = 1,
    InProgress = 2,
    Blocked = 3,
    InReview = 4,
    Done = 5,
    Cancelled = 6
}

public enum TimeEntryActivityType
{
    Development = 1,
    Design = 2,
    ArchitectureAndAnalysis = 3,
    Meeting = 4,
    QualityAndTesting = 5,
    DeploymentAndDevOps = 6,
    Support = 7,
    BugFix = 8,
    Rework = 9,
    ProjectManagement = 10
}

public enum DeliverableType
{
    SourceCodeRepo = 1,
    DocumentOrManual = 2,
    DesignSystemOrFigma = 3,
    Digital3DModel = 4,
    BuildPackage = 5,
    ProductionDeployment = 6,
    InteractivePrototype = 7
}

public enum DeliverableStatus
{
    Draft = 1,
    Submitted = 2,
    UnderReview = 3,
    Accepted = 4,
    Rejected = 5
}

public enum ChangeRequestStatus
{
    Draft = 1,
    Submitted = 2,
    Approved = 3,
    Rejected = 4,
    Cancelled = 5
}

/// <summary>
/// Agregado Raiz: Projeto Digital Enterprise da HB Studio.
/// Controla ciclo de vida, escopo, marcos, horas e custos históricos sem duplicar CRM, Sales ou Financial.
/// </summary>
public class DigitalProject : BranchEntity
{
    public string ProjectCode { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;
    public string Description { get; private set; } = string.Empty;
    public DigitalProjectType Type { get; private set; }
    public PricingModel PricingModel { get; private set; }
    public DigitalProjectStatus Status { get; private set; }

    public Guid CustomerPartyId { get; private set; }
    public Guid? CrmOpportunityId { get; private set; }
    public Guid? SalesOrderId { get; private set; }

    // Responsável e Equipe
    public Guid LeadTechnicianUserId { get; private set; }
    public string LeadTechnicianName { get; private set; } = string.Empty;

    // Prazos e Datas
    public DateTime? PlannedStartDateUtc { get; private set; }
    public DateTime? PlannedDeliveryDateUtc { get; private set; }
    public DateTime? ActualStartDateUtc { get; private set; }
    public DateTime? ActualCompletionDateUtc { get; private set; }

    // Finanças Contratadas vs Realizadas (CPC 47 e Gestão de Custos)
    public decimal ContractedPrice { get; private set; }      // Receita total contratada
    public decimal EstimatedHours { get; private set; }
    public decimal TotalActualLaborCost { get; private set; } // Horas trabalhadas * Custo interno
    public decimal TotalThirdPartyCost { get; private set; }  // Freelancers, licenças, infra
    public decimal TotalExpensesCost { get; private set; }    // Despesas diretamente atribuíveis
    public decimal TotalActualCost => TotalActualLaborCost + TotalThirdPartyCost + TotalExpensesCost;

    public decimal InvoicedAmount { get; private set; }       // Total já faturado via Sales/Financial
    public decimal PaidAmount { get; private set; }           // Total liquidado no Financial

    // Propriedade Intelectual (Lei 9.609/1998) e LGPD (Lei 13.709/2018)
    public string IntellectualPropertyPolicy { get; private set; } = "Software sob encomenda (direitos patrimoniais cedidos ao contratante após quitação integral)";
    public string LgpdProcessingRole { get; private set; } = "Operadora de dados sob instruções legítimas do contratante";

    // Coleções Filhas do Agregado
    private readonly List<DigitalProjectMilestone> _milestones = new();
    public IReadOnlyCollection<DigitalProjectMilestone> Milestones => _milestones.AsReadOnly();

    private readonly List<DigitalProjectTask> _tasks = new();
    public IReadOnlyCollection<DigitalProjectTask> Tasks => _tasks.AsReadOnly();

    private readonly List<DigitalProjectTimeEntry> _timeEntries = new();
    public IReadOnlyCollection<DigitalProjectTimeEntry> TimeEntries => _timeEntries.AsReadOnly();

    private readonly List<DigitalProjectDeliverable> _deliverables = new();
    public IReadOnlyCollection<DigitalProjectDeliverable> Deliverables => _deliverables.AsReadOnly();

    private readonly List<DigitalProjectChangeRequest> _changeRequests = new();
    public IReadOnlyCollection<DigitalProjectChangeRequest> ChangeRequests => _changeRequests.AsReadOnly();

    private readonly List<DigitalProjectContractVersion> _contractVersions = new();
    public IReadOnlyCollection<DigitalProjectContractVersion> ContractVersions => _contractVersions.AsReadOnly();

    private DigitalProject() { }

    public DigitalProject(
        Guid tenantId,
        Guid branchId,
        string projectCode,
        string name,
        string description,
        DigitalProjectType type,
        PricingModel pricingModel,
        Guid customerPartyId,
        Guid? crmOpportunityId,
        Guid? salesOrderId,
        Guid leadTechnicianUserId,
        string leadTechnicianName,
        decimal contractedPrice,
        decimal estimatedHours,
        DateTime? plannedStartDateUtc,
        DateTime? plannedDeliveryDateUtc) : base(tenantId, branchId)
    {
        ProjectCode = projectCode.Trim().ToUpperInvariant();
        Name = name.Trim();
        Description = description.Trim();
        Type = type;
        PricingModel = pricingModel;
        Status = DigitalProjectStatus.Draft;
        CustomerPartyId = customerPartyId;
        CrmOpportunityId = crmOpportunityId;
        SalesOrderId = salesOrderId;
        LeadTechnicianUserId = leadTechnicianUserId;
        LeadTechnicianName = leadTechnicianName.Trim();
        ContractedPrice = Math.Max(0m, contractedPrice);
        EstimatedHours = Math.Max(0m, estimatedHours);
        PlannedStartDateUtc = plannedStartDateUtc;
        PlannedDeliveryDateUtc = plannedDeliveryDateUtc;
    }

    public void ApproveProject()
    {
        if (Status != DigitalProjectStatus.Draft && Status != DigitalProjectStatus.Proposed && Status != DigitalProjectStatus.WaitingContract)
            throw new InvalidOperationException($"Não é possível aprovar projeto no status {Status}.");

        Status = DigitalProjectStatus.Approved;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void StartExecution()
    {
        if (Status != DigitalProjectStatus.Approved && Status != DigitalProjectStatus.Planning)
            throw new InvalidOperationException($"Não é possível iniciar execução no status {Status}.");

        Status = DigitalProjectStatus.InProgress;
        ActualStartDateUtc ??= DateTime.UtcNow;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void CompleteProject()
    {
        if (Status != DigitalProjectStatus.InProgress && Status != DigitalProjectStatus.UnderReview)
            throw new InvalidOperationException($"Não é possível concluir projeto no status {Status}.");

        Status = DigitalProjectStatus.Completed;
        ActualCompletionDateUtc = DateTime.UtcNow;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void CloseProject()
    {
        if (Status != DigitalProjectStatus.Completed)
            throw new InvalidOperationException("Apenas projetos completados com aceites finais podem ser encerrados.");

        Status = DigitalProjectStatus.Closed;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void RecordInvoicedMilestone(decimal amount)
    {
        if (amount < 0) throw new ArgumentException("Valor faturado não pode ser negativo.");
        InvoicedAmount += amount;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void RecordPaymentReceived(decimal amount)
    {
        if (amount < 0) throw new ArgumentException("Valor liquidado não pode ser negativo.");
        PaidAmount += amount;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public DigitalProjectMilestone AddMilestone(
        string title,
        string description,
        DateTime? targetDateUtc,
        decimal milestonePrice,
        bool isBillable)
    {
        var order = _milestones.Count + 1;
        var milestone = new DigitalProjectMilestone(TenantId, Id, order, title, description, targetDateUtc, milestonePrice, isBillable);
        _milestones.Add(milestone);
        UpdatedAtUtc = DateTime.UtcNow;
        return milestone;
    }

    public DigitalProjectTask AddTask(
        Guid? milestoneId,
        string title,
        string description,
        Guid? assignedUserId,
        string? assignedUserName,
        decimal estimatedHours,
        DateTime? dueDateUtc)
    {
        var task = new DigitalProjectTask(TenantId, Id, milestoneId, title, description, assignedUserId, assignedUserName, estimatedHours, dueDateUtc);
        _tasks.Add(task);
        UpdatedAtUtc = DateTime.UtcNow;
        return task;
    }

    public DigitalProjectTimeEntry AddTimeEntry(
        Guid taskId,
        Guid userId,
        string userName,
        DateTime workDateUtc,
        decimal durationHours,
        TimeEntryActivityType activityType,
        string description,
        bool isBillable,
        decimal historicalHourlyCost)
    {
        if (durationHours <= 0)
            throw new ArgumentException("Duração do apontamento deve ser estritamente positiva.");

        var entry = new DigitalProjectTimeEntry(
            TenantId,
            Id,
            taskId,
            userId,
            userName,
            workDateUtc,
            durationHours,
            activityType,
            description,
            isBillable,
            historicalHourlyCost
        );

        _timeEntries.Add(entry);

        // Apuração matemática imediata do custo de mão de obra
        TotalActualLaborCost += Math.Round(durationHours * historicalHourlyCost, 2);
        UpdatedAtUtc = DateTime.UtcNow;
        return entry;
    }

    public DigitalProjectDeliverable AddDeliverable(
        Guid? milestoneId,
        string title,
        DeliverableType type,
        string version,
        string description,
        string storageUriOrUrl,
        string? sha256Hash)
    {
        var deliverable = new DigitalProjectDeliverable(TenantId, Id, milestoneId, title, type, version, description, storageUriOrUrl, sha256Hash);
        _deliverables.Add(deliverable);
        UpdatedAtUtc = DateTime.UtcNow;
        return deliverable;
    }

    public DigitalProjectChangeRequest AddChangeRequest(
        string title,
        string requesterName,
        string reason,
        string proposedScopeChanges,
        decimal impactHours,
        decimal impactCost,
        decimal impactPrice,
        int impactDays)
    {
        var crNumber = $"CR-{ProjectCode}-{_changeRequests.Count + 1:D2}";
        var cr = new DigitalProjectChangeRequest(TenantId, Id, crNumber, title, requesterName, reason, proposedScopeChanges, impactHours, impactCost, impactPrice, impactDays);
        _changeRequests.Add(cr);
        UpdatedAtUtc = DateTime.UtcNow;
        return cr;
    }

    public DigitalProjectContractVersion AddContractVersion(
        int versionNumber,
        string contractTitle,
        string termsSummary,
        string documentUri,
        string sha256Hash,
        string registeredByUserName)
    {
        var version = new DigitalProjectContractVersion(TenantId, Id, versionNumber, contractTitle, termsSummary, documentUri, sha256Hash, registeredByUserName);
        _contractVersions.Add(version);
        UpdatedAtUtc = DateTime.UtcNow;
        return version;
    }
}

/// <summary>
/// Marco contratual do projeto digital.
/// Pode ou não ser faturável conforme o contrato.
/// </summary>
public class DigitalProjectMilestone : TenantEntity
{
    public Guid DigitalProjectId { get; private set; }
    public int SequenceOrder { get; private set; }
    public string Title { get; private set; } = string.Empty;
    public string Description { get; private set; } = string.Empty;
    public DateTime? TargetDateUtc { get; private set; }
    public decimal MilestonePrice { get; private set; }
    public bool IsBillable { get; private set; }
    public MilestoneStatus Status { get; private set; }
    public DateTime? ApprovedAtUtc { get; private set; }
    public string? ApprovedByNotes { get; private set; }
    public bool HasBeenBilled { get; private set; }

    private DigitalProjectMilestone() { }

    public DigitalProjectMilestone(
        Guid tenantId,
        Guid digitalProjectId,
        int sequenceOrder,
        string title,
        string description,
        DateTime? targetDateUtc,
        decimal milestonePrice,
        bool isBillable) : base(tenantId)
    {
        DigitalProjectId = digitalProjectId;
        SequenceOrder = sequenceOrder;
        Title = title.Trim();
        Description = description.Trim();
        TargetDateUtc = targetDateUtc;
        MilestonePrice = Math.Max(0m, milestonePrice);
        IsBillable = isBillable;
        Status = MilestoneStatus.Planned;
    }

    public void SubmitForReview()
    {
        Status = MilestoneStatus.Submitted;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void AcceptMilestone(string approvalNotes)
    {
        Status = MilestoneStatus.Accepted;
        ApprovedAtUtc = DateTime.UtcNow;
        ApprovedByNotes = approvalNotes.Trim();
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void MarkAsBilled()
    {
        if (HasBeenBilled) throw new InvalidOperationException("Este marco já foi faturado anteriormente (Prevenção de Faturamento Duplicado).");
        HasBeenBilled = true;
        UpdatedAtUtc = DateTime.UtcNow;
    }
}

/// <summary>
/// Tarefa operacional da equipe técnica.
/// </summary>
public class DigitalProjectTask : TenantEntity
{
    public Guid DigitalProjectId { get; private set; }
    public Guid? MilestoneId { get; private set; }
    public string Title { get; private set; } = string.Empty;
    public string Description { get; private set; } = string.Empty;
    public Guid? AssignedUserId { get; private set; }
    public string? AssignedUserName { get; private set; }
    public decimal EstimatedHours { get; private set; }
    public DateTime? DueDateUtc { get; private set; }
    public ProjectTaskStatus Status { get; private set; }
    public DateTime? CompletedAtUtc { get; private set; }

    private DigitalProjectTask() { }

    public DigitalProjectTask(
        Guid tenantId,
        Guid digitalProjectId,
        Guid? milestoneId,
        string title,
        string description,
        Guid? assignedUserId,
        string? assignedUserName,
        decimal estimatedHours,
        DateTime? dueDateUtc) : base(tenantId)
    {
        DigitalProjectId = digitalProjectId;
        MilestoneId = milestoneId;
        Title = title.Trim();
        Description = description.Trim();
        AssignedUserId = assignedUserId;
        AssignedUserName = assignedUserName?.Trim();
        EstimatedHours = Math.Max(0m, estimatedHours);
        DueDateUtc = dueDateUtc;
        Status = ProjectTaskStatus.Todo;
    }

    public void UpdateStatus(ProjectTaskStatus newStatus)
    {
        Status = newStatus;
        if (newStatus == ProjectTaskStatus.Done)
        {
            CompletedAtUtc = DateTime.UtcNow;
        }
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void AssignUser(Guid userId, string userName)
    {
        AssignedUserId = userId;
        AssignedUserName = userName.Trim();
        UpdatedAtUtc = DateTime.UtcNow;
    }
}

/// <summary>
/// Apontamento de Horas Efetivamente Trabalhadas (Timesheet).
/// Salva o custo horário histórico para integridade contábil imutável.
/// </summary>
public class DigitalProjectTimeEntry : TenantEntity
{
    public Guid DigitalProjectId { get; private set; }
    public Guid DigitalProjectTaskId { get; private set; }
    public Guid UserId { get; private set; }
    public string UserName { get; private set; } = string.Empty;
    public DateTime WorkDateUtc { get; private set; }
    public decimal DurationHours { get; private set; }
    public TimeEntryActivityType ActivityType { get; private set; }
    public string Description { get; private set; } = string.Empty;
    public bool IsBillable { get; private set; }
    public decimal HistoricalHourlyCost { get; private set; }
    public decimal TotalCost => Math.Round(DurationHours * HistoricalHourlyCost, 2);
    public bool IsApproved { get; private set; }
    public Guid? ApprovedByUserId { get; private set; }

    private DigitalProjectTimeEntry() { }

    public DigitalProjectTimeEntry(
        Guid tenantId,
        Guid digitalProjectId,
        Guid digitalProjectTaskId,
        Guid userId,
        string userName,
        DateTime workDateUtc,
        decimal durationHours,
        TimeEntryActivityType activityType,
        string description,
        bool isBillable,
        decimal historicalHourlyCost) : base(tenantId)
    {
        DigitalProjectId = digitalProjectId;
        DigitalProjectTaskId = digitalProjectTaskId;
        UserId = userId;
        UserName = userName.Trim();
        WorkDateUtc = workDateUtc;
        DurationHours = durationHours;
        ActivityType = activityType;
        Description = description.Trim();
        IsBillable = isBillable;
        HistoricalHourlyCost = Math.Max(0m, historicalHourlyCost);
        IsApproved = false;
    }

    public void Approve(Guid approvedByUserId)
    {
        IsApproved = true;
        ApprovedByUserId = approvedByUserId;
        UpdatedAtUtc = DateTime.UtcNow;
    }
}

/// <summary>
/// Entregável digital formal (código, manual, build, layout, modelo 3D).
/// </summary>
public class DigitalProjectDeliverable : TenantEntity
{
    public Guid DigitalProjectId { get; private set; }
    public Guid? MilestoneId { get; private set; }
    public string Title { get; private set; } = string.Empty;
    public DeliverableType Type { get; private set; }
    public string ArtifactVersion { get; private set; } = string.Empty;
    public string Description { get; private set; } = string.Empty;
    public string StorageUriOrUrl { get; private set; } = string.Empty;
    public string? Sha256Hash { get; private set; }
    public DeliverableStatus Status { get; private set; }
    public DateTime? SubmittedAtUtc { get; private set; }
    public DateTime? AcceptedAtUtc { get; private set; }
    public string? AcceptanceNotes { get; private set; }

    private DigitalProjectDeliverable() { }

    public DigitalProjectDeliverable(
        Guid tenantId,
        Guid digitalProjectId,
        Guid? milestoneId,
        string title,
        DeliverableType type,
        string artifactVersion,
        string description,
        string storageUriOrUrl,
        string? sha256Hash) : base(tenantId)
    {
        DigitalProjectId = digitalProjectId;
        MilestoneId = milestoneId;
        Title = title.Trim();
        Type = type;
        ArtifactVersion = artifactVersion.Trim();
        Description = description.Trim();
        StorageUriOrUrl = storageUriOrUrl.Trim();
        Sha256Hash = sha256Hash?.Trim();
        Status = DeliverableStatus.Draft;
    }

    public void Submit()
    {
        Status = DeliverableStatus.Submitted;
        SubmittedAtUtc = DateTime.UtcNow;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void Accept(string notes)
    {
        Status = DeliverableStatus.Accepted;
        AcceptedAtUtc = DateTime.UtcNow;
        AcceptanceNotes = notes.Trim();
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void Reject(string reason)
    {
        Status = DeliverableStatus.Rejected;
        AcceptanceNotes = reason.Trim();
        UpdatedAtUtc = DateTime.UtcNow;
    }
}

/// <summary>
/// Solicitação de Alteração de Escopo (Change Request / Aditivo Técnico).
/// Impede que o escopo histórico seja alterado silenciosamente.
/// </summary>
public class DigitalProjectChangeRequest : TenantEntity
{
    public Guid DigitalProjectId { get; private set; }
    public string CrNumber { get; private set; } = string.Empty;
    public string Title { get; private set; } = string.Empty;
    public string RequesterName { get; private set; } = string.Empty;
    public string Reason { get; private set; } = string.Empty;
    public string ProposedScopeChanges { get; private set; } = string.Empty;
    public decimal ImpactHours { get; private set; }
    public decimal ImpactCost { get; private set; }
    public decimal ImpactPrice { get; private set; }
    public int ImpactDays { get; private set; }
    public ChangeRequestStatus Status { get; private set; }
    public DateTime? ApprovedAtUtc { get; private set; }
    public string? DecisionNotes { get; private set; }

    private DigitalProjectChangeRequest() { }

    public DigitalProjectChangeRequest(
        Guid tenantId,
        Guid digitalProjectId,
        string crNumber,
        string title,
        string requesterName,
        string reason,
        string proposedScopeChanges,
        decimal impactHours,
        decimal impactCost,
        decimal impactPrice,
        int impactDays) : base(tenantId)
    {
        DigitalProjectId = digitalProjectId;
        CrNumber = crNumber.Trim().ToUpperInvariant();
        Title = title.Trim();
        RequesterName = requesterName.Trim();
        Reason = reason.Trim();
        ProposedScopeChanges = proposedScopeChanges.Trim();
        ImpactHours = impactHours;
        ImpactCost = impactCost;
        ImpactPrice = impactPrice;
        ImpactDays = impactDays;
        Status = ChangeRequestStatus.Draft;
    }

    public void Submit()
    {
        Status = ChangeRequestStatus.Submitted;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void Approve(string notes)
    {
        Status = ChangeRequestStatus.Approved;
        ApprovedAtUtc = DateTime.UtcNow;
        DecisionNotes = notes.Trim();
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void Reject(string reason)
    {
        Status = ChangeRequestStatus.Rejected;
        DecisionNotes = reason.Trim();
        UpdatedAtUtc = DateTime.UtcNow;
    }
}

/// <summary>
/// Versão Histórica e Imutável do Contrato do Projeto.
/// Preserva integridade jurídica e evidência formal do documento.
/// </summary>
public class DigitalProjectContractVersion : TenantEntity
{
    public Guid DigitalProjectId { get; private set; }
    public int VersionNumber { get; private set; }
    public string ContractTitle { get; private set; } = string.Empty;
    public string TermsSummary { get; private set; } = string.Empty;
    public string DocumentUri { get; private set; } = string.Empty;
    public string Sha256Hash { get; private set; } = string.Empty;
    public string RegisteredByUserName { get; private set; } = string.Empty;

    private DigitalProjectContractVersion() { }

    public DigitalProjectContractVersion(
        Guid tenantId,
        Guid digitalProjectId,
        int versionNumber,
        string contractTitle,
        string termsSummary,
        string documentUri,
        string sha256Hash,
        string registeredByUserName) : base(tenantId)
    {
        DigitalProjectId = digitalProjectId;
        VersionNumber = versionNumber;
        ContractTitle = contractTitle.Trim();
        TermsSummary = termsSummary.Trim();
        DocumentUri = documentUri.Trim();
        Sha256Hash = sha256Hash.Trim();
        RegisteredByUserName = registeredByUserName.Trim();
    }
}
