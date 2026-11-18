import { NextRequest, NextResponse } from "next/server";
import { getDb, verifyPbkdf2Password } from "@/lib/serverless-db";
import jwt from "jsonwebtoken";
import crypto from "crypto";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MINUTES = 15;

function getJwtSecret(): string {
  const secret = process.env.AUTH_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      "MISSING_AUTH_SECRET: A variável de ambiente AUTH_SECRET ou JWT_SECRET não está configurada no ambiente. Configure em Settings > Environment Variables na Vercel."
    );
  }
  return secret;
}

// Mapeamento canônico estrito de PartnerType (conforme enum oficial no backend C#):
// 1 = ManagingPartner (Sócio-Administrador)
// 2 = OperatingPartner (Sócio-Operacional)
// 3 = SilentPartner (Sócio-Investidor/Capitalista)
// 4 = AdvisoryPartner (Conselheiro)
function mapPartnerType(type: number): string {
  switch (type) {
    case 1:
      return "ManagingPartner";
    case 2:
      return "OperatingPartner";
    case 3:
      return "SilentPartner";
    case 4:
      return "AdvisoryPartner";
    default:
      return "Partner";
  }
}

export async function POST(request: NextRequest) {
  const correlationId = request.headers.get("x-correlation-id") || crypto.randomUUID();

  try {
    const body = await request.json().catch(() => ({}));
    const { email, password } = body;

    if (!email || typeof email !== "string" || !password || typeof password !== "string") {
      return NextResponse.json(
        { error: "Informe e-mail corporativo e senha de acesso.", code: "INVALID_CREDENTIALS" },
        { status: 400, headers: { "X-Correlation-Id": correlationId } }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    // 1. Obter conexão com o Neon Database
    let sql;
    try {
      sql = getDb();
    } catch (dbErr: any) {
      console.error(`[${correlationId}] DATABASE_UNAVAILABLE:`, dbErr.message);
      return NextResponse.json(
        { error: "DATABASE_UNAVAILABLE: Variável DATABASE_URL não configurada ou inacessível no ambiente da Vercel.", code: "DATABASE_UNAVAILABLE" },
        { status: 503, headers: { "X-Correlation-Id": correlationId } }
      );
    }

    // 2. RATE LIMITING PERSISTENTE NO NEON (Cross-Instance Serverless)
    // Consulta falhas recentes registradas em audit_events nos últimos 15 minutos
    const lockoutWindowUtc = new Date(Date.now() - LOCKOUT_WINDOW_MINUTES * 60 * 1000).toISOString();
    try {
      const lockRes = await sql.query(
        `SELECT COUNT(*)::int AS failures
         FROM audit_events
         WHERE "Action" = 'LoginFailed'
           AND LOWER("ActorEmail") = LOWER($1)
           AND "CreatedAtUtc" >= $2`,
        [normalizedEmail, lockoutWindowUtc]
      );

      const recentFailures = lockRes[0]?.failures || 0;
      if (recentFailures >= MAX_FAILED_ATTEMPTS) {
        return NextResponse.json(
          {
            error: `Acesso temporariamente bloqueado por excesso de tentativas incorretas (${recentFailures}/${MAX_FAILED_ATTEMPTS}). Tente novamente em 15 minutos.`,
            code: "LOCKED_OUT",
          },
          { status: 429, headers: { "X-Correlation-Id": correlationId } }
        );
      }
    } catch (lockErr: any) {
      console.error(`[${correlationId}] Erro ao verificar rate limiting persistente no Neon:`, lockErr.message);
      // Política Fail-Closed: se houver falha de banco ao verificar rate limit, recusa por segurança
      return NextResponse.json(
        { error: "Serviço de segurança temporariamente indisponível.", code: "DATABASE_ERROR" },
        { status: 503, headers: { "X-Correlation-Id": correlationId } }
      );
    }

    // 3. Busca do usuário na tabela oficial users
    let users;
    try {
      users = await sql.query(
        `SELECT "Id", "FullName", "Email", "PasswordHash", "IsActive", "DefaultBranchId", "TenantId", "JobTitle", "SecurityStamp"
         FROM users 
         WHERE LOWER("Email") = LOWER($1) 
         LIMIT 1;`,
        [normalizedEmail]
      );
    } catch (err: any) {
      console.error(`[${correlationId}] Erro ao consultar tabela users no Neon:`, err.message);
      return NextResponse.json(
        { error: "Falha na comunicação com o banco de dados Neon.", code: "DATABASE_ERROR" },
        { status: 503, headers: { "X-Correlation-Id": correlationId } }
      );
    }

    // Proteção contra enumeração: resposta uniforme caso não exista ou esteja inativo
    if (users.length === 0 || !users[0].IsActive) {
      await recordAuditFailure(sql, null, null, normalizedEmail, correlationId, "UserNotFoundOrInactive", request);
      return NextResponse.json(
        { error: "Não foi possível entrar. Verifique suas credenciais ou procure o responsável pelo acesso.", code: "UNAUTHORIZED" },
        { status: 401, headers: { "X-Correlation-Id": correlationId } }
      );
    }

    const user = users[0];

    // 4. Validação segura da senha usando o algoritmo PBKDF2 canônico do ERP
    const isPasswordValid = verifyPbkdf2Password(password, user.PasswordHash);
    if (!isPasswordValid) {
      await recordAuditFailure(sql, user.TenantId, user.DefaultBranchId, normalizedEmail, correlationId, "InvalidPassword", request, user.Id);
      return NextResponse.json(
        { error: "Não foi possível entrar. Verifique suas credenciais ou procure o responsável pelo acesso.", code: "UNAUTHORIZED" },
        { status: 401, headers: { "X-Correlation-Id": correlationId } }
      );
    }

    // 5. REGRA CENTRAL ENTERPRISE: ACESSO INTERATIVO RESTRITO EXCLUSIVAMENTE AOS SÓCIOS AUTORIZADOS
    // O sócio deve possuir registro ativo, IsErpAccessEnabled = true e corresponder formalmente ao e-mail corporativo cadastrado
    let partners;
    try {
      partners = await sql.query(
        `SELECT "Id", "PartyId", "Name", "Email", "Type", "Status", "IsErpAccessEnabled", "TenantId"
         FROM partners
         WHERE "TenantId" = $1 
           AND LOWER("Email") = LOWER($2)
           AND "Status" = 1 
           AND "IsErpAccessEnabled" = true
         LIMIT 1;`,
        [user.TenantId, normalizedEmail]
      );
    } catch (err: any) {
      console.error(`[${correlationId}] Erro ao consultar tabela partners no Neon:`, err.message);
      return NextResponse.json(
        { error: "Falha na validação societária com o banco Neon.", code: "DATABASE_ERROR" },
        { status: 503, headers: { "X-Correlation-Id": correlationId } }
      );
    }

    if (partners.length === 0) {
      await recordAuditFailure(sql, user.TenantId, user.DefaultBranchId, normalizedEmail, correlationId, "PartnerNotAuthorized", request, user.Id);
      return NextResponse.json(
        { error: "Acesso restrito exclusivamente a sócios com habilitação ativa no ERP.", code: "PARTNER_ACCESS_REQUIRED" },
        { status: 403, headers: { "X-Correlation-Id": correlationId } }
      );
    }

    const partner = partners[0];

    // 6. Coleta das permissões efetivas do usuário com isolamento multi-tenant estrito
    let permsRes;
    try {
      permsRes = await sql.query(
        `SELECT DISTINCT rp."PermissionKey"
         FROM role_permissions rp
         JOIN user_roles ur ON rp."RoleId" = ur."RoleId" AND rp."TenantId" = ur."TenantId"
         WHERE ur."UserId" = $1 AND ur."TenantId" = $2;`,
        [user.Id, user.TenantId]
      );
    } catch (err: any) {
      console.error(`[${correlationId}] Erro ao consultar permissões no Neon:`, err.message);
      return NextResponse.json(
        { error: "Falha na coleta de permissões do usuário.", code: "DATABASE_ERROR" },
        { status: 503, headers: { "X-Correlation-Id": correlationId } }
      );
    }

    const permissions = permsRes.map((r: any) => r.PermissionKey);
    const sessionId = crypto.randomUUID().replace(/-/g, "");

    // 7. Obtenção do segredo de assinatura JWT (Sem fallback inseguro fixo)
    let jwtSecret: string;
    try {
      jwtSecret = getJwtSecret();
    } catch (secretErr: any) {
      console.error(`[${correlationId}] CONFIG_ERROR:`, secretErr.message);
      return NextResponse.json(
        {
          error: "CONFIG_ERROR: AUTH_SECRET não configurado na Vercel. Defina AUTH_SECRET nas variáveis de ambiente do projeto.",
          code: "CONFIG_ERROR",
        },
        { status: 500, headers: { "X-Correlation-Id": correlationId } }
      );
    }

    // 8. Geração do token JWT assinado com claims corporativas
    const token = jwt.sign(
      {
        sub: user.Id,
        nameid: user.Id,
        email: user.Email,
        tenant_id: user.TenantId,
        branch_id: user.DefaultBranchId,
        session_id: sessionId,
        security_stamp: String(user.SecurityStamp || 1),
        // Não incluir as 133 PermissionKeys no JWT/cookie: o token anterior
        // excedia o limite de ~4 KiB por cookie e era descartado pelo browser.
        // As permissões efetivas são consultadas do Neon em /api/auth/me,
        // após autenticação e validação da sessão, sem confiar em claims antigas.
      },
      jwtSecret,
      {
        expiresIn: "8h",
        issuer: "HBStudioErp",
        audience: "HBStudioErpClient",
      }
    );

    // Fail-closed para futuras alterações no JWT: não voltar a emitir
    // cookies acima dos limites comuns dos navegadores.
    if (Buffer.byteLength(`hb_access_token=${token}`, "utf8") > 3800) {
      console.error(`[${correlationId}] SESSION_COOKIE_TOO_LARGE`);
      return NextResponse.json(
        {
          error: "Não foi possível criar uma sessão compatível com o navegador.",
          code: "SESSION_COOKIE_TOO_LARGE",
        },
        { status: 500, headers: { "X-Correlation-Id": correlationId } }
      );
    }

    const partnerRoleName = mapPartnerType(partner.Type);

    const userProfile = {
      id: user.Id,
      fullName: user.FullName,
      email: user.Email,
      tenantId: user.TenantId,
      branchId: user.DefaultBranchId,
      isPartner: true,
      partnerRole: partnerRoleName,
      permissions: permissions,
      jobTitle: user.JobTitle,
    };

    // 9. Registro de auditoria no Neon compatível com o esquema canônico da tabela audit_events
    try {
      await sql.query(
        `INSERT INTO audit_events (
          "Id", "TenantId", "BranchId", "EntityType", "EntityId", "Action",
          "ActorId", "ActorEmail", "CorrelationId", "BeforeStateJson", "AfterStateJson",
          "CreatedAtUtc", "Version"
        )
        VALUES (
          gen_random_uuid(), $1, $2, 'Session', $3, 'PartnerLoginSuccess',
          $4, $5, $6, NULL, $7::jsonb,
          NOW(), 1
        );`,
        [
          user.TenantId,
          user.DefaultBranchId,
          sessionId,
          user.Id,
          user.Email,
          correlationId,
          JSON.stringify({
            partnerId: partner.Id,
            partnerType: partnerRoleName,
            partnerName: partner.Name,
            ipAddress: request.headers.get("x-forwarded-for") || "unknown",
          }),
        ]
      );
    } catch (auditErr: any) {
      console.warn(`[${correlationId}] Aviso: Falha não bloqueante ao registrar login de auditoria no Neon:`, auditErr.message);
    }

    // 10. Resposta com Cookie HttpOnly blindado
    const response = NextResponse.json(
      { user: userProfile },
      { headers: { "X-Correlation-Id": correlationId } }
    );

    response.cookies.set("hb_access_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 8 * 60 * 60, // 8 horas
    });

    return response;
  } catch (err: any) {
    console.error(`[${correlationId}] Erro interno no login:`, err);
    return NextResponse.json(
      { error: "Erro interno ao processar autenticação.", code: "INTERNAL_ERROR" },
      { status: 500, headers: { "X-Correlation-Id": correlationId } }
    );
  }
}

async function recordAuditFailure(
  sql: any,
  tenantId: string | null,
  branchId: string | null,
  email: string,
  correlationId: string,
  reason: string,
  request: NextRequest,
  actorId?: string
) {
  try {
    await sql.query(
      `INSERT INTO audit_events (
        "Id", "TenantId", "BranchId", "EntityType", "EntityId", "Action",
        "ActorId", "ActorEmail", "CorrelationId", "BeforeStateJson", "AfterStateJson",
        "CreatedAtUtc", "Version"
      )
      VALUES (
        gen_random_uuid(), $1, $2, 'Session', gen_random_uuid()::text, 'LoginFailed',
        $3, $4, $5, NULL, $6::jsonb,
        NOW(), 1
      );`,
      [
        tenantId,
        branchId,
        actorId || null,
        email,
        correlationId,
        JSON.stringify({
          reason,
          ipAddress: request.headers.get("x-forwarded-for") || "unknown",
        }),
      ]
    );
  } catch (auditErr: any) {
    console.warn(`[${correlationId}] Aviso: Falha ao persistir tentativa de login falha no Neon:`, auditErr.message);
  }
}
