import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/serverless-db";
import jwt from "jsonwebtoken";
import crypto from "crypto";

function getJwtSecret(): string {
  const secret = process.env.AUTH_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("MISSING_AUTH_SECRET: A variável AUTH_SECRET não está configurada.");
  }
  return secret;
}

// 1. GET /api/repairs/orders - Listar todas as OS com filtros e dados consolidados
export async function GET(request: NextRequest) {
  const correlationId = request.headers.get("x-correlation-id") || crypto.randomUUID();

  try {
    const token = request.cookies.get("hb_access_token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const decoded: any = jwt.verify(token, getJwtSecret());
    const tenantId = decoded.tenant_id;

    const sql = getDb();

    // Query principal de ordens de serviço unindo cliente e equipamento
    const orders = await sql.query(
      `SELECT 
        ro."Id",
        ro."OrderNumber",
        ro."Status",
        ro."CustomerId",
        p."Name" AS "CustomerName",
        ro."CustomerEquipmentId",
        ce."EquipmentType",
        ce."Brand",
        ce."Model",
        ce."Color",
        ce."SerialNumber",
        ce."Notes" AS "EquipmentDetails",
        ro."ReportedDefect",
        ro."PhysicalConditionNotes",
        ro."DiagnosticNotes",
        ro."ResolutionNotes",
        ro."TotalPartsPrice",
        ro."TotalLaborPrice",
        ro."TotalDiscount",
        ro."FinalPrice",
        ro."ReceivedAtUtc",
        ro."EstimatedCompletionUtc",
        ro."DeliveredAtUtc",
        ro."CreatedAtUtc"
       FROM repair_orders ro
       LEFT JOIN parties p ON ro."CustomerId" = p."Id"
       LEFT JOIN customer_equipments ce ON ro."CustomerEquipmentId" = ce."Id"
       WHERE ro."TenantId" = $1
       ORDER BY ro."CreatedAtUtc" DESC;`,
      [tenantId]
    );

    // Buscar itens de cada OS
    const orderIds = orders.map((o: any) => o.Id);
    let allItems: any[] = [];
    if (orderIds.length > 0) {
      allItems = await sql.query(
        `SELECT "Id", "RepairOrderId", "ItemType", "Description", "Quantity", "UnitPrice", "UnitCost", "ProductSkuId"
         FROM repair_estimate_items
         WHERE "RepairOrderId" = ANY($1::uuid[])`,
        [orderIds]
      );
    }

    // Agrupar itens nas ordens
    const itemsByOrder = new Map<string, any[]>();
    for (const item of allItems) {
      const list = itemsByOrder.get(item.RepairOrderId) || [];
      list.push(item);
      itemsByOrder.set(item.RepairOrderId, list);
    }

    const formatted = orders.map((o: any) => ({
      id: o.Id,
      orderNumber: o.OrderNumber,
      status: o.Status,
      customerId: o.CustomerId,
      customerName: o.CustomerName || "Cliente Balcão",
      customerEquipmentId: o.CustomerEquipmentId,
      equipmentType: o.EquipmentType || "Geral",
      brand: o.Brand || "",
      model: o.Model || "",
      color: o.Color || "",
      serialNumber: o.SerialNumber || "S/N",
      equipmentDetails: o.EquipmentDetails || "",
      reportedDefect: o.ReportedDefect,
      physicalConditionNotes: o.PhysicalConditionNotes || "",
      diagnosticNotes: o.DiagnosticNotes || "",
      resolutionNotes: o.ResolutionNotes || "",
      totalPartsPrice: Number(o.TotalPartsPrice || 0),
      totalLaborPrice: Number(o.TotalLaborPrice || 0),
      totalDiscount: Number(o.TotalDiscount || 0),
      finalPrice: Number(o.FinalPrice || 0),
      receivedAtUtc: o.ReceivedAtUtc,
      estimatedCompletionUtc: o.EstimatedCompletionUtc,
      deliveredAtUtc: o.DeliveredAtUtc,
      items: itemsByOrder.get(o.Id) || [],
    }));

    return NextResponse.json({ orders: formatted }, { headers: { "X-Correlation-Id": correlationId } });
  } catch (err: any) {
    console.error(`[${correlationId}] Erro ao buscar ordens de serviço:`, err);
    return NextResponse.json(
      { error: "Erro ao consultar ordens de serviço no Neon." },
      { status: 500, headers: { "X-Correlation-Id": correlationId } }
    );
  }
}

// 2. POST /api/repairs/orders - Criar nova Ordem de Serviço
export async function POST(request: NextRequest) {
  const correlationId = request.headers.get("x-correlation-id") || crypto.randomUUID();

  try {
    const token = request.cookies.get("hb_access_token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const decoded: any = jwt.verify(token, getJwtSecret());
    const tenantId = decoded.tenant_id;
    const branchId = decoded.branch_id || "b0000000-0000-0000-0000-000000000001";
    const userId = decoded.sub || decoded.nameid;

    const body = await request.json();
    const {
      customerId,
      customerName,
      customerPhone,
      equipmentType,
      brand,
      model,
      color,
      serialNumber,
      equipmentDetails,
      reportedDefect,
      physicalConditionNotes,
      items, // array de { itemType, description, quantity, unitPrice, productSkuId }
    } = body;

    if (!reportedDefect) {
      return NextResponse.json({ error: "Defeito/Serviço relatado é obrigatório." }, { status: 400 });
    }

    const sql = getDb();

    // 1. Resolver ou criar Cliente (Party) se não selecionado
    let finalCustomerId = customerId;
    if (!finalCustomerId) {
      const createdParty = await sql.query(
        `INSERT INTO parties ("Id", "TenantId", "Type", "Name", "IsActive", "CreatedAtUtc")
         VALUES (gen_random_uuid(), $1, 1, $2, true, NOW())
         RETURNING "Id";`,
        [tenantId, customerName?.trim() || "Cliente Balcão"]
      );
      finalCustomerId = createdParty[0].Id;
    }

    // 2. Criar CustomerEquipment
    const createdEq = await sql.query(
      `INSERT INTO customer_equipments (
        "Id", "TenantId", "PartyId", "EquipmentType", "Brand", "Model", "Color", "SerialNumber", "Notes", "CreatedAtUtc"
      )
      VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, NOW()
      )
      RETURNING "Id";`,
      [
        tenantId,
        finalCustomerId,
        equipmentType || "Computador",
        brand || "Gamer/Custom",
        model || "Desktop",
        color || "Branco",
        serialNumber || "S/N",
        equipmentDetails || "PC Gamer Branco Ryzen 7",
      ]
    );
    const finalEquipmentId = createdEq[0].Id;

    // 3. Gerar número de OS sequencial amigável: OS-2026-XXXX
    const countRes = await sql.query(
      `SELECT COUNT(*)::int AS total FROM repair_orders WHERE "TenantId" = $1;`,
      [tenantId]
    );
    const nextSeq = (countRes[0]?.total || 0) + 1;
    const year = new Date().getFullYear();
    const orderNumber = `OS-${year}-${String(nextSeq).padStart(4, "0")}`;

    // 4. Calcular totais de peças e serviços
    let totalLabor = 0;
    let totalParts = 0;
    const cleanItems = Array.isArray(items) ? items : [];
    for (const it of cleanItems) {
      const subtotal = Number(it.quantity || 1) * Number(it.unitPrice || 0);
      if (it.itemType === 1) {
        totalLabor += subtotal;
      } else {
        totalParts += subtotal;
      }
    }
    const finalPrice = totalLabor + totalParts;

    // 5. Inserir a Ordem de Serviço (Status inicial 1 = Received / Triagem)
    const orderRes = await sql.query(
      `INSERT INTO repair_orders (
        "Id", "TenantId", "BranchId", "OrderNumber", "CustomerId", "CustomerEquipmentId",
        "AssignedTechnicianId", "Status", "ReportedDefect", "PhysicalConditionNotes",
        "ReceivedAtUtc", "LegalWarrantyDays", "AdditionalWarrantyDays",
        "TotalLaborPrice", "TotalPartsPrice", "TotalDiscount", "FinalPrice",
        "TotalPartsCost", "TotalLaborCost", "CreatedAtUtc"
      )
      VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5,
        $6, 1, $7, $8,
        NOW(), 90, 0,
        $9, $10, 0, $11,
        0, 0, NOW()
      )
      RETURNING "Id", "OrderNumber";`,
      [
        tenantId,
        branchId,
        orderNumber,
        finalCustomerId,
        finalEquipmentId,
        userId,
        reportedDefect.trim(),
        physicalConditionNotes?.trim() || null,
        totalLabor,
        totalParts,
        finalPrice,
      ]
    );

    const newOrderId = orderRes[0].Id;

    // 6. Inserir itens de estimativa / peças / serviços vinculados
    for (const it of cleanItems) {
      await sql.query(
        `INSERT INTO repair_estimate_items (
          "Id", "TenantId", "RepairOrderId", "ItemType", "Description", "Quantity", "UnitPrice", "UnitCost", "ProductSkuId", "CreatedAtUtc"
        )
        VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5, $6, 0, $7, NOW()
        );`,
        [
          tenantId,
          newOrderId,
          it.itemType || 1, // 1 = LaborService, 2 = Part
          it.description || "Serviço de Manutenção",
          Number(it.quantity || 1),
          Number(it.unitPrice || 0),
          it.productSkuId || null,
        ]
      );
    }

    // 7. Gravar status history de criação
    await sql.query(
      `INSERT INTO repair_status_history (
        "Id", "TenantId", "RepairOrderId", "OldStatus", "NewStatus", "Notes", "ChangedByUserId", "CreatedAtUtc"
      )
      VALUES (
        gen_random_uuid(), $1, $2, 1, 1, 'Ordem de Serviço criada no balcão.', $3, NOW()
      );`,
      [tenantId, newOrderId, userId]
    );

    return NextResponse.json(
      {
        message: "Ordem de serviço criada com sucesso.",
        id: newOrderId,
        orderNumber: orderRes[0].OrderNumber,
      },
      { status: 201, headers: { "X-Correlation-Id": correlationId } }
    );
  } catch (err: any) {
    console.error(`[${correlationId}] Erro ao criar ordem de serviço:`, err);
    return NextResponse.json(
      { error: "Erro interno ao cadastrar ordem de serviço." },
      { status: 500, headers: { "X-Correlation-Id": correlationId } }
    );
  }
}
