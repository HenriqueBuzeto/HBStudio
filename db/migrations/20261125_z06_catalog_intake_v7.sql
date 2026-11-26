BEGIN;
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
  INSERT INTO public.product_skus("Id","TenantId","ProductModelId","SkuCode","VariantName","BarcodeEan","DefaultPrice","IsActive","CreatedAtUtc") VALUES(sku,t,model,code,variant,barcode,price,true,now());
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
COMMIT;
