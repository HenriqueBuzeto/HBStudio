using System.Text.Json;
using BuildingBlocks.Application;
using Messaging.Application.Contracts;
using Messaging.Application.DTOs;
using Messaging.Domain.Entities;
using Messaging.Domain.Services;
using Microsoft.EntityFrameworkCore;
using Parties.Domain;

namespace Messaging.Application.Services;

public class CommunicationEligibilityService : ICommunicationEligibilityService
{
    private readonly DbContext _dbContext;

    public CommunicationEligibilityService(DbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<EligibilityResult> EvaluateEligibilityAsync(
        Guid tenantId,
        Guid? partyId,
        string recipient,
        MessagingChannel channel,
        MessagePurpose purpose,
        CancellationToken ct = default)
    {
        // 1. Destinatário obrigatório
        if (string.IsNullOrWhiteSpace(recipient))
        {
            return new EligibilityResult(false, "Destinatário não informado.");
        }

        // 2. Se for canal InApp (notificação interna do ERP para usuário da loja)
        if (channel == MessagingChannel.InApp)
        {
            return new EligibilityResult(true, RequiresApprovedTemplate: false);
        }

        // 3. Validação canônica de consentimento no PartyConsentRecord (MOD-01)
        if (partyId.HasValue)
        {
            var consents = await _dbContext.Set<PartyConsentRecord>()
                .Where(c => c.TenantId == tenantId && c.PartyId == partyId.Value)
                .OrderByDescending(c => c.EventDateUtc)
                .ToListAsync(ct);

            var channelName = channel.ToString().ToUpperInvariant();

            // Verificar se houve Opt-Out / Revogação explícita
            var revoked = consents.FirstOrDefault(c => 
                c.Channel.ToUpperInvariant() == channelName && 
                !c.IsOptIn &&
                (c.Purpose.Equals("Marketing", StringComparison.OrdinalIgnoreCase) || 
                 c.Purpose.Equals("All", StringComparison.OrdinalIgnoreCase)));

            if (revoked != null)
            {
                // Se a finalidade for estritamente Marketing ou Comercial, bloqueia
                if (purpose is MessagePurpose.Marketing or MessagePurpose.CommercialAlert)
                {
                    return new EligibilityResult(false, $"Envio suprimido: Destinatário revogou consentimento para {channelName} em {revoked.EventDateUtc:dd/MM/yyyy}.");
                }
            }

            // Para Marketing estrito, exige Opt-In prévio
            if (purpose == MessagePurpose.Marketing)
            {
                var optIn = consents.FirstOrDefault(c => 
                    c.Channel.ToUpperInvariant() == channelName && 
                    c.IsOptIn && 
                    c.Purpose.Equals("Marketing", StringComparison.OrdinalIgnoreCase));

                if (optIn == null)
                {
                    return new EligibilityResult(false, "Mensagem promocional bloqueada: Consentimento prévio de Marketing não localizado no cadastro.");
                }
            }
        }
        else if (purpose == MessagePurpose.Marketing)
        {
            // Mensagem de marketing para número avulso sem cadastro nem opt-in é PROIBIDA
            return new EligibilityResult(false, "Proibido envio de Marketing para contato não associado a cliente com opt-in auditado.");
        }

        // 4. Validação da janela de 24h para WhatsApp
        var cleanPhone = new string(recipient.Where(char.IsDigit).ToArray());
        var conversation = await _dbContext.Set<CustomerConversation>()
            .FirstOrDefaultAsync(c => c.TenantId == tenantId && c.CustomerPhoneNumber == cleanPhone, ct);

        var isWithin24hWindow = conversation?.IsActiveSession24h ?? false;

        // Se está dentro da janela de 24h de conversa iniciada pelo cliente, permite mensagem livre
        // Fora da janela de 24h, OBRIGA o uso de Template aprovado pela Meta
        return new EligibilityResult(true, RequiresApprovedTemplate: !isWithin24hWindow);
    }
}
