using CashManagement.Domain;

namespace CashManagement.Application;

#region Terminais

public record CreateCashRegisterDto(
    Guid BranchId,
    string Code,
    string Name,
    string? Notes = null
);

public record UpdateCashRegisterDto(
    string Name,
    CashRegisterStatus Status,
    string? Notes = null
);

public record CashRegisterResponse(
    Guid Id,
    Guid BranchId,
    string Code,
    string Name,
    CashRegisterStatus Status,
    string? Notes,
    DateTime CreatedAtUtc,
    uint Version
);

#endregion

#region Turnos

public record OpenCashShiftDto(
    Guid BranchId,
    Guid CashRegisterId,
    Guid OperatorUserId,
    decimal OpeningFloat,
    string? OpeningSource = null,
    string? OpeningNotes = null,
    string? IdempotencyKey = null
);

public record CashCountItemDto(
    decimal Denomination,
    int Quantity
);

public record SubmitBlindCountDto(
    decimal CountedTotal,
    List<CashCountItemDto>? Denominations,
    string? Notes = null
);

public record ApproveCashClosingDto(
    string? Notes = null
);

public record CashCountDenominationResponse(
    Guid Id,
    decimal Denomination,
    int Quantity,
    decimal TotalAmount
);

public record CashMovementResponse(
    Guid Id,
    Guid BranchId,
    Guid CashRegisterId,
    Guid CashShiftId,
    CashMovementType MovementType,
    CashMovementDirection Direction,
    decimal Amount,
    string SourceType,
    string SourceId,
    string DocumentReference,
    string? Reason,
    Guid CreatedByUserId,
    string? CorrelationId,
    string? IdempotencyKey,
    DateTime CreatedAtUtc
);

public record CashShiftSummaryResponse(
    Guid Id,
    Guid BranchId,
    Guid CashRegisterId,
    string? RegisterCode,
    string? RegisterName,
    Guid OperatorUserId,
    Guid OpenedByUserId,
    DateTime OpenedAtUtc,
    decimal OpeningFloat,
    CashShiftStatus Status,
    decimal CurrentBalance,
    decimal TotalCashIn,
    decimal TotalCashOut,
    DateTime? ClosedAtUtc,
    decimal? ExpectedCashBalance,
    decimal? CountedCashBalance,
    decimal? DiscrepancyAmount,
    CashDiscrepancyType? DiscrepancyType,
    uint Version
);

public record CashShiftDetailResponse(
    Guid Id,
    Guid BranchId,
    Guid CashRegisterId,
    string? RegisterCode,
    string? RegisterName,
    Guid OperatorUserId,
    Guid OpenedByUserId,
    DateTime OpenedAtUtc,
    decimal OpeningFloat,
    string? OpeningSource,
    string? OpeningNotes,
    CashShiftStatus Status,
    decimal CurrentBalance,
    decimal TotalCashIn,
    decimal TotalCashOut,
    DateTime? ClosingStartedAtUtc,
    DateTime? ClosedAtUtc,
    Guid? ClosedByUserId,
    Guid? ApprovedByUserId,
    string? ClosingNotes,
    decimal? ExpectedCashBalance,
    decimal? CountedCashBalance,
    decimal? DiscrepancyAmount,
    CashDiscrepancyType? DiscrepancyType,
    List<CashMovementResponse> Movements,
    List<CashCountDenominationResponse> Denominations,
    uint Version
);

#endregion

#region Sangria, Suprimento e Movimentação

public record CreateCashWithdrawalDto(
    decimal Amount,
    string Reason,
    string DestinationDeclared,
    string? ReceiverName = null,
    string? IdempotencyKey = null
);

public record CreateCashSupplyDto(
    decimal Amount,
    string Reason,
    string OriginDeclared,
    string? IdempotencyKey = null
);

public record RecordCashSaleReceiptDto(
    Guid SaleId,
    Guid SalePaymentIntentId,
    decimal Amount,
    string DocumentReference,
    string? IdempotencyKey = null
);

#endregion

#region Divergências

public record JustifyCashDiscrepancyDto(
    string Justification
);

public record ResolveCashDiscrepancyDto(
    bool Approved,
    string ResolutionNotes
);

public record CashDiscrepancyResponse(
    Guid Id,
    Guid BranchId,
    Guid CashShiftId,
    CashDiscrepancyType DiscrepancyType,
    decimal Amount,
    CashDiscrepancyStatus Status,
    string? OperatorJustification,
    Guid? JustifiedByUserId,
    DateTime? JustifiedAtUtc,
    string? ResolutionNotes,
    Guid? ResolvedByUserId,
    DateTime? ResolvedAtUtc,
    DateTime CreatedAtUtc
);

#endregion
