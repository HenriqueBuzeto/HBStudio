using System;
using BuildingBlocks.Domain;

namespace PartnersCapital.Domain.Entities;

public enum ContributionType
{
    Cash = 1,       // Aporte em dinheiro (depósito bancário / pix)
    Asset = 2,      // Integralização em bens (equipamentos, imóveis, veículos)
    Intangible = 3  // Bens incorpóreos / direitos avaliados formalmente
}

public enum ContributionStatus
{
    Subscribed = 1, // Subscrito (prometido a integralizar)
    PaidIn = 2,     // Integralizado (efetivamente aportado)
    Cancelled = 3
}

public class CapitalContribution : TenantEntity
{
    public Guid PartnerId { get; private set; }
    public ContributionType Type { get; private set; }
    public ContributionStatus Status { get; private set; }
    public decimal Amount { get; private set; }
    public DateTime SubscriptionDate { get; private set; }
    public DateTime? PaidInDate { get; private set; }
    public Guid? BankAccountId { get; private set; } // Onde o dinheiro foi depositado (no MOD-12)
    public Guid? FinancialJournalEntryId { get; private set; } // Partida dobrada escriturada
    public string Description { get; private set; } = string.Empty;
    public string FormalInstrumentReference { get; private set; } = string.Empty; // Registro Junta Comercial / Contrato Social

    private CapitalContribution() { }

    public CapitalContribution(
        Guid tenantId,
        Guid partnerId,
        ContributionType type,
        decimal amount,
        DateTime subscriptionDate,
        string description,
        string formalInstrumentReference,
        Guid? bankAccountId = null) : base(tenantId)
    {
        if (partnerId == Guid.Empty) throw new ArgumentException("PartnerId is required.", nameof(partnerId));
        if (amount <= 0) throw new ArgumentOutOfRangeException(nameof(amount), "Contribution amount must be greater than zero.");

        PartnerId = partnerId;
        Type = type;
        Status = ContributionStatus.Subscribed;
        Amount = amount;
        SubscriptionDate = subscriptionDate;
        Description = description?.Trim() ?? string.Empty;
        FormalInstrumentReference = formalInstrumentReference?.Trim() ?? string.Empty;
        BankAccountId = bankAccountId;
    }

    public void MarkPaidIn(DateTime paidInDate, Guid? journalEntryId, Guid? bankAccountId = null)
    {
        if (Status == ContributionStatus.PaidIn)
            throw new InvalidOperationException("Contribution is already paid in.");

        Status = ContributionStatus.PaidIn;
        PaidInDate = paidInDate;
        FinancialJournalEntryId = journalEntryId;
        if (bankAccountId.HasValue) BankAccountId = bankAccountId;
        UpdatedAtUtc = DateTime.UtcNow;
    }
}
