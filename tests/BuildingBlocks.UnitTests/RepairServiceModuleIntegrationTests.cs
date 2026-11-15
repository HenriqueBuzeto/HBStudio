using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using BuildingBlocks.Domain;
using BuildingBlocks.Infrastructure;
using BuildingBlocks.Security;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Parties.Domain;
using RepairService.Application.DTOs;
using RepairService.Domain.Enums;
using Xunit;

namespace BuildingBlocks.UnitTests;

public class RepairServiceModuleIntegrationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private const string ConnectionString = "Host=127.0.0.1;Port=5433;Database=hbstudio_erp_test;Username=postgres;Password=;";
    private readonly WebApplicationFactory<Program> _factory;
    private readonly JwtTokenService _jwtTokenService;

    public RepairServiceModuleIntegrationTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _jwtTokenService = new JwtTokenService(
            "HBStudioEnterpriseErpSuperSecretKey20261113!",
            "HBStudioErp",
            "HBStudioErpClient"
        );
    }

    private HttpClient CreateAuthenticatedClient(Guid tenantId, Guid branchId, Guid userId, params string[] permissions)
    {
        var client = _factory.CreateClient();
        var token = _jwtTokenService.GenerateToken(
            tenantId,
            branchId,
            userId,
            "tecnico.balcao@hbstudio.com.br",
            permissions
        );
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token.AccessToken);
        return client;
    }

    private async Task<(Guid CustomerId, Guid EquipmentId)> SeedCustomerAndEquipmentAsync(Guid tenantId)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(ConnectionString).Options;
        await using var db = new AppDbContext(options);

        var party = new Party(tenantId, PartyType.Individual, $"Cliente Teste {Guid.NewGuid():N}", null, "12345678901");
        party.EnableCustomerProfile();
        db.Parties.Add(party);

        var equipment = new CustomerEquipment(
            tenantId,
            party.Id,
            "Celular",
            "Apple",
            "iPhone 13 Pro",
            $"SN-{Guid.NewGuid():N}",
            "354890123456789",
            null,
            "Azul Sierra",
            "Entrada para troca de tela"
        );
        db.CustomerEquipments.Add(equipment);

        await db.SaveChangesAsync();
        return (party.Id, equipment.Id);
    }

    [Fact]
    public async Task RepairService_CompleteLifecycle_FromIntakeToDeliveryAndWarranty()
    {
        var tenantId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var branchId = Guid.NewGuid();

        var (customerId, equipmentId) = await SeedCustomerAndEquipmentAsync(tenantId);

        var client = CreateAuthenticatedClient(tenantId, branchId, userId,
            PermissionCatalog.RepairsView,
            PermissionCatalog.RepairsCreate,
            PermissionCatalog.RepairsDiagnose,
            PermissionCatalog.RepairsQuote,
            PermissionCatalog.RepairsApprove,
            PermissionCatalog.RepairsAssign,
            PermissionCatalog.RepairsExecute,
            PermissionCatalog.RepairsPartsConsume,
            PermissionCatalog.RepairsQualityCheck,
            PermissionCatalog.RepairsDeliver,
            PermissionCatalog.RepairsWarranty
        );

        // 1. Abertura da Ordem de Serviço no Balcão
        var orderNumber = $"OS-{DateTime.UtcNow.Ticks}";
        var createRequest = new CreateRepairOrderRequest(
            branchId,
            orderNumber,
            customerId,
            equipmentId,
            "Tela quebrada após queda, touch com toque fantasma.",
            "Trincado no canto superior direito da tela, carcaça sem amassados severos.",
            "Capa de silicone, sem carregador",
            DateTime.UtcNow.AddDays(2)
        );

        var createRes = await client.PostAsJsonAsync("/api/repairs/orders", createRequest);
        Assert.Equal(HttpStatusCode.Created, createRes.StatusCode);
        var order = await createRes.Content.ReadFromJsonAsync<RepairOrderResponse>();
        Assert.NotNull(order);
        Assert.Equal(RepairOrderStatus.Received, order.Status);
        Assert.Equal(orderNumber, order.OrderNumber);

        // 2. Checklist de Entrada (Smartphone)
        var checklistItem = new AddChecklistItemRequest("Tela", "Touchscreen", ChecklistItemStatus.NonConforming, "Toque fantasma e falha em linha vertical.");
        var chkRes = await client.PostAsJsonAsync($"/api/repairs/orders/{order.Id}/checklist", checklistItem);
        if (chkRes.StatusCode != HttpStatusCode.OK)
        {
            var err = await chkRes.Content.ReadAsStringAsync();
            throw new Exception($"Checklist falhou com status {chkRes.StatusCode}: {err}");
        }
        Assert.Equal(HttpStatusCode.OK, chkRes.StatusCode);

        // 3. Atribuição de Técnico e Início do Diagnóstico na Bancada
        var techId = Guid.NewGuid();
        var assignRes = await client.PostAsync($"/api/repairs/orders/{order.Id}/assign-technician?technicianId={techId}", null);
        if (assignRes.StatusCode != HttpStatusCode.OK)
        {
            var err = await assignRes.Content.ReadAsStringAsync();
            throw new Exception($"AssignTechnician falhou com status {assignRes.StatusCode}: {err}");
        }
        Assert.Equal(HttpStatusCode.OK, assignRes.StatusCode);

        var startDiagRes = await client.PostAsync($"/api/repairs/orders/{order.Id}/start-diagnosis?technicianId={techId}", null);
        Assert.Equal(HttpStatusCode.OK, startDiagRes.StatusCode);

        // 4. Conclusão do Diagnóstico
        var diagRequest = new CompleteDiagnosisRequest("Necessária substituição do módulo display OLED original. Face ID e bateria intactos.");
        var compDiagRes = await client.PostAsJsonAsync($"/api/repairs/orders/{order.Id}/complete-diagnosis", diagRequest);
        Assert.Equal(HttpStatusCode.OK, compDiagRes.StatusCode);
        var diagOrder = await compDiagRes.Content.ReadFromJsonAsync<RepairOrderResponse>();
        Assert.Equal(RepairOrderStatus.WaitingEstimateApproval, diagOrder?.Status);

        // 5. Elaboração e Aprovação do Orçamento (CDC Art. 40)
        var laborItem = new AddEstimateItemRequest(RepairEstimateItemType.LaborService, "Mão de obra técnica qualificada - Troca de Tela iPhone 13 Pro", 1, 250.00m, 80.00m);
        await client.PostAsJsonAsync($"/api/repairs/orders/{order.Id}/estimate/items", laborItem);

        var partItem = new AddEstimateItemRequest(RepairEstimateItemType.Part, "Display OLED iPhone 13 Pro Premium", 1, 650.00m, 380.00m, Guid.NewGuid());
        var estRes = await client.PostAsJsonAsync($"/api/repairs/orders/{order.Id}/estimate/items", partItem);
        Assert.Equal(HttpStatusCode.OK, estRes.StatusCode);
        var estOrder = await estRes.Content.ReadFromJsonAsync<RepairOrderResponse>();
        Assert.Equal(900.00m, estOrder?.FinalPrice);

        // Aprovação expressa do cliente
        var approveRequest = new ApproveEstimateRequest("WhatsApp Balcão", "Mensagem de áudio e texto do cliente confirmando orçamento de R$ 900,00");
        var appRes = await client.PostAsJsonAsync($"/api/repairs/orders/{order.Id}/estimate/approve", approveRequest);
        Assert.Equal(HttpStatusCode.OK, appRes.StatusCode);

        // 6. Início do Reparo e Consumo de Peça Rastreável
        var startRepairRes = await client.PostAsync($"/api/repairs/orders/{order.Id}/start-repair", null);
        Assert.Equal(HttpStatusCode.OK, startRepairRes.StatusCode);

        var consumePartRequest = new ConsumePartRequest(Guid.NewGuid(), "Display OLED iPhone 13 Pro Premium", 1, 380.00m);
        var partConsumeRes = await client.PostAsJsonAsync($"/api/repairs/orders/{order.Id}/parts/consume", consumePartRequest);
        Assert.Equal(HttpStatusCode.OK, partConsumeRes.StatusCode);

        // 7. Conclusão Técnica e Inspeção de Qualidade (Quality Check)
        var completeRepairRequest = new CompleteRepairRequest("Tela instalada com sucesso, testes de touch 100%, TrueTone programado.", 75.00m);
        var compRepairRes = await client.PostAsJsonAsync($"/api/repairs/orders/{order.Id}/complete-repair", completeRepairRequest);
        Assert.Equal(HttpStatusCode.OK, compRepairRes.StatusCode);

        var qaRequest = new PassQualityCheckRequest("Câmeras, FaceID, microfone e carregamento validados conforme protocolo.");
        var qaRes = await client.PostAsJsonAsync($"/api/repairs/orders/{order.Id}/quality-check", qaRequest);
        Assert.Equal(HttpStatusCode.OK, qaRes.StatusCode);
        var qaOrder = await qaRes.Content.ReadFromJsonAsync<RepairOrderResponse>();
        Assert.Equal(RepairOrderStatus.ReadyForPickup, qaOrder?.Status);

        // 8. Entrega ao Cliente e Ativação da Garantia Legal (CDC 90 dias)
        var deliverRequest = new DeliverRepairOrderRequest("Cliente Teste", "12345678901", "Aparelho entregue em perfeitas condições com película aplicada.", 0);
        var delRes = await client.PostAsJsonAsync($"/api/repairs/orders/{order.Id}/deliver", deliverRequest);
        Assert.Equal(HttpStatusCode.OK, delRes.StatusCode);
        var deliveredOrder = await delRes.Content.ReadFromJsonAsync<RepairOrderResponse>();
        Assert.Equal(RepairOrderStatus.Delivered, deliveredOrder?.Status);
        Assert.Equal(90, deliveredOrder?.LegalWarrantyDays);
        Assert.NotNull(deliveredOrder?.WarrantyExpiresAtUtc);

        // 9. Abertura e Avaliação de Reclamação em Garantia
        var claimRequest = new CreateWarrantyClaimRequest("Toque falhando na borda inferior após 15 dias de uso", DateTime.UtcNow);
        var claimRes = await client.PostAsJsonAsync($"/api/repairs/orders/{order.Id}/warranty/claims", claimRequest);
        Assert.Equal(HttpStatusCode.OK, claimRes.StatusCode);
        var orderWithClaim = await claimRes.Content.ReadFromJsonAsync<RepairOrderResponse>();
        var claim = orderWithClaim?.WarrantyClaims.First();
        Assert.NotNull(claim);
        Assert.Equal(WarrantyCoverageDecision.UnderReview, claim.Decision);

        var decideClaimRequest = new DecideWarrantyClaimRequest(WarrantyCoverageDecision.Covered, "Falha de componente constatada na bancada sem avarias físicas. Garantia integral autorizada.");
        var decideRes = await client.PostAsJsonAsync($"/api/repairs/orders/{order.Id}/warranty/claims/{claim.Id}/decide", decideClaimRequest);
        Assert.Equal(HttpStatusCode.OK, decideRes.StatusCode);
        var orderDecided = await decideRes.Content.ReadFromJsonAsync<RepairOrderResponse>();
        var decidedClaim = orderDecided?.WarrantyClaims.First(c => c.Id == claim.Id);
        Assert.Equal(WarrantyCoverageDecision.Covered, decidedClaim?.Decision);
    }

    [Fact]
    public async Task RepairService_CustomerEquipment_DoesNotAlterCommercialInventory()
    {
        var tenantId = Guid.NewGuid();
        var (customerId, equipmentId) = await SeedCustomerAndEquipmentAsync(tenantId);

        var options = new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(ConnectionString).Options;
        await using var db = new AppDbContext(options);

        // Confirmar que o CustomerEquipment pertence à tabela do Parties e não cria InventoryUnit comercial
        var customerEquipment = await db.CustomerEquipments.FirstOrDefaultAsync(e => e.Id == equipmentId);
        Assert.NotNull(customerEquipment);

        var commercialUnits = await db.InventoryUnits.Where(u => u.SerialNumber == customerEquipment.SerialNumber).ToListAsync();
        Assert.Empty(commercialUnits); // Custódia de aparelho do cliente nunca vira mercadoria da loja
    }

    [Fact]
    public async Task RepairService_Security_RequiresRepairsPermissions()
    {
        var tenantId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var branchId = Guid.NewGuid();
        var (customerId, equipmentId) = await SeedCustomerAndEquipmentAsync(tenantId);

        // Usuário sem permissões
        var client = CreateAuthenticatedClient(tenantId, branchId, userId);

        var createRequest = new CreateRepairOrderRequest(
            branchId,
            $"OS-{DateTime.UtcNow.Ticks}",
            customerId,
            equipmentId,
            "Troca de bateria",
            null,
            null,
            null
        );

        var res = await client.PostAsJsonAsync("/api/repairs/orders", createRequest);
        Assert.Equal(HttpStatusCode.Forbidden, res.StatusCode);
    }
}
