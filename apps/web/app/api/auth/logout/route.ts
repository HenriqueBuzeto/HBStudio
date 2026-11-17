import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/serverless-db";
import { requireJwtSessionSecret } from "@/lib/serverless-auth-config";
import jwt from "jsonwebtoken";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  const correlationId = request.headers.get("x-correlation-id") || crypto.randomUUID();
  const token = request.cookies.get("hb_access_token")?.value;

  let revocationFailed = false;

  if (token) {
    try {
      const decoded = jwt.verify(token, requireJwtSessionSecret(), {
        algorithms: ["HS256"],
        issuer: "HBStudioErp",
        audience: "HBStudioErpClient",
      });
      if (typeof decoded === "string" ||
          typeof decoded.session_id !== "string" || !decoded.session_id ||
          typeof decoded.sub !== "string" || typeof decoded.exp !== "number") {
        throw new Error("INVALID_SESSION_CLAIMS");
      }

      const sql = getDb();
      const expiresAt = new Date(decoded.exp * 1000).toISOString();
      await sql.query(
        `INSERT INTO revoked_sessions ("Id", "SessionId", "UserId", "Reason", "ExpiresAtUtc", "CreatedAtUtc", "Version")
         VALUES (gen_random_uuid(), $1, $2, 'UserSignOut', $3, NOW(), 1)
         ON CONFLICT ("SessionId") DO NOTHING;`,
        [decoded.session_id, decoded.sub, expiresAt]
      );
    } catch (err: unknown) {
      // Token inválido/expirado já não representa sessão autenticada.
      // Falha de configuração/banco NÃO deve ser reportada como revogação concluída.
      if (!(err instanceof jwt.JsonWebTokenError)) {
        revocationFailed = true;
        console.error(`[${correlationId}] SESSION_REVOCATION_FAILED:`, err instanceof Error ? err.name : "UNKNOWN");
      }
    }
  }

  const response = NextResponse.json(
    revocationFailed
      ? { error: "Não foi possível confirmar a revogação da sessão.", code: "SESSION_REVOCATION_FAILED" }
      : { message: "Logout realizado com sucesso." },
    { status: revocationFailed ? 503 : 200, headers: { "X-Correlation-Id": correlationId } }
  );

  response.cookies.set("hb_access_token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}
