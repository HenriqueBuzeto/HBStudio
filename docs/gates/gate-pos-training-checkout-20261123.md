# Gate Enterprise — PDV de Treinamento e Checkout Real (23/11/2026)

## Situação da entrega
**Implementado nesta branch:** treinamento persistente, separado dos registros de venda/receita/estoque, acionado por Ctrl+F1; impressão em 58/80 mm/A4; histórico; cancelamento auditado. **Checkout comercial real ainda NÃO homologado.**

## Fronteira legal e funcional
- `Ctrl+F1` alterna SOMENTE `TREINAMENTO`, para qualquer operador com `sales.pos.use`; não altera o modo fiscal de vendas reais.
- Treinamento: pode selecionar qualquer cliente da empresa (ou consumidor não identificado), qualquer SKU ativo e o método de pagamento **apenas como dado simulado**; não exige turno, depósito nem estoque real.
- Uma simulação não comprova recebimento em dinheiro, Pix ou cartão. Não é parte do faturamento, DRE, Kardex, caixa, contas a receber ou obrigações tributárias.
- Venda real sem documento fiscal só pode ser permitida se houver dispensa aplicável confirmada na conclusão, por operação, emitente, cliente, produto e legislação vigente. Dinheiro e pedido do cliente para 'não emitir' NÃO constituem, isoladamente, dispensa da obrigação.
- Para venda fiscal aplicável: emissão regular homologada ou contingência fiscal legal; imprimir 'não fiscal' não pode fazer as vezes de NFC-e.

## Arquivos e contratos
- `db/migrations/20261123_pos_training_sales.sql`: tabela **`pos_training_checkout_records`** sem dependência de `sales`, com FKs compostas para empresa/filial/usuário/cliente, idempotência por `(TenantId,BranchId,RequestKey)`, preços capturados, status `SIMULATED/VOIDED`, trigger que impede reescrita e exclusão de snapshots históricos.
- `GET/POST /api/sales/training`: listar por filial e registrar simulação; revalida vendedor, cliente, SKUs, quantidades e preços diretamente no Neon; exige `sales.pos.use`, antifalsificação de origem e desconto sujeito a `sales.discount.override`; escritura simulação + evento auditável numa única consulta SQL.
- `PATCH /api/sales/training/[id]`: cancelar simulação com motivo de 4–500 caracteres; exige `sales.cancel` e auditoria; não gera estorno financeiro porque nenhum dinheiro foi recebido.
- `/sales`: Ctrl+F1 ativa simulação, botão vermelho, histórico separado, impressão e manutenção; o botão de venda real permanece bloqueado até haver checkout homologado.
- `/documents/print?kind=training-sale&id=...`: consulta dados do registro persistido, imprime em térmica ou A4 com marca obrigatória SIMULAÇÃO, sem QR/SEFAZ/recibo pago. Autorização por sessão e escopo.

## QA REAL na Neon isolada `br-withered-frost-b6aomdyr`
1. Foi detectado previamente `pos_training_sales` com schema diferente. A nova tabela recebeu nome separado para não aceitar `CREATE TABLE IF NOT EXISTS` como uma falsa homologação de modelo incompatível.
2. Aplicada a migration e 10 comandos de FKs, índices e trigger; sem writes no Neon principal.
3. Executada a CTE exata da API de treinamento: inserção da simulação `SIM-C7C311CC-624C-485E-B7C5-34DFAD11BE97`, com 1 SKU e total R$ 6.499,00; retorno `created:true`.
4. Repetição da mesma RequestKey e Hash: retorno da MESMA simulação `created:false`, contagem permanece 1.
5. UPDATE arbitrário de preço e DELETE do snapshot rejeitados pelo trigger `TRAINING_SNAPSHOT_IMMUTABLE` / `TRAINING_DELETE_FORBIDDEN`.
6. Cancelamento `SIMULATED -> VOIDED` com motivo e usuário permitido; tentativa posterior de alteração do snapshot deve ser rejeitada.
7. Para esse tenant na QA, havia zero registros nas tabelas comerciais `sales`, `cash_movements`, `stock_movements`, `financial_journal_entries` e `fiscal_documents`; simulação nunca as modificou.
8. No último SHA testado, 8 workflows no GitHub passaram (incluindo TypeScript, Next.js build e testes de BR formats e taxas de adquirente). Confirmar SHA de cada revisão no PR antes de publicar.

**Limitadores desta evidência:** os testes de SQL em QA foram realizados por consulta direta; não substituem E2E com cookies reais, motorista de impressão, permissões e CSP/browser. O ambiente QA contém outros fixtures de módulos anteriores.

## Ainda bloqueia o checkout real
- Depósito válido por filial, entrada física de estoque, ligação individual IMEI ↔ Kardex ↔ saldo, sem geração fictícia de saldos.
- Plano de contas do tenant com associações explícitas para caixa, recebíveis da adquirente, receita, estoque e custo; lançamentos dobrados por venda.
- Turno/cash register aberto por operador ou autorização delegada, movimentação de dinheiro auditada.
- Liquidação confirmada: Pix/cartão somente com PSP e comprovante verificável; dinheiro mediante registro de recebimento físico com permissões e conciliação de caixa.
- Uma única transação idempotente para venda, itens, estoque, caixa, razão/recebível e trilha de auditoria, além de estorno/devolução e reentrada com concorrência controlada.
- Fiscal obrigatório: credenciamento e emissão NFC-e/NF-e/NFS-e por natureza. Dispensa fiscal (quando comprovável) deve ser reavaliada por backend na transação final.
- Impressão de recibo real apenas após persistência transacional; nunca imprimir DANFE autorizado sem protocolo; cupom interno deve identificar corretamente a natureza da operação.
- Relatórios de vendas reais devem excluir `pos_training_checkout_records` de receita, lucro, comissões e impostos. Relatórios de treinamento ficam na aba independente.

## Gate de publicação
1. Revisão de segurança + E2E de POST, GET e PATCH com perfis 401,403,409,422; isolamento de empresas e filiais; repetição simultânea da mesma RequestKey; refresh e impressão dupla.
2. Testes em Windows Chrome/Edge e bobinas 58/80 mm; físico, driver, corte, QR (quando fiscal), falta de papel e fallback.
3. Migrations aplicadas em banco alvo APÓS backup/checagem de tabelas e ANTES de subir endpoints.
4. CI frontend+backend ASP.NET Core+Neon + smoke tests; a Vercel deve ter acesso ao projeto correto e builds disponíveis; não assumir deploy a partir de GitHub CI.
5. Manter PR #14 e PR de treinamento em DRAFT enquanto houver bloqueadores; não mesclar `master` nem afirmar produção operacional apenas pelo build.

## Referências oficiais
- NFC-e/SP: https://portal.fazenda.sp.gov.br/servicos/nfce/
- RC 29208/2024, dispensa MEI nas hipóteses legais: https://legislacao.fazenda.sp.gov.br/Paginas/RC29208_2024.aspx
