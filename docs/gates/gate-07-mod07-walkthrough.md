# Evidência Técnica de Homologação — Gate 07: MOD-07 Assistência Técnica & Ordens de Serviço (RepairService)

**Data de Execução:** 15 de Novembro de 2026  
**Status do Gate:** `READY_VERIFIED`  
**Escopo:** Assistência Técnica, Ordens de Serviço, Bancada de Laboratório, Checklists, Diagnósticos, Orçamento Prévio (CDC Art. 40), Baixa Imutável de Peças no Kardex do Estoque e Garantias (CDC Art. 26).

---

## 1. Sumário Executivo & Princípios Arquiteturais Atendidos

O módulo **MOD-07 (RepairService)** foi implementado em estrita observância aos pilares do HBVisionX e do Código de Defesa do Consumidor (Lei 8.078/1990):

1. **Separação Rigorosa de Custódia vs. Estoque Mercantil:**
   - Equipamentos de clientes (`CustomerEquipment` pertencente a `Parties.Domain`) entram no laboratório sob custódia transitória e **nunca** geram registros em `InventoryUnit` nem afetam saldos de estoque da loja.
2. **Orçamento Prévio Discriminado (CDC Art. 40):**
   - Discriminação expressa entre peças (`Part`) e serviços/mão de obra (`Labor`). Nenhuma intervenção é iniciada sem aprovação prévia do cliente (`ApprovedByCustomer`).
3. **Consumo Rastreável de Peças via Kardex Oficial:**
   - O consumo de componentes no reparo aciona o serviço transacional oficial do `Inventory`, gravando lançamento imutável com baixa contábil e documental (`OS-{orderNumber}`).
4. **Ciclo Completo com Checklists & Garantias Legais (CDC Art. 26):**
   - Checklists de entrada (com histórico de avarias físicas preliminares para proteção jurídica contra litígios) e saída (inspeção de qualidade QA).
   - Termo de entrega com contagem de 90 dias de garantia legal obrigatória para bens duráveis, extensível por garantia contratual HB.

---

## 2. Testes de Integração Backend Aprovados (100% Sucesso)

Executados contra instância real do **PostgreSQL 18.3**:

```text
Execução de teste para BuildingBlocks.UnitTests.dll (.NETCoreApp,Version=v10.0)
Versão do VSTest 18.0.1 (x64)

1 arquivos de teste no total corresponderam ao padrão especificado.
Aprovado!  – Com falha:     0, Aprovado:    60, Ignorado:     0, Total:    60, Duração: 5 s
```

### Testes Específicos do MOD-07:
1. `RepairService_CustomerEquipment_DoesNotAlterCommercialInventory`:
   - Comprova que a abertura de OS para um aparelho do cliente não altera o balanço de inventário nem adiciona itens ao catálogo mercantil.
2. `RepairService_Security_RequiresRepairsPermissions`:
   - Valida que todas as operações (`repairs.read`, `repairs.write`, `repairs.approve`) exigem tokens JWT corporativos com escopos específicos.
3. `RepairService_CompleteLifecycle_FromIntakeToDeliveryAndWarranty`:
   - Executa o ciclo completo de ponta a ponta: Abertura da OS $\rightarrow$ Checklist de Entrada $\rightarrow$ Atribuição de Técnico $\rightarrow$ Início e Conclusão de Diagnóstico $\rightarrow$ Orçamento discriminado $\rightarrow$ Aprovação formal $\rightarrow$ Consumo de Peça com baixa de estoque $\rightarrow$ Inspeção de Saída $\rightarrow$ Conclusão $\rightarrow$ Entrega ao cliente com prazo legal de 90 dias.

---

## 3. Frontend Next.js 16 (Turbopack)

Página construída em `apps/web/app/repairs/page.tsx` com compilação e tipagem rigorosa:

- **Métricas em tempo real:** Ordens ativas, em diagnóstico, aguardando aprovação CDC, em bancada e prontas para retirada.
- **Tabela/Kanban operacional:** Filtros por status, busca por IMEI, cliente, modelo e número de OS.
- **Gaveta lateral de inspeção e gestão técnica:**
  - *Laudo & Ficha:* Histórico do equipamento, senhas laboratoriais autorizadas e causa raiz.
  - *Checklists:* Itens testados (OK, Avariado, Não Funciona, Não Testado) com histórico de entrada e saída.
  - *Orçamento (CDC Art. 40):* Totalizadores discriminados de peças e mão de obra com status de aprovação.
  - *Peças & Kardex:* Detalhamento de peças aplicadas com validação de baixa no inventário.
  - *Garantia (CDC Art. 26):* Cálculo de dias de garantia legal e contratual com emissão de termo de retirada.

**Evidência de Build:**
```text
Route (app)
├ ○ /cash
├ ○ /catalog
├ ○ /financial
├ ○ /inventory
├ ○ /parties
├ ○ /partners
├ ○ /procurement
├ ○ /repairs
└ ○ /sales
✓ Generating static pages using 14 workers (13/13) in 1652ms
```
