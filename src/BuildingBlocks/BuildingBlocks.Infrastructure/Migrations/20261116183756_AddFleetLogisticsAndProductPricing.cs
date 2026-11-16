using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BuildingBlocks.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddFleetLogisticsAndProductPricing : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "fleet_vehicles",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    BranchId = table.Column<Guid>(type: "uuid", nullable: false),
                    InternalCode = table.Column<string>(type: "text", nullable: false),
                    Plate = table.Column<string>(type: "text", nullable: false),
                    Brand = table.Column<string>(type: "text", nullable: false),
                    Model = table.Column<string>(type: "text", nullable: false),
                    Year = table.Column<int>(type: "integer", nullable: false),
                    Type = table.Column<int>(type: "integer", nullable: false),
                    Ownership = table.Column<int>(type: "integer", nullable: false),
                    Fuel = table.Column<int>(type: "integer", nullable: false),
                    TankCapacityLiters = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    InitialOdometerKm = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    CurrentOdometerKm = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    AverageConsumptionKmPerLiter = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    OwnerPartnerId = table.Column<Guid>(type: "uuid", nullable: true),
                    ResponsibleName = table.Column<string>(type: "text", nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    UtilizationStartDateUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_fleet_vehicles", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "product_price_suggestions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    BranchId = table.Column<Guid>(type: "uuid", nullable: false),
                    InventoryUnitId = table.Column<Guid>(type: "uuid", nullable: true),
                    ProductSkuId = table.Column<Guid>(type: "uuid", nullable: false),
                    PricingPolicyId = table.Column<Guid>(type: "uuid", nullable: true),
                    ReferencePrice = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    TargetNegotiationPrice = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    RealAcquisitionCost = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    AllocatedLogisticsCost = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    CommercialProvisions = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    TotalCostBase = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    MarkupRateApplied = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: false),
                    CalculatedSuggestedPrice = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    MinimumAllowedPrice = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    ApprovedFinalPrice = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    CalculationBreakdownJson = table.Column<string>(type: "text", nullable: false),
                    ApprovedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    ApprovedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ApprovalNotes = table.Column<string>(type: "text", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_product_price_suggestions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "product_pricing_policies",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    BranchId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Scope = table.Column<int>(type: "integer", nullable: false),
                    TargetCategoryId = table.Column<Guid>(type: "uuid", nullable: true),
                    TargetBrandId = table.Column<Guid>(type: "uuid", nullable: true),
                    TargetModelId = table.Column<Guid>(type: "uuid", nullable: true),
                    TargetSkuId = table.Column<Guid>(type: "uuid", nullable: true),
                    TargetCondition = table.Column<int>(type: "integer", nullable: true),
                    TargetAcquisitionDiscountRate = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: false),
                    TargetMarkupRate = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: false),
                    TargetMinMarginRate = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: false),
                    EstimatedPickupLogisticsRate = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: false),
                    EstimatedDeliveryLogisticsRate = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: false),
                    OtherCommercialCostRate = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: false),
                    RoundingRule = table.Column<int>(type: "integer", nullable: false),
                    PreferRealCostOverEstimate = table.Column<bool>(type: "boolean", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    VersionNumber = table.Column<int>(type: "integer", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_product_pricing_policies", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "fleet_maintenance_plans",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    VehicleId = table.Column<Guid>(type: "uuid", nullable: false),
                    PlanName = table.Column<string>(type: "text", nullable: false),
                    RecommendedIntervalKm = table.Column<int>(type: "integer", nullable: false),
                    RecommendedIntervalDays = table.Column<int>(type: "integer", nullable: false),
                    LastServiceOdometerKm = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    LastServiceDateUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    NextServiceOdometerKm = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    NextServiceDateUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    OilSpecification = table.Column<string>(type: "text", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_fleet_maintenance_plans", x => x.Id);
                    table.ForeignKey(
                        name: "FK_fleet_maintenance_plans_fleet_vehicles_VehicleId",
                        column: x => x.VehicleId,
                        principalTable: "fleet_vehicles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "fleet_trips",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    BranchId = table.Column<Guid>(type: "uuid", nullable: false),
                    TripNumber = table.Column<string>(type: "text", nullable: false),
                    VehicleId = table.Column<Guid>(type: "uuid", nullable: false),
                    DriverUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    DriverName = table.Column<string>(type: "text", nullable: false),
                    Purpose = table.Column<int>(type: "integer", nullable: false),
                    OriginCity = table.Column<string>(type: "text", nullable: false),
                    DestinationCity = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: true),
                    StartTimeUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    EndTimeUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    InitialOdometerKm = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    FinalOdometerKm = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    DistanceKm = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    TotalFuelExpenses = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    TotalOtherExpenses = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    TotalAllocatedCost = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_fleet_trips", x => x.Id);
                    table.ForeignKey(
                        name: "FK_fleet_trips_fleet_vehicles_VehicleId",
                        column: x => x.VehicleId,
                        principalTable: "fleet_vehicles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "fleet_maintenance_services",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    BranchId = table.Column<Guid>(type: "uuid", nullable: false),
                    VehicleId = table.Column<Guid>(type: "uuid", nullable: false),
                    MaintenancePlanId = table.Column<Guid>(type: "uuid", nullable: true),
                    Type = table.Column<int>(type: "integer", nullable: false),
                    ServiceDateUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    OdometerKm = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    WorkshopName = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: false),
                    PartsCost = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    LaborCost = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    TotalCost = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    OilBrandAndSpecs = table.Column<string>(type: "text", nullable: true),
                    FilterReplaced = table.Column<bool>(type: "boolean", nullable: false),
                    NextRecommendedOdometerKm = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    NextRecommendedDateUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    PaymentMethod = table.Column<int>(type: "integer", nullable: false),
                    FinancialStatus = table.Column<int>(type: "integer", nullable: false),
                    AccountPayableId = table.Column<Guid>(type: "uuid", nullable: true),
                    PayingPartnerId = table.Column<Guid>(type: "uuid", nullable: true),
                    PartnerReimbursementId = table.Column<Guid>(type: "uuid", nullable: true),
                    InvoiceDocumentReference = table.Column<string>(type: "text", nullable: true),
                    ReceiptAttachmentPath = table.Column<string>(type: "text", nullable: true),
                    RegisteredByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    IdempotencyKey = table.Column<string>(type: "text", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_fleet_maintenance_services", x => x.Id);
                    table.ForeignKey(
                        name: "FK_fleet_maintenance_services_fleet_maintenance_plans_Maintena~",
                        column: x => x.MaintenancePlanId,
                        principalTable: "fleet_maintenance_plans",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_fleet_maintenance_services_fleet_vehicles_VehicleId",
                        column: x => x.VehicleId,
                        principalTable: "fleet_vehicles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "fleet_expenses",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    BranchId = table.Column<Guid>(type: "uuid", nullable: false),
                    Category = table.Column<int>(type: "integer", nullable: false),
                    VehicleId = table.Column<Guid>(type: "uuid", nullable: true),
                    TripId = table.Column<Guid>(type: "uuid", nullable: true),
                    ExpenseDateUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    SupplierName = table.Column<string>(type: "text", nullable: true),
                    PaymentMethod = table.Column<int>(type: "integer", nullable: false),
                    FinancialStatus = table.Column<int>(type: "integer", nullable: false),
                    AccountPayableId = table.Column<Guid>(type: "uuid", nullable: true),
                    PayingPartnerId = table.Column<Guid>(type: "uuid", nullable: true),
                    PartnerReimbursementId = table.Column<Guid>(type: "uuid", nullable: true),
                    DocumentReference = table.Column<string>(type: "text", nullable: true),
                    ReceiptAttachmentPath = table.Column<string>(type: "text", nullable: true),
                    RegisteredByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    IdempotencyKey = table.Column<string>(type: "text", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_fleet_expenses", x => x.Id);
                    table.ForeignKey(
                        name: "FK_fleet_expenses_fleet_trips_TripId",
                        column: x => x.TripId,
                        principalTable: "fleet_trips",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_fleet_expenses_fleet_vehicles_VehicleId",
                        column: x => x.VehicleId,
                        principalTable: "fleet_vehicles",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "fleet_fuelings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    BranchId = table.Column<Guid>(type: "uuid", nullable: false),
                    VehicleId = table.Column<Guid>(type: "uuid", nullable: false),
                    TripId = table.Column<Guid>(type: "uuid", nullable: true),
                    FuelingDateUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    GasStationName = table.Column<string>(type: "text", nullable: false),
                    Fuel = table.Column<int>(type: "integer", nullable: false),
                    TotalAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Liters = table.Column<decimal>(type: "numeric(18,3)", precision: 18, scale: 3, nullable: true),
                    PricePerLiter = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: true),
                    OdometerKm = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    IsFullTank = table.Column<bool>(type: "boolean", nullable: false),
                    PaymentMethod = table.Column<int>(type: "integer", nullable: false),
                    FinancialStatus = table.Column<int>(type: "integer", nullable: false),
                    FinancialAccountId = table.Column<Guid>(type: "uuid", nullable: true),
                    AccountPayableId = table.Column<Guid>(type: "uuid", nullable: true),
                    PartnerReimbursementId = table.Column<Guid>(type: "uuid", nullable: true),
                    PayingPartnerId = table.Column<Guid>(type: "uuid", nullable: true),
                    ReceiptDocumentReference = table.Column<string>(type: "text", nullable: true),
                    ReceiptAttachmentPath = table.Column<string>(type: "text", nullable: true),
                    RegisteredByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    IdempotencyKey = table.Column<string>(type: "text", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_fleet_fuelings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_fleet_fuelings_fleet_trips_TripId",
                        column: x => x.TripId,
                        principalTable: "fleet_trips",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_fleet_fuelings_fleet_vehicles_VehicleId",
                        column: x => x.VehicleId,
                        principalTable: "fleet_vehicles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "fleet_trip_allocations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TripId = table.Column<Guid>(type: "uuid", nullable: false),
                    TargetType = table.Column<int>(type: "integer", nullable: false),
                    TargetId = table.Column<Guid>(type: "uuid", nullable: false),
                    TargetReference = table.Column<string>(type: "text", nullable: false),
                    InventoryUnitId = table.Column<Guid>(type: "uuid", nullable: true),
                    ProductSkuId = table.Column<Guid>(type: "uuid", nullable: true),
                    AllocatedAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Method = table.Column<int>(type: "integer", nullable: false),
                    AllocationPercentage = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: false),
                    Justification = table.Column<string>(type: "text", nullable: true),
                    AllocatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    AllocatedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_fleet_trip_allocations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_fleet_trip_allocations_fleet_trips_TripId",
                        column: x => x.TripId,
                        principalTable: "fleet_trips",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_fleet_expenses_TenantId_Category_ExpenseDateUtc",
                table: "fleet_expenses",
                columns: new[] { "TenantId", "Category", "ExpenseDateUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_fleet_expenses_TenantId_FinancialStatus",
                table: "fleet_expenses",
                columns: new[] { "TenantId", "FinancialStatus" });

            migrationBuilder.CreateIndex(
                name: "IX_fleet_expenses_TenantId_IdempotencyKey",
                table: "fleet_expenses",
                columns: new[] { "TenantId", "IdempotencyKey" },
                unique: true,
                filter: "\"IdempotencyKey\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_fleet_expenses_TenantId_TripId",
                table: "fleet_expenses",
                columns: new[] { "TenantId", "TripId" });

            migrationBuilder.CreateIndex(
                name: "IX_fleet_expenses_TenantId_VehicleId",
                table: "fleet_expenses",
                columns: new[] { "TenantId", "VehicleId" });

            migrationBuilder.CreateIndex(
                name: "IX_fleet_expenses_TripId",
                table: "fleet_expenses",
                column: "TripId");

            migrationBuilder.CreateIndex(
                name: "IX_fleet_expenses_VehicleId",
                table: "fleet_expenses",
                column: "VehicleId");

            migrationBuilder.CreateIndex(
                name: "IX_fleet_fuelings_TenantId_FinancialStatus",
                table: "fleet_fuelings",
                columns: new[] { "TenantId", "FinancialStatus" });

            migrationBuilder.CreateIndex(
                name: "IX_fleet_fuelings_TenantId_IdempotencyKey",
                table: "fleet_fuelings",
                columns: new[] { "TenantId", "IdempotencyKey" },
                unique: true,
                filter: "\"IdempotencyKey\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_fleet_fuelings_TenantId_TripId",
                table: "fleet_fuelings",
                columns: new[] { "TenantId", "TripId" });

            migrationBuilder.CreateIndex(
                name: "IX_fleet_fuelings_TenantId_VehicleId_FuelingDateUtc",
                table: "fleet_fuelings",
                columns: new[] { "TenantId", "VehicleId", "FuelingDateUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_fleet_fuelings_TripId",
                table: "fleet_fuelings",
                column: "TripId");

            migrationBuilder.CreateIndex(
                name: "IX_fleet_fuelings_VehicleId",
                table: "fleet_fuelings",
                column: "VehicleId");

            migrationBuilder.CreateIndex(
                name: "IX_fleet_maintenance_plans_TenantId_VehicleId_IsActive",
                table: "fleet_maintenance_plans",
                columns: new[] { "TenantId", "VehicleId", "IsActive" });

            migrationBuilder.CreateIndex(
                name: "IX_fleet_maintenance_plans_VehicleId",
                table: "fleet_maintenance_plans",
                column: "VehicleId");

            migrationBuilder.CreateIndex(
                name: "IX_fleet_maintenance_services_MaintenancePlanId",
                table: "fleet_maintenance_services",
                column: "MaintenancePlanId");

            migrationBuilder.CreateIndex(
                name: "IX_fleet_maintenance_services_TenantId_FinancialStatus",
                table: "fleet_maintenance_services",
                columns: new[] { "TenantId", "FinancialStatus" });

            migrationBuilder.CreateIndex(
                name: "IX_fleet_maintenance_services_TenantId_VehicleId_ServiceDateUtc",
                table: "fleet_maintenance_services",
                columns: new[] { "TenantId", "VehicleId", "ServiceDateUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_fleet_maintenance_services_VehicleId",
                table: "fleet_maintenance_services",
                column: "VehicleId");

            migrationBuilder.CreateIndex(
                name: "IX_fleet_trip_allocations_TenantId_InventoryUnitId",
                table: "fleet_trip_allocations",
                columns: new[] { "TenantId", "InventoryUnitId" });

            migrationBuilder.CreateIndex(
                name: "IX_fleet_trip_allocations_TenantId_TargetType_TargetId",
                table: "fleet_trip_allocations",
                columns: new[] { "TenantId", "TargetType", "TargetId" });

            migrationBuilder.CreateIndex(
                name: "IX_fleet_trip_allocations_TenantId_TripId",
                table: "fleet_trip_allocations",
                columns: new[] { "TenantId", "TripId" });

            migrationBuilder.CreateIndex(
                name: "IX_fleet_trip_allocations_TripId",
                table: "fleet_trip_allocations",
                column: "TripId");

            migrationBuilder.CreateIndex(
                name: "IX_fleet_trips_TenantId_StartTimeUtc",
                table: "fleet_trips",
                columns: new[] { "TenantId", "StartTimeUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_fleet_trips_TenantId_TripNumber",
                table: "fleet_trips",
                columns: new[] { "TenantId", "TripNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_fleet_trips_TenantId_VehicleId_Status",
                table: "fleet_trips",
                columns: new[] { "TenantId", "VehicleId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_fleet_trips_VehicleId",
                table: "fleet_trips",
                column: "VehicleId");

            migrationBuilder.CreateIndex(
                name: "IX_fleet_vehicles_TenantId_BranchId_Status",
                table: "fleet_vehicles",
                columns: new[] { "TenantId", "BranchId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_fleet_vehicles_TenantId_InternalCode",
                table: "fleet_vehicles",
                columns: new[] { "TenantId", "InternalCode" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_fleet_vehicles_TenantId_Plate",
                table: "fleet_vehicles",
                columns: new[] { "TenantId", "Plate" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_product_price_suggestions_TenantId_InventoryUnitId",
                table: "product_price_suggestions",
                columns: new[] { "TenantId", "InventoryUnitId" });

            migrationBuilder.CreateIndex(
                name: "IX_product_price_suggestions_TenantId_ProductSkuId_Status",
                table: "product_price_suggestions",
                columns: new[] { "TenantId", "ProductSkuId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_product_pricing_policies_TenantId_BranchId_IsActive",
                table: "product_pricing_policies",
                columns: new[] { "TenantId", "BranchId", "IsActive" });

            migrationBuilder.CreateIndex(
                name: "IX_product_pricing_policies_TenantId_Scope_TargetSkuId",
                table: "product_pricing_policies",
                columns: new[] { "TenantId", "Scope", "TargetSkuId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "fleet_expenses");

            migrationBuilder.DropTable(
                name: "fleet_fuelings");

            migrationBuilder.DropTable(
                name: "fleet_maintenance_services");

            migrationBuilder.DropTable(
                name: "fleet_trip_allocations");

            migrationBuilder.DropTable(
                name: "product_price_suggestions");

            migrationBuilder.DropTable(
                name: "product_pricing_policies");

            migrationBuilder.DropTable(
                name: "fleet_maintenance_plans");

            migrationBuilder.DropTable(
                name: "fleet_trips");

            migrationBuilder.DropTable(
                name: "fleet_vehicles");
        }
    }
}
