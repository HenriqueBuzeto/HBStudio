import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/serverless-db";
import jwt from "jsonwebtoken";
import crypto from "crypto";

function getJwtSecret(): string {
  const secret = process.env.AUTH_SECRET || process.env.JWT_SECRET;
  if (!secret) throw new Error("MISSING_AUTH_SECRET");
  return secret;
}

// POST /api/fiscal/csc - Cadastrar ou atualizar Token CSC da SEFAZ
export async function POST(request: NextRequest) {
  const correlationId = request.headers.get("x-correlation-id") || crypto.randomUUID();

  try {
    const token = request.cookies.get("hb_access_token")?.value;
    if (!token) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const decoded: any = jwt.verify(token, getJwtSecret());
    const tenantId = decoded.tenant_id;

    const body = await request.json();
    const { cscId, cscToken, environment } = body;

    if (!cscId || !cscToken) {
      return NextResponse.json({ error: "Identificador CSC (ex: 000001) e Código Token são obrigatórios." }, { status: 400 });
    }

    const sql = getDb();

    // 1. Obter estabelecimento fiscal
    const ests = await sql.query(
      `SELECT "Id" FROM fiscal_establishments WHERE "TenantId" = $1 LIMIT 1;`,
      [tenantId]
    );

    if (ests.length === 0) {
      return NextResponse.json(
        { error: "Configure primeiro os dados do Estabelecimento Fiscal antes de registrar o CSC." },
        { status: 400 }
      );
    }

    const establishmentId = ests[0].Id;
    const cleanToken = cscToken.trim();
    const masked =
      cleanToken.length > 8
        ? `${cleanToken.substring(0, 3)}***${cleanToken.substring(cleanToken.length - 3)}`
        : "CSC***OCULTO";

    // Criptografia AES segura do CSC
    const iv = crypto.randomBytes(16);
    const key = crypto.scryptSync(getJwtSecret(), "csc-salt", 32);
    const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
    const encrypted = Buffer.concat([cipher.update(cleanToken, "utf8"), cipher.final()]);
    const payloadWithIv = Buffer.concat([iv, encrypted]);

    // Desativar CSCs anteriores
    await sql.query(
      `UPDATE fiscal_cscs SET "IsActive" = false WHERE "EstablishmentId" = $1;`,
      [establishmentId]
    );

    // Inserir novo CSC
    await sql.query(
      `INSERT INTO fiscal_cscs (
        "Id", "TenantId", "EstablishmentId", "CscId", "EncryptedCscToken", "CscTokenMasked", "Environment", "IsActive", "CreatedAtUtc"
      )
      VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5, $6, true, NOW()
      );`,
      [
        tenantId,
        establishmentId,
        cscId.trim(),
        payloadWithIv,
        masked,
        Number(environment || 1),
      ]
    );

    return NextResponse.json({
      message: "Código de Segurança do Contribuinte (CSC) registrado com sucesso no Neon.",
      masked,
    });
  } catch (err: any) {
    console.error(`[${correlationId}] Erro ao registrar CSC:`, err);
    return NextResponse.json({ error: "Erro interno ao cadastrar CSC." }, { status: 500 });
  }
}
