import {NextRequest} from "next/server";
import crypto from "node:crypto";
import {FleetError,uuid} from "@/lib/fleet-session";
import {catalogHandler,READ_PERMISSION,MANAGE_PERMISSION,readBody,textField,optionalUuid,response} from "@/lib/catalog-server";

export async function GET(request:NextRequest){
 return catalogHandler(request,READ_PERMISSION,async(ctx,cid)=>{
  const rows=await ctx.db.query('SELECT "Id"::text AS id,"Name" AS name,"Slug" AS slug,"ParentCategoryId"::text AS "parentCategoryId","IsActive" AS "isActive","CreatedAtUtc" AS "createdAtUtc",xmin::text::bigint AS version FROM product_categories WHERE "TenantId"=$1::uuid ORDER BY "Name" LIMIT 500',[ctx.tenantId]);
  return response(rows,cid);
 });
}
export async function POST(request:NextRequest){
 return catalogHandler(request,MANAGE_PERMISSION,async(ctx,cid)=>{
  const b=await readBody(request);
  const name=textField(b.name,"Nome da categoria",100);
  const slug=textField(b.slug,"Slug da categoria",100).toLowerCase();
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))throw new FleetError(400,"INVALID_SLUG","Slug deve conter letras minúsculas, números e hífens.");
  const parent=optionalUuid(b.parentCategoryId,"Categoria superior");
  const id=crypto.randomUUID();
  const rows=await ctx.db.query(
   'WITH created AS (INSERT INTO product_categories ("Id","TenantId","Name","Slug","ParentCategoryId","IsActive","CreatedAtUtc") SELECT $1::uuid,$2::uuid,$3,$4,$5::uuid,true,now() WHERE $5::uuid IS NULL OR EXISTS (SELECT 1 FROM product_categories WHERE "TenantId"=$2::uuid AND "Id"=$5::uuid AND "IsActive"=true) RETURNING "Id","Name","Slug","ParentCategoryId","IsActive","CreatedAtUtc"),'+
   ' audited AS (INSERT INTO audit_events ("Id","TenantId","BranchId","EntityType","EntityId","Action","ActorId","ActorEmail","CorrelationId","AfterStateJson","CreatedAtUtc","Version") SELECT gen_random_uuid(),$2::uuid,$6::uuid,\'ProductCategory\',c."Id"::text,\'Created\',$7::uuid,$8,$9,jsonb_build_object(\'name\',$3,\'slug\',$4),now(),1 FROM created c RETURNING "Id")'+
   ' SELECT c."Id"::text AS id,c."Name" AS name,c."Slug" AS slug,c."ParentCategoryId"::text AS "parentCategoryId",c."IsActive" AS "isActive",c."CreatedAtUtc" AS "createdAtUtc" FROM created c CROSS JOIN audited',
   [id,ctx.tenantId,name,slug,parent,ctx.branchId,ctx.userId,ctx.email,cid]
  );
  if(!rows.length)throw new FleetError(409,"INVALID_PARENT_CATEGORY","Categoria superior inexistente na sua empresa.");
  return response(rows[0],cid,201);
 },true);
}
