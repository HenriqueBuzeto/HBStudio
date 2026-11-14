# Walkthrough — Gate 13: MOD-13 Gestão Societária, Capital Social e Governança (PartnersCapital)

**Data de Execução:** 14/11/2026  
**Ambiente:** Windows 11 · .NET 10.0 · Next.js 16.4.6 (Turbopack) · PostgreSQL 18.3 real (Porta 5433)  
**Status de Homologação:** `READY_VERIFIED`  
**Testes Backend:** 57/57 Aprovados (0 falhas)  
**Build Frontend:** Pass (12/12 rotas estáticas geradas com sucesso)

---

## 1. Visão Geral da Implementação

O **MOD-13 — PartnersCapital** consolida a estrutura societária da **HB Studio**, garantindo a governança patrimonial entre a pessoa jurídica e seus três sócios fundadores/investidores, com estrita observância ao princípio contábil da **Entidade/Separação Fiduciária**:

1. **Cap Table & Quotas (100.00% estrito):**
   - Modelagem de sócios vinculados ou não a entidades de `Parties` (MOD-01).
   - Validação matemática mandatória na criação e alteração de participações: a soma das participações societárias deve totalizar **exatamente 100.00%**.
   - Histórico temporal de quotas para rastreabilidade de entrada de novos investidores ou rearranjos.

2. **Aportes de Capital Social (Patrimônio Líquido):**
   - Subscrição e integralização de capital social vinculadas às contas de Patrimônio Líquido (`FinancialAccountType.Equity`).
   - Entrada direta em conta bancária oficial da HB Studio, **sem transitar pela DRE operacional** (aporte de sócio não é receita).

3. **Mútuos de Sócios (Passivo Exigível):**
   - Recursos emprestados pelos sócios à empresa entram como dívida da PJ no Passivo Circulante/Não Circulante (`FinancialAccountType.Liability`).
   - Amortização do saldo principal debita o passivo e credita o banco da empresa, **sem gerar despesa operacional na DRE**.

4. **Pró-Labore & Tetos Mensais:**
   - Remuneração pelo trabalho operacional dos sócios administradores.
   - Validação de teto mensal deliberado em ata;
   - Geração automática de títulos no **Contas a Pagar** do módulo Financeiro (MOD-12) e apropriação de despesa administrativa/operacional na DRE por competência.

5. **Distribuição de Lucros (Dividendos) com Prudência Fiduciária:**
   - Propostas de distribuição de resultados exigem:
     1. Apuração contábil na DRE gerencial do período com resultado líquido estritamente positivo (`NetResult > 0`);
     2. Limitação ao lucro real apurado (vedada distribuição de lucros fictícios ou sem base contábil);
     3. Aprovação formal com número de ata de reunião de sócios;
     4. Liquidação gerando títulos a pagar individuais por sócio proporcionais ao percentual de participação no Cap Table.

6. **Simulador de Prudência & Liquidez Livre:**
   - Avaliação algorítmica considerando: `Caixa Atual - Reserva Mínima de Capital de Giro`.
   - Bloqueio ou alerta de descapitalização caso o valor pretendido comprometa a continuidade operacional.

---

## 2. Evidências de Banco de Dados (EF Core Migration)

Migration aplicada com sucesso no PostgreSQL 18.3 real:
- **Migration ID:** `20261114165031_AddPartnersCapitalModule`
- **Tabelas criadas no schema `public`:**
  - `Partners`
  - `EquityParticipations`
  - `CapitalContributions`
  - `PartnerLoans`
  - `PartnerCompensations`
  - `ProfitDistributionProposals`
  - `ProfitDistributionItems`

---

## 3. Evidências dos Testes Automatizados (xUnit)

Execução realizada via `dotnet test tests/BuildingBlocks.UnitTests/BuildingBlocks.UnitTests.csproj`:

```text
Execução de teste para C:\Users\HB Studio Dev\Documents\Site\HB Studio\tests\BuildingBlocks.UnitTests\bin\Debug\net10.0\BuildingBlocks.UnitTests.dll (.NETCoreApp,Version=v10.0)
Versão do VSTest 18.0.1 (x64)

Iniciando execução de teste, espere...
1 arquivos de teste no total corresponderam ao padrão especificado.

Aprovado!  – Com falha:     0, Aprovado:    57, Ignorado:     0, Total:    57, Duração: 4 s - BuildingBlocks.UnitTests.dll (net10.0)
```

### Novos Testes do MOD-13 Adicionados à Suíte:
1. `PartnersCapital_CapTable_ValidatesExactHundredPercentTotal`: Valida aprovação de quotas somando 100% e rejeição estrita de composições divergentes (ex.: 90% ou 110%).
2. `PartnersCapital_CapitalContribution_IncreasesEquityWithoutImpactingDreRevenue`: Valida aporte de R$ 50.000,00 gerando débito em Banco, crédito em Patrimônio Líquido e comprova DRE com Receita Bruta = R$ 0,00.
3. `PartnersCapital_PartnerLoan_RecognizesLiabilityAndAmortizesWithoutDreExpense`: Valida empréstimo mútuo de R$ 20.000,00 no Passivo Exigível e amortização parcial sem impacto nas despesas operacionais da DRE.
4. `PartnersCapital_ProLabore_EnforcesCapAndGeneratesAccountPayable`: Valida geração de título a pagar para pró-labore dentro do teto mensal autorizado e bloqueio de tentativas de ultrapassar o limite.
5. `PartnersCapital_ProfitDistribution_RequiresPositiveDreProfitAndGeneratesProportionalPayables`: Valida exigência de lucro na DRE, trava contra distribuição com prejuízo ou superior ao lucro líquido, e geração de títulos a pagar proporcionais para cada sócio.
6. `PartnersCapital_ApiSecurity_RequiresPartnersCapitalPermissions`: Valida proteção dos endpoints HTTP `/api/partners/*` exigindo as permissões `partners.view`, `partners.manage` e `partners.distribute`.

---

## 4. Evidências do Frontend Next.js

Build de produção executado com sucesso: `npm --prefix apps/web run build`

```text
▲ Next.js 16.4.6 (Turbopack)
✓ Running next.config.ts took 160ms
- Cache Components enabled
- Partial Prefetching enabled

  Creating an optimized production build ...
✓ Compiled successfully in 2.3s
  Running TypeScript ...
  Finished TypeScript in 3.4s ...
  Collecting page data using 13 workers ...
  Generating static pages using 13 workers (12/12) in 1500ms
  Finalizing page optimization ...

Route (app)
┌ ○ /
├ ○ /_not-found
├ ○ /cash
├ ○ /catalog
├ ○ /financial
├ ○ /inventory
├ ○ /parties
├ ○ /partners
├ ○ /procurement
└ ○ /sales

○  (Static)  prerendered as static content
```

### Recursos da Interface (`/partners`):
- **Cap Table Visual:** Exibição dos três sócios (Estratégia 40%, Técnica 35%, Comercial/3D 25%), quotas e tetos de pró-labore.
- **Painel de Aportes & Mútuos:** Rastreio de integralizações e contratos de mútuo com saldo devedor e instrumento formal.
- **Pró-Labore & Governança:** Tetos mensais autorizados e integração contábil com Contas a Pagar.
- **Distribuições & Atas:** Histórico de propostas aprovadas em ata com repartição proporcional instantânea.
- **Simulador Interativo de Liquidez:** Cálculo em tempo real do teto prudencial (`Caixa - Capital de Giro Mínimo`) com parecer visual de segurança financeira.
