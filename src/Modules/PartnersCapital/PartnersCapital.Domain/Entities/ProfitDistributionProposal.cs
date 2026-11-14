using System;
using System.Collections.Generic;
using BuildingBlocks.Domain;

namespace PartnersCapital.Domain.Entities;

public enum DistributionStatus
{
    Draft = 1,              // Em elaboração
    UnderDeliberation = 2,  // Submetido aos sócios para aprovação
    Approved = 3,           // Homologado em Ata/Reunião de Sócios
    Rejected = 4,           // Rejeitado pela Governança
    PartiallyPaid = 5,
    FullySettled = 6,
    Cancelled = 7
}

public class ProfitDistributionProposal : TenantEntity
{
    public string ProtocolNumber { get; private set; } = string.Empty;
    public int FiscalYear { get; private set; }
    public int? FiscalQuarter { get; private set; }
    public decimal BaseNetProfit { get; private set; } // Lucro Líquido apurado pela DRE contábil
    public decimal LegalReserveRetention { get; private set; } // Retenção para reserva legal (ex: 5%)
    public decimal WorkingCapitalRetention { get; private set; } // Retenção prudencial de capital de giro
    public decimal DistributableAmount => Math.Max(0, BaseNetProfit - LegalReserveRetention - WorkingCapitalRetention);
    public decimal TotalDistributedAmount { get; private set; }
    public DistributionStatus Status { get; private set; }
    public DateTime DeliberationDate { get; private set; }
    public string MeetingMinutesReference { get; private set; } = string.Empty;
    public string Notes { get; private set; } = string.Empty;

    private readonly List<ProfitDistributionItem> _items = new();
    public IReadOnlyCollection<ProfitDistributionItem> Items => _items.AsReadOnly();

    private ProfitDistributionProposal() { }

    public ProfitDistributionProposal(
        Guid tenantId,
        string protocolNumber,
        int fiscalYear,
        int? fiscalQuarter,
        decimal baseNetProfit,
        decimal legalReserveRetention,
        decimal workingCapitalRetention,
        DateTime deliberationDate,
        string meetingMinutesReference = "",
        string notes = "") : base(tenantId)
    {
        if (string.IsNullOrWhiteSpace(protocolNumber)) throw new ArgumentException("Protocol number is required.", nameof(protocolNumber));
        if (baseNetProfit <= 0) throw new ArgumentOutOfRangeException(nameof(baseNetProfit), "Base profit must be positive for profit distribution.");

        ProtocolNumber = protocolNumber.Trim();
        FiscalYear = fiscalYear;
        FiscalQuarter = fiscalQuarter;
        BaseNetProfit = baseNetProfit;
        LegalReserveRetention = Math.Max(0, legalReserveRetention);
        WorkingCapitalRetention = Math.Max(0, workingCapitalRetention);
        Status = DistributionStatus.Draft;
        DeliberationDate = deliberationDate;
        MeetingMinutesReference = meetingMinutesReference?.Trim() ?? string.Empty;
        Notes = notes?.Trim() ?? string.Empty;
    }

    public void AddItem(Guid partnerId, decimal partnerPercentage, decimal amount, decimal? customWithholding = null)
    {
        if (Status != DistributionStatus.Draft && Status != DistributionStatus.UnderDeliberation)
            throw new InvalidOperationException("Cannot add items to an approved or finalized proposal.");

        if (TotalDistributedAmount + amount > DistributableAmount)
            throw new InvalidOperationException($"Total distributed amount ({TotalDistributedAmount + amount}) cannot exceed distributable ceiling ({DistributableAmount}).");

        var item = new ProfitDistributionItem(Id, TenantId, partnerId, partnerPercentage, amount, customWithholding ?? 0);
        _items.Add(item);
        TotalDistributedAmount += amount;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void SubmitForApproval()
    {
        if (Status != DistributionStatus.Draft)
            throw new InvalidOperationException("Only draft proposals can be submitted for approval.");
        if (_items.Count == 0)
            throw new InvalidOperationException("Cannot submit a proposal with zero distribution items.");

        Status = DistributionStatus.UnderDeliberation;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void Approve(string meetingMinutes)
    {
        if (Status != DistributionStatus.UnderDeliberation && Status != DistributionStatus.Draft)
            throw new InvalidOperationException("Proposal must be under deliberation or draft to be approved.");

        Status = DistributionStatus.Approved;
        MeetingMinutesReference = meetingMinutes.Trim();
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void MarkSettled()
    {
        Status = DistributionStatus.FullySettled;
        UpdatedAtUtc = DateTime.UtcNow;
    }
}

public class ProfitDistributionItem : TenantEntity
{
    public Guid ProposalId { get; private set; }
    public Guid PartnerId { get; private set; }
    public decimal PartnerPercentage { get; private set; }
    public decimal GrossAmount { get; private set; }
    public decimal TaxWithheld { get; private set; } // Isento de IRRF no Brasil atual, mas preparado para retenções se aplicável
    public decimal NetAmount => GrossAmount - TaxWithheld;
    public bool IsPaid { get; private set; }
    public DateTime? PaidDate { get; private set; }
    public Guid? BankAccountId { get; private set; }
    public Guid? JournalEntryId { get; private set; } // Lançamento contábil no MOD-12

    private ProfitDistributionItem() { }

    public ProfitDistributionItem(
        Guid proposalId,
        Guid tenantId,
        Guid partnerId,
        decimal partnerPercentage,
        decimal grossAmount,
        decimal taxWithheld = 0) : base(tenantId)
    {
        ProposalId = proposalId;
        PartnerId = partnerId;
        PartnerPercentage = partnerPercentage;
        GrossAmount = grossAmount;
        TaxWithheld = taxWithheld;
        IsPaid = false;
    }

    public void MarkPaid(DateTime paidDate, Guid? bankAccountId, Guid? journalEntryId)
    {
        IsPaid = true;
        PaidDate = paidDate;
        BankAccountId = bankAccountId;
        JournalEntryId = journalEntryId;
        UpdatedAtUtc = DateTime.UtcNow;
    }
}
