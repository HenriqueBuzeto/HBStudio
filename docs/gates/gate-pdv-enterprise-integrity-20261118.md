# Gate Enterprise — Integridade do PDV e Orçamentos Vercel + Neon

**Data da auditoria:** 18/11/2026  
**Módulos:** `/sales`, `/cash`, Catálogo, Parties, RepairService, Fiscal  
**Decisão:** separar orçamento operacional de venda liquidada e NFC-e oficialmente autorizada.

## Diagnóstico crítico: estado anterior

| Problema identificado | Gravidade | Correção neste ciclo |
| --- | --- | --- |
| `POST /api/sales` emitia números de protocolo, chave e QR Code de NFC-e usando valores gerados localmente e gravava documento como autorizado sem SEFAZ | P0 | Endpoint de confirmação bloqueado em fail-closed. Nenhum dado fiscal é gerado |
| `POST /api/sales/[id]/cancel` alterava venda e documento fiscal diretamente no banco, chamando isso de cancelamento SEFAZ | P0 | Cancelamento desabilitado até evento oficial, protocolo, estorno e compensações transacionais |
| Inserts independentes para venda, itens, pagamentos e OS sem transação abrangente | P0 | Fluxo inseguro desabilitado; não registra pagamento, baixa de estoque ou entrega |
| `/sales/auxiliary` fabricava pontos de fidelidade e estabelecimento fiscal de exemplo | P1 | Dados somente das tabelas oficiais do tenant e filial. Não inventa pontuação |
| UI do histórico exibindo chave, protocolo e QR Code fixos | P0 | Removido; exibe somente dados efetivamente registrados |
| Parcelamento em 1–12x sem distribuição explícita de centavos | P1 | `distributeInstallments()` em centavos, testes em CI para todos os 12 cenários |
| OS ficticiamente importada para o carrinho com `ProductSkuId` fixo | P0 | OS pronta é somente consultável; faturamento indisponível até mapeamento formal de serviço e consumo de peças |
| `/cash` não tem turnos operacionais integrados para este tenant | P0 | Checkout bloqueado; nenhuma venda pode ser confirmada sem caixa e conciliação |

## Entrega implementada

- `GET /api/sales/auxiliary`: consulta real de clientes, vendedores, SKUs, estoque disponível por filial, OS prontas e turno aberto. Permissões canônicas e não vazamento de custos.
- `GET /api/sales`: histórico de vendas e pagamentos, com estados canônicos de domínio e isolamento da empresa/filial.
- `POST /api/sales/quotes`: cria orçamento com itens, vendedor e cliente reais, preço autoritativo do SKU, conferência de preço esperado (proteção contra atualização concorrente), desconto autorizado e auditoria; comando único no PostgreSQL.
- `GET /api/sales/quotes`: reconsulta os orçamentos após reload, de acordo com tenant/filial.
- `/sales`: busca de itens por nome/SKU/barcode, carrinho com quantidades, cliente/vendedor, OS para consulta, totais, desconto e parcelamento de 1x a 12x, orçamento imprimível explicitamente não fiscal.
- Nenhuma alteração automática nas tabelas de produção do Neon foi feita por esta entrega.

### Comportamento do parcelamento

- `R$ 1.200,00 / 12` → 12 parcelas de `R$ 100,00`.
- `R$ 1.200,00 / 10` → 10 parcelas de `R$ 120,00`.
- `R$ 1.000,00 / 3` → `R$ 333,34 + R$ 333,33 + R$ 333,33`.
- A soma das parcelas é idêntica ao total em centavos, sem arredondamento cumulativo.
- Os valores exibidos são **simulação sem taxas**. Taxas, política de parcelamento, autorização financeira e calendário de recebimento devem ser obtidos do provedor/adquirente.

## Próxima fase obrigatória — checkout efetivamente liquidado

1. Criar fluxo de terminal e turno real em `cash_registers`, `cash_shifts`, `cash_movements`, com abertura, sangria, suprimento, contagem cega, aprovação de diferença e fechamento.
2. Criar orquestrador de venda transacional e idempotente: validação de SKUs/IMEI, reserva de estoque, pagamento, conciliação, baixa Kardex append-only, snapshots históricos e emissão de recebíveis.
3. Integrar TEF/adquirente, Pix com E2E/PSP e cartão com NSU/código de autorização confirmados; permitir pagamento misto e 1–12 parcelas com regras tarifárias configuráveis. Nunca marcar cobrança paga somente porque a UI recebeu clique.
4. Implementar vínculo formal de OS e consumo de peças/serviços, com histórico, status e garantias.
5. Reutilizar o motor fiscal canônico (Zeus ou serviço fiscal equivalente homologado) para assinar XML, transmitir, consultar recibo/protocolo, formar DANFE NFC-e e receber eventos de cancelamento; nenhuma atualização de SQL substitui SEFAZ.
6. Somente após homologação E2E no banco e na SEFAZ homologação liberar o checkout fiscal em produção.

## Evidências e limitações

- Tabelas existentes no Neon: `sales`, `sale_items`, `sale_payment_intents`, `sales_quotes`, `sales_quote_items`, `parties`, `product_skus`, `stock_balances`, `repair_orders`, `cash_registers`, `cash_shifts`, `fiscal_documents`.
- Consulta não destrutiva no tenant da conta principal mostrou **1 SKU ativo**, **0 saldo de estoque**, **0 turnos de caixa** e **0 vendas**. O produto sem saldo pode constar de orçamento, que NÃO reserva estoque.
- Foi executado `EXPLAIN` sem escrita para validar a query PostgreSQL de orçamento.
- CI de TypeScript e build de produção foram/serão vinculados ao commit final desta PR. Testes reais de gravação, recibo fiscal e checkout ainda não foram executados.
- **Gate de venda definitiva:** `NOT_READY`.
- **Gate de NFC-e e cancelamento SEFAZ:** `BLOCKED_FOR_SAFETY`.
- **Gate de orçamento serverless:** `SOFTWARE_VERIFIED` após CI, `E2E_NOT_VERIFIED` até teste de criação/leitura real.

## Nota legal (SP)

O cancelamento de NFC-e em SP está sujeito ao prazo de 30 minutos contado **da autorização de uso**, observadas as condições legais (inclusive não ter havido saída da mercadoria), e depende da transmissão de evento oficial. Não basta editar o status no banco. Consulte a Portaria CAT 12/2015, art. 14, e as orientações atuais da SEFAZ-SP.

## Segurança

Todas as operações serverless exigem JWT válido, `SecurityStamp` coerente, conta e sócio ativos, permissão efetiva `sales.pos.use` / `sales.create` e controles de tenant/filial. Mutações verificam Origin/Sec-Fetch-Site. Nenhum token é enviado ao navegador ou armazenado em localStorage.
