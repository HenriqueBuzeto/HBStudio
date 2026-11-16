using Messaging.Domain.Entities;

namespace Messaging.Domain.Services;

public interface ICommunicationEligibilityService
{
    Task<EligibilityResult> EvaluateEligibilityAsync(
        Guid tenantId,
        Guid? partyId,
        string recipient,
        MessagingChannel channel,
        MessagePurpose purpose,
        CancellationToken ct = default);
}

public record EligibilityResult(
    bool IsEligible,
    string? RejectionReason = null,
    bool RequiresApprovedTemplate = true
);
