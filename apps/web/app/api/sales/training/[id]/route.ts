import {NextRequest,NextResponse} from "next/server";
import crypto from "node:crypto";
import {authorizeFleet,FleetError,guardOrigin,uuid} from "@/lib/fleet-session";
type Params={params:Promise<{id:string}>};
export async function PATCH(request:NextRequest,{params}:Params){
 const cid=request.headers.get("x-correlation-id")||crypto.randomUUID();
 const headers={"Cache-Control":"no-store","X-Correlation-Id":cid};
 try{
  guardOrigin(request);
  const ctx=await authorizeFleet(request,"sales.cancel");
  const {id}=await params;uuid(id,"Simulação");
  const body=await request.json();
  const reason=typeof body?.reason==="string"?body.reason.trim():"";
  if(reason.length<4||reason.length>500)throw new FleetError(422,"INVALID_REASON","Informe o motivo de cancelamento (4 a 500 caracteres).");
  const rows=await ctx.db.query(`
    WITH voided AS (
      UPDATE pos_training_sales SET "Status"='VOIDED',"VoidedAtUtc"=now(),
       "VoidedByUserId"=$4::uuid,"VoidReason"=$5
      WHERE "TenantId"=$1::uuid AND "BranchId"=$2::uuid
       AND "Id"=$3::uuid AND "Status"='SIMULATED'
      RETURNING "Id","Number"
    ), audited AS (
      INSERT INTO audit_events ("Id","TenantId","BranchId","EntityType","EntityId",
       "Action","ActorId","ActorEmail","CorrelationId","AfterStateJson","CreatedAtUtc","Version")
      SELECT gen_random_uuid(),$1::uuid,$2::uuid,'PosTrainingSale',v."Id"::text,
       'Voided',$4::uuid,$6,$7,jsonb_build_object('simulation',true,'reason',$5),now(),2
      FROM voided v RETURNING "Id"
    ) SELECT v."Id"::text id,v."Number" number FROM voided v JOIN audited a ON true`,
    [ctx.tenantId,ctx.branchId,id,ctx.userId,reason,ctx.email,cid]);
  if(!rows.length)throw new FleetError(409,"TRAINING_NOT_ACTIVE","Simulação não encontrada ou já cancelada.");
  return NextResponse.json({id:rows[0].id,number:rows[0].number,status:"VOIDED",
    note:"Cancelamento de simulação. Sem estorno real ou movimentação financeira."},{headers});
 }catch(e){
  if(e instanceof FleetError)return NextResponse.json({code:e.code,error:e.message},{status:e.status,headers});
  console.error("[TrainingPOS:Void]["+cid+"]:",e instanceof Error?e.name:"unknown");
  return NextResponse.json({code:"TRAINING_VOID_UNAVAILABLE",error:"Não foi possível cancelar a simulação."},{status:503,headers});
 }
}
