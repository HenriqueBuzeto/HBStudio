import {NextRequest,NextResponse} from "next/server";
import crypto from "node:crypto";
import {authorizeFleet,guardOrigin,FleetError} from "@/lib/fleet-session";

/**
 * P0 containment for the legacy .NET forwarder. The production Vercel project
 * does not host the .NET tax engine and the historical adapter fabricated
 * authorization, cancellation and status protocols. No fiscal mutation may
 * fall through to API_INTERNAL_URL or to a raw SQL status update.
 */
type Context={params:Promise<{path:string[]}>};
async function block(request:NextRequest,context:Context){
 const correlationId=request.headers.get("x-correlation-id")||crypto.randomUUID();
 try{
  const path=(await context.params).path||[];
  if(request.method!=="GET")guardOrigin(request);
  const action=path.some(x=>/cancel|inutil|event/i.test(x))?"fiscal.cancel":
               request.method==="GET"?"fiscal.documents.view":"fiscal.issue";
  await authorizeFleet(request,action);
  return NextResponse.json({
   code:"FISCAL_SEFAZ_NOT_HOMOLOGATED",
   error:"Operação fiscal bloqueada: assinatura, transporte, resposta oficial SEFAZ e conciliação ainda não foram homologados. Nenhum documento foi emitido ou cancelado.",
   fiscalReady:false,
   sefazAuthorized:false
  },{status:503,headers:{"X-Correlation-Id":correlationId,"Cache-Control":"no-store"}});
 }catch(e){
  if(e instanceof FleetError)return NextResponse.json({code:e.code,error:e.message},{status:e.status,headers:{"X-Correlation-Id":correlationId}});
  console.error("[FISCAL]["+correlationId+"] Legacy fiscal route:",e instanceof Error?e.name:"Unknown");
  return NextResponse.json({code:"FISCAL_UNAVAILABLE",error:"Operação fiscal indisponível por segurança."},{status:503,headers:{"X-Correlation-Id":correlationId}});
 }
}
export async function GET(r:NextRequest,c:Context){return block(r,c);}
export async function POST(r:NextRequest,c:Context){return block(r,c);}
export async function PUT(r:NextRequest,c:Context){return block(r,c);}
export async function PATCH(r:NextRequest,c:Context){return block(r,c);}
export async function DELETE(r:NextRequest,c:Context){return block(r,c);}
