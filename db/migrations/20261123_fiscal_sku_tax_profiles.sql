-- Fiscal product taxonomy: classification only, never generates/authorizes invoice.
-- Must be reviewed by a tax professional for NCM/CEST/CFOP/CSOSN and operation.
CREATE TABLE IF NOT EXISTS fiscal_sku_tax_profiles (
 "Id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 "TenantId" uuid NOT NULL REFERENCES tenants("Id") ON DELETE RESTRICT,
 "BranchId" uuid NOT NULL REFERENCES branches("Id") ON DELETE RESTRICT,
 "ProductSkuId" uuid NOT NULL REFERENCES product_skus("Id") ON DELETE RESTRICT,
 "FiscalModel" integer NOT NULL CHECK ("FiscalModel" IN (55,65)),
 "Regime" integer NOT NULL CHECK ("Regime" IN (1,2,3,4)),
 "Ncm" text NOT NULL CHECK ("Ncm" ~ '^[0-9]{8}$'),
 "Cest" text NULL CHECK ("Cest" IS NULL OR "Cest" ~ '^[0-9]{7}$'),
 "Cfop" text NOT NULL CHECK ("Cfop" ~ '^[0-9]{4}$'),
 "Csosn" text NULL CHECK ("Csosn" IS NULL OR "Csosn" ~ '^[0-9]{3}$'),
 "Cst" text NULL CHECK ("Cst" IS NULL OR "Cst" ~ '^[0-9]{2}$'),
 "OriginCode" integer NOT NULL CHECK ("OriginCode" BETWEEN 0 AND 8),
 "LegalBasis" text NOT NULL CHECK (length(trim("LegalBasis"))>=12),
 "ApprovedByUserId" uuid NOT NULL REFERENCES users("Id") ON DELETE RESTRICT,
 "ApprovedAtUtc" timestamptz NOT NULL,
 "ValidFromUtc" timestamptz NOT NULL DEFAULT now(),
 "ValidUntilUtc" timestamptz NULL,
 "IsActive" boolean NOT NULL DEFAULT false,
 "CreatedAtUtc" timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT "CK_fiscal_sku_tax_profile_window" CHECK ("ValidUntilUtc" IS NULL OR "ValidUntilUtc">"ValidFromUtc"),
 CONSTRAINT "CK_fiscal_sku_tax_profile_mei_nfce" CHECK (
   "Regime" <> 4 OR "FiscalModel" <> 65 OR COALESCE("Csosn" IN ('102','300'),false)
 )
);
CREATE UNIQUE INDEX IF NOT EXISTS "UX_fiscal_sku_tax_active"
 ON fiscal_sku_tax_profiles ("TenantId","BranchId","ProductSkuId","FiscalModel")
 WHERE "IsActive"=true;
CREATE INDEX IF NOT EXISTS "IX_fiscal_sku_tax_lookup"
 ON fiscal_sku_tax_profiles ("TenantId","BranchId","ProductSkuId","Regime","FiscalModel");
