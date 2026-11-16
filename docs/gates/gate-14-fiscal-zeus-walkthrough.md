# Walkthrough — Gate 14 | Motor Fiscal & Emissão de NFC-e (Zeus DFe.NET)

**Status do Gate:** `INTERNAL_VERIFIED` *(Aguardando credenciais fiscais oficiais da SEFAZ-SP para `HOMOLOGATION_VERIFIED`)*  
**Data:** 16 de Novembro de 2026  
**Responsável Técnico:** Antigravity Senior Architect / HB Studio Dev Team  
**Módulo:** `MOD-14 — Fiscal & Invoicing Engine`  
**Biblioteca Principal:** `Zeus.Net.NFe.NFCe` versão `2026.9.24.1416` (LGPL-2.1)  
**Frameworks:** .NET 10 • ASP.NET Core Minimal APIs • PostgreSQL 18.3 • Next.js 16 (Turbopack)  

---

## 1. Classificação de Prontidão Operacional

| Status | Definição | Situação HB Studio |
| :--- | :--- | :--- |
| **`INTERNAL_VERIFIED`** | Módulo, regras de negócio, criptografia, resiliência, validação de XML e testes automatizados 100% verificados localmente. | **CONCLUÍDO (5/5 testes aprovados)** |
| **`EXTERNAL_NOT_CONFIGURED`** | Pendente de upload do Certificado A1 real (`.pfx`) e credenciamento oficial da SEFAZ-SP pelo contador. | **STATUS ATUAL** |
| **`HOMOLOGATION_VERIFIED`** | Transmissão e autorização real de NFC-e e cancelamento validados no ambiente oficial de Homologação da SEFAZ-SP. | *Aguardando dados oficiais do emitente* |
| **`PRODUCTION_READY`** | Emissão liberada em ambiente de Produção com autorização fiscal regular. | *Etapa subsequente à homologação externa* |

---

## 2. Auditoria Técnica e Hardening Realizado

### 2.1. QR Code NFC-e (Versão 3.00 vs 2.00 — NT 2025.001 v1.03 & Manual v6.0)
- **Emissão Online (`tpEmis = 1`):** Formato estrito `p=chNFe|3|tpAmb`, eliminando a necessidade de token CSC e hash SHA-1 na transmissão online normal.
- **Emissão em Contingência Offline (`tpEmis = 9`):**
  - **Com Destinatário Identificado:** Formato `p=chNFe|3|tpAmb|dia|vNF|tpIdDest|idDest|assinatura` com assinatura digital **RSA-SHA1 Base64** da sequência dos parâmetros.
  - **Sem Destinatário (Consumidor Anônimo):** Formato `p=chNFe|3|tpAmb|dia|vNF|assinatura`, suprimindo os parâmetros de identificação sem gerar pipes vazios duplicados (`||`), prevenindo a Rejeição 397/474.
- **QR Code V2 Legado:** Preservado para contingência e compatibilidade transicional com CSC e SHA-1.

### 2.2. Modelo Criptográfico AES-256-GCM com HKDF e AAD
- **Origem do Segredo:** Chave-mestra corporativa de alta entropia (256 bits) lida via variável de ambiente `HB_STUDIO_FISCAL_MASTER_KEY` com fallback controlado.
- **Derivação Segura via HKDF (RFC 5869):** Utiliza `HKDF.DeriveKey` com SHA-256, salt único de 16 bytes extraído do `TenantId` e contexto explícito de domínio (`info`), eliminando qualquer derivação ingênua baseada em textos previsíveis.
- **Unicidade de Nonce (IV):** Cada operação de criptografia gera um nonce CSPRNG de 96 bits (12 bytes) com `RandomNumberGenerator.Fill()`.
- **Additional Authenticated Data (AAD):** Todo ciphertext vincula `TENANT={tenantId};RES_TYPE={type};RES_ID={id}`. Tentativas de descriptografar dados de um tenant com a chave de outro ou de trocar o registro são rejeitadas instantaneamente com `CryptographicException`.

### 2.3. Resiliência de Comunicação, Idempotência e Timeout
- **Máquina de Estados:** `Draft`, `Signed`, `Submitting`, `Authorized`, `Rejected`, `Denied`, `CancellationRequested`, `Cancelled`, `ContingencyOffline`, `ManualReviewRequired`.
- **Prevenção de Duplicidade:** O endpoint `/api/fiscal/nfce/sale` verifica vendas já autorizadas ou em submissão antes de alocar nova numeração.
- **Preservação de Numeração em Falha de Rede:** O documento retém a chave de 44 dígitos e a sequência intactas, tentando reconsulta automática de protocolo na SEFAZ (`/documents/{id}/reconcile`) antes de acionar intervenção humana.

### 2.4. Hardening de Importação de XML Inbound (Modelo 55)
- Proteção nativa contra ataques **XXE** (`DtdProcessing.Prohibit`, `XmlResolver = null`).
- Limite estrito de tamanho de arquivo: **5 MB**.
- Validação obrigatória da tag `<Signature>` no padrão W3C XMLDSig.
- Validação estrita de compatibilidade do CNPJ destinatário com o CNPJ cadastrado do estabelecimento.
- Rejeição de chave de acesso duplicada no banco de dados.

### 2.5. Autenticação e Autorização Granular (RBAC)
Todos os endpoints `/api/fiscal/*` exigem autenticação JWT Bearer e validam permissões canônicas:
- `/api/fiscal/establishment` (GET): `fiscal.documents.view`
- `/api/fiscal/establishment` (POST): `fiscal.settings.manage`
- `/api/fiscal/certificate` (POST): `fiscal.settings.manage`
- `/api/fiscal/csc` (POST): `fiscal.settings.manage`
- `/api/fiscal/nfce/sale` (POST): `fiscal.issue`
- `/api/fiscal/documents/{id}/cancel` (POST): `fiscal.cancel`
- `/api/fiscal/inbound/import` (POST): `fiscal.issue`

---

## 3. Evidências dos Testes Automatizados (`dotnet test`)

Execução da suíte de integração e segurança no .NET 10:
```
Iniciando execução de teste...
1 arquivos de teste no total corresponderam ao padrão especificado.

Aprovado!  – Com falha: 0, Aprovado: 5, Ignorado: 0, Total: 5, Duração: 6 s
- Fiscal_Establishment_Config_And_Csc_Registration_Should_Succeed
- AesGcm_Encryption_Hkdf_Aad_And_Tampering_Verification_Should_Work
- QrCode_NT2025_001_V3_Online_And_Contingency_With_RsaSha1_Should_Be_Compliant
- Fiscal_Inbound_Xml_Should_Validate_Signature_And_Prevent_Tampering
- Fiscal_Authorization_And_Tenant_Isolation_Should_Enforce_403
```

---

## 4. Próximos Passos para Homologação Externa (`HOMOLOGATION_VERIFIED`)

1. **Upload do Certificado A1 Real:** Fazer o upload do arquivo `.pfx` e senha emitidos para a pessoa jurídica da HB Studio através da aba `/fiscal` -> Configurações Fiscais.
2. **Confirmação de Inscrição Estadual (IE) e CSC:** Obter junto à SEFAZ-SP o Código de Segurança do Contribuinte no Posto Fiscal Eletrônico para testes de contingência/V2.
3. **Disparo de Emissão de Teste:** Emitir a primeira nota fiscal no ambiente de homologação (`Environment = 1`) para comprovar o recebimento do protocolo oficial de autorização SEFAZ (ex: `cStat = 100`).
