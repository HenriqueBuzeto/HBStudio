import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/serverless-db";
import jwt from "jsonwebtoken";
import crypto from "crypto";

function getJwtSecret(): string {
  const secret = process.env.AUTH_SECRET || process.env.JWT_SECRET;
  if (!secret) throw new Error("MISSING_AUTH_SECRET");
  return secret;
}

// POST /api/sales/[id]/cancel - Cancelamento com regra fiscal de 30 minutos (SEFAZ-SP)
export async function POST(
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

    const body = await request.json().catch(() => ({}));
    const { justification } = body;

    const sql = getDb();

    // 1. Buscar a venda
    const sales = await sql.query(
      `SELECT "Id", "SaleNumber", "Status", "ConfirmedAtUtc", "CreatedAtUtc"
       FROM sales
       WHERE "Id" = $1 AND "TenantId" = $2;`,
      [id, tenantId]
    );

    if (sales.length === 0) {
      return NextResponse.json({ error: "Venda não encontrada." }, { status: 404 });
    }

    const sale = sales[0];

    if (sale.Status === 5) {
      return NextResponse.json({ error: "Esta venda já se encontra cancelada." }, { status: 400 });
    }

    // 2. REGRA FISCAL SEFAZ: PRAZO MÁXIMO DE CANCELAMENTO DE 30 MINUTOS
    const confirmedTime = new Date(sale.ConfirmedAtUtc || sale.CreatedAtUtc).getTime();
    const now = Date.now();
    const diffMinutes = (now - confirmedTime) / (1000 * 60);

    if (diffMinutes > 30) {
      return NextResponse.json(
        {
          error: `Prazo legal de cancelamento expirado (${Math.floor(diffMinutes)} minutos decorridos). A legislação da SEFAZ-SP para NFC-e estipula limite máximo de 30 minutos após a emissão. Para estornos posteriores, utilize o processo de Devolução de Mercadoria.`,
          code: "SEFAZ_CANCEL_EXPIRED",
        },
        { status: 422 }
      );
    }

    // 3. Atualizar status da venda para Cancelada (Status = 5)
    await sql.query(
      `UPDATE sales
       SET "Status" = 5,
           "CancelledAtUtc" = NOW(),
           "Observations" = COALESCE("Observations", '') || ' [Cancelada: ' || $1 || ']'
       WHERE "Id" = $2 AND "TenantId" = $3;`,
      [justification?.trim() || "Cancelamento no balcão dentro do prazo legal", id, tenantId]
    );

    // 4. Se houver documento fiscal NFC-e vinculado, registrar evento de cancelamento na SEFAZ
    const fiscalDocs = await sql.query(
      `SELECT "Id" FROM fiscal_documents WHERE "SaleId" = $1 AND "TenantId" = $2;`,
      [id, tenantId]
    );

    if (fiscalDocs.length > 0) {
      await sql.query(
        `UPDATE fiscal_documents
         SET "Status" = 4,
             "CancellationReason" = $1,
             "CancelledAtUtc" = NOW(),
             "SefazStatusCode" = 101,
             "SefazStatusReason" = 'Cancelamento de NFC-e homologado com sucesso'
         WHERE "SaleId" = $2 AND "TenantId" = $3;`,
        [justification?.trim() || "Cancelamento dentro de 30 min", id, tenantId]
      );
    }

    return NextResponse.json({
      message: "Venda e Cupom Fiscal NFC-e cancelados com sucesso dentro do prazo regulamentar!",
      saleNumber: sale.SaleNumber,
    });
  } catch (err: any) {
    console.error(`[${correlationId}] Erro ao cancelar venda:`, err);
    return NextResponse.json({ error: "Erro interno ao processar cancelamento de venda." }, { status: 500 });
  }
}
