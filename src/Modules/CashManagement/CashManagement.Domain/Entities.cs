using BuildingBlocks.Domain;

namespace CashManagement.Domain;

public enum CashRegisterStatus
{
    Active = 1,
    Inactive = 2,
    Maintenance = 3
}

public enum CashShiftStatus
{
    Open = 1,
    Closing = 2,
    CountSubmitted = 3,
    Approved = 4,
    Closed = 5
}

public enum CashMovementType
{
    OpeningFloat = 1,
    CashSaleReceipt = 2,
    CashRefund = 3,
    CashSupply = 4,
    CashWithdrawal = 5,
    CashHandover = 6,
    CashAdjustment = 7,
    Reversal = 8
}

public enum CashMovementDirection
{
    In = 1,
    Out = 2
}

public enum CashDiscrepancyType
{
    Surplus = 1, // Sobra
    Shortage = 2 // Falta
}

public enum CashDiscrepancyStatus
{
    Pending = 1,
    Justified = 2,
    Approved = 3,
    Rejected = 4
}

/// <summary>
/// Terminal Físico de Caixa (PDV Balcão).
/// </summary>
public class CashRegister : TenantEntity
{
    public Guid BranchId { get; private set; }
    public string Code { get; private set; }
    public string Name { get; private set; }
    public CashRegisterStatus Status { get; private set; }
    public string? Notes { get; private set; }

    private CashRegister() { }

    public CashRegister(Guid tenantId, Guid branchId, string code, string name, string? notes = null)
    {
        TenantId = tenantId;
        BranchId = branchId;
        Code = code.Trim().ToUpperInvariant();
        Name = name.Trim();
        Status = CashRegisterStatus.Active;
        Notes = notes?.Trim();
    }

    public void Update(string name, CashRegisterStatus status, string? notes)
    {
        Name = name.Trim();
        Status = status;
        Notes = notes?.Trim();
    }
}

/// <summary>
/// Turno de Caixa aberto por um operador para um terminal físico.
/// </summary>
public class CashShift : TenantEntity
{
    public Guid BranchId { get; private set; }
    public Guid CashRegisterId { get; private set; }
    public Guid OperatorUserId { get; private set; }
    public Guid OpenedByUserId { get; private set; }
    public DateTime OpenedAtUtc { get; private set; }
    public decimal OpeningFloat { get; private set; }
    public string? OpeningSource { get; private set; }
    public string? OpeningNotes { get; private set; }

    public CashShiftStatus Status { get; private set; }

    // Saldo Físico Materializado de Dinheiro (gaveta)
    public decimal CurrentBalance { get; private set; }
    public decimal TotalCashIn { get; private set; }
    public decimal TotalCashOut { get; private set; }

    // Fechamento
    public DateTime? ClosingStartedAtUtc { get; private set; }
    public DateTime? ClosedAtUtc { get; private set; }
    public Guid? ClosedByUserId { get; private set; }
    public Guid? ApprovedByUserId { get; private set; }
    public string? ClosingNotes { get; private set; }

    // Valores da contagem e apuração
    public decimal? ExpectedCashBalance { get; private set; }
    public decimal? CountedCashBalance { get; private set; }
    public decimal? DiscrepancyAmount { get; private set; }
    public CashDiscrepancyType? DiscrepancyType { get; private set; }

    private readonly List<CashMovement> _movements = new();
    public IReadOnlyCollection<CashMovement> Movements => _movements.AsReadOnly();

    private readonly List<CashCountDenomination> _denominations = new();
    public IReadOnlyCollection<CashCountDenomination> Denominations => _denominations.AsReadOnly();

    private CashShift() { }

    public CashShift(
        Guid tenantId,
        Guid branchId,
        Guid cashRegisterId,
        Guid operatorUserId,
        Guid openedByUserId,
        decimal openingFloat,
        string? openingSource = null,
        string? openingNotes = null)
    {
        if (openingFloat < 0)
            throw new ArgumentException("O fundo inicial de caixa não pode ser negativo.", nameof(openingFloat));

        TenantId = tenantId;
        BranchId = branchId;
        CashRegisterId = cashRegisterId;
        OperatorUserId = operatorUserId;
        OpenedByUserId = openedByUserId;
        OpenedAtUtc = DateTime.UtcNow;
        OpeningFloat = openingFloat;
        OpeningSource = openingSource?.Trim();
        OpeningNotes = openingNotes?.Trim();

        Status = CashShiftStatus.Open;
        CurrentBalance = openingFloat;
        TotalCashIn = openingFloat;
        TotalCashOut = 0;

        // Registrar o movimento inicial de abertura
        var openingMovement = new CashMovement(
            tenantId,
            branchId,
            cashRegisterId,
            Id,
            CashMovementType.OpeningFloat,
            CashMovementDirection.In,
            openingFloat,
            sourceType: "OPENING",
            sourceId: Id.ToString(),
            documentReference: "ABERTURA",
            reason: $"Fundo inicial de caixa. Origem: {openingSource ?? "Cofre"}",
            openedByUserId
        );
        _movements.Add(openingMovement);
    }

    public CashMovement AddMovement(
        CashMovementType type,
        CashMovementDirection direction,
        decimal amount,
        string sourceType,
        string sourceId,
        string documentReference,
        string? reason,
        Guid createdByUserId,
        string? correlationId = null,
        string? idempotencyKey = null)
    {
        if (Status != CashShiftStatus.Open)
            throw new InvalidOperationException($"Não é possível realizar movimentações em turno com situação {Status}.");

        if (amount <= 0)
            throw new ArgumentException("O valor da movimentação de caixa deve ser maior que zero.", nameof(amount));

        if (direction == CashMovementDirection.Out && CurrentBalance < amount)
        {
            throw new InvalidOperationException($"Saldo físico em caixa insuficiente. Saldo atual: {CurrentBalance:C2}, Tentativa de saída: {amount:C2}.");
        }

        var movement = new CashMovement(
            TenantId,
            BranchId,
            CashRegisterId,
            Id,
            type,
            direction,
            amount,
            sourceType,
            sourceId,
            documentReference,
            reason,
            createdByUserId,
            correlationId,
            idempotencyKey
        );

        _movements.Add(movement);

        if (direction == CashMovementDirection.In)
        {
            CurrentBalance += amount;
            TotalCashIn += amount;
        }
        else
        {
            CurrentBalance -= amount;
            TotalCashOut += amount;
        }

        return movement;
    }

    public void StartClosing(Guid userId)
    {
        if (Status != CashShiftStatus.Open)
            throw new InvalidOperationException($"Apenas turnos abertos podem iniciar fechamento. Situação atual: {Status}.");

        Status = CashShiftStatus.Closing;
        ClosingStartedAtUtc = DateTime.UtcNow;
    }

    public void SubmitBlindCount(
        Guid userId,
        decimal countedTotal,
        IEnumerable<(decimal Denomination, int Quantity)> denominations,
        string? notes)
    {
        if (Status != CashShiftStatus.Open && Status != CashShiftStatus.Closing)
            throw new InvalidOperationException($"Não é possível registrar contagem em turno com situação {Status}.");

        if (countedTotal < 0)
            throw new ArgumentException("O valor contado não pode ser negativo.", nameof(countedTotal));

        // Limpar denominações anteriores
        _denominations.Clear();

        Status = CashShiftStatus.CountSubmitted;
        ExpectedCashBalance = CurrentBalance;
        CountedCashBalance = countedTotal;
        ClosingNotes = notes?.Trim();

        var diff = countedTotal - CurrentBalance;
        DiscrepancyAmount = Math.Abs(diff);

        if (diff > 0)
        {
            DiscrepancyType = CashDiscrepancyType.Surplus;
        }
        else if (diff < 0)
        {
            DiscrepancyType = CashDiscrepancyType.Shortage;
        }
        else
        {
            DiscrepancyType = null;
        }
    }

    public void ApproveClosing(Guid approverUserId, string? notes)
    {
        if (Status != CashShiftStatus.CountSubmitted)
            throw new InvalidOperationException("Apenas turnos com contagem submetida podem ser aprovados.");

        ApprovedByUserId = approverUserId;
        Status = CashShiftStatus.Approved;
        if (!string.IsNullOrWhiteSpace(notes))
        {
            ClosingNotes = string.IsNullOrWhiteSpace(ClosingNotes) ? notes : $"{ClosingNotes} | Aprovação: {notes}";
        }
    }

    public void CloseShift(Guid closedByUserId)
    {
        if (Status != CashShiftStatus.Approved && Status != CashShiftStatus.CountSubmitted)
            throw new InvalidOperationException("O turno precisa estar com contagem submetida e aprovado para encerramento final.");

        Status = CashShiftStatus.Closed;
        ClosedAtUtc = DateTime.UtcNow;
        ClosedByUserId = closedByUserId;
    }
}

/// <summary>
/// Movimento imutável de dinheiro físico (append-only ledger).
/// </summary>
public class CashMovement : TenantEntity
{
    public Guid BranchId { get; private set; }
    public Guid CashRegisterId { get; private set; }
    public Guid CashShiftId { get; private set; }
    public CashMovementType MovementType { get; private set; }
    public CashMovementDirection Direction { get; private set; }
    public decimal Amount { get; private set; }
    public string SourceType { get; private set; }
    public string SourceId { get; private set; }
    public string DocumentReference { get; private set; }
    public string? Reason { get; private set; }
    public Guid CreatedByUserId { get; private set; }
    public string? CorrelationId { get; private set; }
    public string? IdempotencyKey { get; private set; }
    public Guid? ReversalOfMovementId { get; private set; }

    private CashMovement() { }

    public CashMovement(
        Guid tenantId,
        Guid branchId,
        Guid cashRegisterId,
        Guid cashShiftId,
        CashMovementType movementType,
        CashMovementDirection direction,
        decimal amount,
        string sourceType,
        string sourceId,
        string documentReference,
        string? reason,
        Guid createdByUserId,
        string? correlationId = null,
        string? idempotencyKey = null,
        Guid? reversalOfMovementId = null)
    {
        if (amount <= 0)
            throw new ArgumentException("O valor do movimento deve ser maior que zero.", nameof(amount));

        TenantId = tenantId;
        BranchId = branchId;
        CashRegisterId = cashRegisterId;
        CashShiftId = cashShiftId;
        MovementType = movementType;
        Direction = direction;
        Amount = amount;
        SourceType = sourceType.Trim().ToUpperInvariant();
        SourceId = sourceId.Trim();
        DocumentReference = documentReference.Trim().ToUpperInvariant();
        Reason = reason?.Trim();
        CreatedByUserId = createdByUserId;
        CorrelationId = correlationId?.Trim();
        IdempotencyKey = idempotencyKey?.Trim();
        ReversalOfMovementId = reversalOfMovementId;
    }
}

/// <summary>
/// Denominação de notas e moedas contadas na conferência física.
/// </summary>
public class CashCountDenomination : TenantEntity
{
    public Guid CashShiftId { get; private set; }
    public decimal Denomination { get; private set; }
    public int Quantity { get; private set; }
    public decimal TotalAmount => Denomination * Quantity;

    private CashCountDenomination() { }

    public CashCountDenomination(Guid tenantId, Guid cashShiftId, decimal denomination, int quantity)
    {
        TenantId = tenantId;
        CashShiftId = cashShiftId;
        Denomination = denomination;
        Quantity = quantity;
    }
}

/// <summary>
/// Apuração e tratamento formal de divergência de caixa (sobra ou falta).
/// </summary>
public class CashDiscrepancy : TenantEntity
{
    public Guid BranchId { get; private set; }
    public Guid CashShiftId { get; private set; }
    public CashDiscrepancyType DiscrepancyType { get; private set; }
    public decimal Amount { get; private set; }
    public CashDiscrepancyStatus Status { get; private set; }
    public string? OperatorJustification { get; private set; }
    public Guid? JustifiedByUserId { get; private set; }
    public DateTime? JustifiedAtUtc { get; private set; }
    public string? ResolutionNotes { get; private set; }
    public Guid? ResolvedByUserId { get; private set; }
    public DateTime? ResolvedAtUtc { get; private set; }

    private CashDiscrepancy() { }

    public CashDiscrepancy(
        Guid tenantId,
        Guid branchId,
        Guid cashShiftId,
        CashDiscrepancyType discrepancyType,
        decimal amount)
    {
        TenantId = tenantId;
        BranchId = branchId;
        CashShiftId = cashShiftId;
        DiscrepancyType = discrepancyType;
        Amount = amount;
        Status = CashDiscrepancyStatus.Pending;
    }

    public void AddJustification(string justification, Guid userId)
    {
        OperatorJustification = justification.Trim();
        JustifiedByUserId = userId;
        JustifiedAtUtc = DateTime.UtcNow;
        Status = CashDiscrepancyStatus.Justified;
    }

    public void Resolve(bool approved, string resolutionNotes, Guid approverUserId)
    {
        Status = approved ? CashDiscrepancyStatus.Approved : CashDiscrepancyStatus.Rejected;
        ResolutionNotes = resolutionNotes.Trim();
        ResolvedByUserId = approverUserId;
        ResolvedAtUtc = DateTime.UtcNow;
    }
}
