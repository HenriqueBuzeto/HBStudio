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
   ctx.db.query(`SELECT "Id"::text AS id,"SkuCode" AS "skuCode",
    "VariantName" AS name,"DefaultPrice"::float8 AS price
    FROM product_skus WHERE "TenantId"=$1::uuid AND "IsActive"=true
    ORDER BY "VariantName" LIMIT 200`,[ctx.tenantId])
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
