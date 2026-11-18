import crypto from "node:crypto";
import {NextRequest,NextResponse} from "next/server";
import {authorizeFleet,FleetError,guardOrigin,uuid} from "@/lib/fleet-session";

export type LoyaltySession=Awaited<ReturnType<typeof authorizeFleet>>;
export const PERMS={view:"loyalty.view",manage:"loyalty.manage",redeem:"loyalty.redeem"} as const;
export function result(body:unknown,cid:string,status=200){
 return NextResponse.json(body,{status,headers:{"X-Correlation-Id":cid,"Cache-Control":"no-store"}});
}
export async function loyaltyRoute(req:NextRequest,permission:string,
 task:(ctx:LoyaltySession,cid:string)=>Promise<NextResponse>,mutation=false){
 const cid=req.headers.get("x-correlation-id")||crypto.randomUUID();
 try{
  if(mutation)guardOrigin(req);
  const ctx=await authorizeFleet(req,permission);
  return await task(ctx,cid);
 }catch(e){
  if(e instanceof FleetError)return result({code:e.code,error:e.message},cid,e.status);
  const db=e as {code?:string;name?:string};
  if(db.code==="23505")return result({code:"LOYALTY_CONFLICT",error:"Já existe registro semelhante ou chave de requisição reutilizada."},cid,409);
  if(db.code==="23514"||db.code==="22023"||db.code==="23503"||db.code==="23502")
   return result({code:"LOYALTY_RULE_VIOLATION",error:"Operação não concluída: saldo insuficiente, estoque indisponível, registro inválido ou resgate já processado."},cid,409);
  console.error("[LOYALTY]["+cid+"] "+(db.name||"DatabaseError")+" code="+(db.code||"UNKNOWN"));
  return result({code:"LOYALTY_UNAVAILABLE",error:"Módulo de fidelidade indisponível no Neon. Nenhuma operação foi confirmada."},cid,503);
 }
}
export async function body(req:NextRequest):Promise<Record<string,unknown>>{
 if(Number(req.headers.get("content-length")||0)>12000)throw new FleetError(413,"PAYLOAD_TOO_LARGE","Requisição excede limite.");
 const data:unknown=await req.json().catch(()=>null);
 if(!data||typeof data!=="object"||Array.isArray(data))throw new FleetError(400,"INVALID_JSON","Dados inválidos.");
 return data as Record<string,unknown>;
}
export function required(v:unknown,label:string,max=140){
 if(typeof v!=="string"||!v.trim()||v.trim().length>max)throw new FleetError(400,"VALIDATION_ERROR",label+" obrigatório ou inválido.");
 return v.trim();
}
export function optional(v:unknown,max=600):string|null{
 if(v===null||v===undefined||v==="")return null;
 if(typeof v!=="string"||v.trim().length>max)throw new FleetError(400,"VALIDATION_ERROR","Texto inválido.");
 return v.trim()||null;
}
export function integer(v:unknown,label:string,min=0,max=2147483647):number{
 if(typeof v!=="number"||!Number.isSafeInteger(v)||v<min||v>max)
  throw new FleetError(400,"VALIDATION_ERROR",label+" inválido.");
 return v;
}
export function rewardKind(v:unknown):"GIFT"|"DISCOUNT_FIXED"|"DISCOUNT_PERCENT"{
 if(v!=="GIFT"&&v!=="DISCOUNT_FIXED"&&v!=="DISCOUNT_PERCENT")
  throw new FleetError(400,"INVALID_REWARD_TYPE","Tipo de benefício inválido.");
 return v;
}
export async function assertCustomer(ctx:LoyaltySession,partyId:string){
 const rows=await ctx.db.query('SELECT "Id" FROM parties WHERE "TenantId"=$1::uuid AND "Id"=$2::uuid AND "IsActive"=true LIMIT 1',[ctx.tenantId,uuid(partyId,"Cliente")]);
 if(!rows.length)throw new FleetError(404,"CUSTOMER_NOT_FOUND","Cliente inexistente ou inativo nesta empresa.");
}
