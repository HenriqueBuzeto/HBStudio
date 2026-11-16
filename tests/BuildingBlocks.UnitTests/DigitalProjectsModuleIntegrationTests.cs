using System.Net;
using System.Net.Http.Json;
using BuildingBlocks.Domain;
using BuildingBlocks.Security;
using DigitalProjects.Application.DTOs;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;

namespace BuildingBlocks.UnitTests;

public class DigitalProjectsModuleIntegrationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly ITokenService _jwtTokenService;

    public DigitalProjectsModuleIntegrationTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _jwtTokenService = new JwtTokenService(
            "HBStudioEnterpriseErpSuperSecretKey20261113!",
            "HBStudioErp",
            "HBStudioErpClient");
    }

    private HttpClient CreateClientWithPermissions(Guid tenantId, Guid branchId, params string[] permissions)
    {
        var tokenResponse = _jwtTokenService.GenerateToken(
            tenantId,
            branchId,
            Guid.NewGuid(),
            "projects.tester@hbstudio.com",
            permissions);

        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", tokenResponse.AccessToken);
        return client;
    }

    [Fact]
    public async Task Projects_Lifecycle_Scope_Milestones_Tasks_Timesheet_Deliverables_AndCostRentability()
    {
        // ARRANGE: Tenant isolado e permissões canônicas
        var tenantId = Guid.NewGuid();
        var branchId = Guid.NewGuid();
        var customerPartyId = Guid.NewGuid();
        var leadTechId = Guid.NewGuid();

        var client = CreateClientWithPermissions(
            tenantId,
            branchId,
            PermissionCatalog.ProjectsView,
            PermissionCatalog.ProjectsManage
        );

        // 1. Criar Projeto Digital Enterprise
        var createProjectReq = new CreateDigitalProjectRequest(
            "Portal Enterprise HB Studio & E-commerce",
            "Desenvolvimento de portal institucional, catálogo e sistema de pedidos sob medida",
            1, // CustomSoftware
            1, // FixedPrice
            customerPartyId,
            null,
            null,
            leadTechId,
            "Henrique Barreto",
            8500.00m, // Preço Contratado R$ 8.500
            60.00m,   // 60 horas estimadas
            DateTime.UtcNow,
            DateTime.UtcNow.AddDays(30)
        );

        var createRes = await client.PostAsJsonAsync("/api/projects", createProjectReq);
        createRes.StatusCode.Should().Be(HttpStatusCode.Created);
        var created = await createRes.Content.ReadFromJsonAsync<DigitalProjectDto>();
        created.Should().NotBeNull();
        created!.Name.Should().Be(createProjectReq.Name);
        created.ContractedPrice.Should().Be(8500.00m);
        created.Status.Should().Be("Draft");

        // 2. Adicionar Marco Contratual (Milestone)
        var createMilestoneReq = new CreateMilestoneRequest(
            "Fase 1: Protótipo UI/UX & Arquitetura Base",
            "Aprovação do layout, design system e rotas preliminares",
            DateTime.UtcNow.AddDays(7),
            3000.00m,
            true // Faturável
        );
        var mRes = await client.PostAsJsonAsync($"/api/projects/{created.Id}/milestones", createMilestoneReq);
        mRes.StatusCode.Should().Be(HttpStatusCode.Created);
        var milestone = await mRes.Content.ReadFromJsonAsync<MilestoneDto>();
        milestone.Should().NotBeNull();
        milestone!.MilestonePrice.Should().Be(3000.00m);
        milestone.Status.Should().Be("Planned");

        // 3. Adicionar Tarefa Técnica
        var createTaskReq = new CreateProjectTaskRequest(
            milestone.Id,
            "Implementar Design System HBVisionX no Next.js",
            "Configuração de Tailwind, layouts, tipografia e cards",
            leadTechId,
            "Henrique Barreto",
            16.00m,
            DateTime.UtcNow.AddDays(3)
        );
        var tRes = await client.PostAsJsonAsync($"/api/projects/{created.Id}/tasks", createTaskReq);
        tRes.StatusCode.Should().Be(HttpStatusCode.Created);
        var task = await tRes.Content.ReadFromJsonAsync<TaskDto>();
        task.Should().NotBeNull();
        task!.Title.Should().Be(createTaskReq.Title);

        // 4. Apontar Horas Trabalhadas com Custo Horário Histórico (Timesheet)
        // 5 horas trabalhadas a um custo interno de R$ 50/h = R$ 250 de custo de mão de obra
        var timeReq = new CreateTimeEntryRequest(
            task.Id,
            leadTechId,
            "Henrique Barreto",
            DateTime.UtcNow,
            5.00m,
            1, // Development
            "Desenvolvimento de componentes base e temas da UI",
            true,
            50.00m // R$ 50/h custo histórico real
        );
        var timeRes = await client.PostAsJsonAsync($"/api/projects/{created.Id}/time-entries", timeReq);
        timeRes.StatusCode.Should().Be(HttpStatusCode.Created);
        var entry = await timeRes.Content.ReadFromJsonAsync<TimeEntryDto>();
        entry.Should().NotBeNull();
        entry!.TotalCost.Should().Be(250.00m);

        // 5. Adicionar Entregável Formal (Código-Fonte com Hash)
        var delivReq = new CreateDeliverableRequest(
            milestone.Id,
            "Release Candidate v1.0.0 Frontend",
            1, // SourceCodeRepo
            "v1.0.0",
            "Repositório com arquitetura pronta para homologação",
            "git@github.com:hbstudio/portal.git",
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        );
        var delivRes = await client.PostAsJsonAsync($"/api/projects/{created.Id}/deliverables", delivReq);
        delivRes.StatusCode.Should().Be(HttpStatusCode.Created);
        var deliverable = await delivRes.Content.ReadFromJsonAsync<DeliverableDto>();
        deliverable.Should().NotBeNull();
        deliverable!.Status.Should().Be("Draft");

        // 6. Aceite Formal do Entregável pelo Cliente
        var acceptDelivRes = await client.PostAsync($"/api/projects/{created.Id}/deliverables/{deliverable.Id}/accept", null);
        acceptDelivRes.StatusCode.Should().Be(HttpStatusCode.OK);

        // 7. Aprovação do Marco Contratual
        var approveMilestoneRes = await client.PostAsync($"/api/projects/{created.Id}/milestones/{milestone.Id}/approve", null);
        approveMilestoneRes.StatusCode.Should().Be(HttpStatusCode.OK);

        // 8. Solicitação de Mudança de Escopo (Change Request)
        var crReq = new CreateChangeRequestRequest(
            "Adicionar Integração com WhatsApp Meta Cloud",
            "Carlos Diretor",
            "Necessidade de envio de mensagens automáticas de confirmação",
            "Novos endpoints e webhooks na API",
            12.00m, // 12 horas
            600.00m, // Custo R$ 600
            1500.00m, // Preço adicional R$ 1.500
            5 // 5 dias
        );
        var crRes = await client.PostAsJsonAsync($"/api/projects/{created.Id}/change-requests", crReq);
        crRes.StatusCode.Should().Be(HttpStatusCode.Created);
        var cr = await crRes.Content.ReadFromJsonAsync<ChangeRequestDto>();
        cr.Should().NotBeNull();
        cr!.Status.Should().Be("Draft");

        // Aprovação do Aditivo
        var approveCrRes = await client.PostAsync($"/api/projects/{created.Id}/change-requests/{cr.Id}/approve", null);
        approveCrRes.StatusCode.Should().Be(HttpStatusCode.OK);

        // 9. Consultar Detalhes Consolidados do Projeto
        var detailsRes = await client.GetAsync($"/api/projects/{created.Id}");
        detailsRes.StatusCode.Should().Be(HttpStatusCode.OK);
        var details = await detailsRes.Content.ReadFromJsonAsync<DigitalProjectDetailsDto>();
        details.Should().NotBeNull();

        // Validações Contábeis e Rastreabilidade
        details!.TotalActualLaborCost.Should().Be(250.00m);
        details.TotalActualCost.Should().Be(250.00m);
        details.Milestones.Should().HaveCount(1);
        details.Milestones[0].Status.Should().Be("Accepted");
        details.Tasks.Should().HaveCount(1);
        details.TimeEntries.Should().HaveCount(1);
        details.Deliverables.Should().HaveCount(1);
        details.Deliverables[0].Status.Should().Be("Accepted");
        details.ChangeRequests.Should().HaveCount(1);
        details.ChangeRequests[0].Status.Should().Be("Approved");
    }

    [Fact]
    public async Task Projects_WithoutPermission_ReturnsForbidden()
    {
        // ARRANGE: Usuário autenticado sem permissões de projetos
        var tenantId = Guid.NewGuid();
        var branchId = Guid.NewGuid();
        var client = CreateClientWithPermissions(tenantId, branchId, "sales.pos.use");

        // ACT
        var res = await client.GetAsync("/api/projects");

        // ASSERT: Fail-Closed Enterprise
        res.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }
}
