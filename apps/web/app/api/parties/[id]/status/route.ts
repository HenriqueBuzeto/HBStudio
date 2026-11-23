import { NextRequest, NextResponse } from "next/server";
import { authorizeFleet, guardOrigin, FleetError, uuid } from "@/lib/fleet-session";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    guardOrigin(request);
    uuid(id, "Cadastro");
    const ctx = await authorizeFleet(request, "customers.edit");
    const tenantId = ctx.tenantId;

    const body = await request.json();
    if (typeof body.isActive !== "boolean") {
      return NextResponse.json({ error: "O estado ativo/inativo deve ser um valor booleano." }, { status: 400 });
    }
    const isActive = body.isActive;

    const sql = ctx.db;
    const res = await sql.query(
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
    if (err instanceof FleetError) {
      return NextResponse.json({ code: err.code, error: err.message }, { status: err.status });
    }
    console.error("Erro ao alterar status:", err);
    return NextResponse.json({ error: "Erro ao atualizar status" }, { status: 500 });
  }
}
