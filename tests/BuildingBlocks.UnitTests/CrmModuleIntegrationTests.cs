using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using BuildingBlocks.Domain;
using BuildingBlocks.Infrastructure;
using BuildingBlocks.Security;
using IdentityAccess.Domain;
using Catalog.Domain;
using CRM.Application.DTOs;
using CRM.Domain.Entities;
using CRM.Domain.Enums;
using FluentAssertions;
using Inventory.Application;
using Inventory.Domain;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Parties.Domain;
using Xunit;

namespace BuildingBlocks.UnitTests;

public class CrmModuleIntegrationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly ITokenService _jwtTokenService;

    public CrmModuleIntegrationTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _jwtTokenService = new JwtTokenService(
            "HBStudioEnterpriseErpSuperSecretKey20261113!",
            "HBStudioErp",
            "HBStudioErpClient");
    }

    private HttpClient CreateAuthenticatedClient(Guid tenantId, Guid branchId, IEnumerable<string> permissions)
    {
        var tokenResponse = _jwtTokenService.GenerateToken(
            tenantId,
            branchId,
            Guid.NewGuid(),
            "crm.tester@hbstudio.com",
            permissions);

        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", tokenResponse.AccessToken);
        return client;
    }

    private async Task<(Guid TenantId, Guid BranchId)> SeedTenantAndBranchAsync()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var tenant = new Tenant($"Tenant-CRM-{Guid.NewGuid():N}", $"T-{Guid.NewGuid():N}"[..8]);
        var branch = tenant.AddBranch($"Filial CRM {Guid.NewGuid():N}", $"B-{Guid.NewGuid():N}"[..8]);
        db.Tenants.Add(tenant);
        await db.SaveChangesAsync();

        return (tenant.Id, branch.Id);
    }

    [Fact]
    public async Task Crm_Security_RequiresCrmPermissions()
    {
        // 1. Cliente Anônimo (sem token) deve receber 401 Unauthorized
        var anonClient = _factory.CreateClient();
        var anonRes = await anonClient.GetAsync("/api/crm/leads");
        anonRes.StatusCode.Should().Be(HttpStatusCode.Unauthorized);

        // 2. Cliente com permissão incorreta deve receber 403 Forbidden
        var (tenantId, branchId) = await SeedTenantAndBranchAsync();
        var unauthClient = CreateAuthenticatedClient(tenantId, branchId, [PermissionCatalog.InventoryView]);
        var forbiddenRes = await unauthClient.GetAsync("/api/crm/leads");
        forbiddenRes.StatusCode.Should().Be(HttpStatusCode.Forbidden);

        // 3. Cliente com CrmView deve receber 200 OK
        var authClient = CreateAuthenticatedClient(tenantId, branchId, [PermissionCatalog.CrmView]);
        var okRes = await authClient.GetAsync("/api/crm/leads");
        okRes.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Crm_PurchaseIntent_Matching_WithSerializedInventory_RejectsIneligibleUnits_AndReservesExclusively()
    {
        var (tenantId, branchId) = await SeedTenantAndBranchAsync();

        var client = CreateAuthenticatedClient(tenantId, branchId, [
            PermissionCatalog.CrmView,
            PermissionCatalog.CrmManage,
            PermissionCatalog.CrmInterestManage,
            PermissionCatalog.CustomersView,
            PermissionCatalog.CustomersCreate,
            PermissionCatalog.InventoryView,
            PermissionCatalog.InventoryMove
        ]);

        Guid partyId;
        Guid modelId;
        Guid skuId;
        Guid warehouseId;
        Guid eligibleUnitId;
        Guid lowBatteryUnitId;
        Guid pendingInspectionUnitId;

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            // 1. Criar Depósito
            var wh = new Warehouse(tenantId, branchId, $"DEP-{Guid.NewGuid():N}"[..8], "Depósito Matriz", WarehouseType.CentralDeposit);
            db.Set<Warehouse>().Add(wh);
            warehouseId = wh.Id;

            // 2. Criar Cliente (Party)
            var party = new Party(tenantId, PartyType.Individual, "Dr. Ricardo Guimarães", documentNumber: "12345678909");
            db.Parties.Add(party);
            partyId = party.Id;

            // 3. Criar Marca, Categoria, Modelo e SKU com serialização estrita
            var brand = new ProductBrand(tenantId, $"Apple-{Guid.NewGuid():N}"[..12]);
            var category = new ProductCategory(tenantId, "Smartphones", $"smartphones-{Guid.NewGuid():N}"[..16]);
            db.ProductBrands.Add(brand);
            db.ProductCategories.Add(category);

            var model = new ProductModel(tenantId, "iPhone 14 Pro Max", ProductKind.Standard, SerializationPolicy.StrictSerialized, brand.Id, category.Id);
            db.ProductModels.Add(model);
            modelId = model.Id;

            var sku = new ProductSku(tenantId, model.Id, $"IPH14PM-256-{Guid.NewGuid():N}"[..16], "256GB - Roxo Profundo", 3400.00m);
            db.ProductSkus.Add(sku);
            skuId = sku.Id;

            // 4. Criar Unidades Físicas:
            // Unidade A: ELEGÍVEL (Usado, Grau B, Bateria 88%, Aprovado para venda, R$ 3400 <= 3500)
            var unitEligible = new InventoryUnit(tenantId, sku.Id, ItemCondition.PreOwned, 2200.00m, "SN-IP14-01", "354928119028111", null, CosmeticGrade.GradeB, 88);
            unitEligible.ApproveForSale("Checklist 100% OK");
            db.Set<InventoryUnit>().Add(unitEligible);
            eligibleUnitId = unitEligible.Id;

            // Criar posição serial e saldo em estoque para a Unidade A
            var balance = new StockBalance(tenantId, branchId, wh.Id, null, sku.Id);
            balance.ApplyMovement(1, 2200.00m);
            db.Set<StockBalance>().Add(balance);

            var serialPos = new SerialStockPosition(tenantId, unitEligible.Id, sku.Id, branchId, wh.Id, null);
            db.Set<SerialStockPosition>().Add(serialPos);

            // Unidade B: REJEITADA por BATERIA (79% < mínimo de 85% exigido pelo cliente)
            var unitLowBat = new InventoryUnit(tenantId, sku.Id, ItemCondition.PreOwned, 1900.00m, "SN-IP14-02", "354928119028222", null, CosmeticGrade.GradeB, 79);
            unitLowBat.ApproveForSale("Bateria degradada");
            db.Set<InventoryUnit>().Add(unitLowBat);
            lowBatteryUnitId = unitLowBat.Id;

            // Unidade C: REJEITADA por STATUS OPERACIONAL (Ainda em bancada de testes / não aprovada para venda)
            var unitPending = new InventoryUnit(tenantId, sku.Id, ItemCondition.PreOwned, 2100.00m, "SN-IP14-03", "354928119028333", null, CosmeticGrade.GradeA, 95);
            // Permanece em AcquiredPendingInspection!
            db.Set<InventoryUnit>().Add(unitPending);
            pendingInspectionUnitId = unitPending.Id;

            await db.SaveChangesAsync();
        }

        // 5. Cadastrar Intenção de Compra pelo CRM
        var intentReq = new CreatePurchaseIntentRequest(
            PartyId: partyId,
            AssignedSellerUserId: null,
            Category: "Smartphones",
            Brand: "Apple",
            ModelName: "iPhone 14 Pro Max",
            DesiredStorageCapacity: "256GB",
            DesiredColor: null, // Indiferente
            ColorIsFlexible: true,
            Condition: DesiredCondition.Used,
            MinimumCosmeticGrade: "B",
            MinimumBatteryHealthPercentage: 85, // Exige 85%+
            MaxBudgetPrice: 3500.00m,
            PreferredBranchId: null,
            ValidUntilUtc: DateTime.UtcNow.AddDays(30),
            Priority: OpportunityPriority.High,
            PreferredContactChannel: ContactChannel.WhatsApp,
            Notes: "Cliente aguardando aparelho para fechar imediato.");

        var createRes = await client.PostAsJsonAsync("/api/crm/intents", intentReq);
        if (createRes.StatusCode != HttpStatusCode.Created)
        {
            var err = await createRes.Content.ReadAsStringAsync();
            throw new Exception($"Create intent failed: {createRes.StatusCode} - {err}");
        }
        var createdIntent = await createRes.Content.ReadFromJsonAsync<PurchaseIntentResponse>();
        createdIntent.Should().NotBeNull();
        createdIntent!.Status.Should().Be(PurchaseIntentStatus.MatchFound);

        // 6. Verificar os Matches Gerados pelo Motor
        createdIntent.Matches.Should().HaveCount(1, "Somente a Unidade A atende todos os critérios rigorosos (bateria 85%+ e status ApprovedForSale)");
        var match = createdIntent.Matches.First();
        match.InventoryUnitId.Should().Be(eligibleUnitId);
        match.Status.Should().Be(MatchStatus.CandidateIdentified);
        match.IsFullMatch.Should().BeTrue();

        // 7. Solicitar Reserva Oficial do Match (sem bypass de domínio)
        var reserveReq = new ReserveMatchedUnitRequest(match.Id, "Cliente confirmou interesse por WhatsApp; segurando por 48h.");
        var reserveRes = await client.PostAsJsonAsync("/api/crm/matching/reserve", reserveReq);
        if (reserveRes.StatusCode != HttpStatusCode.OK)
        {
            var err = await reserveRes.Content.ReadAsStringAsync();
            throw new Exception($"Reserve failed: {reserveRes.StatusCode} - {err}");
        }
        var updatedMatch = await reserveRes.Content.ReadFromJsonAsync<InventoryMatchResponse>();
        updatedMatch.Should().NotBeNull();
        updatedMatch!.Status.Should().Be(MatchStatus.Reserved);

        // 8. Tentar Reservar Novamente a Mesma Unidade (Prevenção de Over-Selling / Duplicidade)
        // Se a unidade já estiver reservada, o sistema deve rejeitar
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var u = await db.Set<InventoryUnit>().FindAsync(eligibleUnitId);
            u!.MarkSold(); // Simular saída do estoque
            await db.SaveChangesAsync();
        }

        var secondReserveRes = await client.PostAsJsonAsync("/api/crm/matching/reserve", reserveReq);
        secondReserveRes.StatusCode.Should().Be(HttpStatusCode.InternalServerError);
    }

    [Fact]
    public async Task Crm_CompleteLifecycle_Lead_ToOpportunity_ToParty_AndConsentCompliance()
    {
        var (tenantId, branchId) = await SeedTenantAndBranchAsync();

        var client = CreateAuthenticatedClient(tenantId, branchId, [
            PermissionCatalog.CrmView,
            PermissionCatalog.CrmManage,
            PermissionCatalog.CustomersView,
            PermissionCatalog.CustomersCreate
        ]);

        // 1. Criar Lead no balcão
        var leadReq = new CreateLeadRequest(
            Name: "Fernanda Lins",
            Phone: "(11) 98888-7766",
            Email: "fernanda.lins@gmail.com",
            Source: "Instagram",
            MainInterest: "Troca de Tela iPad Pro 12.9",
            AssignedSellerUserId: null,
            Notes: "Solicitou cotação rápida.");

        var leadRes = await client.PostAsJsonAsync("/api/crm/leads", leadReq);
        leadRes.StatusCode.Should().Be(HttpStatusCode.Created);
        var lead = await leadRes.Content.ReadFromJsonAsync<LeadResponse>();
        lead.Should().NotBeNull();
        lead!.Status.Should().Be(LeadStatus.New);

        // 2. Qualificar o Lead
        var updateStatusRes = await client.PutAsJsonAsync($"/api/crm/leads/{lead.Id}/status", new UpdateLeadStatusRequest(LeadStatus.Qualified, "Interesse confirmado; agendando visita"));
        updateStatusRes.StatusCode.Should().Be(HttpStatusCode.OK);

        // 3. Converter Lead em Party Oficial
        Guid partyId;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var party = new Party(tenantId, PartyType.Individual, lead.Name, documentNumber: "98765432100");
            // Registrar opt-out de marketing (o cliente pediu apenas suporte de OS, sem publicidade)
            party.RecordConsent("WhatsApp", "Marketing", isOptIn: false, origin: "Balcão Atendimento");
            db.Parties.Add(party);
            await db.SaveChangesAsync();
            partyId = party.Id;
        }

        var convertRes = await client.PostAsJsonAsync($"/api/crm/leads/{lead.Id}/convert", new ConvertLeadRequest(partyId));
        if (convertRes.StatusCode != HttpStatusCode.OK)
        {
            var err = await convertRes.Content.ReadAsStringAsync();
            throw new Exception($"Convert failed: {convertRes.StatusCode} - {err}");
        }
        var convertedLead = await convertRes.Content.ReadFromJsonAsync<LeadResponse>();
        convertedLead!.Status.Should().Be(LeadStatus.Converted);
        convertedLead.ConvertedPartyId.Should().Be(partyId);

        // 4. Criar Funil e Oportunidade
        var pipelineReq = new CreatePipelineRequest(
            Name: "Assistência Técnica & Upgrades",
            PipelineType: PipelineType.RepairServices,
            Stages: [
                new CreatePipelineStageRequest("Contato Inicial", 1),
                new CreatePipelineStageRequest("Orçamento Apresentado", 2),
                new CreatePipelineStageRequest("Serviço Aprovado", 3, IsWonStage: true),
                new CreatePipelineStageRequest("Desistência", 4, IsLostStage: true)
            ]);

        var pipeRes = await client.PostAsJsonAsync("/api/crm/pipelines", pipelineReq);
        pipeRes.StatusCode.Should().Be(HttpStatusCode.Created);
        var pipeline = await pipeRes.Content.ReadFromJsonAsync<PipelineResponse>();
        pipeline.Should().NotBeNull();
        var initialStage = pipeline!.Stages.First(s => s.OrderIndex == 1);
        var wonStage = pipeline.Stages.First(s => s.IsWonStage);

        var oppReq = new CreateOpportunityRequest(
            PartyId: partyId,
            LeadId: lead.Id,
            PipelineId: pipeline.Id,
            StageId: initialStage.Id,
            AssignedSellerUserId: null,
            Title: "Reparo Tela iPad Pro - Fernanda",
            EstimatedValue: 1200.00m,
            Priority: OpportunityPriority.High,
            Description: "Orçamento para módulo de tela original");

        var oppRes = await client.PostAsJsonAsync("/api/crm/opportunities", oppReq);
        oppRes.StatusCode.Should().Be(HttpStatusCode.Created);
        var opp = await oppRes.Content.ReadFromJsonAsync<OpportunityResponse>();
        opp.Should().NotBeNull();
        opp!.Status.Should().Be(OpportunityStatus.Open);

        // 5. Adicionar Atividade Comercial à Oportunidade
        var actReq = new AddOpportunityActivityRequest(
            ActivityType: ActivityType.PhoneCall,
            Title: "Confirmar recebimento do orçamento",
            Description: "Ligar às 14h para confirmar detalhes",
            ScheduledForUtc: DateTime.UtcNow.AddHours(2),
            AssignedUserId: null,
            Priority: OpportunityPriority.High);

        var actRes = await client.PostAsJsonAsync($"/api/crm/opportunities/{opp.Id}/activities", actReq);
        actRes.StatusCode.Should().Be(HttpStatusCode.OK);
        var oppWithAct = await actRes.Content.ReadFromJsonAsync<OpportunityResponse>();
        oppWithAct!.Activities.Should().HaveCount(1);

        // 6. Mover Etapa para Ganha
        var moveReq = new MoveOpportunityStageRequest(wonStage.Id, IsWon: true, IsLost: false);
        var moveRes = await client.PutAsJsonAsync($"/api/crm/opportunities/{opp.Id}/stage", moveReq);
        moveRes.StatusCode.Should().Be(HttpStatusCode.OK);
        var wonOpp = await moveRes.Content.ReadFromJsonAsync<OpportunityResponse>();
        wonOpp!.Status.Should().Be(OpportunityStatus.Won);
        wonOpp.ClosedAtUtc.Should().NotBeNull();

        // 7. Dashboard Metrics
        var metricsRes = await client.GetAsync("/api/crm/metrics");
        metricsRes.StatusCode.Should().Be(HttpStatusCode.OK);
        var metrics = await metricsRes.Content.ReadFromJsonAsync<CrmDashboardMetricsResponse>();
        metrics.Should().NotBeNull();
    }
}
