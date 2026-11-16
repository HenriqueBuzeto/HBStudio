using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Messaging.Application.Contracts;
using Messaging.Domain.Entities;

namespace Messaging.Infrastructure.Providers;

public class MetaWhatsAppCloudApiProvider : IMessageProvider
{
    private readonly HttpClient _httpClient;

    public MetaWhatsAppCloudApiProvider(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    public MessagingChannel Channel => MessagingChannel.WhatsApp;

    public async Task<ProviderSendResult> SendTemplateAsync(
        MessagingChannelAccount account,
        MessageTemplate template,
        string recipient,
        Dictionary<string, string> variables,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(account.PhoneNumberId) || string.IsNullOrWhiteSpace(account.EncryptedAccessToken))
        {
            return new ProviderSendResult(false, null, "Credenciais da WhatsApp Cloud API não configuradas.", IsPermanentFailure: true);
        }

        var cleanPhone = new string(recipient.Where(char.IsDigit).ToArray());

        var url = $"https://graph.facebook.com/{account.GraphApiVersion}/{account.PhoneNumberId}/messages";
        using var req = new HttpRequestMessage(HttpMethod.Post, url);
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", account.EncryptedAccessToken);

        var payload = new
        {
            messaging_product = "whatsapp",
            recipient_type = "individual",
            to = cleanPhone,
            type = "template",
            template = new
            {
                name = template.ExternalTemplateName,
                language = new { code = template.Language }
            }
        };

        req.Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

        try
        {
            var res = await _httpClient.SendAsync(req, ct);
            var content = await res.Content.ReadAsStringAsync(ct);

            if (!res.IsSuccessStatusCode)
            {
                var isPerm = (int)res.StatusCode is 400 or 401 or 403;
                return new ProviderSendResult(false, null, $"Meta Graph API error {(int)res.StatusCode}: {content}", IsPermanentFailure: isPerm);
            }

            using var doc = JsonDocument.Parse(content);
            var msgId = doc.RootElement.GetProperty("messages")[0].GetProperty("id").GetString();
            return new ProviderSendResult(true, msgId);
        }
        catch (Exception ex)
        {
            return new ProviderSendResult(false, null, $"Falha de conexão com a Meta: {ex.Message}", IsPermanentFailure: false);
        }
    }

    public async Task<ProviderSendResult> SendSessionMessageAsync(
        MessagingChannelAccount account,
        string recipient,
        string text,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(account.PhoneNumberId) || string.IsNullOrWhiteSpace(account.EncryptedAccessToken))
        {
            return new ProviderSendResult(false, null, "Credenciais não configuradas.", IsPermanentFailure: true);
        }

        var cleanPhone = new string(recipient.Where(char.IsDigit).ToArray());
        var url = $"https://graph.facebook.com/{account.GraphApiVersion}/{account.PhoneNumberId}/messages";
        using var req = new HttpRequestMessage(HttpMethod.Post, url);
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", account.EncryptedAccessToken);

        var payload = new
        {
            messaging_product = "whatsapp",
            recipient_type = "individual",
            to = cleanPhone,
            type = "text",
            text = new { preview_url = false, body = text }
        };

        req.Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

        try
        {
            var res = await _httpClient.SendAsync(req, ct);
            var content = await res.Content.ReadAsStringAsync(ct);

            if (!res.IsSuccessStatusCode)
            {
                var isPerm = (int)res.StatusCode is 400 or 401 or 403;
                return new ProviderSendResult(false, null, $"Meta error {(int)res.StatusCode}: {content}", IsPermanentFailure: isPerm);
            }

            using var doc = JsonDocument.Parse(content);
            var msgId = doc.RootElement.GetProperty("messages")[0].GetProperty("id").GetString();
            return new ProviderSendResult(true, msgId);
        }
        catch (Exception ex)
        {
            return new ProviderSendResult(false, null, $"Falha de rede Meta: {ex.Message}", IsPermanentFailure: false);
        }
    }

    public bool ValidateWebhookSignature(string payload, string signatureHeader, string appSecret)
    {
        if (string.IsNullOrWhiteSpace(signatureHeader) || !signatureHeader.StartsWith("sha256=", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        var expectedHashHex = signatureHeader["sha256=".Length..].Trim();
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(appSecret));
        var computedHash = hmac.ComputeHash(Encoding.UTF8.GetBytes(payload));
        var computedHashHex = Convert.ToHexString(computedHash).ToLowerInvariant();

        // Comparação em tempo constante para mitigar timing attack
        return CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(expectedHashHex.ToLowerInvariant()),
            Encoding.UTF8.GetBytes(computedHashHex)
        );
    }
}
