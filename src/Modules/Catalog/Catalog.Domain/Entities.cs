using BuildingBlocks.Domain;

namespace Catalog.Domain;

public class ProductCategory : TenantEntity
{
    public string Name { get; private set; }
    public string Slug { get; private set; }
    public Guid? ParentCategoryId { get; private set; }
    public ProductCategory? ParentCategory { get; private set; }
    public bool IsActive { get; private set; } = true;

    private readonly List<ProductCategory> _subCategories = [];
    public IReadOnlyCollection<ProductCategory> SubCategories => _subCategories.AsReadOnly();

    private ProductCategory() { Name = string.Empty; Slug = string.Empty; }

    public ProductCategory(Guid tenantId, string name, string slug, Guid? parentCategoryId = null) : base(tenantId)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("O nome da categoria é obrigatório.", nameof(name));
        if (string.IsNullOrWhiteSpace(slug))
            throw new ArgumentException("O slug da categoria é obrigatório.", nameof(slug));

        Name = name.Trim();
        Slug = slug.Trim().ToLower();
        ParentCategoryId = parentCategoryId;
    }

    public void Update(string name, string slug, Guid? parentCategoryId)
    {
        if (parentCategoryId.HasValue && parentCategoryId.Value == Id)
            throw new InvalidOperationException("Uma categoria não pode ser subcategoria de si mesma.");

        Name = name.Trim();
        Slug = slug.Trim().ToLower();
        ParentCategoryId = parentCategoryId;
    }
}

public class ProductBrand : TenantEntity
{
    public string Name { get; private set; }
    public string? Description { get; private set; }
    public bool IsActive { get; private set; } = true;

    private ProductBrand() { Name = string.Empty; }

    public ProductBrand(Guid tenantId, string name, string? description = null) : base(tenantId)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("O nome da marca é obrigatório.", nameof(name));

        Name = name.Trim();
        Description = description?.Trim();
    }
}

public enum ProductKind
{
    Standard = 1,          // Mercadoria revenda / produto acabado
    RawMaterial = 2,       // Insumo (filamento 3D, resina, parafusos)
    SparePart = 3,         // Peça de reposição (telas de celular, conectores, baterias)
    Service = 4,           // Mão de obra / serviço técnico
    Manufactured3D = 5     // Peça impressa sob demanda
}

public enum SerializationPolicy
{
    None = 0,             // Sem controle individual (e.g. cabos simples, películas)
    Optional = 1,         // Serial opcional
    StrictSerialized = 2  // Obrigatório IMEI/Serial único (celulares, notebooks, placas)
}

public class ProductModel : TenantEntity
{
    public string Name { get; private set; } // Ex: "iPhone 14 Pro Max", "Filamento PLA Premium", "Display OLED iPhone 13"
    public string? Description { get; private set; }
    public ProductKind Kind { get; private set; }
    public SerializationPolicy SerializationPolicy { get; private set; }
    public Guid BrandId { get; private set; }
    public ProductBrand? Brand { get; private set; }
    public Guid CategoryId { get; private set; }
    public ProductCategory? Category { get; private set; }
    public bool IsActive { get; private set; } = true;

    private readonly List<ProductSku> _skus = [];
    public IReadOnlyCollection<ProductSku> Skus => _skus.AsReadOnly();

    private ProductModel() { Name = string.Empty; }

    public ProductModel(
        Guid tenantId,
        string name,
        ProductKind kind,
        SerializationPolicy serializationPolicy,
        Guid brandId,
        Guid categoryId,
        string? description = null) : base(tenantId)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("O nome do modelo de produto é obrigatório.", nameof(name));

        Name = name.Trim();
        Kind = kind;
        SerializationPolicy = serializationPolicy;
        BrandId = brandId;
        CategoryId = categoryId;
        Description = description?.Trim();
    }

    public ProductSku AddSku(
        string skuCode,
        string variantName,
        decimal defaultPrice,
        string? barcodeEan = null,
        string? technicalSpecsJson = null)
    {
        var sku = new ProductSku(
            TenantId,
            Id,
            skuCode,
            variantName,
            defaultPrice,
            barcodeEan,
            technicalSpecsJson
        );
        _skus.Add(sku);
        return sku;
    }
}

public class ProductSku : TenantEntity
{
    public Guid ProductModelId { get; private set; }
    public ProductModel? ProductModel { get; private set; }
    public string SkuCode { get; private set; } // SKU interno único por tenant (ex: "IPH14PM-128-PURPLE")
    public string VariantName { get; private set; } // Ex: "128GB - Roxo Profundo"
    public string? BarcodeEan { get; private set; }
    public decimal DefaultPrice { get; private set; }
    public string? TechnicalSpecsJson { get; private set; } // JSON com especificações (RAM, Cor, Voltagem, Diâmetro)
    public bool IsActive { get; private set; } = true;

    private readonly List<InventoryUnit> _inventoryUnits = [];
    public IReadOnlyCollection<InventoryUnit> InventoryUnits => _inventoryUnits.AsReadOnly();

    private ProductSku() { SkuCode = string.Empty; VariantName = string.Empty; }

    public ProductSku(
        Guid tenantId,
        Guid productModelId,
        string skuCode,
        string variantName,
        decimal defaultPrice,
        string? barcodeEan = null,
        string? technicalSpecsJson = null) : base(tenantId)
    {
        if (string.IsNullOrWhiteSpace(skuCode))
            throw new ArgumentException("O código SKU é obrigatório.", nameof(skuCode));
        if (string.IsNullOrWhiteSpace(variantName))
            throw new ArgumentException("O nome da variante é obrigatório.", nameof(variantName));
        if (defaultPrice < 0)
            throw new ArgumentException("O preço padrão não pode ser negativo.", nameof(defaultPrice));

        ProductModelId = productModelId;
        SkuCode = skuCode.Trim().ToUpper();
        VariantName = variantName.Trim();
        DefaultPrice = defaultPrice;
        BarcodeEan = string.IsNullOrWhiteSpace(barcodeEan) ? null : barcodeEan.Trim();
        TechnicalSpecsJson = technicalSpecsJson;
    }

    public void UpdatePrice(decimal newPrice)
    {
        if (newPrice < 0)
            throw new ArgumentException("O preço não pode ser negativo.", nameof(newPrice));
        DefaultPrice = newPrice;
    }
}

public enum ItemCondition
{
    BrandNew = 1,       // Novo (lacrado de fábrica)
    PreOwned = 2,       // Usado (adquirido no balcão / troca / recompra)
    Refurbished = 3,    // Recondicionado pela assistência técnica
    OpenBox = 4         // Mostruário / Caixa aberta
}

public enum CosmeticGrade
{
    GradeA = 1, // Impecável, sem marcas visíveis
    GradeB = 2, // Leves sinais de uso, micro-riscos imperceptíveis à distância
    GradeC = 3, // Marcas visíveis de uso, arranhões ou pequenos amassados
    None = 0    // Não aplicável (novo ou insumo)
}

public enum UnitOperationalStatus
{
    AcquiredPendingInspection = 1, // Recebido, aguardando checklist técnico
    InInspection = 2,              // Em bancada de testes
    ApprovedForSale = 3,           // Liberado e precificado para venda
    Quarantined = 4,               // Apresentou vício/defeito durante teste
    Sold = 5                       // Faturado no PDV / Venda
}

public class InventoryUnit : TenantEntity
{
    public Guid ProductSkuId { get; private set; }
    public ProductSku? ProductSku { get; private set; }
    public string? SerialNumber { get; private set; }
    public string? Imei1 { get; private set; }
    public string? Imei2 { get; private set; }
    public ItemCondition Condition { get; private set; }
    public CosmeticGrade Grade { get; private set; }
    public int? BatteryHealthPercentage { get; private set; } // Ex: 88%
    public decimal AcquisitionCost { get; private set; }     // Custo real individual (sigiloso)
    public Guid? SupplierPartyId { get; private set; }       // Fornecedor ou Cliente que vendeu no balcão
    public UnitOperationalStatus OperationalStatus { get; private set; }
    public string? InspectionNotes { get; private set; }
    public DateTime AcquisitionDateUtc { get; private set; }

    private InventoryUnit() { }

    public InventoryUnit(
        Guid tenantId,
        Guid productSkuId,
        ItemCondition condition,
        decimal acquisitionCost,
        string? serialNumber = null,
        string? imei1 = null,
        string? imei2 = null,
        CosmeticGrade grade = CosmeticGrade.None,
        int? batteryHealthPercentage = null,
        Guid? supplierPartyId = null,
        string? inspectionNotes = null) : base(tenantId)
    {
        if (acquisitionCost < 0)
            throw new ArgumentException("O custo de aquisição não pode ser negativo.", nameof(acquisitionCost));

        ProductSkuId = productSkuId;
        Condition = condition;
        AcquisitionCost = acquisitionCost;
        SerialNumber = string.IsNullOrWhiteSpace(serialNumber) ? null : serialNumber.Trim();
        Imei1 = string.IsNullOrWhiteSpace(imei1) ? null : imei1.Trim();
        Imei2 = string.IsNullOrWhiteSpace(imei2) ? null : imei2.Trim();
        Grade = grade;
        BatteryHealthPercentage = batteryHealthPercentage;
        SupplierPartyId = supplierPartyId;
        InspectionNotes = inspectionNotes?.Trim();
        OperationalStatus = UnitOperationalStatus.AcquiredPendingInspection;
        AcquisitionDateUtc = DateTime.UtcNow;
    }

    public void ApproveForSale(string? approvalNotes = null)
    {
        OperationalStatus = UnitOperationalStatus.ApprovedForSale;
        if (!string.IsNullOrWhiteSpace(approvalNotes))
        {
            InspectionNotes = string.IsNullOrWhiteSpace(InspectionNotes)
                ? approvalNotes.Trim()
                : $"{InspectionNotes} | Aprovação: {approvalNotes.Trim()}";
        }
    }

    public void MarkInInspection()
    {
        OperationalStatus = UnitOperationalStatus.InInspection;
    }

    public void MarkQuarantined(string reason)
    {
        OperationalStatus = UnitOperationalStatus.Quarantined;
        InspectionNotes = string.IsNullOrWhiteSpace(InspectionNotes)
            ? $"Quarentena: {reason.Trim()}"
            : $"{InspectionNotes} | Quarentena: {reason.Trim()}";
    }

    public void MarkSold()
    {
        if (OperationalStatus != UnitOperationalStatus.ApprovedForSale)
            throw new InvalidOperationException($"Não é possível vender uma unidade física com status '{OperationalStatus}'. Deve estar 'ApprovedForSale'.");

        OperationalStatus = UnitOperationalStatus.Sold;
    }
}
