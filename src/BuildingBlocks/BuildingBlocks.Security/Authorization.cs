using Microsoft.AspNetCore.Authorization;
using BuildingBlocks.Application;

namespace BuildingBlocks.Security;

public class PermissionRequirement : IAuthorizationRequirement
{
    public string Permission { get; }

    public PermissionRequirement(string permission)
    {
        Permission = permission ?? throw new ArgumentNullException(nameof(permission));
    }
}

public class PermissionAuthorizationHandler : AuthorizationHandler<PermissionRequirement>
{
    private readonly IExecutionContext _executionContext;

    public PermissionAuthorizationHandler(IExecutionContext executionContext)
    {
        _executionContext = executionContext;
    }

    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        PermissionRequirement requirement)
    {
        if (!_executionContext.IsAuthenticated)
        {
            return Task.CompletedTask; // Fail-closed: not authenticated
        }

        if (_executionContext.HasPermission(requirement.Permission))
        {
            context.Succeed(requirement);
        }

        return Task.CompletedTask;
    }
}
