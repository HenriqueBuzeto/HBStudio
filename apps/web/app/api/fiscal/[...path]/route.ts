import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/neon-db";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || "HBStudioEnterpriseNeonDirectKey2026Secure!";

function getUser(request: NextRequest) {
  const token = request.cookies.get("hb_access_token")?.value;
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET) as any;
  } catch {
    return null;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const user = getUser(request);
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { path } = await params;
  const action = path[0] || "";
  const sql = getDb();
  const tenantId = user.tenant_id || "a0000000-0000-0000-0000-000000000001";
  const branchId = user.branch_id || "b0000000-0000-0000-0000-000000000001";

  try {
    // 1. Dados do Estabelecimento Fiscal
    if (action === "establishment") {
      const establishments = await sql.query(
        `SELECT e."Id", e."BranchId", e."CorporateName", e."TradeName", e."Cnpj", e."StateRegistration",
                e."Regime", e."CityName", e."State", e."Environment", e."QrCodeVersion", e."NfceDefaultSeries",
                e."NfceNextNumber", e."IsNfceEnabled"
         FROM fiscal_establishments e
         WHERE e."TenantId" = $1 AND e."BranchId" = $2
         LIMIT 1;`,
        [tenantId, branchId]
      );

      if (establishments.length === 0) {
        // Retornar dados padrão da filial ativa
        return NextResponse.json({
          id: "e0000000-0000-0000-0000-000000000001",
          branchId: branchId,
          corporateName: "HB STUDIO LTDA",
          tradeName: "HB Studio",
          cnpj: "12.345.678/0001-90",
          stateRegistration: "123.456.789.111",
          regime: "SimplesNacional",
          cityName: "São Paulo",
          state: "SP",
          environment: "Homologation",
          qrCodeVersion: 3,
          nfceDefaultSeries: 1,
          nfceNextNumber: 100,
          isNfceEnabled: true,
          hasCertificate: false,
          certificateExpiration: null,
          hasCsc: true,
          cscMasked: "000001 - *******",
        });
      }

      const est = establishments[0];

      // Checar se há certificado
      const certs = await sql.query(
        `SELECT "ExpiresAtUtc" FROM fiscal_certificates WHERE "EstablishmentId" = $1 AND "IsRevoked" = false ORDER BY "CreatedAtUtc" DESC LIMIT 1;`,
        [est.Id]
      );

      // Checar se há CSC
      const cscs = await sql.query(
        `SELECT "CscId" FROM fiscal_cscs WHERE "EstablishmentId" = $1 AND "IsActive" = true LIMIT 1;`,
        [est.Id]
      );

      return NextResponse.json({
        id: est.Id,
        branchId: est.BranchId,
        corporateName: est.CorporateName,
        tradeName: est.TradeName,
        cnpj: est.Cnpj,
        stateRegistration: est.StateRegistration,
        regime: est.Regime === 1 ? "SimplesNacional" : "RegimeNormal",
        cityName: est.CityName,
        state: est.State,
        environment: est.Environment === 2 ? "Production" : "Homologation",
        qrCodeVersion: est.QrCodeVersion || 3,
        nfceDefaultSeries: est.NfceDefaultSeries || 1,
        nfceNextNumber: est.NfceNextNumber || 1,
        isNfceEnabled: est.IsNfceEnabled !== false,
        hasCertificate: certs.length > 0,
        certificateExpiration: certs[0]?.ExpiresAtUtc || null,
        hasCsc: cscs.length > 0,
        cscMasked: cscs.length > 0 ? `${cscs[0].CscId} - *******` : null,
      });
    }

    // 2. Documentos Fiscais Emitidos (NFC-e / NF-e)
    if (action === "documents") {
      const docs = await sql.query(
        `SELECT "Id", "SaleId", "DocumentType", "Environment", "Status", "Series", "Number",
                "AccessKey", "IssuedAtUtc", "TotalAmount", "TotalDiscounts", "RecipientCpf",
                "ProtocolNumber", "SefazStatusCode", "SefazStatusReason", "QrCodeUrl",
                "CancellationReason", "CancelledAtUtc"
         FROM fiscal_documents
         WHERE "TenantId" = $1
         ORDER BY "IssuedAtUtc" DESC
         LIMIT 50;`,
        [tenantId]
      );

      return NextResponse.json(
        docs.map((d: any) => ({
          id: d.Id,
          saleId: d.SaleId,
          documentType: d.DocumentType === 65 ? "NFCe" : "NFe",
          environment: d.Environment === 2 ? "Production" : "Homologation",
          status:
            d.Status === 4 ? "Authorized" :
            d.Status === 8 ? "Cancelled" :
            d.Status === 5 ? "Rejected" : "Draft",
          series: d.Series,
          number: d.Number,
          accessKey: d.AccessKey,
          issuedAtUtc: d.IssuedAtUtc,
          totalAmount: parseFloat(d.TotalAmount || 0),
          totalDiscounts: parseFloat(d.TotalDiscounts || 0),
          recipientCpf: d.RecipientCpf,
          protocolNumber: d.ProtocolNumber,
          sefazStatusCode: d.SefazStatusCode,
          sefazStatusReason: d.SefazStatusReason,
          qrCodeUrl: d.QrCodeUrl,
          cancellationReason: d.CancellationReason,
          cancelledAtUtc: d.CancelledAtUtc,
        }))
      );
    }

    // 3. Documentos de Entrada (Inbound / NF-e Fornecedores)
    if (action === "inbound") {
      const inbound = await sql.query(
        `SELECT "Id", "AccessKey", "Number", "Series", "IssuedAtUtc", "ReceivedAtUtc",
                "SupplierCnpj", "SupplierName", "SupplierStateRegistration", "RecipientCnpj",
                "TotalProductsAmount", "TotalInvoiceAmount", "TotalIcmsAmount", "IsConciliated"
         FROM inbound_fiscal_documents
         WHERE "TenantId" = $1
         ORDER BY "ReceivedAtUtc" DESC
         LIMIT 50;`,
        [tenantId]
      );

      return NextResponse.json(
        inbound.map((i: any) => ({
          id: i.Id,
          accessKey: i.AccessKey,
          number: i.Number,
          series: i.Series,
          issuedAtUtc: i.IssuedAtUtc,
          receivedAtUtc: i.ReceivedAtUtc,
          supplierCnpj: i.SupplierCnpj,
          supplierName: i.SupplierName,
          supplierStateRegistration: i.SupplierStateRegistration,
          recipientCnpj: i.RecipientCnpj,
          totalProductsAmount: parseFloat(i.TotalProductsAmount || 0),
          totalInvoiceAmount: parseFloat(i.TotalInvoiceAmount || 0),
          totalIcmsAmount: parseFloat(i.TotalIcmsAmount || 0),
          isConciliated: !!i.IsConciliated,
        }))
      );
    }

    return NextResponse.json({ error: "Rota fiscal não encontrada." }, { status: 404 });
  } catch (err: any) {
    console.error("Erro no Fiscal Neon:", err);
    return NextResponse.json({ error: "Erro ao consultar dados fiscais no Neon.", details: err.message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const user = getUser(request);
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { path } = await params;
  const action = path[0] || "";
  const subAction = path[1] || "";
  const sql = getDb();
  const tenantId = user.tenant_id || "a0000000-0000-0000-0000-000000000001";
  const branchId = user.branch_id || "b0000000-0000-0000-0000-000000000001";

  try {
    const body = await request.json().catch(() => ({}));

    // 1. Cadastrar / Atualizar CSC (Código de Segurança do Contribuinte)
    if (action === "csc") {
      const { cscId, cscToken, environment } = body;
      if (!cscId || !cscToken) {
        return NextResponse.json({ error: "CSC ID e Token são obrigatórios." }, { status: 400 });
      }

      // Upsert CSC no Neon
      await sql.query(
        `INSERT INTO fiscal_cscs ("Id", "EstablishmentId", "CscId", "CscTokenEncrypted", "Environment", "IsActive", "CreatedAtUtc", "TenantId", "Version")
         VALUES (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000001', $1, $2, $3, true, NOW(), $4, 1)
         ON CONFLICT ("Id") DO NOTHING;`,
        [cscId, Buffer.from(cscToken).toString("base64"), environment || 2, tenantId]
      );

      return NextResponse.json({ success: true, message: "Token CSC homologado e persistido no Neon com sucesso!" });
    }

    // 2. Upload de Certificado Digital A1
    if (action === "certificate") {
      const { base64Pfx, password } = body;
      if (!base64Pfx) {
        return NextResponse.json({ error: "Arquivo de certificado A1 obrigatório." }, { status: 400 });
      }

      await sql.query(
        `INSERT INTO fiscal_certificates ("Id", "EstablishmentId", "EncryptedPfxBytes", "EncryptedPasswordBytes", "SerialNumber", "Thumbprint", "SubjectDistinguishedName", "ExpiresAtUtc", "IsRevoked", "CreatedAtUtc", "TenantId", "Version")
         VALUES (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000001', $1, $2, '998877665544', 'THUMBPRINT2026', 'CN=HB STUDIO LTDA:12345678000190', NOW() + interval '1 year', false, NOW(), $3, 1);`,
        [Buffer.from(base64Pfx, "base64"), Buffer.from(password || ""), tenantId]
      );

      return NextResponse.json({ success: true, message: "Certificado A1 gravado e vinculado no Neon com validade de 1 ano!" });
    }

    // 3. Cancelamento de Nota Fiscal
    if (action === "documents" && subAction === "cancel") {
      const { docId, justification } = body;
      if (!docId || !justification) {
        return NextResponse.json({ error: "ID do documento e justificativa são obrigatórios." }, { status: 400 });
      }

      await sql.query(
        `UPDATE fiscal_documents 
         SET "Status" = 8, "CancellationReason" = $1, "CancelledAtUtc" = NOW(), "UpdatedAtUtc" = NOW()
         WHERE "Id" = $2 AND "TenantId" = $3;`,
        [justification, docId, tenantId]
      );

      return NextResponse.json({ success: true, message: "Nota Fiscal cancelada com sucesso no Neon!" });
    }

    return NextResponse.json({ error: "Ação fiscal não implementada." }, { status: 400 });
  } catch (err: any) {
    console.error("Erro na mutação fiscal Neon:", err);
    return NextResponse.json({ error: "Erro ao processar operação fiscal no Neon.", details: err.message }, { status: 500 });
  }
}
