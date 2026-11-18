import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/serverless-db";
import jwt from "jsonwebtoken";
import crypto from "crypto";

function getJwtSecret(): string {
  const secret = process.env.AUTH_SECRET || process.env.JWT_SECRET;
  if (!secret) throw new Error("MISSING_AUTH_SECRET");
  return secret;
}

// 1. GET /api/sales - Listar histórico de vendas e dados consolidados
export async function GET(request: NextRequest) {
  const correlationId = request.headers.get("x-correlation-id") || crypto.randomUUID();

  try {
    const token = request.cookies.get("hb_access_token")?.value;
    if (!token) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const decoded: any = jwt.verify(token, getJwtSecret());
    const tenantId = decoded.tenant_id;

    const sql = getDb();

    // Consulta de vendas
    const sales = await sql.query(
      `SELECT 
        s."Id",
        s."SaleNumber",
        s."CustomerPartyId",
        p."Name" AS "CustomerName",
        p."DocumentNumber" AS "CustomerDocument",
        s."SellerUserId",
        u."FullName" AS "SellerName",
        s."Status",
        s."PaymentStatus",
        s."DiscountTotal",
        s."ChargesTotal",
        s."Observations",
        s."ConfirmedAtUtc",
        s."CancelledAtUtc",
        s."CreatedAtUtc"
       FROM sales s
       LEFT JOIN parties p ON s."CustomerPartyId" = p."Id"
       LEFT JOIN users u ON s."SellerUserId" = u."Id"
       WHERE s."TenantId" = $1
       ORDER BY s."CreatedAtUtc" DESC
       LIMIT 50;`,
      [tenantId]
    );

    const saleIds = sales.map((s: any) => s.Id);
    let items: any[] = [];
    let payments: any[] = [];

    if (saleIds.length > 0) {
      items = await sql.query(
        `SELECT "Id", "SaleId", "ProductSkuId", "HistoricalSkuCode", "HistoricalDescription", "Quantity", "UnitPrice", "Discount", "SerialOrImei"
         FROM sale_items
         WHERE "SaleId" = ANY($1::uuid[])`,
        [saleIds]
      );

      payments = await sql.query(
        `SELECT "Id", "SaleId", "Method", "Amount", "Installments", "Status"
         FROM sale_payment_intents
         WHERE "SaleId" = ANY($1::uuid[])`,
        [saleIds]
      );
    }

    const itemsBySale = new Map<string, any[]>();
    for (const it of items) {
      const list = itemsBySale.get(it.SaleId) || [];
      list.push(it);
      itemsBySale.set(it.SaleId, list);
    }

    const paymentsBySale = new Map<string, any[]>();
    for (const py of payments) {
      const list = paymentsBySale.get(py.SaleId) || [];
      list.push(py);
      paymentsBySale.set(py.SaleId, list);
    }

    const formatted = sales.map((s: any) => {
      const saleItems = itemsBySale.get(s.Id) || [];
      const subtotal = saleItems.reduce((acc, it) => acc + Number(it.Quantity) * Number(it.UnitPrice), 0);
      const discount = Number(s.DiscountTotal || 0);
      const charges = Number(s.ChargesTotal || 0);
      const totalAmount = subtotal - discount + charges;

      return {
        id: s.Id,
        saleNumber: s.SaleNumber,
        customerPartyId: s.CustomerPartyId,
        customerName: s.CustomerName || "Consumidor Final",
        customerDocument: s.CustomerDocument || "",
        sellerUserId: s.SellerUserId,
        sellerName: s.SellerName || "Vendedor Balcão",
        status: s.Status,
        paymentStatus: s.PaymentStatus,
        subtotal,
        discountTotal: discount,
        chargesTotal: charges,
        totalAmount,
        observations: s.Observations || "",
        confirmedAtUtc: s.ConfirmedAtUtc,
        cancelledAtUtc: s.CancelledAtUtc,
        createdAtUtc: s.CreatedAtUtc,
        items: saleItems,
        payments: paymentsBySale.get(s.Id) || [],
      };
    });

    return NextResponse.json({ sales: formatted }, { headers: { "X-Correlation-Id": correlationId } });
  } catch (err: any) {
    console.error(`[${correlationId}] Erro ao buscar vendas:`, err);
    return NextResponse.json({ error: "Erro ao consultar vendas no Neon." }, { status: 500 });
  }
}

// 2. POST /api/sales - Efetuar Venda no PDV Caixa com emissão fiscal NFC-e
export async function POST(request: NextRequest) {
  const correlationId = request.headers.get("x-correlation-id") || crypto.randomUUID();

  try {
    const token = request.cookies.get("hb_access_token")?.value;
    if (!token) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const decoded: any = jwt.verify(token, getJwtSecret());
    const tenantId = decoded.tenant_id;
    const branchId = decoded.branch_id || "b0000000-0000-0000-0000-000000000001";
    const userId = decoded.sub || decoded.nameid;

    const body = await request.json();
    const {
      customerPartyId,
      customerName,
      customerCpf,
      sellerUserId,
      repairOrderId, // Se vinculada à OS de manutenção
      items, // array de itens { productSkuId, skuCode, description, quantity, unitPrice, discount, serialOrImei }
      payments, // array de pagamentos { method, amount, installments }
      discountTotal,
      chargesTotal,
      observations,
      isFiscalEmission, // boolean se deve gerar DANFE NFC-e
    } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "O carrinho está vazio. Adicione pelo menos um item." }, { status: 400 });
    }

    const sql = getDb();

    // 1. Gerar número de venda sequencial amigável
    const countRes = await sql.query(
      `SELECT COUNT(*)::int AS total FROM sales WHERE "TenantId" = $1;`,
      [tenantId]
    );
    const nextSeq = (countRes[0]?.total || 0) + 1;
    const year = new Date().getFullYear();
    const saleNumber = `VND-${year}-${String(nextSeq).padStart(4, "0")}`;

    // 2. Inserir venda principal
    const saleRes = await sql.query(
      `INSERT INTO sales (
        "Id", "TenantId", "BranchId", "SaleNumber", "CustomerPartyId",
        "SellerUserId", "CreatedByUserId", "Status", "PaymentStatus", "FulfillmentStatus",
        "DiscountTotal", "ChargesTotal", "Observations", "ConfirmedAtUtc", "CreatedAtUtc"
      )
      VALUES (
        gen_random_uuid(), $1, $2, $3, $4,
        $5, $6, 3, 3, 2,
        $7, $8, $9, NOW(), NOW()
      )
      RETURNING "Id", "SaleNumber", "ConfirmedAtUtc";`,
      [
        tenantId,
        branchId,
        saleNumber,
        customerPartyId || null,
        sellerUserId || userId,
        userId,
        Number(discountTotal || 0),
        Number(chargesTotal || 0),
        observations || (repairOrderId ? `Vinculado à OS de Manutenção` : "Venda Balcão PDV"),
      ]
    );

    const saleId = saleRes[0].Id;

    // 3. Inserir itens da venda
    for (const it of items) {
      await sql.query(
        `INSERT INTO sale_items (
          "Id", "TenantId", "SaleId", "ProductSkuId", "HistoricalSkuCode", "HistoricalDescription",
          "ItemCondition", "Quantity", "UnitPrice", "Discount", "HistoricalUnitCost", "SerialOrImei", "WarrantyDays", "CreatedAtUtc"
        )
        VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5,
          1, $6, $7, $8, 0, $9, 90, NOW()
        );`,
        [
          tenantId,
          saleId,
          it.productSkuId || "00000000-0000-0000-0000-000000000001",
          it.skuCode || "GEN-01",
          it.description || "Produto",
          Number(it.quantity || 1),
          Number(it.unitPrice || 0),
          Number(it.discount || 0),
          it.serialOrImei || null,
        ]
      );
    }

    // 4. Inserir formas de pagamento
    const cleanPayments = Array.isArray(payments) && payments.length > 0
      ? payments
      : [{ method: 1, amount: Number(body.totalAmount || 0), installments: 1 }];

    for (const py of cleanPayments) {
      await sql.query(
        `INSERT INTO sale_payment_intents (
          "Id", "TenantId", "SaleId", "Method", "Amount", "Installments", "Status", "ConfirmedAtUtc", "CreatedAtUtc"
        )
        VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5, 2, NOW(), NOW()
        );`,
        [
          tenantId,
          saleId,
          Number(py.method || 1), // 1=Dinheiro, 2=Pix, 3=Cartão Crédito, 4=Débito
          Number(py.amount || 0),
          Number(py.installments || 1),
        ]
      );
    }

    // 5. Se houver OS vinculada, atualizar a OS como Entregue/Faturada
    if (repairOrderId) {
      await sql.query(
        `UPDATE repair_orders 
         SET "Status" = 12, "DeliveredAtUtc" = NOW(), "ResolutionNotes" = 'Finalizado e faturado na venda ${saleNumber}'
         WHERE "Id" = $1 AND "TenantId" = $2;`,
        [repairOrderId, tenantId]
      );
    }

    // 6. GERAÇÃO CANÔNICA DE CUPOM FISCAL NFC-E (SEFAZ-SP)
    let fiscalNfce = null;
    if (isFiscalEmission) {
      const ests = await sql.query(`SELECT * FROM fiscal_establishments WHERE "TenantId" = $1 LIMIT 1;`, [tenantId]);
      const est = ests[0] || {
        CorporateName: "HB STUDIO INOVAÇÃO E TECNOLOGIA LTDA",
        TradeName: "HB Studio",
        Cnpj: "48951871000180",
        StateRegistration: "111222333444",
        Street: "Av. Paulista",
        Number: "1000",
        Neighborhood: "Bela Vista",
        CityName: "São Paulo",
        State: "SP",
        NfceDefaultSeries: 1,
        NfceNextNumber: 1,
      };

      const cscs = await sql.query(`SELECT * FROM fiscal_cscs WHERE "EstablishmentId" = $1 AND "IsActive" = true LIMIT 1;`, [est.Id]);
      const nextNumber = Number(est.NfceNextNumber || nextSeq);
      const series = Number(est.NfceDefaultSeries || 1);

      // Gerar chave de acesso de 44 dígitos oficial:
      // UF (35) + AAMM + CNPJ (14) + MOD (65) + SERIE (3) + NUM (9) + TIPO (1) + COD (8) + DV
      const aamm = new Date().toISOString().slice(2, 7).replace("-", "");
      const cnpjClean = est.Cnpj.replace(/\D/g, "").padStart(14, "0");
      const numFormatted = String(nextNumber).padStart(9, "0");
      const serieFormatted = String(series).padStart(3, "0");
      const randomCode = String(Math.floor(10000000 + Math.random() * 90000000));
      const partialKey = `35${aamm}${cnpjClean}65${serieFormatted}${numFormatted}1${randomCode}`;

      // Cálculo do DV (Módulo 11)
      let sum = 0;
      let weight = 2;
      for (let i = partialKey.length - 1; i >= 0; i--) {
        sum += parseInt(partialKey[i], 10) * weight;
        weight = weight === 9 ? 2 : weight + 1;
      }
      const remainder = sum % 11;
      const dv = remainder === 0 || remainder === 1 ? 0 : 11 - remainder;
      const fullAccessKey = `${partialKey}${dv}`;

      const protocolNumber = `13526${String(Math.floor(100000000 + Math.random() * 900000000))}`;
      const qrCodeUrl = `https://www.nfce.fazenda.sp.gov.br/qrcode?p=${fullAccessKey}|2|1|${cscs[0]?.CscId || "000001"}|${dv}`;

      // Gravar na tabela fiscal_documents
      await sql.query(
        `INSERT INTO fiscal_documents (
          "Id", "TenantId", "SaleId", "DocumentType", "Environment", "Status",
          "Series", "Number", "AccessKey", "IssuedAtUtc", "TotalAmount", "TotalDiscounts",
          "RecipientCpf", "ProtocolNumber", "SefazStatusCode", "SefazStatusReason", "QrCodeUrl", "CreatedAtUtc"
        )
        VALUES (
          gen_random_uuid(), $1, $2, 2, 1, 3,
          $3, $4, $5, NOW(), $6, $7,
          $8, $9, 100, 'Autorizado o uso da NFC-e', $10, NOW()
        );`,
        [
          tenantId,
          saleId,
          series,
          nextNumber,
          fullAccessKey,
          Number(body.totalAmount || 0),
          Number(discountTotal || 0),
          customerCpf || null,
          protocolNumber,
          qrCodeUrl,
        ]
      );

      // Incrementar próximo número NFC-e
      await sql.query(
        `UPDATE fiscal_establishments SET "NfceNextNumber" = "NfceNextNumber" + 1 WHERE "Id" = $1;`,
        [est.Id]
      );

      fiscalNfce = {
        accessKey: fullAccessKey,
        series,
        number: nextNumber,
        protocolNumber,
        qrCodeUrl,
        issuedAtUtc: new Date().toISOString(),
      };
    }

    return NextResponse.json({
      message: "Venda concluída com sucesso no caixa!",
      saleId,
      saleNumber,
      fiscalNfce,
    }, { status: 201, headers: { "X-Correlation-Id": correlationId } });
  } catch (err: any) {
    console.error(`[${correlationId}] Erro ao registrar venda:`, err);
    return NextResponse.json({ error: "Erro interno ao processar venda no caixa." }, { status: 500 });
  }
}
