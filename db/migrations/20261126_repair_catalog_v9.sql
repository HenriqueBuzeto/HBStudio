BEGIN;
CREATE OR REPLACE FUNCTION public.repair_catalog_items_v9(t uuid, b uuid, ord uuid, items jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE v jsonb;historic public.repair_estimate_items%ROWTYPE;sku uuid;typ integer;qty numeric;price numeric;kind integer;policy integer;canonical text;catalog_price numeric;service_unit text;result jsonb:='[]';seen uuid[]:=ARRAY[]::uuid[];check_skus uuid[]:=ARRAY[]::uuid[];old_id uuid;avail numeric;needed numeric;
BEGIN
 IF jsonb_typeof(items) IS DISTINCT FROM 'array' OR jsonb_array_length(items)>100 THEN RAISE EXCEPTION 'REPAIR_INVALID_ITEMS' USING ERRCODE='23514';END IF;
 FOR v IN SELECT value FROM jsonb_array_elements(items) LOOP
  old_id:=nullif(v->>'id','')::uuid;sku:=nullif(v->>'productSkuId','')::uuid;typ:=(v->>'itemType')::integer;qty:=(v->>'quantity')::numeric;price:=(v->>'unitPrice')::numeric;
  IF typ IS NULL OR typ NOT IN(1,2) OR qty IS NULL OR qty<=0 OR qty>10000 OR qty<>round(qty,3) OR price IS NULL OR price<0 OR price>100000000 OR price<>round(price,2) THEN RAISE EXCEPTION 'REPAIR_INVALID_ITEM' USING ERRCODE='23514';END IF;
  IF old_id IS NOT NULL THEN
   IF ord IS NULL OR old_id=ANY(seen) THEN RAISE EXCEPTION 'REPAIR_INVALID_ITEM_ID' USING ERRCODE='23514';END IF;
   seen:=array_append(seen,old_id);
   SELECT i.* INTO historic FROM public.repair_estimate_items i JOIN public.repair_orders o ON o."Id"=i."RepairOrderId" AND o."TenantId"=i."TenantId" WHERE i."TenantId"=t AND o."BranchId"=b AND i."RepairOrderId"=ord AND i."Id"=old_id;
   IF NOT FOUND OR historic."ProductSkuId" IS DISTINCT FROM sku OR historic."ItemType"<>typ OR historic."Quantity"<>qty OR historic."UnitPrice"<>price OR historic."Description" IS DISTINCT FROM (v->>'description') THEN RAISE EXCEPTION 'REPAIR_INVALID_HISTORICAL_ITEM' USING ERRCODE='23514';END IF;
   result:=result||jsonb_build_array(v);CONTINUE;
  END IF;
  IF sku IS NULL THEN RAISE EXCEPTION 'REPAIR_INVALID_CATALOG_REQUIRED' USING ERRCODE='23514';END IF;
  SELECT m."Kind",m."SerializationPolicy",left(m."Name"||' · '||s."VariantName",400),s."DefaultPrice",coalesce(s."TechnicalSpecsJson"->>'serviceUnit','EXECUTION') INTO kind,policy,canonical,catalog_price,service_unit FROM public.product_skus s JOIN public.product_models m ON m."Id"=s."ProductModelId" AND m."TenantId"=s."TenantId" WHERE s."TenantId"=t AND s."Id"=sku AND s."IsActive" AND m."IsActive" FOR SHARE OF s,m;
  IF NOT FOUND OR (typ=1 AND kind<>4) OR (typ=2 AND (kind NOT IN(1,3,5) OR policy<>0 OR qty<>trunc(qty))) THEN RAISE EXCEPTION 'REPAIR_INVALID_CATALOG_TYPE' USING ERRCODE='23514';END IF;
  IF typ=1 AND service_unit<>'HOUR' AND qty<>trunc(qty) THEN RAISE EXCEPTION 'REPAIR_INVALID_SERVICE_QUANTITY' USING ERRCODE='23514';END IF;
  IF catalog_price IS NULL OR price<>catalog_price THEN RAISE EXCEPTION 'REPAIR_INVALID_CATALOG_PRICE' USING ERRCODE='23514';END IF;
  IF typ=2 THEN check_skus:=array_append(check_skus,sku);END IF;
  result:=result||jsonb_build_array(jsonb_build_object('itemType',typ,'description',canonical,'quantity',qty,'unitPrice',catalog_price,'productSkuId',sku));
 END LOOP;
 FOR sku IN SELECT DISTINCT unnest(check_skus) LOOP
  SELECT coalesce(sum(greatest(0,s."OnHandQuantity"-s."ReservedQuantity"-s."BlockedQuantity")),0) INTO avail FROM public.stock_balances s JOIN public.warehouses w ON w."Id"=s."WarehouseId" AND w."TenantId"=s."TenantId" AND w."BranchId"=s."BranchId" AND w."IsActive" AND w."Type" IN(1,2,3) WHERE s."TenantId"=t AND s."BranchId"=b AND s."ProductSkuId"=sku AND NOT EXISTS(SELECT 1 FROM public.manufacturing_material_balance_configs c WHERE c.tenant_id=t AND c.branch_id=b AND c.balance_id=s."Id");
  SELECT coalesce(sum((x->>'quantity')::numeric),0) INTO needed FROM jsonb_array_elements(result) x WHERE x->>'productSkuId'=sku::text AND (x->>'itemType')::integer=2;
  IF needed>avail THEN RAISE EXCEPTION 'REPAIR_INVALID_STOCK_AVAILABLE' USING ERRCODE='23514';END IF;
 END LOOP;
 RETURN result;
END $function$;

CREATE OR REPLACE FUNCTION public.catalog_intake_v7(t uuid, b uuid, u uuid, req uuid, p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE prior jsonb;result jsonb;mode text;kind integer;policy integer;name text;variant text;code text;brand_name text;cat_name text;cat_slug text;brand uuid;cat uuid;model uuid;sku uuid;wh uuid;wh_name text;bal uuid;price numeric;qty numeric;unit_cost numeric;amount numeric;grams numeric;factor numeric;rolls integer;tare numeric;mat text;color text;batch text;doc text;reason text;material_kind text;spools jsonb:='[]';receipt boolean;barcode text;existing boolean;
BEGIN
 PERFORM public.factory_assert_actor_v2(t,b,u);
 IF NOT EXISTS(SELECT 1 FROM public.user_roles ur JOIN public.role_permissions rp ON rp."TenantId"=ur."TenantId" AND rp."RoleId"=ur."RoleId" WHERE ur."TenantId"=t AND ur."UserId"=u AND rp."PermissionKey"='catalog.products.manage') THEN RAISE EXCEPTION 'Catalog permission required' USING ERRCODE='42501';END IF;
 mode:=public.factory_text_v2(p,'mode',1,20);
 IF mode NOT IN('CATALOG','STOCK','FILAMENT','SUPPLY') THEN RAISE EXCEPTION 'Invalid intake type' USING ERRCODE='22023';END IF;
 receipt:=mode<>'CATALOG';existing:=p->>'skuId' IS NOT NULL AND p->>'skuId'<>'';
 IF receipt AND EXISTS(SELECT 1 FROM unnest(ARRAY['inventory.view','inventory.adjust','inventory.cost.view']) k WHERE NOT EXISTS(SELECT 1 FROM public.user_roles ur JOIN public.role_permissions rp ON rp."TenantId"=ur."TenantId" AND rp."RoleId"=ur."RoleId" WHERE ur."TenantId"=t AND ur."UserId"=u AND rp."PermissionKey"=k)) THEN RAISE EXCEPTION 'Inventory intake permissions required' USING ERRCODE='42501';END IF;
 prior:=public.factory_begin_command_v2(t,b,u,req,'CatalogIntakeV7',p);IF prior IS NOT NULL THEN RETURN prior;END IF;
 IF existing THEN
  IF NOT receipt THEN RAISE EXCEPTION 'Existing SKU requires stock intake' USING ERRCODE='22023';END IF;
  sku:=(p->>'skuId')::uuid;
  SELECT m."Id",m."Kind",m."SerializationPolicy",s."SkuCode" INTO model,kind,policy,code FROM public.product_skus s JOIN public.product_models m ON m."Id"=s."ProductModelId" AND m."TenantId"=s."TenantId" WHERE s."TenantId"=t AND s."Id"=sku AND s."IsActive" AND m."IsActive" FOR SHARE OF s,m;
  IF NOT FOUND THEN RAISE EXCEPTION 'SKU unavailable' USING ERRCODE='22023';END IF;
 ELSE
  kind:=public.factory_number_v2(p,'kind',1,5,true);policy:=public.factory_number_v2(p,'policy',0,2,true);
  IF mode IN('FILAMENT','SUPPLY') AND (kind<>2 OR policy<>0) THEN RAISE EXCEPTION 'Material must be nonserialized raw material' USING ERRCODE='22023';END IF;
  name:=public.factory_text_v2(p,'name',1,180);variant:=public.factory_text_v2(p,'variant',1,150);code:=upper(public.factory_text_v2(p,'code',1,80));brand_name:=public.factory_text_v2(p,'brand',1,150);cat_name:=public.factory_text_v2(p,'category',1,150);price:=public.factory_number_v2(p,'price',0,100000000);barcode:=nullif(public.factory_text_v2(p,'barcode',0,50),'');
  IF price<>round(price,2) OR code !~ '^[A-Z0-9][A-Z0-9._-]{0,79}$' OR (kind IN(2,4,5) AND policy<>0) THEN RAISE EXCEPTION 'Invalid SKU, price or serialization' USING ERRCODE='22023';END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(t::text||'catalog-v7',17));
  IF EXISTS(SELECT 1 FROM public.product_skus WHERE "TenantId"=t AND upper("SkuCode")=code) THEN RAISE EXCEPTION 'SKU already exists; select existing product' USING ERRCODE='23505';END IF;
  IF barcode IS NOT NULL AND EXISTS(SELECT 1 FROM public.product_skus WHERE "TenantId"=t AND "BarcodeEan"=barcode) THEN RAISE EXCEPTION 'Barcode already exists' USING ERRCODE='23505';END IF;
  SELECT "Id" INTO brand FROM public.product_brands WHERE "TenantId"=t AND lower(btrim("Name"))=lower(brand_name) AND "IsActive" ORDER BY "Id" LIMIT 1;
  IF brand IS NULL THEN
   IF EXISTS(SELECT 1 FROM public.product_brands WHERE "TenantId"=t AND lower(btrim("Name"))=lower(brand_name)) THEN RAISE EXCEPTION 'Brand is inactive' USING ERRCODE='23514';END IF;
   brand:=gen_random_uuid();INSERT INTO public.product_brands("Id","TenantId","Name","IsActive","CreatedAtUtc") VALUES(brand,t,brand_name,true,now());
  END IF;
  SELECT "Id" INTO cat FROM public.product_categories WHERE "TenantId"=t AND lower(btrim("Name"))=lower(cat_name) AND "ParentCategoryId" IS NULL AND "IsActive" ORDER BY "Id" LIMIT 1;
  IF cat IS NULL THEN
   IF EXISTS(SELECT 1 FROM public.product_categories WHERE "TenantId"=t AND lower(btrim("Name"))=lower(cat_name) AND "ParentCategoryId" IS NULL) THEN RAISE EXCEPTION 'Category is inactive' USING ERRCODE='23514';END IF;
   cat:=gen_random_uuid();cat_slug:=left(trim(both '-' from regexp_replace(lower(cat_name),'[^a-z0-9]+','-','g')),110)||'-'||left(cat::text,8);
   INSERT INTO public.product_categories("Id","TenantId","Name","Slug","IsActive","CreatedAtUtc") VALUES(cat,t,cat_name,cat_slug,true,now());
  END IF;
  model:=gen_random_uuid();sku:=gen_random_uuid();
  INSERT INTO public.product_models("Id","TenantId","Name","Description","Kind","SerializationPolicy","BrandId","CategoryId","IsActive","CreatedAtUtc") VALUES(model,t,name,public.factory_text_v2(p,'description',0,1000),kind,policy,brand,cat,true,now());
  IF kind=4 THEN
   IF coalesce(p->>'serviceUnit','EXECUTION') NOT IN('EXECUTION','HOUR') THEN RAISE EXCEPTION 'Invalid service unit' USING ERRCODE='22023';END IF;
   IF coalesce(p->>'serviceMinutes','0') !~ '^[0-9]{1,5}$' THEN RAISE EXCEPTION 'Invalid service duration' USING ERRCODE='22023';END IF;
   IF coalesce((p->>'serviceMinutes')::int,0)>10080 THEN RAISE EXCEPTION 'Invalid service duration' USING ERRCODE='22023';END IF;
  END IF;
  INSERT INTO public.product_skus("Id","TenantId","ProductModelId","SkuCode","VariantName","BarcodeEan","DefaultPrice","TechnicalSpecsJson","IsActive","CreatedAtUtc") VALUES(sku,t,model,code,variant,barcode,price,CASE WHEN kind=4 THEN jsonb_build_object('serviceUnit',coalesce(p->>'serviceUnit','EXECUTION'),'serviceMinutes',coalesce((p->>'serviceMinutes')::int,0)) ELSE NULL END,true,now());
 END IF;
 IF NOT receipt THEN
  result:=jsonb_build_object('modelId',model,'skuId',sku,'skuCode',code,'stockCreated',false);
  RETURN public.factory_end_command_v2(t,b,u,req,'CatalogIntakeV7',p,result,'ProductModel',model);
 END IF;
 IF policy<>0 OR kind=4 OR (mode IN('FILAMENT','SUPPLY') AND kind<>2) OR (mode='STOCK' AND kind=2) THEN RAISE EXCEPTION 'Use specialized material or serialized inventory workflow' USING ERRCODE='22023';END IF;
 IF jsonb_typeof(p->'physicalConfirmed') IS DISTINCT FROM 'boolean' OR (p->>'physicalConfirmed')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'Physical opening balance confirmation required' USING ERRCODE='22023';END IF;
 doc:=public.factory_text_v2(p,'reference',1,100);reason:=public.factory_text_v2(p,'reason',4,250);amount:=public.factory_number_v2(p,'totalCost',0,100000000);
 IF amount<>round(amount,2) THEN RAISE EXCEPTION 'Cost must be in cents' USING ERRCODE='22023';END IF;
 IF mode='FILAMENT' THEN
  rolls:=public.factory_number_v2(p,'count',1,100,true);grams:=public.factory_number_v2(p,'grams',0.001,100000);tare:=public.factory_number_v2(p,'tare',0,100000);batch:=public.factory_text_v2(p,'batch',0,120);mat:=upper(public.factory_text_v2(p,'material',1,80));color:=upper(public.factory_text_v2(p,'color',1,80));factor:=1000;qty:=rolls*grams/factor;material_kind:='FILAMENT';
  IF grams<>round(grams,3) OR tare<>round(tare,3) THEN RAISE EXCEPTION 'Invalid spool precision' USING ERRCODE='22023';END IF;
 ELSIF mode='SUPPLY' THEN
  qty:=public.factory_number_v2(p,'quantity',1,1000000,true);factor:=1;mat:=public.factory_text_v2(p,'material',1,80);color:='';material_kind:='SUPPLY';
 ELSE qty:=public.factory_number_v2(p,'quantity',1,1000000,true);END IF;
 unit_cost:=round(amount/qty,4);
 IF qty<>round(qty,6) OR round(qty*unit_cost,2)<>amount THEN RAISE EXCEPTION 'Total cannot be represented by inventory cost precision' USING ERRCODE='22023';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(t::text||b::text||'warehouse-v7',18));
 IF p->>'warehouseId' IS NOT NULL AND p->>'warehouseId'<>'' THEN
  wh:=(p->>'warehouseId')::uuid;
  IF NOT EXISTS(SELECT 1 FROM public.warehouses WHERE "TenantId"=t AND "BranchId"=b AND "Id"=wh AND "IsActive") THEN RAISE EXCEPTION 'Warehouse unavailable' USING ERRCODE='22023';END IF;
 ELSE
  wh_name:=public.factory_text_v2(p,'warehouseName',1,150);
  SELECT "Id" INTO wh FROM public.warehouses WHERE "TenantId"=t AND "BranchId"=b AND lower(btrim("Name"))=lower(wh_name) AND "IsActive" ORDER BY "Id" LIMIT 1;
  IF wh IS NULL THEN
   IF EXISTS(SELECT 1 FROM public.warehouses WHERE "TenantId"=t AND "BranchId"=b AND lower(btrim("Name"))=lower(wh_name)) THEN RAISE EXCEPTION 'Warehouse inactive' USING ERRCODE='23514';END IF;
   wh:=gen_random_uuid();INSERT INTO public.warehouses("Id","TenantId","BranchId","Code","Name","Type","IsActive","CreatedAtUtc") VALUES(wh,t,b,'DEP-'||upper(left(wh::text,8)),wh_name,CASE WHEN mode IN('FILAMENT','SUPPLY') THEN 4 ELSE 1 END,true,now());
  END IF;
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(t::text||b::text||sku::text||wh::text,19));
 IF EXISTS(SELECT 1 FROM public.stock_balances WHERE "TenantId"=t AND "BranchId"=b AND "ProductSkuId"=sku AND "WarehouseId"=wh) THEN RAISE EXCEPTION 'Opening balance already exists; use receipt or adjustment' USING ERRCODE='23514';END IF;
 bal:=gen_random_uuid();
 INSERT INTO public.stock_balances("Id","TenantId","BranchId","WarehouseId","ProductSkuId","OnHandQuantity","ReservedQuantity","BlockedQuantity","AverageCost","LastMovementAtUtc","CreatedAtUtc") VALUES(bal,t,b,wh,sku,qty,0,0,unit_cost,now(),now());
 INSERT INTO public.stock_movements("Id","TenantId","BranchId","WarehouseId","ProductSkuId","MovementType","Quantity","UnitCost","TotalCost","BalanceAfterQuantity","DocumentReference","Reason","CorrelationId","IdempotencyKey","CreatedByUserId","CreatedAtUtc") VALUES(gen_random_uuid(),t,b,wh,sku,1,qty,unit_cost,amount,qty,doc,reason,req,'CATALOG-OPEN-'||req::text,u,now());
 IF material_kind IS NOT NULL THEN
  PERFORM public.factory_configure_material_v2(t,b,u,bal,material_kind,mat,color,factor);
  IF mode='FILAMENT' THEN spools:=public.factory_register_spools_v2(t,b,u,req,bal,rolls,grams,tare,batch);END IF;
 END IF;
 result:=jsonb_build_object('modelId',model,'skuId',sku,'skuCode',code,'balanceId',bal,'warehouseId',wh,'stockCreated',true,'quantity',qty,'unitCost',unit_cost,'totalCost',amount,'spools',spools);
 RETURN public.factory_end_command_v2(t,b,u,req,'CatalogIntakeV7',p,result,'ProductModel',model);
END $function$;

CREATE OR REPLACE FUNCTION public.repair_enterprise_create(p_tenant uuid, p_branch uuid, p_actor uuid, p_actor_email text, p_correlation text, p_customer uuid, p_customer_name text, p_equipment_type text, p_brand text, p_model text, p_color text, p_serial text, p_equipment_notes text, p_defect text, p_condition text, p_items jsonb, p_request_key uuid)
 RETURNS TABLE(id uuid, "orderNumber" text)
 LANGUAGE plpgsql
AS $function$
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
  p_items:=public.repair_catalog_items_v9(p_tenant,p_branch,NULL,p_items);
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
      OR v_item."unitPrice"<>round(v_item."unitPrice",2) OR v_item."quantity"<>round(v_item."quantity",3) THEN
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
END $function$;

CREATE OR REPLACE FUNCTION public.repair_enterprise_update(p_tenant uuid, p_branch uuid, p_actor uuid, p_actor_email text, p_correlation text, p_order uuid, p_expected_status integer, p_expected_updated timestamp with time zone, p_status integer, p_defect text, p_diagnostic text, p_resolution text, p_items jsonb, p_delivered_person text, p_delivery_notes text)
 RETURNS TABLE(status integer, "finalPrice" numeric, "updatedAtUtc" timestamp with time zone)
 LANGUAGE plpgsql
AS $function$
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
  IF v_next=12 AND v_current."Status"<>12
    AND (coalesce(length(trim(p_delivered_person)),0)<2 OR length(trim(p_delivered_person))>180) THEN
    RAISE EXCEPTION 'REPAIR_DELIVERY_RECIPIENT_REQUIRED' USING ERRCODE='23514';
  END IF;
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
    p_items:=public.repair_catalog_items_v9(p_tenant,p_branch,p_order,p_items);
    v_labor:=0;v_parts:=0;
    FOR v_item IN SELECT x.* FROM jsonb_to_recordset(p_items) AS x(
      "itemType" integer,"description" text,"quantity" numeric,"unitPrice" numeric,"productSkuId" uuid)
    LOOP
      IF (v_item."itemType" IS NULL OR v_item."itemType" NOT IN (1,2)) OR coalesce(length(trim(v_item."description")),0)=0
        OR v_item."quantity" IS NULL OR v_item."quantity"<=0 OR v_item."quantity">10000
        OR v_item."unitPrice" IS NULL OR v_item."unitPrice"<0 OR v_item."unitPrice">100000000
        OR v_item."unitPrice"<>round(v_item."unitPrice",2) OR v_item."quantity"<>round(v_item."quantity",3) THEN
        RAISE EXCEPTION 'REPAIR_INVALID_ITEM' USING ERRCODE='23514';
      END IF;
      IF v_item."productSkuId" IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM product_skus WHERE "Id"=v_item."productSkuId" AND "TenantId"=p_tenant
      ) THEN RAISE EXCEPTION 'REPAIR_SKU_NOT_FOUND' USING ERRCODE='23514'; END IF;
      IF v_item."itemType"=1 THEN v_labor:=v_labor+round(v_item."quantity"*v_item."unitPrice",2);
      ELSE v_parts:=v_parts+round(v_item."quantity"*v_item."unitPrice",2); END IF;
    END LOOP;
    DELETE FROM repair_estimate_items WHERE "TenantId"=p_tenant AND "RepairOrderId"=p_order AND NOT ("Id"=ANY(ARRAY(SELECT (v->>'id')::uuid FROM jsonb_array_elements(p_items) v WHERE v->>'id' IS NOT NULL)));
    INSERT INTO repair_estimate_items ("Id","TenantId","RepairOrderId","ItemType","Description",
      "Quantity","UnitPrice","UnitCost","ProductSkuId","CreatedAtUtc")
    SELECT gen_random_uuid(),p_tenant,p_order,x."itemType",trim(x."description"),
      x."quantity",x."unitPrice",0,x."productSkuId",now()
    FROM jsonb_to_recordset(p_items) AS x("itemType" integer,"description" text,
      "quantity" numeric,"unitPrice" numeric,"productSkuId" uuid,id uuid) WHERE x.id IS NULL;
  END IF;
  IF v_labor+v_parts < v_current."TotalDiscount" THEN
    RAISE EXCEPTION 'REPAIR_INVALID_DISCOUNT' USING ERRCODE='23514';
  END IF;
  UPDATE repair_orders SET
    "Status"=v_next,
    "ReportedDefect"=coalesce(nullif(trim(p_defect),''),"ReportedDefect"),
    "DiagnosticNotes"=coalesce(nullif(trim(p_diagnostic),''),"DiagnosticNotes"),
    "ResolutionNotes"=coalesce(nullif(trim(p_resolution),''),"ResolutionNotes"),
    "TotalLaborPrice"=v_labor,"TotalPartsPrice"=v_parts,
    "FinalPrice"=v_labor+v_parts-"TotalDiscount",
    "DeliveredAtUtc"=CASE WHEN v_next=12 AND "Status"<>12 THEN now() ELSE "DeliveredAtUtc" END,
    "DeliveredToPersonName"=CASE WHEN v_next=12 AND "Status"<>12 THEN trim(p_delivered_person) ELSE "DeliveredToPersonName" END,
    "DeliveryNotes"=CASE WHEN v_next=12 AND "Status"<>12 THEN nullif(trim(p_delivery_notes),'') ELSE "DeliveryNotes" END,
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
END $function$;
COMMIT;
