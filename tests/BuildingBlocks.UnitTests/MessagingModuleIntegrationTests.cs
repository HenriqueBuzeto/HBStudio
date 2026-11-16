using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using BuildingBlocks.Domain;
using BuildingBlocks.Infrastructure;
using BuildingBlocks.Security;
using Catalog.Domain;
using FluentAssertions;
using IdentityAccess.Domain;
using Inventory.Application;
using Inventory.Domain;
using Messaging.Application.Contracts;
using Messaging.Application.DTOs;
using Messaging.Domain.Entities;
using Messaging.Domain.Services;
using Messaging.Infrastructure.Providers;
using Messaging.Infrastructure.Workers;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Parties.Domain;
using Xunit;

namespace BuildingBlocks.UnitTests;

public class MessagingModuleIntegrationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly ITokenService _jwtTokenService;

    public MessagingModuleIntegrationTests(WebApplicationFactory<Program> factory)
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
            "messaging.tester@hbstudio.com",
            permissions);

        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", tokenResponse.AccessToken);
        return client;
    }

    private async Task<(Guid TenantId, Guid BranchId)> SeedTenantAndBranchAsync()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var tenant = new Tenant($"Tenant-MSG-{Guid.NewGuid():N}", $"T-{Guid.NewGuid():N}"[..8]);
        var branch = tenant.AddBranch($"Filial MSG {Guid.NewGuid():N}", $"B-{Guid.NewGuid():N}"[..8]);
        db.Tenants.Add(tenant);
        await db.SaveChangesAsync();

        return (tenant.Id, branch.Id);
    }

    [Fact]
    public async Task Messaging_Security_RequiresCanonicalPermissions()
    {
        // 1. Cliente Anônimo recebe 401
        var anonClient = _factory.CreateClient();
        var anonRes = await anonClient.GetAsync("/api/messaging/metrics");
        anonRes.StatusCode.Should().Be(HttpStatusCode.Unauthorized);

        // 2. Cliente com permissão incorreta recebe 403
        var (tenantId, branchId) = await SeedTenantAndBranchAsync();
        var unauthClient = CreateAuthenticatedClient(tenantId, branchId, [PermissionCatalog.InventoryView]);
        var forbiddenRes = await unauthClient.GetAsync("/api/messaging/metrics");
        forbiddenRes.StatusCode.Should().Be(HttpStatusCode.Forbidden);

        // 3. Cliente com MessagingView recebe 200 OK
        var authClient = CreateAuthenticatedClient(tenantId, branchId, [PermissionCatalog.MessagingView]);
        var okRes = await authClient.GetAsync("/api/messaging/metrics");
        okRes.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Messaging_Eligibility_SuppressesMarketingMessage_WhenOptOutRecordedInPartyConsentRecord()
    {
        var (tenantId, branchId) = await SeedTenantAndBranchAsync();

        var client = CreateAuthenticatedClient(tenantId, branchId, [
            PermissionCatalog.MessagingView,
            PermissionCatalog.MessagingSend,
            PermissionCatalog.MessagingTemplatesManage
        ]);

        Guid partyId;
        Guid templateId;

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            // Criar Cliente
            var party = new Party(tenantId, PartyType.Individual, "Carlos Alberto", documentNumber: "11122233344");
            // REGISTRO DE OPT-OUT CANÔNICO (Não aceita marketing por WhatsApp)
            party.RecordConsent("WhatsApp", "Marketing", isOptIn: false, origin: "Balcão Loja", evidence: "Solicitou cancelamento");
            db.Parties.Add(party);

            // Criar Template
            var tpl = new MessageTemplate(tenantId, "Promoção Especial", "promo_especial", MessagingChannel.WhatsApp, TemplateCategory.Marketing, "pt_BR", "Olá {{nome}}, temos novidades!", null, MessagePurpose.Marketing, TemplateStatus.Approved);
            db.Set<MessageTemplate>().Add(tpl);

            await db.SaveChangesAsync();
            partyId = party.Id;
            templateId = tpl.Id;
        }

        // Tentar enfileirar mensagem de marketing para o cliente com opt-out
        var req = new EnqueueMessageRequest(
            Channel: MessagingChannel.WhatsApp,
            Recipient: "11988887777",
            PartyId: partyId,
            Purpose: MessagePurpose.Marketing, // Proibido para opt-out!
            SourceType: "CAMPAIGN",
            SourceId: null,
            TemplateId: templateId,
            TemplateVariables: new() { ["nome"] = "Carlos" },
            TextBody: null,
            IdempotencyKey: $"OPT-TEST-{Guid.NewGuid():N}");

        var res = await client.PostAsJsonAsync("/api/messaging/messages/enqueue", req);
        
        // Deve falhar com erro de rejeição de elegibilidade
        res.StatusCode.Should().Be(HttpStatusCode.InternalServerError);
        var err = await res.Content.ReadAsStringAsync();
        err.Should().Contain("revogou consentimento");
    }

    [Fact]
    public async Task Messaging_Idempotency_SameKey_DoesNotDuplicateMessage()
    {
        var (tenantId, branchId) = await SeedTenantAndBranchAsync();

        var client = CreateAuthenticatedClient(tenantId, branchId, [
            PermissionCatalog.MessagingView,
            PermissionCatalog.MessagingSend,
            PermissionCatalog.MessagingTemplatesManage
        ]);

        Guid templateId;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var tpl = new MessageTemplate(tenantId, "Aviso OS", "aviso_os", MessagingChannel.WhatsApp, TemplateCategory.Utility, "pt_BR", "Sua OS está pronta!", null, MessagePurpose.Operational, TemplateStatus.Approved);
            db.Set<MessageTemplate>().Add(tpl);
            await db.SaveChangesAsync();
            templateId = tpl.Id;
        }

        var idempotencyKey = $"IDEMP-{Guid.NewGuid():N}";

        var req = new EnqueueMessageRequest(
            Channel: MessagingChannel.WhatsApp,
            Recipient: "11977776666",
            PartyId: null,
            Purpose: MessagePurpose.Operational,
            SourceType: "REPAIR_OS",
            SourceId: Guid.NewGuid(),
            TemplateId: templateId,
            TemplateVariables: null,
            TextBody: null,
            IdempotencyKey: idempotencyKey);

        // 1. Primeiro Enfileiramento
        var res1 = await client.PostAsJsonAsync("/api/messaging/messages/enqueue", req);
        res1.StatusCode.Should().Be(HttpStatusCode.Created);
        var msg1 = await res1.Content.ReadFromJsonAsync<MessageRequestResponse>();
        msg1.Should().NotBeNull();

        // 2. Segundo Enfileiramento com a MESMA chave
        var res2 = await client.PostAsJsonAsync("/api/messaging/messages/enqueue", req);
        res2.StatusCode.Should().Be(HttpStatusCode.Created);
        var msg2 = await res2.Content.ReadFromJsonAsync<MessageRequestResponse>();
        msg2.Should().NotBeNull();

        // DEVE RETORNAR O MESMO ID E NÃO DUPLICAR NA FILA
        msg2!.Id.Should().Be(msg1!.Id);
    }

    [Fact]
    public async Task Messaging_Webhooks_HMAC256_ValidSignatureAccepted_AndInvalidRejected()
    {
        var (tenantId, branchId) = await SeedTenantAndBranchAsync();
        var client = _factory.CreateClient();

        var appSecret = "HBStudioMetaSecretKey2026!";

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var acc = new MessagingChannelAccount(
                tenantId,
                branchId,
                MessagingChannel.WhatsApp,
                "WhatsApp Principal",
                senderPhoneNumber: "11999998888",
                phoneNumberId: "PHONE-ID-12345",
                wabaId: "WABA-12345",
                encryptedAccessToken: "ACCESS-TOKEN-VALID",
                encryptedAppSecret: appSecret,
                verifyToken: "VERIFY-TOKEN-TEST",
                graphApiVersion: "v21.0"
            );
            acc.UpdateStatus(ProviderConnectionStatus.Active);
            db.Set<MessagingChannelAccount>().Add(acc);
            await db.SaveChangesAsync();
        }

        var samplePayload = "{\"object\":\"whatsapp_business_account\",\"entry\":[]}";

        // 1. Assinatura Inválida
        var reqInvalid = new HttpRequestMessage(HttpMethod.Post, "/api/webhooks/whatsapp");
        reqInvalid.Headers.Add("X-Hub-Signature-256", "sha256=assinatura_forjada_invalida_123");
        reqInvalid.Content = new StringContent(samplePayload, Encoding.UTF8, "application/json");

        var resInvalid = await client.SendAsync(reqInvalid);
        resInvalid.StatusCode.Should().Be(HttpStatusCode.Unauthorized);

        // 2. Assinatura Válida calculada com HMAC-SHA256 sobre o corpo bruto
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(appSecret));
        var computedHash = hmac.ComputeHash(Encoding.UTF8.GetBytes(samplePayload));
        var validSignatureHeader = $"sha256={Convert.ToHexString(computedHash).ToLowerInvariant()}";

        var reqValid = new HttpRequestMessage(HttpMethod.Post, "/api/webhooks/whatsapp");
        reqValid.Headers.Add("X-Hub-Signature-256", validSignatureHeader);
        reqValid.Content = new StringContent(samplePayload, Encoding.UTF8, "application/json");

        var resValid = await client.SendAsync(reqValid);
        resValid.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task MessagingWorker_ExpiredReservation_ReleasesStockBalance_AndSerialPositionAutomatically()
    {
        var (tenantId, branchId) = await SeedTenantAndBranchAsync();

        Guid warehouseId;
        Guid skuId;
        Guid unitId;
        Guid reservationId;

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            var wh = new Warehouse(tenantId, branchId, $"DEP-{Guid.NewGuid():N}"[..8], "Depósito Geral", WarehouseType.GeneralStore);
            db.Set<Warehouse>().Add(wh);
            warehouseId = wh.Id;

            var brand = new ProductBrand(tenantId, $"Brand-{Guid.NewGuid():N}"[..10]);
            var cat = new ProductCategory(tenantId, "Acessórios", $"acess-{Guid.NewGuid():N}"[..10]);
            db.ProductBrands.Add(brand);
            db.ProductCategories.Add(cat);

            var model = new ProductModel(tenantId, "Apple Watch Ultra", ProductKind.Standard, SerializationPolicy.StrictSerialized, brand.Id, cat.Id);
            db.ProductModels.Add(model);

            var sku = new ProductSku(tenantId, model.Id, $"SKU-AW-{Guid.NewGuid():N}"[..12], "Apple Watch 49mm", 5500.00m);
            db.ProductSkus.Add(sku);
            skuId = sku.Id;

            var unit = new InventoryUnit(tenantId, sku.Id, ItemCondition.BrandNew, 3800.00m, "SN-WATCH-01", null, null, CosmeticGrade.GradeA, 100);
            unit.ApproveForSale("Lacre de fábrica");
            db.Set<InventoryUnit>().Add(unit);
            unitId = unit.Id;

            // Criar saldo e posição serial
            var bal = new StockBalance(tenantId, branchId, wh.Id, null, sku.Id);
            bal.ApplyMovement(1, 3800.00m);
            db.Set<StockBalance>().Add(bal);

            var pos = new SerialStockPosition(tenantId, unit.Id, sku.Id, branchId, wh.Id, null);
            db.Set<SerialStockPosition>().Add(pos);

            // Criar Reserva JÁ EXPIRADA (ExpiresAtUtc no passado)
            var res = new StockReservation(
                tenantId,
                branchId,
                $"RES-EXP-{Guid.NewGuid():N}"[..8],
                "Reserva CRM teste de expiração 48h",
                expiresAtUtc: DateTime.UtcNow.AddMinutes(-10) // Vencida há 10 minutos!
            );
            res.AddItem(wh.Id, null, sku.Id, 1, unit.Id);
            bal.Reserve(1);
            pos.SetReserved(res.Id);

            db.Set<StockReservation>().Add(res);
            await db.SaveChangesAsync();

            reservationId = res.Id;

            // Verificar que o saldo disponível antes do worker é 0
            bal.AvailableQuantity.Should().Be(0);
            pos.IsReserved.Should().BeTrue();
        }

        // Executar a rotina do Worker dedicada a expiração
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var logger = scope.ServiceProvider.GetRequiredService<ILogger<MessagingWorker>>();
            var worker = new MessagingWorker(scope.ServiceProvider, logger);

            // Chamada direta do método do ciclo de expiração sem precisar aguardar timer
            await worker.ProcessExpiredStockReservationsAsync(scope.ServiceProvider, db, CancellationToken.None);
        }

        // Verificar que o saldo disponível foi restaurado e a reserva foi marcada como Expired
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var res = await db.Set<StockReservation>().FindAsync(reservationId);
            res.Should().NotBeNull();
            res!.Status.Should().Be(ReservationStatus.Expired);

            var bal = await db.Set<StockBalance>().FirstOrDefaultAsync(b => b.ProductSkuId == skuId && b.WarehouseId == warehouseId);
            bal!.AvailableQuantity.Should().Be(1, "O saldo disponível DEVE ser liberado automaticamente pela rotina do worker");
            bal.ReservedQuantity.Should().Be(0);

            var pos = await db.Set<SerialStockPosition>().FirstOrDefaultAsync(p => p.InventoryUnitId == unitId);
            pos!.IsReserved.Should().BeFalse("A unidade serial não deve mais estar bloqueada");
        }
    }
}
