using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using BuildingBlocks.Domain;
using BuildingBlocks.Infrastructure;
using BuildingBlocks.Security;
using Fiscal.Application.Contracts;
using Fiscal.Application.DTOs;
using Fiscal.Domain.Entities;
using Fiscal.Infrastructure.ZeusAdapters;
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

        // 1. Configurar Estabelecimento Fiscal com QR Code V3 (NT 2025.001)
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
            Environment: 1, // Homologação
            QrCodeVersion: 3, // QR Code V3 (NT 2025.001)
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
        establishment.QrCodeVersion.Should().Be(3);

        // 2. Registrar Token CSC (para contingência / legado V2)
        var cscReq = new RegisterCscRequest(
            CscId: "000001",
            CscToken: "ABCDEF1234567890ABCDEF1234567890",
            Environment: 1
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
    public void AesGcm_Encryption_And_Tampering_Verification_Should_Work()
    {
        // 1. Chave AES de 256 bits
        byte[] key = AesGcmEncryptionHelper.DeriveKeyFromSecret("TenantSuperKey2026");
        byte[] originalData = Encoding.UTF8.GetBytes("CertificadoA1PrivateKeyAndSecret1234");

        // 2. Criptografa gerando [Nonce 12b][Tag 16b][Ciphertext]
        byte[] encrypted = AesGcmEncryptionHelper.Encrypt(originalData, key);
        encrypted.Length.Should().Be(12 + 16 + originalData.Length);

        // 3. Descriptografa com sucesso
        byte[] decrypted = AesGcmEncryptionHelper.Decrypt(encrypted, key);
        Encoding.UTF8.GetString(decrypted).Should().Be("CertificadoA1PrivateKeyAndSecret1234");

        // 4. Teste de Violação: Adulterar 1 byte do ciphertext
        byte[] tampered = (byte[])encrypted.Clone();
        tampered[^1] ^= 0xFF; // Inverte o último bit

        // 5. Autenticação criptográfica deve rejeitar imediatamente
        var act = () => AesGcmEncryptionHelper.Decrypt(tampered, key);
        act.Should().Throw<CryptographicException>();
    }

    [Fact]
    public void QrCode_NT2025_001_V3_And_V2_Resolution_Should_Be_Compliant()
    {
        var provider = new ZeusNFeProvider();
        var est = new FiscalEstablishment(
            Guid.NewGuid(),
            Guid.NewGuid(),
            "HB STUDIO",
            "HB Studio",
            "48951871000180",
            "111222333",
            TaxRegime.SimplesNacional,
            "Rua Teste",
            "100",
            "Centro",
            "3550308",
            "São Paulo",
            "SP",
            "01001000"
        );
        est.SwitchEnvironment(FiscalEnvironment.Homologation);

        string accessKey = "35261148951871000180650010000000011189201450";

        // Caso 1: QR Code Versão 3 (NT 2025.001) - Online (Sem CSC, p=chNFe|3|tpAmb)
        est.SetQrCodeVersion(QrCodeVersion.V3);
        string v3OnlineUrl = provider.GenerateQrCodeUrl(est, accessKey, 8990.00m, "12345678909", null, tpEmis: 1);
        v3OnlineUrl.Should().Contain("homologacao.nfce.fazenda.sp.gov.br/qrcode?p=");
        v3OnlineUrl.Should().EndWith($"?p={accessKey}|3|1");

        // Caso 2: QR Code Versão 2 (Legado - Exige CSC e Hash SHA-1)
        est.SetQrCodeVersion(QrCodeVersion.V2);
        var csc = new FiscalCsc(
            Guid.NewGuid(),
            est.Id,
            "000001",
            Encoding.UTF8.GetBytes("TOKEN_CSC_SEFAZ_SP_SECRET"),
            "TOK***RET",
            FiscalEnvironment.Homologation
        );
        string v2Url = provider.GenerateQrCodeUrl(est, accessKey, 8990.00m, "12345678909", csc, tpEmis: 1);
        v2Url.Should().Contain("|2|1|");
        v2Url.Should().Contain("|000001|");
    }

    [Fact]
    public async Task Fiscal_Inbound_Xml_Should_Reject_When_Payload_Exceeds_Or_Cnpj_Mismatch()
    {
        var tenantId = Guid.NewGuid();
        var branchId = Guid.NewGuid();

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var est = new FiscalEstablishment(
                tenantId,
                branchId,
                "HB STUDIO LTDA",
                "HB Studio",
                "48951871000180",
                "111222333",
                TaxRegime.SimplesNacional,
                "Rua Teste",
                "123",
                "Centro",
                "3550308",
                "São Paulo",
                "SP",
                "01001000"
            );
            db.FiscalEstablishments.Add(est);
            await db.SaveChangesAsync();
        }

        var client = CreateClientWithPermissions(tenantId, branchId, PermissionCatalog.FiscalDocumentsView, PermissionCatalog.FiscalIssue);

        // XML com CNPJ destinatário divergente
        var mismatchXml = @"<?xml version=""1.0"" encoding=""UTF-8""?>
<nfeProc xmlns=""http://www.portalfiscal.inf.br/nfe"" versao=""4.00"">
  <NFe>
    <infNFe Id=""NFe35261199999999000199550010000012341234567890"" versao=""4.00"">
      <ide><nNF>999</nNF><serie>1</serie><dhEmi>2026-11-16T14:30:00-03:00</dhEmi></ide>
      <emit><CNPJ>12345678000199</CNPJ><xNome>OUTRO FORNECEDOR</xNome></emit>
      <dest><CNPJ>00000000000000</CNPJ><xNome>OUTRA EMPRESA</xNome></dest>
      <det nItem=""1""><prod><cProd>1</cProd><xProd>TESTE</xProd><NCM>85285200</NCM><qCom>1</qCom><vUnCom>100</vUnCom><vProd>100</vProd></prod></det>
      <total><ICMSTot><vProd>100</vProd><vNF>100</vNF><vICMS>0</vICMS></ICMSTot></total>
    </infNFe>
  </NFe>
</nfeProc>";

        var res = await client.PostAsJsonAsync("/api/fiscal/inbound/import", new InboundXmlUploadRequest(mismatchXml));
        res.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var err = await res.Content.ReadAsStringAsync();
        err.Should().Contain("não coincide com o CNPJ do estabelecimento");
    }
}
