# Fiscal Enterprise — MEI / São Paulo / PDV / NFC-e / NF-e / NFS-e

**Data de referência:** 23/11/2026. **Estado:** desenho de integração e validações preliminares, sem emissão autorizada em produção.

## Pesquisa de base normativa (links oficiais)
- SP NFC-e, obrigatoriedade varejo desde 01/01/2026, substituição do SAT: https://portal.fazenda.sp.gov.br/servicos/nfce/
- Portaria SRE 40/2024, credenciamento por estabelecimento, homologação, DANFE, contingência: https://legislacao.fazenda.sp.gov.br/Paginas/Portaria-SRE-40-de-2024.aspx
- LC 123/2006 e exceções MEI: https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp123.htm
- SEFAZ SP RC 29208/2024, dispensa MEI para consumidor final PF e hipóteses CNPJ com entrada: https://legislacao.fazenda.sp.gov.br/Paginas/RC29208_2024.aspx
- Portal NF-e NT 2024.001, CRT 4 e validações CSOSN: https://www.nfe.fazenda.gov.br/Portal/exibirArquivo.aspx?conteudo=6luq3tpmg08%3D
- Receita Federal / Simples 2026, DAS-MEI: https://www8.receita.fazenda.gov.br/simplesnacional/Noticias/NoticiaCompleta.aspx?id=c3b2044c-ff97-432a-b33c-ecf2a3df6dc3
- MEMP 23/10/2026 e 12/11/2026, teto e novas regras: https://www.gov.br/memp/pt-br/assuntos/noticias/mei-podera-usar-declaracao-anual-no-lugar-da-nota-fiscal-para-pessoas-fisicas
- RFB 2026 Simples/NFSe e CBS/IBS: https://www.gov.br/receitafederal/pt-br/assuntos/noticias/2026/outubro/reforma-tributaria-86-dos-documentos-fiscais-de-empresas-obrigadas-ja-trazem-destaque-da-cbs

**Alerta jurídico:** comunicação geral de obrigatoriedade da NFC-e para varejo paulista e dispensa federal/estadual em hipóteses de MEI coexistem. A aplicabilidade da exceção depende da condição do emitente (MEI/SIMEI), da natureza da operação, do destinatário, das regras vigentes no momento e da validação por profissional fiscal. Não parametrizar “não fiscal” como dispensa universal.

## Regra de tributação do MEI
O regime MEI utiliza código **CRT=4** na NF-e/NFC-e. Não calcular alíquota de ICMS/ISS por venda apenas como porcentagem para simular DAS. Conforme tabela oficial em 2026: INSS R$ 81,05; ICMS fixo R$ 1 quando aplicável, ISS R$ 5 quando aplicável. Venda deve entrar no relatório de receitas, independentemente de emissão de nota. Aplicação de NCM, CFOP, CSOSN, CEST, origem e natureza da operação deve ser revisada por responsável fiscal, nunca inferida automaticamente do nome do produto. NFC-e de MEI admite CSOSN 102 ou 300 conforme regra de validação aplicável; NF-e modelo 55 pode ter regras diferentes. Para 2026, a Receita informa que optantes do Simples não estão obrigados a destacar CBS na documentação fiscal; monitorar mudanças em 2027.

## Atalho Ctrl + F1
- A chave troca **somente a intenção visual** entre FISCAL (padrão) e COMPROVANTE INTERNO (vermelho).
- O navegador consulta `GET /api/sales/document-eligibility` com cliente identificado, tipo de operação local de mercadorias e solicitação de nota pelo consumidor.
- O backend exige `sales.pos.use`, cliente ativo do tenant, CPF com dígitos válidos, `Type=1`, emitente da filial CRT 4/SP, e política de dispensa com aprovação e vigência.
- O modo interno não fica disponível para CNPJ, sem CPF identificado, serviços, transporte/interstate, cliente que solicitou documento ou política não homologada.
- Sem política aprovada, o banco retorna `eligible=false`. Nenhuma política é criada automaticamente; a migration traz `IsActive=false`.
- **Nenhuma opção visual é prova de dispensa fiscal.** O checkout definitivo DEVE reexecutar a regra com snapshot integral (itens/NCM/origem/UF/destino) na mesma transação, auditar motivo e referência de aprovação; a UI nunca pode controlar a emissão pela própria flag.
- Documentos internos devem exibir `COMPROVANTE INTERNO — NÃO É DOCUMENTO FISCAL`; não gerar QR-code/numeração/estado SEFAZ. Devem guardar a venda comercial e receita real, mesmo quando juridicamente dispensada a nota.
- Atualizar/analisar regra para 2027: o período de vigência desta política preliminar está deliberadamente limitado a 2026. Não renovar automaticamente.

## Componentes implementados nesta branch
1. `apps/web/lib/fiscal-validation.ts`: aceita CRT 4, sem retirar validações de CNPJ, UF SP, IE, ambiente homologação etc.
2. `apps/web/app/fiscal/page.tsx`: opção MEI CRT 4 no cadastro de emissor.
3. `db/migrations/20261123_fiscal_mei_document_policy.sql`: política de dispensa aprovada por estabelecimento/tenant/filial, validade e referência documental. Nenhuma autorização seeded.
4. `apps/web/app/api/sales/document-eligibility/route.ts`: decisão preliminar fail-closed de modo interno.
5. `apps/web/app/sales/page.tsx`: Ctrl+F1 + botão acessível, caixa vermelha de pré-avaliação, solicitação de nota do consumidor e erros visíveis; sem liberar checkout.
6. `db/migrations/20261123_fiscal_sku_tax_profiles.sql`: classificação NCM/CEST/CFOP/CSOSN/CST/origem por SKU e regime, com aprovação e sem preenchimento automático. Validação especial MEI/NFC-e 102/300.

**QA Neon:** ambas migrations de classificação/política aplicadas somente na branch isolada `qa-erp-integracao-20261123-todos-gates`. Zero políticas ativadas, zero emissão fiscal. Estabelecimentos existentes na QA consultada usam CRT 1, não CRT 4, portanto modo interno não é elegível para eles.

## Arquitetura restante para fiscal real
1. **Configuração por emitente/filial:** CNPJ ativo, CADESP/IE, CNAE, CRT, dados completos, CSC de homologação e produção, certificado A1 (ou integração HSM) com cofre de segredos isolado e rotação. Nunca enviar senha/certificado pelo chat.
2. **Catálogo fiscal:** NCM, CEST quando aplicável, CFOP por natureza de operação, origem, CSOSN/CST, unidade comercial/tributável, regras monofásico/ST quando cabível; assinaturas de aprovação e versões históricas.
3. **Emissor NF-e/NFC-e:** serialização de XML conforme MOC e NT atual, validação XSD, assinatura digital XMLDSig ICP-Brasil, certificado correto, TLS mútua, requisição síncrona, parse tipado de cStat/xMotivo/chNFe/nProt; armazenamento seguro de XML e respostas reais; unicidade de numeração por ambiente/modelo/serie/estabelecimento e idempotência.
4. **Máquina fiscal:** PREPARED → SIGNED → SENT → AUTHORIZED ou REJECTED; TIMEOUT → UNCERTAIN → CONSULT_BY_ACCESS_KEY (nunca reemitir cegamente), CANCEL_REQUESTED → CANCELED; contingência NFC-e offline apenas quando legalmente aplicável, com fila de transmissão, prazos, QR Code e regularização.
5. **DANFE:** imprimir apenas documento emitido/autorizado ou contingência legal efetiva, QR Code real e chave; ambiente de homologação deve ficar identificado como sem validade jurídica.
6. **NFS-e serviços:** emissor nacional e regras aplicáveis a MEI de prestação de serviços; não tratar prestação de assistência como venda de mercadoria indistinta. Separar produtos, serviço e operação mista com revisão fiscal.
7. **Orquestrador PDV:** venda confirmada por pagamento real -> reserva/baixa estoque -> caixa/razão -> fiscal, com estados de falha recuperáveis, estorno e conciliação; fiscalização pode possuir fila e pendência conforme regra. Não concluir operação financeira como paga apenas por retorno “enviado”.
8. **Conciliação:** consulta chave e protocolo, eventos de cancelamento, inutilização conforme norma vigente, carta correção quando permitida, reprocessamento seguro, retenção de documentos, auditar tentativas e acessos.

## Gates antes de qualquer deploy/merge
- CI TypeScript/Next; validação SQL e unit tests de CPF/CRT/regras.
- Testes E2E autenticados para PF/CNPJ, solicitação de nota, env2/env1, idempotência, 401/403, multiempresa e filial; nenhuma dispensa para não MEI.
- Homologação de comunicação **real** com endpoints SEFAZ via certificado do emitente; aprovação XML em ambiente 2, rejeições e timeout, contingência, cancelamentos e reconciliação fiscal/financeira.
- Revisão por contador/assessoria do regulamento aplicável ao estabelecimento para a política de dispensa. Nenhum código deve substituir essa validação.
- Produção: migração após backup e gates, variáveis no Vercel com mínimo privilégio, verificação de credenciamento, acesso real e smoke tests sem simulação.

**Estado:** FASE INICIAL IMPLEMENTADA / EM HOMOLOGAÇÃO. Não transmite nota, não habilita checkout, não permite burlas. O PR fiscal deve ser integrado à branch geral somente após QA, seguido de squash merge final quando houver integração ponta a ponta.
