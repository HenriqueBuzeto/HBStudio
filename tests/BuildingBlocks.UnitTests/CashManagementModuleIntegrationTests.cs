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
using CashManagement.Application;
using CashManagement.Domain;
using IdentityAccess.Domain;

namespace BuildingBlocks.UnitTests;

public class CashManagementModuleIntegrationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly JwtTokenService _jwtTokenService;

    public CashManagementModuleIntegrationTests(WebApplicationFactory<Program> factory)
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
            "operador@hbstudio.com.br",
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
        var tenant = new Tenant($"HB Tech {prefix} {suffix}", $"TEN-CASH-{prefix}-{suffix}");
        var branch = tenant.AddBranch($"Filial {prefix}", $"BR-CASH-{suffix}");
        db.Tenants.Add(tenant);

        var user = new User(tenant.Id, $"Operador {prefix}", $"{prefix.ToLower()}_{suffix}@hbstudio.com", "hash", branch.Id);
        db.Users.Add(user);

        await db.SaveChangesAsync();
        return (tenant.Id, branch.Id, user.Id);
    }

    [Fact]
    public async Task CashShift_Open_ShouldSetBalanceAndRecordOpeningMovement()
    {
        var (tenantId, branchId, userId) = await SeedBaseTenantAsync("OPEN");
        var client = CreateAuthenticatedClient(tenantId, branchId, userId,
            PermissionCatalog.CashRegisterView,
            PermissionCatalog.CashRegisterManage,
            PermissionCatalog.CashOpen,
            PermissionCatalog.CashShiftView,
            PermissionCatalog.CashReconcile);

        // 1. Cadastrar Terminal
        var regRes = await client.PostAsJsonAsync("/api/cash/registers", new CreateCashRegisterDto(
            branchId, "CX-01", "Caixa Balcão 1", "Terminal Principal"));
        Assert.Equal(HttpStatusCode.Created, regRes.StatusCode);
        var reg = await regRes.Content.ReadFromJsonAsync<CashRegisterResponse>();
        Assert.NotNull(reg);

        // 2. Abrir Turno com R$ 350,00 de Fundo Inicial
        var openRes = await client.PostAsJsonAsync("/api/cash/shifts/open", new OpenCashShiftDto(
            branchId,
            reg.Id,
            userId,
            OpeningFloat: 350.00m,
            OpeningSource: "Cofre Central",
            OpeningNotes: "Turno da Manhã"
        ));
        Assert.Equal(HttpStatusCode.Created, openRes.StatusCode);
        var shift = await openRes.Content.ReadFromJsonAsync<CashShiftDetailResponse>();
        Assert.NotNull(shift);

        // Assert
        Assert.Equal(CashShiftStatus.Open, shift.Status);
        Assert.Equal(350.00m, shift.OpeningFloat);
        Assert.Equal(350.00m, shift.CurrentBalance);
        Assert.Single(shift.Movements);
        Assert.Equal(CashMovementType.OpeningFloat, shift.Movements[0].MovementType);
        Assert.Equal(350.00m, shift.Movements[0].Amount);
    }

    [Fact]
    public async Task CashShift_ConcurrentOpenAttemptsOnSameRegister_ShouldAllowOnlyOne()
    {
        var (tenantId, branchId, userId) = await SeedBaseTenantAsync("CONC");
        var client = CreateAuthenticatedClient(tenantId, branchId, userId,
            PermissionCatalog.CashRegisterManage,
            PermissionCatalog.CashOpen,
            PermissionCatalog.CashShiftView);

        var regRes = await client.PostAsJsonAsync("/api/cash/registers", new CreateCashRegisterDto(
            branchId, "CX-02", "Caixa Balcão 2"));
        var reg = await regRes.Content.ReadFromJsonAsync<CashRegisterResponse>();

        // Act 1: Primeira abertura com sucesso
        var res1 = await client.PostAsJsonAsync("/api/cash/shifts/open", new OpenCashShiftDto(
            branchId, reg!.Id, userId, 200.00m));
        Assert.Equal(HttpStatusCode.Created, res1.StatusCode);

        // Act 2: Segunda tentativa no mesmo terminal ativo deve ser rejeitada
        var res2 = await client.PostAsJsonAsync("/api/cash/shifts/open", new OpenCashShiftDto(
            branchId, reg.Id, userId, 200.00m));
        Assert.False(res2.IsSuccessStatusCode);
    }

    [Fact]
    public async Task CashMovement_SupplyAndWithdrawal_ShouldUpdatePhysicalBalanceAccurately()
    {
        var (tenantId, branchId, userId) = await SeedBaseTenantAsync("MOV");
        var client = CreateAuthenticatedClient(tenantId, branchId, userId,
            PermissionCatalog.CashRegisterManage,
            PermissionCatalog.CashOpen,
            PermissionCatalog.CashShiftView,
            PermissionCatalog.CashSupply,
            PermissionCatalog.CashWithdraw,
            PermissionCatalog.CashReconcile);

        var regRes = await client.PostAsJsonAsync("/api/cash/registers", new CreateCashRegisterDto(
            branchId, "CX-03", "Caixa Balcão 3"));
        var reg = await regRes.Content.ReadFromJsonAsync<CashRegisterResponse>();

        var openRes = await client.PostAsJsonAsync("/api/cash/shifts/open", new OpenCashShiftDto(
            branchId, reg!.Id, userId, 100.00m)); // Saldo inicial: 100
        var shift = await openRes.Content.ReadFromJsonAsync<CashShiftDetailResponse>();

        // Act 1: Suprimento de R$ 150,00 (troco do cofre)
        var supRes = await client.PostAsJsonAsync($"/api/cash/shifts/{shift!.Id}/supply", new CreateCashSupplyDto(
            Amount: 150.00m,
            Reason: "Reforço para troco",
            OriginDeclared: "Cofre"
        ));
        Assert.Equal(HttpStatusCode.OK, supRes.StatusCode);
        var supply = await supRes.Content.ReadFromJsonAsync<CashMovementResponse>();
        Assert.Equal(CashMovementType.CashSupply, supply!.MovementType);

        // Act 2: Sangria de R$ 200,00 (recolhimento)
        var withRes = await client.PostAsJsonAsync($"/api/cash/shifts/{shift.Id}/withdrawal", new CreateCashWithdrawalDto(
            Amount: 200.00m,
            Reason: "Recolhimento malote",
            DestinationDeclared: "Cofre",
            ReceiverName: "Gerente João"
        ));
        Assert.Equal(HttpStatusCode.OK, withRes.StatusCode);
        var withdrawal = await withRes.Content.ReadFromJsonAsync<CashMovementResponse>();
        Assert.Equal(CashMovementType.CashWithdrawal, withdrawal!.MovementType);

        // Assert - Saldo: 100 + 150 - 200 = 50.00
        var detailsRes = await client.GetAsync($"/api/cash/shifts/{shift.Id}");
        var details = await detailsRes.Content.ReadFromJsonAsync<CashShiftDetailResponse>();
        Assert.Equal(50.00m, details!.CurrentBalance);
        Assert.Equal(250.00m, details.TotalCashIn);
        Assert.Equal(200.00m, details.TotalCashOut);

        // Act 3: Sangria maior que saldo (R$ 80,00 > R$ 50,00) deve falhar
        var overWith = await client.PostAsJsonAsync($"/api/cash/shifts/{shift.Id}/withdrawal", new CreateCashWithdrawalDto(
            80.00m, "Sangria excessiva", "Cofre"));
        Assert.False(overWith.IsSuccessStatusCode);
    }

    [Fact]
    public async Task SalesCashReceipt_ShouldOnlyRecordPhysicalCashPart_InDrawer()
    {
        var (tenantId, branchId, userId) = await SeedBaseTenantAsync("SALE");
        var client = CreateAuthenticatedClient(tenantId, branchId, userId,
            PermissionCatalog.CashRegisterManage,
            PermissionCatalog.CashOpen,
            PermissionCatalog.CashShiftView,
            PermissionCatalog.SalesPosUse,
            PermissionCatalog.CashReconcile);

        var regRes = await client.PostAsJsonAsync("/api/cash/registers", new CreateCashRegisterDto(
            branchId, "CX-04", "Caixa Balcão 4"));
        var reg = await regRes.Content.ReadFromJsonAsync<CashRegisterResponse>();

        var openRes = await client.PostAsJsonAsync("/api/cash/shifts/open", new OpenCashShiftDto(
            branchId, reg!.Id, userId, 200.00m)); // Saldo inicial: 200
        var shift = await openRes.Content.ReadFromJsonAsync<CashShiftDetailResponse>();

        var saleId = Guid.NewGuid();
        var paymentCashId = Guid.NewGuid();

        // Act - Entrada de R$ 500,00 referente a parcela em dinheiro
        var receiptRes = await client.PostAsJsonAsync($"/api/cash/shifts/{shift!.Id}/sale-receipt", new RecordCashSaleReceiptDto(
            SaleId: saleId,
            SalePaymentIntentId: paymentCashId,
            Amount: 500.00m,
            DocumentReference: "VENDA-PDV-1001"
        ));
        Assert.Equal(HttpStatusCode.OK, receiptRes.StatusCode);
        var receipt = await receiptRes.Content.ReadFromJsonAsync<CashMovementResponse>();
        Assert.Equal(CashMovementType.CashSaleReceipt, receipt!.MovementType);
        Assert.Equal(500.00m, receipt.Amount);

        var details = await (await client.GetAsync($"/api/cash/shifts/{shift.Id}")).Content.ReadFromJsonAsync<CashShiftDetailResponse>();
        Assert.Equal(700.00m, details!.CurrentBalance);

        // Idempotência: repetição não duplica entrada
        var duplicateRes = await client.PostAsJsonAsync($"/api/cash/shifts/{shift.Id}/sale-receipt", new RecordCashSaleReceiptDto(
            SaleId: saleId,
            SalePaymentIntentId: paymentCashId,
            Amount: 500.00m,
            DocumentReference: "VENDA-PDV-1001"
        ));
        var duplicate = await duplicateRes.Content.ReadFromJsonAsync<CashMovementResponse>();
        Assert.Equal(receipt.Id, duplicate!.Id);

        var detailsAfter = await (await client.GetAsync($"/api/cash/shifts/{shift.Id}")).Content.ReadFromJsonAsync<CashShiftDetailResponse>();
        Assert.Equal(700.00m, detailsAfter!.CurrentBalance);
    }

    [Fact]
    public async Task BlindCount_AndDiscrepancy_ShouldEnforceBlindnessAndRecordDiscrepancy()
    {
        var (tenantId, branchId, userId) = await SeedBaseTenantAsync("BLIND");
        var operatorClient = CreateAuthenticatedClient(tenantId, branchId, userId,
            PermissionCatalog.CashRegisterManage,
            PermissionCatalog.CashOpen,
            PermissionCatalog.CashShiftView,
            PermissionCatalog.CashShiftCount,
            PermissionCatalog.CashClose);

        var regRes = await operatorClient.PostAsJsonAsync("/api/cash/registers", new CreateCashRegisterDto(
            branchId, "CX-05", "Caixa Balcão 5"));
        var reg = await regRes.Content.ReadFromJsonAsync<CashRegisterResponse>();

        var openRes = await operatorClient.PostAsJsonAsync("/api/cash/shifts/open", new OpenCashShiftDto(
            branchId, reg!.Id, userId, 300.00m)); // Saldo gaveta: 300
        var shift = await openRes.Content.ReadFromJsonAsync<CashShiftDetailResponse>();

        // Operador comum (sem permissão de conciliação) não vê saldo esperado na contagem
        var detailsBlind = await (await operatorClient.GetAsync($"/api/cash/shifts/{shift!.Id}")).Content.ReadFromJsonAsync<CashShiftDetailResponse>();
        Assert.Null(detailsBlind!.ExpectedCashBalance);
        Assert.Equal(0m, detailsBlind.CurrentBalance);

        // Act: Submissão de contagem cega com divergência (contou R$ 280,00 -> falta de R$ 20,00)
        var countRes = await operatorClient.PostAsJsonAsync($"/api/cash/shifts/{shift.Id}/submit-count", new SubmitBlindCountDto(
            CountedTotal: 280.00m,
            Denominations: new List<CashCountItemDto>
            {
                new(100.00m, 2),
                new(50.00m, 1),
                new(20.00m, 1),
                new(10.00m, 1)
            },
            Notes: "Falta apurada na conferência cega"
        ));
        Assert.Equal(HttpStatusCode.OK, countRes.StatusCode);
        var countSubmission = await countRes.Content.ReadFromJsonAsync<CashShiftDetailResponse>();

        Assert.Equal(CashShiftStatus.CountSubmitted, countSubmission!.Status);
        Assert.Equal(300.00m, countSubmission.ExpectedCashBalance);
        Assert.Equal(280.00m, countSubmission.CountedCashBalance);
        Assert.Equal(20.00m, countSubmission.DiscrepancyAmount);
        Assert.Equal(CashDiscrepancyType.Shortage, countSubmission.DiscrepancyType);

        // Cliente Gerente para aprovação
        var managerClient = CreateAuthenticatedClient(tenantId, branchId, userId,
            PermissionCatalog.CashShiftView,
            PermissionCatalog.CashShiftApprove,
            PermissionCatalog.CashClose,
            PermissionCatalog.CashDiscrepancyView,
            PermissionCatalog.CashDiscrepancyResolve);

        var discrepancies = await (await managerClient.GetAsync($"/api/cash/discrepancies?branchId={branchId}")).Content.ReadFromJsonAsync<List<CashDiscrepancyResponse>>();
        Assert.NotNull(discrepancies);
        Assert.Single(discrepancies);
        Assert.Equal(20.00m, discrepancies[0].Amount);

        // Aprovação e Fechamento
        var approveRes = await managerClient.PostAsJsonAsync($"/api/cash/shifts/{shift.Id}/approve-closing", new ApproveCashClosingDto("Aprovado com ressalva"));
        Assert.Equal(HttpStatusCode.OK, approveRes.StatusCode);

        var closeRes = await managerClient.PostAsJsonAsync($"/api/cash/shifts/{shift.Id}/close", new { });
        Assert.Equal(HttpStatusCode.OK, closeRes.StatusCode);
        var closedShift = await closeRes.Content.ReadFromJsonAsync<CashShiftDetailResponse>();
        Assert.Equal(CashShiftStatus.Closed, closedShift!.Status);
    }

    [Fact]
    public async Task TenantIsolation_TenantACannotAccessOrModifyCashOfTenantB()
    {
        var (tenantA, branchA, userA) = await SeedBaseTenantAsync("ISOA");
        var (tenantB, branchB, userB) = await SeedBaseTenantAsync("ISOB");

        var clientA = CreateAuthenticatedClient(tenantA, branchA, userA,
            PermissionCatalog.CashRegisterManage,
            PermissionCatalog.CashOpen,
            PermissionCatalog.CashShiftView);

        var clientB = CreateAuthenticatedClient(tenantB, branchB, userB,
            PermissionCatalog.CashRegisterView,
            PermissionCatalog.CashRegisterManage,
            PermissionCatalog.CashOpen,
            PermissionCatalog.CashShiftView);

        var regRes = await clientA.PostAsJsonAsync("/api/cash/registers", new CreateCashRegisterDto(
            branchA, "CX-A", "Caixa Matriz A"));
        var regA = await regRes.Content.ReadFromJsonAsync<CashRegisterResponse>();

        var openRes = await clientA.PostAsJsonAsync("/api/cash/shifts/open", new OpenCashShiftDto(
            branchA, regA!.Id, userA, 100.00m));
        var shiftA = await openRes.Content.ReadFromJsonAsync<CashShiftDetailResponse>();

        // Act & Assert: Tenant B tenta acessar o turno do Tenant A
        var crossAccessRes = await clientB.GetAsync($"/api/cash/shifts/{shiftA!.Id}");
        Assert.Equal(HttpStatusCode.NotFound, crossAccessRes.StatusCode);

        // Tenant B não deve ver os caixas de A
        var listB = await (await clientB.GetAsync("/api/cash/registers")).Content.ReadFromJsonAsync<List<CashRegisterResponse>>();
        Assert.NotNull(listB);
        Assert.DoesNotContain(listB, r => r.Id == regA.Id);
    }
}
