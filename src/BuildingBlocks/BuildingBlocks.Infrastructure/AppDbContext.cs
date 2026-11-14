using Microsoft.EntityFrameworkCore;
using BuildingBlocks.Domain;
using BuildingBlocks.Application;
using AppExecutionContext = BuildingBlocks.Application.ExecutionContext;
using IdentityAccess.Domain;
using Parties.Domain;
using Catalog.Domain;
using Inventory.Domain;

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

    // Modulo Catalog
    public DbSet<ProductCategory> ProductCategories => Set<ProductCategory>();
    public DbSet<ProductBrand> ProductBrands => Set<ProductBrand>();
    public DbSet<ProductModel> ProductModels => Set<ProductModel>();
    public DbSet<ProductSku> ProductSkus => Set<ProductSku>();
    public DbSet<InventoryUnit> InventoryUnits => Set<InventoryUnit>();
    public DbSet<InventoryUnitIdentifier> InventoryUnitIdentifiers => Set<InventoryUnitIdentifier>();

    // Modulo Inventory & Kardex
    public DbSet<Warehouse> Warehouses => Set<Warehouse>();
    public DbSet<WarehouseLocation> WarehouseLocations => Set<WarehouseLocation>();
    public DbSet<StockMovement> StockMovements => Set<StockMovement>();
    public DbSet<StockBalance> StockBalances => Set<StockBalance>();
    public DbSet<SerialStockPosition> SerialStockPositions => Set<SerialStockPosition>();
    public DbSet<StockReservation> StockReservations => Set<StockReservation>();
    public DbSet<StockReservationItem> StockReservationItems => Set<StockReservationItem>();
    public DbSet<StockTransfer> StockTransfers => Set<StockTransfer>();
    public DbSet<StockTransferItem> StockTransferItems => Set<StockTransferItem>();
    public DbSet<InventoryCount> InventoryCounts => Set<InventoryCount>();
    public DbSet<InventoryCountItem> InventoryCountItems => Set<InventoryCountItem>();

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

        // Configuração do Módulo Catalog & InventoryUnit
        modelBuilder.Entity<ProductCategory>(b =>
        {
            b.ToTable("product_categories");
            b.HasKey(c => c.Id);
            b.Property(c => c.Name).HasMaxLength(150).IsRequired();
            b.Property(c => c.Slug).HasMaxLength(150).IsRequired();
            b.Property(c => c.Version).IsRowVersion();

            b.HasIndex(c => new { c.TenantId, c.Slug }).IsUnique();

            b.HasOne(c => c.ParentCategory)
             .WithMany(p => p.SubCategories)
             .HasForeignKey(c => c.ParentCategoryId)
             .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<ProductBrand>(b =>
        {
            b.ToTable("product_brands");
            b.HasKey(brand => brand.Id);
            b.Property(brand => brand.Name).HasMaxLength(150).IsRequired();
            b.Property(brand => brand.Description).HasMaxLength(500);
            b.Property(brand => brand.Version).IsRowVersion();

            b.HasIndex(brand => new { brand.TenantId, brand.Name }).IsUnique();
        });

        modelBuilder.Entity<ProductModel>(b =>
        {
            b.ToTable("product_models");
            b.HasKey(m => m.Id);
            b.Property(m => m.Name).HasMaxLength(200).IsRequired();
            b.Property(m => m.Description).HasMaxLength(1000);
            b.Property(m => m.Version).IsRowVersion();

            b.HasOne(m => m.Brand)
             .WithMany()
             .HasForeignKey(m => m.BrandId)
             .OnDelete(DeleteBehavior.Restrict);

            b.HasOne(m => m.Category)
             .WithMany()
             .HasForeignKey(m => m.CategoryId)
             .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<ProductSku>(b =>
        {
            b.ToTable("product_skus");
            b.HasKey(s => s.Id);
            b.Property(s => s.SkuCode).HasMaxLength(100).IsRequired();
            b.Property(s => s.VariantName).HasMaxLength(150).IsRequired();
            b.Property(s => s.BarcodeEan).HasMaxLength(50);
            b.Property(s => s.DefaultPrice).HasPrecision(18, 2);
            b.Property(s => s.TechnicalSpecsJson).HasColumnType("jsonb");
            b.Property(s => s.Version).IsRowVersion();

            // SKU deve ser estritamente único por tenant
            b.HasIndex(s => new { s.TenantId, s.SkuCode }).IsUnique();

            b.HasOne(s => s.ProductModel)
             .WithMany(m => m.Skus)
             .HasForeignKey(s => s.ProductModelId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<InventoryUnit>(b =>
        {
            b.ToTable("inventory_units");
            b.HasKey(u => u.Id);
            b.Property(u => u.SerialNumber).HasMaxLength(100);
            b.Property(u => u.Imei1).HasMaxLength(20);
            b.Property(u => u.Imei2).HasMaxLength(20);
            b.Property(u => u.AcquisitionCost).HasPrecision(18, 2);
            b.Property(u => u.InspectionNotes).HasMaxLength(1000);
            b.Property(u => u.Version).IsRowVersion();

            // Índices parciais únicos por tenant para IMEI1 e IMEI2 (quando não nulos)
            b.HasIndex(u => new { u.TenantId, u.Imei1 })
             .IsUnique()
             .HasFilter("\"Imei1\" IS NOT NULL");

            b.HasIndex(u => new { u.TenantId, u.Imei2 })
             .IsUnique()
             .HasFilter("\"Imei2\" IS NOT NULL");

            b.HasOne(u => u.ProductSku)
             .WithMany(s => s.InventoryUnits)
             .HasForeignKey(u => u.ProductSkuId)
             .OnDelete(DeleteBehavior.Restrict);

            b.HasOne<Party>()
             .WithMany()
             .HasForeignKey(u => u.SupplierPartyId)
             .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<InventoryUnitIdentifier>(b =>
        {
            b.ToTable("inventory_unit_identifiers");
            b.HasKey(i => i.Id);
            b.Property(i => i.NormalizedValue).HasMaxLength(100).IsRequired();
            b.Property(i => i.Version).IsRowVersion();

            // Restrição crítica: Unicidade global de qualquer identificador (IMEI ou Serial) por tenant
            b.HasIndex(i => new { i.TenantId, i.IdentifierType, i.NormalizedValue }).IsUnique();

            b.HasOne(i => i.InventoryUnit)
             .WithMany(u => u.Identifiers)
             .HasForeignKey(i => i.InventoryUnitId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        // Configuração do Módulo Inventory & Kardex
        modelBuilder.Entity<Warehouse>(b =>
        {
            b.ToTable("warehouses");
            b.HasKey(w => w.Id);
            b.Property(w => w.Code).HasMaxLength(50).IsRequired();
            b.Property(w => w.Name).HasMaxLength(150).IsRequired();
            b.Property(w => w.Description).HasMaxLength(500);
            b.Property(w => w.Version).IsRowVersion();

            b.HasIndex(w => new { w.TenantId, w.BranchId, w.Code }).IsUnique();

            b.HasOne<Branch>()
             .WithMany()
             .HasForeignKey(w => w.BranchId)
             .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<WarehouseLocation>(b =>
        {
            b.ToTable("warehouse_locations");
            b.HasKey(l => l.Id);
            b.Property(l => l.Code).HasMaxLength(50).IsRequired();
            b.Property(l => l.Aisle).HasMaxLength(20).IsRequired();
            b.Property(l => l.Shelf).HasMaxLength(20).IsRequired();
            b.Property(l => l.Bin).HasMaxLength(20).IsRequired();
            b.Property(l => l.Description).HasMaxLength(200);
            b.Property(l => l.Version).IsRowVersion();

            b.HasIndex(l => new { l.TenantId, l.WarehouseId, l.Code }).IsUnique();

            b.HasOne(l => l.Warehouse)
             .WithMany(w => w.Locations)
             .HasForeignKey(l => l.WarehouseId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<StockMovement>(b =>
        {
            b.ToTable("stock_movements");
            b.HasKey(m => m.Id);
            b.Property(m => m.Quantity).HasPrecision(18, 4); // Permite gramas de filamento 3D
            b.Property(m => m.UnitCost).HasPrecision(18, 4);
            b.Property(m => m.TotalCost).HasPrecision(18, 2);
            b.Property(m => m.BalanceAfterQuantity).HasPrecision(18, 4);
            b.Property(m => m.DocumentReference).HasMaxLength(100).IsRequired();
            b.Property(m => m.Reason).HasMaxLength(250);
            b.Property(m => m.IdempotencyKey).HasMaxLength(100);
            b.Property(m => m.Version).IsRowVersion();

            // Kardex imutável: Sem updates, indexado por tenant, data, SKU e serial
            b.HasIndex(m => new { m.TenantId, m.BranchId, m.CreatedAtUtc });
            b.HasIndex(m => new { m.TenantId, m.ProductSkuId, m.CreatedAtUtc });
            b.HasIndex(m => new { m.TenantId, m.InventoryUnitId, m.CreatedAtUtc });
            b.HasIndex(m => new { m.TenantId, m.IdempotencyKey })
             .IsUnique()
             .HasFilter("\"IdempotencyKey\" IS NOT NULL");

            b.HasOne(m => m.Warehouse)
             .WithMany()
             .HasForeignKey(m => m.WarehouseId)
             .OnDelete(DeleteBehavior.Restrict);

            b.HasOne(m => m.WarehouseLocation)
             .WithMany()
             .HasForeignKey(m => m.WarehouseLocationId)
             .OnDelete(DeleteBehavior.Restrict);

            b.HasOne(m => m.ProductSku)
             .WithMany()
             .HasForeignKey(m => m.ProductSkuId)
             .OnDelete(DeleteBehavior.Restrict);

            b.HasOne(m => m.InventoryUnit)
             .WithMany()
             .HasForeignKey(m => m.InventoryUnitId)
             .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<StockBalance>(b =>
        {
            b.ToTable("stock_balances");
            b.HasKey(b => b.Id);
            b.Property(b => b.OnHandQuantity).HasPrecision(18, 4);
            b.Property(b => b.ReservedQuantity).HasPrecision(18, 4);
            b.Property(b => b.BlockedQuantity).HasPrecision(18, 4);
            b.Property(b => b.AverageCost).HasPrecision(18, 4);
            b.Property(b => b.Version).IsRowVersion();

            b.HasIndex(b => new { b.TenantId, b.BranchId, b.WarehouseId, b.WarehouseLocationId, b.ProductSkuId }).IsUnique();

            b.HasOne(b => b.Warehouse)
             .WithMany()
             .HasForeignKey(b => b.WarehouseId)
             .OnDelete(DeleteBehavior.Restrict);

            b.HasOne(b => b.WarehouseLocation)
             .WithMany()
             .HasForeignKey(b => b.WarehouseLocationId)
             .OnDelete(DeleteBehavior.Restrict);

            b.HasOne(b => b.ProductSku)
             .WithMany()
             .HasForeignKey(b => b.ProductSkuId)
             .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<SerialStockPosition>(b =>
        {
            b.ToTable("serial_stock_positions");
            b.HasKey(p => p.Id);
            b.Property(p => p.Version).IsRowVersion();

            // Unidade física serializada só pode ter uma posição no estoque
            b.HasIndex(p => new { p.TenantId, p.InventoryUnitId }).IsUnique();

            b.HasOne(p => p.InventoryUnit)
             .WithMany()
             .HasForeignKey(p => p.InventoryUnitId)
             .OnDelete(DeleteBehavior.Cascade);

            b.HasOne(p => p.Warehouse)
             .WithMany()
             .HasForeignKey(p => p.WarehouseId)
             .OnDelete(DeleteBehavior.Restrict);

            b.HasOne(p => p.WarehouseLocation)
             .WithMany()
             .HasForeignKey(p => p.WarehouseLocationId)
             .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<StockReservation>(b =>
        {
            b.ToTable("stock_reservations");
            b.HasKey(r => r.Id);
            b.Property(r => r.ReservationNumber).HasMaxLength(50).IsRequired();
            b.Property(r => r.Reason).HasMaxLength(250).IsRequired();
            b.Property(r => r.DocumentReference).HasMaxLength(100);
            b.Property(r => r.IdempotencyKey).HasMaxLength(100);
            b.Property(r => r.Version).IsRowVersion();

            b.HasIndex(r => new { r.TenantId, r.ReservationNumber }).IsUnique();
            b.HasIndex(r => new { r.TenantId, r.IdempotencyKey })
             .IsUnique()
             .HasFilter("\"IdempotencyKey\" IS NOT NULL");
        });

        modelBuilder.Entity<StockReservationItem>(b =>
        {
            b.ToTable("stock_reservation_items");
            b.HasKey(i => i.Id);
            b.Property(i => i.Quantity).HasPrecision(18, 4);
            b.Property(i => i.Version).IsRowVersion();

            b.HasOne<StockReservation>()
             .WithMany(r => r.Items)
             .HasForeignKey(i => i.StockReservationId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<StockTransfer>(b =>
        {
            b.ToTable("stock_transfers");
            b.HasKey(t => t.Id);
            b.Property(t => t.TransferNumber).HasMaxLength(50).IsRequired();
            b.Property(t => t.Notes).HasMaxLength(500);
            b.Property(t => t.Version).IsRowVersion();

            b.HasIndex(t => new { t.TenantId, t.TransferNumber }).IsUnique();
        });

        modelBuilder.Entity<StockTransferItem>(b =>
        {
            b.ToTable("stock_transfer_items");
            b.HasKey(i => i.Id);
            b.Property(i => i.Quantity).HasPrecision(18, 4);
            b.Property(i => i.Version).IsRowVersion();

            b.HasOne<StockTransfer>()
             .WithMany(t => t.Items)
             .HasForeignKey(i => i.StockTransferId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<InventoryCount>(b =>
        {
            b.ToTable("inventory_counts");
            b.HasKey(c => c.Id);
            b.Property(c => c.CountNumber).HasMaxLength(50).IsRequired();
            b.Property(c => c.Description).HasMaxLength(250).IsRequired();
            b.Property(c => c.Version).IsRowVersion();

            b.HasIndex(c => new { c.TenantId, c.CountNumber }).IsUnique();

            b.HasOne(c => c.Warehouse)
             .WithMany()
             .HasForeignKey(c => c.WarehouseId)
             .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<InventoryCountItem>(b =>
        {
            b.ToTable("inventory_count_items");
            b.HasKey(i => i.Id);
            b.Property(i => i.SystemSnapshotQuantity).HasPrecision(18, 4);
            b.Property(i => i.CountedQuantity).HasPrecision(18, 4);
            b.Property(i => i.Notes).HasMaxLength(250);
            b.Property(i => i.Version).IsRowVersion();

            b.HasOne<InventoryCount>()
             .WithMany(c => c.Items)
             .HasForeignKey(i => i.InventoryCountId)
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
