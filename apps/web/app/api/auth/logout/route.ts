import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/serverless-db";
import jwt from "jsonwebtoken";
import crypto from "crypto";

function getJwtSecret(): string {
  return process.env.JWT_SECRET || process.env.AUTH_SECRET || "HBStudioDevJwtSecretKey2026Secure1234567890!";
}

export async function POST(request: NextRequest) {
  const correlationId = request.headers.get("x-correlation-id") || crypto.randomUUID();
  const token = request.cookies.get("hb_access_token")?.value;

  if (token) {
    try {
      const decoded: any = jwt.verify(token, getJwtSecret());
      const sessionId = decoded.session_id;
      const userId = decoded.sub || decoded.nameid;

      if (sessionId) {
        const sql = getDb();
        const expiresAt = decoded.exp ? new Date(decoded.exp * 1000).toISOString() : new Date(Date.now() + 8 * 3600 * 1000).toISOString();
        
        // Inserção estrita na tabela canônica revoked_sessions
        await sql.query(
          `INSERT INTO revoked_sessions ("Id", "SessionId", "UserId", "Reason", "ExpiresAtUtc", "CreatedAtUtc", "Version")
           VALUES (gen_random_uuid(), $1, $2, 'UserSignOut', $3, NOW(), 1)
           ON CONFLICT ("SessionId") DO NOTHING;`,
          [sessionId, userId || null, expiresAt]
        );
      }
    } catch (err: any) {
      console.warn(`[${correlationId}] Aviso durante revogação de sessão no logout:`, err.message);
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
