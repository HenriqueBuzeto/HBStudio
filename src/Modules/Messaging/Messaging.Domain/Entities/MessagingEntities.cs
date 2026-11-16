using BuildingBlocks.Domain;

namespace Messaging.Domain.Entities;

public enum MessagingChannel
{
    WhatsApp = 1,
    InApp = 2,
    Email = 3,
    Sms = 4
}

public enum ProviderConnectionStatus
{
    NotConfigured = 1,
    Configured = 2,
    Validating = 3,
    Active = 4,
    Degraded = 5,
    Disabled = 6,
    Error = 7
}

public enum MessagePurpose
{
    Operational = 1,        // Notificações de OS, faturamento, retirada (ServiceUpdates)
    CommercialAlert = 2,    // Alerta de produto disponível / matching
    Marketing = 3,          // Campanhas comerciais, ofertas
    Authentication = 4      // Códigos 2FA / tokens
}

public enum TemplateCategory
{
    Utility = 1,
    Marketing = 2,
    Authentication = 3
}

public enum TemplateStatus
{
    Draft = 1,
    Submitted = 2,
    Approved = 3,
    Rejected = 4,
    Paused = 5,
    Disabled = 6
}

public enum MessageRequestStatus
{
    Draft = 1,
    PendingApproval = 2,
    Queued = 3,
    Scheduled = 4,
    Processing = 5,
    ProviderAccepted = 6,
    Sent = 7,
    Delivered = 8,
    Read = 9,
    Failed = 10,
    Suppressed = 11,
    Cancelled = 12,
    Expired = 13,
    DeliveryUnknown = 14
}

public enum AutomationTriggerType
{
    CrmMatchFound = 1,
    RepairEstimateReady = 2,
    RepairReadyForPickup = 3,
    SaleConfirmed = 4,
    CustomCommercialFollowUp = 5
}

public class MessagingChannelAccount : BaseEntity, ITenantScoped, IBranchScoped
{
    public Guid TenantId { get; set; }
    public Guid BranchId { get; set; }
    public MessagingChannel Channel { get; private set; }
    public string AccountName { get; private set; } = string.Empty;
    public string? SenderPhoneNumber { get; private set; }
    public string? PhoneNumberId { get; private set; }
    public string? WabaId { get; private set; }
    public string? EncryptedAccessToken { get; private set; }
    public string? EncryptedAppSecret { get; private set; }
    public string? VerifyToken { get; private set; }
    public string GraphApiVersion { get; private set; } = "v21.0";
    public ProviderConnectionStatus Status { get; private set; }
    public DateTime? LastVerifiedAtUtc { get; private set; }
    public string? LastError { get; private set; }
    public bool IsActive { get; private set; } = true;
    public DateTime CreatedAtUtc { get; private set; }

    protected MessagingChannelAccount() { }

    public MessagingChannelAccount(
        Guid tenantId,
        Guid branchId,
        MessagingChannel channel,
        string accountName,
        string? senderPhoneNumber = null,
        string? phoneNumberId = null,
        string? wabaId = null,
        string? encryptedAccessToken = null,
        string? encryptedAppSecret = null,
        string? verifyToken = null,
        string graphApiVersion = "v21.0")
    {
        TenantId = tenantId;
        BranchId = branchId;
        Channel = channel;
        AccountName = string.IsNullOrWhiteSpace(accountName) ? throw new ArgumentException("Nome da conta obrigatório.") : accountName.Trim();
        SenderPhoneNumber = senderPhoneNumber?.Trim();
        PhoneNumberId = phoneNumberId?.Trim();
        WabaId = wabaId?.Trim();
        EncryptedAccessToken = encryptedAccessToken;
        EncryptedAppSecret = encryptedAppSecret;
        VerifyToken = verifyToken?.Trim();
        GraphApiVersion = string.IsNullOrWhiteSpace(graphApiVersion) ? "v21.0" : graphApiVersion.Trim();
        Status = string.IsNullOrWhiteSpace(encryptedAccessToken) ? ProviderConnectionStatus.NotConfigured : ProviderConnectionStatus.Configured;
        CreatedAtUtc = DateTime.UtcNow;
    }

    public void UpdateStatus(ProviderConnectionStatus status, string? error = null)
    {
        Status = status;
        LastError = error;
        LastVerifiedAtUtc = DateTime.UtcNow;
    }

    public void RotateCredentials(string encryptedAccessToken, string? encryptedAppSecret, string? verifyToken)
    {
        EncryptedAccessToken = encryptedAccessToken;
        EncryptedAppSecret = encryptedAppSecret;
        VerifyToken = verifyToken;
        Status = ProviderConnectionStatus.Configured;
        LastVerifiedAtUtc = DateTime.UtcNow;
    }

    public void SetActive(bool active) => IsActive = active;
}

public class MessageTemplate : BaseEntity, ITenantScoped
{
    public Guid TenantId { get; set; }
    public string Name { get; private set; } = string.Empty;
    public string ExternalTemplateName { get; private set; } = string.Empty;
    public MessagingChannel Channel { get; private set; }
    public TemplateCategory Category { get; private set; }
    public string Language { get; private set; } = "pt_BR";
    public string Content { get; private set; } = string.Empty;
    public string? AllowedVariablesJson { get; private set; }
    public TemplateStatus Status { get; private set; }
    public MessagePurpose Purpose { get; private set; }
    public DateTime CreatedAtUtc { get; private set; }
    public DateTime? StatusUpdatedAtUtc { get; private set; }

    protected MessageTemplate() { }

    public MessageTemplate(
        Guid tenantId,
        string name,
        string externalTemplateName,
        MessagingChannel channel,
        TemplateCategory category,
        string language,
        string content,
        string? allowedVariablesJson,
        MessagePurpose purpose,
        TemplateStatus status = TemplateStatus.Draft)
    {
        TenantId = tenantId;
        Name = string.IsNullOrWhiteSpace(name) ? throw new ArgumentException("Nome do template é obrigatório.") : name.Trim();
        ExternalTemplateName = string.IsNullOrWhiteSpace(externalTemplateName) ? name.Trim().ToLower().Replace(" ", "_") : externalTemplateName.Trim();
        Channel = channel;
        Category = category;
        Language = string.IsNullOrWhiteSpace(language) ? "pt_BR" : language.Trim();
        Content = string.IsNullOrWhiteSpace(content) ? throw new ArgumentException("Conteúdo do template é obrigatório.") : content.Trim();
        AllowedVariablesJson = allowedVariablesJson;
        Purpose = purpose;
        Status = status;
        CreatedAtUtc = DateTime.UtcNow;
    }

    public void UpdateStatus(TemplateStatus status)
    {
        Status = status;
        StatusUpdatedAtUtc = DateTime.UtcNow;
    }
}

public class MessageRequest : BaseEntity, ITenantScoped, IBranchScoped
{
    public Guid TenantId { get; set; }
    public Guid BranchId { get; set; }
    public Guid? ChannelAccountId { get; private set; }
    public MessagingChannel Channel { get; private set; }
    public string Recipient { get; private set; } = string.Empty; // Telefone, Email ou UserId
    public Guid? PartyId { get; private set; }
    public MessagePurpose Purpose { get; private set; }
    public string SourceType { get; private set; } = string.Empty; // ex: "CRM_MATCH", "REPAIR_OS", "SALES"
    public Guid? SourceId { get; private set; }
    public Guid? TemplateId { get; private set; }
    public string PayloadJson { get; private set; } = "{}";
    public string TextBody { get; private set; } = string.Empty;
    public DateTime ScheduledAtUtc { get; private set; }
    public DateTime ExpiresAtUtc { get; private set; }
    public string IdempotencyKey { get; private set; } = string.Empty;
    public Guid CorrelationId { get; private set; }
    public MessageRequestStatus Status { get; private set; }
    public string? ProviderMessageId { get; private set; }
    public int AttemptCount { get; private set; } = 0;
    public DateTime? NextAttemptAtUtc { get; private set; }
    public string? LastError { get; private set; }
    public Guid? LeaseOwnerId { get; private set; }
    public DateTime? LeaseExpiresAtUtc { get; private set; }
    public DateTime CreatedAtUtc { get; private set; }
    public DateTime? DeliveredAtUtc { get; private set; }
    public DateTime? ReadAtUtc { get; private set; }

    protected MessageRequest() { }

    public MessageRequest(
        Guid tenantId,
        Guid branchId,
        Guid? channelAccountId,
        MessagingChannel channel,
        string recipient,
        Guid? partyId,
        MessagePurpose purpose,
        string sourceType,
        Guid? sourceId,
        Guid? templateId,
        string payloadJson,
        string textBody,
        string idempotencyKey,
        Guid correlationId,
        DateTime? scheduledAtUtc = null,
        DateTime? expiresAtUtc = null)
    {
        TenantId = tenantId;
        BranchId = branchId;
        ChannelAccountId = channelAccountId;
        Channel = channel;
        Recipient = string.IsNullOrWhiteSpace(recipient) ? throw new ArgumentException("Destinatário obrigatório.") : recipient.Trim();
        PartyId = partyId;
        Purpose = purpose;
        SourceType = string.IsNullOrWhiteSpace(sourceType) ? "MANUAL" : sourceType.Trim();
        SourceId = sourceId;
        TemplateId = templateId;
        PayloadJson = payloadJson ?? "{}";
        TextBody = textBody?.Trim() ?? string.Empty;
        IdempotencyKey = string.IsNullOrWhiteSpace(idempotencyKey) ? Guid.NewGuid().ToString("N") : idempotencyKey.Trim();
        CorrelationId = correlationId == Guid.Empty ? Guid.NewGuid() : correlationId;
        ScheduledAtUtc = scheduledAtUtc ?? DateTime.UtcNow;
        ExpiresAtUtc = expiresAtUtc ?? DateTime.UtcNow.AddDays(2);
        Status = MessageRequestStatus.Queued;
        CreatedAtUtc = DateTime.UtcNow;
    }

    public bool TryAcquireLease(Guid workerId, TimeSpan leaseDuration)
    {
        var now = DateTime.UtcNow;
        if (LeaseExpiresAtUtc.HasValue && LeaseExpiresAtUtc.Value > now && LeaseOwnerId != workerId)
        {
            return false; // Bloqueado por outro worker
        }

        LeaseOwnerId = workerId;
        LeaseExpiresAtUtc = now.Add(leaseDuration);
        Status = MessageRequestStatus.Processing;
        return true;
    }

    public void ReleaseLease()
    {
        LeaseOwnerId = null;
        LeaseExpiresAtUtc = null;
    }

    public void MarkProviderAccepted(string providerMessageId)
    {
        ProviderMessageId = providerMessageId;
        Status = MessageRequestStatus.ProviderAccepted;
        ReleaseLease();
    }

    public void MarkSent()
    {
        Status = MessageRequestStatus.Sent;
        ReleaseLease();
    }

    public void MarkDelivered(DateTime? deliveredAtUtc = null)
    {
        Status = MessageRequestStatus.Delivered;
        DeliveredAtUtc = deliveredAtUtc ?? DateTime.UtcNow;
    }

    public void MarkRead(DateTime? readAtUtc = null)
    {
        Status = MessageRequestStatus.Read;
        ReadAtUtc = readAtUtc ?? DateTime.UtcNow;
    }

    public void MarkFailed(string error, bool isPermanent, TimeSpan? retryBackoff = null)
    {
        AttemptCount++;
        LastError = error;
        ReleaseLease();

        if (isPermanent || AttemptCount >= 5)
        {
            Status = MessageRequestStatus.Failed;
            NextAttemptAtUtc = null;
        }
        else
        {
            Status = MessageRequestStatus.Queued;
            NextAttemptAtUtc = DateTime.UtcNow.Add(retryBackoff ?? TimeSpan.FromSeconds(Math.Pow(2, AttemptCount) * 5));
        }
    }

    public void Suppress(string reason)
    {
        Status = MessageRequestStatus.Suppressed;
        LastError = reason;
        ReleaseLease();
    }

    public void Expire()
    {
        Status = MessageRequestStatus.Expired;
        LastError = "Tempo limite de expiração da mensagem atingido.";
        ReleaseLease();
    }
}

public class InAppNotification : BaseEntity, ITenantScoped, IBranchScoped
{
    public Guid TenantId { get; set; }
    public Guid BranchId { get; set; }
    public Guid TargetUserId { get; private set; }
    public string Category { get; private set; } = string.Empty; // ex: "CRM_MATCH", "REPAIR_READY", "SYSTEM_ALERT"
    public string Title { get; private set; } = string.Empty;
    public string Description { get; private set; } = string.Empty;
    public string? ActionUrl { get; private set; }
    public bool IsRead { get; private set; } = false;
    public DateTime CreatedAtUtc { get; private set; }
    public DateTime? ReadAtUtc { get; private set; }

    protected InAppNotification() { }

    public InAppNotification(
        Guid tenantId,
        Guid branchId,
        Guid targetUserId,
        string category,
        string title,
        string description,
        string? actionUrl = null)
    {
        TenantId = tenantId;
        BranchId = branchId;
        TargetUserId = targetUserId;
        Category = string.IsNullOrWhiteSpace(category) ? "GERAL" : category.Trim();
        Title = string.IsNullOrWhiteSpace(title) ? throw new ArgumentException("Título da notificação obrigatório.") : title.Trim();
        Description = string.IsNullOrWhiteSpace(description) ? string.Empty : description.Trim();
        ActionUrl = actionUrl?.Trim();
        IsRead = false;
        CreatedAtUtc = DateTime.UtcNow;
    }

    public void MarkAsRead()
    {
        IsRead = true;
        ReadAtUtc = DateTime.UtcNow;
    }
}

public class MessagingWebhookEvent : BaseEntity, ITenantScoped
{
    public Guid TenantId { get; set; }
    public string Provider { get; private set; } = "WhatsApp";
    public string EventId { get; private set; } = string.Empty;
    public string EventType { get; private set; } = string.Empty;
    public string RawPayloadJson { get; private set; } = string.Empty;
    public bool IsProcessed { get; private set; } = false;
    public DateTime ReceivedAtUtc { get; private set; }
    public DateTime? ProcessedAtUtc { get; private set; }
    public string? ProcessingError { get; private set; }

    protected MessagingWebhookEvent() { }

    public MessagingWebhookEvent(Guid tenantId, string provider, string eventId, string eventType, string rawPayloadJson)
    {
        TenantId = tenantId;
        Provider = provider;
        EventId = eventId;
        EventType = eventType;
        RawPayloadJson = rawPayloadJson;
        IsProcessed = false;
        ReceivedAtUtc = DateTime.UtcNow;
    }

    public void MarkProcessed()
    {
        IsProcessed = true;
        ProcessedAtUtc = DateTime.UtcNow;
    }

    public void MarkFailed(string error)
    {
        ProcessingError = error;
    }
}

public class CustomerConversation : BaseEntity, ITenantScoped, IBranchScoped
{
    public Guid TenantId { get; set; }
    public Guid BranchId { get; set; }
    public Guid? PartyId { get; private set; }
    public string CustomerPhoneNumber { get; private set; } = string.Empty;
    public string CustomerName { get; private set; } = string.Empty;
    public DateTime? LastCustomerMessageAtUtc { get; private set; }
    public bool IsActiveSession24h => LastCustomerMessageAtUtc.HasValue && DateTime.UtcNow <= LastCustomerMessageAtUtc.Value.AddHours(24);
    public string Status { get; private set; } = "Open"; // Open, Closed, Transferred
    public Guid? AssignedAgentUserId { get; private set; }
    public DateTime CreatedAtUtc { get; private set; }

    private readonly List<ConversationMessage> _messages = new();
    public IReadOnlyCollection<ConversationMessage> Messages => _messages.AsReadOnly();

    protected CustomerConversation() { }

    public CustomerConversation(Guid tenantId, Guid branchId, Guid? partyId, string customerPhoneNumber, string customerName)
    {
        TenantId = tenantId;
        BranchId = branchId;
        PartyId = partyId;
        CustomerPhoneNumber = customerPhoneNumber.Trim();
        CustomerName = customerName.Trim();
        CreatedAtUtc = DateTime.UtcNow;
    }

    public void RecordInboundMessage(string text, string providerMessageId)
    {
        LastCustomerMessageAtUtc = DateTime.UtcNow;
        _messages.Add(new ConversationMessage(TenantId, Id, true, text, providerMessageId));
    }

    public void RecordOutboundMessage(string text, string? providerMessageId)
    {
        _messages.Add(new ConversationMessage(TenantId, Id, false, text, providerMessageId));
    }

    public void Close() => Status = "Closed";
}

public class ConversationMessage : BaseEntity, ITenantScoped
{
    public Guid TenantId { get; set; }
    public Guid ConversationId { get; private set; }
    public bool IsInbound { get; private set; }
    public string Content { get; private set; } = string.Empty;
    public string? ProviderMessageId { get; private set; }
    public DateTime SentAtUtc { get; private set; }

    protected ConversationMessage() { }

    public ConversationMessage(Guid tenantId, Guid conversationId, bool isInbound, string content, string? providerMessageId)
    {
        TenantId = tenantId;
        ConversationId = conversationId;
        IsInbound = isInbound;
        Content = content;
        ProviderMessageId = providerMessageId;
        SentAtUtc = DateTime.UtcNow;
    }
}
