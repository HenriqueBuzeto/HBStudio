import {NextRequest} from "next/server";
import crypto from "node:crypto";
import {FleetError,uuid} from "@/lib/fleet-session";
import {catalogHandler,READ_PERMISSION,MANAGE_PERMISSION,COST_PERMISSION,readBody,optionalUuid,optionalText,numberField,positivePrice,normalizeIdentifier,response} from "@/lib/catalog-server";

export async function GET(request:NextRequest){
 return catalogHandler(request,READ_PERMISSION,async(ctx,cid)=>{
  const params=new URL(request.url).searchParams;
  const skuId=params.get("skuId"),search=(params.get("searchSerialOrImei")||params.get("search")||"").trim(),status=params.get("status");
  if(skuId)uuid(skuId,"SKU");
  if(search.length>100)throw new FleetError(400,"INVALID_FILTER","Filtro muito longo.");
  const statusNo=status?numberField(status,"Status da unidade",[1,2,3,4,5]):null;
  const withCost=ctx.permissions.has(COST_PERMISSION);
  const rows=await ctx.db.query(
   'SELECT u."Id"::text AS id,u."ProductSkuId"::text AS "productSkuId",s."SkuCode" AS "skuCode",m."Name" AS "modelName",u."SerialNumber" AS "serialNumber",u."Imei1" AS imei1,u."Imei2" AS imei2,u."Condition" AS condition,u."Grade" AS grade,u."BatteryHealthPercentage" AS "batteryHealthPercentage",CASE WHEN $2::boolean THEN u."AcquisitionCost"::float8 ELSE NULL END AS "acquisitionCost",u."SupplierPartyId"::text AS "supplierPartyId",u."OperationalStatus" AS "operationalStatus",u."InspectionNotes" AS "inspectionNotes",u."AcquisitionDateUtc" AS "acquisitionDateUtc",u.xmin::text::bigint AS version FROM inventory_units u JOIN product_skus s ON s."Id"=u."ProductSkuId" AND s."TenantId"=u."TenantId" JOIN product_models m ON m."Id"=s."ProductModelId" AND m."TenantId"=u."TenantId" WHERE u."TenantId"=$1::uuid AND ($3::uuid IS NULL OR u."ProductSkuId"=$3::uuid) AND ($4::text=\'\' OR u."Imei1" ILIKE (\'%\'||$4||\'%\') OR u."Imei2" ILIKE (\'%\'||$4||\'%\') OR u."SerialNumber" ILIKE (\'%\'||$4||\'%\') OR s."SkuCode" ILIKE (\'%\'||$4||\'%\') OR m."Name" ILIKE (\'%\'||$4||\'%\')) AND ($5::int IS NULL OR u."OperationalStatus"=$5::int) ORDER BY u."CreatedAtUtc" DESC LIMIT 500',
   [ctx.tenantId,withCost,skuId||null,search,statusNo]
  );
  return response(rows,cid);
 });
}
export async function POST(request:NextRequest){
 return catalogHandler(request,MANAGE_PERMISSION,async(ctx,cid)=>{
  const b=await readBody(request);
  const skuId=uuid(b.productSkuId,"SKU"),condition=numberField(b.condition,"Condição",[1,2,3,4]),grade=numberField(b.grade,"Grau estético",[0,1,2,3]);
  const cost=positivePrice(b.acquisitionCost,"Custo de aquisição");
  const imei1=normalizeIdentifier(b.imei1,"IMEI 1","imei"),imei2=normalizeIdentifier(b.imei2,"IMEI 2","imei"),serial=normalizeIdentifier(b.serialNumber,"Número de série","serial");
  if(!imei1&&!imei2&&!serial)throw new FleetError(400,"IDENTIFIER_REQUIRED","Informe IMEI ou serial para cadastrar uma unidade individual.");
  if(imei1&&imei2&&imei1===imei2)throw new FleetError(400,"DUPLICATE_IMEI","IMEI 1 e IMEI 2 não podem ser iguais.");
  const battery=b.batteryHealthPercentage===null||b.batteryHealthPercentage===""||b.batteryHealthPercentage===undefined?null:Number(b.batteryHealthPercentage);
  if(battery!==null&&(!Number.isInteger(battery)||battery<0||battery>100))throw new FleetError(400,"INVALID_BATTERY","Saúde da bateria deve estar entre 0 e 100%.");
  const supplier=optionalUuid(b.supplierPartyId,"Fornecedor");
  const notes=optionalText(b.inspectionNotes,1200);
  const id=crypto.randomUUID();
  const rows=await ctx.db.query(
   'WITH valid_sku AS (SELECT s."Id" FROM product_skus s JOIN product_models m ON m."Id"=s."ProductModelId" AND m."TenantId"=s."TenantId" WHERE s."Id"=$2::uuid AND s."TenantId"=$1::uuid AND s."IsActive"=true AND m."IsActive"=true AND (m."SerializationPolicy"<>2 OR $3::text IS NOT NULL OR $4::text IS NOT NULL)),'+
   ' created AS (INSERT INTO inventory_units ("Id","TenantId","ProductSkuId","SerialNumber","Imei1","Imei2","Condition","Grade","BatteryHealthPercentage","AcquisitionCost","SupplierPartyId","OperationalStatus","InspectionNotes","AcquisitionDateUtc","CreatedAtUtc","AllocatedFreightCost") SELECT $5::uuid,$1::uuid,s."Id",$3,$4,$6,$7::int,$8::int,$9::int,$10::numeric,$11::uuid,1,$12,now(),now(),0 FROM valid_sku s WHERE $11::uuid IS NULL OR EXISTS (SELECT 1 FROM parties p WHERE p."Id"=$11::uuid AND p."TenantId"=$1::uuid) RETURNING "Id"),'+
   ' ids AS (INSERT INTO inventory_unit_identifiers ("Id","TenantId","InventoryUnitId","IdentifierType","NormalizedValue","IsPrimary","CreatedAtUtc") SELECT gen_random_uuid(),$1::uuid,c."Id",i.kind,i.val,i.isprimary,now() FROM created c CROSS JOIN LATERAL (VALUES (1::int,$4::text,true),(1::int,$6::text,false),(2::int,$3::text,true)) i(kind,val,isprimary) WHERE i.val IS NOT NULL RETURNING "Id"),'+
   ' audited AS (INSERT INTO audit_events ("Id","TenantId","BranchId","EntityType","EntityId","Action","ActorId","ActorEmail","CorrelationId","AfterStateJson","CreatedAtUtc","Version") SELECT gen_random_uuid(),$1::uuid,$13::uuid,\'InventoryUnit\',c."Id"::text,\'RegisteredPendingInspection\',$14::uuid,$15,$16,jsonb_build_object(\'productSkuId\',$2,\'condition\',$7,\'grade\',$8),now(),1 FROM created c RETURNING "Id") SELECT c."Id"::text AS id,(SELECT COUNT(*)::int FROM ids) AS "identifiersCreated" FROM created c CROSS JOIN audited a',
   [ctx.tenantId,skuId,serial,imei1,id,imei2,condition,grade,battery,cost,supplier,notes,ctx.branchId,ctx.userId,ctx.email,cid]
  );
  if(!rows.length)throw new FleetError(409,"INVALID_SKU_OR_SUPPLIER","SKU ou fornecedor não pertence a esta empresa, ou SKU está inativo.");
  return response({...rows[0],operationalStatus:1,message:"Unidade registrada para inspeção. Nenhuma venda ou baixa de estoque foi realizada."},cid,201);
 },true);
}
