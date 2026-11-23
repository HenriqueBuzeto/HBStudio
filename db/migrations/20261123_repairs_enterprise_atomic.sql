-- HBStudio Repairs Enterprise — additive, non-destructive.
-- Apply on an isolated Neon QA branch first. Do not apply to production without gate approval.
CREATE TABLE IF NOT EXISTS repair_order_counters (
  "TenantId" uuid NOT NULL REFERENCES tenants("Id") ON DELETE RESTRICT,
  "Year" integer NOT NULL CHECK ("Year" BETWEEN 2020 AND 9999),
  "LastNumber" bigint NOT NULL CHECK ("LastNumber" >= 0),
  PRIMARY KEY ("TenantId","Year")
);

CREATE TABLE IF NOT EXISTS repair_order_create_requests (
  "TenantId" uuid NOT NULL REFERENCES tenants("Id") ON DELETE RESTRICT,
  "RequestKey" uuid NOT NULL,
  "PayloadFingerprint" text NOT NULL,
  "RepairOrderId" uuid NOT NULL REFERENCES repair_orders("Id") ON DELETE RESTRICT,
  "CreatedAtUtc" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("TenantId","RequestKey")
);

CREATE OR REPLACE FUNCTION repair_enterprise_create(
  p_tenant uuid, p_branch uuid, p_actor uuid, p_actor_email text, p_correlation text,
  p_customer uuid, p_customer_name text, p_equipment_type text, p_brand text,
  p_model text, p_color text, p_serial text, p_equipment_notes text,
  p_defect text, p_condition text, p_items jsonb, p_request_key uuid
)
RETURNS TABLE (id uuid, "orderNumber" text)
LANGUAGE plpgsql AS $repair$
DECLARE
  v_customer uuid := p_customer;
  v_equipment uuid := gen_random_uuid();
  v_order uuid := gen_random_uuid();
  v_no bigint;
  v_year int := extract(year FROM now())::integer;
  v_number text;
  v_labor numeric(18,2) := 0;
  v_parts numeric(18,2) := 0;
  v_item record;
  v_count integer := 0;
  v_fingerprint text;
  v_previous record;
BEGIN
  IF p_request_key IS NULL THEN
    RAISE EXCEPTION 'REPAIR_IDEMPOTENCY_KEY_REQUIRED' USING ERRCODE='23514';
  END IF;
  -- Lock just this tenant/request pair; duplicate submissions cannot create two OS records.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant::text||':'||p_request_key::text,0));
  v_fingerprint := md5(jsonb_build_object(
    'customerId',p_customer,'customerName',p_customer_name,'equipmentType',p_equipment_type,
    'brand',p_brand,'model',p_model,'color',p_color,'serial',p_serial,
    'details',p_equipment_notes,'defect',p_defect,'condition',p_condition,'items',p_items)::text);
  SELECT req."RepairOrderId",req."PayloadFingerprint" INTO v_previous
    FROM repair_order_create_requests req
    WHERE req."TenantId"=p_tenant AND req."RequestKey"=p_request_key;
  IF FOUND THEN
    IF v_previous."PayloadFingerprint"<>v_fingerprint THEN
      RAISE EXCEPTION 'REPAIR_IDEMPOTENCY_MISMATCH' USING ERRCODE='23514';
    END IF;
    SELECT ro."OrderNumber" INTO v_number FROM repair_orders ro
      WHERE ro."TenantId"=p_tenant AND ro."Id"=v_previous."RepairOrderId";
    RETURN QUERY SELECT v_previous."RepairOrderId",v_number;
    RETURN;
  END IF;
  IF p_tenant IS NULL OR p_branch IS NULL OR p_actor IS NULL THEN
    RAISE EXCEPTION 'REPAIR_CONTEXT_REQUIRED' USING ERRCODE='23514';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM branches WHERE "Id"=p_branch AND "TenantId"=p_tenant) THEN
    RAISE EXCEPTION 'REPAIR_INVALID_BRANCH' USING ERRCODE='23514';
  END IF;
  IF coalesce(length(trim(p_defect)),0) < 3 OR length(p_defect)>2000 THEN
    RAISE EXCEPTION 'REPAIR_DEFECT_REQUIRED' USING ERRCODE='23514';
  END IF;
  IF coalesce(length(trim(p_model)),0)=0 OR coalesce(length(trim(p_brand)),0)=0 THEN
    RAISE EXCEPTION 'REPAIR_EQUIPMENT_REQUIRED' USING ERRCODE='23514';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items)<>'array' OR jsonb_array_length(p_items)>100 THEN
    RAISE EXCEPTION 'REPAIR_INVALID_ITEMS' USING ERRCODE='23514';
  END IF;
  IF v_customer IS NULL THEN
    IF coalesce(length(trim(p_customer_name)),0)<2 THEN
      RAISE EXCEPTION 'REPAIR_CUSTOMER_REQUIRED' USING ERRCODE='23514';
    END IF;
    v_customer := gen_random_uuid();
    INSERT INTO parties ("Id","TenantId","Type","Name","IsActive","CreatedAtUtc")
      VALUES(v_customer,p_tenant,1,trim(p_customer_name),true,now());
    INSERT INTO customer_profiles ("Id","TenantId","PartyId","TotalSalesValue","CompletedRepairsCount","CreatedAtUtc")
      VALUES(gen_random_uuid(),p_tenant,v_customer,0,0,now());
  ELSE
    IF NOT EXISTS (SELECT 1 FROM parties WHERE "Id"=v_customer AND "TenantId"=p_tenant AND "IsActive"=true) THEN
      RAISE EXCEPTION 'REPAIR_CUSTOMER_NOT_FOUND' USING ERRCODE='23514';
    END IF;
  END IF;
  INSERT INTO customer_equipments ("Id","TenantId","PartyId","EquipmentType","Brand","Model","Color","SerialNumber","Notes","CreatedAtUtc")
    VALUES(v_equipment,p_tenant,v_customer,coalesce(nullif(trim(p_equipment_type),''),'Computador'),trim(p_brand),
      trim(p_model),nullif(trim(p_color),''),nullif(trim(p_serial),''),nullif(trim(p_equipment_notes),''),now());

  -- Concurrency-safe year/tenant sequence. ON CONFLICT locks the counter row.
  INSERT INTO repair_order_counters("TenantId","Year","LastNumber")
    SELECT p_tenant,v_year,coalesce(max(
      CASE WHEN ro."OrderNumber" ~ ('^OS-'||v_year::text||'-[0-9]+$')
      THEN substring(ro."OrderNumber" from '[0-9]+$')::bigint ELSE 0 END
    ),0)+1
    FROM repair_orders ro WHERE ro."TenantId"=p_tenant
  ON CONFLICT ("TenantId","Year") DO UPDATE
    SET "LastNumber"=repair_order_counters."LastNumber"+1
  RETURNING "LastNumber" INTO v_no;
  v_number := 'OS-'||v_year::text||'-'||lpad(v_no::text,4,'0');

  FOR v_item IN
    SELECT x.* FROM jsonb_to_recordset(p_items) AS x(
      "itemType" integer,"description" text,"quantity" numeric,"unitPrice" numeric,"productSkuId" uuid)
  LOOP
    v_count:=v_count+1;
    IF (v_item."itemType" IS NULL OR v_item."itemType" NOT IN (1,2)) OR coalesce(length(trim(v_item."description")),0)=0
      OR v_item."quantity" IS NULL OR v_item."quantity"<=0 OR v_item."quantity">10000
      OR v_item."unitPrice" IS NULL OR v_item."unitPrice"<0 OR v_item."unitPrice">100000000
      OR scale(v_item."unitPrice")>2 OR scale(v_item."quantity")>3 THEN
      RAISE EXCEPTION 'REPAIR_INVALID_ITEM' USING ERRCODE='23514';
    END IF;
    IF v_item."productSkuId" IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM product_skus WHERE "Id"=v_item."productSkuId" AND "TenantId"=p_tenant
    ) THEN
      RAISE EXCEPTION 'REPAIR_SKU_NOT_FOUND' USING ERRCODE='23514';
    END IF;
    IF v_item."itemType"=1 THEN
      v_labor:=v_labor+round(v_item."quantity"*v_item."unitPrice",2);
    ELSE
      v_parts:=v_parts+round(v_item."quantity"*v_item."unitPrice",2);
    END IF;
  END LOOP;

  INSERT INTO repair_orders ("Id","TenantId","BranchId","OrderNumber","CustomerId",
    "CustomerEquipmentId","AssignedTechnicianId","Status","ReportedDefect","PhysicalConditionNotes",
    "ReceivedAtUtc","LegalWarrantyDays","AdditionalWarrantyDays","TotalLaborPrice","TotalPartsPrice",
    "TotalDiscount","FinalPrice","TotalPartsCost","TotalLaborCost","CreatedAtUtc")
  VALUES(v_order,p_tenant,p_branch,v_number,v_customer,v_equipment,p_actor,1,trim(p_defect),
    nullif(trim(p_condition),''),now(),90,0,v_labor,v_parts,0,v_labor+v_parts,0,0,now());

  INSERT INTO repair_estimate_items ("Id","TenantId","RepairOrderId","ItemType","Description",
    "Quantity","UnitPrice","UnitCost","ProductSkuId","CreatedAtUtc")
  SELECT gen_random_uuid(),p_tenant,v_order,x."itemType",trim(x."description"),
    x."quantity",x."unitPrice",0,x."productSkuId",now()
  FROM jsonb_to_recordset(p_items) AS x("itemType" integer,"description" text,"quantity" numeric,
    "unitPrice" numeric,"productSkuId" uuid);

  INSERT INTO repair_status_history ("Id","TenantId","RepairOrderId","Status","Description","TimestampUtc","CreatedAtUtc")
    VALUES(gen_random_uuid(),p_tenant,v_order,1,'OS recebida e registrada',now(),now());

  INSERT INTO audit_events ("Id","TenantId","BranchId","EntityType","EntityId","Action","ActorId",
    "ActorEmail","CorrelationId","AfterStateJson","CreatedAtUtc","Version")
  VALUES(gen_random_uuid(),p_tenant,p_branch,'RepairOrder',v_order::text,'RepairCreated',p_actor,
    coalesce(p_actor_email,''),p_correlation,
    jsonb_build_object('orderNumber',v_number,'status',1,'customerId',v_customer,'itemCount',v_count),
    now(),1);

  INSERT INTO repair_order_create_requests ("TenantId","RequestKey","PayloadFingerprint","RepairOrderId")
    VALUES(p_tenant,p_request_key,v_fingerprint,v_order);

  RETURN QUERY SELECT v_order,v_number;
END $repair$;

-- All mutation steps (item replacement, totals, status, history and audit)
-- run within the *same function invocation/transaction*. OCC uses UpdatedAtUtc token.
CREATE OR REPLACE FUNCTION repair_enterprise_update(
  p_tenant uuid,p_branch uuid,p_actor uuid,p_actor_email text,p_correlation text,
  p_order uuid,p_expected_status integer,p_expected_updated timestamptz,
  p_status integer,p_defect text,p_diagnostic text,p_resolution text,p_items jsonb
)
RETURNS TABLE ("status" integer,"finalPrice" numeric,"updatedAtUtc" timestamptz)
LANGUAGE plpgsql AS $repair$
DECLARE
  v_current repair_orders%ROWTYPE;
  v_next integer;
  v_labor numeric(18,2);
  v_parts numeric(18,2);
  v_item record;
BEGIN
  SELECT * INTO v_current FROM repair_orders
    WHERE "Id"=p_order AND "TenantId"=p_tenant AND "BranchId"=p_branch FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'REPAIR_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  IF p_expected_status IS DISTINCT FROM v_current."Status"
    OR date_trunc('milliseconds',p_expected_updated) IS DISTINCT FROM date_trunc('milliseconds',v_current."UpdatedAtUtc") THEN
    RAISE EXCEPTION 'REPAIR_CONFLICT' USING ERRCODE='40001';
  END IF;
  v_next:=coalesce(p_status,v_current."Status");
  -- Canonical workflow: triage -> bench -> awaiting -> tested -> delivered.
  -- A delivered OS is terminal; rework from tested must return to the bench first.
  IF v_next NOT IN (1,2,3,4,7,8,10,11,12)
    OR (v_current."Status"=12 AND v_next<>12)
    OR (v_next<>v_current."Status" AND NOT CASE v_current."Status"
      WHEN 1 THEN v_next IN (2,3,8)
      WHEN 2 THEN v_next IN (3,8,4)
      WHEN 3 THEN v_next IN (8,7,4,10)
      WHEN 8 THEN v_next IN (3,7,4,10)
      WHEN 7 THEN v_next IN (3,8,4)
      WHEN 4 THEN v_next IN (3,8,7)
      WHEN 10 THEN v_next IN (11,8,12)
      WHEN 11 THEN v_next IN (8,12)
      ELSE false END) THEN
    RAISE EXCEPTION 'REPAIR_INVALID_TRANSITION' USING ERRCODE='23514';
  END IF;

  v_labor:=v_current."TotalLaborPrice";
  v_parts:=v_current."TotalPartsPrice";
  IF p_items IS NOT NULL THEN
    IF jsonb_typeof(p_items)<>'array' OR jsonb_array_length(p_items)>100 THEN
      RAISE EXCEPTION 'REPAIR_INVALID_ITEMS' USING ERRCODE='23514';
    END IF;
    IF v_current."Status" IN (10,11,12) THEN
      RAISE EXCEPTION 'REPAIR_FINALIZED_ITEMS_LOCKED' USING ERRCODE='23514';
    END IF;
    v_labor:=0;v_parts:=0;
    FOR v_item IN SELECT x.* FROM jsonb_to_recordset(p_items) AS x(
      "itemType" integer,"description" text,"quantity" numeric,"unitPrice" numeric,"productSkuId" uuid)
    LOOP
      IF (v_item."itemType" IS NULL OR v_item."itemType" NOT IN (1,2)) OR coalesce(length(trim(v_item."description")),0)=0
        OR v_item."quantity" IS NULL OR v_item."quantity"<=0 OR v_item."quantity">10000
        OR v_item."unitPrice" IS NULL OR v_item."unitPrice"<0 OR v_item."unitPrice">100000000
        OR scale(v_item."unitPrice")>2 OR scale(v_item."quantity")>3 THEN
        RAISE EXCEPTION 'REPAIR_INVALID_ITEM' USING ERRCODE='23514';
      END IF;
      IF v_item."productSkuId" IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM product_skus WHERE "Id"=v_item."productSkuId" AND "TenantId"=p_tenant
      ) THEN RAISE EXCEPTION 'REPAIR_SKU_NOT_FOUND' USING ERRCODE='23514'; END IF;
      IF v_item."itemType"=1 THEN v_labor:=v_labor+round(v_item."quantity"*v_item."unitPrice",2);
      ELSE v_parts:=v_parts+round(v_item."quantity"*v_item."unitPrice",2); END IF;
    END LOOP;
    DELETE FROM repair_estimate_items WHERE "TenantId"=p_tenant AND "RepairOrderId"=p_order;
    INSERT INTO repair_estimate_items ("Id","TenantId","RepairOrderId","ItemType","Description",
      "Quantity","UnitPrice","UnitCost","ProductSkuId","CreatedAtUtc")
    SELECT gen_random_uuid(),p_tenant,p_order,x."itemType",trim(x."description"),
      x."quantity",x."unitPrice",0,x."productSkuId",now()
    FROM jsonb_to_recordset(p_items) AS x("itemType" integer,"description" text,
      "quantity" numeric,"unitPrice" numeric,"productSkuId" uuid);
  END IF;
  UPDATE repair_orders SET
    "Status"=v_next,
    "ReportedDefect"=coalesce(nullif(trim(p_defect),''),"ReportedDefect"),
    "DiagnosticNotes"=coalesce(nullif(trim(p_diagnostic),''),"DiagnosticNotes"),
    "ResolutionNotes"=coalesce(nullif(trim(p_resolution),''),"ResolutionNotes"),
    "TotalLaborPrice"=v_labor,"TotalPartsPrice"=v_parts,
    "FinalPrice"=v_labor+v_parts-"TotalDiscount",
    "DeliveredAtUtc"=CASE WHEN v_next=12 AND "Status"<>12 THEN now() ELSE "DeliveredAtUtc" END,
    "UpdatedAtUtc"=date_trunc('milliseconds',clock_timestamp())
  WHERE "TenantId"=p_tenant AND "BranchId"=p_branch AND "Id"=p_order
  RETURNING * INTO v_current;
  IF p_expected_status<>v_next THEN
    INSERT INTO repair_status_history ("Id","TenantId","RepairOrderId","Status","Description","TimestampUtc","CreatedAtUtc")
      VALUES(gen_random_uuid(),p_tenant,p_order,v_next,
        format('Status alterado de %s para %s por usuário autorizado',p_expected_status,v_next),now(),now());
  END IF;
  INSERT INTO audit_events ("Id","TenantId","BranchId","EntityType","EntityId","Action","ActorId",
    "ActorEmail","CorrelationId","BeforeStateJson","AfterStateJson","CreatedAtUtc","Version")
  VALUES(gen_random_uuid(),p_tenant,p_branch,'RepairOrder',p_order::text,'RepairUpdated',p_actor,
    coalesce(p_actor_email,''),p_correlation,jsonb_build_object('status',p_expected_status),
    jsonb_build_object('status',v_next,'replacedItems',p_items IS NOT NULL),now(),1);
  RETURN QUERY SELECT v_current."Status",v_current."FinalPrice",v_current."UpdatedAtUtc";
END $repair$;

-- Grant only to the database role used by the protected BFF; API controls per-user permissions.
REVOKE ALL ON FUNCTION repair_enterprise_create(uuid,uuid,uuid,text,text,uuid,text,text,text,text,text,text,text,text,text,jsonb,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION repair_enterprise_update(uuid,uuid,uuid,text,text,uuid,integer,timestamptz,integer,text,text,text,jsonb) FROM PUBLIC;
