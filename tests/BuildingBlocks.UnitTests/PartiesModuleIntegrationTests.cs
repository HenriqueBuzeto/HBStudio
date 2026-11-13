using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using BuildingBlocks.Domain;
using BuildingBlocks.Infrastructure;
using BuildingBlocks.Security;
using Parties.Application;
using Parties.Domain;
using Xunit;

namespace BuildingBlocks.UnitTests;

public class PartiesModuleIntegrationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private const string PostgresTestConn = "Host=127.0.0.1;Port=5433;Database=hbstudio_erp_test;Username=postgres;Password=;";
    private readonly JwtTokenService _jwtTokenService = new("HBStudioEnterpriseErpSuperSecretKey20261113!");

    public PartiesModuleIntegrationTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task CreateCustomerPF_ShouldSucceed_AndPersistBothPartyAndCustomerProfile()
    {
        var tenantId = Guid.NewGuid();
        var client = _factory.CreateClient();

        var token = _jwtTokenService.GenerateToken(
            tenantId,
            null,
            Guid.NewGuid(),
            "atendente@hbstudio.com.br",
            new[] { PermissionCatalog.CustomersView, PermissionCatalog.CustomersCreate }
        );
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token.AccessToken);

        var request = new CreatePartyRequest(
            Type: PartyType.Individual,
            Name: "Carlos Eduardo Silva",
            TradeName: null,
            DocumentNumber: "12345678901",
            StateRegistration: null,
            MunicipalRegistration: null,
            BirthDate: new DateTime(1990, 5, 20),
            Notes: "Cliente balcão fidelizado",
            EnableCustomer: true,
            EnableSupplier: false,
            CustomerNotes: "Preferência por pagamento PIX",
            SupplyCategories: null,
            PaymentTerms: null,
            PrimaryPhone: "11987654321",
            PrimaryEmail: "carlos.silva@example.com"
        );

        var response = await client.PostAsJsonAsync("/api/parties", request);
        response.StatusCode.Should().Be(HttpStatusCode.Created);

        var created = await response.Content.ReadFromJsonAsync<PartyResponse>();
        created.Should().NotBeNull();
        created!.Name.Should().Be("Carlos Eduardo Silva");
        created.IsCustomer.Should().BeTrue();
        created.IsSupplier.Should().BeFalse();
        created.DocumentNumber.Should().Be("12345678901");
        created.Contacts.Should().HaveCount(1);
        created.Contacts.First().Phone.Should().Be("11987654321");

        // Validar no PostgreSQL real
        var options = new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(PostgresTestConn).Options;
        using var context = new AppDbContext(options);
        var dbRecord = await context.Parties
            .Include(p => p.CustomerProfile)
            .Include(p => p.Contacts)
            .FirstOrDefaultAsync(p => p.Id == created.Id);

        dbRecord.Should().NotBeNull();
        dbRecord!.CustomerProfile.Should().NotBeNull();
        dbRecord.CustomerProfile!.InternalNotes.Should().Be("Preferência por pagamento PIX");
    }

    [Fact]
    public async Task SameParty_CanBeCustomerAndSupplierSimultaneously()
    {
        var tenantId = Guid.NewGuid();
        var client = _factory.CreateClient();

        var token = _jwtTokenService.GenerateToken(
            tenantId,
            null,
            Guid.NewGuid(),
            "gerente@hbstudio.com.br",
            new[] { PermissionCatalog.CustomersView, PermissionCatalog.CustomersCreate }
        );
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token.AccessToken);

        var request = new CreatePartyRequest(
            Type: PartyType.LegalEntity,
            Name: "Tech Parts & Servicos LTDA",
            TradeName: "TechParts",
            DocumentNumber: "12345678000199",
            StateRegistration: "123456789",
            MunicipalRegistration: null,
            BirthDate: null,
            Notes: "Fornecedor de telas e cliente de manutenção de notebooks",
            EnableCustomer: true,
            EnableSupplier: true,
            CustomerNotes: "Faturamento quinzenal",
            SupplyCategories: "Peças de celular, Telas OLED",
            PaymentTerms: "Boleto 28 dias",
            PrimaryPhone: "1133334444",
            PrimaryEmail: "contato@techparts.com"
        );

        var response = await client.PostAsJsonAsync("/api/parties", request);
        response.StatusCode.Should().Be(HttpStatusCode.Created);

        var created = await response.Content.ReadFromJsonAsync<PartyResponse>();
        created!.IsCustomer.Should().BeTrue();
        created.IsSupplier.Should().BeTrue();

        var options = new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(PostgresTestConn).Options;
        using var context = new AppDbContext(options);
        var dbRecord = await context.Parties
            .Include(p => p.CustomerProfile)
            .Include(p => p.SupplierProfile)
            .FirstOrDefaultAsync(p => p.Id == created.Id);

        dbRecord!.CustomerProfile.Should().NotBeNull();
        dbRecord.SupplierProfile.Should().NotBeNull();
        dbRecord.SupplierProfile!.SupplyCategories.Should().Contain("Telas OLED");
    }

    [Fact]
    public async Task AddCustomerEquipment_ShouldLinkToParty_WithoutAffectingInventory()
    {
        var tenantId = Guid.NewGuid();
        var client = _factory.CreateClient();

        var token = _jwtTokenService.GenerateToken(
            tenantId,
            null,
            Guid.NewGuid(),
            "tecnico@hbstudio.com.br",
            new[] { PermissionCatalog.CustomersView, PermissionCatalog.CustomersCreate, PermissionCatalog.CustomersEdit }
        );
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token.AccessToken);

        // 1. Criar Cliente
        var partyReq = new CreatePartyRequest(
            Type: PartyType.Individual,
            Name: "Mariana Costa",
            TradeName: null,
            DocumentNumber: "98765432100",
            StateRegistration: null,
            MunicipalRegistration: null,
            BirthDate: null,
            Notes: null,
            EnableCustomer: true,
            EnableSupplier: false,
            CustomerNotes: null,
            SupplyCategories: null,
            PaymentTerms: null,
            PrimaryPhone: "1199998888",
            PrimaryEmail: "mariana@example.com"
        );

        var partyRes = await client.PostAsJsonAsync("/api/parties", partyReq);
        var party = await partyRes.Content.ReadFromJsonAsync<PartyResponse>();

        // 2. Adicionar Equipamento do Cliente (CustomerEquipment)
        var eqReq = new AddEquipmentRequest(
            EquipmentType: "Celular",
            Brand: "Apple",
            Model: "iPhone 14 Pro Max",
            SerialNumber: "F2LZQ0XXXXX",
            Imei1: "354890123456789",
            Imei2: "354890123456780",
            Color: "Roxo Profundo",
            Notes: "Vidro traseiro trincado e tela piscando"
        );

        var eqRes = await client.PostAsJsonAsync($"/api/parties/{party!.Id}/equipments", eqReq);
        eqRes.StatusCode.Should().Be(HttpStatusCode.Created);

        var eq = await eqRes.Content.ReadFromJsonAsync<CustomerEquipmentResponse>();
        eq.Should().NotBeNull();
        eq!.Model.Should().Be("iPhone 14 Pro Max");
        eq.Imei1.Should().Be("354890123456789");

        // 3. Validar no banco real que o CustomerEquipment pertence à Party e NÃO é um item de estoque
        var options = new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(PostgresTestConn).Options;
        using var context = new AppDbContext(options);
        var dbEq = await context.CustomerEquipments.FirstOrDefaultAsync(e => e.Id == eq.Id);

        dbEq.Should().NotBeNull();
        dbEq!.PartyId.Should().Be(party.Id);
        dbEq.TenantId.Should().Be(tenantId);
    }

    [Fact]
    public async Task RecordConsent_ShouldPersistAuditAndLgpdPreferences()
    {
        var tenantId = Guid.NewGuid();
        var client = _factory.CreateClient();

        var token = _jwtTokenService.GenerateToken(
            tenantId,
            null,
            Guid.NewGuid(),
            "atendente@hbstudio.com.br",
            new[] { PermissionCatalog.CustomersView, PermissionCatalog.CustomersCreate, PermissionCatalog.CustomersEdit }
        );
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token.AccessToken);

        // Criar Pessoa
        var partyReq = new CreatePartyRequest(
            Type: PartyType.Individual,
            Name: "Lucas Ribeiro",
            TradeName: null,
            DocumentNumber: "11122233344",
            StateRegistration: null,
            MunicipalRegistration: null,
            BirthDate: null,
            Notes: null,
            EnableCustomer: true,
            EnableSupplier: false,
            CustomerNotes: null,
            SupplyCategories: null,
            PaymentTerms: null,
            PrimaryPhone: "11977776666",
            PrimaryEmail: "lucas@example.com"
        );

        var partyRes = await client.PostAsJsonAsync("/api/parties", partyReq);
        var party = await partyRes.Content.ReadFromJsonAsync<PartyResponse>();

        // Registrar Consentimento WhatsApp Marketing com Opt-in explícito
        var consentReq = new RecordConsentRequest(
            Channel: "WhatsApp",
            Purpose: "Marketing",
            IsOptIn: true,
            Origin: "Termo de Balcão Assinado",
            Evidence: "Documento digitalizado #DOC-4482"
        );

        var consentRes = await client.PostAsJsonAsync($"/api/parties/{party!.Id}/consents", consentReq);
        consentRes.StatusCode.Should().Be(HttpStatusCode.Created);

        var consent = await consentRes.Content.ReadFromJsonAsync<PartyConsentResponse>();
        consent!.Channel.Should().Be("WHATSAPP");
        consent.Purpose.Should().Be("Marketing");
        consent.IsOptIn.Should().BeTrue();
    }

    [Fact]
    public async Task TenantIsolation_TenantBCannotSeeTenantAParties()
    {
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();
        var client = _factory.CreateClient();

        // 1. Criar cliente no Tenant A
        var tokenA = _jwtTokenService.GenerateToken(tenantA, null, Guid.NewGuid(), "userA@hbstudio.com.br", new[] { PermissionCatalog.CustomersView, PermissionCatalog.CustomersCreate });
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", tokenA.AccessToken);

        var partyReq = new CreatePartyRequest(
            Type: PartyType.Individual,
            Name: "Cliente Exclusivo Tenant A",
            TradeName: null,
            DocumentNumber: "55544433322",
            StateRegistration: null,
            MunicipalRegistration: null,
            BirthDate: null,
            Notes: null,
            EnableCustomer: true,
            EnableSupplier: false,
            CustomerNotes: null,
            SupplyCategories: null,
            PaymentTerms: null,
            PrimaryPhone: "11988887777",
            PrimaryEmail: "tenantA@example.com"
        );

        var resA = await client.PostAsJsonAsync("/api/parties", partyReq);
        var createdA = await resA.Content.ReadFromJsonAsync<PartyResponse>();

        // 2. Consultar listagem com usuário do Tenant B
        var tokenB = _jwtTokenService.GenerateToken(tenantB, null, Guid.NewGuid(), "userB@hbstudio.com.br", new[] { PermissionCatalog.CustomersView });
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", tokenB.AccessToken);

        var resB = await client.GetAsync("/api/parties");
        var listB = await resB.Content.ReadFromJsonAsync<List<PartyResponse>>();

        // Assert: Tenant B não vê o cliente criado no Tenant A
        listB.Should().NotContain(p => p.Id == createdA!.Id);

        // 3. Tentar acessar diretamente o detalhe por Id
        var resDetailB = await client.GetAsync($"/api/parties/{createdA!.Id}");
        resDetailB.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task OCC_SimultaneousUpdateViaHttp_ShouldReturn409Conflict()
    {
        var tenantId = Guid.NewGuid();
        var client = _factory.CreateClient();

        var token = _jwtTokenService.GenerateToken(tenantId, null, Guid.NewGuid(), "admin@hbstudio.com.br", new[] { PermissionCatalog.CustomersView, PermissionCatalog.CustomersCreate, PermissionCatalog.CustomersEdit });
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token.AccessToken);

        // Criar registro
        var partyReq = new CreatePartyRequest(
            Type: PartyType.Individual,
            Name: "Registro Concorrente",
            TradeName: null,
            DocumentNumber: "99988877766",
            StateRegistration: null,
            MunicipalRegistration: null,
            BirthDate: null,
            Notes: "Original",
            EnableCustomer: true,
            EnableSupplier: false,
            CustomerNotes: null,
            SupplyCategories: null,
            PaymentTerms: null,
            PrimaryPhone: "1199990000",
            PrimaryEmail: "occ@example.com"
        );

        var createRes = await client.PostAsJsonAsync("/api/parties", partyReq);
        var created = await createRes.Content.ReadFromJsonAsync<PartyResponse>();

        // Primeiro Update com a versão correta
        var update1 = new UpdatePartyRequest("Nome Atualizado 1", null, "Alterado primeiro", created!.Version);
        var update1Res = await client.PutAsJsonAsync($"/api/parties/{created.Id}", update1);
        update1Res.StatusCode.Should().Be(HttpStatusCode.OK);

        // Segundo Update tentando salvar com a versão defasada (Version original)
        var update2 = new UpdatePartyRequest("Nome Conflitante 2", null, "Tentativa com versao antiga", created.Version);
        var update2Res = await client.PutAsJsonAsync($"/api/parties/{created.Id}", update2);

        // Assert: HTTP 409 Conflict retornado
        update2Res.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }
}
