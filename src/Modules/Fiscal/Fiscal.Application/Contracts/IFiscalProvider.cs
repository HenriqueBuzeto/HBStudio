using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Fiscal.Domain.Entities;

namespace Fiscal.Application.Contracts;

public record NfceItemTransmissionModel(
    int ItemIndex,
    Guid? SkuId,
    string Code,
    string Description,
    string Ncm,
    string? Cest,
    string Cfop,
    decimal Quantity,
    decimal UnitPrice,
    decimal Discount,
    string? SerialOrImei,
    string Csosn = "102");

public record NfceTransmissionRequest(
    Guid EstablishmentId,
    Guid? SaleId,
    FiscalEnvironment Environment,
    int Series,
    int Number,
    decimal TotalAmount,
    decimal TotalDiscounts,
    string PaymentType, // Dinheiro, CartaoCredito, CartaoDebito, Pix
    string? RecipientCpf,
    string? RecipientName,
    IReadOnlyList<NfceItemTransmissionModel> Items);

public record NfceTransmissionResult(
    bool Success,
    string AccessKey,
    int StatusCode,
    string StatusReason,
    string? ProtocolNumber,
    string? QrCodeUrl,
    string? SignedXml,
    string? ErrorMessage);

public record NfceCancellationRequest(
    string AccessKey,
    string ProtocolNumber,
    string Justification,
    int Series,
    int Number,
    int SequentialEventNumber = 1);

public record NfceCancellationResult(
    bool Success,
    int StatusCode,
    string StatusReason,
    string? CancellationProtocol,
    string? EventXml,
    string? ErrorMessage);

public record ServiceStatusResult(
    bool IsOnline,
    int StatusCode,
    string StatusReason,
    string Environment,
    string Uf,
    DateTime CheckedAtUtc);

public record DocumentStatusConsultationResult(
    bool Success,
    int StatusCode,
    string StatusReason,
    string? ProtocolNumber,
    DateTime? ProtocolReceivedAtUtc,
    string? ProtocolXml);

public interface IFiscalProvider
{
    string ProviderName { get; }
    Task<ServiceStatusResult> CheckStatusAsync(FiscalEstablishment establishment, CancellationToken ct = default);
    Task<DocumentStatusConsultationResult> ConsultDocumentStatusAsync(FiscalEstablishment establishment, FiscalCertificate? certificate, string accessKey, CancellationToken ct = default);
    Task<NfceTransmissionResult> EmitNfceAsync(FiscalEstablishment establishment, FiscalCertificate? certificate, FiscalCsc? csc, NfceTransmissionRequest request, CancellationToken ct = default);
    Task<NfceCancellationResult> CancelNfceAsync(FiscalEstablishment establishment, FiscalCertificate? certificate, NfceCancellationRequest request, CancellationToken ct = default);
}
