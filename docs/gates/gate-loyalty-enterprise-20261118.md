# Gate Enterprise — Clube HB / Fidelidade, Gamificação & Cashback em Pontos

**Data:** 18/11/2026  
**Arquitetura:** Next.js 16 (Vercel Node.js Functions) → Neon PostgreSQL, sem Docker, Railway ou backend .NET hospedado.  
**Escopo:** cadastro de benefícios, contas por cliente, extrato, reservas, cancelamentos, entrega de brindes e pontuação originada de venda paga.

## Regra de negócio canônica

1. **Uma compra NÃO gera pontos** apenas por existir orçamento, carrinho, reserva, pedido, tentativa de pagamento ou NFC-e.
2. Pontos são gerados somente quando `sales.Status IN (Confirmed=4,Fulfilled=5)`, `sales.PaymentStatus=Confirmed(4)`, `ConfirmedAtUtc IS NOT NULL`, o cliente `parties` pertence ao mesmo tenant e está ativo, e a soma dos `sale_payment_intents` com status `Confirmed(2)` e timestamp real de confirmação cobre integralmente o valor da compra.
3. A política inicial configurável é **1 ponto por R$ 5,00 pagos**, baseada em inteiros de centavos. O sistema utiliza floor para compras fracionadas. Cada empresa ativa sua política explicitamente, com `EnabledSinceUtc`; não existe pontuação retroativa.
4. Uma venda tem evento único `SALE_EARN:{SaleId}` com `UNIQUE(TenantId,EventKey)`. Atualizar status/pagamento novamente não duplica pontos.
5. Cancelamento, devolução total e reembolso finalizado inserem evento compensatório `SALE_REVERSAL`. Devolução parcial aprovada (`sale_returns.Status=2`) estorna proporcionalmente conforme itens restituídos e saldo de pontos ainda não reverso.
6. A conta pode ficar temporariamente negativa após devolução de compra cujo crédito já foi gasto. O sistema bloqueia novos resgates até que exista saldo suficiente. Nunca apaga histórico de pontos.
7. `loyalty_accounts` guarda o saldo corrente em BIGINT, e `loyalty_ledger` guarda a trilha imutável. Todas as alterações de saldo acontecem na mesma transação do lançamento, sob travamento da linha da conta.
8. Recompensa: `GIFT`, `DISCOUNT_FIXED` ou `DISCOUNT_PERCENT`, pontos requeridos, disponibilidade opcional e flag ativo/inativo.
9. Resgates transacionais usam a função `loyalty_reserve_reward`, chave de idempotência única e travamentos para impedir saldo negativo por concorrência e sobre-reserva do limite. O estado inicial é `RESERVED`.
10. Cancelamento da reserva devolve pontos e disponibilidade, lançando `REDEMPTION_REFUND`. Entrega de brinde `GIFT` exige permissão administrativa e registro textual da evidência. Registro de entrega não implica baixa automática do estoque físico.
11. **Vouchers e descontos são apenas reservas**, não alteram `sales.DiscountTotal` e não constituem cashback financeiro recebido. A aplicação no PDV ficará indisponível até o coordenador transacional real de checkout/caixa/Kardex ser homologado. Nunca representar venda como concluída.
12. Todo acesso exige JWT e SecurityStamp atuais, vínculo societário ativo, autorização formal `loyalty.view`, `loyalty.manage`, `loyalty.redeem`, tenant validado, CSRF em mutações e auditoria administrativa.

## Banco e implantação

- Migração SQL aditiva: `db/migrations/20261118_loyalty_enterprise.sql`.
- Tabelas: `loyalty_settings`, `loyalty_accounts`, `loyalty_rewards`, `loyalty_redemptions`, `loyalty_ledger`.
- Gatilhos: confirmação de venda, pagamento, cancelamento/reembolso, devolução parcial e imutabilidade do extrato.
- Trigger de integridade exige que todas as associações de cliente/benefício/venda/resgate usem o mesmo tenant.
- Chaves granulares adicionadas ao `PermissionCatalog.cs`. Grant inicial SOMENTE aos papéis que já detêm `access.manage`; nomes de cargos não concedem permissões.
- **Nenhuma tabela antiga foi excluída, apagada, truncada ou sobrescrita. Nenhum cliente/recompensa de demonstração foi inserido na base oficial.**

## API Vercel

| Rota | Métodos | Acesso |
|---|---|---|
| `/api/loyalty/overview` | GET | loyalty.view |
| `/api/loyalty/settings` | GET, PUT | loyalty.view / manage |
| `/api/loyalty/rewards` | GET, POST | loyalty.view / manage |
| `/api/loyalty/rewards/[id]` | PATCH | loyalty.manage |
| `/api/loyalty/customers` | GET | loyalty.view |
| `/api/loyalty/customers/[id]` | GET | loyalty.view |
| `/api/loyalty/redemptions` | GET, POST | loyalty.view / redeem |
| `/api/loyalty/redemptions/[id]` | PATCH | loyalty.manage |

A UI HBVisionX está em `apps/web/app/loyalty/page.tsx`, acessível no menu `Gamificação & Fidelidade`. O painel individual em `apps/web/components/CustomerLoyaltyPanel.tsx` substitui os sete brindes estáticos em `/parties` e consulta extrato e recompensas reais por `PartyId`. O PDV exibe saldo real de pontos, quando o operador tem `loyalty.view`, mas segue bloqueado para liquidação de venda.

## Evidências de homologação no Neon isolado

**Branch de testes:** `qa-loyalty-20261118` (não é o branch principal).

- Migração integral executada na branch Neon isolada sem alterações em dados produtivos.
- Venda sintética no branch QA com total de **R$ 1.200,00**, pagamento status confirmado: o trigger gerou **240 pontos**, 1 único evento `SALE_EARN`.
- Brinde de QA de 20 pontos: o resgate debitou o saldo para 220 pontos e reservou 1 unidade do benefício.
- Repetição com a mesma chave de idempotência: retornou o **mesmo ID**, sem segunda reserva nem novo débito.
- Cancelamento da reserva: saldo retornou para 240 pontos e alocação retornou a zero.
- Cancelamento da venda: saldo passou a zero com 1 evento de reversão.
- Venda antiga pré-ativação inserida na branch QA e liquidada depois: **0 pontos creditados**.
- Todos esses registros são exclusivos da branch temporária do Neon e não existem no banco oficial.

**CI:** `.github/workflows/loyalty-enterprise-gate.yml` executa TypeScript, Next.js produção e regressão .NET com PostgreSQL efêmero no GitHub. Contêiner de testes no runner **não é Docker de produção**, o deploy permanece Vercel + Neon.

## Limitações honestas e gates de lançamento

- **A aplicação financeira de descontos em vendas está bloqueada**, porque o checkout do PDV continua `CHECKOUT_NOT_HOMOLOGATED`. A futura liquidação deverá consumir a reserva de forma atômica, com trava, anti-replay, teto de desconto, persistência na venda, contabilização e compensação de cancelamento/estorno.
- **Brindes físicos não realizam automaticamente baixa Kardex**, porque o fluxo de movimentação fiscal/estoque deve seguir a integração canônica. A entrega manual é rastreada, sem fingir movimentação.
- O painel `/parties` ainda tem uma dependência legada de `forwardToBackend` para listagem/CRUD de clientes no Vercel; o novo módulo `/loyalty` consulta os clientes diretamente no Neon. A correção completa desse fluxo pertence ao gate Parties.
- LGPD: nenhuma campanha de marketing é autorizada implicitamente; opt-in, canal e finalidade devem ser consultados no módulo de consentimento antes de comunicação.
- Expiração de pontos, segmentação de campanhas e níveis Bronze/Prata/Ouro/Diamante ainda dependem de políticas de negócio explícitas; **nenhum limite fictício** foi introduzido.
- O status `PRODUCTION_FINANCIAL_CASHBACK_READY` permanece **false**; o programa opera como fidelidade por pontos e reserva de recompensas, não como carteira monetária liquidável.

## Conferência após deploy

1. Faça login novamente para carregar as novas permissões efetivas e abra `/loyalty`.
2. Na aba Configuração, habilite a política (por padrão na tela: **R$ 5,00 / 1 ponto**). Nenhuma venda antiga será pontuada retroativamente.
3. Cadastre o brinde ou desconto real, sem seeds, e confirme que aparece na listagem do Neon após F5.
4. Consulte um cliente existente. O saldo inicial deve ser 0, a menos que haja eventos reais de vendas confirmadas.
5. Teste reserva com saldo suficiente somente em ambiente de homologação e veja `loyalty_ledger` e `loyalty_redemptions`.
6. Confirme que nenhum desconto reservado modifica `sales`, `stock_balances` ou emissão SEFAZ.

**Veredito:** módulo de fidelidade e resgate implementado com controle de saldo real; integração de liquidação de cashback/checkout ainda bloqueada por segurança.
