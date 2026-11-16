# Walkthrough de Homologação — Hardening Enterprise de Usuários, Cargos e Controle de Acesso
**HB Studio ERP — Blueprint Enterprise 1.0 & Governança de Acessos**
**Data de Execução:** 16 de Novembro de 2026

---

## 1. Contexto e Diagnóstico da Auditoria
Na implementação anterior, identificou-se uma fragilidade no formulário de criação de usuários:
1. O checkbox de "Sócio com Acesso Master" atribuía automaticamente todas as permissões (`PermissionCatalog.All`) através de uma Role criada dinamicamente com o nome do cargo.
2. Isso criava potencial elevação indevida de privilégios e inconsistência entre cargo profissional e autorização real.
3. O cabeçalho superior exibia um badge fixo sem leitura dinâmica do perfil do usuário autenticado.

---

## 2. Separação Canônica de Conceitos Implementada

| Conceito | Definição no ERP | Implementação Técnica |
| :--- | :--- | :--- |
| **Cargo Profissional (`JobTitle`)** | Informação meramente cadastral e visual de exibição na interface (ex: CEO, Diretor Executivo, Gerente Geral, Vendedor Balcão). | Campo persistido `User.JobTitle` (varchar 100). Não concede permissões no backend. |
| **Vínculo Societário (`Partner`)** | Relação societária formal registrada no `PartnersCapital` com documentação, cotas e contrato social. | Validação contra a tabela `partners`. O checkbox apenas ativa a checagem com registros oficiais; **não cria sócios fictícios**. |
| **Acesso ao ERP** | Habilitação para login e emissão de JWT. | Mantida a política restrita aos sócios ativos e habilitados (`IsErpAccessEnabled`). Tentativas de outros colaboradores retornam 401. |
| **Permissões Efetivas (`Effective Access`)** | Conjunto canônico de `PermissionKeys` calculadas exclusivamente via agregação de papéis (`UserRoles` -> `RolePermissions`). | Avaliadas pelo `PermissionAuthorizationHandler` no ASP.NET Core e `hasPermission` no frontend. |

---

## 3. Endpoints de Governança e Segurança (`/api/users`)

1. **`GET /api/users`** (Protegido por `PermissionCatalog.AccessManage`):
   - Retorna listagem de usuários com cargo informativo (`JobTitle`), vínculo societário e roles atribuídas.
   - **Nenhum segredo ou hash de senha é exposto**.

2. **`POST /api/users`** (Protegido por `PermissionCatalog.AccessManage`):
   - Cria o usuário com seu cargo informativo (`JobTitle`).
   - Atribui exclusivamente o papel padrão seguro **"Colaborador Operacional"** com privilégios mínimos.
   - Não atribui acesso total ou permissões críticas por seleção de títulos como "CEO" ou "Diretor Executivo".
   - Valida se o e-mail ou nome corresponde a um sócio formal existente no `PartnersCapital`.

3. **`PUT /api/users/{id}/roles`** (Protegido por `PermissionCatalog.AccessManage`):
   - Concessão e revogação controlada e auditável de perfis de acesso.
   - **Prevenção contra auto-elevação**: bloqueia com HTTP 403 qualquer tentativa de um usuário alterar seus próprios privilégios.
   - **Restrição de Perfis Administrativos**: perfis contendo "Master" ou "Administrador" somente podem ser atribuídos a usuários que comprovadamente possuem vínculo formal no `PartnersCapital`.
   - Invalida imediatamente o `SecurityStamp` do usuário alvo, forçando a atualização das sessões ativas.
   - Registra auditoria com antes/depois no `AuditEvent` (JSONB).

4. **`PUT /api/users/{id}/job-title`** (Protegido por `PermissionCatalog.AccessManage`):
   - Permite alterar o cargo informativo com registro em auditoria.

5. **`PUT /api/users/{id}/password`** (Protegido por `PermissionCatalog.AccessManage`):
   - Redefine a senha via PBKDF2 e incrementa o `SecurityStamp` para revogar sessões anteriores.

6. **`PUT /api/users/{id}/toggle-status`** (Protegido por `PermissionCatalog.AccessManage`):
   - Bloqueia/desbloqueia o usuário com proteção contra auto-bloqueio.

---

## 4. Badge Dinâmico no Cabeçalho e Barra Lateral
- **`apps/web/components/RootShellLayout.tsx`**:
  - Cabeçalho: Exibe `{user?.jobTitle || "CEO"}` dinamicamente vindo de `userProfile` retornado por `/api/auth/me`.
  - Barra lateral: Exibe `{user?.jobTitle || "CEO"} • HB Studio`.
  - Usuário com cargo "Gerente Geral" exibe "Gerente Geral", usuário com cargo "CEO" exibe "CEO".

---

## 5. Evidência dos Testes de Integração Automatizados

Execução da suíte completa de testes no PostgreSQL 18:
```powershell
dotnet test tests/BuildingBlocks.UnitTests/BuildingBlocks.UnitTests.csproj
```
**Resultado:**
```
Aprovado! – Com falha: 0, Aprovado: 101, Ignorado: 0, Total: 101, Duração: 31 s
```

### Casos de Teste Específicos Cobertos (`UserEnterpriseAuthorizationIntegrationTests.cs`):
1. `JobTitle_CEO_DoesNotGrantPermissionsAutomatically` (Aprovado): Cargo CEO não concede permissões administrativas.
2. `JobTitle_ExecutiveDirector_DoesNotGrantPermissionsAutomatically` (Aprovado): Cargo Diretor Executivo não concede permissões.
3. `CustomJobTitle_IsSavedCorrectlyWithoutAlteringRoles` (Aprovado): Cargo personalizado gravado e isolado de permissões.
4. `PartnerCheckbox_WithoutOfficialPartnersCapitalRecord_DoesNotCreateFictitiousPartner` (Aprovado): Não cria sócio fictício.
5. `UserWithoutAccessManage_CannotListOrModifyUsers_Returns403` (Aprovado): Operador sem `access.manage` recebe 403 Forbidden.
6. `SelfPrivilegeElevation_IsBlockedWith403` (Aprovado): Bloqueio de auto-elevação com 403 Forbidden.
7. `UnauthenticatedOrDisabledUser_CannotLogin_Returns401` (Aprovado): Usuário sem vínculo societário ativo recebe 401.
8. `HeaderBadge_ReflectsAuthenticatedUserJobTitle` (Aprovado): `/api/auth/me` retorna o `JobTitle` confiável do usuário autenticado.
9. `AuditEvent_IsLoggedWhenUserIsCreatedAndRolesUpdated` (Aprovado): Auditoria registra criação e alterações com payload JSON.

---

## 6. Verificação do Frontend Next.js 16
```powershell
npm --prefix apps/web run build
```
**Resultado:** 25 rotas geradas estática e dinamicamente com **0 erros** de TypeScript ou Turbopack.
