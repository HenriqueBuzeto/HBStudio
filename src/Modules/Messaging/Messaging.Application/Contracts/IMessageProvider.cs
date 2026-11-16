using Messaging.Domain.Entities;

namespace Messaging.Application.Contracts;

public interface IMessageProvider
{
    MessagingChannel Channel { get; }
    Task<ProviderSendResult> SendTemplateAsync(MessagingChannelAccount account, MessageTemplate template, string recipient, Dictionary<string, string> variables, CancellationToken ct = default);
    Task<ProviderSendResult> SendSessionMessageAsync(MessagingChannelAccount account, string recipient, string text, CancellationToken ct = default);
    bool ValidateWebhookSignature(string payload, string signatureHeader, string appSecret);
}

public record ProviderSendResult(
    bool Success,
    string? ProviderMessageId = null,
    string? ErrorMessage = null,
    bool IsPermanentFailure = false
);
