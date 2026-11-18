import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/serverless-db";
import jwt from "jsonwebtoken";
import crypto from "crypto";

function getJwtSecret(): string {
  const secret = process.env.AUTH_SECRET || process.env.JWT_SECRET;
  if (!secret) throw new Error("MISSING_AUTH_SECRET");
  return secret;
}

// POST /api/fiscal/establishment - Salvar ou atualizar cadastro do estabelecimento fiscal no Neon
export async function POST(request: NextRequest) {
  const correlationId = request.headers.get("x-correlation-id") || crypto.randomUUID();

  try {
    const token = request.cookies.get("hb_access_token")?.value;
    if (!token) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const decoded: any = jwt.verify(token, getJwtSecret());
    const tenantId = decoded.tenant_id;
    const branchId = decoded.branch_id || "b0000000-0000-0000-0000-000000000001";

    const body = await request.json();
    const {
      corporateName,
      tradeName,
      cnpj,
      stateRegistration,
      municipalRegistration,
      cnae,
      regime, // 1 = Simples Nacional, 2 = Regime Normal
      street,
      number,
      complement,
      neighborhood,
      cityCodeIbge,
      cityName,
      state,
      postalCode,
      environment, // 1 = Producao, 2 = Homologacao
      nfceDefaultSeries,
      nfceNextNumber,
    } = body;

    if (!corporateName || !cnpj || !stateRegistration) {
      return NextResponse.json(
        { error: "Razão Social, CNPJ e Inscrição Estadual são obrigatórios para emissão fiscal." },
        { status: 400 }
      );
    }

    const cleanCnpj = cnpj.replace(/\D/g, "");
    if (cleanCnpj.length !== 14) {
      return NextResponse.json({ error: "CNPJ inválido (deve conter 14 dígitos)." }, { status: 400 });
    }

    const sql = getDb();

    // Verificar se já existe estabelecimento para o tenant
    const existing = await sql.query(
      `SELECT "Id" FROM fiscal_establishments WHERE "TenantId" = $1 LIMIT 1;`,
      [tenantId]
    );

    if (existing.length > 0) {
      // Atualizar estabelecimento existente
      await sql.query(
        `UPDATE fiscal_establishments
         SET "CorporateName" = $1,
             "TradeName" = $2,
             "Cnpj" = $3,
             "StateRegistration" = $4,
             "MunicipalRegistration" = $5,
             "Cnae" = $6,
             "Regime" = $7,
             "Street" = $8,
             "Number" = $9,
             "Complement" = $10,
             "Neighborhood" = $11,
             "CityCodeIbge" = $12,
             "CityName" = $13,
             "State" = $14,
             "PostalCode" = $15,
             "Environment" = $16,
             "NfceDefaultSeries" = $17,
             "NfceNextNumber" = $18,
             "IsNfceEnabled" = true,
             "IsActive" = true,
             "UpdatedAtUtc" = NOW()
         WHERE "Id" = $19 AND "TenantId" = $20;`,
        [
          corporateName.trim(),
          tradeName?.trim() || corporateName.trim(),
          cleanCnpj,
          stateRegistration.trim(),
          municipalRegistration?.trim() || "",
          cnae?.trim() || "4751201",
          Number(regime || 1),
          street?.trim() || "Rua Principal",
          number?.trim() || "100",
          complement?.trim() || null,
          neighborhood?.trim() || "Centro",
          cityCodeIbge?.trim() || "3550308", // Padrão SP
          cityName?.trim() || "São Paulo",
          state?.trim().toUpperCase() || "SP",
          postalCode?.replace(/\D/g, "") || "01001000",
          Number(environment || 1),
          Number(nfceDefaultSeries || 1),
          Number(nfceNextNumber || 1),
          existing[0].Id,
          tenantId,
        ]
      );

      return NextResponse.json({
        message: "Dados do estabelecimento fiscal atualizados com sucesso no Neon.",
        id: existing[0].Id,
      });
    } else {
      // Inserir novo estabelecimento
      const res = await sql.query(
        `INSERT INTO fiscal_establishments (
          "Id", "TenantId", "BranchId", "CorporateName", "TradeName", "Cnpj", "StateRegistration",
          "MunicipalRegistration", "Cnae", "Regime", "Street", "Number", "Complement",
          "Neighborhood", "CityCodeIbge", "CityName", "State", "PostalCode",
          "Environment", "QrVersion", "NfceDefaultSeries", "NfceNextNumber", "IsNfceEnabled", "IsActive", "CreatedAtUtc"
        )
        VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11, $12,
          $13, $14, $15, $16, $17,
          $18, 3, $19, $20, true, true, NOW()
        )
        RETURNING "Id";`,
        [
          tenantId,
          branchId,
          corporateName.trim(),
          tradeName?.trim() || corporateName.trim(),
          cleanCnpj,
          stateRegistration.trim(),
          municipalRegistration?.trim() || "",
          cnae?.trim() || "4751201",
          Number(regime || 1),
          street?.trim() || "Rua Principal",
          number?.trim() || "100",
          complement?.trim() || null,
          neighborhood?.trim() || "Centro",
          cityCodeIbge?.trim() || "3550308",
          cityName?.trim() || "São Paulo",
          state?.trim().toUpperCase() || "SP",
          postalCode?.replace(/\D/g, "") || "01001000",
          Number(environment || 1),
          Number(nfceDefaultSeries || 1),
          Number(nfceNextNumber || 1),
        ]
      );

      return NextResponse.json({
        message: "Estabelecimento fiscal cadastrado com sucesso no Neon.",
        id: res[0].Id,
      });
    }
  } catch (err: any) {
    console.error(`[${correlationId}] Erro ao salvar estabelecimento:`, err);
    return NextResponse.json({ error: "Erro interno ao salvar dados fiscais." }, { status: 500 });
  }
}
