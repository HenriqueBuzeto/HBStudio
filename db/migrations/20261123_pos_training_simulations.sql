-- Training sales are simulations, never recognized as commercial/financial sales.
-- Tenant/branch scoped, physically separate from sales, cash, stock and fiscal ledgers.
CREATE TABLE IF NOT EXISTS pos_training_sales (
 "Id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 "TenantId" uuid NOT NULL REFERENCES tenants("Id") ON DELETE RESTRICT,
 "BranchId" uuid NOT NULL REFERENCES branches("Id") ON DELETE RESTRICT,
 "CustomerPartyId" uuid NULL REFERENCES parties("Id") ON DELETE RESTRICT,
 "SellerUserId" uuid NOT NULL REFERENCES users("Id") ON DELETE RESTRICT,
 "CreatedByUserId" uuid NOT NULL REFERENCES users("Id") ON DELETE RESTRICT,
 "IdempotencyKey" uuid NOT NULL,
 "PayloadHash" text NOT NULL CHECK (length("PayloadHash")=64),
 "TrainingNumber" text NOT NULL,
 "PaymentMethod" integer NOT NULL CHECK ("PaymentMethod" BETWEEN 1 AND 4),
 "Installments" integer NOT NULL CHECK ("Installments" BETWEEN 1 AND 18),
 "SubtotalCents" bigint NOT NULL CHECK ("SubtotalCents">=0),
 "DiscountCents" bigint NOT NULL CHECK ("DiscountCents">=0),
 "TotalCents" bigint NOT NULL CHECK ("TotalCents">0),
 "Status" text NOT NULL DEFAULT 'SIMULATED' CHECK ("Status" IN ('SIMULATED','CANCELLED')),
 "CreatedAtUtc" timestamptz NOT NULL DEFAULT now(),
 "CancelledAtUtc" timestamptz NULL,
 "CancelledByUserId" uuid NULL REFERENCES users("Id") ON DELETE RESTRICT,
 "CancellationReason" text NULL,
 CONSTRAINT "CK_pos_training_total" CHECK ("SubtotalCents"-"DiscountCents"="TotalCents"),
 CONSTRAINT "CK_pos_training_installments" CHECK ("PaymentMethod"=3 OR "Installments"=1),
 CONSTRAINT "UQ_pos_training_idempotency" UNIQUE ("TenantId","BranchId","IdempotencyKey"),
 CONSTRAINT "UQ_pos_training_human_number" UNIQUE ("TenantId","BranchId","TrainingNumber"),
 CONSTRAINT "UQ_pos_training_scoped_id" UNIQUE ("TenantId","BranchId","Id")
);
CREATE TABLE IF NOT EXISTS pos_training_sale_items (
 "Id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 "TenantId" uuid NOT NULL,
 "BranchId" uuid NOT NULL,
 "TrainingSaleId" uuid NOT NULL,
 "ProductSkuId" uuid NOT NULL REFERENCES product_skus("Id") ON DELETE RESTRICT,
 "SkuCode" text NOT NULL,
 "Description" text NOT NULL,
 "Quantity" integer NOT NULL CHECK ("Quantity" BETWEEN 1 AND 100),
 "UnitPriceCents" bigint NOT NULL CHECK ("UnitPriceCents">=0),
 "CreatedAtUtc" timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY ("TenantId","BranchId","TrainingSaleId")
 REFERENCES pos_training_sales("TenantId","BranchId","Id") ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS "IX_pos_training_sale_list"
 ON pos_training_sales("TenantId","BranchId","CreatedAtUtc" DESC);
CREATE INDEX IF NOT EXISTS "IX_pos_training_items_sale"
 ON pos_training_sale_items("TenantId","BranchId","TrainingSaleId");
COMMENT ON TABLE pos_training_sales IS
 'SIMULATION ONLY: not a tax sale, stock operation, payment, cash posting, journal, receivable, or revenue. The printer must show SIMULACAO.';
