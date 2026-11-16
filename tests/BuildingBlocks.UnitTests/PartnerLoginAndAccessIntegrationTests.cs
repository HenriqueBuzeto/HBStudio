using System.Net;
using System.Net.Http.Json;
using BuildingBlocks.Domain;
using BuildingBlocks.Infrastructure;
using BuildingBlocks.Security;
using IdentityAccess.Application.DTOs;
using IdentityAccess.Domain;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PartnersCapital.Domain.Entities;
using Xunit;

namespace BuildingBlocks.UnitTests;

public class PartnerLoginAndAccessIntegrationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private const string PostgresTestConn = "Host=127.0.0.1;Port=5433;Database=hbstudio_erp_test;Username=postgres;Password=;";

    public PartnerLoginAndAccessIntegrationTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                var descriptor = services.SingleOrDefault(d => d.ServiceType == typeof(DbContextOptions<AppDbContext>));
                if (descriptor != null) services.Remove(descriptor);

                services.AddDbContext<AppDbContext>(options =>
                {
                    options.UseNpgsql(PostgresTestConn);
                });
            });
        });
    }

    [Fact]
    public async Task PartnerLogin_ValidCredentialsAndActivePartner_SucceedsWithJwtAndProfile()
    {
        // Arrange
        var client = _factory.CreateClient();
        var hasher = new Pbkdf2PasswordHasher();
        var unique = Guid.NewGuid().ToString("N")[..8];

        var tenantId = Guid.NewGuid();
        var branchId = Guid.NewGuid();
        var email = $"socio_{unique}@hbstudio.com.br";
        var rawPassword = "SenhaForteSegura@2026";
        var passwordHash = hasher.HashPassword(rawPassword);

        // Provisionamento EFÊMERO isolado para o teste
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            var tenant = new Tenant($"Tenant Test {unique}", $"TT_{unique}");
            var branch = tenant.AddBranch($"Matriz {unique}", "HQ", true);
            db.Tenants.Add(tenant);
            db.Branches.Add(branch);

            var user = new User(tenant.Id, $"Sócio Executivo {unique}", email, passwordHash, branch.Id);
            db.Users.Add(user);

            var role = new Role(tenant.Id, "Diretor Executivo", "Acesso Administrativo");
            role.AddPermission(PermissionCatalog.PartnersView);
            role.AddPermission(PermissionCatalog.FinanceJournalView);
            db.Roles.Add(role);

            user.AssignRole(role);

            // Vínculo societário ativo em PartnersCapital
            var partner = new Partner(
                tenant.Id,
                Guid.NewGuid(),
                user.FullName,
                "123.456.789-00",
                email,
                PartnerType.ManagingPartner,
                DateTime.UtcNow);
            db.Partners.Add(partner);

            await db.SaveChangesAsync();
        }

        // Act: Tentativa de login com credenciais válidas
        var loginResponse = await client.PostAsJsonAsync("/api/auth/login", new LoginRequest(email, rawPassword));

        // Assert
        Assert.Equal(HttpStatusCode.OK, loginResponse.StatusCode);
        var authResult = await loginResponse.Content.ReadFromJsonAsync<LoginResponse>();
        Assert.NotNull(authResult);
        Assert.NotEmpty(authResult.AccessToken);
        Assert.True(authResult.User.IsPartner);
        Assert.Equal("ManagingPartner", authResult.User.PartnerRole);
        Assert.Contains(PermissionCatalog.PartnersView, authResult.User.Permissions);

        // Act 2: Consulta /api/auth/me usando o token gerado
        client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", authResult.AccessToken);
        var meResponse = await client.GetAsync("/api/auth/me");

        // Assert 2
        Assert.Equal(HttpStatusCode.OK, meResponse.StatusCode);
        var profile = await meResponse.Content.ReadFromJsonAsync<UserProfileDto>();
        Assert.NotNull(profile);
        Assert.Equal(email, profile.Email);
        Assert.True(profile.IsPartner);
    }

    [Fact]
    public async Task PartnerLogin_InvalidPassword_Or_UnregisteredEmail_FailsWith401GenericMessage()
    {
        // Arrange
        var client = _factory.CreateClient();

        // 1. E-mail inexistente
        var unregResponse = await client.PostAsJsonAsync("/api/auth/login", new LoginRequest("naoexiste@hbstudio.com.br", "QualquerSenha123!"));
        Assert.Equal(HttpStatusCode.Unauthorized, unregResponse.StatusCode);
        var unregContent = await unregResponse.Content.ReadAsStringAsync();
        Assert.Contains("Não foi possível entrar", unregContent);

        // 2. Senha incorreta de usuário existente
        var hasher = new Pbkdf2PasswordHasher();
        var unique = Guid.NewGuid().ToString("N")[..8];
        var email = $"user_{unique}@hbstudio.com.br";

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var tenant = new Tenant($"Tenant {unique}", $"T_{unique}");
            db.Tenants.Add(tenant);
            var user = new User(tenant.Id, $"Usuario {unique}", email, hasher.HashPassword("SenhaCorreta@2026"));
            db.Users.Add(user);
            await db.SaveChangesAsync();
        }

        var wrongPwdResponse = await client.PostAsJsonAsync("/api/auth/login", new LoginRequest(email, "SenhaErrada@999"));
        Assert.Equal(HttpStatusCode.Unauthorized, wrongPwdResponse.StatusCode);
        var wrongPwdContent = await wrongPwdResponse.Content.ReadAsStringAsync();
        Assert.Contains("Não foi possível entrar", wrongPwdContent);
    }

    [Fact]
    public async Task PartnerLogin_ValidUser_But_NotActivePartner_IsRejectedWith401()
    {
        // Arrange
        var client = _factory.CreateClient();
        var hasher = new Pbkdf2PasswordHasher();
        var unique = Guid.NewGuid().ToString("N")[..8];
        var email = $"funcionario_{unique}@hbstudio.com.br";
        var password = "SenhaValida@2026";

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var tenant = new Tenant($"Tenant {unique}", $"T_{unique}");
            db.Tenants.Add(tenant);

            // Usuário tem login ativo, mas NÃO É SÓCIO (não tem registro em Partners ou é sócio desativado)
            var user = new User(tenant.Id, $"Funcionario {unique}", email, hasher.HashPassword(password));
            db.Users.Add(user);
            await db.SaveChangesAsync();
        }

        // Act: Tenta logar
        var response = await client.PostAsJsonAsync("/api/auth/login", new LoginRequest(email, password));

        // Assert: Rejeitado por ausência de vínculo societário ativo
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        var content = await response.Content.ReadAsStringAsync();
        Assert.Contains("Não foi possível entrar", content);
    }
}
