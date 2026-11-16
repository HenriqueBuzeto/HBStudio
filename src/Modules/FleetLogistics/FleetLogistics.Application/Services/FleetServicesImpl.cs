using System.Text.Json;
using BuildingBlocks.Domain;
using Catalog.Domain;
using Financial.Domain;
using FleetLogistics.Application.DTOs;
using FleetLogistics.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using PartnersCapital.Domain.Entities;

namespace FleetLogistics.Application.Services;

public class FleetLogisticsService : IFleetLogisticsService
{
    private readonly DbContext _db;

    public FleetLogisticsService(DbContext db)
    {
        _db = db;
    }

    #region Veículos
    public async Task<List<FleetVehicle>> GetVehiclesAsync(Guid tenantId, CancellationToken ct = default)
    {
        return await _db.Set<FleetVehicle>()
            .Where(v => v.TenantId == tenantId)
            .OrderBy(v => v.InternalCode)
            .ToListAsync(ct);
    }

    public async Task<FleetVehicle?> GetVehicleByIdAsync(Guid tenantId, Guid vehicleId, CancellationToken ct = default)
    {
        return await _db.Set<FleetVehicle>()
            .FirstOrDefaultAsync(v => v.TenantId == tenantId && v.Id == vehicleId, ct);
    }

    public async Task<FleetVehicle> CreateVehicleAsync(Guid tenantId, Guid branchId, CreateVehicleRequest req, CancellationToken ct = default)
    {
        var existing = await _db.Set<FleetVehicle>()
            .AnyAsync(v => v.TenantId == tenantId && (v.Plate == req.Plate.Trim().ToUpperInvariant() || v.InternalCode == req.InternalCode.Trim().ToUpperInvariant()), ct);

        if (existing)
            throw new InvalidOperationException($"Já existe um veículo cadastrado com a placa '{req.Plate}' ou código '{req.InternalCode}'.");

        var vehicle = new FleetVehicle(
            tenantId,
            branchId,
            req.InternalCode,
            req.Plate,
            req.Brand,
            req.Model,
            req.Year,
            req.Type,
            req.Ownership,
            req.Fuel,
            req.InitialOdometerKm,
            req.TankCapacityLiters,
            req.AverageConsumptionKmPerLiter,
            req.OwnerPartnerId,
            req.ResponsibleName,
            req.Notes
        );

        _db.Set<FleetVehicle>().Add(vehicle);
        await _db.SaveChangesAsync(ct);
        return vehicle;
    }

    public async Task<FleetVehicle?> UpdateVehicleAsync(Guid tenantId, Guid vehicleId, UpdateVehicleRequest req, CancellationToken ct = default)
    {
        var vehicle = await GetVehicleByIdAsync(tenantId, vehicleId, ct);
        if (vehicle == null) return null;

        vehicle.UpdateDetails(
            req.Brand,
            req.Model,
            req.TankCapacityLiters,
            req.AverageConsumptionKmPerLiter,
            req.ResponsibleName,
            req.Notes
        );

        await _db.SaveChangesAsync(ct);
        return vehicle;
    }

    public async Task<FleetVehicle?> CorrectOdometerAsync(Guid tenantId, Guid vehicleId, CorrectOdometerRequest req, Guid userId, CancellationToken ct = default)
    {
        var vehicle = await GetVehicleByIdAsync(tenantId, vehicleId, ct);
        if (vehicle == null) return null;

        vehicle.CorrectOdometerFormal(req.CorrectedOdometerKm, req.Reason, userId);
        await _db.SaveChangesAsync(ct);
        return vehicle;
    }

    public async Task<bool> DeactivateVehicleAsync(Guid tenantId, Guid vehicleId, CancellationToken ct = default)
    {
        var vehicle = await GetVehicleByIdAsync(tenantId, vehicleId, ct);
        if (vehicle == null) return false;

        vehicle.SetStatus(VehicleStatus.OutOfService);
        await _db.SaveChangesAsync(ct);
        return true;
    }
    #endregion

    #region Viagens
    public async Task<List<FleetTrip>> GetTripsAsync(Guid tenantId, Guid? vehicleId = null, TripStatus? status = null, CancellationToken ct = default)
    {
        var query = _db.Set<FleetTrip>().Where(t => t.TenantId == tenantId);

        if (vehicleId.HasValue)
            query = query.Where(t => t.VehicleId == vehicleId.Value);

        if (status.HasValue)
            query = query.Where(t => t.Status == status.Value);

        return await query.OrderByDescending(t => t.StartTimeUtc).ToListAsync(ct);
    }

    public async Task<FleetTrip?> GetTripByIdAsync(Guid tenantId, Guid tripId, CancellationToken ct = default)
    {
        return await _db.Set<FleetTrip>()
            .Include(t => t.Vehicle)
            .FirstOrDefaultAsync(t => t.TenantId == tenantId && t.Id == tripId, ct);
    }

    public async Task<FleetTrip> CreateTripAsync(Guid tenantId, Guid branchId, CreateTripRequest req, CancellationToken ct = default)
    {
        var vehicle = await GetVehicleByIdAsync(tenantId, req.VehicleId, ct)
            ?? throw new InvalidOperationException("Veículo informado não encontrado.");

        if (vehicle.Status == VehicleStatus.InUse)
            throw new InvalidOperationException($"O veículo {vehicle.InternalCode} ({vehicle.Plate}) já está em uso em outra viagem em andamento.");

        var trip = new FleetTrip(
            tenantId,
            branchId,
            req.TripNumber,
            req.VehicleId,
            req.DriverUserId,
            req.DriverName,
            req.Purpose,
            req.OriginCity,
            req.DestinationCity,
            req.InitialOdometerKm,
            req.StartTimeUtc,
            req.Description,
            req.Notes
        );

        vehicle.SetStatus(VehicleStatus.InUse);
        _db.Set<FleetTrip>().Add(trip);
        await _db.SaveChangesAsync(ct);
        return trip;
    }

    public async Task<FleetTrip?> CompleteTripAsync(Guid tenantId, Guid tripId, CompleteTripRequest req, CancellationToken ct = default)
    {
        var trip = await GetTripByIdAsync(tenantId, tripId, ct);
        if (trip == null) return null;

        var vehicle = await GetVehicleByIdAsync(tenantId, trip.VehicleId, ct);
        if (vehicle != null)
        {
            vehicle.UpdateCurrentOdometer(req.FinalOdometerKm);
            vehicle.SetStatus(VehicleStatus.Available);
        }

        trip.CompleteTrip(req.FinalOdometerKm, req.EndTimeUtc, req.CompletionNotes);
        await _db.SaveChangesAsync(ct);
        return trip;
    }

    public async Task<FleetTrip?> CancelTripAsync(Guid tenantId, Guid tripId, string reason, CancellationToken ct = default)
    {
        var trip = await GetTripByIdAsync(tenantId, tripId, ct);
        if (trip == null) return null;

        var vehicle = await GetVehicleByIdAsync(tenantId, trip.VehicleId, ct);
        if (vehicle != null && vehicle.Status == VehicleStatus.InUse)
        {
            vehicle.SetStatus(VehicleStatus.Available);
        }

        trip.Cancel(reason);
        await _db.SaveChangesAsync(ct);
        return trip;
    }
    #endregion

    #region Abastecimentos & Integração Financeira
    public async Task<List<FleetFueling>> GetFuelingsAsync(Guid tenantId, Guid? vehicleId = null, Guid? tripId = null, CancellationToken ct = default)
    {
        var query = _db.Set<FleetFueling>().Where(f => f.TenantId == tenantId);

        if (vehicleId.HasValue)
            query = query.Where(f => f.VehicleId == vehicleId.Value);

        if (tripId.HasValue)
            query = query.Where(f => f.TripId == tripId.Value);

        return await query.OrderByDescending(f => f.FuelingDateUtc).ToListAsync(ct);
    }

    public async Task<FleetFueling> CreateFuelingAsync(Guid tenantId, Guid branchId, CreateFuelingRequest req, Guid userId, CancellationToken ct = default)
    {
        // 1. Idempotência estrita: impedir duplo clique
        if (!string.IsNullOrWhiteSpace(req.IdempotencyKey))
        {
            var existing = await _db.Set<FleetFueling>()
                .FirstOrDefaultAsync(f => f.TenantId == tenantId && f.IdempotencyKey == req.IdempotencyKey, ct);
            if (existing != null) return existing;
        }

        var vehicle = await GetVehicleByIdAsync(tenantId, req.VehicleId, ct)
            ?? throw new InvalidOperationException("Veículo informado não encontrado.");

        var fueling = new FleetFueling(
            tenantId,
            branchId,
            req.VehicleId,
            req.FuelingDateUtc,
            req.GasStationName,
            req.Fuel,
            req.TotalAmount,
            req.OdometerKm,
            req.PaymentMethod,
            userId,
            req.Liters,
            req.IsFullTank,
            req.TripId,
            req.PayingPartnerId,
            req.ReceiptDocumentReference,
            req.ReceiptAttachmentPath,
            req.Notes,
            req.IdempotencyKey
        );

        // 2. Integração com Viagem (se informada)
        if (req.TripId.HasValue)
        {
            var trip = await _db.Set<FleetTrip>().FirstOrDefaultAsync(t => t.TenantId == tenantId && t.Id == req.TripId.Value, ct);
            trip?.AddExpenses(req.TotalAmount, 0);
        }

        // 3. Atualizar hodômetro do veículo se a leitura for maior
        if (req.OdometerKm > vehicle.CurrentOdometerKm)
        {
            vehicle.UpdateCurrentOdometer(req.OdometerKm);
        }

        // 4. Integração Contábil / Financeira Oficial (Cenários A, B, E)
        if (req.PaymentMethod == PaymentMethodCategory.InvoicedPayLater)
        {
            // Cenário B: Faturado para pagar depois -> Cria obrigação no AccountPayable oficial
            var titleNumber = $"COMB-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString()[..6].ToUpperInvariant()}";
            var payable = new AccountPayable(
                tenantId,
                branchId,
                null,
                titleNumber,
                $"Abastecimento {vehicle.InternalCode} ({vehicle.Plate}) - {req.GasStationName}",
                DateTime.UtcNow,
                DateTime.UtcNow.AddDays(7), // Vencimento padrão faturado 7 dias
                req.TotalAmount,
                documentReference: req.ReceiptDocumentReference ?? titleNumber
            );

            _db.Set<AccountPayable>().Add(payable);
            fueling.LinkFinancialPayable(payable.Id);
        }
        else if (req.PaymentMethod == PaymentMethodCategory.PaidByPartner && req.PayingPartnerId.HasValue)
        {
            // Cenário E: Sócio pagou com dinheiro pessoal -> Registra despesa da empresa e obrigação de reembolso
            var reimbursementTitle = $"REEMB-SOCIO-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString()[..6].ToUpperInvariant()}";
            var partnerPayable = new AccountPayable(
                tenantId,
                branchId,
                null,
                reimbursementTitle,
                $"Reembolso de Combustível ao Sócio - Veículo {vehicle.InternalCode} ({vehicle.Plate})",
                DateTime.UtcNow,
                DateTime.UtcNow.AddDays(5),
                req.TotalAmount,
                documentReference: req.ReceiptDocumentReference ?? reimbursementTitle
            );

            _db.Set<AccountPayable>().Add(partnerPayable);
            fueling.LinkPartnerReimbursement(partnerPayable.Id);
        }

        _db.Set<FleetFueling>().Add(fueling);
        await _db.SaveChangesAsync(ct);
        return fueling;
    }
    #endregion

    #region Despesas de Deslocamento
    public async Task<List<FleetExpense>> GetExpensesAsync(Guid tenantId, Guid? vehicleId = null, Guid? tripId = null, CancellationToken ct = default)
    {
        var query = _db.Set<FleetExpense>().Where(e => e.TenantId == tenantId);

        if (vehicleId.HasValue)
            query = query.Where(e => e.VehicleId == vehicleId.Value);

        if (tripId.HasValue)
            query = query.Where(e => e.TripId == tripId.Value);

        return await query.OrderByDescending(e => e.ExpenseDateUtc).ToListAsync(ct);
    }

    public async Task<FleetExpense> CreateExpenseAsync(Guid tenantId, Guid branchId, CreateExpenseRequest req, Guid userId, CancellationToken ct = default)
    {
        if (!string.IsNullOrWhiteSpace(req.IdempotencyKey))
        {
            var existing = await _db.Set<FleetExpense>()
                .FirstOrDefaultAsync(e => e.TenantId == tenantId && e.IdempotencyKey == req.IdempotencyKey, ct);
            if (existing != null) return existing;
        }

        var expense = new FleetExpense(
            tenantId,
            branchId,
            req.Category,
            req.Description,
            req.Amount,
            req.ExpenseDateUtc,
            req.PaymentMethod,
            userId,
            req.VehicleId,
            req.TripId,
            req.SupplierName,
            req.PayingPartnerId,
            req.DocumentReference,
            req.ReceiptAttachmentPath,
            req.Notes,
            req.IdempotencyKey
        );

        if (req.TripId.HasValue)
        {
            var trip = await _db.Set<FleetTrip>().FirstOrDefaultAsync(t => t.TenantId == tenantId && t.Id == req.TripId.Value, ct);
            trip?.AddExpenses(0, req.Amount);
        }

        if (req.PaymentMethod == PaymentMethodCategory.InvoicedPayLater)
        {
            var titleNumber = $"DESP-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString()[..6].ToUpperInvariant()}";
            var payable = new AccountPayable(
                tenantId,
                branchId,
                null,
                titleNumber,
                $"Despesa Logística: {req.Description}",
                DateTime.UtcNow,
                DateTime.UtcNow.AddDays(7),
                req.Amount,
                documentReference: req.DocumentReference ?? titleNumber
            );

            _db.Set<AccountPayable>().Add(payable);
            expense.LinkFinancialPayable(payable.Id);
        }
        else if (req.PaymentMethod == PaymentMethodCategory.PaidByPartner && req.PayingPartnerId.HasValue)
        {
            var reimbursementTitle = $"REEMB-SOCIO-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString()[..6].ToUpperInvariant()}";
            var partnerPayable = new AccountPayable(
                tenantId,
                branchId,
                null,
                reimbursementTitle,
                $"Reembolso Despesa de Viagem ao Sócio - {req.Description}",
                DateTime.UtcNow,
                DateTime.UtcNow.AddDays(5),
                req.Amount,
                documentReference: req.DocumentReference ?? reimbursementTitle
            );

            _db.Set<AccountPayable>().Add(partnerPayable);
            expense.LinkPartnerReimbursement(partnerPayable.Id);
        }

        _db.Set<FleetExpense>().Add(expense);
        await _db.SaveChangesAsync(ct);
        return expense;
    }
    #endregion

    #region Manutenção & Troca de Óleo
    public async Task<List<FleetMaintenancePlan>> GetMaintenancePlansAsync(Guid tenantId, Guid? vehicleId = null, CancellationToken ct = default)
    {
        var query = _db.Set<FleetMaintenancePlan>().Where(p => p.TenantId == tenantId);
        if (vehicleId.HasValue)
            query = query.Where(p => p.VehicleId == vehicleId.Value);

        return await query.OrderBy(p => p.PlanName).ToListAsync(ct);
    }

    public async Task<FleetMaintenancePlan> CreateMaintenancePlanAsync(Guid tenantId, CreateMaintenancePlanRequest req, CancellationToken ct = default)
    {
        var plan = new FleetMaintenancePlan(
            tenantId,
            req.VehicleId,
            req.PlanName,
            req.RecommendedIntervalKm,
            req.RecommendedIntervalDays,
            req.LastServiceOdometerKm,
            req.LastServiceDateUtc,
            req.OilSpecification
        );

        _db.Set<FleetMaintenancePlan>().Add(plan);
        await _db.SaveChangesAsync(ct);
        return plan;
    }

    public async Task<List<FleetMaintenanceService>> GetMaintenanceServicesAsync(Guid tenantId, Guid? vehicleId = null, CancellationToken ct = default)
    {
        var query = _db.Set<FleetMaintenanceService>().Where(s => s.TenantId == tenantId);
        if (vehicleId.HasValue)
            query = query.Where(s => s.VehicleId == vehicleId.Value);

        return await query.OrderByDescending(s => s.ServiceDateUtc).ToListAsync(ct);
    }

    public async Task<FleetMaintenanceService> RecordMaintenanceServiceAsync(Guid tenantId, Guid branchId, CreateMaintenanceServiceRequest req, Guid userId, CancellationToken ct = default)
    {
        if (!string.IsNullOrWhiteSpace(req.IdempotencyKey))
        {
            var existing = await _db.Set<FleetMaintenanceService>()
                .FirstOrDefaultAsync(s => s.TenantId == tenantId && s.IdempotencyKey == req.IdempotencyKey, ct);
            if (existing != null) return existing;
        }

        var vehicle = await GetVehicleByIdAsync(tenantId, req.VehicleId, ct)
            ?? throw new InvalidOperationException("Veículo informado não encontrado.");

        var service = new FleetMaintenanceService(
            tenantId,
            branchId,
            req.VehicleId,
            req.Type,
            req.ServiceDateUtc,
            req.OdometerKm,
            req.WorkshopName,
            req.Description,
            req.PartsCost,
            req.LaborCost,
            req.PaymentMethod,
            userId,
            req.MaintenancePlanId,
            req.OilBrandAndSpecs,
            req.FilterReplaced,
            req.NextRecommendedOdometerKm,
            req.NextRecommendedDateUtc,
            req.PayingPartnerId,
            req.InvoiceDocumentReference,
            req.ReceiptAttachmentPath,
            req.Notes,
            req.IdempotencyKey
        );

        // Atualiza hodômetro do veículo se maior
        if (req.OdometerKm > vehicle.CurrentOdometerKm)
        {
            vehicle.UpdateCurrentOdometer(req.OdometerKm);
        }

        // Se vinculado a plano de manutenção preventiva (ex: troca de óleo), atualiza o marco do plano
        if (req.MaintenancePlanId.HasValue)
        {
            var plan = await _db.Set<FleetMaintenancePlan>().FirstOrDefaultAsync(p => p.TenantId == tenantId && p.Id == req.MaintenancePlanId.Value, ct);
            plan?.RecordServiceExecution(req.OdometerKm, req.ServiceDateUtc);
        }

        // Integração Contas a Pagar se faturado
        if (req.PaymentMethod == PaymentMethodCategory.InvoicedPayLater)
        {
            var titleNumber = $"MANUT-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString()[..6].ToUpperInvariant()}";
            var payable = new AccountPayable(
                tenantId,
                branchId,
                null,
                titleNumber,
                $"Manutenção Mecânica: {req.Description} - {req.WorkshopName}",
                DateTime.UtcNow,
                DateTime.UtcNow.AddDays(15),
                service.TotalCost,
                documentReference: req.InvoiceDocumentReference ?? titleNumber
            );

            _db.Set<AccountPayable>().Add(payable);
            service.LinkFinancialPayable(payable.Id);
        }

        _db.Set<FleetMaintenanceService>().Add(service);
        await _db.SaveChangesAsync(ct);
        return service;
    }
    #endregion

    #region Rateios de Viagem para Produtos
    public async Task<List<FleetTripAllocation>> GetAllocationsAsync(Guid tenantId, Guid? tripId = null, Guid? inventoryUnitId = null, CancellationToken ct = default)
    {
        var query = _db.Set<FleetTripAllocation>().Where(a => a.TenantId == tenantId);
        if (tripId.HasValue)
            query = query.Where(a => a.TripId == tripId.Value);
        if (inventoryUnitId.HasValue)
            query = query.Where(a => a.InventoryUnitId == inventoryUnitId.Value);

        return await query.OrderByDescending(a => a.AllocatedAtUtc).ToListAsync(ct);
    }

    public async Task<FleetTripAllocation> AllocateTripCostAsync(Guid tenantId, AllocateTripCostRequest req, Guid userId, CancellationToken ct = default)
    {
        var trip = await _db.Set<FleetTrip>().FirstOrDefaultAsync(t => t.TenantId == tenantId && t.Id == req.TripId, ct)
            ?? throw new InvalidOperationException("Viagem não encontrada.");

        trip.RegisterAllocation(req.AllocatedAmount);

        var allocation = new FleetTripAllocation(
            tenantId,
            req.TripId,
            req.TargetType,
            req.TargetId,
            req.TargetReference,
            req.AllocatedAmount,
            req.Method,
            req.AllocationPercentage,
            userId,
            req.InventoryUnitId,
            req.ProductSkuId,
            req.Justification
        );

        _db.Set<FleetTripAllocation>().Add(allocation);
        await _db.SaveChangesAsync(ct);
        return allocation;
    }
    #endregion

    #region Dashboard
    public async Task<FleetDashboardSummary> GetDashboardSummaryAsync(Guid tenantId, Guid? branchId = null, CancellationToken ct = default)
    {
        var vehicles = await _db.Set<FleetVehicle>().Where(v => v.TenantId == tenantId).ToListAsync(ct);
        var trips = await _db.Set<FleetTrip>().Where(t => t.TenantId == tenantId).ToListAsync(ct);
        var plans = await _db.Set<FleetMaintenancePlan>().Where(p => p.TenantId == tenantId && p.IsActive).ToListAsync(ct);
        var payables = await _db.Set<FleetFueling>().Where(f => f.TenantId == tenantId && f.FinancialStatus == FinancialStatus.PayablePending).ToListAsync(ct);
        var allocations = await _db.Set<FleetTripAllocation>().Where(a => a.TenantId == tenantId).ToListAsync(ct);

        var now = DateTime.UtcNow;
        int upcoming = 0;
        int overdue = 0;

        foreach (var plan in plans)
        {
            var vehicle = vehicles.FirstOrDefault(v => v.Id == plan.VehicleId);
            if (vehicle != null)
            {
                var status = plan.EvaluateStatus(vehicle.CurrentOdometerKm, now);
                if (status == OilChangePlanStatus.Upcoming) upcoming++;
                else if (status == OilChangePlanStatus.Overdue) overdue++;
            }
        }

        return new FleetDashboardSummary(
            TotalVehicles: vehicles.Count,
            ActiveTrips: trips.Count(t => t.Status == TripStatus.InProgress),
            CompletedTrips: trips.Count(t => t.Status == TripStatus.Completed),
            TotalDistanceKm: trips.Sum(t => t.DistanceKm),
            TotalFuelExpenses: trips.Sum(t => t.TotalFuelExpenses),
            TotalOtherExpenses: trips.Sum(t => t.TotalOtherExpenses),
            TotalAllocatedToProducts: allocations.Sum(a => a.AllocatedAmount),
            UpcomingOilChanges: upcoming,
            OverdueOilChanges: overdue,
            PendingPayablesCount: payables.Count,
            PendingPayablesAmount: payables.Sum(p => p.TotalAmount)
        );
    }
    #endregion
}

public class ProductPricingEngineService : IProductPricingEngineService
{
    private readonly DbContext _db;

    public ProductPricingEngineService(DbContext db)
    {
        _db = db;
    }

    public async Task<List<ProductPricingPolicy>> GetPoliciesAsync(Guid tenantId, CancellationToken ct = default)
    {
        return await _db.Set<ProductPricingPolicy>()
            .Where(p => p.TenantId == tenantId)
            .OrderByDescending(p => p.IsActive)
            .ThenBy(p => p.Name)
            .ToListAsync(ct);
    }

    public async Task<ProductPricingPolicy> CreatePolicyAsync(Guid tenantId, Guid branchId, CreatePricingPolicyRequest req, CancellationToken ct = default)
    {
        var policy = new ProductPricingPolicy(
            tenantId,
            branchId,
            req.Name,
            req.Scope,
            req.TargetAcquisitionDiscountRate,
            req.TargetMarkupRate,
            req.TargetMinMarginRate,
            req.EstimatedPickupLogisticsRate,
            req.EstimatedDeliveryLogisticsRate,
            req.OtherCommercialCostRate,
            req.RoundingRule,
            req.PreferRealCostOverEstimate,
            req.TargetCategoryId,
            req.TargetBrandId,
            req.TargetModelId,
            req.TargetSkuId,
            req.TargetCondition,
            req.Description
        );

        _db.Set<ProductPricingPolicy>().Add(policy);
        await _db.SaveChangesAsync(ct);
        return policy;
    }

    public async Task<ProductPricingPolicy?> UpdatePolicyAsync(Guid tenantId, Guid policyId, CreatePricingPolicyRequest req, CancellationToken ct = default)
    {
        var policy = await _db.Set<ProductPricingPolicy>()
            .FirstOrDefaultAsync(p => p.TenantId == tenantId && p.Id == policyId, ct);
        if (policy == null) return null;

        policy.UpdateRules(
            req.Name,
            req.TargetAcquisitionDiscountRate,
            req.TargetMarkupRate,
            req.TargetMinMarginRate,
            req.EstimatedPickupLogisticsRate,
            req.EstimatedDeliveryLogisticsRate,
            req.OtherCommercialCostRate,
            req.RoundingRule,
            req.PreferRealCostOverEstimate,
            req.Description
        );

        await _db.SaveChangesAsync(ct);
        return policy;
    }

    public async Task<bool> TogglePolicyActiveAsync(Guid tenantId, Guid policyId, bool active, CancellationToken ct = default)
    {
        var policy = await _db.Set<ProductPricingPolicy>()
            .FirstOrDefaultAsync(p => p.TenantId == tenantId && p.Id == policyId, ct);
        if (policy == null) return false;

        policy.SetActive(active);
        await _db.SaveChangesAsync(ct);
        return true;
    }

    public async Task<ProductPriceSuggestion> GeneratePriceSuggestionAsync(Guid tenantId, Guid branchId, GeneratePriceSuggestionRequest req, CancellationToken ct = default)
    {
        // 1. Localizar política aplicável (Precedência: SKU -> Modelo -> Categoria -> Global)
        var policies = await _db.Set<ProductPricingPolicy>()
            .Where(p => p.TenantId == tenantId && p.IsActive)
            .ToListAsync(ct);

        var policy = policies.FirstOrDefault(p => p.TargetSkuId == req.ProductSkuId)
            ?? policies.FirstOrDefault(p => p.Scope == PricingPolicyScope.GlobalTenant)
            ?? new ProductPricingPolicy(
                tenantId,
                branchId,
                "Política Padrão de Fábrica",
                PricingPolicyScope.GlobalTenant,
                targetAcquisitionDiscountRate: 0.15m, // 15% de desconto de negociação
                targetMarkupRate: 0.30m,              // 30% de markup comercial
                targetMinMarginRate: 0.15m,           // 15% margem mínima
                estimatedPickupLogisticsRate: 0.05m,  // 5% provisão de frete retirada
                estimatedDeliveryLogisticsRate: 0.10m,// 10% provisão de entrega
                otherCommercialCostRate: 0.03m,       // 3% taxas
                roundingRule: PricingRoundingRule.EndWithNineZero
            );

        // 2. Cálculo do Desconto-Alvo de Negociação (para a proposta de compra)
        var targetNegotiationPrice = Math.Round(req.ReferencePrice * (1 - policy.TargetAcquisitionDiscountRate), 2);

        // 3. Apuração do Frete / Custo Logístico (Real vs Estimado)
        decimal allocatedLogistics = 0;
        if (req.CustomLogisticsCost.HasValue && req.CustomLogisticsCost.Value > 0)
        {
            allocatedLogistics = req.CustomLogisticsCost.Value;
        }
        else if (req.InventoryUnitId.HasValue && policy.PreferRealCostOverEstimate)
        {
            // Busca se houve rateio real apurado para esta unidade serializada
            var realAllocations = await _db.Set<FleetTripAllocation>()
                .Where(a => a.TenantId == tenantId && a.InventoryUnitId == req.InventoryUnitId.Value)
                .SumAsync(a => a.AllocatedAmount, ct);

            allocatedLogistics = realAllocations > 0 ? realAllocations : Math.Round(req.RealAcquisitionCost * policy.EstimatedPickupLogisticsRate, 2);
        }
        else
        {
            allocatedLogistics = Math.Round(req.RealAcquisitionCost * policy.EstimatedPickupLogisticsRate, 2);
        }

        // 4. Provisões Comerciais Adicionais (Entrega futura + Taxas)
        var commercialProvisions = Math.Round(req.RealAcquisitionCost * (policy.EstimatedDeliveryLogisticsRate + policy.OtherCommercialCostRate), 2);

        // 5. Base de Custo Total
        var totalCostBase = req.RealAcquisitionCost + allocatedLogistics + commercialProvisions;

        // 6. Preço Sugerido com Markup
        var suggestedRaw = totalCostBase * (1 + policy.TargetMarkupRate);

        // 7. Aplicação da Regra de Arredondamento
        var suggestedPrice = ApplyRounding(suggestedRaw, policy.RoundingRule);

        // 8. Preço Mínimo Autorizado (garante margem mínima estrita)
        var minAllowedRaw = policy.TargetMinMarginRate < 1
            ? totalCostBase / (1 - policy.TargetMinMarginRate)
            : totalCostBase * 1.10m;
        var minimumAllowedPrice = Math.Round(minAllowedRaw, 2);

        var breakdown = new
        {
            PolicyName = policy.Name,
            PolicyVersion = policy.VersionNumber,
            ReferencePrice = req.ReferencePrice,
            TargetDiscountRate = policy.TargetAcquisitionDiscountRate,
            TargetNegotiationPrice = targetNegotiationPrice,
            RealAcquisitionCost = req.RealAcquisitionCost,
            AllocatedLogistics = allocatedLogistics,
            CommercialProvisions = commercialProvisions,
            TotalCostBase = totalCostBase,
            MarkupRate = policy.TargetMarkupRate,
            SuggestedRaw = suggestedRaw,
            FinalSuggestedPrice = suggestedPrice,
            MinimumAllowedPrice = minimumAllowedPrice,
            CalculatedAtUtc = DateTime.UtcNow
        };

        var suggestion = new ProductPriceSuggestion(
            tenantId,
            branchId,
            req.ProductSkuId,
            req.ReferencePrice,
            targetNegotiationPrice,
            req.RealAcquisitionCost,
            allocatedLogistics,
            commercialProvisions,
            policy.TargetMarkupRate,
            suggestedPrice,
            minimumAllowedPrice,
            JsonSerializer.Serialize(breakdown),
            req.InventoryUnitId,
            policy.Id
        );

        _db.Set<ProductPriceSuggestion>().Add(suggestion);
        await _db.SaveChangesAsync(ct);
        return suggestion;
    }

    public async Task<List<ProductPriceSuggestion>> GetSuggestionsAsync(Guid tenantId, Guid? productSkuId = null, Guid? inventoryUnitId = null, PriceApprovalStatus? status = null, CancellationToken ct = default)
    {
        var query = _db.Set<ProductPriceSuggestion>().Where(s => s.TenantId == tenantId);

        if (productSkuId.HasValue)
            query = query.Where(s => s.ProductSkuId == productSkuId.Value);

        if (inventoryUnitId.HasValue)
            query = query.Where(s => s.InventoryUnitId == inventoryUnitId.Value);

        if (status.HasValue)
            query = query.Where(s => s.Status == status.Value);

        return await query.OrderByDescending(s => s.CreatedAtUtc).ToListAsync(ct);
    }

    public async Task<ProductPriceSuggestion?> ApprovePriceSuggestionAsync(Guid tenantId, Guid suggestionId, ApprovePriceSuggestionRequest req, Guid userId, CancellationToken ct = default)
    {
        var suggestion = await _db.Set<ProductPriceSuggestion>()
            .FirstOrDefaultAsync(s => s.TenantId == tenantId && s.Id == suggestionId, ct);
        if (suggestion == null) return null;

        suggestion.Approve(userId, req.CustomApprovedPrice, req.ApprovalNotes);

        // Atualiza oficialmente o preço vigente no Catalog/SKU
        var sku = await _db.Set<ProductSku>()
            .FirstOrDefaultAsync(k => k.TenantId == tenantId && k.Id == suggestion.ProductSkuId, ct);
        if (sku != null)
        {
            sku.UpdatePrice(suggestion.ApprovedFinalPrice);
        }

        await _db.SaveChangesAsync(ct);
        return suggestion;
    }

    public async Task<ProductPriceSuggestion?> RejectPriceSuggestionAsync(Guid tenantId, Guid suggestionId, string reason, Guid userId, CancellationToken ct = default)
    {
        var suggestion = await _db.Set<ProductPriceSuggestion>()
            .FirstOrDefaultAsync(s => s.TenantId == tenantId && s.Id == suggestionId, ct);
        if (suggestion == null) return null;

        suggestion.Reject(userId, reason);
        await _db.SaveChangesAsync(ct);
        return suggestion;
    }

    private static decimal ApplyRounding(decimal amount, PricingRoundingRule rule)
    {
        return rule switch
        {
            PricingRoundingRule.EndWithNineNine => Math.Floor(amount) + 0.99m,
            PricingRoundingRule.EndWithNineZero => Math.Floor(amount) + 0.90m,
            PricingRoundingRule.RoundToWhole => Math.Round(amount, 0),
            _ => Math.Round(amount, 2)
        };
    }
}
