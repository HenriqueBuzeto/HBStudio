import {NextRequest} from "next/server";
import {loyaltyHandler,LOYALTY_VIEW,respond,checkParty,uuidField,calculateTier} from "@/lib/loyalty-server";

export async function GET(request:NextRequest,{params}:{params:Promise<{id:string}>}){
 return loyaltyHandler(request,LOYALTY_VIEW,async(s,cid)=>{
  const partyId=uuidField((await params).id,"Cliente"),party=await checkParty(s,partyId);
  const [acct,program,ledger,redemptions,rewards]=await Promise.all([
   s.db.query('SELECT "PointsBalance" AS "pointsBalance","LifetimeEarned" AS "lifetimeEarned","LifetimeRedeemed" AS "lifetimeRedeemed","CashbackCentsAccrued" AS "cashbackCents","EligibleSpendCents" AS "eligibleSpendCents","PurchasesCount" AS "purchasesCount" FROM loyalty_accounts WHERE "TenantId"=$1::uuid AND "PartyId"=$2::uuid LIMIT 1',[s.tenantId,partyId]),
   s.db.query('SELECT "Enabled" AS enabled,"EarnCentsPerPoint" AS "earnCentsPerPoint","CashbackBps" AS "cashbackBps","SilverAtPoints" AS "silverAtPoints","GoldAtPoints" AS "goldAtPoints","DiamondAtPoints" AS "diamondAtPoints" FROM loyalty_programs WHERE "TenantId"=$1::uuid',[s.tenantId]),
   s.db.query('SELECT "Id"::text AS id,"Kind" AS kind,"PointsDelta" AS points,"CashbackCentsDelta" AS "cashbackCents","EligibleSpendCents" AS "eligibleSpendCents","EventKey" AS "eventKey","SaleId"::text AS "saleId","RedemptionId"::text AS "redemptionId","CreatedAtUtc" AS "createdAtUtc" FROM loyalty_ledger WHERE "TenantId"=$1::uuid AND "PartyId"=$2::uuid ORDER BY "CreatedAtUtc" DESC LIMIT 100',[s.tenantId,partyId]),
   s.db.query('SELECT r."Id"::text AS id,r."RewardTitle" AS title,r."Kind" AS kind,r."PointsSpent" AS points,r."Code" AS code,r."Status" AS status,r."CreatedAtUtc" AS "createdAtUtc",r."FulfilledAtUtc" AS "fulfilledAtUtc",r."Notes" AS notes FROM loyalty_redemptions r WHERE r."TenantId"=$1::uuid AND r."PartyId"=$2::uuid ORDER BY r."CreatedAtUtc" DESC LIMIT 50',[s.tenantId,partyId]),
   s.db.query('SELECT "Id"::text AS id,"Kind" AS kind,"Title" AS title,"Description" AS description,"PointsCost" AS "pointsCost","ValueCents" AS "valueCents","StockAvailable" AS "stockAvailable","IsActive" AS "isActive","StartsAtUtc" AS "startsAtUtc","EndsAtUtc" AS "endsAtUtc" FROM loyalty_rewards WHERE "TenantId"=$1::uuid AND "IsActive"=true ORDER BY "PointsCost" ASC LIMIT 100',[s.tenantId])
  ]);
  const a=acct[0]??null,p=program[0]??null;
  return respond({party,
   account:a||{pointsBalance:"0",lifetimeEarned:"0",lifetimeRedeemed:"0",cashbackCents:"0",eligibleSpendCents:"0",purchasesCount:0},
   accountExists:!!a,
   tier:calculateTier(Number(a?.lifetimeEarned||0),p),
   program:p,ledger,redemptions,rewards,
   capabilities:{redeem:s.permissions.has("loyalty.redeem"),fulfill:s.permissions.has("loyalty.fulfill"),voucherCheckout:false},
   note:"Saldo contabilizado no extrato; valores de cashback são créditos acumulados, não dinheiro ou desconto disponível no PDV enquanto checkout não for homologado."
  },cid);
 });
}
