using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BuildingBlocks.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddRepairServiceModule : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "repair_orders",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    BranchId = table.Column<Guid>(type: "uuid", nullable: false),
                    OrderNumber = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    CustomerId = table.Column<Guid>(type: "uuid", nullable: false),
                    CustomerEquipmentId = table.Column<Guid>(type: "uuid", nullable: false),
                    AssignedTechnicianId = table.Column<Guid>(type: "uuid", nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    ReportedDefect = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    PhysicalConditionNotes = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    AccessoriesIncluded = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    DiagnosticNotes = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    ResolutionNotes = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    ReceivedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    EstimatedCompletionUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DiagnosisCompletedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RepairedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    QualityCheckedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeliveredAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    OriginalRepairOrderId = table.Column<Guid>(type: "uuid", nullable: true),
                    LegalWarrantyDays = table.Column<int>(type: "integer", nullable: false),
                    AdditionalWarrantyDays = table.Column<int>(type: "integer", nullable: false),
                    WarrantyExpiresAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeliveredToPersonName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    DeliveredToDocumentNumber = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    DeliveryNotes = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    StockReservationId = table.Column<Guid>(type: "uuid", nullable: true),
                    TotalLaborPrice = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    TotalPartsPrice = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    TotalDiscount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    FinalPrice = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    TotalPartsCost = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    TotalLaborCost = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_repair_orders", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "repair_checklist_items",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    RepairOrderId = table.Column<Guid>(type: "uuid", nullable: false),
                    Category = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    ItemName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    Notes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    IsOutputCheck = table.Column<bool>(type: "boolean", nullable: false),
                    CheckedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_repair_checklist_items", x => x.Id);
                    table.ForeignKey(
                        name: "FK_repair_checklist_items_repair_orders_RepairOrderId",
                        column: x => x.RepairOrderId,
                        principalTable: "repair_orders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "repair_estimate_items",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    RepairOrderId = table.Column<Guid>(type: "uuid", nullable: false),
                    ItemType = table.Column<int>(type: "integer", nullable: false),
                    Description = table.Column<string>(type: "character varying(250)", maxLength: 250, nullable: false),
                    Quantity = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: false),
                    UnitPrice = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    UnitCost = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    ProductSkuId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_repair_estimate_items", x => x.Id);
                    table.ForeignKey(
                        name: "FK_repair_estimate_items_repair_orders_RepairOrderId",
                        column: x => x.RepairOrderId,
                        principalTable: "repair_orders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "repair_evidence_attachments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    RepairOrderId = table.Column<Guid>(type: "uuid", nullable: false),
                    FileName = table.Column<string>(type: "character varying(250)", maxLength: 250, nullable: false),
                    StorageUrl = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    FileType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    FileSizeBytes = table.Column<long>(type: "bigint", nullable: false),
                    Category = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    UploadedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_repair_evidence_attachments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_repair_evidence_attachments_repair_orders_RepairOrderId",
                        column: x => x.RepairOrderId,
                        principalTable: "repair_orders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "repair_part_usages",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    RepairOrderId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProductSkuId = table.Column<Guid>(type: "uuid", nullable: false),
                    PartDescription = table.Column<string>(type: "character varying(250)", maxLength: 250, nullable: false),
                    Quantity = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: false),
                    ActualUnitCost = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    InventoryUnitId = table.Column<Guid>(type: "uuid", nullable: true),
                    StockMovementId = table.Column<Guid>(type: "uuid", nullable: true),
                    ConsumedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_repair_part_usages", x => x.Id);
                    table.ForeignKey(
                        name: "FK_repair_part_usages_repair_orders_RepairOrderId",
                        column: x => x.RepairOrderId,
                        principalTable: "repair_orders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "repair_status_history",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    RepairOrderId = table.Column<Guid>(type: "uuid", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    TimestampUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_repair_status_history", x => x.Id);
                    table.ForeignKey(
                        name: "FK_repair_status_history_repair_orders_RepairOrderId",
                        column: x => x.RepairOrderId,
                        principalTable: "repair_orders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "repair_warranty_claims",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    RepairOrderId = table.Column<Guid>(type: "uuid", nullable: false),
                    DefectDescription = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    ClaimDateUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Decision = table.Column<int>(type: "integer", nullable: false),
                    DecisionRationale = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    DecisionDateUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    FollowUpRepairOrderId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_repair_warranty_claims", x => x.Id);
                    table.ForeignKey(
                        name: "FK_repair_warranty_claims_repair_orders_RepairOrderId",
                        column: x => x.RepairOrderId,
                        principalTable: "repair_orders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_repair_checklist_items_RepairOrderId",
                table: "repair_checklist_items",
                column: "RepairOrderId");

            migrationBuilder.CreateIndex(
                name: "IX_repair_checklist_items_TenantId_RepairOrderId_ItemName_IsOu~",
                table: "repair_checklist_items",
                columns: new[] { "TenantId", "RepairOrderId", "ItemName", "IsOutputCheck" });

            migrationBuilder.CreateIndex(
                name: "IX_repair_estimate_items_RepairOrderId",
                table: "repair_estimate_items",
                column: "RepairOrderId");

            migrationBuilder.CreateIndex(
                name: "IX_repair_estimate_items_TenantId_RepairOrderId",
                table: "repair_estimate_items",
                columns: new[] { "TenantId", "RepairOrderId" });

            migrationBuilder.CreateIndex(
                name: "IX_repair_evidence_attachments_RepairOrderId",
                table: "repair_evidence_attachments",
                column: "RepairOrderId");

            migrationBuilder.CreateIndex(
                name: "IX_repair_evidence_attachments_TenantId_RepairOrderId",
                table: "repair_evidence_attachments",
                columns: new[] { "TenantId", "RepairOrderId" });

            migrationBuilder.CreateIndex(
                name: "IX_repair_orders_TenantId_BranchId_Status",
                table: "repair_orders",
                columns: new[] { "TenantId", "BranchId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_repair_orders_TenantId_CustomerEquipmentId",
                table: "repair_orders",
                columns: new[] { "TenantId", "CustomerEquipmentId" });

            migrationBuilder.CreateIndex(
                name: "IX_repair_orders_TenantId_CustomerId",
                table: "repair_orders",
                columns: new[] { "TenantId", "CustomerId" });

            migrationBuilder.CreateIndex(
                name: "IX_repair_orders_TenantId_OrderNumber",
                table: "repair_orders",
                columns: new[] { "TenantId", "OrderNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_repair_orders_TenantId_OriginalRepairOrderId",
                table: "repair_orders",
                columns: new[] { "TenantId", "OriginalRepairOrderId" });

            migrationBuilder.CreateIndex(
                name: "IX_repair_part_usages_RepairOrderId",
                table: "repair_part_usages",
                column: "RepairOrderId");

            migrationBuilder.CreateIndex(
                name: "IX_repair_part_usages_TenantId_RepairOrderId_ProductSkuId",
                table: "repair_part_usages",
                columns: new[] { "TenantId", "RepairOrderId", "ProductSkuId" });

            migrationBuilder.CreateIndex(
                name: "IX_repair_status_history_RepairOrderId",
                table: "repair_status_history",
                column: "RepairOrderId");

            migrationBuilder.CreateIndex(
                name: "IX_repair_status_history_TenantId_RepairOrderId_TimestampUtc",
                table: "repair_status_history",
                columns: new[] { "TenantId", "RepairOrderId", "TimestampUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_repair_warranty_claims_RepairOrderId",
                table: "repair_warranty_claims",
                column: "RepairOrderId");

            migrationBuilder.CreateIndex(
                name: "IX_repair_warranty_claims_TenantId_RepairOrderId",
                table: "repair_warranty_claims",
                columns: new[] { "TenantId", "RepairOrderId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "repair_checklist_items");

            migrationBuilder.DropTable(
                name: "repair_estimate_items");

            migrationBuilder.DropTable(
                name: "repair_evidence_attachments");

            migrationBuilder.DropTable(
                name: "repair_part_usages");

            migrationBuilder.DropTable(
                name: "repair_status_history");

            migrationBuilder.DropTable(
                name: "repair_warranty_claims");

            migrationBuilder.DropTable(
                name: "repair_orders");
        }
    }
}
