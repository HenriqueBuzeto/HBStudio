using BuildingBlocks.Domain;

namespace FleetLogistics.Domain.Entities;

public enum PricingPolicyScope
{
    GlobalTenant = 1,      // Padrão geral da empresa
    Category = 2,          // Por Categoria de produto (ex: Smartphones, Acessórios)
    Brand = 3,             // Por Marca (ex: Apple, Samsung)
    Model = 4,             // Por Modelo específico (ex: iPhone 14 Pro Max)
    Sku = 5,               // Por SKU específico
    ItemCondition = 6      // Por Condição (Novo vs Usado PreOwned)
}

public enum PricingRoundingRule
{
    None = 0,              // Preço exato matemático (centavos calculados)
    EndWithNineNine = 1,   // Terminar em ,99 (ex: R$ 1.499,99)
    EndWithNineZero = 2,   // Terminar em ,90 (ex: R$ 1.490,90)
    RoundToWhole = 3       // Arredondar para o real mais próximo (ex: R$ 1.490,00)
}

/// <summary>
/// Política de Precificação Comercial e Margens Configuráveis da HB Studio.
/// </summary>
public class ProductPricingPolicy : TenantEntity
{
    public Guid BranchId { get; private set; }
    public string Name { get; private set; }                       // Ex: "Regra Padrão iPhones Usados"
    public PricingPolicyScope Scope { get; private set; }
    public Guid? TargetCategoryId { get; private set; }
    public Guid? TargetBrandId { get; private set; }
    public Guid? TargetModelId { get; private set; }
    public Guid? TargetSkuId { get; private set; }
    public int? TargetCondition { get; private set; }              // 1=BrandNew, 2=PreOwned
    public decimal TargetAcquisitionDiscountRate { get; private set; } // Ex: 0.15m (15% de desconto-alvo na COMPRA de usados)
    public decimal TargetMarkupRate { get; private set; }             // Ex: 0.30m (30% de markup de revenda sobre o custo total)
    public decimal MaxCounterDiscountRate { get; private set; }       // Ex: 0.05m (5% de desconto comercial máximo permitido no BALCÃO/PDV)
    public decimal TargetMinMarginRate { get; private set; }          // Ex: 0.15m (15% de margem líquida mínima permitida)
    public decimal EstimatedPickupLogisticsRate { get; private set; } // Ex: 0.05m (5% provisão de frete para retirada)
    public decimal EstimatedDeliveryLogisticsRate { get; private set; } // Ex: 0.10m (10% provisão de frete para entrega)
    public decimal OtherCommercialCostRate { get; private set; }      // Ex: 0.03m (3% taxas cartão/comercial)
    public PricingRoundingRule RoundingRule { get; private set; }
    public bool PreferRealCostOverEstimate { get; private set; } = true; // Se houver frete real apurado, substitui estimativa
    public bool IsActive { get; private set; } = true;
    public int VersionNumber { get; private set; } = 1;
    public string? Description { get; private set; }

    private ProductPricingPolicy()
    {
        Name = string.Empty;
    }

    public ProductPricingPolicy(
        Guid tenantId,
        Guid branchId,
        string name,
        PricingPolicyScope scope,
        decimal targetAcquisitionDiscountRate,
        decimal targetMarkupRate,
        decimal targetMinMarginRate,
        decimal maxCounterDiscountRate = 0.05m,
        decimal estimatedPickupLogisticsRate = 0.05m,
        decimal estimatedDeliveryLogisticsRate = 0.10m,
        decimal otherCommercialCostRate = 0m,
        PricingRoundingRule roundingRule = PricingRoundingRule.EndWithNineZero,
        bool preferRealCostOverEstimate = true,
        Guid? targetCategoryId = null,
        Guid? targetBrandId = null,
        Guid? targetModelId = null,
        Guid? targetSkuId = null,
        int? targetCondition = null,
        string? description = null) : base(tenantId)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Nome da política é obrigatório.", nameof(name));
        if (targetMarkupRate < 0)
            throw new ArgumentException("Markup não pode ser negativo.", nameof(targetMarkupRate));
        if (maxCounterDiscountRate < 0 || maxCounterDiscountRate > 0.50m)
            throw new ArgumentException("Desconto de balcão deve estar entre 0% e 50%.", nameof(maxCounterDiscountRate));

        BranchId = branchId;
        Name = name.Trim();
        Scope = scope;
        TargetAcquisitionDiscountRate = targetAcquisitionDiscountRate;
        TargetMarkupRate = targetMarkupRate;
        TargetMinMarginRate = targetMinMarginRate;
        MaxCounterDiscountRate = maxCounterDiscountRate;
        EstimatedPickupLogisticsRate = estimatedPickupLogisticsRate;
        EstimatedDeliveryLogisticsRate = estimatedDeliveryLogisticsRate;
        OtherCommercialCostRate = otherCommercialCostRate;
        RoundingRule = roundingRule;
        PreferRealCostOverEstimate = preferRealCostOverEstimate;
        TargetCategoryId = targetCategoryId;
        TargetBrandId = targetBrandId;
        TargetModelId = targetModelId;
        TargetSkuId = targetSkuId;
        TargetCondition = targetCondition;
        Description = description?.Trim();
        IsActive = true;
        VersionNumber = 1;
    }

    public void UpdateRules(
        string name,
        decimal targetAcquisitionDiscountRate,
        decimal targetMarkupRate,
        decimal targetMinMarginRate,
        decimal maxCounterDiscountRate,
        decimal estimatedPickupLogisticsRate,
        decimal estimatedDeliveryLogisticsRate,
        decimal otherCommercialCostRate,
        PricingRoundingRule roundingRule,
        bool preferRealCostOverEstimate,
        string? description)
    {
        Name = name.Trim();
        TargetAcquisitionDiscountRate = targetAcquisitionDiscountRate;
        TargetMarkupRate = targetMarkupRate;
        TargetMinMarginRate = targetMinMarginRate;
        MaxCounterDiscountRate = maxCounterDiscountRate;
        EstimatedPickupLogisticsRate = estimatedPickupLogisticsRate;
        EstimatedDeliveryLogisticsRate = estimatedDeliveryLogisticsRate;
        OtherCommercialCostRate = otherCommercialCostRate;
        RoundingRule = roundingRule;
        PreferRealCostOverEstimate = preferRealCostOverEstimate;
        Description = description?.Trim();
        VersionNumber++;
    }

    public void SetActive(bool active)
    {
        IsActive = active;
    }
}
