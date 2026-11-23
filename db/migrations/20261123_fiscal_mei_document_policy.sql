-- Fiscal document policy, additive and fail-closed.
-- No policy is seeded. A legal/compliance review must approve each issuer/branch.
-- MEI PF document dispensation must be revalidated for tax changes effective in 2027.
CREATE TABLE IF NOT EXISTS fiscal_receipt_exemption_policies (
 "Id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 "TenantId" uuid NOT NULL REFERENCES tenants("Id") ON DELETE RESTRICT,
 "BranchId" uuid NOT NULL REFERENCES branches("Id") ON DELETE RESTRICT,
 "FiscalEstablishmentId" uuid NOT NULL REFERENCES fiscal_establishments("Id") ON DELETE RESTRICT,
 "Regime" integer NOT NULL CHECK ("Regime"=4),
 "BuyerType" text NOT NULL CHECK ("BuyerType"='PF'),
 "OperationType" text NOT NULL CHECK ("OperationType"='LOCAL_GOODS'),
 "LegalBasis" text NOT NULL CHECK (length(trim("LegalBasis"))>20),
 "ApprovalReference" text NOT NULL CHECK (length(trim("ApprovalReference"))>5),
 "ApprovedByUserId" uuid NOT NULL REFERENCES users("Id") ON DELETE RESTRICT,
 "ApprovedAtUtc" timestamptz NOT NULL,
 "ValidFromUtc" timestamptz NOT NULL,
 "ValidUntilUtc" timestamptz NOT NULL,
 "IsActive" boolean NOT NULL DEFAULT false,
 "CreatedAtUtc" timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT "CK_fiscal_receipt_valid_window" CHECK (
   "ValidFromUtc"<"ValidUntilUtc" AND "ValidUntilUtc"<='2027-01-01T00:00:00Z'::timestamptz
 )
);
CREATE INDEX IF NOT EXISTS "IX_fiscal_receipt_exemption_scoped"
 ON fiscal_receipt_exemption_policies ("TenantId","BranchId","FiscalEstablishmentId","ValidFromUtc","ValidUntilUtc")
 WHERE "IsActive"=true;
COMMENT ON TABLE fiscal_receipt_exemption_policies IS
 'Manual compliance approval, not a global bypass. No exemption active by default; review legislative changes before 2027.';
