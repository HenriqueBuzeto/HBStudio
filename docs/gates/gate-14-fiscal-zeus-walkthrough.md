# Walkthrough — Gate 14 | Motor Fiscal & Emissão de NFC-e (Zeus DFe.NET)

**Status do Gate:** `INTERNAL_VERIFIED` *(Aguardando credenciais fiscais oficiais da SEFAZ-SP para `HOMOLOGATION_VERIFIED`)*  
**Data da Auditoria Sênior:** 16 de Novembro de 2026  
**Responsável Técnico:** Antigravity Senior Architect / HB Studio Dev Team  
**Módulo:** `MOD-14 — Fiscal & Invoicing Engine`  
**Biblioteca Principal:** `Zeus.Net.NFe.NFCe` versão `2026.9.24.1416` (LGPL-2.1)  
**Frameworks:** .NET 10 • ASP.NET Core Minimal APIs • PostgreSQL 18.3 • Next.js 16 (Turbopack)  

---

## 1. Classificação de Prontidão Operacional

| Status | Definição | Situação HB Studio |
| :--- | :--- | :--- |
| **`INTERNAL_VERIFIED`** | Módulo, regras de negócio, criptografia, resiliência, validação de XML e testes automatizados 100% verificados localmente. | **CONCLUÍDO (7/7 testes aprovados)** |
| **`EXTERNAL_NOT_CONFIGURED`** | Pendente de upload do Certificado A1 real (`.pfx`) e credenciamento oficial da SEFAZ-SP pelo contador. | **STATUS ATUAL** |
| **`HOMOLOGATION_VERIFIED`** | Transmissão e autorização real de NFC-e e cancelamento validados no ambiente oficial de Homologação da SEFAZ-SP. | *Aguardando dados oficiais do emitente* |
| **`PRODUCTION_READY`** | Emissão liberada em ambiente de Produção com autorização fiscal regular. | *Etapa subsequente à homologação externa* |

---

## 2. Hardening Sênior Aplicado no Fechamento do Gate 14

### 2.1. QR Code V3 em Contingência para Consumidor Anônimo (`|||`)
- **Norma Técnica:** Manual de Padrões Técnicos do DANFE NFC-e v6.0 (Item 4.4.2, Tabela 7) e NT 2025.001 v1.03.
- **Correção Crítica:** Quando a NFC-e for emitida em contingência offline (`tpEmis = 9`) e o consumidor **não for identificado** (venda anônima de balcão), as posições 6 (`tpIdDest`) e 7 (`idDest`) **permanecem obrigatoriamente vazias, mas os delimitadores de campos são preservados**:
  $$\text{p=chNFe|3|tpAmb|dia|vNF|||assinatura}$$
- **Assinatura RSA-SHA1:** A assinatura digital Base64 é calculada estritamente sobre a sequência canônica dos 7 primeiros parâmetros com os separadores vazios preservados:
  $$\text{dataToSign} = \text{chNFe|3|tpAmb|dia|vNF||}$$
- **Emissão Online (`tpEmis = 1`):** Permanece no formato canônico da NT 2025.001:
  $$\text{p=chNFe|3|tpAmb}$$

### 2.2. Verificação Criptográfica Real XMLDSig (`System.Security.Cryptography.Xml`)
- Substituída a mera checagem da existência da tag `<Signature>`.
- O parser agora emprega `SignedXml(xmlDoc)` com:
  1. Carregamento seguro da assinatura W3C XMLDSig (`http://www.w3.org/2000/09/xmldsig#`).
  2. **Proteção Anti-XML Signature Wrapping (XSW):** Verificação de que a referência do `SignedInfo` aponta exclusivamente para o elemento `#NFe{accessKey}` da nota.
  3. **CheckSignature():** Validação criptográfica do Digest e da chave pública do emissor (`signedXml.CheckSignature()`). Adulterações posteriores no conteúdo da nota fiscal rejeitam a importação com erro explícito de integridade.

### 2.3. Keyring Versionado para Rotação Transparente de Chaves-Mestras
- Implementado em `AesGcmEncryptionHelper`:
  - Envelope de criptografia com formato `[1 byte KeyVersion][12 bytes Nonce][16 bytes Tag][Ciphertext]`.
  - Dicionário thread-safe `MasterKeyRing` com resolução de versão no momento da decriptação.
  - Permite rotação dinâmica de chaves sem perda de acesso aos certificados A1 e tokens CSC cifrados sob versões anteriores.

### 2.4. Worker de Reconciliação Fiscal em Background (`FiscalReconciliationWorker`)
- Registrado como `IHostedService` no ASP.NET Core (`Program.cs`).
- Executa a cada 60 segundos buscando notas em estado `Submitting` ou `ManualReviewRequired` que ultrapassaram 2 minutos de tolerância.
- Executa a conciliação automática com a SEFAZ, preservando a numeração e chave de acesso de 44 dígitos sem gerar duplicidades.

---

## 3. Matriz de Testes Automatizados Executada

Execução completa da suíte de integração e segurança no .NET 10 (`dotnet test`):

```
Iniciando execução de teste...
1 arquivos de teste no total corresponderam ao padrão especificado.

Aprovado!  – Com falha: 0, Aprovado: 7, Ignorado: 0, Total: 7, Duração: 5 s
- Fiscal_Establishment_Config_And_Csc_Registration_Should_Succeed
- AesGcm_Encryption_Hkdf_Aad_And_Tampering_Verification_Should_Work
- AesGcm_Keyring_Versioning_And_Rotation_Should_Allow_Transparent_Decryption
- QrCode_NT2025_001_V3_Online_And_Contingency_With_RsaSha1_Should_Be_Compliant
- Fiscal_Inbound_Xml_Real_XmlDSig_CheckSignature_Should_Validate_Or_Reject
- Fiscal_Inbound_Xml_Should_Validate_Signature_And_Prevent_Tampering
- Fiscal_Authorization_And_Tenant_Isolation_Should_Enforce_403
```

---

## 4. Próximos Passos para Ativação em Homologação Real

1. Upload do Certificado Digital A1 (`.pfx`) pelo painel web (`/fiscal`) ou API.
2. Cadastramento dos dados reais da empresa (CNPJ e Inscrição Estadual de São Paulo).
3. Solicitação de homologação de emissão de NFC-e junto ao SEFAZ-SP.
