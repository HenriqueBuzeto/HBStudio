# Gate Enterprise — PDV de treinamento, Ctrl+F1, cupons e vendas reais

Data: 23/11/2026. Branch `feat/pos-training-safe-sales-20261123`, baseada em `integration/erp-end-to-end-20261123`.

## Implementado e verificável
- `Ctrl+F1` alterna o modo visual de treinamento (vermelho), para qualquer cliente, inclusive não identificado, somente para equipe com permissões canônicas de PDV.
- O botão `SIMULAR venda de treinamento` persiste um **registro de simulação** no Neon, com snapshot de preço validado no servidor, vendedor/cliente, meio de pagamento nominal, parcelas 1–18, desconto sob permissão e total em centavos.
- Os dados ficam em `pos_training_sales` e `pos_training_sale_items`, **não** em `sales`, `sale_items`, `sale_payment_intents`, `cash_movements`, `stock_movements`, `financial_journal_entries` ou `fiscal_documents`.
- Uma função SQL garante criação atômica dos itens, escopo tenant/filial, validação de SKU ativo, preço persistido e idempotência por requisição; duplicação da mesma chave não cria segunda simulação. Alteração do payload com mesma chave gera conflito.
- A aba `Simulações` mostra histórico e total **simulado**, explicitamente separado dos relatórios de vendas e receitas. Cancelamentos exigem `sales.cancel`, motivo e registro de quem/quando cancelou.
- Documentos 58/80mm e A4, PDF pelo diálogo e resumo WhatsApp, sempre com a indicação **SIMULAÇÃO, NÃO É VENDA, NÃO COMPROVA PAGAMENTO, NÃO É DOCUMENTO FISCAL E NÃO FOI ENVIADO À SEFAZ**.
- Autoimpressão usa a preferência local do terminal e `window.print()`, sem comprovar impressão física.

## Evidências QA
- Migrations de simulação aplicadas **somente** na Neon QA `br-withered-frost-b6aomdyr`.
- Simulação `SIM-C3063351AE6D48D0`: SKU de R$ 6499,00, um item, total R$ 6499,00. Repetição retorna `replayed=true`, conflito rejeitado.
- Consultas SQL de histórico, itens e dados de impressão PASS.
- Contagem QA durante verificação: 1 simulação, 0 vendas reais, 0 intenções de pagamento, 0 saídas Kardex para o tenant testado.
- CI TS, Next build, regressões de máscaras e taxas: confirmar resultado do SHA final antes de merge.

## Bloqueadores para a venda REAL
- Não é correto liberar um bypass universal não fiscal: São Paulo tornou NFC-e obrigatória em 01/01/2026 para o varejo em geral: https://portal.fazenda.sp.gov.br/servicos/nfce/
- A SEFAZ-SP reconhece dispensas legais específicas do MEI para vendas a pessoa física e operações com CNPJ sob condições: https://legislacao.fazenda.sp.gov.br/Paginas/RC29208_2024.aspx
- O pagamento em **dinheiro** e o cliente **não querer cupom** NÃO estabelecem dispensa automática.
- Para venda real com dispensa comprovada, implementar orquestração serializável e idempotente de estoque/IMEI, pagamentos efetivamente recebidos, turno de caixa, razão/contas, margens, devolução/cancelamento e revalidação fiscal no servidor na mesma operação. Sem dispensa legal, emitir NF-e/NFC-e quando aplicável.
- A filial testada tem SKU cadastrado porém estoque Kardex 0 e depósito não cadastrado. Não inventar entrada nem baixar unidade não disponível.
- O `POST /api/sales` permanece em fail-closed até o checkout REAL ter sido concluído e aprovado. Assim, dashboards de receita e DRE não contam simulações.
- Testes E2E autenticados multiempresa/filial, todos os perfis/escopos, CSRF, concorrência, restituição, falha PSP, impressoras físicas 58/80mm e A4 ainda necessários.

## Plano de deploy
1. Gate backend + frontend, QA contra Neon branch com migrations completas.
2. Confirmar acesso à equipe Vercel correta e liberar limite de build, conferindo SHA exato.
3. Avaliação legal/contábil do modo não fiscal REAL da filial.
4. Aplicar migrations com backup e rollback ANTES de publicar endpoints, nunca usar main Neon para testes destrutivos.
5. Smoke test autenticado e rollback sob erro. Não mesclar `master` nem anunciar produção 100% sem E2E e infraestrutura.
