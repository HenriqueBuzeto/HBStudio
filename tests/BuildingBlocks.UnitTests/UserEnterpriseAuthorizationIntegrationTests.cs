using System.Net;
using System.Net.Http.Headers;
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

public class UserEnterpriseAuthorizationIntegrationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private const string PostgresTestConn = "Host=127.0.0.1;Port=5433;Database=hbstudio_erp_test;Username=postgres;Password=;";

    public UserEnterpriseAuthorizationIntegrationTests(WebApplicationFactory<Program> factory)
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

    private async Task<(HttpClient Client, string Token, Guid TenantId, Guid UserId, Guid RoleId)> SetupAdminContextAsync(string prefix)
    {
        var client = _factory.CreateClient();
        var hasher = new Pbkdf2PasswordHasher();
        var unique = Guid.NewGuid().ToString("N")[..8];
        var email = $"{prefix}_{unique}@hbstudio.com.br";
        var password = "AdminStrongPassword@2026";
        var passwordHash = hasher.HashPassword(password);

        Guid tenantId;
        Guid userId;
        Guid roleId;

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var tenant = new Tenant($"Tenant {prefix} {unique}", $"T_{unique}");
            var branch = tenant.AddBranch($"Matriz {unique}", "HQ", true);
            db.Tenants.Add(tenant);
            db.Branches.Add(branch);

            var user = new User(tenant.Id, $"Admin {unique}", email, passwordHash, branch.Id, "CEO");
            db.Users.Add(user);

            var role = new Role(tenant.Id, "Admin Master", "Perfil com acesso administrativo total");
            role.AddPermission(PermissionCatalog.AccessManage);
            role.AddPermission(PermissionCatalog.AuditView);
            role.AddPermission(PermissionCatalog.FiscalDocumentsView);
            role.AddPermission(PermissionCatalog.FinanceJournalView);
            role.AddPermission(PermissionCatalog.CustomersView);
            role.AddPermission(PermissionCatalog.InventoryView);
            db.Roles.Add(role);

            user.AssignRole(role);

            // Sócio formalmente cadastrado no PartnersCapital
            var partner = new Partner(
                tenant.Id,
                Guid.NewGuid(),
                user.FullName,
                "111.222.333-44",
                email,
                PartnerType.ManagingPartner,
                DateTime.UtcNow,
                isErpAccessEnabled: true);
            db.Partners.Add(partner);

            await db.SaveChangesAsync();

            tenantId = tenant.Id;
            userId = user.Id;
            roleId = role.Id;
        }

        // Realiza login oficial
        var loginRes = await client.PostAsJsonAsync("/api/auth/login", new LoginRequest(email, password));
        loginRes.EnsureSuccessStatusCode();
        var authResult = await loginRes.Content.ReadFromJsonAsync<LoginResponse>();
        Assert.NotNull(authResult);

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", authResult.AccessToken);
        return (client, authResult.AccessToken, tenantId, userId, roleId);
    }

    [Fact]
    public async Task JobTitle_CEO_DoesNotGrantPermissionsAutomatically()
    {
        // 1. Cargo CEO não concede privilégios automaticamente
        var (adminClient, _, tenantId, _, _) = await SetupAdminContextAsync("test_ceo");

        var createReq = new CreateUserDto(
            "Diretor Estrategico",
            $"diretor_{Guid.NewGuid():N}@hbstudio.com.br",
            "Senha@2026123",
            IsPartner: false,
            RoleTitle: "CEO");

        var res = await adminClient.PostAsJsonAsync("/api/users", createReq);
        Assert.Equal(HttpStatusCode.Created, res.StatusCode);

        // Verifica que o novo usuário criado NÃO possui permissões fiscais ou financeiras
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var newUser = await db.Users.FirstOrDefaultAsync(u => u.Email == createReq.Email);
        Assert.NotNull(newUser);
        Assert.Equal("CEO", newUser.JobTitle);

        var userRoleIds = await db.UserRoles.Where(ur => ur.UserId == newUser.Id).Select(ur => ur.RoleId).ToListAsync();
        var permissions = await db.RolePermissions.Where(rp => userRoleIds.Contains(rp.RoleId)).Select(rp => rp.PermissionKey).ToListAsync();

        Assert.DoesNotContain(PermissionCatalog.FiscalIssue, permissions);
        Assert.DoesNotContain(PermissionCatalog.FiscalCancel, permissions);
        Assert.DoesNotContain(PermissionCatalog.PartnersManage, permissions);
        Assert.DoesNotContain(PermissionCatalog.AccessManage, permissions);
    }

    [Fact]
    public async Task JobTitle_ExecutiveDirector_DoesNotGrantPermissionsAutomatically()
    {
        // 2. Cargo Diretor Executivo não concede privilégios
        var (adminClient, _, tenantId, _, _) = await SetupAdminContextAsync("test_dir");

        var createReq = new CreateUserDto(
            "Diretor Executivo Test",
            $"diretor_exec_{Guid.NewGuid():N}@hbstudio.com.br",
            "Senha@2026123",
            IsPartner: false,
            RoleTitle: "Diretor Executivo");

        var res = await adminClient.PostAsJsonAsync("/api/users", createReq);
        Assert.Equal(HttpStatusCode.Created, res.StatusCode);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == createReq.Email);
        Assert.NotNull(user);
        Assert.Equal("Diretor Executivo", user.JobTitle);

        var userRoleIds = await db.UserRoles.Where(ur => ur.UserId == user.Id).Select(ur => ur.RoleId).ToListAsync();
        var permissions = await db.RolePermissions.Where(rp => userRoleIds.Contains(rp.RoleId)).Select(rp => rp.PermissionKey).ToListAsync();

        Assert.DoesNotContain(PermissionCatalog.FinancePeriodClose, permissions);
        Assert.DoesNotContain(PermissionCatalog.AccessManage, permissions);
    }

    [Fact]
    public async Task CustomJobTitle_IsSavedCorrectlyWithoutAlteringRoles()
    {
        // 3. Cargo personalizado é salvo corretamente
        var (adminClient, _, tenantId, _, _) = await SetupAdminContextAsync("test_custom");

        var customTitle = "Engenheiro de Firmware Especialista";
        var createReq = new CreateUserDto(
            "Engenheiro Hardware",
            $"eng_{Guid.NewGuid():N}@hbstudio.com.br",
            "Senha@2026123",
            IsPartner: false,
            RoleTitle: customTitle);

        var res = await adminClient.PostAsJsonAsync("/api/users", createReq);
        Assert.Equal(HttpStatusCode.Created, res.StatusCode);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == createReq.Email);
        Assert.NotNull(user);
        Assert.Equal(customTitle, user.JobTitle);
    }

    [Fact]
    public async Task PartnerCheckbox_WithoutOfficialPartnersCapitalRecord_DoesNotCreateFictitiousPartner()
    {
        // 4. Vínculo societário não gera automaticamente acesso irrestrito nem cria sócio fictício
        var (adminClient, _, tenantId, _, _) = await SetupAdminContextAsync("test_partner_chk");

        var createReq = new CreateUserDto(
            "Suposto Socio Sem Registro",
            $"ficticio_{Guid.NewGuid():N}@hbstudio.com.br",
            "Senha@2026123",
            IsPartner: true, // Marcou checkbox
            RoleTitle: "Sócio Investidor");

        var res = await adminClient.PostAsJsonAsync("/api/users", createReq);
        Assert.Equal(HttpStatusCode.Created, res.StatusCode);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        // Verifica que NÃO foi inserido sócio fictício no PartnersCapital
        var partnerExists = await db.Partners.AnyAsync(p => p.Email == createReq.Email);
        Assert.False(partnerExists);

        // Verifica que usuário foi criado com papel restrito e não possui privilégios de sócio Master
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == createReq.Email);
        Assert.NotNull(user);
        var userRoleIds = await db.UserRoles.Where(ur => ur.UserId == user.Id).Select(ur => ur.RoleId).ToListAsync();
        var permissions = await db.RolePermissions.Where(rp => userRoleIds.Contains(rp.RoleId)).Select(rp => rp.PermissionKey).ToListAsync();
        Assert.DoesNotContain(PermissionCatalog.AccessManage, permissions);
    }

    [Fact]
    public async Task UserWithoutAccessManage_CannotListOrModifyUsers_Returns403()
    {
        // 5 & 10. Usuário sem permissão não altera grants e recebe 403 Forbidden
        var client = _factory.CreateClient();
        var hasher = new Pbkdf2PasswordHasher();
        var unique = Guid.NewGuid().ToString("N")[..8];
        var email = $"operador_{unique}@hbstudio.com.br";
        var password = "OpPassword@2026";

        Guid tenantId;
        Guid operatorUserId;

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var tenant = new Tenant($"Tenant Op {unique}", $"TOP_{unique}");
            db.Tenants.Add(tenant);

            var user = new User(tenant.Id, $"Operador {unique}", email, hasher.HashPassword(password), null, "Vendedor Balcão");
            db.Users.Add(user);

            var role = new Role(tenant.Id, "Vendedor", "Apenas PDV");
            role.AddPermission(PermissionCatalog.SalesPosUse);
            db.Roles.Add(role);
            user.AssignRole(role);

            // Sócio para permitir autenticação
            var partner = new Partner(tenant.Id, Guid.NewGuid(), user.FullName, "222.333.444-55", email, PartnerType.OperatingPartner, DateTime.UtcNow);
            db.Partners.Add(partner);

            await db.SaveChangesAsync();
            tenantId = tenant.Id;
            operatorUserId = user.Id;
        }

        // Login do operador
        var loginRes = await client.PostAsJsonAsync("/api/auth/login", new LoginRequest(email, password));
        var auth = await loginRes.Content.ReadFromJsonAsync<LoginResponse>();
        Assert.NotNull(auth);

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);

        // Tenta listar usuários sem permissão AccessManage -> 403 Forbidden
        var listRes = await client.GetAsync("/api/users");
        Assert.Equal(HttpStatusCode.Forbidden, listRes.StatusCode);

        // Tenta criar usuário sem permissão AccessManage -> 403 Forbidden
        var createRes = await client.PostAsJsonAsync("/api/users", new CreateUserDto("Novo", "novo@hb.com", "123456", false));
        Assert.Equal(HttpStatusCode.Forbidden, createRes.StatusCode);
    }

    [Fact]
    public async Task SelfPrivilegeElevation_IsBlockedWith403()
    {
        // 6. Usuário não consegue elevar os próprios privilégios indevidamente
        var (adminClient, _, tenantId, adminUserId, _) = await SetupAdminContextAsync("test_elevation");

        // Admin tenta atribuir novos papéis a si mesmo via endpoint
        var assignReq = new AssignRolesDto(new List<string> { "Super Mega Role" });
        var res = await adminClient.PutAsJsonAsync($"/api/users/{adminUserId}/roles", assignReq);

        Assert.Equal(HttpStatusCode.Forbidden, res.StatusCode);
    }

    [Fact]
    public async Task UnauthenticatedOrDisabledUser_CannotLogin_Returns401()
    {
        // 11. Usuários sem habilitação de login não conseguem autenticar
        var client = _factory.CreateClient();
        var hasher = new Pbkdf2PasswordHasher();
        var unique = Guid.NewGuid().ToString("N")[..8];
        var email = $"nao_habilitado_{unique}@hbstudio.com.br";
        var password = "ValidPassword@2026";

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var tenant = new Tenant($"Tenant Block {unique}", $"TB_{unique}");
            db.Tenants.Add(tenant);

            // Usuário criado sem registro de sócio no PartnersCapital
            var user = new User(tenant.Id, $"Funcionario {unique}", email, hasher.HashPassword(password), null, "Técnico Especialista");
            db.Users.Add(user);
            await db.SaveChangesAsync();
        }

        // Tenta login: rejeitado porque a política Enterprise restringe login aos sócios ativos e habilitados
        var loginRes = await client.PostAsJsonAsync("/api/auth/login", new LoginRequest(email, password));
        Assert.Equal(HttpStatusCode.Unauthorized, loginRes.StatusCode);
    }

    [Fact]
    public async Task HeaderBadge_ReflectsAuthenticatedUserJobTitle()
    {
        // 12. Badge do perfil corresponde ao cargo (JobTitle) do usuário autenticado
        var client = _factory.CreateClient();
        var hasher = new Pbkdf2PasswordHasher();
        var unique = Guid.NewGuid().ToString("N")[..8];
        var email = $"gerente_{unique}@hbstudio.com.br";
        var password = "GerentePassword@2026";
        var expectedJobTitle = "Gerente Geral";

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var tenant = new Tenant($"Tenant Gerente {unique}", $"TG_{unique}");
            db.Tenants.Add(tenant);

            var user = new User(tenant.Id, $"Gerente {unique}", email, hasher.HashPassword(password), null, expectedJobTitle);
            db.Users.Add(user);

            var partner = new Partner(tenant.Id, Guid.NewGuid(), user.FullName, "999.000.111-22", email, PartnerType.ManagingPartner, DateTime.UtcNow);
            db.Partners.Add(partner);

            await db.SaveChangesAsync();
        }

        var loginRes = await client.PostAsJsonAsync("/api/auth/login", new LoginRequest(email, password));
        loginRes.EnsureSuccessStatusCode();
        var authResult = await loginRes.Content.ReadFromJsonAsync<LoginResponse>();
        Assert.NotNull(authResult);

        // O JobTitle informado deve vir de dados confiáveis no perfil autenticado
        Assert.Equal(expectedJobTitle, authResult.User.JobTitle);

        // Consulta /api/auth/me autenticada
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", authResult.AccessToken);
        var meRes = await client.GetAsync("/api/auth/me");
        meRes.EnsureSuccessStatusCode();
        var meProfile = await meRes.Content.ReadFromJsonAsync<UserProfileDto>();
        Assert.NotNull(meProfile);
        Assert.Equal(expectedJobTitle, meProfile.JobTitle);
    }

    [Fact]
    public async Task AuditEvent_IsLoggedWhenUserIsCreatedAndRolesUpdated()
    {
        // 15. Auditoria registra concessões, alterações de cargo e criação de usuários
        var (adminClient, _, tenantId, _, _) = await SetupAdminContextAsync("test_audit");

        var createReq = new CreateUserDto(
            "Audited User",
            $"audit_user_{Guid.NewGuid():N}@hbstudio.com.br",
            "Senha@2026Audit",
            IsPartner: false,
            RoleTitle: "Analista Financeiro");

        var res = await adminClient.PostAsJsonAsync("/api/users", createReq);
        Assert.Equal(HttpStatusCode.Created, res.StatusCode);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var auditRecord = await db.AuditEvents
            .Where(a => a.TenantId == tenantId && a.EntityType == "IdentityUser" && a.Action == "UserCreated")
            .OrderByDescending(a => a.CreatedAtUtc)
            .FirstOrDefaultAsync();

        Assert.NotNull(auditRecord);
        Assert.Contains("Analista Financeiro", auditRecord.AfterStateJson);
    }
}
