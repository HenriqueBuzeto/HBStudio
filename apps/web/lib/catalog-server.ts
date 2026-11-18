import crypto from "node:crypto";
import {NextRequest,NextResponse} from "next/server";
import {authorizeFleet,FleetError,guardOrigin,uuid} from "@/lib/fleet-session";

export type CatalogContext=Awaited<ReturnType<typeof authorizeFleet>>;
export const READ_PERMISSION="catalog.products.view";
export const MANAGE_PERMISSION="catalog.products.manage";
export const COST_PERMISSION="catalog.cost.view";

export const jsonHeaders=(cid:string)=>({"X-Correlation-Id":cid,"Cache-Control":"no-store"});
export function response(value:unknown,cid:string,status=200){
 return NextResponse.json(value,{status,headers:jsonHeaders(cid)});
}
export async function catalogHandler(
 request:NextRequest,
 permission:string,
 fn:(ctx:CatalogContext,cid:string)=>Promise<NextResponse>,
 mutation=false
):Promise<NextResponse>{
 const cid=request.headers.get("x-correlation-id")||crypto.randomUUID();
 try{
  if(mutation)guardOrigin(request);
  const ctx=await authorizeFleet(request,permission);
  return await fn(ctx,cid);
 }catch(e){
  if(e instanceof FleetError)return response({error:e.message,code:e.code},cid,e.status);
  const err=e as {code?:string;constraint?:string;name?:string};
  if(err?.code==="23505")return response({code:"CATALOG_DUPLICATE",error:"Esse código, identificador ou nome já está cadastrado. Atualize e confira o registro existente."},cid,409);
  if(err?.code==="23503"||err?.code==="23514")return response({code:"CATALOG_REFERENCE_CONFLICT",error:"Registro relacionado inválido ou regra de integridade violada."},cid,409);
  console.error("[CATALOG]["+cid+"] "+(err?.name||"Unknown")+" "+(err?.code||"SERVER_ERROR"));
  return response({code:"CATALOG_DATABASE_UNAVAILABLE",error:"Não foi possível consultar ou gravar no Neon. Nenhum cadastro foi confirmado. Tente novamente."},cid,503);
 }
}
export function textField(value:unknown,label:string,max=160):string{
 if(typeof value!=="string"||!value.trim()||value.trim().length>max)
  throw new FleetError(400,"VALIDATION_ERROR",label+" obrigatório ou inválido.");
 return value.trim();
}
export function optionalText(value:unknown,max=1000):string|null{
 if(value==null||value==="")return null;
 if(typeof value!=="string"||value.length>max)throw new FleetError(400,"VALIDATION_ERROR","Texto com tamanho inválido.");
 return value.trim()||null;
}
export function optionalUuid(value:unknown,label:string):string|null{
 return value==null||value===""?null:uuid(value,label);
}
export function numberField(value:unknown,label:string,allowed:number[]):number{
 const n=Number(value);
 if(!Number.isInteger(n)||!allowed.includes(n))throw new FleetError(400,"VALIDATION_ERROR",label+" inválido.");
 return n;
}
export function positivePrice(value:unknown,label="Preço",canBeZero=true):number{
 const n=typeof value==="number"?value:Number(value);
 if(value==null||value===""||!Number.isFinite(n)||n<0||(!canBeZero&&n===0)||n>100_000_000||!Number.isSafeInteger(Math.round(n*100))||Math.abs(n*100-Math.round(n*100))>0.00001)
  throw new FleetError(400,"VALIDATION_ERROR",label+" deve ser um valor em reais com no máximo duas casas decimais.");
 return n;
}
export function expectedVersion(value:unknown):number{
 const n=Number(value);
 if(!Number.isSafeInteger(n)||n<=0||n>4294967295)throw new FleetError(400,"VALIDATION_ERROR","Versão do registro inválida. Recarregue a tela.");
 return n;
}
export async function readBody(request:NextRequest,maxBytes=16000):Promise<Record<string,unknown>>{
 const len=Number(request.headers.get("content-length")||0);
 if(len>maxBytes)throw new FleetError(413,"PAYLOAD_TOO_LARGE","Cadastro excede o limite permitido.");
 const parsed:unknown=await request.json().catch(()=>null);
 if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))throw new FleetError(400,"INVALID_JSON","Dados do cadastro inválidos.");
 return parsed as Record<string,unknown>;
}
export function normalizeIdentifier(value:unknown,label:string,type:"imei"|"serial"):string|null{
 const raw=optionalText(value,80);
 if(!raw)return null;
 const norm=raw.replace(/[\s-]/g,"").toUpperCase();
 if(type==="imei"&&!/^\d{15}$/.test(norm))throw new FleetError(400,"INVALID_IMEI",label+" deve conter 15 dígitos.");
 if(type==="serial"&&(!/^[A-Z0-9._/]{3,70}$/.test(norm)))throw new FleetError(400,"INVALID_SERIAL",label+" deve conter de 3 a 70 caracteres válidos.");
 return norm;
}
export async function getModelById(ctx:CatalogContext,id:string){
 const rows=await ctx.db.query(
  'SELECT m."Id"::text AS id,m."Name" AS name,m."Description" AS description,m."Kind" AS kind,m."SerializationPolicy" AS "serializationPolicy",m."BrandId"::text AS "brandId",b."Name" AS "brandName",m."CategoryId"::text AS "categoryId",c."Name" AS "categoryName",m."IsActive" AS "isActive",m."CreatedAtUtc" AS "createdAtUtc",m.xmin::text::bigint AS version,'+
  'COALESCE((SELECT jsonb_agg(jsonb_build_object(\'id\',s."Id",\'productModelId\',s."ProductModelId",\'skuCode\',s."SkuCode",\'variantName\',s."VariantName",\'barcodeEan\',s."BarcodeEan",\'defaultPrice\',s."DefaultPrice",\'isActive\',s."IsActive",\'version\',s.xmin::text::bigint,\'availableUnitsCount\',(SELECT count(*)::int FROM inventory_units i WHERE i."TenantId"=s."TenantId" AND i."ProductSkuId"=s."Id" AND i."OperationalStatus"=3)) ORDER BY s."CreatedAtUtc" ASC) FROM product_skus s WHERE s."TenantId"=m."TenantId" AND s."ProductModelId"=m."Id"),\'[]\'::jsonb) AS skus '+
  'FROM product_models m JOIN product_brands b ON b."Id"=m."BrandId" AND b."TenantId"=m."TenantId" JOIN product_categories c ON c."Id"=m."CategoryId" AND c."TenantId"=m."TenantId" WHERE m."TenantId"=$1::uuid AND m."Id"=$2::uuid LIMIT 1',
  [ctx.tenantId,id]);
 return rows[0]??null;
}
export async function getUnitById(ctx:CatalogContext,id:string){
 const withCost=ctx.permissions.has(COST_PERMISSION);
 const rows=await ctx.db.query(
  'SELECT u."Id"::text AS id,u."ProductSkuId"::text AS "productSkuId",s."SkuCode" AS "skuCode",m."Name" AS "modelName",u."SerialNumber" AS "serialNumber",u."Imei1" AS imei1,u."Imei2" AS imei2,u."Condition" AS condition,u."Grade" AS grade,u."BatteryHealthPercentage" AS "batteryHealthPercentage",CASE WHEN $3::boolean THEN u."AcquisitionCost"::float8 ELSE NULL END AS "acquisitionCost",u."SupplierPartyId"::text AS "supplierPartyId",u."OperationalStatus" AS "operationalStatus",u."InspectionNotes" AS "inspectionNotes",u."AcquisitionDateUtc" AS "acquisitionDateUtc",u.xmin::text::bigint AS version FROM inventory_units u JOIN product_skus s ON s."Id"=u."ProductSkuId" AND s."TenantId"=u."TenantId" JOIN product_models m ON m."Id"=s."ProductModelId" AND m."TenantId"=u."TenantId" WHERE u."TenantId"=$1::uuid AND u."Id"=$2::uuid LIMIT 1',
  [ctx.tenantId,id,withCost]
 );
 return rows[0]??null;
}
