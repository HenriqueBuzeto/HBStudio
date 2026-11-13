namespace BuildingBlocks.Domain;

public interface IEntity
{
    Guid Id { get; }
    byte[] Version { get; }
}

public interface ITenantScoped
{
    Guid TenantId { get; }
}

public interface IBranchScoped : ITenantScoped
{
    Guid BranchId { get; }
}

public abstract class BaseEntity : IEntity
{
    public Guid Id { get; protected set; } = Guid.NewGuid();
    public DateTime CreatedAtUtc { get; protected set; } = DateTime.UtcNow;
    public DateTime? UpdatedAtUtc { get; protected set; }
    public byte[] Version { get; set; } = [];
}

public abstract class TenantEntity : BaseEntity, ITenantScoped
{
    public Guid TenantId { get; protected set; }

    protected TenantEntity() { }

    protected TenantEntity(Guid tenantId)
    {
        if (tenantId == Guid.Empty)
            throw new ArgumentException("TenantId não pode ser vazio.", nameof(tenantId));

        TenantId = tenantId;
    }
}

public abstract class BranchEntity : TenantEntity, IBranchScoped
{
    public Guid BranchId { get; protected set; }

    protected BranchEntity() { }

    protected BranchEntity(Guid tenantId, Guid branchId) : base(tenantId)
    {
        if (branchId == Guid.Empty)
            throw new ArgumentException("BranchId não pode ser vazio.", nameof(branchId));

        BranchId = branchId;
    }
}
