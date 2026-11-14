using System;
using System.Collections.Generic;
using PartnersCapital.Domain.Entities;

namespace PartnersCapital.Application.DTOs;

public record CreatePartnerRequest(
    Guid PartyId,
    string Name,
    string DocumentNumber,
    string Email,
    PartnerType Type,
    DateTime AdmissionDate,
    decimal MonthlyCompensationCap = 0,
    string? Notes = null
);

public record UpdateCapTableEntry(
    Guid PartnerId,
    decimal Quotas,
    decimal Percentage,
    decimal NominalValuePerQuota,
    DateTime EffectiveDate,
    string LegalDocumentReference
);

public record UpdateCapTableRequest(
    List<UpdateCapTableEntry> Entries,
    DateTime EffectiveDate,
    string LegalDocumentReference
);

public record RegisterContributionRequest(
    Guid PartnerId,
    ContributionType Type,
    decimal Amount,
    DateTime SubscriptionDate,
    string Description,
    string FormalInstrumentReference,
    Guid? BankAccountId = null
);

public record PayInContributionRequest(
    DateTime PaidInDate,
    Guid? BankAccountId = null
);

public record RegisterLoanRequest(
    Guid PartnerId,
    LoanDirection Direction,
    decimal PrincipalAmount,
    decimal AnnualInterestRate,
    DateTime IssueDate,
    DateTime DueDate,
    string ContractNumber,
    string Notes = "",
    Guid? BankAccountId = null
);

public record AmortizeLoanRequest(
    decimal Amount,
    DateTime PaymentDate,
    Guid? BankAccountId = null
);

public record ScheduleCompensationRequest(
    Guid PartnerId,
    int ReferenceYear,
    int ReferenceMonth,
    decimal GrossAmount,
    decimal InssWithholding,
    decimal IrrfWithholding,
    DateTime ScheduledPaymentDate,
    string Notes = ""
);

public record CreateDistributionProposalRequest(
    string ProtocolNumber,
    int FiscalYear,
    int? FiscalQuarter,
    decimal BaseNetProfit,
    decimal LegalReserveRetention,
    decimal WorkingCapitalRetention,
    DateTime DeliberationDate,
    string MeetingMinutesReference = "",
    string Notes = ""
);

public record ProposeDistributionItemRequest(
    Guid PartnerId,
    decimal Amount,
    decimal? CustomWithholding = null
);

public record SettleDistributionItemRequest(
    DateTime PaymentDate,
    Guid BankAccountId
);

public record PartnerSummaryDto(
    Guid Id,
    Guid PartyId,
    string Name,
    string DocumentNumber,
    string Email,
    string Type,
    string Status,
    DateTime AdmissionDate,
    decimal CurrentQuotas,
    decimal CurrentPercentage,
    decimal TotalContributionsPaidIn,
    decimal OutstandingLoanBalance,
    decimal MonthlyCompensationCap
);

public record CapTableSummaryDto(
    decimal TotalQuotas,
    decimal TotalNominalCapital,
    List<CapTablePartnerDto> Partners
);

public record CapTablePartnerDto(
    Guid PartnerId,
    string PartnerName,
    decimal Quotas,
    decimal Percentage,
    decimal NominalValue
);

public record LiquiditySimulationResultDto(
    decimal AvailableBankBalance,
    decimal PendingShortTermPayables,
    decimal MinimumOperatingReserve,
    decimal NetLiquidSurplus,
    decimal DistributableCap,
    bool IsSufficientForDistribution,
    string Assessment
);
