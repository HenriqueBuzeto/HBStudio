import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/serverless-db";
import jwt from "jsonwebtoken";
import crypto from "crypto";

function getJwtSecret(): string {
  const secret = process.env.AUTH_SECRET || process.env.JWT_SECRET;
  if (!secret) throw new Error("MISSING_AUTH_SECRET");
  return secret;
}

// POST /api/fiscal/certificate - Fazer upload e armazenar o Certificado Digital A1 no Neon
export async function POST(request: NextRequest) {
  const correlationId = request.headers.get("x-correlation-id") || crypto.randomUUID();

  try {
    const token = request.cookies.get("hb_access_token")?.value;
    if (!token) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const decoded: any = jwt.verify(token, getJwtSecret());
    const tenantId = decoded.tenant_id;

    const body = await request.json();
    const { pfxBase64, password } = body;

    if (!pfxBase64 || !password) {
      return NextResponse.json(
        { error: "Arquivo de certificado digital (.pfx / .p12) em Base64 e senha são obrigatórios." },
        { status: 400 }
      );
    }

    const sql = getDb();

    // 1. Obter estabelecimento fiscal
    const ests = await sql.query(
      `SELECT "Id", "Cnpj", "CorporateName" FROM fiscal_establishments WHERE "TenantId" = $1 LIMIT 1;`,
      [tenantId]
    );

    if (ests.length === 0) {
      return NextResponse.json(
        { error: "Configure primeiro os dados do Estabelecimento Fiscal antes de cadastrar o certificado." },
        { status: 400 }
      );
    }

    const establishmentId = ests[0].Id;
    const certBuffer = Buffer.from(pfxBase64, "base64");

    // Gerar impressão digital e criptografia do PFX e da senha
    const thumbprint = crypto.createHash("sha1").update(certBuffer).digest("hex").toUpperCase();
    const iv = crypto.randomBytes(16);
    const key = crypto.scryptSync(getJwtSecret(), "cert-salt", 32);

    const cipherRaw = crypto.createCipheriv("aes-256-cbc", key, iv);
    const encryptedRaw = Buffer.concat([cipherRaw.update(certBuffer), cipherRaw.final()]);

    const cipherPass = crypto.createCipheriv("aes-256-cbc", key, iv);
    const encryptedPass = Buffer.concat([cipherPass.update(password, "utf8"), cipherPass.final()]);

    // Data de validade padrão A1 (1 ano a partir de hoje)
    const validUntil = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

    // Desativar certificados anteriores
    await sql.query(
      `UPDATE fiscal_certificates SET "IsActive" = false WHERE "EstablishmentId" = $1;`,
      [establishmentId]
    );

    // Inserir certificado no Neon
    await sql.query(
      `INSERT INTO fiscal_certificates (
        "Id", "TenantId", "EstablishmentId", "SubjectName", "Thumbprint", "Cnpj",
        "ValidFromUtc", "ValidUntilUtc", "EncryptedRawData", "EncryptedPassword",
        "KeyIvBase64", "IsActive", "CreatedAtUtc"
      )
      VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5,
        NOW(), $6, $7, $8,
        $9, true, NOW()
      );`,
      [
        tenantId,
        establishmentId,
        ests[0].CorporateName,
        thumbprint,
        ests[0].Cnpj,
        validUntil,
        encryptedRaw,
        encryptedPass,
        iv.toString("base64"),
      ]
    );

    return NextResponse.json({
      message: "Certificado Digital A1 armazenado e protegido com sucesso no Neon.",
      thumbprint,
      validUntil,
    });
  } catch (err: any) {
    console.error(`[${correlationId}] Erro ao armazenar certificado:`, err);
    return NextResponse.json({ error: "Erro interno ao processar certificado digital." }, { status: 500 });
  }
}
