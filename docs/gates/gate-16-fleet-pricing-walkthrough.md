# GATE-16 — HOMOLOGAÇÃO ENTERPRISE: FRETES, FROTA E PRECIFICAÇÃO INTELIGENTE

**Status:** `READY_VERIFIED`  
**Data:** 16 de Novembro de 2026  
**Auditoria Sênior:** Homologação Complementar Aprovada  
**Stack:** .NET 10 • PostgreSQL 18.3 • Next.js 16 (App Router) • Tailwind CSS  
**Regressão Automatizada:** 82/82 testes aprovados (100% verdes)

---

## 1. Resumo Executivo da Auditoria & Correções Aplicadas

Em resposta à auditoria crítica da diretoria da **HB Studio**, realizamos o pente-fino arquitetural e contábil, sanando todas as ambiguidades e garantindo alinhamento estrito com os princípios contábeis do CPC 16(R1) e a estratégia comercial da empresa:

### A. Segregação Absoluta entre Desconto de Compra e Desconto de Venda
- **Desconto-Alvo de Compra (`TargetAcquisitionDiscountRate` - ex: 15%):**
  - Utilizado exclusivamente para gerar a **proposta-alvo de aquisição** ao captar celulares usados (ex: celular anunciado a R$ 1.000 -> oferta de R$ 850).
  - **NÃO** concede e nem altera o desconto de venda no balcão/PDV. O custo histórico registrado no estoque é sempre o valor efetivamente pago.
- **Desconto Comercial Máximo de Balcão (`MaxCounterDiscountRate` - ex: 5% a 10%):**
  - Parâmetro independente no `ProductPricingPolicy`.
  - Limita a margem máxima de flexibilização do vendedor no PDV.
  - O sistema calcula o preço piso de corte (`MaxCounterDiscountPrice`).
- **Margem Mínima Blindada (`TargetMinMarginRate` - ex: 15%):**
  - Se o desconto de balcão fizer a margem líquida cair abaixo do piso configurado, o sistema corta no valor que assegura a rentabilidade estrita, impedindo vendas com prejuízo.

### B. Conformidade Contábil com o CPC 16(R1) / IAS 2
- **Fretes de Aquisição / Retirada (`UsedDeviceAcquisition` e `ProcurementOrder`):**
  - São custos diretamente atribuíveis à colocação do item em condição de venda.
  - Incorporam formalmente o custo oficial no estoque serializado (`InventoryUnit.IncorporateFreightCost`).
- **Fretes de Entrega a Clientes (`SalesDelivery`):**
  - São despesas comerciais e de distribuição.
  - O sistema **bloqueia estritamente** a tentativa de capitalização de fretes de entrega no estoque, exigindo que sejam lançadas como despesas operacionais no DRE (`Financial`).
- **Sem Duplicidade Contábil:**
  - O rateio da viagem não gera novo desembolso nem nova conta a pagar no Financeiro.
  - A despesa original (abastecimento, pedágio) é liquidada uma única vez. O rateio é apenas um apontamento de custeio por absorção.

### C. Visualização no Cadastro de Produtos e Catálogo
- Tela `/catalog`: Na aba "Aparelhos Serializados (IMEI)", a visualização de custo agora decompõe explicitamente:
  - **Custo Compra (NF/Recibo de Aquisição)**
  - **Frete Rateado (CPC 16)**
  - **Custo Estoque Oficial (`TotalInventoryCost = AcquisitionCost + AllocatedFreightCost`)**
  - **Preço Sugerido (com Markup de 30%)**
  - **Preço Aprovado de Venda**
- Aba `/fretes`: Painel completo com as três variáveis exibidas de forma independente: *Desconto Compra Usado (15%)*, *Markup Revenda (30%)*, *Desconto Máx. Balcão (5%)* e *Rentabilidade no Pior Cenário de Balcão*.

---

## 2. Evidência dos Testes Automatizados (82/82 Aprovados)

Execução realizada no framework xUnit / .NET 10:

```text
Execução de teste para C:\Users\HB Studio Dev\Documents\Site\HB Studio\tests\BuildingBlocks.UnitTests\bin\Debug\net10.0\BuildingBlocks.UnitTests.dll (.NETCoreApp,Version=v10.0)
Versão do VSTest 18.0.1 (x64)

Iniciando execução de teste, espere...
1 arquivos de teste no total corresponderam ao padrão especificado.

Aprovado!  – Com falha:     0, Aprovado:    82, Ignorado:     0, Total:    82, Duração: 13 s - BuildingBlocks.UnitTests.dll (net10.0)
```

### Novos Testes e Asserções Auditadas:
1. `Vehicle_Registration_And_Trip_DistanceCalculation_Succeeds`
2. `Quick_Fueling_Without_Liters_Registers_Expense_And_Updates_Financial`
3. `Maintenance_OilChange_Evaluation_And_Execution_Updates_Plan_Properly`
4. `EndToEnd_Trip_Allocation_To_Acquired_Device_And_Price_Suggestion_Workflow`:
   - Validado que proposta de compra de R$ 850 (15% de desconto) não reduz o preço de venda.
   - Validado que o markup de 30% gera o preço sugerido arredondado de R$ 1.523,90.
   - Validado que o desconto máximo de balcão (5%) calcula R$ 1.447,70, garantindo a margem líquida da empresa.
   - Validado que o frete real de R$ 42,00 é incorporado ao estoque e o status da sugestão é aprovado com atualização no SKU.
