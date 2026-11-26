-- Isolated, immutable simulation-only sales. Never post stock/finance/fiscal.
-- This table must NOT be included in commercial sales totals or tax revenue.
CREATE TABLE IF NOT EXISTS pos_training_checkout_records (
 "Id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 "TenantId" uuid NOT NULL REFERENCES tenants("Id") ON DELETE RESTRICT,
 "BranchId" uuid NOT NULL REFERENCES branches("Id") ON DELETE RESTRICT,
 "CreatedByUserId" uuid NOT NULL REFERENCES users("Id") ON DELETE RESTRICT,
 "CustomerPartyId" uuid NULL REFERENCES parties("Id") ON DELETE RESTRICT,
 "SellerUserId" uuid NOT NULL REFERENCES users("Id") ON DELETE RESTRICT,
 "RequestKey" uuid NOT NULL,
 "Number" varchar(40) NOT NULL,
 "PaymentMethod" varchar(15) NOT NULL CHECK ("PaymentMethod" IN ('CASH','PIX','CREDIT','DEBIT')),
 "Installments" integer NOT NULL CHECK ("Installments" BETWEEN 1 AND 18),
 "ItemsSnapshot" jsonb NOT NULL CHECK(jsonb_typeof("ItemsSnapshot")='array' AND jsonb_array_length("ItemsSnapshot") BETWEEN 1 AND 100),
 "SubtotalCents" bigint NOT NULL CHECK ("SubtotalCents">0),
 "DiscountCents" bigint NOT NULL DEFAULT 0 CHECK ("DiscountCents">=0),
 "TotalCents" bigint NOT NULL CHECK ("TotalCents">0 AND "TotalCents"="SubtotalCents"-"DiscountCents"),
 "Status" varchar(12) NOT NULL DEFAULT 'SIMULATED' CHECK ("Status" IN ('SIMULATED','VOIDED')),
 "CreatedAtUtc" timestamptz NOT NULL DEFAULT now(),
 "VoidedAtUtc" timestamptz NULL,
 "VoidedByUserId" uuid NULL REFERENCES users("Id") ON DELETE RESTRICT,
 "VoidReason" varchar(500) NULL,
 "RequestHash" varchar(64) NOT NULL CHECK ("RequestHash" ~ '^[a-f0-9]{64}$'),
 UNIQUE ("TenantId","BranchId","RequestKey"),
 UNIQUE ("TenantId","BranchId","Number"),
 UNIQUE ("TenantId","BranchId","Id"),
 CHECK (("Status"='SIMULATED' AND "VoidedAtUtc" IS NULL AND "VoidedByUserId" IS NULL)
  OR ("Status"='VOIDED' AND "VoidedAtUtc" IS NOT NULL AND "VoidedByUserId" IS NOT NULL AND length(trim(COALESCE("VoidReason",'')))>3))
);
CREATE INDEX IF NOT EXISTS "IX_pos_training_checkout_records_scope"
 ON pos_training_checkout_records ("TenantId","BranchId","CreatedAtUtc" DESC);
COMMENT ON TABLE pos_training_checkout_records IS
 'SIMULATION ONLY. No legal/commercial sale, no bank receipt, no payment intent, no fiscal document, no warehouse/Kardex or financial ledger posting.';

-- Composite tenant ownership prevents connecting training records to a
-- customer, seller or branch in another company even from direct SQL.
CREATE UNIQUE INDEX IF NOT EXISTS "UX_training_branch_tenant_id"
 ON branches ("TenantId","Id");
CREATE UNIQUE INDEX IF NOT EXISTS "UX_training_user_tenant_id"
 ON users ("TenantId","Id");
CREATE UNIQUE INDEX IF NOT EXISTS "UX_training_party_tenant_id"
 ON parties ("TenantId","Id");
ALTER TABLE pos_training_checkout_records
 ADD CONSTRAINT "FK_training_branch_tenant"
 FOREIGN KEY ("TenantId","BranchId") REFERENCES branches("TenantId","Id") ON DELETE RESTRICT;
ALTER TABLE pos_training_checkout_records
 ADD CONSTRAINT "FK_training_creator_tenant"
 FOREIGN KEY ("TenantId","CreatedByUserId") REFERENCES users("TenantId","Id") ON DELETE RESTRICT;
ALTER TABLE pos_training_checkout_records
 ADD CONSTRAINT "FK_training_seller_tenant"
 FOREIGN KEY ("TenantId","SellerUserId") REFERENCES users("TenantId","Id") ON DELETE RESTRICT;
ALTER TABLE pos_training_checkout_records
 ADD CONSTRAINT "FK_training_customer_tenant"
 FOREIGN KEY ("TenantId","CustomerPartyId") REFERENCES parties("TenantId","Id") ON DELETE RESTRICT;
ALTER TABLE pos_training_checkout_records
 ADD CONSTRAINT "FK_training_void_actor_tenant"
 FOREIGN KEY ("TenantId","VoidedByUserId") REFERENCES users("TenantId","Id") ON DELETE RESTRICT;

-- No one may rewrite or delete historic simulated prices/parties/amounts.
-- The only legal mutation is SIMULATED -> VOIDED with timestamp and reason.
CREATE OR REPLACE FUNCTION pos_training_checkout_immutable()
RETURNS trigger LANGUAGE plpgsql AS $training_guard$
BEGIN
 IF TG_OP='DELETE' THEN
  RAISE EXCEPTION 'TRAINING_DELETE_FORBIDDEN' USING ERRCODE='23514';
 END IF;
 IF OLD."Status"<>'SIMULATED' OR NEW."Status"<>'VOIDED'
   OR NEW."VoidedAtUtc" IS NULL OR NEW."VoidedByUserId" IS NULL
   OR length(trim(COALESCE(NEW."VoidReason",'')))<4
   OR (to_jsonb(OLD)-'Status'-'VoidedAtUtc'-'VoidedByUserId'-'VoidReason')
    IS DISTINCT FROM
      (to_jsonb(NEW)-'Status'-'VoidedAtUtc'-'VoidedByUserId'-'VoidReason')
 THEN RAISE EXCEPTION 'TRAINING_SNAPSHOT_IMMUTABLE' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $training_guard$;
CREATE TRIGGER "TR_training_checkout_immutable"
 BEFORE UPDATE OR DELETE ON pos_training_checkout_records
 FOR EACH ROW EXECUTE FUNCTION pos_training_checkout_immutable();
