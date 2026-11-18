import {NextRequest} from "next/server";
import {loyaltyRoute,PERMS,result} from "@/lib/loyalty-server";
export async function GET(req:NextRequest){
 return loyaltyRoute(req,PERMS.view,async(ctx,cid)=>{
  const params=new URL(req.url).searchParams;const search=(params.get("search")||"").trim().slice(0,100);
  const page=Math.min(10000,Math.max(1,Number.parseInt(params.get("page")||"1",10)||1));
  const rows=await ctx.db.query(
   'SELECT p."Id"::text AS id,p."Name" AS name,COALESCE(a."PointsBalance",0)::bigint AS "pointsBalance",COALESCE(a."LifetimeEarned",0)::bigint AS "lifetimeEarned",COALESCE(a."LifetimeRedeemed",0)::bigint AS "lifetimeRedeemed",COUNT(*) OVER()::int AS "totalMatches" FROM parties p LEFT JOIN loyalty_accounts a ON a."PartyId"=p."Id" AND a."TenantId"=p."TenantId" WHERE p."TenantId"=$1::uuid AND p."IsActive"=true AND ($2::text=\'\' OR p."Name" ILIKE (\'%\'||$2||\'%\')) ORDER BY p."Name" LIMIT 30 OFFSET $3::int',
   [ctx.tenantId,search,(page-1)*30]
  );
  return result({customers:rows,total:rows[0]?.totalMatches??0,page,pageSize:30},cid);
 });
}
