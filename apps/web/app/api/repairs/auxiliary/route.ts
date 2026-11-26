import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { authorizeFleet, FleetError } from "@/lib/fleet-session";

export async function GET(request:NextRequest) {
 const cid=request.headers.get("x-correlation-id")||crypto.randomUUID();
 try {
  const ctx=await authorizeFleet(request,"repairs.view");
  const [parties,skus]=await Promise.all([
   ctx.db.query(`SELECT "Id"::text AS id,"Name" AS name,"DocumentNumber" AS document
    FROM parties WHERE "TenantId"=$1::uuid AND "IsActive"=true
    ORDER BY "Name" LIMIT 200`,[ctx.tenantId]),
   ctx.permissions.has("catalog.products.view")?ctx.db.query(`SELECT s."Id"::text id,s."SkuCode" "skuCode",left(m."Name"||' · '||s."VariantName",400) name,s."DefaultPrice"::float8 price,m."Kind" kind,
      CASE WHEN m."Kind"=4 THEN coalesce(s."TechnicalSpecsJson"->>'serviceUnit','EXECUTION') END "serviceUnit",
      CASE WHEN m."Kind"=4 THEN s."TechnicalSpecsJson"->>'serviceMinutes' END "serviceMinutes",
      CASE WHEN m."Kind"<>4 THEN coalesce(a.available,0)::float8 END available
    FROM product_skus s JOIN product_models m ON m."Id"=s."ProductModelId" AND m."TenantId"=s."TenantId"
    LEFT JOIN LATERAL (SELECT sum(greatest(0,b."OnHandQuantity"-b."ReservedQuantity"-b."BlockedQuantity")) available FROM stock_balances b
      JOIN warehouses w ON w."Id"=b."WarehouseId" AND w."TenantId"=b."TenantId" AND w."BranchId"=b."BranchId" AND w."IsActive" AND w."Type" IN(1,2,3)
      WHERE b."TenantId"=s."TenantId" AND b."BranchId"=$2::uuid AND b."ProductSkuId"=s."Id" AND NOT EXISTS(SELECT 1 FROM manufacturing_material_balance_configs c WHERE c.tenant_id=b."TenantId" AND c.branch_id=b."BranchId" AND c.balance_id=b."Id")) a ON $3::boolean AND m."Kind"<>4
    WHERE s."TenantId"=$1::uuid AND s."IsActive" AND m."IsActive" AND s."DefaultPrice" IS NOT NULL AND (m."Kind"=4 OR ($3::boolean AND m."Kind" IN(1,3,5) AND m."SerializationPolicy"=0 AND coalesce(a.available,0)>0))
    ORDER BY m."Kind",m."Name",s."SkuCode" LIMIT 2000`,[ctx.tenantId,ctx.branchId,ctx.permissions.has("inventory.view")]):Promise.resolve([])
  ]);
  return NextResponse.json({
   customers:parties.map((p:any)=>({id:p.id,name:p.name,
    document:ctx.permissions.has("customers.sensitive.view")?p.document:null})),
   products:skus
  },{headers:{"X-Correlation-Id":cid,"Cache-Control":"no-store"}});
 } catch(e) {
  if(e instanceof FleetError)return NextResponse.json({code:e.code,error:e.message},{status:e.status});
  console.error("[Repairs]["+cid+"] auxiliary query failed");
  return NextResponse.json({error:"Dados de apoio indisponíveis."},{status:503});
 }
}
