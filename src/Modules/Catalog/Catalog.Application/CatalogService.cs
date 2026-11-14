using Microsoft.EntityFrameworkCore;
using BuildingBlocks.Application;
using BuildingBlocks.Infrastructure;
using Catalog.Domain;

namespace Catalog.Application;

public interface ICatalogService
{
    // Categorias & Marcas
    Task<IReadOnlyList<CategoryResponse>> ListCategoriesAsync(CancellationToken ct = default);
    Task<CategoryResponse> CreateCategoryAsync(CreateCategoryRequest request, CancellationToken ct = default);
    Task<IReadOnlyList<BrandResponse>> ListBrandsAsync(CancellationToken ct = default);
    Task<BrandResponse> CreateBrandAsync(CreateBrandRequest request, CancellationToken ct = default);

    // Modelos & SKUs
    Task<IReadOnlyList<ProductModelResponse>> ListModelsAsync(string? search, Guid? categoryId, Guid? brandId, CancellationToken ct = default);
    Task<ProductModelResponse?> GetModelByIdAsync(Guid id, CancellationToken ct = default);
    Task<ProductModelResponse> CreateModelAsync(CreateProductModelRequest request, CancellationToken ct = default);
    Task<ProductSkuResponse> AddSkuAsync(Guid modelId, CreateProductSkuRequest request, CancellationToken ct = default);
    Task<ProductSkuResponse> UpdateSkuPriceAsync(Guid skuId, UpdateSkuPriceRequest request, CancellationToken ct = default);

    // Unidades Físicas / Serializadas / Usados
    Task<IReadOnlyList<InventoryUnitResponse>> ListUnitsAsync(Guid? skuId, string? searchSerialOrImei, UnitOperationalStatus? status, bool canViewCost, CancellationToken ct = default);
    Task<InventoryUnitResponse?> GetUnitByIdAsync(Guid id, bool canViewCost, CancellationToken ct = default);
    Task<InventoryUnitResponse> RegisterUnitAsync(RegisterInventoryUnitRequest request, bool canViewCost, CancellationToken ct = default);
    Task<InventoryUnitResponse> ApproveUnitForSaleAsync(Guid unitId, ApproveUnitForSaleRequest request, bool canViewCost, CancellationToken ct = default);
}

public class CatalogService : ICatalogService
{
    private readonly AppDbContext _dbContext;
    private readonly IExecutionContext _executionContext;

    public CatalogService(AppDbContext dbContext, IExecutionContext executionContext)
    {
        _dbContext = dbContext;
        _executionContext = executionContext;
    }

    public async Task<IReadOnlyList<CategoryResponse>> ListCategoriesAsync(CancellationToken ct = default)
    {
        return await _dbContext.ProductCategories
            .AsNoTracking()
            .OrderBy(c => c.Name)
            .Select(c => new CategoryResponse(c.Id, c.Name, c.Slug, c.ParentCategoryId, c.IsActive, c.CreatedAtUtc, c.Version))
            .ToListAsync(ct);
    }

    public async Task<CategoryResponse> CreateCategoryAsync(CreateCategoryRequest request, CancellationToken ct = default)
    {
        var tenantId = _executionContext.TenantId;
        var category = new ProductCategory(tenantId, request.Name, request.Slug, request.ParentCategoryId);

        _dbContext.ProductCategories.Add(category);
        await _dbContext.SaveChangesAsync(ct);

        return new CategoryResponse(category.Id, category.Name, category.Slug, category.ParentCategoryId, category.IsActive, category.CreatedAtUtc, category.Version);
    }

    public async Task<IReadOnlyList<BrandResponse>> ListBrandsAsync(CancellationToken ct = default)
    {
        return await _dbContext.ProductBrands
            .AsNoTracking()
            .OrderBy(b => b.Name)
            .Select(b => new BrandResponse(b.Id, b.Name, b.Description, b.IsActive, b.CreatedAtUtc, b.Version))
            .ToListAsync(ct);
    }

    public async Task<BrandResponse> CreateBrandAsync(CreateBrandRequest request, CancellationToken ct = default)
    {
        var tenantId = _executionContext.TenantId;
        var brand = new ProductBrand(tenantId, request.Name, request.Description);

        _dbContext.ProductBrands.Add(brand);
        await _dbContext.SaveChangesAsync(ct);

        return new BrandResponse(brand.Id, brand.Name, brand.Description, brand.IsActive, brand.CreatedAtUtc, brand.Version);
    }

    public async Task<IReadOnlyList<ProductModelResponse>> ListModelsAsync(string? search, Guid? categoryId, Guid? brandId, CancellationToken ct = default)
    {
        var query = _dbContext.ProductModels
            .Include(m => m.Brand)
            .Include(m => m.Category)
            .Include(m => m.Skus)
                .ThenInclude(s => s.InventoryUnits)
            .AsNoTracking();

        if (categoryId.HasValue) query = query.Where(m => m.CategoryId == categoryId.Value);
        if (brandId.HasValue) query = query.Where(m => m.BrandId == brandId.Value);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var clean = search.Trim().ToLower();
            query = query.Where(m => m.Name.ToLower().Contains(clean) || (m.Description != null && m.Description.ToLower().Contains(clean)));
        }

        var models = await query.OrderBy(m => m.Name).ToListAsync(ct);

        return models.Select(MapToModelResponse).ToList();
    }

    public async Task<ProductModelResponse?> GetModelByIdAsync(Guid id, CancellationToken ct = default)
    {
        var model = await _dbContext.ProductModels
            .Include(m => m.Brand)
            .Include(m => m.Category)
            .Include(m => m.Skus)
                .ThenInclude(s => s.InventoryUnits)
            .AsNoTracking()
            .FirstOrDefaultAsync(m => m.Id == id, ct);

        return model == null ? null : MapToModelResponse(model);
    }

    public async Task<ProductModelResponse> CreateModelAsync(CreateProductModelRequest request, CancellationToken ct = default)
    {
        var tenantId = _executionContext.TenantId;
        var model = new ProductModel(
            tenantId,
            request.Name,
            request.Kind,
            request.SerializationPolicy,
            request.BrandId,
            request.CategoryId,
            request.Description
        );

        _dbContext.ProductModels.Add(model);
        await _dbContext.SaveChangesAsync(ct);

        return await GetModelByIdAsync(model.Id, ct) ?? MapToModelResponse(model);
    }

    public async Task<ProductSkuResponse> AddSkuAsync(Guid modelId, CreateProductSkuRequest request, CancellationToken ct = default)
    {
        var model = await _dbContext.ProductModels
            .Include(m => m.Skus)
            .FirstOrDefaultAsync(m => m.Id == modelId, ct);

        if (model == null)
            throw new KeyNotFoundException($"Modelo de produto {modelId} não encontrado.");

        var sku = model.AddSku(
            request.SkuCode,
            request.VariantName,
            request.DefaultPrice,
            request.BarcodeEan,
            request.TechnicalSpecsJson
        );

        _dbContext.ProductSkus.Add(sku);
        await _dbContext.SaveChangesAsync(ct);

        return new ProductSkuResponse(
            sku.Id,
            sku.ProductModelId,
            sku.SkuCode,
            sku.VariantName,
            sku.BarcodeEan,
            sku.DefaultPrice,
            sku.TechnicalSpecsJson,
            sku.IsActive,
            sku.CreatedAtUtc,
            sku.Version,
            0
        );
    }

    public async Task<ProductSkuResponse> UpdateSkuPriceAsync(Guid skuId, UpdateSkuPriceRequest request, CancellationToken ct = default)
    {
        var sku = await _dbContext.ProductSkus
            .Include(s => s.InventoryUnits)
            .FirstOrDefaultAsync(s => s.Id == skuId, ct);

        if (sku == null)
            throw new KeyNotFoundException($"SKU {skuId} não encontrado.");

        if (request.ExpectedVersion != 0 && sku.Version != request.ExpectedVersion)
        {
            throw new DbUpdateConcurrencyException($"Conflito de versão no SKU {skuId}. Esperado: {request.ExpectedVersion}, Atual: {sku.Version}");
        }

        sku.UpdatePrice(request.NewPrice);
        await _dbContext.SaveChangesAsync(ct);

        var availableCount = sku.InventoryUnits.Count(u => u.OperationalStatus == UnitOperationalStatus.ApprovedForSale);

        return new ProductSkuResponse(
            sku.Id,
            sku.ProductModelId,
            sku.SkuCode,
            sku.VariantName,
            sku.BarcodeEan,
            sku.DefaultPrice,
            sku.TechnicalSpecsJson,
            sku.IsActive,
            sku.CreatedAtUtc,
            sku.Version,
            availableCount
        );
    }

    public async Task<IReadOnlyList<InventoryUnitResponse>> ListUnitsAsync(
        Guid? skuId, 
        string? searchSerialOrImei, 
        UnitOperationalStatus? status, 
        bool canViewCost, 
        CancellationToken ct = default)
    {
        var query = _dbContext.InventoryUnits
            .Include(u => u.ProductSku)
                .ThenInclude(s => s!.ProductModel)
            .AsNoTracking();

        if (skuId.HasValue) query = query.Where(u => u.ProductSkuId == skuId.Value);
        if (status.HasValue) query = query.Where(u => u.OperationalStatus == status.Value);
        if (!string.IsNullOrWhiteSpace(searchSerialOrImei))
        {
            var clean = searchSerialOrImei.Trim();
            query = query.Where(u => (u.SerialNumber != null && u.SerialNumber.Contains(clean)) ||
                                     (u.Imei1 != null && u.Imei1.Contains(clean)) ||
                                     (u.Imei2 != null && u.Imei2.Contains(clean)));
        }

        var units = await query.OrderByDescending(u => u.AcquisitionDateUtc).ToListAsync(ct);
        return units.Select(u => MapToUnitResponse(u, canViewCost)).ToList();
    }

    public async Task<InventoryUnitResponse?> GetUnitByIdAsync(Guid id, bool canViewCost, CancellationToken ct = default)
    {
        var unit = await _dbContext.InventoryUnits
            .Include(u => u.ProductSku)
                .ThenInclude(s => s!.ProductModel)
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == id, ct);

        return unit == null ? null : MapToUnitResponse(unit, canViewCost);
    }

    public async Task<InventoryUnitResponse> RegisterUnitAsync(RegisterInventoryUnitRequest request, bool canViewCost, CancellationToken ct = default)
    {
        var tenantId = _executionContext.TenantId;

        var sku = await _dbContext.ProductSkus
            .Include(s => s.ProductModel)
            .FirstOrDefaultAsync(s => s.Id == request.ProductSkuId, ct);

        if (sku == null)
            throw new KeyNotFoundException($"SKU {request.ProductSkuId} não encontrado.");

        // Validação da política de serialização
        if (sku.ProductModel?.SerializationPolicy == SerializationPolicy.StrictSerialized)
        {
            if (string.IsNullOrWhiteSpace(request.Imei1) && string.IsNullOrWhiteSpace(request.SerialNumber))
            {
                throw new ArgumentException("O modelo exige rastreabilidade serial rigorosa. Informe ao menos o IMEI 1 ou o Número de Série.");
            }
        }

        // Validação de IMEI duplicado por tenant
        if (!string.IsNullOrWhiteSpace(request.Imei1))
        {
            var existsImei1 = await _dbContext.InventoryUnits
                .AnyAsync(u => u.Imei1 == request.Imei1.Trim(), ct);
            if (existsImei1)
                throw new InvalidOperationException($"Já existe uma unidade física cadastrada com o IMEI 1 '{request.Imei1}'.");
        }

        if (!string.IsNullOrWhiteSpace(request.Imei2))
        {
            var existsImei2 = await _dbContext.InventoryUnits
                .AnyAsync(u => u.Imei2 == request.Imei2.Trim(), ct);
            if (existsImei2)
                throw new InvalidOperationException($"Já existe uma unidade física cadastrada com o IMEI 2 '{request.Imei2}'.");
        }

        var unit = new InventoryUnit(
            tenantId,
            request.ProductSkuId,
            request.Condition,
            request.AcquisitionCost,
            request.SerialNumber,
            request.Imei1,
            request.Imei2,
            request.Grade,
            request.BatteryHealthPercentage,
            request.SupplierPartyId,
            request.InspectionNotes
        );

        _dbContext.InventoryUnits.Add(unit);
        await _dbContext.SaveChangesAsync(ct);

        return await GetUnitByIdAsync(unit.Id, canViewCost, ct) ?? MapToUnitResponse(unit, canViewCost);
    }

    public async Task<InventoryUnitResponse> ApproveUnitForSaleAsync(Guid unitId, ApproveUnitForSaleRequest request, bool canViewCost, CancellationToken ct = default)
    {
        var unit = await _dbContext.InventoryUnits
            .Include(u => u.ProductSku)
                .ThenInclude(s => s!.ProductModel)
            .FirstOrDefaultAsync(u => u.Id == unitId, ct);

        if (unit == null)
            throw new KeyNotFoundException($"Unidade {unitId} não encontrada.");

        if (request.ExpectedVersion != 0 && unit.Version != request.ExpectedVersion)
        {
            throw new DbUpdateConcurrencyException($"Conflito de versão na unidade {unitId}. Esperado: {request.ExpectedVersion}, Atual: {unit.Version}");
        }

        unit.ApproveForSale(request.ApprovalNotes);
        await _dbContext.SaveChangesAsync(ct);

        return MapToUnitResponse(unit, canViewCost);
    }

    private static ProductModelResponse MapToModelResponse(ProductModel m) => new(
        m.Id,
        m.Name,
        m.Description,
        m.Kind,
        m.SerializationPolicy,
        m.BrandId,
        m.Brand?.Name,
        m.CategoryId,
        m.Category?.Name,
        m.IsActive,
        m.Skus.Select(s => new ProductSkuResponse(
            s.Id,
            s.ProductModelId,
            s.SkuCode,
            s.VariantName,
            s.BarcodeEan,
            s.DefaultPrice,
            s.TechnicalSpecsJson,
            s.IsActive,
            s.CreatedAtUtc,
            s.Version,
            s.InventoryUnits?.Count(u => u.OperationalStatus == UnitOperationalStatus.ApprovedForSale) ?? 0
        )).ToList(),
        m.CreatedAtUtc,
        m.Version
    );

    private static InventoryUnitResponse MapToUnitResponse(InventoryUnit u, bool canViewCost) => new(
        u.Id,
        u.ProductSkuId,
        u.ProductSku?.SkuCode,
        u.ProductSku?.ProductModel?.Name,
        u.SerialNumber,
        u.Imei1,
        u.Imei2,
        u.Condition,
        u.Grade,
        u.BatteryHealthPercentage,
        canViewCost ? u.AcquisitionCost : null,
        u.SupplierPartyId,
        u.OperationalStatus,
        u.InspectionNotes,
        u.AcquisitionDateUtc,
        u.Version
    );
}
