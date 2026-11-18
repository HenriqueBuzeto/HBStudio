import crypto from "node:crypto";
import {NextRequest} from "next/server";
import {FleetError,guardOrigin,authorizeFleet,uuid} from "@/lib/fleet-session";
import {respond,requestJson,requiredString,optionalString} from "@/lib/loyalty-server";

export async function customerMutation(request:NextRequest,rawId:string,fn:(ctx:Awaited<ReturnType<typeof authorizeFleet>>,partyId:string,cid:string)=>Promise<ReturnType<typeof respond>>){
 const cid=request.headers.get("x-correlation-id")||crypto.randomUUID();
 try{
  guardOrigin(request);
  const id=uuid(rawId,"Cliente");
  const ctx=await authorizeFleet(request,"customers.edit");
  const exists=await ctx.db.query('SELECT "Id" FROM parties WHERE "TenantId"=$1::uuid AND "Id"=$2::uuid LIMIT 1',[ctx.tenantId,id]);
  if(!exists.length)throw new FleetError(404,"CUSTOMER_NOT_FOUND","Cadastro não localizado nesta empresa.");
  return await fn(ctx,id,cid);
 }catch(err){
  if(err instanceof FleetError)return respond({error:err.message,code:err.code},cid,err.status);
  const ex=err as {code?:string;name?:string};
  if(ex.code==="23505")return respond({error:"Registro duplicado. Atualize a ficha.",code:"DUPLICATE"},cid,409);
  if(ex.code==="23503"||ex.code==="23514")return respond({error:"Vínculo inválido.",code:"REFERENCE_CONFLICT"},cid,409);
  console.error("[PARTIES]["+cid+"] "+(ex.name||"SERVER_ERROR")+" ("+(ex.code||"unknown")+")");
  return respond({error:"Não foi possível confirmar o registro no Neon.",code:"PARTIES_UNAVAILABLE"},cid,503);
 }
}
export {requestJson,requiredString,optionalString,respond};
