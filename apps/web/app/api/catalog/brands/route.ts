import {NextRequest} from "next/server";
import crypto from "node:crypto";
import {catalogHandler,READ_PERMISSION,MANAGE_PERMISSION,readBody,textField,optionalText,response} from "@/lib/catalog-server";

export async function GET(request:NextRequest){
 return catalogHandler(request,READ_PERMISSION,async(ctx,cid)=>{
  const rows=await ctx.db.query('SELECT "Id"::text AS id,"Name" AS name,"Description" AS description,"IsActive" AS "isActive","CreatedAtUtc" AS "createdAtUtc",xmin::text::bigint AS version FROM product_brands WHERE "TenantId"=$1::uuid ORDER BY "Name" LIMIT 500',[ctx.tenantId]);
  return response(rows,cid);
 });
}
export async function POST(request:NextRequest){
 return catalogHandler(request,MANAGE_PERMISSION,async(ctx,cid)=>{
  const b=await readBody(request);
  const name=textField(b.name,"Nome da marca",100),description=optionalText(b.description,500);
  const id=crypto.randomUUID();
  const rows=await ctx.db.query(
   'WITH created AS (INSERT INTO product_brands ("Id","TenantId","Name","Description","IsActive","CreatedAtUtc") VALUES ($1::uuid,$2::uuid,$3,$4,true,now()) RETURNING "Id","Name","Description","IsActive","CreatedAtUtc"),'+
   ' audited AS (INSERT INTO audit_events ("Id","TenantId","BranchId","EntityType","EntityId","Action","ActorId","ActorEmail","CorrelationId","AfterStateJson","CreatedAtUtc","Version") SELECT gen_random_uuid(),$2::uuid,$5::uuid,\'ProductBrand\',c."Id"::text,\'Created\',$6::uuid,$7,$8,jsonb_build_object(\'name\',$3),now(),1 FROM created c RETURNING "Id")'+
   ' SELECT c."Id"::text AS id,c."Name" AS name,c."Description" AS description,c."IsActive" AS "isActive",c."CreatedAtUtc" AS "createdAtUtc" FROM created c CROSS JOIN audited',
   [id,ctx.tenantId,name,description,ctx.branchId,ctx.userId,ctx.email,cid]
  );
  return response(rows[0],cid,201);
 },true);
}
