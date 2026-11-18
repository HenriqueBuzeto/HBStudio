import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/serverless-db";
import jwt from "jsonwebtoken";
import crypto from "crypto";

function getJwtSecret(): string {
  const secret = process.env.AUTH_SECRET || process.env.JWT_SECRET;
  if (!secret) throw new Error("MISSING_AUTH_SECRET");
  return secret;
}

// GET /api/parties - Listar clientes e fornecedores do tenant com contatos, endereços e equipamentos
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("hb_access_token")?.value;
    if (!token) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const decoded: any = jwt.verify(token, getJwtSecret());
    const tenantId = decoded.tenant_id;

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() || "";
    const onlyCustomers = searchParams.get("onlyCustomers") === "true";
    const onlySuppliers = searchParams.get("onlySuppliers") === "true";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10)));
    const offset = (page - 1) * pageSize;

    const sql = getDb();

    // Query principal de Parties com perfis
    let query = `
      SELECT 
        p."Id",
        p."Type",
        p."Name",
        p."TradeName",
        p."DocumentNumber",
        p."StateRegistration",
        p."MunicipalRegistration",
        p."BirthDate",
        p."IsActive",
        p."Notes",
        p."CreatedAtUtc",
        cp."Id" AS "CustomerProfileId",
        sp."Id" AS "SupplierProfileId"
      FROM parties p
      LEFT JOIN customer_profiles cp ON p."Id" = cp."PartyId" AND cp."TenantId" = p."TenantId"
      LEFT JOIN supplier_profiles sp ON p."Id" = sp."PartyId" AND sp."TenantId" = p."TenantId"
      WHERE p."TenantId" = $1
    `;
    const params: any[] = [tenantId];

    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      const idx = params.length;
      query += ` AND (LOWER(p."Name") LIKE $${idx} OR LOWER(COALESCE(p."TradeName", '')) LIKE $${idx} OR p."DocumentNumber" LIKE $${idx})`;
    }

    if (onlyCustomers) {
      query += ` AND cp."Id" IS NOT NULL`;
    }
    if (onlySuppliers) {
      query += ` AND sp."Id" IS NOT NULL`;
    }

    query += ` ORDER BY p."CreatedAtUtc" DESC LIMIT ${pageSize} OFFSET ${offset};`;

    const parties = await sql.query(query, params);

    if (parties.length === 0) {
      return NextResponse.json([]);
    }

    const partyIds = parties.map((p: any) => p.Id);

    // Buscar Contatos, Endereços e Equipamentos para os clientes retornados
    const [contacts, addresses, equipments] = await Promise.all([
      sql.query(
        `SELECT "Id", "PartyId", "Name", "Email", "Phone", "WhatsApp", "IsPrimary"
         FROM party_contacts
         WHERE "TenantId" = $1 AND "PartyId" = ANY($2::uuid[]);`,
        [tenantId, partyIds]
      ),
      sql.query(
        `SELECT "Id", "PartyId", "Street", "Number", "Complement", "Neighborhood", "City", "State", "PostalCode", "IsPrimary"
         FROM party_addresses
         WHERE "TenantId" = $1 AND "PartyId" = ANY($2::uuid[]);`,
        [tenantId, partyIds]
      ),
      sql.query(
        `SELECT "Id", "PartyId", "EquipmentType", "Brand", "Model", "Color", "SerialNumber", "Imei1", "Imei2", "Notes"
         FROM customer_equipments
         WHERE "TenantId" = $1 AND "PartyId" = ANY($2::uuid[]);`,
        [tenantId, partyIds]
      )
    ]);

    // Mapear arrays relacionados
    const contactsByParty: Record<string, any[]> = {};
    const addressesByParty: Record<string, any[]> = {};
    const equipmentsByParty: Record<string, any[]> = {};

    contacts.forEach((c: any) => {
      if (!contactsByParty[c.PartyId]) contactsByParty[c.PartyId] = [];
      contactsByParty[c.PartyId].push({
        id: c.Id,
        name: c.Name,
        email: c.Email,
        phone: c.Phone,
        whatsApp: c.WhatsApp,
        isPrimary: c.IsPrimary,
      });
    });

    addresses.forEach((a: any) => {
      if (!addressesByParty[a.PartyId]) addressesByParty[a.PartyId] = [];
      addressesByParty[a.PartyId].push({
        id: a.Id,
        street: a.Street,
        number: a.Number,
        complement: a.Complement,
        neighborhood: a.Neighborhood,
        city: a.City,
        state: a.State,
        postalCode: a.PostalCode,
        isPrimary: a.IsPrimary,
      });
    });

    equipments.forEach((e: any) => {
      if (!equipmentsByParty[e.PartyId]) equipmentsByParty[e.PartyId] = [];
      equipmentsByParty[e.PartyId].push({
        id: e.Id,
        equipmentType: e.EquipmentType,
        brand: e.Brand,
        model: e.Model,
        color: e.Color,
        serialNumber: e.SerialNumber,
        imei1: e.Imei1,
        imei2: e.Imei2,
        notes: e.Notes,
      });
    });

    const result = parties.map((p: any) => ({
      id: p.Id,
      type: p.Type,
      name: p.Name,
      tradeName: p.TradeName,
      documentNumber: p.DocumentNumber,
      stateRegistration: p.StateRegistration,
      municipalRegistration: p.MunicipalRegistration,
      birthDate: p.BirthDate,
      isActive: p.IsActive,
      notes: p.Notes,
      isCustomer: !!p.CustomerProfileId,
      isSupplier: !!p.SupplierProfileId,
      contacts: contactsByParty[p.Id] || [],
      addresses: addressesByParty[p.Id] || [],
      equipments: equipmentsByParty[p.Id] || [],
      createdAtUtc: p.CreatedAtUtc,
    }));

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("Erro ao listar parties:", err);
    return NextResponse.json({ error: "Erro ao listar clientes", detail: err.message }, { status: 500 });
  }
}

// POST /api/parties - Cadastrar novo cliente ou fornecedor no Neon
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("hb_access_token")?.value;
    if (!token) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const decoded: any = jwt.verify(token, getJwtSecret());
    const tenantId = decoded.tenant_id;

    const body = await request.json();
    const {
      type,
      name,
      tradeName,
      documentNumber,
      stateRegistration,
      municipalRegistration,
      birthDate,
      notes,
      enableCustomer,
      enableSupplier,
      customerNotes,
      supplyCategories,
      paymentTerms,
      primaryPhone,
      primaryEmail
    } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "O nome completo ou razão social é obrigatório." }, { status: 400 });
    }

    const cleanDoc = documentNumber?.trim() ? documentNumber.trim().replace(/\D/g, "") : null;
    const cleanType = type === 2 ? 2 : 1;

    const sql = getDb();

    // Validar duplicidade de documento se informado
    if (cleanDoc) {
      const existingDoc = await sql.query(
        `SELECT "Id", "Name" FROM parties 
         WHERE "TenantId" = $1 AND "DocumentNumber" = $2 LIMIT 1;`,
        [tenantId, cleanDoc]
      );
      if (existingDoc.length > 0) {
        return NextResponse.json(
          { error: `Já existe um cadastro com o documento '${documentNumber}' (${existingDoc[0].Name}).` },
          { status: 400 }
        );
      }
    }

    const partyId = crypto.randomUUID();
    const now = new Date().toISOString();

    // 1. Inserir Party
    await sql.query(
      `INSERT INTO parties (
        "Id", "TenantId", "Type", "Name", "TradeName", "DocumentNumber",
        "StateRegistration", "MunicipalRegistration", "BirthDate", "IsActive",
        "Notes", "CreatedAtUtc"
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, true,
        $10, $11
      );`,
      [
        partyId,
        tenantId,
        cleanType,
        name.trim(),
        tradeName?.trim() || null,
        cleanDoc,
        stateRegistration?.trim() || null,
        municipalRegistration?.trim() || null,
        birthDate ? new Date(birthDate).toISOString() : null,
        notes?.trim() || null,
        now
      ]
    );

    // 2. Criar CustomerProfile se habilitado (padrão true para clientes)
    if (enableCustomer !== false) {
      const cpId = crypto.randomUUID();
      await sql.query(
        `INSERT INTO customer_profiles (
          "Id", "TenantId", "PartyId", "InternalNotes", "TotalSalesValue", "CompletedRepairsCount", "CreatedAtUtc"
        ) VALUES (
          $1, $2, $3, $4, 0, 0, $5
        );`,
        [cpId, tenantId, partyId, customerNotes?.trim() || null, now]
      );
    }

    // 3. Criar SupplierProfile se habilitado
    if (enableSupplier) {
      const spId = crypto.randomUUID();
      await sql.query(
        `INSERT INTO supplier_profiles (
          "Id", "TenantId", "PartyId", "PaymentTerms", "SupplyCategories", "LeadTimeDays", "CreatedAtUtc"
        ) VALUES (
          $1, $2, $3, $4, $5, 0, $6
        );`,
        [spId, tenantId, partyId, paymentTerms?.trim() || null, supplyCategories?.trim() || null, now]
      );
    }

    // 4. Inserir Contato Primário se informado
    if (primaryPhone?.trim() || primaryEmail?.trim()) {
      const contactId = crypto.randomUUID();
      await sql.query(
        `INSERT INTO party_contacts (
          "Id", "TenantId", "PartyId", "Name", "Email", "Phone", "WhatsApp", "IsPrimary", "CreatedAtUtc"
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, true, $8
        );`,
        [
          contactId,
          tenantId,
          partyId,
          name.trim(),
          primaryEmail?.trim() || null,
          primaryPhone?.trim() || null,
          primaryPhone?.trim() || null,
          now
        ]
      );
    }

    return NextResponse.json({
      id: partyId,
      name: name.trim(),
      message: "Cliente/Pessoa cadastrado com sucesso!",
    });
  } catch (err: any) {
    console.error("Erro ao criar party:", err);
    return NextResponse.json({ error: "Erro ao cadastrar cliente", detail: err.message }, { status: 500 });
  }
}
