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

    const parties = await sql(query, params);

    if (parties.length === 0) {
      return NextResponse.json([]);
    }

    const partyIds = parties.map((p: any) => p.Id);

    // Buscar Contatos, Endereços e Equipamentos para os clientes retornados
    const [contacts, addresses, equipments] = await Promise.all([
      sql(
        `SELECT "Id", "PartyId", "Name", "Email", "Phone", "WhatsApp", "IsPrimary"
         FROM party_contacts
         WHERE "TenantId" = $1 AND "PartyId" = ANY($2::uuid[]);`,
        [tenantId, partyIds]
      ),
      sql(
        `SELECT "Id", "PartyId", "Street", "Number", "Complement", "Neighborhood", "City", "State", "PostalCode", "IsPrimary"
         FROM party_addresses
         WHERE "TenantId" = $1 AND "PartyId" = ANY($2::uuid[]);`,
        [tenantId, partyIds]
      ),
      sql(
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

// POST /api/parties - Salva o cadastro completo atomicamente no Neon.
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("hb_access_token")?.value;
    if (!token) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const decoded: any = jwt.verify(token, getJwtSecret());
    const tenantId = decoded.tenant_id;
    if (!tenantId) return NextResponse.json({ error: "Sessão sem empresa válida." }, { status: 403 });

    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return NextResponse.json({ error: "O nome completo ou razão social é obrigatório." }, { status: 400 });

    const type = body.type === 2 ? 2 : 1;
    const cleanDoc = typeof body.documentNumber === "string"
      ? body.documentNumber.replace(/\\D/g, "") || null
      : null;
    if (cleanDoc && cleanDoc.length !== (type === 2 ? 14 : 11)) {
      return NextResponse.json({ error: "CPF ou CNPJ com quantidade inválida de dígitos." }, { status: 400 });
    }
    const address = body.address && typeof body.address === "object" ? body.address : null;
    const equipment = body.equipment && typeof body.equipment === "object" ? body.equipment : null;
    if (address && (!address.street?.trim() || !address.city?.trim() || !address.state?.trim()
      || !address.postalCode?.trim() || !address.neighborhood?.trim())) {
      return NextResponse.json({ error: "Endereço incompleto: informe rua, bairro, cidade, estado e CEP." }, { status: 400 });
    }
    if (equipment && !equipment.model?.trim()) {
      return NextResponse.json({ error: "Modelo do aparelho é obrigatório." }, { status: 400 });
    }

    const sql = getDb();
    if (cleanDoc) {
      const existing = await sql(
        'SELECT "Id" FROM parties WHERE "TenantId" = $1 AND "DocumentNumber" = $2 LIMIT 1',
        [tenantId, cleanDoc]
      );
      if (existing.length) return NextResponse.json({ error: "Já existe um cadastro com este CPF/CNPJ." }, { status: 409 });
    }

    const partyId = crypto.randomUUID();
    const now = new Date().toISOString();
    const operations = [
      sql(`INSERT INTO parties (
        "Id","TenantId","Type","Name","TradeName","DocumentNumber",
        "StateRegistration","MunicipalRegistration","BirthDate","IsActive","Notes","CreatedAtUtc"
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true,$10,$11)`,
      [
        partyId, tenantId, type, name, type === 2 ? body.tradeName?.trim() || null : null,
        cleanDoc, type === 2 ? body.stateRegistration?.trim() || null : null,
        body.municipalRegistration?.trim() || null,
        body.birthDate || null, body.notes?.trim() || null, now
      ])
    ];
    if (body.enableCustomer !== false) {
      operations.push(sql(
        `INSERT INTO customer_profiles ("Id","TenantId","PartyId","InternalNotes","TotalSalesValue","CompletedRepairsCount","CreatedAtUtc")
         VALUES ($1,$2,$3,$4,0,0,$5)`,
        [crypto.randomUUID(), tenantId, partyId, body.customerNotes?.trim() || null, now]
      ));
    }
    if (body.enableSupplier === true) {
      operations.push(sql(
        `INSERT INTO supplier_profiles ("Id","TenantId","PartyId","PaymentTerms","SupplyCategories","LeadTimeDays","CreatedAtUtc")
         VALUES ($1,$2,$3,$4,$5,0,$6)`,
        [crypto.randomUUID(), tenantId, partyId, body.paymentTerms?.trim() || null, body.supplyCategories?.trim() || null, now]
      ));
    }
    if (body.primaryPhone?.trim() || body.primaryEmail?.trim()) {
      operations.push(sql(
        `INSERT INTO party_contacts ("Id","TenantId","PartyId","Name","Email","Phone","WhatsApp","IsPrimary","CreatedAtUtc")
         VALUES ($1,$2,$3,$4,$5,$6,$7,true,$8)`,
        [crypto.randomUUID(), tenantId, partyId, name, body.primaryEmail?.trim() || null,
          body.primaryPhone?.trim() || null, body.primaryPhone?.trim() || null, now]
      ));
    }
    if (address) {
      operations.push(sql(
        `INSERT INTO party_addresses ("Id","TenantId","PartyId","Street","Number","Complement","Neighborhood",
          "City","State","PostalCode","IsPrimary","CreatedAtUtc")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true,$11)`,
        [crypto.randomUUID(), tenantId, partyId, address.street.trim(), address.number?.trim() || "S/N",
          address.complement?.trim() || null, address.neighborhood.trim(), address.city.trim(),
          address.state.trim().toUpperCase(), address.postalCode.trim(), now]
      ));
    }
    if (equipment) {
      operations.push(sql(
        `INSERT INTO customer_equipments ("Id","TenantId","PartyId","EquipmentType","Brand","Model","Color",
          "SerialNumber","Imei1","Imei2","Notes","CreatedAtUtc")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [crypto.randomUUID(), tenantId, partyId, equipment.equipmentType || "Smartphone",
          equipment.brand || "Outro", equipment.model.trim(), equipment.color?.trim() || null,
          equipment.serialNumber?.trim() || null, equipment.imei1?.trim() || null,
          equipment.imei2?.trim() || null, equipment.notes?.trim() || null, now]
      ));
    }

    // Uma falha em qualquer entidade causa rollback de todo o cadastro.
    await sql.transaction(operations);
    return NextResponse.json({ id: partyId, name, message: "Cadastro completo salvo com sucesso." }, { status: 201 });
  } catch (err: any) {
    console.error("Erro ao criar cadastro completo:", err);
    if (err?.code === "23505") {
      return NextResponse.json({ error: "Já existe um registro com esses dados exclusivos." }, { status: 409 });
    }
    return NextResponse.json({ error: "Falha ao salvar cadastro. Nenhum registro parcial foi confirmado." }, { status: 500 });
  }
}
