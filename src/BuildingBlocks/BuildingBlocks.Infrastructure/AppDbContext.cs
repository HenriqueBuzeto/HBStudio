using Microsoft.EntityFrameworkCore;
using BuildingBlocks.Domain;
using BuildingBlocks.Application;
using AppExecutionContext = BuildingBlocks.Application.ExecutionContext;
using IdentityAccess.Domain;
using Parties.Domain;

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

    // Modulo Parties
    public DbSet<Party> Parties => Set<Party>();
    public DbSet<CustomerProfile> CustomerProfiles => Set<CustomerProfile>();
    public DbSet<SupplierProfile> SupplierProfiles => Set<SupplierProfile>();
    public DbSet<PartyContact> PartyContacts => Set<PartyContact>();
    public DbSet<PartyAddress> PartyAddresses => Set<PartyAddress>();
    public DbSet<CustomerEquipment> CustomerEquipments => Set<CustomerEquipment>();
    public DbSet<PartyConsentRecord> PartyConsentRecords => Set<PartyConsentRecord>();

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

            // FK composta com Tenant
            b.HasOne<Tenant>()
             .WithMany(t => t.Branches)
             .HasForeignKey(br => br.TenantId)
             .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<User>(b =>
        {
            b.ToTable("users");
            b.HasKey(u => u.Id);
            b.Property(u => u.FullName).HasMaxLength(200).IsRequired();
            b.Property(u => u.Email).HasMaxLength(250).IsRequired();
            b.HasIndex(u => new { u.TenantId, u.Email }).IsUnique();
            b.Property(u => u.Version).IsRowVersion();

            b.HasOne<Tenant>()
             .WithMany()
             .HasForeignKey(u => u.TenantId)
             .OnDelete(DeleteBehavior.Restrict);

            b.HasOne<Branch>()
             .WithMany()
             .HasForeignKey(u => u.DefaultBranchId)
             .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Role>(b =>
        {
            b.ToTable("roles");
            b.HasKey(r => r.Id);
            b.Property(r => r.Name).HasMaxLength(100).IsRequired();
            b.HasIndex(r => new { r.TenantId, r.Name }).IsUnique();
            b.Property(r => r.Version).IsRowVersion();

            b.HasOne<Tenant>()
             .WithMany()
             .HasForeignKey(r => r.TenantId)
             .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<UserRole>(b =>
        {
            b.ToTable("user_roles");
            b.HasKey(ur => new { ur.TenantId, ur.UserId, ur.RoleId });

            b.HasOne<Tenant>()
             .WithMany()
             .HasForeignKey(ur => ur.TenantId)
             .OnDelete(DeleteBehavior.Restrict);

            b.HasOne<User>()
             .WithMany(u => u.UserRoles)
             .HasForeignKey(ur => ur.UserId)
             .OnDelete(DeleteBehavior.Cascade);

            b.HasOne<Role>()
             .WithMany()
             .HasForeignKey(ur => ur.RoleId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<RolePermission>(b =>
        {
            b.ToTable("role_permissions");
            b.HasKey(rp => new { rp.TenantId, rp.RoleId, rp.PermissionKey });
            b.Property(rp => rp.PermissionKey).HasMaxLength(100).IsRequired();

            b.HasOne<Tenant>()
             .WithMany()
             .HasForeignKey(rp => rp.TenantId)
             .OnDelete(DeleteBehavior.Restrict);

            b.HasOne<Role>()
             .WithMany(r => r.Permissions)
             .HasForeignKey(rp => rp.RoleId)
             .OnDelete(DeleteBehavior.Cascade);
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
            b.Property(a => a.BeforeStateJson).HasColumnType("jsonb");
            b.Property(a => a.AfterStateJson).HasColumnType("jsonb");

            b.HasIndex(a => new { a.TenantId, a.CreatedAtUtc });
        });

        // Configuração do Módulo Parties
        modelBuilder.Entity<Party>(b =>
        {
            b.ToTable("parties");
            b.HasKey(p => p.Id);
            b.Property(p => p.Name).HasMaxLength(250).IsRequired();
            b.Property(p => p.TradeName).HasMaxLength(250);
            b.Property(p => p.DocumentNumber).HasMaxLength(20);
            b.Property(p => p.StateRegistration).HasMaxLength(50);
            b.Property(p => p.MunicipalRegistration).HasMaxLength(50);
            b.Property(p => p.Version).IsRowVersion();

            // Índice com unicidade condicional por tenant (quando documento informado)
            b.HasIndex(p => new { p.TenantId, p.DocumentNumber })
             .IsUnique()
             .HasFilter("\"DocumentNumber\" IS NOT NULL");

            b.HasOne(p => p.CustomerProfile)
             .WithOne()
             .HasForeignKey<CustomerProfile>(cp => cp.PartyId)
             .OnDelete(DeleteBehavior.Cascade);

            b.HasOne(p => p.SupplierProfile)
             .WithOne()
             .HasForeignKey<SupplierProfile>(sp => sp.PartyId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<CustomerProfile>(b =>
        {
            b.ToTable("customer_profiles");
            b.HasKey(cp => cp.Id);
            b.Property(cp => cp.TotalSalesValue).HasPrecision(18, 2);
            b.Property(cp => cp.Version).IsRowVersion();
        });

        modelBuilder.Entity<SupplierProfile>(b =>
        {
            b.ToTable("supplier_profiles");
            b.HasKey(sp => sp.Id);
            b.Property(sp => sp.Version).IsRowVersion();
        });

        modelBuilder.Entity<PartyContact>(b =>
        {
            b.ToTable("party_contacts");
            b.HasKey(c => c.Id);
            b.Property(c => c.Name).HasMaxLength(150).IsRequired();
            b.Property(c => c.Email).HasMaxLength(250);
            b.Property(c => c.Phone).HasMaxLength(20);
            b.Property(c => c.WhatsApp).HasMaxLength(20);
            b.Property(c => c.Version).IsRowVersion();

            b.HasOne<Party>()
             .WithMany(p => p.Contacts)
             .HasForeignKey(c => c.PartyId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<PartyAddress>(b =>
        {
            b.ToTable("party_addresses");
            b.HasKey(a => a.Id);
            b.Property(a => a.Street).HasMaxLength(200).IsRequired();
            b.Property(a => a.Number).HasMaxLength(50).IsRequired();
            b.Property(a => a.Complement).HasMaxLength(100);
            b.Property(a => a.Neighborhood).HasMaxLength(100).IsRequired();
            b.Property(a => a.City).HasMaxLength(100).IsRequired();
            b.Property(a => a.State).HasMaxLength(2).IsRequired();
            b.Property(a => a.PostalCode).HasMaxLength(10).IsRequired();
            b.Property(a => a.Version).IsRowVersion();

            b.HasOne<Party>()
             .WithMany(p => p.Addresses)
             .HasForeignKey(a => a.PartyId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<CustomerEquipment>(b =>
        {
            b.ToTable("customer_equipments");
            b.HasKey(e => e.Id);
            b.Property(e => e.EquipmentType).HasMaxLength(100).IsRequired();
            b.Property(e => e.Brand).HasMaxLength(100).IsRequired();
            b.Property(e => e.Model).HasMaxLength(150).IsRequired();
            b.Property(e => e.SerialNumber).HasMaxLength(100);
            b.Property(e => e.Imei1).HasMaxLength(20);
            b.Property(e => e.Imei2).HasMaxLength(20);
            b.Property(e => e.Color).HasMaxLength(50);
            b.Property(e => e.Version).IsRowVersion();

            b.HasOne<Party>()
             .WithMany(p => p.Equipments)
             .HasForeignKey(e => e.PartyId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<PartyConsentRecord>(b =>
        {
            b.ToTable("party_consent_records");
            b.HasKey(c => c.Id);
            b.Property(c => c.Channel).HasMaxLength(50).IsRequired();
            b.Property(c => c.Purpose).HasMaxLength(100).IsRequired();
            b.Property(c => c.Origin).HasMaxLength(100).IsRequired();
            b.Property(c => c.Evidence).HasMaxLength(500);
            b.Property(c => c.Version).IsRowVersion();

            b.HasOne<Party>()
             .WithMany(p => p.Consents)
             .HasForeignKey(c => c.PartyId)
             .OnDelete(DeleteBehavior.Cascade);
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

    public Guid CurrentTenantId => _executionContext?.TenantId ?? Guid.Empty;
    public bool IsContextAuthenticated => _executionContext?.IsAuthenticated ?? false;

    private void ConfigureTenantFilter<TEntity>(ModelBuilder modelBuilder) where TEntity : class, ITenantScoped
    {
        modelBuilder.Entity<TEntity>().HasQueryFilter(e => !IsContextAuthenticated || e.TenantId == CurrentTenantId);
    }

    public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        // 1. Validar e Forçar Isolamento de Tenant
        var tenantEntries = ChangeTracker.Entries<ITenantScoped>()
            .Where(e => e.State == EntityState.Added || e.State == EntityState.Modified)
            .ToList();

        if (_executionContext != null && _executionContext.IsAuthenticated && _executionContext.TenantId != Guid.Empty)
        {
            foreach (var entry in tenantEntries)
            {
                if (entry.State == EntityState.Added)
                {
                    if (entry.Entity.TenantId == Guid.Empty)
                    {
                        entry.Property(nameof(ITenantScoped.TenantId)).CurrentValue = _executionContext.TenantId;
                    }
                    else if (entry.Entity.TenantId != _executionContext.TenantId)
                    {
                        throw new InvalidOperationException("Tentativa de gravação com TenantId diferente do contexto autenticado.");
                    }
                }
                else if (entry.State == EntityState.Modified)
                {
                    var originalTenantId = entry.OriginalValues.GetValue<Guid>(nameof(ITenantScoped.TenantId));
                    if (originalTenantId != _executionContext.TenantId || entry.Entity.TenantId != _executionContext.TenantId)
                    {
                        throw new InvalidOperationException("Violação de segurança: Não é permitido alterar ou transferir TenantId.");
                    }
                }
            }
        }

        // 2. Gravar Eventos de Auditoria Sanitizada Automaticamente
        var auditedEntries = ChangeTracker.Entries<BaseEntity>()
            .Where(e => e.Entity is not AuditEvent && 
                       (e.State == EntityState.Added || e.State == EntityState.Modified || e.State == EntityState.Deleted))
            .ToList();

        var auditList = new List<AuditEvent>();
        foreach (var entry in auditedEntries)
        {
            var action = entry.State switch
            {
                EntityState.Added => "INSERT",
                EntityState.Modified => "UPDATE",
                EntityState.Deleted => "DELETE",
                _ => "UNKNOWN"
            };

            Guid? tenantId = (entry.Entity as ITenantScoped)?.TenantId ?? _executionContext?.TenantId;
            Guid? branchId = (entry.Entity as IBranchScoped)?.BranchId ?? _executionContext?.BranchId;

            var audit = new AuditEvent(
                tenantId,
                branchId,
                entry.Entity.GetType().Name,
                entry.Property("Id").CurrentValue?.ToString() ?? Guid.Empty.ToString(),
                action,
                _executionContext?.UserId,
                _executionContext?.UserEmail ?? "system",
                _executionContext is AppExecutionContext ec ? ec.CorrelationId : null
            );
            auditList.Add(audit);
        }

        if (auditList.Count > 0)
        {
            AuditEvents.AddRange(auditList);
        }

        return await base.SaveChangesAsync(cancellationToken);
    }
}
