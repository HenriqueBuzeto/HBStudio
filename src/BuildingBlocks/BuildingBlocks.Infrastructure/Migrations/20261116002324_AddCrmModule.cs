using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BuildingBlocks.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddCrmModule : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "crm_leads",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    BranchId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    Phone = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    Email = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    Source = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    MainInterest = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    AssignedSellerUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    Notes = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    NextContactAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ConvertedPartyId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ConvertedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_crm_leads", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "crm_opportunities",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    BranchId = table.Column<Guid>(type: "uuid", nullable: false),
                    PartyId = table.Column<Guid>(type: "uuid", nullable: true),
                    LeadId = table.Column<Guid>(type: "uuid", nullable: true),
                    PipelineId = table.Column<Guid>(type: "uuid", nullable: false),
                    StageId = table.Column<Guid>(type: "uuid", nullable: false),
                    AssignedSellerUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    Origin = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    EstimatedValue = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    ExpectedClosingDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Priority = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    ClosedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LossReason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    ConvertedSalesQuoteId = table.Column<Guid>(type: "uuid", nullable: true),
                    ConvertedSaleId = table.Column<Guid>(type: "uuid", nullable: true),
                    AssociatedRepairOrderId = table.Column<Guid>(type: "uuid", nullable: true),
                    AssociatedPurchaseIntentId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_crm_opportunities", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "crm_pipelines",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    PipelineType = table.Column<int>(type: "integer", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_crm_pipelines", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "crm_purchase_intents",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    BranchId = table.Column<Guid>(type: "uuid", nullable: false),
                    PartyId = table.Column<Guid>(type: "uuid", nullable: false),
                    AssignedSellerUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    TargetProductModelId = table.Column<Guid>(type: "uuid", nullable: true),
                    TargetProductSkuId = table.Column<Guid>(type: "uuid", nullable: true),
                    Category = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Brand = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    ModelName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    DesiredStorageCapacity = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    DesiredColor = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    ColorIsFlexible = table.Column<bool>(type: "boolean", nullable: false),
                    Condition = table.Column<int>(type: "integer", nullable: false),
                    MinimumCosmeticGrade = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    MinimumBatteryHealthPercentage = table.Column<int>(type: "integer", nullable: true),
                    MaxBudgetPrice = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    PreferredBranchId = table.Column<Guid>(type: "uuid", nullable: true),
                    ValidUntilUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Priority = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    PreferredContactChannel = table.Column<int>(type: "integer", nullable: false),
                    Notes = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ClosedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CloseReason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_crm_purchase_intents", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "crm_opportunity_activities",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    BranchId = table.Column<Guid>(type: "uuid", nullable: false),
                    OpportunityId = table.Column<Guid>(type: "uuid", nullable: false),
                    ActivityType = table.Column<int>(type: "integer", nullable: false),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    ScheduledForUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    AssignedUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    Priority = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    CompletedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CompletionNotes = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_crm_opportunity_activities", x => x.Id);
                    table.ForeignKey(
                        name: "FK_crm_opportunity_activities_crm_opportunities_OpportunityId",
                        column: x => x.OpportunityId,
                        principalTable: "crm_opportunities",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "crm_pipeline_stages",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    PipelineId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    OrderIndex = table.Column<int>(type: "integer", nullable: false),
                    IsWonStage = table.Column<bool>(type: "boolean", nullable: false),
                    IsLostStage = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_crm_pipeline_stages", x => x.Id);
                    table.ForeignKey(
                        name: "FK_crm_pipeline_stages_crm_pipelines_PipelineId",
                        column: x => x.PipelineId,
                        principalTable: "crm_pipelines",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "crm_inventory_matches",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    BranchId = table.Column<Guid>(type: "uuid", nullable: false),
                    PurchaseIntentId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProductSkuId = table.Column<Guid>(type: "uuid", nullable: false),
                    InventoryUnitId = table.Column<Guid>(type: "uuid", nullable: true),
                    VerifiedPrice = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    MatchDetails = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    IsFullMatch = table.Column<bool>(type: "boolean", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    EvaluatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    StatusUpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RejectionReason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_crm_inventory_matches", x => x.Id);
                    table.ForeignKey(
                        name: "FK_crm_inventory_matches_crm_purchase_intents_PurchaseIntentId",
                        column: x => x.PurchaseIntentId,
                        principalTable: "crm_purchase_intents",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_crm_inventory_matches_PurchaseIntentId",
                table: "crm_inventory_matches",
                column: "PurchaseIntentId");

            migrationBuilder.CreateIndex(
                name: "IX_crm_inventory_matches_TenantId_InventoryUnitId",
                table: "crm_inventory_matches",
                columns: new[] { "TenantId", "InventoryUnitId" });

            migrationBuilder.CreateIndex(
                name: "IX_crm_inventory_matches_TenantId_PurchaseIntentId_ProductSkuId",
                table: "crm_inventory_matches",
                columns: new[] { "TenantId", "PurchaseIntentId", "ProductSkuId" });

            migrationBuilder.CreateIndex(
                name: "IX_crm_leads_TenantId_BranchId",
                table: "crm_leads",
                columns: new[] { "TenantId", "BranchId" });

            migrationBuilder.CreateIndex(
                name: "IX_crm_leads_TenantId_Status",
                table: "crm_leads",
                columns: new[] { "TenantId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_crm_opportunities_TenantId_BranchId_Status",
                table: "crm_opportunities",
                columns: new[] { "TenantId", "BranchId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_crm_opportunities_TenantId_PipelineId_StageId",
                table: "crm_opportunities",
                columns: new[] { "TenantId", "PipelineId", "StageId" });

            migrationBuilder.CreateIndex(
                name: "IX_crm_opportunity_activities_OpportunityId",
                table: "crm_opportunity_activities",
                column: "OpportunityId");

            migrationBuilder.CreateIndex(
                name: "IX_crm_opportunity_activities_TenantId_OpportunityId_Status",
                table: "crm_opportunity_activities",
                columns: new[] { "TenantId", "OpportunityId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_crm_pipeline_stages_PipelineId",
                table: "crm_pipeline_stages",
                column: "PipelineId");

            migrationBuilder.CreateIndex(
                name: "IX_crm_pipeline_stages_TenantId_PipelineId_OrderIndex",
                table: "crm_pipeline_stages",
                columns: new[] { "TenantId", "PipelineId", "OrderIndex" });

            migrationBuilder.CreateIndex(
                name: "IX_crm_pipelines_TenantId_IsActive",
                table: "crm_pipelines",
                columns: new[] { "TenantId", "IsActive" });

            migrationBuilder.CreateIndex(
                name: "IX_crm_purchase_intents_TenantId_BranchId_Status",
                table: "crm_purchase_intents",
                columns: new[] { "TenantId", "BranchId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_crm_purchase_intents_TenantId_PartyId",
                table: "crm_purchase_intents",
                columns: new[] { "TenantId", "PartyId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "crm_inventory_matches");

            migrationBuilder.DropTable(
                name: "crm_leads");

            migrationBuilder.DropTable(
                name: "crm_opportunity_activities");

            migrationBuilder.DropTable(
                name: "crm_pipeline_stages");

            migrationBuilder.DropTable(
                name: "crm_purchase_intents");

            migrationBuilder.DropTable(
                name: "crm_opportunities");

            migrationBuilder.DropTable(
                name: "crm_pipelines");
        }
    }
}
