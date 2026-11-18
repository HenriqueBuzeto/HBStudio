import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/serverless-db";
import jwt from "jsonwebtoken";
import crypto from "crypto";

function getJwtSecret(): string {
  const secret = process.env.AUTH_SECRET || process.env.JWT_SECRET;
  if (!secret) throw new Error("MISSING_AUTH_SECRET");
  return secret;
}

// 1. GET /api/fiscal/status - Retorna o status fiscal completo da empresa no Neon
export async function GET(request: NextRequest) {
  const correlationId = request.headers.get("x-correlation-id") || crypto.randomUUID();

  try {
    const token = request.cookies.get("hb_access_token")?.value;
    if (!token) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const decoded: any = jwt.verify(token, getJwtSecret());
    const tenantId = decoded.tenant_id;
    const branchId = decoded.branch_id;

    const sql = getDb();

    // Buscar dados do estabelecimento fiscal no Neon
    const ests = await sql.query(
      `SELECT * FROM fiscal_establishments WHERE "TenantId" = $1 LIMIT 1;`,
      [tenantId]
    );

    if (ests.length === 0) {
      return NextResponse.json({
        configured: false,
        establishment: null,
        certificate: null,
        csc: null,
      });
    }

    const est = ests[0];

    // Buscar certificado digital
    const certs = await sql.query(
      `SELECT "Id", "SubjectName", "Thumbprint", "Cnpj", "ValidFromUtc", "ValidUntilUtc", "IsActive"
       FROM fiscal_certificates
       WHERE "EstablishmentId" = $1 AND "IsActive" = true
       ORDER BY "CreatedAtUtc" DESC LIMIT 1;`,
      [est.Id]
    );

    // Buscar CSC (Código de Segurança do Contribuinte)
    const cscs = await sql.query(
      `SELECT "Id", "CscId", "CscTokenMasked", "Environment", "IsActive"
       FROM fiscal_cscs
       WHERE "EstablishmentId" = $1 AND "IsActive" = true
       ORDER BY "CreatedAtUtc" DESC LIMIT 1;`,
      [est.Id]
    );

    // Contagem de documentos emitidos
    const docCounts = await sql.query(
      `SELECT COUNT(*)::int AS count FROM fiscal_documents WHERE "TenantId" = $1;`,
      [tenantId]
    );

    return NextResponse.json({
      configured: true,
      establishment: {
        id: est.Id,
        corporateName: est.CorporateName,
        tradeName: est.TradeName,
        cnpj: est.Cnpj,
        stateRegistration: est.StateRegistration,
        municipalRegistration: est.MunicipalRegistration,
        cnae: est.Cnae,
        regime: est.Regime === 1 ? "Simples Nacional" : "Regime Normal (Lucro Presumido/Real)",
        street: est.Street,
        number: est.Number,
        neighborhood: est.Neighborhood,
        cityName: est.CityName,
        state: est.State,
        postalCode: est.PostalCode,
        environment: est.Environment === 1 ? "Produção (SEFAZ-SP)" : "Homologação (Testes)",
        qrCodeVersion: "Versão 2.0 (NT 2025.001)",
        nfceDefaultSeries: est.NfceDefaultSeries || 1,
        nfceNextNumber: est.NfceNextNumber || 1,
        isNfceEnabled: est.IsNfceEnabled,
      },
      certificate: certs[0]
        ? {
            id: certs[0].Id,
            subjectName: certs[0].SubjectName,
            thumbprint: certs[0].Thumbprint,
            validUntilUtc: certs[0].ValidUntilUtc,
            isActive: certs[0].IsActive,
          }
        : null,
      csc: cscs[0]
        ? {
            id: cscs[0].Id,
            cscId: cscs[0].CscId,
            cscTokenMasked: cscs[0].CscTokenMasked,
            environment: cscs[0].Environment === 1 ? "Produção" : "Homologação",
          }
        : null,
      stats: {
        totalIssued: docCounts[0]?.count || 0,
      },
    });
  } catch (err: any) {
    console.error(`[${correlationId}] Erro ao buscar status fiscal:`, err);
    return NextResponse.json({ error: "Erro ao consultar status fiscal no banco." }, { status: 500 });
  }
}
