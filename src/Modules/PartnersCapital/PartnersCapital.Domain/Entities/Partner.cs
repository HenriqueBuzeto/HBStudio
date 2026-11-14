using System;
using BuildingBlocks.Domain;

namespace PartnersCapital.Domain.Entities;

public enum PartnerType
{
    ManagingPartner = 1, // Sócio-Administrador / Executivo
    OperatingPartner = 2, // Sócio Operacional
    SilentPartner = 3,    // Sócio Capitalista / Investidor
    AdvisoryPartner = 4   // Conselheiro / Sócio Estratégico
}

public enum PartnerStatus
{
    Active = 1,
    Suspended = 2,
    Withdrawn = 3 // Retirado / Dissolvido
}

public class Partner : TenantEntity
{
    public Guid PartyId { get; private set; } // Vínculo com Party do MOD-01
    public string Name { get; private set; } = string.Empty;
    public string DocumentNumber { get; private set; } = string.Empty; // CPF/CNPJ
    public string Email { get; private set; } = string.Empty;
    public PartnerType Type { get; private set; }
    public PartnerStatus Status { get; private set; }
    public DateTime AdmissionDate { get; private set; }
    public DateTime? ExitDate { get; private set; }
    public decimal MonthlyCompensationCap { get; private set; } // Teto aprovado para pró-labore
    public string? Notes { get; private set; }

    private Partner() { }

    public Partner(
        Guid tenantId,
        Guid partyId,
        string name,
        string documentNumber,
        string email,
        PartnerType type,
        DateTime admissionDate,
        decimal monthlyCompensationCap = 0,
        string? notes = null) : base(tenantId)
    {
        if (partyId == Guid.Empty) throw new ArgumentException("PartyId is required.", nameof(partyId));
        if (string.IsNullOrWhiteSpace(name)) throw new ArgumentException("Partner name is required.", nameof(name));
        if (string.IsNullOrWhiteSpace(documentNumber)) throw new ArgumentException("Document number is required.", nameof(documentNumber));

        PartyId = partyId;
        Name = name.Trim();
        DocumentNumber = documentNumber.Trim();
        Email = email?.Trim() ?? string.Empty;
        Type = type;
        Status = PartnerStatus.Active;
        AdmissionDate = admissionDate;
        MonthlyCompensationCap = monthlyCompensationCap >= 0 ? monthlyCompensationCap : 0;
        Notes = notes;
    }

    public void UpdateCompensationCap(decimal cap)
    {
        if (cap < 0) throw new ArgumentException("Cap cannot be negative.", nameof(cap));
        MonthlyCompensationCap = cap;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void UpdateStatus(PartnerStatus status, DateTime? exitDate = null)
    {
        Status = status;
        if (status == PartnerStatus.Withdrawn && exitDate.HasValue)
        {
            ExitDate = exitDate;
        }
        UpdatedAtUtc = DateTime.UtcNow;
    }
}
