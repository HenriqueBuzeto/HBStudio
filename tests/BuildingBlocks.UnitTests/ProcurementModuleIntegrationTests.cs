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
using Parties.Domain;
using Procurement.Domain;
using Procurement.Application;

namespace BuildingBlocks.UnitTests;

public class ProcurementModuleIntegrationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly JwtTokenService _jwtTokenService;

    public ProcurementModuleIntegrationTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _jwtTokenService = new JwtTokenService(
            "HBStudioEnterpriseErpSuperSecretKey20261113!",
            "HBStudioErp",
            "HBStudioErpClient"
        );
    }

    private async Task<(Guid tenantId, Guid branchId, Guid warehouseId, Guid supplierId, Guid customerId, Guid serializedSkuId, Guid batchSkuId)> SeedBaseDataAsync()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var suffix = Guid.NewGuid().ToString("N")[..6];
        var tenant = new Tenant("HB Studio Procurement " + suffix, "TEN-PROC-" + suffix);
        var branch = tenant.AddBranch("Filial Matriz", "BR-MATRIZ-" + suffix);
        db.Tenants.Add(tenant);
        await db.SaveChangesAsync();

        var supplier = new Party(tenant.Id, PartyType.LegalEntity, "Distribuidora Tech Brasil " + suffix, "Tech Brasil LTDA", "12345678000195");
        supplier.EnableSupplierProfile();
        db.Parties.Add(supplier);

        var customer = new Party(tenant.Id, PartyType.Individual, "João da Silva " + suffix, null, "12345678901");
        customer.EnableCustomerProfile();
        db.Parties.Add(customer);

        var warehouse = new Warehouse(tenant.Id, branch.Id, "ALM-PRI-" + suffix, "Depósito Principal Matriz", WarehouseType.CentralDeposit);
        db.Warehouses.Add(warehouse);

        var category = new ProductCategory(tenant.Id, "Smartphones", "smartphones-" + suffix);
        var brand = new ProductBrand(tenant.Id, "Apple " + suffix);
        db.ProductCategories.Add(category);
        db.ProductBrands.Add(brand);

        var modelIphone = new ProductModel(tenant.Id, "iPhone 15 Pro", ProductKind.Standard, SerializationPolicy.StrictSerialized, brand.Id, category.Id);
        var skuIphone = modelIphone.AddSku("IPH15P-128-NAT-" + suffix, "128GB Titânio Natural", 6500.00m);
        db.ProductModels.Add(modelIphone);

        var modelFilament = new ProductModel(tenant.Id, "Filamento PLA Creality", ProductKind.RawMaterial, SerializationPolicy.None, brand.Id, category.Id);
        var skuFilament = modelFilament.AddSku("PLA-BLACK-1KG-" + suffix, "1kg Preto", 120.00m);
        db.ProductModels.Add(modelFilament);

        await db.SaveChangesAsync();

        return (tenant.Id, branch.Id, warehouse.Id, supplier.Id, customer.Id, skuIphone.Id, skuFilament.Id);
    }

    [Fact]
    public async Task PurchaseRequest_Lifecycle_ShouldCreate_Submit_AndApprove()
    {
        var data = await SeedBaseDataAsync();
        var client = _factory.CreateClient();

        var token = _jwtTokenService.GenerateToken(data.tenantId, data.branchId, Guid.NewGuid(), "comprador@hbstudio.com.br", new[]
        {
            PermissionCatalog.PurchasesView,
            PermissionCatalog.PurchasesCreate,
            PermissionCatalog.PurchasesApprove,
            PermissionCatalog.PurchasesCostView
        });
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token.AccessToken);

        // 1. Criar Requisição
        var createDto = new CreatePurchaseRequestDto(
            data.branchId,
            "REQ-2026-" + Guid.NewGuid().ToString("N")[..4],
            "Reposição mensal de insumos de impressão 3D",
            DateTime.UtcNow.AddDays(7),
            new List<CreatePurchaseRequestItemDto>
            {
                new(data.batchSkuId, 10, 85.00m, "Urgente para novos lotes")
            }
        );

        var createRes = await client.PostAsJsonAsync("/api/procurement/requests", createDto);
        Assert.Equal(HttpStatusCode.Created, createRes.StatusCode);
        var req = await createRes.Content.ReadFromJsonAsync<PurchaseRequestResponse>();
        Assert.NotNull(req);
        Assert.Equal(PurchaseRequestStatus.Draft, req.Status);
        Assert.Equal(850.00m, req.TotalEstimatedCost);

        // 2. Submeter
        var submitRes = await client.PostAsync($"/api/procurement/requests/{req.Id}/submit", null);
        Assert.Equal(HttpStatusCode.OK, submitRes.StatusCode);
        var submittedReq = await submitRes.Content.ReadFromJsonAsync<PurchaseRequestResponse>();
        Assert.NotNull(submittedReq);
        Assert.Equal(PurchaseRequestStatus.Submitted, submittedReq.Status);

        // 3. Aprovar
        var approveRes = await client.PostAsync($"/api/procurement/requests/{req.Id}/approve?notes=Aprovado+para+cotacao", null);
        Assert.Equal(HttpStatusCode.OK, approveRes.StatusCode);
        var approvedReq = await approveRes.Content.ReadFromJsonAsync<PurchaseRequestResponse>();
        Assert.NotNull(approvedReq);
        Assert.Equal(PurchaseRequestStatus.Approved, approvedReq.Status);
    }

    [Fact]
    public async Task PurchaseOrder_PartialAndFullReceipt_ShouldUpdateOrderAndKardex()
    {
        var data = await SeedBaseDataAsync();
        var client = _factory.CreateClient();

        var token = _jwtTokenService.GenerateToken(data.tenantId, data.branchId, Guid.NewGuid(), "comprador@hbstudio.com.br", new[]
        {
            PermissionCatalog.PurchasesView,
            PermissionCatalog.PurchasesCreate,
            PermissionCatalog.PurchasesApprove,
            PermissionCatalog.PurchasesReceive,
            PermissionCatalog.PurchasesCostView,
            PermissionCatalog.InventoryView
        });
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token.AccessToken);

        // 1. Criar e Aprovar Pedido de Compra de 10 unidades
        var orderDto = new CreatePurchaseOrderDto(
            data.branchId,
            data.supplierId,
            "PO-2026-" + Guid.NewGuid().ToString("N")[..4],
            DateTime.UtcNow.AddDays(5),
            "30 Dias Boleto",
            ShippingCost: 50.00m,
            OtherExpenses: 0m,
            TotalDiscount: 0m,
            new List<CreatePurchaseOrderItemDto>
            {
                new(data.batchSkuId, QuantityOrdered: 10, UnitCost: 90.00m)
            },
            Notes: "Pedido de teste recebimento parcial"
        );

        var createOrderRes = await client.PostAsJsonAsync("/api/procurement/orders", orderDto);
        Assert.Equal(HttpStatusCode.Created, createOrderRes.StatusCode);
        var order = await createOrderRes.Content.ReadFromJsonAsync<PurchaseOrderResponse>();
        Assert.NotNull(order);

        // Submeter e Aprovar Pedido
        await client.PostAsync($"/api/procurement/orders/{order.Id}/submit", null);
        var approveOrderRes = await client.PostAsync($"/api/procurement/orders/{order.Id}/approve", null);
        Assert.Equal(HttpStatusCode.OK, approveOrderRes.StatusCode);

        // 2. Primeiro Recebimento Parcial (4 unidades)
        var receipt1Dto = new CreateGoodsReceiptDto(
            data.branchId,
            data.warehouseId,
            WarehouseLocationId: null,
            order.Id,
            data.supplierId,
            ReceiptNumber: "REC-PART-1-" + Guid.NewGuid().ToString("N")[..4],
            InvoiceOrDocumentNumber: "NF-998811",
            new List<CreateGoodsReceiptItemDto>
            {
                new(data.batchSkuId, QuantityReceived: 4, RealUnitCost: 90.00m)
            },
            IdempotencyKey: "IDEMP-REC-1-" + Guid.NewGuid().ToString("N")[..4]
        );

        var rec1Res = await client.PostAsJsonAsync("/api/procurement/receipts", receipt1Dto);
        Assert.Equal(HttpStatusCode.Created, rec1Res.StatusCode);

        // Verificar status do pedido: deve estar PartiallyReceived com 6 pendentes
        var orderCheck1 = await client.GetFromJsonAsync<PurchaseOrderResponse>($"/api/procurement/orders/{order.Id}");
        Assert.NotNull(orderCheck1);
        Assert.Equal(PurchaseOrderStatus.PartiallyReceived, orderCheck1.Status);
        Assert.Equal(4, orderCheck1.Items[0].QuantityReceived);
        Assert.Equal(6, orderCheck1.Items[0].QuantityPending);

        // 3. Segundo Recebimento (Restante de 6 unidades)
        var receipt2Dto = new CreateGoodsReceiptDto(
            data.branchId,
            data.warehouseId,
            WarehouseLocationId: null,
            order.Id,
            data.supplierId,
            ReceiptNumber: "REC-PART-2-" + Guid.NewGuid().ToString("N")[..4],
            InvoiceOrDocumentNumber: "NF-998812",
            new List<CreateGoodsReceiptItemDto>
            {
                new(data.batchSkuId, QuantityReceived: 6, RealUnitCost: 90.00m)
            },
            IdempotencyKey: "IDEMP-REC-2-" + Guid.NewGuid().ToString("N")[..4]
        );

        var rec2Res = await client.PostAsJsonAsync("/api/procurement/receipts", receipt2Dto);
        Assert.Equal(HttpStatusCode.Created, rec2Res.StatusCode);

        // Verificar status do pedido: deve estar Received com 0 pendentes
        var orderCheck2 = await client.GetFromJsonAsync<PurchaseOrderResponse>($"/api/procurement/orders/{order.Id}");
        Assert.NotNull(orderCheck2);
        Assert.Equal(PurchaseOrderStatus.Received, orderCheck2.Status);
        Assert.Equal(10, orderCheck2.Items[0].QuantityReceived);
        Assert.Equal(0, orderCheck2.Items[0].QuantityPending);

        // 4. Conferir Saldo Materializado no Estoque (MOD-03)
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var balance = await db.StockBalances
            .FirstOrDefaultAsync(b => b.BranchId == data.branchId && b.WarehouseId == data.warehouseId && b.ProductSkuId == data.batchSkuId);
        Assert.NotNull(balance);
        Assert.Equal(10, balance.OnHandQuantity);
        Assert.Equal(90.00m, balance.AverageCost);

        // 5. Conferir Movimentos Append-Only no Kardex oficial
        var movements = await db.StockMovements
            .Where(m => m.BranchId == data.branchId && m.ProductSkuId == data.batchSkuId && m.MovementType == StockMovementType.PurchaseReceipt)
            .OrderBy(m => m.CreatedAtUtc)
            .ToListAsync();

        Assert.Equal(2, movements.Count);
        Assert.Equal(4, movements[0].Quantity);
        Assert.Equal(6, movements[1].Quantity);
    }

    [Fact]
    public async Task GoodsReceipt_Idempotency_ShouldNotDuplicateMovement()
    {
        var data = await SeedBaseDataAsync();
        var client = _factory.CreateClient();

        var token = _jwtTokenService.GenerateToken(data.tenantId, data.branchId, Guid.NewGuid(), "comprador@hbstudio.com.br", new[]
        {
            PermissionCatalog.PurchasesView,
            PermissionCatalog.PurchasesCreate,
            PermissionCatalog.PurchasesApprove,
            PermissionCatalog.PurchasesReceive,
            PermissionCatalog.PurchasesCostView
        });
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token.AccessToken);

        var idemKey = "KEY-IDEMP-" + Guid.NewGuid().ToString("N");
        var receiptDto = new CreateGoodsReceiptDto(
            data.branchId,
            data.warehouseId,
            WarehouseLocationId: null,
            PurchaseOrderId: null,
            data.supplierId,
            ReceiptNumber: "REC-IDEMP-" + Guid.NewGuid().ToString("N")[..4],
            InvoiceOrDocumentNumber: "NF-AVULSA-123",
            new List<CreateGoodsReceiptItemDto>
            {
                new(data.batchSkuId, QuantityReceived: 5, RealUnitCost: 100.00m)
            },
            IdempotencyKey: idemKey
        );

        // Primeira chamada
        var res1 = await client.PostAsJsonAsync("/api/procurement/receipts", receiptDto);
        Assert.Equal(HttpStatusCode.Created, res1.StatusCode);
        var rec1 = await res1.Content.ReadFromJsonAsync<GoodsReceiptResponse>();

        // Segunda chamada com mesmo IdempotencyKey
        var res2 = await client.PostAsJsonAsync("/api/procurement/receipts", receiptDto);
        Assert.True(res2.IsSuccessStatusCode);
        var rec2 = await res2.Content.ReadFromJsonAsync<GoodsReceiptResponse>();

        Assert.NotNull(rec1);
        Assert.NotNull(rec2);
        Assert.Equal(rec1.Id, rec2.Id);

        // Conferir no banco que só houve 1 movimento de estoque
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var count = await db.StockMovements.CountAsync(m => m.WarehouseId == data.warehouseId && m.ProductSkuId == data.batchSkuId);
        Assert.Equal(1, count);
    }

    [Fact]
    public async Task UsedDeviceAcquisition_ShouldInspect_Approve_CreateInventoryUnit_AndKardex()
    {
        var data = await SeedBaseDataAsync();
        var client = _factory.CreateClient();

        var token = _jwtTokenService.GenerateToken(data.tenantId, data.branchId, Guid.NewGuid(), "avaliador@hbstudio.com.br", new[]
        {
            PermissionCatalog.PurchasesView,
            PermissionCatalog.PurchasesCreate,
            PermissionCatalog.PurchasesApprove,
            PermissionCatalog.PurchasesCostView,
            PermissionCatalog.InventoryView
        });
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token.AccessToken);

        var serial = "F2L" + Guid.NewGuid().ToString("N")[..8].ToUpperInvariant();
        var imei1 = "3589" + Guid.NewGuid().ToString("N")[..11];

        // 1. Cadastrar Avaliação Técnica no Balcão
        var dto = new RegisterUsedDeviceAcquisitionDto(
            data.branchId,
            data.warehouseId,
            WarehouseLocationId: null,
            data.customerId,
            data.serializedSkuId,
            AcquisitionNumber: "ACQ-" + Guid.NewGuid().ToString("N")[..6],
            SerialNumber: serial,
            Imei1: imei1,
            Imei2: null,
            Condition: ItemCondition.PreOwned,
            Grade: CosmeticGrade.GradeA,
            BatteryHealthPercentage: 89,
            NegotiatedPrice: 3200.00m,
            AttributableExpenses: 150.00m, // Higienização + Laudo
            ChecklistInspectionJson: "{\"screen\": \"Original\", \"faceId\": \"OK\", \"camera\": \"OK\", \"housing\": \"Sem riscos\"}",
            Notes: "Aparelho adquirido de cliente com nota fiscal de origem"
        );

        var regRes = await client.PostAsJsonAsync("/api/procurement/used-devices", dto);
        Assert.Equal(HttpStatusCode.Created, regRes.StatusCode);
        var acq = await regRes.Content.ReadFromJsonAsync<UsedDeviceAcquisitionResponse>();
        Assert.NotNull(acq);
        Assert.Equal(UsedDeviceStatus.Evaluating, acq.Status);
        Assert.Equal(3350.00m, acq.TotalAcquisitionCost);

        // 2. Aprovar e Receber no Estoque
        var receiveRes = await client.PostAsync($"/api/procurement/used-devices/{acq.Id}/approve-receive?warehouseId={data.warehouseId}", null);
        Assert.Equal(HttpStatusCode.OK, receiveRes.StatusCode);
        var receivedAcq = await receiveRes.Content.ReadFromJsonAsync<UsedDeviceAcquisitionResponse>();
        Assert.NotNull(receivedAcq);
        Assert.Equal(UsedDeviceStatus.ReceivedInStock, receivedAcq.Status);
        Assert.NotNull(receivedAcq.InventoryUnitId);

        // 3. Verificar no Banco: Unidade criada, Identificadores registrados, Kardex CustomerBuyback e SerialStockPosition
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var unit = await db.InventoryUnits
            .Include(u => u.Identifiers)
            .FirstOrDefaultAsync(u => u.Id == receivedAcq.InventoryUnitId.Value);

        Assert.NotNull(unit);
        Assert.Equal(3350.00m, unit.AcquisitionCost);
        Assert.Equal(ItemCondition.PreOwned, unit.Condition);
        Assert.Equal(UnitOperationalStatus.ApprovedForSale, unit.OperationalStatus);
        Assert.Contains(unit.Identifiers, id => id.NormalizedValue == InventoryUnitIdentifier.Normalize(imei1));

        var position = await db.SerialStockPositions.FirstOrDefaultAsync(p => p.InventoryUnitId == unit.Id);
        Assert.NotNull(position);
        Assert.Equal(data.warehouseId, position.WarehouseId);

        var movement = await db.StockMovements.FirstOrDefaultAsync(m => m.InventoryUnitId == unit.Id);
        Assert.NotNull(movement);
        Assert.Equal(StockMovementType.CustomerBuyback, movement.MovementType);
        Assert.Equal(1, movement.Quantity);
        Assert.Equal(3350.00m, movement.UnitCost);
    }

    [Fact]
    public async Task SupplierReturn_ShouldDispatchAndDeductStock()
    {
        var data = await SeedBaseDataAsync();
        var client = _factory.CreateClient();

        var token = _jwtTokenService.GenerateToken(data.tenantId, data.branchId, Guid.NewGuid(), "comprador@hbstudio.com.br", new[]
        {
            PermissionCatalog.PurchasesView,
            PermissionCatalog.PurchasesCreate,
            PermissionCatalog.PurchasesApprove,
            PermissionCatalog.PurchasesReceive,
            PermissionCatalog.PurchasesCostView,
            PermissionCatalog.InventoryView
        });
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token.AccessToken);

        // 1. Dar entrada inicial de 8 unidades
        var receiptDto = new CreateGoodsReceiptDto(
            data.branchId,
            data.warehouseId,
            WarehouseLocationId: null,
            PurchaseOrderId: null,
            data.supplierId,
            ReceiptNumber: "REC-FOR-RET-" + Guid.NewGuid().ToString("N")[..4],
            InvoiceOrDocumentNumber: "NF-INIT-101",
            new List<CreateGoodsReceiptItemDto>
            {
                new(data.batchSkuId, QuantityReceived: 8, RealUnitCost: 100.00m)
            }
        );
        var recRes = await client.PostAsJsonAsync("/api/procurement/receipts", receiptDto);
        Assert.Equal(HttpStatusCode.Created, recRes.StatusCode);

        // 2. Criar e Despachar Devolução de 3 unidades com vício
        var returnDto = new CreateSupplierReturnDto(
            data.branchId,
            data.warehouseId,
            data.supplierId,
            GoodsReceiptId: null,
            ReturnNumber: "DEV-2026-" + Guid.NewGuid().ToString("N")[..4],
            Reason: "Carretel quebrado no lote recebido",
            new List<CreateSupplierReturnItemDto>
            {
                new(data.batchSkuId, Quantity: 3, UnitCost: 100.00m)
            },
            ReturnInvoiceNumber: "NF-DEV-5544"
        );

        var returnRes = await client.PostAsJsonAsync("/api/procurement/returns", returnDto);
        Assert.Equal(HttpStatusCode.Created, returnRes.StatusCode);
        var dev = await returnRes.Content.ReadFromJsonAsync<SupplierReturnResponse>();
        Assert.NotNull(dev);
        Assert.Equal(SupplierReturnStatus.DispatchedAndPosted, dev.Status);

        // 3. Verificar baixa no saldo do Kardex (8 - 3 = 5 restantes)
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var balance = await db.StockBalances
            .FirstOrDefaultAsync(b => b.BranchId == data.branchId && b.WarehouseId == data.warehouseId && b.ProductSkuId == data.batchSkuId);
        Assert.NotNull(balance);
        Assert.Equal(5, balance.OnHandQuantity);

        var returnMovement = await db.StockMovements
            .FirstOrDefaultAsync(m => m.CorrelationId == dev.Id && m.MovementType == StockMovementType.SaleIssue);
        Assert.NotNull(returnMovement);
        Assert.Equal(-3, returnMovement.Quantity);
    }

    [Fact]
    public async Task CostProtection_UserWithoutPermission_ShouldNotSeeCostData()
    {
        var data = await SeedBaseDataAsync();
        var client = _factory.CreateClient();

        // 1. Cadastrar pedido com usuário com permissão total
        var fullToken = _jwtTokenService.GenerateToken(data.tenantId, data.branchId, Guid.NewGuid(), "gerente@hbstudio.com.br", new[]
        {
            PermissionCatalog.PurchasesView,
            PermissionCatalog.PurchasesCreate,
            PermissionCatalog.PurchasesApprove,
            PermissionCatalog.PurchasesCostView
        });
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", fullToken.AccessToken);

        var orderDto = new CreatePurchaseOrderDto(
            data.branchId,
            data.supplierId,
            "PO-COST-" + Guid.NewGuid().ToString("N")[..4],
            DateTime.UtcNow.AddDays(3),
            "14 Dias",
            ShippingCost: 120.00m,
            OtherExpenses: 30.00m,
            TotalDiscount: 10.00m,
            new List<CreatePurchaseOrderItemDto>
            {
                new(data.batchSkuId, QuantityOrdered: 5, UnitCost: 80.00m)
            }
        );
        var createRes = await client.PostAsJsonAsync("/api/procurement/orders", orderDto);
        var createdOrder = await createRes.Content.ReadFromJsonAsync<PurchaseOrderResponse>();
        Assert.NotNull(createdOrder);
        Assert.Equal(120.00m, createdOrder.ShippingCost);
        Assert.Equal(80.00m, createdOrder.Items[0].UnitCost);

        // 2. Consultar o mesmo pedido com usuário SEM permissão purchases.cost.view
        var restrictedToken = _jwtTokenService.GenerateToken(data.tenantId, data.branchId, Guid.NewGuid(), "atendente@hbstudio.com.br", new[]
        {
            PermissionCatalog.PurchasesView
        });
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", restrictedToken.AccessToken);

        var restrictedOrder = await client.GetFromJsonAsync<PurchaseOrderResponse>($"/api/procurement/orders/{createdOrder.Id}");
        Assert.NotNull(restrictedOrder);
        Assert.Null(restrictedOrder.ShippingCost);
        Assert.Null(restrictedOrder.TotalOrderAmount);
        Assert.Null(restrictedOrder.ItemsSubtotal);
        Assert.Null(restrictedOrder.Items[0].UnitCost);
        Assert.Null(restrictedOrder.Items[0].TotalAmount);
    }
}
