import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/serverless-db";
import jwt from "jsonwebtoken";
import crypto from "crypto";


function getJwtSecret(): string {
  const secret = process.env.AUTH_SECRET || process.env.JWT_SECRET;
  if (!secret) throw new Error("MISSING_AUTH_SECRET");
  return secret;
}

// GET: Listar aquisições de usados/eletrônicos no balcão
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("hb_access_token")?.value;
    if (!token) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const decoded: any = jwt.verify(token, getJwtSecret());
    const tenantId = decoded.tenant_id;

    const sql = getDb();

    const acquisitions = await sql.query(
      `SELECT 
        u."Id",
        u."BranchId",
        u."SellerPartyId",
        p."Name" AS "SellerName",
        u."ProductSkuId",
        ps."SkuCode",
        ps."VariantName" AS "SkuName",
        u."InventoryUnitId",
        u."AcquisitionNumber",
        u."SerialNumber",
        u."Imei1",
        u."Imei2",
        u."Condition",
        u."Grade",
        u."BatteryHealthPercentage",
        u."NegotiatedPrice",
        u."AttributableExpenses",
        u."ChecklistInspectionJson",
        u."Status",
        u."Notes",
        u."CreatedAtUtc"
       FROM used_device_acquisitions u
       LEFT JOIN parties p ON u."SellerPartyId" = p."Id"
       LEFT JOIN product_skus ps ON u."ProductSkuId" = ps."Id"
       WHERE u."TenantId" = $1
       ORDER BY u."CreatedAtUtc" DESC;`,
      [tenantId]
    );

    return NextResponse.json(
      acquisitions.map((a: any) => ({
        id: a.Id,
        branchId: a.BranchId,
        sellerPartyId: a.SellerPartyId,
        sellerName: a.SellerName || "Cliente Vendedor",
        productSkuId: a.ProductSkuId,
        skuCode: a.SkuCode || "SKU-USADO",
        skuName: a.SkuName || "Produto Seminovos",
        inventoryUnitId: a.InventoryUnitId,
        acquisitionNumber: a.AcquisitionNumber,
        serialNumber: a.SerialNumber,
        imei1: a.Imei1,
        imei2: a.Imei2,
        condition: a.Condition === 1 ? "BrandNew" : a.Condition === 2 ? "UsedGood" : a.Condition === 3 ? "Refurbished" : "UsedFair",
        grade: a.Grade === 1 ? "GradeA" : a.Grade === 2 ? "GradeB" : a.Grade === 3 ? "GradeC" : "None",
        batteryHealthPercentage: a.BatteryHealthPercentage,
        negotiatedPrice: Number(a.NegotiatedPrice) || 0,
        attributableExpenses: Number(a.AttributableExpenses) || 0,
        totalAcquisitionCost: (Number(a.NegotiatedPrice) || 0) + (Number(a.AttributableExpenses) || 0),
        checklistInspectionJson: a.ChecklistInspectionJson || "{}",
        status: a.Status === 2 ? "Approved" : a.Status === 3 ? "ReceivedInStock" : a.Status === 4 ? "Rejected" : "Evaluating",
        notes: a.Notes,
        createdAtUtc: a.CreatedAtUtc,
      }))
    );
  } catch (err: any) {
    console.error("Erro ao listar aquisições de usados:", err);
    return NextResponse.json({ error: "Erro ao listar aquisições", detail: err.message }, { status: 500 });
  }
}

// POST: Registrar nova aquisição de usado (computador gamer, console, celular, etc.)
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("hb_access_token")?.value;
    if (!token) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const decoded: any = jwt.verify(token, getJwtSecret());
    const tenantId = decoded.tenant_id;
    const userId = decoded.sub || decoded.uid || "00000000-0000-0000-0000-000000000000";

    const body = await request.json();
    const {
      branchId,
      sellerPartyId,
      productSkuId,
      deviceCategory, // 'smartphone', 'computador_gamer', 'videogame', 'outro'
      serialNumber,
      imei1,
      imei2,
      condition,
      grade,
      batteryHealthPercentage,
      negotiatedPrice,
      attributableExpenses,
      checklist,
      notes,
    } = body;

    if (!sellerPartyId) {
      return NextResponse.json({ error: "Vendedor / Cliente é obrigatório." }, { status: 400 });
    }
    if (!productSkuId) {
      return NextResponse.json({ error: "Modelo / SKU é obrigatório." }, { status: 400 });
    }
    if (!serialNumber) {
      return NextResponse.json({ error: "Número de Série é obrigatório para rastreabilidade." }, { status: 400 });
    }

    const sql = getDb();

    // Validar duplicidade de Serial Number no mesmo Tenant
    const existingSerial = await sql.query(
      `SELECT "Id" FROM used_device_acquisitions WHERE "TenantId" = $1 AND "SerialNumber" = $2 LIMIT 1;`,
      [tenantId, serialNumber.trim()]
    );
    if (existingSerial.length > 0) {
      return NextResponse.json(
        { error: `O Número de Série '${serialNumber}' já está registrado em outra entrada de usado.` },
        { status: 400 }
      );
    }

    // Gerar número de aquisição sequencial elegante
    const countRes = await sql.query(
      `SELECT count(*) as total FROM used_device_acquisitions WHERE "TenantId" = $1;`,
      [tenantId]
    );
    const nextSeq = parseInt(countRes[0]?.total || "0", 10) + 1;
    const acquisitionNumber = `AQ-${new Date().getFullYear()}-${String(nextSeq).padStart(5, "0")}`;

    const newId = crypto.randomUUID();
    const resolvedBranchId = branchId || "00000000-0000-0000-0000-000000000001";

    // Mapear Condição (1: BrandNew, 2: PreOwned, 3: Refurbished, 4: OpenBox)
    let condInt = 2;
    if (condition === "UsedLikeNew" || condition === "OpenBox") condInt = 4;
    else if (condition === "Refurbished") condInt = 3;

    // Mapear Grau Estético (1: GradeA, 2: GradeB, 3: GradeC)
    let gradeInt = 1;
    if (grade === "GradeB") gradeInt = 2;
    else if (grade === "GradeC") gradeInt = 3;

    const checklistJson = JSON.stringify({
      category: deviceCategory || "eletronico",
      checklist: checklist || {},
      inspectedAt: new Date().toISOString(),
    });

    const now = new Date().toISOString();

    await sql.query(
      `INSERT INTO used_device_acquisitions (
        "Id", "TenantId", "BranchId", "SellerPartyId", "ProductSkuId",
        "AcquisitionNumber", "SerialNumber", "Imei1", "Imei2",
        "Condition", "Grade", "BatteryHealthPercentage",
        "NegotiatedPrice", "AttributableExpenses", "ChecklistInspectionJson",
        "Status", "Notes", "CreatedByUserId", "CreatedAtUtc"
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9,
        $10, $11, $12,
        $13, $14, $15,
        1, $16, $17, $18
      );`,
      [
        newId,
        tenantId,
        resolvedBranchId,
        sellerPartyId,
        productSkuId,
        acquisitionNumber,
        serialNumber.trim(),
        imei1?.trim() || null,
        imei2?.trim() || null,
        condInt,
        gradeInt,
        batteryHealthPercentage ? parseInt(batteryHealthPercentage, 10) : null,
        Number(negotiatedPrice) || 0,
        Number(attributableExpenses) || 0,
        checklistJson,
        notes?.trim() || null,
        userId,
        now,
      ]
    );

    return NextResponse.json({
      success: true,
      id: newId,
      acquisitionNumber,
      message: "Aquisição de usado registrada com sucesso!",
    });
  } catch (err: any) {
    console.error("Erro ao registrar aquisição de usado:", err);
    return NextResponse.json({ error: "Erro ao registrar aquisição", detail: err.message }, { status: 500 });
  }
}
