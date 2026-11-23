# Gate 2 — Assistência Técnica & OS Enterprise (HBStudio)

Data: 2026-11-23
Origem: master em commit `377895c`.
Implementação: `feat/repairs-enterprise-atomic-os-20261123`; PR #12 (draft).
Banco: Neon `wandering-unit-92531646`; testes realizados **exclusivamente** na branch isolada `qa-repairs-20261123-enterprise` (ID `br-red-cloud-b6kd5jrl`).
Produção Neon: **não alterada**; Vercel: **nenhum deploy feito**.

## Problemas comprovados da versão anterior
- POST de OS gravava Party, aparelho, ordem, itens e histórico por consultas separadas (falha parcial).
- Número `OS-YYYY-NNNN` era gerado por `COUNT(*)+1`, sem concorrência.
- Histórico de status apontava colunas não existentes (`OldStatus`, `NewStatus`, `ChangedByUserId`); contrato real tem `Status`, `Description`, `TimestampUtc`.
- PUT excluía os itens antes de concluir o restante, sem atomicidade nem controle OCC.
- Rotas de OS e auxiliares apenas verificavam JWT, sem Effective Access; GET não filtrava filial e itens não filtravam tenant.
- A interface silenciava erros de HTTP, não enviava token OCC e incluía peças/serviços com preços ilustrativos.

## Alterações preparadas
- Migration aditiva `20261123_repairs_enterprise_atomic.sql`, com contador por empresa/ano, tabela de chaves idempotentes, `repair_enterprise_create` e `repair_enterprise_update` (funções SQL transacionais).
- Criação atômica: cliente/perfil (quando novo), aparelho, OS, itens, status inicial, trilha de auditoria e chave idempotente. FKs e validações de valor, SKU e filial.
- Numeração `OS-YYYY-NNNN` via contador com `INSERT ... ON CONFLICT DO UPDATE`, sem `COUNT+1`; preserva maior numeração preexistente no primeiro uso.
- Idempotência com chave por solicitação, lock transacional e fingerprint do payload; mesma chave + payload retorna a mesma OS, mesma chave + payload diferente é rejeitada.
- Atualização de Kanban e itens é atômica com row lock e token otimista `Status` + `UpdatedAtUtc`; histórico e auditoria vinculados à mesma operação.
- Seis categorias Kanban: Triagem (1/2), Em Bancada (3/8), Aguardando Peça (7), Aguardando Cliente (4), Pronto/Testado (10/11), Entregue (12), com transições permitidas explícitas.
- Entrega exige usuário com `repairs.deliver`, nome de quem retirou e gravação de `DeliveredAtUtc`, `DeliveredToPersonName` e `DeliveryNotes`. Marcação Pronto/Testado exige `repairs.quality`.
- Edição de estimativas bloqueada após QC/entrega (10/11/12), impedindo valor negativo quando desconto supera itens.
- APIs protegidas via `authorizeFleet`, `guardOrigin`, permissões canônicas e escopo tenant+branch; documentação sensível redigida conforme `customers.sensitive.view`.
- UI em padrão atual, formulários com erro real, loading, modal responsivo, dados não simulados, criação idempotente e confirmação de entrega; botões respeitam Effective Access.

## Evidência dos testes Neon QA
| Cenário | Resultado |
| --- | --- |
| Aplicação das funções e tabela do contador na branch QA | PASS |
| Criação OS com cliente, aparelho, dois itens e trilha de status | PASS — OS-2026-0001 |
| Duas criações concorrentes, cada uma com sua chave | PASS — OS-2026-0002 e 0003 |
| SKU inexistente / falha no meio da transação | PASS — nenhum Party parcial persistido |
| Repetição concorrente da mesma chave/payload | PASS — OS-2026-0004, 1 única OS e 1 cliente |
| Mesma chave com payload divergente | PASS — rejeitada |
| OCC: status antigo após outra alteração | PASS — rejeitado |
| Histórico: 1 → 8 → 7 | PASS — histórico correto |
| Bloqueio entrega direta de 7 → 12 | PASS — rejeitada |
| Fluxo 7 → 8 → 10 → 12 | PASS |
| Bloqueio alteração de entregue para bancada | PASS — rejeitada |
| Entrega sem destinatário | PASS — rejeitada |
| Entrega com destinatário e observações | PASS — OS-2026-0005, comprovado no Neon |
| TypeScript + Next.js produção | PASS nos workflows GitHub; confirmar último commit após qualquer alteração |

## Pendências antes de merge/deploy
1. A migration foi ensaiada somente em QA. Confirmar migração aplicada no banco alvo **antes** de publicar os novos endpoints; exigir rollback/backup e idempotência de migração.
2. Executar testes E2E autenticados, com perfis diferentes, via navegador: criação, consulta, erro 422, conflito 409, status, entrega e refresh.
3. Revalidar navegação mobile, TV, modais, foco e acessibilidade; verificar token e sessão depois de refresh.
4. Testar cenário de cliente existente, ausência de privilégios (403), leitura cruzada tenant/filial e sessão expirada (401).
5. Confirmar custo e consumo de peças de estoque: a inclusão de `ProductSkuId` na estimativa **não é reserva nem baixa de estoque**. Não declarar integração estoque/financeiro concluída.
6. Disponibilizar seleção de aparelho já cadastrado, sem obrigar novo equipamento em cada OS; avaliar política de deduplicação por serial/IMEI.
7. Validar garantia legal, aceite/diagnóstico, checklist e evidência de entrega conforme regras de negócio existentes antes de declarar assistência técnica homologada em sua totalidade.
8. Testar release sob conta Vercel correta, monitorar erros 4xx/5xx e preparar rollback; nunca publicar API nova com função SQL ainda inexistente.

## Veredicto
**Código preparado com QA de banco e CI. Não homologado ponta a ponta em produção.** PR #12 permanece draft até autorização de migração em produção e gate de testes de UX/autorização.
