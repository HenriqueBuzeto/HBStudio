using BuildingBlocks.Domain;

namespace Manufacturing3D.Domain.Entities;

#region Enums

public enum PrinterTechnology
{
    FDM_FFF = 1,
    SLA_Resin = 2,
    SLS_Nylon = 3
}

public enum PrinterOperationalStatus
{
    Available = 1,
    Reserved = 2,
    Preparing = 3,
    Printing = 4,
    Paused = 5,
    Finishing = 6,
    Maintenance = 7,
    OutOfService = 8
}

public enum ManufacturingOrderType
{
    ProductionForStock = 1,      // Fabricação para estoque
    CustomOrder = 2,             // Sob encomenda (Sales)
    InternalPrototype = 3        // P&D / Protótipo interno
}

public enum ManufacturingOrderStatus
{
    Draft = 1,
    Estimated = 2,
    WaitingApproval = 3,
    Approved = 4,
    Planned = 5,
    WaitingMaterial = 6,
    Ready = 7,
    InProduction = 8,
    Paused = 9,
    QualityCheck = 10,
    PartiallyCompleted = 11,
    Completed = 12,
    Cancelled = 13,
    Failed = 14
}

public enum PrintJobAttemptStatus
{
    Created = 1,
    Preparing = 2,
    Running = 3,
    Paused = 4,
    Completed = 5,
    Failed = 6,
    Aborted = 7
}

public enum QualityInspectionStatus
{
    Pending = 1,
    Approved = 2,
    Rejected = 3,
    ReworkRequired = 4
}

public enum FailureCategory
{
    BedAdhesion = 1,             // Descolamento da mesa
    ExtrusionClog = 2,           // Entupimento / bico
    FilamentRunoutOrBreak = 3,   // Filamento rompido / sem filamento
    PowerOutage = 4,             // Interrupção elétrica
    GeometryOrLayerShift = 5,    // Deslocamento de camada
    DimensionalDefect = 6,       // Dimensão fora de tolerância
    FinishRejection = 7,         // Acabamento rejeitado
    Other = 99
}

#endregion

#region Equipments & Spools

/// <summary>
/// Equipamento / Impressora 3D da HB Studio.
/// </summary>
public class ManufacturingPrinter : BranchEntity
{
    public string Code { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;
    public string Manufacturer { get; private set; } = string.Empty;
    public string Model { get; private set; } = string.Empty;
    public string? SerialNumber { get; private set; }
    public PrinterTechnology Technology { get; private set; }
    public string BuildVolume { get; private set; } = string.Empty; // ex: "256x256x256mm"
    public int ExtruderCount { get; private set; } = 1;
    public string CompatibleMaterials { get; private set; } = "PLA,PETG,ABS,TPU";
    public decimal NominalPowerWatts { get; private set; } = 350m;
    public decimal AveragePowerWatts { get; private set; } = 150m;
    public decimal AcquisitionCost { get; private set; }
    public decimal EstimatedLifespanHours { get; private set; } = 5000m;
    public decimal ConfiguredHourlyMachineCost { get; private set; } = 2.50m; // Tarifa gerencial de hora-máquina
    public PrinterOperationalStatus Status { get; private set; } = PrinterOperationalStatus.Available;
    public string? StatusNote { get; private set; }
    public DateTime? StatusUpdatedAtUtc { get; private set; }

    private ManufacturingPrinter() { }

    public ManufacturingPrinter(
        Guid tenantId,
        Guid branchId,
        string code,
        string name,
        string manufacturer,
        string model,
        string? serialNumber,
        PrinterTechnology technology,
        string buildVolume,
        decimal nominalPowerWatts,
        decimal averagePowerWatts,
        decimal acquisitionCost,
        decimal configuredHourlyMachineCost) : base(tenantId, branchId)
    {
        Code = code.Trim().ToUpperInvariant();
        Name = name.Trim();
        Manufacturer = manufacturer.Trim();
        Model = model.Trim();
        SerialNumber = serialNumber?.Trim();
        Technology = technology;
        BuildVolume = buildVolume.Trim();
        NominalPowerWatts = nominalPowerWatts;
        AveragePowerWatts = averagePowerWatts;
        AcquisitionCost = acquisitionCost;
        ConfiguredHourlyMachineCost = configuredHourlyMachineCost;
        Status = PrinterOperationalStatus.Available;
        StatusUpdatedAtUtc = DateTime.UtcNow;
    }

    public void UpdateStatus(PrinterOperationalStatus newStatus, string? note = null)
    {
        Status = newStatus;
        StatusNote = note;
        StatusUpdatedAtUtc = DateTime.UtcNow;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void UpdateHourlyRate(decimal newRate)
    {
        if (newRate < 0) throw new ArgumentOutOfRangeException(nameof(newRate), "Taxa horária não pode ser negativa.");
        ConfiguredHourlyMachineCost = newRate;
        UpdatedAtUtc = DateTime.UtcNow;
    }
}

/// <summary>
/// Bobina física de filamento em uso operacional na fábrica.
/// O saldo contábil canônico permanece no Inventory (StockBalance/ProductSku).
/// </summary>
public class ManufacturingSpool : BranchEntity
{
    public Guid ProductSkuId { get; private set; } // SKU do Catálogo / Estoque
    public string SpoolCode { get; private set; } = string.Empty;
    public string? BatchNumber { get; private set; }
    public string MaterialType { get; private set; } = "PLA"; // PLA, PETG, etc
    public string Color { get; private set; } = "Preto";
    public decimal DiameterMm { get; private set; } = 1.75m;
    public decimal InitialNetWeightGrams { get; private set; } = 1000m;
    public decimal RemainingWeightGrams { get; private set; } = 1000m;
    public decimal SpoolTareGrams { get; private set; } = 200m;
    public bool IsActive { get; private set; } = true;
    public DateTime OpenedAtUtc { get; private set; } = DateTime.UtcNow;

    private ManufacturingSpool() { }

    public ManufacturingSpool(
        Guid tenantId,
        Guid branchId,
        Guid productSkuId,
        string spoolCode,
        string? batchNumber,
        string materialType,
        string color,
        decimal initialWeightGrams,
        decimal spoolTareGrams) : base(tenantId, branchId)
    {
        ProductSkuId = productSkuId;
        SpoolCode = spoolCode.Trim().ToUpperInvariant();
        BatchNumber = batchNumber?.Trim();
        MaterialType = materialType.Trim();
        Color = color.Trim();
        InitialNetWeightGrams = initialWeightGrams;
        RemainingWeightGrams = initialWeightGrams;
        SpoolTareGrams = spoolTareGrams;
        IsActive = true;
    }

    public void RegisterConsumption(decimal gramsConsumed)
    {
        if (gramsConsumed <= 0) return;
        RemainingWeightGrams = Math.Max(0m, RemainingWeightGrams - gramsConsumed);
        if (RemainingWeightGrams == 0m) IsActive = false;
        UpdatedAtUtc = DateTime.UtcNow;
    }
}

#endregion

#region 3D Design Assets & Technical Library

/// <summary>
/// Biblioteca técnica de modelos 3D (STL, 3MF).
/// </summary>
public class ManufacturingDesignAsset : BranchEntity
{
    public string Code { get; private set; } = string.Empty;
    public string Title { get; private set; } = string.Empty;
    public string Category { get; private set; } = "Geral";
    public string? Description { get; private set; }
    public string LicenseType { get; private set; } = "Comercial / HB Studio"; // CC-BY, Propriedade HB, etc
    public bool IsCommercialAllowed { get; private set; } = true;
    public string? Author { get; private set; }
    public Guid? AssociatedProductSkuId { get; private set; } // Caso vire um produto comercial no Catalog

    private readonly List<ManufacturingDesignVersion> _versions = new();
    public IReadOnlyCollection<ManufacturingDesignVersion> Versions => _versions.AsReadOnly();

    private ManufacturingDesignAsset() { }

    public ManufacturingDesignAsset(
        Guid tenantId,
        Guid branchId,
        string code,
        string title,
        string category,
        string licenseType,
        bool isCommercialAllowed,
        string? author,
        Guid? associatedProductSkuId = null) : base(tenantId, branchId)
    {
        Code = code.Trim().ToUpperInvariant();
        Title = title.Trim();
        Category = category.Trim();
        LicenseType = licenseType.Trim();
        IsCommercialAllowed = isCommercialAllowed;
        Author = author?.Trim();
        AssociatedProductSkuId = associatedProductSkuId;
    }

    public ManufacturingDesignVersion AddVersion(
        string revisionCode,
        string fileFormat,
        string storagePath,
        string sha256Hash,
        long fileSizeBytes,
        decimal estimatedDurationMinutes,
        decimal estimatedMassGrams,
        string? notes = null)
    {
        var version = new ManufacturingDesignVersion(
            TenantId,
            Id,
            revisionCode,
            fileFormat,
            storagePath,
            sha256Hash,
            fileSizeBytes,
            estimatedDurationMinutes,
            estimatedMassGrams,
            notes);

        _versions.Add(version);
        UpdatedAtUtc = DateTime.UtcNow;
        return version;
    }
}

public class ManufacturingDesignVersion : TenantEntity
{
    public Guid AssetId { get; private set; }
    public string RevisionCode { get; private set; } = "v1.0";
    public string FileFormat { get; private set; } = "3MF"; // 3MF, STL
    public string StoragePath { get; private set; } = string.Empty;
    public string Sha256Hash { get; private set; } = string.Empty;
    public long FileSizeBytes { get; private set; }
    public decimal EstimatedDurationMinutes { get; private set; }
    public decimal EstimatedMassGrams { get; private set; }
    public string? TechnicalNotes { get; private set; }

    private ManufacturingDesignVersion() { }

    internal ManufacturingDesignVersion(
        Guid tenantId,
        Guid assetId,
        string revisionCode,
        string fileFormat,
        string storagePath,
        string sha256Hash,
        long fileSizeBytes,
        decimal estimatedDurationMinutes,
        decimal estimatedMassGrams,
        string? notes) : base(tenantId)
    {
        AssetId = assetId;
        RevisionCode = revisionCode.Trim();
        FileFormat = fileFormat.Trim().ToUpperInvariant();
        StoragePath = storagePath.Trim();
        Sha256Hash = sha256Hash.Trim();
        FileSizeBytes = fileSizeBytes;
        EstimatedDurationMinutes = estimatedDurationMinutes;
        EstimatedMassGrams = estimatedMassGrams;
        TechnicalNotes = notes;
    }
}

#endregion

#region Quotes & Manufacturing Orders

/// <summary>
/// Orçamento detalhado de fabricação (Custo estimado decomposto + Preço sugerido).
/// </summary>
public class ManufacturingQuote : BranchEntity
{
    public string QuoteNumber { get; private set; } = string.Empty;
    public Guid? CustomerPartyId { get; private set; }
    public string Description { get; private set; } = string.Empty;
    public int PlannedQuantity { get; private set; } = 1;

    // Componentes de custo estimados (decimal rigoroso)
    public decimal EstimatedMaterialCost { get; private set; }
    public decimal EstimatedEnergyCost { get; private set; }
    public decimal EstimatedMachineCost { get; private set; }
    public decimal EstimatedLaborCost { get; private set; }
    public decimal EstimatedPlannedWasteCost { get; private set; }
    public decimal TotalEstimatedCost => EstimatedMaterialCost + EstimatedEnergyCost + EstimatedMachineCost + EstimatedLaborCost + EstimatedPlannedWasteCost;

    // Precificação
    public decimal MarkupPercent { get; private set; } = 50.0m;
    public decimal SuggestedFinalPrice { get; private set; }
    public decimal GrossMarginPercent => SuggestedFinalPrice > 0 ? ((SuggestedFinalPrice - TotalEstimatedCost) / SuggestedFinalPrice) * 100m : 0m;

    public bool IsApproved { get; private set; }

    private ManufacturingQuote() { }

    public ManufacturingQuote(
        Guid tenantId,
        Guid branchId,
        string quoteNumber,
        Guid? customerPartyId,
        string description,
        int plannedQuantity,
        decimal materialCost,
        decimal energyCost,
        decimal machineCost,
        decimal laborCost,
        decimal wasteCost,
        decimal markupPercent) : base(tenantId, branchId)
    {
        QuoteNumber = quoteNumber.Trim().ToUpperInvariant();
        CustomerPartyId = customerPartyId;
        Description = description.Trim();
        PlannedQuantity = plannedQuantity > 0 ? plannedQuantity : 1;
        EstimatedMaterialCost = materialCost;
        EstimatedEnergyCost = energyCost;
        EstimatedMachineCost = machineCost;
        EstimatedLaborCost = laborCost;
        EstimatedPlannedWasteCost = wasteCost;
        MarkupPercent = markupPercent;

        var cost = materialCost + energyCost + machineCost + laborCost + wasteCost;
        SuggestedFinalPrice = cost * (1.0m + (markupPercent / 100.0m));
        IsApproved = false;
    }

    public void Approve()
    {
        IsApproved = true;
        UpdatedAtUtc = DateTime.UtcNow;
    }
}

/// <summary>
/// Ordem de Produção (OP) de Fabricação 3D.
/// </summary>
public class ManufacturingOrder : BranchEntity
{
    public string OrderNumber { get; private set; } = string.Empty;
    public ManufacturingOrderType Type { get; private set; }
    public ManufacturingOrderStatus Status { get; private set; }
    public Guid? SalesOrderId { get; private set; }       // Vínculo sob encomenda
    public Guid? TargetProductSkuId { get; private set; }  // Produto final a ser gerado
    public Guid? DesignVersionId { get; private set; }    // Revisão 3D utilizada
    public Guid? AssignedPrinterId { get; private set; }  // Impressora planejada
    public Guid MaterialProductSkuId { get; private set; } // Filamento oficial (Catalog SKU)
    public Guid? MaterialStockReservationId { get; private set; } // Reserva oficial no Inventory

    public int PlannedQuantity { get; private set; }
    public int ProducedQuantity { get; private set; }
    public int ApprovedQuantity { get; private set; }
    public int RejectedQuantity { get; private set; }

    // Estimativas de Fatiador
    public decimal EstimatedFilamentGrams { get; private set; }
    public decimal EstimatedPrintTimeMinutes { get; private set; }
    public decimal TotalEstimatedCost { get; private set; }

    // CUSTOS EFETIVOS REAIS APURADOS
    public decimal ActualMaterialCost { get; private set; }
    public decimal ActualEnergyCost { get; private set; }
    public decimal ActualMachineCost { get; private set; }
    public decimal ActualLaborCost { get; private set; }
    public decimal ActualWasteCost { get; private set; }
    public decimal TotalActualCost => ActualMaterialCost + ActualEnergyCost + ActualMachineCost + ActualLaborCost + ActualWasteCost;

    // Custo Unitário da Peça Aprovada
    public decimal ActualUnitCost => ApprovedQuantity > 0 ? Math.Round(TotalActualCost / ApprovedQuantity, 2) : 0m;

    public string? FailureReason { get; private set; }
    public DateTime? StartedAtUtc { get; private set; }
    public DateTime? FinishedAtUtc { get; private set; }

    private readonly List<ManufacturingPrintAttempt> _attempts = new();
    public IReadOnlyCollection<ManufacturingPrintAttempt> Attempts => _attempts.AsReadOnly();

    private ManufacturingOrder() { }

    public ManufacturingOrder(
        Guid tenantId,
        Guid branchId,
        string orderNumber,
        ManufacturingOrderType type,
        Guid? salesOrderId,
        Guid? targetProductSkuId,
        Guid? designVersionId,
        Guid? assignedPrinterId,
        Guid materialProductSkuId,
        int plannedQuantity,
        decimal estimatedFilamentGrams,
        decimal estimatedPrintTimeMinutes,
        decimal totalEstimatedCost) : base(tenantId, branchId)
    {
        OrderNumber = orderNumber.Trim().ToUpperInvariant();
        Type = type;
        Status = ManufacturingOrderStatus.Draft;
        SalesOrderId = salesOrderId;
        TargetProductSkuId = targetProductSkuId;
        DesignVersionId = designVersionId;
        AssignedPrinterId = assignedPrinterId;
        MaterialProductSkuId = materialProductSkuId;
        PlannedQuantity = plannedQuantity > 0 ? plannedQuantity : 1;
        EstimatedFilamentGrams = estimatedFilamentGrams;
        EstimatedPrintTimeMinutes = estimatedPrintTimeMinutes;
        TotalEstimatedCost = totalEstimatedCost;
    }

    public void LinkReservation(Guid reservationId)
    {
        MaterialStockReservationId = reservationId;
        Status = ManufacturingOrderStatus.Ready;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void StartProduction()
    {
        if (Status != ManufacturingOrderStatus.Ready && Status != ManufacturingOrderStatus.Approved && Status != ManufacturingOrderStatus.Planned && Status != ManufacturingOrderStatus.InProduction)
            throw new InvalidOperationException($"Não é possível iniciar produção no status {Status}.");

        Status = ManufacturingOrderStatus.InProduction;
        StartedAtUtc ??= DateTime.UtcNow;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public ManufacturingPrintAttempt CreateAttempt(int attemptNumber, Guid printerId, decimal estimatedDurationMinutes, decimal estimatedGrams)
    {
        var attempt = new ManufacturingPrintAttempt(TenantId, Id, attemptNumber, printerId, estimatedDurationMinutes, estimatedGrams);
        _attempts.Add(attempt);
        UpdatedAtUtc = DateTime.UtcNow;
        return attempt;
    }

    public void RegisterConsumptionAndCosts(
        decimal materialCost,
        decimal energyCost,
        decimal machineCost,
        decimal laborCost,
        decimal wasteCost)
    {
        ActualMaterialCost += materialCost;
        ActualEnergyCost += energyCost;
        ActualMachineCost += machineCost;
        ActualLaborCost += laborCost;
        ActualWasteCost += wasteCost;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void CompleteQualityInspection(int approvedQty, int rejectedQty, string? failureReason = null)
    {
        ProducedQuantity = approvedQty + rejectedQty;
        ApprovedQuantity = approvedQty;
        RejectedQuantity = rejectedQty;
        FailureReason = failureReason;

        Status = approvedQty > 0 
            ? (approvedQty >= PlannedQuantity ? ManufacturingOrderStatus.Completed : ManufacturingOrderStatus.PartiallyCompleted)
            : ManufacturingOrderStatus.Failed;

        FinishedAtUtc = DateTime.UtcNow;
        UpdatedAtUtc = DateTime.UtcNow;
    }
}

/// <summary>
/// Execução / Tentativa de impressão real na máquina.
/// Permite rastrear falhas sem perder o histórico nem o custo incorrido.
/// </summary>
public class ManufacturingPrintAttempt : TenantEntity
{
    public Guid ManufacturingOrderId { get; private set; }
    public int AttemptNumber { get; private set; }
    public Guid PrinterId { get; private set; }
    public PrintJobAttemptStatus Status { get; private set; }
    public decimal EstimatedDurationMinutes { get; private set; }
    public decimal ActualDurationMinutes { get; private set; }
    public decimal EstimatedMassGrams { get; private set; }
    public decimal ActualMassGrams { get; private set; }
    public FailureCategory? FailureCategory { get; private set; }
    public string? FailureNotes { get; private set; }
    public string? OperatorName { get; private set; }
    public DateTime? StartedAtUtc { get; private set; }
    public DateTime? FinishedAtUtc { get; private set; }

    private ManufacturingPrintAttempt() { }

    internal ManufacturingPrintAttempt(
        Guid tenantId,
        Guid orderId,
        int attemptNumber,
        Guid printerId,
        decimal estimatedDurationMinutes,
        decimal estimatedMassGrams) : base(tenantId)
    {
        ManufacturingOrderId = orderId;
        AttemptNumber = attemptNumber;
        PrinterId = printerId;
        Status = PrintJobAttemptStatus.Created;
        EstimatedDurationMinutes = estimatedDurationMinutes;
        EstimatedMassGrams = estimatedMassGrams;
    }

    public void Start(string operatorName)
    {
        Status = PrintJobAttemptStatus.Running;
        OperatorName = operatorName.Trim();
        StartedAtUtc = DateTime.UtcNow;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void CompleteSuccessfully(decimal actualDurationMinutes, decimal actualMassGrams)
    {
        Status = PrintJobAttemptStatus.Completed;
        ActualDurationMinutes = actualDurationMinutes;
        ActualMassGrams = actualMassGrams;
        FinishedAtUtc = DateTime.UtcNow;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void RegisterFailure(FailureCategory category, string reason, decimal wastedDurationMinutes, decimal wastedMassGrams)
    {
        Status = PrintJobAttemptStatus.Failed;
        FailureCategory = category;
        FailureNotes = reason.Trim();
        ActualDurationMinutes = wastedDurationMinutes;
        ActualMassGrams = wastedMassGrams;
        FinishedAtUtc = DateTime.UtcNow;
        UpdatedAtUtc = DateTime.UtcNow;
    }
}

#endregion
