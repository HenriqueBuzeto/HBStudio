using BuildingBlocks.Domain;
using Catalog.Domain;

namespace Inventory.Domain;

public enum WarehouseType
{
    GeneralStore = 1,     // Loja Física / Varejo
    CentralDeposit = 2,   // Depósito Central / Matriz
    TechnicalBench = 3,   // Bancada / Almoxarifado da Assistência Técnica
    Manufacturing3D = 4,  // Almoxarifado de Insumos e Filamentos 3D
    Quarantine = 5        // Armazém de Quarentena / Devoluções com Vício
}

public class Warehouse : TenantEntity
{
    public Guid BranchId { get; private set; }
    public string Code { get; private set; } // Ex: "ALM-LOJA-01"
    public string Name { get; private set; } // Ex: "Depósito Principal Matriz"
    public WarehouseType Type { get; private set; }
    public string? Description { get; private set; }
    public bool IsActive { get; private set; } = true;

    private readonly List<WarehouseLocation> _locations = [];
    public IReadOnlyCollection<WarehouseLocation> Locations => _locations.AsReadOnly();

    private Warehouse() { Code = string.Empty; Name = string.Empty; }

    public Warehouse(
        Guid tenantId,
        Guid branchId,
        string code,
        string name,
        WarehouseType type,
        string? description = null) : base(tenantId)
    {
        if (string.IsNullOrWhiteSpace(code))
            throw new ArgumentException("O código do depósito é obrigatório.", nameof(code));
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("O nome do depósito é obrigatório.", nameof(name));

        BranchId = branchId;
        Code = code.Trim().ToUpperInvariant();
        Name = name.Trim();
        Type = type;
        Description = description?.Trim();
    }

    public WarehouseLocation AddLocation(string aisle, string shelf, string bin, string? description = null)
    {
        var location = new WarehouseLocation(TenantId, Id, aisle, shelf, bin, description);
        _locations.Add(location);
        return location;
    }
}

public class WarehouseLocation : TenantEntity
{
    public Guid WarehouseId { get; private set; }
    public Warehouse? Warehouse { get; private set; }
    public string Code { get; private set; } // Ex: "A1-P2-G03"
    public string Aisle { get; private set; } // Corredor / Rua
    public string Shelf { get; private set; } // Prateleira
    public string Bin { get; private set; }   // Gaveta / Caixa / Posição
    public string? Description { get; private set; }
    public bool IsBlocked { get; private set; } = false;

    private WarehouseLocation() { Code = string.Empty; Aisle = string.Empty; Shelf = string.Empty; Bin = string.Empty; }

    public WarehouseLocation(
        Guid tenantId,
        Guid warehouseId,
        string aisle,
        string shelf,
        string bin,
        string? description = null) : base(tenantId)
    {
        WarehouseId = warehouseId;
        Aisle = aisle.Trim().ToUpperInvariant();
        Shelf = shelf.Trim().ToUpperInvariant();
        Bin = bin.Trim().ToUpperInvariant();
        Code = $"{Aisle}-{Shelf}-{Bin}";
        Description = description?.Trim();
    }

    public void ToggleBlock(bool blocked) => IsBlocked = blocked;
}

public enum StockMovementType
{
    InitialBalance = 1,       // Carga inicial / Saldo de implantação
    PurchaseReceipt = 2,      // Recebimento de Compra / Fornecedor
    CustomerBuyback = 3,      // Recompra de Aparelho Usado no Balcão
    SaleIssue = 4,            // Baixa por Venda / Cupom Fiscal / NF-e
    TransferOut = 5,          // Saída de Transferência (Origem)
    TransferIn = 6,           // Entrada de Transferência (Destino)
    PositiveAdjustment = 7,   // Ajuste de Inventário (+)
    NegativeAdjustment = 8,   // Ajuste de Inventário (-)
    TechnicalConsumption = 9, // Consumo de peça em Ordem de Serviço
    Manufacturing3DIssue = 10, // Consumo de filamento/resina em lote de impressão 3D
    Manufacturing3DReceipt = 11, // Entrada de produto acabado após aprovação da produção
    LoyaltyRewardIssue = 12 // Baixa de recompensa física entregue
}

// Kardex Imutável (Append-only Ledger de Estoque)
public class StockMovement : TenantEntity
{
    public Guid BranchId { get; private set; }
    public Guid WarehouseId { get; private set; }
    public Warehouse? Warehouse { get; private set; }
    public Guid? WarehouseLocationId { get; private set; }
    public WarehouseLocation? WarehouseLocation { get; private set; }
    public Guid ProductSkuId { get; private set; }
    public ProductSku? ProductSku { get; private set; }
    public Guid? InventoryUnitId { get; private set; }
    public InventoryUnit? InventoryUnit { get; private set; }

    public StockMovementType MovementType { get; private set; }
    public decimal Quantity { get; private set; } // Positivo para entradas, negativo para saídas
    public decimal UnitCost { get; private set; }
    public decimal TotalCost { get; private set; }
    public decimal BalanceAfterQuantity { get; private set; } // Saldo OnHand após o lançamento

    public string DocumentReference { get; private set; } // NF, OS, Pedido, Inventário
    public string? Reason { get; private set; }
    public Guid? CorrelationId { get; private set; } // Para agrupar transferências, faturamentos ou batches
    public string? IdempotencyKey { get; private set; }
    public Guid CreatedByUserId { get; private set; }

    private StockMovement() { DocumentReference = string.Empty; }

    public StockMovement(
        Guid tenantId,
        Guid branchId,
        Guid warehouseId,
        Guid? warehouseLocationId,
        Guid productSkuId,
        Guid? inventoryUnitId,
        StockMovementType movementType,
        decimal quantity,
        decimal unitCost,
        decimal balanceAfterQuantity,
        string documentReference,
        string? reason,
        Guid? correlationId,
        string? idempotencyKey,
        Guid createdByUserId) : base(tenantId)
    {
        if (quantity == 0)
            throw new ArgumentException("A quantidade de movimento não pode ser zero.", nameof(quantity));
        if (unitCost < 0)
            throw new ArgumentException("O custo unitário não pode ser negativo.", nameof(unitCost));
        if (string.IsNullOrWhiteSpace(documentReference))
            throw new ArgumentException("A referência de documento é obrigatória no Kardex.", nameof(documentReference));

        BranchId = branchId;
        WarehouseId = warehouseId;
        WarehouseLocationId = warehouseLocationId;
        ProductSkuId = productSkuId;
        InventoryUnitId = inventoryUnitId;
        MovementType = movementType;
        Quantity = quantity;
        UnitCost = unitCost;
        TotalCost = Math.Round(Math.Abs(quantity) * unitCost, 2);
        BalanceAfterQuantity = balanceAfterQuantity;
        DocumentReference = documentReference.Trim();
        Reason = reason?.Trim();
        CorrelationId = correlationId;
        IdempotencyKey = idempotencyKey?.Trim();
        CreatedByUserId = createdByUserId;
    }
}

// Projeção Materializada de Saldo de Estoque por SKU e Depósito/Localização
public class StockBalance : TenantEntity
{
    public Guid BranchId { get; private set; }
    public Guid WarehouseId { get; private set; }
    public Warehouse? Warehouse { get; private set; }
    public Guid? WarehouseLocationId { get; private set; }
    public WarehouseLocation? WarehouseLocation { get; private set; }
    public Guid ProductSkuId { get; private set; }
    public ProductSku? ProductSku { get; private set; }

    public decimal OnHandQuantity { get; private set; }  // Físico na prateleira
    public decimal ReservedQuantity { get; private set; } // Alocado a pedidos/OS
    public decimal BlockedQuantity { get; private set; }  // Em quarentena ou perícia
    public decimal AvailableQuantity => Math.Max(0, OnHandQuantity - ReservedQuantity - BlockedQuantity);

    public decimal AverageCost { get; private set; }     // Custo médio ponderado
    public DateTime LastMovementAtUtc { get; private set; }

    private StockBalance() { }

    public StockBalance(
        Guid tenantId,
        Guid branchId,
        Guid warehouseId,
        Guid? warehouseLocationId,
        Guid productSkuId) : base(tenantId)
    {
        BranchId = branchId;
        WarehouseId = warehouseId;
        WarehouseLocationId = warehouseLocationId;
        ProductSkuId = productSkuId;
        OnHandQuantity = 0;
        ReservedQuantity = 0;
        BlockedQuantity = 0;
        AverageCost = 0;
        LastMovementAtUtc = DateTime.UtcNow;
    }

    public void ApplyMovement(decimal quantity, decimal unitCost)
    {
        if (quantity > 0)
        {
            // Entrada: Recalcula custo médio ponderado
            var currentTotalValue = OnHandQuantity * AverageCost;
            var incomingTotalValue = quantity * unitCost;
            var newOnHand = OnHandQuantity + quantity;
            AverageCost = newOnHand > 0 ? Math.Round((currentTotalValue + incomingTotalValue) / newOnHand, 4) : unitCost;
            OnHandQuantity = newOnHand;
        }
        else
        {
            // Saída: Mantém custo médio atual, verifica ruptura
            var deduction = Math.Abs(quantity);
            if (OnHandQuantity < deduction)
            {
                throw new InvalidOperationException($"Saldo físico insuficiente para saída do SKU {ProductSkuId}. Físico: {OnHandQuantity}, Solicitado: {deduction}");
            }
            OnHandQuantity -= deduction;
        }

        LastMovementAtUtc = DateTime.UtcNow;
    }

    public void Reserve(decimal quantity)
    {
        if (quantity <= 0)
            throw new ArgumentException("Quantidade a reservar deve ser positiva.", nameof(quantity));

        if (AvailableQuantity < quantity)
            throw new InvalidOperationException($"Saldo disponível insuficiente para reserva. Disponível: {AvailableQuantity}, Solicitado: {quantity}");

        ReservedQuantity += quantity;
        LastMovementAtUtc = DateTime.UtcNow;
    }

    public void ReleaseReservation(decimal quantity)
    {
        if (quantity <= 0)
            throw new ArgumentException("Quantidade a liberar deve ser positiva.", nameof(quantity));

        if (ReservedQuantity < quantity)
            throw new InvalidOperationException($"Não é possível liberar mais do que o saldo reservado ({ReservedQuantity}).");

        ReservedQuantity -= quantity;
        LastMovementAtUtc = DateTime.UtcNow;
    }

    public void ConsumeReservation(decimal quantity)
    {
        if (quantity <= 0)
            throw new ArgumentException("Quantidade a consumir deve ser positiva.", nameof(quantity));

        if (ReservedQuantity < quantity)
            throw new InvalidOperationException($"Não é possível consumir mais do que a reserva ({ReservedQuantity}).");
        if (OnHandQuantity < quantity)
            throw new InvalidOperationException($"Saldo físico insuficiente para consumo de reserva ({OnHandQuantity}).");

        ReservedQuantity -= quantity;
        OnHandQuantity -= quantity;
        LastMovementAtUtc = DateTime.UtcNow;
    }

    public void Block(decimal quantity)
    {
        if (quantity <= 0)
            throw new ArgumentException("Quantidade a bloquear deve ser positiva.", nameof(quantity));
        if (AvailableQuantity < quantity)
            throw new InvalidOperationException($"Saldo disponível insuficiente para bloqueio ({AvailableQuantity}).");

        BlockedQuantity += quantity;
        LastMovementAtUtc = DateTime.UtcNow;
    }

    public void Unblock(decimal quantity)
    {
        if (quantity <= 0)
            throw new ArgumentException("Quantidade a desbloquear deve ser positiva.", nameof(quantity));
        if (BlockedQuantity < quantity)
            throw new InvalidOperationException($"Quantidade bloqueada insuficiente para desbloqueio ({BlockedQuantity}).");

        BlockedQuantity -= quantity;
        LastMovementAtUtc = DateTime.UtcNow;
    }
}

// Rastreamento da Posição Física Atual de Unidades Serializadas (IMEI/Serial)
public class SerialStockPosition : TenantEntity
{
    public Guid InventoryUnitId { get; private set; }
    public InventoryUnit? InventoryUnit { get; private set; }
    public Guid ProductSkuId { get; private set; }
    public Guid BranchId { get; private set; }
    public Guid WarehouseId { get; private set; }
    public Warehouse? Warehouse { get; private set; }
    public Guid? WarehouseLocationId { get; private set; }
    public WarehouseLocation? WarehouseLocation { get; private set; }
    public bool IsInStock { get; private set; } = true;
    public bool IsReserved { get; private set; } = false;
    public Guid? CurrentReservationId { get; private set; }
    public DateTime LastUpdatedAtUtc { get; private set; }

    private SerialStockPosition() { }

    public SerialStockPosition(
        Guid tenantId,
        Guid inventoryUnitId,
        Guid productSkuId,
        Guid branchId,
        Guid warehouseId,
        Guid? warehouseLocationId) : base(tenantId)
    {
        InventoryUnitId = inventoryUnitId;
        ProductSkuId = productSkuId;
        BranchId = branchId;
        WarehouseId = warehouseId;
        WarehouseLocationId = warehouseLocationId;
        IsInStock = true;
        IsReserved = false;
        LastUpdatedAtUtc = DateTime.UtcNow;
    }

    public void Move(Guid branchId, Guid warehouseId, Guid? warehouseLocationId)
    {
        BranchId = branchId;
        WarehouseId = warehouseId;
        WarehouseLocationId = warehouseLocationId;
        LastUpdatedAtUtc = DateTime.UtcNow;
    }

    public void SetReserved(Guid reservationId)
    {
        if (!IsInStock)
            throw new InvalidOperationException("Unidade física não está no estoque para reserva.");
        if (IsReserved)
            throw new InvalidOperationException("Unidade física já se encontra reservada.");

        IsReserved = true;
        CurrentReservationId = reservationId;
        LastUpdatedAtUtc = DateTime.UtcNow;
    }

    public void ReleaseReservation()
    {
        IsReserved = false;
        CurrentReservationId = null;
        LastUpdatedAtUtc = DateTime.UtcNow;
    }

    public void DispatchSaleOrConsumption()
    {
        if (!IsInStock)
            throw new InvalidOperationException("Unidade já foi baixada do estoque.");

        IsInStock = false;
        IsReserved = false;
        CurrentReservationId = null;
        LastUpdatedAtUtc = DateTime.UtcNow;
    }
}

public enum ReservationStatus
{
    Active = 1,
    Consumed = 2,
    Released = 3,
    Expired = 4
}

public class StockReservation : TenantEntity
{
    public Guid BranchId { get; private set; }
    public string ReservationNumber { get; private set; }
    public ReservationStatus Status { get; private set; }
    public string Reason { get; private set; }
    public string? DocumentReference { get; private set; }
    public DateTime ExpiresAtUtc { get; private set; }
    public string? IdempotencyKey { get; private set; }

    private readonly List<StockReservationItem> _items = [];
    public IReadOnlyCollection<StockReservationItem> Items => _items.AsReadOnly();

    private StockReservation() { ReservationNumber = string.Empty; Reason = string.Empty; }

    public StockReservation(
        Guid tenantId,
        Guid branchId,
        string reservationNumber,
        string reason,
        DateTime expiresAtUtc,
        string? documentReference = null,
        string? idempotencyKey = null) : base(tenantId)
    {
        if (string.IsNullOrWhiteSpace(reservationNumber))
            throw new ArgumentException("Número da reserva é obrigatório.", nameof(reservationNumber));
        if (string.IsNullOrWhiteSpace(reason))
            throw new ArgumentException("Motivo da reserva é obrigatório.", nameof(reason));

        BranchId = branchId;
        ReservationNumber = reservationNumber.Trim().ToUpperInvariant();
        Reason = reason.Trim();
        ExpiresAtUtc = expiresAtUtc;
        DocumentReference = documentReference?.Trim();
        IdempotencyKey = idempotencyKey?.Trim();
        Status = ReservationStatus.Active;
    }

    public void AddItem(Guid warehouseId, Guid? warehouseLocationId, Guid productSkuId, decimal quantity, Guid? inventoryUnitId = null)
    {
        var item = new StockReservationItem(TenantId, Id, warehouseId, warehouseLocationId, productSkuId, quantity, inventoryUnitId);
        _items.Add(item);
    }

    public void MarkConsumed()
    {
        if (Status != ReservationStatus.Active)
            throw new InvalidOperationException($"Não é possível consumir reserva com status '{Status}'.");
        Status = ReservationStatus.Consumed;
    }

    public void MarkReleased()
    {
        if (Status != ReservationStatus.Active)
            throw new InvalidOperationException($"Não é possível liberar reserva com status '{Status}'.");
        Status = ReservationStatus.Released;
    }

    public void MarkExpired()
    {
        if (Status == ReservationStatus.Active)
            Status = ReservationStatus.Expired;
    }
}

public class StockReservationItem : TenantEntity
{
    public Guid StockReservationId { get; private set; }
    public Guid WarehouseId { get; private set; }
    public Guid? WarehouseLocationId { get; private set; }
    public Guid ProductSkuId { get; private set; }
    public decimal Quantity { get; private set; }
    public Guid? InventoryUnitId { get; private set; }

    private StockReservationItem() { }

    public StockReservationItem(
        Guid tenantId,
        Guid stockReservationId,
        Guid warehouseId,
        Guid? warehouseLocationId,
        Guid productSkuId,
        decimal quantity,
        Guid? inventoryUnitId) : base(tenantId)
    {
        StockReservationId = stockReservationId;
        WarehouseId = warehouseId;
        WarehouseLocationId = warehouseLocationId;
        ProductSkuId = productSkuId;
        Quantity = quantity;
        InventoryUnitId = inventoryUnitId;
    }
}

public enum TransferStatus
{
    Draft = 1,
    Submitted = 2,
    InTransit = 3,
    Received = 4,
    Cancelled = 5
}

public class StockTransfer : TenantEntity
{
    public string TransferNumber { get; private set; }
    public Guid SourceBranchId { get; private set; }
    public Guid SourceWarehouseId { get; private set; }
    public Guid TargetBranchId { get; private set; }
    public Guid TargetWarehouseId { get; private set; }
    public TransferStatus Status { get; private set; }
    public string? Notes { get; private set; }
    public DateTime? DispatchedAtUtc { get; private set; }
    public DateTime? ReceivedAtUtc { get; private set; }
    public Guid CreatedByUserId { get; private set; }

    private readonly List<StockTransferItem> _items = [];
    public IReadOnlyCollection<StockTransferItem> Items => _items.AsReadOnly();

    private StockTransfer() { TransferNumber = string.Empty; }

    public StockTransfer(
        Guid tenantId,
        string transferNumber,
        Guid sourceBranchId,
        Guid sourceWarehouseId,
        Guid targetBranchId,
        Guid targetWarehouseId,
        Guid createdByUserId,
        string? notes = null) : base(tenantId)
    {
        if (string.IsNullOrWhiteSpace(transferNumber))
            throw new ArgumentException("Número de transferência obrigatório.", nameof(transferNumber));

        TransferNumber = transferNumber.Trim().ToUpperInvariant();
        SourceBranchId = sourceBranchId;
        SourceWarehouseId = sourceWarehouseId;
        TargetBranchId = targetBranchId;
        TargetWarehouseId = targetWarehouseId;
        CreatedByUserId = createdByUserId;
        Notes = notes?.Trim();
        Status = TransferStatus.Draft;
    }

    public void AddItem(Guid productSkuId, decimal quantity, Guid? inventoryUnitId = null)
    {
        if (Status != TransferStatus.Draft)
            throw new InvalidOperationException("Não é possível adicionar itens a transferências já submetidas.");

        var item = new StockTransferItem(TenantId, Id, productSkuId, quantity, inventoryUnitId);
        _items.Add(item);
    }

    public void Submit()
    {
        if (Status != TransferStatus.Draft)
            throw new InvalidOperationException("Apenas transferências em rascunho podem ser submetidas.");
        if (_items.Count == 0)
            throw new InvalidOperationException("A transferência não possui itens.");

        Status = TransferStatus.Submitted;
    }

    public void Dispatch()
    {
        if (Status != TransferStatus.Submitted)
            throw new InvalidOperationException("Apenas transferências submetidas podem ser despachadas em trânsito.");

        Status = TransferStatus.InTransit;
        DispatchedAtUtc = DateTime.UtcNow;
    }

    public void Receive()
    {
        if (Status != TransferStatus.InTransit)
            throw new InvalidOperationException("Apenas transferências em trânsito podem ser recebidas no destino.");

        Status = TransferStatus.Received;
        ReceivedAtUtc = DateTime.UtcNow;
    }

    public void Cancel()
    {
        if (Status == TransferStatus.Received)
            throw new InvalidOperationException("Não é possível cancelar uma transferência já recebida.");

        Status = TransferStatus.Cancelled;
    }
}

public class StockTransferItem : TenantEntity
{
    public Guid StockTransferId { get; private set; }
    public Guid ProductSkuId { get; private set; }
    public decimal Quantity { get; private set; }
    public Guid? InventoryUnitId { get; private set; }

    private StockTransferItem() { }

    public StockTransferItem(
        Guid tenantId,
        Guid stockTransferId,
        Guid productSkuId,
        decimal quantity,
        Guid? inventoryUnitId) : base(tenantId)
    {
        StockTransferId = stockTransferId;
        ProductSkuId = productSkuId;
        Quantity = quantity;
        InventoryUnitId = inventoryUnitId;
    }
}

public enum InventoryCountStatus
{
    Draft = 1,
    InProgress = 2,
    PendingApproval = 3,
    ApprovedAndPosted = 4,
    Cancelled = 5
}

public class InventoryCount : TenantEntity
{
    public string CountNumber { get; private set; }
    public Guid BranchId { get; private set; }
    public Guid WarehouseId { get; private set; }
    public Warehouse? Warehouse { get; private set; }
    public InventoryCountStatus Status { get; private set; }
    public string Description { get; private set; }
    public DateTime? PostedAtUtc { get; private set; }
    public Guid CreatedByUserId { get; private set; }
    public Guid? ApprovedByUserId { get; private set; }

    private readonly List<InventoryCountItem> _items = [];
    public IReadOnlyCollection<InventoryCountItem> Items => _items.AsReadOnly();

    private InventoryCount() { CountNumber = string.Empty; Description = string.Empty; }

    public InventoryCount(
        Guid tenantId,
        Guid branchId,
        Guid warehouseId,
        string countNumber,
        string description,
        Guid createdByUserId) : base(tenantId)
    {
        BranchId = branchId;
        WarehouseId = warehouseId;
        CountNumber = countNumber.Trim().ToUpperInvariant();
        Description = description.Trim();
        CreatedByUserId = createdByUserId;
        Status = InventoryCountStatus.Draft;
    }

    public void Start()
    {
        if (Status != InventoryCountStatus.Draft)
            throw new InvalidOperationException("Apenas contagens em rascunho podem ser iniciadas.");
        Status = InventoryCountStatus.InProgress;
    }

    public void RecordItem(Guid productSkuId, decimal systemSnapshotQuantity, decimal countedQuantity, Guid? inventoryUnitId = null, string? notes = null)
    {
        if (Status != InventoryCountStatus.InProgress)
            throw new InvalidOperationException("Contagem deve estar em andamento para lançamento de itens.");

        var existing = _items.FirstOrDefault(i => i.ProductSkuId == productSkuId && i.InventoryUnitId == inventoryUnitId);
        if (existing != null)
        {
            existing.UpdateCount(countedQuantity, notes);
        }
        else
        {
            var item = new InventoryCountItem(TenantId, Id, productSkuId, systemSnapshotQuantity, countedQuantity, inventoryUnitId, notes);
            _items.Add(item);
        }
    }

    public void SubmitForApproval()
    {
        if (Status != InventoryCountStatus.InProgress)
            throw new InvalidOperationException("Apenas contagens em andamento podem ser submetidas para aprovação.");
        Status = InventoryCountStatus.PendingApproval;
    }

    public void ApproveAndPost(Guid approvedByUserId)
    {
        if (Status != InventoryCountStatus.PendingApproval)
            throw new InvalidOperationException("Apenas contagens pendentes de aprovação podem ser postadas.");

        Status = InventoryCountStatus.ApprovedAndPosted;
        ApprovedByUserId = approvedByUserId;
        PostedAtUtc = DateTime.UtcNow;
    }
}

public class InventoryCountItem : TenantEntity
{
    public Guid InventoryCountId { get; private set; }
    public Guid ProductSkuId { get; private set; }
    public Guid? InventoryUnitId { get; private set; }
    public decimal SystemSnapshotQuantity { get; private set; }
    public decimal CountedQuantity { get; private set; }
    public decimal VarianceQuantity => CountedQuantity - SystemSnapshotQuantity;
    public string? Notes { get; private set; }

    private InventoryCountItem() { }

    public InventoryCountItem(
        Guid tenantId,
        Guid inventoryCountId,
        Guid productSkuId,
        decimal systemSnapshotQuantity,
        decimal countedQuantity,
        Guid? inventoryUnitId,
        string? notes) : base(tenantId)
    {
        InventoryCountId = inventoryCountId;
        ProductSkuId = productSkuId;
        SystemSnapshotQuantity = systemSnapshotQuantity;
        CountedQuantity = countedQuantity;
        InventoryUnitId = inventoryUnitId;
        Notes = notes?.Trim();
    }

    public void UpdateCount(decimal countedQuantity, string? notes)
    {
        CountedQuantity = countedQuantity;
        if (!string.IsNullOrWhiteSpace(notes))
            Notes = notes.Trim();
    }
}
