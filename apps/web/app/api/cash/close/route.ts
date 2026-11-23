import {NextRequest,NextResponse} from "next/server";
import crypto from "crypto";
import {authorizeFleet,guardOrigin,FleetError,uuid} from "@/lib/fleet-session";

const headers=(cid:string)=>({"Cache-Control":"no-store","X-Correlation-Id":cid});
export async function POST(request:NextRequest){
 const cid=request.headers.get("x-correlation-id")||crypto.randomUUID();
 try {
  guardOrigin(request);
  const ctx=await authorizeFleet(request,"cash.close");
  const body=await request.json();
  if(!body||typeof body!=="object"||Array.isArray(body))
   throw new FleetError(422,"VALIDATION_ERROR","Dados inválidos.");
  const shiftId=uuid(body.shiftId,"Turno"),requestKey=uuid(body.requestKey,"Chave de solicitação");
  const valid=(v:unknown)=>v!==null&&v!==undefined&&v!==""&&Number.isFinite(Number(v))&&
   Number(v)>=0&&Number(v)<=1000000&&Math.abs(Number(v)*100-Math.round(Number(v)*100))<0.000001;
  if(!valid(body.countedAmount)||!valid(body.expectedBalance))
    throw new FleetError(422,"INVALID_CASH_AMOUNT","Informe valores válidos em reais e centavos.");
  if(body.notes!=null&&(typeof body.notes!=="string"||body.notes.length>500))
    throw new FleetError(422,"INVALID_NOTES","Observação muito longa.");
  const result=await ctx.db.query(
   'SELECT * FROM cash_enterprise_close_shift($1::uuid,$2::uuid,$3::uuid,$4::text,$5::uuid,$6::numeric,$7::numeric,$8::text,$9::uuid,$10::text)',
   [ctx.tenantId,ctx.branchId,ctx.userId,ctx.email,shiftId,
    Number(body.countedAmount),Number(body.expectedBalance),body.notes||null,requestKey,cid]
  );
  return NextResponse.json({shiftId:result[0].shiftId,closedAtUtc:result[0].closedAtUtc,
   message:"Turno encerrado com conferência exata e evento de auditoria."},
   {status:200,headers:headers(cid)});
 } catch(e) {
  if(e instanceof FleetError)
   return NextResponse.json({code:e.code,error:e.message},{status:e.status,headers:headers(cid)});
  const msg=e instanceof Error?e.message:"";
  const code=msg.match(/CASH_[A-Z_]+/)?.[0];
  if(code) {
   const conflict=code.includes("CONFLICT");
   const diff=code==="CASH_COUNT_DISCREPANCY_REQUIRES_APPROVAL";
   return NextResponse.json({code,error:diff?
    "A contagem diverge do saldo registrado. O fechamento exige conferência e aprovação de diferença. Nenhum turno foi encerrado.":
    conflict?"O saldo ou a solicitação mudou. Atualize antes de continuar.":
    "Fechamento recusado por regra de integridade de caixa."},
    {status:conflict?409:422,headers:headers(cid)});
  }
  console.error("[Cash]["+cid+"] close failure:",e instanceof Error?e.name:"unknown");
  return NextResponse.json({code:"CASH_CLOSE_UNAVAILABLE",error:"Fechamento indisponível."},
   {status:503,headers:headers(cid)});
 }
}
