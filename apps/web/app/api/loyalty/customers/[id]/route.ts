import {NextRequest} from "next/server";
import {uuid} from "@/lib/fleet-session";
import {loyaltyRoute,PERMS,result,assertCustomer} from "@/lib/loyalty-server";
export async function GET(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 return loyaltyRoute(req,PERMS.view,async(ctx,cid)=>{
  const partyId=uuid((await params).id,"Cliente");await assertCustomer(ctx,partyId);
  const [balance,ledger,redemptions]=await Promise.all([
   ctx.db.query('SELECT "PointsBalance"::bigint AS "pointsBalance","LifetimeEarned"::bigint AS "lifetimeEarned","LifetimeRedeemed"::bigint AS "lifetimeRedeemed" FROM loyalty_accounts WHERE "TenantId"=$1::uuid AND "PartyId"=$2::uuid',[ctx.tenantId,partyId]),
   ctx.db.query('SELECT l."Id"::text AS id,l."Kind" AS kind,l."PointsDelta"::bigint AS "pointsDelta",l."Reason" AS reason,l."SaleId"::text AS "saleId",s."SaleNumber" AS "saleNumber",l."RedemptionId"::text AS "redemptionId",l."CreatedAtUtc" AS "createdAt" FROM loyalty_ledger l LEFT JOIN sales s ON s."Id"=l."SaleId" AND s."TenantId"=l."TenantId" WHERE l."TenantId"=$1::uuid AND l."PartyId"=$2::uuid ORDER BY l."CreatedAtUtc" DESC LIMIT 100',[ctx.tenantId,partyId]),
   ctx.db.query('SELECT "Id"::text AS id,"RewardId"::text AS "rewardId","RewardTitleSnapshot" AS title,"RewardKindSnapshot" AS kind,"PointsSpent"::bigint AS "pointsSpent","Status" AS status,"CreatedAtUtc" AS "createdAt","CompletedAtUtc" AS "completedAt" FROM loyalty_redemptions WHERE "TenantId"=$1::uuid AND "PartyId"=$2::uuid ORDER BY "CreatedAtUtc" DESC LIMIT 100',[ctx.tenantId,partyId])
  ]);
  return result({customerId:partyId,pointsBalance:balance[0]?.pointsBalance??0,lifetimeEarned:balance[0]?.lifetimeEarned??0,lifetimeRedeemed:balance[0]?.lifetimeRedeemed??0,ledger,redemptions},cid);
 });
}
