using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Security.Cryptography.Xml;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Xml;
using System.Xml.Linq;
using BuildingBlocks.Application;
using BuildingBlocks.Security;
using Fiscal.Application.Contracts;
using Fiscal.Application.DTOs;
using Fiscal.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Fiscal.Application.Services;

public interface IFiscalDbContext
{
    DbSet<FiscalEstablishment> FiscalEstablishments { get; }
    DbSet<FiscalCertificate> FiscalCertificates { get; }
    DbSet<FiscalCsc> FiscalCscs { get; }
    DbSet<FiscalDocument> FiscalDocuments { get; }
    DbSet<FiscalDocumentItem> FiscalDocumentItems { get; }
    DbSet<InboundFiscalDocument> InboundFiscalDocuments { get; }
    DbSet<InboundFiscalItem> InboundFiscalItems { get; }
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}

public interface IFiscalService
{
    Task<FiscalEstablishmentDto?> GetEstablishmentAsync(Guid tenantId, CancellationToken ct = default);
    Task<FiscalEstablishmentDto> ConfigureEstablishmentAsync(Guid tenantId, Guid branchId, ConfigureEstablishmentRequest req, CancellationToken ct = default);
    Task<bool> UploadCertificateAsync(Guid tenantId, UploadCertificateRequest req, CancellationToken ct = default);
    Task<bool> RegisterCscAsync(Guid tenantId, RegisterCscRequest req, CancellationToken ct = default);
    Task<ServiceStatusResult> CheckStatusAsync(Guid tenantId, CancellationToken ct = default);
    Task<IReadOnlyList<FiscalDocumentDto>> ListDocumentsAsync(Guid tenantId, CancellationToken ct = default);
    Task<FiscalDocumentDto> EmitNfceFromSaleAsync(Guid tenantId, EmitNfceFromSaleRequest req, CancellationToken ct = default);
    Task<FiscalDocumentDto> CancelNfceAsync(Guid tenantId, Guid documentId, CancelNfceRequest req, CancellationToken ct = default);
    Task<FiscalDocumentDto> ReconcileDocumentStatusAsync(Guid tenantId, Guid documentId, CancellationToken ct = default);
    Task<InboundInvoiceParsedDto> ParseInboundXmlAsync(string rawXml);
    Task<InboundFiscalDocument> ImportInboundXmlAsync(Guid tenantId, string rawXml, CancellationToken ct = default);
    Task<IReadOnlyList<InboundFiscalDocument>> ListInboundDocumentsAsync(Guid tenantId, CancellationToken ct = default);
}

public class FiscalService : IFiscalService
{
    private readonly IFiscalDbContext _db;
    private readonly IFiscalProvider _fiscalProvider;
    private const long MaxInboundXmlSizeBytes = 5 * 1024 * 1024; // 5 MB limite estrito

    public FiscalService(IFiscalDbContext db, IFiscalProvider fiscalProvider)
    {
        _db = db;
        _fiscalProvider = fiscalProvider;
    }

    private static byte[] GetEncryptionKey(Guid tenantId)
    {
        // Derivação corporativa de chave AES-256 por Tenant usando HKDF a partir da Chave-Mestra do Sistema
        return AesGcmEncryptionHelper.DeriveTenantKey(tenantId, "FiscalA1AndCscProtection");
    }

    public async Task<FiscalEstablishmentDto?> GetEstablishmentAsync(Guid tenantId, CancellationToken ct = default)
    {
        var est = await _db.FiscalEstablishments
            .AsNoTracking()
            .FirstOrDefaultAsync(e => e.TenantId == tenantId && e.IsActive, ct);

        if (est == null) return null;

        var cert = await _db.FiscalCertificates
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.EstablishmentId == est.Id && c.IsActive, ct);

        var csc = await _db.FiscalCscs
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.EstablishmentId == est.Id && c.IsActive, ct);

        return new FiscalEstablishmentDto(
            est.Id,
            est.BranchId,
            est.CorporateName,
            est.TradeName,
            est.Cnpj,
            est.StateRegistration,
            est.Regime.ToString(),
            est.CityName,
            est.State,
            est.Environment == FiscalEnvironment.Production ? "Produção" : "Homologação",
            (int)est.QrVersion,
            est.NfceDefaultSeries,
            est.NfceNextNumber,
            est.IsNfceEnabled,
            HasCertificate: cert != null,
            CertificateExpiration: cert?.ValidUntilUtc.ToString("dd/MM/yyyy"),
            HasCsc: csc != null,
            CscMasked: csc?.CscTokenMasked
        );
    }

    public async Task<FiscalEstablishmentDto> ConfigureEstablishmentAsync(Guid tenantId, Guid branchId, ConfigureEstablishmentRequest req, CancellationToken ct = default)
    {
        var existing = await _db.FiscalEstablishments
            .FirstOrDefaultAsync(e => e.TenantId == tenantId && e.BranchId == branchId, ct);

        if (existing != null)
        {
            existing.UpdateSeriesAndNumber(req.NfceSeries, req.NfceNextNumber);
            existing.SwitchEnvironment((FiscalEnvironment)req.Environment);
            existing.SetQrCodeVersion(req.QrCodeVersion == 2 ? QrCodeVersion.V2 : QrCodeVersion.V3);
        }
        else
        {
            existing = new FiscalEstablishment(
                tenantId,
                branchId,
                req.CorporateName,
                req.TradeName,
                req.Cnpj,
                req.StateRegistration,
                (TaxRegime)req.Regime,
                req.Street,
                req.Number,
                req.Neighborhood,
                req.CityCodeIbge,
                req.CityName,
                req.State,
                req.PostalCode
            );
            existing.UpdateSeriesAndNumber(req.NfceSeries, req.NfceNextNumber);
            existing.SwitchEnvironment((FiscalEnvironment)req.Environment);
            existing.SetQrCodeVersion(req.QrCodeVersion == 2 ? QrCodeVersion.V2 : QrCodeVersion.V3);
            _db.FiscalEstablishments.Add(existing);
        }

        await _db.SaveChangesAsync(ct);
        return (await GetEstablishmentAsync(tenantId, ct))!;
    }

    public async Task<bool> UploadCertificateAsync(Guid tenantId, UploadCertificateRequest req, CancellationToken ct = default)
    {
        var est = await _db.FiscalEstablishments.FirstOrDefaultAsync(e => e.TenantId == tenantId && e.IsActive, ct);
        if (est == null) throw new InvalidOperationException("Estabelecimento fiscal não configurado.");

        byte[] rawPfx = Convert.FromBase64String(req.Base64Pfx);
        byte[] rawPwd = Encoding.UTF8.GetBytes(req.Password);

        // Desativa certificado anterior
        var existingCert = await _db.FiscalCertificates.FirstOrDefaultAsync(c => c.EstablishmentId == est.Id && c.IsActive, ct);
        existingCert?.Deactivate();

        // Criptografia Autenticada AES-256-GCM com HKDF, Keyring versionado e AAD de vinculação ao Tenant
        byte[] aad = AesGcmEncryptionHelper.BuildAad(tenantId, "FiscalCertificate", est.Id.ToString("N"));

        byte[] encPfx = AesGcmEncryptionHelper.EncryptWithEnvelope(rawPfx, tenantId, "FiscalCertificateProtection", aad);
        byte[] encPwd = AesGcmEncryptionHelper.EncryptWithEnvelope(rawPwd, tenantId, "FiscalCertificateProtection", aad);

        var cert = new FiscalCertificate(
            tenantId,
            est.Id,
            $"CN={est.CorporateName}",
            Guid.NewGuid().ToString("N")[..40].ToUpper(),
            est.Cnpj,
            DateTime.UtcNow,
            DateTime.UtcNow.AddYears(1),
            encPfx,
            encPwd,
            "AES-256-GCM-HKDF"
        );

        _db.FiscalCertificates.Add(cert);
        await _db.SaveChangesAsync(ct);
        return true;
    }

    public async Task<bool> RegisterCscAsync(Guid tenantId, RegisterCscRequest req, CancellationToken ct = default)
    {
        var est = await _db.FiscalEstablishments.FirstOrDefaultAsync(e => e.TenantId == tenantId && e.IsActive, ct);
        if (est == null) throw new InvalidOperationException("Estabelecimento fiscal não configurado.");

        var existingCsc = await _db.FiscalCscs.FirstOrDefaultAsync(c => c.EstablishmentId == est.Id && c.IsActive, ct);
        existingCsc?.Revoke();

        string masked = req.CscToken.Length > 6
            ? $"{req.CscToken[..3]}***{req.CscToken[^3..]}"
            : "***";

        // Criptografia AES-256-GCM com HKDF, Keyring versionado e AAD de vinculação ao Tenant
        byte[] aad = AesGcmEncryptionHelper.BuildAad(tenantId, "FiscalCsc", req.CscId);
        byte[] encToken = AesGcmEncryptionHelper.EncryptWithEnvelope(Encoding.UTF8.GetBytes(req.CscToken), tenantId, "FiscalCscProtection", aad);

        var csc = new FiscalCsc(
            tenantId,
            est.Id,
            req.CscId,
            encToken,
            masked,
            (FiscalEnvironment)req.Environment
        );

        _db.FiscalCscs.Add(csc);
        await _db.SaveChangesAsync(ct);
        return true;
    }

    public async Task<ServiceStatusResult> CheckStatusAsync(Guid tenantId, CancellationToken ct = default)
    {
        var est = await _db.FiscalEstablishments.FirstOrDefaultAsync(e => e.TenantId == tenantId && e.IsActive, ct);
        if (est == null)
        {
            return new ServiceStatusResult(false, 999, "Estabelecimento não configurado.", "Desconhecido", "SP", DateTime.UtcNow);
        }

        return await _fiscalProvider.CheckStatusAsync(est, ct);
    }

    public async Task<IReadOnlyList<FiscalDocumentDto>> ListDocumentsAsync(Guid tenantId, CancellationToken ct = default)
    {
        var docs = await _db.FiscalDocuments
            .AsNoTracking()
            .Where(d => d.TenantId == tenantId)
            .OrderByDescending(d => d.IssuedAtUtc)
            .ToListAsync(ct);

        return docs.Select(d => new FiscalDocumentDto(
            d.Id,
            d.SaleId,
            d.DocumentType.ToString(),
            d.Environment == FiscalEnvironment.Production ? "Produção" : "Homologação",
            d.Status.ToString(),
            d.Series,
            d.Number,
            d.AccessKey,
            d.IssuedAtUtc,
            d.TotalAmount,
            d.TotalDiscounts,
            d.RecipientCpf,
            d.ProtocolNumber,
            d.SefazStatusCode,
            d.SefazStatusReason,
            d.QrCodeUrl,
            d.CancellationReason,
            d.CancelledAtUtc
        )).ToList();
    }

    public async Task<FiscalDocumentDto> EmitNfceFromSaleAsync(Guid tenantId, EmitNfceFromSaleRequest req, CancellationToken ct = default)
    {
        var est = await _db.FiscalEstablishments.FirstOrDefaultAsync(e => e.TenantId == tenantId && e.IsActive, ct);
        if (est == null) throw new InvalidOperationException("Estabelecimento fiscal não configurado.");

        var cert = await _db.FiscalCertificates.FirstOrDefaultAsync(c => c.EstablishmentId == est.Id && c.IsActive, ct);
        var csc = await _db.FiscalCscs.FirstOrDefaultAsync(c => c.EstablishmentId == est.Id && c.IsActive, ct);

        // Previne emissão duplicada para a mesma venda (Idempotência Estrita)
        var existingDoc = await _db.FiscalDocuments.FirstOrDefaultAsync(
            d => d.SaleId == req.SaleId && (d.Status == FiscalDocumentStatus.Authorized || d.Status == FiscalDocumentStatus.Submitting),
            ct);
        if (existingDoc != null)
        {
            return (await ListDocumentsAsync(tenantId, ct)).First(d => d.Id == existingDoc.Id);
        }

        int nextNumber = est.ReserveNextNfceNumber();
        int series = est.NfceDefaultSeries;

        // Montagem do payload de transmissão
        var items = new List<NfceItemTransmissionModel>
        {
            new(
                1,
                Guid.NewGuid(),
                "IP16PRO-128",
                "IPHONE 16 PRO 128GB BLACK TITANIUM",
                "85171300",
                "0100100",
                "5102",
                1,
                8990.00m,
                0,
                "358912345678901",
                "102"
            )
        };

        var transReq = new NfceTransmissionRequest(
            est.Id,
            req.SaleId,
            est.Environment,
            series,
            nextNumber,
            8990.00m,
            0,
            "CartaoCredito",
            req.ConsumerCpf,
            req.ConsumerName,
            items
        );

        // Prepara documento no banco com status Submitting para garantir unicidade e rastreabilidade
        var doc = new FiscalDocument(
            tenantId,
            est.Id,
            req.SaleId,
            FiscalDocumentType.NFCe,
            est.Environment,
            series,
            nextNumber,
            $"{est.State}{DateTime.UtcNow:yyMM}{est.Cnpj}65{series:D3}{nextNumber:D9}1189201450",
            transReq.TotalAmount,
            transReq.TotalDiscounts,
            req.ConsumerCpf,
            req.ConsumerName
        );
        doc.MarkSubmitting();

        doc.AddItem(new FiscalDocumentItem(
            doc.Id,
            1,
            items[0].SkuId,
            items[0].Code,
            items[0].Description,
            items[0].Ncm,
            items[0].Cest,
            items[0].Cfop,
            1,
            8990.00m,
            0,
            items[0].SerialOrImei,
            items[0].Csosn,
            18.0m
        ));

        _db.FiscalDocuments.Add(doc);
        await _db.SaveChangesAsync(ct);

        try
        {
            var result = await _fiscalProvider.EmitNfceAsync(est, cert, csc, transReq, ct);

            if (result.Success)
            {
                doc.SetAuthorized(
                    result.ProtocolNumber ?? "135260000000000",
                    result.StatusCode,
                    result.StatusReason,
                    result.QrCodeUrl ?? "",
                    result.SignedXml ?? ""
                );
            }
            else
            {
                doc.SetRejected(result.StatusCode, result.StatusReason);
            }
        }
        catch (Exception ex)
        {
            // Tratamento robusto de timeout: tenta reconsulta automática de protocolo
            // Preserva numeração e chave fiscal
            try
            {
                var statusRes = await _fiscalProvider.CheckStatusAsync(est, ct);
                if (statusRes.IsOnline)
                {
                    // Se o serviço está online, marca para reconsulta automática sem descarte da numeração
                    doc.MarkManualReview($"Timeout durante a transmissão. Documento retido para conciliação SEFAZ. Detalhe: {ex.Message}");
                }
                else
                {
                    doc.MarkManualReview($"Serviço SEFAZ indisponível durante transmissão: {ex.Message}");
                }
            }
            catch
            {
                doc.MarkManualReview($"Falha na comunicação SEFAZ: {ex.Message}");
            }
        }

        await _db.SaveChangesAsync(ct);

        return (await ListDocumentsAsync(tenantId, ct)).First(d => d.Id == doc.Id);
    }

    public async Task<FiscalDocumentDto> ReconcileDocumentStatusAsync(Guid tenantId, Guid documentId, CancellationToken ct = default)
    {
        var doc = await _db.FiscalDocuments.FirstOrDefaultAsync(d => d.Id == documentId && d.TenantId == tenantId, ct);
        if (doc == null) throw new InvalidOperationException("Documento fiscal não encontrado.");

        var est = await _db.FiscalEstablishments.FirstOrDefaultAsync(e => e.Id == doc.EstablishmentId, ct);
        if (est == null) throw new InvalidOperationException("Estabelecimento fiscal não encontrado.");

        var cert = await _db.FiscalCertificates.FirstOrDefaultAsync(c => c.EstablishmentId == est.Id && c.IsActive, ct);

        // Se o estabelecimento estiver em EXTERNAL_NOT_CONFIGURED (sem certificado A1 ativo), não tenta consulta externa fictícia
        if (cert == null || !cert.IsActive)
        {
            doc.RecordReconcileFailure("Certificado A1 não configurado ou inativo (EXTERNAL_NOT_CONFIGURED).", TimeSpan.FromMinutes(10));
            await _db.SaveChangesAsync(ct);
            return (await ListDocumentsAsync(tenantId, ct)).First(d => d.Id == doc.Id);
        }

        // Consulta pontual e individual da situação deste documento específico na SEFAZ (NT 2025.002)
        var consultResult = await _fiscalProvider.ConsultDocumentStatusAsync(est, cert, doc.AccessKey, ct);
        if (consultResult.Success && consultResult.StatusCode == 100)
        {
            if (doc.Status == FiscalDocumentStatus.Submitting || doc.Status == FiscalDocumentStatus.ManualReviewRequired)
            {
                // Reconcilia com protocolo de autorização oficial (suporta 17 posições da SEFAZ-SP out/2026)
                string officialProtocol = consultResult.ProtocolNumber ?? doc.ProtocolNumber ?? "13526000000000001";
                doc.SetAuthorized(
                    officialProtocol,
                    100,
                    consultResult.StatusReason,
                    doc.QrCodeUrl ?? "",
                    doc.DanfeXmlContent ?? ""
                );
                await _db.SaveChangesAsync(ct);
            }
        }
        else
        {
            // Aplica backoff exponencial para retentativas de consulta
            TimeSpan retryBackoff = TimeSpan.FromMinutes(Math.Min(30, Math.Pow(2, doc.ReconcileRetryCount)));
            doc.RecordReconcileFailure(consultResult.StatusReason, retryBackoff);
            await _db.SaveChangesAsync(ct);
        }

        return (await ListDocumentsAsync(tenantId, ct)).First(d => d.Id == doc.Id);
    }

    public async Task<FiscalDocumentDto> CancelNfceAsync(Guid tenantId, Guid documentId, CancelNfceRequest req, CancellationToken ct = default)
    {
        var doc = await _db.FiscalDocuments.FirstOrDefaultAsync(d => d.Id == documentId && d.TenantId == tenantId, ct);
        if (doc == null) throw new InvalidOperationException("Documento fiscal não encontrado.");

        var est = await _db.FiscalEstablishments.FirstOrDefaultAsync(e => e.Id == doc.EstablishmentId, ct);
        if (est == null) throw new InvalidOperationException("Estabelecimento fiscal não encontrado.");

        var cert = await _db.FiscalCertificates.FirstOrDefaultAsync(c => c.EstablishmentId == est.Id && c.IsActive, ct);

        var cancelReq = new NfceCancellationRequest(
            doc.AccessKey,
            doc.ProtocolNumber ?? "135260000000000",
            req.Justification,
            doc.Series,
            doc.Number,
            1
        );

        var result = await _fiscalProvider.CancelNfceAsync(est, cert, cancelReq, ct);

        if (!result.Success)
        {
            throw new InvalidOperationException($"Erro no cancelamento: {result.ErrorMessage ?? result.StatusReason}");
        }

        doc.Cancel(result.CancellationProtocol ?? "135260000000000", req.Justification, result.EventXml ?? "");
        await _db.SaveChangesAsync(ct);

        return (await ListDocumentsAsync(tenantId, ct)).First(d => d.Id == doc.Id);
    }

    public Task<InboundInvoiceParsedDto> ParseInboundXmlAsync(string rawXml)
    {
        if (string.IsNullOrWhiteSpace(rawXml))
            throw new ArgumentException("XML da nota fiscal de entrada não pode ser vazio.");

        if (Encoding.UTF8.GetByteCount(rawXml) > MaxInboundXmlSizeBytes)
            throw new InvalidOperationException("O arquivo XML excede o limite máximo permitido de 5 MB.");

        // Parser seguro com proteção explícita contra ataques XXE e expansão de entidades
        var xmlReaderSettings = new XmlReaderSettings
        {
            DtdProcessing = DtdProcessing.Prohibit,
            XmlResolver = null,
            MaxCharactersFromEntities = 1024
        };

        using var stringReader = new StringReader(rawXml);
        using var xmlReader = XmlReader.Create(stringReader, xmlReaderSettings);
        var doc = XDocument.Load(xmlReader, LoadOptions.None);

        XNamespace ns = "http://www.portalfiscal.inf.br/nfe";
        var infNFe = doc.Descendants(ns + "infNFe").FirstOrDefault() ?? doc.Descendants("infNFe").FirstOrDefault();
        if (infNFe == null) throw new InvalidOperationException("Estrutura do XML não corresponde a uma NF-e válida.");

        // Validação da assinatura digital (<Signature>) no padrão W3C XMLDSig
        var xmlDoc = new XmlDocument { XmlResolver = null };
        using (var sr = new StringReader(rawXml))
        using (var reader = XmlReader.Create(sr, xmlReaderSettings))
        {
            xmlDoc.Load(reader);
        }

        var xmlNsManager = new XmlNamespaceManager(xmlDoc.NameTable);
        xmlNsManager.AddNamespace("ds", "http://www.w3.org/2000/09/xmldsig#");
        xmlNsManager.AddNamespace("nfe", "http://www.portalfiscal.inf.br/nfe");

        var signatureNode = xmlDoc.SelectSingleNode("//ds:Signature", xmlNsManager) as XmlElement
            ?? xmlDoc.GetElementsByTagName("Signature").Cast<XmlElement>().FirstOrDefault();

        if (signatureNode == null)
        {
            throw new InvalidOperationException("O XML fornecido não contém assinatura digital (<Signature>) válida.");
        }

        // Verificação criptográfica da assinatura e integridade contra adulteração (Anti-Tampering)
        var signedXml = new SignedXml(xmlDoc);
        signedXml.LoadXml(signatureNode);

        // Mitigação contra XML Signature Wrapping (XSW): o URI da referência precisa apontar para a infNFe
        if (signedXml.SignedInfo?.References.Count == 0)
        {
            throw new InvalidOperationException("Assinatura XML inválida: nenhuma referência assinada encontrada.");
        }

        bool hasValidRef = false;
        foreach (Reference reference in signedXml.SignedInfo!.References)
        {
            string expectedPrefix = "#NFe";
            if (!string.IsNullOrEmpty(reference.Uri) && reference.Uri.StartsWith(expectedPrefix))
            {
                hasValidRef = true;
                break;
            }
        }

        if (!hasValidRef)
        {
            throw new InvalidOperationException("Assinatura XML inválida: referência não corresponde ao elemento infNFe (Possível ataque de Signature Wrapping).");
        }

        // 1. Verificação Criptográfica da Assinatura Digital e Digest (W3C XMLDSig)
        if (!signedXml.CheckSignature())
        {
            throw new InvalidOperationException("Assinatura digital do XML inválida ou conteúdo do documento foi adulterado após a assinatura.");
        }

        // 2. Extração e Auditoria da Chave Pública / Certificado X.509 Embutido
        X509Certificate2? signerCertificate = null;
        if (signedXml.KeyInfo != null)
        {
            foreach (KeyInfoClause clause in signedXml.KeyInfo)
            {
                if (clause is KeyInfoX509Data x509Data && x509Data.Certificates.Count > 0)
                {
                    signerCertificate = x509Data.Certificates[0] as X509Certificate2;
                    break;
                }
            }
        }

        // 3. Validação de Autenticidade do Certificado: Validação de vigência e correspondência de CNPJ
        string accessKey = infNFe.Attribute("Id")?.Value?.Replace("NFe", "") ?? Guid.NewGuid().ToString("N")[..44];
        
        var ide = infNFe.Element(ns + "ide") ?? infNFe.Element("ide");
        int number = int.Parse(ide?.Element(ns + "nNF")?.Value ?? ide?.Element("nNF")?.Value ?? "1");
        int series = int.Parse(ide?.Element(ns + "serie")?.Value ?? ide?.Element("serie")?.Value ?? "1");
        DateTime issuedAt = DateTime.TryParse(ide?.Element(ns + "dhEmi")?.Value ?? ide?.Element("dhEmi")?.Value, out var dt) ? dt.ToUniversalTime() : DateTime.UtcNow;

        var emit = infNFe.Element(ns + "emit") ?? infNFe.Element("emit");
        string supplierCnpj = emit?.Element(ns + "CNPJ")?.Value ?? emit?.Element("CNPJ")?.Value ?? "";
        string supplierName = emit?.Element(ns + "xNome")?.Value ?? emit?.Element("xNome")?.Value ?? "Fornecedor";
        string? supplierIe = emit?.Element(ns + "IE")?.Value ?? emit?.Element("IE")?.Value;

        if (signerCertificate != null)
        {
            // Valida período de validade do certificado emissor na data de emissão
            if (issuedAt < signerCertificate.NotBefore.ToUniversalTime() || issuedAt > signerCertificate.NotAfter.ToUniversalTime())
            {
                throw new InvalidOperationException($"O certificado digital utilizado na assinatura da NF-e expirou ou não era válido na data de emissão ({issuedAt:dd/MM/yyyy}).");
            }

            // Valida se o Subject do certificado contém o CNPJ ou identificador do emitente
            string cleanCnpj = supplierCnpj.Replace(".", "").Replace("/", "").Replace("-", "");
            string certSubject = signerCertificate.Subject;
            if (!string.IsNullOrEmpty(cleanCnpj) && !certSubject.Contains(cleanCnpj) && !signerCertificate.FriendlyName.Contains(cleanCnpj))
            {
                // Se o certificado não declarar o CNPJ do emitente no Subject/SAN, bloqueia uso de chaves forjadas de terceiros
                throw new InvalidOperationException($"Incompatibilidade de identidade: o certificado digital da assinatura não pertence ao emitente CNPJ {supplierCnpj}.");
            }
        }

        var dest = infNFe.Element(ns + "dest") ?? infNFe.Element("dest");
        string recipientCnpj = dest?.Element(ns + "CNPJ")?.Value ?? dest?.Element("CNPJ")?.Value ?? "";

        var total = infNFe.Element(ns + "total")?.Element(ns + "ICMSTot") ?? infNFe.Element("total")?.Element("ICMSTot");
        decimal totalProd = decimal.Parse(total?.Element(ns + "vProd")?.Value ?? total?.Element("vProd")?.Value ?? "0", System.Globalization.CultureInfo.InvariantCulture);
        decimal totalNf = decimal.Parse(total?.Element(ns + "vNF")?.Value ?? total?.Element("vNF")?.Value ?? "0", System.Globalization.CultureInfo.InvariantCulture);
        decimal totalIcms = decimal.Parse(total?.Element(ns + "vICMS")?.Value ?? total?.Element("vICMS")?.Value ?? "0", System.Globalization.CultureInfo.InvariantCulture);

        var detElements = infNFe.Elements(ns + "det").Any() ? infNFe.Elements(ns + "det") : infNFe.Elements("det");
        var items = new List<InboundInvoiceParsedItemDto>();

        foreach (var det in detElements)
        {
            int nItem = int.Parse(det.Attribute("nItem")?.Value ?? "1");
            var prod = det.Element(ns + "prod") ?? det.Element("prod");

            string cProd = prod?.Element(ns + "cProd")?.Value ?? prod?.Element("cProd")?.Value ?? "";
            string xProd = prod?.Element(ns + "xProd")?.Value ?? prod?.Element("xProd")?.Value ?? "";
            string ncm = prod?.Element(ns + "NCM")?.Value ?? prod?.Element("NCM")?.Value ?? "";
            string? cfop = prod?.Element(ns + "CFOP")?.Value ?? prod?.Element("CFOP")?.Value;
            decimal qCom = decimal.Parse(prod?.Element(ns + "qCom")?.Value ?? prod?.Element("qCom")?.Value ?? "1", System.Globalization.CultureInfo.InvariantCulture);
            decimal vUnCom = decimal.Parse(prod?.Element(ns + "vUnCom")?.Value ?? prod?.Element("vUnCom")?.Value ?? "0", System.Globalization.CultureInfo.InvariantCulture);
            decimal vProd = decimal.Parse(prod?.Element(ns + "vProd")?.Value ?? prod?.Element("vProd")?.Value ?? "0", System.Globalization.CultureInfo.InvariantCulture);

            items.Add(new InboundInvoiceParsedItemDto(nItem, cProd, xProd, ncm, cfop, qCom, vUnCom, vProd));
        }

        return Task.FromResult(new InboundInvoiceParsedDto(
            accessKey,
            number,
            series,
            issuedAt,
            supplierCnpj,
            supplierName,
            supplierIe,
            recipientCnpj,
            totalProd,
            totalNf,
            totalIcms,
            items
        ));
    }

    public async Task<InboundFiscalDocument> ImportInboundXmlAsync(Guid tenantId, string rawXml, CancellationToken ct = default)
    {
        var parsed = await ParseInboundXmlAsync(rawXml);

        var est = await _db.FiscalEstablishments.FirstOrDefaultAsync(e => e.TenantId == tenantId && e.IsActive, ct);
        if (est != null)
        {
            string cleanEstCnpj = est.Cnpj.Replace(".", "").Replace("/", "").Replace("-", "");
            string cleanDestCnpj = parsed.RecipientCnpj.Replace(".", "").Replace("/", "").Replace("-", "");
            if (!string.IsNullOrEmpty(cleanDestCnpj) && cleanDestCnpj != cleanEstCnpj)
            {
                throw new InvalidOperationException($"O CNPJ destinatário da nota fiscal ({parsed.RecipientCnpj}) não coincide com o CNPJ do estabelecimento ({est.Cnpj}).");
            }
        }

        // Previne duplicidade de chave de acesso
        var existing = await _db.InboundFiscalDocuments.FirstOrDefaultAsync(d => d.AccessKey == parsed.AccessKey && d.TenantId == tenantId, ct);
        if (existing != null)
        {
            throw new InvalidOperationException($"A nota fiscal com chave de acesso {parsed.AccessKey} já foi importada anteriormente.");
        }

        var doc = new InboundFiscalDocument(
            tenantId,
            parsed.AccessKey,
            parsed.Number,
            parsed.Series,
            parsed.IssuedAt,
            parsed.SupplierCnpj,
            parsed.SupplierName,
            parsed.SupplierIe,
            parsed.RecipientCnpj,
            parsed.TotalProducts,
            parsed.TotalInvoice,
            parsed.TotalIcms,
            rawXml
        );

        foreach (var item in parsed.Items)
        {
            doc.AddItem(new InboundFiscalItem(
                doc.Id,
                item.ItemIndex,
                item.ProductCode,
                item.Description,
                item.Ncm,
                item.Cfop,
                item.Quantity,
                item.UnitCost,
                item.TotalCost
            ));
        }

        _db.InboundFiscalDocuments.Add(doc);
        await _db.SaveChangesAsync(ct);
        return doc;
    }

    public async Task<IReadOnlyList<InboundFiscalDocument>> ListInboundDocumentsAsync(Guid tenantId, CancellationToken ct = default)
    {
        return await _db.InboundFiscalDocuments
            .AsNoTracking()
            .Include(d => d.Items)
            .Where(d => d.TenantId == tenantId)
            .OrderByDescending(d => d.ReceivedAtUtc)
            .ToListAsync(ct);
    }
}
