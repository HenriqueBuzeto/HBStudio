using System;
using BuildingBlocks.Domain;

namespace PartnersCapital.Domain.Entities;

public class EquityParticipation : TenantEntity
{
    public Guid PartnerId { get; private set; }
    public decimal Quotas { get; private set; } // Quantidade nominal de quotas
    public decimal Percentage { get; private set; } // Participação percentual (ex: 40.00 para 40%)
    public decimal NominalValuePerQuota { get; private set; } // Valor nominal por quota (ex: R$ 1,00)
    public decimal TotalNominalValue => Quotas * NominalValuePerQuota;
    public DateTime EffectiveDate { get; private set; }
    public DateTime? ExpirationDate { get; private set; }
    public bool IsCurrent { get; private set; }
    public string LegalDocumentReference { get; private set; } = string.Empty; // Alteração Contratual / Ata

    private EquityParticipation() { }

    public EquityParticipation(
        Guid tenantId,
        Guid partnerId,
        decimal quotas,
        decimal percentage,
        decimal nominalValuePerQuota,
        DateTime effectiveDate,
        string legalDocumentReference) : base(tenantId)
    {
        if (partnerId == Guid.Empty) throw new ArgumentException("PartnerId is required.", nameof(partnerId));
        if (quotas <= 0) throw new ArgumentException("Quotas must be greater than zero.", nameof(quotas));
        if (percentage <= 0 || percentage > 100) throw new ArgumentOutOfRangeException(nameof(percentage), "Percentage must be between 0 and 100.");
        if (nominalValuePerQuota <= 0) throw new ArgumentException("Nominal value per quota must be greater than zero.", nameof(nominalValuePerQuota));

        PartnerId = partnerId;
        Quotas = quotas;
        Percentage = percentage;
        NominalValuePerQuota = nominalValuePerQuota;
        EffectiveDate = effectiveDate;
        IsCurrent = true;
        LegalDocumentReference = legalDocumentReference?.Trim() ?? string.Empty;
    }

    public void Supersede(DateTime expirationDate)
    {
        IsCurrent = false;
        ExpirationDate = expirationDate;
        UpdatedAtUtc = DateTime.UtcNow;
    }
}
