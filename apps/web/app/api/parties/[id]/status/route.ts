import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/serverless-db";
import jwt from "jsonwebtoken";

function getJwtSecret(): string {
  const secret = process.env.AUTH_SECRET || process.env.JWT_SECRET;
  if (!secret) throw new Error("MISSING_AUTH_SECRET");
  return secret;
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const token = request.cookies.get("hb_access_token")?.value;
    if (!token) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const decoded: any = jwt.verify(token, getJwtSecret());
    const tenantId = decoded.tenant_id;

    const body = await request.json();
    const isActive = Boolean(body.isActive);

    const sql = getDb();
    const res = await sql(
      `UPDATE parties
       SET "IsActive" = $1, "UpdatedAtUtc" = NOW()
       WHERE "Id" = $2 AND "TenantId" = $3
       RETURNING "Id", "Name", "IsActive";`,
      [isActive, id, tenantId]
    );

    if (res.length === 0) {
      return NextResponse.json({ error: "Pessoa/Cliente não encontrado." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      id: res[0].Id,
      isActive: res[0].IsActive,
      message: `Status atualizado com sucesso para ${isActive ? "Ativo" : "Inativo"}.`
    });
  } catch (err: any) {
    console.error("Erro ao alterar status:", err);
    return NextResponse.json({ error: "Erro ao atualizar status", detail: err.message }, { status: 500 });
  }
}
