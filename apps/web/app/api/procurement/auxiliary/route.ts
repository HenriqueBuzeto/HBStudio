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

    // 1. Clientes / Fornecedores / Vendedores de balcão
    const parties = await sql.query(
      `SELECT "Id", "Name", "TradeName", "DocumentNumber"
       FROM parties
       WHERE "TenantId" = $1 AND "IsActive" = true
       ORDER BY "Name" ASC
       LIMIT 150;`,
      [tenantId]
    );

    // 2. SKUs e Modelos do Catálogo
    const skus = await sql.query(
      `SELECT ps."Id", ps."SkuCode", ps."VariantName", ps."DefaultPrice", pm."Name" as "ModelName"
       FROM product_skus ps
       LEFT JOIN product_models pm ON ps."ProductModelId" = pm."Id"
       WHERE ps."TenantId" = $1 AND ps."IsActive" = true
       ORDER BY ps."VariantName" ASC
       LIMIT 200;`,
      [tenantId]
    );

    // 3. Depósitos / Estoques
    const warehouses = await sql.query(
      `SELECT "Id", "Name", "Code"
       FROM warehouses
       WHERE "TenantId" = $1 AND "IsActive" = true
       ORDER BY "Name" ASC
       LIMIT 20;`,
      [tenantId]
    );

    return NextResponse.json({
      parties: parties.map((p: any) => ({
        id: p.Id,
        name: p.Name || p.TradeName || "Pessoa sem nome",
        document: p.DocumentNumber || "",
      })),
      skus: skus.map((s: any) => ({
        id: s.Id,
        skuCode: s.SkuCode,
        name: s.VariantName || s.SkuCode,
        modelName: s.ModelName || "Geral",
        defaultPrice: Number(s.DefaultPrice) || 0,
      })),
      warehouses: warehouses.map((w: any) => ({
        id: w.Id,
        name: w.Name,
        code: w.Code,
      })),
    });
  } catch (err: any) {
    console.error("Erro ao carregar dados auxiliares de procurement:", err);
    return NextResponse.json(
      { error: "Erro ao consultar dados auxiliares", detail: err.message },
      { status: 500 }
    );
  }
}
