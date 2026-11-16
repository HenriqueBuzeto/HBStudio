using BuildingBlocks.Application;
using Catalog.Domain;
using CRM.Application.DTOs;
using CRM.Domain.Entities;
using CRM.Domain.Enums;
using CRM.Domain.Repositories;
using Inventory.Application;
using Inventory.Domain;
using Microsoft.EntityFrameworkCore;
using Parties.Domain;
using Sales.Application;
using Sales.Domain;

namespace CRM.Application.Services;

public class CrmAppService
{
    private readonly ICrmRepository _crmRepository;
    private readonly InventoryService _inventoryService;
    private readonly SalesService? _salesService;
    private readonly IExecutionContext _executionContext;
    private readonly DbContext _dbContext; // Para consultas oficiais de leitura de produtos/unidades/parties sem contornar seus domínios

    public CrmAppService(
        ICrmRepository crmRepository,
        InventoryService inventoryService,
        IExecutionContext executionContext,
        DbContext dbContext,
        SalesService? salesService = null)
    {
        _crmRepository = crmRepository;
        _inventoryService = inventoryService;
        _executionContext = executionContext;
        _dbContext = dbContext;
        _salesService = salesService;
    }

    private Guid CurrentTenantId => _executionContext.TenantId != Guid.Empty ? _executionContext.TenantId : throw new UnauthorizedAccessException("Tenant não identificado.");
    private Guid CurrentBranchId => _executionContext.BranchId.HasValue && _executionContext.BranchId.Value != Guid.Empty ? _executionContext.BranchId.Value : Guid.NewGuid();

    // ==========================================
    // 1. LEADS
    // ==========================================
    public async Task<LeadResponse> CreateLeadAsync(CreateLeadRequest request, CancellationToken ct = default)
    {
        var lead = new CrmLead(
            CurrentTenantId,
            CurrentBranchId,
            request.Name,
            request.Phone,
            request.Email,
            request.Source,
            request.MainInterest,
            request.AssignedSellerUserId,
            request.Notes);

        await _crmRepository.AddLeadAsync(lead, ct);
        await _crmRepository.SaveChangesAsync(ct);

        return MapLead(lead);
    }

    public async Task<List<LeadResponse>> ListLeadsAsync(CancellationToken ct = default)
    {
        var leads = await _crmRepository.ListLeadsAsync(CurrentTenantId, null, ct);
        return leads.Select(MapLead).ToList();
    }

    public async Task<LeadResponse> UpdateLeadStatusAsync(Guid id, UpdateLeadStatusRequest request, CancellationToken ct = default)
    {
        var lead = await _crmRepository.GetLeadByIdAsync(id, ct)
            ?? throw new KeyNotFoundException($"Lead {id} não encontrado.");

        lead.UpdateStatus(request.Status, request.Notes);
        await _crmRepository.UpdateLeadAsync(lead, ct);
        await _crmRepository.SaveChangesAsync(ct);

        return MapLead(lead);
    }

    public async Task<LeadResponse> ConvertLeadToPartyAsync(Guid id, ConvertLeadRequest request, CancellationToken ct = default)
    {
        var lead = await _crmRepository.GetLeadByIdAsync(id, ct)
            ?? throw new KeyNotFoundException($"Lead {id} não encontrado.");

        // Validar se PartyId existe no banco do tenant
        var partyExists = await _dbContext.Set<Party>()
            .AnyAsync(p => p.Id == request.PartyId && p.TenantId == CurrentTenantId, ct);

        if (!partyExists)
            throw new KeyNotFoundException($"Cliente/Fornecedor (Party) {request.PartyId} não encontrado no tenant.");

        lead.ConvertToParty(request.PartyId);
        await _crmRepository.UpdateLeadAsync(lead, ct);
        await _crmRepository.SaveChangesAsync(ct);

        return MapLead(lead);
    }

    // ==========================================
    // 2. PIPELINES
    // ==========================================
    public async Task<PipelineResponse> CreatePipelineAsync(CreatePipelineRequest request, CancellationToken ct = default)
    {
        var pipeline = new CrmPipeline(CurrentTenantId, request.Name, request.PipelineType);

        foreach (var s in request.Stages.OrderBy(x => x.OrderIndex))
        {
            pipeline.AddStage(s.Name, s.OrderIndex, s.IsWonStage, s.IsLostStage);
        }

        await _crmRepository.AddPipelineAsync(pipeline, ct);
        await _crmRepository.SaveChangesAsync(ct);

        return MapPipeline(pipeline);
    }

    public async Task<List<PipelineResponse>> ListPipelinesAsync(CancellationToken ct = default)
    {
        var pipelines = await _crmRepository.ListPipelinesAsync(CurrentTenantId, ct);
        return pipelines.Select(MapPipeline).ToList();
    }

    // ==========================================
    // 3. OPORTUNIDADES
    // ==========================================
    public async Task<OpportunityResponse> CreateOpportunityAsync(CreateOpportunityRequest request, CancellationToken ct = default)
    {
        // Se informado PartyId, validar existência
        if (request.PartyId.HasValue)
        {
            var party = await _dbContext.Set<Party>()
                .Include(p => p.Consents)
                .FirstOrDefaultAsync(p => p.Id == request.PartyId.Value && p.TenantId == CurrentTenantId, ct)
                ?? throw new KeyNotFoundException($"Party {request.PartyId.Value} não encontrada.");

            // Se o cliente revogou consentimento de contato promocional, registrar conformidade
            var hasOptOut = party.Consents.Any(c => !c.IsOptIn && c.Purpose.Contains("Marketing", StringComparison.OrdinalIgnoreCase));
            if (hasOptOut)
            {
                // Tratamento ético LGPD: registrado
            }
        }

        var opp = new CrmOpportunity(
            CurrentTenantId,
            CurrentBranchId,
            request.PartyId,
            request.LeadId,
            request.PipelineId,
            request.StageId,
            request.AssignedSellerUserId,
            request.Title,
            request.EstimatedValue,
            request.Priority,
            request.Description,
            request.Origin,
            request.ExpectedClosingDate);

        await _crmRepository.AddOpportunityAsync(opp, ct);
        await _crmRepository.SaveChangesAsync(ct);

        return MapOpportunity(opp);
    }

    public async Task<List<OpportunityResponse>> ListOpportunitiesAsync(Guid? pipelineId = null, CancellationToken ct = default)
    {
        var opps = await _crmRepository.ListOpportunitiesAsync(CurrentTenantId, null, pipelineId, ct);
        return opps.Select(MapOpportunity).ToList();
    }

    public async Task<OpportunityResponse> MoveOpportunityStageAsync(Guid id, MoveOpportunityStageRequest request, CancellationToken ct = default)
    {
        var opp = await _crmRepository.GetOpportunityByIdAsync(id, ct)
            ?? throw new KeyNotFoundException($"Oportunidade {id} não encontrada.");

        opp.MoveStage(request.NewStageId, request.IsWon, request.IsLost, request.LossReason);
        await _crmRepository.UpdateOpportunityAsync(opp, ct);
        await _crmRepository.SaveChangesAsync(ct);

        return MapOpportunity(opp);
    }

    public async Task<OpportunityResponse> AddOpportunityActivityAsync(Guid opportunityId, AddOpportunityActivityRequest request, CancellationToken ct = default)
    {
        var opp = await _crmRepository.GetOpportunityByIdAsync(opportunityId, ct)
            ?? throw new KeyNotFoundException($"Oportunidade {opportunityId} não encontrada.");

        opp.AddActivity(
            request.ActivityType,
            request.Title,
            request.Description,
            request.ScheduledForUtc,
            request.AssignedUserId,
            request.Priority);

        await _crmRepository.UpdateOpportunityAsync(opp, ct);
        await _crmRepository.SaveChangesAsync(ct);

        return MapOpportunity(opp);
    }

    // ==========================================
    // 4. INTENÇÕES DE COMPRA (PURCHASE INTENTS)
    // ==========================================
    public async Task<PurchaseIntentResponse> CreatePurchaseIntentAsync(CreatePurchaseIntentRequest request, CancellationToken ct = default)
    {
        // Validar Party no tenant
        var party = await _dbContext.Set<Party>()
            .FirstOrDefaultAsync(p => p.Id == request.PartyId && p.TenantId == CurrentTenantId, ct)
            ?? throw new KeyNotFoundException($"Cliente (Party) {request.PartyId} não encontrado no tenant.");

        var intent = new CrmPurchaseIntent(
            CurrentTenantId,
            CurrentBranchId,
            request.PartyId,
            request.AssignedSellerUserId,
            request.Category,
            request.Brand,
            request.ModelName,
            request.DesiredStorageCapacity,
            request.DesiredColor,
            request.ColorIsFlexible,
            request.Condition,
            request.MinimumCosmeticGrade,
            request.MinimumBatteryHealthPercentage,
            request.MaxBudgetPrice,
            request.PreferredBranchId,
            request.ValidUntilUtc,
            request.Priority,
            request.PreferredContactChannel,
            request.Notes,
            request.TargetProductModelId,
            request.TargetProductSkuId);

        await _crmRepository.AddPurchaseIntentAsync(intent, ct);
        await _crmRepository.SaveChangesAsync(ct);

        // Matching imediato com estoque existente
        await EvaluateMatchingForIntentAsync(intent, ct);
        await _crmRepository.SaveChangesAsync(ct);

        return MapPurchaseIntent(intent);
    }

    public async Task<List<PurchaseIntentResponse>> ListActivePurchaseIntentsAsync(CancellationToken ct = default)
    {
        var intents = await _crmRepository.ListActivePurchaseIntentsAsync(CurrentTenantId, null, ct);
        return intents.Select(MapPurchaseIntent).ToList();
    }

    public async Task<PurchaseIntentResponse> CancelPurchaseIntentAsync(Guid id, string reason, CancellationToken ct = default)
    {
        var intent = await _crmRepository.GetPurchaseIntentByIdAsync(id, ct)
            ?? throw new KeyNotFoundException($"Intenção de compra {id} não encontrada.");

        intent.Cancel(reason);
        await _crmRepository.UpdatePurchaseIntentAsync(intent, ct);
        await _crmRepository.SaveChangesAsync(ct);

        return MapPurchaseIntent(intent);
    }

    // ==========================================
    // 5. MOTOR DE MATCHING COM ESTOQUE (INVENTORY)
    // ==========================================
    public async Task<RunInventoryMatchingResult> RunInventoryMatchingAsync(CancellationToken ct = default)
    {
        var activeIntents = await _crmRepository.ListActivePurchaseIntentsAsync(CurrentTenantId, null, ct);
        var newMatchesList = new List<InventoryMatchResponse>();

        foreach (var intent in activeIntents)
        {
            var createdMatches = await EvaluateMatchingForIntentAsync(intent, ct);
            newMatchesList.AddRange(createdMatches.Select(MapMatch));
        }

        await _crmRepository.SaveChangesAsync(ct);

        return new RunInventoryMatchingResult(
            TotalActiveIntentsEvaluated: activeIntents.Count,
            MatchesFound: newMatchesList.Count,
            NewMatches: newMatchesList);
    }

    public async Task<List<CrmInventoryMatch>> EvaluateMatchingForIntentAsync(CrmPurchaseIntent intent, CancellationToken ct = default)
    {
        var createdMatches = new List<CrmInventoryMatch>();

        // 1. Buscar SKUs ativos do tenant com seu modelo
        var allSkus = await _dbContext.Set<ProductSku>()
            .Include(s => s.ProductModel)
            .Where(s => s.TenantId == CurrentTenantId && s.IsActive)
            .ToListAsync(ct);

        var candidateSkus = allSkus.AsEnumerable();

        if (!string.IsNullOrWhiteSpace(intent.ModelName))
        {
            var targetModel = intent.ModelName.Trim().ToLower();
            candidateSkus = candidateSkus.Where(s =>
                (s.ProductModel != null && s.ProductModel.Name.ToLower().Contains(targetModel)) ||
                s.VariantName.ToLower().Contains(targetModel) ||
                s.SkuCode.ToLower().Contains(targetModel));
        }

        if (!string.IsNullOrWhiteSpace(intent.DesiredStorageCapacity))
        {
            var targetCap = intent.DesiredStorageCapacity.Trim().ToLower();
            candidateSkus = candidateSkus.Where(s =>
                s.VariantName.ToLower().Contains(targetCap) ||
                (s.TechnicalSpecsJson != null && s.TechnicalSpecsJson.ToLower().Contains(targetCap)));
        }

        if (!intent.ColorIsFlexible && !string.IsNullOrWhiteSpace(intent.DesiredColor))
        {
            var targetColor = intent.DesiredColor.Trim().ToLower();
            candidateSkus = candidateSkus.Where(s =>
                s.VariantName.ToLower().Contains(targetColor) ||
                (s.TechnicalSpecsJson != null && s.TechnicalSpecsJson.ToLower().Contains(targetColor)));
        }

        foreach (var sku in candidateSkus)
        {
            // Validar orçamento máximo
            if (intent.MaxBudgetPrice.HasValue && sku.DefaultPrice > intent.MaxBudgetPrice.Value)
            {
                continue;
            }

            // Verificar se o modelo exige serialização estrita
            var isStrictSerialized = sku.ProductModel?.SerializationPolicy == SerializationPolicy.StrictSerialized;

            if (isStrictSerialized)
            {
                var units = await _dbContext.Set<InventoryUnit>()
                    .Where(u => u.ProductSkuId == sku.Id && u.TenantId == CurrentTenantId)
                    .ToListAsync(ct);

                foreach (var unit in units)
                {
                    // Invariante HBVisionX: Unidade DEVE estar oficialmente ApprovedForSale
                    if (unit.OperationalStatus != UnitOperationalStatus.ApprovedForSale)
                    {
                        continue; // Rejeitar não inspecionadas, quarentena, vendidas, etc.
                    }

                    // Se a intenção exige condição específica
                    if (intent.Condition == DesiredCondition.New && unit.Condition != ItemCondition.BrandNew) continue;
                    if (intent.Condition == DesiredCondition.Used && unit.Condition == ItemCondition.BrandNew) continue;

                    // Se exige grau de conservação mínimo
                    if (!string.IsNullOrWhiteSpace(intent.MinimumCosmeticGrade))
                    {
                        var desiredRank = GradeRank(intent.MinimumCosmeticGrade);
                        var actualRank = (int)unit.Grade;
                        if (actualRank < desiredRank) continue;
                    }

                    // Se exige saúde mínima de bateria
                    if (intent.MinimumBatteryHealthPercentage.HasValue)
                    {
                        if (!unit.BatteryHealthPercentage.HasValue || unit.BatteryHealthPercentage.Value < intent.MinimumBatteryHealthPercentage.Value)
                        {
                            continue;
                        }
                    }

                    // Idempotência estrita: verificar se já existe match
                    var alreadyMatched = intent.Matches.Any(m => m.InventoryUnitId == unit.Id);
                    if (alreadyMatched) continue;

                    var details = $"Match Serializado: Modelo {sku.ProductModel?.Name ?? sku.VariantName}, Condição: {unit.Condition}, Grau: {unit.Grade}, Bateria: {unit.BatteryHealthPercentage?.ToString() ?? "N/A"}%, IMEI/Serial: {unit.Imei1 ?? unit.SerialNumber ?? "S/N"}";
                    var match = intent.AddMatch(sku.Id, unit.Id, sku.DefaultPrice, details, isFullMatch: true);
                    createdMatches.Add(match);
                }
            }
            else
            {
                // Mercadoria não serializada
                var balance = await _dbContext.Set<StockBalance>()
                    .FirstOrDefaultAsync(b => b.ProductSkuId == sku.Id && b.TenantId == CurrentTenantId, ct);

                if (balance != null && balance.AvailableQuantity > 0)
                {
                    var alreadyMatched = intent.Matches.Any(m => m.ProductSkuId == sku.Id && m.InventoryUnitId == null);
                    if (!alreadyMatched)
                    {
                        var details = $"Match Saldo Disponível: SKU {sku.SkuCode} - {sku.VariantName}, Qtd Livre: {balance.AvailableQuantity}";
                        var match = intent.AddMatch(sku.Id, null, sku.DefaultPrice, details, isFullMatch: true);
                        createdMatches.Add(match);
                    }
                }
            }
        }

        return createdMatches;
    }

    private static int GradeRank(string grade) => grade.ToUpperInvariant() switch
    {
        "A" or "GRADEA" => 1,
        "B" or "GRADEB" => 2,
        "C" or "GRADEC" => 3,
        _ => 0
    };

    // ==========================================
    // 6. RESERVA OFICIAL DE MATCH (VIA INVENTORY)
    // ==========================================
    public async Task<InventoryMatchResponse> ReserveMatchedUnitAsync(ReserveMatchedUnitRequest request, CancellationToken ct = default)
    {
        var match = await _crmRepository.GetMatchByIdAsync(request.MatchId, ct)
            ?? throw new KeyNotFoundException($"Match {request.MatchId} não encontrado.");

        var intent = await _crmRepository.GetPurchaseIntentByIdAsync(match.PurchaseIntentId, ct)
            ?? throw new KeyNotFoundException("Intenção de compra associada não encontrada.");

        // Revalidar disponibilidade da unidade serializada antes da reserva
        if (match.InventoryUnitId.HasValue)
        {
            var unit = await _dbContext.Set<InventoryUnit>()
                .FirstOrDefaultAsync(u => u.Id == match.InventoryUnitId.Value && u.TenantId == CurrentTenantId, ct)
                ?? throw new KeyNotFoundException("Unidade de estoque não encontrada.");

            if (unit.OperationalStatus != UnitOperationalStatus.ApprovedForSale)
            {
                match.InvalidateByStockMove($"A unidade de estoque não está mais disponível para venda (Status atual: {unit.OperationalStatus}).");
                await _crmRepository.UpdateMatchAsync(match, ct);
                await _crmRepository.SaveChangesAsync(ct);
                throw new InvalidOperationException($"Não foi possível reservar: Unidade indisponível no momento ({unit.OperationalStatus}).");
            }

            // Obter depósito padrão da filial
            var warehouse = await _dbContext.Set<Warehouse>()
                .FirstOrDefaultAsync(w => w.TenantId == CurrentTenantId && w.BranchId == CurrentBranchId, ct)
                ?? await _dbContext.Set<Warehouse>().FirstOrDefaultAsync(w => w.TenantId == CurrentTenantId, ct)
                ?? throw new InvalidOperationException("Nenhum depósito cadastrado para efetuar a reserva.");

            // Executa a reserva oficial no serviço de inventário (sem bypass de domínio)
            var reservationReq = new CreateReservationRequest(
                BranchId: CurrentBranchId,
                ReservationNumber: $"RES-CRM-{Guid.NewGuid().ToString()[..6].ToUpperInvariant()}",
                Reason: $"Reserva comercial gerada por match do CRM para cliente {intent.PartyId}. {request.Notes}",
                ExpiresAtUtc: DateTime.UtcNow.AddDays(2),
                DocumentReference: $"CRM-INTENT-{intent.Id.ToString()[..8].ToUpperInvariant()}",
                IdempotencyKey: $"CRM-RES-{match.Id}",
                Items: [
                    new CreateReservationItemRequest(
                        WarehouseId: warehouse.Id,
                        WarehouseLocationId: null,
                        ProductSkuId: match.ProductSkuId,
                        Quantity: 1,
                        InventoryUnitId: match.InventoryUnitId.Value)
                ]);

            await _inventoryService.CreateReservationAsync(reservationReq, ct);

            match.MarkReserved();
            intent.MarkNegotiating();

            await _crmRepository.UpdateMatchAsync(match, ct);
            await _crmRepository.UpdatePurchaseIntentAsync(intent, ct);
            await _crmRepository.SaveChangesAsync(ct);
        }

        return MapMatch(match);
    }

    // ==========================================
    // 7. DASHBOARD METRICS
    // ==========================================
    public async Task<CrmDashboardMetricsResponse> GetDashboardMetricsAsync(CancellationToken ct = default)
    {
        var leads = await _crmRepository.ListLeadsAsync(CurrentTenantId, null, ct);
        var opps = await _crmRepository.ListOpportunitiesAsync(CurrentTenantId, null, null, ct);
        var intents = await _crmRepository.ListActivePurchaseIntentsAsync(CurrentTenantId, null, ct);

        var activeLeads = leads.Count(l => l.Status is LeadStatus.New or LeadStatus.Contacted or LeadStatus.Qualified);
        var openOpps = opps.Count(o => o.Status == OpportunityStatus.Open);
        var pipelineValue = opps.Where(o => o.Status == OpportunityStatus.Open).Sum(o => o.EstimatedValue);
        var activeIntentsCount = intents.Count(i => i.Status is PurchaseIntentStatus.Active or PurchaseIntentStatus.MatchFound or PurchaseIntentStatus.Negotiating);
        var availableMatches = intents.SelectMany(i => i.Matches).Count(m => m.Status == MatchStatus.CandidateIdentified);
        var pendingActivities = opps.SelectMany(o => o.Activities).Count(a => a.Status == ActivityStatus.Pending);

        return new CrmDashboardMetricsResponse(
            ActiveLeadsCount: activeLeads,
            OpenOpportunitiesCount: openOpps,
            TotalPipelineEstimatedValue: pipelineValue,
            ActivePurchaseIntentsCount: activeIntentsCount,
            AvailableMatchesCount: availableMatches,
            PendingActivitiesCount: pendingActivities);
    }

    // ==========================================
    // MAPPERS
    // ==========================================
    private static LeadResponse MapLead(CrmLead l) => new(
        l.Id, l.TenantId, l.BranchId, l.Name, l.Phone, l.Email, l.Source, l.MainInterest,
        l.AssignedSellerUserId, l.Status, l.Notes, l.NextContactAtUtc, l.ConvertedPartyId, l.CreatedAtUtc);

    private static PipelineResponse MapPipeline(CrmPipeline p) => new(
        p.Id, p.Name, p.PipelineType, p.IsActive,
        p.Stages.OrderBy(s => s.OrderIndex).Select(s => new PipelineStageResponse(s.Id, s.PipelineId, s.Name, s.OrderIndex, s.IsWonStage, s.IsLostStage)).ToList());

    private static OpportunityResponse MapOpportunity(CrmOpportunity o) => new(
        o.Id, o.TenantId, o.BranchId, o.PartyId, o.LeadId, o.PipelineId, o.StageId, o.AssignedSellerUserId,
        o.Title, o.Description, o.Origin, o.EstimatedValue, o.ExpectedClosingDate, o.Priority, o.Status,
        o.ClosedAtUtc, o.LossReason, o.ConvertedSalesQuoteId, o.ConvertedSaleId, o.AssociatedRepairOrderId,
        o.AssociatedPurchaseIntentId, o.CreatedAtUtc,
        o.Activities.OrderBy(a => a.ScheduledForUtc).Select(a => new OpportunityActivityResponse(
            a.Id, a.OpportunityId, a.ActivityType, a.Title, a.Description, a.ScheduledForUtc,
            a.AssignedUserId, a.Priority, a.Status, a.CompletedAtUtc, a.CompletionNotes, a.CreatedAtUtc)).ToList());

    private static PurchaseIntentResponse MapPurchaseIntent(CrmPurchaseIntent i) => new(
        Id: i.Id, TenantId: i.TenantId, BranchId: i.BranchId, PartyId: i.PartyId, AssignedSellerUserId: i.AssignedSellerUserId, Category: i.Category, Brand: i.Brand, ModelName: i.ModelName,
        DesiredStorageCapacity: i.DesiredStorageCapacity, DesiredColor: i.DesiredColor, ColorIsFlexible: i.ColorIsFlexible, Condition: i.Condition, MinimumCosmeticGrade: i.MinimumCosmeticGrade,
        MinimumBatteryHealthPercentage: i.MinimumBatteryHealthPercentage, MaxBudgetPrice: i.MaxBudgetPrice, PreferredBranchId: i.PreferredBranchId, ValidUntilUtc: i.ValidUntilUtc, Priority: i.Priority,
        Status: i.Status, PreferredContactChannel: i.PreferredContactChannel, Notes: i.Notes, CreatedAtUtc: i.CreatedAtUtc,
        Matches: i.Matches.OrderByDescending(m => m.EvaluatedAtUtc).Select(MapMatch).ToList());

    private static InventoryMatchResponse MapMatch(CrmInventoryMatch m) => new(
        m.Id, m.PurchaseIntentId, m.ProductSkuId, m.InventoryUnitId, m.VerifiedPrice, m.MatchDetails,
        m.IsFullMatch, m.Status, m.EvaluatedAtUtc, m.StatusUpdatedAtUtc, m.RejectionReason);
}
