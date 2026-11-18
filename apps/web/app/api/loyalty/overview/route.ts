import {NextRequest} from "next/server";
import {loyaltyRoute,PERMS,result} from "@/lib/loyalty-server";
export async function GET(req:NextRequest){
 return loyaltyRoute(req,PERMS.view,async(ctx,cid)=>{
  const [overview,settings]=await Promise.all([
   ctx.db.query('SELECT (SELECT count(*)::int FROM loyalty_accounts WHERE "TenantId"=$1::uuid) AS "members",(SELECT COALESCE(SUM("PointsBalance"),0)::bigint FROM loyalty_accounts WHERE "TenantId"=$1::uuid) AS "pointsOutstanding",(SELECT COALESCE(SUM("LifetimeEarned"),0)::bigint FROM loyalty_accounts WHERE "TenantId"=$1::uuid) AS "pointsIssued",(SELECT count(*)::int FROM loyalty_redemptions WHERE "TenantId"=$1::uuid AND "Status"=\'RESERVED\') AS "reservedRedemptions",(SELECT count(*)::int FROM loyalty_rewards WHERE "TenantId"=$1::uuid AND "IsActive"=true) AS "activeRewards"',[ctx.tenantId]),
   ctx.db.query('SELECT "Enabled" AS enabled,"EarnEveryCents" AS "earnEveryCents","PointsPerStep" AS "pointsPerStep" FROM loyalty_settings WHERE "TenantId"=$1::uuid',[ctx.tenantId])
  ]);
  return result({metrics:overview[0],configured:settings.length>0,settings:settings[0]??null,checkoutReady:false},cid);
 });
}
