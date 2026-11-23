# Gate — Crédito / Débito & Pix | Taxas reais da maquininha | 23/11/2026

**Projeto:** HB Studio ERP. **Branch:** `feat/acquirer-fees-net-receivables-20261123`. **PR:** #18, draft baseado na branch de integração geral, sem deploy. **Neon de produção intocado.**

## Objetivo funcional

O preço da venda ao cliente continua SEM juros em 1–18 parcelas. A empresa cadastra seu contrato real com cada adquirente (máquina física ou PSP), informando para cada modalidade as taxas de MDR, percentual **efetivo total** de antecipação sobre líquido após MDR, tarifa fixa e prazo estimado de repasse. O ERP nunca presume que o bruto entrará integralmente no banco.

Exibição de dois valores distintos:
- **Bruto comercial / recebido do comprador:** preço único acordado na venda, sem repassar custo financeiro.
- **Líquido previsto do estabelecimento:** bruto menos MDR, antecipação e tarifa fixa, calculado em centavos inteiros. É previsão até conciliação com extrato real.
- **Líquido liquidado (real):** somente valores com evento/snapshot SETTLED associado a comprovante verificável da adquirente; não se calcula a partir do configurador.

## Fontes técnicas e prática internacional

- Adyen Settlement details report: bruto, fees, advance fee, payout, liquidação e conciliação separados por conta: https://docs.adyen.com/reporting/settlement-reconciliation/transaction-level/settlement-details-report/
- Adyen accounting/reconciliation: relatórios de fees e acquirer external: https://docs.adyen.com/reporting/settlement-reconciliation/transaction-level/
- Stone parcelamento lojista e D+30 por parcela: https://online.stone.com.br/v3.4/docs/tipos-de-transa%C3%A7%C3%B5es
- Stone conciliação de parcelas, SalesFee (MDR + antecipação) e vencimento original: https://conciliacao.stone.com.br/reference/installments-layout-2_5
- Cielo tarifas variam por contrato/plano, Pix, débito e 1–18x: https://www.cielo.com.br/
- Stone antecipação: https://ajuda.stone.com.br/antecipacao-e-seus-beneficios

**Não copiar percentuais de sites promocionais.** Operadora, bandeira, tipo de cartão, plano, negociação, repasse D+1/D+30 e antecipação podem mudar os valores efetivos.

## Fórmula canônica do MVP

Valores inteiros em centavos, taxas em basis points (100 bps = 1%):
1. `mdr = round(grossCents * mdrBps / 10000)`
2. `afterMdr = grossCents - mdr`
3. `anticipation = round(afterMdr * anticipationBps / 10000)`
4. `netExpected = grossCents - mdr - anticipation - fixedFeeCents`

Arredondamento individual para centavos. Quando o provedor calcular MDR/antecipação por parcela, por dia, por bandeira ou por calendário de liquidação, essa regra deve ser expandida por um modelo específico de contrato. A tabela genérica aceita somente **taxa efetiva total** de antecipação, NÃO 'taxa ao mês'. Quando o contrato utilizar juros por mês, a empresa deve converter conforme o cálculo oficial do adquirente e conferi-lo em homologação antes de cadastrar a taxa efetiva.

**Exemplo estritamente demonstrativo de QA (não representa taxa real contratada):** R$ 6.499,00 em 18x; MDR 4,50%; antecipação efetiva 0,50% sobre o pós-MDR; tarifa fixa zero. MDR R$ 292,46; antecipação R$ 31,03; líquido esperado R$ 6.175,51. Cliente paga exatamente R$ 6.499,00 (parcelas divididas com centavos exatos).

## Persistência e governança

- `payment_acquirer_profiles`: adquirentes/terminais por TenantId+BranchId, com versão vigente e status.
- `payment_acquirer_rate_versions`: novas publicações incrementam versão com OCC e auditoria.
- `payment_acquirer_rate_rules`: **20 linhas** por versão: 1 Pix, 1 Débito, 18 Crédito. Cada modalidade pode ser habilitada/desabilitada; valor zero, se habilitado, é escolha explícita. Prazos D+0 a D+365 e repasse SINGLE/MONTHLY (sem falsa promessa de dia exato de crédito).
- `payment_acquirer_fee_snapshots`: estrutura de histórico para transações *verificadas* pelo checkout futuro, com bruto, taxas calculadas, líquido previsto, status EXPECTED / SETTLED / REVERSED e valor efetivamente conciliado quando SETTLED. O schema tem FKs compostas, restrições de soma e trigger anti-alteração de taxas. **A tela de configuração não insere snapshots, venda ou recebimento.**
- Triggers protegem versões e regras publicadas contra UPDATE/DELETE; todo ajuste de percentual cria uma nova versão.
- A política de publicação usa `finance.banks.manage`; consulta usa `finance.reports.view`; o PDV apresenta taxas somente se a sessão possuir `sales.pos.use` + `sales.cost.view` ou `finance.reports.view`.
- Tabela vazia por padrão na produção: **nenhuma taxa genérica se torna cobrança real sem cadastro manual explícito**.

## Telas e APIs

- `/financial/acquirers`: configuração de MDR, antecipação efetiva, taxa fixa, habilitação e D+ por modalidade, até 18x; simulação bruto × líquido; publicação versionada.
- `GET/POST/PUT /api/financial/acquirers`: listagem, criação e publicação de 20 regras atômicas com auditoria e optimistic concurrency (409 em conflito).
- `/sales`: parcelamento sem juros 1–18x e leitura de projeção adquirente por perfil (somente para usuários autorizados a visualizar custos). Se tabela ausente ou desabilitada, mostrar indisponível, nunca 0% presumido.
- `GET /api/sales/acquirer-fees`: cálculo *server-side* validado por tenant+filial, método, valor, parcelas e versão, sem checkout.
- `GET /api/financial/overview`: KPI separado bruto, taxas previstas, líquido previsto e líquido real SETTLED de snapshots persistidos. Se nenhum snapshot, informar ausência em vez de criar receita falsa.
- `apps/web/lib/pos-installments.ts`: 18 parcelas; `POST /api/sales/quotes` aceita 1–18 parcelas em orçamento, sem pagamento.

## Evidências Neon QA

- Migration aditiva aplicada em `qa-erp-integracao-20261123-todos-gates` (branch `br-withered-frost-b6aomdyr`): 8 comandos iniciais, 4 restrições de FKs adicionadas, 5 comandos de guardas/trigger.
- Perfil *Adquirente Simulada QA* criado exclusivamente em QA, 20 regras inseridas na v1, todas 18 linhas de crédito.
- Duas publicações concorrentes com `expectedVersion=1`: **1 versão 2 com 20 regras**, segunda solicitação não atualizou nada (OCC rejeita). Apenas versões 1 e 2 permanecem.
- UPDATE de taxa histórica e DELETE de versão publicada recusados pelo trigger.
- Nenhuma tabela de adquirente/fee alterada em Neon principal; nenhuma cobrança inventada.
- Workflow CI TypeScript, Next build e testes determinísticos de centavos: verificar resultado do último SHA antes de merge.

## Gate de pagamentos reais — ainda pendente

Não vincular `payment_acquirer_fee_snapshots` a uma venda não confirmada. A jornada de liquidação exigirá:
1. Captura/recebimento real com identificador da adquirente, bandeira, autorização/NSU e confirmação assinada/verificável; dinheiro em espécie possui outro contrato.
2. Snapshot imutável de tabela da data do pagamento (mesmo que o administrador altere a tabela depois); vinculado a `sale_payment_intents`, tenant/branch e evento único.
3. Reconhecimento financeiro separado de venda bruta, taxa financeira, recebível PSP e banco. Sem contabilizar 100% do bruto como dinheiro já depositado.
4. Conciliação de extrato ou API da adquirente (Pix, débito, crédito parcelado, antecipação, estorno/chargeback); calcular diferença previsto × recebido e gerar ajustes rastreáveis sem apagar histórico.
5. Contas a receber por parcela e calendário oficial de repasses; este MVP calcula divisão estimada, não datas oficiais de cada parcela.
6. Cancelamento e reversões financeiras com idempotência e trilhas imutáveis.
7. Testes 401/403, escopo multiempresa/filial, concorrência, payloads incorretos, 1–18x, arredondamento, navegadores, end-to-end PSP e relatórios.
8. Só mesclar na master e aplicar migration em produção após aprovação do gate global (branch PR #14).

**Situação:** Configurador real persistente + projeção financeira no PDV/Financeiro implementados em PR draft; pagamentos e conciliação reais não habilitados.
