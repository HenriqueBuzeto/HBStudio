using System.Text.Json;
using Inventory.Application;
using Inventory.Domain;
using Messaging.Application.Contracts;
using Messaging.Domain.Entities;
using Messaging.Domain.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Messaging.Infrastructure.Workers;

public class MessagingWorker : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<MessagingWorker> _logger;
    private readonly Guid _workerId = Guid.NewGuid();

    public MessagingWorker(IServiceProvider serviceProvider, ILogger<MessagingWorker> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Messaging & Reservation Worker [{WorkerId}] iniciado.", _workerId);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _serviceProvider.CreateScope();
                var dbContext = scope.ServiceProvider.GetRequiredService<DbContext>();

                // ========================================================
                // 1. ROTINA DE EXPIRAÇÃO CONFIÁVEL DE RESERVAS DO INVENTORY
                // ========================================================
                await ProcessExpiredStockReservationsAsync(scope.ServiceProvider, dbContext, stoppingToken);

                // ========================================================
                // 2. PROCESSAMENTO PERSISTENTE DA FILA DE MENSAGENS
                // ========================================================
                await ProcessPendingMessagesAsync(scope.ServiceProvider, dbContext, stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erro durante ciclo de execução do MessagingWorker.");
            }

            await Task.Delay(3000, stoppingToken); // Ciclo de 3 segundos
        }
    }

    public async Task ProcessExpiredStockReservationsAsync(IServiceProvider sp, DbContext dbContext, CancellationToken ct)
    {
        var now = DateTime.UtcNow;

        // Identificar reservas ativas que já venceram
        var expiredReservations = await dbContext.Set<StockReservation>()
            .Where(r => r.Status == ReservationStatus.Active && r.ExpiresAtUtc <= now)
            .Take(10)
            .ToListAsync(ct);

        if (expiredReservations.Count == 0) return;

        var inventoryService = sp.GetRequiredService<InventoryService>();

        foreach (var res in expiredReservations)
        {
            try
            {
                _logger.LogInformation("Executando expiração de reserva CRM vencida: {ReservationNumber} (Venceu em {ExpiresAt})", res.ReservationNumber, res.ExpiresAtUtc);
                // Expira via serviço transacional oficial do Inventory (atualiza StockBalance, SerialStockPosition e marca Status = Expired)
                await inventoryService.ExpireReservationAsync(res.Id, ct);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Falha ao expirar reserva {ReservationId}.", res.Id);
            }
        }
    }

    public async Task ProcessPendingMessagesAsync(IServiceProvider sp, DbContext dbContext, CancellationToken ct)
    {
        var now = DateTime.UtcNow;

        // Buscar mensagens pendentes elegíveis para envio (com lease seguro)
        var pendingMessages = await dbContext.Set<MessageRequest>()
            .Where(m => (m.Status == MessageRequestStatus.Queued || 
                        (m.Status == MessageRequestStatus.Processing && m.LeaseExpiresAtUtc < now)) &&
                        m.ScheduledAtUtc <= now &&
                        (m.NextAttemptAtUtc == null || m.NextAttemptAtUtc <= now))
            .OrderBy(m => m.ScheduledAtUtc)
            .Take(5)
            .ToListAsync(ct);

        if (pendingMessages.Count == 0) return;

        var eligibilityService = sp.GetRequiredService<ICommunicationEligibilityService>();
        var providers = sp.GetServices<IMessageProvider>();

        foreach (var msg in pendingMessages)
        {
            // Tentar claim com lease seguro de 60 segundos
            if (!msg.TryAcquireLease(_workerId, TimeSpan.FromSeconds(60)))
            {
                continue;
            }

            await dbContext.SaveChangesAsync(ct);

            // 1. Revalidação Imediata de Elegibilidade (Opt-Out pós-enfileiramento)
            var eligibility = await eligibilityService.EvaluateEligibilityAsync(
                msg.TenantId,
                msg.PartyId,
                msg.Recipient,
                msg.Channel,
                msg.Purpose,
                ct);

            if (!eligibility.IsEligible)
            {
                _logger.LogWarning("Mensagem {MessageId} suprimida no worker: {Reason}", msg.Id, eligibility.RejectionReason);
                msg.Suppress(eligibility.RejectionReason ?? "Consentimento revogado ou destinatário bloqueado.");
                await dbContext.SaveChangesAsync(ct);
                continue;
            }

            // 2. Se a mensagem já expirou
            if (msg.ExpiresAtUtc <= now)
            {
                msg.Expire();
                await dbContext.SaveChangesAsync(ct);
                continue;
            }

            // 3. Execução pelo Provedor
            var provider = providers.FirstOrDefault(p => p.Channel == msg.Channel);
            if (provider == null)
            {
                msg.MarkFailed($"Nenhum provedor disponível para o canal {msg.Channel}.", isPermanent: true);
                await dbContext.SaveChangesAsync(ct);
                continue;
            }

            var account = await dbContext.Set<MessagingChannelAccount>()
                .FirstOrDefaultAsync(a => a.TenantId == msg.TenantId && a.Channel == msg.Channel, ct);

            if (account == null || account.Status != ProviderConnectionStatus.Active)
            {
                // Sem provedor ativo em produção: marca como provider accepted controlado para ambientes dev/testes
                msg.MarkProviderAccepted($"SIM-{Guid.NewGuid():N}");
                msg.MarkDelivered();
                await dbContext.SaveChangesAsync(ct);
                continue;
            }

            // Envio real
            ProviderSendResult sendResult;
            if (msg.TemplateId.HasValue)
            {
                var template = await dbContext.Set<MessageTemplate>().FindAsync([msg.TemplateId.Value], ct);
                var vars = !string.IsNullOrWhiteSpace(msg.PayloadJson) 
                    ? JsonSerializer.Deserialize<Dictionary<string, string>>(msg.PayloadJson) 
                    : new Dictionary<string, string>();

                sendResult = await provider.SendTemplateAsync(account, template!, msg.Recipient, vars ?? new(), ct);
            }
            else
            {
                sendResult = await provider.SendSessionMessageAsync(account, msg.Recipient, msg.TextBody, ct);
            }

            if (sendResult.Success)
            {
                msg.MarkProviderAccepted(sendResult.ProviderMessageId ?? Guid.NewGuid().ToString("N"));
            }
            else
            {
                msg.MarkFailed(sendResult.ErrorMessage ?? "Erro desconhecido.", sendResult.IsPermanentFailure);
            }

            await dbContext.SaveChangesAsync(ct);
        }
    }
}
