using BuildingBlocks.Application;
using BuildingBlocks.Infrastructure;
using Microsoft.EntityFrameworkCore;
using RepairService.Application.DTOs;
using RepairService.Domain.Entities;
using RepairService.Domain.Enums;
using RepairService.Domain.Repositories;
using Inventory.Application;
using Inventory.Domain;

namespace RepairService.Application.Services;

public class RepairServiceAppService
{
    private readonly IRepairServiceRepository _repository;
    private readonly AppDbContext _dbContext;
    private readonly IExecutionContext _executionContext;

    public RepairServiceAppService(
        IRepairServiceRepository repository,
        AppDbContext dbContext,
        IExecutionContext executionContext)
    {
        _repository = repository;
        _dbContext = dbContext;
        _executionContext = executionContext;
    }

    public async Task<RepairOrderResponse> CreateRepairOrderAsync(CreateRepairOrderRequest request, CancellationToken ct = default)
    {
        var tenantId = _executionContext.TenantId;

        // Validar cliente e equipamento no mesmo tenant
        var customerExists = await _dbContext.Parties.AnyAsync(p => p.Id == request.CustomerId && p.TenantId == tenantId, ct);
        if (!customerExists)
            throw new KeyNotFoundException("Cliente não encontrado ou não pertence a este tenant.");

        var equipmentExists = await _dbContext.CustomerEquipments.AnyAsync(e => e.Id == request.CustomerEquipmentId && e.TenantId == tenantId, ct);
        if (!equipmentExists)
            throw new KeyNotFoundException("Equipamento não encontrado ou não pertence a este tenant.");

        // Validar unicidade do número da OS
        var existingOrder = await _repository.GetByOrderNumberAsync(request.OrderNumber, ct);
        if (existingOrder != null)
            throw new InvalidOperationException($"Já existe uma Ordem de Serviço com o número '{request.OrderNumber}'.");

        var repairOrder = new RepairOrder(
            tenantId,
            request.BranchId,
            request.OrderNumber,
            request.CustomerId,
            request.CustomerEquipmentId,
            request.ReportedDefect,
            request.PhysicalConditionNotes,
            request.AccessoriesIncluded,
            request.EstimatedCompletionUtc,
            request.AssignedTechnicianId,
            request.OriginalRepairOrderId
        );

        await _repository.AddAsync(repairOrder, ct);
        await _repository.SaveChangesAsync(ct);

        return MapToResponse(repairOrder);
    }

    public async Task<RepairOrderResponse?> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        var order = await _repository.GetByIdAsync(id, ct);
        return order == null ? null : MapToResponse(order);
    }

    public async Task<IReadOnlyList<RepairOrderResponse>> ListAsync(Guid? branchId, RepairOrderStatus? status, Guid? customerId, CancellationToken ct = default)
    {
        var list = await _repository.ListAsync(branchId, status, customerId, ct);
        return list.Select(MapToResponse).ToList();
    }

    public async Task<RepairOrderResponse> AddChecklistItemAsync(Guid orderId, AddChecklistItemRequest request, CancellationToken ct = default)
    {
        var order = await GetOrderOrThrow(orderId, ct);
        order.AddChecklistItem(request.Category, request.ItemName, request.Status, request.Notes, request.IsOutputCheck);
        await _repository.UpdateAsync(order, ct);
        await _repository.SaveChangesAsync(ct);
        return MapToResponse(order);
    }

    public async Task<RepairOrderResponse> AssignTechnicianAsync(Guid orderId, Guid technicianId, string? notes = null, CancellationToken ct = default)
    {
        var order = await GetOrderOrThrow(orderId, ct);
        order.AssignTechnician(technicianId, notes);
        await _repository.UpdateAsync(order, ct);
        await _repository.SaveChangesAsync(ct);
        return MapToResponse(order);
    }

    public async Task<RepairOrderResponse> StartDiagnosisAsync(Guid orderId, Guid technicianId, CancellationToken ct = default)
    {
        var order = await GetOrderOrThrow(orderId, ct);
        order.StartDiagnosis(technicianId);
        await _repository.UpdateAsync(order, ct);
        await _repository.SaveChangesAsync(ct);
        return MapToResponse(order);
    }

    public async Task<RepairOrderResponse> CompleteDiagnosisAsync(Guid orderId, CompleteDiagnosisRequest request, CancellationToken ct = default)
    {
        var order = await GetOrderOrThrow(orderId, ct);
        order.CompleteDiagnosis(request.DiagnosticNotes);
        await _repository.UpdateAsync(order, ct);
        await _repository.SaveChangesAsync(ct);
        return MapToResponse(order);
    }

    public async Task<RepairOrderResponse> AddEstimateItemAsync(Guid orderId, AddEstimateItemRequest request, CancellationToken ct = default)
    {
        var order = await GetOrderOrThrow(orderId, ct);
        order.AddEstimateItem(request.ItemType, request.Description, request.Quantity, request.UnitPrice, request.UnitCost, request.ProductSkuId);
        await _repository.UpdateAsync(order, ct);
        await _repository.SaveChangesAsync(ct);
        return MapToResponse(order);
    }

    public async Task<RepairOrderResponse> ApproveEstimateAsync(Guid orderId, ApproveEstimateRequest request, CancellationToken ct = default)
    {
        var order = await GetOrderOrThrow(orderId, ct);
        order.ApproveEstimate(request.ApprovalChannel, request.ApprovalEvidence);
        await _repository.UpdateAsync(order, ct);
        await _repository.SaveChangesAsync(ct);
        return MapToResponse(order);
    }

    public async Task<RepairOrderResponse> RejectEstimateAsync(Guid orderId, RejectEstimateRequest request, CancellationToken ct = default)
    {
        var order = await GetOrderOrThrow(orderId, ct);
        order.RejectEstimate(request.Reason);
        await _repository.UpdateAsync(order, ct);
        await _repository.SaveChangesAsync(ct);
        return MapToResponse(order);
    }

    public async Task<RepairOrderResponse> StartRepairAsync(Guid orderId, CancellationToken ct = default)
    {
        var order = await GetOrderOrThrow(orderId, ct);
        order.StartRepair();
        await _repository.UpdateAsync(order, ct);
        await _repository.SaveChangesAsync(ct);
        return MapToResponse(order);
    }

    public async Task<RepairOrderResponse> ReservePartsAsync(Guid orderId, List<ReservePartRequest> parts, InventoryService inventoryService, CancellationToken ct = default)
    {
        var order = await GetOrderOrThrow(orderId, ct);

        // Criar reserva oficial no Inventory
        var reservationRequest = new CreateReservationRequest(
            order.BranchId,
            $"RES-OS-{order.OrderNumber}",
            $"Reserva de peças para OS {order.OrderNumber}",
            DateTime.UtcNow.AddDays(7),
            $"OS-{order.OrderNumber}",
            null,
            parts.Select(p => new CreateReservationItemRequest(p.WarehouseId, p.WarehouseLocationId, p.ProductSkuId, p.Quantity, p.InventoryUnitId)).ToList()
        );

        var reservation = await inventoryService.CreateReservationAsync(reservationRequest, ct);

        order.SetWaitingParts(reservation.Id);
        await _repository.UpdateAsync(order, ct);
        await _repository.SaveChangesAsync(ct);

        return MapToResponse(order);
    }

    public async Task<RepairOrderResponse> ConsumePartAsync(Guid orderId, ConsumePartRequest request, CancellationToken ct = default)
    {
        var order = await GetOrderOrThrow(orderId, ct);

        // Não permitir consumir sem lançamento
        if (request.Quantity <= 0)
            throw new ArgumentException("Quantidade a ser consumida deve ser maior que zero.", nameof(request.Quantity));

        order.RecordPartUsage(
            request.ProductSkuId,
            request.PartDescription,
            request.Quantity,
            request.ActualUnitCost,
            request.InventoryUnitId,
            request.StockMovementId
        );

        await _repository.UpdateAsync(order, ct);
        await _repository.SaveChangesAsync(ct);

        return MapToResponse(order);
    }

    public async Task<RepairOrderResponse> CompleteRepairAsync(Guid orderId, CompleteRepairRequest request, CancellationToken ct = default)
    {
        var order = await GetOrderOrThrow(orderId, ct);
        order.CompleteRepair(request.ResolutionNotes, request.TechnicianLaborCost);
        await _repository.UpdateAsync(order, ct);
        await _repository.SaveChangesAsync(ct);
        return MapToResponse(order);
    }

    public async Task<RepairOrderResponse> PassQualityCheckAsync(Guid orderId, PassQualityCheckRequest request, CancellationToken ct = default)
    {
        var order = await GetOrderOrThrow(orderId, ct);
        order.PassQualityCheck(request.QaNotes);
        await _repository.UpdateAsync(order, ct);
        await _repository.SaveChangesAsync(ct);
        return MapToResponse(order);
    }

    public async Task<RepairOrderResponse> DeliverToCustomerAsync(Guid orderId, DeliverRepairOrderRequest request, CancellationToken ct = default)
    {
        var order = await GetOrderOrThrow(orderId, ct);
        order.DeliverToCustomer(request.DeliveredToPersonName, request.DeliveredToDocumentNumber, request.DeliveryNotes, request.AdditionalWarrantyDays);
        await _repository.UpdateAsync(order, ct);
        await _repository.SaveChangesAsync(ct);
        return MapToResponse(order);
    }

    public async Task<RepairOrderResponse> CreateWarrantyClaimAsync(Guid orderId, CreateWarrantyClaimRequest request, CancellationToken ct = default)
    {
        var order = await GetOrderOrThrow(orderId, ct);
        order.AddWarrantyClaim(request.DefectDescription, request.ClaimDateUtc);
        await _repository.UpdateAsync(order, ct);
        await _repository.SaveChangesAsync(ct);
        return MapToResponse(order);
    }

    public async Task<RepairOrderResponse> DecideWarrantyClaimAsync(Guid orderId, Guid claimId, DecideWarrantyClaimRequest request, CancellationToken ct = default)
    {
        var order = await GetOrderOrThrow(orderId, ct);
        var claim = order.WarrantyClaims.FirstOrDefault(c => c.Id == claimId);
        if (claim == null)
            throw new KeyNotFoundException($"Reclamação de garantia {claimId} não encontrada na OS {orderId}.");

        claim.Decide(request.Decision, request.Rationale, request.FollowUpRepairOrderId);
        await _repository.UpdateAsync(order, ct);
        await _repository.SaveChangesAsync(ct);
        return MapToResponse(order);
    }

    private async Task<RepairOrder> GetOrderOrThrow(Guid orderId, CancellationToken ct)
    {
        var order = await _repository.GetByIdAsync(orderId, ct);
        if (order == null)
            throw new KeyNotFoundException($"Ordem de Serviço {orderId} não encontrada.");
        return order;
    }

    private static RepairOrderResponse MapToResponse(RepairOrder order)
    {
        return new RepairOrderResponse(
            order.Id,
            order.BranchId,
            order.OrderNumber,
            order.CustomerId,
            order.CustomerEquipmentId,
            order.AssignedTechnicianId,
            order.Status,
            order.ReportedDefect,
            order.PhysicalConditionNotes,
            order.AccessoriesIncluded,
            order.DiagnosticNotes,
            order.ResolutionNotes,
            order.ReceivedAtUtc,
            order.EstimatedCompletionUtc,
            order.DiagnosisCompletedAtUtc,
            order.RepairedAtUtc,
            order.QualityCheckedAtUtc,
            order.DeliveredAtUtc,
            order.OriginalRepairOrderId,
            order.LegalWarrantyDays,
            order.AdditionalWarrantyDays,
            order.WarrantyExpiresAtUtc,
            order.DeliveredToPersonName,
            order.TotalLaborPrice,
            order.TotalPartsPrice,
            order.FinalPrice,
            order.TotalPartsCost,
            order.TotalLaborCost,
            order.ChecklistItems.Select(c => new RepairChecklistItemResponse(c.Id, c.Category, c.ItemName, c.Status, c.Notes, c.IsOutputCheck, c.CheckedAtUtc)).ToList(),
            order.EstimateItems.Select(e => new RepairEstimateItemResponse(e.Id, e.ItemType, e.Description, e.Quantity, e.UnitPrice, e.UnitCost, e.ProductSkuId)).ToList(),
            order.PartUsages.Select(p => new RepairPartUsageResponse(p.Id, p.ProductSkuId, p.PartDescription, p.Quantity, p.ActualUnitCost, p.InventoryUnitId, p.StockMovementId, p.ConsumedAtUtc)).ToList(),
            order.StatusHistory.Select(s => new RepairStatusHistoryResponse(s.Id, s.Status, s.Description, s.TimestampUtc)).ToList(),
            order.WarrantyClaims.Select(w => new RepairWarrantyClaimResponse(w.Id, w.DefectDescription, w.ClaimDateUtc, w.Decision, w.DecisionRationale, w.DecisionDateUtc, w.FollowUpRepairOrderId)).ToList()
        );
    }
}
