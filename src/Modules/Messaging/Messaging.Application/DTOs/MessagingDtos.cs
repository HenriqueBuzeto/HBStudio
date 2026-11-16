using Messaging.Domain.Entities;

namespace Messaging.Application.DTOs;

public record MessagingChannelAccountResponse(
    Guid Id,
    Guid TenantId,
    Guid BranchId,
    MessagingChannel Channel,
    string AccountName,
    string? SenderPhoneNumber,
    string? PhoneNumberId,
    string? WabaId,
    ProviderConnectionStatus Status,
    DateTime? LastVerifiedAtUtc,
    string? LastError,
    bool IsActive,
    DateTime CreatedAtUtc
);

public record CreateChannelAccountRequest(
    MessagingChannel Channel,
    string AccountName,
    string? SenderPhoneNumber,
    string? PhoneNumberId,
    string? WabaId,
    string? AccessToken,
    string? AppSecret,
    string? VerifyToken,
    string? GraphApiVersion
);

public record MessageTemplateResponse(
    Guid Id,
    Guid TenantId,
    string Name,
    string ExternalTemplateName,
    MessagingChannel Channel,
    TemplateCategory Category,
    string Language,
    string Content,
    TemplateStatus Status,
    MessagePurpose Purpose,
    DateTime CreatedAtUtc
);

public record CreateMessageTemplateRequest(
    string Name,
    string ExternalTemplateName,
    MessagingChannel Channel,
    TemplateCategory Category,
    string Language,
    string Content,
    MessagePurpose Purpose
);

public record MessageRequestResponse(
    Guid Id,
    Guid TenantId,
    Guid BranchId,
    MessagingChannel Channel,
    string Recipient,
    Guid? PartyId,
    MessagePurpose Purpose,
    string SourceType,
    Guid? SourceId,
    Guid? TemplateId,
    string TextBody,
    MessageRequestStatus Status,
    string? ProviderMessageId,
    int AttemptCount,
    string? LastError,
    DateTime ScheduledAtUtc,
    DateTime CreatedAtUtc,
    DateTime? DeliveredAtUtc,
    DateTime? ReadAtUtc
);

public record EnqueueMessageRequest(
    MessagingChannel Channel,
    string Recipient,
    Guid? PartyId,
    MessagePurpose Purpose,
    string SourceType,
    Guid? SourceId,
    Guid? TemplateId,
    Dictionary<string, string>? TemplateVariables,
    string? TextBody,
    string? IdempotencyKey
);

public record InAppNotificationResponse(
    Guid Id,
    Guid TargetUserId,
    string Category,
    string Title,
    string Description,
    string? ActionUrl,
    bool IsRead,
    DateTime CreatedAtUtc
);

public record MessagingDashboardMetricsResponse(
    int TotalProcessed,
    int TotalDelivered,
    int TotalFailed,
    int TotalPendingQueue,
    int UnreadNotificationsCount,
    int ActiveConversationsCount,
    ProviderConnectionStatus WhatsAppStatus
);
