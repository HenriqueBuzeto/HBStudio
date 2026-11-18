import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { authorizeFleet, guardOrigin, FleetError, uuid, string } from "@/lib/fleet-session";

export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
 const cid=request.headers.get("x-correlation-id")||crypto.randomUUID();
 try{
  guardOrigin(request);
  const ctx=await authorizeFleet(request,"sales.cancel");
  const id=uuid((await params).id,"Venda");
  const b=await request.json().catch(()=>null);
  const reason=string(b?.justification,"Justificativa",500);
  if(reason.length<10)throw new FleetError(400,"VALIDATION_ERROR","Informe uma justificativa com pelo menos 10 caracteres.");
  const rows=await ctx.db.query('SELECT s."Id",s."Status",d."Id" AS "FiscalId",d."Status" AS "FiscalStatus" FROM sales s LEFT JOIN fiscal_documents d ON d."SaleId"=s."Id" AND d."TenantId"=s."TenantId" WHERE s."Id"=$1::uuid AND s."TenantId"=$2::uuid AND s."BranchId"=$3::uuid LIMIT 1',[id,ctx.tenantId,ctx.branchId]);
  if(!rows.length)throw new FleetError(404,"NOT_FOUND","Venda não encontrada nesta empresa/filial.");
  if(rows[0].FiscalId)return NextResponse.json({code:"FISCAL_CANCELLATION_REQUIRES_SEFAZ",error:"Cancelamento fiscal exige evento oficial assinado, transmissão à SEFAZ, protocolo e conciliação. Nenhum documento foi cancelado."},{status:409,headers:{"X-Correlation-Id":cid}});
  return NextResponse.json({code:"SALE_REVERSAL_NOT_HOMOLOGATED",error:"Cancelamento ainda exige estorno financeiro, liberação de estoque e trilha auditável. Nenhuma venda foi alterada."},{status:409,headers:{"X-Correlation-Id":cid}});
 }catch(error){
  if(error instanceof FleetError)return NextResponse.json({code:error.code,error:error.message},{status:error.status,headers:{"X-Correlation-Id":cid}});
  console.error("[PDV]["+cid+"] Sale cancellation failed:",error instanceof Error?error.name:"Unknown");
  return NextResponse.json({code:"CANCELLATION_UNAVAILABLE",error:"Cancelamento indisponível. Nenhuma alteração fiscal confirmada."},{status:503,headers:{"X-Correlation-Id":cid}});
 }
}
