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

// Endpoint de Teste Protegido com PermissionKey
app.MapGet("/api/secure-inventory", () => Results.Ok(new { message = "Acesso autorizado ao estoque." }))
   .RequireAuthorization(PermissionCatalog.InventoryView);

// Endpoint de Custo Protegido (Sensível)
app.MapGet("/api/secure-inventory-cost", () => Results.Ok(new { sensitiveCost = 1500.50m }))
   .RequireAuthorization(PermissionCatalog.InventoryCostView);

app.Run();

// Tornar a classe Program acessível para testes WebApplicationFactory
public partial class Program { }
