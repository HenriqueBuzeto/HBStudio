import {NextRequest} from "next/server";
import {uuid,FleetError} from "@/lib/fleet-session";
import {loyaltyRoute,PERMS,result,body} from "@/lib/loyalty-server";

export async function PATCH(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 return loyaltyRoute(req,PERMS.manage,async(ctx,cid)=>{
  const redemptionId=uuid((await params).id,"Resgate");
  const d=await body(req);
  const action=d.action;
  if(action!=="CANCEL"&&action!=="FULFILL_GIFT")throw new FleetError(400,"INVALID_ACTION","Operação inválida.");
  if(action==="FULFILL_GIFT"){
   const confirmation=typeof d.deliveryConfirmation==="string"?d.deliveryConfirmation.trim():"";
   if(confirmation.length<10||confirmation.length>300)throw new FleetError(400,"DELIVERY_CONFIRMATION_REQUIRED","Informe evidência de entrega do brinde (mínimo 10 caracteres).");
  }
  const rows=await ctx.db.query(
   'WITH changed AS (SELECT loyalty_update_redemption($1::uuid,$2::uuid,$3::uuid,$4::text) AS status),'+
   ' audited AS (INSERT INTO audit_events("Id","TenantId","BranchId","EntityType","EntityId","Action","ActorId","ActorEmail","CorrelationId","AfterStateJson","CreatedAtUtc","Version") SELECT gen_random_uuid(),$1::uuid,$5::uuid,\'LoyaltyRedemption\',$2::text,c.status,$3::uuid,$6,$7,jsonb_build_object(\'action\',$4,\'deliveryEvidence\',$8),now(),1 FROM changed c RETURNING "Id") SELECT c.status FROM changed c CROSS JOIN audited',
   [ctx.tenantId,redemptionId,ctx.userId,action,ctx.branchId,ctx.email,cid,action==="FULFILL_GIFT"?String(d.deliveryConfirmation).trim():null]
  );
  return result({id:redemptionId,processed:true,action:rows[0].status,message:action==="CANCEL"?"Reserva cancelada e pontos integralmente restituídos.":"Entrega manual registrada em auditoria. Movimentação de estoque físico exige o módulo Kardex homologado."},cid);
 },true);
}
