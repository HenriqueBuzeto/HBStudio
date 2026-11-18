# Auditoria Enterprise — HB Studio ERP / HBVisionX

**Data de referência:** 18/11/2026  
**Repositório:** `HenriqueBuzeto/HBStudio`  
**Alvo da auditoria:** `master` após merge do PR #10; Neon `neon-charcoal-clock`, branch principal `main` apenas em leitura; branches de funcionalidades comparadas.  
**Branch de correções:** `audit/erp-enterprise-hardening-20261118`  
**Publicação:** nenhuma nesta etapa; bloqueio de builds Vercel informado pelo usuário.

## Alcance e evidências

Esta é uma auditoria estática e de metadados, **não uma homologação funcional completa**. Foram lidos arquivos de telas, APIs, utilitários compartilhados e as alterações de branches de funcionalidades. O banco Neon principal foi consultado somente com SELECT de catálogo e agregações. Não foram executados testes ponta a ponta com usuário autenticado, nem `npm ci`, `tsc`, `next build` ou migrations de produção nesta sessão.

Status: **CONFIRMADO** = evidência direta do código/metadata; **RISCO** = derivação técnica dependente de teste; **PENDENTE** = não foi possível verificar. Não atribuir PASS sem evidência.

## Resumo executivo

A infraestrutura de domínio tem cobertura elevada de entidades (clientes, vendas, estoque, caixa, CRM, financeiro, fidelidade, manufatura, projetos, fretes e OS), mas há uma diferença significativa entre **tabelas existentes**, **APIs implementadas**, **UI existente** e **fluxos operacionais homologados**. A condição de pronto precisa ser avaliada pela cadeia completa usuário → autorização → API → Neon → auditoria → recarregamento → reversão.

### P0 — Bloqueadores críticos

| ID | Achado e evidência | Impacto | Tratamento |
| --- | --- | --- | --- |
| P0-01 | **CONFIRMADO** `apps/web/lib/serverless-db.ts`: `getDb()` devolvia `neon(connectionString)` (função chamável), mas `fleet-session.ts`, login, logout, `/api/auth/me`, catálogo, vendas, OS e outras rotas chamam `db.query(sql, params)`. | Erros 500 ou 503 sistêmicos, incluindo auth e telas transacionais | **CORRIGIDO NA BRANCH DE AUDITORIA** com adaptador tipado preservando a API chamável, `.query` e `.transaction`. Teste de compilação/integração pendente. |
| P0-02 | **CONFIRMADO** API de clientes retornava 500; rotas antigas validavam somente JWT e tenant, não Effective Access nem guard de origem. | Escrita/consulta sem permissionamento canônico; API frágil | **ALTERADO NA BRANCH** para usar `authorizeFleet`, `guardOrigin`, escopo por tenant e permissão, além de erros estruturados. Validar permissão por tipo de cliente/fornecedor. |
| P0-03 | **CONFIRMADO** `apps/web/app/api/repairs/orders/route.ts`: criação de cliente/aparelho/OS/itens/histórico em queries sucessivas; número `OS-ano-N` calculado por COUNT+1. | Cadastro parcial e colisão em dois usuários concorrentes | Refatorar com sequência transacional por tenant/filial/ano, lock ou constraint UNIQUE e criação atômica; testar rollback, simultaneidade e idempotência. **NÃO CORRIGIDO NESTA RODADA**. |
| P0-04 | **CONFIRMADO** `apps/web/app/api/sales/route.ts` preserva bloqueio do checkout real por segurança; `/api/sales/auxiliary` declara `checkout:false` e `fiscalIssue:false`. | Venda não completa ciclo financeiro, estoque, fiscal e cashback | Homologar meio de pagamento, confirmação real, baixa imutável de estoque, caixa/financeiro/fiscal e compensações antes de liberar. Jamais remover bloqueio por conveniência. |
| P0-05 | **CONFIRMADO** páginas de Caixa e Financeiro não fazem busca de API; DRE é inicializada em zero e Caixa mantém turno/saldos em memória. | Indicadores não representam o Neon; risco de interpretação financeira incorreta | Implementar leitura/ação sobre cash_shifts, cash_movements, contas e razão; estados de indisponibilidade explícitos. Não tratar zero como dado financeiro real. |
| P0-06 | **CONFIRMADO** checkout, registro de pagamento, cancelamento, devolução, pontos e caixa não estão homologados conjuntamente. | Inconsistência contábil e incentivo indevido | Exigir gate de integração ponta a ponta com transações reais isoladas em QA; não usar dados fictícios como evidência. |

### P1 — Módulos funcionais incompletos

| Módulo | Evidência no repositório | Recomendação senior |
| --- | --- | --- |
| Fidelidade / cashback | `master` não possui `apps/web/app/loyalty/page.tsx` e a ficha antiga usava REWARDS_CATALOG fixo, nível Bronze default e barra de 72%. Branch `feat/loyalty-cashback-enterprise-20261118` tem UI/APIs/migration distintas. | **Bloquear merge automático:** Neon principal possui `loyalty_settings`, branch alternativa prevê `loyalty_programs`; campos de contas/recompensas diferem. Escolher contrato canônico, criar migration incremental e backfill idempotente, testar os triggers e integrar a página por permissões. **Removidos dados fictícios da ficha na branch de auditoria.** |
| CRM | `apps/web/app/crm/page.tsx` mostra `window.alert` e botão de nova oportunidade desabilitado; Neon tem tabelas crm_*; existem branches separadas com APIs CRM. | Revisar branch CRM, reconciliar com master, ligar busca CRUD, funil/stages persistidos, atividades, lead → cliente → proposta → venda, datas/usuários, LGPD e escopo. |
| Caixa | `app/cash/page.tsx`: abertura, movimentos e turno sem API, ações indisponíveis. Neon tem cash_shifts, movements etc. | Abertura/fechamento e suprimento/sangria com usuário, filial, caixa, conferência cega, idempotência e auditoria. Conciliar com venda quitada. |
| Financeiro | `app/financial/page.tsx`: `dreData` fixado em 0; pagáveis/recebíveis iniciam vazios sem carregamento; botões Exportar/Novo Lançamento sem ações. Neon possui tabelas financial_* e contas. | DRE de ledger oficial, período e filial; Pagar/Receber, conciliação, lançamentos, contas bancárias, exportação real; ocultar dados sensíveis conforme permissão. |
| Manufatura | `app/manufacturing/page.tsx`: simulação de orçamento disponível, ordens/produção/refugos aguardam integração; Neon tem manufacturing_*. | Ficha técnica, orçamento, materiais/spools, reserva e consumo, ordem, execução, tempos, perdas, estoque, custo autorizado, histórico e QA. |
| Projetos | `app/projects/page.tsx`: CRUD e timesheet aguardam Neon; banco possui digital_projects, tarefas e timesheets. | CRUD transacional, horas/aprovação, milestones, custos, faturamento e visibilidade por equipe/cliente. |
| Mensagens | `app/messaging/page.tsx`: envio explicitamente indisponível sem Neon/Meta Cloud API. | Integração segura webhook + template consentido, opt-in LGPD, fila, retries, idempotência, delivery status, custos/limites e trilha. |
| Sócios | `app/partners/page.tsx`: cadastro bloqueado; banco possui partners e relacionamentos. | Governança: registro societário, aportes, mútuos, direitos de acesso, pagamentos, aprovações e auditoria; não liberar escrita direta sem workflows. |
| Estoque | `app/inventory/page.tsx` possui endpoints de saldos/kardex/depósitos e recebimento. | Testar reserva, saldo físico x disponível, depósito/filial, inventário, concorrência, movimentações imutáveis e integração venda/OS/compra. |
| Compras | `app/procurement/page.tsx` possui endpoints para pedidos/recebimentos/aparelhos usados. | Validar emissão, aprovação, recebimento, custos autorizados, entradas serializadas, fiscal, duplicidade e vínculo com estoque/financeiro. |
| Catálogo | `app/catalog/page.tsx` possui APIs reais. | Testar edição/OCC, SKU/IMEI, categorias/modelos, GTIN, preços, custos por permissão, erros 409, estoque e consulta paginada. |
| Assistência | `app/repairs/page.tsx` consome APIs; criação API não atômica e COUNT+1. | Corrigir P0-03; completar estados da OS, serviço/peça, garantia, laudo, aceite, checklist, evidências e reversão. |
| Fretes / frota | `app/fretes/page.tsx` e `/api/fleet/[...path]` usam APIs e permissões. | Testar veículos, viagens, abastecimento, manutenção, km, custo, vínculos com venda/OS/projeto e OCC. |
| Fiscal | `app/fiscal/page.tsx` consome config; endpoint catch-all retorna indisponibilidade 503 em ações não homologadas. | Manter fail-closed. Testar certificados, CSC, emissão real apenas com autorização/conciliação, eventos e retorno SEFAZ, sem inventar sucesso. |

### P1 — Segurança e integridade transversal

1. Migrar as rotas antigas (especialmente OS, procurement e outras que verificam JWT diretamente) para autorização canônica, permission keys e escopo tenant/filial. Autenticação **não substitui** autorização por ação.
2. Nunca expor CPF/CNPJ, custos, margem, emails, hashes, segredos ou inscrições fiscais apenas pela ocultação do HTML. Redigir no backend; auditar escopos em pesquisa/exportação.
3. Validar `Origin` / CSRF em toda mutação com cookies, TTL/revogação de sessão, tratamento de 401/403/409/422/500 e correlação de log.
4. Preferir transactions SQL ou CTEs atômicas para operações multientidade; indices UNIQUE para idempotência. Evitar `COUNT(*)+1` como gerador concorrente.
5. Proteger estados e arredondamentos monetários em centavos integer/numeric; teste de frações, 1x–12x e operações repetidas.
6. Evitar migrations paralelas com a mesma semântica. Branches de fidelidade têm schemas incompatíveis; nunca aplicar ambas cegamente.
7. Fazer revisão das políticas de roles, Effective Access e privilégio mínimo; nenhuma permissão pessoal hardcoded em migrations.
8. Auditar logs de produção sem gravar senhas, tokens, números integrais de documentos ou dados sensíveis.

### P2 — UX / Interface

- As páginas devem preservar o Design System HBVisionX; tela é gestão operacional, não landing page.
- Testar modal **Novo Cadastro Completo** em 388px, 768px, 1280px e 1920px: screenshot de 388px mostra conteúdo parcialmente fora da viewport. Adicionar max-width, largura responsiva, scroll e foco acessível.
- Forms precisam de validações por seção (não enviar parcialmente), mensagens próximas dos campos, estados loading/saving/saved, reenvio idempotente e preservar dados quando houver erro.
- Remover botões decorativos e indicadores artificiais. `app/page.tsx` anuncia 11 módulos como `READY_VERIFIED` apesar de fluxos bloqueados; substituir rótulos por estado verificável.
- Exibir 403/404/409 e retry adequados; ao receber OCC 409, pedir recarregamento, nunca sobrescrever.
- Não representar ausência de dados de API como saldo R$0,00, 0 pontos, nível Bronze ou “sem histórico” sem comprovação.

## Diagnóstico específico — Fidelidade / Cashback Enterprise

**Banco Neon principal, leitura 18/11/2026:** `loyalty_settings`, `loyalty_accounts`, `loyalty_rewards`, `loyalty_ledger`, `loyalty_redemptions` existem. Naquele momento, contas, recompensas, extrato e resgates tinham zero registros. Branch de QA `loyalty-gate-20261118` utiliza tabela `loyalty_programs` com contratos e tipos divergentes. Na principal foram encontradas 7 linhas em `sales`, em combinações de estados numéricos; não assumir pagamento quitado pela contagem.

**Contrato mínimo obrigatório:**
- política por tenant com habilitação, pontos por reais/centavos, categorias elegíveis, cap semanal/mensal, datas e versionamento;
- carteira por (tenant, cliente), proibindo saldo negativo e FKs compostas;
- ledger imutável, event key única por evento de pagamento, snapshots de regras e auditoria;
- pontos por pagamento liquidado real, não apenas venda criada; compensação por cancelamento, estorno e devolução parcial, inclusive quando já houver pontos resgatados;
- reservas de brindes com estoque, prazo/expiração, cancelamento e transição para entregue;
- vouchers/descontos resgatados com limites por venda, não cumulatividade e efeitos fiscais/financeiros **apenas após checkout homologado**;
- cashback distinguindo crédito de pontos (nunca dinheiro disponível para saque por inferência);
- permissões `loyalty.view/manage/redeem/fulfill` no backend e frontend, multi-tenant, filial, idempotência e OCC;
- integração visível na ficha de cliente e tela administrativa, sem catálogo fictício;
- consentimento, regulamento, prazo de validade, relatórios, trilha de usuário e antifraude.

**Teste de contrato:** (a) venda paga → 1 crédito; (b) webhook duplicado → 1 crédito; (c) cancelamento → compensação auditada; (d) 2 resgates simultâneos → no máximo saldo e estoque disponíveis; (e) outro tenant não lê/grava; (f) desconto bloqueado enquanto checkout não estiver homologado.

## Sequência de implementação recomendada

| Gate | Escopo | Saída esperada |
| --- | --- | --- |
| G0 | Build/typecheck, compilação, auth, adapter Neon, rotas de clientes | Todas as consultas legadas e novas funcionam; 0 erros TypeScript; 0 falhas de cadastro. |
| G1 | Segurança e OS | Sem bypass de tenant/permissions; cadastro OS atomicamente e sem duplicidade em concorrência. |
| G2 | PDV → pagamentos → estoque → caixa → financeiro | Teste de ciclo completo e reversão com evidências; sem habilitar status fictícios. |
| G3 | Fidelidade consolidada | Um esquema canônico, migração ensaiada em QA, saldo e resgates transacionais integrados aos clientes. |
| G4 | CRM, catálogo, estoque, compras, assistência | CRUD funcional, buscas, edição, OCC, loading, permission/tenant e audit trail. |
| G5 | Financeiro, Caixa, Fiscal, manufatura, projetos, frota, mensagens e sócios | Operações habilitadas somente com persistência real; teste de cada fluxo. |
| G6 | QA visual, regressão, logs e performance | Relatório de PASS/FAIL com screenshots em 4 resoluções, 401/403/409/500 e evidências de Neon. |
| G7 | Release Vercel | Deploy do SHA testado, smoke test autenticado, logs sem erros, rollback preparado. |

## Correções já versionadas na branch de auditoria (ainda não mescladas)

1. `apps/web/lib/serverless-db.ts`: compatibilização de `db(sql,params)`, `db.query(sql,params)` e `db.transaction([...])`.
2. `apps/web/app/api/parties/route.ts`: sessão/role/tenant canônicos, `guardOrigin`, paginação mais segura, acesso a documentos condicionado a permissão, cadastro atômico do PR #10 preservado.
3. `apps/web/app/api/parties/[id]/{addresses,equipments,status}/route.ts`: autorização e guards; status somente aceita booleano explícito.
4. `apps/web/app/parties/page.tsx`: remoção de recompensa, pontuação, nível e progressão simulados enquanto a fidelidade real não está integrada.
5. `.github/workflows/erp-serverless-integrity.yml`: gate independente de TypeScript e build Next.js; **não publica Vercel**.

**Atenção:** esse código foi versionado, mas ainda **não foi declarado homologado**. Restringir merge a PASS dos gates G0/G1; caso contrário, permanecer em branch para correção.

## Plano de homologação para amanhã

1. Confirmar que a Vercel aceita builds e que a conta correta tem acesso ao projeto `hbstudio`. Não criar outro projeto por engano.
2. Rodar CI GitHub da branch de auditoria, revisar logs e corrigir todo erro de TypeScript/build.
3. Criar/usar somente branch Neon QA isolada e migrar schema se realmente necessário; nunca usar production para dados de teste.
4. Autenticar com perfil de testes e testar POST/GET/PUT no Cliente; garantir reload persistido, 403 sem permissão, rollback e CPF duplicado.
5. Testar routes compartilhadas de login, `/api/auth/me`, catálogo, PDV, OS e fretes após o novo adapter.
6. Consolidar as branches antigas sob revisão; não usar merge automático de schemas conflitantes.
7. Se os gates estiverem PASS, fazer merge, build, release, smoke e observar erros 500.
8. Manter rollback pronto, incluindo migrações **reversíveis** e compatibilidade com versão anterior.

**Critério para declarar “ERP operacional completo”:** todos os módulos que aparecem como disponíveis devem passar CRUD real, autorização por ação, banco, multi-tenant/filial, idempotência/concorrência, auditoria, reversão e QA de interface; módulos ainda bloqueados devem constar explicitamente como indisponíveis.
