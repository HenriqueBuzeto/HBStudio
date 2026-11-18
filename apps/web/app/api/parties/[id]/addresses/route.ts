import { NextRequest, NextResponse } from "next/server";
import { authorizeFleet, guardOrigin, FleetError, uuid } from "@/lib/fleet-session";
import crypto from "crypto";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    guardOrigin(request);
    uuid(id, "Cadastro");
    const ctx = await authorizeFleet(request, "customers.edit");
    const tenantId = ctx.tenantId;

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

    const sql = ctx.db;
    // A FK simples de PartyId não substitui a checagem de isolamento por tenant.
    const party = await sql.query(
      'SELECT "Id" FROM parties WHERE "Id" = $1 AND "TenantId" = $2 LIMIT 1',
      [id, tenantId]
    );
    if (party.length === 0) return NextResponse.json({ error: "Cadastro não encontrado." }, { status: 404 });
    // Neon HTTP client is a callable query function (not a pg Pool).
    const addrId = crypto.randomUUID();
    const now = new Date().toISOString();

    await sql.query(
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
    if (err instanceof FleetError) {
      return NextResponse.json({ code: err.code, error: err.message }, { status: err.status });
    }
    console.error("Erro ao cadastrar endereço:", err);
    return NextResponse.json({ error: "Erro ao cadastrar endereço" }, { status: 500 });
  }
}
