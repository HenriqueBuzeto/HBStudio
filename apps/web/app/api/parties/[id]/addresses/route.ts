import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/serverless-db";
import jwt from "jsonwebtoken";
import crypto from "crypto";

function getJwtSecret(): string {
  const secret = process.env.AUTH_SECRET || process.env.JWT_SECRET;
  if (!secret) throw new Error("MISSING_AUTH_SECRET");
  return secret;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const token = request.cookies.get("hb_access_token")?.value;
    if (!token) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const decoded: any = jwt.verify(token, getJwtSecret());
    const tenantId = decoded.tenant_id;

    const body = await request.json();
    const {
      street,
      number,
      complement,
      neighborhood,
      city,
      state,
      postalCode,
      isPrimary
    } = body;

    if (!street?.trim() || !number?.trim() || !city?.trim() || !state?.trim() || !postalCode?.trim()) {
      return NextResponse.json({ error: "Campos obrigatórios de endereço ausentes." }, { status: 400 });
    }

    const sql = getDb();
    // A FK simples de PartyId não substitui a checagem de isolamento por tenant.
    const party = await sql(
      'SELECT "Id" FROM parties WHERE "Id" = $1 AND "TenantId" = $2 LIMIT 1',
      [id, tenantId]
    );
    if (party.length === 0) return NextResponse.json({ error: "Cadastro não encontrado." }, { status: 404 });
    // Neon HTTP client is a callable query function (not a pg Pool).
    const addrId = crypto.randomUUID();
    const now = new Date().toISOString();

    await sql(
      `INSERT INTO party_addresses (
        "Id", "TenantId", "PartyId", "Street", "Number", "Complement",
        "Neighborhood", "City", "State", "PostalCode", "IsPrimary", "CreatedAtUtc"
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11, $12
      );`,
      [
        addrId,
        tenantId,
        id,
        street.trim(),
        number.trim(),
        complement?.trim() || null,
        neighborhood?.trim() || "Centro",
        city.trim(),
        state.trim().toUpperCase(),
        postalCode.trim(),
        isPrimary ?? true,
        now
      ]
    );

    return NextResponse.json({
      id: addrId,
      message: "Endereço cadastrado com sucesso!"
    });
  } catch (err: any) {
    console.error("Erro ao cadastrar endereço:", err);
    return NextResponse.json({ error: "Erro ao cadastrar endereço", detail: err.message }, { status: 500 });
  }
}
