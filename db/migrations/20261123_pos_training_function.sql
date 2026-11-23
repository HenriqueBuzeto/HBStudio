
-- Atomic simulation creation. No writes to actual sales, stock, cash or fiscal tables.
CREATE OR REPLACE FUNCTION pos_training_create(
 p_tenant uuid,p_branch uuid,p_actor uuid,p_seller uuid,p_customer uuid,
 p_key uuid,p_hash text,p_method integer,p_installments integer,
 p_discount_cents bigint,p_items jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER AS $train$
DECLARE
 v_id uuid;v_count integer;v_distinct integer;v_existing record;
 v_subtotal bigint;v_total bigint;v_number text;
BEGIN
 IF p_hash !~ '^[a-f0-9]{64}$' OR p_method NOT BETWEEN 1 AND 4 OR
    p_installments NOT BETWEEN 1 AND 18 OR
    (p_method<>3 AND p_installments<>1) OR p_discount_cents<0 OR
    jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 50
 THEN RAISE EXCEPTION 'TRAINING_INVALID_REQUEST' USING ERRCODE='22023';END IF;
 IF NOT EXISTS(SELECT 1 FROM branches WHERE "Id"=p_branch AND "TenantId"=p_tenant AND "IsActive"=true) OR
    NOT EXISTS(SELECT 1 FROM users WHERE "Id"=p_actor AND "TenantId"=p_tenant AND "IsActive"=true) OR
    NOT EXISTS(SELECT 1 FROM users WHERE "Id"=p_seller AND "TenantId"=p_tenant AND "IsActive"=true) OR
    (p_customer IS NOT NULL AND NOT EXISTS(SELECT 1 FROM parties WHERE "Id"=p_customer AND "TenantId"=p_tenant AND "IsActive"=true))
 THEN RAISE EXCEPTION 'TRAINING_INVALID_SCOPE' USING ERRCODE='23503';END IF;
 -- The UNIQUE key serializes identical concurrent requests and prevents double writes.
 SELECT "Id","PayloadHash","TrainingNumber" INTO v_existing
 FROM pos_training_sales WHERE "TenantId"=p_tenant AND "BranchId"=p_branch AND "IdempotencyKey"=p_key;
 IF FOUND THEN
   IF v_existing."PayloadHash"<>p_hash THEN
     RAISE EXCEPTION 'TRAINING_IDEMPOTENCY_CONFLICT' USING ERRCODE='23505';
   END IF;
   RETURN jsonb_build_object('id',v_existing."Id",'number',v_existing."TrainingNumber",'replayed',true);
 END IF;
 CREATE TEMP TABLE IF NOT EXISTS pg_temp.training_validation_items(
   sku_id uuid,qty integer,price_cents bigint,sku_code text,description text
 ) ON COMMIT DROP;
 TRUNCATE pg_temp.training_validation_items;
 INSERT INTO pg_temp.training_validation_items
 SELECT s."Id",r.qty,round(s."DefaultPrice"*100)::bigint,s."SkuCode",
   coalesce(nullif(s."VariantName",''),s."SkuCode")
 FROM jsonb_to_recordset(p_items) AS r(id uuid,qty integer)
 JOIN product_skus s ON s."Id"=r.id AND s."TenantId"=p_tenant AND s."IsActive"=true
 WHERE r.qty BETWEEN 1 AND 100;
 SELECT count(*),count(DISTINCT sku_id),coalesce(sum(qty*price_cents),0)
 INTO v_count,v_distinct,v_subtotal FROM pg_temp.training_validation_items;
 IF v_count<>jsonb_array_length(p_items) OR v_count<>v_distinct OR v_subtotal<=0 OR v_subtotal>100000000000 OR
    p_discount_cents>=v_subtotal THEN RAISE EXCEPTION 'TRAINING_INVALID_ITEMS' USING ERRCODE='22023';END IF;
 v_total:=v_subtotal-p_discount_cents;
 v_id:=gen_random_uuid();
 v_number:='SIM-'||upper(substr(replace(v_id::text,'-',''),1,16));
 INSERT INTO pos_training_sales
 ("Id","TenantId","BranchId","CustomerPartyId","SellerUserId","CreatedByUserId",
  "IdempotencyKey","PayloadHash","TrainingNumber","PaymentMethod","Installments",
  "SubtotalCents","DiscountCents","TotalCents")
 VALUES(v_id,p_tenant,p_branch,p_customer,p_seller,p_actor,p_key,p_hash,v_number,
  p_method,p_installments,v_subtotal,p_discount_cents,v_total)
 ON CONFLICT ("TenantId","BranchId","IdempotencyKey") DO NOTHING;
 IF NOT FOUND THEN
   SELECT "Id","PayloadHash","TrainingNumber" INTO v_existing FROM pos_training_sales
   WHERE "TenantId"=p_tenant AND "BranchId"=p_branch AND "IdempotencyKey"=p_key;
   IF v_existing."PayloadHash"<>p_hash THEN
     RAISE EXCEPTION 'TRAINING_IDEMPOTENCY_CONFLICT' USING ERRCODE='23505';
   END IF;
   RETURN jsonb_build_object('id',v_existing."Id",'number',v_existing."TrainingNumber",'replayed',true);
 END IF;
 INSERT INTO pos_training_sale_items
 ("TenantId","BranchId","TrainingSaleId","ProductSkuId","SkuCode","Description","Quantity","UnitPriceCents")
 SELECT p_tenant,p_branch,v_id,sku_id,sku_code,description,qty,price_cents
 FROM pg_temp.training_validation_items;
 RETURN jsonb_build_object('id',v_id,'number',v_number,'replayed',false,
  'totalCents',v_total,'subtotalCents',v_subtotal,'discountCents',p_discount_cents);
END $train$;
