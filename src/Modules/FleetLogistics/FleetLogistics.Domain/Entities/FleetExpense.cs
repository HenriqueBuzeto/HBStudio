using BuildingBlocks.Domain;

namespace FleetLogistics.Domain.Entities;

public enum ExpenseCategory
{
    Fuel = 1,
    Toll = 2,            // Pedágio
    Parking = 3,         // Estacionamento
    VehicleMaintenance = 4, // Manutenção / Oficina
    CarWash = 5,         // Lavagem / Estética automotiva
    FoodTravel = 6,      // Alimentação em viagem / Diária
    Lodging = 7,         // Hospedagem
    AppTransport = 8,    // Uber / 99 / Táxi
    ThirdPartyFreight = 9, // Frete terceirizado / Transportadora
    TowTruck = 10,       // Guincho
    Other = 99
}

/// <summary>
/// Despesa operacional de logística / transporte (Pedágios, estacionamentos, refeições em deslocamento).
/// </summary>
public class FleetExpense : TenantEntity
{
    public Guid BranchId { get; private set; }
    public ExpenseCategory Category { get; private set; }
    public Guid? VehicleId { get; private set; }
    public FleetVehicle? Vehicle { get; private set; }
    public Guid? TripId { get; private set; }
    public FleetTrip? Trip { get; private set; }
    public DateTime ExpenseDateUtc { get; private set; }
    public string Description { get; private set; }
    public decimal Amount { get; private set; }
    public string? SupplierName { get; private set; }
    public PaymentMethodCategory PaymentMethod { get; private set; }
    public FinancialStatus FinancialStatus { get; private set; }
    public Guid? AccountPayableId { get; private set; }
    public Guid? PayingPartnerId { get; private set; }
    public Guid? PartnerReimbursementId { get; private set; }
    public string? DocumentReference { get; private set; }
    public string? ReceiptAttachmentPath { get; private set; }
    public Guid RegisteredByUserId { get; private set; }
    public string? Notes { get; private set; }
    public string? IdempotencyKey { get; private set; }

    private FleetExpense()
    {
        Description = string.Empty;
    }

    public FleetExpense(
        Guid tenantId,
        Guid branchId,
        ExpenseCategory category,
        string description,
        decimal amount,
        DateTime expenseDateUtc,
        PaymentMethodCategory paymentMethod,
        Guid registeredByUserId,
        Guid? vehicleId = null,
        Guid? tripId = null,
        string? supplierName = null,
        Guid? payingPartnerId = null,
        string? documentReference = null,
        string? receiptAttachmentPath = null,
        string? notes = null,
        string? idempotencyKey = null) : base(tenantId)
    {
        if (amount <= 0)
            throw new ArgumentException("O valor da despesa deve ser maior que zero.", nameof(amount));
        if (string.IsNullOrWhiteSpace(description))
            throw new ArgumentException("A descrição da despesa é obrigatória.", nameof(description));
        if (paymentMethod == PaymentMethodCategory.PaidByPartner && !payingPartnerId.HasValue)
            throw new ArgumentException("O sócio pagador deve ser informado para despesas pagas pessoalmente.", nameof(payingPartnerId));

        BranchId = branchId;
        Category = category;
        Description = description.Trim();
        Amount = amount;
        ExpenseDateUtc = expenseDateUtc;
        PaymentMethod = paymentMethod;
        RegisteredByUserId = registeredByUserId;
        VehicleId = vehicleId;
        TripId = tripId;
        SupplierName = supplierName?.Trim();
        PayingPartnerId = payingPartnerId;
        DocumentReference = documentReference?.Trim().ToUpperInvariant();
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
