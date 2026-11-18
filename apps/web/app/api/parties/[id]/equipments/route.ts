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
      equipmentType,
      brand,
      model,
      color,
      serialNumber,
      imei1,
      imei2,
      notes
    } = body;

    if (!model?.trim()) {
      return NextResponse.json({ error: "Modelo do equipamento é obrigatório." }, { status: 400 });
    }

    const sql = ctx.db;
    // A FK simples de PartyId não substitui a checagem de isolamento por tenant.
    const party = await sql.query(
      'SELECT "Id" FROM parties WHERE "Id" = $1 AND "TenantId" = $2 LIMIT 1',
      [id, tenantId]
    );
    if (party.length === 0) return NextResponse.json({ error: "Cadastro não encontrado." }, { status: 404 });
    // Neon HTTP client is a callable query function (not a pg Pool).
    const eqId = crypto.randomUUID();
    const now = new Date().toISOString();

    await sql.query(
      `INSERT INTO customer_equipments (
        "Id", "TenantId", "PartyId", "EquipmentType", "Brand", "Model",
        "Color", "SerialNumber", "Imei1", "Imei2", "Notes", "CreatedAtUtc"
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11, $12
      );`,
      [
        eqId,
        tenantId,
        id,
        equipmentType || "Smartphone",
        brand || "Outro",
        model.trim(),
        color?.trim() || null,
        serialNumber?.trim() || null,
        imei1?.trim() || null,
        imei2?.trim() || null,
        notes?.trim() || null,
        now
      ]
    );

    return NextResponse.json({
      id: eqId,
      equipmentType: equipmentType || "Smartphone",
      brand: brand || "Outro",
      model: model.trim(),
      message: "Equipamento vinculado com sucesso!"
    });
  } catch (err: any) {
    if (err instanceof FleetError) {
      return NextResponse.json({ code: err.code, error: err.message }, { status: err.status });
    }
    console.error("Erro ao vincular equipamento ao cliente:", err);
    return NextResponse.json({ error: "Erro ao cadastrar equipamento" }, { status: 500 });
  }
}
