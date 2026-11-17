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

export async function POST(request: NextRequest) {
  const correlationId = request.headers.get("x-correlation-id") || crypto.randomUUID();
  const token = request.cookies.get("hb_access_token")?.value;

  if (token) {
    try {
      const jwtSecret = getJwtSecret();
      const decoded: any = jwt.verify(token, jwtSecret);
      const sessionId = decoded.session_id;
      const userId = decoded.sub || decoded.nameid;

      if (sessionId) {
        const sql = getDb();
        const expiresAt = decoded.exp ? new Date(decoded.exp * 1000).toISOString() : new Date(Date.now() + 8 * 3600 * 1000).toISOString();
        
        // Inserção estrita na tabela canônica revoked_sessions (sem silenciar erros)
        await sql.query(
          `INSERT INTO revoked_sessions ("Id", "SessionId", "UserId", "Reason", "ExpiresAtUtc", "CreatedAtUtc", "Version")
           VALUES (gen_random_uuid(), $1, $2, 'UserSignOut', $3, NOW(), 1)
           ON CONFLICT ("SessionId") DO NOTHING;`,
          [sessionId, userId || null, expiresAt]
        );
      }
    } catch (err: any) {
      console.error(`[${correlationId}] Erro ao revogar sessão no Neon durante logout:`, err.message);
      // Se a falha for de banco ou configuração, retorna erro explícito para não enganar a auditoria
      return NextResponse.json(
        { error: "Não foi possível revogar a sessão no banco de dados. Tente novamente.", code: "LOGOUT_FAILED" },
        { status: 500, headers: { "X-Correlation-Id": correlationId } }
      );
    }
  }

  const response = NextResponse.json(
    { message: "Logout realizado com sucesso." },
    { headers: { "X-Correlation-Id": correlationId } }
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
