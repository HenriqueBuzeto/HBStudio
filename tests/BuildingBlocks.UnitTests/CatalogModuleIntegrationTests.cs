using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using BuildingBlocks.Domain;
using BuildingBlocks.Infrastructure;
using BuildingBlocks.Security;
using Catalog.Application;
using Catalog.Domain;
using Xunit;

namespace BuildingBlocks.UnitTests;

public class CatalogModuleIntegrationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private const string PostgresTestConn = "Host=127.0.0.1;Port=5433;Database=hbstudio_erp_test;Username=postgres;Password=;";
    private readonly JwtTokenService _jwtTokenService = new("HBStudioEnterpriseErpSuperSecretKey20261113!");

    public CatalogModuleIntegrationTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task CreateCategoryAndBrand_ShouldSucceed_AndPersistInPostgres()
    {
        var tenantId = Guid.NewGuid();
        var client = _factory.CreateClient();

        var token = _jwtTokenService.GenerateToken(tenantId, null, Guid.NewGuid(), "gerente@hbstudio.com.br", new[] { PermissionCatalog.CatalogProductsView, PermissionCatalog.CatalogProductsManage });
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token.AccessToken);

        // 1. Criar Categoria
        var catReq = new CreateCategoryRequest("Smartphones", "smartphones", null);
        var catRes = await client.PostAsJsonAsync("/api/catalog/categories", catReq);
        catRes.StatusCode.Should().Be(HttpStatusCode.Created);
        var cat = await catRes.Content.ReadFromJsonAsync<CategoryResponse>();
        cat!.Name.Should().Be("Smartphones");

        // 2. Criar Marca
        var brandReq = new CreateBrandRequest("Apple", "Fabricante oficial de iPhones");
        var brandRes = await client.PostAsJsonAsync("/api/catalog/brands", brandReq);
        brandRes.StatusCode.Should().Be(HttpStatusCode.Created);
        var brand = await brandRes.Content.ReadFromJsonAsync<BrandResponse>();
        brand!.Name.Should().Be("Apple");

        // 3. Validar no banco PostgreSQL real
        var options = new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(PostgresTestConn).Options;
        using var context = new AppDbContext(options);
        var dbCat = await context.ProductCategories.FirstOrDefaultAsync(c => c.Id == cat.Id);
        var dbBrand = await context.ProductBrands.FirstOrDefaultAsync(b => b.Id == brand.Id);

        dbCat.Should().NotBeNull();
        dbBrand.Should().NotBeNull();
        dbCat!.TenantId.Should().Be(tenantId);
        dbBrand!.TenantId.Should().Be(tenantId);
    }

    [Fact]
    public async Task CreateProductModel_WithUniqueSku_ShouldEnforceTenantScope()
    {
        var tenantId = Guid.NewGuid();
        var client = _factory.CreateClient();

        var token = _jwtTokenService.GenerateToken(tenantId, null, Guid.NewGuid(), "cadastrador@hbstudio.com.br", new[] { PermissionCatalog.CatalogProductsView, PermissionCatalog.CatalogProductsManage });
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token.AccessToken);

        // Criar Marca e Categoria
        var brandRes = await client.PostAsJsonAsync("/api/catalog/brands", new CreateBrandRequest("Samsung", "Eletrônicos e Celulares"));
        var brand = await brandRes.Content.ReadFromJsonAsync<BrandResponse>();

        var catRes = await client.PostAsJsonAsync("/api/catalog/categories", new CreateCategoryRequest("Smartphones Samsung", "smartphones-samsung", null));
        var cat = await catRes.Content.ReadFromJsonAsync<CategoryResponse>();

        // Criar Modelo
        var modelReq = new CreateProductModelRequest(
            Name: "Galaxy S23 Ultra",
            Kind: ProductKind.Standard,
            SerializationPolicy: SerializationPolicy.StrictSerialized,
            BrandId: brand!.Id,
            CategoryId: cat!.Id,
            Description: "Linha premium Snapdragon 8 Gen 2"
        );
        var modelRes = await client.PostAsJsonAsync("/api/catalog/models", modelReq);
        modelRes.StatusCode.Should().Be(HttpStatusCode.Created);
        var model = await modelRes.Content.ReadFromJsonAsync<ProductModelResponse>();
        model.Should().NotBeNull();

        // Adicionar SKU
        var skuReq = new CreateProductSkuRequest(
            SkuCode: "GAL-S23U-256-BLK",
            VariantName: "256GB - Preto Fantasma",
            DefaultPrice: 4299.00m,
            BarcodeEan: "7892509123456",
            TechnicalSpecsJson: "{\"storage\":\"256GB\",\"ram\":\"12GB\",\"color\":\"Preto Fantasma\"}"
        );
        var skuRes = await client.PostAsJsonAsync($"/api/catalog/models/{model!.Id}/skus", skuReq);
        skuRes.StatusCode.Should().Be(HttpStatusCode.Created);
        var sku = await skuRes.Content.ReadFromJsonAsync<ProductSkuResponse>();
        sku!.SkuCode.Should().Be("GAL-S23U-256-BLK");

        // Validar no PostgreSQL
        var options = new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(PostgresTestConn).Options;
        using var context = new AppDbContext(options);
        var dbSku = await context.ProductSkus.FirstOrDefaultAsync(s => s.Id == sku.Id);
        dbSku.Should().NotBeNull();
        dbSku!.DefaultPrice.Should().Be(4299.00m);
        dbSku.TenantId.Should().Be(tenantId);
    }

    [Fact]
    public async Task RegisterInventoryUnit_WithDuplicateImeiInSameTenant_ShouldBeRejected()
    {
        var tenantId = Guid.NewGuid();
        var client = _factory.CreateClient();

        var token = _jwtTokenService.GenerateToken(tenantId, null, Guid.NewGuid(), "tecnico@hbstudio.com.br", new[] { PermissionCatalog.CatalogProductsView, PermissionCatalog.CatalogProductsManage, PermissionCatalog.CatalogCostView });
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token.AccessToken);

        // Criar estrutura base
        var brandRes = await client.PostAsJsonAsync("/api/catalog/brands", new CreateBrandRequest("Apple Inc", null));
        var brand = await brandRes.Content.ReadFromJsonAsync<BrandResponse>();
        var catRes = await client.PostAsJsonAsync("/api/catalog/categories", new CreateCategoryRequest("iPhones Usados", "iphones-usados", null));
        var cat = await catRes.Content.ReadFromJsonAsync<CategoryResponse>();

        var modelRes = await client.PostAsJsonAsync("/api/catalog/models", new CreateProductModelRequest(
            Name: "iPhone 13 128GB",
            Kind: ProductKind.Standard,
            SerializationPolicy: SerializationPolicy.StrictSerialized,
            BrandId: brand!.Id,
            CategoryId: cat!.Id,
            Description: null
        ));
        var model = await modelRes.Content.ReadFromJsonAsync<ProductModelResponse>();

        var skuRes = await client.PostAsJsonAsync($"/api/catalog/models/{model!.Id}/skus", new CreateProductSkuRequest(
            SkuCode: "IPH13-128-MID",
            VariantName: "128GB Meia-noite",
            DefaultPrice: 2899.00m,
            BarcodeEan: null,
            TechnicalSpecsJson: null
        ));
        var sku = await skuRes.Content.ReadFromJsonAsync<ProductSkuResponse>();

        // 1. Cadastrar primeira unidade com IMEI 352000111222333
        var unitReq1 = new RegisterInventoryUnitRequest(
            ProductSkuId: sku!.Id,
            Condition: ItemCondition.PreOwned,
            AcquisitionCost: 1900.00m,
            SerialNumber: "DX3G80XXXXX",
            Imei1: "352000111222333",
            Imei2: "352000111222334",
            Grade: CosmeticGrade.GradeA,
            BatteryHealthPercentage: 89,
            SupplierPartyId: null,
            InspectionNotes: "Bateria original, tela impecável, sem arranhões"
        );
        var unitRes1 = await client.PostAsJsonAsync("/api/catalog/units", unitReq1);
        unitRes1.StatusCode.Should().Be(HttpStatusCode.Created);

        // 2. Tentar cadastrar segunda unidade com o MESMO IMEI 1
        var unitReq2 = new RegisterInventoryUnitRequest(
            ProductSkuId: sku.Id,
            Condition: ItemCondition.PreOwned,
            AcquisitionCost: 1850.00m,
            SerialNumber: "DX3G99YYYYY",
            Imei1: "352000111222333", // Duplicado!
            Imei2: null,
            Grade: CosmeticGrade.GradeB,
            BatteryHealthPercentage: 85,
            SupplierPartyId: null,
            InspectionNotes: "Tentativa de duplicidade"
        );
        var unitRes2 = await client.PostAsJsonAsync("/api/catalog/units", unitReq2);

        // Assert: Rejeitado como BadRequest (400) com mensagem clara
        unitRes2.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task InventoryUnit_AcquisitionCost_ShouldBeHidden_WhenUserLacksCatalogCostViewPermission()
    {
        var tenantId = Guid.NewGuid();
        var client = _factory.CreateClient();

        // 1. Criar unidade usando usuário com permissão de custo
        var managerToken = _jwtTokenService.GenerateToken(tenantId, null, Guid.NewGuid(), "gerente@hbstudio.com.br", new[] { PermissionCatalog.CatalogProductsView, PermissionCatalog.CatalogProductsManage, PermissionCatalog.CatalogCostView });
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", managerToken.AccessToken);

        var brandRes = await client.PostAsJsonAsync("/api/catalog/brands", new CreateBrandRequest("Xiaomi", null));
        var brand = await brandRes.Content.ReadFromJsonAsync<BrandResponse>();
        var catRes = await client.PostAsJsonAsync("/api/catalog/categories", new CreateCategoryRequest("Redmi", "redmi", null));
        var cat = await catRes.Content.ReadFromJsonAsync<CategoryResponse>();

        var modelRes = await client.PostAsJsonAsync("/api/catalog/models", new CreateProductModelRequest("Redmi Note 12", ProductKind.Standard, SerializationPolicy.StrictSerialized, brand!.Id, cat!.Id, null));
        var model = await modelRes.Content.ReadFromJsonAsync<ProductModelResponse>();

        var skuRes = await client.PostAsJsonAsync($"/api/catalog/models/{model!.Id}/skus", new CreateProductSkuRequest("RDM-N12-128", "128GB Azul", 1200.00m, null, null));
        var sku = await skuRes.Content.ReadFromJsonAsync<ProductSkuResponse>();

        var unitRes = await client.PostAsJsonAsync("/api/catalog/units", new RegisterInventoryUnitRequest(
            ProductSkuId: sku!.Id,
            Condition: ItemCondition.BrandNew,
            AcquisitionCost: 750.00m,
            SerialNumber: "SN-RDM-888999",
            Imei1: "860000111222333",
            Imei2: null,
            Grade: CosmeticGrade.None,
            BatteryHealthPercentage: 100,
            SupplierPartyId: null,
            InspectionNotes: "Lacrado de distribuidor"
        ));
        var unit = await unitRes.Content.ReadFromJsonAsync<InventoryUnitResponse>();
        unit!.AcquisitionCost.Should().Be(750.00m); // Gerente visualiza custo

        // 2. Consultar como Vendedor comum (sem catalog.cost.view)
        var sellerToken = _jwtTokenService.GenerateToken(tenantId, null, Guid.NewGuid(), "vendedor@hbstudio.com.br", new[] { PermissionCatalog.CatalogProductsView });
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", sellerToken.AccessToken);

        var sellerUnitRes = await client.GetAsync($"/api/catalog/units/{unit.Id}");
        sellerUnitRes.StatusCode.Should().Be(HttpStatusCode.OK);
        var sellerUnit = await sellerUnitRes.Content.ReadFromJsonAsync<InventoryUnitResponse>();

        // Assert: Custo é estritamente omitido (null)
        sellerUnit.Should().NotBeNull();
        sellerUnit!.AcquisitionCost.Should().BeNull();
    }

    [Fact]
    public async Task OCC_SimultaneousSkuPriceUpdate_ShouldReturn409Conflict()
    {
        var tenantId = Guid.NewGuid();
        var client = _factory.CreateClient();

        var token = _jwtTokenService.GenerateToken(tenantId, null, Guid.NewGuid(), "diretor@hbstudio.com.br", new[] { PermissionCatalog.CatalogProductsView, PermissionCatalog.CatalogProductsManage });
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token.AccessToken);

        var brandRes = await client.PostAsJsonAsync("/api/catalog/brands", new CreateBrandRequest("Sony", null));
        var brand = await brandRes.Content.ReadFromJsonAsync<BrandResponse>();
        var catRes = await client.PostAsJsonAsync("/api/catalog/categories", new CreateCategoryRequest("Consoles", "consoles", null));
        var cat = await catRes.Content.ReadFromJsonAsync<CategoryResponse>();

        var modelRes = await client.PostAsJsonAsync("/api/catalog/models", new CreateProductModelRequest("PlayStation 5 Slim", ProductKind.Standard, SerializationPolicy.StrictSerialized, brand!.Id, cat!.Id, null));
        var model = await modelRes.Content.ReadFromJsonAsync<ProductModelResponse>();

        var skuRes = await client.PostAsJsonAsync($"/api/catalog/models/{model!.Id}/skus", new CreateProductSkuRequest("PS5-SLIM-1TB", "1TB Digital", 3499.00m, null, null));
        var sku = await skuRes.Content.ReadFromJsonAsync<ProductSkuResponse>();

        // Primeiro Update com a versão original
        var update1Res = await client.PutAsJsonAsync($"/api/catalog/skus/{sku!.Id}/price", new UpdateSkuPriceRequest(3399.00m, sku.Version));
        update1Res.StatusCode.Should().Be(HttpStatusCode.OK);

        // Segundo Update com versão defasada (sku.Version original)
        var update2Res = await client.PutAsJsonAsync($"/api/catalog/skus/{sku.Id}/price", new UpdateSkuPriceRequest(3299.00m, sku.Version));

        // Assert: HTTP 409 Conflict retornado
        update2Res.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }
}
