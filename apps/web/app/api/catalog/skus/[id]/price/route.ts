import {NextRequest} from "next/server";
import {FleetError,uuid} from "@/lib/fleet-session";
import {catalogHandler,MANAGE_PERMISSION,readBody,positivePrice,expectedVersion,response} from "@/lib/catalog-server";

export async function PUT(request:NextRequest,{params}:{params:Promise<{id:string}>}){
 return catalogHandler(request,MANAGE_PERMISSION,async(ctx,cid)=>{
  const skuId=uuid((await params).id,"SKU"),b=await readBody(request);
  const price=positivePrice(b.newPrice),expected=expectedVersion(b.expectedVersion);
  const rows=await ctx.db.query(
   'WITH updated AS (UPDATE product_skus SET "DefaultPrice"=$3::numeric,"UpdatedAtUtc"=now() WHERE "Id"=$1::uuid AND "TenantId"=$2::uuid AND xmin::text::bigint=$4::bigint AND "IsActive"=true RETURNING "Id","DefaultPrice",xmin::text::bigint AS version),'+
   ' audited AS (INSERT INTO audit_events ("Id","TenantId","BranchId","EntityType","EntityId","Action","ActorId","ActorEmail","CorrelationId","AfterStateJson","CreatedAtUtc","Version") SELECT gen_random_uuid(),$2::uuid,$5::uuid,\'ProductSku\',s."Id"::text,\'PriceUpdated\',$6::uuid,$7,$8,jsonb_build_object(\'newPrice\',$3,\'expectedVersion\',$4),now(),1 FROM updated s RETURNING "Id") SELECT s."Id"::text AS id,s."DefaultPrice"::float8 AS "defaultPrice",s.version FROM updated s JOIN audited a ON true',
   [skuId,ctx.tenantId,price,expected,ctx.branchId,ctx.userId,ctx.email,cid]
  );
  if(!rows.length)throw new FleetError(409,"CATALOG_OCC_CONFLICT","Preço não alterado. O SKU foi modificado ou não existe mais. Recarregue antes de tentar novamente.");
  return response(rows[0],cid);
 },true);
}
