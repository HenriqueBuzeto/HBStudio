# Matriz de Cobertura e Homologação de Módulos (Module Coverage)

**Data de Atualização:** 13/11/2026  
**Status do Projeto:** Fase 0 em Inicialização  

> **Legenda de Status:**
> - `NOT_STARTED`: Módulo planejado, sem implementação física.
> - `IN_PROGRESS`: Em desenvolvimento ou com implementação parcial.
> - `IMPLEMENTED_NOT_VERIFIED`: Código e testes gerados, aguardando validação de gate/evidências.
> - `PARTIAL`: Aprovado parcialmente com ressalvas explícitas.
> - `READY_VERIFIED`: 100% dos critérios do Gate aprovados com testes automatizados executados, evidências reais e auditoria.
> - `BLOCKED`: Bloqueado por dependência técnica ou decisão externa.

---

## 1. Matriz de Módulos e Status Real

| ID | Módulo | Bounded Context | Domínio | Persistência / Migrations | API REST | Frontend UI | Testes Automatizados | Status Homologado |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **MOD-00** | **Fundação & Segurança** | `IdentityAccess` & `BuildingBlocks` | Implementado | Implementado | Implementado | Implementado | 5/5 xUnit Aprovados | `READY_VERIFIED` |
| **MOD-01** | **Pessoas & Contatos** | `Parties` | Não iniciado | Não iniciado | Não iniciado | Não iniciado | Não iniciado | `NOT_STARTED` |
| **MOD-02** | **Catálogo & Serialização (IMEI)** | `Catalog` | Não iniciado | Não iniciado | Não iniciado | Não iniciado | Não iniciado | `NOT_STARTED` |
| **MOD-03** | **Estoque & Kardex Imutável** | `Inventory` | Não iniciado | Não iniciado | Não iniciado | Não iniciado | Não iniciado | `NOT_STARTED` |
| **MOD-04** | **Compras & Recebimento** | `Procurement` | Não iniciado | Não iniciado | Não iniciado | Não iniciado | Não iniciado | `NOT_STARTED` |
| **MOD-05** | **Vendas & PDV** | `Sales` | Não iniciado | Não iniciado | Não iniciado | Não iniciado | Não iniciado | `NOT_STARTED` |
| **MOD-06** | **Caixa & Turnos Físicos** | `CashManagement` | Não iniciado | Não iniciado | Não iniciado | Não iniciado | Não iniciado | `NOT_STARTED` |
| **MOD-07** | **Assistência Técnica & OS** | `RepairService` | Não iniciado | Não iniciado | Não iniciado | Não iniciado | Não iniciado | `NOT_STARTED` |
| **MOD-08** | **CRM & Intenção de Compra** | `CRM` | Não iniciado | Não iniciado | Não iniciado | Não iniciado | Não iniciado | `NOT_STARTED` |
| **MOD-09** | **Automação de Mensagens** | `Messaging` | Não iniciado | Não iniciado | Não iniciado | Não iniciado | Não iniciado | `NOT_STARTED` |
| **MOD-10** | **Fábrica 3D & Custos Reais** | `Manufacturing3D` | Não iniciado | Não iniciado | Não iniciado | Não iniciado | Não iniciado | `NOT_STARTED` |
| **MOD-11** | **Projetos Digitais & Horas** | `DigitalProjects` | Não iniciado | Não iniciado | Não iniciado | Não iniciado | Não iniciado | `NOT_STARTED` |
| **MOD-12** | **Financeiro & DRE** | `Financial` | Não iniciado | Não iniciado | Não iniciado | Não iniciado | Não iniciado | `NOT_STARTED` |
| **MOD-13** | **Sócios & Aportes / Liquidez** | `PartnersCapital` | Não iniciado | Não iniciado | Não iniciado | Não iniciado | Não iniciado | `NOT_STARTED` |
| **MOD-14** | **Fiscal (NFC-e / NF-e / NFS-e)** | `Fiscal` | Não iniciado | Não iniciado | Não iniciado | Não iniciado | Não iniciado | `NOT_STARTED` |
| **MOD-15** | **Relatórios & Auditoria Geral** | `Reporting` | Não iniciado | Não iniciado | Não iniciado | Não iniciado | Não iniciado | `NOT_STARTED` |

---

## 2. Critérios de Homologação para Mudança de Status

Nenhum módulo terá seu status alterado para `READY_VERIFIED` sem que os seguintes critérios sejam demonstrados com comandos executáveis e saída real registrada:
1. Migrations reais do EF Core aplicadas sem erro.
2. Contratos REST OpenAPI documentados e implementados.
3. Autorização com `PermissionKeys` em todos os endpoints sem hardcode de role.
4. Isolamento multi-tenant testado (impossibilidade de leitura de dados de outro tenant).
5. Concorrência tratada com OCC (`Version` / `rowversion`) retornando HTTP 409 em caso de colisão.
6. Telas funcionais no frontend em Next.js com estados de loading, empty, erro e tratamento de 403/409.
7. Testes unitários e de integração verdes.
