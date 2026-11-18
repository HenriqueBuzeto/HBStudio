import {NextRequest} from "next/server";
import {FleetError} from "@/lib/fleet-session";
import {customerMutation,requestJson,respond} from "@/lib/parties-server";
export async function PUT(request:NextRequest,{params}:{params:Promise<{id:string}>}){
 return customerMutation(request,(await params).id,async(s,partyId,cid)=>{
  const b=await requestJson(request);
  if(typeof b.isActive!=="boolean")throw new FleetError(400,"INVALID_STATUS","Status deve ser verdadeiro ou falso.");
  const rows=await s.db.query(
   'WITH updated AS (UPDATE parties SET "IsActive"=$3::boolean,"UpdatedAtUtc"=now() WHERE "Id"=$1::uuid AND "TenantId"=$2::uuid RETURNING "Id","IsActive"),'+
   ' audited AS (INSERT INTO audit_events ("Id","TenantId","BranchId","EntityType","EntityId","Action","ActorId","ActorEmail","CorrelationId","AfterStateJson","CreatedAtUtc","Version") SELECT gen_random_uuid(),$2::uuid,$4::uuid,\'Party\',u."Id"::text,\'StatusChanged\',$5::uuid,$6,$7,jsonb_build_object(\'active\',$3),now(),1 FROM updated u RETURNING "Id") SELECT u."Id"::text AS id,u."IsActive" AS "isActive" FROM updated u JOIN audited a ON true',
   [partyId,s.tenantId,b.isActive,s.branchId,s.userId,s.email,cid]);
  return respond(rows[0],cid);
 });
}
