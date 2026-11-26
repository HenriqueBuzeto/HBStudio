import {NextRequest,NextResponse} from "next/server";
import crypto from "node:crypto";
import {authorizeFleet,guardOrigin,FleetError,uuid} from "@/lib/fleet-session";
export async function POST(request:NextRequest){
 const cid=crypto.randomUUID(),headers={"Cache-Control":"no-store","X-Correlation-Id":cid};
 try{
  guardOrigin(request);const ctx=await authorizeFleet(request,"cash.register.manage");
  if(!ctx.permissions.has("cash.shift.view"))throw new FleetError(403,"FORBIDDEN","Permissão de consulta de caixa necessária.");
  const raw=await request.text();if(raw.length>5000)throw new FleetError(413,"SIZE_LIMIT","Cadastro muito extenso.");
  let body:any;try{body=JSON.parse(raw);}catch{throw new FleetError(422,"INVALID_BODY","Dados inválidos.");}
  if(typeof body?.code!=="string"||typeof body?.name!=="string"||(body.notes!==undefined&&typeof body.notes!=="string"))throw new FleetError(422,"INVALID_BODY","Informe código e nome do caixa.");
  const [row]=await ctx.db.query("SELECT public.cash_register_create_v8($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::jsonb) result",[ctx.tenantId,ctx.branchId,ctx.userId,uuid(body.requestKey,"Solicitação"),JSON.stringify({code:body.code,name:body.name,notes:body.notes||""})]);
  return NextResponse.json(row.result,{status:201,headers});
 }catch(e){if(e instanceof FleetError)return NextResponse.json({code:e.code,error:e.message},{status:e.status,headers});const code=(e as {code?:string})?.code;
 if(code==="42501")return NextResponse.json({error:"Sem permissão para cadastrar caixa."},{status:403,headers});
 if(code==="23505"||code==="23514")return NextResponse.json({error:"Código de caixa já utilizado ou solicitação conflitante."},{status:409,headers});
 if(code==="22023")return NextResponse.json({error:"Revise código, nome e observações."},{status:422,headers});
 console.error("[CashRegister]["+cid+"]",code||"UNKNOWN");return NextResponse.json({error:"Cadastro não confirmado. Referência: "+cid},{status:503,headers});
 }
}
