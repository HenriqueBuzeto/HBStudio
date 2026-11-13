using Microsoft.EntityFrameworkCore;
using BuildingBlocks.Domain;
using BuildingBlocks.Application;
using IdentityAccess.Domain;

namespace BuildingBlocks.Infrastructure;

public class AppDbContext : DbContext
{
    private readonly IExecutionContext? _executionContext;

    public DbSet<Tenant> Tenants => Set<Tenant>();
    public DbSet<Branch> Branches => Set<Branch>();
    public DbSet<User> Users => Set<User>();
    public DbSet<Role> Roles => Set<Role>();
    public DbSet<UserRole> UserRoles => Set<UserRole>();
    public DbSet<RolePermission> RolePermissions => Set<RolePermission>();
    public DbSet<AuditEvent> AuditEvents => Set<AuditEvent>();

    public AppDbContext(DbContextOptions<AppDbContext> options, IExecutionContext? executionContext = null)
        : base(options)
    {
        _executionContext = executionContext;
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Mapeamento e Chaves
        modelBuilder.Entity<Tenant>(b =>
        {
            b.ToTable("tenants");
            b.HasKey(t => t.Id);
            b.Property(t => t.Name).HasMaxLength(150).IsRequired();
            b.Property(t => t.Code).HasMaxLength(50).IsRequired();
            b.HasIndex(t => t.Code).IsUnique();
            b.Property(t => t.Version).IsRowVersion();
        });

        modelBuilder.Entity<Branch>(b =>
        {
            b.ToTable("branches");
            b.HasKey(br => br.Id);
            b.Property(br => br.Name).HasMaxLength(150).IsRequired();
            b.Property(br => br.Code).HasMaxLength(50).IsRequired();
            b.HasIndex(br => new { br.TenantId, br.Code }).IsUnique();
            b.Property(br => br.Version).IsRowVersion();
        });

        modelBuilder.Entity<User>(b =>
        {
            b.ToTable("users");
            b.HasKey(u => u.Id);
            b.Property(u => u.FullName).HasMaxLength(200).IsRequired();
            b.Property(u => u.Email).HasMaxLength(250).IsRequired();
            b.HasIndex(u => new { u.TenantId, u.Email }).IsUnique();
            b.Property(u => u.Version).IsRowVersion();
        });

        modelBuilder.Entity<Role>(b =>
        {
            b.ToTable("roles");
            b.HasKey(r => r.Id);
            b.Property(r => r.Name).HasMaxLength(100).IsRequired();
            b.HasIndex(r => new { r.TenantId, r.Name }).IsUnique();
            b.Property(r => r.Version).IsRowVersion();
        });

        modelBuilder.Entity<UserRole>(b =>
        {
            b.ToTable("user_roles");
            b.HasKey(ur => new { ur.TenantId, ur.UserId, ur.RoleId });
        });

        modelBuilder.Entity<RolePermission>(b =>
        {
            b.ToTable("role_permissions");
            b.HasKey(rp => new { rp.TenantId, rp.RoleId, rp.PermissionKey });
            b.Property(rp => rp.PermissionKey).HasMaxLength(100).IsRequired();
        });

        modelBuilder.Entity<AuditEvent>(b =>
        {
            b.ToTable("audit_events");
            b.HasKey(a => a.Id);
            b.Property(a => a.EntityType).HasMaxLength(100).IsRequired();
            b.Property(a => a.EntityId).HasMaxLength(100).IsRequired();
            b.Property(a => a.Action).HasMaxLength(50).IsRequired();
            b.Property(a => a.ActorEmail).HasMaxLength(250).IsRequired();
            b.Property(a => a.CorrelationId).HasMaxLength(100);
        });

        // Configurar Filtros Globais Multi-Tenant Automaticos
        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            if (typeof(ITenantScoped).IsAssignableFrom(entityType.ClrType))
            {
                var method = typeof(AppDbContext)
                    .GetMethod(nameof(ConfigureTenantFilter), System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance)?
                    .MakeGenericMethod(entityType.ClrType);

                method?.Invoke(this, [modelBuilder]);
            }
        }
    }

    private void ConfigureTenantFilter<TEntity>(ModelBuilder modelBuilder) where TEntity : class, ITenantScoped
    {
        modelBuilder.Entity<TEntity>().HasQueryFilter(e => _executionContext == null || e.TenantId == _executionContext.TenantId);
    }

    public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        var entries = ChangeTracker.Entries<ITenantScoped>()
            .Where(e => e.State == EntityState.Added)
            .ToList();

        if (_executionContext != null && _executionContext.IsAuthenticated && _executionContext.TenantId != Guid.Empty)
        {
            foreach (var entry in entries)
            {
                if (entry.Entity.TenantId == Guid.Empty)
                {
                    // Fail-safe: herda do contexto se não explicitado na entidade
                    entry.Property(nameof(ITenantScoped.TenantId)).CurrentValue = _executionContext.TenantId;
                }
                else if (entry.Entity.TenantId != _executionContext.TenantId)
                {
                    throw new InvalidOperationException("Tentativa de gravação com TenantId diferente do contexto autenticado.");
                }
            }
        }

        return await base.SaveChangesAsync(cancellationToken);
    }
}
