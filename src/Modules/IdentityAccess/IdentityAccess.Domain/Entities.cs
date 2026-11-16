using BuildingBlocks.Domain;

namespace IdentityAccess.Domain;

public class Tenant : BaseEntity
{
    public string Name { get; private set; }
    public string Code { get; private set; }
    public bool IsActive { get; private set; } = true;

    private readonly List<Branch> _branches = [];
    public IReadOnlyCollection<Branch> Branches => _branches.AsReadOnly();

    private Tenant() { Name = string.Empty; Code = string.Empty; }

    public Tenant(string name, string code)
    {
        if (string.IsNullOrWhiteSpace(name)) throw new ArgumentException("Nome do tenant obrigatório.", nameof(name));
        if (string.IsNullOrWhiteSpace(code)) throw new ArgumentException("Código do tenant obrigatório.", nameof(code));

        Name = name.Trim();
        Code = code.Trim().ToUpperInvariant();
    }

    public Branch AddBranch(string name, string code, bool isHeadquarters = false)
    {
        var branch = new Branch(Id, name, code, isHeadquarters);
        _branches.Add(branch);
        return branch;
    }
}

public class Branch : TenantEntity
{
    public string Name { get; private set; }
    public string Code { get; private set; }
    public bool IsHeadquarters { get; private set; }
    public bool IsActive { get; private set; } = true;

    private Branch() { Name = string.Empty; Code = string.Empty; }

    public Branch(Guid tenantId, string name, string code, bool isHeadquarters = false) : base(tenantId)
    {
        if (string.IsNullOrWhiteSpace(name)) throw new ArgumentException("Nome da filial obrigatório.", nameof(name));
        if (string.IsNullOrWhiteSpace(code)) throw new ArgumentException("Código da filial obrigatório.", nameof(code));

        Name = name.Trim();
        Code = code.Trim().ToUpperInvariant();
        IsHeadquarters = isHeadquarters;
    }
}

public class User : TenantEntity
{
    public string FullName { get; private set; }
    public string Email { get; private set; }
    public string PasswordHash { get; private set; }
    public string JobTitle { get; private set; } = string.Empty; // Cargo / Título Profissional Informativo
    public bool IsActive { get; private set; } = true;
    public Guid? DefaultBranchId { get; private set; }
    public uint SecurityStamp { get; private set; } = 1; // Incrementado a cada revogação/alteração de permissão

    private readonly List<UserRole> _userRoles = [];
    public IReadOnlyCollection<UserRole> UserRoles => _userRoles.AsReadOnly();

    private User() { FullName = string.Empty; Email = string.Empty; PasswordHash = string.Empty; JobTitle = string.Empty; }

    public User(Guid tenantId, string fullName, string email, string passwordHash, Guid? defaultBranchId = null, string? jobTitle = null) : base(tenantId)
    {
        if (string.IsNullOrWhiteSpace(fullName)) throw new ArgumentException("Nome obrigatório.", nameof(fullName));
        if (string.IsNullOrWhiteSpace(email)) throw new ArgumentException("Email obrigatório.", nameof(email));
        if (string.IsNullOrWhiteSpace(passwordHash)) throw new ArgumentException("Hash de senha obrigatório.", nameof(passwordHash));

        FullName = fullName.Trim();
        Email = email.Trim().ToLowerInvariant();
        PasswordHash = passwordHash;
        DefaultBranchId = defaultBranchId;
        JobTitle = string.IsNullOrWhiteSpace(jobTitle) ? "Colaborador" : jobTitle.Trim();
        SecurityStamp = 1;
    }

    public void SetJobTitle(string jobTitle)
    {
        JobTitle = string.IsNullOrWhiteSpace(jobTitle) ? "Colaborador" : jobTitle.Trim();
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void InvalidateSecurityStamp()
    {
        SecurityStamp++;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void Deactivate()
    {
        IsActive = false;
        InvalidateSecurityStamp();
    }

    public void AssignRole(Role role)
    {
        if (role.TenantId != TenantId)
            throw new InvalidOperationException("Role deve pertencer ao mesmo Tenant do usuário.");

        if (!_userRoles.Any(ur => ur.RoleId == role.Id))
        {
            _userRoles.Add(new UserRole(TenantId, Id, role.Id));
            InvalidateSecurityStamp();
        }
    }

    public void RemoveRole(Guid roleId)
    {
        var existing = _userRoles.FirstOrDefault(ur => ur.RoleId == roleId);
        if (existing != null)
        {
            _userRoles.Remove(existing);
            InvalidateSecurityStamp();
        }
    }
}

public class Role : TenantEntity
{
    public string Name { get; private set; }
    public string Description { get; private set; }

    private readonly List<RolePermission> _permissions = [];
    public IReadOnlyCollection<RolePermission> Permissions => _permissions.AsReadOnly();

    private Role() { Name = string.Empty; Description = string.Empty; }

    public Role(Guid tenantId, string name, string description = "") : base(tenantId)
    {
        if (string.IsNullOrWhiteSpace(name)) throw new ArgumentException("Nome do grupo obrigatório.", nameof(name));
        Name = name.Trim();
        Description = description;
    }

    public void AddPermission(string permissionKey)
    {
        if (string.IsNullOrWhiteSpace(permissionKey))
            throw new ArgumentException("Chave de permissão inválida.", nameof(permissionKey));

        if (!_permissions.Any(p => p.PermissionKey == permissionKey))
        {
            _permissions.Add(new RolePermission(TenantId, Id, permissionKey));
        }
    }

    public void RemovePermission(string permissionKey)
    {
        var existing = _permissions.FirstOrDefault(p => p.PermissionKey == permissionKey);
        if (existing != null)
        {
            _permissions.Remove(existing);
        }
    }
}

public class UserRole : TenantEntity
{
    public Guid UserId { get; private set; }
    public Guid RoleId { get; private set; }

    private UserRole() { }

    public UserRole(Guid tenantId, Guid userId, Guid roleId) : base(tenantId)
    {
        UserId = userId;
        RoleId = roleId;
    }
}

public class RolePermission : TenantEntity
{
    public Guid RoleId { get; private set; }
    public string PermissionKey { get; private set; }

    private RolePermission() { PermissionKey = string.Empty; }

    public RolePermission(Guid tenantId, Guid roleId, string permissionKey) : base(tenantId)
    {
        RoleId = roleId;
        PermissionKey = permissionKey;
    }
}

public class AuditEvent : BaseEntity
{
    public Guid? TenantId { get; private set; }
    public Guid? BranchId { get; private set; }
    public string EntityType { get; private set; }
    public string EntityId { get; private set; }
    public string Action { get; private set; }
    public Guid? ActorId { get; private set; }
    public string ActorEmail { get; private set; }
    public string? CorrelationId { get; private set; }
    public string? BeforeStateJson { get; private set; }
    public string? AfterStateJson { get; private set; }

    private AuditEvent() { EntityType = string.Empty; EntityId = string.Empty; Action = string.Empty; ActorEmail = string.Empty; }

    public AuditEvent(
        Guid? tenantId,
        Guid? branchId,
        string entityType,
        string entityId,
        string action,
        Guid? actorId,
        string actorEmail,
        string? correlationId = null,
        string? beforeStateJson = null,
        string? afterStateJson = null)
    {
        TenantId = tenantId;
        BranchId = branchId;
        EntityType = entityType;
        EntityId = entityId;
        Action = action;
        ActorId = actorId;
        ActorEmail = actorEmail;
        CorrelationId = correlationId;
        BeforeStateJson = beforeStateJson;
        AfterStateJson = afterStateJson;
    }
}

public class RevokedSession : BaseEntity
{
    public string SessionId { get; private set; }
    public Guid? UserId { get; private set; }
    public string? Reason { get; private set; }
    public DateTime ExpiresAtUtc { get; private set; }

    private RevokedSession() { SessionId = string.Empty; }

    public RevokedSession(string sessionId, Guid? userId, DateTime expiresAtUtc, string? reason = null)
    {
        if (string.IsNullOrWhiteSpace(sessionId))
            throw new ArgumentException("SessionId is required.", nameof(sessionId));

        SessionId = sessionId.Trim();
        UserId = userId;
        ExpiresAtUtc = expiresAtUtc;
        Reason = reason;
    }
}
