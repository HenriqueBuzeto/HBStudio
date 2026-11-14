# Walkthrough de Homologação — MOD-02: Catálogo Inteligente, SKUs e Unidades Serializadas (Usados)

**Data de Execução:** 14/11/2026  
**Status do Módulo:** `READY_VERIFIED`  
**Escopo:** Bounded Context `Catalog` & `InventoryUnit` — Modelagem de Famílias/Modelos comerciais, SKUs únicos por tenant, Rastreabilidade de Usados/Seminovos com IMEI 1/IMEI 2/Serial, Laudo técnico, Ocultação de Custo Real (`catalog.cost.view`), OCC via `xmin`, Migrations reversíveis no PostgreSQL 18.3 e Interface Next.js.

---

## 1. Resumo Executivo das Entregas

1. **Camadas do Domínio & Arquitetura Modular:**
   - Criados os projetos `Catalog.Domain`, `Catalog.Application` e `Catalog.Infrastructure` referenciados na Solution `HBStudioErp.slnx`.
   - Entidades de Domínio ricas:
     - `ProductCategory`: Categorias hierárquicas com prevenção de auto-referência cíclica e slug único por tenant.
     - `ProductBrand`: Gestão de marcas com controle de unicidade por tenant.
     - `ProductModel`: Modelo comercial (`Kind`: Standard, RawMaterial, SparePart, Service, Manufactured3D) e política de serialização (`StrictSerialized`, `Optional`, `None`).
     - `ProductSku`: Variação vendável com código SKU estritamente único por tenant (`IPH14PM-128-PURPLE`), código de barras EAN/UPC, atributos técnicos JSONB e controle de concorrência (`xmin`).
     - `InventoryUnit`: Unidade física individual com IMEI 1, IMEI 2 (SIM 2), Serial Apple/Fabricante, Condição (Novo, Usado, Recondicionado, Mostruário), Grau Estético (A, B, C), Saúde de Bateria %, Custo de Aquisição individual e Laudo Técnico.
2. **PostgreSQL Real & Migrations:**
   - Migration `20261114043649_AddCatalogAndInventoryUnitModule` gerada e aplicada com sucesso no cluster PostgreSQL 18.3 na porta 5433.
   - Total de 20 tabelas físicas no banco de dados.
   - Índices parciais únicos criados para `Imei1` e `Imei2` (`"Imei1" IS NOT NULL`) por `TenantId`, prevenindo entrada de aparelhos clonados ou cadastros duplicados.
3. **Segurança Fail-Closed e Segregação de Dados Sensíveis:**
   - O custo real de compra (`AcquisitionCost`) só é retornado se o usuário possuir explicitamente a claim de permissão `catalog.cost.view`. Caso contrário, o backend omite o dado como `null` (zero vazamento de margem de lucro para vendedores ou PDV).
   - Endpoints de escrita protegidos por `catalog.products.manage` e consultas por `catalog.products.view`.
4. **Tratamento de Concorrência Otimista (OCC):**
   - Alterações de preço de SKU e aprovação de unidades exigem `ExpectedVersion`, retornando HTTP 409 Conflict em colisões simultâneas.
5. **Frontend Integrado (Next.js App Router):**
   - Rota `/catalog` implementada em `apps/web/app/catalog/page.tsx` com tabs para **Modelos & Famílias** e **Aparelhos Usados & Serializados (IMEI)**.
   - Modais para cadastro de novo modelo e inclusão de aparelho usado com IMEI duplo, grau estético, saúde de bateria e laudo.
   - Botão para alternar visualização de custo real (com proteção visual e autorização).
   - Build estático de produção do Next.js aprovado (`npm run build`).

---

## 2. Evidências dos Testes Automatizados (xUnit)

A suíte de testes xUnit foi expandida de 17 para **22 testes de integração reais**, todos executados contra o cluster PostgreSQL 18.3 local:

```powershell
Execução de teste para BuildingBlocks.UnitTests.dll (.NETCoreApp,Version=v10.0)
Versão do VSTest 18.0.1 (x64)

1. CreateCategoryAndBrand_ShouldSucceed_AndPersistInPostgres [PASS]
2. CreateProductModel_WithUniqueSku_ShouldEnforceTenantScope [PASS]
3. RegisterInventoryUnit_WithDuplicateImeiInSameTenant_ShouldBeRejected [PASS]
4. InventoryUnit_AcquisitionCost_ShouldBeHidden_WhenUserLacksCatalogCostViewPermission [PASS]
5. OCC_SimultaneousSkuPriceUpdate_ShouldReturn409Conflict [PASS]
+ 17 testes do Gate 0 e MOD-01 [PASS]

Aprovado!  – Com falha: 0, Aprovado: 22, Ignorado: 0, Total: 22, Duração: 2 s
```

---

## 3. Evidências de Migrations e DDL no Banco de Dados

Tabelas do módulo Catalog criadas no schema `public`:
- `product_categories`
- `product_brands`
- `product_models`
- `product_skus` (índice único composto `TenantId` + `SkuCode`)
- `inventory_units` (índices parciais únicos para `TenantId` + `Imei1` e `TenantId` + `Imei2`)

---

## 4. Evidência do Build Frontend

```powershell
> web@0.1.0 build
> next build

▲ Next.js 16.4.6 (Turbopack)
✓ Running next.config.ts took 46ms
- Cache Components enabled
- Partial Prefetching enabled
✓ Compiled successfully in 724ms
✓ Generating static pages using 7 workers (6/6) in 1190ms

Route (app)
┌ ○ /
├ ○ /_not-found
├ ○ /catalog
└ ○ /parties
```

---

## 5. Próximos Passos
Com a catalogação, SKUs e unidades serializadas homologadas, o próximo passo é o **MOD-03: Estoque, Kardex Imutável e Almoxarifado Central**, conectando o ledger contábil de movimentações físicas (`stock_movements`) às unidades serializadas e aos lotes.
