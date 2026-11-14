using System;
using PartnersCapital.Domain.Entities;

namespace PartnersCapital.Application.DTOs;

public record PartnerResponse(
    Guid Id,
    Guid TenantId,
    Guid PartyId,
    string Name,
    string DocumentNumber,
    string Email,
    PartnerType Type,
    PartnerStatus Status,
    DateTime AdmissionDate,
    DateTime? ExitDate,
    decimal MonthlyCompensationCap,
    string? Notes
);

public record CapitalContributionResponse(
    Guid Id,
    Guid TenantId,
    Guid PartnerId,
    ContributionType Type,
    ContributionStatus Status,
    decimal Amount,
    DateTime SubscriptionDate,
    DateTime? PaidInDate,
    Guid? BankAccountId,
    Guid? FinancialJournalEntryId,
    string Description,
    string FormalInstrumentReference
);

public record PartnerLoanResponse(
    Guid Id,
    Guid TenantId,
    Guid PartnerId,
    LoanDirection Direction,
    LoanStatus Status,
    decimal PrincipalAmount,
    decimal AmortizedAmount,
    decimal OutstandingBalance,
    decimal AnnualInterestRate,
    DateTime IssueDate,
    DateTime DueDate,
    string ContractNumber,
    string Notes,
    Guid? BankAccountId,
    Guid? DisbursementJournalEntryId
);

public record PartnerCompensationResponse(
    Guid Id,
    Guid TenantId,
    Guid PartnerId,
    int ReferenceYear,
    int ReferenceMonth,
    decimal GrossAmount,
    decimal InssWithholding,
    decimal IrrfWithholding,
    decimal NetAmount,
    CompensationStatus Status,
    DateTime ScheduledPaymentDate,
    DateTime? PaidDate,
    Guid? AccountPayableId,
    Guid? BankAccountId,
    string Notes
);

public record ProfitDistributionItemResponse(
    Guid Id,
    Guid ProposalId,
    Guid TenantId,
    Guid PartnerId,
    decimal PartnerPercentage,
    decimal GrossAmount,
    decimal TaxWithheld,
    decimal NetAmount,
    bool IsPaid,
    DateTime? PaidDate,
    Guid? BankAccountId,
    Guid? JournalEntryId
);

public record ProfitDistributionProposalResponse(
    Guid Id,
    Guid TenantId,
    string ProtocolNumber,
    int FiscalYear,
    int? FiscalQuarter,
    decimal BaseNetProfit,
    decimal LegalReserveRetention,
    decimal WorkingCapitalRetention,
    decimal DistributableAmount,
    decimal TotalDistributedAmount,
    DistributionStatus Status,
    DateTime DeliberationDate,
    string MeetingMinutesReference,
    string Notes,
    List<ProfitDistributionItemResponse> Items
);
