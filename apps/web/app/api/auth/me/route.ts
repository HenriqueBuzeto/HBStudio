import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/serverless-db";
import jwt from "jsonwebtoken";
import crypto from "crypto";

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
        { error: "Serviço indisponível.", code: "SERVICE_UNAVAILABLE" },
        { status: 503, headers: { "X-Correlation-Id": correlationId } }
      );
    }

    // 1. Verificar se a sessão foi revogada
    if (sessionId) {
      const revoked = await sql.query(
        `SELECT "Id" FROM "RevokedSessions" WHERE "SessionId" = $1 LIMIT 1;`,
        [sessionId]
      ).catch(() => []);
      if (revoked.length > 0) {
        return clearSessionResponse(correlationId);
      }
    }

    // 2. Buscar usuário no Neon e validar SecurityStamp
    const users = await sql.query(
      `SELECT "Id", "FullName", "Email", "IsActive", "DefaultBranchId", "TenantId", "JobTitle", "SecurityStamp"
       FROM users 
       WHERE "Id" = $1 
       LIMIT 1;`,
      [userId]
    );

    if (users.length === 0 || !users[0].IsActive) {
      return clearSessionResponse(correlationId);
    }

    const user = users[0];

    // Se o SecurityStamp mudou (permissões alteradas ou logout global), revogar
    if (String(user.SecurityStamp || "1") !== tokenSecurityStamp) {
      return clearSessionResponse(correlationId);
    }

    // 3. Validar se continua sendo sócio com acesso habilitado
    const partners = await sql.query(
      `SELECT "Id", "Name", "Type", "Status", "IsErpAccessEnabled"
       FROM partners
       WHERE "TenantId" = $1 
         AND (LOWER("Email") = LOWER($2) OR LOWER("Name") = LOWER($3))
         AND "Status" = 1 
         AND "IsErpAccessEnabled" = true
       LIMIT 1;`,
      [user.TenantId, user.Email.toLowerCase(), user.FullName.toLowerCase()]
    );

    if (partners.length === 0) {
      return clearSessionResponse(correlationId);
    }

    const partner = partners[0];

    // 4. Coletar permissões atualizadas
    const permsRes = await sql.query(
      `SELECT DISTINCT rp."PermissionKey"
       FROM role_permissions rp
       JOIN user_roles ur ON rp."RoleId" = ur."RoleId"
       WHERE ur."UserId" = $1 AND ur."TenantId" = $2;`,
      [user.Id, user.TenantId]
    );

    const permissions = permsRes.map((r: any) => r.PermissionKey);
    const partnerRoleName =
      partner.Type === 1 ? "ManagingPartner" :
      partner.Type === 2 ? "InvestorPartner" : "OperationalPartner";

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
