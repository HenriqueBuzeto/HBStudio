import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { authorizeFleet, guardOrigin, FleetError, uuid } from "@/lib/fleet-session";

const responseHeaders=(cid:string)=>({"X-Correlation-Id":cid,"Cache-Control":"no-store"});

function respondError(e:unknown,cid:string) {
  if(e instanceof FleetError)
    return NextResponse.json({code:e.code,error:e.message},{status:e.status,headers:responseHeaders(cid)});
  const message=e instanceof Error?e.message:"";
  if(message.includes("REPAIR_CONFLICT"))
    return NextResponse.json({code:"REPAIR_CONFLICT",error:"OS alterada por outro usuário. Recarregue antes de tentar novamente."},{status:409,headers:responseHeaders(cid)});
  if(message.includes("REPAIR_NOT_FOUND"))
    return NextResponse.json({code:"REPAIR_NOT_FOUND",error:"OS não encontrada nesta filial."},{status:404,headers:responseHeaders(cid)});
  if(/REPAIR_(INVALID_|DELIVERED_|FINALIZED_|DELIVERY_)/.test(message))
    return NextResponse.json({code:"REPAIR_VALIDATION_ERROR",error:"Transição de status ou itens não permitidos para esta OS."},{status:422,headers:responseHeaders(cid)});
  console.error("[Repairs]["+cid+"] update error:",e instanceof Error?e.name:"unknown");
  return NextResponse.json({code:"REPAIR_UPDATE_UNAVAILABLE",error:"Falha ao atualizar ordem de serviço."},{status:503,headers:responseHeaders(cid)});
}

export async function PUT(request:NextRequest,{params}:{params:Promise<{id:string}>}) {
  const cid=request.headers.get("x-correlation-id")||crypto.randomUUID();
  try {
    guardOrigin(request);
    const {id}=await params;
    uuid(id,"OS");
    const body=await request.json();
    if(!body||typeof body!=="object"||Array.isArray(body))
      throw new FleetError(422,"VALIDATION_ERROR","Dados inválidos.");
    const changingItems=Object.prototype.hasOwnProperty.call(body,"items");
    const changingStatus=Object.prototype.hasOwnProperty.call(body,"status");
    const newStatus=changingStatus ? Number(body.status) : null;
    const statusPermission=newStatus===12?"repairs.deliver":newStatus===10?"repairs.quality":"repairs.execute";
    const permission=changingItems?"repairs.quote":changingStatus?statusPermission:"repairs.diagnose";
    const ctx=await authorizeFleet(request,permission);
    if(changingItems&&changingStatus&&!ctx.permissions.has(statusPermission))
      throw new FleetError(403,"FORBIDDEN","Permissão "+statusPermission+" necessária.");
    const expectedStatus=Number(body.expectedStatus);
    if(!Number.isInteger(expectedStatus))
      throw new FleetError(422,"VALIDATION_ERROR","Status atual obrigatório.");
    const expectedUpdated=body.expectedUpdatedAtUtc;
    if(expectedUpdated!==null && (typeof expectedUpdated!=="string" || !Number.isFinite(Date.parse(expectedUpdated))))
      throw new FleetError(422,"VALIDATION_ERROR","Token de concorrência inválido.");
    if(!Object.prototype.hasOwnProperty.call(body,"expectedUpdatedAtUtc"))
      throw new FleetError(422,"VALIDATION_ERROR","Token de concorrência ausente.");
    const status=changingStatus?Number(body.status):null;
    if(status!==null&&!Number.isInteger(status))
      throw new FleetError(422,"VALIDATION_ERROR","Status inválido.");
    if(changingItems&&(!Array.isArray(body.items)||body.items.length>100))
      throw new FleetError(422,"VALIDATION_ERROR","Lista de itens inválida.");
    const items=changingItems?body.items.map((item:any)=>{
      if(!item||typeof item!=="object"||![1,2].includes(item.itemType))
        throw new FleetError(422,"VALIDATION_ERROR","Tipo de item inválido.");
      const quantity=Number(item.quantity),price=Number(item.unitPrice);
      if(typeof item.description!=="string"||!item.description.trim()||
        !Number.isFinite(quantity)||quantity<=0||quantity>10000||
        !Number.isFinite(price)||price<0||price>100000000||
        Math.abs(Math.round(price*100)-price*100)>0.000001)
        throw new FleetError(422,"VALIDATION_ERROR","Quantidade ou preço inválido.");
      return {itemType:item.itemType,description:item.description.trim(),quantity,
        unitPrice:price,productSkuId:item.productSkuId?uuid(item.productSkuId,"SKU"):null};
    }):null;
    const optionalText=(v:unknown,max:number)=> {
      if(v===undefined||v===null||v==="")return null;
      if(typeof v!=="string"||v.length>max)
        throw new FleetError(422,"VALIDATION_ERROR","Campo de texto inválido.");
      return v.trim()||null;
    };
    const rows=await ctx.db.query(
      'SELECT * FROM repair_enterprise_update($1::uuid,$2::uuid,$3::uuid,$4::text,$5::text,$6::uuid,$7::int,$8::timestamptz,$9::int,$10::text,$11::text,$12::text,$13::jsonb,$14::text,$15::text)',
      [ctx.tenantId,ctx.branchId,ctx.userId,ctx.email,cid,id,expectedStatus,expectedUpdated,
        status,optionalText(body.reportedDefect,2000),optionalText(body.diagnosticNotes,2000),
        optionalText(body.resolutionNotes,2000),items===null?null:JSON.stringify(items),
        optionalText(body.deliveredToPersonName,180),optionalText(body.deliveryNotes,1000)]
    );
    const result=rows[0];
    return NextResponse.json({message:"OS atualizada e registrada no histórico.",
      status:result.status,finalPrice:Number(result.finalPrice),
      updatedAtUtc:result.updatedAtUtc},{headers:responseHeaders(cid)});
  } catch(e){return respondError(e,cid);}
}
