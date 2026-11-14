using System;
using BuildingBlocks.Domain;

namespace PartnersCapital.Domain.Entities;

public enum CompensationStatus
{
    Scheduled = 1,
    Approved = 2,
    Paid = 3,
    Cancelled = 4
}

public class PartnerCompensation : TenantEntity
{
    public Guid PartnerId { get; private set; }
    public int ReferenceYear { get; private set; }
    public int ReferenceMonth { get; private set; }
    public decimal GrossAmount { get; private set; } // Valor Bruto
    public decimal InssWithholding { get; private set; } // Retenção INSS
    public decimal IrrfWithholding { get; private set; } // Retenção IRRF
    public decimal NetAmount => GrossAmount - InssWithholding - IrrfWithholding; // Valor Líquido a Pagar
    public CompensationStatus Status { get; private set; }
    public DateTime ScheduledPaymentDate { get; private set; }
    public DateTime? PaidDate { get; private set; }
    public Guid? AccountPayableId { get; private set; } // Título no Contas a Pagar do MOD-12
    public Guid? BankAccountId { get; private set; }
    public string Notes { get; private set; } = string.Empty;

    private PartnerCompensation() { }

    public PartnerCompensation(
        Guid tenantId,
        Guid partnerId,
        int referenceYear,
        int referenceMonth,
        decimal grossAmount,
        decimal inssWithholding,
        decimal irrfWithholding,
        DateTime scheduledPaymentDate,
        string notes = "",
        Guid? accountPayableId = null) : base(tenantId)
    {
        if (partnerId == Guid.Empty) throw new ArgumentException("PartnerId is required.", nameof(partnerId));
        if (referenceMonth < 1 || referenceMonth > 12) throw new ArgumentOutOfRangeException(nameof(referenceMonth));
        if (grossAmount <= 0) throw new ArgumentOutOfRangeException(nameof(grossAmount), "Gross amount must be positive.");

        PartnerId = partnerId;
        ReferenceYear = referenceYear;
        ReferenceMonth = referenceMonth;
        GrossAmount = grossAmount;
        InssWithholding = inssWithholding >= 0 ? inssWithholding : 0;
        IrrfWithholding = irrfWithholding >= 0 ? irrfWithholding : 0;
        Status = CompensationStatus.Scheduled;
        ScheduledPaymentDate = scheduledPaymentDate;
        Notes = notes?.Trim() ?? string.Empty;
        AccountPayableId = accountPayableId;
    }

    public void Approve()
    {
        if (Status != CompensationStatus.Scheduled)
            throw new InvalidOperationException($"Cannot approve compensation in status {Status}.");
        Status = CompensationStatus.Approved;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void MarkPaid(DateTime paidDate, Guid? bankAccountId = null)
    {
        if (Status == CompensationStatus.Cancelled)
            throw new InvalidOperationException("Cannot pay a cancelled compensation.");
        Status = CompensationStatus.Paid;
        PaidDate = paidDate;
        if (bankAccountId.HasValue) BankAccountId = bankAccountId;
        UpdatedAtUtc = DateTime.UtcNow;
    }
}
