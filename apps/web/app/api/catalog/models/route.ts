import {NextRequest} from "next/server";
import crypto from "node:crypto";
import {FleetError,uuid} from "@/lib/fleet-session";
import {catalogHandler,READ_PERMISSION,MANAGE_PERMISSION,readBody,textField,optionalText,numberField,positivePrice,response} from "@/lib/catalog-server";

export async function GET(request:NextRequest){
 return catalogHandler(request,READ_PERMISSION,async(ctx,cid)=>{
  const url=new URL(request.url);
  const search=(url.searchParams.get("search")||"").trim();
  if(search.length>120)throw new FleetError(400,"INVALID_FILTER","Filtro de busca inválido.");
  const categoryId=url.searchParams.get("categoryId");
  const brandId=url.searchParams.get("brandId");
  if(categoryId)uuid(categoryId,"Categoria");
  if(brandId)uuid(brandId,"Marca");
  const rows=await ctx.db.query(
   'SELECT m."Id"::text AS id,m."Name" AS name,m."Description" AS description,m."Kind" AS kind,m."SerializationPolicy" AS "serializationPolicy",m."BrandId"::text AS "brandId",b."Name" AS "brandName",m."CategoryId"::text AS "categoryId",c."Name" AS "categoryName",m."IsActive" AS "isActive",m."CreatedAtUtc" AS "createdAtUtc",m.xmin::text::bigint AS version,'+
   'COALESCE((SELECT jsonb_agg(jsonb_build_object(\'id\',s."Id",\'productModelId\',s."ProductModelId",\'skuCode\',s."SkuCode",\'variantName\',s."VariantName",\'barcodeEan\',s."BarcodeEan",\'defaultPrice\',s."DefaultPrice",\'isActive\',s."IsActive",\'version\',s.xmin::text::bigint,\'availableUnitsCount\',(SELECT count(*)::int FROM inventory_units i WHERE i."TenantId"=s."TenantId" AND i."ProductSkuId"=s."Id" AND i."OperationalStatus"=3)) ORDER BY s."CreatedAtUtc" ASC) FROM product_skus s WHERE s."TenantId"=m."TenantId" AND s."ProductModelId"=m."Id"),\'[]\'::jsonb) AS skus '+
   'FROM product_models m JOIN product_brands b ON b."Id"=m."BrandId" AND b."TenantId"=m."TenantId" JOIN product_categories c ON c."Id"=m."CategoryId" AND c."TenantId"=m."TenantId" WHERE m."TenantId"=$1::uuid AND ($2::text=\'\' OR m."Name" ILIKE (\'%\'||$2||\'%\') OR b."Name" ILIKE (\'%\'||$2||\'%\') OR EXISTS(SELECT 1 FROM product_skus s WHERE s."TenantId"=m."TenantId" AND s."ProductModelId"=m."Id" AND (s."SkuCode" ILIKE (\'%\'||$2||\'%\') OR s."VariantName" ILIKE (\'%\'||$2||\'%\')))) AND ($3::uuid IS NULL OR m."CategoryId"=$3::uuid) AND ($4::uuid IS NULL OR m."BrandId"=$4::uuid) ORDER BY m."Name" LIMIT 500',
   [ctx.tenantId,search,categoryId||null,brandId||null]
  );
  return response(rows,cid);
 });
}

export async function POST(request:NextRequest){
 return catalogHandler(request,MANAGE_PERMISSION,async(ctx,cid)=>{
  const b=await readBody(request);
  const name=textField(b.name,"Nome do modelo",180);
  const kind=numberField(b.kind,"Tipo de produto",[1,2,3,4,5]);
  const policy=numberField(b.serializationPolicy,"Política de serialização",[0,1,2]);
  const brandId=uuid(b.brandId,"Marca"),categoryId=uuid(b.categoryId,"Categoria");
  const description=optionalText(b.description,2000);
  const s=b.initialSku;
  if(!s||typeof s!=="object"||Array.isArray(s))throw new FleetError(400,"SKU_REQUIRED","SKU inicial obrigatório.");
  const sku=s as Record<string,unknown>;
  const skuCode=textField(sku.skuCode,"Código SKU",80).toUpperCase();
  const variantName=textField(sku.variantName,"Variação",160);
  const price=positivePrice(sku.defaultPrice);
  const barcode=optionalText(sku.barcodeEan,64);
  const specs=optionalText(sku.technicalSpecsJson,4000);
  if(specs){try{JSON.parse(specs);}catch{throw new FleetError(400,"INVALID_SPECS","Especificações devem ser JSON válido.");}}
  const modelId=crypto.randomUUID(),skuId=crypto.randomUUID();
  const rows=await ctx.db.query(
   'WITH created AS (INSERT INTO product_models ("Id","TenantId","Name","Description","Kind","SerializationPolicy","BrandId","CategoryId","IsActive","CreatedAtUtc") SELECT $1::uuid,$2::uuid,$3,$4,$5::int,$6::int,$7::uuid,$8::uuid,true,now() WHERE EXISTS(SELECT 1 FROM product_brands WHERE "Id"=$7::uuid AND "TenantId"=$2::uuid AND "IsActive"=true) AND EXISTS(SELECT 1 FROM product_categories WHERE "Id"=$8::uuid AND "TenantId"=$2::uuid AND "IsActive"=true) RETURNING "Id"),'+
   ' created_sku AS (INSERT INTO product_skus ("Id","TenantId","ProductModelId","SkuCode","VariantName","BarcodeEan","DefaultPrice","TechnicalSpecsJson","IsActive","CreatedAtUtc") SELECT $9::uuid,$2::uuid,m."Id",$10,$11,$12,$13::numeric,$14::jsonb,true,now() FROM created m RETURNING "Id"),'+
   ' audited AS (INSERT INTO audit_events ("Id","TenantId","BranchId","EntityType","EntityId","Action","ActorId","ActorEmail","CorrelationId","AfterStateJson","CreatedAtUtc","Version") SELECT gen_random_uuid(),$2::uuid,$15::uuid,\'ProductModel\',m."Id"::text,\'CreatedWithSku\',$16::uuid,$17,$18,jsonb_build_object(\'modelName\',$3,\'skuCode\',$10,\'price\',$13),now(),1 FROM created m JOIN created_sku s ON true RETURNING "Id")'+
   ' SELECT m."Id"::text AS id,s."Id"::text AS "skuId" FROM created m JOIN created_sku s ON true JOIN audited a ON true',
   [modelId,ctx.tenantId,name,description,kind,policy,brandId,categoryId,skuId,skuCode,variantName,barcode,price,specs,ctx.branchId,ctx.userId,ctx.email,cid]
  );
  if(rows.length!==1)throw new FleetError(409,"INVALID_CATALOG_REFERENCE","Marca ou categoria inexistente nesta empresa. Atualize a lista.");
  return response({id:rows[0].id,skuId:rows[0].skuId,created:true},cid,201);
 },true);
}
