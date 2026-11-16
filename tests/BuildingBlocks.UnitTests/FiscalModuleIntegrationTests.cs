using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Security.Cryptography.Xml;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Xml;
using BuildingBlocks.Domain;
using BuildingBlocks.Infrastructure;
using BuildingBlocks.Security;
using Fiscal.Application.Contracts;
using Fiscal.Application.DTOs;
using Fiscal.Application.Services;
using Fiscal.Domain.Entities;
using Fiscal.Infrastructure.Workers;
using Fiscal.Infrastructure.ZeusAdapters;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
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

        // 2. Registrar Token CSC
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
    public void AesGcm_Keyring_Versioning_And_Rotation_Should_Allow_Transparent_Decryption()
    {
        var tenantId = Guid.NewGuid();
        byte[] originalSecret = Encoding.UTF8.GetBytes("SuperSecretFiscalCertificatePassword2026");
        byte[] aad = AesGcmEncryptionHelper.BuildAad(tenantId, "FiscalCertificate", "Est01");

        // 1. Criptografa na Versão 1 do Keyring
        byte[] envelopeV1 = AesGcmEncryptionHelper.EncryptWithEnvelope(originalSecret, tenantId, "FiscalCertKeyringTest", aad, keyVersion: 1);
        envelopeV1[0].Should().Be(1); // Header com KeyVersion = 1

        // 2. Registra Versão 2 no Keyring (simulando rotação de segredo corporativo)
        AesGcmEncryptionHelper.RegisterMasterKeyVersion(2, "NEW_ROTATED_MASTER_KEY_SECRET_VERSION_2_ENTROPY_2026_9999!");

        // 3. Criptografa novo payload na Versão 2
        byte[] envelopeV2 = AesGcmEncryptionHelper.EncryptWithEnvelope(originalSecret, tenantId, "FiscalCertKeyringTest", aad, keyVersion: 2);
        envelopeV2[0].Should().Be(2);

        // 4. DecryptWithEnvelope deve descriptografar com sucesso ambos os envelopes usando as chaves correspondentes
        byte[] decryptedV1 = AesGcmEncryptionHelper.DecryptWithEnvelope(envelopeV1, tenantId, "FiscalCertKeyringTest", aad);
        Encoding.UTF8.GetString(decryptedV1).Should().Be("SuperSecretFiscalCertificatePassword2026");

        byte[] decryptedV2 = AesGcmEncryptionHelper.DecryptWithEnvelope(envelopeV2, tenantId, "FiscalCertKeyringTest", aad);
        Encoding.UTF8.GetString(decryptedV2).Should().Be("SuperSecretFiscalCertificatePassword2026");

        // 5. Envelope adulterado ou versão inexistente deve falhar
        byte[] invalidVersionEnvelope = (byte[])envelopeV1.Clone();
        invalidVersionEnvelope[0] = 99; // Versão desconhecida
        var actInvalidVersion = () => AesGcmEncryptionHelper.DecryptWithEnvelope(invalidVersionEnvelope, tenantId, "FiscalCertKeyringTest", aad);
        actInvalidVersion.Should().Throw<CryptographicException>()
            .WithMessage("*Versão de chave-mestra '99' não encontrada*");
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
        // Formato: p=chNFe|3|tpAmb|dia|vNF|tpIdDest|idDest|assinatura
        using var rsaKey = RSA.Create(2048);
        string v3ContingencyWithDest = provider.GenerateQrCodeUrl(
            est, accessKey, 8990.00m, "12345678909", null, tpEmis: 9, rsaPrivateKey: rsaKey);

        v3ContingencyWithDest.Should().Contain($"?p={accessKey}|3|1|");
        v3ContingencyWithDest.Should().Contain("|8990.00|1|12345678909|"); // tpIdDest=1 (CPF)

        // Cenário 3: QR Code V3 Contingência Offline (tpEmis = 9) SEM Destinatário Identificado (Consumidor Anônimo)
        // Conforme Manual DANFE NFC-e v6.0 item 4.4.2 Tabela 7 e NT 2025.001 v1.03:
        // As posições 6 (tpIdDest) e 7 (idDest) são OBRIGATORIAMENTE preservadas com delimitadores vazios:
        // Formato Exigido: p=chNFe|3|tpAmb|dia|vNF|||assinatura
        string v3ContingencyNoDest = provider.GenerateQrCodeUrl(
            est, accessKey, 150.00m, null, null, tpEmis: 9, rsaPrivateKey: rsaKey);

        string dia = DateTime.UtcNow.ToString("dd");
        v3ContingencyNoDest.Should().Contain($"?p={accessKey}|3|1|{dia}|150.00|||");

        // Extrai a parte da assinatura e os parâmetros assinados
        string queryPart = v3ContingencyNoDest.Substring(v3ContingencyNoDest.IndexOf("?p=") + 3);
        string[] parts = queryPart.Split('|');
        // Total de 8 partes: [chNFe, 3, tpAmb, dia, vNF, "", "", signature]
        parts.Length.Should().Be(8);
        parts[0].Should().Be(accessKey);
        parts[1].Should().Be("3");
        parts[2].Should().Be("1"); // Homologação
        parts[3].Should().Be(dia);
        parts[4].Should().Be("150.00");
        parts[5].Should().BeEmpty(); // tpIdDest vazio
        parts[6].Should().BeEmpty(); // idDest vazio
        parts[7].Should().NotBeNullOrWhiteSpace(); // Assinatura RSA-SHA1 em Base64
    }

    [Fact]
    public void Fiscal_Inbound_Xml_Real_XmlDSig_CheckSignature_Should_Validate_Or_Reject()
    {
        // 1. Gera par de chaves RSA para teste de assinatura real XMLDSig
        using var rsa = RSA.Create(2048);

        string accessKey = "35261148951871000180550010000012341234567890";
        string xmlToSign = $@"<nfeProc xmlns=""http://www.portalfiscal.inf.br/nfe"" versao=""4.00"">
  <NFe>
    <infNFe Id=""NFe{accessKey}"" versao=""4.00"">
      <ide><nNF>1234</nNF><serie>1</serie><dhEmi>2026-11-16T14:30:00-03:00</dhEmi></ide>
      <emit><CNPJ>12345678000199</CNPJ><xNome>FORNECEDOR INTEGRAL</xNome></emit>
      <dest><CNPJ>48951871000180</CNPJ><xNome>HB STUDIO</xNome></dest>
      <det nItem=""1""><prod><cProd>1</cProd><xProd>IPHONE 16</xProd><NCM>85171300</NCM><qCom>1</qCom><vUnCom>8000</vUnCom><vProd>8000</vProd></prod></det>
      <total><ICMSTot><vProd>8000</vProd><vNF>8000</vNF><vICMS>0</vICMS></ICMSTot></total>
    </infNFe>
  </NFe>
</nfeProc>";

        // 2. Aplica assinatura XMLDSig W3C canônica sobre o elemento infNFe
        var xmlDoc = new XmlDocument { PreserveWhitespace = true };
        xmlDoc.LoadXml(xmlToSign);

        var signedXml = new SignedXml(xmlDoc) { SigningKey = rsa };
        var reference = new Reference { Uri = $"#NFe{accessKey}" };
        reference.AddTransform(new XmlDsigEnvelopedSignatureTransform());
        reference.AddTransform(new XmlDsigC14NTransform());
        signedXml.AddReference(reference);

        var keyInfo = new KeyInfo();
        keyInfo.AddClause(new RSAKeyValue(rsa));
        signedXml.KeyInfo = keyInfo;

        signedXml.ComputeSignature();
        var xmlDigitalSignature = signedXml.GetXml();
        xmlDoc.DocumentElement!.AppendChild(xmlDoc.ImportNode(xmlDigitalSignature, true));

        string validSignedXml = xmlDoc.OuterXml;

        var fiscalService = new FiscalService(null!, new ZeusNFeProvider());

        // 3. Deve analisar e aceitar o XML com assinatura válida
        var parseAct = async () => await fiscalService.ParseInboundXmlAsync(validSignedXml);
        parseAct.Should().NotThrowAsync();

        // 4. Cenário de Ataque / Adulteração: Altera o valor da mercadoria de 8000 para 9999 após assinado
        string tamperedXml = validSignedXml.Replace("<vProd>8000</vProd>", "<vProd>9999</vProd>");
        var parseTamperedAct = async () => await fiscalService.ParseInboundXmlAsync(tamperedXml);
        parseTamperedAct.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*Assinatura digital do XML inválida ou conteúdo do documento foi adulterado*");
    }

    [Fact]
    public void Fiscal_Inbound_Xml_With_Untrusted_Signer_Certificate_Should_Be_Rejected()
    {
        // Cria um certificado autoassinado para emitente com CNPJ diferente (simulando ataque com chave privada forjada de terceiro)
        using var rsa = RSA.Create(2048);
        var certReq = new CertificateRequest("CN=EMPRESA FRAUDULENTA:99999999000199", rsa, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
        using var cert = certReq.CreateSelfSigned(DateTimeOffset.UtcNow.AddDays(-1), DateTimeOffset.UtcNow.AddYears(1));

        string accessKey = "35261148951871000180550010000012341234567890";
        string xmlToSign = $@"<nfeProc xmlns=""http://www.portalfiscal.inf.br/nfe"" versao=""4.00"">
  <NFe>
    <infNFe Id=""NFe{accessKey}"" versao=""4.00"">
      <ide><nNF>1234</nNF><serie>1</serie><dhEmi>2026-11-16T14:30:00-03:00</dhEmi></ide>
      <emit><CNPJ>12345678000199</CNPJ><xNome>FORNECEDOR VALIDO</xNome></emit>
      <dest><CNPJ>48951871000180</CNPJ><xNome>HB STUDIO</xNome></dest>
      <det nItem=""1""><prod><cProd>1</cProd><xProd>IPHONE 16</xProd><NCM>85171300</NCM><qCom>1</qCom><vUnCom>8000</vUnCom><vProd>8000</vProd></prod></det>
      <total><ICMSTot><vProd>8000</vProd><vNF>8000</vNF><vICMS>0</vICMS></ICMSTot></total>
    </infNFe>
  </NFe>
</nfeProc>";

        var xmlDoc = new XmlDocument { PreserveWhitespace = true };
        xmlDoc.LoadXml(xmlToSign);

        var signedXml = new SignedXml(xmlDoc) { SigningKey = cert.GetRSAPrivateKey() };
        var reference = new Reference { Uri = $"#NFe{accessKey}" };
        reference.AddTransform(new XmlDsigEnvelopedSignatureTransform());
        reference.AddTransform(new XmlDsigC14NTransform());
        signedXml.AddReference(reference);

        var keyInfo = new KeyInfo();
        keyInfo.AddClause(new KeyInfoX509Data(cert));
        signedXml.KeyInfo = keyInfo;

        signedXml.ComputeSignature();
        xmlDoc.DocumentElement!.AppendChild(xmlDoc.ImportNode(signedXml.GetXml(), true));

        var fiscalService = new FiscalService(null!, new ZeusNFeProvider());
        var actMismatch = async () => await fiscalService.ParseInboundXmlAsync(xmlDoc.OuterXml);
        actMismatch.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*Incompatibilidade de identidade: o certificado digital da assinatura não pertence ao emitente*");
    }

    [Fact]
    public void Fiscal_Reconcile_Multi_Instance_Lease_Should_Prevent_Concurrent_Duplicate_Processing()
    {
        var tenantId = Guid.NewGuid();
        var estId = Guid.NewGuid();
        var doc = new FiscalDocument(
            tenantId,
            estId,
            Guid.NewGuid(),
            FiscalDocumentType.NFCe,
            FiscalEnvironment.Homologation,
            1,
            1001,
            "35261148951871000180650010000010011189201450",
            450.00m,
            0m);

        doc.MarkSubmitting();

        var worker1Id = Guid.NewGuid();
        var worker2Id = Guid.NewGuid();

        // 1. Worker 1 adquire o lease com sucesso por 60 segundos
        bool worker1Acquired = doc.TryAcquireReconcileLease(worker1Id, TimeSpan.FromSeconds(60));
        worker1Acquired.Should().BeTrue();
        doc.ReconcileClaimWorkerId.Should().Be(worker1Id);
        doc.ReconcileLeaseExpiresAtUtc.Should().BeAfter(DateTime.UtcNow);

        // 2. Worker 2 tenta concorrentemente e DEVE ser recusado (evitando execução duplicada de reconciliação)
        bool worker2Acquired = doc.TryAcquireReconcileLease(worker2Id, TimeSpan.FromSeconds(60));
        worker2Acquired.Should().BeFalse();

        // 3. Worker 1 falha com timeout na SEFAZ e registra backoff de retry
        doc.RecordReconcileFailure("SEFAZ Timeout", TimeSpan.FromMinutes(2));
        doc.ReconcileLeaseExpiresAtUtc.Should().BeNull();
        doc.ReconcileRetryCount.Should().Be(1);
        doc.NextReconcileAttemptAtUtc.Should().BeAfter(DateTime.UtcNow);
    }

    [Fact]
    public void SefazSp_17_Digits_Protocol_Number_Should_Be_Accepted_And_Preserved()
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
            "01001000");

        // Protocolo de 17 posições da SEFAZ-SP (vigente desde 05/10/2026 - NT 2025.002)
        string protocol17 = "13526009812491201";
        protocol17.Length.Should().Be(17);

        var doc = new FiscalDocument(
            est.TenantId,
            est.Id,
            Guid.NewGuid(),
            FiscalDocumentType.NFCe,
            FiscalEnvironment.Production,
            1,
            500,
            "35261148951871000180650010000005001189201450",
            1200.00m,
            0m);

        doc.SetAuthorized(protocol17, 100, "Autorizado o uso da NFC-e", "https://nfce.fazenda.sp.gov.br", "<xml></xml>");

        doc.ProtocolNumber.Should().Be(protocol17);
        doc.ProtocolNumber!.Length.Should().Be(17);
        doc.Status.Should().Be(FiscalDocumentStatus.Authorized);
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
