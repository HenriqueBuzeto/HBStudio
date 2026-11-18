import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/serverless-db";
import jwt from "jsonwebtoken";

function getJwtSecret(): string {
  const secret = process.env.AUTH_SECRET || process.env.JWT_SECRET;
  if (!secret) throw new Error("MISSING_AUTH_SECRET");
  return secret;
}

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("hb_access_token")?.value;
    if (!token) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const decoded: any = jwt.verify(token, getJwtSecret());
    const tenantId = decoded.tenant_id;

    const sql = getDb();

    // Buscar clientes
    const parties = await sql.query(
      `SELECT "Id", "Name", "TradeName", "DocumentNumber"
       FROM parties
       WHERE "TenantId" = $1 AND "IsActive" = true
       ORDER BY "Name" ASC
       LIMIT 100;`,
      [tenantId]
    );

    // Buscar produtos/SKUs
    const skus = await sql.query(
      `SELECT "Id", "SkuCode", "VariantName", "DefaultPrice"
       FROM product_skus
       WHERE "TenantId" = $1 AND "IsActive" = true
       ORDER BY "VariantName" ASC
       LIMIT 100;`,
      [tenantId]
    );

    return NextResponse.json({
      customers: parties.map((p: any) => ({
        id: p.Id,
        name: p.Name || p.TradeName || "Cliente sem nome",
        document: p.DocumentNumber || "",
      })),
      products: skus.map((s: any) => ({
        id: s.Id,
        skuCode: s.SkuCode,
        name: s.VariantName || s.SkuCode,
        price: Number(s.DefaultPrice || 0),
      })),
    });
  } catch (err: any) {
    return NextResponse.json({ error: "Erro ao buscar dados auxiliares." }, { status: 500 });
  }
}
