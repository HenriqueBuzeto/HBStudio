-- HB Studio ERP / Loyalty P0 -- additive, repeatable, no legacy deletions
-- All monetary operations use cents; points are BIGINT, never JavaScript floats.
CREATE TABLE IF NOT EXISTS loyalty_settings (
  "TenantId" uuid PRIMARY KEY REFERENCES tenants("Id") ON DELETE RESTRICT,
  "Enabled" boolean NOT NULL DEFAULT false,
  "EnabledSinceUtc" timestamptz,
  "EarnEveryCents" integer NOT NULL DEFAULT 500 CHECK ("EarnEveryCents">0),
  "PointsPerStep" integer NOT NULL DEFAULT 1 CHECK ("PointsPerStep">0 AND "PointsPerStep"<=100),
  "CreatedAtUtc" timestamptz NOT NULL DEFAULT now(),
  "UpdatedAtUtc" timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE loyalty_settings ADD COLUMN IF NOT EXISTS "EnabledSinceUtc" timestamptz;
CREATE TABLE IF NOT EXISTS loyalty_accounts (
  "TenantId" uuid NOT NULL REFERENCES tenants("Id") ON DELETE RESTRICT,
  "PartyId" uuid NOT NULL REFERENCES parties("Id") ON DELETE RESTRICT,
  "PointsBalance" bigint NOT NULL DEFAULT 0,
  "LifetimeEarned" bigint NOT NULL DEFAULT 0 CHECK ("LifetimeEarned">=0),
  "LifetimeRedeemed" bigint NOT NULL DEFAULT 0 CHECK ("LifetimeRedeemed">=0),
  "UpdatedAtUtc" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("TenantId","PartyId")
);
CREATE TABLE IF NOT EXISTS loyalty_rewards (
  "Id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "TenantId" uuid NOT NULL REFERENCES tenants("Id") ON DELETE RESTRICT,
  "Title" varchar(140) NOT NULL,
  "Description" varchar(600),
  "Kind" varchar(24) NOT NULL CHECK ("Kind" IN ('GIFT','DISCOUNT_FIXED','DISCOUNT_PERCENT')),
  "PointsCost" bigint NOT NULL CHECK ("PointsCost">0),
  "DiscountCents" integer CHECK ("DiscountCents" IS NULL OR "DiscountCents">0),
  "DiscountPercent" integer CHECK ("DiscountPercent" IS NULL OR ("DiscountPercent" BETWEEN 1 AND 100)),
  "StockTotal" integer CHECK ("StockTotal" IS NULL OR "StockTotal">=0),
  "StockAllocated" integer NOT NULL DEFAULT 0 CHECK ("StockAllocated">=0),
  "IsActive" boolean NOT NULL DEFAULT true,
  "Version" integer NOT NULL DEFAULT 1,
  "CreatedAtUtc" timestamptz NOT NULL DEFAULT now(),
  "UpdatedAtUtc" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "CK_loyalty_reward_kind" CHECK (
    ("Kind"='GIFT' AND "DiscountCents" IS NULL AND "DiscountPercent" IS NULL)
    OR ("Kind"='DISCOUNT_FIXED' AND "DiscountCents">0 AND "DiscountPercent" IS NULL)
    OR ("Kind"='DISCOUNT_PERCENT' AND "DiscountPercent" BETWEEN 1 AND 100 AND "DiscountCents" IS NULL)
  ),
  CONSTRAINT "CK_loyalty_reward_stock" CHECK ("StockTotal" IS NULL OR "StockAllocated"<="StockTotal")
);
CREATE INDEX IF NOT EXISTS "IX_loyalty_rewards_tenant" ON loyalty_rewards("TenantId","IsActive","CreatedAtUtc");
CREATE TABLE IF NOT EXISTS loyalty_redemptions (
  "Id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "TenantId" uuid NOT NULL REFERENCES tenants("Id") ON DELETE RESTRICT,
  "PartyId" uuid NOT NULL REFERENCES parties("Id") ON DELETE RESTRICT,
  "RewardId" uuid NOT NULL REFERENCES loyalty_rewards("Id") ON DELETE RESTRICT,
  "RewardTitleSnapshot" varchar(140) NOT NULL,
  "RewardKindSnapshot" varchar(24) NOT NULL,
  "PointsSpent" bigint NOT NULL CHECK ("PointsSpent">0),
  "Status" varchar(24) NOT NULL DEFAULT 'RESERVED' CHECK ("Status" IN ('RESERVED','FULFILLED','CANCELLED')),
  "IdempotencyKey" varchar(100) NOT NULL,
  "RedeemedByUserId" uuid NOT NULL REFERENCES users("Id") ON DELETE RESTRICT,
  "CompletedAtUtc" timestamptz,
  "CreatedAtUtc" timestamptz NOT NULL DEFAULT now(),
  "UpdatedAtUtc" timestamptz NOT NULL DEFAULT now(),
  UNIQUE("TenantId","IdempotencyKey")
);
CREATE INDEX IF NOT EXISTS "IX_loyalty_redemptions_party" ON loyalty_redemptions("TenantId","PartyId","CreatedAtUtc" DESC);
CREATE TABLE IF NOT EXISTS loyalty_ledger (
  "Id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "TenantId" uuid NOT NULL REFERENCES tenants("Id") ON DELETE RESTRICT,
  "PartyId" uuid NOT NULL REFERENCES parties("Id") ON DELETE RESTRICT,
  "EventKey" varchar(150) NOT NULL,
  "Kind" varchar(32) NOT NULL CHECK ("Kind" IN ('SALE_EARN','SALE_REVERSAL','RETURN_REVERSAL','REDEMPTION_RESERVE','REDEMPTION_REFUND')),
  "PointsDelta" bigint NOT NULL CHECK ("PointsDelta"<>0),
  "SaleId" uuid REFERENCES sales("Id") ON DELETE RESTRICT,
  "RedemptionId" uuid REFERENCES loyalty_redemptions("Id") ON DELETE RESTRICT,
  "Reason" varchar(300) NOT NULL,
  "CreatedAtUtc" timestamptz NOT NULL DEFAULT now(),
  UNIQUE("TenantId","EventKey")
);
CREATE INDEX IF NOT EXISTS "IX_loyalty_ledger_party" ON loyalty_ledger("TenantId","PartyId","CreatedAtUtc" DESC);
CREATE OR REPLACE FUNCTION loyalty_ledger_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Loyalty ledger is append-only' USING ERRCODE='P0001';
END;$$;
DROP TRIGGER IF EXISTS "TR_loyalty_ledger_immutable" ON loyalty_ledger;
CREATE TRIGGER "TR_loyalty_ledger_immutable" BEFORE UPDATE OR DELETE ON loyalty_ledger
FOR EACH ROW EXECUTE FUNCTION loyalty_ledger_immutable();
-- Fail closed if any tenant association is inconsistent, independent of API JWT.
CREATE OR REPLACE FUNCTION loyalty_validate_tenant() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM parties WHERE "Id"=NEW."PartyId" AND "TenantId"=NEW."TenantId")
 THEN RAISE EXCEPTION 'Loyalty party tenant mismatch' USING ERRCODE='23514'; END IF;
 IF TG_TABLE_NAME='loyalty_redemptions' THEN
   IF NOT EXISTS(SELECT 1 FROM loyalty_rewards WHERE "Id"=NEW."RewardId" AND "TenantId"=NEW."TenantId")
      OR NOT EXISTS(SELECT 1 FROM users WHERE "Id"=NEW."RedeemedByUserId" AND "TenantId"=NEW."TenantId")
   THEN RAISE EXCEPTION 'Reward/actor tenant mismatch' USING ERRCODE='23514'; END IF;
 ELSIF TG_TABLE_NAME='loyalty_ledger' THEN
   IF NEW."SaleId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM sales WHERE "Id"=NEW."SaleId" AND "TenantId"=NEW."TenantId")
   THEN RAISE EXCEPTION 'Sale tenant mismatch' USING ERRCODE='23514'; END IF;
   IF NEW."RedemptionId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM loyalty_redemptions WHERE "Id"=NEW."RedemptionId" AND "TenantId"=NEW."TenantId" AND "PartyId"=NEW."PartyId")
   THEN RAISE EXCEPTION 'Redemption tenant mismatch' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END;$$;
DROP TRIGGER IF EXISTS "TR_loyalty_account_tenant" ON loyalty_accounts;
CREATE TRIGGER "TR_loyalty_account_tenant" BEFORE INSERT OR UPDATE ON loyalty_accounts FOR EACH ROW EXECUTE FUNCTION loyalty_validate_tenant();
DROP TRIGGER IF EXISTS "TR_loyalty_redemption_tenant" ON loyalty_redemptions;
CREATE TRIGGER "TR_loyalty_redemption_tenant" BEFORE INSERT OR UPDATE ON loyalty_redemptions FOR EACH ROW EXECUTE FUNCTION loyalty_validate_tenant();
DROP TRIGGER IF EXISTS "TR_loyalty_ledger_tenant" ON loyalty_ledger;
CREATE TRIGGER "TR_loyalty_ledger_tenant" BEFORE INSERT ON loyalty_ledger FOR EACH ROW EXECUTE FUNCTION loyalty_validate_tenant();

CREATE OR REPLACE FUNCTION loyalty_accrue_sale(p_sale_id uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_sale sales%ROWTYPE; v_settings loyalty_settings%ROWTYPE;
 v_total_cents bigint; v_paid_cents bigint; v_points bigint; v_written uuid;
BEGIN
 SELECT * INTO v_sale FROM sales WHERE "Id"=p_sale_id;
 IF NOT FOUND OR v_sale."CustomerPartyId" IS NULL OR v_sale."Status" NOT IN (4,5)
   OR v_sale."PaymentStatus"<>4 OR v_sale."ConfirmedAtUtc" IS NULL THEN RETURN; END IF;
 SELECT * INTO v_settings FROM loyalty_settings WHERE "TenantId"=v_sale."TenantId" AND "Enabled"=true;
 IF NOT FOUND OR v_settings."EnabledSinceUtc" IS NULL OR v_sale."ConfirmedAtUtc"<v_settings."EnabledSinceUtc" THEN RETURN; END IF;
 IF NOT EXISTS(SELECT 1 FROM parties WHERE "Id"=v_sale."CustomerPartyId" AND "TenantId"=v_sale."TenantId" AND "IsActive"=true) THEN RETURN; END IF;
 SELECT GREATEST(0,round((COALESCE(SUM(i."Quantity"*i."UnitPrice"-i."Discount"),0)
    -v_sale."DiscountTotal"+v_sale."ChargesTotal")*100)::bigint) INTO v_total_cents
 FROM sale_items i WHERE i."TenantId"=v_sale."TenantId" AND i."SaleId"=p_sale_id;
 SELECT round(COALESCE(SUM(p."Amount"),0)*100)::bigint INTO v_paid_cents
 FROM sale_payment_intents p WHERE p."TenantId"=v_sale."TenantId" AND p."SaleId"=p_sale_id
 AND p."Status"=2 AND p."ConfirmedAtUtc" IS NOT NULL;
 IF v_total_cents<=0 OR v_paid_cents<v_total_cents THEN RETURN; END IF;
 v_points=(v_total_cents/v_settings."EarnEveryCents")*v_settings."PointsPerStep";
 IF v_points<=0 THEN RETURN; END IF;
 INSERT INTO loyalty_accounts("TenantId","PartyId")
 VALUES (v_sale."TenantId",v_sale."CustomerPartyId") ON CONFLICT DO NOTHING;
 -- Serialization via account lock; deterministic, additive ledger protects replay.
 PERFORM 1 FROM loyalty_accounts WHERE "TenantId"=v_sale."TenantId" AND "PartyId"=v_sale."CustomerPartyId" FOR UPDATE;
 INSERT INTO loyalty_ledger("TenantId","PartyId","EventKey","Kind","PointsDelta","SaleId","Reason")
 VALUES(v_sale."TenantId",v_sale."CustomerPartyId",'SALE_EARN:'||p_sale_id,'SALE_EARN',v_points,p_sale_id,'Pagamento da venda confirmado')
 ON CONFLICT("TenantId","EventKey") DO NOTHING RETURNING "Id" INTO v_written;
 IF v_written IS NOT NULL THEN
  UPDATE loyalty_accounts SET "PointsBalance"="PointsBalance"+v_points,"LifetimeEarned"="LifetimeEarned"+v_points,"UpdatedAtUtc"=now()
  WHERE "TenantId"=v_sale."TenantId" AND "PartyId"=v_sale."CustomerPartyId";
 END IF;
END;$$;

CREATE OR REPLACE FUNCTION loyalty_reverse_sale(p_sale_id uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_sale sales%ROWTYPE; v_points bigint; v_written uuid;
BEGIN
 SELECT * INTO v_sale FROM sales WHERE "Id"=p_sale_id;
 IF NOT FOUND OR (v_sale."Status" NOT IN (6,8) AND v_sale."PaymentStatus"<>7) OR v_sale."CustomerPartyId" IS NULL THEN RETURN; END IF;
 SELECT COALESCE(SUM("PointsDelta"),0)::bigint INTO v_points FROM loyalty_ledger
 WHERE "TenantId"=v_sale."TenantId" AND "SaleId"=p_sale_id AND "Kind" IN ('SALE_EARN','RETURN_REVERSAL');
 IF v_points<=0 THEN RETURN; END IF;
 PERFORM 1 FROM loyalty_accounts WHERE "TenantId"=v_sale."TenantId" AND "PartyId"=v_sale."CustomerPartyId" FOR UPDATE;
 INSERT INTO loyalty_ledger("TenantId","PartyId","EventKey","Kind","PointsDelta","SaleId","Reason")
 VALUES(v_sale."TenantId",v_sale."CustomerPartyId",'SALE_REVERSAL:'||p_sale_id,'SALE_REVERSAL',-v_points,p_sale_id,'Cancelamento ou devolução total de venda')
 ON CONFLICT("TenantId","EventKey") DO NOTHING RETURNING "Id" INTO v_written;
 IF v_written IS NOT NULL THEN
  UPDATE loyalty_accounts SET "PointsBalance"="PointsBalance"-v_points,"UpdatedAtUtc"=now()
   WHERE "TenantId"=v_sale."TenantId" AND "PartyId"=v_sale."CustomerPartyId";
 END IF;
END;$$;
CREATE OR REPLACE FUNCTION loyalty_sale_event() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW."Status" IN (4,5) AND NEW."PaymentStatus"=4 THEN PERFORM loyalty_accrue_sale(NEW."Id"); END IF;
 IF NEW."Status" IN (6,8) OR NEW."PaymentStatus"=7 THEN PERFORM loyalty_reverse_sale(NEW."Id"); END IF;
 RETURN NEW;
END;$$;
DROP TRIGGER IF EXISTS "TR_loyalty_sale_event" ON sales;
CREATE TRIGGER "TR_loyalty_sale_event" AFTER INSERT OR UPDATE OF "Status","PaymentStatus","ConfirmedAtUtc","CustomerPartyId" ON sales
FOR EACH ROW EXECUTE FUNCTION loyalty_sale_event();
CREATE OR REPLACE FUNCTION loyalty_payment_event() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW."Status"=2 AND NEW."ConfirmedAtUtc" IS NOT NULL THEN
   PERFORM loyalty_accrue_sale(NEW."SaleId");
 END IF;
 RETURN NEW;
END;$$;
DROP TRIGGER IF EXISTS "TR_loyalty_payment_event" ON sale_payment_intents;
CREATE TRIGGER "TR_loyalty_payment_event" AFTER INSERT OR UPDATE OF "Status","ConfirmedAtUtc" ON sale_payment_intents
FOR EACH ROW EXECUTE FUNCTION loyalty_payment_event();

CREATE OR REPLACE FUNCTION loyalty_reserve_reward(
 p_tenant uuid,p_party uuid,p_reward uuid,p_actor uuid,p_key text
) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v_account loyalty_accounts%ROWTYPE; v_reward loyalty_rewards%ROWTYPE;
 v_prior loyalty_redemptions%ROWTYPE; v_id uuid;
BEGIN
 IF p_key IS NULL OR length(p_key)<16 OR length(p_key)>100 THEN
  RAISE EXCEPTION 'Invalid idempotency key' USING ERRCODE='22023'; END IF;
 SELECT * INTO v_prior FROM loyalty_redemptions WHERE "TenantId"=p_tenant AND "IdempotencyKey"=p_key;
 IF FOUND THEN
   IF v_prior."PartyId"<>p_party OR v_prior."RewardId"<>p_reward THEN
     RAISE EXCEPTION 'Idempotency conflict' USING ERRCODE='23505'; END IF;
   RETURN v_prior."Id";
 END IF;
 IF NOT EXISTS(SELECT 1 FROM parties WHERE "Id"=p_party AND "TenantId"=p_tenant AND "IsActive"=true)
 OR NOT EXISTS(SELECT 1 FROM users WHERE "Id"=p_actor AND "TenantId"=p_tenant AND "IsActive"=true)
 THEN RAISE EXCEPTION 'Party or actor not authorized for tenant' USING ERRCODE='23514'; END IF;
 INSERT INTO loyalty_accounts("TenantId","PartyId") VALUES(p_tenant,p_party) ON CONFLICT DO NOTHING;
 SELECT * INTO v_account FROM loyalty_accounts WHERE "TenantId"=p_tenant AND "PartyId"=p_party FOR UPDATE;
 SELECT * INTO v_prior FROM loyalty_redemptions WHERE "TenantId"=p_tenant AND "IdempotencyKey"=p_key;
 IF FOUND THEN
   IF v_prior."PartyId"<>p_party OR v_prior."RewardId"<>p_reward THEN
      RAISE EXCEPTION 'Idempotency conflict' USING ERRCODE='23505'; END IF;
   RETURN v_prior."Id";
 END IF;
 SELECT * INTO v_reward FROM loyalty_rewards WHERE "Id"=p_reward AND "TenantId"=p_tenant AND "IsActive"=true FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Reward unavailable' USING ERRCODE='23514'; END IF;
 IF v_reward."StockTotal" IS NOT NULL AND v_reward."StockAllocated">=v_reward."StockTotal"
 THEN RAISE EXCEPTION 'Reward stock depleted' USING ERRCODE='23514'; END IF;
 IF v_account."PointsBalance"<v_reward."PointsCost"
 THEN RAISE EXCEPTION 'Insufficient points' USING ERRCODE='23514'; END IF;
 v_id=gen_random_uuid();
 INSERT INTO loyalty_redemptions("Id","TenantId","PartyId","RewardId","RewardTitleSnapshot","RewardKindSnapshot","PointsSpent","Status","IdempotencyKey","RedeemedByUserId")
 VALUES(v_id,p_tenant,p_party,p_reward,v_reward."Title",v_reward."Kind",v_reward."PointsCost",'RESERVED',p_key,p_actor);
 UPDATE loyalty_accounts SET "PointsBalance"="PointsBalance"-v_reward."PointsCost",
 "LifetimeRedeemed"="LifetimeRedeemed"+v_reward."PointsCost","UpdatedAtUtc"=now()
 WHERE "TenantId"=p_tenant AND "PartyId"=p_party;
 UPDATE loyalty_rewards SET "StockAllocated"="StockAllocated"+1,"Version"="Version"+1,"UpdatedAtUtc"=now()
 WHERE "TenantId"=p_tenant AND "Id"=p_reward;
 INSERT INTO loyalty_ledger("TenantId","PartyId","EventKey","Kind","PointsDelta","RedemptionId","Reason")
 VALUES(p_tenant,p_party,'REDEMPTION_RESERVE:'||v_id,'REDEMPTION_RESERVE',-v_reward."PointsCost",v_id,'Resgate reservado; não entregue nem aplicado no PDV');
 RETURN v_id;
END;$$;

CREATE OR REPLACE FUNCTION loyalty_update_redemption(
 p_tenant uuid,p_redemption uuid,p_actor uuid,p_action text
) RETURNS text LANGUAGE plpgsql AS $$
DECLARE v_row loyalty_redemptions%ROWTYPE;
BEGIN
 SELECT * INTO v_row FROM loyalty_redemptions WHERE "TenantId"=p_tenant AND "Id"=p_redemption FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Redemption not found' USING ERRCODE='23514'; END IF;
 IF v_row."Status"<>'RESERVED' THEN RAISE EXCEPTION 'Redemption already processed' USING ERRCODE='23514'; END IF;
 IF NOT EXISTS(SELECT 1 FROM users WHERE "Id"=p_actor AND "TenantId"=p_tenant AND "IsActive"=true)
 THEN RAISE EXCEPTION 'Actor invalid' USING ERRCODE='23514'; END IF;
 IF p_action='CANCEL' THEN
  UPDATE loyalty_redemptions SET "Status"='CANCELLED',"CompletedAtUtc"=now(),"UpdatedAtUtc"=now() WHERE "Id"=p_redemption;
  UPDATE loyalty_accounts SET "PointsBalance"="PointsBalance"+v_row."PointsSpent",
   "LifetimeRedeemed"="LifetimeRedeemed"-v_row."PointsSpent","UpdatedAtUtc"=now()
  WHERE "TenantId"=p_tenant AND "PartyId"=v_row."PartyId";
  UPDATE loyalty_rewards SET "StockAllocated"="StockAllocated"-1,"Version"="Version"+1,"UpdatedAtUtc"=now()
  WHERE "Id"=v_row."RewardId" AND "TenantId"=p_tenant;
  INSERT INTO loyalty_ledger("TenantId","PartyId","EventKey","Kind","PointsDelta","RedemptionId","Reason")
  VALUES(p_tenant,v_row."PartyId",'REDEMPTION_REFUND:'||p_redemption,'REDEMPTION_REFUND',v_row."PointsSpent",p_redemption,'Cancelamento de reserva de benefício');
 ELSIF p_action='FULFILL_GIFT' AND v_row."RewardKindSnapshot"='GIFT' THEN
  UPDATE loyalty_redemptions SET "Status"='FULFILLED',"CompletedAtUtc"=now(),"UpdatedAtUtc"=now() WHERE "Id"=p_redemption;
 ELSE
  RAISE EXCEPTION 'Unsupported reward settlement; checkout linkage pending' USING ERRCODE='23514';
 END IF;
 RETURN p_action;
END;$$;
-- Existing tenants remain unconfigured; only explicit admin setup enables accrual.

-- Refund reversal is triggered only after inspection and approved restocking (SaleReturnStatus=2).
-- Negative balances are intentionally possible after returns: future redemptions must be denied.
CREATE OR REPLACE FUNCTION loyalty_reverse_return(p_return_id uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_return sale_returns%ROWTYPE; v_sale sales%ROWTYPE; v_original bigint;
 v_available bigint; v_total numeric; v_refund numeric; v_points bigint; v_written uuid;
BEGIN
 SELECT * INTO v_return FROM sale_returns WHERE "Id"=p_return_id AND "Status"=2;
 IF NOT FOUND THEN RETURN; END IF;
 SELECT * INTO v_sale FROM sales WHERE "Id"=v_return."SaleId" AND "TenantId"=v_return."TenantId";
 IF NOT FOUND OR v_sale."CustomerPartyId" IS NULL OR v_sale."Status" IN (6,8) THEN RETURN; END IF;
 SELECT COALESCE(SUM("PointsDelta"),0)::bigint INTO v_original FROM loyalty_ledger
 WHERE "TenantId"=v_sale."TenantId" AND "SaleId"=v_sale."Id" AND "Kind"='SALE_EARN';
 IF v_original<=0 THEN RETURN; END IF;
 PERFORM 1 FROM loyalty_accounts WHERE "TenantId"=v_sale."TenantId" AND "PartyId"=v_sale."CustomerPartyId" FOR UPDATE;
 SELECT GREATEST(0,COALESCE(SUM("PointsDelta"),0))::bigint INTO v_available FROM loyalty_ledger
 WHERE "TenantId"=v_sale."TenantId" AND "SaleId"=v_sale."Id"
 AND "Kind" IN ('SALE_EARN','RETURN_REVERSAL','SALE_REVERSAL');
 IF v_available<=0 THEN RETURN; END IF;
 SELECT GREATEST(0,COALESCE(SUM("Quantity"*"UnitPrice"-"Discount"),0)-v_sale."DiscountTotal"+v_sale."ChargesTotal")
 INTO v_total FROM sale_items WHERE "TenantId"=v_sale."TenantId" AND "SaleId"=v_sale."Id";
 SELECT COALESCE(SUM("RefundAmount"),0) INTO v_refund FROM sale_return_items
 WHERE "TenantId"=v_sale."TenantId" AND "SaleReturnId"=p_return_id;
 IF v_total<=0 OR v_refund<=0 THEN RETURN; END IF;
 v_points=LEAST(v_available,floor(v_original*LEAST(v_refund/v_total,1))::bigint);
 IF v_points<=0 THEN RETURN; END IF;
 INSERT INTO loyalty_ledger("TenantId","PartyId","EventKey","Kind","PointsDelta","SaleId","Reason")
 VALUES(v_sale."TenantId",v_sale."CustomerPartyId",'RETURN_REVERSAL:'||p_return_id,'RETURN_REVERSAL',-v_points,v_sale."Id",'Devolução aprovada com estorno proporcional')
 ON CONFLICT("TenantId","EventKey") DO NOTHING RETURNING "Id" INTO v_written;
 IF v_written IS NOT NULL THEN
   UPDATE loyalty_accounts SET "PointsBalance"="PointsBalance"-v_points,"UpdatedAtUtc"=now()
   WHERE "TenantId"=v_sale."TenantId" AND "PartyId"=v_sale."CustomerPartyId";
 END IF;
END;$$;
CREATE OR REPLACE FUNCTION loyalty_return_event() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW."Status"=2 THEN PERFORM loyalty_reverse_return(NEW."Id"); END IF;
 RETURN NEW;
END;$$;
DROP TRIGGER IF EXISTS "TR_loyalty_return_event" ON sale_returns;
CREATE TRIGGER "TR_loyalty_return_event" AFTER INSERT OR UPDATE OF "Status" ON sale_returns
FOR EACH ROW EXECUTE FUNCTION loyalty_return_event();

-- Only roles with existing access.manage governance receive administration keys.
-- No role-name matching, no user/job-title grants, no expansion to operational roles.
INSERT INTO role_permissions("TenantId","RoleId","PermissionKey","Id","CreatedAtUtc","Version")
SELECT DISTINCT rp."TenantId",rp."RoleId",k.permission,gen_random_uuid(),now(),1
FROM role_permissions rp
CROSS JOIN (VALUES ('loyalty.view'),('loyalty.manage'),('loyalty.redeem')) AS k(permission)
WHERE rp."PermissionKey"='access.manage'
ON CONFLICT("TenantId","RoleId","PermissionKey") DO NOTHING;
