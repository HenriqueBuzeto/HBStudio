import {NextRequest} from "next/server";
import {loyaltyHandler,LOYALTY_VIEW,respond} from "@/lib/loyalty-server";
export async function GET(request:NextRequest){
 return loyaltyHandler(request,LOYALTY_VIEW,async(s,cid)=>{
  const [program,rewards,summary,customers,redemptions,ledger]=await Promise.all([
   s.db.query('SELECT "Id"::text AS id,"Enabled" AS enabled,"EarnCentsPerPoint" AS "earnCentsPerPoint","CashbackBps" AS "cashbackBps","SilverAtPoints" AS "silverAtPoints","GoldAtPoints" AS "goldAtPoints","DiamondAtPoints" AS "diamondAtPoints","Version" AS version FROM loyalty_programs WHERE "TenantId"=$1::uuid',[s.tenantId]),
   s.db.query('SELECT "Id"::text AS id,"Kind" AS kind,"Title" AS title,"Description" AS description,"PointsCost" AS "pointsCost","ValueCents" AS "valueCents","StockAvailable" AS "stockAvailable","IsActive" AS "isActive","StartsAtUtc" AS "startsAtUtc","EndsAtUtc" AS "endsAtUtc","Version" AS version FROM loyalty_rewards WHERE "TenantId"=$1::uuid ORDER BY "CreatedAtUtc" DESC LIMIT 200',[s.tenantId]),
   s.db.query('SELECT COUNT(*)::int AS "activeAccounts",COALESCE(SUM(GREATEST("PointsBalance",0)),0)::bigint AS "availablePoints",COALESCE(SUM("LifetimeEarned"),0)::bigint AS "lifetimeEarned",COALESCE(SUM("LifetimeRedeemed"),0)::bigint AS "lifetimeRedeemed",COALESCE(SUM(GREATEST("CashbackCentsAccrued",0)),0)::bigint AS "cashbackCents",COALESCE(SUM("PurchasesCount"),0)::bigint AS "rewardedPurchases" FROM loyalty_accounts WHERE "TenantId"=$1::uuid',[s.tenantId]),
   s.db.query('SELECT a."PartyId"::text AS id,p."Name" AS name,p."IsActive" AS "isActive",a."PointsBalance" AS points,a."LifetimeEarned" AS earned,a."LifetimeRedeemed" AS redeemed,a."CashbackCentsAccrued" AS "cashbackCents",a."EligibleSpendCents" AS "spentCents",a."PurchasesCount" AS purchases FROM loyalty_accounts a JOIN parties p ON p."Id"=a."PartyId" AND p."TenantId"=a."TenantId" WHERE a."TenantId"=$1::uuid ORDER BY a."UpdatedAtUtc" DESC NULLS LAST LIMIT 100',[s.tenantId]),
   s.db.query('SELECT r."Id"::text AS id,r."PartyId"::text AS "partyId",p."Name" AS "customerName",r."RewardTitle" AS title,r."PointsSpent" AS points,r."Kind" AS kind,r."Status" AS status,r."Code" AS code,r."CreatedAtUtc" AS "createdAtUtc",r."FulfilledAtUtc" AS "fulfilledAtUtc",r."Notes" AS notes FROM loyalty_redemptions r JOIN parties p ON p."Id"=r."PartyId" AND p."TenantId"=r."TenantId" WHERE r."TenantId"=$1::uuid ORDER BY r."CreatedAtUtc" DESC LIMIT 100',[s.tenantId]),
   s.db.query('SELECT l."Id"::text AS id,l."PartyId"::text AS "partyId",p."Name" AS "customerName",l."Kind" AS kind,l."PointsDelta" AS points,l."CashbackCentsDelta" AS "cashbackCents",l."EventKey" AS "eventKey",l."SaleId"::text AS "saleId",l."CreatedAtUtc" AS "createdAtUtc" FROM loyalty_ledger l JOIN parties p ON p."Id"=l."PartyId" AND p."TenantId"=l."TenantId" WHERE l."TenantId"=$1::uuid ORDER BY l."CreatedAtUtc" DESC LIMIT 100',[s.tenantId])
  ]);
  return respond({program:program[0]||null,rewards,summary:summary[0],customers,redemptions,ledger,
   capabilities:{manage:s.permissions.has("loyalty.manage"),redeem:s.permissions.has("loyalty.redeem"),fulfill:s.permissions.has("loyalty.fulfill"),voucherCheckout:false},
   information:"Pontos por vendas efetivamente quitadas; crédito cashback não é dinheiro sacável e sua utilização no PDV aguarda checkout homologado."
  },cid);
 });
}
