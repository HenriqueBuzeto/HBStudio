-- Precision: support exact 0.001g with 1000g per central unit. Preserve 14 integer digits.

-- Managerial lot cost and canonical weighted-average inventory cost remain separate.

BEGIN;

ALTER TABLE public.stock_balances ALTER COLUMN "OnHandQuantity" TYPE numeric(20,6), ALTER COLUMN "ReservedQuantity" TYPE numeric(20,6), ALTER COLUMN "BlockedQuantity" TYPE numeric(20,6);

ALTER TABLE public.stock_movements ALTER COLUMN "Quantity" TYPE numeric(20,6), ALTER COLUMN "BalanceAfterQuantity" TYPE numeric(20,6);

ALTER TABLE public.stock_reservation_items ALTER COLUMN "Quantity" TYPE numeric(20,6);

ALTER TABLE public.stock_transfer_items ALTER COLUMN "Quantity" TYPE numeric(20,6);

ALTER TABLE public.inventory_count_items ALTER COLUMN "SystemSnapshotQuantity" TYPE numeric(20,6), ALTER COLUMN "CountedQuantity" TYPE numeric(20,6);

ALTER TABLE public.manufacturing_material_allocations ADD COLUMN actual_managerial_cost numeric(24,6) GENERATED ALWAYS AS (CASE WHEN actual_quantity IS NULL THEN NULL ELSE round(actual_quantity*unit_cost_snapshot,6) END) STORED;

ALTER TABLE public.manufacturing_material_allocations ALTER COLUMN planned_stock_quantity TYPE numeric(20,6), ALTER COLUMN actual_stock_quantity TYPE numeric(20,6);

ALTER TABLE public.manufacturing_factory_spool_receipts ALTER COLUMN stock_quantity TYPE numeric(20,6);

CREATE OR REPLACE FUNCTION public.factory_preview_order_v2(t uuid, b uuid, u uuid, p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE pr public.manufacturing_printers%ROWTYPE;line jsonb;c public.manufacturing_material_balance_configs%ROWTYPE;sb public.stock_balances%ROWTYPE;sp public.manufacturing_spools%ROWTYPE;d public.manufacturing_spool_details%ROWTYPE;qty numeric;already numeric;f jsonb:='[]';s jsonb:='[]';est jsonb;
BEGIN
 PERFORM public.factory_assert_actor_v2(t,b,u);
 IF jsonb_typeof(p->'plan') IS DISTINCT FROM 'array' OR jsonb_array_length(p->'plan') NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Material plan required' USING ERRCODE='22023';END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p->'plan') l GROUP BY l->>'balanceId',coalesce(l->>'spoolId','') HAVING count(*)>1) THEN RAISE EXCEPTION 'Duplicate material line' USING ERRCODE='22023';END IF;
 SELECT * INTO pr FROM public.manufacturing_printers WHERE "TenantId"=t AND "BranchId"=b AND "Id"=(p->>'printerId')::uuid AND "Status" NOT IN(7,8);
 IF NOT FOUND OR pr."AveragePowerWatts"<=0 OR pr."ConfiguredHourlyMachineCost"<0 THEN RAISE EXCEPTION 'Printer unavailable' USING ERRCODE='22023';END IF;
 FOR line IN SELECT l FROM jsonb_array_elements(p->'plan') l LOOP
  qty:=public.factory_number_v2(line,'quantity',0.001,1000000);
  SELECT * INTO c FROM public.manufacturing_material_balance_configs WHERE tenant_id=t AND branch_id=b AND balance_id=(line->>'balanceId')::uuid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Material not configured' USING ERRCODE='22023';END IF;
  SELECT * INTO sb FROM public.stock_balances WHERE "TenantId"=t AND "BranchId"=b AND "Id"=c.balance_id;
  IF qty/c.units_per_stock_unit<>round(qty/c.units_per_stock_unit,6) THEN RAISE EXCEPTION 'Unit precision unsupported' USING ERRCODE='22023';END IF;
  IF (SELECT sum(public.factory_number_v2(l,'quantity',0.001,1000000)/c.units_per_stock_unit) FROM jsonb_array_elements(p->'plan') l WHERE (l->>'balanceId')::uuid=c.balance_id)>sb."OnHandQuantity"-sb."ReservedQuantity"-sb."BlockedQuantity" THEN RAISE EXCEPTION 'Insufficient stock' USING ERRCODE='23514';END IF;
  IF c.kind='FILAMENT' THEN
   SELECT * INTO d FROM public.manufacturing_spool_details WHERE tenant_id=t AND branch_id=b AND balance_id=c.balance_id AND spool_id=(line->>'spoolId')::uuid;
   IF NOT FOUND THEN RAISE EXCEPTION 'Spool unavailable' USING ERRCODE='22023';END IF;
   SELECT * INTO sp FROM public.manufacturing_spools WHERE "TenantId"=t AND "BranchId"=b AND "Id"=d.spool_id;
   SELECT coalesce(sum(planned_quantity),0) INTO already FROM public.manufacturing_material_allocations WHERE tenant_id=t AND branch_id=b AND spool_id=d.spool_id AND state='RESERVED';
   IF NOT sp."IsActive" OR qty>sp."RemainingWeightGrams"-already THEN RAISE EXCEPTION 'Insufficient spool' USING ERRCODE='23514';END IF;
   f:=f||jsonb_build_array(jsonb_build_object('grams',qty,'costPerKg',d.cost_per_gram*1000));
  ELSE
   IF line->>'spoolId' IS NOT NULL OR qty<>trunc(qty) THEN RAISE EXCEPTION 'Supply requires whole units' USING ERRCODE='22023';END IF;
   s:=s||jsonb_build_array(jsonb_build_object('quantity',qty,'unitCost',sb."AverageCost"));
  END IF;
 END LOOP;
 IF jsonb_array_length(f)=0 THEN RAISE EXCEPTION 'Filament required' USING ERRCODE='22023';END IF;
 est:=public.manufacturing_estimate_cost_v1(f,s,public.factory_number_v2(p,'seconds',1,31536000,true)::integer,pr."AveragePowerWatts",public.factory_number_v2(p,'tariff',0,1000000),pr."ConfiguredHourlyMachineCost",public.factory_number_v2(p,'laborSeconds',0,31536000,true)::integer,public.factory_number_v2(p,'laborHour',0,1000000),public.factory_number_v2(p,'other',0,1000000),public.factory_number_v2(p,'wastePct',0,100),public.factory_number_v2(p,'marginPct',0,99.9999),public.factory_number_v2(p,'feePct',0,99.9999));
 RETURN jsonb_build_object('estimate',est,'fingerprint',md5(est::text));
END $function$;

CREATE OR REPLACE FUNCTION public.factory_register_received_spools_v3(t uuid, b uuid, u uuid, req uuid, p jsonb)
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
 IF claimed+n*stockqty>item."QuantityReceived" OR stockqty<>round(stockqty,6) THEN RAISE EXCEPTION 'Receipt quantity already allocated' USING ERRCODE='23514';END IF;
 r:=public.factory_register_spools_v2(t,b,u,req,bal,n,grams,tare,batch);
 FOR sp IN SELECT v FROM jsonb_array_elements(r) v LOOP
  INSERT INTO public.manufacturing_factory_spool_receipts(tenant_id,branch_id,spool_id,receipt_id,receipt_item_id,stock_quantity,receipt_unit_cost,created_by) VALUES(t,b,(sp->>'id')::uuid,receipt."Id",item_id,stockqty,item."RealUnitCost",u);
  UPDATE public.manufacturing_spool_details SET cost_per_gram=item."RealUnitCost"/c.units_per_stock_unit WHERE tenant_id=t AND branch_id=b AND spool_id=(sp->>'id')::uuid;
 END LOOP;
 RETURN public.factory_end_command_v2(t,b,u,req,'RegisterReceivedSpools',p,r,'FactoryReceipt',receipt."Id");
END $function$;

CREATE OR REPLACE FUNCTION public.factory_register_spools_v2(t uuid, b uuid, u uuid, req uuid, bal uuid, n integer, grams numeric, tare numeric, batch text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE sb public.stock_balances%ROWTYPE;c public.manufacturing_material_balance_configs%ROWTYPE; prior public.manufacturing_spool_registration_requests%ROWTYPE;
 payload jsonb; result jsonb:='[]'::jsonb; grp text; seq bigint; sid uuid; code text; tracked numeric; i integer;
BEGIN
 PERFORM public.factory_assert_actor_v2(t,b,u);
 IF req IS NULL OR n IS NULL OR n NOT BETWEEN 1 AND 100 OR grams IS NULL OR grams::text IN ('NaN','Infinity','-Infinity') OR grams<=0 OR grams>100000 OR grams<>round(grams,3) OR tare IS NULL OR tare::text IN ('NaN','Infinity','-Infinity') OR tare<0 OR tare>100000 OR length(coalesce(batch,''))>120 THEN RAISE EXCEPTION 'Invalid spool registration' USING ERRCODE='22023'; END IF;
 payload:=jsonb_build_object('balance',bal,'count',n,'grams',grams,'tare',tare,'batch',batch);
 PERFORM pg_advisory_xact_lock(hashtextextended(t::text||b::text||req::text,0));
 SELECT * INTO prior FROM public.manufacturing_spool_registration_requests WHERE tenant_id=t AND branch_id=b AND request_id=req;
 IF FOUND THEN IF prior.request_payload<>payload THEN RAISE EXCEPTION 'Idempotency mismatch' USING ERRCODE='23514'; END IF; RETURN prior.result; END IF;
 SELECT * INTO sb FROM public.stock_balances WHERE "TenantId"=t AND "BranchId"=b AND "Id"=bal FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Stock balance unavailable' USING ERRCODE='22023'; END IF;
 SELECT * INTO c FROM public.manufacturing_material_balance_configs WHERE tenant_id=t AND branch_id=b AND balance_id=bal AND kind='FILAMENT';
 IF NOT FOUND THEN RAISE EXCEPTION 'Configure filament stock unit first' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM public.manufacturing_spools s WHERE s."TenantId"=t AND s."BranchId"=b AND s."ProductSkuId"=sb."ProductSkuId" AND s."IsActive" AND NOT EXISTS(SELECT 1 FROM public.manufacturing_spool_details d WHERE d.tenant_id=t AND d.branch_id=b AND d.spool_id=s."Id")) THEN RAISE EXCEPTION 'Reconcile legacy physical spools first' USING ERRCODE='23514'; END IF;
 grp:=c.material_type||chr(31)||c.color;
 PERFORM pg_advisory_xact_lock(hashtextextended(t::text||b::text||grp,1));
 SELECT coalesce(sum(s."RemainingWeightGrams"),0) INTO tracked FROM public.manufacturing_spool_details d JOIN public.manufacturing_spools s ON s."Id"=d.spool_id AND s."TenantId"=t AND s."BranchId"=b WHERE d.tenant_id=t AND d.branch_id=b AND d.balance_id=bal;
 IF (grams/c.units_per_stock_unit)<>round(grams/c.units_per_stock_unit,6) OR tracked+n*grams>(sb."OnHandQuantity"-sb."ReservedQuantity"-sb."BlockedQuantity")*c.units_per_stock_unit THEN RAISE EXCEPTION 'Insufficient unassigned stock or unit precision' USING ERRCODE='23514'; END IF;
 SELECT greatest(coalesce((SELECT max(d.sequence_no) FROM public.manufacturing_spool_details d WHERE d.tenant_id=t AND d.branch_id=b AND d.group_key=grp),0),coalesce((SELECT max(s."SpoolCode"::bigint) FROM public.manufacturing_spools s WHERE s."TenantId"=t AND s."BranchId"=b AND upper(btrim(s."MaterialType"))=c.material_type AND upper(btrim(s."Color"))=c.color AND s."SpoolCode" ~ '^[0-9]{1,12}$'),0)) INTO seq;
 FOR i IN 1..n LOOP
  seq:=seq+1;sid:=gen_random_uuid();code:=lpad(seq::text,greatest(3,length(seq::text)),'0');
  INSERT INTO public.manufacturing_spools("Id","ProductSkuId","SpoolCode","BatchNumber","MaterialType","Color","DiameterMm","InitialNetWeightGrams","RemainingWeightGrams","SpoolTareGrams","IsActive","OpenedAtUtc","CreatedAtUtc","TenantId","BranchId") VALUES(sid,sb."ProductSkuId",code,batch,c.material_type,c.color,1.75,grams,grams,tare,true,now(),now(),t,b);
  INSERT INTO public.manufacturing_spool_details(tenant_id,branch_id,spool_id,balance_id,group_key,sequence_no,cost_per_gram) VALUES(t,b,sid,bal,grp,seq,sb."AverageCost"/c.units_per_stock_unit);
  result:=result||jsonb_build_array(jsonb_build_object('id',sid,'code',code,'remainingGrams',grams));
 END LOOP;
 INSERT INTO public.manufacturing_spool_registration_requests(tenant_id,branch_id,request_id,request_payload,result) VALUES(t,b,req,payload,result);
 INSERT INTO public.audit_events("Id","TenantId","BranchId","EntityType","EntityId","Action","ActorId","ActorEmail","CorrelationId","AfterStateJson","CreatedAtUtc","Version") SELECT gen_random_uuid(),t,b,'FactorySpoolRegistration',req::text,'Registered',u,x."Email",req::text,jsonb_build_object('balanceId',bal,'count',n,'spools',result),now(),1 FROM public.users x WHERE x."Id"=u;
 RETURN result;
END $function$;

CREATE OR REPLACE FUNCTION public.factory_reserve_material_v2(t uuid, b uuid, u uuid, req uuid, ord uuid, bal uuid, sp uuid, qty numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE o public.manufacturing_orders%ROWTYPE; sb public.stock_balances%ROWTYPE;c public.manufacturing_material_balance_configs%ROWTYPE;s public.manufacturing_spools%ROWTYPE;d public.manufacturing_spool_details%ROWTYPE;a public.manufacturing_material_allocations%ROWTYPE; stock_qty numeric; unit_cost numeric; already numeric; rid uuid:=gen_random_uuid();
BEGIN
 PERFORM public.factory_assert_actor_v2(t,b,u);
 IF req IS NULL OR qty IS NULL OR qty::text IN ('NaN','Infinity','-Infinity') OR qty<=0 OR qty>1000000 OR qty<>round(qty,3) THEN RAISE EXCEPTION 'Invalid quantity' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(t::text||b::text||req::text,2));
 SELECT * INTO a FROM public.manufacturing_material_allocations WHERE tenant_id=t AND branch_id=b AND id=req;
 IF FOUND THEN
  IF (a.order_id,a.balance_id,a.spool_id,a.planned_quantity) IS DISTINCT FROM (ord,bal,sp,qty) THEN RAISE EXCEPTION 'Idempotency mismatch' USING ERRCODE='23514'; END IF;
  RETURN jsonb_build_object('id',req,'state',a.state,'quantity',a.planned_quantity);
 END IF;
 SELECT * INTO o FROM public.manufacturing_orders WHERE "TenantId"=t AND "BranchId"=b AND "Id"=ord FOR UPDATE;
 IF NOT FOUND OR o."Status" NOT IN (4,5,7,8,10) OR o."MaterialStockReservationId" IS NOT NULL THEN RAISE EXCEPTION 'Order unavailable or uses legacy reservation' USING ERRCODE='23514'; END IF;
 SELECT * INTO sb FROM public.stock_balances WHERE "TenantId"=t AND "BranchId"=b AND "Id"=bal FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Stock balance unavailable' USING ERRCODE='22023'; END IF;
 SELECT * INTO c FROM public.manufacturing_material_balance_configs WHERE tenant_id=t AND branch_id=b AND balance_id=bal;
 IF NOT FOUND THEN RAISE EXCEPTION 'Material not configured' USING ERRCODE='22023'; END IF;
 stock_qty:=qty/c.units_per_stock_unit;
 IF stock_qty<>round(stock_qty,6) OR stock_qty>sb."OnHandQuantity"-sb."ReservedQuantity"-sb."BlockedQuantity" THEN RAISE EXCEPTION 'Insufficient stock or unit precision' USING ERRCODE='23514'; END IF;
 IF c.kind='FILAMENT' THEN
  SELECT * INTO d FROM public.manufacturing_spool_details WHERE tenant_id=t AND branch_id=b AND balance_id=bal AND spool_id=sp;
  IF NOT FOUND THEN RAISE EXCEPTION 'Spool unavailable' USING ERRCODE='22023'; END IF;
  SELECT * INTO s FROM public.manufacturing_spools WHERE "TenantId"=t AND "BranchId"=b AND "Id"=sp FOR UPDATE;
  SELECT coalesce(sum(planned_quantity),0) INTO already FROM public.manufacturing_material_allocations WHERE tenant_id=t AND branch_id=b AND spool_id=sp AND state='RESERVED';
  IF NOT s."IsActive" OR qty>s."RemainingWeightGrams"-already THEN RAISE EXCEPTION 'Insufficient physical spool' USING ERRCODE='23514'; END IF;
  unit_cost:=d.cost_per_gram;
 ELSE
  IF sp IS NOT NULL OR qty<>trunc(qty) THEN RAISE EXCEPTION 'Supply requires whole units and no spool' USING ERRCODE='22023'; END IF;
  unit_cost:=sb."AverageCost";
 END IF;
 INSERT INTO public.stock_reservations("Id","BranchId","ReservationNumber","Status","Reason","DocumentReference","ExpiresAtUtc","IdempotencyKey","CreatedAtUtc","TenantId") VALUES(rid,b,'FAB-'||rid::text,1,'Reserva industrial por material','FAB-OP-'||ord::text,'infinity'::timestamptz,'FAB-'||req::text,now(),t);
 INSERT INTO public.stock_reservation_items("Id","StockReservationId","WarehouseId","WarehouseLocationId","ProductSkuId","Quantity","CreatedAtUtc","TenantId") VALUES(gen_random_uuid(),rid,sb."WarehouseId",sb."WarehouseLocationId",sb."ProductSkuId",stock_qty,now(),t);
 INSERT INTO public.manufacturing_material_allocations(tenant_id,branch_id,id,order_id,balance_id,spool_id,reservation_id,planned_quantity,units_per_stock_unit,planned_stock_quantity,unit_cost_snapshot,state,created_by) VALUES(t,b,req,ord,bal,sp,rid,qty,c.units_per_stock_unit,stock_qty,unit_cost,'RESERVED',u);
 UPDATE public.stock_balances SET "ReservedQuantity"="ReservedQuantity"+stock_qty,"LastMovementAtUtc"=now(),"UpdatedAtUtc"=now() WHERE "Id"=bal AND "TenantId"=t AND "BranchId"=b;
 INSERT INTO public.audit_events("Id","TenantId","BranchId","EntityType","EntityId","Action","ActorId","ActorEmail","CorrelationId","AfterStateJson","CreatedAtUtc","Version") SELECT gen_random_uuid(),t,b,'FactoryMaterialAllocation',req::text,'Reserved',u,x."Email",req::text,jsonb_build_object('order',ord,'balance',bal,'spool',sp,'quantity',qty),now(),1 FROM public.users x WHERE x."Id"=u;
 RETURN jsonb_build_object('id',req,'state','RESERVED','quantity',qty);
END $function$;

CREATE OR REPLACE FUNCTION public.factory_settle_material_v2(t uuid, b uuid, u uuid, req uuid, allocation uuid, actual numeric, waste boolean, attempt uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE a public.manufacturing_material_allocations%ROWTYPE;o public.manufacturing_orders%ROWTYPE;sb public.stock_balances%ROWTYPE;s public.manufacturing_spools%ROWTYPE;rs public.stock_reservations%ROWTYPE; stock_qty numeric; val numeric; managerial numeric; new_state text;
BEGIN
 PERFORM public.factory_assert_actor_v2(t,b,u);
 IF req IS NULL OR actual IS NULL OR actual::text IN ('NaN','Infinity','-Infinity') OR actual<0 OR actual<>round(actual,3) OR waste IS NULL OR (actual=0 AND (waste OR attempt IS NOT NULL)) THEN RAISE EXCEPTION 'Invalid settlement' USING ERRCODE='22023'; END IF;
 SELECT * INTO a FROM public.manufacturing_material_allocations WHERE tenant_id=t AND branch_id=b AND id=allocation;
 IF NOT FOUND THEN RAISE EXCEPTION 'Allocation unavailable' USING ERRCODE='22023'; END IF;
 SELECT * INTO o FROM public.manufacturing_orders WHERE "TenantId"=t AND "BranchId"=b AND "Id"=a.order_id FOR UPDATE;
 SELECT * INTO a FROM public.manufacturing_material_allocations WHERE tenant_id=t AND branch_id=b AND id=allocation FOR UPDATE;
 IF a.state<>'RESERVED' THEN
  IF (a.settlement_request_id,a.actual_quantity,a.waste,a.attempt_id) IS DISTINCT FROM (req,actual,waste,attempt) THEN RAISE EXCEPTION 'Already settled or idempotency mismatch' USING ERRCODE='23514'; END IF;
  RETURN jsonb_build_object('id',allocation,'state',a.state,'actual',actual);
 END IF;
 IF actual>a.planned_quantity OR (actual>0 AND o."Status" NOT IN (8,9,10)) OR (actual>0 AND o."MaterialStockReservationId" IS NOT NULL) THEN RAISE EXCEPTION 'Consumption exceeds plan or order state invalid' USING ERRCODE='23514'; END IF;
 IF actual>0 AND a.spool_id IS NOT NULL AND (attempt IS NULL OR NOT EXISTS(SELECT 1 FROM public.manufacturing_print_attempts x WHERE x."Id"=attempt AND x."TenantId"=t AND x."ManufacturingOrderId"=a.order_id AND x."Status" IN (3,4))) THEN RAISE EXCEPTION 'Active print attempt required' USING ERRCODE='23514'; END IF;
 IF attempt IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.manufacturing_print_attempts x WHERE x."Id"=attempt AND x."TenantId"=t AND x."ManufacturingOrderId"=a.order_id) THEN RAISE EXCEPTION 'Attempt unavailable' USING ERRCODE='22023'; END IF;
 IF a.spool_id IS NULL AND actual<>trunc(actual) THEN RAISE EXCEPTION 'Supply requires whole units' USING ERRCODE='22023'; END IF;
 SELECT * INTO sb FROM public.stock_balances WHERE "Id"=a.balance_id AND "TenantId"=t AND "BranchId"=b FOR UPDATE;
 SELECT * INTO rs FROM public.stock_reservations WHERE "Id"=a.reservation_id AND "TenantId"=t AND "BranchId"=b FOR UPDATE;
 stock_qty:=actual/a.units_per_stock_unit;
 IF rs."Status"<>1 OR stock_qty<>round(stock_qty,6) OR sb."ReservedQuantity"<a.planned_stock_quantity OR sb."OnHandQuantity"<stock_qty OR sb."OnHandQuantity"-stock_qty<sb."ReservedQuantity"-a.planned_stock_quantity+sb."BlockedQuantity" THEN RAISE EXCEPTION 'Inventory reconciliation required' USING ERRCODE='23514'; END IF;
 IF a.spool_id IS NOT NULL THEN
  SELECT * INTO s FROM public.manufacturing_spools WHERE "Id"=a.spool_id AND "TenantId"=t AND "BranchId"=b FOR UPDATE;
  IF s."RemainingWeightGrams"<actual THEN RAISE EXCEPTION 'Physical spool insufficient' USING ERRCODE='23514'; END IF;
 END IF;
 val:=round(stock_qty*sb."AverageCost",6);managerial:=round(actual*a.unit_cost_snapshot,6);new_state:=CASE WHEN actual=0 THEN 'RELEASED' ELSE 'CONSUMED' END;
 UPDATE public.manufacturing_material_allocations SET state=new_state,actual_quantity=actual,actual_stock_quantity=stock_qty,actual_stock_cost=val,settlement_request_id=req,waste=factory_settle_material_v2.waste,attempt_id=attempt,settled_by=u,settled_at=now() WHERE tenant_id=t AND branch_id=b AND id=allocation;
 IF actual>0 AND a.spool_id IS NOT NULL THEN
  UPDATE public.manufacturing_spools SET "RemainingWeightGrams"="RemainingWeightGrams"-actual,"IsActive"=("RemainingWeightGrams"-actual)>0,"UpdatedAtUtc"=now() WHERE "Id"=a.spool_id AND "TenantId"=t AND "BranchId"=b;
 END IF;
 UPDATE public.stock_balances SET "ReservedQuantity"="ReservedQuantity"-a.planned_stock_quantity,"OnHandQuantity"="OnHandQuantity"-stock_qty,"LastMovementAtUtc"=now(),"UpdatedAtUtc"=now() WHERE "Id"=a.balance_id AND "TenantId"=t AND "BranchId"=b;
 UPDATE public.stock_reservations SET "Status"=CASE WHEN actual=0 THEN 3 ELSE 2 END,"UpdatedAtUtc"=now() WHERE "Id"=a.reservation_id AND "TenantId"=t AND "BranchId"=b;
 IF actual>0 THEN
  INSERT INTO public.stock_movements("Id","BranchId","WarehouseId","WarehouseLocationId","ProductSkuId","MovementType","Quantity","UnitCost","TotalCost","BalanceAfterQuantity","DocumentReference","Reason","CorrelationId","IdempotencyKey","CreatedByUserId","CreatedAtUtc","TenantId") VALUES(gen_random_uuid(),b,sb."WarehouseId",sb."WarehouseLocationId",sb."ProductSkuId",10,-stock_qty,sb."AverageCost",round(val,2),sb."OnHandQuantity"-stock_qty,'FAB-OP-'||a.order_id::text,CASE WHEN waste THEN 'Refugo de fabricação 3D' ELSE 'Consumo de fabricação 3D' END,req,'FAB-CONSUME-'||allocation::text,u,now(),t);
  PERFORM set_config('hbstudio.factory_order_command',a.order_id::text,true);
  UPDATE public.manufacturing_orders SET "ActualMaterialCost"="ActualMaterialCost"+CASE WHEN waste THEN 0 ELSE managerial END,"ActualWasteCost"="ActualWasteCost"+CASE WHEN waste THEN managerial ELSE 0 END,"UpdatedAtUtc"=now() WHERE "Id"=a.order_id AND "TenantId"=t AND "BranchId"=b;
 END IF;
 INSERT INTO public.audit_events("Id","TenantId","BranchId","EntityType","EntityId","Action","ActorId","ActorEmail","CorrelationId","AfterStateJson","CreatedAtUtc","Version") SELECT gen_random_uuid(),t,b,'FactoryMaterialAllocation',allocation::text,new_state,u,x."Email",req::text,jsonb_build_object('order',a.order_id,'actual',actual,'waste',waste,'attempt',attempt,'managerialCost',managerial,'stockCost',val),now(),1 FROM public.users x WHERE x."Id"=u;
 RETURN jsonb_build_object('id',allocation,'state',new_state,'actual',actual);
END $function$;

COMMIT;
