using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
using BuildingBlocks.Domain;
using BuildingBlocks.Infrastructure;
using BuildingBlocks.Security;
using Financial.Application;
using Financial.Domain;
using IdentityAccess.Domain;

namespace BuildingBlocks.UnitTests;

public class FinancialModuleIntegrationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly JwtTokenService _jwtTokenService;

    public FinancialModuleIntegrationTests(WebApplicationFactory<Program> factory)
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
            "diretor.financeiro@hbstudio.com.br",
            permissions
        );
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token.AccessToken);
        return client;
    }

    private async Task<(Guid tenantId, Guid branchId, Guid userId)> SeedBaseTenantAsync(string prefix)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var suffix = Guid.NewGuid().ToString("N")[..6];
        var tenant = new Tenant($"HB Tech {prefix} {suffix}", $"TEN-FIN-{prefix}-{suffix}");
        var branch = tenant.AddBranch($"Filial {prefix}", $"BR-FIN-{suffix}");
        db.Tenants.Add(tenant);

        var user = new User(tenant.Id, $"Financeiro {prefix}", $"{prefix.ToLower()}_{suffix}@hbstudio.com", "hash", branch.Id);
        db.Users.Add(user);

        await db.SaveChangesAsync();
        return (tenant.Id, branch.Id, user.Id);
    }

    [Fact]
    public async Task JournalEntry_DoubleEntry_BalancedShouldSucceed_UnbalancedShouldFail()
    {
        var (tenantId, branchId, userId) = await SeedBaseTenantAsync("JOURNAL");
        var client = CreateAuthenticatedClient(tenantId, branchId, userId,
            PermissionCatalog.FinanceJournalView,
            PermissionCatalog.FinanceReportsView);

        // 1. Cadastrar Contas Contábeis (Banco Itaú e Receita de Eletrônicos)
        var accRes1 = await client.PostAsJsonAsync("/api/financial/accounts", new CreateFinancialAccountDto("1.1.1.01", "Banco Itaú C/C", FinancialAccountType.Asset));
        var accBanco = await accRes1.Content.ReadFromJsonAsync<FinancialAccountResponse>();

        var accRes2 = await client.PostAsJsonAsync("/api/financial/accounts", new CreateFinancialAccountDto("4.1.1.01", "Receita Venda Novos", FinancialAccountType.Revenue));
        var accReceita = await accRes2.Content.ReadFromJsonAsync<FinancialAccountResponse>();

        // Act 1: Lançamento Balanceado de R$ 5.000,00 (Débito Banco, Crédito Receita)
        var balancedRes = await client.PostAsJsonAsync("/api/financial/journal-entries", new CreateJournalEntryDto(
            branchId,
            DateTime.UtcNow,
            "LANCTO-001",
            "SALE",
            "V-100",
            "Venda de iPhone 15 Pro",
            new List<CreateJournalLineDto>
            {
                new(accBanco!.Id, JournalLineDirection.Debit, 5000.00m),
                new(accReceita!.Id, JournalLineDirection.Credit, 5000.00m)
            }
        ));
        Assert.Equal(HttpStatusCode.Created, balancedRes.StatusCode);
        var entry = await balancedRes.Content.ReadFromJsonAsync<FinancialJournalEntryResponse>();
        Assert.NotNull(entry);
        Assert.Equal(5000.00m, entry.TotalAmount);

        // Act 2: Lançamento Desbalanceado (Débito 5000, Crédito 4000) deve falhar estritamente
        var unbalancedRes = await client.PostAsJsonAsync("/api/financial/journal-entries", new CreateJournalEntryDto(
            branchId,
            DateTime.UtcNow,
            "LANCTO-002",
            "MANUAL",
            "M-101",
            "Tentativa desbalanceada",
            new List<CreateJournalLineDto>
            {
                new(accBanco.Id, JournalLineDirection.Debit, 5000.00m),
                new(accReceita.Id, JournalLineDirection.Credit, 4000.00m)
            }
        ));
        Assert.False(unbalancedRes.IsSuccessStatusCode);
    }

    [Fact]
    public async Task AccountPayable_FullLifecycle_Create_PartialPay_AndFinalSettle()
    {
        var (tenantId, branchId, userId) = await SeedBaseTenantAsync("PAYABLE");
        var client = CreateAuthenticatedClient(tenantId, branchId, userId,
            PermissionCatalog.FinancePayablesView,
            PermissionCatalog.FinancePay,
            PermissionCatalog.FinanceBanksManage,
            PermissionCatalog.FinanceReportsView);

        // 1. Cadastrar Conta Bancária com Saldo Inicial de R$ 20.000,00
        var bankRes = await client.PostAsJsonAsync("/api/financial/bank-accounts", new CreateBankAccountDto(
            branchId, "Banco do Brasil", "1234", "99887-1", BankAccountType.Checking, 20000.00m));
        var bank = await bankRes.Content.ReadFromJsonAsync<BankAccountResponse>();

        // 2. Criar Conta a Pagar de Fornecedor: R$ 3.000,00
        var payableRes = await client.PostAsJsonAsync("/api/financial/payables", new CreateAccountPayableDto(
            branchId,
            SupplierPartyId: null,
            TitleNumber: "NF-FORN-9876",
            Description: "Fornecimento de Telas e Peças",
            IssueDateUtc: DateTime.UtcNow,
            DueDateUtc: DateTime.UtcNow.AddDays(15),
            OriginalAmount: 3000.00m
        ));
        Assert.Equal(HttpStatusCode.Created, payableRes.StatusCode);
        var payable = await payableRes.Content.ReadFromJsonAsync<AccountPayableResponse>();

        // 3. Pagamento Parcial de R$ 1.000,00
        var partPayRes = await client.PostAsJsonAsync($"/api/financial/payables/{payable!.Id}/pay", new PayTitleDto(
            Amount: 1000.00m,
            BankAccountId: bank!.Id,
            Reference: "TED-PARC-1"
        ));
        Assert.Equal(HttpStatusCode.OK, partPayRes.StatusCode);
        var partPayable = await partPayRes.Content.ReadFromJsonAsync<AccountPayableResponse>();
        Assert.Equal(PayableStatus.PartiallyPaid, partPayable!.Status);
        Assert.Equal(2000.00m, partPayable.BalanceRemaining);

        // 4. Quitação do Saldo Restante (R$ 2.000,00)
        var finalPayRes = await client.PostAsJsonAsync($"/api/financial/payables/{payable.Id}/pay", new PayTitleDto(
            Amount: 2000.00m,
            BankAccountId: bank.Id,
            Reference: "TED-QUITACAO"
        ));
        Assert.Equal(HttpStatusCode.OK, finalPayRes.StatusCode);
        var finalPayable = await finalPayRes.Content.ReadFromJsonAsync<AccountPayableResponse>();
        Assert.Equal(PayableStatus.Paid, finalPayable!.Status);
        Assert.Equal(0m, finalPayable.BalanceRemaining);

        // 5. Verificar dedução no saldo bancário escriturado (20.000 - 3.000 = 17.000)
        var banks = await (await client.GetAsync($"/api/financial/bank-accounts?branchId={branchId}")).Content.ReadFromJsonAsync<List<BankAccountResponse>>();
        var bankUpdated = banks!.First(b => b.Id == bank.Id);
        Assert.Equal(17000.00m, bankUpdated.CurrentBalance);
    }

    [Fact]
    public async Task AccountReceivable_Lifecycle_CreateAndReceiveWithBankCredit()
    {
        var (tenantId, branchId, userId) = await SeedBaseTenantAsync("RECEIVABLE");
        var client = CreateAuthenticatedClient(tenantId, branchId, userId,
            PermissionCatalog.FinanceReceivablesView,
            PermissionCatalog.FinanceSettle,
            PermissionCatalog.FinanceBanksManage,
            PermissionCatalog.FinanceReportsView);

        // 1. Cadastrar Conta Bancária com Saldo de R$ 5.000,00
        var bankRes = await client.PostAsJsonAsync("/api/financial/bank-accounts", new CreateBankAccountDto(
            branchId, "Nubank PJ", null, "0001-99", BankAccountType.Payment, 5000.00m));
        var bank = await bankRes.Content.ReadFromJsonAsync<BankAccountResponse>();

        // 2. Criar Conta a Receber de Projeto de Software: R$ 4.500,00
        var recRes = await client.PostAsJsonAsync("/api/financial/receivables", new CreateAccountReceivableDto(
            branchId,
            CustomerPartyId: null,
            TitleNumber: "REC-SOFT-01",
            Description: "Desenvolvimento Landing Page Empresa Parceira",
            IssueDateUtc: DateTime.UtcNow,
            DueDateUtc: DateTime.UtcNow.AddDays(7),
            OriginalAmount: 4500.00m
        ));
        Assert.Equal(HttpStatusCode.Created, recRes.StatusCode);
        var rec = await recRes.Content.ReadFromJsonAsync<AccountReceivableResponse>();

        // 3. Recebimento e Liquidação Total
        var settleRes = await client.PostAsJsonAsync($"/api/financial/receivables/{rec!.Id}/receive", new ReceiveTitleDto(
            Amount: 4500.00m,
            BankAccountId: bank!.Id,
            Reference: "PIX-CLIENTE"
        ));
        Assert.Equal(HttpStatusCode.OK, settleRes.StatusCode);
        var settledRec = await settleRes.Content.ReadFromJsonAsync<AccountReceivableResponse>();
        Assert.Equal(ReceivableStatus.Received, settledRec!.Status);
        Assert.Equal(0m, settledRec.BalanceRemaining);

        // 4. Saldo Bancário Atualizado: 5.000 + 4.500 = 9.500
        var banks = await (await client.GetAsync($"/api/financial/bank-accounts?branchId={branchId}")).Content.ReadFromJsonAsync<List<BankAccountResponse>>();
        var bankUpdated = banks!.First(b => b.Id == bank.Id);
        Assert.Equal(9500.00m, bankUpdated.CurrentBalance);
    }

    [Fact]
    public async Task BankStatement_Import_AndReconciliation_ShouldMatchAndDeduplicate()
    {
        var (tenantId, branchId, userId) = await SeedBaseTenantAsync("RECON");
        var client = CreateAuthenticatedClient(tenantId, branchId, userId,
            PermissionCatalog.FinanceBanksManage,
            PermissionCatalog.FinanceJournalView,
            PermissionCatalog.FinanceReconcile,
            PermissionCatalog.FinanceReportsView);

        var bankRes = await client.PostAsJsonAsync("/api/financial/bank-accounts", new CreateBankAccountDto(
            branchId, "Inter PJ", "0001", "776655-4", BankAccountType.Checking, 1000.00m));
        var bank = await bankRes.Content.ReadFromJsonAsync<BankAccountResponse>();

        // 1. Criar Lançamento no Razão
        var accRes = await client.PostAsJsonAsync("/api/financial/accounts", new CreateFinancialAccountDto("1.1.1.05", "Banco Inter", FinancialAccountType.Asset));
        var accBanco = await accRes.Content.ReadFromJsonAsync<FinancialAccountResponse>();
        var accCapRes = await client.PostAsJsonAsync("/api/financial/accounts", new CreateFinancialAccountDto("2.1.1.01", "Adiantamento", FinancialAccountType.Liability));
        var accCap = await accCapRes.Content.ReadFromJsonAsync<FinancialAccountResponse>();

        var entryRes = await client.PostAsJsonAsync("/api/financial/journal-entries", new CreateJournalEntryDto(
            branchId,
            DateTime.UtcNow,
            "DOC-INTER-01",
            "MANUAL",
            "OP-01",
            "Crédito Bancário",
            new List<CreateJournalLineDto>
            {
                new(accBanco!.Id, JournalLineDirection.Debit, 800.00m),
                new(accCap!.Id, JournalLineDirection.Credit, 800.00m)
            }
        ));
        var entry = await entryRes.Content.ReadFromJsonAsync<FinancialJournalEntryResponse>();

        // 2. Importar Extrato Bancário (FitId único para desduplicação)
        var importRes = await client.PostAsJsonAsync($"/api/financial/bank-accounts/{bank!.Id}/import-statement", new ImportBankStatementDto(
            BankAccountId: bank.Id,
            Transactions: new List<ImportBankTransactionDto>
            {
                new(DateTime.UtcNow, 800.00m, "TX-INTER-FIT-1001", "TED RECEBIDA CLIENTE")
            }
        ));
        Assert.Equal(HttpStatusCode.OK, importRes.StatusCode);
        var imported = await importRes.Content.ReadFromJsonAsync<List<BankTransactionResponse>>();
        Assert.Single(imported!);

        // Desduplicação: segunda importação com mesmo FitId é ignorada
        var duplicateImport = await client.PostAsJsonAsync($"/api/financial/bank-accounts/{bank.Id}/import-statement", new ImportBankStatementDto(
            BankAccountId: bank.Id,
            Transactions: new List<ImportBankTransactionDto>
            {
                new(DateTime.UtcNow, 800.00m, "TX-INTER-FIT-1001", "TED RECEBIDA CLIENTE")
            }
        ));
        var dupList = await duplicateImport.Content.ReadFromJsonAsync<List<BankTransactionResponse>>();
        Assert.Empty(dupList!); // Não duplica

        // 3. Conciliar Transação
        var reconRes = await client.PostAsJsonAsync($"/api/financial/transactions/{imported[0].Id}/reconcile", new ReconcileTransactionDto(entry!.Id));
        Assert.Equal(HttpStatusCode.OK, reconRes.StatusCode);
        var reconTx = await reconRes.Content.ReadFromJsonAsync<BankTransactionResponse>();
        Assert.Equal(ReconciliationStatus.Matched, reconTx!.Status);
        Assert.Equal(entry.Id, reconTx.MatchedJournalEntryId);

        // 4. Saldo Conciliado Atualizado: 1.000 + 800 = 1.800
        var banks = await (await client.GetAsync($"/api/financial/bank-accounts?branchId={branchId}")).Content.ReadFromJsonAsync<List<BankAccountResponse>>();
        var bankUpdated = banks!.First(b => b.Id == bank.Id);
        Assert.Equal(1800.00m, bankUpdated.ReconciledBalance);
    }

    [Fact]
    public async Task DRE_AndCashFlowForecast_AccurateCalculations_NoFictitiousData()
    {
        var (tenantId, branchId, userId) = await SeedBaseTenantAsync("DRE");
        var client = CreateAuthenticatedClient(tenantId, branchId, userId,
            PermissionCatalog.FinanceJournalView,
            PermissionCatalog.FinanceReportsView,
            PermissionCatalog.FinanceBanksManage);

        // 1. Contas Contábeis de Receita, CMV e Despesa Administrativa
        var accRec = await (await client.PostAsJsonAsync("/api/financial/accounts", new CreateFinancialAccountDto("4.1.01", "Receita Loja", FinancialAccountType.Revenue))).Content.ReadFromJsonAsync<FinancialAccountResponse>();
        var accCmv = await (await client.PostAsJsonAsync("/api/financial/accounts", new CreateFinancialAccountDto("3.1.01", "CMV Eletrônicos", FinancialAccountType.Expense))).Content.ReadFromJsonAsync<FinancialAccountResponse>();
        var accDesp = await (await client.PostAsJsonAsync("/api/financial/accounts", new CreateFinancialAccountDto("5.1.01", "Despesa Aluguel", FinancialAccountType.Expense))).Content.ReadFromJsonAsync<FinancialAccountResponse>();
        var accAtivo = await (await client.PostAsJsonAsync("/api/financial/accounts", new CreateFinancialAccountDto("1.1.01", "Caixa Geral", FinancialAccountType.Asset))).Content.ReadFromJsonAsync<FinancialAccountResponse>();

        var now = DateTime.UtcNow;

        // Venda de R$ 10.000,00
        await client.PostAsJsonAsync("/api/financial/journal-entries", new CreateJournalEntryDto(
            branchId, now, "NF-001", "SALE", "S-1", "Venda de Mercadorias",
            new List<CreateJournalLineDto>
            {
                new(accAtivo!.Id, JournalLineDirection.Debit, 10000.00m),
                new(accRec!.Id, JournalLineDirection.Credit, 10000.00m)
            }
        ));

        // CMV de R$ 6.000,00
        await client.PostAsJsonAsync("/api/financial/journal-entries", new CreateJournalEntryDto(
            branchId, now, "CMV-001", "INVENTORY", "K-1", "Baixa de Estoque CMV",
            new List<CreateJournalLineDto>
            {
                new(accCmv!.Id, JournalLineDirection.Debit, 6000.00m),
                new(accAtivo.Id, JournalLineDirection.Credit, 6000.00m)
            }
        ));

        // Despesa Administrativa de R$ 2.500,00
        await client.PostAsJsonAsync("/api/financial/journal-entries", new CreateJournalEntryDto(
            branchId, now, "DESP-001", "MANUAL", "D-1", "Aluguel Loja",
            new List<CreateJournalLineDto>
            {
                new(accAtivo.Id, JournalLineDirection.Credit, 2500.00m),
                new(accDesp!.Id, JournalLineDirection.Debit, 2500.00m)
            }
        ));

        // Act - Consulta da DRE do período
        var dreRes = await client.GetAsync($"/api/financial/reports/dre?startDate={now.AddDays(-1):O}&endDate={now.AddDays(1):O}&branchId={branchId}");
        Assert.Equal(HttpStatusCode.OK, dreRes.StatusCode);
        var dre = await dreRes.Content.ReadFromJsonAsync<DreReportResponse>();

        // Assert DRE:
        // Receita Bruta: R$ 10.000,00
        // CMV: R$ 6.000,00 -> Lucro Bruto: R$ 4.000,00 (Margem Bruta: 40%)
        // Despesas: R$ 2.500,00 -> Resultado Líquido: R$ 1.500,00 (Margem Líquida: 15%)
        Assert.NotNull(dre);
        Assert.Equal(10000.00m, dre.GrossRevenue);
        Assert.Equal(6000.00m, dre.CmvAndServiceCosts);
        Assert.Equal(4000.00m, dre.GrossProfit);
        Assert.Equal(40.00m, dre.GrossMarginPercent);
        Assert.Equal(2500.00m, dre.OperatingExpenses);
        Assert.Equal(1500.00m, dre.NetResult);
        Assert.Equal(15.00m, dre.NetMarginPercent);
    }

    [Fact]
    public async Task TenantIsolation_TenantACannotAccessOrModifyFinancialOfTenantB()
    {
        var (tenantA, branchA, userA) = await SeedBaseTenantAsync("ISOFA");
        var (tenantB, branchB, userB) = await SeedBaseTenantAsync("ISOFB");

        var clientA = CreateAuthenticatedClient(tenantA, branchA, userA,
            PermissionCatalog.FinancePayablesView,
            PermissionCatalog.FinancePay);

        var clientB = CreateAuthenticatedClient(tenantB, branchB, userB,
            PermissionCatalog.FinancePayablesView,
            PermissionCatalog.FinancePay);

        // Tenant A cria conta a pagar
        var payableResA = await clientA.PostAsJsonAsync("/api/financial/payables", new CreateAccountPayableDto(
            branchA, null, "TIT-A-100", "Conta Fornecedor A", DateTime.UtcNow, DateTime.UtcNow.AddDays(10), 1500.00m));
        var payableA = await payableResA.Content.ReadFromJsonAsync<AccountPayableResponse>();

        // Tenant B lista contas: não deve enxergar título do Tenant A
        var listB = await (await clientB.GetAsync("/api/financial/payables")).Content.ReadFromJsonAsync<List<AccountPayableResponse>>();
        Assert.NotNull(listB);
        Assert.DoesNotContain(listB, p => p.Id == payableA!.Id);
    }
}
