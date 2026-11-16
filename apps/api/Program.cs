using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using BuildingBlocks.Application;
using BuildingBlocks.Domain;
using BuildingBlocks.Infrastructure;
using BuildingBlocks.Security;

var builder = WebApplication.CreateBuilder(args);

// Configuração do DbContext PostgreSQL
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection") 
    ?? "Host=127.0.0.1;Port=5433;Database=hbstudio_erp_test;Username=postgres;Password=;";

builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<IExecutionContext, HttpExecutionContextAccessor>();

builder.Services.AddDbContext<AppDbContext>((sp, options) =>
{
    options.UseNpgsql(connectionString);
});

// Modulo Parties
builder.Services.AddScoped<Parties.Application.IPartiesService, Parties.Application.PartiesService>();

// Modulo Catalog & Inventory
builder.Services.AddScoped<Catalog.Application.ICatalogService, Catalog.Application.CatalogService>();
builder.Services.AddScoped<Inventory.Application.InventoryService>();
builder.Services.AddScoped<Procurement.Application.ProcurementService>();
builder.Services.AddScoped<Sales.Application.SalesService>();
builder.Services.AddScoped<CashManagement.Application.CashManagementService>();
builder.Services.AddScoped<Financial.Application.FinancialService>();
builder.Services.AddScoped<PartnersCapital.Domain.Repositories.IPartnersCapitalRepository, PartnersCapital.Infrastructure.Repositories.PartnersCapitalRepository>();
builder.Services.AddScoped<PartnersCapital.Application.Services.PartnersCapitalService>();

// Modulo RepairService (MOD-07)
builder.Services.AddScoped<RepairService.Domain.Repositories.IRepairServiceRepository, RepairService.Infrastructure.Repositories.RepairServiceRepository>();
builder.Services.AddScoped<RepairService.Application.Services.RepairServiceAppService>();

// Modulo CRM (MOD-08)
builder.Services.AddScoped<CRM.Domain.Repositories.ICrmRepository, CRM.Infrastructure.Repositories.CrmRepository>();
builder.Services.AddScoped<CRM.Application.Services.CrmAppService>();
builder.Services.AddScoped<Microsoft.EntityFrameworkCore.DbContext>(sp => sp.GetRequiredService<AppDbContext>());

// Configuração de Autenticação JWT
var jwtKey = builder.Configuration["Jwt:Key"] ?? "HBStudioEnterpriseErpSuperSecretKey20261113!";
var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "HBStudioErp";
var jwtAudience = builder.Configuration["Jwt:Audience"] ?? "HBStudioErpClient";

builder.Services.AddSingleton<ITokenService>(new JwtTokenService(jwtKey, jwtIssuer, jwtAudience));

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtIssuer,
            ValidAudience = jwtAudience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))
        };
    });

// Configuração do Pipeline de Autorização por PermissionKeys
builder.Services.AddScoped<IAuthorizationHandler, PermissionAuthorizationHandler>();

builder.Services.AddAuthorization(options =>
{
    foreach (var permission in PermissionCatalog.All)
    {
        options.AddPolicy(permission, policy => policy.Requirements.Add(new PermissionRequirement(permission)));
    }
});

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddProblemDetails();

var app = builder.Build();

app.UseStatusCodePages();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseAuthentication();
app.UseAuthorization();

// Health Check Endpoint
app.MapGet("/health", () => Results.Ok(new { status = "Healthy", timestamp = DateTime.UtcNow }));

// Endpoints do Módulo Parties
var partiesGroup = app.MapGroup("/api/parties").RequireAuthorization();

partiesGroup.MapGet("/", async (
    string? search, 
    bool? onlyCustomers, 
    bool? onlySuppliers, 
    int? page, 
    int? pageSize, 
    Parties.Application.IPartiesService service, 
    CancellationToken ct) =>
{
    var result = await service.ListAsync(search, onlyCustomers, onlySuppliers, page ?? 1, pageSize ?? 20, ct);
    return Results.Ok(result);
}).RequireAuthorization(PermissionCatalog.CustomersView);

partiesGroup.MapGet("/{id:guid}", async (Guid id, Parties.Application.IPartiesService service, CancellationToken ct) =>
{
    var party = await service.GetByIdAsync(id, ct);
    return party == null ? Results.NotFound() : Results.Ok(party);
}).RequireAuthorization(PermissionCatalog.CustomersView);

partiesGroup.MapPost("/", async (Parties.Application.CreatePartyRequest req, Parties.Application.IPartiesService service, CancellationToken ct) =>
{
    var created = await service.CreateAsync(req, ct);
    return Results.Created($"/api/parties/{created.Id}", created);
}).RequireAuthorization(PermissionCatalog.CustomersCreate);

partiesGroup.MapPut("/{id:guid}", async (Guid id, Parties.Application.UpdatePartyRequest req, Parties.Application.IPartiesService service, CancellationToken ct) =>
{
    try
    {
        var updated = await service.UpdateAsync(id, req, ct);
        return Results.Ok(updated);
    }
    catch (Microsoft.EntityFrameworkCore.DbUpdateConcurrencyException)
    {
        return Results.Conflict(new { error = "Conflito de concorrência detectado: o registro foi alterado simultaneamente por outro usuário." });
    }
    catch (KeyNotFoundException)
    {
        return Results.NotFound();
    }
}).RequireAuthorization(PermissionCatalog.CustomersEdit);

partiesGroup.MapPost("/{id:guid}/equipments", async (Guid id, Parties.Application.AddEquipmentRequest req, Parties.Application.IPartiesService service, CancellationToken ct) =>
{
    var eq = await service.AddEquipmentAsync(id, req, ct);
    return Results.Created($"/api/parties/{id}/equipments/{eq.Id}", eq);
}).RequireAuthorization(PermissionCatalog.CustomersEdit);

partiesGroup.MapPost("/{id:guid}/consents", async (Guid id, Parties.Application.RecordConsentRequest req, Parties.Application.IPartiesService service, CancellationToken ct) =>
{
    var consent = await service.RecordConsentAsync(id, req, ct);
    return Results.Created($"/api/parties/{id}/consents/{consent.Id}", consent);
}).RequireAuthorization(PermissionCatalog.CustomersEdit);

// Endpoints do Módulo Catalog & InventoryUnit
var catalogGroup = app.MapGroup("/api/catalog").RequireAuthorization();

// Categorias
catalogGroup.MapGet("/categories", async (Catalog.Application.ICatalogService service, CancellationToken ct) =>
{
    var categories = await service.ListCategoriesAsync(ct);
    return Results.Ok(categories);
}).RequireAuthorization(PermissionCatalog.CatalogProductsView);

catalogGroup.MapPost("/categories", async (Catalog.Application.CreateCategoryRequest req, Catalog.Application.ICatalogService service, CancellationToken ct) =>
{
    var created = await service.CreateCategoryAsync(req, ct);
    return Results.Created($"/api/catalog/categories/{created.Id}", created);
}).RequireAuthorization(PermissionCatalog.CatalogProductsManage);

// Marcas
catalogGroup.MapGet("/brands", async (Catalog.Application.ICatalogService service, CancellationToken ct) =>
{
    var brands = await service.ListBrandsAsync(ct);
    return Results.Ok(brands);
}).RequireAuthorization(PermissionCatalog.CatalogProductsView);

catalogGroup.MapPost("/brands", async (Catalog.Application.CreateBrandRequest req, Catalog.Application.ICatalogService service, CancellationToken ct) =>
{
    var created = await service.CreateBrandAsync(req, ct);
    return Results.Created($"/api/catalog/brands/{created.Id}", created);
}).RequireAuthorization(PermissionCatalog.CatalogProductsManage);

// Modelos de Produtos
catalogGroup.MapGet("/models", async (string? search, Guid? categoryId, Guid? brandId, Catalog.Application.ICatalogService service, CancellationToken ct) =>
{
    var models = await service.ListModelsAsync(search, categoryId, brandId, ct);
    return Results.Ok(models);
}).RequireAuthorization(PermissionCatalog.CatalogProductsView);

catalogGroup.MapGet("/models/{id:guid}", async (Guid id, Catalog.Application.ICatalogService service, CancellationToken ct) =>
{
    var model = await service.GetModelByIdAsync(id, ct);
    return model == null ? Results.NotFound() : Results.Ok(model);
}).RequireAuthorization(PermissionCatalog.CatalogProductsView);

catalogGroup.MapPost("/models", async (Catalog.Application.CreateProductModelRequest req, Catalog.Application.ICatalogService service, CancellationToken ct) =>
{
    var created = await service.CreateModelAsync(req, ct);
    return Results.Created($"/api/catalog/models/{created.Id}", created);
}).RequireAuthorization(PermissionCatalog.CatalogProductsManage);

// SKUs
catalogGroup.MapPost("/models/{id:guid}/skus", async (Guid id, Catalog.Application.CreateProductSkuRequest req, Catalog.Application.ICatalogService service, CancellationToken ct) =>
{
    try
    {
        var created = await service.AddSkuAsync(id, req, ct);
        return Results.Created($"/api/catalog/skus/{created.Id}", created);
    }
    catch (KeyNotFoundException)
    {
        return Results.NotFound();
    }
}).RequireAuthorization(PermissionCatalog.CatalogProductsManage);

catalogGroup.MapPut("/skus/{id:guid}/price", async (Guid id, Catalog.Application.UpdateSkuPriceRequest req, Catalog.Application.ICatalogService service, CancellationToken ct) =>
{
    try
    {
        var updated = await service.UpdateSkuPriceAsync(id, req, ct);
        return Results.Ok(updated);
    }
    catch (Microsoft.EntityFrameworkCore.DbUpdateConcurrencyException)
    {
        return Results.Conflict(new { error = "Conflito de concorrência detectado: o SKU foi alterado simultaneamente por outro usuário." });
    }
    catch (KeyNotFoundException)
    {
        return Results.NotFound();
    }
}).RequireAuthorization(PermissionCatalog.CatalogProductsManage);

// Unidades Físicas / Serializadas / Usados
catalogGroup.MapGet("/units", async (
    Guid? skuId,
    string? search,
    Catalog.Domain.UnitOperationalStatus? status,
    System.Security.Claims.ClaimsPrincipal user,
    Catalog.Application.ICatalogService service,
    CancellationToken ct) =>
{
    bool canViewCost = user.HasClaim("permission", PermissionCatalog.CatalogCostView);
    var units = await service.ListUnitsAsync(skuId, search, status, canViewCost, ct);
    return Results.Ok(units);
}).RequireAuthorization(PermissionCatalog.CatalogProductsView);

catalogGroup.MapGet("/units/{id:guid}", async (
    Guid id,
    System.Security.Claims.ClaimsPrincipal user,
    Catalog.Application.ICatalogService service,
    CancellationToken ct) =>
{
    bool canViewCost = user.HasClaim("permission", PermissionCatalog.CatalogCostView);
    var unit = await service.GetUnitByIdAsync(id, canViewCost, ct);
    return unit == null ? Results.NotFound() : Results.Ok(unit);
}).RequireAuthorization(PermissionCatalog.CatalogProductsView);

catalogGroup.MapPost("/units", async (
    Catalog.Application.RegisterInventoryUnitRequest req,
    System.Security.Claims.ClaimsPrincipal user,
    Catalog.Application.ICatalogService service,
    CancellationToken ct) =>
{
    try
    {
        bool canViewCost = user.HasClaim("permission", PermissionCatalog.CatalogCostView);
        var created = await service.RegisterUnitAsync(req, canViewCost, ct);
        return Results.Created($"/api/catalog/units/{created.Id}", created);
    }
    catch (KeyNotFoundException)
    {
        return Results.NotFound();
    }
    catch (InvalidOperationException ex)
    {
        return Results.BadRequest(new { error = ex.Message });
    }
    catch (ArgumentException ex)
    {
        return Results.BadRequest(new { error = ex.Message });
    }
}).RequireAuthorization(PermissionCatalog.CatalogProductsManage);

catalogGroup.MapPut("/units/{id:guid}/approve", async (
    Guid id,
    Catalog.Application.ApproveUnitForSaleRequest req,
    System.Security.Claims.ClaimsPrincipal user,
    Catalog.Application.ICatalogService service,
    CancellationToken ct) =>
{
    try
    {
        bool canViewCost = user.HasClaim("permission", PermissionCatalog.CatalogCostView);
        var approved = await service.ApproveUnitForSaleAsync(id, req, canViewCost, ct);
        return Results.Ok(approved);
    }
    catch (Microsoft.EntityFrameworkCore.DbUpdateConcurrencyException)
    {
        return Results.Conflict(new { error = "Conflito de concorrência detectado na unidade física." });
    }
    catch (KeyNotFoundException)
    {
        return Results.NotFound();
    }
}).RequireAuthorization(PermissionCatalog.CatalogProductsManage);

// Endpoints do Módulo Inventory & Kardex
var inventoryGroup = app.MapGroup("/api/inventory").RequireAuthorization();

// Almoxarifados e Localizações
inventoryGroup.MapGet("/warehouses", async (
    Guid? branchId,
    Inventory.Application.InventoryService service,
    CancellationToken ct) =>
{
    var list = await service.ListWarehousesAsync(branchId, ct);
    return Results.Ok(list);
}).RequireAuthorization(PermissionCatalog.InventoryView);

inventoryGroup.MapPost("/warehouses", async (
    Inventory.Application.CreateWarehouseRequest req,
    Inventory.Application.InventoryService service,
    CancellationToken ct) =>
{
    var created = await service.CreateWarehouseAsync(req, ct);
    return Results.Created($"/api/inventory/warehouses/{created.Id}", created);
}).RequireAuthorization(PermissionCatalog.InventoryMove);

inventoryGroup.MapGet("/warehouses/{id:guid}/locations", async (
    Guid id,
    Inventory.Application.InventoryService service,
    CancellationToken ct) =>
{
    var list = await service.ListLocationsAsync(id, ct);
    return Results.Ok(list);
}).RequireAuthorization(PermissionCatalog.InventoryView);

inventoryGroup.MapPost("/warehouses/{id:guid}/locations", async (
    Guid id,
    Inventory.Application.CreateWarehouseLocationRequest req,
    Inventory.Application.InventoryService service,
    CancellationToken ct) =>
{
    var created = await service.AddLocationAsync(id, req, ct);
    return Results.Created($"/api/inventory/warehouses/{id}/locations/{created.Id}", created);
}).RequireAuthorization(PermissionCatalog.InventoryMove);

// Saldos e Posições de Estoque
inventoryGroup.MapGet("/balances", async (
    Guid? branchId,
    Guid? warehouseId,
    Guid? skuId,
    System.Security.Claims.ClaimsPrincipal user,
    Inventory.Application.InventoryService service,
    CancellationToken ct) =>
{
    bool canViewCost = user.HasClaim("permission", PermissionCatalog.InventoryCostView);
    var balances = await service.ListBalancesAsync(branchId, warehouseId, skuId, canViewCost, ct);
    return Results.Ok(balances);
}).RequireAuthorization(PermissionCatalog.InventoryView);

// Kardex Imutável
inventoryGroup.MapGet("/kardex", async (
    Guid? branchId,
    Guid? warehouseId,
    Guid? skuId,
    Guid? inventoryUnitId,
    System.Security.Claims.ClaimsPrincipal user,
    Inventory.Application.InventoryService service,
    CancellationToken ct) =>
{
    bool canViewCost = user.HasClaim("permission", PermissionCatalog.InventoryCostView);
    var history = await service.GetKardexAsync(branchId, warehouseId, skuId, inventoryUnitId, canViewCost, ct);
    return Results.Ok(history);
}).RequireAuthorization(PermissionCatalog.InventoryView);

// Entrada Inicial / Recebimento de Estoque com Kardex
inventoryGroup.MapPost("/initial-receipt", async (
    Inventory.Application.InitialStockReceiptRequest req,
    System.Security.Claims.ClaimsPrincipal user,
    Inventory.Application.InventoryService service,
    CancellationToken ct) =>
{
    bool canViewCost = user.HasClaim("permission", PermissionCatalog.InventoryCostView);
    var movement = await service.RegisterInitialReceiptAsync(req, canViewCost, ct);
    return Results.Created($"/api/inventory/kardex/{movement.Id}", movement);
}).RequireAuthorization(PermissionCatalog.InventoryMove);

// Reservas de Estoque
inventoryGroup.MapPost("/reservations", async (
    Inventory.Application.CreateReservationRequest req,
    Inventory.Application.InventoryService service,
    CancellationToken ct) =>
{
    var reservation = await service.CreateReservationAsync(req, ct);
    return Results.Created($"/api/inventory/reservations/{reservation.Id}", reservation);
}).RequireAuthorization(PermissionCatalog.InventoryMove);

inventoryGroup.MapPost("/reservations/{id:guid}/release", async (
    Guid id,
    Inventory.Application.InventoryService service,
    CancellationToken ct) =>
{
    var released = await service.ReleaseReservationAsync(id, ct);
    return Results.Ok(released);
}).RequireAuthorization(PermissionCatalog.InventoryMove);

inventoryGroup.MapPost("/reservations/{id:guid}/consume", async (
    Guid id,
    Inventory.Application.InventoryService service,
    CancellationToken ct) =>
{
    var consumed = await service.ConsumeReservationAsync(id, ct);
    return Results.Ok(consumed);
}).RequireAuthorization(PermissionCatalog.InventoryMove);

// Transferências Entre Depósitos / Filiais
inventoryGroup.MapPost("/transfers", async (
    Inventory.Application.CreateTransferRequest req,
    Inventory.Application.InventoryService service,
    CancellationToken ct) =>
{
    var transfer = await service.CreateTransferAsync(req, ct);
    return Results.Created($"/api/inventory/transfers/{transfer.Id}", transfer);
}).RequireAuthorization(PermissionCatalog.InventoryMove);

inventoryGroup.MapPost("/transfers/{id:guid}/dispatch", async (
    Guid id,
    Inventory.Application.InventoryService service,
    CancellationToken ct) =>
{
    var dispatched = await service.DispatchTransferAsync(id, ct);
    return Results.Ok(dispatched);
}).RequireAuthorization(PermissionCatalog.InventoryMove);

inventoryGroup.MapPost("/transfers/{id:guid}/receive", async (
    Guid id,
    Inventory.Application.InventoryService service,
    CancellationToken ct) =>
{
    var received = await service.ReceiveTransferAsync(id, ct);
    return Results.Ok(received);
}).RequireAuthorization(PermissionCatalog.InventoryMove);

// Inventário Físico (Contagem e Reconciliação)
inventoryGroup.MapPost("/counts", async (
    Inventory.Application.CreateInventoryCountRequest req,
    Inventory.Application.InventoryService service,
    CancellationToken ct) =>
{
    var count = await service.CreateCountAsync(req, ct);
    return Results.Created($"/api/inventory/counts/{count.Id}", count);
}).RequireAuthorization(PermissionCatalog.InventoryAdjust);

inventoryGroup.MapPost("/counts/{id:guid}/records", async (
    Guid id,
    Inventory.Application.RecordCountItemRequest req,
    Inventory.Application.InventoryService service,
    CancellationToken ct) =>
{
    var updated = await service.RecordCountItemAsync(id, req, ct);
    return Results.Ok(updated);
}).RequireAuthorization(PermissionCatalog.InventoryAdjust);

inventoryGroup.MapPost("/counts/{id:guid}/approve-post", async (
    Guid id,
    Inventory.Application.InventoryService service,
    CancellationToken ct) =>
{
    var posted = await service.ApproveAndPostCountAsync(id, ct);
    return Results.Ok(posted);
}).RequireAuthorization(PermissionCatalog.InventoryAdjust);

// ==========================================
// Modulo Procurement (MOD-04) - Compras e Usados
// ==========================================
var procurementGroup = app.MapGroup("/api/procurement");

// Requisições de Compra
procurementGroup.MapGet("/requests", async (
    Guid? branchId,
    Procurement.Domain.PurchaseRequestStatus? status,
    System.Security.Claims.ClaimsPrincipal user,
    Procurement.Application.ProcurementService service,
    CancellationToken ct) =>
{
    bool canViewCost = user.HasClaim("permission", PermissionCatalog.PurchasesCostView);
    var list = await service.ListPurchaseRequestsAsync(branchId, status, canViewCost, ct);
    return Results.Ok(list);
}).RequireAuthorization(PermissionCatalog.PurchasesView);

procurementGroup.MapGet("/requests/{id:guid}", async (
    Guid id,
    System.Security.Claims.ClaimsPrincipal user,
    Procurement.Application.ProcurementService service,
    CancellationToken ct) =>
{
    bool canViewCost = user.HasClaim("permission", PermissionCatalog.PurchasesCostView);
    var item = await service.GetPurchaseRequestByIdAsync(id, canViewCost, ct);
    return Results.Ok(item);
}).RequireAuthorization(PermissionCatalog.PurchasesView);

procurementGroup.MapPost("/requests", async (
    Procurement.Application.CreatePurchaseRequestDto req,
    System.Security.Claims.ClaimsPrincipal user,
    Procurement.Application.ProcurementService service,
    CancellationToken ct) =>
{
    bool canViewCost = user.HasClaim("permission", PermissionCatalog.PurchasesCostView);
    var created = await service.CreatePurchaseRequestAsync(req, canViewCost, ct);
    return Results.Created($"/api/procurement/requests/{created.Id}", created);
}).RequireAuthorization(PermissionCatalog.PurchasesCreate);

procurementGroup.MapPost("/requests/{id:guid}/submit", async (
    Guid id,
    System.Security.Claims.ClaimsPrincipal user,
    Procurement.Application.ProcurementService service,
    CancellationToken ct) =>
{
    bool canViewCost = user.HasClaim("permission", PermissionCatalog.PurchasesCostView);
    var submitted = await service.SubmitPurchaseRequestAsync(id, canViewCost, ct);
    return Results.Ok(submitted);
}).RequireAuthorization(PermissionCatalog.PurchasesCreate);

procurementGroup.MapPost("/requests/{id:guid}/approve", async (
    Guid id,
    string? notes,
    System.Security.Claims.ClaimsPrincipal user,
    Procurement.Application.ProcurementService service,
    CancellationToken ct) =>
{
    bool canViewCost = user.HasClaim("permission", PermissionCatalog.PurchasesCostView);
    var approved = await service.ApprovePurchaseRequestAsync(id, notes, canViewCost, ct);
    return Results.Ok(approved);
}).RequireAuthorization(PermissionCatalog.PurchasesApprove);

procurementGroup.MapPost("/requests/{id:guid}/reject", async (
    Guid id,
    string notes,
    System.Security.Claims.ClaimsPrincipal user,
    Procurement.Application.ProcurementService service,
    CancellationToken ct) =>
{
    bool canViewCost = user.HasClaim("permission", PermissionCatalog.PurchasesCostView);
    var rejected = await service.RejectPurchaseRequestAsync(id, notes, canViewCost, ct);
    return Results.Ok(rejected);
}).RequireAuthorization(PermissionCatalog.PurchasesApprove);

// Cotações
procurementGroup.MapGet("/quotations", async (
    Guid? branchId,
    Guid? supplierPartyId,
    Procurement.Domain.QuotationStatus? status,
    System.Security.Claims.ClaimsPrincipal user,
    Procurement.Application.ProcurementService service,
    CancellationToken ct) =>
{
    bool canViewCost = user.HasClaim("permission", PermissionCatalog.PurchasesCostView);
    var list = await service.ListSupplierQuotationsAsync(branchId, supplierPartyId, status, canViewCost, ct);
    return Results.Ok(list);
}).RequireAuthorization(PermissionCatalog.PurchasesView);

procurementGroup.MapGet("/quotations/{id:guid}", async (
    Guid id,
    System.Security.Claims.ClaimsPrincipal user,
    Procurement.Application.ProcurementService service,
    CancellationToken ct) =>
{
    bool canViewCost = user.HasClaim("permission", PermissionCatalog.PurchasesCostView);
    var item = await service.GetSupplierQuotationByIdAsync(id, canViewCost, ct);
    return Results.Ok(item);
}).RequireAuthorization(PermissionCatalog.PurchasesView);

procurementGroup.MapPost("/quotations", async (
    Procurement.Application.CreateSupplierQuotationDto req,
    System.Security.Claims.ClaimsPrincipal user,
    Procurement.Application.ProcurementService service,
    CancellationToken ct) =>
{
    bool canViewCost = user.HasClaim("permission", PermissionCatalog.PurchasesCostView);
    var created = await service.CreateSupplierQuotationAsync(req, canViewCost, ct);
    return Results.Created($"/api/procurement/quotations/{created.Id}", created);
}).RequireAuthorization(PermissionCatalog.PurchasesCreate);

procurementGroup.MapPost("/quotations/{id:guid}/accept", async (
    Guid id,
    System.Security.Claims.ClaimsPrincipal user,
    Procurement.Application.ProcurementService service,
    CancellationToken ct) =>
{
    bool canViewCost = user.HasClaim("permission", PermissionCatalog.PurchasesCostView);
    var accepted = await service.AcceptSupplierQuotationAsync(id, canViewCost, ct);
    return Results.Ok(accepted);
}).RequireAuthorization(PermissionCatalog.PurchasesApprove);

// Pedidos de Compra
procurementGroup.MapGet("/orders", async (
    Guid? branchId,
    Guid? supplierPartyId,
    Procurement.Domain.PurchaseOrderStatus? status,
    System.Security.Claims.ClaimsPrincipal user,
    Procurement.Application.ProcurementService service,
    CancellationToken ct) =>
{
    bool canViewCost = user.HasClaim("permission", PermissionCatalog.PurchasesCostView);
    var list = await service.ListPurchaseOrdersAsync(branchId, supplierPartyId, status, canViewCost, ct);
    return Results.Ok(list);
}).RequireAuthorization(PermissionCatalog.PurchasesView);

procurementGroup.MapGet("/orders/{id:guid}", async (
    Guid id,
    System.Security.Claims.ClaimsPrincipal user,
    Procurement.Application.ProcurementService service,
    CancellationToken ct) =>
{
    bool canViewCost = user.HasClaim("permission", PermissionCatalog.PurchasesCostView);
    var item = await service.GetPurchaseOrderByIdAsync(id, canViewCost, ct);
    return Results.Ok(item);
}).RequireAuthorization(PermissionCatalog.PurchasesView);

procurementGroup.MapPost("/orders", async (
    Procurement.Application.CreatePurchaseOrderDto req,
    System.Security.Claims.ClaimsPrincipal user,
    Procurement.Application.ProcurementService service,
    CancellationToken ct) =>
{
    bool canViewCost = user.HasClaim("permission", PermissionCatalog.PurchasesCostView);
    var created = await service.CreatePurchaseOrderAsync(req, canViewCost, ct);
    return Results.Created($"/api/procurement/orders/{created.Id}", created);
}).RequireAuthorization(PermissionCatalog.PurchasesCreate);

procurementGroup.MapPost("/orders/{id:guid}/submit", async (
    Guid id,
    System.Security.Claims.ClaimsPrincipal user,
    Procurement.Application.ProcurementService service,
    CancellationToken ct) =>
{
    bool canViewCost = user.HasClaim("permission", PermissionCatalog.PurchasesCostView);
    var submitted = await service.SubmitPurchaseOrderAsync(id, canViewCost, ct);
    return Results.Ok(submitted);
}).RequireAuthorization(PermissionCatalog.PurchasesCreate);

procurementGroup.MapPost("/orders/{id:guid}/approve", async (
    Guid id,
    System.Security.Claims.ClaimsPrincipal user,
    Procurement.Application.ProcurementService service,
    CancellationToken ct) =>
{
    bool canViewCost = user.HasClaim("permission", PermissionCatalog.PurchasesCostView);
    var approved = await service.ApprovePurchaseOrderAsync(id, canViewCost, ct);
    return Results.Ok(approved);
}).RequireAuthorization(PermissionCatalog.PurchasesApprove);

procurementGroup.MapPost("/orders/{id:guid}/cancel", async (
    Guid id,
    string reason,
    System.Security.Claims.ClaimsPrincipal user,
    Procurement.Application.ProcurementService service,
    CancellationToken ct) =>
{
    bool canViewCost = user.HasClaim("permission", PermissionCatalog.PurchasesCostView);
    var cancelled = await service.CancelPurchaseOrderAsync(id, reason, canViewCost, ct);
    return Results.Ok(cancelled);
}).RequireAuthorization(PermissionCatalog.PurchasesApprove);

// Recebimento de Mercadorias (Conferência e Kardex)
procurementGroup.MapGet("/receipts", async (
    Guid? branchId,
    Guid? warehouseId,
    Procurement.Domain.GoodsReceiptStatus? status,
    System.Security.Claims.ClaimsPrincipal user,
    Procurement.Application.ProcurementService service,
    CancellationToken ct) =>
{
    bool canViewCost = user.HasClaim("permission", PermissionCatalog.PurchasesCostView);
    var list = await service.ListGoodsReceiptsAsync(branchId, warehouseId, status, canViewCost, ct);
    return Results.Ok(list);
}).RequireAuthorization(PermissionCatalog.PurchasesView);

procurementGroup.MapGet("/receipts/{id:guid}", async (
    Guid id,
    System.Security.Claims.ClaimsPrincipal user,
    Procurement.Application.ProcurementService service,
    CancellationToken ct) =>
{
    bool canViewCost = user.HasClaim("permission", PermissionCatalog.PurchasesCostView);
    var item = await service.GetGoodsReceiptByIdAsync(id, canViewCost, ct);
    return Results.Ok(item);
}).RequireAuthorization(PermissionCatalog.PurchasesView);

procurementGroup.MapPost("/receipts", async (
    Procurement.Application.CreateGoodsReceiptDto req,
    System.Security.Claims.ClaimsPrincipal user,
    Procurement.Application.ProcurementService service,
    CancellationToken ct) =>
{
    bool canViewCost = user.HasClaim("permission", PermissionCatalog.PurchasesCostView);
    var received = await service.CreateAndPostGoodsReceiptAsync(req, canViewCost, ct);
    return Results.Created($"/api/procurement/receipts/{received.Id}", received);
}).RequireAuthorization(PermissionCatalog.PurchasesReceive);

// Aquisição de Usados no Balcão
procurementGroup.MapGet("/used-devices", async (
    Guid? branchId,
    Procurement.Domain.UsedDeviceStatus? status,
    System.Security.Claims.ClaimsPrincipal user,
    Procurement.Application.ProcurementService service,
    CancellationToken ct) =>
{
    bool canViewCost = user.HasClaim("permission", PermissionCatalog.PurchasesCostView);
    var list = await service.ListUsedDeviceAcquisitionsAsync(branchId, status, canViewCost, ct);
    return Results.Ok(list);
}).RequireAuthorization(PermissionCatalog.PurchasesView);

procurementGroup.MapGet("/used-devices/{id:guid}", async (
    Guid id,
    System.Security.Claims.ClaimsPrincipal user,
    Procurement.Application.ProcurementService service,
    CancellationToken ct) =>
{
    bool canViewCost = user.HasClaim("permission", PermissionCatalog.PurchasesCostView);
    var item = await service.GetUsedDeviceAcquisitionByIdAsync(id, canViewCost, ct);
    return Results.Ok(item);
}).RequireAuthorization(PermissionCatalog.PurchasesView);

procurementGroup.MapPost("/used-devices", async (
    Procurement.Application.RegisterUsedDeviceAcquisitionDto req,
    System.Security.Claims.ClaimsPrincipal user,
    Procurement.Application.ProcurementService service,
    CancellationToken ct) =>
{
    bool canViewCost = user.HasClaim("permission", PermissionCatalog.PurchasesCostView);
    var registered = await service.RegisterUsedDeviceAcquisitionAsync(req, canViewCost, ct);
    return Results.Created($"/api/procurement/used-devices/{registered.Id}", registered);
}).RequireAuthorization(PermissionCatalog.PurchasesCreate);

procurementGroup.MapPost("/used-devices/{id:guid}/approve-receive", async (
    Guid id,
    Guid warehouseId,
    Guid? warehouseLocationId,
    System.Security.Claims.ClaimsPrincipal user,
    Procurement.Application.ProcurementService service,
    CancellationToken ct) =>
{
    bool canViewCost = user.HasClaim("permission", PermissionCatalog.PurchasesCostView);
    var received = await service.ApproveAndReceiveUsedDeviceInStockAsync(id, warehouseId, warehouseLocationId, canViewCost, ct);
    return Results.Ok(received);
}).RequireAuthorization(PermissionCatalog.PurchasesApprove);

// Devoluções a Fornecedores
procurementGroup.MapGet("/returns", async (
    Guid? branchId,
    Guid? supplierPartyId,
    Procurement.Domain.SupplierReturnStatus? status,
    System.Security.Claims.ClaimsPrincipal user,
    Procurement.Application.ProcurementService service,
    CancellationToken ct) =>
{
    bool canViewCost = user.HasClaim("permission", PermissionCatalog.PurchasesCostView);
    var list = await service.ListSupplierReturnsAsync(branchId, supplierPartyId, status, canViewCost, ct);
    return Results.Ok(list);
}).RequireAuthorization(PermissionCatalog.PurchasesView);

procurementGroup.MapGet("/returns/{id:guid}", async (
    Guid id,
    System.Security.Claims.ClaimsPrincipal user,
    Procurement.Application.ProcurementService service,
    CancellationToken ct) =>
{
    bool canViewCost = user.HasClaim("permission", PermissionCatalog.PurchasesCostView);
    var item = await service.GetSupplierReturnByIdAsync(id, canViewCost, ct);
    return Results.Ok(item);
}).RequireAuthorization(PermissionCatalog.PurchasesView);

procurementGroup.MapPost("/returns", async (
    Procurement.Application.CreateSupplierReturnDto req,
    System.Security.Claims.ClaimsPrincipal user,
    Procurement.Application.ProcurementService service,
    CancellationToken ct) =>
{
    bool canViewCost = user.HasClaim("permission", PermissionCatalog.PurchasesCostView);
    var returned = await service.CreateAndDispatchSupplierReturnAsync(req, canViewCost, ct);
    return Results.Created($"/api/procurement/returns/{returned.Id}", returned);
}).RequireAuthorization(PermissionCatalog.PurchasesCreate);

// ==========================================
// Modulo Sales (MOD-05) - Orçamentos, PDV e Vendas
// ==========================================
var salesGroup = app.MapGroup("/api/sales");

// Orçamentos
salesGroup.MapGet("/quotes", async (
    Guid? branchId,
    Sales.Domain.SalesQuoteStatus? status,
    Sales.Application.SalesService service,
    CancellationToken ct) =>
{
    var list = await service.ListQuotesAsync(branchId, status, ct);
    return Results.Ok(list);
}).RequireAuthorization(PermissionCatalog.SalesCreate);

salesGroup.MapGet("/quotes/{id:guid}", async (
    Guid id,
    Sales.Application.SalesService service,
    CancellationToken ct) =>
{
    var item = await service.GetQuoteByIdAsync(id, ct);
    return Results.Ok(item);
}).RequireAuthorization(PermissionCatalog.SalesCreate);

salesGroup.MapPost("/quotes", async (
    Sales.Application.CreateSalesQuoteDto req,
    Sales.Application.SalesService service,
    CancellationToken ct) =>
{
    var created = await service.CreateQuoteAsync(req, ct);
    return Results.Created($"/api/sales/quotes/{created.Id}", created);
}).RequireAuthorization(PermissionCatalog.SalesCreate);

salesGroup.MapPost("/quotes/{id:guid}/send", async (
    Guid id,
    Sales.Application.SalesService service,
    CancellationToken ct) =>
{
    var sent = await service.SendQuoteAsync(id, ct);
    return Results.Ok(sent);
}).RequireAuthorization(PermissionCatalog.SalesCreate);

salesGroup.MapPost("/quotes/{id:guid}/accept", async (
    Guid id,
    Sales.Application.SalesService service,
    CancellationToken ct) =>
{
    var accepted = await service.AcceptQuoteAsync(id, ct);
    return Results.Ok(accepted);
}).RequireAuthorization(PermissionCatalog.SalesCreate);

salesGroup.MapPost("/quotes/{id:guid}/convert", async (
    Guid id,
    System.Security.Claims.ClaimsPrincipal user,
    Sales.Application.SalesService service,
    CancellationToken ct) =>
{
    bool canViewCost = user.HasClaim("permission", PermissionCatalog.SalesCostView);
    var sale = await service.ConvertQuoteToSaleAsync(id, canViewCost, ct);
    return Results.Ok(sale);
}).RequireAuthorization(PermissionCatalog.SalesCreate);

// Vendas & PDV
salesGroup.MapGet("/sales", async (
    Guid? branchId,
    Sales.Domain.SaleStatus? status,
    Sales.Domain.SalePaymentStatus? paymentStatus,
    System.Security.Claims.ClaimsPrincipal user,
    Sales.Application.SalesService service,
    CancellationToken ct) =>
{
    bool canViewCost = user.HasClaim("permission", PermissionCatalog.SalesCostView);
    var list = await service.ListSalesAsync(branchId, status, paymentStatus, canViewCost, ct);
    return Results.Ok(list);
}).RequireAuthorization(PermissionCatalog.SalesPosUse);

salesGroup.MapGet("/sales/{id:guid}", async (
    Guid id,
    System.Security.Claims.ClaimsPrincipal user,
    Sales.Application.SalesService service,
    CancellationToken ct) =>
{
    bool canViewCost = user.HasClaim("permission", PermissionCatalog.SalesCostView);
    var item = await service.GetSaleByIdAsync(id, canViewCost, ct);
    return Results.Ok(item);
}).RequireAuthorization(PermissionCatalog.SalesPosUse);

salesGroup.MapPost("/sales", async (
    Sales.Application.CreateSaleDto req,
    System.Security.Claims.ClaimsPrincipal user,
    Sales.Application.SalesService service,
    CancellationToken ct) =>
{
    bool canViewCost = user.HasClaim("permission", PermissionCatalog.SalesCostView);
    var created = await service.CreateSaleAsync(req, canViewCost, ct);
    return Results.Created($"/api/sales/sales/{created.Id}", created);
}).RequireAuthorization(PermissionCatalog.SalesPosUse);

salesGroup.MapPost("/sales/{id:guid}/reserve", async (
    Guid id,
    Guid warehouseId,
    System.Security.Claims.ClaimsPrincipal user,
    Sales.Application.SalesService service,
    CancellationToken ct) =>
{
    bool canViewCost = user.HasClaim("permission", PermissionCatalog.SalesCostView);
    var reserved = await service.ReserveStockForSaleAsync(id, warehouseId, canViewCost, ct);
    return Results.Ok(reserved);
}).RequireAuthorization(PermissionCatalog.SalesPosUse);

salesGroup.MapPost("/sales/{id:guid}/payments", async (
    Guid id,
    Sales.Application.AddPaymentIntentRequest req,
    Sales.Application.SalesService service,
    CancellationToken ct) =>
{
    var payment = await service.RegisterPaymentIntentAsync(id, req, ct);
    return Results.Created($"/api/sales/sales/{id}/payments/{payment.Id}", payment);
}).RequireAuthorization(PermissionCatalog.SalesPosUse);

salesGroup.MapPost("/sales/{id:guid}/payments/{paymentId:guid}/confirm", async (
    Guid id,
    Guid paymentId,
    Sales.Application.ConfirmPaymentIntentRequest req,
    Sales.Application.SalesService service,
    CancellationToken ct) =>
{
    var confirmed = await service.ConfirmPaymentIntentAsync(id, paymentId, req, ct);
    return Results.Ok(confirmed);
}).RequireAuthorization(PermissionCatalog.SalesPosUse);

salesGroup.MapPost("/sales/{id:guid}/complete-fulfill", async (
    Guid id,
    Guid warehouseId,
    System.Security.Claims.ClaimsPrincipal user,
    Sales.Application.SalesService service,
    CancellationToken ct) =>
{
    bool canViewCost = user.HasClaim("permission", PermissionCatalog.SalesCostView);
    var completed = await service.CompleteSaleAndFulfillAsync(id, warehouseId, canViewCost, ct);
    return Results.Ok(completed);
}).RequireAuthorization(PermissionCatalog.SalesPosUse);

salesGroup.MapPost("/sales/{id:guid}/cancel", async (
    Guid id,
    string reason,
    System.Security.Claims.ClaimsPrincipal user,
    Sales.Application.SalesService service,
    CancellationToken ct) =>
{
    bool canViewCost = user.HasClaim("permission", PermissionCatalog.SalesCostView);
    var cancelled = await service.CancelSaleAsync(id, reason, canViewCost, ct);
    return Results.Ok(cancelled);
}).RequireAuthorization(PermissionCatalog.SalesCancel);

// Devoluções de Venda
salesGroup.MapGet("/returns", async (
    Guid? branchId,
    Sales.Application.SalesService service,
    CancellationToken ct) =>
{
    var list = await service.ListSaleReturnsAsync(branchId, ct);
    return Results.Ok(list);
}).RequireAuthorization(PermissionCatalog.SalesPosUse);

salesGroup.MapPost("/returns", async (
    Sales.Application.CreateSaleReturnDto req,
    Sales.Application.SalesService service,
    CancellationToken ct) =>
{
    var created = await service.CreateSaleReturnAsync(req, ct);
    return Results.Created($"/api/sales/returns/{created.Id}", created);
}).RequireAuthorization(PermissionCatalog.SalesCancel);

salesGroup.MapPost("/returns/{id:guid}/restock", async (
    Guid id,
    Guid warehouseId,
    string inspectionNotes,
    Sales.Application.SalesService service,
    CancellationToken ct) =>
{
    var restocked = await service.InspectAndRestockReturnAsync(id, warehouseId, inspectionNotes, ct);
    return Results.Ok(restocked);
}).RequireAuthorization(PermissionCatalog.SalesCancel);

// ==================== CASH MANAGEMENT (MOD-06) ====================
var cashGroup = app.MapGroup("/api/cash").RequireAuthorization();

// Terminais de Caixa
cashGroup.MapGet("/registers", async (
    Guid? branchId,
    CashManagement.Application.CashManagementService service,
    CancellationToken ct) =>
{
    var list = await service.ListRegistersAsync(branchId, ct);
    return Results.Ok(list);
}).RequireAuthorization(PermissionCatalog.CashRegisterView);

cashGroup.MapPost("/registers", async (
    CashManagement.Application.CreateCashRegisterDto req,
    CashManagement.Application.CashManagementService service,
    CancellationToken ct) =>
{
    var created = await service.CreateRegisterAsync(req, ct);
    return Results.Created($"/api/cash/registers/{created.Id}", created);
}).RequireAuthorization(PermissionCatalog.CashRegisterManage);

cashGroup.MapPut("/registers/{id:guid}", async (
    Guid id,
    CashManagement.Application.UpdateCashRegisterDto req,
    CashManagement.Application.CashManagementService service,
    CancellationToken ct) =>
{
    var updated = await service.UpdateRegisterAsync(id, req, ct);
    return Results.Ok(updated);
}).RequireAuthorization(PermissionCatalog.CashRegisterManage);

// Turnos de Caixa
cashGroup.MapGet("/registers/{registerId:guid}/active-shift", async (
    Guid registerId,
    CashManagement.Application.CashManagementService service,
    CancellationToken ct) =>
{
    var shift = await service.GetActiveShiftForRegisterAsync(registerId, ct);
    return shift != null ? Results.Ok(shift) : Results.NotFound();
}).RequireAuthorization(PermissionCatalog.CashShiftView);

cashGroup.MapGet("/shifts", async (
    Guid? branchId,
    CashManagement.Domain.CashShiftStatus? status,
    CashManagement.Application.CashManagementService service,
    CancellationToken ct) =>
{
    var list = await service.ListShiftsAsync(branchId, status, ct);
    return Results.Ok(list);
}).RequireAuthorization(PermissionCatalog.CashShiftView);

cashGroup.MapGet("/shifts/{id:guid}", async (
    Guid id,
    ClaimsPrincipal user,
    CashManagement.Application.CashManagementService service,
    CancellationToken ct) =>
{
    try
    {
        var canViewExpected = user.HasClaim("permission", PermissionCatalog.CashReconcile) || user.HasClaim("permission", PermissionCatalog.CashShiftApprove);
        var shift = await service.GetShiftDetailsAsync(id, canViewExpected, ct);
        return Results.Ok(shift);
    }
    catch (KeyNotFoundException)
    {
        return Results.NotFound();
    }
}).RequireAuthorization(PermissionCatalog.CashShiftView);

cashGroup.MapPost("/shifts/open", async (
    CashManagement.Application.OpenCashShiftDto req,
    CashManagement.Application.CashManagementService service,
    CancellationToken ct) =>
{
    var shift = await service.OpenShiftAsync(req, ct);
    return Results.Created($"/api/cash/shifts/{shift.Id}", shift);
}).RequireAuthorization(PermissionCatalog.CashOpen);

cashGroup.MapPost("/shifts/{id:guid}/withdrawal", async (
    Guid id,
    CashManagement.Application.CreateCashWithdrawalDto req,
    CashManagement.Application.CashManagementService service,
    CancellationToken ct) =>
{
    var mov = await service.RecordWithdrawalAsync(id, req, ct);
    return Results.Ok(mov);
}).RequireAuthorization(PermissionCatalog.CashWithdraw);

cashGroup.MapPost("/shifts/{id:guid}/supply", async (
    Guid id,
    CashManagement.Application.CreateCashSupplyDto req,
    CashManagement.Application.CashManagementService service,
    CancellationToken ct) =>
{
    var mov = await service.RecordSupplyAsync(id, req, ct);
    return Results.Ok(mov);
}).RequireAuthorization(PermissionCatalog.CashSupply);

cashGroup.MapPost("/shifts/{id:guid}/sale-receipt", async (
    Guid id,
    CashManagement.Application.RecordCashSaleReceiptDto req,
    CashManagement.Application.CashManagementService service,
    CancellationToken ct) =>
{
    var mov = await service.RecordCashSaleReceiptAsync(id, req, ct);
    return Results.Ok(mov);
}).RequireAuthorization(PermissionCatalog.SalesPosUse);

cashGroup.MapPost("/shifts/{id:guid}/start-closing", async (
    Guid id,
    CashManagement.Application.CashManagementService service,
    CancellationToken ct) =>
{
    await service.StartShiftClosingAsync(id, ct);
    return Results.NoContent();
}).RequireAuthorization(PermissionCatalog.CashClose);

cashGroup.MapPost("/shifts/{id:guid}/submit-count", async (
    Guid id,
    CashManagement.Application.SubmitBlindCountDto req,
    ClaimsPrincipal user,
    CashManagement.Application.CashManagementService service,
    CancellationToken ct) =>
{
    var canViewExpected = user.HasClaim("permission", PermissionCatalog.CashReconcile) || user.HasClaim("permission", PermissionCatalog.CashShiftApprove);
    var shift = await service.SubmitBlindCountAsync(id, req, canViewExpected, ct);
    return Results.Ok(shift);
}).RequireAuthorization(PermissionCatalog.CashShiftCount);

cashGroup.MapPost("/shifts/{id:guid}/approve-closing", async (
    Guid id,
    CashManagement.Application.ApproveCashClosingDto req,
    CashManagement.Application.CashManagementService service,
    CancellationToken ct) =>
{
    var shift = await service.ApproveClosingAsync(id, req, ct);
    return Results.Ok(shift);
}).RequireAuthorization(PermissionCatalog.CashShiftApprove);

cashGroup.MapPost("/shifts/{id:guid}/close", async (
    Guid id,
    CashManagement.Application.CashManagementService service,
    CancellationToken ct) =>
{
    var shift = await service.CloseShiftAsync(id, ct);
    return Results.Ok(shift);
}).RequireAuthorization(PermissionCatalog.CashClose);

// Divergências de Caixa
cashGroup.MapGet("/discrepancies", async (
    Guid? branchId,
    CashManagement.Domain.CashDiscrepancyStatus? status,
    CashManagement.Application.CashManagementService service,
    CancellationToken ct) =>
{
    var list = await service.ListDiscrepanciesAsync(branchId, status, ct);
    return Results.Ok(list);
}).RequireAuthorization(PermissionCatalog.CashDiscrepancyView);

cashGroup.MapPost("/discrepancies/{id:guid}/justify", async (
    Guid id,
    CashManagement.Application.JustifyCashDiscrepancyDto req,
    CashManagement.Application.CashManagementService service,
    CancellationToken ct) =>
{
    var res = await service.JustifyDiscrepancyAsync(id, req, ct);
    return Results.Ok(res);
}).RequireAuthorization(PermissionCatalog.CashShiftCount);

cashGroup.MapPost("/discrepancies/{id:guid}/resolve", async (
    Guid id,
    CashManagement.Application.ResolveCashDiscrepancyDto req,
    CashManagement.Application.CashManagementService service,
    CancellationToken ct) =>
{
    var res = await service.ResolveDiscrepancyAsync(id, req, ct);
    return Results.Ok(res);
}).RequireAuthorization(PermissionCatalog.CashDiscrepancyResolve);

// ==================== FINANCIAL (MOD-12) ====================
var financialGroup = app.MapGroup("/api/financial").RequireAuthorization();

// Plano de Contas & Centros de Custo
financialGroup.MapGet("/accounts", async (
    Financial.Application.FinancialService service,
    CancellationToken ct) =>
{
    var list = await service.ListAccountsAsync(ct);
    return Results.Ok(list);
}).RequireAuthorization(PermissionCatalog.FinanceReportsView);

financialGroup.MapPost("/accounts", async (
    Financial.Application.CreateFinancialAccountDto req,
    Financial.Application.FinancialService service,
    CancellationToken ct) =>
{
    var created = await service.CreateAccountAsync(req, ct);
    return Results.Created($"/api/financial/accounts/{created.Id}", created);
}).RequireAuthorization(PermissionCatalog.FinanceJournalView);

financialGroup.MapGet("/cost-centers", async (
    Financial.Application.FinancialService service,
    CancellationToken ct) =>
{
    var list = await service.ListCostCentersAsync(ct);
    return Results.Ok(list);
}).RequireAuthorization(PermissionCatalog.FinanceReportsView);

financialGroup.MapPost("/cost-centers", async (
    Financial.Application.CreateCostCenterDto req,
    Financial.Application.FinancialService service,
    CancellationToken ct) =>
{
    var created = await service.CreateCostCenterAsync(req, ct);
    return Results.Created($"/api/financial/cost-centers/{created.Id}", created);
}).RequireAuthorization(PermissionCatalog.FinanceCostCentersManage);

// Contas Bancárias
financialGroup.MapGet("/bank-accounts", async (
    Guid? branchId,
    Financial.Application.FinancialService service,
    CancellationToken ct) =>
{
    var list = await service.ListBankAccountsAsync(branchId, ct);
    return Results.Ok(list);
}).RequireAuthorization(PermissionCatalog.FinanceReportsView);

financialGroup.MapPost("/bank-accounts", async (
    Financial.Application.CreateBankAccountDto req,
    Financial.Application.FinancialService service,
    CancellationToken ct) =>
{
    var created = await service.CreateBankAccountAsync(req, ct);
    return Results.Created($"/api/financial/bank-accounts/{created.Id}", created);
}).RequireAuthorization(PermissionCatalog.FinanceBanksManage);

// Contas a Pagar
financialGroup.MapGet("/payables", async (
    Guid? branchId,
    Financial.Domain.PayableStatus? status,
    Financial.Application.FinancialService service,
    CancellationToken ct) =>
{
    var list = await service.ListAccountsPayableAsync(branchId, status, ct);
    return Results.Ok(list);
}).RequireAuthorization(PermissionCatalog.FinancePayablesView);

financialGroup.MapPost("/payables", async (
    Financial.Application.CreateAccountPayableDto req,
    Financial.Application.FinancialService service,
    CancellationToken ct) =>
{
    var created = await service.CreateAccountPayableAsync(req, ct);
    return Results.Created($"/api/financial/payables/{created.Id}", created);
}).RequireAuthorization(PermissionCatalog.FinancePay);

financialGroup.MapPost("/payables/{id:guid}/pay", async (
    Guid id,
    Financial.Application.PayTitleDto req,
    Financial.Application.FinancialService service,
    CancellationToken ct) =>
{
    var res = await service.PayTitleAsync(id, req, ct);
    return Results.Ok(res);
}).RequireAuthorization(PermissionCatalog.FinancePay);

// Contas a Receber
financialGroup.MapGet("/receivables", async (
    Guid? branchId,
    Financial.Domain.ReceivableStatus? status,
    Financial.Application.FinancialService service,
    CancellationToken ct) =>
{
    var list = await service.ListAccountsReceivableAsync(branchId, status, ct);
    return Results.Ok(list);
}).RequireAuthorization(PermissionCatalog.FinanceReceivablesView);

financialGroup.MapPost("/receivables", async (
    Financial.Application.CreateAccountReceivableDto req,
    Financial.Application.FinancialService service,
    CancellationToken ct) =>
{
    var created = await service.CreateAccountReceivableAsync(req, ct);
    return Results.Created($"/api/financial/receivables/{created.Id}", created);
}).RequireAuthorization(PermissionCatalog.FinanceSettle);

financialGroup.MapPost("/receivables/{id:guid}/receive", async (
    Guid id,
    Financial.Application.ReceiveTitleDto req,
    Financial.Application.FinancialService service,
    CancellationToken ct) =>
{
    var res = await service.ReceiveTitleAsync(id, req, ct);
    return Results.Ok(res);
}).RequireAuthorization(PermissionCatalog.FinanceSettle);

// Razão Contábil / Journal Entry (Partidas Dobradas)
financialGroup.MapGet("/journal-entries", async (
    Guid? branchId,
    Financial.Application.FinancialService service,
    CancellationToken ct) =>
{
    var list = await service.ListJournalEntriesAsync(branchId, ct);
    return Results.Ok(list);
}).RequireAuthorization(PermissionCatalog.FinanceJournalView);

financialGroup.MapPost("/journal-entries", async (
    Financial.Application.CreateJournalEntryDto req,
    Financial.Application.FinancialService service,
    CancellationToken ct) =>
{
    var created = await service.CreateJournalEntryAsync(req, ct);
    return Results.Created($"/api/financial/journal-entries/{created.Id}", created);
}).RequireAuthorization(PermissionCatalog.FinanceJournalView);

// Extratos e Conciliação Bancária
financialGroup.MapGet("/bank-accounts/{bankAccountId:guid}/transactions", async (
    Guid bankAccountId,
    Financial.Domain.ReconciliationStatus? status,
    Financial.Application.FinancialService service,
    CancellationToken ct) =>
{
    var list = await service.ListTransactionsAsync(bankAccountId, status, ct);
    return Results.Ok(list);
}).RequireAuthorization(PermissionCatalog.FinanceReconcile);

financialGroup.MapPost("/bank-accounts/{bankAccountId:guid}/import-statement", async (
    Guid bankAccountId,
    Financial.Application.ImportBankStatementDto req,
    Financial.Application.FinancialService service,
    CancellationToken ct) =>
{
    var imported = await service.ImportStatementAsync(req, ct);
    return Results.Ok(imported);
}).RequireAuthorization(PermissionCatalog.FinanceReconcile);

financialGroup.MapPost("/transactions/{transactionId:guid}/reconcile", async (
    Guid transactionId,
    Financial.Application.ReconcileTransactionDto req,
    Financial.Application.FinancialService service,
    CancellationToken ct) =>
{
    var reconciled = await service.ReconcileTransactionAsync(transactionId, req, ct);
    return Results.Ok(reconciled);
}).RequireAuthorization(PermissionCatalog.FinanceReconcile);

// DRE Gerencial & Fluxo de Caixa Projetado
financialGroup.MapGet("/reports/dre", async (
    DateTime startDate,
    DateTime endDate,
    Guid? branchId,
    Financial.Application.FinancialService service,
    CancellationToken ct) =>
{
    var startUtc = DateTime.SpecifyKind(startDate, DateTimeKind.Utc);
    var endUtc = DateTime.SpecifyKind(endDate, DateTimeKind.Utc);
    var report = await service.GetDreReportAsync(startUtc, endUtc, branchId, ct);
    return Results.Ok(report);
}).RequireAuthorization(PermissionCatalog.FinanceReportsView);

financialGroup.MapGet("/reports/cash-flow-forecast", async (
    Guid? branchId,
    Financial.Application.FinancialService service,
    CancellationToken ct) =>
{
    var forecast = await service.GetCashFlowForecastAsync(branchId, ct);
    return Results.Ok(forecast);
}).RequireAuthorization(PermissionCatalog.FinanceReportsView);

// ==========================================
// MOD-13 — PartnersCapital (Gestão Societária, Cap Table, Aportes, Mútuos e Resultados)
// ==========================================
var partnersGroup = app.MapGroup("/api/partners");

partnersGroup.MapGet("/", async (
    PartnersCapital.Application.Services.PartnersCapitalService service,
    IExecutionContext executionContext,
    CancellationToken ct) =>
{
    var summaries = await service.ListPartnerSummariesAsync(executionContext.TenantId, ct);
    return Results.Ok(summaries);
}).RequireAuthorization(PartnersCapitalPermissionKeys.View);

partnersGroup.MapPost("/", async (
    PartnersCapital.Application.DTOs.CreatePartnerRequest request,
    PartnersCapital.Application.Services.PartnersCapitalService service,
    IExecutionContext executionContext,
    CancellationToken ct) =>
{
    var p = await service.CreatePartnerAsync(executionContext.TenantId, request, ct);
    var response = new PartnersCapital.Application.DTOs.PartnerResponse(
        p.Id, p.TenantId, p.PartyId, p.Name, p.DocumentNumber, p.Email, p.Type, p.Status,
        p.AdmissionDate, p.ExitDate, p.MonthlyCompensationCap, p.Notes
    );
    return Results.Created($"/api/partners/{p.Id}", response);
}).RequireAuthorization(PartnersCapitalPermissionKeys.Manage);

partnersGroup.MapGet("/cap-table", async (
    PartnersCapital.Application.Services.PartnersCapitalService service,
    IExecutionContext executionContext,
    CancellationToken ct) =>
{
    var capTable = await service.GetCurrentCapTableSummaryAsync(executionContext.TenantId, ct);
    return Results.Ok(capTable);
}).RequireAuthorization(PartnersCapitalPermissionKeys.View);

partnersGroup.MapPost("/cap-table", async (
    PartnersCapital.Application.DTOs.UpdateCapTableRequest request,
    PartnersCapital.Application.Services.PartnersCapitalService service,
    IExecutionContext executionContext,
    CancellationToken ct) =>
{
    var result = await service.UpdateCapTableAsync(executionContext.TenantId, request, ct);
    return Results.Ok(result);
}).RequireAuthorization(PartnersCapitalPermissionKeys.CapitalManage);

partnersGroup.MapPost("/contributions", async (
    PartnersCapital.Application.DTOs.RegisterContributionRequest request,
    PartnersCapital.Application.Services.PartnersCapitalService service,
    IExecutionContext executionContext,
    CancellationToken ct) =>
{
    var c = await service.RegisterContributionAsync(executionContext.TenantId, request, ct);
    var response = new PartnersCapital.Application.DTOs.CapitalContributionResponse(
        c.Id, c.TenantId, c.PartnerId, c.Type, c.Status, c.Amount, c.SubscriptionDate,
        c.PaidInDate, c.BankAccountId, c.FinancialJournalEntryId, c.Description, c.FormalInstrumentReference
    );
    return Results.Created($"/api/partners/contributions/{c.Id}", response);
}).RequireAuthorization(PartnersCapitalPermissionKeys.CapitalManage);

partnersGroup.MapPost("/contributions/{id:guid}/pay-in", async (
    Guid id,
    PartnersCapital.Application.DTOs.PayInContributionRequest request,
    PartnersCapital.Application.Services.PartnersCapitalService service,
    IExecutionContext executionContext,
    CancellationToken ct) =>
{
    var c = await service.PayInContributionAsync(executionContext.TenantId, id, request, ct);
    var response = new PartnersCapital.Application.DTOs.CapitalContributionResponse(
        c.Id, c.TenantId, c.PartnerId, c.Type, c.Status, c.Amount, c.SubscriptionDate,
        c.PaidInDate, c.BankAccountId, c.FinancialJournalEntryId, c.Description, c.FormalInstrumentReference
    );
    return Results.Ok(response);
}).RequireAuthorization(PartnersCapitalPermissionKeys.CapitalManage);

partnersGroup.MapPost("/loans", async (
    PartnersCapital.Application.DTOs.RegisterLoanRequest request,
    PartnersCapital.Application.Services.PartnersCapitalService service,
    IExecutionContext executionContext,
    CancellationToken ct) =>
{
    var l = await service.RegisterLoanAsync(executionContext.TenantId, request, ct);
    var response = new PartnersCapital.Application.DTOs.PartnerLoanResponse(
        l.Id, l.TenantId, l.PartnerId, l.Direction, l.Status, l.PrincipalAmount, l.AmortizedAmount,
        l.OutstandingBalance, l.AnnualInterestRate, l.IssueDate, l.DueDate, l.ContractNumber, l.Notes,
        l.BankAccountId, l.DisbursementJournalEntryId
    );
    return Results.Created($"/api/partners/loans/{l.Id}", response);
}).RequireAuthorization(PartnersCapitalPermissionKeys.LoanManage);

partnersGroup.MapPost("/loans/{id:guid}/amortize", async (
    Guid id,
    PartnersCapital.Application.DTOs.AmortizeLoanRequest request,
    PartnersCapital.Application.Services.PartnersCapitalService service,
    IExecutionContext executionContext,
    CancellationToken ct) =>
{
    var l = await service.AmortizeLoanAsync(executionContext.TenantId, id, request, ct);
    var response = new PartnersCapital.Application.DTOs.PartnerLoanResponse(
        l.Id, l.TenantId, l.PartnerId, l.Direction, l.Status, l.PrincipalAmount, l.AmortizedAmount,
        l.OutstandingBalance, l.AnnualInterestRate, l.IssueDate, l.DueDate, l.ContractNumber, l.Notes,
        l.BankAccountId, l.DisbursementJournalEntryId
    );
    return Results.Ok(response);
}).RequireAuthorization(PartnersCapitalPermissionKeys.LoanManage);

partnersGroup.MapPost("/compensations", async (
    PartnersCapital.Application.DTOs.ScheduleCompensationRequest request,
    PartnersCapital.Application.Services.PartnersCapitalService service,
    IExecutionContext executionContext,
    CancellationToken ct) =>
{
    var c = await service.ScheduleCompensationAsync(executionContext.TenantId, request, ct);
    var response = new PartnersCapital.Application.DTOs.PartnerCompensationResponse(
        c.Id, c.TenantId, c.PartnerId, c.ReferenceYear, c.ReferenceMonth, c.GrossAmount,
        c.InssWithholding, c.IrrfWithholding, c.NetAmount, c.Status, c.ScheduledPaymentDate,
        c.PaidDate, c.AccountPayableId, c.BankAccountId, c.Notes
    );
    return Results.Created($"/api/partners/compensations/{c.Id}", response);
}).RequireAuthorization(PartnersCapitalPermissionKeys.CompensationManage);

partnersGroup.MapPost("/distribution/proposals", async (
    PartnersCapital.Application.DTOs.CreateDistributionProposalRequest request,
    PartnersCapital.Application.Services.PartnersCapitalService service,
    IExecutionContext executionContext,
    CancellationToken ct) =>
{
    var p = await service.CreateDistributionProposalAsync(executionContext.TenantId, request, ct);
    var items = p.Items.Select(i => new PartnersCapital.Application.DTOs.ProfitDistributionItemResponse(
        i.Id, i.ProposalId, i.TenantId, i.PartnerId, i.PartnerPercentage, i.GrossAmount,
        i.TaxWithheld, i.NetAmount, i.IsPaid, i.PaidDate, i.BankAccountId, i.JournalEntryId
    )).ToList();
    var response = new PartnersCapital.Application.DTOs.ProfitDistributionProposalResponse(
        p.Id, p.TenantId, p.ProtocolNumber, p.FiscalYear, p.FiscalQuarter, p.BaseNetProfit,
        p.LegalReserveRetention, p.WorkingCapitalRetention, p.DistributableAmount,
        p.TotalDistributedAmount, p.Status, p.DeliberationDate, p.MeetingMinutesReference, p.Notes, items
    );
    return Results.Created($"/api/partners/distribution/proposals/{p.Id}", response);
}).RequireAuthorization(PartnersCapitalPermissionKeys.DistributionPropose);

partnersGroup.MapPost("/distribution/proposals/{id:guid}/approve", async (
    Guid id,
    string meetingMinutes,
    PartnersCapital.Application.Services.PartnersCapitalService service,
    IExecutionContext executionContext,
    CancellationToken ct) =>
{
    var p = await service.ApproveProposalAsync(executionContext.TenantId, id, meetingMinutes, ct);
    var items = p.Items.Select(i => new PartnersCapital.Application.DTOs.ProfitDistributionItemResponse(
        i.Id, i.ProposalId, i.TenantId, i.PartnerId, i.PartnerPercentage, i.GrossAmount,
        i.TaxWithheld, i.NetAmount, i.IsPaid, i.PaidDate, i.BankAccountId, i.JournalEntryId
    )).ToList();
    var response = new PartnersCapital.Application.DTOs.ProfitDistributionProposalResponse(
        p.Id, p.TenantId, p.ProtocolNumber, p.FiscalYear, p.FiscalQuarter, p.BaseNetProfit,
        p.LegalReserveRetention, p.WorkingCapitalRetention, p.DistributableAmount,
        p.TotalDistributedAmount, p.Status, p.DeliberationDate, p.MeetingMinutesReference, p.Notes, items
    );
    return Results.Ok(response);
}).RequireAuthorization(PartnersCapitalPermissionKeys.DistributionApprove);

partnersGroup.MapPost("/distribution/proposals/{id:guid}/settle/{partnerId:guid}", async (
    Guid id,
    Guid partnerId,
    PartnersCapital.Application.DTOs.SettleDistributionItemRequest request,
    PartnersCapital.Application.Services.PartnersCapitalService service,
    IExecutionContext executionContext,
    CancellationToken ct) =>
{
    var p = await service.SettleProposalItemAsync(executionContext.TenantId, id, partnerId, request, ct);
    var items = p.Items.Select(i => new PartnersCapital.Application.DTOs.ProfitDistributionItemResponse(
        i.Id, i.ProposalId, i.TenantId, i.PartnerId, i.PartnerPercentage, i.GrossAmount,
        i.TaxWithheld, i.NetAmount, i.IsPaid, i.PaidDate, i.BankAccountId, i.JournalEntryId
    )).ToList();
    var response = new PartnersCapital.Application.DTOs.ProfitDistributionProposalResponse(
        p.Id, p.TenantId, p.ProtocolNumber, p.FiscalYear, p.FiscalQuarter, p.BaseNetProfit,
        p.LegalReserveRetention, p.WorkingCapitalRetention, p.DistributableAmount,
        p.TotalDistributedAmount, p.Status, p.DeliberationDate, p.MeetingMinutesReference, p.Notes, items
    );
    return Results.Ok(response);
}).RequireAuthorization(PartnersCapitalPermissionKeys.DistributionSettle);

partnersGroup.MapGet("/simulation/liquidity", async (
    decimal proposedAmount,
    decimal? reserve,
    PartnersCapital.Application.Services.PartnersCapitalService service,
    IExecutionContext executionContext,
    CancellationToken ct) =>
{
    var simulation = await service.SimulateLiquidityAsync(executionContext.TenantId, proposedAmount, reserve ?? 20000m, ct);
    return Results.Ok(simulation);
}).RequireAuthorization(PartnersCapitalPermissionKeys.View);

// Modulo RepairService (MOD-07) - Endpoints REST
var repairsGroup = app.MapGroup("/api/repairs").RequireAuthorization();

repairsGroup.MapPost("/orders", async (
    RepairService.Application.DTOs.CreateRepairOrderRequest request,
    RepairService.Application.Services.RepairServiceAppService service,
    CancellationToken ct) =>
{
    var created = await service.CreateRepairOrderAsync(request, ct);
    return Results.Created($"/api/repairs/orders/{created.Id}", created);
}).RequireAuthorization(PermissionCatalog.RepairsCreate);

repairsGroup.MapGet("/orders", async (
    Guid? branchId,
    RepairService.Domain.Enums.RepairOrderStatus? status,
    Guid? customerId,
    RepairService.Application.Services.RepairServiceAppService service,
    CancellationToken ct) =>
{
    var list = await service.ListAsync(branchId, status, customerId, ct);
    return Results.Ok(list);
}).RequireAuthorization(PermissionCatalog.RepairsView);

repairsGroup.MapGet("/orders/{id:guid}", async (
    Guid id,
    RepairService.Application.Services.RepairServiceAppService service,
    CancellationToken ct) =>
{
    var order = await service.GetByIdAsync(id, ct);
    return order != null ? Results.Ok(order) : Results.NotFound();
}).RequireAuthorization(PermissionCatalog.RepairsView);

repairsGroup.MapPost("/orders/{id:guid}/checklist", async (
    Guid id,
    RepairService.Application.DTOs.AddChecklistItemRequest request,
    RepairService.Application.Services.RepairServiceAppService service,
    CancellationToken ct) =>
{
    var updated = await service.AddChecklistItemAsync(id, request, ct);
    return Results.Ok(updated);
}).RequireAuthorization(PermissionCatalog.RepairsCreate);

repairsGroup.MapPost("/orders/{id:guid}/assign-technician", async (
    Guid id,
    Guid technicianId,
    string? notes,
    RepairService.Application.Services.RepairServiceAppService service,
    CancellationToken ct) =>
{
    var updated = await service.AssignTechnicianAsync(id, technicianId, notes, ct);
    return Results.Ok(updated);
}).RequireAuthorization(PermissionCatalog.RepairsAssign);

repairsGroup.MapPost("/orders/{id:guid}/start-diagnosis", async (
    Guid id,
    Guid technicianId,
    RepairService.Application.Services.RepairServiceAppService service,
    CancellationToken ct) =>
{
    var updated = await service.StartDiagnosisAsync(id, technicianId, ct);
    return Results.Ok(updated);
}).RequireAuthorization(PermissionCatalog.RepairsDiagnose);

repairsGroup.MapPost("/orders/{id:guid}/complete-diagnosis", async (
    Guid id,
    RepairService.Application.DTOs.CompleteDiagnosisRequest request,
    RepairService.Application.Services.RepairServiceAppService service,
    CancellationToken ct) =>
{
    var updated = await service.CompleteDiagnosisAsync(id, request, ct);
    return Results.Ok(updated);
}).RequireAuthorization(PermissionCatalog.RepairsDiagnose);

repairsGroup.MapPost("/orders/{id:guid}/estimate/items", async (
    Guid id,
    RepairService.Application.DTOs.AddEstimateItemRequest request,
    RepairService.Application.Services.RepairServiceAppService service,
    CancellationToken ct) =>
{
    var updated = await service.AddEstimateItemAsync(id, request, ct);
    return Results.Ok(updated);
}).RequireAuthorization(PermissionCatalog.RepairsQuote);

repairsGroup.MapPost("/orders/{id:guid}/estimate/approve", async (
    Guid id,
    RepairService.Application.DTOs.ApproveEstimateRequest request,
    RepairService.Application.Services.RepairServiceAppService service,
    CancellationToken ct) =>
{
    var updated = await service.ApproveEstimateAsync(id, request, ct);
    return Results.Ok(updated);
}).RequireAuthorization(PermissionCatalog.RepairsApprove);

repairsGroup.MapPost("/orders/{id:guid}/estimate/reject", async (
    Guid id,
    RepairService.Application.DTOs.RejectEstimateRequest request,
    RepairService.Application.Services.RepairServiceAppService service,
    CancellationToken ct) =>
{
    var updated = await service.RejectEstimateAsync(id, request, ct);
    return Results.Ok(updated);
}).RequireAuthorization(PermissionCatalog.RepairsQuote);

repairsGroup.MapPost("/orders/{id:guid}/start-repair", async (
    Guid id,
    RepairService.Application.Services.RepairServiceAppService service,
    CancellationToken ct) =>
{
    var updated = await service.StartRepairAsync(id, ct);
    return Results.Ok(updated);
}).RequireAuthorization(PermissionCatalog.RepairsExecute);

repairsGroup.MapPost("/orders/{id:guid}/parts/consume", async (
    Guid id,
    RepairService.Application.DTOs.ConsumePartRequest request,
    RepairService.Application.Services.RepairServiceAppService service,
    CancellationToken ct) =>
{
    var updated = await service.ConsumePartAsync(id, request, ct);
    return Results.Ok(updated);
}).RequireAuthorization(PermissionCatalog.RepairsPartsConsume);

repairsGroup.MapPost("/orders/{id:guid}/complete-repair", async (
    Guid id,
    RepairService.Application.DTOs.CompleteRepairRequest request,
    RepairService.Application.Services.RepairServiceAppService service,
    CancellationToken ct) =>
{
    var updated = await service.CompleteRepairAsync(id, request, ct);
    return Results.Ok(updated);
}).RequireAuthorization(PermissionCatalog.RepairsExecute);

repairsGroup.MapPost("/orders/{id:guid}/quality-check", async (
    Guid id,
    RepairService.Application.DTOs.PassQualityCheckRequest request,
    RepairService.Application.Services.RepairServiceAppService service,
    CancellationToken ct) =>
{
    var updated = await service.PassQualityCheckAsync(id, request, ct);
    return Results.Ok(updated);
}).RequireAuthorization(PermissionCatalog.RepairsQualityCheck);

repairsGroup.MapPost("/orders/{id:guid}/deliver", async (
    Guid id,
    RepairService.Application.DTOs.DeliverRepairOrderRequest request,
    RepairService.Application.Services.RepairServiceAppService service,
    CancellationToken ct) =>
{
    var updated = await service.DeliverToCustomerAsync(id, request, ct);
    return Results.Ok(updated);
}).RequireAuthorization(PermissionCatalog.RepairsDeliver);

repairsGroup.MapPost("/orders/{id:guid}/warranty/claims", async (
    Guid id,
    RepairService.Application.DTOs.CreateWarrantyClaimRequest request,
    RepairService.Application.Services.RepairServiceAppService service,
    CancellationToken ct) =>
{
    var updated = await service.CreateWarrantyClaimAsync(id, request, ct);
    return Results.Ok(updated);
}).RequireAuthorization(PermissionCatalog.RepairsWarranty);

repairsGroup.MapPost("/orders/{id:guid}/warranty/claims/{claimId:guid}/decide", async (
    Guid id,
    Guid claimId,
    RepairService.Application.DTOs.DecideWarrantyClaimRequest request,
    RepairService.Application.Services.RepairServiceAppService service,
    CancellationToken ct) =>
{
    var updated = await service.DecideWarrantyClaimAsync(id, claimId, request, ct);
    return Results.Ok(updated);
}).RequireAuthorization(PermissionCatalog.RepairsWarranty);

// ========================================================
// ENDPOINTS DO MÓDULO CRM (MOD-08)
// ========================================================
var crmGroup = app.MapGroup("/api/crm").RequireAuthorization();

// Dashboard Metrics
crmGroup.MapGet("/metrics", async (CRM.Application.Services.CrmAppService service, CancellationToken ct) =>
{
    var metrics = await service.GetDashboardMetricsAsync(ct);
    return Results.Ok(metrics);
}).RequireAuthorization(PermissionCatalog.CrmView);

// Leads
crmGroup.MapGet("/leads", async (CRM.Application.Services.CrmAppService service, CancellationToken ct) =>
{
    var leads = await service.ListLeadsAsync(ct);
    return Results.Ok(leads);
}).RequireAuthorization(PermissionCatalog.CrmView);

crmGroup.MapPost("/leads", async (CRM.Application.DTOs.CreateLeadRequest req, CRM.Application.Services.CrmAppService service, CancellationToken ct) =>
{
    var created = await service.CreateLeadAsync(req, ct);
    return Results.Created($"/api/crm/leads/{created.Id}", created);
}).RequireAuthorization(PermissionCatalog.CrmManage);

crmGroup.MapPut("/leads/{id:guid}/status", async (Guid id, CRM.Application.DTOs.UpdateLeadStatusRequest req, CRM.Application.Services.CrmAppService service, CancellationToken ct) =>
{
    var updated = await service.UpdateLeadStatusAsync(id, req, ct);
    return Results.Ok(updated);
}).RequireAuthorization(PermissionCatalog.CrmManage);

crmGroup.MapPost("/leads/{id:guid}/convert", async (Guid id, CRM.Application.DTOs.ConvertLeadRequest req, CRM.Application.Services.CrmAppService service, CancellationToken ct) =>
{
    var converted = await service.ConvertLeadToPartyAsync(id, req, ct);
    return Results.Ok(converted);
}).RequireAuthorization(PermissionCatalog.CrmManage);

// Pipelines
crmGroup.MapGet("/pipelines", async (CRM.Application.Services.CrmAppService service, CancellationToken ct) =>
{
    var pipelines = await service.ListPipelinesAsync(ct);
    return Results.Ok(pipelines);
}).RequireAuthorization(PermissionCatalog.CrmView);

crmGroup.MapPost("/pipelines", async (CRM.Application.DTOs.CreatePipelineRequest req, CRM.Application.Services.CrmAppService service, CancellationToken ct) =>
{
    var created = await service.CreatePipelineAsync(req, ct);
    return Results.Created($"/api/crm/pipelines/{created.Id}", created);
}).RequireAuthorization(PermissionCatalog.CrmManage);

// Oportunidades
crmGroup.MapGet("/opportunities", async (Guid? pipelineId, CRM.Application.Services.CrmAppService service, CancellationToken ct) =>
{
    var opps = await service.ListOpportunitiesAsync(pipelineId, ct);
    return Results.Ok(opps);
}).RequireAuthorization(PermissionCatalog.CrmView);

crmGroup.MapPost("/opportunities", async (CRM.Application.DTOs.CreateOpportunityRequest req, CRM.Application.Services.CrmAppService service, CancellationToken ct) =>
{
    var created = await service.CreateOpportunityAsync(req, ct);
    return Results.Created($"/api/crm/opportunities/{created.Id}", created);
}).RequireAuthorization(PermissionCatalog.CrmManage);

crmGroup.MapPut("/opportunities/{id:guid}/stage", async (Guid id, CRM.Application.DTOs.MoveOpportunityStageRequest req, CRM.Application.Services.CrmAppService service, CancellationToken ct) =>
{
    var updated = await service.MoveOpportunityStageAsync(id, req, ct);
    return Results.Ok(updated);
}).RequireAuthorization(PermissionCatalog.CrmManage);

crmGroup.MapPost("/opportunities/{id:guid}/activities", async (Guid id, CRM.Application.DTOs.AddOpportunityActivityRequest req, CRM.Application.Services.CrmAppService service, CancellationToken ct) =>
{
    var updated = await service.AddOpportunityActivityAsync(id, req, ct);
    return Results.Ok(updated);
}).RequireAuthorization(PermissionCatalog.CrmManage);

// Intenções de Compra (Purchase Intents)
crmGroup.MapGet("/intents", async (CRM.Application.Services.CrmAppService service, CancellationToken ct) =>
{
    var intents = await service.ListActivePurchaseIntentsAsync(ct);
    return Results.Ok(intents);
}).RequireAuthorization(PermissionCatalog.CrmView);

crmGroup.MapPost("/intents", async (CRM.Application.DTOs.CreatePurchaseIntentRequest req, CRM.Application.Services.CrmAppService service, CancellationToken ct) =>
{
    var created = await service.CreatePurchaseIntentAsync(req, ct);
    return Results.Created($"/api/crm/intents/{created.Id}", created);
}).RequireAuthorization(PermissionCatalog.CrmInterestManage);

crmGroup.MapPost("/intents/{id:guid}/cancel", async (Guid id, string reason, CRM.Application.Services.CrmAppService service, CancellationToken ct) =>
{
    var cancelled = await service.CancelPurchaseIntentAsync(id, reason, ct);
    return Results.Ok(cancelled);
}).RequireAuthorization(PermissionCatalog.CrmInterestManage);

// Motor de Matching
crmGroup.MapPost("/matching/run", async (CRM.Application.Services.CrmAppService service, CancellationToken ct) =>
{
    var result = await service.RunInventoryMatchingAsync(ct);
    return Results.Ok(result);
}).RequireAuthorization(PermissionCatalog.CrmManage);

crmGroup.MapPost("/matching/reserve", async (CRM.Application.DTOs.ReserveMatchedUnitRequest req, CRM.Application.Services.CrmAppService service, CancellationToken ct) =>
{
    var reserved = await service.ReserveMatchedUnitAsync(req, ct);
    return Results.Ok(reserved);
}).RequireAuthorization(PermissionCatalog.CrmManage);

// Endpoint de Teste Protegido com PermissionKey
app.MapGet("/api/secure-inventory", () => Results.Ok(new { message = "Acesso autorizado ao estoque." }))
   .RequireAuthorization(PermissionCatalog.InventoryView);

// Endpoint de Custo Protegido (Sensível)
app.MapGet("/api/secure-inventory-cost", () => Results.Ok(new { sensitiveCost = 1500.50m }))
   .RequireAuthorization(PermissionCatalog.InventoryCostView);

app.Run();

// Tornar a classe Program acessível para testes WebApplicationFactory
public partial class Program { }
