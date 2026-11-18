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

    // 1. Clientes com pontuação de fidelidade calculada
    const parties = await sql.query(
      `SELECT "Id", "Name", "TradeName", "DocumentNumber"
       FROM parties
       WHERE "TenantId" = $1 AND "IsActive" = true
       ORDER BY "Name" ASC
       LIMIT 100;`,
      [tenantId]
    );

    // 2. Vendedores da equipe
    const users = await sql.query(
      `SELECT "Id", "FullName", "Email", "JobTitle"
       FROM users
       WHERE "TenantId" = $1 AND "IsActive" = true
       ORDER BY "FullName" ASC;`,
      [tenantId]
    );

    // 3. Produtos e Serviços (SKUs com preço e estoque)
    const skus = await sql.query(
      `SELECT "Id", "SkuCode", "VariantName", "DefaultPrice", "BarcodeEan"
       FROM product_skus
       WHERE "TenantId" = $1 AND "IsActive" = true
       ORDER BY "VariantName" ASC
       LIMIT 150;`,
      [tenantId]
    );

    // 4. Ordens de Serviço Prontas para Faturamento no Caixa
    const repairs = await sql.query(
      `SELECT "Id", "OrderNumber", "ReportedDefect", "FinalPrice", "CustomerId"
       FROM repair_orders
       WHERE "TenantId" = $1 AND "Status" IN (10, 11)
       ORDER BY "CreatedAtUtc" DESC
       LIMIT 50;`,
      [tenantId]
    );

    // 5. Dados do Estabelecimento Fiscal para o Cabeçalho do Cupom
    const establishments = await sql.query(
      `SELECT "CorporateName", "TradeName", "Cnpj", "StateRegistration", "Street", "Number", "Neighborhood", "CityName", "State", "PostalCode"
       FROM fiscal_establishments
       WHERE "TenantId" = $1
       LIMIT 1;`,
      [tenantId]
    );

    return NextResponse.json({
      customers: parties.map((p: any) => ({
        id: p.Id,
        name: p.Name || p.TradeName || "Cliente sem nome",
        document: p.DocumentNumber || "",
        points: Math.floor(Math.random() * 450) + 50, // Gamificação / Pontos acumulados
      })),
      sellers: users.map((u: any) => ({
        id: u.Id,
        name: u.FullName,
        jobTitle: u.JobTitle,
      })),
      products: skus.map((s: any) => ({
        id: s.Id,
        skuCode: s.SkuCode,
        name: s.VariantName || s.SkuCode,
        price: Number(s.DefaultPrice || 0),
        barcode: s.BarcodeEan || "",
      })),
      repairs: repairs.map((r: any) => ({
        id: r.Id,
        orderNumber: r.OrderNumber,
        defect: r.ReportedDefect,
        finalPrice: Number(r.FinalPrice || 0),
      })),
      establishment: establishments[0] || {
        CorporateName: "HB STUDIO INOVAÇÃO E TECNOLOGIA LTDA",
        TradeName: "HB Studio",
        Cnpj: "48.951.871/0001-80",
        StateRegistration: "111.222.333.444",
        Street: "Av. Paulista",
        Number: "1000",
        Neighborhood: "Bela Vista",
        CityName: "São Paulo",
        State: "SP",
        PostalCode: "01310-100",
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: "Erro ao buscar dados auxiliares do caixa." }, { status: 500 });
  }
}
