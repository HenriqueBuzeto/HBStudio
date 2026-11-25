BEGIN;
CREATE SCHEMA IF NOT EXISTS factory_qa;
CREATE OR REPLACE FUNCTION factory_qa.run_precision_v4()
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE t uuid:='a0000000-0000-0000-0000-000000000001';b uuid:='b0000000-0000-0000-0000-000000000001';u uuid:='d0000000-0000-0000-0000-000000000001';bal uuid;sp uuid;cust uuid;printer uuid;ord uuid;att uuid;alloc uuid;p jsonb;r jsonb;initial_stock numeric;initial_spool numeric;qty numeric;result jsonb;
BEGIN
 BEGIN
 SELECT d.balance_id,d.spool_id,s."RemainingWeightGrams",sb."OnHandQuantity" INTO bal,sp,initial_spool,initial_stock FROM manufacturing_spool_details d JOIN manufacturing_spools s ON s."Id"=d.spool_id JOIN stock_balances sb ON sb."Id"=d.balance_id WHERE d.tenant_id=t AND d.branch_id=b AND s."Color"='BRANCO' AND s."RemainingWeightGrams">100 ORDER BY d.sequence_no LIMIT 1;
 SELECT "Id" INTO cust FROM parties WHERE "TenantId"=t AND "Name" LIKE 'QA · Cliente Fábrica %' ORDER BY "Name" LIMIT 1;
 SELECT "Id" INTO printer FROM manufacturing_printers WHERE "TenantId"=t AND "BranchId"=b AND "Status"=1 ORDER BY "Code" LIMIT 1;
 FOREACH qty IN ARRAY ARRAY[14.37::numeric,0.001::numeric] LOOP
  p:=jsonb_build_object('customerId',cust,'printerId',printer,'title','QA precision','notes','','quantity',1,'seconds',3391,'laborSeconds',0,'tariff',1,'laborHour',0,'other',0,'wastePct',0,'marginPct',40,'feePct',0,'plan',jsonb_build_array(jsonb_build_object('balanceId',bal,'spoolId',sp,'quantity',qty)));
  r:=public.factory_preview_order_v2(t,b,u,p);p:=p||jsonb_build_object('approvedPrice',greatest(0.01,(r->'estimate'->>'suggestedPrice')::numeric),'estimateFingerprint',r->>'fingerprint');
  r:=public.factory_create_order_v2(t,b,u,gen_random_uuid(),p);ord:=(r->>'id')::uuid;
  SELECT id INTO alloc FROM manufacturing_material_allocations WHERE tenant_id=t AND branch_id=b AND order_id=ord;
  IF (SELECT planned_stock_quantity FROM manufacturing_material_allocations WHERE id=alloc)<>qty/1000 THEN RAISE EXCEPTION 'reservation precision';END IF;
  r:=public.factory_start_attempt_v2(t,b,u,gen_random_uuid(),jsonb_build_object('orderId',ord,'printerId',printer,'seconds',3391,'version',1));att:=(r->>'attemptId')::uuid;
  PERFORM public.factory_finish_attempt_v2(t,b,u,gen_random_uuid(),jsonb_build_object('orderId',ord,'attemptId',att,'version',2,'success',true,'seconds',3391,'laborSeconds',0,'producedQuantity',1,'notes','','actuals',jsonb_build_array(jsonb_build_object('allocationId',alloc,'quantity',qty))));
  IF (SELECT actual_stock_quantity FROM manufacturing_material_allocations WHERE id=alloc)<>qty/1000 OR NOT EXISTS(SELECT 1 FROM stock_movements WHERE "TenantId"=t AND "BranchId"=b AND "IdempotencyKey"='FAB-CONSUME-'||alloc::text AND "Quantity"=-qty/1000) THEN RAISE EXCEPTION 'Kardex precision';END IF;
  PERFORM public.factory_quality_v2(t,b,u,gen_random_uuid(),jsonb_build_object('orderId',ord,'version',3,'approvedQuantity',1,'rejectedQuantity',0,'laborSeconds',0,'notes','QA','actuals','[]'::jsonb));
 END LOOP;
 IF (SELECT "OnHandQuantity" FROM stock_balances WHERE "Id"=bal)<>initial_stock-0.014371 OR (SELECT "RemainingWeightGrams" FROM manufacturing_spools WHERE "Id"=sp)<>initial_spool-14.371 THEN RAISE EXCEPTION 'precision balance mismatch';END IF;
 result:=jsonb_build_object('passed',true,'imageGrams',14.37,'minimumGrams',0.001,'stockUnitsConsumed',0.014371,'fixturesRolledBack',true);
 RAISE EXCEPTION 'rollback' USING ERRCODE='ZX001';
 EXCEPTION WHEN SQLSTATE 'ZX001' THEN NULL;
 END;
 RETURN result;
END $function$;
SELECT factory_qa.run_precision_v4() AS result;
ROLLBACK;
