using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BuildingBlocks.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddDigitalProjectsModule : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "digital_projects",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ProjectCode = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "text", nullable: false),
                    Type = table.Column<int>(type: "integer", nullable: false),
                    PricingModel = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    CustomerPartyId = table.Column<Guid>(type: "uuid", nullable: false),
                    CrmOpportunityId = table.Column<Guid>(type: "uuid", nullable: true),
                    SalesOrderId = table.Column<Guid>(type: "uuid", nullable: true),
                    LeadTechnicianUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    LeadTechnicianName = table.Column<string>(type: "text", nullable: false),
                    PlannedStartDateUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    PlannedDeliveryDateUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ActualStartDateUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ActualCompletionDateUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ContractedPrice = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    EstimatedHours = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    TotalActualLaborCost = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    TotalThirdPartyCost = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    TotalExpensesCost = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    InvoicedAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    PaidAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    IntellectualPropertyPolicy = table.Column<string>(type: "text", nullable: false),
                    LgpdProcessingRole = table.Column<string>(type: "text", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    BranchId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_digital_projects", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "digital_project_change_requests",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    DigitalProjectId = table.Column<Guid>(type: "uuid", nullable: false),
                    CrNumber = table.Column<string>(type: "text", nullable: false),
                    Title = table.Column<string>(type: "text", nullable: false),
                    RequesterName = table.Column<string>(type: "text", nullable: false),
                    Reason = table.Column<string>(type: "text", nullable: false),
                    ProposedScopeChanges = table.Column<string>(type: "text", nullable: false),
                    ImpactHours = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    ImpactCost = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    ImpactPrice = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    ImpactDays = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    ApprovedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DecisionNotes = table.Column<string>(type: "text", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_digital_project_change_requests", x => x.Id);
                    table.ForeignKey(
                        name: "FK_digital_project_change_requests_digital_projects_DigitalPro~",
                        column: x => x.DigitalProjectId,
                        principalTable: "digital_projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "digital_project_contract_versions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    DigitalProjectId = table.Column<Guid>(type: "uuid", nullable: false),
                    VersionNumber = table.Column<int>(type: "integer", nullable: false),
                    ContractTitle = table.Column<string>(type: "text", nullable: false),
                    TermsSummary = table.Column<string>(type: "text", nullable: false),
                    DocumentUri = table.Column<string>(type: "text", nullable: false),
                    Sha256Hash = table.Column<string>(type: "text", nullable: false),
                    RegisteredByUserName = table.Column<string>(type: "text", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_digital_project_contract_versions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_digital_project_contract_versions_digital_projects_DigitalP~",
                        column: x => x.DigitalProjectId,
                        principalTable: "digital_projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "digital_project_deliverables",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    DigitalProjectId = table.Column<Guid>(type: "uuid", nullable: false),
                    MilestoneId = table.Column<Guid>(type: "uuid", nullable: true),
                    Title = table.Column<string>(type: "text", nullable: false),
                    Type = table.Column<int>(type: "integer", nullable: false),
                    ArtifactVersion = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: false),
                    StorageUriOrUrl = table.Column<string>(type: "text", nullable: false),
                    Sha256Hash = table.Column<string>(type: "text", nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    SubmittedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    AcceptedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    AcceptanceNotes = table.Column<string>(type: "text", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_digital_project_deliverables", x => x.Id);
                    table.ForeignKey(
                        name: "FK_digital_project_deliverables_digital_projects_DigitalProjec~",
                        column: x => x.DigitalProjectId,
                        principalTable: "digital_projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "digital_project_milestones",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    DigitalProjectId = table.Column<Guid>(type: "uuid", nullable: false),
                    SequenceOrder = table.Column<int>(type: "integer", nullable: false),
                    Title = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: false),
                    TargetDateUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    MilestonePrice = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    IsBillable = table.Column<bool>(type: "boolean", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    ApprovedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ApprovedByNotes = table.Column<string>(type: "text", nullable: true),
                    HasBeenBilled = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_digital_project_milestones", x => x.Id);
                    table.ForeignKey(
                        name: "FK_digital_project_milestones_digital_projects_DigitalProjectId",
                        column: x => x.DigitalProjectId,
                        principalTable: "digital_projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "digital_project_tasks",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    DigitalProjectId = table.Column<Guid>(type: "uuid", nullable: false),
                    MilestoneId = table.Column<Guid>(type: "uuid", nullable: true),
                    Title = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: false),
                    AssignedUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    AssignedUserName = table.Column<string>(type: "text", nullable: true),
                    EstimatedHours = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    DueDateUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    CompletedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_digital_project_tasks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_digital_project_tasks_digital_projects_DigitalProjectId",
                        column: x => x.DigitalProjectId,
                        principalTable: "digital_projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "digital_project_time_entries",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    DigitalProjectId = table.Column<Guid>(type: "uuid", nullable: false),
                    DigitalProjectTaskId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserName = table.Column<string>(type: "text", nullable: false),
                    WorkDateUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    DurationHours = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    ActivityType = table.Column<int>(type: "integer", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: false),
                    IsBillable = table.Column<bool>(type: "boolean", nullable: false),
                    HistoricalHourlyCost = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    IsApproved = table.Column<bool>(type: "boolean", nullable: false),
                    ApprovedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_digital_project_time_entries", x => x.Id);
                    table.ForeignKey(
                        name: "FK_digital_project_time_entries_digital_projects_DigitalProjec~",
                        column: x => x.DigitalProjectId,
                        principalTable: "digital_projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_digital_project_change_requests_DigitalProjectId",
                table: "digital_project_change_requests",
                column: "DigitalProjectId");

            migrationBuilder.CreateIndex(
                name: "IX_digital_project_change_requests_TenantId_DigitalProjectId_C~",
                table: "digital_project_change_requests",
                columns: new[] { "TenantId", "DigitalProjectId", "CrNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_digital_project_contract_versions_DigitalProjectId",
                table: "digital_project_contract_versions",
                column: "DigitalProjectId");

            migrationBuilder.CreateIndex(
                name: "IX_digital_project_contract_versions_TenantId_DigitalProjectId~",
                table: "digital_project_contract_versions",
                columns: new[] { "TenantId", "DigitalProjectId", "VersionNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_digital_project_deliverables_DigitalProjectId",
                table: "digital_project_deliverables",
                column: "DigitalProjectId");

            migrationBuilder.CreateIndex(
                name: "IX_digital_project_deliverables_TenantId_DigitalProjectId",
                table: "digital_project_deliverables",
                columns: new[] { "TenantId", "DigitalProjectId" });

            migrationBuilder.CreateIndex(
                name: "IX_digital_project_milestones_DigitalProjectId",
                table: "digital_project_milestones",
                column: "DigitalProjectId");

            migrationBuilder.CreateIndex(
                name: "IX_digital_project_milestones_TenantId_DigitalProjectId_Sequen~",
                table: "digital_project_milestones",
                columns: new[] { "TenantId", "DigitalProjectId", "SequenceOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_digital_project_tasks_DigitalProjectId",
                table: "digital_project_tasks",
                column: "DigitalProjectId");

            migrationBuilder.CreateIndex(
                name: "IX_digital_project_tasks_TenantId_DigitalProjectId_Status",
                table: "digital_project_tasks",
                columns: new[] { "TenantId", "DigitalProjectId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_digital_project_time_entries_DigitalProjectId",
                table: "digital_project_time_entries",
                column: "DigitalProjectId");

            migrationBuilder.CreateIndex(
                name: "IX_digital_project_time_entries_TenantId_DigitalProjectId_Work~",
                table: "digital_project_time_entries",
                columns: new[] { "TenantId", "DigitalProjectId", "WorkDateUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_digital_project_time_entries_TenantId_UserId",
                table: "digital_project_time_entries",
                columns: new[] { "TenantId", "UserId" });

            migrationBuilder.CreateIndex(
                name: "IX_digital_projects_TenantId_CustomerPartyId",
                table: "digital_projects",
                columns: new[] { "TenantId", "CustomerPartyId" });

            migrationBuilder.CreateIndex(
                name: "IX_digital_projects_TenantId_ProjectCode",
                table: "digital_projects",
                columns: new[] { "TenantId", "ProjectCode" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_digital_projects_TenantId_Status",
                table: "digital_projects",
                columns: new[] { "TenantId", "Status" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "digital_project_change_requests");

            migrationBuilder.DropTable(
                name: "digital_project_contract_versions");

            migrationBuilder.DropTable(
                name: "digital_project_deliverables");

            migrationBuilder.DropTable(
                name: "digital_project_milestones");

            migrationBuilder.DropTable(
                name: "digital_project_tasks");

            migrationBuilder.DropTable(
                name: "digital_project_time_entries");

            migrationBuilder.DropTable(
                name: "digital_projects");
        }
    }
}
