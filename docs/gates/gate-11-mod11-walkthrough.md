# Gate 11 Walkthrough — MOD-11: DigitalProjects (Projetos Digitais, Contratos, Escopo, Entregáveis, Tarefas, Horas, Custos, Aprovações, Faturamento e Rentabilidade)

## 1. Visão Geral do Bounded Context
O **MOD-11 — DigitalProjects** implementa a esteira completa de engenharia de software sob medida, consultoria técnica, design digital, modelagem 3D e contratos de sustentação para a operação da **HB Studio**. O módulo opera em estrita conformidade com os princípios da governança contábil (**CPC 47 / IFRS 15 - Receita de Contrato com Cliente** e **CPC 16(R1) - Valoração de Custos**) e jurídica (**Lei nº 9.609/1998 - Software** e **Lei nº 13.709/2018 - LGPD** na figura de Operadora de Dados).

---

## 2. Auditoria e Resolução do MOD-10 (Manufacturing3D)
Conforme exigido na auditoria do MOD-10, foi implementada a segregação contábil estrita entre **perdas normais** e **perdas anormais** de manufatura:
1. **Perdas Normais**: Integram o custo de produção capitalizável (`CapitalizableProductionCost`), sendo rateadas sobre as unidades boas acabadas e incorporadas ao valor de estoque do Kardex.
2. **Perdas Anormais (`AbnormalWasteCost`)**: Conforme CPC 16(R1) itens 13 e 16, são expurgadas da valoração do estoque e reconhecidas diretamente como despesa operacional do período, impedindo a sobreavaliação patrimonial de inventário.

---

## 3. Arquitetura e Entidades do MOD-11
O módulo foi implementado em `src/Modules/DigitalProjects/` seguindo Clean Architecture e DDD:
- **`DigitalProject`**: Raiz de agregação contendo escopo, modelo de precificação (`FixedPrice`, `TimeAndMaterials`, `RetainerHourPackage`, `RecurringContract`, `Hybrid`), cláusulas de PI (Lei 9.609/98), governança LGPD, marcos, tarefas, timesheets e entregáveis.
- **`DigitalProjectMilestone`**: Marcos de entrega contratual com data prevista, percentual contratual e status de aprovação vinculados ao CPC 47.
- **`DigitalProjectTask`**: Tarefas de desenvolvimento com rastreabilidade de horas orçadas vs executadas e status Kanban.
- **`DigitalProjectTimeEntry`**: Apontamento autoritativo de horas com preservação do custo horário do profissional na data do lançamento (`HourlyCostRateAtDate`), garantindo DRE e apuração de margem histórica imutável.
- **`DigitalProjectDeliverable`**: Entregáveis digitais (repositórios Git, builds, artefatos, documentação) com hash criptográfico SHA-256 e termos de aceite formal assinado.
- **`DigitalProjectChangeRequest`**: Controle estrito de alteração de escopo (*Change Request*) para impedir *scope creep* e aditivos retroativos não faturados.
- **`DigitalProjectContractVersion`**: Versionamento auditável de termos contratuais e minutas.

---

## 4. Integração Contábil & Governança (Zero Financeiro Paralelo)
- **CPC 47 / IFRS 15**: O módulo veda o reconhecimento automático de receita por mero clique ou conclusão de tarefa. A receita e o faturamento decorrem estritamente de marcos formais aceitos (`ClientAccepted`), vinculados ao pedido de faturamento comercial e geração de títulos no `Financial`.
- **Prevenção de Duplicidade Financeira**: O MOD-11 não possui tabelas paralelas de contas a receber ou fluxo de caixa. Qualquer faturamento é emitido através do fluxo unificado de vendas e faturamento da HB Studio.

---

## 5. Endpoints REST & Segurança Fail-Closed
Mapeados sob `/api/projects/*` com permissões granulares:
- `GET /api/projects`: Listagem com filtros de status e cliente (`projects.view`).
- `GET /api/projects/{id}`: Detalhes completos do projeto com rentabilidade, margem bruta, horas e entregáveis (`projects.view`).
- `POST /api/projects`: Criação de novo projeto contratual (`projects.manage`).
- `POST /api/projects/{id}/milestones`: Adição de marcos contratuais (`projects.manage`).
- `POST /api/projects/{id}/tasks`: Criação de tarefas (`projects.manage`).
- `POST /api/projects/{id}/time-entries`: Apontamento de horas com taxa de custo histórica (`projects.manage`).
- `POST /api/projects/{id}/deliverables`: Registro de entregável com hash SHA-256 (`projects.manage`).
- `POST /api/projects/{id}/deliverables/{deliverableId}/accept`: Registro formal de aceite de entregável (`projects.manage`).
- `POST /api/projects/{id}/change-requests`: Solicitação de alteração de escopo com impacto financeiro (`projects.manage`).
- `POST /api/projects/{id}/change-requests/{changeRequestId}/decide`: Aprovação ou rejeição formal de aditivo de escopo (`projects.manage`).

---

## 6. Frontend Operacional HBVisionX
Localizado em `apps/web/app/projects/page.tsx` e integrado à navegação lateral (`apps/web/components/RootShellLayout.tsx`):
- Design System HBVisionX Light + Dark Sidebar com padrão quadriculado suave.
- Cards executivos: Projetos Ativos, Horas Lançadas, Custo Real Acumulado e Margem Bruta Geral.
- Abas operacionais:
  1. **Carteira de Projetos**: Listagem com status, cliente, modelo de precificação e barras de progresso.
  2. **Horas & Timesheet**: Lançamento ágil de horas com validação de custo horário e desenvolvedor.
  3. **Entregáveis & Código-Fonte**: Repositórios, links, hash SHA-256 e status de aceite formal.
  4. **Rentabilidade & Margem**: Apuração visual de Receita Contratual vs Custo de Mão de Obra vs Lucro Bruto.
- Modal de criação de projetos completos sem dados mockados.

---

## 7. Evidências de Testes e Homologação
- **Testes Automatizados**: `tests/BuildingBlocks.UnitTests/DigitalProjectsModuleIntegrationTests.cs`
  - `DigitalProjects_FullLifecycle_Milestones_Timesheet_Deliverables_And_Margin_Succeeds`: Valida criação, marcos, apontamento de horas com custo histórico, entregáveis com SHA-256, aceite formal, solicitação e aprovação de Change Request, e cálculo contábil de rentabilidade.
  - `DigitalProjects_UnauthorizedUser_FailsClosed`: Valida bloqueio por ausência de permissão (403 Forbidden).
- **Resultado Global de Testes**: **73/73 testes APROVADOS (100% verde)**.
- **Frontend Turbopack Build**: Compilação sem erros e 17 rotas estáticas geradas com sucesso (`/projects`).
