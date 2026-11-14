using System;
using System.Collections.Generic;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
using BuildingBlocks.Domain;
using BuildingBlocks.Infrastructure;
using BuildingBlocks.Security;
using Financial.Domain;
using IdentityAccess.Domain;
using Parties.Domain;
using PartnersCapital.Application.DTOs;
using PartnersCapital.Domain.Entities;

namespace BuildingBlocks.UnitTests;

public class PartnersCapitalModuleIntegrationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly JwtTokenService _jwtTokenService;

    public PartnersCapitalModuleIntegrationTests(WebApplicationFactory<Program> factory)
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
            "socio.administrador@hbstudio.com.br",
            permissions
        );
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token.AccessToken);
        return client;
    }

    private async Task<(Guid tenantId, Guid branchId, Guid userId, Guid party1, Guid party2, Guid party3)> SeedPartnersBaseAsync(string prefix)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var unique = Guid.NewGuid().ToString("N")[..8];
        var tenant = new Tenant($"{prefix} Partners Holding {unique}", $"{prefix.ToLower()}_{unique}");
        var branch = new Branch(tenant.Id, $"{prefix} Matriz {unique}", "11222333000199");
        var user = new User(tenant.Id, $"{prefix} Administrador {unique}", $"{prefix.ToLower()}_{unique}@hbstudio.com.br", "hashed_pwd");

        // 3 Sócios da HB Studio como Parties
        var partnerParty1 = new Party(tenant.Id, PartyType.Individual, "Sócio Hugo Boss", "Hugo Boss", "11122233344", null, "hugo@hbstudio.com.br");
        var partnerParty2 = new Party(tenant.Id, PartyType.Individual, "Sócio Bruno Santos", "Bruno Santos", "22233344455", null, "bruno@hbstudio.com.br");
        var partnerParty3 = new Party(tenant.Id, PartyType.Individual, "Sócio Carlos Alberto", "Carlos Alberto", "33344455566", null, "carlos@hbstudio.com.br");

        // Contas Contábeis Padrão (Plano de Contas)
        var accBanco = new FinancialAccount(tenant.Id, "1.1.1.02", "Banco Itaú Conta PJ", FinancialAccountType.Asset);
        var accCapital = new FinancialAccount(tenant.Id, "2.4.1.01", "Capital Social Subscrito e Integralizado", FinancialAccountType.Equity);
        var accMutuo = new FinancialAccount(tenant.Id, "2.1.3.01", "Mútuo de Sócios Exigível", FinancialAccountType.Liability);
        var accLucros = new FinancialAccount(tenant.Id, "2.4.2.01", "Lucros Acumulados do Exercício", FinancialAccountType.Equity);
        var accReceita = new FinancialAccount(tenant.Id, "3.1.1.01", "Receita Operacional Bruta", FinancialAccountType.Revenue);

        // Conta Bancária Real
        var bankAccount = new BankAccount(tenant.Id, branch.Id, "Banco Itaú S.A.", "1234", "98765-4", BankAccountType.Checking, 50000m);

        db.Tenants.Add(tenant);
        db.Branches.Add(branch);
        db.Users.Add(user);
        db.Parties.AddRange(partnerParty1, partnerParty2, partnerParty3);
        db.FinancialAccounts.AddRange(accBanco, accCapital, accMutuo, accLucros, accReceita);
        db.BankAccounts.Add(bankAccount);

        await db.SaveChangesAsync();

        return (tenant.Id, branch.Id, user.Id, partnerParty1.Id, partnerParty2.Id, partnerParty3.Id);
    }

    [Fact]
    public async Task PartnerRegistration_And_CapTable_ShouldEnforce100PercentQuotas()
    {
        var (tenantId, branchId, userId, p1, p2, p3) = await SeedPartnersBaseAsync("CAP");
        var client = CreateAuthenticatedClient(tenantId, branchId, userId,
            PartnersCapitalPermissionKeys.View,
            PartnersCapitalPermissionKeys.Manage,
            PartnersCapitalPermissionKeys.CapitalManage);

        // 1. Cadastrar os 3 sócios
        var createP1 = await client.PostAsJsonAsync("/api/partners", new CreatePartnerRequest(
            p1, "Hugo Boss", "11122233344", "hugo@hbstudio.com.br", PartnerType.ManagingPartner, DateTime.UtcNow.AddYears(-1), 15000m));
        Assert.Equal(HttpStatusCode.Created, createP1.StatusCode);
        var partner1 = await createP1.Content.ReadFromJsonAsync<PartnerResponse>();

        var createP2 = await client.PostAsJsonAsync("/api/partners", new CreatePartnerRequest(
            p2, "Bruno Santos", "22233344455", "bruno@hbstudio.com.br", PartnerType.OperatingPartner, DateTime.UtcNow.AddYears(-1), 12000m));
        Assert.Equal(HttpStatusCode.Created, createP2.StatusCode);
        var partner2 = await createP2.Content.ReadFromJsonAsync<PartnerResponse>();

        var createP3 = await client.PostAsJsonAsync("/api/partners", new CreatePartnerRequest(
            p3, "Carlos Alberto", "33344455566", "carlos@hbstudio.com.br", PartnerType.SilentPartner, DateTime.UtcNow.AddYears(-1), 0));
        Assert.Equal(HttpStatusCode.Created, createP3.StatusCode);
        var partner3 = await createP3.Content.ReadFromJsonAsync<PartnerResponse>();

        // 2. Tentar atualizar Cap Table com soma diferente de 100% -> Deve falhar (400 ou 500)
        var invalidCap = new UpdateCapTableRequest(
            new List<UpdateCapTableEntry>
            {
                new(partner1!.Id, 40000, 40.00m, 1.00m, DateTime.UtcNow, "Contrato Social 1"),
                new(partner2!.Id, 30000, 30.00m, 1.00m, DateTime.UtcNow, "Contrato Social 1")
                // Falta 30%
            },
            DateTime.UtcNow,
            "Contrato Social 1"
        );
        var respInvalid = await client.PostAsJsonAsync("/api/partners/cap-table", invalidCap);
        Assert.False(respInvalid.IsSuccessStatusCode);

        // 3. Atualizar Cap Table com soma exata de 100.00% (40% Hugo, 35% Bruno, 25% Carlos)
        var validCap = new UpdateCapTableRequest(
            new List<UpdateCapTableEntry>
            {
                new(partner1.Id, 40000, 40.00m, 1.00m, DateTime.UtcNow, "Contrato Social 1"),
                new(partner2.Id, 35000, 35.00m, 1.00m, DateTime.UtcNow, "Contrato Social 1"),
                new(partner3!.Id, 25000, 25.00m, 1.00m, DateTime.UtcNow, "Contrato Social 1")
            },
            DateTime.UtcNow,
            "Contrato Social 1"
        );
        var respValid = await client.PostAsJsonAsync("/api/partners/cap-table", validCap);
        Assert.Equal(HttpStatusCode.OK, respValid.StatusCode);
        var capSummary = await respValid.Content.ReadFromJsonAsync<CapTableSummaryDto>();

        Assert.NotNull(capSummary);
        Assert.Equal(100000m, capSummary.TotalQuotas);
        Assert.Equal(100000m, capSummary.TotalNominalCapital);
        Assert.Equal(3, capSummary.Partners.Count);
    }

    [Fact]
    public async Task CapitalContribution_ShouldCreditEquity_WithoutImpactingDreRevenue()
    {
        var (tenantId, branchId, userId, p1, _, _) = await SeedPartnersBaseAsync("APORTE");
        var client = CreateAuthenticatedClient(tenantId, branchId, userId,
            PartnersCapitalPermissionKeys.View,
            PartnersCapitalPermissionKeys.Manage,
            PartnersCapitalPermissionKeys.CapitalManage,
            PermissionCatalog.FinanceReportsView);

        // Obter id da conta bancária
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var bank = await db.BankAccounts.FirstAsync(b => b.TenantId == tenantId);

        // Cadastrar sócio
        var createP = await client.PostAsJsonAsync("/api/partners", new CreatePartnerRequest(
            p1, "Hugo Boss", "11122233344", "hugo@hbstudio.com.br", PartnerType.ManagingPartner, DateTime.UtcNow.AddYears(-1), 15000m));
        var partner = await createP.Content.ReadFromJsonAsync<PartnerResponse>();

        // 1. Subscrição de Aporte de R$ 50.000 em dinheiro
        var subReq = new RegisterContributionRequest(
            partner!.Id,
            ContributionType.Cash,
            50000m,
            DateTime.UtcNow,
            "Aporte de Expansão de Loja",
            "Ata de Reunião 01/2026",
            bank.Id
        );
        var subResp = await client.PostAsJsonAsync("/api/partners/contributions", subReq);
        Assert.Equal(HttpStatusCode.Created, subResp.StatusCode);
        var contribution = await subResp.Content.ReadFromJsonAsync<CapitalContributionResponse>();

        // 2. Integralização (Pay-in) com depósito bancário
        var payInResp = await client.PostAsJsonAsync($"/api/partners/contributions/{contribution!.Id}/pay-in", new PayInContributionRequest(DateTime.UtcNow, bank.Id));
        Assert.Equal(HttpStatusCode.OK, payInResp.StatusCode);

        // 3. Validar que o saldo bancário subiu de R$ 50.000 para R$ 100.000
        var updatedBank = await db.BankAccounts.AsNoTracking().FirstAsync(b => b.Id == bank.Id);
        Assert.Equal(100000m, updatedBank.CurrentBalance);

        // 4. Validar que na DRE a receita continua R$ 0,00 (Aporte não é faturamento!)
        var dreResp = await client.GetAsync($"/api/financial/reports/dre?startDate={DateTime.UtcNow.AddMonths(-1):yyyy-MM-dd}&endDate={DateTime.UtcNow.AddMonths(1):yyyy-MM-dd}");
        Assert.Equal(HttpStatusCode.OK, dreResp.StatusCode);
        var dre = await dreResp.Content.ReadFromJsonAsync<Financial.Application.DreReportResponse>();
        Assert.NotNull(dre);
        Assert.Equal(0m, dre.GrossRevenue);
        Assert.Equal(0m, dre.NetResult);
    }

    [Fact]
    public async Task PartnerLoan_And_Amortization_ShouldAffectLiabilities_NotDreExpenses()
    {
        var (tenantId, branchId, userId, p1, _, _) = await SeedPartnersBaseAsync("LOAN");
        var client = CreateAuthenticatedClient(tenantId, branchId, userId,
            PartnersCapitalPermissionKeys.View,
            PartnersCapitalPermissionKeys.Manage,
            PartnersCapitalPermissionKeys.LoanManage,
            PermissionCatalog.FinanceReportsView);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var bank = await db.BankAccounts.FirstAsync(b => b.TenantId == tenantId);

        var createP = await client.PostAsJsonAsync("/api/partners", new CreatePartnerRequest(
            p1, "Hugo Boss", "11122233344", "hugo@hbstudio.com.br", PartnerType.ManagingPartner, DateTime.UtcNow.AddYears(-1), 15000m));
        var partner = await createP.Content.ReadFromJsonAsync<PartnerResponse>();

        // 1. Registro de Mútuo de R$ 30.000 do sócio para a empresa
        var loanReq = new RegisterLoanRequest(
            partner!.Id,
            LoanDirection.PartnerToCompany,
            30000m,
            0m,
            DateTime.UtcNow,
            DateTime.UtcNow.AddMonths(6),
            "MUT-2026-001",
            "Empréstimo ponte para giro",
            bank.Id
        );
        var loanResp = await client.PostAsJsonAsync("/api/partners/loans", loanReq);
        Assert.Equal(HttpStatusCode.Created, loanResp.StatusCode);
        var loan = await loanResp.Content.ReadFromJsonAsync<PartnerLoanResponse>();
        Assert.Equal(30000m, loan!.OutstandingBalance);

        // Saldo bancário foi para 80.000 (50k inicial + 30k mútuo)
        var bankAfterLoan = await db.BankAccounts.AsNoTracking().FirstAsync(b => b.Id == bank.Id);
        Assert.Equal(80000m, bankAfterLoan.CurrentBalance);

        // 2. Amortização parcial de R$ 10.000 do mútuo
        var amortResp = await client.PostAsJsonAsync($"/api/partners/loans/{loan.Id}/amortize", new AmortizeLoanRequest(10000m, DateTime.UtcNow, bank.Id));
        Assert.Equal(HttpStatusCode.OK, amortResp.StatusCode);
        var loanAfterAmort = await amortResp.Content.ReadFromJsonAsync<PartnerLoanResponse>();
        Assert.Equal(20000m, loanAfterAmort!.OutstandingBalance);

        // Saldo bancário foi para 70.000
        var bankAfterAmort = await db.BankAccounts.AsNoTracking().FirstAsync(b => b.Id == bank.Id);
        Assert.Equal(70000m, bankAfterAmort.CurrentBalance);

        // 3. Confirmar que na DRE nenhuma despesa operacional foi lançada pela devolução de principal
        var dreResp = await client.GetAsync($"/api/financial/reports/dre?startDate={DateTime.UtcNow.AddMonths(-1):yyyy-MM-dd}&endDate={DateTime.UtcNow.AddMonths(1):yyyy-MM-dd}");
        Assert.Equal(HttpStatusCode.OK, dreResp.StatusCode);
        var dre = await dreResp.Content.ReadFromJsonAsync<Financial.Application.DreReportResponse>();
        Assert.NotNull(dre);
        Assert.Equal(0m, dre.OperatingExpenses);
    }

    [Fact]
    public async Task PartnerCompensation_ShouldRespectMonthlyCap()
    {
        var (tenantId, branchId, userId, p1, _, _) = await SeedPartnersBaseAsync("COMP");
        var client = CreateAuthenticatedClient(tenantId, branchId, userId,
            PartnersCapitalPermissionKeys.View,
            PartnersCapitalPermissionKeys.Manage,
            PartnersCapitalPermissionKeys.CompensationManage);

        // Sócio com teto de R$ 10.000
        var createP = await client.PostAsJsonAsync("/api/partners", new CreatePartnerRequest(
            p1, "Hugo Boss", "11122233344", "hugo@hbstudio.com.br", PartnerType.ManagingPartner, DateTime.UtcNow.AddYears(-1), 10000m));
        var partner = await createP.Content.ReadFromJsonAsync<PartnerResponse>();

        // 1. Agendamento acima do teto (R$ 15.000) -> Deve falhar
        var invalidComp = new ScheduleCompensationRequest(
            partner!.Id,
            2026,
            11,
            15000m,
            1650m,
            2000m,
            DateTime.UtcNow.AddDays(5),
            "Tentativa pró-labore acima do teto"
        );
        var respExceed = await client.PostAsJsonAsync("/api/partners/compensations", invalidComp);
        Assert.False(respExceed.IsSuccessStatusCode);

        // 2. Agendamento dentro do teto (R$ 10.000) -> Deve ser criado com sucesso
        var validComp = new ScheduleCompensationRequest(
            partner.Id,
            2026,
            11,
            10000m,
            1100m,
            1500m,
            DateTime.UtcNow.AddDays(5),
            "Pró-labore oficial mês 11/2026"
        );
        var respValid = await client.PostAsJsonAsync("/api/partners/compensations", validComp);
        Assert.Equal(HttpStatusCode.Created, respValid.StatusCode);
        var comp = await respValid.Content.ReadFromJsonAsync<PartnerCompensationResponse>();
        Assert.NotNull(comp);
        Assert.Equal(7400m, comp.NetAmount); // 10000 - 1100 - 1500
        Assert.NotNull(comp.AccountPayableId);
    }

    [Fact]
    public async Task ProfitDistribution_ShouldRequirePositiveNetProfit_And_SettleProportionally()
    {
        var (tenantId, branchId, userId, p1, p2, _) = await SeedPartnersBaseAsync("DIST");
        var client = CreateAuthenticatedClient(tenantId, branchId, userId,
            PartnersCapitalPermissionKeys.View,
            PartnersCapitalPermissionKeys.Manage,
            PartnersCapitalPermissionKeys.CapitalManage,
            PartnersCapitalPermissionKeys.DistributionPropose,
            PartnersCapitalPermissionKeys.DistributionApprove,
            PartnersCapitalPermissionKeys.DistributionSettle);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var bank = await db.BankAccounts.FirstAsync(b => b.TenantId == tenantId);
        var accReceita = await db.FinancialAccounts.FirstAsync(a => a.TenantId == tenantId && a.Type == FinancialAccountType.Revenue);
        var accBanco = await db.FinancialAccounts.FirstAsync(a => a.TenantId == tenantId && a.Type == FinancialAccountType.Asset);

        // Cadastrar sócios e Cap Table 60% / 40%
        var c1 = await client.PostAsJsonAsync("/api/partners", new CreatePartnerRequest(p1, "Hugo", "111", "hugo@hb.com", PartnerType.ManagingPartner, DateTime.UtcNow));
        var part1 = await c1.Content.ReadFromJsonAsync<PartnerResponse>();
        var c2 = await client.PostAsJsonAsync("/api/partners", new CreatePartnerRequest(p2, "Bruno", "222", "bruno@hb.com", PartnerType.OperatingPartner, DateTime.UtcNow));
        var part2 = await c2.Content.ReadFromJsonAsync<PartnerResponse>();

        await client.PostAsJsonAsync("/api/partners/cap-table", new UpdateCapTableRequest(
            new List<UpdateCapTableEntry>
            {
                new(part1!.Id, 60000, 60.00m, 1m, DateTime.UtcNow, "Contrato Social"),
                new(part2!.Id, 40000, 40.00m, 1m, DateTime.UtcNow, "Contrato Social")
            },
            DateTime.UtcNow,
            "Contrato Social"
        ));

        // 1. Tentar propor distribuição sem ter lucro na DRE -> Deve ser rejeitado!
        var emptyProp = new CreateDistributionProposalRequest(
            "DIST-2026-01",
            2026,
            null,
            50000m,
            2500m,
            10000m,
            DateTime.UtcNow,
            "Ata 01"
        );
        var respNoProfit = await client.PostAsJsonAsync("/api/partners/distribution/proposals", emptyProp);
        Assert.False(respNoProfit.IsSuccessStatusCode);

        // 2. Simular faturamento real contábil de R$ 100.000 para gerar Lucro Líquido
        var entry = new FinancialJournalEntry(tenantId, branchId, DateTime.SpecifyKind(new DateTime(2026, 6, 1), DateTimeKind.Utc), "NF-100", "Vendas", "1", "Venda de Serviços e Equipamentos", userId);
        entry.AddLine(accBanco.Id, JournalLineDirection.Debit, 100000m, null, "Entrada Caixa");
        entry.AddLine(accReceita.Id, JournalLineDirection.Credit, 100000m, null, "Receita Bruta");
        entry.ValidateBalance();
        db.FinancialJournalEntries.Add(entry);
        await db.SaveChangesAsync();

        // 3. Propor distribuição com lucro positivo comprovado
        // Lucro = 100k, Reserva Legal = 5k, Capital de Giro Retido = 15k -> Distribuível = 80k
        var validProp = new CreateDistributionProposalRequest(
            "DIST-2026-01",
            2026,
            null,
            100000m,
            5000m,
            15000m,
            DateTime.UtcNow,
            "Ata 01"
        );
        var respValidProp = await client.PostAsJsonAsync("/api/partners/distribution/proposals", validProp);
        Assert.Equal(HttpStatusCode.Created, respValidProp.StatusCode);
        var proposal = await respValidProp.Content.ReadFromJsonAsync<ProfitDistributionProposalResponse>();

        Assert.NotNull(proposal);
        Assert.Equal(80000m, proposal.DistributableAmount);
        Assert.Equal(2, proposal.Items.Count);

        // 4. Homologar em Ata (Aprovação)
        var approveResp = await client.PostAsJsonAsync($"/api/partners/distribution/proposals/{proposal.Id}/approve?meetingMinutes=Ata+Reuniao+Ordinaria+2026", new { });
        Assert.Equal(HttpStatusCode.OK, approveResp.StatusCode);

        // 5. Liquidação da cota do sócio 1 (60% de 80k = 48.000)
        var settle1 = await client.PostAsJsonAsync($"/api/partners/distribution/proposals/{proposal.Id}/settle/{part1.Id}", new SettleDistributionItemRequest(DateTime.UtcNow, bank.Id));
        Assert.Equal(HttpStatusCode.OK, settle1.StatusCode);
    }

    [Fact]
    public async Task LiquiditySimulation_ShouldAssessAvailableCash_And_PendingObligations()
    {
        var (tenantId, branchId, userId, _, _, _) = await SeedPartnersBaseAsync("LIQ");
        var client = CreateAuthenticatedClient(tenantId, branchId, userId,
            PartnersCapitalPermissionKeys.View);

        // Saldo em conta inicial semeado = R$ 50.000
        // Simulação 1: Propor R$ 20.000 com reserva mínima de R$ 20.000 (Sobra = 30k -> Suficiente)
        var sim1Resp = await client.GetAsync("/api/partners/simulation/liquidity?proposedAmount=20000&reserve=20000");
        Assert.Equal(HttpStatusCode.OK, sim1Resp.StatusCode);
        var sim1 = await sim1Resp.Content.ReadFromJsonAsync<LiquiditySimulationResultDto>();
        Assert.NotNull(sim1);
        Assert.True(sim1.IsSufficientForDistribution);
        Assert.Equal(30000m, sim1.NetLiquidSurplus);

        // Simulação 2: Propor R$ 40.000 com reserva mínima de R$ 20.000 (Teto = 30k -> Insuficiente!)
        var sim2Resp = await client.GetAsync("/api/partners/simulation/liquidity?proposedAmount=40000&reserve=20000");
        Assert.Equal(HttpStatusCode.OK, sim2Resp.StatusCode);
        var sim2 = await sim2Resp.Content.ReadFromJsonAsync<LiquiditySimulationResultDto>();
        Assert.NotNull(sim2);
        Assert.False(sim2.IsSufficientForDistribution);
    }
}
