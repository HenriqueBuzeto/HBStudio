using BuildingBlocks.Domain;

namespace Financial.Domain;

public enum FinancialAccountType
{
    Asset = 1,      // Ativo (Caixa, Bancos, Clientes a Receber, Estoques)
    Liability = 2,  // Passivo (Fornecedores a Pagar, Empréstimos, Obrigações)
    Equity = 3,     // Patrimônio Líquido (Capital Social, Reservas, Lucros Acumulados)
    Revenue = 4,    // Receita (Vendas Novos, Usados, Assistência, Softwares, Impressão 3D)
    Expense = 5     // Despesa / Custo (CMV, Custos de Serviços, Administrativas, Aluguel, etc.)
}

public enum JournalLineDirection
{
    Debit = 1,
    Credit = 2
}

public enum PayableStatus
{
    Draft = 1,
    Open = 2,
    PartiallyPaid = 3,
    Paid = 4,
    Cancelled = 5
}

public enum ReceivableStatus
{
    Draft = 1,
    Open = 2,
    PartiallyReceived = 3,
    Received = 4,
    Cancelled = 5
}

public enum BankAccountType
{
    Checking = 1,   // Conta Corrente
    Payment = 2,    // Conta de Pagamento (MercadoPago, Asaas, etc.)
    Savings = 3,    // Poupança / Aplicação
    SafeVault = 4   // Cofre Físico Central
}

public enum ReconciliationStatus
{
    Pending = 1,
    Matched = 2,
    Discrepancy = 3
}

/// <summary>
/// Centro de Custo para apuração por atividade multinegócio da HB Studio.
/// </summary>
public class FinancialCostCenter : TenantEntity
{
    public string Code { get; private set; }
    public string Name { get; private set; }
    public string? Description { get; private set; }
    public bool IsActive { get; private set; }

    private FinancialCostCenter() { }

    public FinancialCostCenter(Guid tenantId, string code, string name, string? description = null)
    {
        TenantId = tenantId;
        Code = code.Trim().ToUpperInvariant();
        Name = name.Trim();
        Description = description?.Trim();
        IsActive = true;
    }
}

/// <summary>
/// Conta do Plano de Contas Gerencial.
/// </summary>
public class FinancialAccount : TenantEntity
{
    public string Code { get; private set; }
    public string Name { get; private set; }
    public FinancialAccountType Type { get; private set; }
    public Guid? ParentAccountId { get; private set; }
    public bool IsActive { get; private set; }

    private FinancialAccount() { }

    public FinancialAccount(Guid tenantId, string code, string name, FinancialAccountType type, Guid? parentAccountId = null)
    {
        TenantId = tenantId;
        Code = code.Trim().ToUpperInvariant();
        Name = name.Trim();
        Type = type;
        ParentAccountId = parentAccountId;
        IsActive = true;
    }
}

/// <summary>
/// Conta Bancária ou de Custódia Financeira Real da Empresa.
/// </summary>
public class BankAccount : TenantEntity
{
    public Guid BranchId { get; private set; }
    public string BankName { get; private set; }
    public string? AgencyNumber { get; private set; }
    public string AccountNumber { get; private set; }
    public BankAccountType Type { get; private set; }
    public decimal CurrentBalance { get; private set; }
    public decimal ReconciledBalance { get; private set; }
    public bool IsActive { get; private set; }

    private BankAccount() { }

    public BankAccount(
        Guid tenantId,
        Guid branchId,
        string bankName,
        string? agencyNumber,
        string accountNumber,
        BankAccountType type,
        decimal initialBalance = 0)
    {
        TenantId = tenantId;
        BranchId = branchId;
        BankName = bankName.Trim();
        AgencyNumber = agencyNumber?.Trim();
        AccountNumber = accountNumber.Trim();
        Type = type;
        CurrentBalance = initialBalance;
        ReconciledBalance = initialBalance;
        IsActive = true;
    }

    public void ApplyMovement(decimal amount)
    {
        CurrentBalance += amount;
    }

    public void ApplyReconciliation(decimal amount)
    {
        ReconciledBalance += amount;
    }
}

/// <summary>
/// Lançamento Contábil/Financeiro Balanceado por Partidas Dobradas (Append-Only Journal Entry).
/// </summary>
public class FinancialJournalEntry : TenantEntity
{
    public Guid BranchId { get; private set; }
    public DateTime CompetenceDateUtc { get; private set; }
    public string DocumentNumber { get; private set; }
    public string SourceType { get; private set; } // SALE, PROCUREMENT, CASH_SHIFT, CAPITAL_CONTRIBUTION, MANUAL
    public string SourceId { get; private set; }
    public string Description { get; private set; }
    public decimal TotalAmount { get; private set; }
    public Guid CreatedByUserId { get; private set; }
    public string? CorrelationId { get; private set; }
    public string? IdempotencyKey { get; private set; }
    public Guid? ReversalOfEntryId { get; private set; }

    private readonly List<FinancialJournalLine> _lines = new();
    public IReadOnlyCollection<FinancialJournalLine> Lines => _lines.AsReadOnly();

    private FinancialJournalEntry() { }

    public FinancialJournalEntry(
        Guid tenantId,
        Guid branchId,
        DateTime competenceDateUtc,
        string documentNumber,
        string sourceType,
        string sourceId,
        string description,
        Guid createdByUserId,
        string? correlationId = null,
        string? idempotencyKey = null,
        Guid? reversalOfEntryId = null)
    {
        TenantId = tenantId;
        BranchId = branchId;
        CompetenceDateUtc = competenceDateUtc;
        DocumentNumber = documentNumber.Trim().ToUpperInvariant();
        SourceType = sourceType.Trim().ToUpperInvariant();
        SourceId = sourceId.Trim();
        Description = description.Trim();
        CreatedByUserId = createdByUserId;
        CorrelationId = correlationId?.Trim();
        IdempotencyKey = idempotencyKey?.Trim();
        ReversalOfEntryId = reversalOfEntryId;
    }

    public void AddLine(Guid accountId, JournalLineDirection direction, decimal amount, Guid? costCenterId = null, string? memo = null)
    {
        if (amount <= 0)
            throw new ArgumentException("O valor da linha contábil deve ser positivo.", nameof(amount));

        _lines.Add(new FinancialJournalLine(TenantId, Id, accountId, direction, amount, costCenterId, memo));
    }

    public void ValidateBalance()
    {
        var totalDebits = _lines.Where(l => l.Direction == JournalLineDirection.Debit).Sum(l => l.Amount);
        var totalCredits = _lines.Where(l => l.Direction == JournalLineDirection.Credit).Sum(l => l.Amount);

        if (totalDebits != totalCredits)
        {
            throw new InvalidOperationException($"Lançamento contábil desbalanceado: Total Débitos ({totalDebits:C2}) != Total Créditos ({totalCredits:C2}).");
        }

        TotalAmount = totalDebits;
    }
}

/// <summary>
/// Linha individual de débito ou crédito de um lançamento.
/// </summary>
public class FinancialJournalLine : TenantEntity
{
    public Guid FinancialJournalEntryId { get; private set; }
    public Guid FinancialAccountId { get; private set; }
    public JournalLineDirection Direction { get; private set; }
    public decimal Amount { get; private set; }
    public Guid? FinancialCostCenterId { get; private set; }
    public string? Memo { get; private set; }

    private FinancialJournalLine() { }

    public FinancialJournalLine(
        Guid tenantId,
        Guid journalEntryId,
        Guid accountId,
        JournalLineDirection direction,
        decimal amount,
        Guid? costCenterId = null,
        string? memo = null)
    {
        TenantId = tenantId;
        FinancialJournalEntryId = journalEntryId;
        FinancialAccountId = accountId;
        Direction = direction;
        Amount = amount;
        FinancialCostCenterId = costCenterId;
        Memo = memo?.Trim();
    }
}

/// <summary>
/// Título de Conta a Pagar (Obrigação com Fornecedores ou Despesas Operacionais).
/// </summary>
public class AccountPayable : TenantEntity
{
    public Guid BranchId { get; private set; }
    public Guid? SupplierPartyId { get; private set; }
    public string TitleNumber { get; private set; }
    public string Description { get; private set; }
    public Guid? FinancialCostCenterId { get; private set; }
    public DateTime IssueDateUtc { get; private set; }
    public DateTime DueDateUtc { get; private set; }
    public decimal OriginalAmount { get; private set; }
    public decimal PaidAmount { get; private set; }
    public decimal BalanceRemaining => OriginalAmount - PaidAmount;
    public PayableStatus Status { get; private set; }
    public string? DocumentReference { get; private set; }
    public Guid? PurchaseOrderId { get; private set; }

    private readonly List<FinancialSettlement> _settlements = new();
    public IReadOnlyCollection<FinancialSettlement> Settlements => _settlements.AsReadOnly();

    private AccountPayable() { }

    public AccountPayable(
        Guid tenantId,
        Guid branchId,
        Guid? supplierPartyId,
        string titleNumber,
        string description,
        DateTime issueDateUtc,
        DateTime dueDateUtc,
        decimal originalAmount,
        Guid? costCenterId = null,
        string? documentReference = null,
        Guid? purchaseOrderId = null)
    {
        if (originalAmount <= 0)
            throw new ArgumentException("O valor original da conta a pagar deve ser maior que zero.", nameof(originalAmount));

        TenantId = tenantId;
        BranchId = branchId;
        SupplierPartyId = supplierPartyId;
        TitleNumber = titleNumber.Trim().ToUpperInvariant();
        Description = description.Trim();
        IssueDateUtc = issueDateUtc;
        DueDateUtc = dueDateUtc;
        OriginalAmount = originalAmount;
        PaidAmount = 0;
        FinancialCostCenterId = costCenterId;
        DocumentReference = documentReference?.Trim().ToUpperInvariant();
        PurchaseOrderId = purchaseOrderId;
        Status = PayableStatus.Open;
    }

    public FinancialSettlement Pay(decimal amount, Guid bankAccountId, Guid userId, string? reference = null)
    {
        if (Status == PayableStatus.Paid || Status == PayableStatus.Cancelled)
            throw new InvalidOperationException($"Não é possível liquidar título em situação {Status}.");

        if (amount <= 0)
            throw new ArgumentException("O valor de pagamento deve ser positivo.", nameof(amount));

        if (amount > BalanceRemaining)
            throw new InvalidOperationException($"Valor de pagamento ({amount:C2}) excede o saldo devedor ({BalanceRemaining:C2}).");

        PaidAmount += amount;
        Status = PaidAmount >= OriginalAmount ? PayableStatus.Paid : PayableStatus.PartiallyPaid;

        var settlement = new FinancialSettlement(
            TenantId,
            BranchId,
            SettlementType.Payable,
            Id,
            bankAccountId,
            amount,
            reference ?? TitleNumber,
            userId
        );

        _settlements.Add(settlement);
        return settlement;
    }
}

/// <summary>
/// Título de Conta a Receber (Crédito com Clientes ou Faturamento Comercial).
/// </summary>
public class AccountReceivable : TenantEntity
{
    public Guid BranchId { get; private set; }
    public Guid? CustomerPartyId { get; private set; }
    public string TitleNumber { get; private set; }
    public string Description { get; private set; }
    public Guid? FinancialCostCenterId { get; private set; }
    public DateTime IssueDateUtc { get; private set; }
    public DateTime DueDateUtc { get; private set; }
    public decimal OriginalAmount { get; private set; }
    public decimal ReceivedAmount { get; private set; }
    public decimal BalanceRemaining => OriginalAmount - ReceivedAmount;
    public ReceivableStatus Status { get; private set; }
    public string? DocumentReference { get; private set; }
    public Guid? SaleId { get; private set; }

    private readonly List<FinancialSettlement> _settlements = new();
    public IReadOnlyCollection<FinancialSettlement> Settlements => _settlements.AsReadOnly();

    private AccountReceivable() { }

    public AccountReceivable(
        Guid tenantId,
        Guid branchId,
        Guid? customerPartyId,
        string titleNumber,
        string description,
        DateTime issueDateUtc,
        DateTime dueDateUtc,
        decimal originalAmount,
        Guid? costCenterId = null,
        string? documentReference = null,
        Guid? saleId = null)
    {
        if (originalAmount <= 0)
            throw new ArgumentException("O valor original da conta a receber deve ser maior que zero.", nameof(originalAmount));

        TenantId = tenantId;
        BranchId = branchId;
        CustomerPartyId = customerPartyId;
        TitleNumber = titleNumber.Trim().ToUpperInvariant();
        Description = description.Trim();
        IssueDateUtc = issueDateUtc;
        DueDateUtc = dueDateUtc;
        OriginalAmount = originalAmount;
        ReceivedAmount = 0;
        FinancialCostCenterId = costCenterId;
        DocumentReference = documentReference?.Trim().ToUpperInvariant();
        SaleId = saleId;
        Status = ReceivableStatus.Open;
    }

    public FinancialSettlement Receive(decimal amount, Guid bankAccountId, Guid userId, string? reference = null)
    {
        if (Status == ReceivableStatus.Received || Status == ReceivableStatus.Cancelled)
            throw new InvalidOperationException($"Não é possível liquidar título em situação {Status}.");

        if (amount <= 0)
            throw new ArgumentException("O valor recebido deve ser positivo.", nameof(amount));

        if (amount > BalanceRemaining)
            throw new InvalidOperationException($"Valor recebido ({amount:C2}) excede o saldo em aberto ({BalanceRemaining:C2}).");

        ReceivedAmount += amount;
        Status = ReceivedAmount >= OriginalAmount ? ReceivableStatus.Received : ReceivableStatus.PartiallyReceived;

        var settlement = new FinancialSettlement(
            TenantId,
            BranchId,
            SettlementType.Receivable,
            Id,
            bankAccountId,
            amount,
            reference ?? TitleNumber,
            userId
        );

        _settlements.Add(settlement);
        return settlement;
    }
}

public enum SettlementType
{
    Payable = 1,
    Receivable = 2
}

/// <summary>
/// Liquidação financeira vinculando título, conta bancária e valor efetivo.
/// </summary>
public class FinancialSettlement : TenantEntity
{
    public Guid BranchId { get; private set; }
    public SettlementType Type { get; private set; }
    public Guid TitleId { get; private set; }
    public Guid BankAccountId { get; private set; }
    public decimal Amount { get; private set; }
    public DateTime SettlementDateUtc { get; private set; }
    public string ReferenceNumber { get; private set; }
    public Guid SettledByUserId { get; private set; }

    private FinancialSettlement() { }

    public FinancialSettlement(
        Guid tenantId,
        Guid branchId,
        SettlementType type,
        Guid titleId,
        Guid bankAccountId,
        decimal amount,
        string referenceNumber,
        Guid settledByUserId)
    {
        TenantId = tenantId;
        BranchId = branchId;
        Type = type;
        TitleId = titleId;
        BankAccountId = bankAccountId;
        Amount = amount;
        SettlementDateUtc = DateTime.UtcNow;
        ReferenceNumber = referenceNumber.Trim().ToUpperInvariant();
        SettledByUserId = settledByUserId;
    }
}

/// <summary>
/// Transação de Extrato Bancário Importada para Conciliação.
/// </summary>
public class BankTransaction : TenantEntity
{
    public Guid BankAccountId { get; private set; }
    public DateTime TransactionDateUtc { get; private set; }
    public decimal Amount { get; private set; }
    public string FitId { get; private set; } // Identificador bancário único no extrato (OFX/CSV)
    public string Memo { get; private set; }
    public ReconciliationStatus Status { get; private set; }
    public Guid? MatchedJournalEntryId { get; private set; }
    public DateTime? ReconciledAtUtc { get; private set; }

    private BankTransaction() { }

    public BankTransaction(
        Guid tenantId,
        Guid bankAccountId,
        DateTime transactionDateUtc,
        decimal amount,
        string fitId,
        string memo)
    {
        TenantId = tenantId;
        BankAccountId = bankAccountId;
        TransactionDateUtc = transactionDateUtc;
        Amount = amount;
        FitId = fitId.Trim();
        Memo = memo.Trim();
        Status = ReconciliationStatus.Pending;
    }

    public void MarkReconciled(Guid journalEntryId)
    {
        Status = ReconciliationStatus.Matched;
        MatchedJournalEntryId = journalEntryId;
        ReconciledAtUtc = DateTime.UtcNow;
    }
}
