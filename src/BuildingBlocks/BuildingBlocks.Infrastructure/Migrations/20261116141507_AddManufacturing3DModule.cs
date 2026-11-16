using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BuildingBlocks.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddManufacturing3DModule : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "manufacturing_design_assets",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "text", nullable: false),
                    Title = table.Column<string>(type: "text", nullable: false),
                    Category = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: true),
                    LicenseType = table.Column<string>(type: "text", nullable: false),
                    IsCommercialAllowed = table.Column<bool>(type: "boolean", nullable: false),
                    Author = table.Column<string>(type: "text", nullable: true),
                    AssociatedProductSkuId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    BranchId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_manufacturing_design_assets", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "manufacturing_orders",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OrderNumber = table.Column<string>(type: "text", nullable: false),
                    Type = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    SalesOrderId = table.Column<Guid>(type: "uuid", nullable: true),
                    TargetProductSkuId = table.Column<Guid>(type: "uuid", nullable: true),
                    DesignVersionId = table.Column<Guid>(type: "uuid", nullable: true),
                    AssignedPrinterId = table.Column<Guid>(type: "uuid", nullable: true),
                    MaterialProductSkuId = table.Column<Guid>(type: "uuid", nullable: false),
                    MaterialStockReservationId = table.Column<Guid>(type: "uuid", nullable: true),
                    PlannedQuantity = table.Column<int>(type: "integer", nullable: false),
                    ProducedQuantity = table.Column<int>(type: "integer", nullable: false),
                    ApprovedQuantity = table.Column<int>(type: "integer", nullable: false),
                    RejectedQuantity = table.Column<int>(type: "integer", nullable: false),
                    EstimatedFilamentGrams = table.Column<decimal>(type: "numeric", nullable: false),
                    EstimatedPrintTimeMinutes = table.Column<decimal>(type: "numeric", nullable: false),
                    TotalEstimatedCost = table.Column<decimal>(type: "numeric", nullable: false),
                    ActualMaterialCost = table.Column<decimal>(type: "numeric", nullable: false),
                    ActualEnergyCost = table.Column<decimal>(type: "numeric", nullable: false),
                    ActualMachineCost = table.Column<decimal>(type: "numeric", nullable: false),
                    ActualLaborCost = table.Column<decimal>(type: "numeric", nullable: false),
                    ActualWasteCost = table.Column<decimal>(type: "numeric", nullable: false),
                    FailureReason = table.Column<string>(type: "text", nullable: true),
                    StartedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    FinishedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    BranchId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_manufacturing_orders", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "manufacturing_printers",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "text", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Manufacturer = table.Column<string>(type: "text", nullable: false),
                    Model = table.Column<string>(type: "text", nullable: false),
                    SerialNumber = table.Column<string>(type: "text", nullable: true),
                    Technology = table.Column<int>(type: "integer", nullable: false),
                    BuildVolume = table.Column<string>(type: "text", nullable: false),
                    ExtruderCount = table.Column<int>(type: "integer", nullable: false),
                    CompatibleMaterials = table.Column<string>(type: "text", nullable: false),
                    NominalPowerWatts = table.Column<decimal>(type: "numeric", nullable: false),
                    AveragePowerWatts = table.Column<decimal>(type: "numeric", nullable: false),
                    AcquisitionCost = table.Column<decimal>(type: "numeric", nullable: false),
                    EstimatedLifespanHours = table.Column<decimal>(type: "numeric", nullable: false),
                    ConfiguredHourlyMachineCost = table.Column<decimal>(type: "numeric", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    StatusNote = table.Column<string>(type: "text", nullable: true),
                    StatusUpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    BranchId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_manufacturing_printers", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "manufacturing_quotes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    QuoteNumber = table.Column<string>(type: "text", nullable: false),
                    CustomerPartyId = table.Column<Guid>(type: "uuid", nullable: true),
                    Description = table.Column<string>(type: "text", nullable: false),
                    PlannedQuantity = table.Column<int>(type: "integer", nullable: false),
                    EstimatedMaterialCost = table.Column<decimal>(type: "numeric", nullable: false),
                    EstimatedEnergyCost = table.Column<decimal>(type: "numeric", nullable: false),
                    EstimatedMachineCost = table.Column<decimal>(type: "numeric", nullable: false),
                    EstimatedLaborCost = table.Column<decimal>(type: "numeric", nullable: false),
                    EstimatedPlannedWasteCost = table.Column<decimal>(type: "numeric", nullable: false),
                    MarkupPercent = table.Column<decimal>(type: "numeric", nullable: false),
                    SuggestedFinalPrice = table.Column<decimal>(type: "numeric", nullable: false),
                    IsApproved = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    BranchId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_manufacturing_quotes", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "manufacturing_spools",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ProductSkuId = table.Column<Guid>(type: "uuid", nullable: false),
                    SpoolCode = table.Column<string>(type: "text", nullable: false),
                    BatchNumber = table.Column<string>(type: "text", nullable: true),
                    MaterialType = table.Column<string>(type: "text", nullable: false),
                    Color = table.Column<string>(type: "text", nullable: false),
                    DiameterMm = table.Column<decimal>(type: "numeric", nullable: false),
                    InitialNetWeightGrams = table.Column<decimal>(type: "numeric", nullable: false),
                    RemainingWeightGrams = table.Column<decimal>(type: "numeric", nullable: false),
                    SpoolTareGrams = table.Column<decimal>(type: "numeric", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    OpenedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    BranchId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_manufacturing_spools", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "manufacturing_design_versions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AssetId = table.Column<Guid>(type: "uuid", nullable: false),
                    RevisionCode = table.Column<string>(type: "text", nullable: false),
                    FileFormat = table.Column<string>(type: "text", nullable: false),
                    StoragePath = table.Column<string>(type: "text", nullable: false),
                    Sha256Hash = table.Column<string>(type: "text", nullable: false),
                    FileSizeBytes = table.Column<long>(type: "bigint", nullable: false),
                    EstimatedDurationMinutes = table.Column<decimal>(type: "numeric", nullable: false),
                    EstimatedMassGrams = table.Column<decimal>(type: "numeric", nullable: false),
                    TechnicalNotes = table.Column<string>(type: "text", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_manufacturing_design_versions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_manufacturing_design_versions_manufacturing_design_assets_A~",
                        column: x => x.AssetId,
                        principalTable: "manufacturing_design_assets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "manufacturing_print_attempts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ManufacturingOrderId = table.Column<Guid>(type: "uuid", nullable: false),
                    AttemptNumber = table.Column<int>(type: "integer", nullable: false),
                    PrinterId = table.Column<Guid>(type: "uuid", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    EstimatedDurationMinutes = table.Column<decimal>(type: "numeric", nullable: false),
                    ActualDurationMinutes = table.Column<decimal>(type: "numeric", nullable: false),
                    EstimatedMassGrams = table.Column<decimal>(type: "numeric", nullable: false),
                    ActualMassGrams = table.Column<decimal>(type: "numeric", nullable: false),
                    FailureCategory = table.Column<int>(type: "integer", nullable: true),
                    FailureNotes = table.Column<string>(type: "text", nullable: true),
                    OperatorName = table.Column<string>(type: "text", nullable: true),
                    StartedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    FinishedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_manufacturing_print_attempts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_manufacturing_print_attempts_manufacturing_orders_Manufactu~",
                        column: x => x.ManufacturingOrderId,
                        principalTable: "manufacturing_orders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_manufacturing_design_versions_AssetId",
                table: "manufacturing_design_versions",
                column: "AssetId");

            migrationBuilder.CreateIndex(
                name: "IX_manufacturing_print_attempts_ManufacturingOrderId",
                table: "manufacturing_print_attempts",
                column: "ManufacturingOrderId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "manufacturing_design_versions");

            migrationBuilder.DropTable(
                name: "manufacturing_print_attempts");

            migrationBuilder.DropTable(
                name: "manufacturing_printers");

            migrationBuilder.DropTable(
                name: "manufacturing_quotes");

            migrationBuilder.DropTable(
                name: "manufacturing_spools");

            migrationBuilder.DropTable(
                name: "manufacturing_design_assets");

            migrationBuilder.DropTable(
                name: "manufacturing_orders");
        }
    }
}
