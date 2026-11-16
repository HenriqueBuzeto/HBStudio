using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using BuildingBlocks.Domain;
using BuildingBlocks.Infrastructure;
using BuildingBlocks.Security;
using Catalog.Domain;
using FluentAssertions;
using Inventory.Application;
using Inventory.Domain;
using Manufacturing3D.Application.DTOs;
using Manufacturing3D.Domain.Entities;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace BuildingBlocks.UnitTests;

public class Manufacturing3DModuleIntegrationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly ITokenService _jwtTokenService;

    public Manufacturing3DModuleIntegrationTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _jwtTokenService = new JwtTokenService(
            "HBStudioEnterpriseErpSuperSecretKey20261113!",
            "HBStudioErp",
            "HBStudioErpClient");
    }

    private HttpClient CreateAuthenticatedClient(Guid tenantId, Guid branchId, IEnumerable<string> permissions)
    {
        var tokenResponse = _jwtTokenService.GenerateToken(
            tenantId,
            branchId,
            Guid.NewGuid(),
            "manufacturing.tester@hbstudio.com",
            permissions);

        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", tokenResponse.AccessToken);
        return client;
    }

    private async Task<(Guid tenantId, Guid branchId)> SeedTenantAndBranchAsync()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var tenant = new IdentityAccess.Domain.Tenant($"Tenant-3D-{Guid.NewGuid():N}", $"T-{Guid.NewGuid():N}"[..8]);
        var branch = tenant.AddBranch($"Filial 3D {Guid.NewGuid():N}", $"B-{Guid.NewGuid():N}"[..8]);
        db.Tenants.Add(tenant);

        await db.SaveChangesAsync();
        return (tenant.Id, branch.Id);
    }

    [Fact]
    public async Task Manufacturing_PrintersEndpoint_RequiresPermission_ReturnsForbiddenWhenClaimMissing()
    {
        var (tenantId, branchId) = await SeedTenantAndBranchAsync();
        // Apenas permissão de visualização, sem permissão de cadastro
        var client = CreateAuthenticatedClient(tenantId, branchId, new[] { PermissionCatalog.ManufacturingView });

        var req = new CreatePrinterRequest(
            "PRN-01",
            "Bambu Lab X1-Carbon",
            "Bambu Lab",
            "X1-Carbon Combo",
            "SN-X1C-9988",
            1, // FDM
            "256x256x256mm",
            350m,
            150m,
            12000m,
            3.50m
        );

        var response = await client.PostAsJsonAsync("/api/manufacturing/printers", req);
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden, "Usuário sem 'manufacturing.printers.manage' deve ser bloqueado.");
    }

    [Fact]
    public async Task Manufacturing_QuoteCalculation_AppliesDecomposedCosts_AndGrossMarginCorrectly()
    {
        var (tenantId, branchId) = await SeedTenantAndBranchAsync();
        var client = CreateAuthenticatedClient(tenantId, branchId, new[] { PermissionCatalog.ManufacturingView, PermissionCatalog.ManufacturingQuote });

        // Orçamento didático de 1 peça:
        // Filamento: 70g a R$ 90/kg = R$ 6,30
        // Tempo: 5 horas, 120W médios = 0,60 kWh a R$ 1,10 = R$ 0,66
        // Máquina: 5h * R$ 2,50/h = R$ 12,50
        // Mão de obra: 25 min (0,4167 h) a R$ 24/h = R$ 10,00
        // Perda prevista: 5%
        // Markup: 66,67%
        var req = new CalculateManufacturingQuoteRequest(
            $"ORC-3D-{Guid.NewGuid():N}"[..12],
            null,
            "Suporte Celular Articulado",
            1,
            70m,
            90m,
            5m,
            120m,
            1.10m,
            2.50m,
            0.4167m,
            24m,
            5.0m,
            66.67m
        );

        var response = await client.PostAsJsonAsync("/api/manufacturing/quotes/calculate", req);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var quote = await response.Content.ReadFromJsonAsync<QuoteCalculationResultDto>();
        quote.Should().NotBeNull();
        quote!.EstimatedMaterialCost.Should().Be(6.30m);
        quote.EstimatedEnergyCost.Should().Be(0.66m);
        quote.EstimatedMachineCost.Should().Be(12.50m);
        quote.EstimatedLaborCost.Should().Be(10.00m);
        quote.TotalEstimatedCost.Should().BeGreaterThan(30m);
        quote.SuggestedFinalPrice.Should().BeGreaterThan(quote.TotalEstimatedCost);
        quote.GrossMarginPercent.Should().BeGreaterThan(0m);
    }

    [Fact]
    public async Task Manufacturing_OrderFlow_ReserveFilament_RegisterFailureAndWaste_CompletesQuality_AndEntersInventory()
    {
        var (tenantId, branchId) = await SeedTenantAndBranchAsync();
        var client = CreateAuthenticatedClient(tenantId, branchId, new[]
        {
            PermissionCatalog.ManufacturingView,
            PermissionCatalog.ManufacturingOrdersManage,
            PermissionCatalog.ManufacturingExecute,
            PermissionCatalog.ManufacturingQualityApprove,
            PermissionCatalog.InventoryView
        });

        Guid warehouseId;
        Guid filamentSkuId;
        Guid finishedGoodSkuId;
        Guid printerId;

        // 1. Setup no Banco: Almoxarifado, Matéria-Prima (Filamento) e Produto Final (Peça Acabada)
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            var wh = new Warehouse(tenantId, branchId, $"ALM-{Guid.NewGuid():N}"[..8], "Almoxarifado 3D", WarehouseType.GeneralStore);
            db.Warehouses.Add(wh);

            var brand = new ProductBrand(tenantId, $"Brand-3D-{Guid.NewGuid():N}"[..10]);
            var cat = new ProductCategory(tenantId, "Insumos 3D", $"cat-{Guid.NewGuid():N}"[..10]);
            db.ProductBrands.Add(brand);
            db.ProductCategories.Add(cat);

            var modelFilament = new ProductModel(tenantId, "Filamento PLA 1kg", ProductKind.Standard, SerializationPolicy.None, brand.Id, cat.Id);
            var modelPart = new ProductModel(tenantId, "Case iPhone 14 Pro 3D", ProductKind.Standard, SerializationPolicy.None, brand.Id, cat.Id);
            db.ProductModels.Add(modelFilament);
            db.ProductModels.Add(modelPart);

            var skuFilament = new ProductSku(tenantId, modelFilament.Id, $"SKU-FIL-{Guid.NewGuid():N}"[..12], "PLA Preto 1kg", 95.00m);
            var skuPart = new ProductSku(tenantId, modelPart.Id, $"SKU-CASE-{Guid.NewGuid():N}"[..12], "Case Impresso", 120.00m);
            db.ProductSkus.Add(skuFilament);
            db.ProductSkus.Add(skuPart);

            // Saldo inicial do filamento no estoque
            var bal = new StockBalance(tenantId, branchId, wh.Id, null, skuFilament.Id);
            bal.ApplyMovement(5, 95.00m); // 5 bobinas em estoque
            db.StockBalances.Add(bal);

            var printer = new ManufacturingPrinter(
                tenantId,
                branchId,
                $"PRN-{Guid.NewGuid():N}"[..8],
                "K1 Max Creality",
                "Creality",
                "K1 Max",
                "SN-K1M-001",
                PrinterTechnology.FDM_FFF,
                "300x300x300mm",
                400m,
                180m,
                6500m,
                3.00m
            );
            db.ManufacturingPrinters.Add(printer);

            await db.SaveChangesAsync();

            warehouseId = wh.Id;
            filamentSkuId = skuFilament.Id;
            finishedGoodSkuId = skuPart.Id;
            printerId = printer.Id;
        }

        // 2. Criar Ordem de Produção (OP)
        var createOrderReq = new CreateManufacturingOrderRequest(
            $"OP-3D-{Guid.NewGuid():N}"[..10],
            1, // ProductionForStock
            null,
            finishedGoodSkuId,
            null,
            printerId,
            filamentSkuId,
            2, // Planejadas 2 peças
            150m,
            300m,
            45.00m
        );

        var orderRes = await client.PostAsJsonAsync("/api/manufacturing/orders", createOrderReq);
        if (orderRes.StatusCode != HttpStatusCode.Created)
        {
            var err = await orderRes.Content.ReadAsStringAsync();
            throw new Exception($"Create order failed: {orderRes.StatusCode} - {err}");
        }
        orderRes.StatusCode.Should().Be(HttpStatusCode.Created);
        var order = await orderRes.Content.ReadFromJsonAsync<ManufacturingOrderDto>();
        order.Should().NotBeNull();

        // 3. Reservar Matéria-Prima no Inventory oficial
        var reserveRes = await client.PostAsync($"/api/manufacturing/orders/{order!.Id}/reserve?warehouseId={warehouseId}&quantityGrams=150", null);
        reserveRes.StatusCode.Should().Be(HttpStatusCode.OK);

        // 4. Iniciar Tentativa 1 (que sofrerá falha por descolamento de mesa após 30 min)
        var attempt1Res = await client.PostAsync($"/api/manufacturing/orders/{order.Id}/attempts/start?attemptNumber=1&printerId={printerId}&operatorName=Carlos&estimatedMinutes=150&estimatedGrams=75", null);
        if (attempt1Res.StatusCode != HttpStatusCode.OK)
        {
            var err = await attempt1Res.Content.ReadAsStringAsync();
            throw new Exception($"Start attempt 1 failed: {attempt1Res.StatusCode} - {err}");
        }
        attempt1Res.StatusCode.Should().Be(HttpStatusCode.OK);
        var attempt1Data = await attempt1Res.Content.ReadFromJsonAsync<Dictionary<string, Guid>>();
        var attempt1Id = attempt1Data!["attemptId"];

        // Registrar Falha na Tentativa 1 (O custo do filamento perdido NÃO se perde da contabilidade!)
        var failReq = new FailPrintAttemptRequest(
            1, // BedAdhesion
            "Primeira camada descolou do leito aquecido",
            30m, // 30 minutos perdidos
            20m, // 20 gramas de filamento perdidos
            95m, // R$ 95/kg
            1.10m,
            3.00m
        );
        var failRes = await client.PostAsJsonAsync($"/api/manufacturing/orders/{order.Id}/attempts/{attempt1Id}/fail", failReq);
        if (failRes.StatusCode != HttpStatusCode.OK)
        {
            var err = await failRes.Content.ReadAsStringAsync();
            throw new Exception($"FailPrintAttempt failed: {failRes.StatusCode} - {err}");
        }
        failRes.StatusCode.Should().Be(HttpStatusCode.OK);

        // 5. Iniciar Tentativa 2 e Concluir com Sucesso
        var attempt2Res = await client.PostAsync($"/api/manufacturing/orders/{order.Id}/attempts/start?attemptNumber=2&printerId={printerId}&operatorName=Carlos&estimatedMinutes=150&estimatedGrams=75", null);
        if (attempt2Res.StatusCode != HttpStatusCode.OK)
        {
            var err = await attempt2Res.Content.ReadAsStringAsync();
            throw new Exception($"Start attempt 2 failed: {attempt2Res.StatusCode} - {err}");
        }
        attempt2Res.StatusCode.Should().Be(HttpStatusCode.OK);
        var attempt2Data = await attempt2Res.Content.ReadFromJsonAsync<Dictionary<string, Guid>>();
        var attempt2Id = attempt2Data!["attemptId"];

        var completeReq = new CompletePrintAttemptRequest(
            140m, // 140 minutos reais
            72m,  // 72 gramas reais
            95m,  // R$ 95/kg
            1.10m,
            3.00m,
            25m,  // R$ 25/h mão de obra
            0.5m  // 30 min operador
        );
        var completeRes = await client.PostAsJsonAsync($"/api/manufacturing/orders/{order.Id}/attempts/{attempt2Id}/complete", completeReq);
        completeRes.StatusCode.Should().Be(HttpStatusCode.OK);

        // 6. Inspeção de Qualidade & Entrada do Produto Acabado no Estoque Oficial
        var qualityReq = new CompleteOrderQualityInspectionRequest(
            2, // 2 peças aprovadas
            0,
            null,
            warehouseId
        );
        var qualityRes = await client.PostAsJsonAsync($"/api/manufacturing/orders/{order.Id}/quality-and-receive", qualityReq);
        qualityRes.StatusCode.Should().Be(HttpStatusCode.OK);

        var finalOrder = await qualityRes.Content.ReadFromJsonAsync<ManufacturingOrderDto>();
        finalOrder.Should().NotBeNull();
        finalOrder!.ApprovedQuantity.Should().Be(2);
        finalOrder.TotalActualCost.Should().BeGreaterThan(0m, "Os custos da tentativa falha E da tentativa concluída devem compor o custo real da OP");
        finalOrder.ActualUnitCost.Should().BeGreaterThan(0m);

        // 7. Validação Física no Inventory: O produto final DEVE estar no saldo oficial com o custo real apurado!
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var finishedBalance = await db.StockBalances.FirstOrDefaultAsync(b => b.ProductSkuId == finishedGoodSkuId && b.WarehouseId == warehouseId);
            finishedBalance.Should().NotBeNull();
            finishedBalance!.OnHandQuantity.Should().Be(2, "As peças aprovadas na qualidade entram oficialmente no estoque");
            finishedBalance.AvailableQuantity.Should().Be(2);
        }
    }
}
