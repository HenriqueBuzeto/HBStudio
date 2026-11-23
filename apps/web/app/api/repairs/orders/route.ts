import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { authorizeFleet, guardOrigin, FleetError, uuid } from "@/lib/fleet-session";

const headers = (cid: string) => ({ "X-Correlation-Id": cid, "Cache-Control": "no-store" });
function failure(error: unknown, cid: string) {
  if (error instanceof FleetError) {
    return NextResponse.json({ code: error.code, error: error.message }, { status: error.status, headers: headers(cid) });
  }
  const message = error instanceof Error ? error.message : "";
  const code = message.match(/REPAIR_[A-Z_]+/)?.[0];
  if (code) {
    const status = code.includes("CONFLICT") ? 409 : code.includes("NOT_FOUND") ? 404 : 422;
    return NextResponse.json({ code, error: "Os dados não atendem às regras da ordem de serviço.", }, { status, headers: headers(cid) });
  }
  console.error("[Repairs][" + cid + "] database failure:", error instanceof Error ? error.name : "unknown");
  return NextResponse.json({ code: "REPAIRS_UNAVAILABLE", error: "Não foi possível concluir a operação de OS." }, { status: 503, headers: headers(cid) });
}
const required = (input: unknown, label: string, max: number) => {
  if (typeof input !== "string" || input.trim().length < 2 || input.trim().length > max)
    throw new FleetError(422, "VALIDATION_ERROR", label + " obrigatório ou inválido.");
  return input.trim();
};
const optional = (value: unknown, max=2000): string | null => {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || value.length > max) throw new FleetError(422,"VALIDATION_ERROR","Texto muito longo.");
  return value.trim() || null;
};
function validateItems(input: unknown) {
  if (!Array.isArray(input) || input.length > 100) throw new FleetError(422,"REPAIR_INVALID_ITEMS","A lista de serviços e peças é inválida.");
  return input.map((item: any) => {
    if (!item || typeof item !== "object" || ![1,2].includes(item.itemType))
      throw new FleetError(422,"REPAIR_INVALID_ITEM","Tipo de item inválido.");
    const description = required(item.description,"Descrição",400);
    const quantity = Number(item.quantity), unitPrice = Number(item.unitPrice);
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 10000 ||
        !Number.isFinite(unitPrice) || unitPrice < 0 || unitPrice > 100000000 ||
        Math.abs(Math.round(unitPrice*100)-unitPrice*100)>0.000001) {
      throw new FleetError(422,"REPAIR_INVALID_ITEM","Quantidade ou preço inválido.");
    }
    return { itemType:item.itemType,description,quantity,unitPrice,
      productSkuId: item.productSkuId ? uuid(item.productSkuId,"SKU") : null };
  });
}

// GET: tenant and branch scoped, hide sensitive cost unless authorized.
export async function GET(request: NextRequest) {
  const cid = request.headers.get("x-correlation-id") || crypto.randomUUID();
  try {
    const ctx = await authorizeFleet(request,"repairs.view");
    const rows = await ctx.db.query(
      `SELECT ro."Id"::text AS id,ro."OrderNumber" AS "orderNumber",
        ro."Status" AS status,ro."CustomerId"::text AS "customerId",p."Name" AS "customerName",
        ro."CustomerEquipmentId"::text AS "customerEquipmentId",
        ce."EquipmentType" AS "equipmentType",ce."Brand" AS brand,
        ce."Model" AS model,ce."Color" AS color,ce."SerialNumber" AS "serialNumber",
        ce."Notes" AS "equipmentDetails",ro."ReportedDefect" AS "reportedDefect",
        ro."PhysicalConditionNotes" AS "physicalConditionNotes",
        ro."DiagnosticNotes" AS "diagnosticNotes",ro."ResolutionNotes" AS "resolutionNotes",
        ro."TotalPartsPrice"::float8 AS "totalPartsPrice",
        ro."TotalLaborPrice"::float8 AS "totalLaborPrice",
        ro."TotalDiscount"::float8 AS "totalDiscount",
        ro."FinalPrice"::float8 AS "finalPrice",
        ro."ReceivedAtUtc" AS "receivedAtUtc",
        ro."EstimatedCompletionUtc" AS "estimatedCompletionUtc",
        ro."DeliveredAtUtc" AS "deliveredAtUtc",
        ro."CreatedAtUtc" AS "createdAtUtc",ro."UpdatedAtUtc" AS "updatedAtUtc"
      FROM repair_orders ro
      JOIN parties p ON p."Id"=ro."CustomerId" AND p."TenantId"=ro."TenantId"
      JOIN customer_equipments ce ON ce."Id"=ro."CustomerEquipmentId" AND ce."TenantId"=ro."TenantId"
      WHERE ro."TenantId"=$1::uuid AND ro."BranchId"=$2::uuid
      ORDER BY ro."CreatedAtUtc" DESC LIMIT 500`,
      [ctx.tenantId,ctx.branchId]
    );
    const ids=rows.map((r:any)=>r.id);
    let items:any[]=[];
    if (ids.length) {
      items=await ctx.db.query(
        `SELECT i."Id"::text AS id,i."RepairOrderId"::text AS "repairOrderId",
          i."ItemType" AS "itemType",i."Description" AS description,
          i."Quantity"::float8 AS quantity,i."UnitPrice"::float8 AS "unitPrice",
          i."ProductSkuId"::text AS "productSkuId"
         FROM repair_estimate_items i JOIN repair_orders ro
           ON ro."Id"=i."RepairOrderId" AND ro."TenantId"=i."TenantId"
         WHERE i."TenantId"=$1::uuid AND ro."BranchId"=$2::uuid AND i."RepairOrderId"=ANY($3::uuid[])`,
        [ctx.tenantId,ctx.branchId,ids]
      );
    }
    const byOrder=new Map<string,any[]>();
    for (const i of items) byOrder.set(i.repairOrderId,[...(byOrder.get(i.repairOrderId)||[]),i]);
    return NextResponse.json({orders:rows.map((r:any)=>({...r,items:byOrder.get(r.id)||[]}))},{headers:headers(cid)});
  } catch(err) {return failure(err,cid);}
}

export async function POST(request: NextRequest) {
  const cid = request.headers.get("x-correlation-id") || crypto.randomUUID();
  try {
    guardOrigin(request);
    const ctx=await authorizeFleet(request,"repairs.create");
    const body=await request.json();
    if(!body || typeof body!=="object" || Array.isArray(body))
      throw new FleetError(422,"VALIDATION_ERROR","Dados da OS inválidos.");
    const customerId=body.customerId ? uuid(body.customerId,"Cliente") : null;
    const customerName=customerId ? null : required(body.customerName,"Cliente",180);
    const equipmentType=required(body.equipmentType,"Tipo de aparelho",100);
    const brand=required(body.brand,"Marca",120);
    const model=required(body.model,"Modelo",160);
    const defect=required(body.reportedDefect,"Defeito relatado",2000);
    const items=validateItems(body.items||[]);
    const requestKey=uuid(body.requestKey,"Chave de idempotência");
    const rows=await ctx.db.query(
      'SELECT * FROM repair_enterprise_create($1::uuid,$2::uuid,$3::uuid,$4::text,$5::text,$6::uuid,$7::text,$8::text,$9::text,$10::text,$11::text,$12::text,$13::text,$14::text,$15::text,$16::jsonb,$17::uuid)',
      [ctx.tenantId,ctx.branchId,ctx.userId,ctx.email,cid,customerId,customerName,equipmentType,
        brand,model,optional(body.color,100),optional(body.serialNumber,120),
        optional(body.equipmentDetails,2000),defect,optional(body.physicalConditionNotes,2000),JSON.stringify(items),requestKey]
    );
    return NextResponse.json({id:rows[0].id,orderNumber:rows[0].orderNumber,
      message:"Ordem de serviço criada e auditada no Neon."},{status:201,headers:headers(cid)});
  } catch(err) {return failure(err,cid);}
}
