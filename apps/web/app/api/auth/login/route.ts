import { NextRequest, NextResponse } from "next/server";
import { getDb, verifyPbkdf2Password } from "@/lib/serverless-db";
import jwt from "jsonwebtoken";
import crypto from "crypto";

// Armazenamento em memória para mitigação contra força bruta (Rate Limiting)
const failedAttemptsMap = new Map<string, { attempts: number; lockedUntil: number }>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutos

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET || process.env.AUTH_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("CRITICAL_CONFIG_ERROR: A variável de ambiente JWT_SECRET ou AUTH_SECRET é obrigatória em produção.");
    }
    return "HBStudioDevJwtSecretKey2026Secure1234567890!";
  }
  return secret;
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

    // 1. Verificação de lockout por força bruta
    const lockInfo = failedAttemptsMap.get(normalizedEmail);
    if (lockInfo && Date.now() < lockInfo.lockedUntil) {
      return NextResponse.json(
        { error: "Acesso temporariamente bloqueado por excesso de tentativas incorretas. Tente novamente mais tarde.", code: "LOCKED_OUT" },
        { status: 429, headers: { "X-Correlation-Id": correlationId } }
      );
    }

    let sql;
    try {
      sql = getDb();
    } catch (dbErr: any) {
      console.error(`[${correlationId}] Erro de configuração de banco:`, dbErr.message);
      return NextResponse.json(
        { error: "Serviço de autenticação temporariamente indisponível. Verifique as configurações do servidor.", code: "DATABASE_UNAVAILABLE" },
        { status: 503, headers: { "X-Correlation-Id": correlationId } }
      );
    }

    // 2. Busca do usuário na tabela oficial users
    const users = await sql.query(
      `SELECT "Id", "FullName", "Email", "PasswordHash", "IsActive", "DefaultBranchId", "TenantId", "JobTitle", "SecurityStamp"
       FROM users 
       WHERE LOWER("Email") = LOWER($1) 
       LIMIT 1;`,
      [normalizedEmail]
    );

    // Proteção contra enumeração: resposta uniforme caso não exista ou esteja inativo
    if (users.length === 0 || !users[0].IsActive) {
      recordFailure(normalizedEmail);
      return NextResponse.json(
        { error: "Não foi possível entrar. Verifique suas credenciais ou procure o responsável pelo acesso.", code: "UNAUTHORIZED" },
        { status: 401, headers: { "X-Correlation-Id": correlationId } }
      );
    }

    const user = users[0];

    // 3. Validação segura da senha usando o algoritmo PBKDF2 canônico do ERP
    const isPasswordValid = verifyPbkdf2Password(password, user.PasswordHash);
    if (!isPasswordValid) {
      recordFailure(normalizedEmail);
      return NextResponse.json(
        { error: "Não foi possível entrar. Verifique suas credenciais ou procure o responsável pelo acesso.", code: "UNAUTHORIZED" },
        { status: 401, headers: { "X-Correlation-Id": correlationId } }
      );
    }

    // 4. REGRA CENTRAL ENTERPRISE: ACESSO INTERATIVO RESTRITO EXCLUSIVAMENTE AOS SÓCIOS AUTORIZADOS
    // O usuário deve possuir registro societário ativo e IsErpAccessEnabled = true
    const partners = await sql.query(
      `SELECT "Id", "Name", "Type", "Status", "IsErpAccessEnabled"
       FROM partners
       WHERE "TenantId" = $1 
         AND (LOWER("Email") = LOWER($2) OR LOWER("Name") = LOWER($3))
         AND "Status" = 1 
         AND "IsErpAccessEnabled" = true
       LIMIT 1;`,
      [user.TenantId, normalizedEmail, user.FullName.toLowerCase()]
    );

    if (partners.length === 0) {
      recordFailure(normalizedEmail);
      return NextResponse.json(
        { error: "Acesso restrito exclusivamente a sócios com habilitação ativa no ERP.", code: "PARTNER_ACCESS_REQUIRED" },
        { status: 403, headers: { "X-Correlation-Id": correlationId } }
      );
    }

    const partner = partners[0];
    failedAttemptsMap.delete(normalizedEmail);

    // 5. Coleta das permissões efetivas do usuário
    const permsRes = await sql.query(
      `SELECT DISTINCT rp."PermissionKey"
       FROM role_permissions rp
       JOIN user_roles ur ON rp."RoleId" = ur."RoleId"
       WHERE ur."UserId" = $1 AND ur."TenantId" = $2;`,
      [user.Id, user.TenantId]
    );

    const permissions = permsRes.map((r: any) => r.PermissionKey);
    const sessionId = crypto.randomUUID().replace(/-/g, "");

    // 6. Geração do token JWT assinado com claims corporativas
    const jwtSecret = getJwtSecret();
    const token = jwt.sign(
      {
        sub: user.Id,
        nameid: user.Id,
        email: user.Email,
        tenant_id: user.TenantId,
        branch_id: user.DefaultBranchId,
        session_id: sessionId,
        security_stamp: String(user.SecurityStamp || 1),
        permission: permissions,
      },
      jwtSecret,
      {
        expiresIn: "8h",
        issuer: "HBStudioErp",
        audience: "HBStudioErpClient",
      }
    );

    const partnerRoleName =
      partner.Type === 1 ? "ManagingPartner" :
      partner.Type === 2 ? "InvestorPartner" : "OperationalPartner";

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

    // 7. Registro de auditoria no Neon
    try {
      await sql.query(
        `INSERT INTO audit_events ("Id", "TenantId", "BranchId", "EventType", "UserId", "Email", "Details", "CreatedAtUtc", "Severity")
         VALUES (gen_random_uuid(), $1, $2, 'PartnerLoginSuccess', $3, $4, $5, NOW(), 1);`,
        [user.TenantId, user.DefaultBranchId, user.Id, user.Email, `Login efetuado com sucesso pelo sócio ${partner.Name}. Sessão: ${sessionId}`]
      );
    } catch (auditErr) {
      console.warn("Aviso: Falha ao registrar log de auditoria no Neon:", auditErr);
    }

    // 8. Resposta segura com Cookie HttpOnly blindado
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

function recordFailure(email: string) {
  const current = failedAttemptsMap.get(email) || { attempts: 0, lockedUntil: 0 };
  current.attempts += 1;
  if (current.attempts >= MAX_ATTEMPTS) {
    current.lockedUntil = Date.now() + LOCKOUT_MS;
  }
  failedAttemptsMap.set(email, current);
}
