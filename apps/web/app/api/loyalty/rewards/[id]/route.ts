import {NextRequest} from "next/server";
import {uuid} from "@/lib/fleet-session";
import {loyaltyRoute,PERMS,result,body,required,optional,integer,rewardKind} from "@/lib/loyalty-server";
export async function PATCH(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 return loyaltyRoute(req,PERMS.manage,async(ctx,cid)=>{
  const id=uuid((await params).id,"Recompensa"),d=await body(req);
  if(typeof d.isActive!=="boolean")return result({error:"Informe status da recompensa.",code:"VALIDATION_ERROR"},cid,400);
  const version=integer(d.expectedVersion,"Versão",1,2147483647);
  const rows=await ctx.db.query(
   'WITH changed AS (UPDATE loyalty_rewards SET "IsActive"=$3::boolean,"Version"="Version"+1,"UpdatedAtUtc"=now() WHERE "Id"=$1::uuid AND "TenantId"=$2::uuid AND "Version"=$4::int RETURNING "Id","Version","IsActive"),'+
   ' audited AS (INSERT INTO audit_events("Id","TenantId","BranchId","EntityType","EntityId","Action","ActorId","ActorEmail","CorrelationId","AfterStateJson","CreatedAtUtc","Version") SELECT gen_random_uuid(),$2::uuid,$5::uuid,\'LoyaltyReward\',c."Id"::text,\'StatusChanged\',$6::uuid,$7,$8,jsonb_build_object(\'isActive\',c."IsActive",\'version\',c."Version"),now(),1 FROM changed c RETURNING "Id") SELECT c."Id"::text AS id,c."Version" AS version,c."IsActive" AS "isActive" FROM changed c CROSS JOIN audited',
   [id,ctx.tenantId,d.isActive,version,ctx.branchId,ctx.userId,ctx.email,cid]
  );
  if(!rows.length)return result({code:"OCC_CONFLICT",error:"A recompensa foi alterada por outro usuário. Atualize a tela."},cid,409);
  return result(rows[0],cid);
 },true);
}
