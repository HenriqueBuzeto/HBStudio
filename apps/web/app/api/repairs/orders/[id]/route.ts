import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/serverless-db";
import jwt from "jsonwebtoken";
import crypto from "crypto";

function getJwtSecret(): string {
  const secret = process.env.AUTH_SECRET || process.env.JWT_SECRET;
  if (!secret) throw new Error("MISSING_AUTH_SECRET");
  return secret;
}

// PUT /api/repairs/orders/[id] - Atualizar status (Kanban), detalhes e itens (produtos/serviços)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const correlationId = request.headers.get("x-correlation-id") || crypto.randomUUID();

  try {
    const { id } = await params;
    const token = request.cookies.get("hb_access_token")?.value;
    if (!token) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const decoded: any = jwt.verify(token, getJwtSecret());
    const tenantId = decoded.tenant_id;
    const userId = decoded.sub || decoded.nameid;

    const body = await request.json();
    const {
      status, // Novo status numérico do Kanban
      diagnosticNotes,
      resolutionNotes,
      reportedDefect,
      items, // array atualizado de itens
    } = body;

    const sql = getDb();

    // 1. Buscar a OS existente
    const currentOrders = await sql.query(
      `SELECT "Id", "Status", "TotalLaborPrice", "TotalPartsPrice" FROM repair_orders WHERE "Id" = $1 AND "TenantId" = $2;`,
      [id, tenantId]
    );

    if (currentOrders.length === 0) {
      return NextResponse.json({ error: "Ordem de serviço não encontrada." }, { status: 404 });
    }

    const current = currentOrders[0];
    const newStatus = status !== undefined ? Number(status) : current.Status;

    // 2. Se houver atualização de itens (produtos ou serviços adicionados/removidos)
    let totalLabor = Number(current.TotalLaborPrice || 0);
    let totalParts = Number(current.TotalPartsPrice || 0);

    if (Array.isArray(items)) {
      totalLabor = 0;
      totalParts = 0;
      // Remover itens anteriores e regravar lista consolidada
      await sql.query(`DELETE FROM repair_estimate_items WHERE "RepairOrderId" = $1;`, [id]);

      for (const it of items) {
        const subtotal = Number(it.quantity || 1) * Number(it.unitPrice || 0);
        if (it.itemType === 1) {
          totalLabor += subtotal;
        } else {
          totalParts += subtotal;
        }

        await sql.query(
          `INSERT INTO repair_estimate_items (
            "Id", "TenantId", "RepairOrderId", "ItemType", "Description", "Quantity", "UnitPrice", "UnitCost", "ProductSkuId", "CreatedAtUtc"
          )
          VALUES (
            gen_random_uuid(), $1, $2, $3, $4, $5, $6, 0, $7, NOW()
          );`,
          [
            tenantId,
            id,
            it.itemType || 1,
            it.description || "Item de Manutenção",
            Number(it.quantity || 1),
            Number(it.unitPrice || 0),
            it.productSkuId || null,
          ]
        );
      }
    }

    const finalPrice = totalLabor + totalParts;

    // 3. Atualizar a ordem de serviço
    await sql.query(
      `UPDATE repair_orders
       SET "Status" = $1,
           "DiagnosticNotes" = COALESCE($2, "DiagnosticNotes"),
           "ResolutionNotes" = COALESCE($3, "ResolutionNotes"),
           "ReportedDefect" = COALESCE($4, "ReportedDefect"),
           "TotalLaborPrice" = $5,
           "TotalPartsPrice" = $6,
           "FinalPrice" = $7,
           "DeliveredAtUtc" = CASE WHEN $1 = 12 THEN NOW() ELSE "DeliveredAtUtc" END,
           "UpdatedAtUtc" = NOW()
       WHERE "Id" = $8 AND "TenantId" = $9;`,
      [
        newStatus,
        diagnosticNotes || null,
        resolutionNotes || null,
        reportedDefect || null,
        totalLabor,
        totalParts,
        finalPrice,
        id,
        tenantId,
      ]
    );

    // 4. Se o status mudou, registrar no histórico
    if (newStatus !== current.Status) {
      await sql.query(
        `INSERT INTO repair_status_history (
          "Id", "TenantId", "RepairOrderId", "OldStatus", "NewStatus", "Notes", "ChangedByUserId", "CreatedAtUtc"
        )
        VALUES (
          gen_random_uuid(), $1, $2, $3, $4, 'Status atualizado no Kanban.', $5, NOW()
        );`,
        [tenantId, id, current.Status, newStatus, userId]
      );
    }

    return NextResponse.json({
      message: "Ordem de serviço atualizada com sucesso.",
      status: newStatus,
      finalPrice,
    });
  } catch (err: any) {
    console.error(`[${correlationId}] Erro ao atualizar OS:`, err);
    return NextResponse.json({ error: "Erro interno ao atualizar ordem de serviço." }, { status: 500 });
  }
}
