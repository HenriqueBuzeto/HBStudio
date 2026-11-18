import {NextRequest} from "next/server";
import {uuid,FleetError} from "@/lib/fleet-session";
import {loyaltyRoute,PERMS,result,body,assertCustomer} from "@/lib/loyalty-server";

export async function GET(req:NextRequest){
 return loyaltyRoute(req,PERMS.view,async(ctx,cid)=>{
  const p=new URL(req.url).searchParams;
  const status=p.get("status");
  if(status&&!["RESERVED","FULFILLED","CANCELLED"].includes(status))throw new FleetError(400,"INVALID_FILTER","Status inválido.");
  const rows=await ctx.db.query('SELECT r."Id"::text AS id,r."PartyId"::text AS "partyId",p."Name" AS "customerName",r."RewardId"::text AS "rewardId",r."RewardTitleSnapshot" AS title,r."RewardKindSnapshot" AS kind,r."PointsSpent"::bigint AS "pointsSpent",r."Status" AS status,r."CreatedAtUtc" AS "createdAt",r."CompletedAtUtc" AS "completedAt" FROM loyalty_redemptions r JOIN parties p ON p."Id"=r."PartyId" AND p."TenantId"=r."TenantId" WHERE r."TenantId"=$1::uuid AND ($2::text IS NULL OR r."Status"=$2::text) ORDER BY r."CreatedAtUtc" DESC LIMIT 200',[ctx.tenantId,status]);
  return result({redemptions:rows},cid);
 });
}
export async function POST(req:NextRequest){
 return loyaltyRoute(req,PERMS.redeem,async(ctx,cid)=>{
  const d=await body(req),partyId=uuid(d.partyId,"Cliente"),rewardId=uuid(d.rewardId,"Recompensa");
  const key=uuid(d.idempotencyKey,"Chave de idempotência");
  await assertCustomer(ctx,partyId);
  const settings=await ctx.db.query('SELECT "Enabled" AS enabled FROM loyalty_settings WHERE "TenantId"=$1::uuid',[ctx.tenantId]);
  if(!settings[0]?.enabled)throw new FleetError(409,"LOYALTY_DISABLED","Programa de fidelidade não configurado ou desativado.");
  const rows=await ctx.db.query(
   'WITH reserved AS (SELECT loyalty_reserve_reward($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::text) AS id),'+
   ' audited AS (INSERT INTO audit_events("Id","TenantId","BranchId","EntityType","EntityId","Action","ActorId","ActorEmail","CorrelationId","AfterStateJson","CreatedAtUtc","Version") SELECT gen_random_uuid(),$1::uuid,$6::uuid,\'LoyaltyRedemption\',r.id::text,\'ReservationRequested\',$4::uuid,$7,$8,jsonb_build_object(\'partyId\',$2,\'rewardId\',$3,\'idempotencyKey\',$5),now(),1 FROM reserved r RETURNING "Id") SELECT r.id::text AS id FROM reserved r CROSS JOIN audited',
   [ctx.tenantId,partyId,rewardId,ctx.userId,key,ctx.branchId,ctx.email,cid]
  );
  return result({id:rows[0].id,status:"RESERVED",message:"Resgate reservado, pontos debitados e auditados. Nenhum desconto aplicado ao PDV e nenhum brinde entregue."},cid,201);
 },true);
}
