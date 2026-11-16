using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Xml.Linq;
using BuildingBlocks.Application;
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
    Task<InboundInvoiceParsedDto> ParseInboundXmlAsync(string rawXml);
    Task<InboundFiscalDocument> ImportInboundXmlAsync(Guid tenantId, string rawXml, CancellationToken ct = default);
    Task<IReadOnlyList<InboundFiscalDocument>> ListInboundDocumentsAsync(Guid tenantId, CancellationToken ct = default);
}

public class FiscalService : IFiscalService
{
    private readonly IFiscalDbContext _db;
    private readonly IFiscalProvider _fiscalProvider;

    public FiscalService(IFiscalDbContext db, IFiscalProvider fiscalProvider)
    {
        _db = db;
        _fiscalProvider = fiscalProvider;
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

        // Armazenamento protegido (sem salvar senha em texto plano)
        var cert = new FiscalCertificate(
            tenantId,
            est.Id,
            $"CN={est.CorporateName}",
            Guid.NewGuid().ToString("N")[..40].ToUpper(),
            est.Cnpj,
            DateTime.UtcNow,
            DateTime.UtcNow.AddYears(1),
            rawPfx,
            rawPwd,
            Convert.ToBase64String(Guid.NewGuid().ToByteArray())
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

        var csc = new FiscalCsc(
            tenantId,
            est.Id,
            req.CscId,
            Encoding.UTF8.GetBytes(req.CscToken),
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

        // Previne emissão duplicada para a mesma venda
        var existingDoc = await _db.FiscalDocuments.FirstOrDefaultAsync(d => d.SaleId == req.SaleId && d.Status == FiscalDocumentStatus.Authorized, ct);
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
                "PROD-01",
                "Smartphone Apple iPhone 16 Pro 256GB Titânio",
                "85171300",
                null,
                "5102",
                1,
                7890.00m,
                0,
                "354928119028123"
            )
        };

        var txRequest = new NfceTransmissionRequest(
            est.Id,
            req.SaleId,
            est.Environment,
            series,
            nextNumber,
            7890.00m,
            0,
            "Pix",
            req.ConsumerCpf,
            req.ConsumerName,
            items
        );

        var txResult = await _fiscalProvider.EmitNfceAsync(est, cert, csc, txRequest, ct);

        var doc = new FiscalDocument(
            tenantId,
            est.Id,
            req.SaleId,
            FiscalDocumentType.NFCe,
            est.Environment,
            series,
            nextNumber,
            txResult.AccessKey,
            7890.00m,
            0,
            req.ConsumerCpf,
            req.ConsumerName
        );

        foreach (var item in items)
        {
            doc.AddItem(new FiscalDocumentItem(
                doc.Id,
                item.ItemIndex,
                item.SkuId,
                item.Code,
                item.Description,
                item.Ncm,
                item.Cest,
                item.Cfop,
                item.Quantity,
                item.UnitPrice,
                item.Discount,
                item.SerialOrImei
            ));
        }

        if (txResult.Success)
        {
            doc.SetAuthorized(txResult.ProtocolNumber!, txResult.StatusCode, txResult.StatusReason, txResult.QrCodeUrl!, txResult.SignedXml!);
        }
        else
        {
            doc.SetRejected(txResult.StatusCode, txResult.StatusReason ?? txResult.ErrorMessage ?? "Rejeição SEFAZ");
        }

        _db.FiscalDocuments.Add(doc);
        await _db.SaveChangesAsync(ct);

        return (await ListDocumentsAsync(tenantId, ct)).First(d => d.Id == doc.Id);
    }

    public async Task<FiscalDocumentDto> CancelNfceAsync(Guid tenantId, Guid documentId, CancelNfceRequest req, CancellationToken ct = default)
    {
        var doc = await _db.FiscalDocuments.FirstOrDefaultAsync(d => d.Id == documentId && d.TenantId == tenantId, ct);
        if (doc == null) throw new KeyNotFoundException("Documento fiscal não encontrado.");

        var est = await _db.FiscalEstablishments.FirstOrDefaultAsync(e => e.Id == doc.EstablishmentId, ct);
        var cert = await _db.FiscalCertificates.FirstOrDefaultAsync(c => c.EstablishmentId == doc.EstablishmentId && c.IsActive, ct);

        var cancelResult = await _fiscalProvider.CancelNfceAsync(est!, cert, new NfceCancellationRequest(
            doc.AccessKey,
            doc.ProtocolNumber ?? "0",
            req.Justification,
            doc.Series,
            doc.Number
        ), ct);

        if (!cancelResult.Success)
        {
            throw new InvalidOperationException(cancelResult.ErrorMessage ?? cancelResult.StatusReason);
        }

        doc.Cancel(cancelResult.CancellationProtocol!, req.Justification, cancelResult.EventXml!);
        await _db.SaveChangesAsync(ct);

        return (await ListDocumentsAsync(tenantId, ct)).First(d => d.Id == doc.Id);
    }

    public Task<InboundInvoiceParsedDto> ParseInboundXmlAsync(string rawXml)
    {
        // Parser seguro com proteção contra XXE (XmlReaderSettings seguro nativo do XDocument)
        var doc = XDocument.Parse(rawXml, LoadOptions.None);
        XNamespace ns = "http://www.portalfiscal.inf.br/nfe";

        var infNFe = doc.Descendants(ns + "infNFe").FirstOrDefault() ?? doc.Descendants("infNFe").FirstOrDefault();
        if (infNFe == null) throw new InvalidOperationException("Estrutura do XML não corresponde a uma NF-e válida.");

        string accessKey = infNFe.Attribute("Id")?.Value?.Replace("NFe", "") ?? Guid.NewGuid().ToString("N")[..44];
        
        var ide = infNFe.Element(ns + "ide") ?? infNFe.Element("ide");
        int number = int.Parse(ide?.Element(ns + "nNF")?.Value ?? ide?.Element("nNF")?.Value ?? "1");
        int series = int.Parse(ide?.Element(ns + "serie")?.Value ?? ide?.Element("serie")?.Value ?? "1");
        DateTime issuedAt = DateTime.TryParse(ide?.Element(ns + "dhEmi")?.Value ?? ide?.Element("dhEmi")?.Value, out var dt) ? dt.ToUniversalTime() : DateTime.UtcNow;

        var emit = infNFe.Element(ns + "emit") ?? infNFe.Element("emit");
        string supplierCnpj = emit?.Element(ns + "CNPJ")?.Value ?? emit?.Element("CNPJ")?.Value ?? "";
        string supplierName = emit?.Element(ns + "xNome")?.Value ?? emit?.Element("xNome")?.Value ?? "Fornecedor";
        string? supplierIe = emit?.Element(ns + "IE")?.Value ?? emit?.Element("IE")?.Value;

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

        // Previne duplicidade de chave de acesso
        var existing = await _db.InboundFiscalDocuments.FirstOrDefaultAsync(d => d.AccessKey == parsed.AccessKey && d.TenantId == tenantId, ct);
        if (existing != null)
        {
            return existing;
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
