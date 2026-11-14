# Walkthrough Técnico — Gate 3 | MOD-03: Estoque, Kardex Imutável, Almoxarifado, Reservas e Inventário Físico

**Data:** 14/11/2026  
**Status do Módulo:** `READY_VERIFIED`  
**Responsável Técnico:** Antigravity Architect & Senior Full-Stack Engineer  
**Commit de Entrega:** `feat(mod-03): implement inventory, immutable kardex, warehouses, reservations and physical stock count`

---

## 1. Visão Geral e Contexto de Engenharia

O **MOD-03** estabelece a autoridade central de posse física, rastreabilidade, movimentação e custeio de mercadorias da HB Studio. Em um modelo de negócio híbrido (varejo de eletrônicos novos e usados com rastreio de IMEI/Serial, peças e bancada de manutenção técnica, insumos fracionários e filamentos de manufatura 3D), o sistema de estoque não pode tolerar inconsistências de saldo, edições arbitrárias de estoque ou venda duplicada de itens serializados.

### Pilares Fundamentais do MOD-03

1. **Correção Prioritária do MOD-02 (Unicidade Global de Identificadores):**
   - Resolução definitiva de colisões entre `Imei1` e `Imei2` através da entidade `InventoryUnitIdentifier` (`inventory_unit_identifiers`).
   - Restrição única no PostgreSQL: `UNIQUE (tenant_id, identifier_type, normalized_value)`.
   - Impede terminantemente que um IMEI cadastrado como IMEI 1 no Aparelho A seja aceito como IMEI 2 no Aparelho B no mesmo tenant.

2. **Kardex Imutável (Append-Only Ledger - `stock_movements`):**
   - Nenhum saldo é alterado sem um registro formal no razão de movimentações.
   - Proibição absoluta de endpoints de `DELETE` ou `UPDATE` retroativo.
   - Todo movimento possui `MovementType`, `Quantity`, `UnitCost`, `TotalCost`, `BalanceAfterQuantity`, `DocumentReference`, `Reason` e `CreatedByUserId`.
   - Suporte a quantidades fracionárias com precisão decimal (`numeric(18,4)`) para consumo em gramas de filamento 3D.

3. **Projeção Materializada de Saldo (`stock_balances`):**
   - Agrupada por `(TenantId, BranchId, WarehouseId, WarehouseLocationId, ProductSkuId)`.
   - Distinção estrita entre:
     - **OnHandQuantity:** Físico real na prateleira/gaveta.
     - **ReservedQuantity:** Comprometido com pedidos/OS em andamento.
     - **BlockedQuantity:** Em quarentena ou perícia técnica.
     - **AvailableQuantity:** Disponível para venda (`OnHand - Reserved - Blocked`), com bloqueio fail-closed para saldo negativo.
   - Recálculo atômico de custo médio ponderado a cada entrada.
   - Concorrência garantida via token `xmin` / `uint Version`.

4. **Motor de Reservas Atômicas (`stock_reservations`):**
   - Alocação imediata de saldo com prevenção de over-selling e dupla reserva.
   - Máquina de estados: `Active` → `Consumed` | `Released` | `Expired`.
   - Vínculo exclusivo a `InventoryUnitId` para eletrônicos serializados.

5. **Transferências entre Armazéns e Filiais (`stock_transfers`):**
   - Fluxo auditado: `Draft` → `Submitted` → `InTransit` (baixa de origem) → `Received` (entrada no destino com propagação do custo).

6. **Inventário Físico & Reconciliação (`inventory_counts`):**
   - Apontamento cego ou comparativo de quantidades contadas vs saldo de snapshot do sistema.
   - Aprovação gerencial transacional gerando movimentos compensatórios no Kardex (`PositiveAdjustment` ou `NegativeAdjustment`).

---

## 2. Evidências de Banco de Dados e Migrations Reais

### Migration Aplicada no PostgreSQL 18.3
- **Migration:** `20261114045601_AddInventoryKardexAndStockModule`
- **Tabelas Criadas e Verificadas:**
  - `warehouses`
  - `warehouse_locations`
  - `stock_movements`
  - `stock_balances`
  - `serial_stock_positions`
  - `stock_reservations`
  - `stock_reservation_items`
  - `stock_transfers`
  - `stock_transfer_items`
  - `inventory_counts`
  - `inventory_count_items`
  - `inventory_unit_identifiers`

### Mapeamento Concorrência e Tipagem Numérica
- Precisão `numeric(18,4)` em quantidades e custos unitários para suporte a insumos fracionários.
- Colunas de concorrência mapeadas para o token de sistema `xmin` (`uint Version`).

---

## 3. Evidências de Testes Automatizados (xUnit)

A suíte completa de testes xUnit do ERP contém **27 testes aprovados** (100% de sucesso):

```
Iniciando execução de teste, espere...
1 arquivos de teste no total corresponderam ao padrão especificado.

Aprovado!  – Com falha:     0, Aprovado:    27, Ignorado:     0, Total:     27, Duração: 2 s - BuildingBlocks.UnitTests.dll (net10.0)
```

### Novos Testes do Módulo de Estoque (`InventoryModuleIntegrationTests`):
1. **`InitialReceipt_ShouldGenerateKardexAndMaterializeBalance`:**
   - Comprova a entrada inicial de estoque gerando atomicamente o registro append-only no Kardex e a projeção de saldo com custo médio e valorização total.
2. **`Reservation_ShouldBlockAvailableQuantityAndPreventOverReservation`:**
   - Comprova a reserva atômica bloqueando o saldo disponível, a rejeição imediata de sobre-reserva (over-selling) e a correta liberação/consumo com baixa no Kardex.
3. **`CrossImeiDuplicate_ShouldBeStrictlyRejectedByTenantIdentifierRegistry`:**
   - Comprova a resolução da integridade do MOD-02: rejeição estrita quando um IMEI usado no campo IMEI 1 de um aparelho tenta ser cadastrado no campo IMEI 2 de outro aparelho.
4. **`StockTransfer_BetweenWarehouses_ShouldUpdateKardexAndBalancesCorrectly`:**
   - Comprova a máquina de estados de transferências entre armazéns, despachando em trânsito com baixa na origem e recebimento no destino preservando o custo médio.
5. **`PhysicalInventoryCount_Reconciliation_ShouldPostKardexAdjustments`:**
   - Comprova a contagem física de inventário, o cálculo de divergências e a postagem transacional de ajustes no Kardex.

---

## 4. Evidências de Frontend Next.js

Build de produção do Next.js 16 compilado com sucesso sem erros de tipagem TSX ou hidratação:
```
▲ Next.js 16.4.6 (Turbopack)
✓ Compiled successfully in 1402ms
  Running TypeScript ...
  Finished TypeScript in 2.9s ...
✓ Generating static pages using 8 workers (7/7) in 1230ms

Route (app)
┌ ○ /
├ ○ /_not-found
├ ○ /catalog
├ ○ /inventory
└ ○ /parties
```

### Interface de Estoque (`apps/web/app/inventory/page.tsx`):
- **Dashboard Operacional:** Indicadores de On Hand, Reservas, Disponível para Venda e Valor Total do Estoque.
- **Proteção de Custo Fail-Closed:** Toggle para visualização ou ocultação de custos e margens sensíveis conforme `inventory.cost.view`.
- **Kardex Imutável:** Visualização em tabela com rastreamento por SKU, IMEI, tipo de movimento e saldo resultante.
- **Entrada / Carga Inicial:** Formulário completo para inclusão de mercadorias no Kardex.
- **Abas Especializadas:** Reservas, Transferências e Inventário Físico.
