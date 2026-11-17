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

      if (sessionId) {
        const sql = getDb();
        await sql.query(
          `INSERT INTO "RevokedSessions" ("Id", "SessionId", "RevokedAtUtc", "TenantId")
           VALUES (gen_random_uuid(), $1, NOW(), $2)
           ON CONFLICT DO NOTHING;`,
          [sessionId, decoded.tenant_id || "a0000000-0000-0000-0000-000000000001"]
        ).catch(() => {});
      }
    } catch {
      // Ignora erro de verificação de token expirado no logout
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
