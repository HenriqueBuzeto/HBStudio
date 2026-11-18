import {NextRequest} from "next/server";
import crypto from "node:crypto";
import {FleetError} from "@/lib/fleet-session";
import {loyaltyHandler,LOYALTY_VIEW,LOYALTY_MANAGE,respond,requestJson,requiredString,optionalString,intValue,optionalDate} from "@/lib/loyalty-server";

export async function GET(request:NextRequest){
 return loyaltyHandler(request,LOYALTY_VIEW,async(s,cid)=>{
  const rows=await s.db.query('SELECT "Id"::text AS id,"Kind" AS kind,"Title" AS title,"Description" AS description,"PointsCost" AS "pointsCost","ValueCents" AS "valueCents","StockAvailable" AS "stockAvailable","IsActive" AS "isActive","StartsAtUtc" AS "startsAtUtc","EndsAtUtc" AS "endsAtUtc","Version" AS version FROM loyalty_rewards WHERE "TenantId"=$1::uuid ORDER BY "CreatedAtUtc" DESC LIMIT 300',[s.tenantId]);
  return respond({rewards:rows},cid);
 });
}
export async function POST(request:NextRequest){
 return loyaltyHandler(request,LOYALTY_MANAGE,async(s,cid)=>{
  const b=await requestJson(request);
  const kind=requiredString(b.kind,"Tipo de recompensa",16);
  if(!["GIFT","SERVICE","VOUCHER","DISCOUNT"].includes(kind))throw new FleetError(400,"INVALID_REWARD_KIND","Tipo de recompensa inválido.");
  const title=requiredString(b.title,"Nome do brinde",160);
  const description=optionalString(b.description,1000);
  const points=intValue(b.pointsCost,"Pontos necessários",1,100000000);
  const cents=intValue(b.valueCents??0,"Valor estimado em centavos",0,100000000);
  if(["VOUCHER","DISCOUNT"].includes(kind)&&cents<=0)throw new FleetError(400,"INVALID_AMOUNT","Desconto ou vale exige valor maior que zero.");
  const stock=b.stockAvailable==null||b.stockAvailable===""?null:intValue(b.stockAvailable,"Estoque promocional",0,1000000);
  const start=optionalDate(b.startsAtUtc,"Data de início"),end=optionalDate(b.endsAtUtc,"Data de término");
  if(start&&end&&new Date(start)>=new Date(end))throw new FleetError(400,"INVALID_PERIOD","Data final deve ser posterior à inicial.");
  const id=crypto.randomUUID();
  const rows=await s.db.query(
   'WITH created AS (INSERT INTO loyalty_rewards ("Id","TenantId","Kind","Title","Description","PointsCost","ValueCents","StockAvailable","IsActive","StartsAtUtc","EndsAtUtc") VALUES ($1::uuid,$2::uuid,$3,$4,$5,$6::int,$7::bigint,$8::int,false,$9::timestamptz,$10::timestamptz) RETURNING "Id"),'+
   ' audit AS (INSERT INTO audit_events ("Id","TenantId","BranchId","EntityType","EntityId","Action","ActorId","ActorEmail","CorrelationId","AfterStateJson","CreatedAtUtc","Version") SELECT gen_random_uuid(),$2::uuid,$11::uuid,\'LoyaltyReward\',x."Id"::text,\'CreatedInactive\',$12::uuid,$13,$14,jsonb_build_object(\'title\',$4,\'kind\',$3,\'points\',$6,\'valueCents\',$7,\'stock\',$8),now(),1 FROM created x RETURNING "Id") SELECT x."Id"::text AS id FROM created x JOIN audit a ON true',
   [id,s.tenantId,kind,title,description,points,cents,stock,start,end,s.branchId,s.userId,s.email,cid]
  );
  return respond({...rows[0],message:"Recompensa cadastrada inativa para revisão. Ative quando confirmar estoque e regras de entrega."},cid,201);
 },true);
}
