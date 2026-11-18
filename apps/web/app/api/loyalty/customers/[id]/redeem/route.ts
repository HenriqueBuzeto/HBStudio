import {NextRequest} from "next/server";
import {loyaltyHandler,LOYALTY_REDEEM,respond,requestJson,uuidField,checkParty} from "@/lib/loyalty-server";

export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
 return loyaltyHandler(request,LOYALTY_REDEEM,async(s,cid)=>{
  const partyId=uuidField((await params).id,"Cliente"),body=await requestJson(request);
  const reward=uuidField(body.rewardId,"Recompensa"),requestKey=uuidField(body.requestKey,"Identificador idempotente");
  await checkParty(s,partyId);
  const rows=await s.db.query('SELECT * FROM loyalty_redeem_reward($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,$6::uuid,$7::text,$8::text)',
   [s.tenantId,s.branchId,partyId,reward,requestKey,s.userId,s.email,cid]);
  return respond({id:rows[0].RedemptionId,code:rows[0].Code,pointsBalance:rows[0].PointsBalance,status:"RESERVED",
   message:"Resgate reservado e pontos debitados. A entrega exige confirmação manual e auditoria; nenhum estoque físico do ERP foi movimentado."},cid,201);
 },true);
}
