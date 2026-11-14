using System;
using BuildingBlocks.Domain;

namespace PartnersCapital.Domain.Entities;

public enum LoanDirection
{
    PartnerToCompany = 1, // Mútuo de sócio para a empresa (Passivo da empresa)
    CompanyToPartner = 2  // Adiantamento/Mútuo da empresa para o sócio (Ativo da empresa)
}

public enum LoanStatus
{
    Active = 1,
    PartiallyAmortized = 2,
    Settled = 3,
    Cancelled = 4
}

public class PartnerLoan : TenantEntity
{
    public Guid PartnerId { get; private set; }
    public LoanDirection Direction { get; private set; }
    public LoanStatus Status { get; private set; }
    public decimal PrincipalAmount { get; private set; }
    public decimal AmortizedAmount { get; private set; }
    public decimal OutstandingBalance => PrincipalAmount - AmortizedAmount;
    public decimal AnnualInterestRate { get; private set; } // Taxa de juros anual acordada (ex: Selic ou fixa)
    public DateTime IssueDate { get; private set; }
    public DateTime DueDate { get; private set; }
    public string ContractNumber { get; private set; } = string.Empty;
    public string Notes { get; private set; } = string.Empty;
    public Guid? BankAccountId { get; private set; } // Conta movimentada no desembolso
    public Guid? DisbursementJournalEntryId { get; private set; }

    private PartnerLoan() { }

    public PartnerLoan(
        Guid tenantId,
        Guid partnerId,
        LoanDirection direction,
        decimal principalAmount,
        decimal annualInterestRate,
        DateTime issueDate,
        DateTime dueDate,
        string contractNumber,
        string notes = "",
        Guid? bankAccountId = null,
        Guid? disbursementJournalEntryId = null) : base(tenantId)
    {
        if (partnerId == Guid.Empty) throw new ArgumentException("PartnerId is required.", nameof(partnerId));
        if (principalAmount <= 0) throw new ArgumentOutOfRangeException(nameof(principalAmount), "Principal amount must be greater than zero.");
        if (dueDate < issueDate) throw new ArgumentException("Due date cannot precede issue date.", nameof(dueDate));

        PartnerId = partnerId;
        Direction = direction;
        Status = LoanStatus.Active;
        PrincipalAmount = principalAmount;
        AmortizedAmount = 0;
        AnnualInterestRate = annualInterestRate >= 0 ? annualInterestRate : 0;
        IssueDate = issueDate;
        DueDate = dueDate;
        ContractNumber = contractNumber?.Trim() ?? string.Empty;
        Notes = notes?.Trim() ?? string.Empty;
        BankAccountId = bankAccountId;
        DisbursementJournalEntryId = disbursementJournalEntryId;
    }

    public void Amortize(decimal amount)
    {
        if (amount <= 0) throw new ArgumentOutOfRangeException(nameof(amount), "Amortization amount must be greater than zero.");
        if (amount > OutstandingBalance) throw new InvalidOperationException($"Amortization of {amount} exceeds outstanding balance {OutstandingBalance}.");

        AmortizedAmount += amount;
        Status = OutstandingBalance == 0 ? LoanStatus.Settled : LoanStatus.PartiallyAmortized;
        UpdatedAtUtc = DateTime.UtcNow;
    }
}
