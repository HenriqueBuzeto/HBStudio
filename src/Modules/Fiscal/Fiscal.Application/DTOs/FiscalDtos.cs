using System;
using System.Collections.Generic;
using System.IO;
using System.Xml.Linq;
using Fiscal.Domain.Entities;

namespace Fiscal.Application.DTOs;

public record FiscalEstablishmentDto(
    Guid Id,
    Guid BranchId,
    string CorporateName,
    string TradeName,
    string Cnpj,
    string StateRegistration,
    string Regime,
    string CityName,
    string State,
    string Environment,
    int NfceDefaultSeries,
    int NfceNextNumber,
    bool IsNfceEnabled,
    bool HasCertificate,
    string? CertificateExpiration,
    bool HasCsc,
    string? CscMasked);

public record ConfigureEstablishmentRequest(
    string CorporateName,
    string TradeName,
    string Cnpj,
    string StateRegistration,
    string MunicipalRegistration,
    string Cnae,
    int Regime, // 1 = Simples, 3 = Normal
    string Street,
    string Number,
    string? Complement,
    string Neighborhood,
    string CityCodeIbge,
    string CityName,
    string State,
    string PostalCode,
    int Environment, // 1 = Homologação, 2 = Produção
    int NfceSeries,
    int NfceNextNumber);

public record UploadCertificateRequest(
    string Base64Pfx,
    string Password);

public record RegisterCscRequest(
    string CscId,
    string CscToken,
    int Environment);

public record EmitNfceFromSaleRequest(
    Guid SaleId,
    string? ConsumerCpf,
    string? ConsumerName);

public record CancelNfceRequest(
    string Justification);

public record FiscalDocumentDto(
    Guid Id,
    Guid? SaleId,
    string DocumentType,
    string Environment,
    string Status,
    int Series,
    int Number,
    string AccessKey,
    DateTime IssuedAtUtc,
    decimal TotalAmount,
    decimal TotalDiscounts,
    string? RecipientCpf,
    string? ProtocolNumber,
    int? SefazStatusCode,
    string? SefazStatusReason,
    string? QrCodeUrl,
    string? CancellationReason,
    DateTime? CancelledAtUtc);

public record InboundInvoiceParsedItemDto(
    int ItemIndex,
    string ProductCode,
    string Description,
    string Ncm,
    string? Cfop,
    decimal Quantity,
    decimal UnitCost,
    decimal TotalCost);

public record InboundInvoiceParsedDto(
    string AccessKey,
    int Number,
    int Series,
    DateTime IssuedAt,
    string SupplierCnpj,
    string SupplierName,
    string? SupplierIe,
    string RecipientCnpj,
    decimal TotalProducts,
    decimal TotalInvoice,
    decimal TotalIcms,
    IReadOnlyList<InboundInvoiceParsedItemDto> Items);

public record InboundXmlUploadRequest(string RawXml);
