# Guia Enterprise de Implantação do Backend (.NET 10) e Integração com a Vercel

Este documento detalha o processo de publicação do **Backend ASP.NET Core (.NET 10)** no **Railway** (ou em qualquer runtime Docker) integrado com o **PostgreSQL Neon** e o **Frontend Next.js** na **Vercel**.

---

## 1. Arquitetura de Comunicação em Produção

```mermaid
flowchart LR
    User["Navegador do Usuário"] -->|HTTPS / Cookies HttpOnly| Vercel["Frontend Next.js (Vercel)"]
    Vercel -->|BFF API_INTERNAL_URL| Railway["Backend .NET 10 (Railway / Docker)"]
    Railway -->|TLS / Npgsql| Neon["PostgreSQL (Neon AWS sa-east-1)"]
```

- O **Navegador** nunca conversa diretamente com o Backend .NET ou com o Neon. Todas as requisições passam pelo BFF Next.js na Vercel com cookies HttpOnly seguros contra XSS.
- O **BFF Next.js** necessita da variável `API_INTERNAL_URL` apontando para o endereço HTTPS público da API .NET no Railway.
- O **Backend .NET** executa as regras de negócio, autorizações por permissões, criptografia e workers de mensageria e fiscal.

---

## 2. Preparação do Dockerfile Multi-Stage (.NET 10)

O monorepositório conta com o arquivo `Dockerfile` na raiz para compilar o monorepo inteiro preservando as referências cruzadas de `apps/api` para `src/`:
- **Estágio 1 (Build):** Imagem base `mcr.microsoft.com/dotnet/sdk:10.0` com restore em cache e compilação em modo `Release`.
- **Estágio 2 (Runtime):** Imagem base `mcr.microsoft.com/dotnet/aspnet:10.0` executando como usuário não-privilegiado (`USER $APP_UID`), escutando na porta `8080`.

---

## 3. Passo a Passo de Implantação no Railway

### Passo 1: Criar o Projeto no Railway
1. Acesse [railway.com](https://railway.com) e faça login com sua conta do GitHub.
2. Clique em **"New Project"** → **"Deploy from GitHub repo"**.
3. Selecione o repositório **`HenriqueBuzeto/HBStudio`**.

### Passo 2: Configurar o Serviço de Build
1. No painel do serviço criado, acesse a aba **"Settings"**:
   - **Root Directory:** `/` (deixe a raiz, para o Dockerfile enxergar `src/` e `apps/api/`).
   - **Builder:** Selecione **`Dockerfile`** (o Railway detectará o `Dockerfile` da raiz).

### Passo 3: Cadastrar as Variáveis de Ambiente no Railway
Na aba **"Variables"** do serviço no Railway, cadastre as seguintes chaves:

| Nome da Variável | Valor Recomendado | Descrição |
| :--- | :--- | :--- |
| `ASPNETCORE_ENVIRONMENT` | `Production` | Ativa o modo de produção com validações estritas de segurança. |
| `PORT` | `8080` | Porta padrão onde a API escuta. |
| `ASPNETCORE_URLS` | `http://0.0.0.0:8080` | Bind de rede interno no contêiner. |
| `ConnectionStrings__DefaultConnection` | `postgresql://neondb_owner:npg_a60HPqlkhOiz@ep-royal-heart-b6jm4j7c-pooler.c-2.sa-east-1.aws.neon.tech/neondb?sslmode=require` | String de conexão segura com o Neon. |
| `Jwt__Key` | *(Gerar uma chave aleatória com mais de 32 caracteres)* | Chave secreta de assinatura dos tokens JWT. Ex: `HBStudioProdEnterpriseKeyNeon2026Secure!` |
| `Jwt__Issuer` | `HBStudioErp` | Emissor do token. |
| `Jwt__Audience` | `HBStudioErpClient` | Destinatário do token. |

> [!IMPORTANT]
> Em modo `Production`, o backend **rejeita a inicialização** caso `Jwt:Key` esteja em branco ou possua menos de 32 caracteres, garantindo que nenhuma chave padrão vaze em produção.

### Passo 4: Gerar Domínio Público no Railway
1. Na aba **"Settings"** do serviço, role até **"Networking"** e clique em **"Generate Domain"**.
2. O Railway gerará um endereço HTTPS público no formato:
   ```
   https://hbstudio-production.up.railway.app
   ```
3. Teste a saúde da API no navegador ou via curl:
   - **Liveness:** `https://hbstudio-production.up.railway.app/health` (deve retornar `{"status":"Healthy"}`)
   - **Readiness:** `https://hbstudio-production.up.railway.app/health/ready` (deve retornar `{"status":"Ready","database":"Connected"}`)

---

## 4. Passo a Passo de Integração na Vercel

Com a URL HTTPS do Railway em mãos, conecte o Frontend Next.js na Vercel:

1. Acesse o painel do seu projeto na [Vercel](https://vercel.com).
2. Vá em **Settings** → **Environment Variables**.
3. Adicione ou edite a variável:
   - **Key:** `API_INTERNAL_URL`
   - **Value:** `https://hbstudio-production.up.railway.app` *(use a sua URL real gerada no Railway, sem barra no final)*
   - **Environments:** Marque `Production`, `Preview` e `Development`.
4. Vá em **Deployments** e clique em **Redeploy** na última versão para que a nova variável entre em vigor.

---

## 5. Homologação Ponta a Ponta

Após o redeploy da Vercel:
1. Abra o domínio da Vercel (ex: `https://seu-erp.vercel.app/login`).
2. Digite as credenciais corporativas:
   - **E-mail:** `henriquebuzeto@hbstudio.com`
   - **Senha:** `Hique03@`
3. Clique em **"Acessar Painel HB Studio"**.
4. O login autenticará no backend do Railway, validará no Neon e redirecionará com cookie seguro `hb_access_token` para o dashboard.
