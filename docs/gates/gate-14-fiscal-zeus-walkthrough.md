# Walkthrough — Gate 14 | Motor Fiscal & Emissão de NFC-e (Zeus DFe.NET)

**Status do Gate:** `INTERNAL_VERIFIED` *(Aguardando credenciais fiscais oficiais da SEFAZ-SP para `HOMOLOGATION_VERIFIED`)*  
**Data da Auditoria Sênior e Fechamento:** 16 de Novembro de 2026  
**Responsável Técnico:** Antigravity Senior Architect / HB Studio Dev Team  
**Módulo:** `MOD-14 — Fiscal & Invoicing Engine`  
**Biblioteca Principal:** `Zeus.Net.NFe.NFCe` versão `2026.9.24.1416` (LGPL-2.1)  
**Frameworks:** .NET 10 • ASP.NET Core Minimal APIs • PostgreSQL 18.3 • Next.js 16 (Turbopack)  

---

## 1. Classificação de Prontidão Operacional

| Status | Definição | Situação HB Studio |
| :--- | :--- | :--- |
| **`INTERNAL_VERIFIED`** | Módulo, regras de negócio, criptografia, resiliência, validação de XML, leases de concorrência e testes automatizados 100% verificados localmente. | **CONCLUÍDO (92/92 testes globais aprovados, 10 fiscais)** |
| **`EXTERNAL_NOT_CONFIGURED`** | Pendente de upload do Certificado A1 real (`.pfx`) e credenciamento oficial da SEFAZ-SP pelo contador. | **STATUS ATUAL** |
| **`HOMOLOGATION_VERIFIED`** | Transmissão e autorização real de NFC-e e cancelamento validados no ambiente oficial de Homologação da SEFAZ-SP. | *Aguardando dados oficiais do emitente* |
| **`PRODUCTION_READY`** | Emissão liberada em ambiente de Produção com autorização fiscal regular. | *Etapa subsequente à homologação externa* |

---

## 2. Auditoria e Verificações Finais Concluídas

### 2.1. Autenticidade Criptográfica do XMLDSig de Entrada (`System.Security.Cryptography.Xml`)
- **Problema de Auditoria:** `SignedXml.CheckSignature()` sem argumentos apenas valida o digest com a chave pública embutida no próprio XML, sem verificar se o signatário é o emitente legítimo.
- **Implementação Segura:**
  1. Carregamento e validação canônica W3C XMLDSig do elemento `infNFe` (`#NFe{accessKey}`).
  2. Proteção contra **XML Signature Wrapping (XSW)**: Rejeita se o `SignedInfo.References` não apontar especificamente para a `#NFe` do documento.
  3. **Validação Criptográfica:** Executa `signedXml.CheckSignature()` garantindo a integridade contra adulteração de valores ou dados de produtos.
  4. **Auditoria do Certificado Signatário (`X509Certificate2`):**
     - Extrai o certificado X.509 embutido no `<KeyInfo>`.
     - Valida o período de vigência (`NotBefore` e `NotAfter`) em relação à data de emissão (`dhEmi`).
     - **Correspondência de Identidade do Emitente:** Exige que o Subject do certificado contenha estritamente o CNPJ informado no grupo `<emit><CNPJ>`. Chaves forjadas de terceiros ou fraudes com certificado de outros CNPJs são bloqueadas imediatamente (`InvalidOperationException`).

### 2.2. Reconciliação Concorrente em Múltiplas Instâncias (`FiscalReconciliationWorker`)
- **Problema de Auditoria:** Em ambientes com réplicas ou containers múltiplos, múltiplos workers não podem processar simultaneamente a mesma NFC-e nem disparar consultas repetitivas.
- **Implementação Segura:**
  1. **Guarda de Configuração:** Se o estabelecimento fiscal estiver em `EXTERNAL_NOT_CONFIGURED` (sem certificado A1 ativo), o reconciliador registra falha amigável com backoff de 10 minutos e não dispara requisições fictícias para a SEFAZ.
  2. **Consulta Individual por Chave:** Utiliza `ConsultDocumentStatusAsync(est, cert, accessKey)` consultando a situação pontual de cada documento na SEFAZ (`retConsSitNFe`), preservando a numeração e chave de 44 dígitos sem gerar novas emissões.
  3. **Mecanismo de Lease Concorrente:** Adicionado na entidade `FiscalDocument`:
     - `ReconcileClaimWorkerId` (identificador único da instância do worker).
     - `ReconcileLeaseExpiresAtUtc` (lease de 90 segundos).
     - `TryAcquireReconcileLease()`: Garante atomicamente que apenas uma réplica adquira o lock transacional no banco.
  4. **Retry e Backoff Exponencial:** Incrementa `ReconcileRetryCount` e agenda `NextReconcileAttemptAtUtc` com backoff progressivo de até 30 minutos em caso de indisponibilidade da SEFAZ.

### 2.3. Suporte a Protocolos de Autorização de 17 Posições (SEFAZ-SP / NT 2025.002)
- **Atualização Regulatória:** A SEFAZ-SP implementou desde 05/10/2026 protocolos de autorização e eventos com **17 dígitos** (formato `[cUF 2][AAMM 4][Seq 11]`), substituindo o formato antigo de 15 posições.
- **Auditoria de Modelo de Dados:**
  - O banco de dados PostgreSQL (`AppDbContext.cs`) armazena `ProtocolNumber` como `character varying(100)`, permitindo protocolos de até 100 caracteres sem truncamento.
  - A entidade `FiscalDocument`, os DTOs (`FiscalDocumentDto`), o provider `ZeusNFeProvider` e os mocks internos foram adaptados para o formato de 17 dígitos (`13526...01`).
  - Adicionado teste específico `SefazSp_17_Digits_Protocol_Number_Should_Be_Accepted_And_Preserved`.

### 2.4. QR Code V3 em Contingência para Consumidor Anônimo (`|||`)
- Confirmada a conformidade estrita com o Manual DANFE NFC-e v6.0 item 4.4.2 e NT 2025.001 v1.03:
  $$\text{p=chNFe|3|tpAmb|dia|vNF|||assinatura}$$
  Com parâmetros 6 e 7 vazios e 3 pipes consecutivos antes da assinatura RSA-SHA1 Base64.
- Teste unitário e de integração `QrCode_NT2025_001_V3_Online_And_Contingency_With_RsaSha1_Should_Be_Compliant` 100% aprovado.

---

## 3. Matriz de Testes Completa da Solução (`dotnet test`)

Execução de **toda a suíte de testes da solução HB Studio ERP**:

```
Execução de teste para BuildingBlocks.UnitTests.dll (.NETCoreApp,Version=v10.0)
Versão do VSTest 18.0.1 (x64)

Iniciando execução de teste, espere...
1 arquivos de teste no total corresponderam ao padrão especificado.

Aprovado!  – Com falha: 0, Aprovado: 92, Ignorado: 0, Total: 92, Duração: 18 s
```

### Detalhamento por Domínio / Módulo:
- **MOD-14 Fiscal & Criptografia (10 testes):**
  - `Fiscal_Establishment_Config_And_Csc_Registration_Should_Succeed`
  - `AesGcm_Encryption_Hkdf_Aad_And_Tampering_Verification_Should_Work`
  - `AesGcm_Keyring_Versioning_And_Rotation_Should_Allow_Transparent_Decryption`
  - `QrCode_NT2025_001_V3_Online_And_Contingency_With_RsaSha1_Should_Be_Compliant`
  - `Fiscal_Inbound_Xml_Real_XmlDSig_CheckSignature_Should_Validate_Or_Reject`
  - `Fiscal_Inbound_Xml_With_Untrusted_Signer_Certificate_Should_Be_Rejected`
  - `Fiscal_Reconcile_Multi_Instance_Lease_Should_Prevent_Concurrent_Duplicate_Processing`
  - `SefazSp_17_Digits_Protocol_Number_Should_Be_Accepted_And_Preserved`
  - `Fiscal_Inbound_Xml_Should_Validate_Signature_And_Prevent_Tampering`
  - `Fiscal_Authorization_And_Tenant_Isolation_Should_Enforce_403`
- **MOD-04 / MOD-05 Sales & PDV (6 testes):** Cotações, ciclo PDV com Kardex, concorrência de IMEI, split payments, devoluções e proteção de custo.
- **MOD-02 / MOD-03 Inventory & Catalog (8 testes):** Bloqueios de estoque, movimentações FIFO/médio, rastreabilidade IMEI.
- **MOD-06 Financial & DRE (11 testes):** Contas a pagar/receber, conciliação bancária, DRE em tempo real, fluxo de caixa.
- **MOD-16 FleetLogistics & Pricing Engine (12 testes):** Rateio de combustível, cálculo de frete por hodômetro, margem de contribuição.
- **MOD-01 IdentityAccess & RBAC (14 testes):** Autenticação JWT, MFA, sessões revogadas, isolamento multi-tenant.
- **MOD-07 RepairService & Assistência Técnica (3 testes):** Ordem de serviço, garantia, segregação de aparelhos de clientes.
- **MOD-08 CRM & Funil de Vendas (4 testes):** Leads, estágios do funil, histórico de interações.
- **MOD-09 Messaging & Notificações (5 testes):** Filas de mensageria, lease de worker, webhooks.
- **MOD-10 / MOD-11 Manufatura 3D & Projetos Digitais (6 testes):** Custos de filamento, horas de máquina, repositórios e branches.
- **MOD-12 / MOD-13 Sócios & Capital Social (7 testes):** Cap Table, distribuição de dividendos proporcional, empréstimos mútuos.
- **Infraestrutura PostgreSQL & Concorrência (6 testes):** OCC transacional, integridade referencial cross-tenant, auditoria automática.

---

## 4. Próxima Etapa: Ativação Fiscal Operacional

Com o encerramento do hardening interno do **MOD-14**:
1. O desenvolvimento e engenharia interna do módulo fiscal estão concluídos e congelados.
2. A transição para `HOMOLOGATION_VERIFIED` ocorrerá exclusivamente após:
   - Obtenção do Certificado Digital A1 (`.pfx`) da HB Studio com o contador.
   - Upload das credenciais e dados cadastrais no painel web `/fiscal`.
   - Emissão de teste autorizada pela SEFAZ-SP no ambiente oficial de homologação.
