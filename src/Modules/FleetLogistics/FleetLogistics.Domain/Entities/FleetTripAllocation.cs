using BuildingBlocks.Domain;

namespace FleetLogistics.Domain.Entities;

public enum AllocationTargetType
{
    UsedDeviceAcquisition = 1, // Aquisição de celular usado (unidade serializada / IMEI)
    ProcurementOrder = 2,      // Pedido de compra de mercadorias / fornecedor
    SalesDelivery = 3,         // Entrega de venda a cliente
    RepairServiceOrder = 4     // Retirada / entrega de assistência técnica
}

public enum AllocationMethod
{
    ProportionalValue = 1,     // Proporcional ao valor de aquisição de cada produto
    EqualQuantity = 2,         // Divisão igualitária por item/quantidade
    ManualSpecified = 3        // Atribuição manual justificada
}

/// <summary>
/// Rateio de custo logístico da viagem atribuído a um produto, aquisição ou venda.
/// </summary>
public class FleetTripAllocation : TenantEntity
{
    public Guid TripId { get; private set; }
    public FleetTrip? Trip { get; private set; }
    public AllocationTargetType TargetType { get; private set; }
    public Guid TargetId { get; private set; } // ID da compra (Procurement), da Unidade Serializada (InventoryUnit) ou da Venda
    public string TargetReference { get; private set; } // Ex: IMEI "354891828374651" ou Pedido "PO-2026-001"
    public Guid? InventoryUnitId { get; private set; }  // Vínculo com Catalog.InventoryUnit
    public Guid? ProductSkuId { get; private set; }     // Vínculo com Catalog.ProductSku
    public decimal AllocatedAmount { get; private set; } // Valor do frete incorporado
    public AllocationMethod Method { get; private set; }
    public decimal AllocationPercentage { get; private set; } // Ex: 33.33% se 1 de 3 celulares
    public string? Justification { get; private set; }
    public DateTime AllocatedAtUtc { get; private set; }
    public Guid AllocatedByUserId { get; private set; }

    private FleetTripAllocation()
    {
        TargetReference = string.Empty;
    }

    public FleetTripAllocation(
        Guid tenantId,
        Guid tripId,
        AllocationTargetType targetType,
        Guid targetId,
        string targetReference,
        decimal allocatedAmount,
        AllocationMethod method,
        decimal allocationPercentage,
        Guid allocatedByUserId,
        Guid? inventoryUnitId = null,
        Guid? productSkuId = null,
        string? justification = null) : base(tenantId)
    {
        if (tripId == Guid.Empty)
            throw new ArgumentException("Viagem é obrigatória para o rateio.", nameof(tripId));
        if (allocatedAmount <= 0)
            throw new ArgumentException("O valor rateado deve ser maior que zero.", nameof(allocatedAmount));
        if (string.IsNullOrWhiteSpace(targetReference))
            throw new ArgumentException("Referência do alvo de rateio é obrigatória.", nameof(targetReference));

        TripId = tripId;
        TargetType = targetType;
        TargetId = targetId;
        TargetReference = targetReference.Trim();
        AllocatedAmount = allocatedAmount;
        Method = method;
        AllocationPercentage = allocationPercentage;
        AllocatedByUserId = allocatedByUserId;
        InventoryUnitId = inventoryUnitId;
        ProductSkuId = productSkuId;
        Justification = justification?.Trim();
        AllocatedAtUtc = DateTime.UtcNow;
    }
}
