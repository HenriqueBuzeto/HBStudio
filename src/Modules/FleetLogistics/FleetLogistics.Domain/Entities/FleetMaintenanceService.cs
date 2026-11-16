using BuildingBlocks.Domain;

namespace FleetLogistics.Domain.Entities;

public enum MaintenanceType
{
    OilAndFilterChange = 1, // Troca de óleo de motor e filtro de óleo
    AirFilterChange = 2,    // Troca de filtro de ar e combustível
    TiresAndAlignment = 3,  // Pneus, alinhamento e balanceamento
    BrakeService = 4,       // Pastilhas, discos e fluido de freio
    BatteryReplacement = 5, // Substituição de bateria
    BeltsAndHoses = 6,      // Correia dentada / alternador / tensores
    SuspensionAndSteering = 7, // Amortecedores, buchas, pivôs
    GeneralCheckup = 8,     // Revisão periódica completa
    CorrectiveRepair = 9,   // Manutenção corretiva de falha / quebra
    OtherService = 99
}

/// <summary>
/// Execução real de serviço mecânico / manutenção preventiva ou corretiva realizada no veículo.
/// </summary>
public class FleetMaintenanceService : TenantEntity
{
    public Guid BranchId { get; private set; }
    public Guid VehicleId { get; private set; }
    public FleetVehicle? Vehicle { get; private set; }
    public Guid? MaintenancePlanId { get; private set; }
    public FleetMaintenancePlan? MaintenancePlan { get; private set; }
    public MaintenanceType Type { get; private set; }
    public DateTime ServiceDateUtc { get; private set; }
    public decimal OdometerKm { get; private set; }
    public string WorkshopName { get; private set; } // Oficina / Prestador
    public string Description { get; private set; }
    public decimal PartsCost { get; private set; }
    public decimal LaborCost { get; private set; }
    public decimal TotalCost { get; private set; }
    public string? OilBrandAndSpecs { get; private set; }
    public bool FilterReplaced { get; private set; }
    public decimal? NextRecommendedOdometerKm { get; private set; }
    public DateTime? NextRecommendedDateUtc { get; private set; }
    public PaymentMethodCategory PaymentMethod { get; private set; }
    public FinancialStatus FinancialStatus { get; private set; }
    public Guid? AccountPayableId { get; private set; }
    public Guid? PayingPartnerId { get; private set; }
    public Guid? PartnerReimbursementId { get; private set; }
    public string? InvoiceDocumentReference { get; private set; }
    public string? ReceiptAttachmentPath { get; private set; }
    public Guid RegisteredByUserId { get; private set; }
    public string? Notes { get; private set; }
    public string? IdempotencyKey { get; private set; }

    private FleetMaintenanceService()
    {
        WorkshopName = string.Empty;
        Description = string.Empty;
    }

    public FleetMaintenanceService(
        Guid tenantId,
        Guid branchId,
        Guid vehicleId,
        MaintenanceType type,
        DateTime serviceDateUtc,
        decimal odometerKm,
        string workshopName,
        string description,
        decimal partsCost,
        decimal laborCost,
        PaymentMethodCategory paymentMethod,
        Guid registeredByUserId,
        Guid? maintenancePlanId = null,
        string? oilBrandAndSpecs = null,
        bool filterReplaced = false,
        decimal? nextRecommendedOdometerKm = null,
        DateTime? nextRecommendedDateUtc = null,
        Guid? payingPartnerId = null,
        string? invoiceDocumentReference = null,
        string? receiptAttachmentPath = null,
        string? notes = null,
        string? idempotencyKey = null) : base(tenantId)
    {
        if (vehicleId == Guid.Empty)
            throw new ArgumentException("Veículo é obrigatório.", nameof(vehicleId));
        if (string.IsNullOrWhiteSpace(workshopName))
            throw new ArgumentException("Nome da oficina/fornecedor é obrigatório.", nameof(workshopName));
        if (string.IsNullOrWhiteSpace(description))
            throw new ArgumentException("Descrição do serviço é obrigatória.", nameof(description));
        if (odometerKm < 0)
            throw new ArgumentException("Hodômetro não pode ser negativo.", nameof(odometerKm));
        if (partsCost < 0 || laborCost < 0)
            throw new ArgumentException("Custos de peças e mão de obra não podem ser negativos.");

        var total = partsCost + laborCost;
        if (total <= 0)
            throw new ArgumentException("O valor total da manutenção deve ser maior que zero.", nameof(total));

        BranchId = branchId;
        VehicleId = vehicleId;
        Type = type;
        ServiceDateUtc = serviceDateUtc;
        OdometerKm = odometerKm;
        WorkshopName = workshopName.Trim();
        Description = description.Trim();
        PartsCost = partsCost;
        LaborCost = laborCost;
        TotalCost = total;
        PaymentMethod = paymentMethod;
        RegisteredByUserId = registeredByUserId;
        MaintenancePlanId = maintenancePlanId;
        OilBrandAndSpecs = oilBrandAndSpecs?.Trim();
        FilterReplaced = filterReplaced;
        NextRecommendedOdometerKm = nextRecommendedOdometerKm;
        NextRecommendedDateUtc = nextRecommendedDateUtc;
        PayingPartnerId = payingPartnerId;
        InvoiceDocumentReference = invoiceDocumentReference?.Trim().ToUpperInvariant();
        ReceiptAttachmentPath = receiptAttachmentPath?.Trim();
        Notes = notes?.Trim();
        IdempotencyKey = idempotencyKey?.Trim();

        FinancialStatus = paymentMethod switch
        {
            PaymentMethodCategory.InvoicedPayLater => FinancialStatus.PayablePending,
            PaymentMethodCategory.PaidByPartner => FinancialStatus.ReimbursementPending,
            _ => FinancialStatus.Settled
        };
    }

    public void LinkFinancialPayable(Guid accountPayableId)
    {
        AccountPayableId = accountPayableId;
        FinancialStatus = FinancialStatus.PayablePending;
    }

    public void LinkPartnerReimbursement(Guid reimbursementId)
    {
        PartnerReimbursementId = reimbursementId;
        FinancialStatus = FinancialStatus.ReimbursementPending;
    }

    public void MarkSettled()
    {
        FinancialStatus = FinancialStatus.Settled;
    }
}
