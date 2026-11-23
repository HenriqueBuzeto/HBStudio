# Gate 3 — PDV, Pagamentos, Caixa e Financeiro Enterprise

**Data:** 23/11/2026. **Base:** `master` = `377895c`.
**Branch:** `feat/pos-cash-finance-enterprise-gate-20261123`.
**QA Neon:** `qa-stage3-cash-20261123-enterprise` (`br-lucky-tree-b6to7tq1`). **Produção: não alterada.**

## Diagnóstico confirmado

- `POST /api/sales` está deliberadamente bloqueado com `CHECKOUT_NOT_HOMOLOGATED`; preservá-lo até integração completa de venda/pagamento, estoque, caixa, financeiro e fiscal.
- `/api/sales/auxiliary` retorna `checkout:false` e `fiscalReady:false`; não inventar transações.
- `/cash` carregava indicadores em memória inicializados com 0, sem leitura e gravação real; botões desativados ou sem ação persistida.
- `/financial` apresentava DRE zero fixada em código, sem carregar razão, títulos e partidas, e botões decorativos.
- Neon possui cash_registers, cash_shifts, cash_movements, financial_journal_entries, financial_journal_lines, accounts_payable/receivable e registros reais. Os registros são dados do próprio banco, não evidências de fluxo de venda homologado.
- Status de venda existentes identificados em combinações numéricas (1/1, 2/1 e 5/4), sem concluir o significado financeiro a partir desses números.

## Entrega desta iteração

1. **Caixa — abertura real:** função `cash_enterprise_open_shift` com validação server-side, permissões `cash.open`, `guardOrigin`, tenant+filial, registrador ativo, linha de auditoria, saldo inicial, movimento de fundo e idempotência por request UUID.
2. **Concorrência:** índice parcial único de turno aberto por empresa/filial/caixa; advisory lock transacional para registro e chave; reenvio igual retorna a mesma operação; reenvio com dados diferentes é rejeitado.
3. **Caixa — movimentos:** nova função `cash_enterprise_move`, tabela `cash_movement_requests`, sangria e suprimento com direção e tipo corretos (4/1 para suprimento, 5/2 para sangria), validação de saldo, proteção contra saldo negativo, OCC e razão obrigatória; escritura `cash_movements` e `audit_events` atomicamente. Endpoint `POST /api/cash/movements` usa `cash.supply` / `cash.withdraw`.
4. **Caixa — leitura:** GET `/api/cash/overview` via `cash.shift.view`, saldos registrados no Neon e conferência simples com soma dos movimentos. Não confundir `CurrentBalance` com contagem física nem declarar caixa conciliado com o provedor de pagamentos.
5. **Caixa — frontend:** novo painel real com turnos, divergências, abertura com formulário responsivo, permissão efetiva, loading, erro e reenvio idempotente. Suprimento/sangria têm formulário de justificativa, valor real, proteção por operador/filial e atualização de saldo. Sangria, suprimento, fechamento cego e liquidação permanecem bloqueados até transações completas.
6. **Financeiro — leitura:** GET `/api/financial/overview` via `finance.reports.view`; títulos condicionados às permissões `finance.payables.view` / `finance.receivables.view`. Consulta limitada a 150 registros por tipo.
7. **Integridade contábil:** validação por lançamento da equivalência entre débitos, créditos, total registrado e quantidade mínima de partidas, sem escrever lançamentos automaticamente.
8. **Financeiro — frontend:** elimina DRE fictícia, mostra lançamentos reais e títulos autorizados. DRE permanece indisponível até homologar classificação do plano de contas, período e critérios de competência.
9. **CI independente:** GitHub Actions TypeScript + Next.js build, sem deploy Vercel.
10. **PDV:** checkout e emissão fiscal mantidos com fail-closed por segurança.

## Testes efetuados na branch Neon QA

- Migration aditiva aplicada com sucesso (tabela de idempotência, índice único parcial e função de abertura).
- Duas solicitações concorrentes usando a mesma chave, fundo R$ 127,50 → **mesmo CashShiftId**, 1 movimento de abertura e 1 evento de auditoria.
- Reutilização da chave com fundo diferente → rejeitada.
- Duas solicitações de suprimento de R$ 22,50 com mesma chave → mesmo movimento, saldo registrado passou de R$ 127,50 para R$ 150,00 uma única vez, 1 auditoria.
- Sangria de R$ 45,00 reenviada com mesma chave → 1 único movimento, 1 auditoria, saldo R$ 105,00.
- Tentativas com saldo esperado obsoleto e sangria superior ao disponível → rejeitadas.
- As consultas SQL do Caixa e Financeiro executaram sem erros em Neon QA.
- O padrão real de movimentos existente foi confrontado com tipos 1=abertura, 4=suprimento, 5=sangria; 1/2 são direções de entrada/saída.
- CI: TypeScript e build Next.js aprovados nos workflows stage3 e ERP para a versão com formulários reais (a última revisão do PDV exige revalidação do SHA).
- Fundo inicial, saldo, entradas e registro do movimento conferidos na base de QA.
- Nenhuma modificação no banco principal Neon nem alteração financeira de produção.
- Build e TypeScript pelo GitHub CI: consultar resultado do commit/PR antes de merge (não equiparar CI verde à homologação E2E).

## Pendências P0 para liberar o checkout

**Não fazer merge operacional que habilite PDV antes de:**

1. Definir contrato único para os estados de venda, intenções de pagamento, captura, liquidação, falha, reembolso, cancelamento e conciliação com o PSP. Não confiar em marcação manual como pagamento liquidado.
2. Checkout transacional com idempotência, disponibilidade de estoque com `SELECT FOR UPDATE`, reserva/baixa imutável no kardex, unidade serial/IMEI e vínculos tenant+branch. Separar *autorização* de *captura/liquidação* do pagamento.
3. Impedir baixas de estoque ou pontos de fidelidade em pedidos pendentes, falhos ou simulados; tratar devolução parcial e estorno compensatório.
4. Caixa: confirmar abertura/fechamento, turnos simultâneos por registrador, sangria e suprimento com dupla verificação/justificativa, conferência cega e diferença aprovada, eventos contábeis sem duplicidade.
5. Financeiro: confirmar partidas dobradas, plano de contas, contas a receber, conciliação de Pix/cartão, taxas e repasses com event IDs únicos.
6. Fiscal: emissão NFC-e/NF-e sob integração oficial, validação de autorizador, certificado, CSC e contingência. Não emitir DANFE antes de SEFAZ real.
7. Testes no QA com usuário autenticado: 401/403, concorrência, idempotência, 409, callbacks duplicados e fora de ordem, queda de rede, rollback, multi-tenant, multi-filial.
8. Integração com gamificação somente após pagamento confirmado, com ledger e estornos correspondentes.
9. Validar aplicação de migration em produção **antes** da API de abertura do Caixa; manter plano de rollback e monitoramento.

**Veredicto:** entrega parcial de base operacional de caixa (abertura, suprimentos, sangrias), diagnóstico de razão e títulos financeiros, sem homologação de fechamento, PDV, liquidação PSP, estoque ou fiscal. PR permanecerá draft até revisão de segurança, testes E2E e migração aprovada.
