import {NextRequest,NextResponse,connection} from "next/server";
import {authorizeFleet,FleetError} from "@/lib/fleet-session";
import {fleetSource} from "@/lib/fleet-source";
import {purchaseInsightsSql} from "@/lib/purchase-insights-sql";
import {randomUUID} from "node:crypto";
export async function GET(req:NextRequest){
 await connection();const cid=randomUUID(),headers={"Cache-Control":"no-store","X-Correlation-Id":cid};
 try{
 const ctx=await authorizeFleet(req,"purchases.view");
 if(!ctx.permissions.has("inventory.view")||!ctx.permissions.has("finance.reports.view"))throw new FleetError(403,"FORBIDDEN","A análise requer acesso a compras, estoque e relatórios.");
 const identity=await ctx.db.query('SELECT current_setting(\'neon.branch_id\',true) AS branch,b."Name" AS name FROM branches b WHERE b."TenantId"=$1::uuid AND b."Id"=$2::uuid AND b."IsActive"',[ctx.tenantId,ctx.branchId]);
 const source=identity[0]?fleetSource(identity[0].branch,process.env.VERCEL_ENV,identity[0].name):null;
 if(!source)throw new FleetError(503,"SOURCE_UNVERIFIED","Origem do banco não confirmada.");
 const costs=["purchases.cost.view","inventory.cost.view","sales.cost.view"].every(k=>ctx.permissions.has(k));
 const rows=await ctx.db.query(purchaseInsightsSql,[ctx.tenantId,ctx.branchId,costs]);
 return NextResponse.json({rows,costs,source,asOf:rows[0]?.asOf??new Date().toISOString()},{headers});
 }catch(e){if(e instanceof FleetError)return NextResponse.json({error:e.message,code:e.code},{status:e.status,headers});
 console.error("[PurchaseInsights]["+cid+"]",(e as {code?:string})?.code||"UNKNOWN");return NextResponse.json({error:"Não foi possível confirmar a análise no Neon."},{status:503,headers});}
}
