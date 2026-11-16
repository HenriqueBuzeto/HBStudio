using FleetLogistics.Application.DTOs;
using FleetLogistics.Domain.Entities;

namespace FleetLogistics.Application.Services;

public interface IFleetLogisticsService
{
    // Veículos
    Task<List<FleetVehicle>> GetVehiclesAsync(Guid tenantId, CancellationToken ct = default);
    Task<FleetVehicle?> GetVehicleByIdAsync(Guid tenantId, Guid vehicleId, CancellationToken ct = default);
    Task<FleetVehicle> CreateVehicleAsync(Guid tenantId, Guid branchId, CreateVehicleRequest req, CancellationToken ct = default);
    Task<FleetVehicle?> UpdateVehicleAsync(Guid tenantId, Guid vehicleId, UpdateVehicleRequest req, CancellationToken ct = default);
    Task<FleetVehicle?> CorrectOdometerAsync(Guid tenantId, Guid vehicleId, CorrectOdometerRequest req, Guid userId, CancellationToken ct = default);
    Task<bool> DeactivateVehicleAsync(Guid tenantId, Guid vehicleId, CancellationToken ct = default);

    // Viagens
    Task<List<FleetTrip>> GetTripsAsync(Guid tenantId, Guid? vehicleId = null, TripStatus? status = null, CancellationToken ct = default);
    Task<FleetTrip?> GetTripByIdAsync(Guid tenantId, Guid tripId, CancellationToken ct = default);
    Task<FleetTrip> CreateTripAsync(Guid tenantId, Guid branchId, CreateTripRequest req, CancellationToken ct = default);
    Task<FleetTrip?> CompleteTripAsync(Guid tenantId, Guid tripId, CompleteTripRequest req, CancellationToken ct = default);
    Task<FleetTrip?> CancelTripAsync(Guid tenantId, Guid tripId, string reason, CancellationToken ct = default);

    // Abastecimentos Rápidos (R$ 50 sem litros obrigatórios)
    Task<List<FleetFueling>> GetFuelingsAsync(Guid tenantId, Guid? vehicleId = null, Guid? tripId = null, CancellationToken ct = default);
    Task<FleetFueling> CreateFuelingAsync(Guid tenantId, Guid branchId, CreateFuelingRequest req, Guid userId, CancellationToken ct = default);

    // Despesas de Deslocamento
    Task<List<FleetExpense>> GetExpensesAsync(Guid tenantId, Guid? vehicleId = null, Guid? tripId = null, CancellationToken ct = default);
    Task<FleetExpense> CreateExpenseAsync(Guid tenantId, Guid branchId, CreateExpenseRequest req, Guid userId, CancellationToken ct = default);

    // Manutenção Preventiva & Troca de Óleo
    Task<List<FleetMaintenancePlan>> GetMaintenancePlansAsync(Guid tenantId, Guid? vehicleId = null, CancellationToken ct = default);
    Task<FleetMaintenancePlan> CreateMaintenancePlanAsync(Guid tenantId, CreateMaintenancePlanRequest req, CancellationToken ct = default);
    Task<List<FleetMaintenanceService>> GetMaintenanceServicesAsync(Guid tenantId, Guid? vehicleId = null, CancellationToken ct = default);
    Task<FleetMaintenanceService> RecordMaintenanceServiceAsync(Guid tenantId, Guid branchId, CreateMaintenanceServiceRequest req, Guid userId, CancellationToken ct = default);

    // Rateio de Frete para Produtos e Aquisições
    Task<List<FleetTripAllocation>> GetAllocationsAsync(Guid tenantId, Guid? tripId = null, Guid? inventoryUnitId = null, CancellationToken ct = default);
    Task<FleetTripAllocation> AllocateTripCostAsync(Guid tenantId, AllocateTripCostRequest req, Guid userId, CancellationToken ct = default);

    // Dashboard
    Task<FleetDashboardSummary> GetDashboardSummaryAsync(Guid tenantId, Guid? branchId = null, CancellationToken ct = default);
}

public interface IProductPricingEngineService
{
    // Políticas Comerciais
    Task<List<ProductPricingPolicy>> GetPoliciesAsync(Guid tenantId, CancellationToken ct = default);
    Task<ProductPricingPolicy> CreatePolicyAsync(Guid tenantId, Guid branchId, CreatePricingPolicyRequest req, CancellationToken ct = default);
    Task<ProductPricingPolicy?> UpdatePolicyAsync(Guid tenantId, Guid policyId, CreatePricingPolicyRequest req, CancellationToken ct = default);
    Task<bool> TogglePolicyActiveAsync(Guid tenantId, Guid policyId, bool active, CancellationToken ct = default);

    // Motor de Cálculo e Sugestão
    Task<ProductPriceSuggestion> GeneratePriceSuggestionAsync(Guid tenantId, Guid branchId, GeneratePriceSuggestionRequest req, CancellationToken ct = default);
    Task<List<ProductPriceSuggestion>> GetSuggestionsAsync(Guid tenantId, Guid? productSkuId = null, Guid? inventoryUnitId = null, PriceApprovalStatus? status = null, CancellationToken ct = default);
    Task<ProductPriceSuggestion?> ApprovePriceSuggestionAsync(Guid tenantId, Guid suggestionId, ApprovePriceSuggestionRequest req, Guid userId, CancellationToken ct = default);
    Task<ProductPriceSuggestion?> RejectPriceSuggestionAsync(Guid tenantId, Guid suggestionId, string reason, Guid userId, CancellationToken ct = default);
}
