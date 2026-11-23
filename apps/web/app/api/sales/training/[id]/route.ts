import {NextRequest,NextResponse} from "next/server";
import crypto from "node:crypto";
import {authorizeFleet,guardOrigin,FleetError,uuid} from "@/lib/fleet-session";
type Context={params:Promise<{id:string}>};
export async function PATCH(request:NextRequest,{params}:Context){
 const cid=request.headers.get("x-correlation-id")||crypto.randomUUID();
 const headers={"Cache-Control":"no-store","X-Correlation-Id":cid};
 try{
  guardOrigin(request);
  const ctx=await authorizeFleet(request,"sales.cancel");
  const {id}=await params;uuid(id,"Simulação");
  const body=await request.json() as {reason?:unknown};
  const reason=typeof body.reason==="string"?body.reason.trim():"";
  if(reason.length<6||reason.length>400)
   throw new FleetError(422,"CANCELLATION_REASON_REQUIRED","Informe um motivo de 6 a 400 caracteres.");
  const result=await ctx.db.query(
   `UPDATE pos_training_sales SET "Status"='CANCELLED',"CancelledAtUtc"=now(),
       "CancelledByUserId"=$4::uuid,"CancellationReason"=$5
     WHERE "Id"=$3::uuid AND "TenantId"=$1::uuid AND "BranchId"=$2::uuid
       AND "Status"='SIMULATED'
     RETURNING "Id"::text AS id,"TrainingNumber" AS number,"Status" AS status`,
   [ctx.tenantId,ctx.branchId,id,ctx.userId,reason]
  );
  if(!result.length)throw new FleetError(409,"SIMULATION_NOT_ACTIVE",
   "Simulação inexistente nesta filial ou já cancelada.");
  return NextResponse.json({simulation:result[0],
   message:"A simulação foi cancelada. Nenhuma operação de caixa, estoque ou banco foi revertida porque nenhuma foi criada."},
   {headers});
 }catch(e){
  if(e instanceof FleetError)return NextResponse.json({code:e.code,error:e.message},{status:e.status,headers});
  return NextResponse.json({code:"TRAINING_CANCEL_UNAVAILABLE",error:"Não foi possível cancelar a simulação."},{status:503,headers});
 }
}
