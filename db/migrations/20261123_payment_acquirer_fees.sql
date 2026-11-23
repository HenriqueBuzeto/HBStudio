-- Enterprise acquiring fee configurations: additive, immutable versions, no seeded percentages.
-- Fee quote describes an estimated net receivable, not an authorization, capture or settlement.
CREATE TABLE IF NOT EXISTS payment_acquirer_profiles (
  "Id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "TenantId" uuid NOT NULL REFERENCES tenants("Id") ON DELETE RESTRICT,
  "BranchId" uuid NOT NULL REFERENCES branches("Id") ON DELETE RESTRICT,
  "Name" varchar(120) NOT NULL CHECK (length(trim("Name")) BETWEEN 2 AND 120),
  "Provider" varchar(120) NOT NULL CHECK (length(trim("Provider")) BETWEEN 2 AND 120),
  "IsActive" boolean NOT NULL DEFAULT true,
  "CurrentVersion" integer NOT NULL DEFAULT 0 CHECK ("CurrentVersion" >= 0),
  "CreatedByUserId" uuid NOT NULL REFERENCES users("Id") ON DELETE RESTRICT,
  "CreatedAtUtc" timestamptz NOT NULL DEFAULT now(),
  "UpdatedAtUtc" timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("TenantId","BranchId","Id"),
  UNIQUE ("TenantId","BranchId","Name")
);

CREATE TABLE IF NOT EXISTS payment_acquirer_rate_versions (
  "Id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "TenantId" uuid NOT NULL,
  "BranchId" uuid NOT NULL,
  "ProfileId" uuid NOT NULL,
  "Version" integer NOT NULL CHECK ("Version" >= 1),
  "EffectiveAtUtc" timestamptz NOT NULL DEFAULT now(),
  "Notes" varchar(500),
  "CreatedByUserId" uuid NOT NULL REFERENCES users("Id") ON DELETE RESTRICT,
  "CreatedAtUtc" timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("TenantId","BranchId","Id"),
  UNIQUE ("TenantId","BranchId","ProfileId","Version"),
  FOREIGN KEY ("TenantId","BranchId","ProfileId")
    REFERENCES payment_acquirer_profiles("TenantId","BranchId","Id") ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS payment_acquirer_rate_rules (
  "Id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "TenantId" uuid NOT NULL,
  "BranchId" uuid NOT NULL,
  "RateVersionId" uuid NOT NULL,
  "Method" varchar(12) NOT NULL CHECK ("Method" IN ('PIX','DEBIT','CREDIT')),
  "Installments" integer NOT NULL CHECK ("Installments" BETWEEN 1 AND 18),
  "MdrBps" integer NOT NULL CHECK ("MdrBps" BETWEEN 0 AND 9999),
  "AnticipationBps" integer NOT NULL CHECK ("AnticipationBps" BETWEEN 0 AND 9999),
  "FixedFeeCents" integer NOT NULL CHECK ("FixedFeeCents" BETWEEN 0 AND 1000000),
  "SettlementDays" integer NOT NULL CHECK ("SettlementDays" BETWEEN 0 AND 365),
  "SettlementMode" varchar(8) NOT NULL CHECK ("SettlementMode" IN ('SINGLE','MONTHLY')),
  "Enabled" boolean NOT NULL DEFAULT true,
  "CreatedAtUtc" timestamptz NOT NULL DEFAULT now(),
  CHECK ("Method"='CREDIT' OR "Installments"=1),
  CHECK ("MdrBps"+"AnticipationBps"<10000),
  CHECK ("SettlementMode"='SINGLE' OR "Method"='CREDIT'),
  UNIQUE ("TenantId","BranchId","Id"),
  UNIQUE ("TenantId","BranchId","RateVersionId","Method","Installments"),
  FOREIGN KEY ("TenantId","BranchId","RateVersionId")
    REFERENCES payment_acquirer_rate_versions("TenantId","BranchId","Id") ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS "UX_sale_payment_intents_tenant_id"
 ON sale_payment_intents ("TenantId","Id");

-- Historic snapshot: ONLY the eventual verified payment coordinator may write it.
-- No triggers are installed that would make a pending payment look settled.
CREATE TABLE IF NOT EXISTS payment_acquirer_fee_snapshots (
  "Id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "TenantId" uuid NOT NULL REFERENCES tenants("Id") ON DELETE RESTRICT,
  "BranchId" uuid NOT NULL REFERENCES branches("Id") ON DELETE RESTRICT,
  "SalePaymentIntentId" uuid NOT NULL,
  "RateRuleId" uuid NOT NULL,
  "GrossCents" bigint NOT NULL CHECK ("GrossCents">0),
  "MdrFeeCents" bigint NOT NULL CHECK ("MdrFeeCents">=0),
  "AnticipationFeeCents" bigint NOT NULL CHECK ("AnticipationFeeCents">=0),
  "FixedFeeCents" bigint NOT NULL CHECK ("FixedFeeCents">=0),
  "NetExpectedCents" bigint NOT NULL CHECK ("NetExpectedCents">=0),
  "Status" varchar(14) NOT NULL DEFAULT 'EXPECTED' CHECK ("Status" IN ('EXPECTED','SETTLED','REVERSED')),
  "NetSettledCents" bigint NULL CHECK ("NetSettledCents" IS NULL OR "NetSettledCents">=0),
  "SettledAtUtc" timestamptz NULL,
  "ProcessorReference" varchar(160),
  "CreatedAtUtc" timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("TenantId","SalePaymentIntentId"),
  FOREIGN KEY ("TenantId","SalePaymentIntentId") REFERENCES sale_payment_intents("TenantId","Id") ON DELETE RESTRICT,
  FOREIGN KEY ("TenantId","BranchId","RateRuleId") REFERENCES payment_acquirer_rate_rules("TenantId","BranchId","Id") ON DELETE RESTRICT,
  CHECK ("GrossCents"="MdrFeeCents"+"AnticipationFeeCents"+"FixedFeeCents"+"NetExpectedCents"),
  CHECK (("Status"='SETTLED' AND "NetSettledCents" IS NOT NULL AND "SettledAtUtc" IS NOT NULL)
      OR ("Status"<>'SETTLED' AND "NetSettledCents" IS NULL AND "SettledAtUtc" IS NULL))
);

CREATE INDEX IF NOT EXISTS "IX_payment_acquirer_profiles_scope" ON payment_acquirer_profiles("TenantId","BranchId","IsActive");
CREATE INDEX IF NOT EXISTS "IX_payment_acquirer_snapshot_scope" ON payment_acquirer_fee_snapshots("TenantId","BranchId","Status");

COMMENT ON TABLE payment_acquirer_rate_rules IS
 'MDR, antecipacao efetiva contratada e tarifas fixas por operadora e 1-18 parcelas. Sem juros repassados ao comprador.';
COMMENT ON TABLE payment_acquirer_fee_snapshots IS
 'Snapshots futuros de pagamentos verificados. EXPECTED nao equivale a liquidado; reconciliar retorno adquirente antes de SETTLED.';
