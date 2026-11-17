# Gate de Homologação Enterprise P0 — Infraestrutura Vercel + Neon

**Data da Auditoria:** 17 de Novembro de 2026  
**Repositório:** [HBStudio no GitHub](https://github.com/HenriqueBuzeto/HBStudio.git)  
**HEAD Remoto:** `a75ff59`  
**Infraestrutura Alvo:** Vercel (Frontend & Container Services) + Neon (PostgreSQL Serverless)  
**Restrição Mandatória:** Sem dependência de Railway ou provedores terceiros de hospedagem.

---

## 1. Classificação Formal dos Gates P0

| Identificador do Gate | Descrição | Status Atual | Evidência Técnica |
| :--- | :--- | :---: | :--- |
| `CODE_REVERT_VERIFIED` | Reversão completa de código inseguro (SQL direto, bypass de permissões, mock fiscal). | **APROVADO** | Commits `ad68e94` e `c5733a6` publicados na `master`. Código limpo e canônico. |
| `BFF_HARDENING_VERIFIED` | Todas as rotas de API do BFF (Parties, Catálogo, Compras, Estoque e Fiscal) usam `forwardToBackend` com anti-CSRF, fail-closed e repasse de Correlation-Id. | **APROVADO** | Commit `a75ff59` unificou `apps/web/app/api/fiscal/[...path]/route.ts` no `forwardToBackend`. |
| `CONTAINER_BUILD_VERIFIED` | Dockerfile multi-stage .NET 10 pronto na raiz, compilação monorepo e usuário não-root. | **APROVADO** | Arquivo `Dockerfile` e `.dockerignore` validados. Build e testes 101/101 aprovados. |
| `CREDENTIAL_ROTATION_VERIFIED` | Rotação comprovada no console do Neon, senha ERP e chave JWT. | **PENDENTE DE CONFIRMAÇÃO DO ADMINISTRADOR** | Checklist operacional documentado em `docs/security/credential-rotation-incident-response.md`. |
| `VERCEL_DEPLOY_VERIFIED` | Implantação do serviço .NET via Container Runtime na Vercel. | **EM HOMOLOGAÇÃO** | Suporte a Container Runtime (Beta) documentado na Vercel; aguardando ativação de projeto dedicado na conta. |
| `AUTH_E2E_VERIFIED` | Login funcionando de ponta a ponta através do domínio público da Vercel. | **BLOQUEADO POR VERCEL_DEPLOY** | Depende do backend .NET responder via `API_INTERNAL_URL` na nuvem. |
| `SEFAZ_EXTERNAL_NOT_CONFIGURED` | Emissão e cancelamento de notas fiscais reais junto à SEFAZ-SP. | **BLOQUEADO POR DESIGN** | Certificado Digital A1 de produção e homologação SEFAZ não configurados pelo usuário. |

---

## 2. Hardening Unificado do BFF Concluído (Commit `a75ff59`)

Todas as rotas de mutação fiscal (`/api/fiscal/csc`, `/api/fiscal/certificate`, `/api/fiscal/documents/cancel`) e de consulta agora passam estritamente pela função `forwardToBackend`:
1. **Proteção Anti-CSRF:** Checagem de `Origin` vs `Host`, bloqueio de `Sec-Fetch-Site: cross-site` e política *fail-closed* em produção.
2. **Preservação de Códigos HTTP:** Repasse fiel de códigos `401 Unauthorized`, `403 Forbidden`, `409 Conflict` e `503 Service Unavailable`.
3. **Auditoria e Rastreabilidade:** Injeção obrigatória de cabeçalho `X-Correlation-Id` em todas as requisições enviadas ao backend .NET.
4. **Sem Mocks Fiscais:** Nenhuma tabela do PostgreSQL é consultada ou alterada de forma avulsa pelo frontend; todo o processamento depende da autoridade fiscal do `FiscalService` e Zeus DFe.NET.

---

## 3. Guia de Conclusão do Gate pelo Administrador

### Ação 1: Concluir e Confirmar a Rotação de Credenciais
1. No console do **[Neon](https://console.neon.tech)**:
   - Redefina a senha de `neondb_owner`.
2. No painel da **[Vercel](https://vercel.com)**:
   - Atualize a variável `DATABASE_URL` / `POSTGRES_URL` com a nova credencial.
3. Defina a nova chave mestre:
   - Cadastre `Jwt__Key` com segredo forte (mínimo 64 caracteres aleatórios).

### Ação 2: Ativação do Container Runtime na Vercel
A Vercel disponibiliza a execução de contêineres Docker (Container Runtime / Fluid Compute).
Para publicar a API .NET diretamente na Vercel:
1. No painel da Vercel, crie um novo projeto conectado ao repositório `HenriqueBuzeto/HBStudio`.
2. Em **Build & Development Settings**, selecione o preset **`Container`** (que utiliza automaticamente o `Dockerfile` da raiz).
3. Cadastre as variáveis de ambiente do backend (.NET):
   - `ASPNETCORE_ENVIRONMENT = Production`
   - `PORT = 8080`
   - `ConnectionStrings__DefaultConnection = <NOVA_STRING_NEON>`
   - `Jwt__Key = <NOVA_CHAVE_JWT>`
   - `Jwt__Issuer = HBStudioErp`
   - `Jwt__Audience = HBStudioErpClient`
4. Após o build do contêiner, aponte a variável `API_INTERNAL_URL` do projeto frontend Next.js para o domínio HTTPS gerado pelo serviço .NET da Vercel.
