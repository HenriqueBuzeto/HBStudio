using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using BuildingBlocks.Application;
using Messaging.Application.Contracts;
using Messaging.Application.DTOs;
using Messaging.Domain.Entities;
using Messaging.Domain.Services;
using Microsoft.EntityFrameworkCore;

namespace Messaging.Application.Services;

public class MessagingAppService
{
    private readonly DbContext _dbContext;
    private readonly IExecutionContext _executionContext;
    private readonly ICommunicationEligibilityService _eligibilityService;
    private readonly IEnumerable<IMessageProvider> _providers;

    public MessagingAppService(
        DbContext dbContext,
        IExecutionContext executionContext,
        ICommunicationEligibilityService eligibilityService,
        IEnumerable<IMessageProvider> providers)
    {
        _dbContext = dbContext;
        _executionContext = executionContext;
        _eligibilityService = eligibilityService;
        _providers = providers;
    }

    private Guid CurrentTenantId => _executionContext.TenantId != Guid.Empty ? _executionContext.TenantId : throw new UnauthorizedAccessException("Tenant não identificado.");
    private Guid CurrentBranchId => _executionContext.BranchId.HasValue && _executionContext.BranchId.Value != Guid.Empty ? _executionContext.BranchId.Value : Guid.NewGuid();

    // ==========================================
    // 1. CONFIGURAÇÃO DE CONTAS DE CANAIS
    // ==========================================
    public async Task<MessagingChannelAccountResponse> CreateChannelAccountAsync(CreateChannelAccountRequest request, CancellationToken ct = default)
    {
        var existing = await _dbContext.Set<MessagingChannelAccount>()
            .FirstOrDefaultAsync(a => a.TenantId == CurrentTenantId && a.Channel == request.Channel, ct);

        if (existing != null)
        {
            throw new InvalidOperationException($"Já existe uma conta de canal {request.Channel} configurada para este Tenant.");
        }

        var account = new MessagingChannelAccount(
            CurrentTenantId,
            CurrentBranchId,
            request.Channel,
            request.AccountName,
            request.SenderPhoneNumber,
            request.PhoneNumberId,
            request.WabaId,
            request.AccessToken,
            request.AppSecret,
            request.VerifyToken,
            request.GraphApiVersion ?? "v21.0"
        );

        _dbContext.Set<MessagingChannelAccount>().Add(account);
        await _dbContext.SaveChangesAsync(ct);

        return MapAccount(account);
    }

    public async Task<List<MessagingChannelAccountResponse>> ListChannelAccountsAsync(CancellationToken ct = default)
    {
        var accounts = await _dbContext.Set<MessagingChannelAccount>()
            .Where(a => a.TenantId == CurrentTenantId)
            .ToListAsync(ct);

        return accounts.Select(MapAccount).ToList();
    }

    // ==========================================
    // 2. GESTÃO DE TEMPLATES
    // ==========================================
    public async Task<MessageTemplateResponse> CreateTemplateAsync(CreateMessageTemplateRequest request, CancellationToken ct = default)
    {
        var template = new MessageTemplate(
            CurrentTenantId,
            request.Name,
            request.ExternalTemplateName,
            request.Channel,
            request.Category,
            request.Language,
            request.Content,
            null,
            request.Purpose,
            TemplateStatus.Approved // Inicializado como aprovado para testes locais homologados
        );

        _dbContext.Set<MessageTemplate>().Add(template);
        await _dbContext.SaveChangesAsync(ct);

        return MapTemplate(template);
    }

    public async Task<List<MessageTemplateResponse>> ListTemplatesAsync(CancellationToken ct = default)
    {
        var templates = await _dbContext.Set<MessageTemplate>()
            .Where(t => t.TenantId == CurrentTenantId)
            .OrderByDescending(t => t.CreatedAtUtc)
            .ToListAsync(ct);

        return templates.Select(MapTemplate).ToList();
    }

    // ==========================================
    // 3. ENFILEIRAMENTO DE MENSAGENS COM IDEMPOTÊNCIA
    // ==========================================
    public async Task<MessageRequestResponse> EnqueueMessageAsync(EnqueueMessageRequest request, CancellationToken ct = default)
    {
        var idempotencyKey = string.IsNullOrWhiteSpace(request.IdempotencyKey) 
            ? $"MSG-{Guid.NewGuid():N}" 
            : request.IdempotencyKey.Trim();

        // 1. Verificação de Idempotência física
        var existingMsg = await _dbContext.Set<MessageRequest>()
            .FirstOrDefaultAsync(m => m.TenantId == CurrentTenantId && m.IdempotencyKey == idempotencyKey, ct);

        if (existingMsg != null)
        {
            return MapMessage(existingMsg);
        }

        // 2. Avaliação canônica de elegibilidade (LGPD + Opt-out + Janela de 24h)
        var eligibility = await _eligibilityService.EvaluateEligibilityAsync(
            CurrentTenantId,
            request.PartyId,
            request.Recipient,
            request.Channel,
            request.Purpose,
            ct);

        if (!eligibility.IsEligible)
        {
            throw new InvalidOperationException($"Não foi possível enfileirar mensagem: {eligibility.RejectionReason}");
        }

        // 3. Validação de obrigatoriedade de template
        if (eligibility.RequiresApprovedTemplate && !request.TemplateId.HasValue)
        {
            throw new InvalidOperationException("Regra da plataforma Meta: Fora da janela de 24h, o envio para WhatsApp exige obrigatoriamente um Template aprovado.");
        }

        string textBody = request.TextBody ?? string.Empty;

        if (request.TemplateId.HasValue)
        {
            var template = await _dbContext.Set<MessageTemplate>()
                .FirstOrDefaultAsync(t => t.Id == request.TemplateId.Value && t.TenantId == CurrentTenantId, ct)
                ?? throw new KeyNotFoundException("Template não encontrado.");

            if (template.Status != TemplateStatus.Approved)
            {
                throw new InvalidOperationException($"O template '{template.Name}' não está aprovado para envio (Status: {template.Status}).");
            }

            textBody = template.Content;
            if (request.TemplateVariables != null)
            {
                foreach (var (k, v) in request.TemplateVariables)
                {
                    textBody = textBody.Replace($"{{{{{k}}}}}", v);
                }
            }
        }

        var channelAccount = await _dbContext.Set<MessagingChannelAccount>()
            .FirstOrDefaultAsync(a => a.TenantId == CurrentTenantId && a.Channel == request.Channel, ct);

        var msg = new MessageRequest(
            CurrentTenantId,
            CurrentBranchId,
            channelAccount?.Id,
            request.Channel,
            request.Recipient,
            request.PartyId,
            request.Purpose,
            request.SourceType,
            request.SourceId,
            request.TemplateId,
            request.TemplateVariables != null ? JsonSerializer.Serialize(request.TemplateVariables) : "{}",
            textBody,
            idempotencyKey,
            Guid.NewGuid()
        );

        _dbContext.Set<MessageRequest>().Add(msg);
        await _dbContext.SaveChangesAsync(ct);

        return MapMessage(msg);
    }

    public async Task<List<MessageRequestResponse>> ListMessagesAsync(CancellationToken ct = default)
    {
        var messages = await _dbContext.Set<MessageRequest>()
            .Where(m => m.TenantId == CurrentTenantId)
            .OrderByDescending(m => m.CreatedAtUtc)
            .Take(100)
            .ToListAsync(ct);

        return messages.Select(MapMessage).ToList();
    }

    // ==========================================
    // 4. NOTIFICAÇÕES INTERNAS (IN-APP)
    // ==========================================
    public async Task<InAppNotificationResponse> CreateInAppNotificationAsync(
        Guid targetUserId,
        string category,
        string title,
        string description,
        string? actionUrl = null,
        CancellationToken ct = default)
    {
        var notif = new InAppNotification(
            CurrentTenantId,
            CurrentBranchId,
            targetUserId,
            category,
            title,
            description,
            actionUrl
        );

        _dbContext.Set<InAppNotification>().Add(notif);
        await _dbContext.SaveChangesAsync(ct);

        return new InAppNotificationResponse(notif.Id, notif.TargetUserId, notif.Category, notif.Title, notif.Description, notif.ActionUrl, notif.IsRead, notif.CreatedAtUtc);
    }

    public async Task<List<InAppNotificationResponse>> ListInAppNotificationsAsync(bool unreadOnly = false, CancellationToken ct = default)
    {
        var query = _dbContext.Set<InAppNotification>()
            .Where(n => n.TenantId == CurrentTenantId);

        if (unreadOnly)
        {
            query = query.Where(n => !n.IsRead);
        }

        var list = await query
            .OrderByDescending(n => n.CreatedAtUtc)
            .Take(50)
            .ToListAsync(ct);

        return list.Select(n => new InAppNotificationResponse(n.Id, n.TargetUserId, n.Category, n.Title, n.Description, n.ActionUrl, n.IsRead, n.CreatedAtUtc)).ToList();
    }

    public async Task MarkNotificationAsReadAsync(Guid id, CancellationToken ct = default)
    {
        var notif = await _dbContext.Set<InAppNotification>()
            .FirstOrDefaultAsync(n => n.Id == id && n.TenantId == CurrentTenantId, ct);

        if (notif != null)
        {
            notif.MarkAsRead();
            await _dbContext.SaveChangesAsync(ct);
        }
    }

    // ==========================================
    // 5. PROCESSAMENTO DE WEBHOOKS SEGUROS (META CLOUD API)
    // ==========================================
    public async Task<bool> ProcessIncomingWebhookAsync(string payload, string signatureHeader, CancellationToken ct = default)
    {
        // 1. Localizar conta do WhatsApp do tenant
        var account = await _dbContext.Set<MessagingChannelAccount>()
            .FirstOrDefaultAsync(a => a.Channel == MessagingChannel.WhatsApp && a.IsActive, ct);

        if (account == null || string.IsNullOrWhiteSpace(account.EncryptedAppSecret))
        {
            return false;
        }

        // 2. Validação criptográfica HMAC-SHA256 em tempo constante
        var provider = _providers.FirstOrDefault(p => p.Channel == MessagingChannel.WhatsApp);
        if (provider == null || !provider.ValidateWebhookSignature(payload, signatureHeader, account.EncryptedAppSecret))
        {
            return false; // Assinatura forjada ou inválida
        }

        // 3. Processar payload estruturado
        using var doc = JsonDocument.Parse(payload);
        var root = doc.RootElement;

        if (root.TryGetProperty("entry", out var entryArray) && entryArray.GetArrayLength() > 0)
        {
            var firstEntry = entryArray[0];
            if (firstEntry.TryGetProperty("changes", out var changesArray) && changesArray.GetArrayLength() > 0)
            {
                var value = changesArray[0].GetProperty("value");

                // Processar Status de Entrega
                if (value.TryGetProperty("statuses", out var statusesArray) && statusesArray.GetArrayLength() > 0)
                {
                    var statusObj = statusesArray[0];
                    var providerMsgId = statusObj.GetProperty("id").GetString();
                    var statusStr = statusObj.GetProperty("status").GetString();

                    if (!string.IsNullOrWhiteSpace(providerMsgId))
                    {
                        var msg = await _dbContext.Set<MessageRequest>()
                            .FirstOrDefaultAsync(m => m.ProviderMessageId == providerMsgId, ct);

                        if (msg != null)
                        {
                            switch (statusStr?.ToLowerInvariant())
                            {
                                case "delivered":
                                    msg.MarkDelivered();
                                    break;
                                case "read":
                                    msg.MarkRead();
                                    break;
                                case "failed":
                                    msg.MarkFailed("Falha de entrega reportada pela Meta.", isPermanent: true);
                                    break;
                            }
                            await _dbContext.SaveChangesAsync(ct);
                        }
                    }
                }

                // Processar Mensagens Recebidas (Inbound) e Opt-out
                if (value.TryGetProperty("messages", out var messagesArray) && messagesArray.GetArrayLength() > 0)
                {
                    var msgObj = messagesArray[0];
                    var fromPhone = msgObj.GetProperty("from").GetString();
                    var textBody = msgObj.TryGetProperty("text", out var tObj) ? tObj.GetProperty("body").GetString() : string.Empty;
                    var providerId = msgObj.GetProperty("id").GetString() ?? Guid.NewGuid().ToString("N");

                    if (!string.IsNullOrWhiteSpace(fromPhone) && !string.IsNullOrWhiteSpace(textBody))
                    {
                        // 1. Obter ou criar conversa
                        var conversation = await _dbContext.Set<CustomerConversation>()
                            .FirstOrDefaultAsync(c => c.CustomerPhoneNumber == fromPhone, ct);

                        if (conversation == null)
                        {
                            conversation = new CustomerConversation(account.TenantId, account.BranchId, null, fromPhone, "Cliente WhatsApp");
                            _dbContext.Set<CustomerConversation>().Add(conversation);
                        }

                        conversation.RecordInboundMessage(textBody, providerId);

                        // 2. Reconhecer comandos de Opt-Out
                        var upper = textBody.Trim().ToUpperInvariant();
                        if (upper is "SAIR" or "PARAR" or "CANCELAR" or "CANCELAR MENSAGENS" || upper.Contains("NÃO QUERO MAIS RECEBER"))
                        {
                            // Registrar supressão no PartyConsentRecord
                            var party = await _dbContext.Set<Parties.Domain.Party>()
                                .Include(p => p.Contacts)
                                .FirstOrDefaultAsync(p => p.Contacts.Any(c => c.Phone == fromPhone || c.WhatsApp == fromPhone), ct);

                            if (party != null)
                            {
                                party.RecordConsent("WhatsApp", "Marketing", isOptIn: false, origin: "WhatsApp Inbound Opt-Out", evidence: textBody);
                            }
                        }

                        await _dbContext.SaveChangesAsync(ct);
                    }
                }
            }
        }

        return true;
    }

    // ==========================================
    // 6. DASHBOARD METRICS
    // ==========================================
    public async Task<MessagingDashboardMetricsResponse> GetDashboardMetricsAsync(CancellationToken ct = default)
    {
        var messages = await _dbContext.Set<MessageRequest>()
            .Where(m => m.TenantId == CurrentTenantId)
            .ToListAsync(ct);

        var unreadNotifs = await _dbContext.Set<InAppNotification>()
            .CountAsync(n => n.TenantId == CurrentTenantId && !n.IsRead, ct);

        var activeConv = await _dbContext.Set<CustomerConversation>()
            .CountAsync(c => c.TenantId == CurrentTenantId && c.Status == "Open", ct);

        var account = await _dbContext.Set<MessagingChannelAccount>()
            .FirstOrDefaultAsync(a => a.TenantId == CurrentTenantId && a.Channel == MessagingChannel.WhatsApp, ct);

        return new MessagingDashboardMetricsResponse(
            TotalProcessed: messages.Count,
            TotalDelivered: messages.Count(m => m.Status is MessageRequestStatus.Delivered or MessageRequestStatus.Read),
            TotalFailed: messages.Count(m => m.Status == MessageRequestStatus.Failed),
            TotalPendingQueue: messages.Count(m => m.Status is MessageRequestStatus.Queued or MessageRequestStatus.Processing),
            UnreadNotificationsCount: unreadNotifs,
            ActiveConversationsCount: activeConv,
            WhatsAppStatus: account?.Status ?? ProviderConnectionStatus.NotConfigured
        );
    }

    // Mappers
    private static MessagingChannelAccountResponse MapAccount(MessagingChannelAccount a) => new(
        a.Id, a.TenantId, a.BranchId, a.Channel, a.AccountName, a.SenderPhoneNumber, a.PhoneNumberId, a.WabaId,
        a.Status, a.LastVerifiedAtUtc, a.LastError, a.IsActive, a.CreatedAtUtc);

    private static MessageTemplateResponse MapTemplate(MessageTemplate t) => new(
        t.Id, t.TenantId, t.Name, t.ExternalTemplateName, t.Channel, t.Category, t.Language, t.Content,
        t.Status, t.Purpose, t.CreatedAtUtc);

    private static MessageRequestResponse MapMessage(MessageRequest m) => new(
        m.Id, m.TenantId, m.BranchId, m.Channel, m.Recipient, m.PartyId, m.Purpose, m.SourceType, m.SourceId,
        m.TemplateId, m.TextBody, m.Status, m.ProviderMessageId, m.AttemptCount, m.LastError, m.ScheduledAtUtc,
        m.CreatedAtUtc, m.DeliveredAtUtc, m.ReadAtUtc);
}
