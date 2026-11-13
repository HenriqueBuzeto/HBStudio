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

// Endpoint de Teste Protegido com PermissionKey
app.MapGet("/api/secure-inventory", () => Results.Ok(new { message = "Acesso autorizado ao estoque." }))
   .RequireAuthorization(PermissionCatalog.InventoryView);

// Endpoint de Custo Protegido (Sensível)
app.MapGet("/api/secure-inventory-cost", () => Results.Ok(new { sensitiveCost = 1500.50m }))
   .RequireAuthorization(PermissionCatalog.InventoryCostView);

app.Run();

// Tornar a classe Program acessível para testes WebApplicationFactory
public partial class Program { }
