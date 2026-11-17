import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/serverless-db";
import jwt from "jsonwebtoken";
import crypto from "crypto";

function getJwtSecret(): string {
  const secret = process.env.AUTH_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      "MISSING_AUTH_SECRET: A variável de ambiente AUTH_SECRET ou JWT_SECRET não está configurada no ambiente."
    );
  }
  return secret;
}

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

export async function GET(request: NextRequest) {
  const correlationId = request.headers.get("x-correlation-id") || crypto.randomUUID();
  const token = request.cookies.get("hb_access_token")?.value;

  if (!token) {
    return NextResponse.json(
      { error: "Sessão não encontrada.", code: "UNAUTHORIZED" },
      { status: 401, headers: { "X-Correlation-Id": correlationId } }
    );
  }

  try {
    const jwtSecret = getJwtSecret();
    const decoded: any = jwt.verify(token, jwtSecret);
    const userId = decoded.sub || decoded.nameid;
    const sessionId = decoded.session_id;
    const tokenSecurityStamp = String(decoded.security_stamp || "1");

    let sql;
    try {
      sql = getDb();
    } catch {
      return NextResponse.json(
        { error: "Serviço de banco indisponível.", code: "SERVICE_UNAVAILABLE" },
        { status: 503, headers: { "X-Correlation-Id": correlationId } }
      );
    }

    // 1. Verificar se a sessão foi revogada na tabela canônica revoked_sessions (Fail-Closed)
    if (sessionId) {
      try {
        const revoked = await sql.query(
          `SELECT "Id" FROM revoked_sessions WHERE "SessionId" = $1 LIMIT 1;`,
          [sessionId]
        );
        if (revoked.length > 0) {
          return clearSessionResponse(correlationId);
        }
      } catch (err: any) {
        console.error(`[${correlationId}] Erro ao verificar revogação de sessão no Neon:`, err.message);
        return NextResponse.json(
          { error: "Erro de comunicação ao validar integridade da sessão.", code: "DATABASE_ERROR" },
          { status: 503, headers: { "X-Correlation-Id": correlationId } }
        );
      }
    }

    // 2. Buscar usuário no Neon e validar SecurityStamp
    let users;
    try {
      users = await sql.query(
        `SELECT "Id", "FullName", "Email", "IsActive", "DefaultBranchId", "TenantId", "JobTitle", "SecurityStamp"
         FROM users 
         WHERE "Id" = $1 
         LIMIT 1;`,
        [userId]
      );
    } catch (err: any) {
      console.error(`[${correlationId}] Erro ao buscar dados de usuário no Neon:`, err.message);
      return NextResponse.json(
        { error: "Erro de comunicação com o banco de dados.", code: "DATABASE_ERROR" },
        { status: 503, headers: { "X-Correlation-Id": correlationId } }
      );
    }

    if (users.length === 0 || !users[0].IsActive) {
      return clearSessionResponse(correlationId);
    }

    const user = users[0];

    // Se o SecurityStamp mudou (logout global ou permissões revogadas), invalida imediatamente
    if (String(user.SecurityStamp || "1") !== tokenSecurityStamp) {
      return clearSessionResponse(correlationId);
    }

    // 3. Validar se continua sendo sócio com acesso habilitado (Validação formal por e-mail e tenant)
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
        [user.TenantId, user.Email.toLowerCase()]
      );
    } catch (err: any) {
      console.error(`[${correlationId}] Erro ao validar status societário no Neon:`, err.message);
      return NextResponse.json(
        { error: "Erro de comunicação com o banco de dados.", code: "DATABASE_ERROR" },
        { status: 503, headers: { "X-Correlation-Id": correlationId } }
      );
    }

    if (partners.length === 0) {
      return clearSessionResponse(correlationId);
    }

    const partner = partners[0];

    // 4. Coletar permissões atualizadas
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
      console.error(`[${correlationId}] Erro ao buscar permissões no Neon:`, err.message);
      return NextResponse.json(
        { error: "Erro de comunicação com o banco de dados.", code: "DATABASE_ERROR" },
        { status: 503, headers: { "X-Correlation-Id": correlationId } }
      );
    }

    const permissions = permsRes.map((r: any) => r.PermissionKey);
    const partnerRoleName = mapPartnerType(partner.Type);

    return NextResponse.json(
      {
        user: {
          id: user.Id,
          fullName: user.FullName,
          email: user.Email,
          tenantId: user.TenantId,
          branchId: user.DefaultBranchId,
          isPartner: true,
          partnerRole: partnerRoleName,
          permissions: permissions,
          jobTitle: user.JobTitle,
        },
      },
      { headers: { "X-Correlation-Id": correlationId } }
    );
  } catch (err: any) {
    return clearSessionResponse(correlationId);
  }
}

function clearSessionResponse(correlationId: string) {
  const res = NextResponse.json(
    { error: "Sessão inválida ou expirada.", code: "UNAUTHORIZED" },
    { status: 401, headers: { "X-Correlation-Id": correlationId } }
  );
  res.cookies.set("hb_access_token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
