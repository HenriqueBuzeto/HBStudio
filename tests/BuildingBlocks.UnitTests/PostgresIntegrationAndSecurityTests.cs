using System.Net;
using System.Net.Http.Headers;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using BuildingBlocks.Application;
using AppExecutionContext = BuildingBlocks.Application.ExecutionContext;
using BuildingBlocks.Domain;
using BuildingBlocks.Infrastructure;
using BuildingBlocks.Security;
using IdentityAccess.Domain;
using Xunit;

namespace BuildingBlocks.UnitTests;

public class PostgresIntegrationAndSecurityTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private const string PostgresTestConn = "Host=127.0.0.1;Port=5433;Database=hbstudio_erp_test;Username=postgres;Password=;";
    private readonly JwtTokenService _jwtTokenService = new("HBStudioEnterpriseErpSuperSecretKey20261113!");

    public PostgresIntegrationAndSecurityTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Postgres_OCC_TwoConcurrentUpdates_ShouldDetectConflictAndThrow()
    {
        // 1. Arrange: Criar entidade no banco real PostgreSQL
        var tenantId = Guid.NewGuid();
        var branchId = Guid.NewGuid();
        var branchName = "Filial Concorrente Teste";

        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(PostgresTestConn)
            .Options;

        var context1 = new AppDbContext(options);
        var tenant = new Tenant("Empresa Concorrencia", "CONC" + Guid.NewGuid().ToString("N")[..6]);
        var branch = tenant.AddBranch(branchName, "BRC01");

        context1.Tenants.Add(tenant);
        await context1.SaveChangesAsync();

        // 2. Dois contextos carregam o mesmo registro simultaneamente
        using var clientAContext = new AppDbContext(options);
        using var clientBContext = new AppDbContext(options);

        var recordForA = await clientAContext.Branches.SingleAsync(b => b.Id == branch.Id);
        var recordForB = await clientBContext.Branches.SingleAsync(b => b.Id == branch.Id);

        // 3. Cliente A modifica e salva com sucesso
        var propA = typeof(Branch).GetProperty("Name");
        propA?.SetValue(recordForA, "Nome Alterado por A");
        await clientAContext.SaveChangesAsync();

        // 4. Cliente B tenta modificar o mesmo registro com sua versão desatualizada
        propA?.SetValue(recordForB, "Nome Alterado por B Concorrente");

        Func<Task> actB = async () => await clientBContext.SaveChangesAsync();

        // 5. Assert: O PostgreSQL / EF Core detecta colisão de concorrência e gera DbUpdateConcurrencyException
        await actB.Should().ThrowAsync<DbUpdateConcurrencyException>();

        // 6. Validar que a modificação original de A permaneceu intacta
        using var verifyContext = new AppDbContext(options);
        var finalRecord = await verifyContext.Branches.SingleAsync(b => b.Id == branch.Id);
        finalRecord.Name.Should().Be("Nome Alterado por A");
    }

    [Fact]
    public async Task Postgres_ForeignKey_CrossTenant_ShouldBeRejectedByDatabase()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(PostgresTestConn)
            .Options;

        using var context = new AppDbContext(options);

        // Tentar inserir filial apontando para TenantId inexistente (violação física de FK no PostgreSQL)
        var invalidBranch = new Branch(Guid.NewGuid(), "Filial Sem Pai", "BR-ERR");
        context.Branches.Add(invalidBranch);

        Func<Task> act = async () => await context.SaveChangesAsync();
        await act.Should().ThrowAsync<DbUpdateException>();
    }

    [Fact]
    public async Task Postgres_AuditTrail_ShouldBeAutomaticallyPersistedOnChanges()
    {
        var tenantId = Guid.NewGuid();
        var execContext = new AppExecutionContext
        {
            TenantId = tenantId,
            UserId = Guid.NewGuid(),
            UserEmail = "auditor@hbstudio.com.br",
            CorrelationId = "CORR-AUDIT-123",
            IsAuthenticated = true
        };

        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(PostgresTestConn)
            .Options;

        using var context = new AppDbContext(options, execContext);
        var tenant = new Tenant("Empresa Auditada", "AUD" + Guid.NewGuid().ToString("N")[..6]);
        context.Tenants.Add(tenant);
        await context.SaveChangesAsync();

        // Verificar se evento de auditoria foi gravado automaticamente no PostgreSQL
        var audit = await context.AuditEvents
            .FirstOrDefaultAsync(a => a.EntityId == tenant.Id.ToString() && a.Action == "INSERT");

        audit.Should().NotBeNull();
        audit!.ActorEmail.Should().Be("auditor@hbstudio.com.br");
        audit.CorrelationId.Should().Be("CORR-AUDIT-123");
    }

    [Fact]
    public async Task Security_AnonymousRequest_ShouldReturn401Unauthorized()
    {
        var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/secure-inventory");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Security_UserLackingPermission_ShouldReturn403Forbidden()
    {
        var client = _factory.CreateClient();

        // Usuário com permissão apenas de visualizar estoque, tentando acessar custo
        var token = _jwtTokenService.GenerateToken(
            Guid.NewGuid(),
            Guid.NewGuid(),
            Guid.NewGuid(),
            "vendedor@hbstudio.com.br",
            new[] { PermissionCatalog.InventoryView }
        );

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token.AccessToken);

        var response = await client.GetAsync("/api/secure-inventory-cost");

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Security_UserWithPermission_ShouldReturn200Ok()
    {
        var client = _factory.CreateClient();

        var token = _jwtTokenService.GenerateToken(
            Guid.NewGuid(),
            Guid.NewGuid(),
            Guid.NewGuid(),
            "gerente@hbstudio.com.br",
            new[] { PermissionCatalog.InventoryView, PermissionCatalog.InventoryCostView }
        );

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token.AccessToken);

        var response = await client.GetAsync("/api/secure-inventory-cost");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }
}
