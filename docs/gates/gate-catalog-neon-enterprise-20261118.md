# Gate Enterprise — Catálogo Real Vercel + Neon e Auditoria das Telas

**Data:** 18/11/2026  
**Stack alvo:** Next.js 16 (Vercel Functions) + PostgreSQL Neon, sem API .NET hospedada  
**Escopo implementado nesta entrega:** `/catalog` e todas as suas rotas BFF.  
**Escopo auditado, ainda pendente:** módulos que dependem de `forwardToBackend`/API .NET ou mocks visuais.

## 1. Causa raiz comprovada

Os endpoints `/api/catalog/categories`, `brands`, `models` e `units` utilizavam `forwardToBackend()`, que exige `API_INTERNAL_URL` em produção. Como o deploy oficial Vercel não hospeda o serviço .NET, os quatro endpoints devolviam falhas simultâneas. O frontend interpretava erro como catálogo vazio e exibia o badge estático "PostgreSQL Neon Conectado" inclusive quando a carga falhava.

Consulta somente de leitura ao Neon para o tenant principal:
- `product_categories`: **1**, Smartphones
- `product_brands`: **1**, Apple
- `product_models`: **1**, iPhone 15 Pro
- `product_skus`: **1**, `IPH15P-128-NAT`, preço R$ 6.499,00
- `inventory_units`: **1** unidade física.
- Nenhum desses registros foi alterado, removido, criado ou reproduzido neste trabalho.

## 2. Integração implementada

| Endpoint | Método | Implementação |
| --- | --- | --- |
| `/api/catalog/categories` | GET, POST | Neon nativo, categoria por tenant, slug único, validação de pai, auditoria |
| `/api/catalog/brands` | GET, POST | Neon nativo, nome único por tenant, auditoria |
| `/api/catalog/models` | GET, POST | Consulta com marcas, categorias e SKUs; cadastro modelo + SKU em um comando SQL atômico |
| `/api/catalog/models/[id]` | GET | Detalhes reais e escopo tenant |
| `/api/catalog/models/[id]/skus` | POST | SKU com preço, pertencimento ao modelo e auditoria |
| `/api/catalog/skus/[id]/price` | PUT | Controle de concorrência real via `xmin`, erro 409 por versão defasada |
| `/api/catalog/units` | GET, POST | Unidades e custo protegido; IMEI/Serial registrados junto à tabela de identificadores canônicos, com UNIQUE por tenant |
| `/api/catalog/units/[id]` | GET | Detalhes com custo mascarado sem `catalog.cost.view` |
| `/api/catalog/units/[id]/approve` | PUT | Aprovação atômica, auditoria, OCC via `xmin`, impede quarentena/vendido/duplicidade |

**Governança:** todas as rotas exigem cookie autenticado com JWT válido, SecurityStamp, sócio ativo e habilitado, papéis/PermissionKeys do banco (`catalog.products.view`, `catalog.products.manage`, `catalog.cost.view`), e filtros obrigatórios por tenant. Mutações exigem mesma origem e auditoria. Respostas de erro `401/403/400/409/503` não viram dados fictícios.

**Integridade:** as entidades originais são reutilizadas, não foi criada tabela paralela nem mock. O token de concorrência real é `xmin::text::bigint` no PostgreSQL, conforme modelo EF; o banco não possui coluna `Version` física no Catálogo.

## 3. Experiência HBVisionX

- Mantém layouts e cartões do Catálogo.
- Carregamento independente de Categorias, Marcas, Modelos e Unidades com `Promise.allSettled`.
- Um erro de rede não se converte em estado vazio; botão `Atualizar`, horário da última consulta, mensagem descritiva e preservação dos registros já carregados.
- Badge de sincronização baseado no estado real, não em texto estático.
- Botões/modal para cadastrar **Marca** e **Categoria** na mesma tela, com vinculação imediata ao cadastro de Modelo.
- Modelo com tipo real: revenda, insumo, peça, serviço ou manufatura 3D, sem hardcoding `Kind=1`.
- Não insere mais 95% de bateria presumidos nem preço `R$ 0` quando campo vazio.
- Mostra unidade aprovada, não a confunde com saldo Kardex disponível; custo visível somente com permissão.
- Exibe estado `inativo` quando aplicável; impede aprovação de unidade em quarentena/vendida.

## 4. Evidências

1. `EXPLAIN (FORMAT TEXT)` no Neon, sem executar alterações: **PASS** para sete comandos de gravação (categoria, marca, modelo+SKU, SKU, preço, registro unidade+identificadores, aprovação).
2. Execução **somente-leitura** das consultas de modelos e unidades, completas e por ID: **1 resultado** em cada consulta; SKU aninhado e tokens de versão reais.
3. GitHub Actions: `.github/workflows/catalog-neon-enterprise-gate.yml` valida `npx tsc --noEmit`, `npm run build` e ausência de `forwardToBackend` em `apps/web/app/api/catalog`.
4. Verificação física pós-deploy: **PENDENTE**. Não houve sessão browser autenticada para exercitar POST/F5. Não declarar E2E homologado até isso ocorrer.
5. Operações reais em produção: **nenhuma escrita**, nenhuma deleção, nenhum cadastro de teste ou credencial exposta.

## 5. Auditoria do restante do ERP — pendências reais

A solicitação inclui "todas as telas". A auditoria confirmou que **não é honesto declarar os demais módulos prontos** com base apenas no build e no Catálogo. Rotas legadas e telas sem fonte real ainda existem:

| Módulo | Evidência da lacuna | Próxima fase |
| --- | --- | --- |
| Clientes & Fornecedores (`/parties`) | `/api/parties` ainda utiliza `forwardToBackend` | Migrar CRUD, vínculos e paginação para Neon com APIs seguras |
| Estoque & Kardex (`/inventory`) | `balances`, `kardex`, `warehouses`, `initial-receipt` ainda dependem da API .NET | Integrar consultas, recebimento transacional, Kardex e saldos reais |
| Usuários (`/users`) | `/api/users` consulta `API_INTERNAL_URL`, podendo falhar na Vercel | Migrar autenticação governada e gestão de usuários com RBAC completo |
| Compras (`/procurement`) | Rotas mistas, algumas diretas ao Neon e outras legadas | Homologar registro, aquisição, aprovação, recebimento e estoque com rollback |
| Assistência Técnica (`/repairs`) | Querys Neon diretas; código ainda tem preenchimentos de equipamento/fonte artificiais e falta transação completa | Hardening de autorização e OS realmente atômica |
| Caixa (`/cash`) | Tela sem integração transacional ponta a ponta | Turnos, sangria, suprimento, fechamento e conciliação |
| CRM (`/crm`) | Interface sem operação persistida de funil | Implementar workflow real de oportunidades, atividades, fases e métricas |
| PDV (`/sales`) | Orçamentos reais, finalização bloqueada até caixa/estoque/adquirente | Integrar liquidação, estoque, comissão, pagamentos e NFC-e |
| Fiscal (`/fiscal`) | P0 de segurança, emissão oficial SEFAZ não homologada | Motor fiscal real e testes em homologação |

**Não alterar mensagens de falha para sucesso só para esconder bugs.** Fase de cada módulo exige CRUD/fluxos completos com banco, auditoria, permissões, isolamento de tenant/filial, build e testes E2E. Nada de seed automático, campos inventados ou SQL que altere produção sem gate.

## 6. Gates desta entrega

- `CATALOG_SQL_SCHEMA_VERIFIED`: PASS (EXPLAIN + SELECT)
- `CATALOG_FRONTEND_BUILD_VERIFIED`: PASS após última execução CI
- `CATALOG_SERVERLESS_ROUTES_VERIFIED`: PASS sem forwarder
- `CATALOG_AUTH_E2E_VERIFIED`: PENDENTE DE SESSÃO AUTENTICADA
- `CATALOG_WRITE_E2E_VERIFIED`: PENDENTE DE TESTE CONTROLADO (sem sujar base oficial)
- `INVENTORY_KARDEX_GATE`: PENDENTE
- `ALL_ERP_SCREENS_READY`: **NÃO** — execução por módulos, conforme matriz acima.

## 7. Checklist manual após publicação

1. Logar na Vercel, abrir `/catalog`, executar Ctrl+Shift+R.
2. Confirmar exatamente a marca Apple, categoria Smartphones, iPhone 15 Pro, SKU `IPH15P-128-NAT`, preço R$ 6.499,00 e 1 unidade.
3. Recarregar com F5 e verificar persistência e ausência do alerta vermelho.
4. Testar que pessoa sem `catalog.cost.view` não recebe custo nas respostas, nem ao forçar API no navegador.
5. Somente em Neon branch de homologação, testar criação de categoria, marca, modelo, SKU, unidade e inspeção; erro duplicado 409, concorrência 409, autenticação 401 e permissão 403.
6. Avaliar reconciliação com `stock_balances`/Kardex antes de permitir finalização de venda.

**Conclusão:** Catálogo corrigido em código e validado por consultas reais; demais módulos mapeados, não declarados homologados.
