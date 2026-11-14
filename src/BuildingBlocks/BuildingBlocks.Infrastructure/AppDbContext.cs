using Microsoft.EntityFrameworkCore;
using BuildingBlocks.Domain;
using BuildingBlocks.Application;
using AppExecutionContext = BuildingBlocks.Application.ExecutionContext;
using IdentityAccess.Domain;
using Parties.Domain;
using Catalog.Domain;
using Inventory.Domain;
using Procurement.Domain;
using Sales.Domain;
using CashManagement.Domain;
using Financial.Domain;

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

    // Modulo Procurement (Compras, Recebimento e Aquisição de Usados)
    public DbSet<PurchaseRequest> PurchaseRequests => Set<PurchaseRequest>();
    public DbSet<PurchaseRequestItem> PurchaseRequestItems => Set<PurchaseRequestItem>();
    public DbSet<SupplierQuotation> SupplierQuotations => Set<SupplierQuotation>();
    public DbSet<SupplierQuotationItem> SupplierQuotationItems => Set<SupplierQuotationItem>();
    public DbSet<PurchaseOrder> PurchaseOrders => Set<PurchaseOrder>();
    public DbSet<PurchaseOrderItem> PurchaseOrderItems => Set<PurchaseOrderItem>();
    public DbSet<GoodsReceipt> GoodsReceipts => Set<GoodsReceipt>();
    public DbSet<GoodsReceiptItem> GoodsReceiptItems => Set<GoodsReceiptItem>();
    public DbSet<UsedDeviceAcquisition> UsedDeviceAcquisitions => Set<UsedDeviceAcquisition>();
    public DbSet<SupplierReturn> SupplierReturns => Set<SupplierReturn>();
    public DbSet<SupplierReturnItem> SupplierReturnItems => Set<SupplierReturnItem>();

    // Modulo Sales (MOD-05) - Orçamentos, PDV, Vendas e Pagamentos
    public DbSet<SalesQuote> SalesQuotes => Set<SalesQuote>();
    public DbSet<SalesQuoteItem> SalesQuoteItems => Set<SalesQuoteItem>();
    public DbSet<Sale> Sales => Set<Sale>();
    public DbSet<SaleItem> SaleItems => Set<SaleItem>();
    public DbSet<SalePaymentIntent> SalePaymentIntents => Set<SalePaymentIntent>();
    public DbSet<SaleReturn> SaleReturns => Set<SaleReturn>();
    public DbSet<SaleReturnItem> SaleReturnItems => Set<SaleReturnItem>();

    // Modulo CashManagement (MOD-06) - Caixa, Turnos, Sangrias, Suprimentos e Fechamento
    public DbSet<CashRegister> CashRegisters => Set<CashRegister>();
    public DbSet<CashShift> CashShifts => Set<CashShift>();
    public DbSet<CashMovement> CashMovements => Set<CashMovement>();
    public DbSet<CashCountDenomination> CashCountDenominations => Set<CashCountDenomination>();
    public DbSet<CashDiscrepancy> CashDiscrepancies => Set<CashDiscrepancy>();

    // Modulo Financial (MOD-12) - Financeiro, Razão Contábil, Contas a Pagar/Receber, Bancos e DRE
    public DbSet<FinancialAccount> FinancialAccounts => Set<FinancialAccount>();
    public DbSet<FinancialCostCenter> FinancialCostCenters => Set<FinancialCostCenter>();
    public DbSet<BankAccount> BankAccounts => Set<BankAccount>();
    public DbSet<FinancialJournalEntry> FinancialJournalEntries => Set<FinancialJournalEntry>();
    public DbSet<FinancialJournalLine> FinancialJournalLines => Set<FinancialJournalLine>();
    public DbSet<AccountPayable> AccountsPayable => Set<AccountPayable>();
    public DbSet<AccountReceivable> AccountsReceivable => Set<AccountReceivable>();
    public DbSet<FinancialSettlement> FinancialSettlements => Set<FinancialSettlement>();
    public DbSet<BankTransaction> BankTransactions => Set<BankTransaction>();

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

        // ==========================================
        // Modulo Procurement (MOD-04)
        // ==========================================
        modelBuilder.Entity<PurchaseRequest>(b =>
        {
            b.ToTable("purchase_requests");
            b.HasKey(r => r.Id);
            b.Property(r => r.RequestNumber).HasMaxLength(50).IsRequired();
            b.Property(r => r.Justification).HasMaxLength(500).IsRequired();
            b.Property(r => r.DecisionNotes).HasMaxLength(500);
            b.Property(r => r.Version).IsRowVersion();

            b.HasIndex(r => new { r.TenantId, r.RequestNumber }).IsUnique();
            b.HasIndex(r => new { r.TenantId, r.BranchId, r.Status });
        });

        modelBuilder.Entity<PurchaseRequestItem>(b =>
        {
            b.ToTable("purchase_request_items");
            b.HasKey(i => i.Id);
            b.Property(i => i.Quantity).HasPrecision(18, 4);
            b.Property(i => i.EstimatedUnitCost).HasPrecision(18, 2);
            b.Property(i => i.Notes).HasMaxLength(250);
            b.Property(i => i.Version).IsRowVersion();

            b.HasOne<PurchaseRequest>()
             .WithMany(r => r.Items)
             .HasForeignKey(i => i.PurchaseRequestId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<SupplierQuotation>(b =>
        {
            b.ToTable("supplier_quotations");
            b.HasKey(q => q.Id);
            b.Property(q => q.QuotationNumber).HasMaxLength(50).IsRequired();
            b.Property(q => q.ShippingFee).HasPrecision(18, 2);
            b.Property(q => q.PaymentTerms).HasMaxLength(150);
            b.Property(q => q.Notes).HasMaxLength(500);
            b.Property(q => q.Version).IsRowVersion();

            b.HasIndex(q => new { q.TenantId, q.QuotationNumber }).IsUnique();
            b.HasIndex(q => new { q.TenantId, q.SupplierPartyId, q.Status });
        });

        modelBuilder.Entity<SupplierQuotationItem>(b =>
        {
            b.ToTable("supplier_quotation_items");
            b.HasKey(i => i.Id);
            b.Property(i => i.Quantity).HasPrecision(18, 4);
            b.Property(i => i.UnitPrice).HasPrecision(18, 2);
            b.Property(i => i.DiscountAmount).HasPrecision(18, 2);
            b.Property(i => i.Version).IsRowVersion();

            b.HasOne<SupplierQuotation>()
             .WithMany(q => q.Items)
             .HasForeignKey(i => i.SupplierQuotationId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<PurchaseOrder>(b =>
        {
            b.ToTable("purchase_orders");
            b.HasKey(o => o.Id);
            b.Property(o => o.OrderNumber).HasMaxLength(50).IsRequired();
            b.Property(o => o.PaymentTerms).HasMaxLength(150);
            b.Property(o => o.ShippingCost).HasPrecision(18, 2);
            b.Property(o => o.OtherExpenses).HasPrecision(18, 2);
            b.Property(o => o.TotalDiscount).HasPrecision(18, 2);
            b.Property(o => o.Notes).HasMaxLength(1000);
            b.Property(o => o.Version).IsRowVersion();

            b.HasIndex(o => new { o.TenantId, o.OrderNumber }).IsUnique();
            b.HasIndex(o => new { o.TenantId, o.BranchId, o.Status });
            b.HasIndex(o => new { o.TenantId, o.SupplierPartyId });
        });

        modelBuilder.Entity<PurchaseOrderItem>(b =>
        {
            b.ToTable("purchase_order_items");
            b.HasKey(i => i.Id);
            b.Property(i => i.HistoricalSkuCode).HasMaxLength(100).IsRequired();
            b.Property(i => i.HistoricalDescription).HasMaxLength(300).IsRequired();
            b.Property(i => i.QuantityOrdered).HasPrecision(18, 4);
            b.Property(i => i.QuantityReceived).HasPrecision(18, 4);
            b.Property(i => i.UnitCost).HasPrecision(18, 2);
            b.Property(i => i.Discount).HasPrecision(18, 2);
            b.Property(i => i.Version).IsRowVersion();

            b.HasOne<PurchaseOrder>()
             .WithMany(o => o.Items)
             .HasForeignKey(i => i.PurchaseOrderId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<GoodsReceipt>(b =>
        {
            b.ToTable("goods_receipts");
            b.HasKey(r => r.Id);
            b.Property(r => r.ReceiptNumber).HasMaxLength(50).IsRequired();
            b.Property(r => r.InvoiceOrDocumentNumber).HasMaxLength(100).IsRequired();
            b.Property(r => r.IdempotencyKey).HasMaxLength(100);
            b.Property(r => r.Notes).HasMaxLength(1000);
            b.Property(r => r.Version).IsRowVersion();

            b.HasIndex(r => new { r.TenantId, r.ReceiptNumber }).IsUnique();
            b.HasIndex(r => new { r.TenantId, r.IdempotencyKey }).IsUnique().HasFilter("\"IdempotencyKey\" IS NOT NULL");
            b.HasIndex(r => new { r.TenantId, r.PurchaseOrderId });
            b.HasIndex(r => new { r.TenantId, r.WarehouseId });
        });

        modelBuilder.Entity<GoodsReceiptItem>(b =>
        {
            b.ToTable("goods_receipt_items");
            b.HasKey(i => i.Id);
            b.Property(i => i.QuantityReceived).HasPrecision(18, 4);
            b.Property(i => i.RealUnitCost).HasPrecision(18, 2);
            b.Property(i => i.SerialOrImei).HasMaxLength(100);
            b.Property(i => i.Notes).HasMaxLength(300);
            b.Property(i => i.Version).IsRowVersion();

            b.HasOne<GoodsReceipt>()
             .WithMany(r => r.Items)
             .HasForeignKey(i => i.GoodsReceiptId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<UsedDeviceAcquisition>(b =>
        {
            b.ToTable("used_device_acquisitions");
            b.HasKey(u => u.Id);
            b.Property(u => u.AcquisitionNumber).HasMaxLength(50).IsRequired();
            b.Property(u => u.SerialNumber).HasMaxLength(100).IsRequired();
            b.Property(u => u.Imei1).HasMaxLength(20);
            b.Property(u => u.Imei2).HasMaxLength(20);
            b.Property(u => u.NegotiatedPrice).HasPrecision(18, 2);
            b.Property(u => u.AttributableExpenses).HasPrecision(18, 2);
            b.Property(u => u.ChecklistInspectionJson).HasColumnType("jsonb").IsRequired();
            b.Property(u => u.Notes).HasMaxLength(1000);
            b.Property(u => u.Version).IsRowVersion();

            b.HasIndex(u => new { u.TenantId, u.AcquisitionNumber }).IsUnique();
            b.HasIndex(u => new { u.TenantId, u.BranchId, u.Status });
            b.HasIndex(u => new { u.TenantId, u.SellerPartyId });
            b.HasIndex(u => new { u.TenantId, u.SerialNumber });
            b.HasIndex(u => new { u.TenantId, u.Imei1 });
        });

        modelBuilder.Entity<SupplierReturn>(b =>
        {
            b.ToTable("supplier_returns");
            b.HasKey(r => r.Id);
            b.Property(r => r.ReturnNumber).HasMaxLength(50).IsRequired();
            b.Property(r => r.Reason).HasMaxLength(500).IsRequired();
            b.Property(r => r.ReturnInvoiceNumber).HasMaxLength(100);
            b.Property(r => r.Version).IsRowVersion();

            b.HasIndex(r => new { r.TenantId, r.ReturnNumber }).IsUnique();
            b.HasIndex(r => new { r.TenantId, r.SupplierPartyId });
            b.HasIndex(r => new { r.TenantId, r.GoodsReceiptId });
        });

        modelBuilder.Entity<SupplierReturnItem>(b =>
        {
            b.ToTable("supplier_return_items");
            b.HasKey(i => i.Id);
            b.Property(i => i.Quantity).HasPrecision(18, 4);
            b.Property(i => i.UnitCost).HasPrecision(18, 2);
            b.Property(i => i.Version).IsRowVersion();

            b.HasOne<SupplierReturn>()
             .WithMany(r => r.Items)
             .HasForeignKey(i => i.SupplierReturnId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        // ==========================================
        // Modulo Sales (MOD-05) - Orçamentos e PDV
        // ==========================================
        modelBuilder.Entity<SalesQuote>(b =>
        {
            b.ToTable("sales_quotes");
            b.HasKey(q => q.Id);
            b.Property(q => q.QuoteNumber).HasMaxLength(50).IsRequired();
            b.Property(q => q.PaymentTermsExpected).HasMaxLength(150);
            b.Property(q => q.ShippingTotal).HasPrecision(18, 2);
            b.Property(q => q.DiscountTotal).HasPrecision(18, 2);
            b.Property(q => q.Notes).HasMaxLength(1000);
            b.Property(q => q.Version).IsRowVersion();

            b.HasIndex(q => new { q.TenantId, q.QuoteNumber }).IsUnique();
            b.HasIndex(q => new { q.TenantId, q.BranchId, q.Status });
            b.HasIndex(q => new { q.TenantId, q.CustomerPartyId });
        });

        modelBuilder.Entity<SalesQuoteItem>(b =>
        {
            b.ToTable("sales_quote_items");
            b.HasKey(i => i.Id);
            b.Property(i => i.HistoricalSkuCode).HasMaxLength(100).IsRequired();
            b.Property(i => i.HistoricalDescription).HasMaxLength(300).IsRequired();
            b.Property(i => i.Quantity).HasPrecision(18, 4);
            b.Property(i => i.UnitPrice).HasPrecision(18, 2);
            b.Property(i => i.Discount).HasPrecision(18, 2);
            b.Property(i => i.SerialOrImei).HasMaxLength(100);
            b.Property(i => i.Version).IsRowVersion();

            b.HasOne<SalesQuote>()
             .WithMany(q => q.Items)
             .HasForeignKey(i => i.SalesQuoteId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Sale>(b =>
        {
            b.ToTable("sales");
            b.HasKey(s => s.Id);
            b.Property(s => s.SaleNumber).HasMaxLength(50).IsRequired();
            b.Property(s => s.ChargesTotal).HasPrecision(18, 2);
            b.Property(s => s.DiscountTotal).HasPrecision(18, 2);
            b.Property(s => s.Observations).HasMaxLength(1000);
            b.Property(s => s.IdempotencyKey).HasMaxLength(100);
            b.Property(s => s.Version).IsRowVersion();

            b.HasIndex(s => new { s.TenantId, s.SaleNumber }).IsUnique();
            b.HasIndex(s => new { s.TenantId, s.IdempotencyKey }).IsUnique().HasFilter("\"IdempotencyKey\" IS NOT NULL");
            b.HasIndex(s => new { s.TenantId, s.BranchId, s.Status });
            b.HasIndex(s => new { s.TenantId, s.CustomerPartyId });
            b.HasIndex(s => new { s.TenantId, s.SellerUserId });
        });

        modelBuilder.Entity<SaleItem>(b =>
        {
            b.ToTable("sale_items");
            b.HasKey(i => i.Id);
            b.Property(i => i.HistoricalSkuCode).HasMaxLength(100).IsRequired();
            b.Property(i => i.HistoricalDescription).HasMaxLength(300).IsRequired();
            b.Property(i => i.Quantity).HasPrecision(18, 4);
            b.Property(i => i.UnitPrice).HasPrecision(18, 2);
            b.Property(i => i.Discount).HasPrecision(18, 2);
            b.Property(i => i.HistoricalUnitCost).HasPrecision(18, 2);
            b.Property(i => i.SerialOrImei).HasMaxLength(100);
            b.Property(i => i.Version).IsRowVersion();

            b.HasOne<Sale>()
             .WithMany(s => s.Items)
             .HasForeignKey(i => i.SaleId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<SalePaymentIntent>(b =>
        {
            b.ToTable("sale_payment_intents");
            b.HasKey(p => p.Id);
            b.Property(p => p.Amount).HasPrecision(18, 2);
            b.Property(p => p.AuthorizationCode).HasMaxLength(100);
            b.Property(p => p.TransactionReference).HasMaxLength(200);
            b.Property(p => p.Notes).HasMaxLength(500);
            b.Property(p => p.Version).IsRowVersion();

            b.HasOne<Sale>()
             .WithMany(s => s.Payments)
             .HasForeignKey(p => p.SaleId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<SaleReturn>(b =>
        {
            b.ToTable("sale_returns");
            b.HasKey(r => r.Id);
            b.Property(r => r.ReturnNumber).HasMaxLength(50).IsRequired();
            b.Property(r => r.Reason).HasMaxLength(500).IsRequired();
            b.Property(r => r.InspectionNotes).HasMaxLength(500);
            b.Property(r => r.Version).IsRowVersion();

            b.HasIndex(r => new { r.TenantId, r.ReturnNumber }).IsUnique();
            b.HasIndex(r => new { r.TenantId, r.SaleId });
        });

        modelBuilder.Entity<SaleReturnItem>(b =>
        {
            b.ToTable("sale_return_items");
            b.HasKey(i => i.Id);
            b.Property(i => i.Quantity).HasPrecision(18, 4);
            b.Property(i => i.RefundAmount).HasPrecision(18, 2);
            b.Property(i => i.Version).IsRowVersion();

            b.HasOne<SaleReturn>()
             .WithMany(r => r.Items)
             .HasForeignKey(i => i.SaleReturnId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        // ==================== CASH MANAGEMENT (MOD-06) ====================
        modelBuilder.Entity<CashRegister>(b =>
        {
            b.ToTable("cash_registers");
            b.HasKey(r => r.Id);
            b.Property(r => r.Code).HasMaxLength(50).IsRequired();
            b.Property(r => r.Name).HasMaxLength(150).IsRequired();
            b.Property(r => r.Notes).HasMaxLength(500);
            b.Property(r => r.Version).IsRowVersion();

            b.HasIndex(r => new { r.TenantId, r.BranchId, r.Code }).IsUnique();
        });

        modelBuilder.Entity<CashShift>(b =>
        {
            b.ToTable("cash_shifts");
            b.HasKey(s => s.Id);
            b.Property(s => s.OpeningFloat).HasPrecision(18, 2);
            b.Property(s => s.CurrentBalance).HasPrecision(18, 2);
            b.Property(s => s.TotalCashIn).HasPrecision(18, 2);
            b.Property(s => s.TotalCashOut).HasPrecision(18, 2);
            b.Property(s => s.ExpectedCashBalance).HasPrecision(18, 2);
            b.Property(s => s.CountedCashBalance).HasPrecision(18, 2);
            b.Property(s => s.DiscrepancyAmount).HasPrecision(18, 2);
            b.Property(s => s.OpeningSource).HasMaxLength(150);
            b.Property(s => s.OpeningNotes).HasMaxLength(500);
            b.Property(s => s.ClosingNotes).HasMaxLength(500);
            b.Property(s => s.Version).IsRowVersion();

            b.HasIndex(s => new { s.TenantId, s.BranchId, s.CashRegisterId, s.Status });
        });

        modelBuilder.Entity<CashMovement>(b =>
        {
            b.ToTable("cash_movements");
            b.HasKey(m => m.Id);
            b.Property(m => m.Amount).HasPrecision(18, 2);
            b.Property(m => m.SourceType).HasMaxLength(50).IsRequired();
            b.Property(m => m.SourceId).HasMaxLength(100).IsRequired();
            b.Property(m => m.DocumentReference).HasMaxLength(100).IsRequired();
            b.Property(m => m.Reason).HasMaxLength(500);
            b.Property(m => m.CorrelationId).HasMaxLength(100);
            b.Property(m => m.IdempotencyKey).HasMaxLength(100);
            b.Property(m => m.Version).IsRowVersion();

            b.HasOne<CashShift>()
             .WithMany(s => s.Movements)
             .HasForeignKey(m => m.CashShiftId)
             .OnDelete(DeleteBehavior.Cascade);

            b.HasIndex(m => new { m.TenantId, m.CashShiftId });
            b.HasIndex(m => new { m.TenantId, m.IdempotencyKey });
            b.HasIndex(m => new { m.TenantId, m.MovementType, m.SourceId });
        });

        modelBuilder.Entity<CashCountDenomination>(b =>
        {
            b.ToTable("cash_count_denominations");
            b.HasKey(d => d.Id);
            b.Property(d => d.Denomination).HasPrecision(18, 2);
            b.Property(d => d.Version).IsRowVersion();

            b.HasOne<CashShift>()
             .WithMany(s => s.Denominations)
             .HasForeignKey(d => d.CashShiftId)
             .OnDelete(DeleteBehavior.Cascade);

            b.HasIndex(d => new { d.TenantId, d.CashShiftId });
        });

        modelBuilder.Entity<CashDiscrepancy>(b =>
        {
            b.ToTable("cash_discrepancies");
            b.HasKey(d => d.Id);
            b.Property(d => d.Amount).HasPrecision(18, 2);
            b.Property(d => d.OperatorJustification).HasMaxLength(1000);
            b.Property(d => d.ResolutionNotes).HasMaxLength(1000);
            b.Property(d => d.Version).IsRowVersion();

            b.HasIndex(d => new { d.TenantId, d.BranchId, d.CashShiftId });
            b.HasIndex(d => new { d.TenantId, d.Status });
        });

        // ==================== FINANCIAL (MOD-12) ====================
        modelBuilder.Entity<FinancialAccount>(b =>
        {
            b.ToTable("financial_accounts");
            b.HasKey(a => a.Id);
            b.Property(a => a.Code).HasMaxLength(50).IsRequired();
            b.Property(a => a.Name).HasMaxLength(150).IsRequired();
            b.Property(a => a.Version).IsRowVersion();

            b.HasIndex(a => new { a.TenantId, a.Code }).IsUnique();
        });

        modelBuilder.Entity<FinancialCostCenter>(b =>
        {
            b.ToTable("financial_cost_centers");
            b.HasKey(c => c.Id);
            b.Property(c => c.Code).HasMaxLength(50).IsRequired();
            b.Property(c => c.Name).HasMaxLength(150).IsRequired();
            b.Property(c => c.Description).HasMaxLength(500);
            b.Property(c => c.Version).IsRowVersion();

            b.HasIndex(c => new { c.TenantId, c.Code }).IsUnique();
        });

        modelBuilder.Entity<BankAccount>(b =>
        {
            b.ToTable("bank_accounts");
            b.HasKey(a => a.Id);
            b.Property(a => a.BankName).HasMaxLength(150).IsRequired();
            b.Property(a => a.AgencyNumber).HasMaxLength(50);
            b.Property(a => a.AccountNumber).HasMaxLength(50).IsRequired();
            b.Property(a => a.CurrentBalance).HasPrecision(18, 2);
            b.Property(a => a.ReconciledBalance).HasPrecision(18, 2);
            b.Property(a => a.Version).IsRowVersion();

            b.HasIndex(a => new { a.TenantId, a.BranchId, a.AccountNumber });
        });

        modelBuilder.Entity<FinancialJournalEntry>(b =>
        {
            b.ToTable("financial_journal_entries");
            b.HasKey(j => j.Id);
            b.Property(j => j.DocumentNumber).HasMaxLength(100).IsRequired();
            b.Property(j => j.SourceType).HasMaxLength(50).IsRequired();
            b.Property(j => j.SourceId).HasMaxLength(100).IsRequired();
            b.Property(j => j.Description).HasMaxLength(500).IsRequired();
            b.Property(j => j.TotalAmount).HasPrecision(18, 2);
            b.Property(j => j.CorrelationId).HasMaxLength(100);
            b.Property(j => j.IdempotencyKey).HasMaxLength(100);
            b.Property(j => j.Version).IsRowVersion();

            b.HasIndex(j => new { j.TenantId, j.BranchId, j.CompetenceDateUtc });
            b.HasIndex(j => new { j.TenantId, j.IdempotencyKey });
        });

        modelBuilder.Entity<FinancialJournalLine>(b =>
        {
            b.ToTable("financial_journal_lines");
            b.HasKey(l => l.Id);
            b.Property(l => l.Amount).HasPrecision(18, 2);
            b.Property(l => l.Memo).HasMaxLength(500);
            b.Property(l => l.Version).IsRowVersion();

            b.HasOne<FinancialJournalEntry>()
             .WithMany(j => j.Lines)
             .HasForeignKey(l => l.FinancialJournalEntryId)
             .OnDelete(DeleteBehavior.Cascade);

            b.HasIndex(l => new { l.TenantId, l.FinancialJournalEntryId });
            b.HasIndex(l => new { l.TenantId, l.FinancialAccountId });
        });

        modelBuilder.Entity<AccountPayable>(b =>
        {
            b.ToTable("accounts_payable");
            b.HasKey(p => p.Id);
            b.Property(p => p.TitleNumber).HasMaxLength(100).IsRequired();
            b.Property(p => p.Description).HasMaxLength(500).IsRequired();
            b.Property(p => p.OriginalAmount).HasPrecision(18, 2);
            b.Property(p => p.PaidAmount).HasPrecision(18, 2);
            b.Property(p => p.DocumentReference).HasMaxLength(100);
            b.Property(p => p.Version).IsRowVersion();

            b.HasIndex(p => new { p.TenantId, p.BranchId, p.TitleNumber }).IsUnique();
            b.HasIndex(p => new { p.TenantId, p.Status, p.DueDateUtc });
        });

        modelBuilder.Entity<AccountReceivable>(b =>
        {
            b.ToTable("accounts_receivable");
            b.HasKey(r => r.Id);
            b.Property(r => r.TitleNumber).HasMaxLength(100).IsRequired();
            b.Property(r => r.Description).HasMaxLength(500).IsRequired();
            b.Property(r => r.OriginalAmount).HasPrecision(18, 2);
            b.Property(r => r.ReceivedAmount).HasPrecision(18, 2);
            b.Property(r => r.DocumentReference).HasMaxLength(100);
            b.Property(r => r.Version).IsRowVersion();

            b.HasIndex(r => new { r.TenantId, r.BranchId, r.TitleNumber }).IsUnique();
            b.HasIndex(r => new { r.TenantId, r.Status, r.DueDateUtc });
        });

        modelBuilder.Entity<FinancialSettlement>(b =>
        {
            b.ToTable("financial_settlements");
            b.HasKey(s => s.Id);
            b.Property(s => s.Amount).HasPrecision(18, 2);
            b.Property(s => s.ReferenceNumber).HasMaxLength(100).IsRequired();
            b.Property(s => s.Version).IsRowVersion();

            b.HasIndex(s => new { s.TenantId, s.TitleId });
        });

        modelBuilder.Entity<BankTransaction>(b =>
        {
            b.ToTable("bank_transactions");
            b.HasKey(t => t.Id);
            b.Property(t => t.Amount).HasPrecision(18, 2);
            b.Property(t => t.FitId).HasMaxLength(100).IsRequired();
            b.Property(t => t.Memo).HasMaxLength(500).IsRequired();
            b.Property(t => t.Version).IsRowVersion();

            b.HasIndex(t => new { t.TenantId, t.BankAccountId, t.FitId }).IsUnique();
            b.HasIndex(t => new { t.TenantId, t.Status });
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
