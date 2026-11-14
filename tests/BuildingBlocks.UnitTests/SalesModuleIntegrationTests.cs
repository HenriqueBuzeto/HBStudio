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
using Parties.Domain;
using Sales.Domain;
using Sales.Application;

namespace BuildingBlocks.UnitTests;

public class SalesModuleIntegrationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly JwtTokenService _jwtTokenService;

    public SalesModuleIntegrationTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _jwtTokenService = new JwtTokenService(
            "HBStudioEnterpriseErpSuperSecretKey20261113!",
            "HBStudioErp",
            "HBStudioErpClient"
        );
    }

    private async Task<(Guid tenantId, Guid branchId, Guid warehouseId, Guid customerId, Guid serializedSkuId, Guid usedInventoryUnitId, Guid commonSkuId)> SeedBaseDataAsync()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var suffix = Guid.NewGuid().ToString("N")[..6];
        var tenant = new Tenant("HB Studio Sales " + suffix, "TEN-SALES-" + suffix);
        var branch = tenant.AddBranch("Filial Shopping", "BR-SHOPPING-" + suffix);
        db.Tenants.Add(tenant);
        await db.SaveChangesAsync();

        var customer = new Party(tenant.Id, PartyType.Individual, "Maria Oliveira " + suffix, null, "98765432100");
        customer.EnableCustomerProfile();
        db.Parties.Add(customer);

        var warehouse = new Warehouse(tenant.Id, branch.Id, "ALM-VD-" + suffix, "Almoxarifado da Loja", WarehouseType.GeneralStore);
        db.Warehouses.Add(warehouse);

        var category = new ProductCategory(tenant.Id, "iPhones", "iphones-" + suffix);
        var brand = new ProductBrand(tenant.Id, "Apple " + suffix);
        db.ProductCategories.Add(category);
        db.ProductBrands.Add(brand);

        // Produto Serializado (iPhone Usado)
        var modelIphone = new ProductModel(tenant.Id, "iPhone 14 Pro", ProductKind.Standard, SerializationPolicy.StrictSerialized, brand.Id, category.Id);
        var skuIphone = modelIphone.AddSku("IPH14P-128-GOLD-" + suffix, "128GB Dourado Usado", 4200.00m);
        db.ProductModels.Add(modelIphone);

        // Produto Comum (Cabo USB-C)
        var modelCable = new ProductModel(tenant.Id, "Cabo USB-C 1m", ProductKind.Standard, SerializationPolicy.None, brand.Id, category.Id);
        var skuCable = modelCable.AddSku("CAB-USBC-1M-" + suffix, "1 metro Branco", 60.00m);
        db.ProductModels.Add(modelCable);

        await db.SaveChangesAsync();

        // Cadastrar Unidade Física Serializada (Disponível e Aprovada para Venda)
        var imeiTest = "3599" + Guid.NewGuid().ToString("N")[..11];
        var unit = new InventoryUnit(
            tenant.Id,
            skuIphone.Id,
            ItemCondition.PreOwned,
            acquisitionCost: 2800.00m,
            serialNumber: "SN-" + suffix,
            imei1: imeiTest,
            imei2: null,
            grade: CosmeticGrade.GradeA,
            batteryHealthPercentage: 92,
            supplierPartyId: null,
            inspectionNotes: "Aparelho 100% revisado"
        );
        unit.ApproveForSale("Revisado e liberado para venda");
        db.InventoryUnits.Add(unit);

        // Posição Serial
        var position = new SerialStockPosition(tenant.Id, unit.Id, skuIphone.Id, branch.Id, warehouse.Id, null);
        db.SerialStockPositions.Add(position);

        // Saldo Materializado para iPhone (1 unidade física)
        var balanceIphone = new StockBalance(tenant.Id, branch.Id, warehouse.Id, null, skuIphone.Id);
        balanceIphone.ApplyMovement(1, 2800.00m);
        db.StockBalances.Add(balanceIphone);

        // Saldo Materializado para Cabos (10 unidades)
        var balanceCable = new StockBalance(tenant.Id, branch.Id, warehouse.Id, null, skuCable.Id);
        balanceCable.ApplyMovement(10, 25.00m);
        db.StockBalances.Add(balanceCable);

        await db.SaveChangesAsync();

        return (tenant.Id, branch.Id, warehouse.Id, customer.Id, skuIphone.Id, unit.Id, skuCable.Id);
    }

    [Fact]
    public async Task SalesQuote_Lifecycle_ShouldCreate_Send_Accept_AndConvertToSale()
    {
        var data = await SeedBaseDataAsync();
        var client = _factory.CreateClient();

        var token = _jwtTokenService.GenerateToken(data.tenantId, data.branchId, Guid.NewGuid(), "vendedor@hbstudio.com.br", new[]
        {
            PermissionCatalog.SalesPosUse,
            PermissionCatalog.SalesCreate,
            PermissionCatalog.SalesCostView
        });
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token.AccessToken);

        // 1. Criar Orçamento Comercial
        var quoteDto = new CreateSalesQuoteDto(
            data.branchId,
            "COT-2026-" + Guid.NewGuid().ToString("N")[..4],
            data.customerId,
            DateTime.UtcNow.AddDays(7),
            "1x Cartão de Crédito",
            ShippingTotal: 20.00m,
            DiscountTotal: 50.00m,
            new List<CreateSalesQuoteItemDto>
            {
                new(data.commonSkuId, Quantity: 2, UnitPrice: 60.00m, Discount: 10.00m)
            },
            Notes: "Orçamento de cabos originais com desconto de fidelidade"
        );

        var createRes = await client.PostAsJsonAsync("/api/sales/quotes", quoteDto);
        Assert.Equal(HttpStatusCode.Created, createRes.StatusCode);
        var quote = await createRes.Content.ReadFromJsonAsync<SalesQuoteResponse>();
        Assert.NotNull(quote);
        Assert.Equal(SalesQuoteStatus.Draft, quote.Status);
        Assert.Equal(80.00m, quote.GrandTotal); // (2 * 60 - 10) + 20 - 50 = 80

        // 2. Enviar e Aceitar Orçamento
        await client.PostAsync($"/api/sales/quotes/{quote.Id}/send", null);
        var acceptRes = await client.PostAsync($"/api/sales/quotes/{quote.Id}/accept", null);
        Assert.Equal(HttpStatusCode.OK, acceptRes.StatusCode);

        // 3. Converter em Venda
        var convertRes = await client.PostAsync($"/api/sales/quotes/{quote.Id}/convert", null);
        Assert.Equal(HttpStatusCode.OK, convertRes.StatusCode);
        var sale = await convertRes.Content.ReadFromJsonAsync<SaleResponse>();
        Assert.NotNull(sale);
        Assert.Equal(SaleStatus.Draft, sale.Status);
        Assert.Equal(80.00m, sale.GrandTotal);

        // Conferir que o orçamento agora está ConvertedToSale
        var updatedQuote = await client.GetFromJsonAsync<SalesQuoteResponse>($"/api/sales/quotes/{quote.Id}");
        Assert.NotNull(updatedQuote);
        Assert.Equal(SalesQuoteStatus.ConvertedToSale, updatedQuote.Status);
        Assert.Equal(sale.Id, updatedQuote.ConvertedSaleId);
    }

    [Fact]
    public async Task Sale_CompletePDVFlow_ShouldReserve_PayCash_Fulfill_AndDeductKardex()
    {
        var data = await SeedBaseDataAsync();
        var client = _factory.CreateClient();

        var token = _jwtTokenService.GenerateToken(data.tenantId, data.branchId, Guid.NewGuid(), "caixa@hbstudio.com.br", new[]
        {
            PermissionCatalog.SalesPosUse,
            PermissionCatalog.SalesCreate,
            PermissionCatalog.SalesCostView,
            PermissionCatalog.InventoryView
        });
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token.AccessToken);

        // 1. Criar Venda no PDV (Cabo USB-C)
        var saleDto = new CreateSaleDto(
            data.branchId,
            data.customerId,
            "VD-PDV-" + Guid.NewGuid().ToString("N")[..4],
            ChargesTotal: 0m,
            DiscountTotal: 5.00m,
            new List<CreateSaleItemDto>
            {
                new(data.commonSkuId, Quantity: 3, UnitPrice: 60.00m, Discount: 0m)
            },
            Observations: "Venda rápida balcão",
            IdempotencyKey: "IDEMP-SALE-" + Guid.NewGuid().ToString("N")[..6]
        );

        var createRes = await client.PostAsJsonAsync("/api/sales/sales", saleDto);
        Assert.Equal(HttpStatusCode.Created, createRes.StatusCode);
        var sale = await createRes.Content.ReadFromJsonAsync<SaleResponse>();
        Assert.NotNull(sale);
        Assert.Equal(175.00m, sale.GrandTotal); // 3 * 60 - 5 = 175

        // 2. Reservar Estoque para o Checkout
        var reserveRes = await client.PostAsync($"/api/sales/sales/{sale.Id}/reserve?warehouseId={data.warehouseId}", null);
        Assert.Equal(HttpStatusCode.OK, reserveRes.StatusCode);
        var reservedSale = await reserveRes.Content.ReadFromJsonAsync<SaleResponse>();
        Assert.NotNull(reservedSale);
        Assert.Equal(SaleStatus.Reserved, reservedSale.Status);

        // 3. Registrar Pagamento em Dinheiro no Balcão com Código de Autorização
        var payDto = new AddPaymentIntentRequest(
            PaymentMethod.Cash,
            Amount: 175.00m,
            AuthorizationCode: "REC-DINHEIRO-CX01",
            Notes: "Recebido em cédulas no balcão"
        );
        var payRes = await client.PostAsJsonAsync($"/api/sales/sales/{sale.Id}/payments", payDto);
        Assert.Equal(HttpStatusCode.Created, payRes.StatusCode);

        // 4. Finalizar e Cumprir a Venda (Baixa Oficial no Kardex)
        var fulfillRes = await client.PostAsync($"/api/sales/sales/{sale.Id}/complete-fulfill?warehouseId={data.warehouseId}", null);
        Assert.Equal(HttpStatusCode.OK, fulfillRes.StatusCode);
        var fulfilledSale = await fulfillRes.Content.ReadFromJsonAsync<SaleResponse>();
        Assert.NotNull(fulfilledSale);
        Assert.Equal(SaleStatus.Fulfilled, fulfilledSale.Status);
        Assert.Equal(SalePaymentStatus.Confirmed, fulfilledSale.PaymentStatus);

        // 5. Verificar Saldo Materializado no Estoque (10 - 3 = 7 restantes)
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var balance = await db.StockBalances
            .FirstOrDefaultAsync(b => b.BranchId == data.branchId && b.WarehouseId == data.warehouseId && b.ProductSkuId == data.commonSkuId);
        Assert.NotNull(balance);
        Assert.Equal(7, balance.OnHandQuantity);
        Assert.Equal(0, balance.ReservedQuantity);

        // 6. Verificar Linha Append-Only no Kardex oficial
        var movement = await db.StockMovements
            .FirstOrDefaultAsync(m => m.CorrelationId == sale.Id && m.MovementType == StockMovementType.SaleIssue);
        Assert.NotNull(movement);
        Assert.Equal(-3, movement.Quantity);
        Assert.Equal(25.00m, movement.UnitCost); // Custo histórico oficial capturado do MOD-03
    }

    [Fact]
    public async Task SerializedSale_TwoSellersCompetingForSameImei_ShouldAllowOnlyOne()
    {
        var data = await SeedBaseDataAsync();
        var client1 = _factory.CreateClient();
        var client2 = _factory.CreateClient();

        var token1 = _jwtTokenService.GenerateToken(data.tenantId, data.branchId, Guid.NewGuid(), "vendedor1@hbstudio.com.br", new[]
        {
            PermissionCatalog.SalesPosUse,
            PermissionCatalog.SalesCreate
        });
        client1.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token1.AccessToken);

        var token2 = _jwtTokenService.GenerateToken(data.tenantId, data.branchId, Guid.NewGuid(), "vendedor2@hbstudio.com.br", new[]
        {
            PermissionCatalog.SalesPosUse,
            PermissionCatalog.SalesCreate
        });
        client2.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token2.AccessToken);

        // Vendedor 1 monta carrinho com o iPhone usado específico
        var saleDto1 = new CreateSaleDto(
            data.branchId,
            data.customerId,
            "VD-DISPUTA-1-" + Guid.NewGuid().ToString("N")[..4],
            ChargesTotal: 0m,
            DiscountTotal: 0m,
            new List<CreateSaleItemDto>
            {
                new(data.serializedSkuId, Quantity: 1, UnitPrice: 4200.00m, Discount: 0m, InventoryUnitId: data.usedInventoryUnitId)
            }
        );
        var resSale1 = await client1.PostAsJsonAsync("/api/sales/sales", saleDto1);
        var sale1 = await resSale1.Content.ReadFromJsonAsync<SaleResponse>();
        Assert.NotNull(sale1);

        // Vendedor 2 monta carrinho com o MESMO iPhone usado
        var saleDto2 = new CreateSaleDto(
            data.branchId,
            data.customerId,
            "VD-DISPUTA-2-" + Guid.NewGuid().ToString("N")[..4],
            ChargesTotal: 0m,
            DiscountTotal: 0m,
            new List<CreateSaleItemDto>
            {
                new(data.serializedSkuId, Quantity: 1, UnitPrice: 4200.00m, Discount: 0m, InventoryUnitId: data.usedInventoryUnitId)
            }
        );
        var resSale2 = await client2.PostAsJsonAsync("/api/sales/sales", saleDto2);
        var sale2 = await resSale2.Content.ReadFromJsonAsync<SaleResponse>();
        Assert.NotNull(sale2);

        // Vendedor 1 reserva primeiro com sucesso
        var resReserve1 = await client1.PostAsync($"/api/sales/sales/{sale1.Id}/reserve?warehouseId={data.warehouseId}", null);
        Assert.Equal(HttpStatusCode.OK, resReserve1.StatusCode);

        // Vendedor 2 tenta reservar a mesma unidade serializada simultaneamente -> DEVE FALHAR COM CONFLITO
        var resReserve2 = await client2.PostAsync($"/api/sales/sales/{sale2.Id}/reserve?warehouseId={data.warehouseId}", null);
        Assert.False(resReserve2.IsSuccessStatusCode);
    }

    [Fact]
    public async Task Sale_SplitPayment_ShouldEnforceFullPaymentBeforeFulfillment()
    {
        var data = await SeedBaseDataAsync();
        var client = _factory.CreateClient();

        var token = _jwtTokenService.GenerateToken(data.tenantId, data.branchId, Guid.NewGuid(), "caixa@hbstudio.com.br", new[]
        {
            PermissionCatalog.SalesPosUse,
            PermissionCatalog.SalesCreate
        });
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token.AccessToken);

        // Venda de R$ 300,00
        var saleDto = new CreateSaleDto(
            data.branchId,
            data.customerId,
            "VD-SPLIT-" + Guid.NewGuid().ToString("N")[..4],
            ChargesTotal: 0m,
            DiscountTotal: 0m,
            new List<CreateSaleItemDto>
            {
                new(data.commonSkuId, Quantity: 5, UnitPrice: 60.00m, Discount: 0m)
            }
        );
        var createRes = await client.PostAsJsonAsync("/api/sales/sales", saleDto);
        var sale = await createRes.Content.ReadFromJsonAsync<SaleResponse>();
        Assert.NotNull(sale);

        // 1. Registrar pagamento parcial de R$ 100 em Dinheiro
        var payCash = new AddPaymentIntentRequest(PaymentMethod.Cash, Amount: 100.00m, AuthorizationCode: "DINHEIRO-100");
        await client.PostAsJsonAsync($"/api/sales/sales/{sale.Id}/payments", payCash);

        // 2. Registrar intenção de R$ 200 via Pix PENDENTE
        var payPix = new AddPaymentIntentRequest(PaymentMethod.Pix, Amount: 200.00m, TransactionReference: "PIX-E2E-PENDING");
        var resPix = await client.PostAsJsonAsync($"/api/sales/sales/{sale.Id}/payments", payPix);
        var pixIntent = await resPix.Content.ReadFromJsonAsync<SalePaymentIntentResponse>();
        Assert.NotNull(pixIntent);

        // 3. Tentar finalizar a venda com o Pix ainda pendente -> DEVE SER REJEITADO
        var prematureFulfill = await client.PostAsync($"/api/sales/sales/{sale.Id}/complete-fulfill?warehouseId={data.warehouseId}", null);
        Assert.False(prematureFulfill.IsSuccessStatusCode);

        // 4. Confirmar o Pix mediante código de autorização / webhook
        var confirmPixReq = new ConfirmPaymentIntentRequest(AuthorizationCode: "PIX-BACEN-CONFIRMED-9988", TransactionReference: "E2E-OK");
        var confirmRes = await client.PostAsJsonAsync($"/api/sales/sales/{sale.Id}/payments/{pixIntent.Id}/confirm", confirmPixReq);
        Assert.Equal(HttpStatusCode.OK, confirmRes.StatusCode);

        // 5. Agora com 100% quitado, a finalização e entrega ocorrem com êxito
        var validFulfill = await client.PostAsync($"/api/sales/sales/{sale.Id}/complete-fulfill?warehouseId={data.warehouseId}", null);
        Assert.Equal(HttpStatusCode.OK, validFulfill.StatusCode);
    }

    [Fact]
    public async Task SaleReturn_ShouldNotRestockUntilPhysicalInspection()
    {
        var data = await SeedBaseDataAsync();
        var client = _factory.CreateClient();

        var token = _jwtTokenService.GenerateToken(data.tenantId, data.branchId, Guid.NewGuid(), "gerente@hbstudio.com.br", new[]
        {
            PermissionCatalog.SalesPosUse,
            PermissionCatalog.SalesCreate,
            PermissionCatalog.SalesCancel
        });
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token.AccessToken);

        // 1. Criar, pagar e entregar venda de 2 cabos
        var saleDto = new CreateSaleDto(
            data.branchId,
            data.customerId,
            "VD-RET-" + Guid.NewGuid().ToString("N")[..4],
            ChargesTotal: 0m,
            DiscountTotal: 0m,
            new List<CreateSaleItemDto>
            {
                new(data.commonSkuId, Quantity: 2, UnitPrice: 60.00m)
            }
        );
        var createRes = await client.PostAsJsonAsync("/api/sales/sales", saleDto);
        var sale = await createRes.Content.ReadFromJsonAsync<SaleResponse>();
        Assert.NotNull(sale);

        // Pagamento em dinheiro
        await client.PostAsJsonAsync($"/api/sales/sales/{sale.Id}/payments", new AddPaymentIntentRequest(PaymentMethod.Cash, 120.00m, AuthorizationCode: "PAGO-CX"));
        await client.PostAsync($"/api/sales/sales/{sale.Id}/complete-fulfill?warehouseId={data.warehouseId}", null);

        // 2. Cliente solicita devolução de 1 cabo
        var returnDto = new CreateSaleReturnDto(
            data.branchId,
            sale.Id,
            "DEV-CLI-" + Guid.NewGuid().ToString("N")[..4],
            Reason: "Comprou modelo incompatível com carregador antigo",
            new List<CreateSaleReturnItemDto>
            {
                new(sale.Items[0].Id, data.commonSkuId, Quantity: 1, RefundAmount: 60.00m)
            }
        );

        var returnRes = await client.PostAsJsonAsync("/api/sales/returns", returnDto);
        Assert.Equal(HttpStatusCode.Created, returnRes.StatusCode);
        var ret = await returnRes.Content.ReadFromJsonAsync<SaleReturnResponse>();
        Assert.NotNull(ret);
        Assert.Equal(SaleReturnStatus.Requested, ret.Status);

        // 3. Confirmar que o estoque AINDA NÃO foi restaurado (10 - 2 = 8 restantes)
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var bal = await db.StockBalances.FirstAsync(b => b.ProductSkuId == data.commonSkuId && b.WarehouseId == data.warehouseId);
            Assert.Equal(8, bal.OnHandQuantity);
        }

        // 4. Técnico inspeciona o item devolvido e aprova o reabastecimento físico
        var restockRes = await client.PostAsync($"/api/sales/returns/{ret.Id}/restock?warehouseId={data.warehouseId}&inspectionNotes=Embalagem+intacta+e+lacrada", null);
        Assert.Equal(HttpStatusCode.OK, restockRes.StatusCode);

        // 5. Agora o estoque deve ter sido restaurado para 9 unidades com lançamento no Kardex
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var bal = await db.StockBalances.FirstAsync(b => b.ProductSkuId == data.commonSkuId && b.WarehouseId == data.warehouseId);
            Assert.Equal(9, bal.OnHandQuantity);

            var movement = await db.StockMovements.FirstOrDefaultAsync(m => m.CorrelationId == ret.Id);
            Assert.NotNull(movement);
            Assert.Equal(1, movement.Quantity);
            Assert.Equal(StockMovementType.PositiveAdjustment, movement.MovementType);
        }
    }

    [Fact]
    public async Task CostProtection_UserWithoutPermission_ShouldNotSeeProfitMarginOrCost()
    {
        var data = await SeedBaseDataAsync();
        var client = _factory.CreateClient();

        // Criar venda no sistema
        var saleDto = new CreateSaleDto(
            data.branchId,
            data.customerId,
            "VD-COST-" + Guid.NewGuid().ToString("N")[..4],
            ChargesTotal: 0m,
            DiscountTotal: 0m,
            new List<CreateSaleItemDto>
            {
                new(data.commonSkuId, Quantity: 2, UnitPrice: 60.00m)
            }
        );

        var adminToken = _jwtTokenService.GenerateToken(data.tenantId, data.branchId, Guid.NewGuid(), "admin@hbstudio.com.br", new[]
        {
            PermissionCatalog.SalesPosUse,
            PermissionCatalog.SalesCostView
        });
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", adminToken.AccessToken);
        var createRes = await client.PostAsJsonAsync("/api/sales/sales", saleDto);
        var sale = await createRes.Content.ReadFromJsonAsync<SaleResponse>();
        Assert.NotNull(sale);
        Assert.NotNull(sale.TotalHistoricalCost);
        Assert.NotNull(sale.EstimatedProfitMargin);

        // Consultar com vendedor comum (SEM sales.cost.view)
        var sellerToken = _jwtTokenService.GenerateToken(data.tenantId, data.branchId, Guid.NewGuid(), "vendedor@hbstudio.com.br", new[]
        {
            PermissionCatalog.SalesPosUse
        });
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", sellerToken.AccessToken);

        var res = await client.GetFromJsonAsync<SaleResponse>($"/api/sales/sales/{sale.Id}");
        Assert.NotNull(res);
        Assert.Null(res.TotalHistoricalCost);
        Assert.Null(res.EstimatedProfitMargin);
        Assert.Null(res.Items[0].HistoricalUnitCost);
        Assert.Null(res.Items[0].TotalCost);
    }
}
