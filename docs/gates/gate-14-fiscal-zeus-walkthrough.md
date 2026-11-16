# Walkthrough — Gate 14 | Motor Fiscal & Emissão de NFC-e (Zeus DFe.NET)

**Status do Gate:** `READY_VERIFIED`  
**Data:** 16 de Novembro de 2026  
**Responsável Técnico:** Antigravity Architect / HB Studio Dev Team  
**Módulo:** `MOD-14 — Fiscal & Invoicing Engine`  
**Biblioteca Principal:** `Zeus.Net.NFe.NFCe` versão `2026.9.24.1416` (LGPL-2.1)  

---

## 1. Visão Geral da Arquitetura Fiscal

O módulo fiscal da HB Studio foi desenhado para eliminar custos operacionais recorrentes por emissão de documentos (substituindo APIs privadas pagas por nota) e assegurar conformidade integral com a **SEFAZ-SP** (São Paulo):

```
┌────────────────────────────────────────────────────────────────────────┐
│                               FRONTEND                                 │
│          Next.js 16 (App Router) • Aba Fiscal & NFC-e (/fiscal)        │
│          Visão Geral • NFC-e Emitidas • XML Entrada • Certificado/CSC  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ BFF Proxy
┌───────────────────────────────────▼────────────────────────────────────┐
│                             BACKEND API                                │
│          ASP.NET Core (.NET 10) • Endpoints /api/fiscal/*              │
│          Autenticação JWT • Controle Canônico de Permissões            │
└───────────────────┬────────────────────────────────┬───────────────────┘
                    │                                │
┌───────────────────▼─────────────┐   ┌──────────────▼───────────────────┐
│       Fiscal.Application        │   │      Fiscal.Infrastructure       │
│ • IFiscalService                │   │ • ZeusNFeProvider                │
│ • Safe Inbound XML (XXE Prot.)  │   │ • Zeus.Net.NFe.NFCe              │
│ • AES-256 Encryption (.pfx, CSC)│   │ • IFiscalProvider Adapter        │
└───────────────────┬─────────────┘   └──────────────┬───────────────────┘
                    │                                │
┌───────────────────▼────────────────────────────────▼───────────────────┐
│                         POSTGRESQL (EF Core 10)                        │
│   fiscal_establishments • fiscal_certificates • fiscal_cscs            │
│   fiscal_documents • fiscal_document_items • inbound_fiscal_documents  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Decisão Técnica: Zeus DFe.NET vs Alternativas

| Critério | Zeus DFe.NET | ACBrLibNFe | APIs Pagas de Terceiros |
| :--- | :--- | :--- | :--- |
| **Integração no .NET 10** | **C# Nativo via NuGet** | DLL C++ com wrapper P/Invoke | HTTP REST Externo |
| **Custo por Emissão** | **R$ 0,00 (Ilimitado)** | R$ 0,00 (binário restrito Pro) | R$ 0,10 a R$ 0,50 / nota |
| **Licença** | **LGPL-2.1 Open-Source** | Dual / ACBr Pro Comercial | Proprietária Fechada |
| **Atualizações 2026** | **Sim (v2026.9.24.1416)** | Sim (fontes Pascal) | Variável |
| **Isolamento de Domínio** | **`IFiscalProvider`** | Wrapper de terceiros | SDK proprietário |

---

## 3. Escopo Implementado

### Prioridade 1 — Emissão de NFC-e (Modelo 65)
- Emissão direta no balcão a partir de vendas concluídas do PDV.
- Assinatura digital A1 em padrão SEFAZ NFe 4.00.
- Cálculo automático de chave de acesso de 44 dígitos com dígito verificador Módulo 11.
- Geração da URL oficial do **QR Code V2** com token CSC e hash SHA-1 para consulta pública por smartphone do cliente.
- Cancelamento homologado perante a SEFAZ com justificativa mínima legal de 15 caracteres.

### Prioridade 2 — Importação de XML de Entrada (Modelo 55)
- Leitura de notas fiscais de compra e fornecedores.
- Proteção nativa contra vulnerabilidades **XXE** (`DtdProcessing = Prohibit`, `XmlResolver = null`).
- Extração de emitente, destinatário, valores de produtos, ICMS e itens com NCM/CFOP.
- Retenção do XML integral assinado em banco de dados para conformidade tributária de 5 anos.

### Prioridade 3 — Conformidade SEFAZ-SP & Segurança em Repouso
- **Regra de São Paulo (01/11/2026):** Dispensada a formalização de inutilização de números pulados. O sistema preserva a sequência atômica de numeração no PostgreSQL (`ReserveNextNfceNumber()`).
- **Criptografia AES-256:** Arquivos `.pfx`, senhas e tokens CSC são criptografados com chaves derivadas de variáveis de ambiente e IV único por registro, impedindo vazamento em caso de dump acidental do banco.

---

## 4. Evidências de Testes & Compilação

### Testes Automatizados no .NET 10 (`dotnet test`)
- Arquivo de Teste: [tests/BuildingBlocks.UnitTests/FiscalModuleIntegrationTests.cs](file:///c:/Users/HB%20Studio%20Dev/Documents/Site/HB%20Studio/tests/BuildingBlocks.UnitTests/FiscalModuleIntegrationTests.cs)
- Execução:
  ```
  Aprovado! – Com falha: 0, Aprovado: 3, Ignorado: 0, Total: 3, Duração: 3 s
  - Fiscal_Establishment_Config_And_Csc_Registration_Should_Succeed
  - Fiscal_Emit_Nfce_And_Cancel_Workflow_Should_Persist_Document
  - Fiscal_Inbound_Xml_Parse_And_Import_Should_Prevent_Xxe_And_Extract_Data
  ```

### Compilação do Frontend (`npm run build`)
- Framework: Next.js 16.4.6 (Turbopack)
- Rota gerada com sucesso: `○ /fiscal` e proxy dinâmico `ƒ /api/fiscal/[...path]`
- Erros de compilação ou TypeScript: **0**.
