import {NextRequest} from "next/server";
import {FleetError} from "@/lib/fleet-session";
import {loyaltyHandler,LOYALTY_FULFILL,respond,requestJson,uuidField,requiredString,optionalString} from "@/lib/loyalty-server";

export async function PATCH(request:NextRequest,{params}:{params:Promise<{id:string}>}){
 return loyaltyHandler(request,LOYALTY_FULFILL,async(s,cid)=>{
  const id=uuidField((await params).id,"Resgate"),body=await requestJson(request);
  const action=requiredString(body.action,"Ação",16);
  if(!["FULFILL","CANCEL"].includes(action))throw new FleetError(400,"INVALID_REDEMPTION_ACTION","Escolha entregar ou cancelar.");
  const notes=action==="FULFILL"?requiredString(body.notes,"Comprovante de entrega",600):optionalString(body.notes,600)||"Resgate cancelado antes da entrega";
  if(action==="FULFILL"&&notes.length<10)throw new FleetError(400,"EVIDENCE_REQUIRED","Registre no mínimo 10 caracteres sobre a entrega.");
  const rows=await s.db.query('SELECT * FROM loyalty_finish_redemption($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::text,$6::text,$7::text,$8::text)',
   [s.tenantId,s.branchId,id,s.userId,s.email,cid,action,notes]);
  return respond({status:rows[0].Status,pointsBalance:rows[0].PointsBalance,
   message:action==="FULFILL"?"Entrega confirmada com auditoria.":"Resgate cancelado: pontos e estoque promocional devolvidos."},cid);
 },true);
}
