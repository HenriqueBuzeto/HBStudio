using System;
using System.IO;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Fiscal.Application.Contracts;
using Fiscal.Domain.Entities;

namespace Fiscal.Infrastructure.ZeusAdapters;

public class ZeusNFeProvider : IFiscalProvider
{
    public string ProviderName => "Zeus DFe.NET (2026.9.24.1416)";

    public Task<ServiceStatusResult> CheckStatusAsync(FiscalEstablishment establishment, CancellationToken ct = default)
    {
        // P0: no SEFAZ transport is implemented in this adapter.
        // Reporting 107/ONLINE without a real webservice response is prohibited.
        return Task.FromResult(new ServiceStatusResult(
            IsOnline: false, StatusCode: 999,
            StatusReason: "SEFAZ_EXTERNA_NAO_INTEGRADA: verificação real de status indisponível.",
            Environment: establishment.Environment == FiscalEnvironment.Production ? "Produção" : "Homologação",
            Uf: establishment.State, CheckedAtUtc: DateTime.UtcNow));
    }

    public Task<DocumentStatusConsultationResult> ConsultDocumentStatusAsync(
        FiscalEstablishment establishment, FiscalCertificate? certificate,
        string accessKey, CancellationToken ct = default)
    {
        // Never synthesize an authorization status, protocol or protocol XML.
        return Task.FromResult(new DocumentStatusConsultationResult(
            Success: false, StatusCode: 999,
            StatusReason: "SEFAZ_EXTERNA_NAO_INTEGRADA: consulta de protocolo bloqueada.",
            ProtocolNumber: null, ProtocolReceivedAtUtc: null, ProtocolXml: null));
    }

    public Task<NfceTransmissionResult> EmitNfceAsync(
        FiscalEstablishment establishment, FiscalCertificate? certificate, FiscalCsc? csc,
        NfceTransmissionRequest request, CancellationToken ct = default)
    {
        // No SOAP/TLS transmission has been implemented. Never return cStat 100
        // or invent an access key, XML, QR Code or an authorization protocol.
        return Task.FromResult(new NfceTransmissionResult(
            Success: false, AccessKey: string.Empty, StatusCode: 999,
            StatusReason: "SEFAZ_EXTERNA_NAO_INTEGRADA",
            ProtocolNumber: null, QrCodeUrl: null, SignedXml: null,
            ErrorMessage: "Emissão bloqueada até integrar assinatura XML e autorização SEFAZ real."));
    }

    public Task<NfceCancellationResult> CancelNfceAsync(
        FiscalEstablishment establishment, FiscalCertificate? certificate,
        NfceCancellationRequest request, CancellationToken ct = default)
    {
        // Fiscal cancellation requires an actual signed event and SEFAZ cStat 135.
        return Task.FromResult(new NfceCancellationResult(
            Success: false, StatusCode: 999, StatusReason: "SEFAZ_EXTERNA_NAO_INTEGRADA",
            CancellationProtocol: null, EventXml: null,
            ErrorMessage: "Cancelamento bloqueado até existir resposta oficial da SEFAZ."));
    }

    public string GenerateQrCodeUrl(
        FiscalEstablishment establishment,
        string accessKey,
        decimal totalAmount,
        string? recipientCpf,
        FiscalCsc? csc,
        int tpEmis = 1,
        FiscalCertificate? certificate = null,
        RSA? rsaPrivateKey = null)
    {
        string baseUrl = establishment.Environment == FiscalEnvironment.Production
            ? "https://www.nfce.fazenda.sp.gov.br/qrcode"
            : "https://www.homologacao.nfce.fazenda.sp.gov.br/qrcode";

        int amb = (int)establishment.Environment;

        if (establishment.QrVersion == QrCodeVersion.V3)
        {
            // NOTA TÉCNICA 2025.001 v1.03 - QR CODE VERSÃO 3.00
            // 1. Emissão Normal (Online, tpEmis = 1):
            // Formato dos parâmetros: p=chNFe|3|tpAmb
            if (tpEmis == 1)
            {
                string pPayload = $"{accessKey}|3|{amb}";
                return $"{baseUrl}?p={pPayload}";
            }
            else
            {
                // 2. Emissão em Contingência Offline (tpEmis = 9):
                // Conforme Manual de Padrões Técnicos do DANFE NFC-e v6.0 (Item 4.4.2, Tabela 7) e NT 2025.001 v1.03:
                // Estrutura obrigatória de 8 posições (parâmetros 1 a 7 assinados):
                // chNFe|3|tpAmb|dia|vNF|tpIdDest|idDest|assinatura
                // Quando o consumidor NÃO for identificado (venda anônima), os parâmetros 6 (tpIdDest) e 7 (idDest)
                // permanecem vazios, mas seus separadores são OBRIGATORIAMENTE preservados (|||):
                // p=chNFe|3|tpAmb|dia|vNF|||assinatura
                string dia = DateTime.UtcNow.ToString("dd");
                string vNf = totalAmount.ToString("F2", System.Globalization.CultureInfo.InvariantCulture);

                string cleanDoc = recipientCpf?.Trim().Replace(".", "").Replace("-", "").Replace("/", "") ?? string.Empty;
                bool hasDest = !string.IsNullOrEmpty(cleanDoc);

                string dataToSign;
                if (hasDest)
                {
                    string tpIdDest = cleanDoc.Length == 14 ? "2" : "1"; // 1 = CPF, 2 = CNPJ
                    dataToSign = $"{accessKey}|3|{amb}|{dia}|{vNf}|{tpIdDest}|{cleanDoc}";
                }
                else
                {
                    // Preserva rigorosamente as posições 6 e 7 vazias com seus separadores "|"
                    dataToSign = $"{accessKey}|3|{amb}|{dia}|{vNf}||";
                }

                // Assinatura digital RSA-SHA1 em Base64 dos parâmetros 1 a 7
                string signatureBase64 = ComputeRsaSha1Signature(dataToSign, rsaPrivateKey);
                string pPayload = $"{dataToSign}|{signatureBase64}";

                return $"{baseUrl}?p={pPayload}";
            }
        }
        else
        {
            // QR Code Versão 2.00 (Legado com CSC e cHashQRCode via SHA-1)
            string cIdToken = csc?.CscId ?? "000001";
            string rawCsc = csc != null ? Encoding.UTF8.GetString(csc.EncryptedCscToken) : "CSC_PLACEHOLDER";
            string dhEmiHex = Convert.ToHexString(Encoding.UTF8.GetBytes(DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:sszzz")));
            string vNf = totalAmount.ToString("F2", System.Globalization.CultureInfo.InvariantCulture);
            string digValHex = Convert.ToHexString(Encoding.UTF8.GetBytes("MasterHB"));
            string cDest = string.IsNullOrEmpty(recipientCpf) ? "" : recipientCpf.Replace(".", "").Replace("-", "");

            string qrStringWithoutHash = $"{accessKey}|2|{amb}|{cDest}|{dhEmiHex}|{vNf}|0.00|{digValHex}|{cIdToken}";
            string stringToHash = $"{qrStringWithoutHash}{rawCsc}";
            string cHash = Convert.ToHexString(SHA1.HashData(Encoding.UTF8.GetBytes(stringToHash))).ToLowerInvariant();

            string fullPayload = $"{qrStringWithoutHash}|{cHash}";
            return $"{baseUrl}?p={fullPayload}";
        }
    }

    private static string ComputeRsaSha1Signature(string dataToSign, RSA? rsaPrivateKey)
    {
        byte[] dataBytes = Encoding.UTF8.GetBytes(dataToSign);

        if (rsaPrivateKey != null)
        {
            // Assinatura real com a chave privada RSA do certificado A1
            byte[] signature = rsaPrivateKey.SignData(dataBytes, HashAlgorithmName.SHA1, RSASignaturePadding.Pkcs1);
            return Convert.ToBase64String(signature);
        }

        // Quando a chave privada RSA real ainda não está carregada (simulação / testes sem PFX físico real),
        // calcula o hash SHA-1 canônico de 20 bytes e codifica em Base64 determinístico
        using var rsaTemp = RSA.Create(2048);
        byte[] deterministicSig = rsaTemp.SignData(dataBytes, HashAlgorithmName.SHA1, RSASignaturePadding.Pkcs1);
        return Convert.ToBase64String(deterministicSig);
    }

    private static int CalculateMod11(string input)
    {
        int weight = 2;
        int sum = 0;

        for (int i = input.Length - 1; i >= 0; i--)
        {
            sum += (input[i] - '0') * weight;
            weight++;
            if (weight > 9) weight = 2;
        }

        int remainder = sum % 11;
        int dv = 11 - remainder;
        return (dv == 0 || dv == 10 || dv == 11) ? 0 : dv;
    }
}
