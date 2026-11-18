import crypto from "node:crypto";
import {NextRequest,NextResponse} from "next/server";
import {authorizeFleet,guardOrigin,FleetError,uuid} from "@/lib/fleet-session";

export type LoyaltySession=Awaited<ReturnType<typeof authorizeFleet>>;
export const LOYALTY_VIEW="loyalty.view";
export const LOYALTY_MANAGE="loyalty.manage";
export const LOYALTY_REDEEM="loyalty.redeem";
export const LOYALTY_FULFILL="loyalty.fulfill";

const publicFailures:Record<string,string>={
 LOYALTY_IDEMPOTENCY_MISMATCH:"A solicitação de resgate já foi utilizada com outros dados.",
 LOYALTY_ACCOUNT_MISSING:"O cliente ainda não tem pontos creditados.",
 LOYALTY_CUSTOMER_INACTIVE:"Cliente inativo. Resgate não permitido.",
 LOYALTY_PARTIAL_RETURN_RECONCILIATION_PENDING:"Cliente com devolução parcial pendente de conciliação. Resgate temporariamente bloqueado.",
 LOYALTY_REWARD_UNAVAILABLE:"Recompensa indisponível ou fora do período de validade.",
 LOYALTY_VOUCHER_REQUIRES_CHECKOUT_GATE:"Vales e descontos dependem da homologação do checkout para aplicação no PDV. Nenhum ponto foi debitado.",
 LOYALTY_PROGRAM_DISABLED:"Programa de fidelidade desativado.",
 LOYALTY_INSUFFICIENT_POINTS:"Saldo de pontos insuficiente.",
 LOYALTY_REWARD_OUT_OF_STOCK:"Recompensa sem estoque promocional disponível.",
 LOYALTY_REDEMPTION_NOT_FOUND:"Resgate inexistente nesta filial.",
 LOYALTY_REDEMPTION_ALREADY_FINAL:"Resgate já finalizado, utilizado ou cancelado.",
 LOYALTY_FULFILLMENT_EVIDENCE_REQUIRED:"Informe o comprovante ou observação de entrega.",
 LOYALTY_INVALID_ACTION:"Operação de resgate inválida."
};
export function respond(body:unknown,cid:string,status=200){
 return NextResponse.json(body,{status,headers:{"Cache-Control":"no-store","X-Correlation-Id":cid}});
}
export async function loyaltyHandler(request:NextRequest,key:string,action:(s:LoyaltySession,cid:string)=>Promise<NextResponse>,mutation=false){
 const cid=request.headers.get("x-correlation-id")||crypto.randomUUID();
 try{
  if(mutation)guardOrigin(request);
  const ctx=await authorizeFleet(request,key);
  return await action(ctx,cid);
 }catch(err){
  if(err instanceof FleetError)return respond({code:err.code,error:err.message},cid,err.status);
  const ex=err as {code?:string;message?:string;name?:string};
  if(ex.code==="23505")return respond({code:"LOYALTY_DUPLICATE",error:"Cadastro ou solicitação duplicada. Atualize a tela para conferir."},cid,409);
  if(ex.code==="23503"||ex.code==="23514")return respond({code:"LOYALTY_INTEGRITY_CONFLICT",error:"Dados inválidos ou conflito de integridade."},cid,409);
  const marker=Object.keys(publicFailures).find(k=>ex.message?.includes(k));
  if(marker)return respond({code:marker,error:publicFailures[marker]},cid,409);
  console.error("[LOYALTY]["+cid+"] "+(ex.name||"DatabaseError")+" ("+(ex.code||"unknown")+")");
  return respond({code:"LOYALTY_UNAVAILABLE",error:"Não foi possível concluir a operação no Neon. Nenhuma alteração foi confirmada."},cid,503);
 }
}
export async function requestJson(request:NextRequest){
 const length=Number(request.headers.get("content-length")||0);
 if(length>15000)throw new FleetError(413,"PAYLOAD_TOO_LARGE","Solicitação muito grande.");
 const body:unknown=await request.json().catch(()=>null);
 if(!body||Array.isArray(body)||typeof body!=="object")throw new FleetError(400,"INVALID_JSON","Preencha os dados do formulário.");
 return body as Record<string,unknown>;
}
export function requiredString(value:unknown,label:string,max=160):string{
 if(typeof value!=="string"||!value.trim()||value.trim().length>max)throw new FleetError(400,"VALIDATION_ERROR",label+" obrigatório (máx. "+max+" caracteres).");
 return value.trim();
}
export function optionalString(value:unknown,max=1000):string|null{
 if(value==null||value==="")return null;
 if(typeof value!=="string"||value.length>max)throw new FleetError(400,"VALIDATION_ERROR","Campo de texto inválido.");
 return value.trim()||null;
}
export function intValue(value:unknown,label:string,min:number,max:number):number{
 const v=Number(value);
 if(value==null||value===""||!Number.isSafeInteger(v)||v<min||v>max)throw new FleetError(400,"VALIDATION_ERROR",label+" deve estar entre "+min+" e "+max+".");
 return v;
}
export function optionalDate(value:unknown,label:string):string|null{
 if(value==null||value==="")return null;
 if(typeof value!=="string"||!Number.isFinite(Date.parse(value)))throw new FleetError(400,"INVALID_DATE",label+" inválida.");
 return new Date(value).toISOString();
}
export const uuidField=(v:unknown,label:string)=>uuid(v,label);
export const boolField=(v:unknown,label:string)=>{
 if(typeof v!=="boolean")throw new FleetError(400,"VALIDATION_ERROR",label+" deve ser verdadeiro ou falso.");
 return v;
};
export function calculateTier(earned:number,p?:{silverAtPoints:number;goldAtPoints:number;diamondAtPoints:number}){
 if(!p)return "Bronze";
 if(earned>=p.diamondAtPoints)return "Diamante";
 if(earned>=p.goldAtPoints)return "Ouro";
 if(earned>=p.silverAtPoints)return "Prata";
 return "Bronze";
}
export async function checkParty(s:LoyaltySession,id:string){
 const rows=await s.db.query('SELECT "Id"::text AS id,"Name" AS name,"IsActive" AS "isActive","Type" AS type FROM parties WHERE "TenantId"=$1::uuid AND "Id"=$2::uuid LIMIT 1',[s.tenantId,id]);
 if(!rows.length)throw new FleetError(404,"CUSTOMER_NOT_FOUND","Cliente não encontrado nesta empresa.");
 return rows[0];
}
