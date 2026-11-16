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
    public void AesGcm_Encryption_Hkdf_Aad_And_Tampering_Verification_Should_Work()
    {
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();

        // 1. Chaves derivadas via HKDF a partir da Chave-Mestra do Sistema
        byte[] keyA = AesGcmEncryptionHelper.DeriveTenantKey(tenantA);
        byte[] keyB = AesGcmEncryptionHelper.DeriveTenantKey(tenantB);

        // Chaves de tenants distintos nunca devem coincidir
        keyA.Should().NotEqual(keyB);

        byte[] originalData = Encoding.UTF8.GetBytes("CertificadoA1PrivateKeyAndSecret1234");
        byte[] aadA = AesGcmEncryptionHelper.BuildAad(tenantA, "FiscalCertificate", "Cert01");

        // 2. Criptografa vinculando ao Tenant A via AAD
        byte[] encrypted = AesGcmEncryptionHelper.Encrypt(originalData, keyA, aadA);
        encrypted.Length.Should().Be(12 + 16 + originalData.Length);

        // 3. Descriptografa com chave e AAD corretos
        byte[] decrypted = AesGcmEncryptionHelper.Decrypt(encrypted, keyA, aadA);
        Encoding.UTF8.GetString(decrypted).Should().Be("CertificadoA1PrivateKeyAndSecret1234");

        // 4. Tentativa de descriptografar com a chave do Tenant B (Isolamento Multi-tenant)
        var actTenantMismatch = () => AesGcmEncryptionHelper.Decrypt(encrypted, keyB, aadA);
        actTenantMismatch.Should().Throw<CryptographicException>();

        // 5. Tentativa de usar AAD de outro Tenant (AAD Tampering)
        byte[] aadB = AesGcmEncryptionHelper.BuildAad(tenantB, "FiscalCertificate", "Cert01");
        var actAadMismatch = () => AesGcmEncryptionHelper.Decrypt(encrypted, keyA, aadB);
        actAadMismatch.Should().Throw<CryptographicException>();

        // 6. Teste de Adulteração de Bits no Ciphertext
        byte[] tampered = (byte[])encrypted.Clone();
        tampered[^1] ^= 0xFF;
        var actTampered = () => AesGcmEncryptionHelper.Decrypt(tampered, keyA, aadA);
        actTampered.Should().Throw<CryptographicException>();
    }

    [Fact]
    public void QrCode_NT2025_001_V3_Online_And_Contingency_With_RsaSha1_Should_Be_Compliant()
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
        est.SetQrCodeVersion(QrCodeVersion.V3);

        string accessKey = "35261148951871000180650010000000011189201450";

        // Cenário 1: QR Code V3 Online (tpEmis = 1) -> estritamente p=chNFe|3|tpAmb
        string v3OnlineUrl = provider.GenerateQrCodeUrl(est, accessKey, 8990.00m, "12345678909", null, tpEmis: 1);
        v3OnlineUrl.Should().EndWith($"?p={accessKey}|3|1");

        // Cenário 2: QR Code V3 Contingência Offline (tpEmis = 9) com Destinatário Identificado
        using var rsaKey = RSA.Create(2048);
        string v3ContingencyWithDest = provider.GenerateQrCodeUrl(
            est, accessKey, 8990.00m, "12345678909", null, tpEmis: 9, rsaPrivateKey: rsaKey);

        v3ContingencyWithDest.Should().Contain($"?p={accessKey}|3|1|");
        v3ContingencyWithDest.Should().Contain("|8990.00|1|12345678909|"); // tpIdDest=1 (CPF)

        // Cenário 3: QR Code V3 Contingência Offline (tpEmis = 9) SEM Destinatário Identificado (Consumidor Anônimo)
        // Regra NT 2025.001: Suprime parâmetros de destinatário sem gerar separadores vazios duplicados (||)
        string v3ContingencyNoDest = provider.GenerateQrCodeUrl(
            est, accessKey, 150.00m, null, null, tpEmis: 9, rsaPrivateKey: rsaKey);

        v3ContingencyNoDest.Should().NotContain("||");
        string dia = DateTime.UtcNow.ToString("dd");
        v3ContingencyNoDest.Should().Contain($"?p={accessKey}|3|1|{dia}|150.00|");
    }

    [Fact]
    public async Task Fiscal_Inbound_Xml_Should_Validate_Signature_And_Prevent_Tampering()
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

        // XML sem a tag de assinatura digital <Signature>
        var xmlWithoutSignature = @"<?xml version=""1.0"" encoding=""UTF-8""?>
<nfeProc xmlns=""http://www.portalfiscal.inf.br/nfe"" versao=""4.00"">
  <NFe>
    <infNFe Id=""NFe35261148951871000180550010000012341234567890"" versao=""4.00"">
      <ide><nNF>1234</nNF><serie>1</serie><dhEmi>2026-11-16T14:30:00-03:00</dhEmi></ide>
      <emit><CNPJ>12345678000199</CNPJ><xNome>FORNECEDOR VALIDO</xNome></emit>
      <dest><CNPJ>48951871000180</CNPJ><xNome>HB STUDIO</xNome></dest>
      <det nItem=""1""><prod><cProd>1</cProd><xProd>PROD</xProd><NCM>85285200</NCM><qCom>1</qCom><vUnCom>100</vUnCom><vProd>100</vProd></prod></det>
      <total><ICMSTot><vProd>100</vProd><vNF>100</vNF><vICMS>0</vICMS></ICMSTot></total>
    </infNFe>
  </NFe>
</nfeProc>";

        var res = await client.PostAsJsonAsync("/api/fiscal/inbound/import", new InboundXmlUploadRequest(xmlWithoutSignature));
        res.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var err = await res.Content.ReadAsStringAsync();
        err.Should().Contain("não contém assinatura digital");
    }

    [Fact]
    public async Task Fiscal_Authorization_And_Tenant_Isolation_Should_Enforce_403()
    {
        var tenantId = Guid.NewGuid();
        var branchId = Guid.NewGuid();

        // Cliente autenticado mas SEM a permissão fiscal.issue
        var clientNoPermission = CreateClientWithPermissions(
            tenantId,
            branchId,
            PermissionCatalog.FiscalDocumentsView);

        var emitReq = new EmitNfceFromSaleRequest(
            SaleId: Guid.NewGuid(),
            ConsumerCpf: "12345678909",
            ConsumerName: "Consumidor Teste");

        var emitRes = await clientNoPermission.PostAsJsonAsync("/api/fiscal/nfce/sale", emitReq);
        emitRes.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }
}
