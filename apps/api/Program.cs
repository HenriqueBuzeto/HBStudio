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

// Endpoint de Teste Protegido com PermissionKey
app.MapGet("/api/secure-inventory", () => Results.Ok(new { message = "Acesso autorizado ao estoque." }))
   .RequireAuthorization(PermissionCatalog.InventoryView);

// Endpoint de Custo Protegido (Sensível)
app.MapGet("/api/secure-inventory-cost", () => Results.Ok(new { sensitiveCost = 1500.50m }))
   .RequireAuthorization(PermissionCatalog.InventoryCostView);

app.Run();

// Tornar a classe Program acessível para testes WebApplicationFactory
public partial class Program { }
