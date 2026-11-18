import {NextRequest} from "next/server";
import crypto from "node:crypto";
import {FleetError} from "@/lib/fleet-session";
import {loyaltyHandler,LOYALTY_VIEW,LOYALTY_MANAGE,respond,requestJson,intValue,boolField} from "@/lib/loyalty-server";
export async function GET(request:NextRequest){
 return loyaltyHandler(request,LOYALTY_VIEW,async(s,cid)=>{
  const rows=await s.db.query('SELECT "Id"::text AS id,"Enabled" AS enabled,"EarnCentsPerPoint" AS "earnCentsPerPoint","CashbackBps" AS "cashbackBps","SilverAtPoints" AS "silverAtPoints","GoldAtPoints" AS "goldAtPoints","DiamondAtPoints" AS "diamondAtPoints","Version" AS version FROM loyalty_programs WHERE "TenantId"=$1::uuid',[s.tenantId]);
  return respond({program:rows[0]||null},cid);
 });
}
export async function PUT(request:NextRequest){
 return loyaltyHandler(request,LOYALTY_MANAGE,async(s,cid)=>{
  const b=await requestJson(request);
  const enabled=boolField(b.enabled,"Programa ativo");
  const rate=intValue(b.earnCentsPerPoint,"Centavos por ponto",1,1000000);
  const bps=intValue(b.cashbackBps,"Cashback em pontos-base",0,3000);
  const silver=intValue(b.silverAtPoints,"Nível Prata",1,9999999);
  const gold=intValue(b.goldAtPoints,"Nível Ouro",1,9999999);
  const diamond=intValue(b.diamondAtPoints,"Nível Diamante",1,9999999);
  const expected=intValue(b.expectedVersion,"Versão",1,2147483647);
  if(!(silver<gold&&gold<diamond))throw new FleetError(400,"INVALID_TIERS","Os níveis precisam aumentar de Prata para Diamante.");
  const rows=await s.db.query(
   'WITH updated AS (UPDATE loyalty_programs SET "Enabled"=$2::boolean,"EarnCentsPerPoint"=$3::int,"CashbackBps"=$4::int,"SilverAtPoints"=$5::int,"GoldAtPoints"=$6::int,"DiamondAtPoints"=$7::int,"Version"="Version"+1,"UpdatedAtUtc"=now() WHERE "TenantId"=$1::uuid AND "Version"=$8::bigint RETURNING "Id","Version"),'+
   ' audit AS (INSERT INTO audit_events ("Id","TenantId","BranchId","EntityType","EntityId","Action","ActorId","ActorEmail","CorrelationId","AfterStateJson","CreatedAtUtc","Version") SELECT gen_random_uuid(),$1::uuid,$9::uuid,\'LoyaltyProgram\',u."Id"::text,\'PolicyChanged\',$10::uuid,$11,$12,jsonb_build_object(\'enabled\',$2,\'earnCentsPerPoint\',$3,\'cashbackBps\',$4,\'silverAt\',$5,\'goldAt\',$6,\'diamondAt\',$7),now(),1 FROM updated u RETURNING "Id") SELECT u."Id"::text AS id,u."Version" AS version FROM updated u JOIN audit a ON true',
   [s.tenantId,enabled,rate,bps,silver,gold,diamond,expected,s.branchId,s.userId,s.email,cid]
  );
  if(!rows.length)throw new FleetError(409,"LOYALTY_POLICY_CONFLICT","Política não salva: alterações concorrentes ou programa inexistente. Recarregue.");
  return respond({...rows[0],message:"Regra atualizada. Transações anteriores preservam a política aplicada no momento da venda."},cid);
 },true);
}
