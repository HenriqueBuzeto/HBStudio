-- Production for stock. Output is recognized only after quality approval.

-- Inventory valuation uses material Kardex cost; managerial costs are separate.

BEGIN;

ALTER TABLE public.manufacturing_factory_order_details ALTER COLUMN customer_id DROP NOT NULL;

ALTER TABLE public.manufacturing_factory_order_details DROP CONSTRAINT manufacturing_factory_order_details_approved_price_check;

ALTER TABLE public.manufacturing_factory_order_details ADD CONSTRAINT factory_order_customer_price_v7 CHECK((customer_id IS NULL AND approved_price=0) OR (customer_id IS NOT NULL AND approved_price>0));

CREATE TABLE public.manufacturing_factory_stock_output_v7 (
 "tenant_id" uuid NOT NULL,
 "branch_id" uuid NOT NULL,
 "order_id" uuid NOT NULL,
 "warehouse_id" uuid NOT NULL,
 "sku_id" uuid NOT NULL,
 "balance_id" uuid,
 "quantity" integer,
 "material_cost" numeric(18,2),
 "managerial_cost" numeric(24,6),
 "movement_id" uuid,
 "accounting_state" text,
 "posted_at" timestamp with time zone,
 CONSTRAINT "manufacturing_factory_stock_o_tenant_id_branch_id_balance__fkey" FOREIGN KEY (tenant_id, branch_id, balance_id) REFERENCES stock_balances("TenantId", "BranchId", "Id"),
 CONSTRAINT "manufacturing_factory_stock_o_tenant_id_branch_id_order_id_fkey" FOREIGN KEY (tenant_id, branch_id, order_id) REFERENCES manufacturing_orders("TenantId", "BranchId", "Id"),
 CONSTRAINT "manufacturing_factory_stock_output_v7_accounting_state_check" CHECK ((accounting_state = ANY (ARRAY['POSTED'::text, 'PENDING_CONFIGURATION'::text]))),
 CONSTRAINT "manufacturing_factory_stock_output_v7_check" CHECK ((((posted_at IS NULL) AND (balance_id IS NULL) AND (quantity IS NULL) AND (movement_id IS NULL) AND (accounting_state IS NULL)) OR ((posted_at IS NOT NULL) AND (balance_id IS NOT NULL) AND (quantity IS NOT NULL) AND (movement_id IS NOT NULL) AND (accounting_state IS NOT NULL) AND (material_cost IS NOT NULL) AND (managerial_cost IS NOT NULL)))),
 CONSTRAINT "manufacturing_factory_stock_output_v7_managerial_cost_check" CHECK ((managerial_cost >= (0)::numeric)),
 CONSTRAINT "manufacturing_factory_stock_output_v7_material_cost_check" CHECK ((material_cost >= (0)::numeric)),
 CONSTRAINT "manufacturing_factory_stock_output_v7_pkey" PRIMARY KEY (tenant_id, branch_id, order_id),
 CONSTRAINT "manufacturing_factory_stock_output_v7_quantity_check" CHECK ((quantity > 0)),
 CONSTRAINT "manufacturing_factory_stock_output_v7_tenant_id_sku_id_fkey" FOREIGN KEY (tenant_id, sku_id) REFERENCES product_skus("TenantId", "Id")
);

CREATE OR REPLACE FUNCTION public.factory_create_order_v2(t uuid, b uuid, u uuid, req uuid, p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE prior jsonb;r jsonb;new_order_id uuid:=gen_random_uuid();cust uuid;printer_id uuid;pr public.manufacturing_printers%ROWTYPE;seq bigint;number text;qty integer;secs integer;labsecs integer;tariff numeric;labor numeric;other numeric;waste numeric;margin numeric;fees numeric;price numeric;grams numeric;mat_sku uuid;f jsonb;s jsonb;est jsonb;line jsonb;due timestamptz; design_id uuid; target_sku uuid; target_wh uuid; stock_order boolean;
BEGIN
 prior:=public.factory_begin_command_v2(t,b,u,req,'CreateOrder',p);IF prior IS NOT NULL THEN RETURN prior;END IF;
 stock_order:=coalesce(p->>'purpose','CUSTOM')='STOCK';
 IF coalesce(p->>'purpose','CUSTOM') NOT IN('CUSTOM','STOCK') THEN RAISE EXCEPTION 'Invalid order purpose' USING ERRCODE='22023';END IF;
 cust:=nullif(p->>'customerId','')::uuid;printer_id:=(p->>'printerId')::uuid;design_id:=(p->>'designVersionId')::uuid;
 IF design_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.manufacturing_factory_files f JOIN public.manufacturing_design_assets a ON a."Id"=f.asset_id AND a."TenantId"=f.tenant_id AND a."BranchId"=f.branch_id WHERE f.tenant_id=t AND f.branch_id=b AND f.version_id=design_id AND a."IsCommercialAllowed") THEN RAISE EXCEPTION 'Design version unavailable or not commercially licensed' USING ERRCODE='22023';END IF;
 IF stock_order THEN
  target_sku:=(p->>'targetSkuId')::uuid;target_wh:=(p->>'targetWarehouseId')::uuid;
  IF cust IS NOT NULL OR NOT EXISTS(SELECT 1 FROM public.product_skus s JOIN public.product_models m ON m."Id"=s."ProductModelId" AND m."TenantId"=s."TenantId" WHERE s."TenantId"=t AND s."Id"=target_sku AND s."IsActive" AND m."IsActive" AND m."Kind"=5 AND m."SerializationPolicy"=0) OR NOT EXISTS(SELECT 1 FROM public.warehouses w WHERE w."TenantId"=t AND w."BranchId"=b AND w."Id"=target_wh AND w."IsActive" AND w."Type" IN(1,2,4)) THEN RAISE EXCEPTION 'Invalid stock production destination' USING ERRCODE='22023';END IF;
  IF EXISTS(SELECT 1 FROM unnest(ARRAY['inventory.view','inventory.adjust','inventory.cost.view']) k WHERE NOT EXISTS(SELECT 1 FROM public.user_roles ur JOIN public.role_permissions rp ON rp."TenantId"=ur."TenantId" AND rp."RoleId"=ur."RoleId" WHERE ur."TenantId"=t AND ur."UserId"=u AND rp."PermissionKey"=k)) THEN RAISE EXCEPTION 'Stock production permission' USING ERRCODE='42501';END IF;
 ELSE
  IF NOT EXISTS(SELECT 1 FROM public.parties x JOIN public.customer_profiles cp ON cp."TenantId"=x."TenantId" AND cp."PartyId"=x."Id" WHERE x."TenantId"=t AND x."Id"=cust AND x."IsActive") THEN RAISE EXCEPTION 'Customer unavailable' USING ERRCODE='22023';END IF;
 END IF;
 SELECT * INTO pr FROM public.manufacturing_printers WHERE "TenantId"=t AND "BranchId"=b AND "Id"=printer_id AND "Status" NOT IN (7,8);
 IF NOT FOUND OR pr."AveragePowerWatts"<=0 OR pr."ConfiguredHourlyMachineCost"<0 THEN RAISE EXCEPTION 'Printer unavailable or invalid costs' USING ERRCODE='22023';END IF;
 qty:=public.factory_number_v2(p,'quantity',1,100000,true);secs:=public.factory_number_v2(p,'seconds',1,31536000,true);labsecs:=public.factory_number_v2(p,'laborSeconds',0,31536000,true);
 tariff:=public.factory_number_v2(p,'tariff',0,1000000);labor:=public.factory_number_v2(p,'laborHour',0,1000000);other:=public.factory_number_v2(p,'other',0,1000000);waste:=public.factory_number_v2(p,'wastePct',0,100);margin:=public.factory_number_v2(p,'marginPct',0,99.9999);fees:=public.factory_number_v2(p,'feePct',0,99.9999);price:=CASE WHEN stock_order THEN 0 ELSE public.factory_number_v2(p,'approvedPrice',0.01,100000000) END;
 IF margin+fees>=100 OR price<>round(price,2) THEN RAISE EXCEPTION 'Invalid price or margin' USING ERRCODE='22023';END IF;
 IF jsonb_typeof(p->'plan') IS DISTINCT FROM 'array' OR jsonb_array_length(p->'plan') NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Material plan required' USING ERRCODE='22023';END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p->'plan') l GROUP BY l->>'balanceId',coalesce(l->>'spoolId','') HAVING count(*)>1) THEN RAISE EXCEPTION 'Duplicate material line' USING ERRCODE='22023';END IF;
 SELECT x."ProductSkuId" INTO mat_sku FROM jsonb_array_elements(p->'plan') l JOIN public.manufacturing_material_balance_configs c ON c.tenant_id=t AND c.branch_id=b AND c.balance_id=(l->>'balanceId')::uuid AND c.kind='FILAMENT' JOIN public.stock_balances x ON x."Id"=c.balance_id WHERE l->>'spoolId' IS NOT NULL LIMIT 1;
 IF mat_sku IS NULL THEN RAISE EXCEPTION 'At least one filament spool required' USING ERRCODE='22023';END IF;
 IF p->>'dueAt' IS NOT NULL AND p->>'dueAt'<>'' THEN due:=(p->>'dueAt')::timestamptz;END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(t::text||b::text||'factory-order',4));
 SELECT coalesce(max(sequence_no),0)+1 INTO seq FROM public.manufacturing_factory_order_details WHERE tenant_id=t AND branch_id=b;
 number:='OS3D-'||lpad(seq::text,greatest(6,length(seq::text)),'0');
 INSERT INTO public.manufacturing_orders("Id","OrderNumber","Type","Status","AssignedPrinterId","DesignVersionId","TargetProductSkuId","MaterialProductSkuId","PlannedQuantity","ProducedQuantity","ApprovedQuantity","RejectedQuantity","EstimatedFilamentGrams","EstimatedPrintTimeMinutes","TotalEstimatedCost","ActualMaterialCost","ActualEnergyCost","ActualMachineCost","ActualLaborCost","ActualWasteCost","CreatedAtUtc","TenantId","BranchId") VALUES(new_order_id,number,CASE WHEN stock_order THEN 1 ELSE 2 END,7,printer_id,design_id,target_sku,mat_sku,qty,0,0,0,0,secs/60::numeric,0,0,0,0,0,0,now(),t,b);
 INSERT INTO public.manufacturing_factory_order_details(tenant_id,branch_id,order_id,sequence_no,customer_id,title,notes,due_at,estimated_seconds,estimated_labor_seconds,tariff,labor_hour,other_estimate,waste_pct,margin_pct,fee_pct,approved_price,price_recorded_by) VALUES(t,b,new_order_id,seq,cust,public.factory_text_v2(p,'title',1,160),public.factory_text_v2(p,'notes',0,4000),due,secs,labsecs,tariff,labor,other,waste,margin,fees,price,u);
 IF stock_order THEN INSERT INTO public.manufacturing_factory_stock_output_v7(tenant_id,branch_id,order_id,warehouse_id,sku_id) VALUES(t,b,new_order_id,target_wh,target_sku);END IF;
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

CREATE OR REPLACE FUNCTION public.factory_guard_order_v2()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
 IF EXISTS(SELECT 1 FROM public.manufacturing_factory_order_details d WHERE d.tenant_id=OLD."TenantId" AND d.branch_id=OLD."BranchId" AND d.order_id=OLD."Id") THEN
  IF current_setting('hbstudio.factory_order_command',true) IS DISTINCT FROM OLD."Id"::text OR (NEW."TenantId",NEW."BranchId",NEW."Id",NEW."OrderNumber",NEW."Type",NEW."TargetProductSkuId",NEW."MaterialProductSkuId",NEW."PlannedQuantity") IS DISTINCT FROM (OLD."TenantId",OLD."BranchId",OLD."Id",OLD."OrderNumber",OLD."Type",OLD."TargetProductSkuId",OLD."MaterialProductSkuId",OLD."PlannedQuantity") THEN RAISE EXCEPTION 'Managed factory order requires factory workflow' USING ERRCODE='23514';END IF;
 END IF;RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.factory_post_stock_output_v7(t uuid, b uuid, u uuid, ord uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE o public.manufacturing_orders%ROWTYPE;x public.manufacturing_factory_stock_output_v7%ROWTYPE;sb public.stock_balances%ROWTYPE;cfg public.internal_checkout_config_v5%ROWTYPE;bal uuid;mov uuid:=gen_random_uuid();qty integer;material numeric;waste numeric;managerial numeric;avg_cost numeric;unit_cost numeric;eid uuid;wid uuid;accounting text:='PENDING_CONFIGURATION';
BEGIN
 PERFORM public.factory_assert_actor_v2(t,b,u);
 IF current_setting('hbstudio.factory_order_command',true) IS DISTINCT FROM ord::text THEN RAISE EXCEPTION 'Stock output requires quality workflow' USING ERRCODE='42501';END IF;
 SELECT * INTO o FROM public.manufacturing_orders WHERE "TenantId"=t AND "BranchId"=b AND "Id"=ord FOR UPDATE;
 SELECT * INTO x FROM public.manufacturing_factory_stock_output_v7 WHERE tenant_id=t AND branch_id=b AND order_id=ord FOR UPDATE;
 IF NOT FOUND OR o."Type"<>1 OR o."Status"<>12 OR o."ApprovedQuantity"<>o."PlannedQuantity" OR o."TargetProductSkuId" IS DISTINCT FROM x.sku_id OR o."SalesOrderId" IS NOT NULL THEN RAISE EXCEPTION 'Invalid finished stock order' USING ERRCODE='23514';END IF;
 IF x.posted_at IS NOT NULL THEN RETURN;END IF;
 IF NOT EXISTS(SELECT 1 FROM public.warehouses w WHERE w."TenantId"=t AND w."BranchId"=b AND w."Id"=x.warehouse_id AND w."IsActive" AND w."Type" IN(1,2,4)) OR NOT EXISTS(SELECT 1 FROM public.product_skus s JOIN public.product_models m ON m."Id"=s."ProductModelId" AND m."TenantId"=s."TenantId" WHERE s."TenantId"=t AND s."Id"=x.sku_id AND s."IsActive" AND m."IsActive" AND m."Kind"=5 AND m."SerializationPolicy"=0) THEN RAISE EXCEPTION 'Finished stock destination unavailable' USING ERRCODE='23514';END IF;
 IF EXISTS(SELECT 1 FROM public.manufacturing_material_allocations a WHERE a.tenant_id=t AND a.branch_id=b AND a.order_id=ord AND (a.state='RESERVED' OR (a.state='CONSUMED' AND NOT EXISTS(SELECT 1 FROM public.stock_movements m WHERE m."TenantId"=t AND m."BranchId"=b AND m."IdempotencyKey"='FAB-CONSUME-'||a.id::text AND m."MovementType"=10)))) THEN RAISE EXCEPTION 'Material ledger incomplete' USING ERRCODE='23514';END IF;
 SELECT coalesce(sum(m."TotalCost") FILTER(WHERE NOT a.waste),0),coalesce(sum(m."TotalCost") FILTER(WHERE a.waste),0) INTO material,waste FROM public.manufacturing_material_allocations a JOIN public.stock_movements m ON m."TenantId"=a.tenant_id AND m."BranchId"=a.branch_id AND m."IdempotencyKey"='FAB-CONSUME-'||a.id::text AND m."MovementType"=10 WHERE a.tenant_id=t AND a.branch_id=b AND a.order_id=ord AND a.state='CONSUMED';
 qty:=o."ApprovedQuantity";unit_cost:=round(material/qty,4);managerial:=o."ActualMaterialCost"+o."ActualWasteCost"+o."ActualEnergyCost"+o."ActualMachineCost"+o."ActualLaborCost";
 PERFORM pg_advisory_xact_lock(hashtextextended(t::text||b::text||x.sku_id::text||x.warehouse_id::text,19));
 IF (SELECT count(*) FROM public.stock_balances WHERE "TenantId"=t AND "BranchId"=b AND "ProductSkuId"=x.sku_id AND "WarehouseId"=x.warehouse_id AND "WarehouseLocationId" IS NULL)>1 THEN RAISE EXCEPTION 'Duplicate destination stock balances' USING ERRCODE='23514';END IF;
 SELECT * INTO sb FROM public.stock_balances WHERE "TenantId"=t AND "BranchId"=b AND "ProductSkuId"=x.sku_id AND "WarehouseId"=x.warehouse_id AND "WarehouseLocationId" IS NULL FOR UPDATE;
 IF FOUND THEN
  IF EXISTS(SELECT 1 FROM public.manufacturing_material_balance_configs c WHERE c.tenant_id=t AND c.branch_id=b AND c.balance_id=sb."Id") OR sb."OnHandQuantity"<0 THEN RAISE EXCEPTION 'Invalid finished stock balance' USING ERRCODE='23514';END IF;
  bal:=sb."Id";avg_cost:=round((sb."OnHandQuantity"*sb."AverageCost"+material)/(sb."OnHandQuantity"+qty),4);
  UPDATE public.stock_balances SET "OnHandQuantity"="OnHandQuantity"+qty,"AverageCost"=avg_cost,"LastMovementAtUtc"=now(),"UpdatedAtUtc"=now() WHERE "Id"=bal AND "TenantId"=t AND "BranchId"=b;
 ELSE
  bal:=gen_random_uuid();INSERT INTO public.stock_balances("Id","TenantId","BranchId","WarehouseId","ProductSkuId","OnHandQuantity","ReservedQuantity","BlockedQuantity","AverageCost","LastMovementAtUtc","CreatedAtUtc") VALUES(bal,t,b,x.warehouse_id,x.sku_id,qty,0,0,unit_cost,now(),now());
 END IF;
 INSERT INTO public.stock_movements("Id","TenantId","BranchId","WarehouseId","ProductSkuId","MovementType","Quantity","UnitCost","TotalCost","BalanceAfterQuantity","DocumentReference","Reason","CorrelationId","IdempotencyKey","CreatedByUserId","CreatedAtUtc") VALUES(mov,t,b,x.warehouse_id,x.sku_id,11,qty,unit_cost,material,coalesce(sb."OnHandQuantity",0)+qty,o."OrderNumber",'Produto acabado aprovado; custo de material do Kardex',ord,'FAB-OUTPUT-'||ord::text,u,now());
 IF EXISTS(SELECT 1 FROM public.internal_checkout_config_v5 WHERE tenant_id=t AND branch_id=b) THEN
  cfg:=public.internal_checkout_config_get_v5(t,b);
  eid:=public.internal_checkout_journal_v5(t,b,u,'FACTORY_MATERIAL_COMPLETE',ord,o."OrderNumber",'Transferência de matéria-prima para produto acabado',cfg.finished_account,cfg.stock_account,material);
  wid:=public.internal_checkout_journal_v5(t,b,u,'FACTORY_MATERIAL_WASTE',ord,o."OrderNumber",'Refugo de material na produção',cfg.waste_account,cfg.stock_account,waste);
  INSERT INTO public.factory_material_capitalization_v5(tenant_id,branch_id,order_id,productive_cost,waste_cost,productive_entry,waste_entry) VALUES(t,b,ord,material,waste,eid,wid);
  accounting:='POSTED';
 END IF;
 UPDATE public.manufacturing_factory_stock_output_v7 SET balance_id=bal,quantity=qty,material_cost=material,managerial_cost=managerial,movement_id=mov,accounting_state=accounting,posted_at=now() WHERE tenant_id=t AND branch_id=b AND order_id=ord;
 INSERT INTO public.audit_events("Id","TenantId","BranchId","EntityType","EntityId","Action","ActorId","ActorEmail","CorrelationId","AfterStateJson","CreatedAtUtc","Version") SELECT gen_random_uuid(),t,b,'FactoryStockOutput',ord::text,'Received',u,z."Email",ord::text,jsonb_build_object('balanceId',bal,'quantity',qty,'materialCost',material,'managerialCost',managerial,'accountingState',accounting),now(),1 FROM public.users z WHERE z."Id"=u;
END $function$;

CREATE OR REPLACE FUNCTION public.factory_quality_v2(t uuid, b uuid, u uuid, req uuid, p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE prior jsonb;r jsonb;ord uuid;o public.manufacturing_orders%ROWTYPE;d public.manufacturing_factory_order_details%ROWTYPE;approved integer;rejected integer;labsecs integer;notes text;pending integer;n integer;given integer;line record;actual numeric;labor numeric;next_status integer;
BEGIN
 prior:=public.factory_begin_command_v2(t,b,u,req,'Quality',p);IF prior IS NOT NULL THEN RETURN prior;END IF;
 ord:=(p->>'orderId')::uuid;
 SELECT * INTO o FROM public.manufacturing_orders WHERE "TenantId"=t AND "BranchId"=b AND "Id"=ord FOR UPDATE;
 SELECT * INTO d FROM public.manufacturing_factory_order_details WHERE tenant_id=t AND branch_id=b AND order_id=ord;
 IF NOT FOUND OR o."Status"<>10 OR public.factory_number_v2(p,'version',1,2147483647,true)<>d.version THEN RAISE EXCEPTION 'Order not in assembly or stale' USING ERRCODE='23514';END IF;
 pending:=o."ProducedQuantity"-o."ApprovedQuantity"-o."RejectedQuantity";
 approved:=public.factory_number_v2(p,'approvedQuantity',0,pending,true);rejected:=public.factory_number_v2(p,'rejectedQuantity',0,pending,true);
 labsecs:=public.factory_number_v2(p,'laborSeconds',0,31536000,true);notes:=public.factory_text_v2(p,'notes',0,1000);
 IF pending<=0 OR approved+rejected<>pending OR (rejected>0 AND length(notes)<4) THEN RAISE EXCEPTION 'Inspect all produced items and document rejection' USING ERRCODE='22023';END IF;
 IF jsonb_typeof(p->'actuals') IS DISTINCT FROM 'array' OR jsonb_array_length(p->'actuals')>100 THEN RAISE EXCEPTION 'Supply consumption list required' USING ERRCODE='22023';END IF;
 SELECT count(*) INTO n FROM public.manufacturing_material_allocations WHERE tenant_id=t AND branch_id=b AND order_id=ord AND spool_id IS NULL AND state='RESERVED';
 SELECT count(DISTINCT l->>'allocationId') INTO given FROM jsonb_array_elements(p->'actuals') l;
 IF n<>given OR n<>jsonb_array_length(p->'actuals') THEN RAISE EXCEPTION 'Report each reserved supply once' USING ERRCODE='22023';END IF;
 FOR line IN SELECT a.id,a.planned_quantity,l FROM public.manufacturing_material_allocations a JOIN jsonb_array_elements(p->'actuals') l ON (l->>'allocationId')::uuid=a.id WHERE a.tenant_id=t AND a.branch_id=b AND a.order_id=ord AND a.spool_id IS NULL AND a.state='RESERVED' ORDER BY a.balance_id,a.id LOOP
  actual:=public.factory_number_v2(line.l,'quantity',0,line.planned_quantity,true);
  PERFORM public.factory_settle_material_v2(t,b,u,gen_random_uuid(),line.id,actual,false,NULL);
  given:=given-1;
 END LOOP;
 IF given<>0 OR EXISTS(SELECT 1 FROM public.manufacturing_material_allocations WHERE tenant_id=t AND branch_id=b AND order_id=ord AND state='RESERVED') THEN RAISE EXCEPTION 'Outstanding material allocations' USING ERRCODE='23514';END IF;
 labor:=round(d.labor_hour*labsecs/3600,6);next_status:=CASE WHEN o."ApprovedQuantity"+approved=o."PlannedQuantity" THEN 12 ELSE 7 END;
 PERFORM set_config('hbstudio.factory_order_command',ord::text,true);
 INSERT INTO public.manufacturing_factory_quality_events(tenant_id,branch_id,request_id,order_id,approved_quantity,rejected_quantity,notes,labor_seconds,labor_cost,actor_id) VALUES(t,b,req,ord,approved,rejected,notes,labsecs,labor,u);
 UPDATE public.manufacturing_orders SET "Status"=next_status,"ApprovedQuantity"="ApprovedQuantity"+approved,"RejectedQuantity"="RejectedQuantity"+rejected,"ActualLaborCost"="ActualLaborCost"+labor,"FailureReason"=CASE WHEN rejected>0 THEN notes ELSE NULL END,"FinishedAtUtc"=CASE WHEN next_status=12 THEN now() ELSE NULL END,"UpdatedAtUtc"=now() WHERE "Id"=ord;
 UPDATE public.manufacturing_factory_order_details SET version=version+1 WHERE tenant_id=t AND branch_id=b AND order_id=ord;
 IF next_status=12 AND o."Type"=1 THEN PERFORM public.factory_post_stock_output_v7(t,b,u,ord);END IF;
 r:=jsonb_build_object('orderId',ord,'status',next_status,'version',d.version+1,'approvedQuantity',approved,'rejectedQuantity',rejected);
 RETURN public.factory_end_command_v2(t,b,u,req,'Quality',p,r,'FactoryOrder',ord);
END $function$;

CREATE OR REPLACE FUNCTION public.internal_checkout_cash_v5(t uuid, b uuid, u uuid, req uuid, p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE prev public.internal_checkout_records_v5%ROWTYPE; cfg public.internal_checkout_config_v5%ROWTYPE; sh public.cash_shifts%ROWTYPE;
 o public.manufacturing_orders%ROWTYPE; d public.manufacturing_factory_order_details%ROWTYPE; cap public.factory_material_capitalization_v5%ROWTYPE;
 sb public.stock_balances%ROWTYPE; line jsonb; rows jsonb:='[]'::jsonb; lr jsonb; customer uuid; ord uuid; shift_id uuid;
 sid uuid:=gen_random_uuid();pid uuid:=gen_random_uuid();mid uuid:=gen_random_uuid();eid uuid;cid uuid;item_id uuid; bal uuid;sku uuid;
 code text;descr text;kind integer;cart_kind integer;serial_policy integer;unit_price numeric;unit_cost numeric;qty numeric;cost numeric;total numeric:=0;stock_cost numeric:=0;managerial numeric:=0;waste_cost numeric:=0;tendered numeric;expected numeric;number text;rev_account uuid;asset_account uuid;ref text;result jsonb;
BEGIN
 PERFORM public.internal_checkout_authorize_v5(t,b,u,'sales.create');
 IF req IS NULL OR jsonb_typeof(p) IS DISTINCT FROM 'object' OR jsonb_typeof(p->'cashConfirmed') IS DISTINCT FROM 'boolean' OR (p->>'cashConfirmed')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'CHECKOUT_CASH_CONFIRMATION_REQUIRED' USING ERRCODE='22023';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(t::text||b::text||req::text,6));
 SELECT * INTO prev FROM public.internal_checkout_records_v5 WHERE tenant_id=t AND branch_id=b AND request_id=req;
 IF FOUND THEN
  IF prev.payload<>p OR prev.actor_id<>u THEN RAISE EXCEPTION 'CHECKOUT_IDEMPOTENCY_CONFLICT' USING ERRCODE='23514';END IF;
  RETURN jsonb_build_object('saleId',prev.sale_id,'number',(SELECT z."SaleNumber" FROM public.sales z WHERE z."TenantId"=t AND z."BranchId"=b AND z."Id"=prev.sale_id),'total',prev.total,'change',prev.change_amount,'state',prev.state,'fiscalIssued',false,'replayed',true);
 END IF;
 cfg:=public.internal_checkout_config_get_v5(t,b);
 shift_id:=(p->>'shiftId')::uuid;ord:=(p->>'orderId')::uuid;customer:=(p->>'customerId')::uuid;
 tendered:=public.factory_number_v2(p,'tendered',0.01,1000000);expected:=public.factory_number_v2(p,'expectedTotal',0.01,1000000);
 IF tendered<>round(tendered,2) OR expected<>round(expected,2) THEN RAISE EXCEPTION 'CHECKOUT_CENTS_REQUIRED' USING ERRCODE='22023';END IF;
 SELECT * INTO sh FROM public.cash_shifts WHERE "TenantId"=t AND "BranchId"=b AND "Id"=shift_id FOR UPDATE;
 IF NOT FOUND OR sh."Status"<>1 OR sh."OperatorUserId"<>u OR NOT EXISTS(SELECT 1 FROM public.cash_registers cr WHERE cr."TenantId"=t AND cr."BranchId"=b AND cr."Id"=sh."CashRegisterId" AND cr."Status"=1) THEN RAISE EXCEPTION 'CHECKOUT_SHIFT_NOT_OPEN' USING ERRCODE='23514';END IF;
 IF ord IS NOT NULL THEN
  IF p ? 'items' AND p->'items'<>'[]'::jsonb THEN RAISE EXCEPTION 'CHECKOUT_FACTORY_NO_MIXED_CART' USING ERRCODE='22023';END IF;
  SELECT * INTO o FROM public.manufacturing_orders WHERE "TenantId"=t AND "BranchId"=b AND "Id"=ord FOR UPDATE;
  IF NOT FOUND OR o."Status"<>12 OR o."Type"<>2 OR o."SalesOrderId" IS NOT NULL OR o."ApprovedQuantity"<>o."PlannedQuantity" THEN RAISE EXCEPTION 'CHECKOUT_ORDER_NOT_READY' USING ERRCODE='23514';END IF;
  SELECT * INTO d FROM public.manufacturing_factory_order_details WHERE tenant_id=t AND branch_id=b AND order_id=ord;
  IF NOT FOUND OR d.version<>public.factory_number_v2(p,'version',1,2147483647,true) OR (customer IS NOT NULL AND customer<>d.customer_id) OR EXISTS(SELECT 1 FROM public.manufacturing_material_allocations a WHERE a.tenant_id=t AND a.branch_id=b AND a.order_id=ord AND a.state='RESERVED') THEN RAISE EXCEPTION 'CHECKOUT_ORDER_CONFLICT' USING ERRCODE='23514';END IF;
  customer:=d.customer_id;total:=d.approved_price;managerial:=o."ActualMaterialCost"+o."ActualWasteCost"+o."ActualEnergyCost"+o."ActualMachineCost"+o."ActualLaborCost";
  SELECT * INTO cap FROM public.factory_material_capitalization_v5 WHERE tenant_id=t AND branch_id=b AND order_id=ord;
  IF NOT FOUND THEN
   IF EXISTS(SELECT 1 FROM public.manufacturing_material_allocations a WHERE a.tenant_id=t AND a.branch_id=b AND a.order_id=ord AND a.state='CONSUMED' AND NOT EXISTS(SELECT 1 FROM public.stock_movements m WHERE m."TenantId"=t AND m."BranchId"=b AND m."IdempotencyKey"='FAB-CONSUME-'||a.id::text AND m."MovementType"=10)) THEN RAISE EXCEPTION 'CHECKOUT_MISSING_KARDEX' USING ERRCODE='23514';END IF;
   SELECT coalesce(sum(m."TotalCost") FILTER(WHERE NOT a.waste),0),coalesce(sum(m."TotalCost") FILTER(WHERE a.waste),0) INTO stock_cost,waste_cost FROM public.manufacturing_material_allocations a JOIN public.stock_movements m ON m."TenantId"=a.tenant_id AND m."BranchId"=a.branch_id AND m."IdempotencyKey"='FAB-CONSUME-'||a.id::text AND m."MovementType"=10 WHERE a.tenant_id=t AND a.branch_id=b AND a.order_id=ord AND a.state='CONSUMED';
   eid:=public.internal_checkout_journal_v5(t,b,u,'FACTORY_MATERIAL_COMPLETE',ord,o."OrderNumber",'Apropriação de material ao produto acabado',cfg.finished_account,cfg.stock_account,stock_cost);
   cid:=public.internal_checkout_journal_v5(t,b,u,'FACTORY_MATERIAL_WASTE',ord,o."OrderNumber",'Refugo de material na produção',cfg.waste_account,cfg.stock_account,waste_cost);
   INSERT INTO public.factory_material_capitalization_v5(tenant_id,branch_id,order_id,productive_cost,waste_cost,productive_entry,waste_entry) VALUES(t,b,ord,stock_cost,waste_cost,eid,cid);
  ELSE stock_cost:=cap.productive_cost;END IF;
  SELECT s."SkuCode" INTO code FROM public.product_skus s WHERE s."TenantId"=t AND s."Id"=cfg.factory_sku;
  rows:=jsonb_build_array(jsonb_build_object('sku',cfg.factory_sku,'code',code,'description',left(d.title||' — '||o."ApprovedQuantity"||' peça(s) · '||o."OrderNumber",300),'quantity',1,'price',total,'unitCost',stock_cost,'balance',null));
  rev_account:=cfg.factory_revenue_account;asset_account:=cfg.finished_account;
 ELSE
  IF jsonb_typeof(p->'items') IS DISTINCT FROM 'array' OR jsonb_array_length(p->'items') NOT BETWEEN 1 AND 100 OR EXISTS(SELECT 1 FROM jsonb_array_elements(p->'items') x GROUP BY (x->>'balanceId')::uuid HAVING count(*)>1) THEN RAISE EXCEPTION 'CHECKOUT_ITEMS_INVALID' USING ERRCODE='22023';END IF;
  FOR line IN SELECT x FROM jsonb_array_elements(p->'items') x ORDER BY (x->>'balanceId')::uuid LOOP
   bal:=(line->>'balanceId')::uuid;qty:=public.factory_number_v2(line,'quantity',1,100000,true);
   SELECT * INTO sb FROM public.stock_balances WHERE "TenantId"=t AND "BranchId"=b AND "Id"=bal FOR UPDATE;
   IF NOT FOUND OR qty>sb."OnHandQuantity"-sb."ReservedQuantity"-sb."BlockedQuantity" OR EXISTS(SELECT 1 FROM public.manufacturing_material_balance_configs c WHERE c.tenant_id=t AND c.branch_id=b AND c.balance_id=bal) OR NOT EXISTS(SELECT 1 FROM public.warehouses w WHERE w."TenantId"=t AND w."BranchId"=b AND w."Id"=sb."WarehouseId" AND w."IsActive") THEN RAISE EXCEPTION 'CHECKOUT_STOCK_UNAVAILABLE' USING ERRCODE='23514';END IF;
   SELECT s."Id",s."SkuCode",left(m."Name"||' · '||s."VariantName",300),s."DefaultPrice",m."Kind",m."SerializationPolicy" INTO sku,code,descr,unit_price,kind,serial_policy FROM public.product_skus s JOIN public.product_models m ON m."Id"=s."ProductModelId" AND m."TenantId"=t AND m."IsActive" WHERE s."TenantId"=t AND s."Id"=sb."ProductSkuId" AND s."IsActive";
   IF NOT FOUND OR kind NOT IN(1,5) OR serial_policy<>0 OR unit_price<=0 OR unit_price<>round(unit_price,2) OR sb."AverageCost"<0  THEN RAISE EXCEPTION 'CHECKOUT_SKU_NOT_SUPPORTED' USING ERRCODE='23514';END IF;
   IF cart_kind IS NULL THEN cart_kind:=kind;ELSIF cart_kind<>kind THEN RAISE EXCEPTION 'CHECKOUT_MIXED_STOCK_TYPES' USING ERRCODE='22023';END IF;
   unit_cost:=round(sb."AverageCost",2);cost:=round(qty*sb."AverageCost",2);total:=total+qty*unit_price;stock_cost:=stock_cost+cost;managerial:=managerial+qty*sb."AverageCost";
   rows:=rows||jsonb_build_array(jsonb_build_object('sku',sku,'code',code,'description',descr,'quantity',qty,'price',unit_price,'unitCost',unit_cost,'cost',cost,'balance',bal));
  END LOOP;
  rev_account:=CASE WHEN cart_kind=5 THEN cfg.factory_revenue_account ELSE cfg.goods_revenue_account END;asset_account:=CASE WHEN cart_kind=5 THEN cfg.finished_account ELSE cfg.stock_account END;
 END IF;
 IF customer IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.parties x JOIN public.customer_profiles cp ON cp."TenantId"=x."TenantId" AND cp."PartyId"=x."Id" WHERE x."TenantId"=t AND x."Id"=customer AND x."IsActive") THEN RAISE EXCEPTION 'CHECKOUT_CUSTOMER_INVALID' USING ERRCODE='22023';END IF;
 IF total<>expected OR total<=0 OR tendered<total THEN RAISE EXCEPTION 'CHECKOUT_PRICE_OR_TENDER_CONFLICT' USING ERRCODE='23514';END IF;
 number:='QA-VD-'||upper(replace(sid::text,'-',''));
 INSERT INTO public.sales("Id","TenantId","BranchId","SaleNumber","CustomerPartyId","SellerUserId","CreatedByUserId","Status","PaymentStatus","FulfillmentStatus","DiscountTotal","ChargesTotal","Observations","IdempotencyKey","CreatedAtUtc") VALUES(sid,t,b,number,customer,u,u,1,1,1,0,0,'Homologação interna isolada; sem emissão fiscal.','QA-CHECKOUT-'||req::text,now());
 FOR lr IN SELECT x FROM jsonb_array_elements(rows) x LOOP
  item_id:=gen_random_uuid();bal:=(lr->>'balance')::uuid;qty:=(lr->>'quantity')::numeric;
  INSERT INTO public.sale_items("Id","TenantId","SaleId","ProductSkuId","HistoricalSkuCode","HistoricalDescription","ItemCondition","Quantity","UnitPrice","Discount","HistoricalUnitCost","WarrantyDays","CreatedAtUtc")
  VALUES(item_id,t,sid,(lr->>'sku')::uuid,lr->>'code',lr->>'description',1,qty,(lr->>'price')::numeric,0,(lr->>'unitCost')::numeric,0,now());
  IF bal IS NOT NULL THEN
   SELECT * INTO sb FROM public.stock_balances WHERE "TenantId"=t AND "BranchId"=b AND "Id"=bal FOR UPDATE;
   UPDATE public.stock_balances SET "OnHandQuantity"="OnHandQuantity"-qty,"LastMovementAtUtc"=now(),"UpdatedAtUtc"=now() WHERE "TenantId"=t AND "BranchId"=b AND "Id"=bal;
   INSERT INTO public.stock_movements("Id","TenantId","BranchId","WarehouseId","WarehouseLocationId","ProductSkuId","MovementType","Quantity","UnitCost","TotalCost","BalanceAfterQuantity","DocumentReference","Reason","CorrelationId","IdempotencyKey","CreatedByUserId","CreatedAtUtc") VALUES(gen_random_uuid(),t,b,sb."WarehouseId",sb."WarehouseLocationId",sb."ProductSkuId",4,-qty,sb."AverageCost",(lr->>'cost')::numeric,sb."OnHandQuantity"-qty,number,'Venda interna QA',sid,'QA-SALE-OUT-'||item_id::text,u,now());
  END IF;
 END LOOP;
 INSERT INTO public.sale_payment_intents("Id","TenantId","SaleId","Method","Amount","Installments","Status","AuthorizationCode","Notes","ConfirmedAtUtc","CreatedAtUtc") VALUES(pid,t,sid,1,total,1,2,'OPERATOR-CASH-QA','Dinheiro registrado pelo operador em homologação',now(),now());
 INSERT INTO public.cash_movements("Id","TenantId","BranchId","CashRegisterId","CashShiftId","MovementType","Direction","Amount","SourceType","SourceId","DocumentReference","Reason","CreatedByUserId","CorrelationId","IdempotencyKey","CreatedAtUtc") VALUES(mid,t,b,sh."CashRegisterId",shift_id,2,1,total,'SALE_PAYMENT',pid::text,number,'Recebimento em dinheiro QA',u,sid::text,'QA-SALE-CASH-'||sid::text,now());
 UPDATE public.cash_shifts SET "CurrentBalance"="CurrentBalance"+total,"TotalCashIn"="TotalCashIn"+total,"UpdatedAtUtc"=now() WHERE "TenantId"=t AND "BranchId"=b AND "Id"=shift_id;
 eid:=public.internal_checkout_journal_v5(t,b,u,'QA_SALE_REVENUE',sid,number,'Receita em dinheiro — homologação',cfg.cash_account,rev_account,total);
 cid:=public.internal_checkout_journal_v5(t,b,u,'QA_SALE_COGS',sid,number,'Custo de estoque vendido — homologação',cfg.cogs_account,asset_account,stock_cost);
 INSERT INTO public.internal_checkout_records_v5(tenant_id,branch_id,sale_id,request_id,actor_id,shift_id,order_id,customer_id,payload,total,tendered,change_amount,material_cost,managerial_cost,payment_id,cash_movement_id,revenue_entry_id,cogs_entry_id,state)
 VALUES(t,b,sid,req,u,shift_id,ord,customer,p,total,tendered,tendered-total,stock_cost,managerial,pid,mid,eid,cid,'REGISTERED');
 FOR lr IN SELECT x FROM jsonb_array_elements(rows) x WHERE x->>'balance' IS NOT NULL LOOP
  SELECT i."Id" INTO item_id FROM public.sale_items i JOIN public.stock_movements m ON m."IdempotencyKey"='QA-SALE-OUT-'||i."Id"::text AND m."TenantId"=t AND m."BranchId"=b JOIN public.stock_balances z ON z."TenantId"=t AND z."BranchId"=b AND z."Id"=(lr->>'balance')::uuid AND z."WarehouseId"=m."WarehouseId" AND z."WarehouseLocationId" IS NOT DISTINCT FROM m."WarehouseLocationId" AND z."ProductSkuId"=m."ProductSkuId" WHERE i."TenantId"=t AND i."SaleId"=sid AND i."ProductSkuId"=(lr->>'sku')::uuid;
  INSERT INTO public.internal_checkout_stock_lines_v5(tenant_id,branch_id,sale_id,sale_item_id,balance_id,quantity,cost) VALUES(t,b,sid,item_id,(lr->>'balance')::uuid,(lr->>'quantity')::numeric,(lr->>'cost')::numeric);
 END LOOP;
 IF ord IS NOT NULL THEN
  PERFORM set_config('hbstudio.factory_order_command',ord::text,true);
  UPDATE public.manufacturing_orders SET "SalesOrderId"=sid,"UpdatedAtUtc"=now() WHERE "TenantId"=t AND "BranchId"=b AND "Id"=ord;
  UPDATE public.manufacturing_factory_order_details SET version=version+1 WHERE tenant_id=t AND branch_id=b AND order_id=ord;
 END IF;
 IF customer IS NOT NULL THEN UPDATE public.customer_profiles SET "TotalSalesValue"="TotalSalesValue"+total,"UpdatedAtUtc"=now() WHERE "TenantId"=t AND "PartyId"=customer;END IF;
 PERFORM set_config('hbstudio.checkout_command',sid::text,true);
 UPDATE public.sales SET "Status"=4,"PaymentStatus"=4,"FulfillmentStatus"=2,"ConfirmedAtUtc"=now(),"UpdatedAtUtc"=now() WHERE "Id"=sid AND "TenantId"=t AND "BranchId"=b;
 result:=jsonb_build_object('saleId',sid,'number',number,'total',total,'change',tendered-total,'state','REGISTERED','fiscalIssued',false,'replayed',false);
 INSERT INTO public.audit_events("Id","TenantId","BranchId","EntityType","EntityId","Action","ActorId","ActorEmail","CorrelationId","AfterStateJson","CreatedAtUtc","Version") SELECT gen_random_uuid(),t,b,'InternalCheckout',sid::text,'CashRegistered',u,x."Email",req::text,result,now(),1 FROM public.users x WHERE x."Id"=u;
 RETURN result;
END $function$;

COMMIT;
