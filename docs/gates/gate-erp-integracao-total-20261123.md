# Plano de fechamento Enterprise — HB Studio ERP (23/11/2026)

## Regra de entrega
Este documento **não significa que todos os módulos estão prontos**. A branch de integração recebe somente código que será revisado e testado; um único **squash merge** para `master` será permitido somente depois dos gates globais. Builds de TypeScript/Next e SQL executado isoladamente **não são evidência de ponta a ponta**.

**Base atual**: `master` (Clientes/Neon, commit 377895c). **Consolidados em staging**: Assistência/OS da PR #12, Caixa/Financeiro da PR #13 e CRM enterprise. No Caixa, acrescentado fechamento exato de turno com contagem física. Nenhum desses novos trechos foi publicado em produção nesta branch.

## Módulos e gates obrigatórios

| Código | Área | Requisito mínimo de liberação | Estado atual da integração |
|---|---|---|---|
| G00 | Autenticação e Clientes | criar, consultar, editar, vincular endereço/equipamento, tenant/branch, RBAC, reload, trilha, conflito | implementação em master; regressão E2E pendente |
| G01 | Assistência/OS | criar atomicamente, número concorrente, Kanban, itens, garantia, aparelho existente, consumo de estoque e entrega | núcleo OS/QA está staged; vínculo de estoque/aparelho existente e E2E pendentes |
| G02 | Caixa | abertura, suprimento, sangria, fechamento com contagem, diferenças aprovadas, cash movements, idempotência, permissões | abertura/movimentos em QA; fechamento sem diferença testado; aprovação de diferenças pendente |
| G03 | Financeiro | títulos, partidas dobradas, competência, conciliação de pagamentos, estorno, DRE classificada | consultas reais integradas; escrituração automática/conciliador/DRE pendentes |
| G04 | PDV | cotação→venda, dinheiro/troco, Pix/cartão confirmado pelo PSP, estoque, pagamento, caixa, lançamentos, cancelamento e devolução | orçamento real; checkout intencionalmente bloqueado |
| G05 | Fiscal | NFC-e/NF-e oficial, certificado, SEFAZ, contingência, eventos, cancelamento, DANFE só após autorização | emissão real ainda bloqueada, SEM integração homologada |
| G06 | Fidelidade | carteira por cliente, bônus por venda liquidada, ledger, recompensa, reserva, resgate, expiração, estorno | migrações divergentes: loyalty_settings vs loyalty_programs; integração bloqueada |
| G07 | CRM | funil/estágios, atividades, oportunidades, owner, transições OCC, conversão venda | API/UI staged; SELECT do board validado em QA; mutations e E2E pendentes |
| G08 | Catálogo e Estoque | SKU, custos autorizados, entrada/saída, reserva, serial/IMEI, transferência, inventário, cancelamento | APIs reais já na master; fluxos de fronteira pendentes |
| G09 | Compras | solicitação, aprovação, pedido, recebimento, nota, custo/estoque e contas a pagar | APIs parciais; jornada completa pendente |
| G10 | Manufatura | ficha técnica, planejamento, reserva de insumos, produção, perdas, custo, entrega em estoque | telas/fluxos parciais |
| G11 | Projetos | projeto, tarefas, horas/aprovação, custos, faturamento, escopo de acesso | telas/fluxos parciais |
| G12 | Frota/fretes | cadastro, viagem, manutenção, km, abastecimento, custo, ligação com pedidos | APIs reais já na master; E2E pendente |
| G13 | Mensagens | opt-in, modelo aprovado, webhooks, filas, retries/idempotência, consentimento LGPD | integração externa bloqueada |
| G14 | Sócios | membros, aportes, mútuos, distribuição, aprovação, razão e trilha | telas/fluxos parciais |
| G15 | BI e governança | KPIs reais, performance, permissões, audit logs, exports, multi-tenant e mobile | cross-cutting; não concluído |

## Jornada de venda: fiscal e não fiscal

**O sistema comercial pode registrar uma venda internamente antes da emissão do documento fiscal**, mas não deve chamar isso de dispensa da obrigação fiscal brasileira. O modo *não fiscal* é apenas um comprovante **interno** que não substitui NFC-e/NF-e quando legalmente obrigatória. O modo *fiscal* só pode declarar documento emitido quando houver autorização real do provedor/SEFAZ.

**Contrato de checkout exigido**:
1. Operador autenticado, filial válida, caixa aberto sob o operador e acesso `sales.pos.use`, `sales.create`.
2. Snapshot de SKU/preço/desconto, imposto quando aplicável, cliente, vendedor e dispositivo serializado; limites por tenant/filial.
3. Reserva ou baixa de estoque com bloqueio concorrente; nunca tirar saldo de produtos sem disponibilidade.
4. Dinheiro: confirmação explícita de numerário efetivamente recebido; Pix/cartão: confirmação verificável e assinada do PSP. Não converter autorização em liquidação.
5. Idempotência transacional por venda e evento de pagamento. Contabilização em partidas dobradas e cash movement sem duplicidade. Não deixar estado de pagamento aprovado sem estoque/razão reconciliáveis.
6. Devolução parcial/total e cancelamento com movimentos compensatórios imutáveis, estorno PSP e devolução de estoque autorizada.
7. Só disparar fidelidade após evento canônico liquidado, e compensar em cancelamento/devolução.
8. Fiscal: documentos autorizados apenas por retorno válido SEFAZ; eventuais pendências fiscais precisam permanecer visíveis e resolúveis.

## Evidências recentes disponíveis

- Assistência: criação atômica, duplicidade, concorrência, OCC, Kanban e entrega foram testados na branch Neon QA isolada no PR #12; testes autenticados permanecem necessários.
- Caixa: abertura, suprimento, sangria testados em `qa-stage3-cash-20261123-enterprise`. Nesta integração, fechamento com contagem R$104 versus saldo R$105 foi recusado; contagem R$105 fechou, retry da mesma chave retornou o mesmo fechamento, sem duplicidade.
- Financeiro: queries de razão e títulos contra Neon QA sem erro; amostra de lançamentos com débito/crédito equilibrados.
- CRM: board de pipelines, estágios e oportunidades consultado em Neon QA sem erro; escrita e permissões de papéis precisam E2E.
- GitHub Actions: build TypeScript + Next juntos deve estar verde no último SHA de integração.

## P0 — proibições de merge

- **Não aplicar migrações em banco principal** sem revisão, backup, ordem e ensaio no Neon QA. Não publicar endpoints que dependam de funções ausentes.
- **Não remover** `CHECKOUT_NOT_HOMOLOGATED` para forçar uma venda fictícia.
- Não mesclar migrações de fidelidade divergentes sem escolher um contrato canônico.
- Não registrar transação de cartão/Pix como paga a partir da seleção do método no formulário.
- Não publicar recibo interno como comprovante fiscal.
- Não exibir receita/lucro/CMV fixos como números reais.
- Não declarar UI funcional por build verde sem executar GET/POST/PATCH/DELETE/403/409/rollback e refresh em perfis distintos.

## Critério final de aceite (Definition of Done)
Todos os módulos expostos como liberados passam: persistência Neon, autorização por ação e escopo, idempotência, transações/concorrência, erros reais, auditoria, rollback/compensação, acessibilidade e responsividade, testes automatizados e E2E, deploy Vercel monitorado. Se um destes não passar, manter a função protegida e o gate pendente.

**Estado geral: EM IMPLEMENTAÇÃO. Não autoriza merge nem deploy.**
