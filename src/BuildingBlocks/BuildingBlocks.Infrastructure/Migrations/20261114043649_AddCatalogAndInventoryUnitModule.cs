using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BuildingBlocks.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddCatalogAndInventoryUnitModule : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "product_brands",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_product_brands", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "product_categories",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    Slug = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    ParentCategoryId = table.Column<Guid>(type: "uuid", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_product_categories", x => x.Id);
                    table.ForeignKey(
                        name: "FK_product_categories_product_categories_ParentCategoryId",
                        column: x => x.ParentCategoryId,
                        principalTable: "product_categories",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "product_models",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    Kind = table.Column<int>(type: "integer", nullable: false),
                    SerializationPolicy = table.Column<int>(type: "integer", nullable: false),
                    BrandId = table.Column<Guid>(type: "uuid", nullable: false),
                    CategoryId = table.Column<Guid>(type: "uuid", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_product_models", x => x.Id);
                    table.ForeignKey(
                        name: "FK_product_models_product_brands_BrandId",
                        column: x => x.BrandId,
                        principalTable: "product_brands",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_product_models_product_categories_CategoryId",
                        column: x => x.CategoryId,
                        principalTable: "product_categories",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "product_skus",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ProductModelId = table.Column<Guid>(type: "uuid", nullable: false),
                    SkuCode = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    VariantName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    BarcodeEan = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    DefaultPrice = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    TechnicalSpecsJson = table.Column<string>(type: "jsonb", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_product_skus", x => x.Id);
                    table.ForeignKey(
                        name: "FK_product_skus_product_models_ProductModelId",
                        column: x => x.ProductModelId,
                        principalTable: "product_models",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "inventory_units",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ProductSkuId = table.Column<Guid>(type: "uuid", nullable: false),
                    SerialNumber = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Imei1 = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    Imei2 = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    Condition = table.Column<int>(type: "integer", nullable: false),
                    Grade = table.Column<int>(type: "integer", nullable: false),
                    BatteryHealthPercentage = table.Column<int>(type: "integer", nullable: true),
                    AcquisitionCost = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    SupplierPartyId = table.Column<Guid>(type: "uuid", nullable: true),
                    OperationalStatus = table.Column<int>(type: "integer", nullable: false),
                    InspectionNotes = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    AcquisitionDateUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_inventory_units", x => x.Id);
                    table.ForeignKey(
                        name: "FK_inventory_units_parties_SupplierPartyId",
                        column: x => x.SupplierPartyId,
                        principalTable: "parties",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_inventory_units_product_skus_ProductSkuId",
                        column: x => x.ProductSkuId,
                        principalTable: "product_skus",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_inventory_units_ProductSkuId",
                table: "inventory_units",
                column: "ProductSkuId");

            migrationBuilder.CreateIndex(
                name: "IX_inventory_units_SupplierPartyId",
                table: "inventory_units",
                column: "SupplierPartyId");

            migrationBuilder.CreateIndex(
                name: "IX_inventory_units_TenantId_Imei1",
                table: "inventory_units",
                columns: new[] { "TenantId", "Imei1" },
                unique: true,
                filter: "\"Imei1\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_inventory_units_TenantId_Imei2",
                table: "inventory_units",
                columns: new[] { "TenantId", "Imei2" },
                unique: true,
                filter: "\"Imei2\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_product_brands_TenantId_Name",
                table: "product_brands",
                columns: new[] { "TenantId", "Name" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_product_categories_ParentCategoryId",
                table: "product_categories",
                column: "ParentCategoryId");

            migrationBuilder.CreateIndex(
                name: "IX_product_categories_TenantId_Slug",
                table: "product_categories",
                columns: new[] { "TenantId", "Slug" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_product_models_BrandId",
                table: "product_models",
                column: "BrandId");

            migrationBuilder.CreateIndex(
                name: "IX_product_models_CategoryId",
                table: "product_models",
                column: "CategoryId");

            migrationBuilder.CreateIndex(
                name: "IX_product_skus_ProductModelId",
                table: "product_skus",
                column: "ProductModelId");

            migrationBuilder.CreateIndex(
                name: "IX_product_skus_TenantId_SkuCode",
                table: "product_skus",
                columns: new[] { "TenantId", "SkuCode" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "inventory_units");

            migrationBuilder.DropTable(
                name: "product_skus");

            migrationBuilder.DropTable(
                name: "product_models");

            migrationBuilder.DropTable(
                name: "product_brands");

            migrationBuilder.DropTable(
                name: "product_categories");
        }
    }
}
