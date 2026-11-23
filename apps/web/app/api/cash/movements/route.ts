import {NextRequest,NextResponse} from "next/server";
import crypto from "crypto";
import {authorizeFleet,guardOrigin,FleetError,uuid} from "@/lib/fleet-session";

function respond(error:unknown,cid:string) {
 const headers={"Cache-Control":"no-store","X-Correlation-Id":cid};
 if(error instanceof FleetError)
  return NextResponse.json({code:error.code,error:error.message},{status:error.status,headers});
 const raw=error instanceof Error?error.message:"";
 const code=raw.match(/CASH_[A-Z_]+/)?.[0];
 if(code){
  const conflict=code.includes("CONFLICT")||code.includes("IDEMPOTENCY");
  return NextResponse.json({code,error:conflict?
   "O saldo ou a solicitação foi alterado. Atualize o caixa antes de repetir.":"A movimentação não atende às regras do turno."},
   {status:conflict?409:422,headers});
 }
 console.error("[Cash]["+cid+"] movement failure:",error instanceof Error?error.name:"unknown");
 return NextResponse.json({code:"CASH_MOVEMENT_UNAVAILABLE",error:"Movimentação não concluída."},{status:503,headers});
}

export async function POST(request:NextRequest){
 const cid=request.headers.get("x-correlation-id")||crypto.randomUUID();
 try{
  guardOrigin(request);
  const body=await request.json();
  if(!body||typeof body!=="object"||Array.isArray(body))
   throw new FleetError(422,"VALIDATION_ERROR","Dados inválidos.");
  if(body.type!=="SUPPLY"&&body.type!=="WITHDRAWAL")
   throw new FleetError(422,"VALIDATION_ERROR","Tipo de movimento inválido.");
  const permission=body.type==="SUPPLY"?"cash.supply":"cash.withdraw";
  const ctx=await authorizeFleet(request,permission);
  const shiftId=uuid(body.shiftId,"Turno");
  const requestKey=uuid(body.requestKey,"Chave da solicitação");
  const amount=Number(body.amount),expectedBalance=Number(body.expectedBalance);
  if(body.amount==null||body.amount===""||!Number.isFinite(amount)||amount<=0||amount>1000000||
    Math.abs(amount*100-Math.round(amount*100))>0.000001)
   throw new FleetError(422,"INVALID_AMOUNT","Valor de movimentação inválido.");
  if(body.expectedBalance==null||body.expectedBalance===""||!Number.isFinite(expectedBalance)||expectedBalance<0||
    Math.abs(expectedBalance*100-Math.round(expectedBalance*100))>0.000001)
   throw new FleetError(422,"INVALID_BALANCE","Atualize o turno antes da movimentação.");
  if(typeof body.reason!=="string"||body.reason.trim().length<5||body.reason.length>500)
   throw new FleetError(422,"INVALID_REASON","Justificativa obrigatória com ao menos 5 caracteres.");
  const rows=await ctx.db.query(
    'SELECT * FROM cash_enterprise_move($1::uuid,$2::uuid,$3::uuid,$4::text,$5::uuid,$6::text,$7::numeric,$8::text,$9::uuid,$10::text,$11::numeric)',
    [ctx.tenantId,ctx.branchId,ctx.userId,ctx.email,shiftId,body.type,amount,body.reason.trim(),
     requestKey,cid,expectedBalance]
  );
  return NextResponse.json({id:rows[0].movementId,balanceAfter:Number(rows[0].balanceAfter),
    message:body.type==="SUPPLY"?"Suprimento registrado.":"Sangria registrada."},
    {status:201,headers:{"Cache-Control":"no-store","X-Correlation-Id":cid}});
 }catch(e){return respond(e,cid);}
}
