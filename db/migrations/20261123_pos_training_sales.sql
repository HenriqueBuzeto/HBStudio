-- Isolated, immutable simulation-only sales. Never post stock/finance/fiscal.
-- This table must NOT be included in commercial sales totals or tax revenue.
CREATE TABLE IF NOT EXISTS pos_training_sales (
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
CREATE INDEX IF NOT EXISTS "IX_pos_training_sales_scope"
 ON pos_training_sales ("TenantId","BranchId","CreatedAtUtc" DESC);
COMMENT ON TABLE pos_training_sales IS
 'SIMULATION ONLY. No legal/commercial sale, no bank receipt, no payment intent, no fiscal document, no warehouse/Kardex or financial ledger posting.';
