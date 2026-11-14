using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using BuildingBlocks.Domain;
using BuildingBlocks.Infrastructure;
using BuildingBlocks.Security;
using IdentityAccess.Domain;
using Catalog.Domain;
using Inventory.Domain;
using Inventory.Application;

namespace BuildingBlocks.UnitTests;

public class InventoryModuleIntegrationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly JwtTokenService _jwtTokenService;

    public InventoryModuleIntegrationTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _jwtTokenService = new JwtTokenService(
            "HBStudioEnterpriseErpSuperSecretKey20261113!",
            "HBStudioErp",
            "HBStudioErpClient"
        );
    }

    [Fact]
    public async Task InitialReceipt_ShouldGenerateKardexAndMaterializeBalance()
    {
        // Arrange
        var client = _factory.CreateClient();

        Guid tenantId;
        Guid branchId;
        Guid warehouseId;
        Guid skuId;

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            var tenant = new Tenant("HB Studio Test " + Guid.NewGuid().ToString("N")[..6], "TEN-" + Guid.NewGuid().ToString("N")[..6]);
            var branch = tenant.AddBranch("Filial Centro", "BRC-01");
            db.Tenants.Add(tenant);
            await db.SaveChangesAsync();

            tenantId = tenant.Id;
            branchId = branch.Id;

            var category = new ProductCategory(tenantId, "Insumos 3D", "insumos-3d-" + Guid.NewGuid().ToString("N")[..6]);
            var brand = new ProductBrand(tenantId, "Creality 3D " + Guid.NewGuid().ToString("N")[..6]);
            db.ProductCategories.Add(category);
            db.ProductBrands.Add(brand);

            var model = new ProductModel(tenantId, "Filamento PLA 1kg", ProductKind.RawMaterial, SerializationPolicy.None, brand.Id, category.Id);
            var sku = model.AddSku("PLA-BLACK-1KG-" + Guid.NewGuid().ToString("N")[..6], "Preto 1kg", 120.00m);
            db.ProductModels.Add(model);

            var warehouse = new Warehouse(tenantId, branchId, "ALM-3D-" + Guid.NewGuid().ToString("N")[..4], "Almoxarifado 3D", WarehouseType.Manufacturing3D);
            db.Warehouses.Add(warehouse);

            await db.SaveChangesAsync();

            warehouseId = warehouse.Id;
            skuId = sku.Id;
        }

        var token = _jwtTokenService.GenerateToken(tenantId, branchId, Guid.NewGuid(), "estoquista@hbstudio.com.br", new[]
        {
            PermissionCatalog.InventoryView,
            PermissionCatalog.InventoryMove,
            PermissionCatalog.InventoryCostView
        });
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token.AccessToken);

        // Act - Entrada inicial de 10 carretéis a R$ 65,00 cada
        var receiptRequest = new InitialStockReceiptRequest(
            branchId,
            warehouseId,
            null,
            skuId,
            10m,
            65.00m,
            "NF-10023",
            "Entrada de fornecedor homologado",
            InventoryUnitId: null,
            IdempotencyKey: $"REC-{Guid.NewGuid()}"
        );

        var response = await client.PostAsJsonAsync("/api/inventory/initial-receipt", receiptRequest);

        // Assert
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var movement = await response.Content.ReadFromJsonAsync<StockMovementResponse>();
        Assert.NotNull(movement);
        Assert.Equal(10m, movement.Quantity);
        Assert.Equal(65.00m, movement.UnitCost);
        Assert.Equal(650.00m, movement.TotalCost);
        Assert.Equal(10m, movement.BalanceAfterQuantity);

        // Verificar Projeção de Saldo Materializado
        var balancesResponse = await client.GetAsync($"/api/inventory/balances?branchId={branchId}&warehouseId={warehouseId}&skuId={skuId}");
        Assert.Equal(HttpStatusCode.OK, balancesResponse.StatusCode);
        var balances = await balancesResponse.Content.ReadFromJsonAsync<List<StockBalanceResponse>>();
        Assert.NotNull(balances);
        var balance = Assert.Single(balances);
        Assert.Equal(10m, balance.OnHandQuantity);
        Assert.Equal(10m, balance.AvailableQuantity);
        Assert.Equal(65.00m, balance.AverageCost);
        Assert.Equal(650.00m, balance.TotalValuedAmount);
    }

    [Fact]
    public async Task Reservation_ShouldBlockAvailableQuantityAndPreventOverReservation()
    {
        // Arrange
        var client = _factory.CreateClient();

        Guid tenantId;
        Guid branchId;
        Guid warehouseId;
        Guid skuId;

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            var tenant = new Tenant("HB Studio Test " + Guid.NewGuid().ToString("N")[..6], "TEN-" + Guid.NewGuid().ToString("N")[..6]);
            var branch = tenant.AddBranch("Matriz", "BRC-01");
            db.Tenants.Add(tenant);
            await db.SaveChangesAsync();

            tenantId = tenant.Id;
            branchId = branch.Id;

            var category = new ProductCategory(tenantId, "Acessórios", "acessorios-" + Guid.NewGuid().ToString("N")[..6]);
            var brand = new ProductBrand(tenantId, "Baseus " + Guid.NewGuid().ToString("N")[..6]);
            db.ProductCategories.Add(category);
            db.ProductBrands.Add(brand);

            var model = new ProductModel(tenantId, "Cabo USB-C", ProductKind.Standard, SerializationPolicy.None, brand.Id, category.Id);
            var sku = model.AddSku("CAB-USBC-1M-" + Guid.NewGuid().ToString("N")[..6], "1 Metro Preto", 45.00m);
            db.ProductModels.Add(model);

            var warehouse = new Warehouse(tenantId, branchId, "ALM-LOJA-" + Guid.NewGuid().ToString("N")[..4], "Loja", WarehouseType.GeneralStore);
            db.Warehouses.Add(warehouse);

            await db.SaveChangesAsync();

            warehouseId = warehouse.Id;
            skuId = sku.Id;
        }

        var token = _jwtTokenService.GenerateToken(tenantId, branchId, Guid.NewGuid(), "vendedor@hbstudio.com.br", new[]
        {
            PermissionCatalog.InventoryView,
            PermissionCatalog.InventoryMove
        });
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token.AccessToken);

        // Carga de 5 unidades em estoque
        var receipt = new InitialStockReceiptRequest(branchId, warehouseId, null, skuId, 5m, 20.00m, "NF-100", "Estoque inicial");
        var recResp = await client.PostAsJsonAsync("/api/inventory/initial-receipt", receipt);
        Assert.Equal(HttpStatusCode.Created, recResp.StatusCode);

        // Act 1 - Reservar 3 unidades (Sucesso)
        var res1 = new CreateReservationRequest(
            branchId,
            "RES-PED-" + Guid.NewGuid().ToString("N")[..6],
            "Reserva de pedido e-commerce",
            DateTime.UtcNow.AddHours(2),
            "PED-9901",
            null,
            new List<CreateReservationItemRequest>
            {
                new(warehouseId, null, skuId, 3m)
            }
        );

        var res1Response = await client.PostAsJsonAsync("/api/inventory/reservations", res1);
        Assert.Equal(HttpStatusCode.Created, res1Response.StatusCode);

        // Act 2 - Tentar reservar 3 unidades adicionais (Disponível é apenas 2 -> Falha com InvalidOperationException / 500)
        var res2 = new CreateReservationRequest(
            branchId,
            "RES-PED-" + Guid.NewGuid().ToString("N")[..6],
            "Segunda tentativa",
            DateTime.UtcNow.AddHours(2),
            "PED-9902",
            null,
            new List<CreateReservationItemRequest>
            {
                new(warehouseId, null, skuId, 3m) // Disponível é 2
            }
        );

        var res2Response = await client.PostAsJsonAsync("/api/inventory/reservations", res2);
        Assert.False(res2Response.IsSuccessStatusCode); // Falha garantida por falta de saldo disponível

        // Act 3 - Consumir a reserva 1
        var createdRes = await res1Response.Content.ReadFromJsonAsync<StockReservationResponse>();
        Assert.NotNull(createdRes);

        var consumeResp = await client.PostAsync($"/api/inventory/reservations/{createdRes.Id}/consume", null);
        Assert.Equal(HttpStatusCode.OK, consumeResp.StatusCode);

        // Verificar saldos pós-consumo: OnHand deve ser 2, Reserved deve ser 0, Available deve ser 2
        var checkBalance = await client.GetFromJsonAsync<List<StockBalanceResponse>>($"/api/inventory/balances?branchId={branchId}&warehouseId={warehouseId}&skuId={skuId}");
        Assert.NotNull(checkBalance);
        var b = Assert.Single(checkBalance);
        Assert.Equal(2m, b.OnHandQuantity);
        Assert.Equal(0m, b.ReservedQuantity);
        Assert.Equal(2m, b.AvailableQuantity);
    }

    [Fact]
    public async Task CrossImeiDuplicate_ShouldBeStrictlyRejectedByTenantIdentifierRegistry()
    {
        // Validação da correção prioritária do MOD-02:
        // Evitar que um IMEI cadastrado como IMEI 1 no Aparelho A possa ser cadastrado como IMEI 2 no Aparelho B!
        var tenantId = Guid.NewGuid();
        var client = _factory.CreateClient();

        Guid skuId;

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            var category = new ProductCategory(tenantId, "Smartphones", "smartphones-" + Guid.NewGuid().ToString("N")[..6]);
            var brand = new ProductBrand(tenantId, "Apple " + Guid.NewGuid().ToString("N")[..6]);
            db.ProductCategories.Add(category);
            db.ProductBrands.Add(brand);

            var model = new ProductModel(tenantId, "iPhone 13 128GB", ProductKind.Standard, SerializationPolicy.StrictSerialized, brand.Id, category.Id);
            var sku = model.AddSku("IPH13-128-BLU-" + Guid.NewGuid().ToString("N")[..6], "Azul 128GB", 3200.00m);
            db.ProductModels.Add(model);

            await db.SaveChangesAsync();
            skuId = sku.Id;
        }

        var token = _jwtTokenService.GenerateToken(tenantId, null, Guid.NewGuid(), "tecnico@hbstudio.com.br", new[]
        {
            PermissionCatalog.CatalogProductsView,
            PermissionCatalog.CatalogProductsManage,
            PermissionCatalog.CatalogCostView
        });
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token.AccessToken);

        var sharedImei = "35489" + Guid.NewGuid().ToString("N")[..10];

        // 1. Cadastrar Aparelho A com IMEI 1 = sharedImei
        var unitA = new Catalog.Application.RegisterInventoryUnitRequest(
            skuId,
            ItemCondition.PreOwned,
            1800.00m,
            "SERIAL-A-" + Guid.NewGuid().ToString("N")[..6],
            sharedImei,
            "354890123456780",
            CosmeticGrade.GradeA,
            89,
            null,
            "Aparelho A perfeito"
        );

        var respA = await client.PostAsJsonAsync("/api/catalog/units", unitA);
        Assert.Equal(HttpStatusCode.Created, respA.StatusCode);

        // 2. Tentar cadastrar Aparelho B onde o IMEI 2 é o mesmo sharedImei (Colisão Cruzada!)
        var unitB = new Catalog.Application.RegisterInventoryUnitRequest(
            skuId,
            ItemCondition.PreOwned,
            1750.00m,
            "SERIAL-B-" + Guid.NewGuid().ToString("N")[..6],
            "354890123456781", // IMEI 1 diferente
            sharedImei,        // IMEI 2 igual ao IMEI 1 do Aparelho A!
            CosmeticGrade.GradeB,
            84,
            null,
            "Tentativa de duplicidade cruzada"
        );

        var respB = await client.PostAsJsonAsync("/api/catalog/units", unitB);

        // Assert: A requisição deve ser rejeitada imediatamente impedindo duplicidade no tenant
        Assert.False(respB.IsSuccessStatusCode);
    }

    [Fact]
    public async Task StockTransfer_BetweenWarehouses_ShouldUpdateKardexAndBalancesCorrectly()
    {
        // Transferência completa entre Depósito Central e Bancada da Assistência
        var client = _factory.CreateClient();

        Guid tenantId;
        Guid branchId;
        Guid centralWarehouseId;
        Guid benchWarehouseId;
        Guid skuId;

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            var tenant = new Tenant("HB Studio Test " + Guid.NewGuid().ToString("N")[..6], "TEN-" + Guid.NewGuid().ToString("N")[..6]);
            var branch = tenant.AddBranch("Matriz", "BRC-01");
            db.Tenants.Add(tenant);
            await db.SaveChangesAsync();

            tenantId = tenant.Id;
            branchId = branch.Id;

            var category = new ProductCategory(tenantId, "Telas", "telas-" + Guid.NewGuid().ToString("N")[..6]);
            var brand = new ProductBrand(tenantId, "Samsung " + Guid.NewGuid().ToString("N")[..6]);
            db.ProductCategories.Add(category);
            db.ProductBrands.Add(brand);

            var model = new ProductModel(tenantId, "Tela Samsung S21", ProductKind.SparePart, SerializationPolicy.None, brand.Id, category.Id);
            var sku = model.AddSku("TEL-S21-OLED-" + Guid.NewGuid().ToString("N")[..6], "Tela OLED Original", 650.00m);
            db.ProductModels.Add(model);

            var central = new Warehouse(tenantId, branchId, "ALM-C-" + Guid.NewGuid().ToString("N")[..4], "Depósito Central", WarehouseType.CentralDeposit);
            var bench = new Warehouse(tenantId, branchId, "ALM-B-" + Guid.NewGuid().ToString("N")[..4], "Bancada Manutenção", WarehouseType.TechnicalBench);
            db.Warehouses.Add(central);
            db.Warehouses.Add(bench);

            await db.SaveChangesAsync();

            centralWarehouseId = central.Id;
            benchWarehouseId = bench.Id;
            skuId = sku.Id;
        }

        var token = _jwtTokenService.GenerateToken(tenantId, branchId, Guid.NewGuid(), "almoxarife@hbstudio.com.br", new[]
        {
            PermissionCatalog.InventoryView,
            PermissionCatalog.InventoryMove,
            PermissionCatalog.InventoryCostView
        });
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token.AccessToken);

        // Carga de 4 telas no Depósito Central a R$ 320,00
        var receipt = new InitialStockReceiptRequest(branchId, centralWarehouseId, null, skuId, 4m, 320.00m, "NF-5512", "Carga peças");
        var recResp = await client.PostAsJsonAsync("/api/inventory/initial-receipt", receipt);
        Assert.Equal(HttpStatusCode.Created, recResp.StatusCode);

        // Act 1 - Criar transferência de 2 telas do Central para Bancada
        var transferReq = new CreateTransferRequest(
            "TRF-" + Guid.NewGuid().ToString("N")[..6],
            branchId,
            centralWarehouseId,
            branchId,
            benchWarehouseId,
            "Envio de peças para bancada",
            new List<CreateTransferItemRequest>
            {
                new(skuId, 2m)
            }
        );

        var trfResp = await client.PostAsJsonAsync("/api/inventory/transfers", transferReq);
        Assert.Equal(HttpStatusCode.Created, trfResp.StatusCode);
        var transfer = await trfResp.Content.ReadFromJsonAsync<StockTransferResponse>();
        Assert.NotNull(transfer);

        // Act 2 - Despachar Transferência (Status InTransit e baixa do Central)
        var dispatchResp = await client.PostAsync($"/api/inventory/transfers/{transfer.Id}/dispatch", null);
        Assert.Equal(HttpStatusCode.OK, dispatchResp.StatusCode);

        // Act 3 - Receber Transferência na Bancada
        var receiveResp = await client.PostAsync($"/api/inventory/transfers/{transfer.Id}/receive", null);
        Assert.Equal(HttpStatusCode.OK, receiveResp.StatusCode);

        // Assert - Saldos finais: Central deve ter 2, Bancada deve ter 2 com custo R$ 320,00
        var balancesResp = await client.GetFromJsonAsync<List<StockBalanceResponse>>($"/api/inventory/balances?branchId={branchId}&skuId={skuId}");
        Assert.NotNull(balancesResp);
        Assert.Equal(2, balancesResp.Count);

        var centralBal = balancesResp.First(b => b.WarehouseId == centralWarehouseId);
        var benchBal = balancesResp.First(b => b.WarehouseId == benchWarehouseId);

        Assert.Equal(2m, centralBal.OnHandQuantity);
        Assert.Equal(2m, benchBal.OnHandQuantity);
        Assert.Equal(320.00m, benchBal.AverageCost);
    }

    [Fact]
    public async Task PhysicalInventoryCount_Reconciliation_ShouldPostKardexAdjustments()
    {
        // Inventário físico com divergência e ajuste automático no Kardex
        var client = _factory.CreateClient();

        Guid tenantId;
        Guid branchId;
        Guid warehouseId;
        Guid skuId;

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            var tenant = new Tenant("HB Studio Test " + Guid.NewGuid().ToString("N")[..6], "TEN-" + Guid.NewGuid().ToString("N")[..6]);
            var branch = tenant.AddBranch("Matriz", "BRC-01");
            db.Tenants.Add(tenant);
            await db.SaveChangesAsync();

            tenantId = tenant.Id;
            branchId = branch.Id;

            var category = new ProductCategory(tenantId, "Conectores", "conectores-" + Guid.NewGuid().ToString("N")[..6]);
            var brand = new ProductBrand(tenantId, "Foxconn " + Guid.NewGuid().ToString("N")[..6]);
            db.ProductCategories.Add(category);
            db.ProductBrands.Add(brand);

            var model = new ProductModel(tenantId, "Conector de Carga iPhone", ProductKind.SparePart, SerializationPolicy.None, brand.Id, category.Id);
            var sku = model.AddSku("CON-IPH-CARGA-" + Guid.NewGuid().ToString("N")[..6], "Conector Padrão", 25.00m);
            db.ProductModels.Add(model);

            var warehouse = new Warehouse(tenantId, branchId, "ALM-P-" + Guid.NewGuid().ToString("N")[..4], "Almoxarifado Peças", WarehouseType.TechnicalBench);
            db.Warehouses.Add(warehouse);

            await db.SaveChangesAsync();

            warehouseId = warehouse.Id;
            skuId = sku.Id;
        }

        var token = _jwtTokenService.GenerateToken(tenantId, branchId, Guid.NewGuid(), "gerente@hbstudio.com.br", new[]
        {
            PermissionCatalog.InventoryView,
            PermissionCatalog.InventoryMove,
            PermissionCatalog.InventoryAdjust,
            PermissionCatalog.InventoryCostView
        });
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token.AccessToken);

        // Carga inicial no sistema: 20 conectores
        var receipt = new InitialStockReceiptRequest(branchId, warehouseId, null, skuId, 20m, 8.50m, "NF-801", "Carga inicial");
        await client.PostAsJsonAsync("/api/inventory/initial-receipt", receipt);

        // Act 1 - Criar contagem física de inventário
        var createCount = new CreateInventoryCountRequest(branchId, warehouseId, "INV-" + Guid.NewGuid().ToString("N")[..6], "Contagem Mensal Almoxarifado Peças");
        var countResp = await client.PostAsJsonAsync("/api/inventory/counts", createCount);
        Assert.Equal(HttpStatusCode.Created, countResp.StatusCode);
        var count = await countResp.Content.ReadFromJsonAsync<InventoryCountResponse>();
        Assert.NotNull(count);

        // Act 2 - Registrar contagem física de 18 unidades (2 unidades a menos / avaria ou perda)
        var recordReq = new RecordCountItemRequest(skuId, 20m, 18m, null, "2 unidades danificadas descartadas na bancada");
        var recordResp = await client.PostAsJsonAsync($"/api/inventory/counts/{count.Id}/records", recordReq);
        if (!recordResp.IsSuccessStatusCode)
        {
            var err = await recordResp.Content.ReadAsStringAsync();
            throw new Exception($"RecordCountItem failed with {recordResp.StatusCode}: {err}");
        }
        Assert.Equal(HttpStatusCode.OK, recordResp.StatusCode);

        // Act 3 - Aprovar e Postar reconciliação de inventário no Kardex
        var postResp = await client.PostAsync($"/api/inventory/counts/{count.Id}/approve-post", null);
        Assert.Equal(HttpStatusCode.OK, postResp.StatusCode);

        // Assert - Saldo final no sistema deve ser ajustado para 18
        var balances = await client.GetFromJsonAsync<List<StockBalanceResponse>>($"/api/inventory/balances?branchId={branchId}&warehouseId={warehouseId}&skuId={skuId}");
        Assert.NotNull(balances);
        var b = Assert.Single(balances);
        Assert.Equal(18m, b.OnHandQuantity);

        // Kardex deve conter o movimento de ajuste negativo (-2)
        var kardex = await client.GetFromJsonAsync<List<StockMovementResponse>>($"/api/inventory/kardex?branchId={branchId}&warehouseId={warehouseId}&skuId={skuId}");
        Assert.NotNull(kardex);
        var adjMovement = kardex.FirstOrDefault(m => m.MovementType == StockMovementType.NegativeAdjustment);
        Assert.NotNull(adjMovement);
        Assert.Equal(-2m, adjMovement.Quantity);
        Assert.Equal(18m, adjMovement.BalanceAfterQuantity);
    }
}
