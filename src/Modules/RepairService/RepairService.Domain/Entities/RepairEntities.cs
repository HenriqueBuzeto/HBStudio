using BuildingBlocks.Domain;
using RepairService.Domain.Enums;

namespace RepairService.Domain.Entities;

public class RepairOrder : TenantEntity
{
    public Guid BranchId { get; private set; }
    public string OrderNumber { get; private set; }
    public Guid CustomerId { get; private set; } // PartyId do cliente (MOD-01)
    public Guid CustomerEquipmentId { get; private set; } // CustomerEquipmentId (MOD-01)
    public Guid? AssignedTechnicianId { get; private set; }
    public RepairOrderStatus Status { get; private set; }

    public string ReportedDefect { get; private set; }
    public string? PhysicalConditionNotes { get; private set; }
    public string? AccessoriesIncluded { get; private set; }
    public string? DiagnosticNotes { get; private set; }
    public string? ResolutionNotes { get; private set; }

    public DateTime ReceivedAtUtc { get; private set; }
    public DateTime? EstimatedCompletionUtc { get; private set; }
    public DateTime? DiagnosisCompletedAtUtc { get; private set; }
    public DateTime? RepairedAtUtc { get; private set; }
    public DateTime? QualityCheckedAtUtc { get; private set; }
    public DateTime? DeliveredAtUtc { get; private set; }

    // Rastreabilidade de Garantia
    public Guid? OriginalRepairOrderId { get; private set; } // Caso seja Retorno em Garantia
    public int LegalWarrantyDays { get; private set; } = 90; // CDC Art. 26 (90 dias para bens duráveis)
    public int AdditionalWarrantyDays { get; private set; } = 0; // Garantia contratual estendida opcional
    public DateTime? WarrantyExpiresAtUtc { get; private set; }

    // Custódia e Retirada
    public string? DeliveredToPersonName { get; private set; }
    public string? DeliveredToDocumentNumber { get; private set; }
    public string? DeliveryNotes { get; private set; }

    // Rastreabilidade Financeira e Estoque
    public Guid? StockReservationId { get; private set; } // ID da reserva oficial em Inventory
    public decimal TotalLaborPrice { get; private set; }
    public decimal TotalPartsPrice { get; private set; }
    public decimal TotalDiscount { get; private set; }
    public decimal FinalPrice { get; private set; }
    public decimal TotalPartsCost { get; private set; } // Custo real do Kardex
    public decimal TotalLaborCost { get; private set; } // Custo gerencial apontado

    // Coleções
    private readonly List<RepairChecklistItem> _checklistItems = new();
    public IReadOnlyCollection<RepairChecklistItem> ChecklistItems => _checklistItems.AsReadOnly();

    private readonly List<RepairEstimateItem> _estimateItems = new();
    public IReadOnlyCollection<RepairEstimateItem> EstimateItems => _estimateItems.AsReadOnly();

    private readonly List<RepairPartUsage> _partUsages = new();
    public IReadOnlyCollection<RepairPartUsage> PartUsages => _partUsages.AsReadOnly();

    private readonly List<RepairStatusHistoryEntry> _statusHistory = new();
    public IReadOnlyCollection<RepairStatusHistoryEntry> StatusHistory => _statusHistory.AsReadOnly();

    private readonly List<RepairEvidenceAttachment> _attachments = new();
    public IReadOnlyCollection<RepairEvidenceAttachment> Attachments => _attachments.AsReadOnly();

    private readonly List<RepairWarrantyClaim> _warrantyClaims = new();
    public IReadOnlyCollection<RepairWarrantyClaim> WarrantyClaims => _warrantyClaims.AsReadOnly();

    private RepairOrder()
    {
        OrderNumber = string.Empty;
        ReportedDefect = string.Empty;
    }

    public RepairOrder(
        Guid tenantId,
        Guid branchId,
        string orderNumber,
        Guid customerId,
        Guid customerEquipmentId,
        string reportedDefect,
        string? physicalConditionNotes,
        string? accessoriesIncluded,
        DateTime? estimatedCompletionUtc,
        Guid? assignedTechnicianId = null,
        Guid? originalRepairOrderId = null) : base(tenantId)
    {
        if (string.IsNullOrWhiteSpace(orderNumber))
            throw new ArgumentException("Número da OS é obrigatório.", nameof(orderNumber));
        if (customerId == Guid.Empty)
            throw new ArgumentException("Cliente é obrigatório.", nameof(customerId));
        if (customerEquipmentId == Guid.Empty)
            throw new ArgumentException("Equipamento do cliente é obrigatório.", nameof(customerEquipmentId));
        if (string.IsNullOrWhiteSpace(reportedDefect))
            throw new ArgumentException("Defeito relatado é obrigatório.", nameof(reportedDefect));

        BranchId = branchId;
        OrderNumber = orderNumber.Trim().ToUpperInvariant();
        CustomerId = customerId;
        CustomerEquipmentId = customerEquipmentId;
        ReportedDefect = reportedDefect.Trim();
        PhysicalConditionNotes = physicalConditionNotes?.Trim();
        AccessoriesIncluded = accessoriesIncluded?.Trim();
        EstimatedCompletionUtc = estimatedCompletionUtc.HasValue ? DateTime.SpecifyKind(estimatedCompletionUtc.Value, DateTimeKind.Utc) : null;
        AssignedTechnicianId = assignedTechnicianId;
        OriginalRepairOrderId = originalRepairOrderId;

        ReceivedAtUtc = DateTime.UtcNow;
        Status = originalRepairOrderId.HasValue ? RepairOrderStatus.WarrantyReturn : RepairOrderStatus.Received;

        AddStatusHistory(Status, "Ordem de Serviço criada e equipamento recebido em custódia no balcão.");
    }

    public void AddChecklistItem(string category, string itemName, ChecklistItemStatus status, string? notes, bool isOutputCheck = false)
    {
        var existing = _checklistItems.FirstOrDefault(c => c.ItemName == itemName && c.IsOutputCheck == isOutputCheck);
        if (existing != null)
        {
            existing.Update(status, notes);
        }
        else
        {
            _checklistItems.Add(new RepairChecklistItem(TenantId, Id, category, itemName, status, notes, isOutputCheck));
        }
    }

    public void AssignTechnician(Guid technicianId, string? notes = null)
    {
        AssignedTechnicianId = technicianId;
        if (Status == RepairOrderStatus.Received)
        {
            Status = RepairOrderStatus.WaitingDiagnosis;
        }
        AddStatusHistory(Status, $"Técnico atribuído: {technicianId}. {notes}");
    }

    public void StartDiagnosis(Guid technicianId)
    {
        AssignedTechnicianId = technicianId;
        Status = RepairOrderStatus.Diagnosing;
        AddStatusHistory(Status, "Diagnóstico técnico iniciado na bancada.");
    }

    public void CompleteDiagnosis(string diagnosticNotes)
    {
        if (string.IsNullOrWhiteSpace(diagnosticNotes))
            throw new ArgumentException("Laudo de diagnóstico é obrigatório.", nameof(diagnosticNotes));

        DiagnosticNotes = diagnosticNotes.Trim();
        DiagnosisCompletedAtUtc = DateTime.UtcNow;
        Status = RepairOrderStatus.WaitingEstimateApproval;
        AddStatusHistory(Status, "Diagnóstico concluído. Aguardando aprovação do orçamento.");
    }

    public void AddEstimateItem(
        RepairEstimateItemType itemType,
        string description,
        decimal quantity,
        decimal unitPrice,
        decimal unitCost,
        Guid? productSkuId = null)
    {
        if (Status == RepairOrderStatus.Delivered || Status == RepairOrderStatus.Cancelled)
            throw new InvalidOperationException("Não é permitido alterar orçamento de OS finalizada ou cancelada.");

        if (quantity <= 0) throw new ArgumentException("Quantidade deve ser maior que zero.", nameof(quantity));
        if (unitPrice < 0) throw new ArgumentException("Preço unitário não pode ser negativo.", nameof(unitPrice));

        _estimateItems.Add(new RepairEstimateItem(
            TenantId,
            Id,
            itemType,
            description,
            quantity,
            unitPrice,
            unitCost,
            productSkuId
        ));

        RecalculateTotals();
    }

    public void ClearEstimateItems()
    {
        _estimateItems.Clear();
        RecalculateTotals();
    }

    public void RecalculateTotals()
    {
        TotalLaborPrice = _estimateItems.Where(i => i.ItemType == RepairEstimateItemType.LaborService).Sum(i => i.Quantity * i.UnitPrice);
        TotalPartsPrice = _estimateItems.Where(i => i.ItemType == RepairEstimateItemType.Part).Sum(i => i.Quantity * i.UnitPrice);
        FinalPrice = Math.Max(0, (TotalLaborPrice + TotalPartsPrice + _estimateItems.Where(i => i.ItemType == RepairEstimateItemType.ExternalService).Sum(i => i.Quantity * i.UnitPrice)) - TotalDiscount);
    }

    public void ApproveEstimate(string approvalChannel, string? approvalEvidence)
    {
        if (Status != RepairOrderStatus.WaitingEstimateApproval && Status != RepairOrderStatus.Diagnosing)
            throw new InvalidOperationException($"Não é possível aprovar orçamento com status atual: {Status}");

        Status = RepairOrderStatus.Approved;
        AddStatusHistory(Status, $"Orçamento aprovado pelo cliente via {approvalChannel}. Evidência: {approvalEvidence}");
    }

    public void RejectEstimate(string reason)
    {
        Status = RepairOrderStatus.Rejected;
        AddStatusHistory(Status, $"Orçamento recusado pelo cliente. Motivo: {reason}");
    }

    public void SetWaitingParts(Guid? stockReservationId = null)
    {
        StockReservationId = stockReservationId;
        Status = RepairOrderStatus.WaitingParts;
        AddStatusHistory(Status, "Aguardando separação ou chegada de peças de reposição.");
    }

    public void StartRepair()
    {
        if (Status != RepairOrderStatus.Approved && Status != RepairOrderStatus.WaitingParts && Status != RepairOrderStatus.WarrantyReturn)
            throw new InvalidOperationException("O reparo só pode ser iniciado se o orçamento tiver sido aprovado ou em retorno de garantia.");

        Status = RepairOrderStatus.InRepair;
        AddStatusHistory(Status, "Execução técnica do reparo iniciada na bancada.");
    }

    public void RecordPartUsage(
        Guid productSkuId,
        string partDescription,
        decimal quantity,
        decimal actualUnitCost,
        Guid? inventoryUnitId = null,
        Guid? stockMovementId = null)
    {
        _partUsages.Add(new RepairPartUsage(
            TenantId,
            Id,
            productSkuId,
            partDescription,
            quantity,
            actualUnitCost,
            inventoryUnitId,
            stockMovementId
        ));

        TotalPartsCost = _partUsages.Sum(p => p.Quantity * p.ActualUnitCost);
    }

    public void CompleteRepair(string resolutionNotes, decimal technicianLaborCost = 0)
    {
        if (Status != RepairOrderStatus.InRepair && Status != RepairOrderStatus.WaitingExternalService && Status != RepairOrderStatus.WarrantyReturn)
            throw new InvalidOperationException("Reparo não está em andamento.");

        ResolutionNotes = resolutionNotes.Trim();
        TotalLaborCost = Math.Max(0, technicianLaborCost);
        RepairedAtUtc = DateTime.UtcNow;
        Status = RepairOrderStatus.QualityCheck;
        AddStatusHistory(Status, "Reparo concluído pelo técnico. Encaminhado para inspeção de qualidade (QA).");
    }

    public void PassQualityCheck(string qaNotes)
    {
        if (Status != RepairOrderStatus.QualityCheck)
            throw new InvalidOperationException("OS precisa estar na etapa de Quality Check.");

        QualityCheckedAtUtc = DateTime.UtcNow;
        Status = RepairOrderStatus.ReadyForPickup;
        AddStatusHistory(Status, $"Inspeção final de qualidade APROVADA. {qaNotes}");
    }

    public void DeliverToCustomer(
        string deliveredToPersonName,
        string? deliveredToDocumentNumber,
        string? deliveryNotes,
        int additionalWarrantyDays = 0)
    {
        if (Status != RepairOrderStatus.ReadyForPickup && Status != RepairOrderStatus.Rejected && Status != RepairOrderStatus.Unrepairable)
            throw new InvalidOperationException("Equipamento só pode ser entregue se estiver pronto para retirada, rejeitado ou sem reparo.");

        DeliveredToPersonName = deliveredToPersonName.Trim();
        DeliveredToDocumentNumber = deliveredToDocumentNumber?.Trim();
        DeliveryNotes = deliveryNotes?.Trim();
        DeliveredAtUtc = DateTime.UtcNow;
        AdditionalWarrantyDays = Math.Max(0, additionalWarrantyDays);

        // Se foi reparado, ativa a garantia legal CDC de 90 dias + garantia adicional
        if (Status == RepairOrderStatus.ReadyForPickup)
        {
            WarrantyExpiresAtUtc = DateTime.UtcNow.AddDays(LegalWarrantyDays + AdditionalWarrantyDays);
        }

        Status = RepairOrderStatus.Delivered;
        AddStatusHistory(Status, $"Equipamento entregue a {DeliveredToPersonName}. Saída oficial de custódia da HB Studio.");
    }

    public void AddAttachment(string fileName, string storageUrl, string fileType, long fileSizeBytes, string category, string? description)
    {
        _attachments.Add(new RepairEvidenceAttachment(TenantId, Id, fileName, storageUrl, fileType, fileSizeBytes, category, description));
    }

    public void AddWarrantyClaim(string defectDescription, DateTime claimDateUtc)
    {
        _warrantyClaims.Add(new RepairWarrantyClaim(TenantId, Id, defectDescription, claimDateUtc));
    }

    private void AddStatusHistory(RepairOrderStatus status, string description)
    {
        _statusHistory.Add(new RepairStatusHistoryEntry(TenantId, Id, status, description, DateTime.UtcNow));
    }
}

public class RepairChecklistItem : TenantEntity
{
    public Guid RepairOrderId { get; private set; }
    public string Category { get; private set; } // Entrada, Saída, Tela, Placa, etc.
    public string ItemName { get; private set; } // Touchscreen, Câmera, FaceID, etc.
    public ChecklistItemStatus Status { get; private set; }
    public string? Notes { get; private set; }
    public bool IsOutputCheck { get; private set; }
    public DateTime CheckedAtUtc { get; private set; }

    private RepairChecklistItem()
    {
        Category = string.Empty;
        ItemName = string.Empty;
    }

    public RepairChecklistItem(
        Guid tenantId,
        Guid repairOrderId,
        string category,
        string itemName,
        ChecklistItemStatus status,
        string? notes,
        bool isOutputCheck) : base(tenantId)
    {
        RepairOrderId = repairOrderId;
        Category = category.Trim();
        ItemName = itemName.Trim();
        Status = status;
        Notes = notes?.Trim();
        IsOutputCheck = isOutputCheck;
        CheckedAtUtc = DateTime.UtcNow;
    }

    public void Update(ChecklistItemStatus status, string? notes)
    {
        Status = status;
        Notes = notes?.Trim();
        CheckedAtUtc = DateTime.UtcNow;
    }
}

public class RepairEstimateItem : TenantEntity
{
    public Guid RepairOrderId { get; private set; }
    public RepairEstimateItemType ItemType { get; private set; }
    public string Description { get; private set; }
    public decimal Quantity { get; private set; }
    public decimal UnitPrice { get; private set; }
    public decimal UnitCost { get; private set; }
    public Guid? ProductSkuId { get; private set; }

    private RepairEstimateItem()
    {
        Description = string.Empty;
    }

    public RepairEstimateItem(
        Guid tenantId,
        Guid repairOrderId,
        RepairEstimateItemType itemType,
        string description,
        decimal quantity,
        decimal unitPrice,
        decimal unitCost,
        Guid? productSkuId) : base(tenantId)
    {
        RepairOrderId = repairOrderId;
        ItemType = itemType;
        Description = description.Trim();
        Quantity = quantity;
        UnitPrice = unitPrice;
        UnitCost = unitCost;
        ProductSkuId = productSkuId;
    }
}

public class RepairPartUsage : TenantEntity
{
    public Guid RepairOrderId { get; private set; }
    public Guid ProductSkuId { get; private set; }
    public string PartDescription { get; private set; }
    public decimal Quantity { get; private set; }
    public decimal ActualUnitCost { get; private set; }
    public Guid? InventoryUnitId { get; private set; }
    public Guid? StockMovementId { get; private set; }
    public DateTime ConsumedAtUtc { get; private set; }

    private RepairPartUsage()
    {
        PartDescription = string.Empty;
    }

    public RepairPartUsage(
        Guid tenantId,
        Guid repairOrderId,
        Guid productSkuId,
        string partDescription,
        decimal quantity,
        decimal actualUnitCost,
        Guid? inventoryUnitId,
        Guid? stockMovementId) : base(tenantId)
    {
        RepairOrderId = repairOrderId;
        ProductSkuId = productSkuId;
        PartDescription = partDescription.Trim();
        Quantity = quantity;
        ActualUnitCost = actualUnitCost;
        InventoryUnitId = inventoryUnitId;
        StockMovementId = stockMovementId;
        ConsumedAtUtc = DateTime.UtcNow;
    }
}

public class RepairStatusHistoryEntry : TenantEntity
{
    public Guid RepairOrderId { get; private set; }
    public RepairOrderStatus Status { get; private set; }
    public string Description { get; private set; }
    public DateTime TimestampUtc { get; private set; }

    private RepairStatusHistoryEntry()
    {
        Description = string.Empty;
    }

    public RepairStatusHistoryEntry(
        Guid tenantId,
        Guid repairOrderId,
        RepairOrderStatus status,
        string description,
        DateTime timestampUtc) : base(tenantId)
    {
        RepairOrderId = repairOrderId;
        Status = status;
        Description = description.Trim();
        TimestampUtc = timestampUtc;
    }
}

public class RepairEvidenceAttachment : TenantEntity
{
    public Guid RepairOrderId { get; private set; }
    public string FileName { get; private set; }
    public string StorageUrl { get; private set; }
    public string FileType { get; private set; }
    public long FileSizeBytes { get; private set; }
    public string Category { get; private set; } // Antes, Durante, Laudo, Entrega
    public string? Description { get; private set; }
    public DateTime UploadedAtUtc { get; private set; }

    private RepairEvidenceAttachment()
    {
        FileName = string.Empty;
        StorageUrl = string.Empty;
        FileType = string.Empty;
        Category = string.Empty;
    }

    public RepairEvidenceAttachment(
        Guid tenantId,
        Guid repairOrderId,
        string fileName,
        string storageUrl,
        string fileType,
        long fileSizeBytes,
        string category,
        string? description) : base(tenantId)
    {
        RepairOrderId = repairOrderId;
        FileName = fileName.Trim();
        StorageUrl = storageUrl.Trim();
        FileType = fileType.Trim();
        FileSizeBytes = fileSizeBytes;
        Category = category.Trim();
        Description = description?.Trim();
        UploadedAtUtc = DateTime.UtcNow;
    }
}

public class RepairWarrantyClaim : TenantEntity
{
    public Guid RepairOrderId { get; private set; }
    public string DefectDescription { get; private set; }
    public DateTime ClaimDateUtc { get; private set; }
    public WarrantyCoverageDecision Decision { get; private set; }
    public string? DecisionRationale { get; private set; }
    public DateTime? DecisionDateUtc { get; private set; }
    public Guid? FollowUpRepairOrderId { get; private set; }

    private RepairWarrantyClaim()
    {
        DefectDescription = string.Empty;
    }

    public RepairWarrantyClaim(
        Guid tenantId,
        Guid repairOrderId,
        string defectDescription,
        DateTime claimDateUtc) : base(tenantId)
    {
        RepairOrderId = repairOrderId;
        DefectDescription = defectDescription.Trim();
        ClaimDateUtc = DateTime.SpecifyKind(claimDateUtc, DateTimeKind.Utc);
        Decision = WarrantyCoverageDecision.UnderReview;
    }

    public void Decide(WarrantyCoverageDecision decision, string rationale, Guid? followUpRepairOrderId = null)
    {
        Decision = decision;
        DecisionRationale = rationale.Trim();
        DecisionDateUtc = DateTime.UtcNow;
        FollowUpRepairOrderId = followUpRepairOrderId;
    }
}

