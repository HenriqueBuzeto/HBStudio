using Financial.Domain;

namespace Financial.Application;

#region Contas Bancárias & Plano de Contas

public record CreateFinancialAccountDto(
    string Code,
    string Name,
    FinancialAccountType Type,
    Guid? ParentAccountId = null
);

public record FinancialAccountResponse(
    Guid Id,
    string Code,
    string Name,
    FinancialAccountType Type,
    Guid? ParentAccountId,
    bool IsActive
);

public record CreateBankAccountDto(
    Guid BranchId,
    string BankName,
    string? AgencyNumber,
    string AccountNumber,
    BankAccountType Type,
    decimal InitialBalance = 0
);

public record BankAccountResponse(
    Guid Id,
    Guid BranchId,
    string BankName,
    string? AgencyNumber,
    string AccountNumber,
    BankAccountType Type,
    decimal CurrentBalance,
    decimal ReconciledBalance,
    bool IsActive,
    uint Version
);

public record CreateCostCenterDto(
    string Code,
    string Name,
    string? Description = null
);

public record FinancialCostCenterResponse(
    Guid Id,
    string Code,
    string Name,
    string? Description,
    bool IsActive
);

#endregion

#region Contas a Pagar & Receber

public record CreateAccountPayableDto(
    Guid BranchId,
    Guid? SupplierPartyId,
    string TitleNumber,
    string Description,
    DateTime IssueDateUtc,
    DateTime DueDateUtc,
    decimal OriginalAmount,
    Guid? CostCenterId = null,
    string? DocumentReference = null,
    Guid? PurchaseOrderId = null
);

public record PayTitleDto(
    decimal Amount,
    Guid BankAccountId,
    string? Reference = null
);

public record AccountPayableResponse(
    Guid Id,
    Guid BranchId,
    Guid? SupplierPartyId,
    string? SupplierName,
    string TitleNumber,
    string Description,
    Guid? FinancialCostCenterId,
    DateTime IssueDateUtc,
    DateTime DueDateUtc,
    decimal OriginalAmount,
    decimal PaidAmount,
    decimal BalanceRemaining,
    PayableStatus Status,
    string? DocumentReference,
    Guid? PurchaseOrderId,
    DateTime CreatedAtUtc,
    uint Version
);

public record CreateAccountReceivableDto(
    Guid BranchId,
    Guid? CustomerPartyId,
    string TitleNumber,
    string Description,
    DateTime IssueDateUtc,
    DateTime DueDateUtc,
    decimal OriginalAmount,
    Guid? CostCenterId = null,
    string? DocumentReference = null,
    Guid? SaleId = null
);

public record ReceiveTitleDto(
    decimal Amount,
    Guid BankAccountId,
    string? Reference = null
);

public record AccountReceivableResponse(
    Guid Id,
    Guid BranchId,
    Guid? CustomerPartyId,
    string? CustomerName,
    string TitleNumber,
    string Description,
    Guid? FinancialCostCenterId,
    DateTime IssueDateUtc,
    DateTime DueDateUtc,
    decimal OriginalAmount,
    decimal ReceivedAmount,
    decimal BalanceRemaining,
    ReceivableStatus Status,
    string? DocumentReference,
    Guid? SaleId,
    DateTime CreatedAtUtc,
    uint Version
);

#endregion

#region Razão Contábil / Journal Entry

public record CreateJournalLineDto(
    Guid AccountId,
    JournalLineDirection Direction,
    decimal Amount,
    Guid? CostCenterId = null,
    string? Memo = null
);

public record CreateJournalEntryDto(
    Guid BranchId,
    DateTime CompetenceDateUtc,
    string DocumentNumber,
    string SourceType,
    string SourceId,
    string Description,
    List<CreateJournalLineDto> Lines,
    string? CorrelationId = null,
    string? IdempotencyKey = null
);

public record FinancialJournalLineResponse(
    Guid Id,
    Guid FinancialAccountId,
    string? AccountCode,
    string? AccountName,
    JournalLineDirection Direction,
    decimal Amount,
    Guid? FinancialCostCenterId,
    string? Memo
);

public record FinancialJournalEntryResponse(
    Guid Id,
    Guid BranchId,
    DateTime CompetenceDateUtc,
    string DocumentNumber,
    string SourceType,
    string SourceId,
    string Description,
    decimal TotalAmount,
    List<FinancialJournalLineResponse> Lines,
    DateTime CreatedAtUtc,
    uint Version
);

#endregion

#region Conciliação Bancária & Extratos

public record ImportBankTransactionDto(
    DateTime TransactionDateUtc,
    decimal Amount,
    string FitId,
    string Memo
);

public record ImportBankStatementDto(
    Guid BankAccountId,
    List<ImportBankTransactionDto> Transactions
);

public record BankTransactionResponse(
    Guid Id,
    Guid BankAccountId,
    DateTime TransactionDateUtc,
    decimal Amount,
    string FitId,
    string Memo,
    ReconciliationStatus Status,
    Guid? MatchedJournalEntryId,
    DateTime? ReconciledAtUtc
);

public record ReconcileTransactionDto(
    Guid JournalEntryId
);

#endregion

#region DRE & Fluxo de Caixa

public record DreReportResponse(
    DateTime StartDateUtc,
    DateTime EndDateUtc,
    decimal GrossRevenue,
    decimal Deductions,
    decimal NetRevenue,
    decimal CmvAndServiceCosts,
    decimal GrossProfit,
    decimal GrossMarginPercent,
    decimal OperatingExpenses,
    decimal OperatingResult,
    decimal NetResult,
    decimal NetMarginPercent,
    List<DreCostCenterBreakdown> CostCenterBreakdowns
);

public record DreCostCenterBreakdown(
    Guid? CostCenterId,
    string CostCenterName,
    decimal Revenue,
    decimal CostAndExpense,
    decimal ContributionResult
);

public record CashFlowForecastResponse(
    DateTime ReferenceDateUtc,
    decimal CurrentLiquidBalance,
    decimal TotalReceivablesNext30Days,
    decimal TotalPayablesNext30Days,
    decimal ProjectedBalanceNext30Days,
    decimal WorkingCapitalRequirementEstimate
);

#endregion
