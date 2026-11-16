using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using BuildingBlocks.Application;

namespace BuildingBlocks.Security;

public class HttpExecutionContextAccessor : IExecutionContext
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    public HttpExecutionContextAccessor(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    private ClaimsPrincipal? User => _httpContextAccessor.HttpContext?.User;

    public bool IsAuthenticated => User?.Identity?.IsAuthenticated ?? false;

    public Guid TenantId
    {
        get
        {
            var claim = User?.FindFirst("tenant_id")?.Value;
            return Guid.TryParse(claim, out var tenantId) ? tenantId : Guid.Empty;
        }
    }

    public Guid? BranchId
    {
        get
        {
            var claim = User?.FindFirst("branch_id")?.Value;
            return Guid.TryParse(claim, out var branchId) ? branchId : null;
        }
    }

    public Guid UserId
    {
        get
        {
            var claim = User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return Guid.TryParse(claim, out var userId) ? userId : Guid.Empty;
        }
    }

    public string UserEmail => User?.FindFirst(ClaimTypes.Email)?.Value ?? string.Empty;

    public string? SessionId => User?.FindFirst("session_id")?.Value;

    public uint TokenSecurityStamp
    {
        get
        {
            var claim = User?.FindFirst("security_stamp")?.Value;
            return uint.TryParse(claim, out var stamp) ? stamp : 1;
        }
    }

    public string? CorrelationId => _httpContextAccessor.HttpContext?.TraceIdentifier;

    public IReadOnlySet<string> Permissions
    {
        get
        {
            if (User == null) return new HashSet<string>();
            return User.FindAll("permission").Select(c => c.Value).ToHashSet();
        }
    }

    public bool HasPermission(string permission) => Permissions.Contains(permission);
}
