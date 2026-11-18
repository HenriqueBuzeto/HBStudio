using System;
using System.Threading.Tasks;
using FluentAssertions;
using Fiscal.Application.Contracts;
using Fiscal.Domain.Entities;
using Fiscal.Infrastructure.ZeusAdapters;
using Xunit;

namespace BuildingBlocks.UnitTests;

public class FiscalFailClosedProviderTests
{
    private static FiscalEstablishment Establishment()
    {
        var establishment = new FiscalEstablishment(
            Guid.NewGuid(), Guid.NewGuid(), "Empresa de Teste", "Teste", "11222333000181",
            "111222333444", TaxRegime.SimplesNacional, "Rua Teste", "1",
            "Centro", "3550308", "São Paulo", "SP", "01001000");
        establishment.SwitchEnvironment(FiscalEnvironment.Homologation);
        return establishment;
    }

    [Fact]
    public async Task Status_Without_External_Transport_Does_Not_Claim_Online()
    {
        var result = await new ZeusNFeProvider().CheckStatusAsync(Establishment());
        result.IsOnline.Should().BeFalse();
        result.StatusCode.Should().NotBe(107);
    }

    [Fact]
    public async Task Consultation_Must_Never_Return_Forged_Authorization()
    {
        var result = await new ZeusNFeProvider().ConsultDocumentStatusAsync(
            Establishment(), null, new string('1', 44));
        result.Success.Should().BeFalse();
        result.ProtocolNumber.Should().BeNull();
        result.ProtocolXml.Should().BeNull();
    }

    [Fact]
    public async Task Emission_Without_Real_Sefaz_Gateway_Must_Fail_Closed()
    {
        var est = Establishment();
        var request = new NfceTransmissionRequest(
            est.Id, null, FiscalEnvironment.Homologation, 1, 1,
            100m, 0m, "Pix", null, null,
            Array.Empty<NfceItemTransmissionModel>());
        var result = await new ZeusNFeProvider().EmitNfceAsync(est, null, null, request);
        result.Success.Should().BeFalse();
        result.StatusCode.Should().NotBe(100);
        result.ProtocolNumber.Should().BeNull();
        result.SignedXml.Should().BeNull();
    }

    [Fact]
    public async Task Cancellation_Without_Real_Sefaz_Receipt_Must_Fail_Closed()
    {
        var est = Establishment();
        var request = new NfceCancellationRequest(new string('1', 44), "13526009812491201",
            "Motivo de cancelamento comprovado", 1, 1);
        var result = await new ZeusNFeProvider().CancelNfceAsync(est, null, request);
        result.Success.Should().BeFalse();
        result.StatusCode.Should().NotBe(135);
        result.CancellationProtocol.Should().BeNull();
    }
}
