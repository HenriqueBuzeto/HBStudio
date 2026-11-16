using BuildingBlocks.Domain;

namespace FleetLogistics.Domain.Entities;

public enum PriceApprovalStatus
{
    PendingApproval = 1, // Sugestão gerada automaticamente, aguardando aprovação do sócio
    Approved = 2,        // Aprovado e publicado oficialmente no Catalog / PDV
    Adjusted = 3,        // Sócio ajustou com justificativa
    Rejected = 4         // Rejeitado
}

/// <summary>
/// Sugestão e Aprovação Comercial de Preço de Produto / Unidade Serializada (IMEI).
/// </summary>
public class ProductPriceSuggestion : TenantEntity
{
    public Guid BranchId { get; private set; }
    public Guid? InventoryUnitId { get; private set; } // Opcional se for para unidade específica (IMEI)
    public Guid ProductSkuId { get; private set; }
    public Guid? PricingPolicyId { get; private set; }
    public decimal ReferencePrice { get; private set; }            // Preço anunciado / base de negociação (ex: R$ 1.000,00)
    public decimal TargetNegotiationPrice { get; private set; }     // Proposta-alvo com desconto (ex: R$ 850,00)
    public decimal RealAcquisitionCost { get; private set; }        // Custo efetivo pago na compra (ex: R$ 1.000,00)
    public decimal AllocatedLogisticsCost { get; private set; }     // Frete real ou estimado alocado (ex: R$ 42,00 ou R$ 50,00)
    public decimal CommercialProvisions { get; private set; }       // Provisões comerciais adicionais (entrega, taxas)
    public decimal TotalCostBase { get; private set; }              // Base de Custo Total = Aquisição + Frete + Provisões
    public decimal MarkupRateApplied { get; private set; }          // Ex: 0.30 (30%)
    public decimal CalculatedSuggestedPrice { get; private set; }   // Preço sugerido calculado matematicamente
    public decimal MinimumAllowedPrice { get; private set; }        // Preço piso pela margem mínima
    public decimal ApprovedFinalPrice { get; private set; }         // Preço oficial publicado
    public PriceApprovalStatus Status { get; private set; }
    public string CalculationBreakdownJson { get; private set; }    // Memória de cálculo detalhada auditável
    public Guid? ApprovedByUserId { get; private set; }
    public DateTime? ApprovedAtUtc { get; private set; }
    public string? ApprovalNotes { get; private set; }

    private ProductPriceSuggestion()
    {
        CalculationBreakdownJson = string.Empty;
    }

    public ProductPriceSuggestion(
        Guid tenantId,
        Guid branchId,
        Guid productSkuId,
        decimal referencePrice,
        decimal targetNegotiationPrice,
        decimal realAcquisitionCost,
        decimal allocatedLogisticsCost,
        decimal commercialProvisions,
        decimal markupRateApplied,
        decimal calculatedSuggestedPrice,
        decimal minimumAllowedPrice,
        string calculationBreakdownJson,
        Guid? inventoryUnitId = null,
        Guid? pricingPolicyId = null) : base(tenantId)
    {
        if (productSkuId == Guid.Empty)
            throw new ArgumentException("ProductSkuId é obrigatório.", nameof(productSkuId));
        if (realAcquisitionCost < 0)
            throw new ArgumentException("Custo real de aquisição não pode ser negativo.", nameof(realAcquisitionCost));

        BranchId = branchId;
        ProductSkuId = productSkuId;
        InventoryUnitId = inventoryUnitId;
        PricingPolicyId = pricingPolicyId;
        ReferencePrice = referencePrice;
        TargetNegotiationPrice = targetNegotiationPrice;
        RealAcquisitionCost = realAcquisitionCost;
        AllocatedLogisticsCost = allocatedLogisticsCost;
        CommercialProvisions = commercialProvisions;
        TotalCostBase = realAcquisitionCost + allocatedLogisticsCost + commercialProvisions;
        MarkupRateApplied = markupRateApplied;
        CalculatedSuggestedPrice = calculatedSuggestedPrice;
        MinimumAllowedPrice = minimumAllowedPrice;
        ApprovedFinalPrice = calculatedSuggestedPrice; // Inicialmente igual ao sugerido
        Status = PriceApprovalStatus.PendingApproval;
        CalculationBreakdownJson = calculationBreakdownJson;
    }

    public void Approve(Guid approvedByUserId, decimal? customApprovedPrice = null, string? approvalNotes = null)
    {
        ApprovedByUserId = approvedByUserId;
        ApprovedAtUtc = DateTime.UtcNow;

        if (customApprovedPrice.HasValue && customApprovedPrice.Value > 0)
        {
            ApprovedFinalPrice = customApprovedPrice.Value;
            Status = customApprovedPrice.Value == CalculatedSuggestedPrice ? PriceApprovalStatus.Approved : PriceApprovalStatus.Adjusted;
        }
        else
        {
            ApprovedFinalPrice = CalculatedSuggestedPrice;
            Status = PriceApprovalStatus.Approved;
        }

        ApprovalNotes = approvalNotes?.Trim();
    }

    public void Reject(Guid rejectedByUserId, string reason)
    {
        ApprovedByUserId = rejectedByUserId;
        ApprovedAtUtc = DateTime.UtcNow;
        Status = PriceApprovalStatus.Rejected;
        ApprovalNotes = $"Rejeitado: {reason.Trim()}";
    }
}
