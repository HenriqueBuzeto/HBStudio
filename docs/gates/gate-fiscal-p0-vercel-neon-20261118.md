# Gate fiscal — P0 de segurança, cofre e início da integração SEFAZ-SP

**Data:** 18/11/2026  
**Arquitetura de produção:** Next.js 16 na Vercel + PostgreSQL Neon (sem Docker / Railway)  
**Estado:** P0 implementado; integração de emissão ainda NÃO homologada.

## 1. Diagnóstico baseado no código original

O adaptador `src/Modules/Fiscal/Fiscal.Infrastructure/ZeusAdapters/ZeusNFeProvider.cs` retornava status de serviço online (107), autorização NFC-e (100) e cancelamento (135) sem comunicação externa, inclusive XML/protocolos e QR Code sintéticos. O aplicativo Vercel não executa esse adaptador .NET. As rotas diretas anteriores também permitiam dados fictícios de estabelecimento, validade inventada do certificado e criptografia AES-CBC não autenticada.

**Correção:** nenhuma resposta de emissão, status fiscal ou cancelamento pode ser considerada oficial sem protocolo recebido de serviço SEFAZ real. O frontend e o endpoint de vendas devem continuar fail-closed.

## 2. Mudanças P0 implementadas

| Camada | Mudança | Limite reconhecido |
| --- | --- | --- |
| Adaptador Zeus .NET | `CheckStatusAsync`, `ConsultDocumentStatusAsync`, `EmitNfceAsync` e `CancelNfceAsync` retornam indisponível/erro, nunca sucesso sintético | Reativação exige integração assinada oficial, não basta certificado |
| QR Code .NET | Removidos fallback RSA temporário e CSC fictício em QR V2 | Helpers de QR não são emissão fiscal homologada |
| Rotas genéricas `/api/fiscal/[...path]` | Encaminhamento inseguro bloqueado e política de erro explícita | Sem backend fiscal real publicado na Vercel |
| `/api/fiscal/establishment` | CNPJ com dígitos verificadores, IE SP com formato, código IBGE, CNAE, CEP, série, sequência, endereço e filial reais; produção bloqueada | Consulta oficial de IE/CADESP e tributos dos produtos ainda faltam |
| `/api/fiscal/csc` | Permissão `fiscal.settings.manage`, `Origin`/CSRF, vínculo tenant/branch/ambiente, AES-256-GCM com AAD e auditoria atômica | CSC criptografado não implica CSC validado pela SEFAZ |
| `/api/fiscal/certificate` | Valida senha do PKCS#12, certificado e validade extraída do PFX; verifica CNPJ no assunto, armazena com AES-256-GCM e *IsActive=false* | Validação completa da cadeia ICP-Brasil, revogação e identidade de campo SAN ainda pendentes; não ativar certificado automaticamente |
| `/api/fiscal/status` | Consulta somente-leitura oficial segregada por tenant/filial, sem status sintético; contagem apenas de documentos autorizados de fato no banco | Não valida retroativamente protocolos históricos com a SEFAZ; `fiscalReady=false` até homologação |
| UI Fiscal | Remove valores fictícios de CNPJ, IE e endereço; código IBGE obrigatório; informação de prontidão real e produção desabilitada | Não representa o emissor como pronto |
| Segurança da sessão | Usa o catálogo canônico `fiscal.settings.manage`/`fiscal.documents.view`, valida `SecurityStamp`, usuário e sócio ativo, JWT/tenant/branch e CSRF | Permissões devem continuar auditadas no backend e testes E2E |
| Efeitos no banco | Nenhuma operação real de emissão, cancelamento, numeração fiscal ou autorização foi executada | A migração do cofre só se aplica a novas credenciais; legado exige reimportação segura |

## 3. Início efetivo da integração Vercel + Neon

Criada `POST /api/fiscal/connection-test`: chamada **real** de mTLS/TLS 1.2+ ao endpoint oficial
`https://homologacao.nfce.fazenda.sp.gov.br/ws/NFeStatusServico4.asmx`,
com SOAP 1.2, PFX decifrado na memória e validação da resposta `retConsStatServ/cStat`.

O teste só usa **ambiente 2 (homologação)** e retorna o código recebido da SEFAZ. HTTP 200 por si só não é sucesso. `cStat=107` comprova apenas status de serviço, não autorização de NFC-e nem validade total do certificado. Nenhuma nota, venda, protocolo, cancelamento ou configuração tributária é modificada por esta operação.

Requisitos de execução:
- Cadastrar dados reais do estabelecimento, com município IBGE e ambiente homologação.
- Configurar `FISCAL_ENCRYPTION_KEY` em **Environment Variables da Vercel** com 32 bytes gerados por fonte criptograficamente segura (64 caracteres hex). **Não usar `AUTH_SECRET` como chave fiscal.**
- Reimplantar projeto Vercel após alterar variáveis.
- Subir PFX real somente pela tela autenticada do ERP, nunca via chat, repositório, log ou issue. O upload fica `IsActive=false`.
- Testar `/api/fiscal/connection-test` somente após conferência de certificado, senha e credenciamento na SEFAZ-SP.

**Observação:** sem acesso autorizado à equipe Vercel e sem credenciais fiscais, não foi possível executar uma conexão oficial real neste ciclo. Os testes de código não substituem SEFAZ E2E.

## 4. Próximos gates — trabalho que continua bloqueado

### Gateway de emissão (em implementação futura)

1. Obter especificações XSD/NT vigentes da NFC-e, QR Code v3 e SOAP serviços da SEFAZ-SP.
2. Validar cadeia ICP-Brasil, CRL/OCSP, certificado A1, CNPJ, IE CADESP, ambiente/CSC correspondente; proteger chaves fiscais independentes e tratar rotação.
3. Gerar XML conforme MOC com códigos tributários reais (NCM, CEST quando aplicável, CFOP, CSOSN/CST, valores e pagamentos), sem campos artificiais.
4. Assinar XMLDSig com chave privada real, validar esquema XSD e digest; montar chave/numeração com controle concorrente, nunca permitir duplicidade ou reutilização indevida.
5. Transmitir mTLS ao `NFeAutorizacao4`, interpretar retorno e recibo oficial; salvar XML, chave, protocolo e assinatura somente como comprovadamente recebidos.
6. Tratar timeout com estado incerto e reconciliação por `NFeConsultaProtocolo4`. Não tentar emissão duplicada ao acaso.
7. Enviar `NFeRecepcaoEvento4` assinado para cancelamento, persistir evento/protocolo de retorno e conciliar com estoque e finanças.
8. Testar regras de contingência permitidas e emissão de DANFE NFC-e com URL/QR oficiais; não presumir que Vercel Functions oferecem trabalho contínuo.

### Matriz de homologação obrigatória

| Caso | Critério objetivo | Situação |
| --- | --- | --- |
| A1 com senha errada | 422 sem gravar ou ativar | Implementado em código, E2E pendente |
| A1 expirado / CNPJ incompatível | Rejeição e fail-closed | Implementado com ressalva de identidade SAN, E2E pendente |
| CSC inválido / ambiente diferente | Rejeição sem gravar token inválido | Implementado em código, E2E pendente |
| Chave fiscal ausente | 503 sem gravar segredo | Implementado, Vercel a configurar |
| Status SEFAZ real em homologação | Resposta SOAP e `cStat` oficiais | Código criado, execução externa pendente |
| NFC-e aprovada | XML assinado, resposta SEFAZ cStat100, chave e protocolo oficiais e consultáveis | NÃO IMPLEMENTADO |
| NFC-e rejeitada | Registrar rejeição, sem marcar venda fiscal autorizada | NÃO IMPLEMENTADO |
| Timeout/queda e consulta | Estado incerto, reconciliação, sem duplicação | NÃO IMPLEMENTADO |
| Cancelamento | Evento oficial cStat135 e protocolo + compensação financeira | NÃO IMPLEMENTADO |
| Produção | Aprovação manual após gate completo e liberação explícita | BLOQUEADO |

## 5. Evidências técnicas

- `tests/BuildingBlocks.UnitTests/FiscalFailClosedProviderTests.cs`: quatro regressões que impedem fake cStat100, cStat135, status107 e consulta de protocolos sem webservice.
- GitHub Actions `.github/workflows/fiscal-p0-security-gate.yml`: checa `npx tsc --noEmit`, `npm run build`, `dotnet build` e testes .NET.
- SQL `EXPLAIN` sem execução para cadastro, CSC e certificado contra esquema real do Neon.
- No último inventário somente-leitura: 0 estabelecimentos, 0 certificados ativos, 0 CSCs e 0 documentos fiscais no tenant principal.

### Fontes externas oficiais

- SEFAZ-SP — WebServices NFC-e: https://portal.fazenda.sp.gov.br/servicos/nfce/Paginas/WebServices.aspx
- SEFAZ-SP — Portal NFC-e: https://portal.fazenda.sp.gov.br/servicos/nfce
- Vercel — limites Vercel Functions: https://vercel.com/docs/functions/limitations

**Veredito:** segurança P0 implementada em branch e submetida a validação. `SEFAZ_PRODUCTION_READY = FALSE` por design.
