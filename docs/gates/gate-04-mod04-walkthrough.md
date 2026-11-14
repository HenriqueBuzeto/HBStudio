# Relatório de Homologação — Gate 04 | MOD-04: Procurement (Compras, Recebimento e Aquisição de Usados)

**Data de Execução:** 14/11/2026  
**Ambiente:** PostgreSQL 18.3 real (Porta 5433) | .NET 10 LTS | Next.js 16.4.6 App Router  
**Status do Gate:** `READY_VERIFIED`  
**Total de Testes Automatizados no Repositório:** 33/33 aprovados (100% de sucesso)  

---

## 1. Resumo Executivo e Escopo Entregue

O **MOD-04 (Procurement)** estabelece a governança completa da cadeia de suprimentos e compras da HB Studio, cobrindo:
1. **Requisições de Compra (`PurchaseRequest` / `PurchaseRequestItem`):** Ciclo completo `Draft` → `Submitted` → `Approved` | `Rejected` → `ConvertedToOrder` → `Cancelled`.
2. **Cotações com Fornecedores (`SupplierQuotation` / `SupplierQuotationItem`):** Comparação de preços, frete, tributos, prazos de entrega e condições de pagamento.
3. **Pedidos de Compra (`PurchaseOrder` / `PurchaseOrderItem`):** Snapshots históricos de código e descrição do SKU (`HistoricalSkuCode`, `HistoricalDescription`), impedindo alterações retroativas caso o catálogo sofra modificações posteriores; controle transacional de quantidades encomendadas, recebidas e pendentes (`QuantityOrdered`, `QuantityReceived`, `QuantityPending`).
4. **Conferência e Recebimento Físico (`GoodsReceipt` / `GoodsReceiptItem`):** Integração atômica e direta com o **MOD-03 (Inventory & Kardex)**. Não foram criadas tabelas paralelas de saldo: cada recebimento alimenta o ledger oficial append-only (`stock_movements`), a projeção materializada (`stock_balances`) e as posições de seriais (`serial_stock_positions`).
5. **Aquisição Balcão de Eletrônicos Usados (`UsedDeviceAcquisition`):** Fluxo para smartphones e PCs usados comprados de pessoas físicas ou jurídicas no balcão. Inclui laudo de checklist técnico (`ChecklistInspectionJson`), despesas atribuíveis (higienização, laudo), gravação da `InventoryUnit` oficial, índice central de identificadores de IMEI (`inventory_unit_identifiers`) e lançamento no Kardex com `StockMovementType.CustomerBuyback`.
6. **Devoluções a Fornecedores (`SupplierReturn` / `SupplierReturnItem`):** Baixa oficial de estoque com documento de devolução.
7. **Segurança e Proteção de Custos (`purchases.cost.view`):** Custo unitário, margem e valores totais financeiros são omitidos server-side no backend quando o usuário não possui a permissão requerida.

---

## 2. Evidências de Banco de Dados e Migrations Reais

### Migration Aplicada
- **Identificador:** `20261114052355_AddProcurementModule`
- **Tabelas criadas no PostgreSQL 18.3:**
  - `purchase_requests`
  - `purchase_request_items`
  - `supplier_quotations`
  - `supplier_quotation_items`
  - `purchase_orders`
  - `purchase_order_items`
  - `goods_receipts`
  - `goods_receipt_items`
  - `used_device_acquisitions`
  - `supplier_returns`
  - `supplier_return_items`
- **Total de tabelas no schema public:** 43 tabelas reais.

---

## 3. Cobertura de Testes Automatizados (xUnit)

A execução do comando `dotnet test` confirmou a aprovação de **33 testes de integração reais**:

```text
Execução de teste para C:\Users\HB Studio Dev\Documents\Site\HB Studio\tests\BuildingBlocks.UnitTests\bin\Debug\net10.0\BuildingBlocks.UnitTests.dll (.NETCoreApp,Version=v10.0)
Versão do VSTest 18.0.1 (x64)

Iniciando execução de teste, espere...
1 arquivos de teste no total corresponderam ao padrão especificado.

Aprovado!  – Com falha: 0, Aprovado: 33, Ignorado: 0, Total: 33, Duração: 3 s - BuildingBlocks.UnitTests.dll (net10.0)
```

### Detalhamento dos Testes do MOD-04:
1. `PurchaseRequest_Lifecycle_ShouldCreate_Submit_AndApprove`: Validação da máquina de estados da requisição de compra interna.
2. `PurchaseOrder_PartialAndFullReceipt_ShouldUpdateOrderAndKardex`: Teste de recebimento parcial (4 unidades) seguido de recebimento final (6 unidades), verificando a transição do status do pedido (`PartiallyReceived` → `Received`), atualização do saldo no `stock_balances` e geração das 2 linhas append-only no Kardex (`StockMovementType.PurchaseReceipt`).
3. `GoodsReceipt_Idempotency_ShouldNotDuplicateMovement`: Garantia de idempotência por `IdempotencyKey`, impedindo duplicidade física de recebimento ou movimentos duplicados no estoque.
4. `UsedDeviceAcquisition_ShouldInspect_Approve_CreateInventoryUnit_AndKardex`: Recompra de balcão de cliente com laudo técnico JSON, criação da `InventoryUnit` no catálogo com identificadores IMEI normalizados, atualização do `SerialStockPosition` e lançamento de `CustomerBuyback` no Kardex.
5. `SupplierReturn_ShouldDispatchAndDeductStock`: Devolução de itens com vício para o fornecedor com baixa no estoque e no Kardex oficial.
6. `CostProtection_UserWithoutPermission_ShouldNotSeeCostData`: Verificação de que usuários sem a claim `purchases.cost.view` recebem payloads com custos e totais mascarados como `null` pelo backend.

---

## 4. Frontend Next.js 16 (App Router)

- **Rota Implementada:** `/procurement` ([apps/web/app/procurement/page.tsx](file:///c:/Users/HB%20Studio%20Dev/Documents/Site/HB%20Studio/apps/web/app/procurement/page.tsx))
- **Abas Operacionais:**
  - Pedidos de Compra (com acompanhamento de entregas parciais e totais)
  - Conferência & Recebimento (com vínculo a NFs e Kardex)
  - Aquisição de Usados (Balcão) (com laudos técnicos, IMEI e grau estético)
  - Cotações com Fornecedores
  - Requisições Internas
  - Devoluções a Fornecedores
- **Build de Produção:** Aprovado via Turbopack (`npm --prefix apps/web run build` com 0 erros de compilação ou tipagem).
