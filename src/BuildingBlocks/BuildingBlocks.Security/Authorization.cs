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
    private readonly ISessionRevocationManager _revocationManager;

    public PermissionAuthorizationHandler(
        IExecutionContext executionContext,
        ISessionRevocationManager? revocationManager = null)
    {
        _executionContext = executionContext;
        _revocationManager = revocationManager ?? new MemorySessionRevocationManager();
    }

    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        PermissionRequirement requirement)
    {
        if (!_executionContext.IsAuthenticated)
        {
            return Task.CompletedTask; // Fail-closed: not authenticated
        }

        // Verificação imediata de revogação de sessão (Logout real no server-side)
        if (_executionContext is HttpExecutionContextAccessor httpExec)
        {
            if (!string.IsNullOrEmpty(httpExec.SessionId) && _revocationManager.IsSessionRevoked(httpExec.SessionId))
            {
                return Task.CompletedTask; // Fail-closed: sessão revogada
            }
        }

        if (_executionContext.HasPermission(requirement.Permission))
        {
            context.Succeed(requirement);
        }

        return Task.CompletedTask;
    }
}
