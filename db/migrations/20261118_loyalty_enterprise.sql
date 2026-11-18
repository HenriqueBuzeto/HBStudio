-- HB Studio ERP Loyalty/Cashback Enterprise v1. Additive, non-destructive.
-- Generated 2026-11-18; apply on Neon staging branch and validate before production.
-- @statement
CREATE UNIQUE INDEX IF NOT EXISTS "UX_parties_TenantId_Id" ON parties ("TenantId","Id");
-- @statement
CREATE UNIQUE INDEX IF NOT EXISTS "UX_sales_TenantId_Id" ON sales ("TenantId","Id");
-- @statement
CREATE TABLE IF NOT EXISTS loyalty_programs (
  "Id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "TenantId" uuid NOT NULL UNIQUE REFERENCES tenants ("Id") ON DELETE RESTRICT,
  "Enabled" boolean NOT NULL DEFAULT true,
  "EarnCentsPerPoint" integer NOT NULL DEFAULT 500 CHECK ("EarnCentsPerPoint" BETWEEN 1 AND 1000000),
  "CashbackBps" integer NOT NULL DEFAULT 0 CHECK ("CashbackBps" BETWEEN 0 AND 3000),
  "SilverAtPoints" integer NOT NULL DEFAULT 500 CHECK ("SilverAtPoints">0),
  "GoldAtPoints" integer NOT NULL DEFAULT 1500 CHECK ("GoldAtPoints">0),
  "DiamondAtPoints" integer NOT NULL DEFAULT 5000 CHECK ("DiamondAtPoints">0),
  "CreatedAtUtc" timestamptz NOT NULL DEFAULT now(),
  "UpdatedAtUtc" timestamptz NULL,
  "Version" bigint NOT NULL DEFAULT 1,
  CONSTRAINT loyalty_tier_increasing CHECK ("SilverAtPoints"<"GoldAtPoints" AND "GoldAtPoints"<"DiamondAtPoints")
);
-- @statement
CREATE TABLE IF NOT EXISTS loyalty_accounts (
  "Id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "TenantId" uuid NOT NULL REFERENCES tenants ("Id") ON DELETE RESTRICT,
  "PartyId" uuid NOT NULL,
  "PointsBalance" bigint NOT NULL DEFAULT 0,
  "LifetimeEarned" bigint NOT NULL DEFAULT 0 CHECK ("LifetimeEarned">=0),
  "LifetimeRedeemed" bigint NOT NULL DEFAULT 0 CHECK ("LifetimeRedeemed">=0),
  "CashbackCentsAccrued" bigint NOT NULL DEFAULT 0,
  "EligibleSpendCents" bigint NOT NULL DEFAULT 0 CHECK ("EligibleSpendCents">=0),
  "PurchasesCount" integer NOT NULL DEFAULT 0 CHECK ("PurchasesCount">=0),
  "CreatedAtUtc" timestamptz NOT NULL DEFAULT now(),
  "UpdatedAtUtc" timestamptz NULL,
  CONSTRAINT "UQ_loyalty_accounts_tenant_party" UNIQUE ("TenantId","PartyId"),
  CONSTRAINT "FK_loyalty_accounts_parties_tenant" FOREIGN KEY ("TenantId","PartyId") REFERENCES parties ("TenantId","Id") ON DELETE RESTRICT
);
-- @statement
CREATE TABLE IF NOT EXISTS loyalty_rewards (
  "Id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "TenantId" uuid NOT NULL REFERENCES tenants ("Id") ON DELETE RESTRICT,
  "Kind" varchar(16) NOT NULL CHECK ("Kind" IN ('GIFT','SERVICE','VOUCHER','DISCOUNT')),
  "Title" varchar(160) NOT NULL,
  "Description" varchar(1000) NULL,
  "PointsCost" integer NOT NULL CHECK ("PointsCost">0),
  "ValueCents" bigint NOT NULL DEFAULT 0 CHECK ("ValueCents">=0),
  "StockAvailable" integer NULL CHECK ("StockAvailable" IS NULL OR "StockAvailable">=0),
  "IsActive" boolean NOT NULL DEFAULT true,
  "StartsAtUtc" timestamptz NULL,
  "EndsAtUtc" timestamptz NULL,
  "CreatedAtUtc" timestamptz NOT NULL DEFAULT now(),
  "UpdatedAtUtc" timestamptz NULL,
  "Version" bigint NOT NULL DEFAULT 1,
  CONSTRAINT "UQ_loyalty_rewards_tenant_id" UNIQUE ("TenantId","Id"),
  CONSTRAINT loyalty_reward_window CHECK ("StartsAtUtc" IS NULL OR "EndsAtUtc" IS NULL OR "StartsAtUtc"<"EndsAtUtc"),
  CONSTRAINT loyalty_reward_voucher_amount CHECK ("Kind" NOT IN ('VOUCHER','DISCOUNT') OR "ValueCents">0)
);
-- @statement
CREATE TABLE IF NOT EXISTS loyalty_redemptions (
  "Id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "TenantId" uuid NOT NULL REFERENCES tenants ("Id") ON DELETE RESTRICT,
  "BranchId" uuid NOT NULL,
  "PartyId" uuid NOT NULL,
  "RewardId" uuid NOT NULL,
  "RequestKey" uuid NOT NULL,
  "Code" varchar(40) NOT NULL,
  "Kind" varchar(16) NOT NULL,
  "RewardTitle" varchar(160) NOT NULL,
  "PointsSpent" integer NOT NULL CHECK ("PointsSpent">0),
  "ValueCents" bigint NOT NULL CHECK ("ValueCents">=0),
  "Status" varchar(20) NOT NULL DEFAULT 'RESERVED' CHECK ("Status" IN ('RESERVED','ISSUED','FULFILLED','CANCELLED','APPLIED')),
  "CreatedByUserId" uuid NOT NULL,
  "FulfilledByUserId" uuid NULL,
  "FulfilledAtUtc" timestamptz NULL,
  "CancelledByUserId" uuid NULL,
  "CancelledAtUtc" timestamptz NULL,
  "Notes" varchar(600) NULL,
  "CreatedAtUtc" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "UQ_loyalty_redemptions_request" UNIQUE ("TenantId","RequestKey"),
  CONSTRAINT "UQ_loyalty_redemptions_code" UNIQUE ("TenantId","Code"),
  CONSTRAINT "UQ_loyalty_redemptions_tenant_id" UNIQUE ("TenantId","Id"),
  CONSTRAINT "FK_loyalty_redemptions_parties" FOREIGN KEY ("TenantId","PartyId") REFERENCES parties ("TenantId","Id") ON DELETE RESTRICT,
  CONSTRAINT "FK_loyalty_redemptions_rewards" FOREIGN KEY ("TenantId","RewardId") REFERENCES loyalty_rewards ("TenantId","Id") ON DELETE RESTRICT
);
-- @statement
CREATE TABLE IF NOT EXISTS loyalty_ledger (
  "Id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "TenantId" uuid NOT NULL REFERENCES tenants ("Id") ON DELETE RESTRICT,
  "PartyId" uuid NOT NULL,
  "SaleId" uuid NULL,
  "RedemptionId" uuid NULL,
  "EventKey" varchar(160) NOT NULL,
  "Kind" varchar(24) NOT NULL CHECK ("Kind" IN ('SALE_EARN','SALE_REVERSAL','REDEEM','REDEEM_REFUND')),
  "PointsDelta" bigint NOT NULL,
  "CashbackCentsDelta" bigint NOT NULL DEFAULT 0,
  "EligibleSpendCents" bigint NOT NULL DEFAULT 0,
  "RulesSnapshot" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "ActorId" uuid NULL,
  "CreatedAtUtc" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "UQ_loyalty_ledger_event" UNIQUE ("TenantId","EventKey"),
  CONSTRAINT "FK_loyalty_ledger_parties" FOREIGN KEY ("TenantId","PartyId") REFERENCES parties ("TenantId","Id") ON DELETE RESTRICT,
  CONSTRAINT "FK_loyalty_ledger_sales" FOREIGN KEY ("TenantId","SaleId") REFERENCES sales ("TenantId","Id") ON DELETE RESTRICT,
  CONSTRAINT "FK_loyalty_ledger_redemptions" FOREIGN KEY ("TenantId","RedemptionId") REFERENCES loyalty_redemptions ("TenantId","Id") ON DELETE RESTRICT
);
-- @statement
CREATE INDEX IF NOT EXISTS "IX_loyalty_ledger_party_date" ON loyalty_ledger ("TenantId","PartyId","CreatedAtUtc" DESC);
-- @statement
CREATE INDEX IF NOT EXISTS "IX_loyalty_redemptions_party_date" ON loyalty_redemptions ("TenantId","PartyId","CreatedAtUtc" DESC);
-- @statement
CREATE INDEX IF NOT EXISTS "IX_loyalty_rewards_catalog" ON loyalty_rewards ("TenantId","IsActive","Kind");
-- @statement
CREATE OR REPLACE FUNCTION loyalty_ledger_immutable() RETURNS trigger LANGUAGE plpgsql AS $body$
BEGIN
 RAISE EXCEPTION 'LOYALTY_LEDGER_IMMUTABLE: corrections must be recorded as compensating events';
END;$body$;
-- @statement
DO $body$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='loyalty_ledger_no_change' AND tgrelid='loyalty_ledger'::regclass) THEN
  CREATE TRIGGER "loyalty_ledger_no_change" BEFORE UPDATE OR DELETE ON loyalty_ledger FOR EACH ROW EXECUTE FUNCTION loyalty_ledger_immutable();
 END IF;
END $body$;
-- @statement
CREATE OR REPLACE FUNCTION loyalty_on_sale_settled() RETURNS trigger LANGUAGE plpgsql AS $body$
DECLARE
 p loyalty_programs%ROWTYPE;
 earned_id uuid;
 reversal_id uuid;
 eligible_cents bigint;
 gross_cents bigint;
 settled_cents bigint;
 reward_points bigint;
 cashback_cents bigint;
 previous_earn loyalty_ledger%ROWTYPE;
BEGIN
 IF NEW."CustomerPartyId" IS NULL THEN RETURN NEW; END IF;
 IF TG_OP = 'UPDATE' AND NEW."Status"=OLD."Status" AND NEW."PaymentStatus"=OLD."PaymentStatus" AND NEW."ConfirmedAtUtc" IS NOT DISTINCT FROM OLD."ConfirmedAtUtc" THEN RETURN NEW; END IF;

 IF NEW."Status" IN (4,5) AND NEW."PaymentStatus"=4 AND NEW."ConfirmedAtUtc" IS NOT NULL THEN
  SELECT * INTO p FROM loyalty_programs
   WHERE "TenantId"=NEW."TenantId" AND "Enabled"=true;
  IF NOT FOUND THEN RETURN NEW; END IF;
  IF NOT EXISTS (SELECT 1 FROM parties WHERE "TenantId"=NEW."TenantId" AND "Id"=NEW."CustomerPartyId" AND "IsActive"=true) THEN RETURN NEW; END IF;
  SELECT COALESCE(round(sum(i."Quantity"*i."UnitPrice"-i."Discount")*100),0)::bigint
    INTO gross_cents FROM sale_items i WHERE i."TenantId"=NEW."TenantId" AND i."SaleId"=NEW."Id";
  eligible_cents:=GREATEST(0,gross_cents-COALESCE(round(NEW."DiscountTotal"*100),0)::bigint);
  IF eligible_cents<=0 THEN RETURN NEW; END IF;
  SELECT COALESCE(round(sum(pi."Amount")*100),0)::bigint INTO settled_cents
    FROM sale_payment_intents pi
    WHERE pi."TenantId"=NEW."TenantId" AND pi."SaleId"=NEW."Id" AND pi."Status"=2 AND pi."ConfirmedAtUtc" IS NOT NULL;
  IF settled_cents < GREATEST(0,eligible_cents+COALESCE(round(NEW."ChargesTotal"*100),0)::bigint) THEN RETURN NEW; END IF;
  reward_points:=floor(eligible_cents::numeric/p."EarnCentsPerPoint")::bigint;
  cashback_cents:=round(eligible_cents::numeric*p."CashbackBps"/10000)::bigint;
  INSERT INTO loyalty_accounts ("TenantId","PartyId") VALUES (NEW."TenantId",NEW."CustomerPartyId")
   ON CONFLICT ("TenantId","PartyId") DO NOTHING;
  -- Serialize cash/points accrual against concurrent reward redemptions.
  PERFORM 1 FROM loyalty_accounts WHERE "TenantId"=NEW."TenantId" AND "PartyId"=NEW."CustomerPartyId" FOR UPDATE;
  INSERT INTO loyalty_ledger ("TenantId","PartyId","SaleId","EventKey","Kind","PointsDelta","CashbackCentsDelta","EligibleSpendCents","RulesSnapshot","ActorId")
    VALUES (NEW."TenantId",NEW."CustomerPartyId",NEW."Id",'SALE_EARN:'||NEW."Id"::text,
      'SALE_EARN',reward_points,cashback_cents,eligible_cents,
      jsonb_build_object('earnCentsPerPoint',p."EarnCentsPerPoint",'cashbackBps',p."CashbackBps",'saleNumber',NEW."SaleNumber"),NEW."CreatedByUserId")
    ON CONFLICT ("TenantId","EventKey") DO NOTHING RETURNING "Id" INTO earned_id;
  IF earned_id IS NOT NULL THEN
   UPDATE loyalty_accounts SET "PointsBalance"="PointsBalance"+reward_points,
     "LifetimeEarned"="LifetimeEarned"+reward_points,
     "CashbackCentsAccrued"="CashbackCentsAccrued"+cashback_cents,
     "EligibleSpendCents"="EligibleSpendCents"+eligible_cents,
     "PurchasesCount"="PurchasesCount"+1,"UpdatedAtUtc"=now()
     WHERE "TenantId"=NEW."TenantId" AND "PartyId"=NEW."CustomerPartyId";
  END IF;
 END IF;

 IF NEW."Status" IN (6,8) THEN
  SELECT * INTO previous_earn FROM loyalty_ledger
    WHERE "TenantId"=NEW."TenantId" AND "EventKey"='SALE_EARN:'||NEW."Id"::text;
  IF FOUND THEN
   PERFORM 1 FROM loyalty_accounts WHERE "TenantId"=NEW."TenantId" AND "PartyId"=NEW."CustomerPartyId" FOR UPDATE;
   INSERT INTO loyalty_ledger ("TenantId","PartyId","SaleId","EventKey","Kind","PointsDelta","CashbackCentsDelta","EligibleSpendCents","RulesSnapshot","ActorId")
    VALUES (NEW."TenantId",NEW."CustomerPartyId",NEW."Id",'SALE_REVERSAL:'||NEW."Id"::text,
      'SALE_REVERSAL',-previous_earn."PointsDelta",-previous_earn."CashbackCentsDelta",
      -previous_earn."EligibleSpendCents",jsonb_build_object('reason','sale cancelled or fully returned'),NEW."CreatedByUserId")
     ON CONFLICT ("TenantId","EventKey") DO NOTHING RETURNING "Id" INTO reversal_id;
   IF reversal_id IS NOT NULL THEN
    UPDATE loyalty_accounts SET "PointsBalance"="PointsBalance"-previous_earn."PointsDelta",
      "CashbackCentsAccrued"="CashbackCentsAccrued"-previous_earn."CashbackCentsDelta",
      "EligibleSpendCents"=GREATEST(0,"EligibleSpendCents"-previous_earn."EligibleSpendCents"),
      "PurchasesCount"=GREATEST(0,"PurchasesCount"-1),"UpdatedAtUtc"=now()
      WHERE "TenantId"=NEW."TenantId" AND "PartyId"=NEW."CustomerPartyId";
   END IF;
  END IF;
 END IF;
 RETURN NEW;
END;$body$;
-- @statement
DO $body$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='loyalty_sale_settled' AND tgrelid='sales'::regclass) THEN
  CREATE TRIGGER "loyalty_sale_settled" AFTER INSERT OR UPDATE OF "Status","PaymentStatus","ConfirmedAtUtc" ON sales
   FOR EACH ROW EXECUTE FUNCTION loyalty_on_sale_settled();
 END IF;
END $body$;
-- @statement
CREATE OR REPLACE FUNCTION loyalty_redeem_reward(
 v_tenant uuid,v_branch uuid,v_party uuid,v_reward uuid,v_request uuid,
 v_actor uuid,v_email text,v_correlation text
) RETURNS TABLE ("RedemptionId" uuid,"Code" text,"PointsBalance" bigint) LANGUAGE plpgsql AS $body$
DECLARE rw loyalty_rewards%ROWTYPE;
 acct loyalty_accounts%ROWTYPE;
 existing loyalty_redemptions%ROWTYPE;
 new_id uuid;new_code text;
BEGIN
 SELECT * INTO existing FROM loyalty_redemptions WHERE "TenantId"=v_tenant AND "RequestKey"=v_request;
 IF FOUND THEN
  IF existing."PartyId"<>v_party OR existing."RewardId"<>v_reward THEN
   RAISE EXCEPTION 'LOYALTY_IDEMPOTENCY_MISMATCH' USING ERRCODE='23514';
  END IF;
  RETURN QUERY SELECT existing."Id",existing."Code"::text,a."PointsBalance"
   FROM loyalty_accounts a WHERE a."TenantId"=v_tenant AND a."PartyId"=v_party;
  RETURN;
 END IF;
 SELECT * INTO acct FROM loyalty_accounts WHERE "TenantId"=v_tenant AND "PartyId"=v_party FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'LOYALTY_ACCOUNT_MISSING' USING ERRCODE='P0001'; END IF;
 IF NOT EXISTS (SELECT 1 FROM parties WHERE "TenantId"=v_tenant AND "Id"=v_party AND "IsActive"=true) THEN
   RAISE EXCEPTION 'LOYALTY_CUSTOMER_INACTIVE' USING ERRCODE='P0001'; END IF;
 IF EXISTS (SELECT 1 FROM sales WHERE "TenantId"=v_tenant AND "CustomerPartyId"=v_party AND "Status"=7) THEN
   RAISE EXCEPTION 'LOYALTY_PARTIAL_RETURN_RECONCILIATION_PENDING' USING ERRCODE='P0001'; END IF;
 SELECT * INTO rw FROM loyalty_rewards WHERE "TenantId"=v_tenant AND "Id"=v_reward FOR UPDATE;
 IF NOT FOUND OR rw."IsActive"<>true OR
   (rw."StartsAtUtc" IS NOT NULL AND rw."StartsAtUtc">now()) OR
   (rw."EndsAtUtc" IS NOT NULL AND rw."EndsAtUtc"<=now()) THEN
   RAISE EXCEPTION 'LOYALTY_REWARD_UNAVAILABLE' USING ERRCODE='P0001'; END IF;
 IF rw."Kind" NOT IN ('GIFT','SERVICE') THEN
   RAISE EXCEPTION 'LOYALTY_VOUCHER_REQUIRES_CHECKOUT_GATE' USING ERRCODE='P0001'; END IF;
 IF acct."PointsBalance"<rw."PointsCost" THEN
   RAISE EXCEPTION 'LOYALTY_INSUFFICIENT_POINTS' USING ERRCODE='P0001'; END IF;
 IF rw."StockAvailable" IS NOT NULL AND rw."StockAvailable"<1 THEN
   RAISE EXCEPTION 'LOYALTY_REWARD_OUT_OF_STOCK' USING ERRCODE='P0001'; END IF;
 new_id:=gen_random_uuid();new_code:='HB-'||upper(encode(gen_random_bytes(9),'hex'));
 INSERT INTO loyalty_redemptions ("Id","TenantId","BranchId","PartyId","RewardId","RequestKey","Code",
   "Kind","RewardTitle","PointsSpent","ValueCents","Status","CreatedByUserId")
 VALUES (new_id,v_tenant,v_branch,v_party,v_reward,v_request,new_code,rw."Kind",rw."Title",rw."PointsCost",rw."ValueCents",'RESERVED',v_actor);
 IF rw."StockAvailable" IS NOT NULL THEN
   UPDATE loyalty_rewards SET "StockAvailable"="StockAvailable"-1,
     "UpdatedAtUtc"=now(),"Version"="Version"+1 WHERE "Id"=rw."Id" AND "TenantId"=v_tenant;
 END IF;
 INSERT INTO loyalty_ledger ("TenantId","PartyId","RedemptionId","EventKey","Kind","PointsDelta","ActorId","RulesSnapshot")
   VALUES (v_tenant,v_party,new_id,'REDEEM:'||new_id::text,'REDEEM',-rw."PointsCost",v_actor,
   jsonb_build_object('rewardTitle',rw."Title",'rewardKind',rw."Kind",'pointsCost',rw."PointsCost"));
 UPDATE loyalty_accounts SET "PointsBalance"="PointsBalance"-rw."PointsCost",
    "LifetimeRedeemed"="LifetimeRedeemed"+rw."PointsCost","UpdatedAtUtc"=now()
 WHERE "TenantId"=v_tenant AND "PartyId"=v_party;
 INSERT INTO audit_events ("Id","TenantId","BranchId","EntityType","EntityId","Action","ActorId","ActorEmail","CorrelationId","AfterStateJson","CreatedAtUtc","Version")
 VALUES (gen_random_uuid(),v_tenant,v_branch,'LoyaltyRedemption',new_id::text,'Reserved',v_actor,v_email,v_correlation,
 jsonb_build_object('partyId',v_party,'rewardId',v_reward,'pointsSpent',rw."PointsCost"),now(),1);
 RETURN QUERY SELECT new_id,new_code,acct."PointsBalance"-rw."PointsCost";
END;$body$;
-- @statement
CREATE OR REPLACE FUNCTION loyalty_finish_redemption(
 v_tenant uuid,v_branch uuid,v_redemption uuid,v_actor uuid,v_email text,v_correlation text,
 v_action text,v_notes text
) RETURNS TABLE ("Status" text,"PointsBalance" bigint) LANGUAGE plpgsql AS $body$
DECLARE rd loyalty_redemptions%ROWTYPE;acct loyalty_accounts%ROWTYPE;
BEGIN
 SELECT * INTO rd FROM loyalty_redemptions WHERE "Id"=v_redemption AND "TenantId"=v_tenant AND "BranchId"=v_branch FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'LOYALTY_REDEMPTION_NOT_FOUND' USING ERRCODE='P0001'; END IF;
 SELECT * INTO acct FROM loyalty_accounts WHERE "TenantId"=v_tenant AND "PartyId"=rd."PartyId" FOR UPDATE;
 IF rd."Status"<> 'RESERVED' THEN RAISE EXCEPTION 'LOYALTY_REDEMPTION_ALREADY_FINAL' USING ERRCODE='P0001'; END IF;
 IF v_action='FULFILL' AND rd."Kind" IN ('GIFT','SERVICE') THEN
  IF trim(coalesce(v_notes,''))='' THEN RAISE EXCEPTION 'LOYALTY_FULFILLMENT_EVIDENCE_REQUIRED' USING ERRCODE='P0001'; END IF;
  UPDATE loyalty_redemptions SET "Status"='FULFILLED',"FulfilledByUserId"=v_actor,
   "FulfilledAtUtc"=now(),"Notes"=left(v_notes,600) WHERE "Id"=v_redemption;
 ELSIF v_action='CANCEL' THEN
  UPDATE loyalty_redemptions SET "Status"='CANCELLED',"CancelledByUserId"=v_actor,
   "CancelledAtUtc"=now(),"Notes"=left(v_notes,600) WHERE "Id"=v_redemption;
  UPDATE loyalty_rewards SET "StockAvailable"="StockAvailable"+1,"Version"="Version"+1,"UpdatedAtUtc"=now()
   WHERE "TenantId"=v_tenant AND "Id"=rd."RewardId" AND "StockAvailable" IS NOT NULL;
  INSERT INTO loyalty_ledger ("TenantId","PartyId","RedemptionId","EventKey","Kind","PointsDelta","ActorId","RulesSnapshot")
   VALUES (v_tenant,rd."PartyId",rd."Id",'REDEEM_REFUND:'||rd."Id"::text,'REDEEM_REFUND',rd."PointsSpent",v_actor,
    jsonb_build_object('reason',left(v_notes,500)));
  UPDATE loyalty_accounts SET "PointsBalance"="PointsBalance"+rd."PointsSpent",
   "LifetimeRedeemed"="LifetimeRedeemed"-rd."PointsSpent","UpdatedAtUtc"=now()
   WHERE "TenantId"=v_tenant AND "PartyId"=rd."PartyId";
 ELSE RAISE EXCEPTION 'LOYALTY_INVALID_ACTION' USING ERRCODE='P0001'; END IF;
 INSERT INTO audit_events ("Id","TenantId","BranchId","EntityType","EntityId","Action","ActorId","ActorEmail","CorrelationId","AfterStateJson","CreatedAtUtc","Version")
 VALUES (gen_random_uuid(),v_tenant,v_branch,'LoyaltyRedemption',rd."Id"::text,v_action,v_actor,v_email,v_correlation,
  jsonb_build_object('notes',left(coalesce(v_notes,''),600)),now(),1);
 RETURN QUERY SELECT v_action, a."PointsBalance" FROM loyalty_accounts a WHERE a."TenantId"=v_tenant AND a."PartyId"=rd."PartyId";
END;$body$;
-- @statement
INSERT INTO loyalty_programs ("TenantId","Enabled","EarnCentsPerPoint","CashbackBps")
 SELECT DISTINCT u."TenantId",true,500,0 FROM users u
 WHERE lower(u."Email")=lower('henriquebuzeto@hbstudio.com')
 AND u."IsActive"=true
 ON CONFLICT ("TenantId") DO NOTHING;
-- @statement
INSERT INTO role_permissions ("Id","TenantId","RoleId","PermissionKey","CreatedAtUtc","Version")
 SELECT gen_random_uuid(),r."TenantId",r."Id",k.name,now(),1
 FROM roles r CROSS JOIN (VALUES ('loyalty.view'),('loyalty.manage'),('loyalty.redeem'),('loyalty.fulfill')) k(name)
 WHERE r."Name"='Administrador Master' AND r."TenantId" IN
 (SELECT u."TenantId" FROM users u WHERE lower(u."Email")=lower('henriquebuzeto@hbstudio.com') AND u."IsActive"=true)
 ON CONFLICT ("TenantId","RoleId","PermissionKey") DO NOTHING;
-- @statement
SELECT 'loyalty migration applied without modifying existing sales/parties' AS result;
