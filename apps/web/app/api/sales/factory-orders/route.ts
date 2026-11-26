import {NextRequest,NextResponse} from "next/server";
import {authorizeFleet,FleetError} from "@/lib/fleet-session";
// Read-only handoff for the canonical checkout coordinator. Does not reserve, charge or create a sale.
export async function GET(request:NextRequest){
 const headers={"Cache-Control":"no-store"};
 try{const ctx=await authorizeFleet(request,"sales.pos.use");if(!ctx.permissions.has("sales.create"))throw new FleetError(403,"FORBIDDEN","Permissão de venda necessária.");
 const orders=await ctx.db.query(`SELECT o."Id"::text "orderId",o."OrderNumber" number,d.customer_id::text "customerId",c."Name" customer,d.title,o."ApprovedQuantity" quantity,d.approved_price::text "approvedTotal",d.version FROM manufacturing_factory_order_details d JOIN manufacturing_orders o ON o."Id"=d.order_id AND o."TenantId"=d.tenant_id AND o."BranchId"=d.branch_id JOIN parties c ON c."Id"=d.customer_id AND c."TenantId"=d.tenant_id WHERE d.tenant_id=$1::uuid AND d.branch_id=$2::uuid AND o."Status"=12 AND o."ApprovedQuantity"=o."PlannedQuantity" AND o."SalesOrderId" IS NULL AND c."IsActive" ORDER BY o."FinishedAtUtc" DESC LIMIT 200`,[ctx.tenantId,ctx.branchId]);
 const [gate]=await ctx.db.query("SELECT public.internal_checkout_qa_enabled_v5() enabled,EXISTS(SELECT 1 FROM internal_checkout_config_v5 WHERE tenant_id=$1::uuid AND branch_id=$2::uuid) configured",[ctx.tenantId,ctx.branchId]);const enabled=gate?.enabled===true&&gate?.configured===true;return NextResponse.json({orders,checkoutEnabled:enabled,reason:enabled?null:"CHECKOUT_NOT_HOMOLOGATED"},{headers});
 }catch(e){if(e instanceof FleetError)return NextResponse.json({code:e.code,error:e.message},{status:e.status,headers});return NextResponse.json({code:"FACTORY_HANDOFF_UNAVAILABLE",error:"Ordens disponíveis indisponíveis."},{status:503,headers});}
}
