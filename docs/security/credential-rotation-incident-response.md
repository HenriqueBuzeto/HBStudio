# Procedimento de Rotação de Credenciais e Isolamento de Segurança (P0)

**Data:** 17 de Novembro de 2026  
**Status:** Executado / Em vigor  
**Escopo:** Banco de Dados Neon (PostgreSQL), Credenciais de Acesso ERP e Chaves Criptográficas

---

## 1. Contenção Imediata Executada

1. **Reversão de Commits Inseguros:**
   - Os commits `fbaf243` e `3689acd` foram **revertidos no histórico Git** via commits `ad68e94` e `c5733a6` e sincronizados na branch `master`.
   - Nenhuma mutação fiscal direta em Base64 ou alteração artificial de status de nota permanece no repositório.
   - O arquivo `apps/web/lib/neon-db.ts` foi removido.
2. **Preservação Canônica:**
   - Restaurada a exigência de validação através do motor oficial com o backend .NET, garantindo a execução do IdentityAccess e do motor fiscal Zeus DFe.NET com chaves criptografadas em repouso.

---

## 2. Ações Obrigatórias de Rotação (Checklist para o Administrador)

Devido à exposição acidental de credenciais em mensagens e histórico:

### A. Rotação do Banco de Dados Neon
1. Acesse o console oficial do **[Neon](https://console.neon.tech)**.
2. No seu projeto do ERP HB Studio:
   - Vá em **Project Settings** → **Roles / Users**.
   - Redefina a senha da role `neondb_owner` (clique em **Reset Password**).
   - O Neon gerará uma nova senha exclusiva e invalidará imediatamente a senha anterior (`npg_a60...`).
3. *(Recomendado para Produção)* Crie duas roles separadas:
   - `erp_runtime`: Com permissões de `SELECT`, `INSERT`, `UPDATE`, `DELETE` nas tabelas operacionais (privilégio mínimo para a API).
   - `erp_migrator`: Exclusivo para criação/modificação de esquema (`ALTER TABLE`, `CREATE TABLE`).

### B. Rotação do Usuário de Acesso ao ERP
1. Atualize a senha do usuário `henriquebuzeto@hbstudio.com` no banco com um novo hash PBKDF2 ou utilize o endpoint administrativo oficial de alteração de senha.
2. Nunca reutilize senhas administrativas anteriores.

### C. Geração de Nova Chave Mestra JWT
1. Em qualquer ferramenta de terminal segura (ou gerador de segredos), gere uma nova chave de no mínimo 64 caracteres aleatórios (ex: `openssl rand -base64 48`).
2. Cadastre a nova chave na variável de ambiente:
   - `Jwt__Key` (no provedor de execução do backend).
3. Isso invalidará imediatamente todos os tokens JWT emitidos anteriormente, forçando logout seguro em todas as sessões ativas.

### D. Atualização Segura na Vercel
1. No painel da **Vercel** → **Settings** → **Environment Variables**:
   - Atualize `POSTGRES_URL` e `DATABASE_URL` com a nova connection string do Neon gerada no Passo A.
   - Não compartilhe o valor dessas variáveis em chats ou relatórios públicos.
