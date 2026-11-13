namespace BuildingBlocks.Application;

public interface IExecutionContext
{
    Guid TenantId { get; }
    Guid? BranchId { get; }
    Guid UserId { get; }
    string UserEmail { get; }
    bool IsAuthenticated { get; }
    IReadOnlySet<string> Permissions { get; }
    bool HasPermission(string permission);
}

public class ExecutionContext : IExecutionContext
{
    public Guid TenantId { get; set; }
    public Guid? BranchId { get; set; }
    public Guid UserId { get; set; }
    public string UserEmail { get; set; } = string.Empty;
    public bool IsAuthenticated { get; set; }
    public IReadOnlySet<string> Permissions { get; set; } = new HashSet<string>();

    public bool HasPermission(string permission) =>
        Permissions.Contains(permission);
}
