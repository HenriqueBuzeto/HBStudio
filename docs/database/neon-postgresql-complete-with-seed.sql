CREATE TABLE IF NOT EXISTS "__EFMigrationsHistory" (
    "MigrationId" character varying(150) NOT NULL,
    "ProductVersion" character varying(32) NOT NULL,
    CONSTRAINT "PK___EFMigrationsHistory" PRIMARY KEY ("MigrationId")
);

START TRANSACTION;
CREATE TABLE audit_events (
    "Id" uuid NOT NULL,
    "TenantId" uuid,
    "BranchId" uuid,
    "EntityType" character varying(100) NOT NULL,
    "EntityId" character varying(100) NOT NULL,
    "Action" character varying(50) NOT NULL,
    "ActorId" uuid,
    "ActorEmail" character varying(250) NOT NULL,
    "CorrelationId" character varying(100),
    "BeforeStateJson" jsonb,
    "AfterStateJson" jsonb,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "Version" bigint NOT NULL,
    CONSTRAINT "PK_audit_events" PRIMARY KEY ("Id")
);

CREATE TABLE tenants (
    "Id" uuid NOT NULL,
    "Name" character varying(150) NOT NULL,
    "Code" character varying(50) NOT NULL,
    "IsActive" boolean NOT NULL,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    CONSTRAINT "PK_tenants" PRIMARY KEY ("Id")
);

CREATE TABLE branches (
    "Id" uuid NOT NULL,
    "Name" character varying(150) NOT NULL,
    "Code" character varying(50) NOT NULL,
    "IsHeadquarters" boolean NOT NULL,
    "IsActive" boolean NOT NULL,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_branches" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_branches_tenants_TenantId" FOREIGN KEY ("TenantId") REFERENCES tenants ("Id") ON DELETE RESTRICT
);

CREATE TABLE roles (
    "Id" uuid NOT NULL,
    "Name" character varying(100) NOT NULL,
    "Description" text NOT NULL,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_roles" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_roles_tenants_TenantId" FOREIGN KEY ("TenantId") REFERENCES tenants ("Id") ON DELETE RESTRICT
);

CREATE TABLE users (
    "Id" uuid NOT NULL,
    "FullName" character varying(200) NOT NULL,
    "Email" character varying(250) NOT NULL,
    "PasswordHash" text NOT NULL,
    "IsActive" boolean NOT NULL,
    "DefaultBranchId" uuid,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_users" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_users_branches_DefaultBranchId" FOREIGN KEY ("DefaultBranchId") REFERENCES branches ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_users_tenants_TenantId" FOREIGN KEY ("TenantId") REFERENCES tenants ("Id") ON DELETE RESTRICT
);

CREATE TABLE role_permissions (
    "TenantId" uuid NOT NULL,
    "RoleId" uuid NOT NULL,
    "PermissionKey" character varying(100) NOT NULL,
    "Id" uuid NOT NULL,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "Version" bigint NOT NULL,
    CONSTRAINT "PK_role_permissions" PRIMARY KEY ("TenantId", "RoleId", "PermissionKey"),
    CONSTRAINT "FK_role_permissions_roles_RoleId" FOREIGN KEY ("RoleId") REFERENCES roles ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_role_permissions_tenants_TenantId" FOREIGN KEY ("TenantId") REFERENCES tenants ("Id") ON DELETE RESTRICT
);

CREATE TABLE user_roles (
    "TenantId" uuid NOT NULL,
    "UserId" uuid NOT NULL,
    "RoleId" uuid NOT NULL,
    "Id" uuid NOT NULL,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "Version" bigint NOT NULL,
    CONSTRAINT "PK_user_roles" PRIMARY KEY ("TenantId", "UserId", "RoleId"),
    CONSTRAINT "FK_user_roles_roles_RoleId" FOREIGN KEY ("RoleId") REFERENCES roles ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_user_roles_tenants_TenantId" FOREIGN KEY ("TenantId") REFERENCES tenants ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_user_roles_users_UserId" FOREIGN KEY ("UserId") REFERENCES users ("Id") ON DELETE CASCADE
);

CREATE INDEX "IX_audit_events_TenantId_CreatedAtUtc" ON audit_events ("TenantId", "CreatedAtUtc");

CREATE UNIQUE INDEX "IX_branches_TenantId_Code" ON branches ("TenantId", "Code");

CREATE INDEX "IX_role_permissions_RoleId" ON role_permissions ("RoleId");

CREATE UNIQUE INDEX "IX_roles_TenantId_Name" ON roles ("TenantId", "Name");

CREATE UNIQUE INDEX "IX_tenants_Code" ON tenants ("Code");

CREATE INDEX "IX_user_roles_RoleId" ON user_roles ("RoleId");

CREATE INDEX "IX_user_roles_UserId" ON user_roles ("UserId");

CREATE INDEX "IX_users_DefaultBranchId" ON users ("DefaultBranchId");

CREATE UNIQUE INDEX "IX_users_TenantId_Email" ON users ("TenantId", "Email");

INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261113212733_InitialCreate', '10.0.0');

COMMIT;

START TRANSACTION;
CREATE TABLE parties (
    "Id" uuid NOT NULL,
    "Type" integer NOT NULL,
    "Name" character varying(250) NOT NULL,
    "TradeName" character varying(250),
    "DocumentNumber" character varying(20),
    "StateRegistration" character varying(50),
    "MunicipalRegistration" character varying(50),
    "BirthDate" timestamp with time zone,
    "IsActive" boolean NOT NULL,
    "Notes" text,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_parties" PRIMARY KEY ("Id")
);

CREATE TABLE customer_equipments (
    "Id" uuid NOT NULL,
    "PartyId" uuid NOT NULL,
    "EquipmentType" character varying(100) NOT NULL,
    "Brand" character varying(100) NOT NULL,
    "Model" character varying(150) NOT NULL,
    "SerialNumber" character varying(100),
    "Imei1" character varying(20),
    "Imei2" character varying(20),
    "Color" character varying(50),
    "Notes" text,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_customer_equipments" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_customer_equipments_parties_PartyId" FOREIGN KEY ("PartyId") REFERENCES parties ("Id") ON DELETE CASCADE
);

CREATE TABLE customer_profiles (
    "Id" uuid NOT NULL,
    "PartyId" uuid NOT NULL,
    "InternalNotes" text,
    "TotalSalesValue" numeric(18,2) NOT NULL,
    "CompletedRepairsCount" integer NOT NULL,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_customer_profiles" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_customer_profiles_parties_PartyId" FOREIGN KEY ("PartyId") REFERENCES parties ("Id") ON DELETE CASCADE
);

CREATE TABLE party_addresses (
    "Id" uuid NOT NULL,
    "PartyId" uuid NOT NULL,
    "Street" character varying(200) NOT NULL,
    "Number" character varying(50) NOT NULL,
    "Complement" character varying(100),
    "Neighborhood" character varying(100) NOT NULL,
    "City" character varying(100) NOT NULL,
    "State" character varying(2) NOT NULL,
    "PostalCode" character varying(10) NOT NULL,
    "IsPrimary" boolean NOT NULL,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_party_addresses" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_party_addresses_parties_PartyId" FOREIGN KEY ("PartyId") REFERENCES parties ("Id") ON DELETE CASCADE
);

CREATE TABLE party_consent_records (
    "Id" uuid NOT NULL,
    "PartyId" uuid NOT NULL,
    "Channel" character varying(50) NOT NULL,
    "Purpose" character varying(100) NOT NULL,
    "IsOptIn" boolean NOT NULL,
    "Origin" character varying(100) NOT NULL,
    "Evidence" character varying(500),
    "EventDateUtc" timestamp with time zone NOT NULL,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_party_consent_records" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_party_consent_records_parties_PartyId" FOREIGN KEY ("PartyId") REFERENCES parties ("Id") ON DELETE CASCADE
);

CREATE TABLE party_contacts (
    "Id" uuid NOT NULL,
    "PartyId" uuid NOT NULL,
    "Name" character varying(150) NOT NULL,
    "Email" character varying(250),
    "Phone" character varying(20),
    "WhatsApp" character varying(20),
    "IsPrimary" boolean NOT NULL,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_party_contacts" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_party_contacts_parties_PartyId" FOREIGN KEY ("PartyId") REFERENCES parties ("Id") ON DELETE CASCADE
);

CREATE TABLE supplier_profiles (
    "Id" uuid NOT NULL,
    "PartyId" uuid NOT NULL,
    "SupplyCategories" text,
    "PaymentTerms" text,
    "LeadTimeDays" integer NOT NULL,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_supplier_profiles" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_supplier_profiles_parties_PartyId" FOREIGN KEY ("PartyId") REFERENCES parties ("Id") ON DELETE CASCADE
);

CREATE INDEX "IX_customer_equipments_PartyId" ON customer_equipments ("PartyId");

CREATE UNIQUE INDEX "IX_customer_profiles_PartyId" ON customer_profiles ("PartyId");

CREATE UNIQUE INDEX "IX_parties_TenantId_DocumentNumber" ON parties ("TenantId", "DocumentNumber") WHERE "DocumentNumber" IS NOT NULL;

CREATE INDEX "IX_party_addresses_PartyId" ON party_addresses ("PartyId");

CREATE INDEX "IX_party_consent_records_PartyId" ON party_consent_records ("PartyId");

CREATE INDEX "IX_party_contacts_PartyId" ON party_contacts ("PartyId");

CREATE UNIQUE INDEX "IX_supplier_profiles_PartyId" ON supplier_profiles ("PartyId");

INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261113214205_AddPartiesModule', '10.0.0');

COMMIT;

START TRANSACTION;
CREATE TABLE product_brands (
    "Id" uuid NOT NULL,
    "Name" character varying(150) NOT NULL,
    "Description" character varying(500),
    "IsActive" boolean NOT NULL,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_product_brands" PRIMARY KEY ("Id")
);

CREATE TABLE product_categories (
    "Id" uuid NOT NULL,
    "Name" character varying(150) NOT NULL,
    "Slug" character varying(150) NOT NULL,
    "ParentCategoryId" uuid,
    "IsActive" boolean NOT NULL,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_product_categories" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_product_categories_product_categories_ParentCategoryId" FOREIGN KEY ("ParentCategoryId") REFERENCES product_categories ("Id") ON DELETE RESTRICT
);

CREATE TABLE product_models (
    "Id" uuid NOT NULL,
    "Name" character varying(200) NOT NULL,
    "Description" character varying(1000),
    "Kind" integer NOT NULL,
    "SerializationPolicy" integer NOT NULL,
    "BrandId" uuid NOT NULL,
    "CategoryId" uuid NOT NULL,
    "IsActive" boolean NOT NULL,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_product_models" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_product_models_product_brands_BrandId" FOREIGN KEY ("BrandId") REFERENCES product_brands ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_product_models_product_categories_CategoryId" FOREIGN KEY ("CategoryId") REFERENCES product_categories ("Id") ON DELETE RESTRICT
);

CREATE TABLE product_skus (
    "Id" uuid NOT NULL,
    "ProductModelId" uuid NOT NULL,
    "SkuCode" character varying(100) NOT NULL,
    "VariantName" character varying(150) NOT NULL,
    "BarcodeEan" character varying(50),
    "DefaultPrice" numeric(18,2) NOT NULL,
    "TechnicalSpecsJson" jsonb,
    "IsActive" boolean NOT NULL,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_product_skus" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_product_skus_product_models_ProductModelId" FOREIGN KEY ("ProductModelId") REFERENCES product_models ("Id") ON DELETE CASCADE
);

CREATE TABLE inventory_units (
    "Id" uuid NOT NULL,
    "ProductSkuId" uuid NOT NULL,
    "SerialNumber" character varying(100),
    "Imei1" character varying(20),
    "Imei2" character varying(20),
    "Condition" integer NOT NULL,
    "Grade" integer NOT NULL,
    "BatteryHealthPercentage" integer,
    "AcquisitionCost" numeric(18,2) NOT NULL,
    "SupplierPartyId" uuid,
    "OperationalStatus" integer NOT NULL,
    "InspectionNotes" character varying(1000),
    "AcquisitionDateUtc" timestamp with time zone NOT NULL,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_inventory_units" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_inventory_units_parties_SupplierPartyId" FOREIGN KEY ("SupplierPartyId") REFERENCES parties ("Id") ON DELETE SET NULL,
    CONSTRAINT "FK_inventory_units_product_skus_ProductSkuId" FOREIGN KEY ("ProductSkuId") REFERENCES product_skus ("Id") ON DELETE RESTRICT
);

CREATE INDEX "IX_inventory_units_ProductSkuId" ON inventory_units ("ProductSkuId");

CREATE INDEX "IX_inventory_units_SupplierPartyId" ON inventory_units ("SupplierPartyId");

CREATE UNIQUE INDEX "IX_inventory_units_TenantId_Imei1" ON inventory_units ("TenantId", "Imei1") WHERE "Imei1" IS NOT NULL;

CREATE UNIQUE INDEX "IX_inventory_units_TenantId_Imei2" ON inventory_units ("TenantId", "Imei2") WHERE "Imei2" IS NOT NULL;

CREATE UNIQUE INDEX "IX_product_brands_TenantId_Name" ON product_brands ("TenantId", "Name");

CREATE INDEX "IX_product_categories_ParentCategoryId" ON product_categories ("ParentCategoryId");

CREATE UNIQUE INDEX "IX_product_categories_TenantId_Slug" ON product_categories ("TenantId", "Slug");

CREATE INDEX "IX_product_models_BrandId" ON product_models ("BrandId");

CREATE INDEX "IX_product_models_CategoryId" ON product_models ("CategoryId");

CREATE INDEX "IX_product_skus_ProductModelId" ON product_skus ("ProductModelId");

CREATE UNIQUE INDEX "IX_product_skus_TenantId_SkuCode" ON product_skus ("TenantId", "SkuCode");

INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261114043649_AddCatalogAndInventoryUnitModule', '10.0.0');

COMMIT;

START TRANSACTION;
CREATE TABLE inventory_unit_identifiers (
    "Id" uuid NOT NULL,
    "InventoryUnitId" uuid NOT NULL,
    "IdentifierType" integer NOT NULL,
    "NormalizedValue" character varying(100) NOT NULL,
    "IsPrimary" boolean NOT NULL,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_inventory_unit_identifiers" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_inventory_unit_identifiers_inventory_units_InventoryUnitId" FOREIGN KEY ("InventoryUnitId") REFERENCES inventory_units ("Id") ON DELETE CASCADE
);

CREATE TABLE stock_reservations (
    "Id" uuid NOT NULL,
    "BranchId" uuid NOT NULL,
    "ReservationNumber" character varying(50) NOT NULL,
    "Status" integer NOT NULL,
    "Reason" character varying(250) NOT NULL,
    "DocumentReference" character varying(100),
    "ExpiresAtUtc" timestamp with time zone NOT NULL,
    "IdempotencyKey" character varying(100),
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_stock_reservations" PRIMARY KEY ("Id")
);

CREATE TABLE stock_transfers (
    "Id" uuid NOT NULL,
    "TransferNumber" character varying(50) NOT NULL,
    "SourceBranchId" uuid NOT NULL,
    "SourceWarehouseId" uuid NOT NULL,
    "TargetBranchId" uuid NOT NULL,
    "TargetWarehouseId" uuid NOT NULL,
    "Status" integer NOT NULL,
    "Notes" character varying(500),
    "DispatchedAtUtc" timestamp with time zone,
    "ReceivedAtUtc" timestamp with time zone,
    "CreatedByUserId" uuid NOT NULL,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_stock_transfers" PRIMARY KEY ("Id")
);

CREATE TABLE warehouses (
    "Id" uuid NOT NULL,
    "BranchId" uuid NOT NULL,
    "Code" character varying(50) NOT NULL,
    "Name" character varying(150) NOT NULL,
    "Type" integer NOT NULL,
    "Description" character varying(500),
    "IsActive" boolean NOT NULL,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_warehouses" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_warehouses_branches_BranchId" FOREIGN KEY ("BranchId") REFERENCES branches ("Id") ON DELETE RESTRICT
);

CREATE TABLE stock_reservation_items (
    "Id" uuid NOT NULL,
    "StockReservationId" uuid NOT NULL,
    "WarehouseId" uuid NOT NULL,
    "WarehouseLocationId" uuid,
    "ProductSkuId" uuid NOT NULL,
    "Quantity" numeric(18,4) NOT NULL,
    "InventoryUnitId" uuid,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_stock_reservation_items" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_stock_reservation_items_stock_reservations_StockReservation~" FOREIGN KEY ("StockReservationId") REFERENCES stock_reservations ("Id") ON DELETE CASCADE
);

CREATE TABLE stock_transfer_items (
    "Id" uuid NOT NULL,
    "StockTransferId" uuid NOT NULL,
    "ProductSkuId" uuid NOT NULL,
    "Quantity" numeric(18,4) NOT NULL,
    "InventoryUnitId" uuid,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_stock_transfer_items" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_stock_transfer_items_stock_transfers_StockTransferId" FOREIGN KEY ("StockTransferId") REFERENCES stock_transfers ("Id") ON DELETE CASCADE
);

CREATE TABLE inventory_counts (
    "Id" uuid NOT NULL,
    "CountNumber" character varying(50) NOT NULL,
    "BranchId" uuid NOT NULL,
    "WarehouseId" uuid NOT NULL,
    "Status" integer NOT NULL,
    "Description" character varying(250) NOT NULL,
    "PostedAtUtc" timestamp with time zone,
    "CreatedByUserId" uuid NOT NULL,
    "ApprovedByUserId" uuid,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_inventory_counts" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_inventory_counts_warehouses_WarehouseId" FOREIGN KEY ("WarehouseId") REFERENCES warehouses ("Id") ON DELETE RESTRICT
);

CREATE TABLE warehouse_locations (
    "Id" uuid NOT NULL,
    "WarehouseId" uuid NOT NULL,
    "Code" character varying(50) NOT NULL,
    "Aisle" character varying(20) NOT NULL,
    "Shelf" character varying(20) NOT NULL,
    "Bin" character varying(20) NOT NULL,
    "Description" character varying(200),
    "IsBlocked" boolean NOT NULL,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_warehouse_locations" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_warehouse_locations_warehouses_WarehouseId" FOREIGN KEY ("WarehouseId") REFERENCES warehouses ("Id") ON DELETE CASCADE
);

CREATE TABLE inventory_count_items (
    "Id" uuid NOT NULL,
    "InventoryCountId" uuid NOT NULL,
    "ProductSkuId" uuid NOT NULL,
    "InventoryUnitId" uuid,
    "SystemSnapshotQuantity" numeric(18,4) NOT NULL,
    "CountedQuantity" numeric(18,4) NOT NULL,
    "Notes" character varying(250),
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_inventory_count_items" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_inventory_count_items_inventory_counts_InventoryCountId" FOREIGN KEY ("InventoryCountId") REFERENCES inventory_counts ("Id") ON DELETE CASCADE
);

CREATE TABLE serial_stock_positions (
    "Id" uuid NOT NULL,
    "InventoryUnitId" uuid NOT NULL,
    "ProductSkuId" uuid NOT NULL,
    "BranchId" uuid NOT NULL,
    "WarehouseId" uuid NOT NULL,
    "WarehouseLocationId" uuid,
    "IsInStock" boolean NOT NULL,
    "IsReserved" boolean NOT NULL,
    "CurrentReservationId" uuid,
    "LastUpdatedAtUtc" timestamp with time zone NOT NULL,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_serial_stock_positions" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_serial_stock_positions_inventory_units_InventoryUnitId" FOREIGN KEY ("InventoryUnitId") REFERENCES inventory_units ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_serial_stock_positions_warehouse_locations_WarehouseLocatio~" FOREIGN KEY ("WarehouseLocationId") REFERENCES warehouse_locations ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_serial_stock_positions_warehouses_WarehouseId" FOREIGN KEY ("WarehouseId") REFERENCES warehouses ("Id") ON DELETE RESTRICT
);

CREATE TABLE stock_balances (
    "Id" uuid NOT NULL,
    "BranchId" uuid NOT NULL,
    "WarehouseId" uuid NOT NULL,
    "WarehouseLocationId" uuid,
    "ProductSkuId" uuid NOT NULL,
    "OnHandQuantity" numeric(18,4) NOT NULL,
    "ReservedQuantity" numeric(18,4) NOT NULL,
    "BlockedQuantity" numeric(18,4) NOT NULL,
    "AverageCost" numeric(18,4) NOT NULL,
    "LastMovementAtUtc" timestamp with time zone NOT NULL,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_stock_balances" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_stock_balances_product_skus_ProductSkuId" FOREIGN KEY ("ProductSkuId") REFERENCES product_skus ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_stock_balances_warehouse_locations_WarehouseLocationId" FOREIGN KEY ("WarehouseLocationId") REFERENCES warehouse_locations ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_stock_balances_warehouses_WarehouseId" FOREIGN KEY ("WarehouseId") REFERENCES warehouses ("Id") ON DELETE RESTRICT
);

CREATE TABLE stock_movements (
    "Id" uuid NOT NULL,
    "BranchId" uuid NOT NULL,
    "WarehouseId" uuid NOT NULL,
    "WarehouseLocationId" uuid,
    "ProductSkuId" uuid NOT NULL,
    "InventoryUnitId" uuid,
    "MovementType" integer NOT NULL,
    "Quantity" numeric(18,4) NOT NULL,
    "UnitCost" numeric(18,4) NOT NULL,
    "TotalCost" numeric(18,2) NOT NULL,
    "BalanceAfterQuantity" numeric(18,4) NOT NULL,
    "DocumentReference" character varying(100) NOT NULL,
    "Reason" character varying(250),
    "CorrelationId" uuid,
    "IdempotencyKey" character varying(100),
    "CreatedByUserId" uuid NOT NULL,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_stock_movements" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_stock_movements_inventory_units_InventoryUnitId" FOREIGN KEY ("InventoryUnitId") REFERENCES inventory_units ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_stock_movements_product_skus_ProductSkuId" FOREIGN KEY ("ProductSkuId") REFERENCES product_skus ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_stock_movements_warehouse_locations_WarehouseLocationId" FOREIGN KEY ("WarehouseLocationId") REFERENCES warehouse_locations ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_stock_movements_warehouses_WarehouseId" FOREIGN KEY ("WarehouseId") REFERENCES warehouses ("Id") ON DELETE RESTRICT
);

CREATE INDEX "IX_inventory_count_items_InventoryCountId" ON inventory_count_items ("InventoryCountId");

CREATE UNIQUE INDEX "IX_inventory_counts_TenantId_CountNumber" ON inventory_counts ("TenantId", "CountNumber");

CREATE INDEX "IX_inventory_counts_WarehouseId" ON inventory_counts ("WarehouseId");

CREATE INDEX "IX_inventory_unit_identifiers_InventoryUnitId" ON inventory_unit_identifiers ("InventoryUnitId");

CREATE UNIQUE INDEX "IX_inventory_unit_identifiers_TenantId_IdentifierType_Normaliz~" ON inventory_unit_identifiers ("TenantId", "IdentifierType", "NormalizedValue");

CREATE INDEX "IX_serial_stock_positions_InventoryUnitId" ON serial_stock_positions ("InventoryUnitId");

CREATE UNIQUE INDEX "IX_serial_stock_positions_TenantId_InventoryUnitId" ON serial_stock_positions ("TenantId", "InventoryUnitId");

CREATE INDEX "IX_serial_stock_positions_WarehouseId" ON serial_stock_positions ("WarehouseId");

CREATE INDEX "IX_serial_stock_positions_WarehouseLocationId" ON serial_stock_positions ("WarehouseLocationId");

CREATE INDEX "IX_stock_balances_ProductSkuId" ON stock_balances ("ProductSkuId");

CREATE UNIQUE INDEX "IX_stock_balances_TenantId_BranchId_WarehouseId_WarehouseLocat~" ON stock_balances ("TenantId", "BranchId", "WarehouseId", "WarehouseLocationId", "ProductSkuId");

CREATE INDEX "IX_stock_balances_WarehouseId" ON stock_balances ("WarehouseId");

CREATE INDEX "IX_stock_balances_WarehouseLocationId" ON stock_balances ("WarehouseLocationId");

CREATE INDEX "IX_stock_movements_InventoryUnitId" ON stock_movements ("InventoryUnitId");

CREATE INDEX "IX_stock_movements_ProductSkuId" ON stock_movements ("ProductSkuId");

CREATE INDEX "IX_stock_movements_TenantId_BranchId_CreatedAtUtc" ON stock_movements ("TenantId", "BranchId", "CreatedAtUtc");

CREATE UNIQUE INDEX "IX_stock_movements_TenantId_IdempotencyKey" ON stock_movements ("TenantId", "IdempotencyKey") WHERE "IdempotencyKey" IS NOT NULL;

CREATE INDEX "IX_stock_movements_TenantId_InventoryUnitId_CreatedAtUtc" ON stock_movements ("TenantId", "InventoryUnitId", "CreatedAtUtc");

CREATE INDEX "IX_stock_movements_TenantId_ProductSkuId_CreatedAtUtc" ON stock_movements ("TenantId", "ProductSkuId", "CreatedAtUtc");

CREATE INDEX "IX_stock_movements_WarehouseId" ON stock_movements ("WarehouseId");

CREATE INDEX "IX_stock_movements_WarehouseLocationId" ON stock_movements ("WarehouseLocationId");

CREATE INDEX "IX_stock_reservation_items_StockReservationId" ON stock_reservation_items ("StockReservationId");

CREATE UNIQUE INDEX "IX_stock_reservations_TenantId_IdempotencyKey" ON stock_reservations ("TenantId", "IdempotencyKey") WHERE "IdempotencyKey" IS NOT NULL;

CREATE UNIQUE INDEX "IX_stock_reservations_TenantId_ReservationNumber" ON stock_reservations ("TenantId", "ReservationNumber");

CREATE INDEX "IX_stock_transfer_items_StockTransferId" ON stock_transfer_items ("StockTransferId");

CREATE UNIQUE INDEX "IX_stock_transfers_TenantId_TransferNumber" ON stock_transfers ("TenantId", "TransferNumber");

CREATE UNIQUE INDEX "IX_warehouse_locations_TenantId_WarehouseId_Code" ON warehouse_locations ("TenantId", "WarehouseId", "Code");

CREATE INDEX "IX_warehouse_locations_WarehouseId" ON warehouse_locations ("WarehouseId");

CREATE INDEX "IX_warehouses_BranchId" ON warehouses ("BranchId");

CREATE UNIQUE INDEX "IX_warehouses_TenantId_BranchId_Code" ON warehouses ("TenantId", "BranchId", "Code");

INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261114045601_AddInventoryKardexAndStockModule', '10.0.0');

COMMIT;

START TRANSACTION;
CREATE TABLE goods_receipts (
    "Id" uuid NOT NULL,
    "BranchId" uuid NOT NULL,
    "WarehouseId" uuid NOT NULL,
    "WarehouseLocationId" uuid,
    "PurchaseOrderId" uuid,
    "SupplierPartyId" uuid NOT NULL,
    "ReceiptNumber" character varying(50) NOT NULL,
    "InvoiceOrDocumentNumber" character varying(100) NOT NULL,
    "Status" integer NOT NULL,
    "Notes" character varying(1000),
    "IdempotencyKey" character varying(100),
    "ReceivedByUserId" uuid NOT NULL,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_goods_receipts" PRIMARY KEY ("Id")
);

CREATE TABLE purchase_orders (
    "Id" uuid NOT NULL,
    "BranchId" uuid NOT NULL,
    "SupplierPartyId" uuid NOT NULL,
    "OrderNumber" character varying(50) NOT NULL,
    "Status" integer NOT NULL,
    "ExpectedDeliveryDateUtc" timestamp with time zone,
    "PaymentTerms" character varying(150),
    "ShippingCost" numeric(18,2) NOT NULL,
    "OtherExpenses" numeric(18,2) NOT NULL,
    "TotalDiscount" numeric(18,2) NOT NULL,
    "Notes" character varying(1000),
    "CreatedByUserId" uuid NOT NULL,
    "ApprovedByUserId" uuid,
    "ApprovedAtUtc" timestamp with time zone,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_purchase_orders" PRIMARY KEY ("Id")
);

CREATE TABLE purchase_requests (
    "Id" uuid NOT NULL,
    "BranchId" uuid NOT NULL,
    "RequestNumber" character varying(50) NOT NULL,
    "Status" integer NOT NULL,
    "Justification" character varying(500) NOT NULL,
    "RequiredDateUtc" timestamp with time zone NOT NULL,
    "RequestedByUserId" uuid NOT NULL,
    "ApprovedByUserId" uuid,
    "DecidedAtUtc" timestamp with time zone,
    "DecisionNotes" character varying(500),
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_purchase_requests" PRIMARY KEY ("Id")
);

CREATE TABLE supplier_quotations (
    "Id" uuid NOT NULL,
    "BranchId" uuid NOT NULL,
    "SupplierPartyId" uuid NOT NULL,
    "QuotationNumber" character varying(50) NOT NULL,
    "Status" integer NOT NULL,
    "ValidUntilUtc" timestamp with time zone NOT NULL,
    "LeadTimeDays" integer NOT NULL,
    "ShippingFee" numeric(18,2) NOT NULL,
    "PaymentTerms" character varying(150),
    "Notes" character varying(500),
    "CreatedByUserId" uuid NOT NULL,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_supplier_quotations" PRIMARY KEY ("Id")
);

CREATE TABLE supplier_returns (
    "Id" uuid NOT NULL,
    "BranchId" uuid NOT NULL,
    "WarehouseId" uuid NOT NULL,
    "SupplierPartyId" uuid NOT NULL,
    "GoodsReceiptId" uuid,
    "ReturnNumber" character varying(50) NOT NULL,
    "Reason" character varying(500) NOT NULL,
    "Status" integer NOT NULL,
    "ReturnInvoiceNumber" character varying(100),
    "CreatedByUserId" uuid NOT NULL,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_supplier_returns" PRIMARY KEY ("Id")
);

CREATE TABLE used_device_acquisitions (
    "Id" uuid NOT NULL,
    "BranchId" uuid NOT NULL,
    "SellerPartyId" uuid NOT NULL,
    "ProductSkuId" uuid NOT NULL,
    "InventoryUnitId" uuid,
    "AcquisitionNumber" character varying(50) NOT NULL,
    "SerialNumber" character varying(100) NOT NULL,
    "Imei1" character varying(20),
    "Imei2" character varying(20),
    "Condition" integer NOT NULL,
    "Grade" integer NOT NULL,
    "BatteryHealthPercentage" integer,
    "NegotiatedPrice" numeric(18,2) NOT NULL,
    "AttributableExpenses" numeric(18,2) NOT NULL,
    "ChecklistInspectionJson" jsonb NOT NULL,
    "Status" integer NOT NULL,
    "Notes" character varying(1000),
    "CreatedByUserId" uuid NOT NULL,
    "ApprovedByUserId" uuid,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_used_device_acquisitions" PRIMARY KEY ("Id")
);

CREATE TABLE goods_receipt_items (
    "Id" uuid NOT NULL,
    "GoodsReceiptId" uuid NOT NULL,
    "ProductSkuId" uuid NOT NULL,
    "QuantityReceived" numeric(18,4) NOT NULL,
    "RealUnitCost" numeric(18,2) NOT NULL,
    "InventoryUnitId" uuid,
    "SerialOrImei" character varying(100),
    "Notes" character varying(300),
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_goods_receipt_items" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_goods_receipt_items_goods_receipts_GoodsReceiptId" FOREIGN KEY ("GoodsReceiptId") REFERENCES goods_receipts ("Id") ON DELETE CASCADE
);

CREATE TABLE purchase_order_items (
    "Id" uuid NOT NULL,
    "PurchaseOrderId" uuid NOT NULL,
    "ProductSkuId" uuid NOT NULL,
    "HistoricalSkuCode" character varying(100) NOT NULL,
    "HistoricalDescription" character varying(300) NOT NULL,
    "QuantityOrdered" numeric(18,4) NOT NULL,
    "QuantityReceived" numeric(18,4) NOT NULL,
    "UnitCost" numeric(18,2) NOT NULL,
    "Discount" numeric(18,2) NOT NULL,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_purchase_order_items" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_purchase_order_items_purchase_orders_PurchaseOrderId" FOREIGN KEY ("PurchaseOrderId") REFERENCES purchase_orders ("Id") ON DELETE CASCADE
);

CREATE TABLE purchase_request_items (
    "Id" uuid NOT NULL,
    "PurchaseRequestId" uuid NOT NULL,
    "ProductSkuId" uuid NOT NULL,
    "Quantity" numeric(18,4) NOT NULL,
    "EstimatedUnitCost" numeric(18,2) NOT NULL,
    "Notes" character varying(250),
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_purchase_request_items" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_purchase_request_items_purchase_requests_PurchaseRequestId" FOREIGN KEY ("PurchaseRequestId") REFERENCES purchase_requests ("Id") ON DELETE CASCADE
);

CREATE TABLE supplier_quotation_items (
    "Id" uuid NOT NULL,
    "SupplierQuotationId" uuid NOT NULL,
    "ProductSkuId" uuid NOT NULL,
    "Quantity" numeric(18,4) NOT NULL,
    "UnitPrice" numeric(18,2) NOT NULL,
    "DiscountAmount" numeric(18,2) NOT NULL,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_supplier_quotation_items" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_supplier_quotation_items_supplier_quotations_SupplierQuotat~" FOREIGN KEY ("SupplierQuotationId") REFERENCES supplier_quotations ("Id") ON DELETE CASCADE
);

CREATE TABLE supplier_return_items (
    "Id" uuid NOT NULL,
    "SupplierReturnId" uuid NOT NULL,
    "ProductSkuId" uuid NOT NULL,
    "Quantity" numeric(18,4) NOT NULL,
    "UnitCost" numeric(18,2) NOT NULL,
    "InventoryUnitId" uuid,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_supplier_return_items" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_supplier_return_items_supplier_returns_SupplierReturnId" FOREIGN KEY ("SupplierReturnId") REFERENCES supplier_returns ("Id") ON DELETE CASCADE
);

CREATE INDEX "IX_goods_receipt_items_GoodsReceiptId" ON goods_receipt_items ("GoodsReceiptId");

CREATE UNIQUE INDEX "IX_goods_receipts_TenantId_IdempotencyKey" ON goods_receipts ("TenantId", "IdempotencyKey") WHERE "IdempotencyKey" IS NOT NULL;

CREATE INDEX "IX_goods_receipts_TenantId_PurchaseOrderId" ON goods_receipts ("TenantId", "PurchaseOrderId");

CREATE UNIQUE INDEX "IX_goods_receipts_TenantId_ReceiptNumber" ON goods_receipts ("TenantId", "ReceiptNumber");

CREATE INDEX "IX_goods_receipts_TenantId_WarehouseId" ON goods_receipts ("TenantId", "WarehouseId");

CREATE INDEX "IX_purchase_order_items_PurchaseOrderId" ON purchase_order_items ("PurchaseOrderId");

CREATE INDEX "IX_purchase_orders_TenantId_BranchId_Status" ON purchase_orders ("TenantId", "BranchId", "Status");

CREATE UNIQUE INDEX "IX_purchase_orders_TenantId_OrderNumber" ON purchase_orders ("TenantId", "OrderNumber");

CREATE INDEX "IX_purchase_orders_TenantId_SupplierPartyId" ON purchase_orders ("TenantId", "SupplierPartyId");

CREATE INDEX "IX_purchase_request_items_PurchaseRequestId" ON purchase_request_items ("PurchaseRequestId");

CREATE INDEX "IX_purchase_requests_TenantId_BranchId_Status" ON purchase_requests ("TenantId", "BranchId", "Status");

CREATE UNIQUE INDEX "IX_purchase_requests_TenantId_RequestNumber" ON purchase_requests ("TenantId", "RequestNumber");

CREATE INDEX "IX_supplier_quotation_items_SupplierQuotationId" ON supplier_quotation_items ("SupplierQuotationId");

CREATE UNIQUE INDEX "IX_supplier_quotations_TenantId_QuotationNumber" ON supplier_quotations ("TenantId", "QuotationNumber");

CREATE INDEX "IX_supplier_quotations_TenantId_SupplierPartyId_Status" ON supplier_quotations ("TenantId", "SupplierPartyId", "Status");

CREATE INDEX "IX_supplier_return_items_SupplierReturnId" ON supplier_return_items ("SupplierReturnId");

CREATE INDEX "IX_supplier_returns_TenantId_GoodsReceiptId" ON supplier_returns ("TenantId", "GoodsReceiptId");

CREATE UNIQUE INDEX "IX_supplier_returns_TenantId_ReturnNumber" ON supplier_returns ("TenantId", "ReturnNumber");

CREATE INDEX "IX_supplier_returns_TenantId_SupplierPartyId" ON supplier_returns ("TenantId", "SupplierPartyId");

CREATE UNIQUE INDEX "IX_used_device_acquisitions_TenantId_AcquisitionNumber" ON used_device_acquisitions ("TenantId", "AcquisitionNumber");

CREATE INDEX "IX_used_device_acquisitions_TenantId_BranchId_Status" ON used_device_acquisitions ("TenantId", "BranchId", "Status");

CREATE INDEX "IX_used_device_acquisitions_TenantId_Imei1" ON used_device_acquisitions ("TenantId", "Imei1");

CREATE INDEX "IX_used_device_acquisitions_TenantId_SellerPartyId" ON used_device_acquisitions ("TenantId", "SellerPartyId");

CREATE INDEX "IX_used_device_acquisitions_TenantId_SerialNumber" ON used_device_acquisitions ("TenantId", "SerialNumber");

INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261114052355_AddProcurementModule', '10.0.0');

COMMIT;

START TRANSACTION;
CREATE TABLE sale_returns (
    "Id" uuid NOT NULL,
    "BranchId" uuid NOT NULL,
    "SaleId" uuid NOT NULL,
    "ReturnNumber" character varying(50) NOT NULL,
    "Reason" character varying(500) NOT NULL,
    "Status" integer NOT NULL,
    "CreatedByUserId" uuid NOT NULL,
    "InspectionNotes" character varying(500),
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_sale_returns" PRIMARY KEY ("Id")
);

CREATE TABLE sales (
    "Id" uuid NOT NULL,
    "BranchId" uuid NOT NULL,
    "SaleNumber" character varying(50) NOT NULL,
    "CustomerPartyId" uuid,
    "SellerUserId" uuid NOT NULL,
    "CreatedByUserId" uuid NOT NULL,
    "QuoteId" uuid,
    "StockReservationId" uuid,
    "Status" integer NOT NULL,
    "PaymentStatus" integer NOT NULL,
    "FulfillmentStatus" integer NOT NULL,
    "DiscountTotal" numeric(18,2) NOT NULL,
    "ChargesTotal" numeric(18,2) NOT NULL,
    "Observations" character varying(1000),
    "IdempotencyKey" character varying(100),
    "ConfirmedAtUtc" timestamp with time zone,
    "FulfilledAtUtc" timestamp with time zone,
    "CancelledAtUtc" timestamp with time zone,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_sales" PRIMARY KEY ("Id")
);

CREATE TABLE sales_quotes (
    "Id" uuid NOT NULL,
    "BranchId" uuid NOT NULL,
    "QuoteNumber" character varying(50) NOT NULL,
    "CustomerPartyId" uuid,
    "SellerUserId" uuid NOT NULL,
    "Status" integer NOT NULL,
    "ValidUntilUtc" timestamp with time zone NOT NULL,
    "PaymentTermsExpected" character varying(150),
    "Notes" character varying(1000),
    "ConvertedSaleId" uuid,
    "DiscountTotal" numeric(18,2) NOT NULL,
    "ShippingTotal" numeric(18,2) NOT NULL,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_sales_quotes" PRIMARY KEY ("Id")
);

CREATE TABLE sale_return_items (
    "Id" uuid NOT NULL,
    "SaleReturnId" uuid NOT NULL,
    "SaleItemId" uuid NOT NULL,
    "ProductSkuId" uuid NOT NULL,
    "Quantity" numeric(18,4) NOT NULL,
    "RefundAmount" numeric(18,2) NOT NULL,
    "InventoryUnitId" uuid,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_sale_return_items" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_sale_return_items_sale_returns_SaleReturnId" FOREIGN KEY ("SaleReturnId") REFERENCES sale_returns ("Id") ON DELETE CASCADE
);

CREATE TABLE sale_items (
    "Id" uuid NOT NULL,
    "SaleId" uuid NOT NULL,
    "ProductSkuId" uuid NOT NULL,
    "HistoricalSkuCode" character varying(100) NOT NULL,
    "HistoricalDescription" character varying(300) NOT NULL,
    "ItemCondition" integer NOT NULL,
    "Quantity" numeric(18,4) NOT NULL,
    "UnitPrice" numeric(18,2) NOT NULL,
    "Discount" numeric(18,2) NOT NULL,
    "HistoricalUnitCost" numeric(18,2) NOT NULL,
    "InventoryUnitId" uuid,
    "SerialOrImei" character varying(100),
    "WarrantyDays" integer NOT NULL,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_sale_items" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_sale_items_sales_SaleId" FOREIGN KEY ("SaleId") REFERENCES sales ("Id") ON DELETE CASCADE
);

CREATE TABLE sale_payment_intents (
    "Id" uuid NOT NULL,
    "SaleId" uuid NOT NULL,
    "Method" integer NOT NULL,
    "Amount" numeric(18,2) NOT NULL,
    "Installments" integer NOT NULL,
    "Status" integer NOT NULL,
    "AuthorizationCode" character varying(100),
    "TransactionReference" character varying(200),
    "Notes" character varying(500),
    "ConfirmedAtUtc" timestamp with time zone,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_sale_payment_intents" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_sale_payment_intents_sales_SaleId" FOREIGN KEY ("SaleId") REFERENCES sales ("Id") ON DELETE CASCADE
);

CREATE TABLE sales_quote_items (
    "Id" uuid NOT NULL,
    "SalesQuoteId" uuid NOT NULL,
    "ProductSkuId" uuid NOT NULL,
    "HistoricalSkuCode" character varying(100) NOT NULL,
    "HistoricalDescription" character varying(300) NOT NULL,
    "Quantity" numeric(18,4) NOT NULL,
    "UnitPrice" numeric(18,2) NOT NULL,
    "Discount" numeric(18,2) NOT NULL,
    "InventoryUnitId" uuid,
    "SerialOrImei" character varying(100),
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_sales_quote_items" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_sales_quote_items_sales_quotes_SalesQuoteId" FOREIGN KEY ("SalesQuoteId") REFERENCES sales_quotes ("Id") ON DELETE CASCADE
);

CREATE INDEX "IX_sale_items_SaleId" ON sale_items ("SaleId");

CREATE INDEX "IX_sale_payment_intents_SaleId" ON sale_payment_intents ("SaleId");

CREATE INDEX "IX_sale_return_items_SaleReturnId" ON sale_return_items ("SaleReturnId");

CREATE UNIQUE INDEX "IX_sale_returns_TenantId_ReturnNumber" ON sale_returns ("TenantId", "ReturnNumber");

CREATE INDEX "IX_sale_returns_TenantId_SaleId" ON sale_returns ("TenantId", "SaleId");

CREATE INDEX "IX_sales_TenantId_BranchId_Status" ON sales ("TenantId", "BranchId", "Status");

CREATE INDEX "IX_sales_TenantId_CustomerPartyId" ON sales ("TenantId", "CustomerPartyId");

CREATE UNIQUE INDEX "IX_sales_TenantId_IdempotencyKey" ON sales ("TenantId", "IdempotencyKey") WHERE "IdempotencyKey" IS NOT NULL;

CREATE UNIQUE INDEX "IX_sales_TenantId_SaleNumber" ON sales ("TenantId", "SaleNumber");

CREATE INDEX "IX_sales_TenantId_SellerUserId" ON sales ("TenantId", "SellerUserId");

CREATE INDEX "IX_sales_quote_items_SalesQuoteId" ON sales_quote_items ("SalesQuoteId");

CREATE INDEX "IX_sales_quotes_TenantId_BranchId_Status" ON sales_quotes ("TenantId", "BranchId", "Status");

CREATE INDEX "IX_sales_quotes_TenantId_CustomerPartyId" ON sales_quotes ("TenantId", "CustomerPartyId");

CREATE UNIQUE INDEX "IX_sales_quotes_TenantId_QuoteNumber" ON sales_quotes ("TenantId", "QuoteNumber");

INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261114131904_AddSalesModule', '10.0.0');

COMMIT;

START TRANSACTION;
CREATE TABLE cash_discrepancies (
    "Id" uuid NOT NULL,
    "BranchId" uuid NOT NULL,
    "CashShiftId" uuid NOT NULL,
    "DiscrepancyType" integer NOT NULL,
    "Amount" numeric(18,2) NOT NULL,
    "Status" integer NOT NULL,
    "OperatorJustification" character varying(1000),
    "JustifiedByUserId" uuid,
    "JustifiedAtUtc" timestamp with time zone,
    "ResolutionNotes" character varying(1000),
    "ResolvedByUserId" uuid,
    "ResolvedAtUtc" timestamp with time zone,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_cash_discrepancies" PRIMARY KEY ("Id")
);

CREATE TABLE cash_registers (
    "Id" uuid NOT NULL,
    "BranchId" uuid NOT NULL,
    "Code" character varying(50) NOT NULL,
    "Name" character varying(150) NOT NULL,
    "Status" integer NOT NULL,
    "Notes" character varying(500),
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_cash_registers" PRIMARY KEY ("Id")
);

CREATE TABLE cash_shifts (
    "Id" uuid NOT NULL,
    "BranchId" uuid NOT NULL,
    "CashRegisterId" uuid NOT NULL,
    "OperatorUserId" uuid NOT NULL,
    "OpenedByUserId" uuid NOT NULL,
    "OpenedAtUtc" timestamp with time zone NOT NULL,
    "OpeningFloat" numeric(18,2) NOT NULL,
    "OpeningSource" character varying(150),
    "OpeningNotes" character varying(500),
    "Status" integer NOT NULL,
    "CurrentBalance" numeric(18,2) NOT NULL,
    "TotalCashIn" numeric(18,2) NOT NULL,
    "TotalCashOut" numeric(18,2) NOT NULL,
    "ClosingStartedAtUtc" timestamp with time zone,
    "ClosedAtUtc" timestamp with time zone,
    "ClosedByUserId" uuid,
    "ApprovedByUserId" uuid,
    "ClosingNotes" character varying(500),
    "ExpectedCashBalance" numeric(18,2),
    "CountedCashBalance" numeric(18,2),
    "DiscrepancyAmount" numeric(18,2),
    "DiscrepancyType" integer,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_cash_shifts" PRIMARY KEY ("Id")
);

CREATE TABLE cash_count_denominations (
    "Id" uuid NOT NULL,
    "CashShiftId" uuid NOT NULL,
    "Denomination" numeric(18,2) NOT NULL,
    "Quantity" integer NOT NULL,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_cash_count_denominations" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_cash_count_denominations_cash_shifts_CashShiftId" FOREIGN KEY ("CashShiftId") REFERENCES cash_shifts ("Id") ON DELETE CASCADE
);

CREATE TABLE cash_movements (
    "Id" uuid NOT NULL,
    "BranchId" uuid NOT NULL,
    "CashRegisterId" uuid NOT NULL,
    "CashShiftId" uuid NOT NULL,
    "MovementType" integer NOT NULL,
    "Direction" integer NOT NULL,
    "Amount" numeric(18,2) NOT NULL,
    "SourceType" character varying(50) NOT NULL,
    "SourceId" character varying(100) NOT NULL,
    "DocumentReference" character varying(100) NOT NULL,
    "Reason" character varying(500),
    "CreatedByUserId" uuid NOT NULL,
    "CorrelationId" character varying(100),
    "IdempotencyKey" character varying(100),
    "ReversalOfMovementId" uuid,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_cash_movements" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_cash_movements_cash_shifts_CashShiftId" FOREIGN KEY ("CashShiftId") REFERENCES cash_shifts ("Id") ON DELETE CASCADE
);

CREATE INDEX "IX_cash_count_denominations_CashShiftId" ON cash_count_denominations ("CashShiftId");

CREATE INDEX "IX_cash_count_denominations_TenantId_CashShiftId" ON cash_count_denominations ("TenantId", "CashShiftId");

CREATE INDEX "IX_cash_discrepancies_TenantId_BranchId_CashShiftId" ON cash_discrepancies ("TenantId", "BranchId", "CashShiftId");

CREATE INDEX "IX_cash_discrepancies_TenantId_Status" ON cash_discrepancies ("TenantId", "Status");

CREATE INDEX "IX_cash_movements_CashShiftId" ON cash_movements ("CashShiftId");

CREATE INDEX "IX_cash_movements_TenantId_CashShiftId" ON cash_movements ("TenantId", "CashShiftId");

CREATE INDEX "IX_cash_movements_TenantId_IdempotencyKey" ON cash_movements ("TenantId", "IdempotencyKey");

CREATE INDEX "IX_cash_movements_TenantId_MovementType_SourceId" ON cash_movements ("TenantId", "MovementType", "SourceId");

CREATE UNIQUE INDEX "IX_cash_registers_TenantId_BranchId_Code" ON cash_registers ("TenantId", "BranchId", "Code");

CREATE INDEX "IX_cash_shifts_TenantId_BranchId_CashRegisterId_Status" ON cash_shifts ("TenantId", "BranchId", "CashRegisterId", "Status");

INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261114151541_AddCashManagementModule', '10.0.0');

COMMIT;

START TRANSACTION;
CREATE TABLE accounts_payable (
    "Id" uuid NOT NULL,
    "BranchId" uuid NOT NULL,
    "SupplierPartyId" uuid,
    "TitleNumber" character varying(100) NOT NULL,
    "Description" character varying(500) NOT NULL,
    "FinancialCostCenterId" uuid,
    "IssueDateUtc" timestamp with time zone NOT NULL,
    "DueDateUtc" timestamp with time zone NOT NULL,
    "OriginalAmount" numeric(18,2) NOT NULL,
    "PaidAmount" numeric(18,2) NOT NULL,
    "Status" integer NOT NULL,
    "DocumentReference" character varying(100),
    "PurchaseOrderId" uuid,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_accounts_payable" PRIMARY KEY ("Id")
);

CREATE TABLE accounts_receivable (
    "Id" uuid NOT NULL,
    "BranchId" uuid NOT NULL,
    "CustomerPartyId" uuid,
    "TitleNumber" character varying(100) NOT NULL,
    "Description" character varying(500) NOT NULL,
    "FinancialCostCenterId" uuid,
    "IssueDateUtc" timestamp with time zone NOT NULL,
    "DueDateUtc" timestamp with time zone NOT NULL,
    "OriginalAmount" numeric(18,2) NOT NULL,
    "ReceivedAmount" numeric(18,2) NOT NULL,
    "Status" integer NOT NULL,
    "DocumentReference" character varying(100),
    "SaleId" uuid,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_accounts_receivable" PRIMARY KEY ("Id")
);

CREATE TABLE bank_accounts (
    "Id" uuid NOT NULL,
    "BranchId" uuid NOT NULL,
    "BankName" character varying(150) NOT NULL,
    "AgencyNumber" character varying(50),
    "AccountNumber" character varying(50) NOT NULL,
    "Type" integer NOT NULL,
    "CurrentBalance" numeric(18,2) NOT NULL,
    "ReconciledBalance" numeric(18,2) NOT NULL,
    "IsActive" boolean NOT NULL,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_bank_accounts" PRIMARY KEY ("Id")
);

CREATE TABLE bank_transactions (
    "Id" uuid NOT NULL,
    "BankAccountId" uuid NOT NULL,
    "TransactionDateUtc" timestamp with time zone NOT NULL,
    "Amount" numeric(18,2) NOT NULL,
    "FitId" character varying(100) NOT NULL,
    "Memo" character varying(500) NOT NULL,
    "Status" integer NOT NULL,
    "MatchedJournalEntryId" uuid,
    "ReconciledAtUtc" timestamp with time zone,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_bank_transactions" PRIMARY KEY ("Id")
);

CREATE TABLE financial_accounts (
    "Id" uuid NOT NULL,
    "Code" character varying(50) NOT NULL,
    "Name" character varying(150) NOT NULL,
    "Type" integer NOT NULL,
    "ParentAccountId" uuid,
    "IsActive" boolean NOT NULL,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_financial_accounts" PRIMARY KEY ("Id")
);

CREATE TABLE financial_cost_centers (
    "Id" uuid NOT NULL,
    "Code" character varying(50) NOT NULL,
    "Name" character varying(150) NOT NULL,
    "Description" character varying(500),
    "IsActive" boolean NOT NULL,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_financial_cost_centers" PRIMARY KEY ("Id")
);

CREATE TABLE financial_journal_entries (
    "Id" uuid NOT NULL,
    "BranchId" uuid NOT NULL,
    "CompetenceDateUtc" timestamp with time zone NOT NULL,
    "DocumentNumber" character varying(100) NOT NULL,
    "SourceType" character varying(50) NOT NULL,
    "SourceId" character varying(100) NOT NULL,
    "Description" character varying(500) NOT NULL,
    "TotalAmount" numeric(18,2) NOT NULL,
    "CreatedByUserId" uuid NOT NULL,
    "CorrelationId" character varying(100),
    "IdempotencyKey" character varying(100),
    "ReversalOfEntryId" uuid,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_financial_journal_entries" PRIMARY KEY ("Id")
);

CREATE TABLE financial_settlements (
    "Id" uuid NOT NULL,
    "BranchId" uuid NOT NULL,
    "Type" integer NOT NULL,
    "TitleId" uuid NOT NULL,
    "BankAccountId" uuid NOT NULL,
    "Amount" numeric(18,2) NOT NULL,
    "SettlementDateUtc" timestamp with time zone NOT NULL,
    "ReferenceNumber" character varying(100) NOT NULL,
    "SettledByUserId" uuid NOT NULL,
    "AccountPayableId" uuid,
    "AccountReceivableId" uuid,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_financial_settlements" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_financial_settlements_accounts_payable_AccountPayableId" FOREIGN KEY ("AccountPayableId") REFERENCES accounts_payable ("Id"),
    CONSTRAINT "FK_financial_settlements_accounts_receivable_AccountReceivable~" FOREIGN KEY ("AccountReceivableId") REFERENCES accounts_receivable ("Id")
);

CREATE TABLE financial_journal_lines (
    "Id" uuid NOT NULL,
    "FinancialJournalEntryId" uuid NOT NULL,
    "FinancialAccountId" uuid NOT NULL,
    "Direction" integer NOT NULL,
    "Amount" numeric(18,2) NOT NULL,
    "FinancialCostCenterId" uuid,
    "Memo" character varying(500),
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_financial_journal_lines" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_financial_journal_lines_financial_journal_entries_Financial~" FOREIGN KEY ("FinancialJournalEntryId") REFERENCES financial_journal_entries ("Id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "IX_accounts_payable_TenantId_BranchId_TitleNumber" ON accounts_payable ("TenantId", "BranchId", "TitleNumber");

CREATE INDEX "IX_accounts_payable_TenantId_Status_DueDateUtc" ON accounts_payable ("TenantId", "Status", "DueDateUtc");

CREATE UNIQUE INDEX "IX_accounts_receivable_TenantId_BranchId_TitleNumber" ON accounts_receivable ("TenantId", "BranchId", "TitleNumber");

CREATE INDEX "IX_accounts_receivable_TenantId_Status_DueDateUtc" ON accounts_receivable ("TenantId", "Status", "DueDateUtc");

CREATE INDEX "IX_bank_accounts_TenantId_BranchId_AccountNumber" ON bank_accounts ("TenantId", "BranchId", "AccountNumber");

CREATE UNIQUE INDEX "IX_bank_transactions_TenantId_BankAccountId_FitId" ON bank_transactions ("TenantId", "BankAccountId", "FitId");

CREATE INDEX "IX_bank_transactions_TenantId_Status" ON bank_transactions ("TenantId", "Status");

CREATE UNIQUE INDEX "IX_financial_accounts_TenantId_Code" ON financial_accounts ("TenantId", "Code");

CREATE UNIQUE INDEX "IX_financial_cost_centers_TenantId_Code" ON financial_cost_centers ("TenantId", "Code");

CREATE INDEX "IX_financial_journal_entries_TenantId_BranchId_CompetenceDateU~" ON financial_journal_entries ("TenantId", "BranchId", "CompetenceDateUtc");

CREATE INDEX "IX_financial_journal_entries_TenantId_IdempotencyKey" ON financial_journal_entries ("TenantId", "IdempotencyKey");

CREATE INDEX "IX_financial_journal_lines_FinancialJournalEntryId" ON financial_journal_lines ("FinancialJournalEntryId");

CREATE INDEX "IX_financial_journal_lines_TenantId_FinancialAccountId" ON financial_journal_lines ("TenantId", "FinancialAccountId");

CREATE INDEX "IX_financial_journal_lines_TenantId_FinancialJournalEntryId" ON financial_journal_lines ("TenantId", "FinancialJournalEntryId");

CREATE INDEX "IX_financial_settlements_AccountPayableId" ON financial_settlements ("AccountPayableId");

CREATE INDEX "IX_financial_settlements_AccountReceivableId" ON financial_settlements ("AccountReceivableId");

CREATE INDEX "IX_financial_settlements_TenantId_TitleId" ON financial_settlements ("TenantId", "TitleId");

INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261114153730_AddFinancialModule', '10.0.0');

COMMIT;

START TRANSACTION;
CREATE TABLE capital_contributions (
    "Id" uuid NOT NULL,
    "PartnerId" uuid NOT NULL,
    "Type" integer NOT NULL,
    "Status" integer NOT NULL,
    "Amount" numeric(18,2) NOT NULL,
    "SubscriptionDate" timestamp with time zone NOT NULL,
    "PaidInDate" timestamp with time zone,
    "BankAccountId" uuid,
    "FinancialJournalEntryId" uuid,
    "Description" character varying(500) NOT NULL,
    "FormalInstrumentReference" character varying(150) NOT NULL,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_capital_contributions" PRIMARY KEY ("Id")
);

CREATE TABLE equity_participations (
    "Id" uuid NOT NULL,
    "PartnerId" uuid NOT NULL,
    "Quotas" numeric(18,4) NOT NULL,
    "Percentage" numeric(7,4) NOT NULL,
    "NominalValuePerQuota" numeric(18,4) NOT NULL,
    "EffectiveDate" timestamp with time zone NOT NULL,
    "ExpirationDate" timestamp with time zone,
    "IsCurrent" boolean NOT NULL,
    "LegalDocumentReference" character varying(150) NOT NULL,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_equity_participations" PRIMARY KEY ("Id")
);

CREATE TABLE partner_compensations (
    "Id" uuid NOT NULL,
    "PartnerId" uuid NOT NULL,
    "ReferenceYear" integer NOT NULL,
    "ReferenceMonth" integer NOT NULL,
    "GrossAmount" numeric(18,2) NOT NULL,
    "InssWithholding" numeric(18,2) NOT NULL,
    "IrrfWithholding" numeric(18,2) NOT NULL,
    "Status" integer NOT NULL,
    "ScheduledPaymentDate" timestamp with time zone NOT NULL,
    "PaidDate" timestamp with time zone,
    "AccountPayableId" uuid,
    "BankAccountId" uuid,
    "Notes" text NOT NULL,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_partner_compensations" PRIMARY KEY ("Id")
);

CREATE TABLE partner_loans (
    "Id" uuid NOT NULL,
    "PartnerId" uuid NOT NULL,
    "Direction" integer NOT NULL,
    "Status" integer NOT NULL,
    "PrincipalAmount" numeric(18,2) NOT NULL,
    "AmortizedAmount" numeric(18,2) NOT NULL,
    "AnnualInterestRate" numeric(7,4) NOT NULL,
    "IssueDate" timestamp with time zone NOT NULL,
    "DueDate" timestamp with time zone NOT NULL,
    "ContractNumber" character varying(100) NOT NULL,
    "Notes" text NOT NULL,
    "BankAccountId" uuid,
    "DisbursementJournalEntryId" uuid,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_partner_loans" PRIMARY KEY ("Id")
);

CREATE TABLE partners (
    "Id" uuid NOT NULL,
    "PartyId" uuid NOT NULL,
    "Name" character varying(200) NOT NULL,
    "DocumentNumber" character varying(20) NOT NULL,
    "Email" character varying(255) NOT NULL,
    "Type" integer NOT NULL,
    "Status" integer NOT NULL,
    "AdmissionDate" timestamp with time zone NOT NULL,
    "ExitDate" timestamp with time zone,
    "MonthlyCompensationCap" numeric(18,2) NOT NULL,
    "Notes" text,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_partners" PRIMARY KEY ("Id")
);

CREATE TABLE profit_distribution_proposals (
    "Id" uuid NOT NULL,
    "ProtocolNumber" character varying(100) NOT NULL,
    "FiscalYear" integer NOT NULL,
    "FiscalQuarter" integer,
    "BaseNetProfit" numeric(18,2) NOT NULL,
    "LegalReserveRetention" numeric(18,2) NOT NULL,
    "WorkingCapitalRetention" numeric(18,2) NOT NULL,
    "TotalDistributedAmount" numeric(18,2) NOT NULL,
    "Status" integer NOT NULL,
    "DeliberationDate" timestamp with time zone NOT NULL,
    "MeetingMinutesReference" character varying(200) NOT NULL,
    "Notes" text NOT NULL,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_profit_distribution_proposals" PRIMARY KEY ("Id")
);

CREATE TABLE profit_distribution_items (
    "Id" uuid NOT NULL,
    "ProposalId" uuid NOT NULL,
    "PartnerId" uuid NOT NULL,
    "PartnerPercentage" numeric(7,4) NOT NULL,
    "GrossAmount" numeric(18,2) NOT NULL,
    "TaxWithheld" numeric(18,2) NOT NULL,
    "IsPaid" boolean NOT NULL,
    "PaidDate" timestamp with time zone,
    "BankAccountId" uuid,
    "JournalEntryId" uuid,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_profit_distribution_items" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_profit_distribution_items_profit_distribution_proposals_Pro~" FOREIGN KEY ("ProposalId") REFERENCES profit_distribution_proposals ("Id") ON DELETE CASCADE
);

CREATE INDEX "IX_capital_contributions_TenantId_PartnerId" ON capital_contributions ("TenantId", "PartnerId");

CREATE INDEX "IX_capital_contributions_TenantId_Status" ON capital_contributions ("TenantId", "Status");

CREATE INDEX "IX_equity_participations_TenantId_PartnerId_IsCurrent" ON equity_participations ("TenantId", "PartnerId", "IsCurrent");

CREATE INDEX "IX_partner_compensations_TenantId_PartnerId_ReferenceYear_Refe~" ON partner_compensations ("TenantId", "PartnerId", "ReferenceYear", "ReferenceMonth");

CREATE INDEX "IX_partner_loans_TenantId_ContractNumber" ON partner_loans ("TenantId", "ContractNumber");

CREATE INDEX "IX_partner_loans_TenantId_PartnerId" ON partner_loans ("TenantId", "PartnerId");

CREATE INDEX "IX_partners_TenantId_DocumentNumber" ON partners ("TenantId", "DocumentNumber");

CREATE UNIQUE INDEX "IX_partners_TenantId_PartyId" ON partners ("TenantId", "PartyId");

CREATE INDEX "IX_profit_distribution_items_ProposalId" ON profit_distribution_items ("ProposalId");

CREATE INDEX "IX_profit_distribution_items_TenantId_ProposalId_PartnerId" ON profit_distribution_items ("TenantId", "ProposalId", "PartnerId");

CREATE INDEX "IX_profit_distribution_proposals_TenantId_FiscalYear" ON profit_distribution_proposals ("TenantId", "FiscalYear");

CREATE UNIQUE INDEX "IX_profit_distribution_proposals_TenantId_ProtocolNumber" ON profit_distribution_proposals ("TenantId", "ProtocolNumber");

INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261114165031_AddPartnersCapitalModule', '10.0.0');

COMMIT;

START TRANSACTION;
CREATE TABLE repair_orders (
    "Id" uuid NOT NULL,
    "BranchId" uuid NOT NULL,
    "OrderNumber" character varying(50) NOT NULL,
    "CustomerId" uuid NOT NULL,
    "CustomerEquipmentId" uuid NOT NULL,
    "AssignedTechnicianId" uuid,
    "Status" integer NOT NULL,
    "ReportedDefect" character varying(1000) NOT NULL,
    "PhysicalConditionNotes" character varying(2000),
    "AccessoriesIncluded" character varying(1000),
    "DiagnosticNotes" character varying(4000),
    "ResolutionNotes" character varying(4000),
    "ReceivedAtUtc" timestamp with time zone NOT NULL,
    "EstimatedCompletionUtc" timestamp with time zone,
    "DiagnosisCompletedAtUtc" timestamp with time zone,
    "RepairedAtUtc" timestamp with time zone,
    "QualityCheckedAtUtc" timestamp with time zone,
    "DeliveredAtUtc" timestamp with time zone,
    "OriginalRepairOrderId" uuid,
    "LegalWarrantyDays" integer NOT NULL,
    "AdditionalWarrantyDays" integer NOT NULL,
    "WarrantyExpiresAtUtc" timestamp with time zone,
    "DeliveredToPersonName" character varying(200),
    "DeliveredToDocumentNumber" character varying(50),
    "DeliveryNotes" character varying(2000),
    "StockReservationId" uuid,
    "TotalLaborPrice" numeric(18,2) NOT NULL,
    "TotalPartsPrice" numeric(18,2) NOT NULL,
    "TotalDiscount" numeric(18,2) NOT NULL,
    "FinalPrice" numeric(18,2) NOT NULL,
    "TotalPartsCost" numeric(18,2) NOT NULL,
    "TotalLaborCost" numeric(18,2) NOT NULL,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_repair_orders" PRIMARY KEY ("Id")
);

CREATE TABLE repair_checklist_items (
    "Id" uuid NOT NULL,
    "RepairOrderId" uuid NOT NULL,
    "Category" character varying(100) NOT NULL,
    "ItemName" character varying(150) NOT NULL,
    "Status" integer NOT NULL,
    "Notes" character varying(500),
    "IsOutputCheck" boolean NOT NULL,
    "CheckedAtUtc" timestamp with time zone NOT NULL,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_repair_checklist_items" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_repair_checklist_items_repair_orders_RepairOrderId" FOREIGN KEY ("RepairOrderId") REFERENCES repair_orders ("Id") ON DELETE CASCADE
);

CREATE TABLE repair_estimate_items (
    "Id" uuid NOT NULL,
    "RepairOrderId" uuid NOT NULL,
    "ItemType" integer NOT NULL,
    "Description" character varying(250) NOT NULL,
    "Quantity" numeric(18,4) NOT NULL,
    "UnitPrice" numeric(18,2) NOT NULL,
    "UnitCost" numeric(18,2) NOT NULL,
    "ProductSkuId" uuid,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_repair_estimate_items" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_repair_estimate_items_repair_orders_RepairOrderId" FOREIGN KEY ("RepairOrderId") REFERENCES repair_orders ("Id") ON DELETE CASCADE
);

CREATE TABLE repair_evidence_attachments (
    "Id" uuid NOT NULL,
    "RepairOrderId" uuid NOT NULL,
    "FileName" character varying(250) NOT NULL,
    "StorageUrl" character varying(1000) NOT NULL,
    "FileType" character varying(100) NOT NULL,
    "FileSizeBytes" bigint NOT NULL,
    "Category" character varying(100) NOT NULL,
    "Description" character varying(500),
    "UploadedAtUtc" timestamp with time zone NOT NULL,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_repair_evidence_attachments" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_repair_evidence_attachments_repair_orders_RepairOrderId" FOREIGN KEY ("RepairOrderId") REFERENCES repair_orders ("Id") ON DELETE CASCADE
);

CREATE TABLE repair_part_usages (
    "Id" uuid NOT NULL,
    "RepairOrderId" uuid NOT NULL,
    "ProductSkuId" uuid NOT NULL,
    "PartDescription" character varying(250) NOT NULL,
    "Quantity" numeric(18,4) NOT NULL,
    "ActualUnitCost" numeric(18,2) NOT NULL,
    "InventoryUnitId" uuid,
    "StockMovementId" uuid,
    "ConsumedAtUtc" timestamp with time zone NOT NULL,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_repair_part_usages" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_repair_part_usages_repair_orders_RepairOrderId" FOREIGN KEY ("RepairOrderId") REFERENCES repair_orders ("Id") ON DELETE RESTRICT
);

CREATE TABLE repair_status_history (
    "Id" uuid NOT NULL,
    "RepairOrderId" uuid NOT NULL,
    "Status" integer NOT NULL,
    "Description" character varying(500) NOT NULL,
    "TimestampUtc" timestamp with time zone NOT NULL,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_repair_status_history" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_repair_status_history_repair_orders_RepairOrderId" FOREIGN KEY ("RepairOrderId") REFERENCES repair_orders ("Id") ON DELETE CASCADE
);

CREATE TABLE repair_warranty_claims (
    "Id" uuid NOT NULL,
    "RepairOrderId" uuid NOT NULL,
    "DefectDescription" character varying(1000) NOT NULL,
    "ClaimDateUtc" timestamp with time zone NOT NULL,
    "Decision" integer NOT NULL,
    "DecisionRationale" character varying(1000),
    "DecisionDateUtc" timestamp with time zone,
    "FollowUpRepairOrderId" uuid,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_repair_warranty_claims" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_repair_warranty_claims_repair_orders_RepairOrderId" FOREIGN KEY ("RepairOrderId") REFERENCES repair_orders ("Id") ON DELETE CASCADE
);

CREATE INDEX "IX_repair_checklist_items_RepairOrderId" ON repair_checklist_items ("RepairOrderId");

CREATE INDEX "IX_repair_checklist_items_TenantId_RepairOrderId_ItemName_IsOu~" ON repair_checklist_items ("TenantId", "RepairOrderId", "ItemName", "IsOutputCheck");

CREATE INDEX "IX_repair_estimate_items_RepairOrderId" ON repair_estimate_items ("RepairOrderId");

CREATE INDEX "IX_repair_estimate_items_TenantId_RepairOrderId" ON repair_estimate_items ("TenantId", "RepairOrderId");

CREATE INDEX "IX_repair_evidence_attachments_RepairOrderId" ON repair_evidence_attachments ("RepairOrderId");

CREATE INDEX "IX_repair_evidence_attachments_TenantId_RepairOrderId" ON repair_evidence_attachments ("TenantId", "RepairOrderId");

CREATE INDEX "IX_repair_orders_TenantId_BranchId_Status" ON repair_orders ("TenantId", "BranchId", "Status");

CREATE INDEX "IX_repair_orders_TenantId_CustomerEquipmentId" ON repair_orders ("TenantId", "CustomerEquipmentId");

CREATE INDEX "IX_repair_orders_TenantId_CustomerId" ON repair_orders ("TenantId", "CustomerId");

CREATE UNIQUE INDEX "IX_repair_orders_TenantId_OrderNumber" ON repair_orders ("TenantId", "OrderNumber");

CREATE INDEX "IX_repair_orders_TenantId_OriginalRepairOrderId" ON repair_orders ("TenantId", "OriginalRepairOrderId");

CREATE INDEX "IX_repair_part_usages_RepairOrderId" ON repair_part_usages ("RepairOrderId");

CREATE INDEX "IX_repair_part_usages_TenantId_RepairOrderId_ProductSkuId" ON repair_part_usages ("TenantId", "RepairOrderId", "ProductSkuId");

CREATE INDEX "IX_repair_status_history_RepairOrderId" ON repair_status_history ("RepairOrderId");

CREATE INDEX "IX_repair_status_history_TenantId_RepairOrderId_TimestampUtc" ON repair_status_history ("TenantId", "RepairOrderId", "TimestampUtc");

CREATE INDEX "IX_repair_warranty_claims_RepairOrderId" ON repair_warranty_claims ("RepairOrderId");

CREATE INDEX "IX_repair_warranty_claims_TenantId_RepairOrderId" ON repair_warranty_claims ("TenantId", "RepairOrderId");

INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261115153150_AddRepairServiceModule', '10.0.0');

COMMIT;

START TRANSACTION;
CREATE TABLE crm_leads (
    "Id" uuid NOT NULL,
    "TenantId" uuid NOT NULL,
    "BranchId" uuid NOT NULL,
    "Name" character varying(150) NOT NULL,
    "Phone" character varying(30),
    "Email" character varying(150),
    "Source" character varying(50) NOT NULL,
    "MainInterest" character varying(200),
    "AssignedSellerUserId" uuid,
    "Status" integer NOT NULL,
    "Notes" character varying(1000),
    "NextContactAtUtc" timestamp with time zone,
    "ConvertedPartyId" uuid,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "ConvertedAtUtc" timestamp with time zone,
    "UpdatedAtUtc" timestamp with time zone,
    CONSTRAINT "PK_crm_leads" PRIMARY KEY ("Id")
);

CREATE TABLE crm_opportunities (
    "Id" uuid NOT NULL,
    "TenantId" uuid NOT NULL,
    "BranchId" uuid NOT NULL,
    "PartyId" uuid,
    "LeadId" uuid,
    "PipelineId" uuid NOT NULL,
    "StageId" uuid NOT NULL,
    "AssignedSellerUserId" uuid,
    "Title" character varying(200) NOT NULL,
    "Description" character varying(1000),
    "Origin" character varying(50) NOT NULL,
    "EstimatedValue" numeric(18,2) NOT NULL,
    "ExpectedClosingDate" timestamp with time zone,
    "Priority" integer NOT NULL,
    "Status" integer NOT NULL,
    "ClosedAtUtc" timestamp with time zone,
    "LossReason" character varying(500),
    "ConvertedSalesQuoteId" uuid,
    "ConvertedSaleId" uuid,
    "AssociatedRepairOrderId" uuid,
    "AssociatedPurchaseIntentId" uuid,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    CONSTRAINT "PK_crm_opportunities" PRIMARY KEY ("Id")
);

CREATE TABLE crm_pipelines (
    "Id" uuid NOT NULL,
    "TenantId" uuid NOT NULL,
    "Name" character varying(100) NOT NULL,
    "PipelineType" integer NOT NULL,
    "IsActive" boolean NOT NULL,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    CONSTRAINT "PK_crm_pipelines" PRIMARY KEY ("Id")
);

CREATE TABLE crm_purchase_intents (
    "Id" uuid NOT NULL,
    "TenantId" uuid NOT NULL,
    "BranchId" uuid NOT NULL,
    "PartyId" uuid NOT NULL,
    "AssignedSellerUserId" uuid,
    "TargetProductModelId" uuid,
    "TargetProductSkuId" uuid,
    "Category" character varying(100) NOT NULL,
    "Brand" character varying(100) NOT NULL,
    "ModelName" character varying(150) NOT NULL,
    "DesiredStorageCapacity" character varying(50),
    "DesiredColor" character varying(50),
    "ColorIsFlexible" boolean NOT NULL,
    "Condition" integer NOT NULL,
    "MinimumCosmeticGrade" character varying(20),
    "MinimumBatteryHealthPercentage" integer,
    "MaxBudgetPrice" numeric(18,2),
    "PreferredBranchId" uuid,
    "ValidUntilUtc" timestamp with time zone NOT NULL,
    "Priority" integer NOT NULL,
    "Status" integer NOT NULL,
    "PreferredContactChannel" integer NOT NULL,
    "Notes" character varying(1000),
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "ClosedAtUtc" timestamp with time zone,
    "CloseReason" character varying(500),
    "UpdatedAtUtc" timestamp with time zone,
    CONSTRAINT "PK_crm_purchase_intents" PRIMARY KEY ("Id")
);

CREATE TABLE crm_opportunity_activities (
    "Id" uuid NOT NULL,
    "TenantId" uuid NOT NULL,
    "BranchId" uuid NOT NULL,
    "OpportunityId" uuid NOT NULL,
    "ActivityType" integer NOT NULL,
    "Title" character varying(200) NOT NULL,
    "Description" character varying(1000),
    "ScheduledForUtc" timestamp with time zone NOT NULL,
    "AssignedUserId" uuid,
    "Priority" integer NOT NULL,
    "Status" integer NOT NULL,
    "CompletedAtUtc" timestamp with time zone,
    "CompletionNotes" character varying(1000),
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    CONSTRAINT "PK_crm_opportunity_activities" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_crm_opportunity_activities_crm_opportunities_OpportunityId" FOREIGN KEY ("OpportunityId") REFERENCES crm_opportunities ("Id") ON DELETE CASCADE
);

CREATE TABLE crm_pipeline_stages (
    "Id" uuid NOT NULL,
    "TenantId" uuid NOT NULL,
    "PipelineId" uuid NOT NULL,
    "Name" character varying(100) NOT NULL,
    "OrderIndex" integer NOT NULL,
    "IsWonStage" boolean NOT NULL,
    "IsLostStage" boolean NOT NULL,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    CONSTRAINT "PK_crm_pipeline_stages" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_crm_pipeline_stages_crm_pipelines_PipelineId" FOREIGN KEY ("PipelineId") REFERENCES crm_pipelines ("Id") ON DELETE CASCADE
);

CREATE TABLE crm_inventory_matches (
    "Id" uuid NOT NULL,
    "TenantId" uuid NOT NULL,
    "BranchId" uuid NOT NULL,
    "PurchaseIntentId" uuid NOT NULL,
    "ProductSkuId" uuid NOT NULL,
    "InventoryUnitId" uuid,
    "VerifiedPrice" numeric(18,2) NOT NULL,
    "MatchDetails" character varying(1000) NOT NULL,
    "IsFullMatch" boolean NOT NULL,
    "Status" integer NOT NULL,
    "EvaluatedAtUtc" timestamp with time zone NOT NULL,
    "StatusUpdatedAtUtc" timestamp with time zone,
    "RejectionReason" character varying(500),
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    CONSTRAINT "PK_crm_inventory_matches" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_crm_inventory_matches_crm_purchase_intents_PurchaseIntentId" FOREIGN KEY ("PurchaseIntentId") REFERENCES crm_purchase_intents ("Id") ON DELETE CASCADE
);

CREATE INDEX "IX_crm_inventory_matches_PurchaseIntentId" ON crm_inventory_matches ("PurchaseIntentId");

CREATE INDEX "IX_crm_inventory_matches_TenantId_InventoryUnitId" ON crm_inventory_matches ("TenantId", "InventoryUnitId");

CREATE INDEX "IX_crm_inventory_matches_TenantId_PurchaseIntentId_ProductSkuId" ON crm_inventory_matches ("TenantId", "PurchaseIntentId", "ProductSkuId");

CREATE INDEX "IX_crm_leads_TenantId_BranchId" ON crm_leads ("TenantId", "BranchId");

CREATE INDEX "IX_crm_leads_TenantId_Status" ON crm_leads ("TenantId", "Status");

CREATE INDEX "IX_crm_opportunities_TenantId_BranchId_Status" ON crm_opportunities ("TenantId", "BranchId", "Status");

CREATE INDEX "IX_crm_opportunities_TenantId_PipelineId_StageId" ON crm_opportunities ("TenantId", "PipelineId", "StageId");

CREATE INDEX "IX_crm_opportunity_activities_OpportunityId" ON crm_opportunity_activities ("OpportunityId");

CREATE INDEX "IX_crm_opportunity_activities_TenantId_OpportunityId_Status" ON crm_opportunity_activities ("TenantId", "OpportunityId", "Status");

CREATE INDEX "IX_crm_pipeline_stages_PipelineId" ON crm_pipeline_stages ("PipelineId");

CREATE INDEX "IX_crm_pipeline_stages_TenantId_PipelineId_OrderIndex" ON crm_pipeline_stages ("TenantId", "PipelineId", "OrderIndex");

CREATE INDEX "IX_crm_pipelines_TenantId_IsActive" ON crm_pipelines ("TenantId", "IsActive");

CREATE INDEX "IX_crm_purchase_intents_TenantId_BranchId_Status" ON crm_purchase_intents ("TenantId", "BranchId", "Status");

CREATE INDEX "IX_crm_purchase_intents_TenantId_PartyId" ON crm_purchase_intents ("TenantId", "PartyId");

INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261116002324_AddCrmModule', '10.0.0');

COMMIT;

START TRANSACTION;
CREATE TABLE "CustomerConversations" (
    "Id" uuid NOT NULL,
    "TenantId" uuid NOT NULL,
    "BranchId" uuid NOT NULL,
    "PartyId" uuid,
    "CustomerPhoneNumber" text NOT NULL,
    "CustomerName" text NOT NULL,
    "LastCustomerMessageAtUtc" timestamp with time zone,
    "Status" text NOT NULL,
    "AssignedAgentUserId" uuid,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "Version" bigint NOT NULL,
    CONSTRAINT "PK_CustomerConversations" PRIMARY KEY ("Id")
);

CREATE TABLE "InAppNotifications" (
    "Id" uuid NOT NULL,
    "TenantId" uuid NOT NULL,
    "BranchId" uuid NOT NULL,
    "TargetUserId" uuid NOT NULL,
    "Category" text NOT NULL,
    "Title" text NOT NULL,
    "Description" text NOT NULL,
    "ActionUrl" text,
    "IsRead" boolean NOT NULL,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "ReadAtUtc" timestamp with time zone,
    "UpdatedAtUtc" timestamp with time zone,
    "Version" bigint NOT NULL,
    CONSTRAINT "PK_InAppNotifications" PRIMARY KEY ("Id")
);

CREATE TABLE "MessageRequests" (
    "Id" uuid NOT NULL,
    "TenantId" uuid NOT NULL,
    "BranchId" uuid NOT NULL,
    "ChannelAccountId" uuid,
    "Channel" integer NOT NULL,
    "Recipient" text NOT NULL,
    "PartyId" uuid,
    "Purpose" integer NOT NULL,
    "SourceType" text NOT NULL,
    "SourceId" uuid,
    "TemplateId" uuid,
    "PayloadJson" text NOT NULL,
    "TextBody" text NOT NULL,
    "ScheduledAtUtc" timestamp with time zone NOT NULL,
    "ExpiresAtUtc" timestamp with time zone NOT NULL,
    "IdempotencyKey" text NOT NULL,
    "CorrelationId" uuid NOT NULL,
    "Status" integer NOT NULL,
    "ProviderMessageId" text,
    "AttemptCount" integer NOT NULL,
    "NextAttemptAtUtc" timestamp with time zone,
    "LastError" text,
    "LeaseOwnerId" uuid,
    "LeaseExpiresAtUtc" timestamp with time zone,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "DeliveredAtUtc" timestamp with time zone,
    "ReadAtUtc" timestamp with time zone,
    "UpdatedAtUtc" timestamp with time zone,
    "Version" bigint NOT NULL,
    CONSTRAINT "PK_MessageRequests" PRIMARY KEY ("Id")
);

CREATE TABLE "MessageTemplates" (
    "Id" uuid NOT NULL,
    "TenantId" uuid NOT NULL,
    "Name" text NOT NULL,
    "ExternalTemplateName" text NOT NULL,
    "Channel" integer NOT NULL,
    "Category" integer NOT NULL,
    "Language" text NOT NULL,
    "Content" text NOT NULL,
    "AllowedVariablesJson" text,
    "Status" integer NOT NULL,
    "Purpose" integer NOT NULL,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "StatusUpdatedAtUtc" timestamp with time zone,
    "UpdatedAtUtc" timestamp with time zone,
    "Version" bigint NOT NULL,
    CONSTRAINT "PK_MessageTemplates" PRIMARY KEY ("Id")
);

CREATE TABLE "MessagingChannelAccounts" (
    "Id" uuid NOT NULL,
    "TenantId" uuid NOT NULL,
    "BranchId" uuid NOT NULL,
    "Channel" integer NOT NULL,
    "AccountName" text NOT NULL,
    "SenderPhoneNumber" text,
    "PhoneNumberId" text,
    "WabaId" text,
    "EncryptedAccessToken" text,
    "EncryptedAppSecret" text,
    "VerifyToken" text,
    "GraphApiVersion" text NOT NULL,
    "Status" integer NOT NULL,
    "LastVerifiedAtUtc" timestamp with time zone,
    "LastError" text,
    "IsActive" boolean NOT NULL,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "Version" bigint NOT NULL,
    CONSTRAINT "PK_MessagingChannelAccounts" PRIMARY KEY ("Id")
);

CREATE TABLE "MessagingWebhookEvents" (
    "Id" uuid NOT NULL,
    "TenantId" uuid NOT NULL,
    "Provider" text NOT NULL,
    "EventId" text NOT NULL,
    "EventType" text NOT NULL,
    "RawPayloadJson" text NOT NULL,
    "IsProcessed" boolean NOT NULL,
    "ReceivedAtUtc" timestamp with time zone NOT NULL,
    "ProcessedAtUtc" timestamp with time zone,
    "ProcessingError" text,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "Version" bigint NOT NULL,
    CONSTRAINT "PK_MessagingWebhookEvents" PRIMARY KEY ("Id")
);

CREATE TABLE "ConversationMessages" (
    "Id" uuid NOT NULL,
    "TenantId" uuid NOT NULL,
    "ConversationId" uuid NOT NULL,
    "IsInbound" boolean NOT NULL,
    "Content" text NOT NULL,
    "ProviderMessageId" text,
    "SentAtUtc" timestamp with time zone NOT NULL,
    "CustomerConversationId" uuid,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "Version" bigint NOT NULL,
    CONSTRAINT "PK_ConversationMessages" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_ConversationMessages_CustomerConversations_CustomerConversa~" FOREIGN KEY ("CustomerConversationId") REFERENCES "CustomerConversations" ("Id")
);

CREATE INDEX "IX_ConversationMessages_CustomerConversationId" ON "ConversationMessages" ("CustomerConversationId");

INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261116124046_AddMessagingModule', '10.0.0');

COMMIT;

START TRANSACTION;
CREATE TABLE manufacturing_design_assets (
    "Id" uuid NOT NULL,
    "Code" text NOT NULL,
    "Title" text NOT NULL,
    "Category" text NOT NULL,
    "Description" text,
    "LicenseType" text NOT NULL,
    "IsCommercialAllowed" boolean NOT NULL,
    "Author" text,
    "AssociatedProductSkuId" uuid,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    "BranchId" uuid NOT NULL,
    CONSTRAINT "PK_manufacturing_design_assets" PRIMARY KEY ("Id")
);

CREATE TABLE manufacturing_orders (
    "Id" uuid NOT NULL,
    "OrderNumber" text NOT NULL,
    "Type" integer NOT NULL,
    "Status" integer NOT NULL,
    "SalesOrderId" uuid,
    "TargetProductSkuId" uuid,
    "DesignVersionId" uuid,
    "AssignedPrinterId" uuid,
    "MaterialProductSkuId" uuid NOT NULL,
    "MaterialStockReservationId" uuid,
    "PlannedQuantity" integer NOT NULL,
    "ProducedQuantity" integer NOT NULL,
    "ApprovedQuantity" integer NOT NULL,
    "RejectedQuantity" integer NOT NULL,
    "EstimatedFilamentGrams" numeric NOT NULL,
    "EstimatedPrintTimeMinutes" numeric NOT NULL,
    "TotalEstimatedCost" numeric NOT NULL,
    "ActualMaterialCost" numeric NOT NULL,
    "ActualEnergyCost" numeric NOT NULL,
    "ActualMachineCost" numeric NOT NULL,
    "ActualLaborCost" numeric NOT NULL,
    "ActualWasteCost" numeric NOT NULL,
    "FailureReason" text,
    "StartedAtUtc" timestamp with time zone,
    "FinishedAtUtc" timestamp with time zone,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    "BranchId" uuid NOT NULL,
    CONSTRAINT "PK_manufacturing_orders" PRIMARY KEY ("Id")
);

CREATE TABLE manufacturing_printers (
    "Id" uuid NOT NULL,
    "Code" text NOT NULL,
    "Name" text NOT NULL,
    "Manufacturer" text NOT NULL,
    "Model" text NOT NULL,
    "SerialNumber" text,
    "Technology" integer NOT NULL,
    "BuildVolume" text NOT NULL,
    "ExtruderCount" integer NOT NULL,
    "CompatibleMaterials" text NOT NULL,
    "NominalPowerWatts" numeric NOT NULL,
    "AveragePowerWatts" numeric NOT NULL,
    "AcquisitionCost" numeric NOT NULL,
    "EstimatedLifespanHours" numeric NOT NULL,
    "ConfiguredHourlyMachineCost" numeric NOT NULL,
    "Status" integer NOT NULL,
    "StatusNote" text,
    "StatusUpdatedAtUtc" timestamp with time zone,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    "BranchId" uuid NOT NULL,
    CONSTRAINT "PK_manufacturing_printers" PRIMARY KEY ("Id")
);

CREATE TABLE manufacturing_quotes (
    "Id" uuid NOT NULL,
    "QuoteNumber" text NOT NULL,
    "CustomerPartyId" uuid,
    "Description" text NOT NULL,
    "PlannedQuantity" integer NOT NULL,
    "EstimatedMaterialCost" numeric NOT NULL,
    "EstimatedEnergyCost" numeric NOT NULL,
    "EstimatedMachineCost" numeric NOT NULL,
    "EstimatedLaborCost" numeric NOT NULL,
    "EstimatedPlannedWasteCost" numeric NOT NULL,
    "MarkupPercent" numeric NOT NULL,
    "SuggestedFinalPrice" numeric NOT NULL,
    "IsApproved" boolean NOT NULL,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    "BranchId" uuid NOT NULL,
    CONSTRAINT "PK_manufacturing_quotes" PRIMARY KEY ("Id")
);

CREATE TABLE manufacturing_spools (
    "Id" uuid NOT NULL,
    "ProductSkuId" uuid NOT NULL,
    "SpoolCode" text NOT NULL,
    "BatchNumber" text,
    "MaterialType" text NOT NULL,
    "Color" text NOT NULL,
    "DiameterMm" numeric NOT NULL,
    "InitialNetWeightGrams" numeric NOT NULL,
    "RemainingWeightGrams" numeric NOT NULL,
    "SpoolTareGrams" numeric NOT NULL,
    "IsActive" boolean NOT NULL,
    "OpenedAtUtc" timestamp with time zone NOT NULL,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    "BranchId" uuid NOT NULL,
    CONSTRAINT "PK_manufacturing_spools" PRIMARY KEY ("Id")
);

CREATE TABLE manufacturing_design_versions (
    "Id" uuid NOT NULL,
    "AssetId" uuid NOT NULL,
    "RevisionCode" text NOT NULL,
    "FileFormat" text NOT NULL,
    "StoragePath" text NOT NULL,
    "Sha256Hash" text NOT NULL,
    "FileSizeBytes" bigint NOT NULL,
    "EstimatedDurationMinutes" numeric NOT NULL,
    "EstimatedMassGrams" numeric NOT NULL,
    "TechnicalNotes" text,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_manufacturing_design_versions" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_manufacturing_design_versions_manufacturing_design_assets_A~" FOREIGN KEY ("AssetId") REFERENCES manufacturing_design_assets ("Id") ON DELETE CASCADE
);

CREATE TABLE manufacturing_print_attempts (
    "Id" uuid NOT NULL,
    "ManufacturingOrderId" uuid NOT NULL,
    "AttemptNumber" integer NOT NULL,
    "PrinterId" uuid NOT NULL,
    "Status" integer NOT NULL,
    "EstimatedDurationMinutes" numeric NOT NULL,
    "ActualDurationMinutes" numeric NOT NULL,
    "EstimatedMassGrams" numeric NOT NULL,
    "ActualMassGrams" numeric NOT NULL,
    "FailureCategory" integer,
    "FailureNotes" text,
    "OperatorName" text,
    "StartedAtUtc" timestamp with time zone,
    "FinishedAtUtc" timestamp with time zone,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_manufacturing_print_attempts" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_manufacturing_print_attempts_manufacturing_orders_Manufactu~" FOREIGN KEY ("ManufacturingOrderId") REFERENCES manufacturing_orders ("Id") ON DELETE CASCADE
);

CREATE INDEX "IX_manufacturing_design_versions_AssetId" ON manufacturing_design_versions ("AssetId");

CREATE INDEX "IX_manufacturing_print_attempts_ManufacturingOrderId" ON manufacturing_print_attempts ("ManufacturingOrderId");

INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261116141507_AddManufacturing3DModule', '10.0.0');

COMMIT;

START TRANSACTION;
CREATE TABLE digital_projects (
    "Id" uuid NOT NULL,
    "ProjectCode" character varying(50) NOT NULL,
    "Name" character varying(200) NOT NULL,
    "Description" text NOT NULL,
    "Type" integer NOT NULL,
    "PricingModel" integer NOT NULL,
    "Status" integer NOT NULL,
    "CustomerPartyId" uuid NOT NULL,
    "CrmOpportunityId" uuid,
    "SalesOrderId" uuid,
    "LeadTechnicianUserId" uuid NOT NULL,
    "LeadTechnicianName" text NOT NULL,
    "PlannedStartDateUtc" timestamp with time zone,
    "PlannedDeliveryDateUtc" timestamp with time zone,
    "ActualStartDateUtc" timestamp with time zone,
    "ActualCompletionDateUtc" timestamp with time zone,
    "ContractedPrice" numeric(18,2) NOT NULL,
    "EstimatedHours" numeric(18,2) NOT NULL,
    "TotalActualLaborCost" numeric(18,2) NOT NULL,
    "TotalThirdPartyCost" numeric(18,2) NOT NULL,
    "TotalExpensesCost" numeric(18,2) NOT NULL,
    "InvoicedAmount" numeric(18,2) NOT NULL,
    "PaidAmount" numeric(18,2) NOT NULL,
    "IntellectualPropertyPolicy" text NOT NULL,
    "LgpdProcessingRole" text NOT NULL,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    "BranchId" uuid NOT NULL,
    CONSTRAINT "PK_digital_projects" PRIMARY KEY ("Id")
);

CREATE TABLE digital_project_change_requests (
    "Id" uuid NOT NULL,
    "DigitalProjectId" uuid NOT NULL,
    "CrNumber" text NOT NULL,
    "Title" text NOT NULL,
    "RequesterName" text NOT NULL,
    "Reason" text NOT NULL,
    "ProposedScopeChanges" text NOT NULL,
    "ImpactHours" numeric(18,2) NOT NULL,
    "ImpactCost" numeric(18,2) NOT NULL,
    "ImpactPrice" numeric(18,2) NOT NULL,
    "ImpactDays" integer NOT NULL,
    "Status" integer NOT NULL,
    "ApprovedAtUtc" timestamp with time zone,
    "DecisionNotes" text,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_digital_project_change_requests" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_digital_project_change_requests_digital_projects_DigitalPro~" FOREIGN KEY ("DigitalProjectId") REFERENCES digital_projects ("Id") ON DELETE CASCADE
);

CREATE TABLE digital_project_contract_versions (
    "Id" uuid NOT NULL,
    "DigitalProjectId" uuid NOT NULL,
    "VersionNumber" integer NOT NULL,
    "ContractTitle" text NOT NULL,
    "TermsSummary" text NOT NULL,
    "DocumentUri" text NOT NULL,
    "Sha256Hash" text NOT NULL,
    "RegisteredByUserName" text NOT NULL,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_digital_project_contract_versions" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_digital_project_contract_versions_digital_projects_DigitalP~" FOREIGN KEY ("DigitalProjectId") REFERENCES digital_projects ("Id") ON DELETE CASCADE
);

CREATE TABLE digital_project_deliverables (
    "Id" uuid NOT NULL,
    "DigitalProjectId" uuid NOT NULL,
    "MilestoneId" uuid,
    "Title" text NOT NULL,
    "Type" integer NOT NULL,
    "ArtifactVersion" text NOT NULL,
    "Description" text NOT NULL,
    "StorageUriOrUrl" text NOT NULL,
    "Sha256Hash" text,
    "Status" integer NOT NULL,
    "SubmittedAtUtc" timestamp with time zone,
    "AcceptedAtUtc" timestamp with time zone,
    "AcceptanceNotes" text,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_digital_project_deliverables" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_digital_project_deliverables_digital_projects_DigitalProjec~" FOREIGN KEY ("DigitalProjectId") REFERENCES digital_projects ("Id") ON DELETE CASCADE
);

CREATE TABLE digital_project_milestones (
    "Id" uuid NOT NULL,
    "DigitalProjectId" uuid NOT NULL,
    "SequenceOrder" integer NOT NULL,
    "Title" text NOT NULL,
    "Description" text NOT NULL,
    "TargetDateUtc" timestamp with time zone,
    "MilestonePrice" numeric(18,2) NOT NULL,
    "IsBillable" boolean NOT NULL,
    "Status" integer NOT NULL,
    "ApprovedAtUtc" timestamp with time zone,
    "ApprovedByNotes" text,
    "HasBeenBilled" boolean NOT NULL,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_digital_project_milestones" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_digital_project_milestones_digital_projects_DigitalProjectId" FOREIGN KEY ("DigitalProjectId") REFERENCES digital_projects ("Id") ON DELETE CASCADE
);

CREATE TABLE digital_project_tasks (
    "Id" uuid NOT NULL,
    "DigitalProjectId" uuid NOT NULL,
    "MilestoneId" uuid,
    "Title" text NOT NULL,
    "Description" text NOT NULL,
    "AssignedUserId" uuid,
    "AssignedUserName" text,
    "EstimatedHours" numeric(18,2) NOT NULL,
    "DueDateUtc" timestamp with time zone,
    "Status" integer NOT NULL,
    "CompletedAtUtc" timestamp with time zone,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_digital_project_tasks" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_digital_project_tasks_digital_projects_DigitalProjectId" FOREIGN KEY ("DigitalProjectId") REFERENCES digital_projects ("Id") ON DELETE CASCADE
);

CREATE TABLE digital_project_time_entries (
    "Id" uuid NOT NULL,
    "DigitalProjectId" uuid NOT NULL,
    "DigitalProjectTaskId" uuid NOT NULL,
    "UserId" uuid NOT NULL,
    "UserName" text NOT NULL,
    "WorkDateUtc" timestamp with time zone NOT NULL,
    "DurationHours" numeric(18,2) NOT NULL,
    "ActivityType" integer NOT NULL,
    "Description" text NOT NULL,
    "IsBillable" boolean NOT NULL,
    "HistoricalHourlyCost" numeric(18,2) NOT NULL,
    "IsApproved" boolean NOT NULL,
    "ApprovedByUserId" uuid,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_digital_project_time_entries" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_digital_project_time_entries_digital_projects_DigitalProjec~" FOREIGN KEY ("DigitalProjectId") REFERENCES digital_projects ("Id") ON DELETE CASCADE
);

CREATE INDEX "IX_digital_project_change_requests_DigitalProjectId" ON digital_project_change_requests ("DigitalProjectId");

CREATE UNIQUE INDEX "IX_digital_project_change_requests_TenantId_DigitalProjectId_C~" ON digital_project_change_requests ("TenantId", "DigitalProjectId", "CrNumber");

CREATE INDEX "IX_digital_project_contract_versions_DigitalProjectId" ON digital_project_contract_versions ("DigitalProjectId");

CREATE UNIQUE INDEX "IX_digital_project_contract_versions_TenantId_DigitalProjectId~" ON digital_project_contract_versions ("TenantId", "DigitalProjectId", "VersionNumber");

CREATE INDEX "IX_digital_project_deliverables_DigitalProjectId" ON digital_project_deliverables ("DigitalProjectId");

CREATE INDEX "IX_digital_project_deliverables_TenantId_DigitalProjectId" ON digital_project_deliverables ("TenantId", "DigitalProjectId");

CREATE INDEX "IX_digital_project_milestones_DigitalProjectId" ON digital_project_milestones ("DigitalProjectId");

CREATE INDEX "IX_digital_project_milestones_TenantId_DigitalProjectId_Sequen~" ON digital_project_milestones ("TenantId", "DigitalProjectId", "SequenceOrder");

CREATE INDEX "IX_digital_project_tasks_DigitalProjectId" ON digital_project_tasks ("DigitalProjectId");

CREATE INDEX "IX_digital_project_tasks_TenantId_DigitalProjectId_Status" ON digital_project_tasks ("TenantId", "DigitalProjectId", "Status");

CREATE INDEX "IX_digital_project_time_entries_DigitalProjectId" ON digital_project_time_entries ("DigitalProjectId");

CREATE INDEX "IX_digital_project_time_entries_TenantId_DigitalProjectId_Work~" ON digital_project_time_entries ("TenantId", "DigitalProjectId", "WorkDateUtc");

CREATE INDEX "IX_digital_project_time_entries_TenantId_UserId" ON digital_project_time_entries ("TenantId", "UserId");

CREATE INDEX "IX_digital_projects_TenantId_CustomerPartyId" ON digital_projects ("TenantId", "CustomerPartyId");

CREATE UNIQUE INDEX "IX_digital_projects_TenantId_ProjectCode" ON digital_projects ("TenantId", "ProjectCode");

CREATE INDEX "IX_digital_projects_TenantId_Status" ON digital_projects ("TenantId", "Status");

INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261116145451_AddDigitalProjectsModule', '10.0.0');

COMMIT;

START TRANSACTION;
ALTER TABLE users ADD "SecurityStamp" bigint NOT NULL DEFAULT 0;

ALTER TABLE partners ADD "IsErpAccessEnabled" boolean NOT NULL DEFAULT FALSE;

INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261116174851_AddUserSecurityStampAndPartnerErpAccess', '10.0.0');

COMMIT;

START TRANSACTION;
CREATE TABLE revoked_sessions (
    "Id" uuid NOT NULL,
    "SessionId" character varying(128) NOT NULL,
    "UserId" uuid,
    "Reason" text,
    "ExpiresAtUtc" timestamp with time zone NOT NULL,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "Version" bigint NOT NULL,
    CONSTRAINT "PK_revoked_sessions" PRIMARY KEY ("Id")
);

CREATE INDEX "IX_revoked_sessions_ExpiresAtUtc" ON revoked_sessions ("ExpiresAtUtc");

CREATE UNIQUE INDEX "IX_revoked_sessions_SessionId" ON revoked_sessions ("SessionId");

INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261116175938_AddRevokedSessionsTable', '10.0.0');

COMMIT;

START TRANSACTION;
CREATE TABLE fleet_vehicles (
    "Id" uuid NOT NULL,
    "BranchId" uuid NOT NULL,
    "InternalCode" text NOT NULL,
    "Plate" text NOT NULL,
    "Brand" text NOT NULL,
    "Model" text NOT NULL,
    "Year" integer NOT NULL,
    "Type" integer NOT NULL,
    "Ownership" integer NOT NULL,
    "Fuel" integer NOT NULL,
    "TankCapacityLiters" numeric(18,2),
    "InitialOdometerKm" numeric(18,2) NOT NULL,
    "CurrentOdometerKm" numeric(18,2) NOT NULL,
    "AverageConsumptionKmPerLiter" numeric(18,2),
    "OwnerPartnerId" uuid,
    "ResponsibleName" text,
    "Status" integer NOT NULL,
    "UtilizationStartDateUtc" timestamp with time zone NOT NULL,
    "Notes" text,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_fleet_vehicles" PRIMARY KEY ("Id")
);

CREATE TABLE product_price_suggestions (
    "Id" uuid NOT NULL,
    "BranchId" uuid NOT NULL,
    "InventoryUnitId" uuid,
    "ProductSkuId" uuid NOT NULL,
    "PricingPolicyId" uuid,
    "ReferencePrice" numeric(18,2) NOT NULL,
    "TargetNegotiationPrice" numeric(18,2) NOT NULL,
    "RealAcquisitionCost" numeric(18,2) NOT NULL,
    "AllocatedLogisticsCost" numeric(18,2) NOT NULL,
    "CommercialProvisions" numeric(18,2) NOT NULL,
    "TotalCostBase" numeric(18,2) NOT NULL,
    "MarkupRateApplied" numeric(18,4) NOT NULL,
    "CalculatedSuggestedPrice" numeric(18,2) NOT NULL,
    "MinimumAllowedPrice" numeric(18,2) NOT NULL,
    "ApprovedFinalPrice" numeric(18,2) NOT NULL,
    "Status" integer NOT NULL,
    "CalculationBreakdownJson" text NOT NULL,
    "ApprovedByUserId" uuid,
    "ApprovedAtUtc" timestamp with time zone,
    "ApprovalNotes" text,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_product_price_suggestions" PRIMARY KEY ("Id")
);

CREATE TABLE product_pricing_policies (
    "Id" uuid NOT NULL,
    "BranchId" uuid NOT NULL,
    "Name" text NOT NULL,
    "Scope" integer NOT NULL,
    "TargetCategoryId" uuid,
    "TargetBrandId" uuid,
    "TargetModelId" uuid,
    "TargetSkuId" uuid,
    "TargetCondition" integer,
    "TargetAcquisitionDiscountRate" numeric(18,4) NOT NULL,
    "TargetMarkupRate" numeric(18,4) NOT NULL,
    "TargetMinMarginRate" numeric(18,4) NOT NULL,
    "EstimatedPickupLogisticsRate" numeric(18,4) NOT NULL,
    "EstimatedDeliveryLogisticsRate" numeric(18,4) NOT NULL,
    "OtherCommercialCostRate" numeric(18,4) NOT NULL,
    "RoundingRule" integer NOT NULL,
    "PreferRealCostOverEstimate" boolean NOT NULL,
    "IsActive" boolean NOT NULL,
    "VersionNumber" integer NOT NULL,
    "Description" text,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_product_pricing_policies" PRIMARY KEY ("Id")
);

CREATE TABLE fleet_maintenance_plans (
    "Id" uuid NOT NULL,
    "VehicleId" uuid NOT NULL,
    "PlanName" text NOT NULL,
    "RecommendedIntervalKm" integer NOT NULL,
    "RecommendedIntervalDays" integer NOT NULL,
    "LastServiceOdometerKm" numeric(18,2),
    "LastServiceDateUtc" timestamp with time zone,
    "NextServiceOdometerKm" numeric(18,2),
    "NextServiceDateUtc" timestamp with time zone,
    "OilSpecification" text,
    "IsActive" boolean NOT NULL,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_fleet_maintenance_plans" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_fleet_maintenance_plans_fleet_vehicles_VehicleId" FOREIGN KEY ("VehicleId") REFERENCES fleet_vehicles ("Id") ON DELETE CASCADE
);

CREATE TABLE fleet_trips (
    "Id" uuid NOT NULL,
    "BranchId" uuid NOT NULL,
    "TripNumber" text NOT NULL,
    "VehicleId" uuid NOT NULL,
    "DriverUserId" uuid NOT NULL,
    "DriverName" text NOT NULL,
    "Purpose" integer NOT NULL,
    "OriginCity" text NOT NULL,
    "DestinationCity" text NOT NULL,
    "Description" text,
    "StartTimeUtc" timestamp with time zone NOT NULL,
    "EndTimeUtc" timestamp with time zone,
    "InitialOdometerKm" numeric(18,2) NOT NULL,
    "FinalOdometerKm" numeric(18,2),
    "DistanceKm" numeric(18,2) NOT NULL,
    "Status" integer NOT NULL,
    "TotalFuelExpenses" numeric(18,2) NOT NULL,
    "TotalOtherExpenses" numeric(18,2) NOT NULL,
    "TotalAllocatedCost" numeric(18,2) NOT NULL,
    "Notes" text,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_fleet_trips" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_fleet_trips_fleet_vehicles_VehicleId" FOREIGN KEY ("VehicleId") REFERENCES fleet_vehicles ("Id") ON DELETE CASCADE
);

CREATE TABLE fleet_maintenance_services (
    "Id" uuid NOT NULL,
    "BranchId" uuid NOT NULL,
    "VehicleId" uuid NOT NULL,
    "MaintenancePlanId" uuid,
    "Type" integer NOT NULL,
    "ServiceDateUtc" timestamp with time zone NOT NULL,
    "OdometerKm" numeric(18,2) NOT NULL,
    "WorkshopName" text NOT NULL,
    "Description" text NOT NULL,
    "PartsCost" numeric(18,2) NOT NULL,
    "LaborCost" numeric(18,2) NOT NULL,
    "TotalCost" numeric(18,2) NOT NULL,
    "OilBrandAndSpecs" text,
    "FilterReplaced" boolean NOT NULL,
    "NextRecommendedOdometerKm" numeric(18,2),
    "NextRecommendedDateUtc" timestamp with time zone,
    "PaymentMethod" integer NOT NULL,
    "FinancialStatus" integer NOT NULL,
    "AccountPayableId" uuid,
    "PayingPartnerId" uuid,
    "PartnerReimbursementId" uuid,
    "InvoiceDocumentReference" text,
    "ReceiptAttachmentPath" text,
    "RegisteredByUserId" uuid NOT NULL,
    "Notes" text,
    "IdempotencyKey" text,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_fleet_maintenance_services" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_fleet_maintenance_services_fleet_maintenance_plans_Maintena~" FOREIGN KEY ("MaintenancePlanId") REFERENCES fleet_maintenance_plans ("Id"),
    CONSTRAINT "FK_fleet_maintenance_services_fleet_vehicles_VehicleId" FOREIGN KEY ("VehicleId") REFERENCES fleet_vehicles ("Id") ON DELETE CASCADE
);

CREATE TABLE fleet_expenses (
    "Id" uuid NOT NULL,
    "BranchId" uuid NOT NULL,
    "Category" integer NOT NULL,
    "VehicleId" uuid,
    "TripId" uuid,
    "ExpenseDateUtc" timestamp with time zone NOT NULL,
    "Description" text NOT NULL,
    "Amount" numeric(18,2) NOT NULL,
    "SupplierName" text,
    "PaymentMethod" integer NOT NULL,
    "FinancialStatus" integer NOT NULL,
    "AccountPayableId" uuid,
    "PayingPartnerId" uuid,
    "PartnerReimbursementId" uuid,
    "DocumentReference" text,
    "ReceiptAttachmentPath" text,
    "RegisteredByUserId" uuid NOT NULL,
    "Notes" text,
    "IdempotencyKey" text,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_fleet_expenses" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_fleet_expenses_fleet_trips_TripId" FOREIGN KEY ("TripId") REFERENCES fleet_trips ("Id"),
    CONSTRAINT "FK_fleet_expenses_fleet_vehicles_VehicleId" FOREIGN KEY ("VehicleId") REFERENCES fleet_vehicles ("Id")
);

CREATE TABLE fleet_fuelings (
    "Id" uuid NOT NULL,
    "BranchId" uuid NOT NULL,
    "VehicleId" uuid NOT NULL,
    "TripId" uuid,
    "FuelingDateUtc" timestamp with time zone NOT NULL,
    "GasStationName" text NOT NULL,
    "Fuel" integer NOT NULL,
    "TotalAmount" numeric(18,2) NOT NULL,
    "Liters" numeric(18,3),
    "PricePerLiter" numeric(18,4),
    "OdometerKm" numeric(18,2) NOT NULL,
    "IsFullTank" boolean NOT NULL,
    "PaymentMethod" integer NOT NULL,
    "FinancialStatus" integer NOT NULL,
    "FinancialAccountId" uuid,
    "AccountPayableId" uuid,
    "PartnerReimbursementId" uuid,
    "PayingPartnerId" uuid,
    "ReceiptDocumentReference" text,
    "ReceiptAttachmentPath" text,
    "RegisteredByUserId" uuid NOT NULL,
    "Notes" text,
    "IdempotencyKey" text,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_fleet_fuelings" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_fleet_fuelings_fleet_trips_TripId" FOREIGN KEY ("TripId") REFERENCES fleet_trips ("Id"),
    CONSTRAINT "FK_fleet_fuelings_fleet_vehicles_VehicleId" FOREIGN KEY ("VehicleId") REFERENCES fleet_vehicles ("Id") ON DELETE CASCADE
);

CREATE TABLE fleet_trip_allocations (
    "Id" uuid NOT NULL,
    "TripId" uuid NOT NULL,
    "TargetType" integer NOT NULL,
    "TargetId" uuid NOT NULL,
    "TargetReference" text NOT NULL,
    "InventoryUnitId" uuid,
    "ProductSkuId" uuid,
    "AllocatedAmount" numeric(18,2) NOT NULL,
    "Method" integer NOT NULL,
    "AllocationPercentage" numeric(18,4) NOT NULL,
    "Justification" text,
    "AllocatedAtUtc" timestamp with time zone NOT NULL,
    "AllocatedByUserId" uuid NOT NULL,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_fleet_trip_allocations" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_fleet_trip_allocations_fleet_trips_TripId" FOREIGN KEY ("TripId") REFERENCES fleet_trips ("Id") ON DELETE CASCADE
);

CREATE INDEX "IX_fleet_expenses_TenantId_Category_ExpenseDateUtc" ON fleet_expenses ("TenantId", "Category", "ExpenseDateUtc");

CREATE INDEX "IX_fleet_expenses_TenantId_FinancialStatus" ON fleet_expenses ("TenantId", "FinancialStatus");

CREATE UNIQUE INDEX "IX_fleet_expenses_TenantId_IdempotencyKey" ON fleet_expenses ("TenantId", "IdempotencyKey") WHERE "IdempotencyKey" IS NOT NULL;

CREATE INDEX "IX_fleet_expenses_TenantId_TripId" ON fleet_expenses ("TenantId", "TripId");

CREATE INDEX "IX_fleet_expenses_TenantId_VehicleId" ON fleet_expenses ("TenantId", "VehicleId");

CREATE INDEX "IX_fleet_expenses_TripId" ON fleet_expenses ("TripId");

CREATE INDEX "IX_fleet_expenses_VehicleId" ON fleet_expenses ("VehicleId");

CREATE INDEX "IX_fleet_fuelings_TenantId_FinancialStatus" ON fleet_fuelings ("TenantId", "FinancialStatus");

CREATE UNIQUE INDEX "IX_fleet_fuelings_TenantId_IdempotencyKey" ON fleet_fuelings ("TenantId", "IdempotencyKey") WHERE "IdempotencyKey" IS NOT NULL;

CREATE INDEX "IX_fleet_fuelings_TenantId_TripId" ON fleet_fuelings ("TenantId", "TripId");

CREATE INDEX "IX_fleet_fuelings_TenantId_VehicleId_FuelingDateUtc" ON fleet_fuelings ("TenantId", "VehicleId", "FuelingDateUtc");

CREATE INDEX "IX_fleet_fuelings_TripId" ON fleet_fuelings ("TripId");

CREATE INDEX "IX_fleet_fuelings_VehicleId" ON fleet_fuelings ("VehicleId");

CREATE INDEX "IX_fleet_maintenance_plans_TenantId_VehicleId_IsActive" ON fleet_maintenance_plans ("TenantId", "VehicleId", "IsActive");

CREATE INDEX "IX_fleet_maintenance_plans_VehicleId" ON fleet_maintenance_plans ("VehicleId");

CREATE INDEX "IX_fleet_maintenance_services_MaintenancePlanId" ON fleet_maintenance_services ("MaintenancePlanId");

CREATE INDEX "IX_fleet_maintenance_services_TenantId_FinancialStatus" ON fleet_maintenance_services ("TenantId", "FinancialStatus");

CREATE INDEX "IX_fleet_maintenance_services_TenantId_VehicleId_ServiceDateUtc" ON fleet_maintenance_services ("TenantId", "VehicleId", "ServiceDateUtc");

CREATE INDEX "IX_fleet_maintenance_services_VehicleId" ON fleet_maintenance_services ("VehicleId");

CREATE INDEX "IX_fleet_trip_allocations_TenantId_InventoryUnitId" ON fleet_trip_allocations ("TenantId", "InventoryUnitId");

CREATE INDEX "IX_fleet_trip_allocations_TenantId_TargetType_TargetId" ON fleet_trip_allocations ("TenantId", "TargetType", "TargetId");

CREATE INDEX "IX_fleet_trip_allocations_TenantId_TripId" ON fleet_trip_allocations ("TenantId", "TripId");

CREATE INDEX "IX_fleet_trip_allocations_TripId" ON fleet_trip_allocations ("TripId");

CREATE INDEX "IX_fleet_trips_TenantId_StartTimeUtc" ON fleet_trips ("TenantId", "StartTimeUtc");

CREATE UNIQUE INDEX "IX_fleet_trips_TenantId_TripNumber" ON fleet_trips ("TenantId", "TripNumber");

CREATE INDEX "IX_fleet_trips_TenantId_VehicleId_Status" ON fleet_trips ("TenantId", "VehicleId", "Status");

CREATE INDEX "IX_fleet_trips_VehicleId" ON fleet_trips ("VehicleId");

CREATE INDEX "IX_fleet_vehicles_TenantId_BranchId_Status" ON fleet_vehicles ("TenantId", "BranchId", "Status");

CREATE UNIQUE INDEX "IX_fleet_vehicles_TenantId_InternalCode" ON fleet_vehicles ("TenantId", "InternalCode");

CREATE UNIQUE INDEX "IX_fleet_vehicles_TenantId_Plate" ON fleet_vehicles ("TenantId", "Plate");

CREATE INDEX "IX_product_price_suggestions_TenantId_InventoryUnitId" ON product_price_suggestions ("TenantId", "InventoryUnitId");

CREATE INDEX "IX_product_price_suggestions_TenantId_ProductSkuId_Status" ON product_price_suggestions ("TenantId", "ProductSkuId", "Status");

CREATE INDEX "IX_product_pricing_policies_TenantId_BranchId_IsActive" ON product_pricing_policies ("TenantId", "BranchId", "IsActive");

CREATE INDEX "IX_product_pricing_policies_TenantId_Scope_TargetSkuId" ON product_pricing_policies ("TenantId", "Scope", "TargetSkuId");

INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261116183756_AddFleetLogisticsAndProductPricing', '10.0.0');

COMMIT;

START TRANSACTION;
ALTER TABLE product_pricing_policies ADD "MaxCounterDiscountRate" numeric NOT NULL DEFAULT 0.0;

ALTER TABLE product_price_suggestions ADD "MaxCounterDiscountPrice" numeric NOT NULL DEFAULT 0.0;

ALTER TABLE inventory_units ADD "AllocatedFreightCost" numeric NOT NULL DEFAULT 0.0;

INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261116191947_UpdatePricingPolicyCounterDiscountAndAllocatedFreight', '10.0.0');

COMMIT;

START TRANSACTION;
ALTER TABLE users ADD "JobTitle" character varying(100) NOT NULL DEFAULT 'Colaborador';

CREATE TABLE fiscal_certificates (
    "Id" uuid NOT NULL,
    "EstablishmentId" uuid NOT NULL,
    "SubjectName" text NOT NULL,
    "Thumbprint" text NOT NULL,
    "Cnpj" text NOT NULL,
    "ValidFromUtc" timestamp with time zone NOT NULL,
    "ValidUntilUtc" timestamp with time zone NOT NULL,
    "EncryptedRawData" bytea NOT NULL,
    "EncryptedPassword" bytea NOT NULL,
    "KeyIvBase64" text NOT NULL,
    "IsActive" boolean NOT NULL,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_fiscal_certificates" PRIMARY KEY ("Id")
);

CREATE TABLE fiscal_cscs (
    "Id" uuid NOT NULL,
    "EstablishmentId" uuid NOT NULL,
    "CscId" text NOT NULL,
    "EncryptedCscToken" bytea NOT NULL,
    "CscTokenMasked" text NOT NULL,
    "Environment" integer NOT NULL,
    "IsActive" boolean NOT NULL,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_fiscal_cscs" PRIMARY KEY ("Id")
);

CREATE TABLE fiscal_documents (
    "Id" uuid NOT NULL,
    "EstablishmentId" uuid NOT NULL,
    "SaleId" uuid,
    "DocumentType" integer NOT NULL,
    "Environment" integer NOT NULL,
    "Status" integer NOT NULL,
    "Series" integer NOT NULL,
    "Number" integer NOT NULL,
    "AccessKey" text NOT NULL,
    "IssuedAtUtc" timestamp with time zone NOT NULL,
    "TotalAmount" numeric(18,2) NOT NULL,
    "TotalDiscounts" numeric(18,2) NOT NULL,
    "TotalNetProductAmount" numeric NOT NULL,
    "TotalTaxesEstimated" numeric NOT NULL,
    "RecipientCpf" text,
    "RecipientName" text,
    "ProtocolNumber" text,
    "ProtocolReceivedAtUtc" timestamp with time zone,
    "SefazStatusCode" integer,
    "SefazStatusReason" text,
    "QrCodeUrl" text,
    "DanfeXmlContent" text,
    "CancellationXmlContent" text,
    "CancellationReason" text,
    "CancelledAtUtc" timestamp with time zone,
    "ReconcileClaimWorkerId" uuid,
    "ReconcileLeaseExpiresAtUtc" timestamp with time zone,
    "ReconcileRetryCount" integer NOT NULL,
    "NextReconcileAttemptAtUtc" timestamp with time zone,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_fiscal_documents" PRIMARY KEY ("Id")
);

CREATE TABLE fiscal_establishments (
    "Id" uuid NOT NULL,
    "BranchId" uuid NOT NULL,
    "CorporateName" text NOT NULL,
    "TradeName" text NOT NULL,
    "Cnpj" text NOT NULL,
    "StateRegistration" text NOT NULL,
    "MunicipalRegistration" text NOT NULL,
    "Cnae" text NOT NULL,
    "Regime" integer NOT NULL,
    "Street" text NOT NULL,
    "Number" text NOT NULL,
    "Complement" text,
    "Neighborhood" text NOT NULL,
    "CityCodeIbge" text NOT NULL,
    "CityName" text NOT NULL,
    "State" text NOT NULL,
    "PostalCode" text NOT NULL,
    "Environment" integer NOT NULL,
    "QrVersion" integer NOT NULL,
    "NfceDefaultSeries" integer NOT NULL,
    "NfceNextNumber" integer NOT NULL,
    "IsNfceEnabled" boolean NOT NULL,
    "IsActive" boolean NOT NULL,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_fiscal_establishments" PRIMARY KEY ("Id")
);

CREATE TABLE inbound_fiscal_documents (
    "Id" uuid NOT NULL,
    "AccessKey" text NOT NULL,
    "Number" integer NOT NULL,
    "Series" integer NOT NULL,
    "IssuedAtUtc" timestamp with time zone NOT NULL,
    "ReceivedAtUtc" timestamp with time zone NOT NULL,
    "SupplierCnpj" text NOT NULL,
    "SupplierName" text NOT NULL,
    "SupplierStateRegistration" text,
    "RecipientCnpj" text NOT NULL,
    "TotalProductsAmount" numeric(18,2) NOT NULL,
    "TotalInvoiceAmount" numeric(18,2) NOT NULL,
    "TotalIcmsAmount" numeric(18,2) NOT NULL,
    "RawXmlContent" text NOT NULL,
    "AssociatedPurchaseOrderId" uuid,
    "IsConciliated" boolean NOT NULL,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    "TenantId" uuid NOT NULL,
    CONSTRAINT "PK_inbound_fiscal_documents" PRIMARY KEY ("Id")
);

CREATE TABLE fiscal_document_items (
    "Id" uuid NOT NULL,
    "FiscalDocumentId" uuid NOT NULL,
    "ItemIndex" integer NOT NULL,
    "SkuId" uuid,
    "ProductCode" text NOT NULL,
    "Description" text NOT NULL,
    "Ncm" text NOT NULL,
    "Cest" text,
    "Cfop" text NOT NULL,
    "UnitOfMeasure" text NOT NULL,
    "Quantity" numeric(18,4) NOT NULL,
    "UnitPrice" numeric(18,4) NOT NULL,
    "TotalGrossAmount" numeric(18,2) NOT NULL,
    "DiscountAmount" numeric(18,2) NOT NULL,
    "NetAmount" numeric(18,2) NOT NULL,
    "SerialOrImei" text,
    "Origem" text NOT NULL,
    "Csosn" text NOT NULL,
    "EstimatedTaxRate" numeric NOT NULL,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    CONSTRAINT "PK_fiscal_document_items" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_fiscal_document_items_fiscal_documents_FiscalDocumentId" FOREIGN KEY ("FiscalDocumentId") REFERENCES fiscal_documents ("Id") ON DELETE CASCADE
);

CREATE TABLE inbound_fiscal_items (
    "Id" uuid NOT NULL,
    "InboundFiscalDocumentId" uuid NOT NULL,
    "ItemIndex" integer NOT NULL,
    "SupplierProductCode" text NOT NULL,
    "ProductDescription" text NOT NULL,
    "Ncm" text NOT NULL,
    "Cfop" text,
    "Quantity" numeric(18,4) NOT NULL,
    "UnitCost" numeric(18,4) NOT NULL,
    "TotalCost" numeric(18,2) NOT NULL,
    "LinkedCatalogSkuId" uuid,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone,
    CONSTRAINT "PK_inbound_fiscal_items" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_inbound_fiscal_items_inbound_fiscal_documents_InboundFiscal~" FOREIGN KEY ("InboundFiscalDocumentId") REFERENCES inbound_fiscal_documents ("Id") ON DELETE CASCADE
);

CREATE INDEX "IX_fiscal_certificates_TenantId_Thumbprint" ON fiscal_certificates ("TenantId", "Thumbprint");

CREATE INDEX "IX_fiscal_cscs_TenantId_CscId_Environment" ON fiscal_cscs ("TenantId", "CscId", "Environment");

CREATE INDEX "IX_fiscal_document_items_FiscalDocumentId" ON fiscal_document_items ("FiscalDocumentId");

CREATE UNIQUE INDEX "IX_fiscal_documents_TenantId_AccessKey" ON fiscal_documents ("TenantId", "AccessKey");

CREATE INDEX "IX_fiscal_documents_TenantId_Series_Number" ON fiscal_documents ("TenantId", "Series", "Number");

CREATE UNIQUE INDEX "IX_fiscal_establishments_TenantId_Cnpj" ON fiscal_establishments ("TenantId", "Cnpj");

CREATE UNIQUE INDEX "IX_inbound_fiscal_documents_TenantId_AccessKey" ON inbound_fiscal_documents ("TenantId", "AccessKey");

CREATE INDEX "IX_inbound_fiscal_items_InboundFiscalDocumentId" ON inbound_fiscal_items ("InboundFiscalDocumentId");

INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261117131642_AddUserJobTitle', '10.0.0');

COMMIT;



-- =============================================================================
-- SCRIPT DE INICIALIZACAO ENTERPRISE - ADMINISTRADOR MASTER COM ACESSO TOTAL
-- HB Studio ERP - Compativel com PostgreSQL 16/17/18 (Neon Serverless)
-- Email: henriquebuzeto@hbstudio.com
-- Permissoes: Todas as 133 chaves canonicas do PermissionCatalog
-- =============================================================================

START TRANSACTION;

-- 1. Tenant Principal
INSERT INTO tenants ("Id", "Name", "Code", "IsActive", "CreatedAtUtc", "UpdatedAtUtc")
VALUES ('a0000000-0000-0000-0000-000000000001', 'HB Studio Tecnologia', 'HBSTUDIO', true, NOW(), NOW())
ON CONFLICT ("Id") DO UPDATE SET "Name" = EXCLUDED."Name", "IsActive" = true;

-- 2. Filial Matriz
INSERT INTO branches ("Id", "TenantId", "Name", "Code", "IsHeadquarters", "IsActive", "CreatedAtUtc", "UpdatedAtUtc")
VALUES ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'HB Studio - Matriz SP', 'MATRIZ', true, true, NOW(), NOW())
ON CONFLICT ("Id") DO UPDATE SET "Name" = EXCLUDED."Name", "IsActive" = true;

-- 3. Perfil de Acesso Master (Super Administrador)
INSERT INTO roles ("Id", "TenantId", "Name", "Description", "CreatedAtUtc", "UpdatedAtUtc")
VALUES ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Administrador Master', 'Acesso Irrestrito Full a Todos os Modulos, Operacoes e Relatorios', NOW(), NOW())
ON CONFLICT ("Id") DO UPDATE SET "Name" = EXCLUDED."Name", "Description" = EXCLUDED."Description";

-- 4. Insercao de Todas as Permissoes da Role Master (133 chaves com Version = 1)
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'access.manage', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'audit.view', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'automation.manage', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'cash.approve_difference', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'cash.audit.view', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'cash.close', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'cash.discrepancy.resolve', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'cash.discrepancy.view', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'cash.movement.view', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'cash.open', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'cash.reconcile', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'cash.register.manage', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'cash.register.view', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'cash.shift.approve', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'cash.shift.count', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'cash.shift.view', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'cash.supply', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'cash.withdraw', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'catalog.cost.view', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'catalog.products.manage', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'catalog.products.view', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'crm.campaign.send', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'crm.interest.manage', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'crm.manage', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'crm.message.view', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'crm.view', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'customers.create', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'customers.edit', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'customers.export', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'customers.sensitive.view', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'customers.view', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'finance.banks.manage', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'finance.costcenters.manage', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'finance.journal.view', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'finance.pay', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'finance.payables.view', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'finance.period.close', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'finance.receivables.view', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'finance.reconcile', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'finance.reports.view', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'finance.settle', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'fiscal.cancel', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'fiscal.documents.view', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'fiscal.issue', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'fiscal.settings.manage', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'fleet.allocations.manage', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'fleet.cost.view', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'fleet.expenses.approve', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'fleet.expenses.create', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'fleet.fueling.create', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'fleet.fueling.manage', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'fleet.maintenance.complete', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'fleet.maintenance.manage', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'fleet.maintenance.view', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'fleet.odometer.correct', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'fleet.reimbursement.request', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'fleet.reports.view', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'fleet.settings.manage', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'fleet.trips.close', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'fleet.trips.create', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'fleet.trips.manage', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'fleet.vehicles.manage', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'fleet.view', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'inventory.adjust', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'inventory.cost.view', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'inventory.move', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'inventory.serials.view', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'inventory.view', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'manufacturing.cost.view', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'manufacturing.costs.view', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'manufacturing.execute', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'manufacturing.orders.manage', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'manufacturing.printers.manage', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'manufacturing.quality.approve', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'manufacturing.quote', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'manufacturing.quotes.manage', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'manufacturing.schedule', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'manufacturing.view', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'messaging.channels.manage', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'messaging.conversations.reply', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'messaging.conversations.view', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'messaging.notifications.view', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'messaging.send', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'messaging.templates.manage', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'messaging.view', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'partners.capital.manage', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'partners.compensation.manage', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'partners.distribution.approve', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'partners.distribution.pay', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'partners.distribution.propose', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'partners.distribution.settle', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'partners.loan.manage', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'partners.manage', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'partners.view', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'pricing.approve', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'pricing.cost.view', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'pricing.minimum.override', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'pricing.override', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'pricing.policies.manage', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'pricing.simulate', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'pricing.suggestions.generate', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'pricing.suggestions.view', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'pricing.view', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'projects.billing.manage', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'projects.cost.view', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'projects.manage', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'projects.view', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'purchases.approve', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'purchases.cost.view', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'purchases.create', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'purchases.receive', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'purchases.view', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'repairs.approve', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'repairs.assign', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'repairs.cost.view', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'repairs.create', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'repairs.deliver', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'repairs.diagnose', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'repairs.execute', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'repairs.parts.consume', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'repairs.parts.reserve', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'repairs.quality', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'repairs.quote', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'repairs.view', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'repairs.warranty', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'sales.cancel', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'sales.cost.view', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'sales.create', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'sales.discount.override', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'sales.pos.use', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'suppliers.create', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'suppliers.edit', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'suppliers.view', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;

-- 5. Usuario Master (Henrique Buzeto)
INSERT INTO users ("Id", "TenantId", "DefaultBranchId", "FullName", "Email", "JobTitle", "PasswordHash", "IsActive", "SecurityStamp", "CreatedAtUtc", "UpdatedAtUtc")
VALUES ('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Henrique Buzeto', 'henriquebuzeto@hbstudio.com', 'CEO', 'v1.600000.VsMWxYC6v53uqrSGoacdeA==.afg6R+UlwTENn3DyUFZmAuX9cPEQEIn2pfkfhmTYoEw=', true, 1, NOW(), NOW())
ON CONFLICT ("TenantId", "Email") DO UPDATE SET "PasswordHash" = EXCLUDED."PasswordHash", "JobTitle" = 'CEO', "IsActive" = true, "SecurityStamp" = users."SecurityStamp" + 1;

-- 6. Vinculo do Usuario ao Perfil Master
INSERT INTO user_roles ("UserId", "RoleId", "TenantId")
VALUES ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001')
ON CONFLICT ("UserId", "RoleId") DO NOTHING;

-- 7. Vinculo Societario Oficial no Modulo PartnersCapital (Socio-Administrador / ManagingPartner)
INSERT INTO partners ("Id", "TenantId", "PartyId", "Name", "DocumentNumber", "Email", "Type", "Status", "AdmissionDate", "MonthlyCompensationCap", "IsErpAccessEnabled", "CreatedAtUtc", "UpdatedAtUtc")
VALUES ('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'Henrique Buzeto', '000.000.000-00', 'henriquebuzeto@hbstudio.com', 1, 1, NOW(), 50000.00, true, NOW(), NOW())
ON CONFLICT ("Id") DO UPDATE SET "IsErpAccessEnabled" = true, "Status" = 1;

COMMIT;

