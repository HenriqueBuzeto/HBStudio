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

    const sql = getDb();
    // A FK simples de PartyId não substitui a checagem de isolamento por tenant.
    const party = await sql(
      'SELECT "Id" FROM parties WHERE "Id" = $1 AND "TenantId" = $2 LIMIT 1',
      [id, tenantId]
    );
    if (party.length === 0) return NextResponse.json({ error: "Cadastro não encontrado." }, { status: 404 });
    // Neon HTTP client is a callable query function (not a pg Pool).
    const eqId = crypto.randomUUID();
    const now = new Date().toISOString();

    await sql(
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
    console.error("Erro ao vincular equipamento ao cliente:", err);
    return NextResponse.json({ error: "Erro ao cadastrar equipamento", detail: err.message }, { status: 500 });
  }
}
