-- Fábrica 3D: private versioned library, BOM and posted goods receipt traceability.

-- Apply after operational core v2. No receipt, payment or invoice is created.

BEGIN;

CREATE UNIQUE INDEX ux_factory_asset_code_v3 ON public.manufacturing_design_assets USING btree ("TenantId", "BranchId", upper(btrim("Code")));

CREATE UNIQUE INDEX ux_factory_asset_scope_v3 ON public.manufacturing_design_assets USING btree ("TenantId", "BranchId", "Id");

CREATE UNIQUE INDEX ux_factory_receipt_item_scope_v3 ON public.goods_receipt_items USING btree ("TenantId", "GoodsReceiptId", "Id");

CREATE UNIQUE INDEX ux_factory_receipt_scope_v3 ON public.goods_receipts USING btree ("TenantId", "BranchId", "Id");

CREATE UNIQUE INDEX ux_factory_version_revision_v3 ON public.manufacturing_design_versions USING btree ("TenantId", "AssetId", upper(btrim("RevisionCode")));

CREATE UNIQUE INDEX ux_factory_version_scope_v3 ON public.manufacturing_design_versions USING btree ("TenantId", "AssetId", "Id");

CREATE TABLE public.manufacturing_factory_files (
 "tenant_id" uuid NOT NULL,
 "branch_id" uuid NOT NULL,
 "asset_id" uuid NOT NULL,
 "version_id" uuid NOT NULL,
 "filename" text NOT NULL,
 "content" bytea NOT NULL,
 "sha256" text NOT NULL,
 "metadata" jsonb NOT NULL,
 "created_by" uuid NOT NULL,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 CONSTRAINT "manufacturing_factory_files_check" CHECK ((sha256 = encode(sha256(content), 'hex'::text))),
 CONSTRAINT "manufacturing_factory_files_content_check" CHECK (((octet_length(content) >= 1) AND (octet_length(content) <= 2097152))),
 CONSTRAINT "manufacturing_factory_files_filename_check" CHECK (((length(filename) >= 1) AND (length(filename) <= 180))),
 CONSTRAINT "manufacturing_factory_files_metadata_check" CHECK (((jsonb_typeof(metadata) = 'object'::text) AND (octet_length((metadata)::text) <= 65536))),
 CONSTRAINT "manufacturing_factory_files_pkey" PRIMARY KEY (tenant_id, branch_id, version_id),
 CONSTRAINT "manufacturing_factory_files_tenant_id_asset_id_version_id_fkey" FOREIGN KEY (tenant_id, asset_id, version_id) REFERENCES manufacturing_design_versions("TenantId", "AssetId", "Id"),
 CONSTRAINT "manufacturing_factory_files_tenant_id_branch_id_asset_id_fkey" FOREIGN KEY (tenant_id, branch_id, asset_id) REFERENCES manufacturing_design_assets("TenantId", "BranchId", "Id")
);

CREATE TABLE public.manufacturing_factory_recipes (
 "tenant_id" uuid NOT NULL,
 "branch_id" uuid NOT NULL,
 "version_id" uuid NOT NULL,
 "batch_quantity" integer NOT NULL,
 "seconds" integer NOT NULL,
 "labor_seconds" integer NOT NULL,
 "notes" text NOT NULL,
 "created_by" uuid NOT NULL,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 CONSTRAINT "manufacturing_factory_recipes_batch_quantity_check" CHECK ((batch_quantity > 0)),
 CONSTRAINT "manufacturing_factory_recipes_labor_seconds_check" CHECK ((labor_seconds >= 0)),
 CONSTRAINT "manufacturing_factory_recipes_notes_check" CHECK ((length(notes) <= 2000)),
 CONSTRAINT "manufacturing_factory_recipes_pkey" PRIMARY KEY (tenant_id, branch_id, version_id),
 CONSTRAINT "manufacturing_factory_recipes_seconds_check" CHECK ((seconds > 0)),
 CONSTRAINT "manufacturing_factory_recipes_tenant_id_branch_id_version__fkey" FOREIGN KEY (tenant_id, branch_id, version_id) REFERENCES manufacturing_factory_files(tenant_id, branch_id, version_id)
);

CREATE TABLE public.manufacturing_factory_recipe_lines (
 "tenant_id" uuid NOT NULL,
 "branch_id" uuid NOT NULL,
 "version_id" uuid NOT NULL,
 "balance_id" uuid NOT NULL,
 "quantity" numeric(18,3) NOT NULL,
 CONSTRAINT "manufacturing_factory_recipe__tenant_id_branch_id_balance__fkey" FOREIGN KEY (tenant_id, branch_id, balance_id) REFERENCES manufacturing_material_balance_configs(tenant_id, branch_id, balance_id),
 CONSTRAINT "manufacturing_factory_recipe__tenant_id_branch_id_version__fkey" FOREIGN KEY (tenant_id, branch_id, version_id) REFERENCES manufacturing_factory_recipes(tenant_id, branch_id, version_id),
 CONSTRAINT "manufacturing_factory_recipe_lines_pkey" PRIMARY KEY (tenant_id, branch_id, version_id, balance_id),
 CONSTRAINT "manufacturing_factory_recipe_lines_quantity_check" CHECK ((quantity > (0)::numeric))
);

CREATE TABLE public.manufacturing_factory_spool_receipts (
 "tenant_id" uuid NOT NULL,
 "branch_id" uuid NOT NULL,
 "spool_id" uuid NOT NULL,
 "receipt_id" uuid NOT NULL,
 "receipt_item_id" uuid NOT NULL,
 "stock_quantity" numeric(18,4) NOT NULL,
 "receipt_unit_cost" numeric(24,10) NOT NULL,
 "created_by" uuid NOT NULL,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 CONSTRAINT "manufacturing_factory_spool_r_tenant_id_branch_id_receipt__fkey" FOREIGN KEY (tenant_id, branch_id, receipt_id) REFERENCES goods_receipts("TenantId", "BranchId", "Id"),
 CONSTRAINT "manufacturing_factory_spool_r_tenant_id_branch_id_spool_id_fkey" FOREIGN KEY (tenant_id, branch_id, spool_id) REFERENCES manufacturing_spool_details(tenant_id, branch_id, spool_id),
 CONSTRAINT "manufacturing_factory_spool_r_tenant_id_receipt_id_receipt_fkey" FOREIGN KEY (tenant_id, receipt_id, receipt_item_id) REFERENCES goods_receipt_items("TenantId", "GoodsReceiptId", "Id"),
 CONSTRAINT "manufacturing_factory_spool_receipts_pkey" PRIMARY KEY (tenant_id, branch_id, spool_id),
 CONSTRAINT "manufacturing_factory_spool_receipts_receipt_unit_cost_check" CHECK ((receipt_unit_cost >= (0)::numeric)),
 CONSTRAINT "manufacturing_factory_spool_receipts_stock_quantity_check" CHECK ((stock_quantity > (0)::numeric))
);

CREATE INDEX ix_factory_spool_receipt_item_v3 ON public.manufacturing_factory_spool_receipts USING btree (tenant_id, branch_id, receipt_item_id);

CREATE FUNCTION public.factory_create_asset_v3(t uuid, b uuid, u uuid, req uuid, p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE prior jsonb;aid uuid:=gen_random_uuid();code text;r jsonb;
BEGIN
 prior:=public.factory_begin_command_v2(t,b,u,req,'CreateAsset',p);IF prior IS NOT NULL THEN RETURN prior;END IF;
 code:=upper(public.factory_text_v2(p,'code',1,40));
 IF jsonb_typeof(p->'commercialAllowed') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'License decision required' USING ERRCODE='22023';END IF;
 INSERT INTO public.manufacturing_design_assets("Id","Code","Title","Category","Description","LicenseType","IsCommercialAllowed","Author","CreatedAtUtc","TenantId","BranchId") VALUES(aid,code,public.factory_text_v2(p,'title',1,160),public.factory_text_v2(p,'category',1,80),public.factory_text_v2(p,'description',0,2000),public.factory_text_v2(p,'license',1,120),(p->>'commercialAllowed')::boolean,nullif(public.factory_text_v2(p,'author',0,160),''),now(),t,b);
 r:=jsonb_build_object('id',aid,'code',code);
 RETURN public.factory_end_command_v2(t,b,u,req,'CreateAsset',p,r,'FactoryDesignAsset',aid);
END $function$;

CREATE OR REPLACE FUNCTION public.factory_create_order_v2(t uuid, b uuid, u uuid, req uuid, p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE prior jsonb;r jsonb;new_order_id uuid:=gen_random_uuid();cust uuid;printer_id uuid;pr public.manufacturing_printers%ROWTYPE;seq bigint;number text;qty integer;secs integer;labsecs integer;tariff numeric;labor numeric;other numeric;waste numeric;margin numeric;fees numeric;price numeric;grams numeric;mat_sku uuid;f jsonb;s jsonb;est jsonb;line jsonb;due timestamptz; design_id uuid;
BEGIN
 prior:=public.factory_begin_command_v2(t,b,u,req,'CreateOrder',p);IF prior IS NOT NULL THEN RETURN prior;END IF;
 cust:=(p->>'customerId')::uuid;printer_id:=(p->>'printerId')::uuid;design_id:=(p->>'designVersionId')::uuid;
 IF design_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.manufacturing_factory_files f JOIN public.manufacturing_design_assets a ON a."Id"=f.asset_id AND a."TenantId"=f.tenant_id AND a."BranchId"=f.branch_id WHERE f.tenant_id=t AND f.branch_id=b AND f.version_id=design_id AND a."IsCommercialAllowed") THEN RAISE EXCEPTION 'Design version unavailable or not commercially licensed' USING ERRCODE='22023';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.parties x JOIN public.customer_profiles cp ON cp."TenantId"=x."TenantId" AND cp."PartyId"=x."Id" WHERE x."TenantId"=t AND x."Id"=cust AND x."IsActive") THEN RAISE EXCEPTION 'Customer unavailable' USING ERRCODE='22023';END IF;
 SELECT * INTO pr FROM public.manufacturing_printers WHERE "TenantId"=t AND "BranchId"=b AND "Id"=printer_id AND "Status" NOT IN (7,8);
 IF NOT FOUND OR pr."AveragePowerWatts"<=0 OR pr."ConfiguredHourlyMachineCost"<0 THEN RAISE EXCEPTION 'Printer unavailable or invalid costs' USING ERRCODE='22023';END IF;
 qty:=public.factory_number_v2(p,'quantity',1,100000,true);secs:=public.factory_number_v2(p,'seconds',1,31536000,true);labsecs:=public.factory_number_v2(p,'laborSeconds',0,31536000,true);
 tariff:=public.factory_number_v2(p,'tariff',0,1000000);labor:=public.factory_number_v2(p,'laborHour',0,1000000);other:=public.factory_number_v2(p,'other',0,1000000);waste:=public.factory_number_v2(p,'wastePct',0,100);margin:=public.factory_number_v2(p,'marginPct',0,99.9999);fees:=public.factory_number_v2(p,'feePct',0,99.9999);price:=public.factory_number_v2(p,'approvedPrice',0.01,100000000);
 IF margin+fees>=100 OR price<>round(price,2) THEN RAISE EXCEPTION 'Invalid price or margin' USING ERRCODE='22023';END IF;
 IF jsonb_typeof(p->'plan') IS DISTINCT FROM 'array' OR jsonb_array_length(p->'plan') NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Material plan required' USING ERRCODE='22023';END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p->'plan') l GROUP BY l->>'balanceId',coalesce(l->>'spoolId','') HAVING count(*)>1) THEN RAISE EXCEPTION 'Duplicate material line' USING ERRCODE='22023';END IF;
 SELECT x."ProductSkuId" INTO mat_sku FROM jsonb_array_elements(p->'plan') l JOIN public.manufacturing_material_balance_configs c ON c.tenant_id=t AND c.branch_id=b AND c.balance_id=(l->>'balanceId')::uuid AND c.kind='FILAMENT' JOIN public.stock_balances x ON x."Id"=c.balance_id WHERE l->>'spoolId' IS NOT NULL LIMIT 1;
 IF mat_sku IS NULL THEN RAISE EXCEPTION 'At least one filament spool required' USING ERRCODE='22023';END IF;
 IF p->>'dueAt' IS NOT NULL AND p->>'dueAt'<>'' THEN due:=(p->>'dueAt')::timestamptz;END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(t::text||b::text||'factory-order',4));
 SELECT coalesce(max(sequence_no),0)+1 INTO seq FROM public.manufacturing_factory_order_details WHERE tenant_id=t AND branch_id=b;
 number:='OS3D-'||lpad(seq::text,greatest(6,length(seq::text)),'0');
 INSERT INTO public.manufacturing_orders("Id","OrderNumber","Type","Status","AssignedPrinterId","DesignVersionId","MaterialProductSkuId","PlannedQuantity","ProducedQuantity","ApprovedQuantity","RejectedQuantity","EstimatedFilamentGrams","EstimatedPrintTimeMinutes","TotalEstimatedCost","ActualMaterialCost","ActualEnergyCost","ActualMachineCost","ActualLaborCost","ActualWasteCost","CreatedAtUtc","TenantId","BranchId") VALUES(new_order_id,number,2,7,printer_id,design_id,mat_sku,qty,0,0,0,0,secs/60::numeric,0,0,0,0,0,0,now(),t,b);
 INSERT INTO public.manufacturing_factory_order_details(tenant_id,branch_id,order_id,sequence_no,customer_id,title,notes,due_at,estimated_seconds,estimated_labor_seconds,tariff,labor_hour,other_estimate,waste_pct,margin_pct,fee_pct,approved_price,price_recorded_by) VALUES(t,b,new_order_id,seq,cust,public.factory_text_v2(p,'title',1,160),public.factory_text_v2(p,'notes',0,4000),due,secs,labsecs,tariff,labor,other,waste,margin,fees,price,u);
 FOR line IN SELECT l FROM jsonb_array_elements(p->'plan') l ORDER BY l->>'balanceId',coalesce(l->>'spoolId','') LOOP
  PERFORM public.factory_reserve_material_v2(t,b,u,gen_random_uuid(),new_order_id,(line->>'balanceId')::uuid,(line->>'spoolId')::uuid,public.factory_number_v2(line,'quantity',0.001,1000000));
 END LOOP;
 SELECT coalesce(jsonb_agg(jsonb_build_object('grams',a.planned_quantity,'costPerKg',a.unit_cost_snapshot*1000)) FILTER(WHERE a.spool_id IS NOT NULL),'[]'::jsonb),coalesce(jsonb_agg(jsonb_build_object('quantity',a.planned_quantity,'unitCost',a.unit_cost_snapshot)) FILTER(WHERE a.spool_id IS NULL),'[]'::jsonb),coalesce(sum(a.planned_quantity) FILTER(WHERE a.spool_id IS NOT NULL),0) INTO f,s,grams FROM public.manufacturing_material_allocations a WHERE a.tenant_id=t AND a.branch_id=b AND a.order_id=new_order_id;
 est:=public.manufacturing_estimate_cost_v1(f,s,secs,pr."AveragePowerWatts",tariff,pr."ConfiguredHourlyMachineCost",labsecs,labor,other,waste,margin,fees);
 IF p ? 'estimateFingerprint' AND p->>'estimateFingerprint' IS DISTINCT FROM md5(est::text) THEN RAISE EXCEPTION 'Estimate changed; recalculate before approval' USING ERRCODE='23514';END IF;
 PERFORM set_config('hbstudio.factory_order_command',new_order_id::text,true);
 UPDATE public.manufacturing_orders SET "EstimatedFilamentGrams"=grams,"TotalEstimatedCost"=(est->>'totalCost')::numeric,"UpdatedAtUtc"=now() WHERE "Id"=new_order_id;
 UPDATE public.manufacturing_factory_order_details SET estimate_snapshot=est WHERE tenant_id=t AND branch_id=b AND order_id=new_order_id;
 r:=jsonb_build_object('id',new_order_id,'number',number,'status',7);
 RETURN public.factory_end_command_v2(t,b,u,req,'CreateOrder',p,r,'FactoryOrder',new_order_id);
END $function$;

CREATE FUNCTION public.factory_create_recipe_v3(t uuid, b uuid, u uuid, req uuid, p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE prior jsonb;vid uuid;line jsonb;bal uuid;c public.manufacturing_material_balance_configs%ROWTYPE;qty numeric;r jsonb;
BEGIN
 prior:=public.factory_begin_command_v2(t,b,u,req,'CreateRecipe',p);IF prior IS NOT NULL THEN RETURN prior;END IF;
 vid:=(p->>'versionId')::uuid;
 IF NOT EXISTS(SELECT 1 FROM public.manufacturing_factory_files f WHERE f.tenant_id=t AND f.branch_id=b AND f.version_id=vid) THEN RAISE EXCEPTION 'Version unavailable' USING ERRCODE='22023';END IF;
 IF jsonb_typeof(p->'lines') IS DISTINCT FROM 'array' OR jsonb_array_length(p->'lines') NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Recipe lines required' USING ERRCODE='22023';END IF;
 INSERT INTO public.manufacturing_factory_recipes(tenant_id,branch_id,version_id,batch_quantity,seconds,labor_seconds,notes,created_by) VALUES(t,b,vid,public.factory_number_v2(p,'batchQuantity',1,100000,true),public.factory_number_v2(p,'seconds',1,31536000,true),public.factory_number_v2(p,'laborSeconds',0,31536000,true),public.factory_text_v2(p,'notes',0,2000),u);
 FOR line IN SELECT l FROM jsonb_array_elements(p->'lines') l LOOP
  bal:=(line->>'balanceId')::uuid;qty:=public.factory_number_v2(line,'quantity',0.001,1000000);
  SELECT * INTO c FROM public.manufacturing_material_balance_configs x WHERE x.tenant_id=t AND x.branch_id=b AND x.balance_id=bal;
  IF NOT FOUND OR qty<>round(qty,3) OR (c.kind='SUPPLY' AND qty<>trunc(qty)) THEN RAISE EXCEPTION 'Invalid recipe material or precision' USING ERRCODE='22023';END IF;
  INSERT INTO public.manufacturing_factory_recipe_lines(tenant_id,branch_id,version_id,balance_id,quantity) VALUES(t,b,vid,bal,qty);
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM public.manufacturing_factory_recipe_lines l JOIN public.manufacturing_material_balance_configs cfg ON (cfg.tenant_id,cfg.branch_id,cfg.balance_id)=(l.tenant_id,l.branch_id,l.balance_id) WHERE l.tenant_id=t AND l.branch_id=b AND l.version_id=vid AND cfg.kind='FILAMENT') THEN RAISE EXCEPTION 'Filament required' USING ERRCODE='22023';END IF;
 r:=jsonb_build_object('versionId',vid,'created',true);
 RETURN public.factory_end_command_v2(t,b,u,req,'CreateRecipe',p,r,'FactoryRecipe',vid);
END $function$;

CREATE FUNCTION public.factory_create_version_v3(t uuid, b uuid, u uuid, req uuid, p jsonb, bytes bytea)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE prior jsonb;aid uuid;vid uuid:=gen_random_uuid();digest text;filename text;fmt text;rev text;meta jsonb;r jsonb;secs numeric;grams numeric;
BEGIN
 PERFORM public.factory_assert_actor_v2(t,b,u);
 IF bytes IS NULL OR octet_length(bytes) NOT BETWEEN 1 AND 2097152 THEN RAISE EXCEPTION 'File size unsupported' USING ERRCODE='22023';END IF;
 digest:=encode(pg_catalog.sha256(bytes),'hex');
 IF p->>'sha256' IS DISTINCT FROM digest THEN RAISE EXCEPTION 'File digest mismatch' USING ERRCODE='22023';END IF;
 prior:=public.factory_begin_command_v2(t,b,u,req,'CreateDesignVersion',p);IF prior IS NOT NULL THEN RETURN prior;END IF;
 aid:=(p->>'assetId')::uuid;filename:=public.factory_text_v2(p,'filename',1,180);fmt:=upper(public.factory_text_v2(p,'format',1,8));rev:=upper(public.factory_text_v2(p,'revision',1,40));meta:=p->'metadata';
 IF fmt NOT IN('GCODE','3MF','STL') OR filename ~ '[[:cntrl:]/\\]' OR jsonb_typeof(meta) IS DISTINCT FROM 'object' OR octet_length(meta::text)>65536 THEN RAISE EXCEPTION 'Invalid file metadata' USING ERRCODE='22023';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.manufacturing_design_assets a WHERE a."TenantId"=t AND a."BranchId"=b AND a."Id"=aid) THEN RAISE EXCEPTION 'Design unavailable' USING ERRCODE='22023';END IF;
 secs:=public.factory_number_v2(p,'seconds',0,31536000,true);grams:=public.factory_number_v2(p,'grams',0,1000000);
 PERFORM pg_advisory_xact_lock(hashtextextended(t::text||'factory-file-quota',5));
 IF (SELECT coalesce(sum(octet_length(content)),0) FROM public.manufacturing_factory_files WHERE tenant_id=t)+octet_length(bytes)>52428800 THEN RAISE EXCEPTION 'QA file quota exceeded' USING ERRCODE='23514';END IF;
 INSERT INTO public.manufacturing_design_versions("Id","AssetId","RevisionCode","FileFormat","StoragePath","Sha256Hash","FileSizeBytes","EstimatedDurationMinutes","EstimatedMassGrams","TechnicalNotes","CreatedAtUtc","TenantId") VALUES(vid,aid,rev,fmt,'factory-db:'||vid::text,digest,octet_length(bytes),secs/60,grams,public.factory_text_v2(p,'notes',0,2000),now(),t);
 INSERT INTO public.manufacturing_factory_files(tenant_id,branch_id,asset_id,version_id,filename,content,sha256,metadata,created_by) VALUES(t,b,aid,vid,filename,bytes,digest,meta,u);
 r:=jsonb_build_object('id',vid,'assetId',aid,'revision',rev,'sha256',digest);
 RETURN public.factory_end_command_v2(t,b,u,req,'CreateDesignVersion',p,r,'FactoryDesignVersion',vid);
END $function$;

CREATE FUNCTION public.factory_immutable_history_v3()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
BEGIN RAISE EXCEPTION 'Factory version/history is immutable' USING ERRCODE='23514';END $function$;

CREATE FUNCTION public.factory_register_received_spools_v3(t uuid, b uuid, u uuid, req uuid, p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE prior jsonb;item_id uuid;bal uuid;receipt public.goods_receipts%ROWTYPE;item public.goods_receipt_items%ROWTYPE;sb public.stock_balances%ROWTYPE;c public.manufacturing_material_balance_configs%ROWTYPE;n integer;grams numeric;tare numeric;batch text;stockqty numeric;claimed numeric;sp jsonb;r jsonb;
BEGIN
 prior:=public.factory_begin_command_v2(t,b,u,req,'RegisterReceivedSpools',p);IF prior IS NOT NULL THEN RETURN prior;END IF;
 item_id:=(p->>'receiptItemId')::uuid;bal:=(p->>'balanceId')::uuid;n:=public.factory_number_v2(p,'count',1,100,true);grams:=public.factory_number_v2(p,'grams',0.001,100000);tare:=public.factory_number_v2(p,'tare',0,100000);batch:=public.factory_text_v2(p,'batch',0,120);
 SELECT * INTO item FROM public.goods_receipt_items WHERE "TenantId"=t AND "Id"=item_id FOR UPDATE;
 IF NOT FOUND OR item."InventoryUnitId" IS NOT NULL OR item."RealUnitCost"<0 THEN RAISE EXCEPTION 'Receipt item unavailable' USING ERRCODE='22023';END IF;
 SELECT * INTO receipt FROM public.goods_receipts WHERE "TenantId"=t AND "BranchId"=b AND "Id"=item."GoodsReceiptId" AND "Status"=2 FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Receipt not posted' USING ERRCODE='23514';END IF;
 SELECT * INTO sb FROM public.stock_balances WHERE "TenantId"=t AND "BranchId"=b AND "Id"=bal FOR UPDATE;
 IF NOT FOUND OR sb."ProductSkuId"<>item."ProductSkuId" OR sb."WarehouseId"<>receipt."WarehouseId" OR sb."WarehouseLocationId" IS DISTINCT FROM receipt."WarehouseLocationId" THEN RAISE EXCEPTION 'Receipt and stock location differ' USING ERRCODE='22023';END IF;
 SELECT * INTO c FROM public.manufacturing_material_balance_configs WHERE tenant_id=t AND branch_id=b AND balance_id=bal AND kind='FILAMENT';
 IF NOT FOUND THEN RAISE EXCEPTION 'Filament not configured' USING ERRCODE='22023';END IF;
 stockqty:=grams/c.units_per_stock_unit;
 SELECT coalesce(sum(stock_quantity),0) INTO claimed FROM public.manufacturing_factory_spool_receipts WHERE tenant_id=t AND branch_id=b AND receipt_item_id=item_id;
 IF claimed+n*stockqty>item."QuantityReceived" OR stockqty<>round(stockqty,4) THEN RAISE EXCEPTION 'Receipt quantity already allocated' USING ERRCODE='23514';END IF;
 r:=public.factory_register_spools_v2(t,b,u,req,bal,n,grams,tare,batch);
 FOR sp IN SELECT v FROM jsonb_array_elements(r) v LOOP
  INSERT INTO public.manufacturing_factory_spool_receipts(tenant_id,branch_id,spool_id,receipt_id,receipt_item_id,stock_quantity,receipt_unit_cost,created_by) VALUES(t,b,(sp->>'id')::uuid,receipt."Id",item_id,stockqty,item."RealUnitCost",u);
  UPDATE public.manufacturing_spool_details SET cost_per_gram=item."RealUnitCost"/c.units_per_stock_unit WHERE tenant_id=t AND branch_id=b AND spool_id=(sp->>'id')::uuid;
 END LOOP;
 RETURN public.factory_end_command_v2(t,b,u,req,'RegisterReceivedSpools',p,r,'FactoryReceipt',receipt."Id");
END $function$;

CREATE TRIGGER factory_immutable_files_v3 BEFORE DELETE OR UPDATE ON public.manufacturing_factory_files FOR EACH ROW EXECUTE FUNCTION factory_immutable_history_v3();

CREATE TRIGGER factory_immutable_receipts_v3 BEFORE DELETE OR UPDATE ON public.manufacturing_factory_spool_receipts FOR EACH ROW EXECUTE FUNCTION factory_immutable_history_v3();

CREATE TRIGGER factory_immutable_recipe_lines_v3 BEFORE DELETE OR UPDATE ON public.manufacturing_factory_recipe_lines FOR EACH ROW EXECUTE FUNCTION factory_immutable_history_v3();

CREATE TRIGGER factory_immutable_recipes_v3 BEFORE DELETE OR UPDATE ON public.manufacturing_factory_recipes FOR EACH ROW EXECUTE FUNCTION factory_immutable_history_v3();

COMMIT;
