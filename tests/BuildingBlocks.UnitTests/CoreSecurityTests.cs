using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using AppExecutionContext = BuildingBlocks.Application.ExecutionContext;
using BuildingBlocks.Domain;
using BuildingBlocks.Infrastructure;
using BuildingBlocks.Security;
using IdentityAccess.Domain;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;
using Xunit;

namespace BuildingBlocks.UnitTests;

public class MultiTenantIsolationTests
{
    [Fact]
    public async Task QueryFilter_ShouldOnlyReturnRecordsFromCurrentTenant()
    {
        // Arrange
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();

        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        // Seed com contexto sem filtro
        using (var seedContext = new AppDbContext(options))
        {
            var userA = new User(tenantA, "User A", "usera@example.com", "hashA");
            var userB = new User(tenantB, "User B", "userb@example.com", "hashB");

            seedContext.Users.AddRange(userA, userB);
            await seedContext.SaveChangesAsync();
        }

        var executionContextTenantA = new AppExecutionContext
        {
            TenantId = tenantA,
            IsAuthenticated = true
        };

        // Act
        using var testContext = new AppDbContext(options, executionContextTenantA);
        var users = await testContext.Users.ToListAsync();

        // Assert
        users.Should().HaveCount(1);
        users.Single().Email.Should().Be("usera@example.com");
        users.Single().TenantId.Should().Be(tenantA);
    }

    [Fact]
    public async Task SaveChanges_ShouldRejectCrossTenantInsert()
    {
        // Arrange
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();

        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        var executionContextTenantA = new AppExecutionContext
        {
            TenantId = tenantA,
            IsAuthenticated = true
        };

        using var context = new AppDbContext(options, executionContextTenantA);
        var invalidUser = new User(tenantB, "User B Attempt", "bad@example.com", "hash");

        context.Users.Add(invalidUser);

        // Act & Assert
        Func<Task> act = async () => await context.SaveChangesAsync();
        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*TenantId diferente do contexto autenticado*");
    }
}

public class PermissionAuthorizationHandlerTests
{
    [Fact]
    public async Task HandleAsync_ShouldSucceed_WhenUserHasPermission()
    {
        // Arrange
        var context = new AppExecutionContext
        {
            TenantId = Guid.NewGuid(),
            IsAuthenticated = true,
            Permissions = new HashSet<string> { PermissionCatalog.SalesPosUse }
        };

        var handler = new PermissionAuthorizationHandler(context);
        var requirement = new PermissionRequirement(PermissionCatalog.SalesPosUse);
        var authContext = new AuthorizationHandlerContext(
            new[] { requirement },
            new ClaimsPrincipal(),
            null);

        // Act
        await handler.HandleAsync(authContext);

        // Assert
        authContext.HasSucceeded.Should().BeTrue();
    }

    [Fact]
    public async Task HandleAsync_ShouldFailClosed_WhenUserLacksPermission()
    {
        // Arrange
        var context = new AppExecutionContext
        {
            TenantId = Guid.NewGuid(),
            IsAuthenticated = true,
            Permissions = new HashSet<string> { PermissionCatalog.SalesPosUse }
        };

        var handler = new PermissionAuthorizationHandler(context);
        var requirement = new PermissionRequirement(PermissionCatalog.SalesCostView); // Sem permissão de custo
        var authContext = new AuthorizationHandlerContext(
            new[] { requirement },
            new ClaimsPrincipal(),
            null);

        // Act
        await handler.HandleAsync(authContext);

        // Assert
        authContext.HasSucceeded.Should().BeFalse();
    }

    [Fact]
    public async Task HandleAsync_ShouldFailClosed_WhenUnauthenticated()
    {
        // Arrange
        var context = new AppExecutionContext
        {
            IsAuthenticated = false
        };

        var handler = new PermissionAuthorizationHandler(context);
        var requirement = new PermissionRequirement(PermissionCatalog.CustomersView);
        var authContext = new AuthorizationHandlerContext(
            new[] { requirement },
            new ClaimsPrincipal(),
            null);

        // Act
        await handler.HandleAsync(authContext);

        // Assert
        authContext.HasSucceeded.Should().BeFalse();
    }
}
