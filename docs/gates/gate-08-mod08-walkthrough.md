# Walkthrough do Gate 08: MOD-08 — CRM, Intenções de Compra & Matching com Estoque Real

## 1. Contexto e Bounded Context
O módulo **MOD-08 (CRM)** é a autoridade sobre leads, prospecção comercial, funis de oportunidades, tarefas de follow-up, intenções de compra e o algoritmo de matching automatizado com o estoque físico serializado (`InventoryUnit`).

### Regras de Ouro e Limites Arquiteturais:
1. **Sem duplicação de Party:** Leads podem ser qualificados e convertidos em `Party` oficial através de seu identificador canônico. Clientes existentes abrem oportunidades diretamente vinculadas ao seu `PartyId`.
2. **Sem Estoque ou Catálogo Paralelo:** O CRM consome exclusivamente o catálogo unificado (`ProductModel` e `ProductSku`) e as unidades serializadas reais do `Inventory` (`InventoryUnit`).
3. **Reserva Oficial Transacional:** O CRM não altera estoques por conta própria; qualquer reserva de aparelho selecionado pelo motor de matching é disparada através do método oficial `InventoryService.CreateReservationAsync()`.
4. **Conformidade LGPD:** Registro explícito de consentimento e opt-out de comunicações promocionais (`LgpdMarketingOptIn`).
5. **Auditoria Prévia MOD-07 Atendida:** Erradicada qualquer menção a senhas de aparelhos no intake (utilizado modo diagnóstico/desbloqueio presencial) e resguardado o CDC Art. 26 para vícios ocultos.

---

## 2. Estrutura de Código Implementada
- **Backend Domain:** `src/Modules/CRM/CRM.Domain`
  - Entidades: `CrmLead`, `CrmPipeline`, `CrmPipelineStage`, `CrmOpportunity`, `CrmOpportunityActivity`, `CrmPurchaseIntent`, `CrmInventoryMatch`.
  - Interfaces de Repositório: `ICrmRepository`.
- **Backend Application:** `src/Modules/CRM/CRM.Application`
  - DTOs para Leads, Funil, Oportunidades, Intenções, Matching e Reserva.
  - Serviço de Aplicação: `CrmAppService` com algoritmo de matching ponderado (Modelo, SKU, Capacidade, Cor, Saúde da Bateria e Teto Orçamentário).
- **Backend Infrastructure:** `src/Modules/CRM/CRM.Infrastructure`
  - Repositório `CrmRepository` com EF Core.
- **Banco de Dados & Migrations:**
  - Mapeamento Fluent API completo no `AppDbContext`.
  - Migration EF Core gerada: `20261116002324_AddCrmModule`.
  - Migration aplicada no PostgreSQL 18.3 real na porta 5433 (`hbstudio_erp_test`).
- **Endpoints REST na API:**
  - `apps/api/Program.cs` com rotas seguras `/api/crm/*` validadas por `PermissionCatalog.CrmView`, `CrmManage` e `CrmInterestManage`.
- **Frontend Next.js:**
  - `apps/web/app/crm/page.tsx` com 4 visões completas: Funil Comercial Kanban, Fila de Espera de Intenções de Compra, Painel de Matching com Unidades Serializadas Reais (com botão de reserva direta de 48h) e Gestão de Leads com Consentimento LGPD.

---

## 3. Evidências dos Testes Automatizados

### Execução dos Testes do MOD-08:
```powershell
dotnet test tests/BuildingBlocks.UnitTests/BuildingBlocks.UnitTests.csproj --filter "FullyQualifiedName~CrmModuleIntegrationTests"
```
**Resultado:**
```text
Iniciando execução de teste, espere...
1 arquivos de teste no total corresponderam ao padrão especificado.
Aprovado!  – Com falha:     0, Aprovado:     3, Ignorado:     0, Total:     3, Duração: 4 s - BuildingBlocks.UnitTests.dll (net10.0)
```

### Execução da Suíte Completa de Testes de Regressão:
```powershell
dotnet test tests/BuildingBlocks.UnitTests/BuildingBlocks.UnitTests.csproj
```
**Resultado:**
```text
Iniciando execução de teste, espere...
1 arquivos de teste no total corresponderam ao padrão especificado.
Aprovado!  – Com falha:     0, Aprovado:    63, Ignorado:     0, Total:    63, Duração: 5 s - BuildingBlocks.UnitTests.dll (net10.0)
```

---

## 4. Evidência do Build do Frontend Next.js 16
```powershell
npm --prefix apps/web run build
```
**Resultado:**
```text
▲ Next.js 16.4.6 (Turbopack)
✓ Compiled successfully in 2.2s
  Running TypeScript ...
  Finished TypeScript in 3.2s ...
✓ Generating static pages using 15 workers (14/14) in 1586ms

Route (app)
┌ ○ /
├ ○ /_not-found
├ ○ /cash
├ ○ /catalog
├ ○ /crm
├ ○ /financial
├ ○ /inventory
├ ○ /parties
├ ○ /partners
├ ○ /procurement
├ ○ /repairs
└ ○ /sales
```

---

## 5. Status Homologado
- **Status:** `READY_VERIFIED`
- **Total de Testes:** 63/63 aprovados.
- **Próximo Módulo:** MOD-09 (Automação de Mensagens & Mensageria Multicanal).
