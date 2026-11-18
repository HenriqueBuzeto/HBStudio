import {NextRequest} from "next/server";
import crypto from "node:crypto";
import {loyaltyRoute,PERMS,result,body,required,optional,integer,rewardKind} from "@/lib/loyalty-server";
export async function GET(req:NextRequest){
 return loyaltyRoute(req,PERMS.view,async(ctx,cid)=>{
  const all=ctx.permissions.has(PERMS.manage)&&new URL(req.url).searchParams.get("all")==="true";
  const rows=await ctx.db.query('SELECT "Id"::text AS id,"Title" AS title,"Description" AS description,"Kind" AS kind,"PointsCost"::bigint AS "pointsCost","DiscountCents" AS "discountCents","DiscountPercent" AS "discountPercent","StockTotal" AS "stockTotal","StockAllocated" AS "stockAllocated","IsActive" AS "isActive","Version" AS version,"CreatedAtUtc" AS "createdAt" FROM loyalty_rewards WHERE "TenantId"=$1::uuid AND ($2::boolean OR "IsActive"=true) ORDER BY "CreatedAtUtc" DESC LIMIT 250',[ctx.tenantId,all]);
  return result({rewards:rows},cid);
 });
}
export async function POST(req:NextRequest){
 return loyaltyRoute(req,PERMS.manage,async(ctx,cid)=>{
  const d=await body(req),id=crypto.randomUUID(),kind=rewardKind(d.kind);
  const title=required(d.title,"Título do brinde/desconto");
  const desc=optional(d.description);
  const points=integer(d.pointsCost,"Custo em pontos",1,100000000);
  const cents=kind==="DISCOUNT_FIXED"?integer(d.discountCents,"Desconto em centavos",1,100000000):null;
  const percent=kind==="DISCOUNT_PERCENT"?integer(d.discountPercent,"Desconto percentual",1,100):null;
  const stock=d.stockTotal===null||d.stockTotal===undefined?null:integer(d.stockTotal,"Quantidade de benefícios",0,1000000);
  const rows=await ctx.db.query(
   'WITH created AS (INSERT INTO loyalty_rewards("Id","TenantId","Title","Description","Kind","PointsCost","DiscountCents","DiscountPercent","StockTotal") VALUES($1::uuid,$2::uuid,$3,$4,$5,$6::bigint,$7::int,$8::int,$9::int) RETURNING "Id","Title","Kind","PointsCost","IsActive"),'+
   ' audited AS (INSERT INTO audit_events("Id","TenantId","BranchId","EntityType","EntityId","Action","ActorId","ActorEmail","CorrelationId","AfterStateJson","CreatedAtUtc","Version") SELECT gen_random_uuid(),$2::uuid,$10::uuid,\'LoyaltyReward\',r."Id"::text,\'Created\',$11::uuid,$12,$13,jsonb_build_object(\'title\',r."Title",\'kind\',r."Kind",\'pointsCost\',r."PointsCost"),now(),1 FROM created r RETURNING "Id") SELECT r."Id"::text AS id FROM created r CROSS JOIN audited',
   [id,ctx.tenantId,title,desc,kind,points,cents,percent,stock,ctx.branchId,ctx.userId,ctx.email,cid]
  );
  return result({id:rows[0].id,created:true,message:"Recompensa cadastrada. Resgate depende de saldo real e estoque disponível."},cid,201);
 },true);
}
