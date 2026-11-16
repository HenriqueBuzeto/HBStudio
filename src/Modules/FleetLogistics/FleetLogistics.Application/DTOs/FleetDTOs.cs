using FleetLogistics.Domain.Entities;

namespace FleetLogistics.Application.DTOs;

public record CreateVehicleRequest(
    string InternalCode,
    string Plate,
    string Brand,
    string Model,
    int Year,
    VehicleType Type,
    VehicleOwnership Ownership,
    FuelType Fuel,
    decimal InitialOdometerKm,
    decimal? TankCapacityLiters = null,
    decimal? AverageConsumptionKmPerLiter = null,
    Guid? OwnerPartnerId = null,
    string? ResponsibleName = null,
    string? Notes = null
);

public record UpdateVehicleRequest(
    string Brand,
    string Model,
    decimal? TankCapacityLiters,
    decimal? AverageConsumptionKmPerLiter,
    string? ResponsibleName,
    string? Notes
);

public record CorrectOdometerRequest(
    decimal CorrectedOdometerKm,
    string Reason
);

public record CreateTripRequest(
    string TripNumber,
    Guid VehicleId,
    Guid DriverUserId,
    string DriverName,
    TripPurpose Purpose,
    string OriginCity,
    string DestinationCity,
    decimal InitialOdometerKm,
    DateTime StartTimeUtc,
    string? Description = null,
    string? Notes = null
);

public record CompleteTripRequest(
    decimal FinalOdometerKm,
    DateTime EndTimeUtc,
    string? CompletionNotes = null
);

public record CreateFuelingRequest(
    Guid VehicleId,
    DateTime FuelingDateUtc,
    string GasStationName,
    FuelType Fuel,
    decimal TotalAmount,
    decimal OdometerKm,
    PaymentMethodCategory PaymentMethod,
    decimal? Liters = null,
    bool IsFullTank = false,
    Guid? TripId = null,
    Guid? PayingPartnerId = null,
    string? ReceiptDocumentReference = null,
    string? ReceiptAttachmentPath = null,
    string? Notes = null,
    string? IdempotencyKey = null
);

public record CreateExpenseRequest(
    ExpenseCategory Category,
    string Description,
    decimal Amount,
    DateTime ExpenseDateUtc,
    PaymentMethodCategory PaymentMethod,
    Guid? VehicleId = null,
    Guid? TripId = null,
    string? SupplierName = null,
    Guid? PayingPartnerId = null,
    string? DocumentReference = null,
    string? ReceiptAttachmentPath = null,
    string? Notes = null,
    string? IdempotencyKey = null
);

public record CreateMaintenancePlanRequest(
    Guid VehicleId,
    string PlanName,
    int RecommendedIntervalKm,
    int RecommendedIntervalDays,
    decimal? LastServiceOdometerKm = null,
    DateTime? LastServiceDateUtc = null,
    string? OilSpecification = null
);

public record CreateMaintenanceServiceRequest(
    Guid VehicleId,
    MaintenanceType Type,
    DateTime ServiceDateUtc,
    decimal OdometerKm,
    string WorkshopName,
    string Description,
    decimal PartsCost,
    decimal LaborCost,
    PaymentMethodCategory PaymentMethod,
    Guid? MaintenancePlanId = null,
    string? OilBrandAndSpecs = null,
    bool FilterReplaced = false,
    decimal? NextRecommendedOdometerKm = null,
    DateTime? NextRecommendedDateUtc = null,
    Guid? PayingPartnerId = null,
    string? InvoiceDocumentReference = null,
    string? ReceiptAttachmentPath = null,
    string? Notes = null,
    string? IdempotencyKey = null
);

public record AllocateTripCostRequest(
    Guid TripId,
    AllocationTargetType TargetType,
    Guid TargetId,
    string TargetReference,
    decimal AllocatedAmount,
    AllocationMethod Method,
    decimal AllocationPercentage,
    Guid? InventoryUnitId = null,
    Guid? ProductSkuId = null,
    string? Justification = null
);

public record CreatePricingPolicyRequest(
    string Name,
    PricingPolicyScope Scope,
    decimal TargetAcquisitionDiscountRate,
    decimal TargetMarkupRate,
    decimal TargetMinMarginRate,
    decimal MaxCounterDiscountRate = 0.05m,
    decimal EstimatedPickupLogisticsRate = 0.05m,
    decimal EstimatedDeliveryLogisticsRate = 0.10m,
    decimal OtherCommercialCostRate = 0m,
    PricingRoundingRule RoundingRule = PricingRoundingRule.EndWithNineZero,
    bool PreferRealCostOverEstimate = true,
    Guid? TargetCategoryId = null,
    Guid? TargetBrandId = null,
    Guid? TargetModelId = null,
    Guid? TargetSkuId = null,
    int? TargetCondition = null,
    string? Description = null
);

public record UpdatePricingPolicyRequest(
    string Name,
    decimal TargetAcquisitionDiscountRate,
    decimal TargetMarkupRate,
    decimal TargetMinMarginRate,
    decimal MaxCounterDiscountRate,
    decimal EstimatedPickupLogisticsRate,
    decimal EstimatedDeliveryLogisticsRate,
    decimal OtherCommercialCostRate,
    PricingRoundingRule RoundingRule,
    bool PreferRealCostOverEstimate,
    string? Description = null
);

public record GeneratePriceSuggestionRequest(
    Guid ProductSkuId,
    decimal ReferencePrice,
    decimal RealAcquisitionCost,
    Guid? InventoryUnitId = null,
    decimal? CustomLogisticsCost = null
);

public record ApprovePriceSuggestionRequest(
    decimal? CustomApprovedPrice = null,
    string? ApprovalNotes = null
);

public record FleetDashboardSummary(
    int TotalVehicles,
    int ActiveTrips,
    int CompletedTrips,
    decimal TotalDistanceKm,
    decimal TotalFuelExpenses,
    decimal TotalOtherExpenses,
    decimal TotalAllocatedToProducts,
    int UpcomingOilChanges,
    int OverdueOilChanges,
    int PendingPayablesCount,
    decimal PendingPayablesAmount
);
