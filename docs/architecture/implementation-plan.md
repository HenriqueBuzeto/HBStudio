# Implementation Plan — ERP Enterprise de Tecnologia Multinegócios

**Data:** 13/11/2026  
**Status:** DRAFT / INICIANDO FASE 0  
**Stack de Referência:** Next.js App Router (TSX) + Tailwind / shadcn/ui + ASP.NET Core .NET 10 LTS (C#) + EF Core / Npgsql + PostgreSQL (Neon)

---

## 1. Auditoria do Repositório & Diagnóstico Inicial

- **Situação Prévia:** Diretório raiz vazio (`c:\Users\HB Studio Dev\Documents\Site\HB Studio`).
- **Git:** Não inicializado previamente. Inicializado agora como repositório limpo (`git init`).
- **Ambiente de Ferramental:**
  - .NET SDK: `10.0.103` (LTS homologado)
  - Node.js: `v24.14.0`
  - NPM: `11.9.0`
- **Código Existente:** 0 linhas de código legado. Repositório novo em conformidade com o Blueprint Enterprise 1.0.

---

## 2. ADRs Fundamentais (Decisões de Arquitetura)

### ADR-01: Topologia de Implantação e Separação de Hosts
- **Decisão:** Frontend Next.js (BFF leve) implantado de forma desacoplada (e.g. Vercel), enquanto API REST / Background Workers em ASP.NET Core (.NET 10) rodam em infraestrutura de container dedicada com suporte a healthchecks contínuos e processos de longa duração.
- **Racional:** Workers de mensageria, outbox processor e relatórios pesados não devem depender da infraestrutura de renderização web.

### ADR-02: Topologia PostgreSQL / Neon e Pool de Conexões
- **Decisão:** Manter duas strings de conexão:
  - `DATABASE_URL_DIRECT`: Conexão direta utilizada exclusivamente para migrations (EF Core CLI / DDL) e operações que exigem transações com prepared statements nativos sem restrições.
  - `DATABASE_URL_POOLED`: Conexão via PgBouncer para operações de runtime de leitura e escrita padrão.
- **Racional:** Previne falhas de prepared statements e de sessão inerentes a pools transacionais do PgBouncer em operações de schema.

### ADR-03: Arquitetura em Monólito Modular
- **Decisão:** Adotar monólito modular em Clean Architecture no backend, com separação física por módulos (`src/Modules/*`) e biblioteca de blocos fundamentais (`src/BuildingBlocks/*`).
- **Racional:** Garante integridade referencial física e ACID no ledger sem complexidade prematura de orquestração distribuída ou eventual consistency onde consistência imediata é mandatória (Kardex, Caixa, Conciliação).

### ADR-04: Multi-tenancy e Isolamento de Filiais
- **Decisão:** Todo recurso pertence a um `tenant_id` obrigatório (UUID). O `tenant_id` é rigorosamente derivado do token de autenticação autenticado pelo servidor (Claims/Identity). O cliente **nunca** define autoritariamente seu `tenant_id`.
- **Racional:** Prevenção estrita de invasão de dados entre empresas (Cross-Tenant Data Leak). Escopos de filial (`branch_id`) são autorizados conforme a matriz de acesso do usuário.

### ADR-05: Backend como Autoridade Única de Negócio (Fail-Closed)
- **Decisão:** Nenhum cálculo financeiro, validação de estoque, aplicação de desconto ou permissão ocorre com autoridade no frontend. O frontend Next.js é um consumidor com tipagem estrita e validação de UX via Zod.
- **Racional:** Fail-closed security. Nenhum payload adulterado no browser pode burlar regras de faturamento, estoque ou conciliação.

### ADR-06: Representação Numérica e Temporal
- **Decisão:** Valores monetários armazenados exclusivamente como `numeric(18,2)`. Quantidades fracionárias (e.g. gramas de filamento 3D, horas) com precisão decimal dedicada (`numeric(18,4)` ou similar). **Proibido o uso de `float` ou `double` para dinheiro**.
- **Datas:** Todas as datas registradas em `UTC` com fuso horário da filial/operação respeitado na apresentação.

---

## 3. Bounded Contexts e Domínios do Sistema

1. **IdentityAccess:** Usuários, credenciais, sessões, grupos, `PermissionKeys`, escopos de filiais e políticas.
2. **Parties:** Clientes, contatos, consentimentos LGPD (WhatsApp/E-mail), fornecedores e endereços.
3. **Catalog:** Modelos de produtos, SKUs, especificações técnicas, unidades serializadas (IMEI/Serial), lotes e catálogo de serviços.
4. **Inventory & Procurement:** Kardex imutável (`stock_movements`), requisições, pedidos de compra, conferência e cálculo de custo real.
5. **Sales & CashManagement:** PDV, orçamentos, fechamentos de venda, turnos de caixa físico (abertura, sangria, suprimento, conferência cega).
6. **Financial & PartnersCapital:** Contas a pagar/receber, conciliação, plano de contas, DRE gerencial, aportes de sócios, allocations de orçamento e propostas de distribuição de lucros.
7. **RepairService:** Assistência técnica, ordens de serviço (OS), checklists de entrada com fotos, diagnósticos, apontamentos técnicos e garantias legais/comerciais.
8. **CRM & Messaging:** Gestão de oportunidades, intenções de compra (e.g. fila para iPhone 14 Pro Max), motor de matching contra estoque vendável e disparos idempotentes.
9. **Manufacturing3D:** Ordens de fabricação aditiva, parâmetros de fatiamento, consumo real de gramas/tempo e alocação de custos e refugos.
10. **DigitalProjects:** Contratos de desenvolvimento, marcos (milestones), apontamento de horas e faturamento recorrente.
11. **Fiscal:** Mapeamento de perfis fiscais e emissão/integração de documentos fiscais (NFC-e / NF-e / NFS-e).

---

## 4. Estrutura de Diretórios Alvo

```
HB Studio/
├── .gitignore
├── README.md
├── docs/
│   ├── architecture/
│   │   ├── implementation-plan.md
│   │   └── module-coverage.md
│   └── adr/
├── apps/
│   ├── web/                    # Next.js App Router, Tailwind CSS, shadcn/ui
│   ├── api/                    # ASP.NET Core Web API Host (.NET 10 LTS)
│   └── worker/                 # ASP.NET Core Background Jobs Worker
├── src/
│   ├── BuildingBlocks/
│   │   ├── BuildingBlocks.Application/
│   │   ├── BuildingBlocks.Domain/
│   │   ├── BuildingBlocks.Infrastructure/
│   │   └── BuildingBlocks.Security/
│   └── Modules/
│       ├── IdentityAccess/
│       ├── Parties/
│       ├── Catalog/
│       ├── Inventory/
│       ├── Procurement/
│       ├── Sales/
│       ├── CashManagement/
│       ├── Financial/
│       ├── PartnersCapital/
│       ├── RepairService/
│       ├── CRM/
│       ├── Messaging/
│       ├── Manufacturing3D/
│       ├── DigitalProjects/
│       └── Fiscal/
└── tests/
    ├── UnitTests/
    ├── IntegrationTests/
    └── E2ETests/
```

---

## 5. Primeiro Gate Executável: Gate 0 (Fase 0)

### Objetivos do Gate 0:
1. Estruturação física do repositório (.NET Solution + Next.js App + BuildingBlocks).
2. Fundação de Segurança & Identity:
   - Pipeline canônico de segurança: Token Authentication -> Tenant Boundary -> PermissionKeys -> Data Scope -> Audit.
   - Entidades base: `Tenant`, `Branch`, `User`, `Role`, `Permission`, `AuditEvent`.
   - Engine de autorização: `PermissionRequirement`, `PermissionAuthorizationHandler`, `IPermissionEvaluator`.
3. Persistência EF Core + Npgsql:
   - Configuração do DbContext com isolamento multi-tenant (filtros globais automáticos).
   - Configuração de auditoria automática em todas as mutações (`audit_events`).
   - Geração de migration real inicial e verificação de integridade no PostgreSQL.
4. Shell do Frontend Next.js:
   - Setup inicial com TypeScript, Tailwind CSS, Lucide Icons e design system base.
   - Provedores de estado, autenticação e layout responsivo testado em 4 larguras de tela (320px, 768px, 1024px, 1440px).
5. Bateria de Testes Automatizados da Fase 0:
   - Testes unitários de isolamento multi-tenant, resolução de permissões e fail-closed security.
