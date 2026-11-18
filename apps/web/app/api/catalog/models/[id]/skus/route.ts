import {NextRequest} from "next/server";
import crypto from "node:crypto";
import {FleetError,uuid} from "@/lib/fleet-session";
import {catalogHandler,MANAGE_PERMISSION,readBody,textField,optionalText,positivePrice,response} from "@/lib/catalog-server";

export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
 return catalogHandler(request,MANAGE_PERMISSION,async(ctx,cid)=>{
  const modelId=uuid((await params).id,"Modelo");
  const b=await readBody(request),id=crypto.randomUUID();
  const code=textField(b.skuCode,"Código SKU",80).toUpperCase();
  const variant=textField(b.variantName,"Variação",160);
  const price=positivePrice(b.defaultPrice),barcode=optionalText(b.barcodeEan,64),specs=optionalText(b.technicalSpecsJson,4000);
  if(specs){try{JSON.parse(specs);}catch{throw new FleetError(400,"INVALID_SPECS","Especificações devem ser JSON válido.");}}
  const rows=await ctx.db.query(
   'WITH inserted AS (INSERT INTO product_skus ("Id","TenantId","ProductModelId","SkuCode","VariantName","BarcodeEan","DefaultPrice","TechnicalSpecsJson","IsActive","CreatedAtUtc") SELECT $1::uuid,$2::uuid,$3::uuid,$4,$5,$6,$7::numeric,$8::jsonb,true,now() WHERE EXISTS(SELECT 1 FROM product_models m WHERE m."Id"=$3::uuid AND m."TenantId"=$2::uuid AND m."IsActive"=true) RETURNING "Id"),'+
   ' audited AS (INSERT INTO audit_events ("Id","TenantId","BranchId","EntityType","EntityId","Action","ActorId","ActorEmail","CorrelationId","AfterStateJson","CreatedAtUtc","Version") SELECT gen_random_uuid(),$2::uuid,$9::uuid,\'ProductSku\',i."Id"::text,\'Created\',$10::uuid,$11,$12,jsonb_build_object(\'modelId\',$3,\'skuCode\',$4,\'price\',$7),now(),1 FROM inserted i RETURNING "Id") SELECT i."Id"::text AS id FROM inserted i JOIN audited a ON true',
   [id,ctx.tenantId,modelId,code,variant,barcode,price,specs,ctx.branchId,ctx.userId,ctx.email,cid]
  );
  if(rows.length!==1)throw new FleetError(404,"MODEL_NOT_FOUND","Modelo inexistente ou inativo nesta empresa.");
  return response({id:rows[0].id,created:true},cid,201);
 },true);
}
