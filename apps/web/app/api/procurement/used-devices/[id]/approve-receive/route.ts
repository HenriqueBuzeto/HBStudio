import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/serverless-db";
import jwt from "jsonwebtoken";

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
    const userId = decoded.sub || decoded.uid;

    const sql = getDb();

    // Atualizar status para Recebido no Estoque (Status 3 = ReceivedInStock)
    const res = await sql.query(
      `UPDATE used_device_acquisitions
       SET "Status" = 3, "ApprovedByUserId" = $1, "UpdatedAtUtc" = NOW()
       WHERE "Id" = $2 AND "TenantId" = $3
       RETURNING "Id", "AcquisitionNumber", "SerialNumber";`,
      [userId, id, tenantId]
    );

    if (res.length === 0) {
      return NextResponse.json({ error: "Aquisição não encontrada ou acesso negado." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: `Aparelho/Equipamento ${res[0].AcquisitionNumber} aprovado e integrado ao estoque com sucesso!`,
    });
  } catch (err: any) {
    console.error("Erro ao aprovar e dar entrada no estoque:", err);
    return NextResponse.json({ error: "Erro ao aprovar entrada", detail: err.message }, { status: 500 });
  }
}
