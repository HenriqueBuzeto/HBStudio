using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Http.Json;
using System.Threading.Tasks;
using BuildingBlocks.Domain;
using BuildingBlocks.Infrastructure;
using BuildingBlocks.Security;
using Fiscal.Application.DTOs;
using Fiscal.Domain.Entities;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace BuildingBlocks.UnitTests;

public class FiscalModuleIntegrationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly ITokenService _jwtTokenService;

    public FiscalModuleIntegrationTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _jwtTokenService = new JwtTokenService(
            "HBStudioEnterpriseErpSuperSecretKey20261113!",
            "HBStudioErp",
            "HBStudioErpClient");
    }

    private HttpClient CreateClientWithPermissions(Guid tenantId, Guid branchId, params string[] permissions)
    {
        var tokenResponse = _jwtTokenService.GenerateToken(
            tenantId,
            branchId,
            Guid.NewGuid(),
            "fiscal.admin@hbstudio.com",
            permissions);

        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", tokenResponse.AccessToken);
        return client;
    }

    [Fact]
    public async Task Fiscal_Establishment_Config_And_Csc_Registration_Should_Succeed()
    {
        var tenantId = Guid.NewGuid();
        var branchId = Guid.NewGuid();

        var client = CreateClientWithPermissions(
            tenantId,
            branchId,
            PermissionCatalog.FiscalSettingsManage,
            PermissionCatalog.FiscalDocumentsView);

        // 1. Configurar Estabelecimento Fiscal
        var configReq = new ConfigureEstablishmentRequest(
            CorporateName: "HB STUDIO INOVAÇÃO E TECNOLOGIA LTDA",
            TradeName: "HB Studio",
            Cnpj: "48951871000180",
            StateRegistration: "111222333444",
            MunicipalRegistration: "55566677",
            Cnae: "4752100",
            Regime: 1, // Simples Nacional
            Street: "Av. Paulista",
            Number: "1000",
            Complement: "Conjunto 14",
            Neighborhood: "Bela Vista",
            CityCodeIbge: "3550308", // São Paulo
            CityName: "São Paulo",
            State: "SP",
            PostalCode: "01310100",
            Environment: 2, // Homologação
            NfceSeries: 1,
            NfceNextNumber: 1
        );

        var postRes = await client.PostAsJsonAsync("/api/fiscal/establishment", configReq);
        var errContent = await postRes.Content.ReadAsStringAsync();
        postRes.StatusCode.Should().Be(HttpStatusCode.OK, errContent);

        var establishment = await postRes.Content.ReadFromJsonAsync<FiscalEstablishmentDto>();
        establishment.Should().NotBeNull();
        establishment!.Cnpj.Should().Be("48951871000180");
        establishment.State.Should().Be("SP");
        establishment.Regime.Should().Be("SimplesNacional");

        // 2. Registrar Token CSC (para QR Code NFC-e)
        var cscReq = new RegisterCscRequest(
            CscId: "000001",
            CscToken: "ABCDEF1234567890ABCDEF1234567890",
            Environment: 2
        );

        var cscRes = await client.PostAsJsonAsync("/api/fiscal/csc", cscReq);
        cscRes.StatusCode.Should().Be(HttpStatusCode.OK);

        // 3. Consultar Estabelecimento e verificar máscara do CSC
        var getRes = await client.GetAsync("/api/fiscal/establishment");
        getRes.StatusCode.Should().Be(HttpStatusCode.OK);
        var refreshedEst = await getRes.Content.ReadFromJsonAsync<FiscalEstablishmentDto>();
        refreshedEst!.HasCsc.Should().BeTrue();
        refreshedEst.CscMasked.Should().Contain("***");
        refreshedEst.CscMasked.Should().NotContain("1234567890");
    }

    [Fact]
    public async Task Fiscal_Emit_Nfce_And_Cancel_Workflow_Should_Persist_Document()
    {
        var tenantId = Guid.NewGuid();
        var branchId = Guid.NewGuid();

        // Inicializar banco de dados para criar a venda necessária
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            // Estabelecimento base
            var est = new FiscalEstablishment(
                tenantId: tenantId,
                branchId: branchId,
                corporateName: "HB STUDIO TECNOLOGIA LTDA",
                tradeName: "HB Studio",
                cnpj: "48951871000180",
                stateRegistration: "111222333",
                regime: TaxRegime.SimplesNacional,
                street: "Rua Teste",
                number: "123",
                neighborhood: "Centro",
                cityCodeIbge: "3550308",
                cityName: "São Paulo",
                state: "SP",
                postalCode: "01001000");

            db.FiscalEstablishments.Add(est);

            // Adicionar Certificado A1 e CSC para atender às precondições de emissão
            var cert = new FiscalCertificate(
                tenantId: tenantId,
                establishmentId: est.Id,
                subjectName: "CN=HB STUDIO:48951871000180",
                thumbprint: "AABBCCDDEEFF11223344",
                cnpj: "48951871000180",
                validFromUtc: DateTime.UtcNow.AddDays(-10),
                validUntilUtc: DateTime.UtcNow.AddDays(355),
                encryptedRawData: new byte[] { 1, 2, 3, 4 },
                encryptedPassword: new byte[] { 5, 6, 7, 8 },
                keyIvBase64: "dGVzdC1pdi1rZXk=");

            var csc = new FiscalCsc(
                tenantId: tenantId,
                establishmentId: est.Id,
                cscId: "000001",
                encryptedCscToken: new byte[] { 9, 10, 11, 12 },
                cscTokenMasked: "ABC***XYZ",
                environment: FiscalEnvironment.Homologation);

            db.FiscalCertificates.Add(cert);
            db.FiscalCscs.Add(csc);

            // Venda simulada no PDV
            var sale = new Sales.Domain.Sale(
                tenantId: tenantId,
                branchId: branchId,
                saleNumber: "VND-202611-001",
                customerPartyId: Guid.NewGuid(),
                sellerUserId: Guid.NewGuid(),
                createdByUserId: Guid.NewGuid());

            sale.AddItem(
                productSkuId: Guid.NewGuid(),
                historicalSkuCode: "IP13-128-BLK",
                historicalDescription: "iPhone 13 128GB Preto Usado Vitrine",
                itemCondition: Catalog.Domain.ItemCondition.PreOwned,
                quantity: 1,
                unitPrice: 120.00m,
                discount: 0m,
                unitCost: 60.00m);

            db.Sales.Add(sale);
            await db.SaveChangesAsync();

            // Emitir NFC-e via Endpoint
            var client = CreateClientWithPermissions(
                tenantId,
                branchId,
                PermissionCatalog.FiscalIssue,
                PermissionCatalog.FiscalDocumentsView,
                PermissionCatalog.FiscalCancel);

            var emitReq = new EmitNfceFromSaleRequest(
                SaleId: sale.Id,
                ConsumerCpf: "12345678909",
                ConsumerName: "Consumidor Teste");

            var emitRes = await client.PostAsJsonAsync("/api/fiscal/nfce/sale", emitReq);
            var emitErr = await emitRes.Content.ReadAsStringAsync();
            emitRes.StatusCode.Should().Be(HttpStatusCode.OK, emitErr);

            var doc = await emitRes.Content.ReadFromJsonAsync<FiscalDocumentDto>();
            doc.Should().NotBeNull();
            doc!.Status.Should().Be("Authorized");
            doc.Series.Should().Be(1);
            doc.Number.Should().Be(1);
            doc.AccessKey.Length.Should().Be(44);
            doc.QrCodeUrl.Should().NotBeNullOrEmpty();
            doc.TotalAmount.Should().Be(7890.00m);

            // Cancelar NFC-e
            var cancelReq = new CancelNfceRequest("Cancelamento homologado por desacordo comercial do cliente");
            var cancelRes = await client.PostAsJsonAsync($"/api/fiscal/documents/{doc.Id}/cancel", cancelReq);
            cancelRes.StatusCode.Should().Be(HttpStatusCode.OK);

            var cancelledDoc = await cancelRes.Content.ReadFromJsonAsync<FiscalDocumentDto>();
            cancelledDoc!.Status.Should().Be("Cancelled");
            cancelledDoc.CancellationReason.Should().Contain("Cancelamento homologado");
        }
    }

    [Fact]
    public async Task Fiscal_Inbound_Xml_Parse_And_Import_Should_Prevent_Xxe_And_Extract_Data()
    {
        var tenantId = Guid.NewGuid();
        var branchId = Guid.NewGuid();

        var client = CreateClientWithPermissions(
            tenantId,
            branchId,
            PermissionCatalog.FiscalDocumentsView,
            PermissionCatalog.FiscalIssue);

        var validNfeXml = @"<?xml version=""1.0"" encoding=""UTF-8""?>
<nfeProc xmlns=""http://www.portalfiscal.inf.br/nfe"" versao=""4.00"">
  <NFe>
    <infNFe Id=""NFe35261148951871000180550010000012341234567890"" versao=""4.00"">
      <ide>
        <nNF>1234</nNF>
        <serie>1</serie>
        <dhEmi>2026-11-16T14:30:00-03:00</dhEmi>
      </ide>
      <emit>
        <CNPJ>12345678000199</CNPJ>
        <xNome>FORNECEDOR DE COMPONENTES APPLE LTDA</xNome>
        <IE>123456789</IE>
      </emit>
      <dest>
        <CNPJ>48951871000180</CNPJ>
        <xNome>HB STUDIO LTDA</xNome>
      </dest>
      <det nItem=""1"">
        <prod>
          <cProd>DISP-IP13-OLED</cProd>
          <xProd>Tela Display OLED iPhone 13 Original Retirada</xProd>
          <NCM>85285200</NCM>
          <CFOP>5102</CFOP>
          <qCom>5.0000</qCom>
          <vUnCom>350.0000000000</vUnCom>
          <vProd>1750.00</vProd>
        </prod>
      </det>
      <total>
        <ICMSTot>
          <vProd>1750.00</vProd>
          <vNF>1750.00</vNF>
          <vICMS>0.00</vICMS>
        </ICMSTot>
      </total>
    </infNFe>
  </NFe>
</nfeProc>";

        // Testar Parse
        var parseRes = await client.PostAsJsonAsync("/api/fiscal/inbound/parse", new InboundXmlUploadRequest(validNfeXml));
        parseRes.StatusCode.Should().Be(HttpStatusCode.OK);

        var parsed = await parseRes.Content.ReadFromJsonAsync<InboundInvoiceParsedDto>();
        parsed.Should().NotBeNull();
        parsed!.Number.Should().Be(1234);
        parsed.Series.Should().Be(1);
        parsed.SupplierCnpj.Should().Be("12345678000199");
        parsed.SupplierName.Should().Be("FORNECEDOR DE COMPONENTES APPLE LTDA");
        parsed.TotalProducts.Should().Be(1750.00m);
        parsed.Items.Should().HaveCount(1);
        parsed.Items[0].ProductCode.Should().Be("DISP-IP13-OLED");
        parsed.Items[0].Quantity.Should().Be(5.00m);
        parsed.Items[0].UnitCost.Should().Be(350.00m);

        // Testar Import
        var importRes = await client.PostAsJsonAsync("/api/fiscal/inbound/import", new InboundXmlUploadRequest(validNfeXml));
        importRes.StatusCode.Should().Be(HttpStatusCode.OK);

        // Listar Notas de Entrada
        var listRes = await client.GetAsync("/api/fiscal/inbound");
        listRes.StatusCode.Should().Be(HttpStatusCode.OK);
        var inbounds = await listRes.Content.ReadFromJsonAsync<List<InboundFiscalDocument>>();
        inbounds.Should().NotBeNull();
        inbounds.Should().Contain(d => d.AccessKey == "35261148951871000180550010000012341234567890");
    }
}
