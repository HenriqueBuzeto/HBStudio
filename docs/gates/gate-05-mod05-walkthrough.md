# Walkthrough — Gate 05 | MOD-05 Sales & PDV
**ERP Enterprise de Tecnologia — HB Studio**  
**Data:** 14/11/2026 | **Status:** `READY_VERIFIED` | **Total de Testes:** 39/39 PASS  
**Ambiente:** .NET 10 LTS · EF Core · PostgreSQL 18.3 (porta 5433) · Next.js 16.4.6 App Router · TypeScript · Tailwind CSS

---

## 1. Visão Geral do Módulo
O módulo **MOD-05 — Sales & PDV** implementa o ciclo comercial completo de ponta a ponta da HB Studio, cobrindo orçamentos comerciais, terminal PDV balcão, split de pagamentos (dinheiro, PIX, cartões), reserva atômica de aparelhos serializados por IMEI, baixa física exclusiva no Kardex e devoluções vinculadas com quarentena técnica obrigatória.

---

## 2. Cenários Automatizados e Comprovação (39/39 Testes)

### Cenário 1: Ciclo Comercial de Orçamento (Quotes)
* **Teste:** `SalesQuote_Lifecycle_ShouldCreate_Send_Accept_AndConvertToSale`
* **Comportamento:** Criação de proposta comercial com itens e snapshots de preço, envio formal, aprovação e conversão direta em venda comercial mantendo a rastreabilidade do `QuoteId`.

### Cenário 2: Fluxo Completo de PDV Balcão com Baixa no Kardex
* **Teste:** `Sale_CompletePDVFlow_ShouldReserve_PayCash_Fulfill_AndDeductKardex`
* **Comportamento:** 
  1. Criação do pedido com reserva em estado `Reserved`.
  2. Registro de pagamento com quitação total.
  3. Despacho/entrega com transição da `InventoryUnit` para `Sold` e emissão de lançamento imutável no Kardex sob `StockMovementType.SaleIssue`.
  4. Redução imediata do saldo físico no estoque materializado.

### Cenário 3: Disputa Atômica por IMEI Serializado (Concorrência Real)
* **Teste:** `SerializedSale_TwoSellersCompetingForSameImei_ShouldAllowOnlyOne`
* **Comportamento:** Dois vendedores em caixas simultâneos tentam bipar e reservar o mesmo iPhone (mesmo `InventoryUnitId`). Apenas uma transação obtém a reserva; a segunda é estritamente rejeitada por conflito de concorrência e estado da unidade, garantindo venda única.

### Cenário 4: Split de Pagamentos e Bloqueio Fail-Closed
* **Teste:** `Sale_SplitPayment_ShouldEnforceFullPaymentBeforeFulfillment`
* **Comportamento:** Venda de R$ 4.500 paga em duas parcelas (R$ 2.000 via PIX + R$ 2.500 no cartão). Qualquer tentativa de despacho prévia à quitação total é bloqueada com `InvalidOperationException`.

### Cenário 5: Devolução com Quarentena Física
* **Teste:** `SaleReturn_ShouldNotRestockUntilPhysicalInspection`
* **Comportamento:** Registro de devolução vinculada à nota/venda. A mercadoria serializada retorna ao estoque primariamente em estado `Defective` / `Quarantine`. Nenhum reabastecimento automático em saldo vendível ocorre sem laudo de inspeção técnica.

### Cenário 6: Proteção de Custo e Margem Bruta
* **Teste:** `CostProtection_UserWithoutPermission_ShouldNotSeeProfitMarginOrCost`
* **Comportamento:** Consulta da listagem de vendas sob perfil de vendedor sem `sales.cost.view`. Os campos `UnitCost`, `TotalCost` e `ProfitMargin` são zerados e higienizados na API backend.

---

## 3. Evidência de Execução de Testes
```
Execução de teste para C:\Users\HB Studio Dev\Documents\Site\HB Studio\tests\BuildingBlocks.UnitTests\bin\Debug\net10.0\BuildingBlocks.UnitTests.dll (.NETCoreApp,Version=v10.0)
Versão do VSTest 18.0.1 (x64)

Iniciando execução de teste, espere...
1 arquivos de teste no total corresponderam ao padrão especificado.

Aprovado!  – Com falha:     0, Aprovado:    39, Ignorado:     0, Total:    39, Duração: 9 s - BuildingBlocks.UnitTests.dll (net10.0)
```

---

## 4. Evidência do Build Frontend (Next.js 16)
```
▲ Next.js 16.4.6 (Turbopack)
✓ Running next.config.ts took 176ms
- Cache Components enabled
- Partial Prefetching enabled

  Creating an optimized production build ...
✓ Compiled successfully in 2.1s
  Running TypeScript ...
  Finished TypeScript in 3.3s ...
  Collecting page data using 10 workers ...
✓ Generating static pages using 10 workers (9/9) in 1440ms
  Finalizing page optimization ...

Route (app)
┌ ○ /
├ ○ /_not-found
├ ○ /catalog
├ ○ /inventory
├ ○ /parties
├ ○ /procurement
└ ○ /sales

○  (Static)  prerendered as static content
```

---

## 5. Homologação Arquitetural
O módulo **MOD-05 — Sales & PDV** cumpre integralmente os requisitos de integridade, isolamento multi-tenant, concorrência otimista, idempotência, Kardex imutável e proteção fail-closed.
