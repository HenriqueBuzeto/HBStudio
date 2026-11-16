using BuildingBlocks.Domain;

namespace FleetLogistics.Domain.Entities;

public enum PaymentMethodCategory
{
    CompanyPix = 1,          // Pix da conta da empresa (liquidado imediatamente)
    CompanyCash = 2,         // Dinheiro físico do caixa da loja (integrado ao CashManagement)
    CompanyCreditCard = 3,   // Cartão corporativo (fatura do cartão)
    InvoicedPayLater = 4,    // Faturado / Boleto a prazo (gera AccountPayable no Financial)
    PaidByPartner = 5        // Pago pelo Sócio com recurso pessoal (gera obrigação de reembolso societário)
}

public enum FinancialStatus
{
    Settled = 1,             // Pago e liquidado (comprovante anexado)
    PayablePending = 2,      // Título aberto no Contas a Pagar
    ReimbursementPending = 3 // Aguardando reembolso a sócio
}

/// <summary>
/// Registro de abastecimento de combustível (Rápido, R$ 50 sem litros obrigatórios).
/// </summary>
public class FleetFueling : TenantEntity
{
    public Guid BranchId { get; private set; }
    public Guid VehicleId { get; private set; }
    public FleetVehicle? Vehicle { get; private set; }
    public Guid? TripId { get; private set; }
    public FleetTrip? Trip { get; private set; }
    public DateTime FuelingDateUtc { get; private set; }
    public string GasStationName { get; private set; } // Posto / Fornecedor
    public FuelType Fuel { get; private set; }
    public decimal TotalAmount { get; private set; }   // Ex: 50.00
    public decimal? Liters { get; private set; }        // Opcional: pode ser null se o condutor só colocou R$ 50
    public decimal? PricePerLiter { get; private set; } // Calculado se Liters > 0
    public decimal OdometerKm { get; private set; }
    public bool IsFullTank { get; private set; }
    public PaymentMethodCategory PaymentMethod { get; private set; }
    public FinancialStatus FinancialStatus { get; private set; }
    public Guid? FinancialAccountId { get; private set; }
    public Guid? AccountPayableId { get; private set; }  // FK no Financial se faturado
    public Guid? PartnerReimbursementId { get; private set; } // FK no PartnersCapital se pago pelo sócio
    public Guid? PayingPartnerId { get; private set; }
    public string? ReceiptDocumentReference { get; private set; } // Número da nota / cupom fiscal
    public string? ReceiptAttachmentPath { get; private set; }
    public Guid RegisteredByUserId { get; private set; }
    public string? Notes { get; private set; }
    public string? IdempotencyKey { get; private set; }

    private FleetFueling()
    {
        GasStationName = string.Empty;
    }

    public FleetFueling(
        Guid tenantId,
        Guid branchId,
        Guid vehicleId,
        DateTime fuelingDateUtc,
        string gasStationName,
        FuelType fuel,
        decimal totalAmount,
        decimal odometerKm,
        PaymentMethodCategory paymentMethod,
        Guid registeredByUserId,
        decimal? liters = null,
        bool isFullTank = false,
        Guid? tripId = null,
        Guid? payingPartnerId = null,
        string? receiptDocumentReference = null,
        string? receiptAttachmentPath = null,
        string? notes = null,
        string? idempotencyKey = null) : base(tenantId)
    {
        if (vehicleId == Guid.Empty)
            throw new ArgumentException("Veículo é obrigatório.", nameof(vehicleId));
        if (totalAmount <= 0)
            throw new ArgumentException("O valor total do abastecimento deve ser maior que zero.", nameof(totalAmount));
        if (odometerKm < 0)
            throw new ArgumentException("Hodômetro no abastecimento não pode ser negativo.", nameof(odometerKm));
        if (string.IsNullOrWhiteSpace(gasStationName))
            throw new ArgumentException("Nome do posto/fornecedor é obrigatório.", nameof(gasStationName));
        if (paymentMethod == PaymentMethodCategory.PaidByPartner && !payingPartnerId.HasValue)
            throw new ArgumentException("O sócio pagador deve ser informado para pagamentos particulares.", nameof(payingPartnerId));

        BranchId = branchId;
        VehicleId = vehicleId;
        TripId = tripId;
        FuelingDateUtc = fuelingDateUtc;
        GasStationName = gasStationName.Trim();
        Fuel = fuel;
        TotalAmount = totalAmount;
        OdometerKm = odometerKm;
        PaymentMethod = paymentMethod;
        RegisteredByUserId = registeredByUserId;
        IsFullTank = isFullTank;
        PayingPartnerId = payingPartnerId;
        ReceiptDocumentReference = receiptDocumentReference?.Trim().ToUpperInvariant();
        ReceiptAttachmentPath = receiptAttachmentPath?.Trim();
        Notes = notes?.Trim();
        IdempotencyKey = idempotencyKey?.Trim();

        if (liters.HasValue && liters.Value > 0)
        {
            Liters = liters.Value;
            PricePerLiter = Math.Round(totalAmount / liters.Value, 4);
        }

        // Define status financeiro inicial conforme meio
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
