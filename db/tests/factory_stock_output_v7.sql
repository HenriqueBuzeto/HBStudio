BEGIN;
CREATE SCHEMA IF NOT EXISTS factory_qa;
CREATE OR REPLACE FUNCTION factory_qa.run_stock_output_v7()
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE t uuid:='a0000000-0000-0000-0000-000000000001';b uuid:='b0000000-0000-0000-0000-000000000001';u uuid:='d0000000-0000-0000-0000-000000000001';req uuid:=gen_random_uuid();p jsonb;r jsonb;sku uuid;wh uuid;sp uuid;bal uuid;printer uuid;ord uuid;att uuid;alloc uuid;outbal uuid;before_stock numeric;before_grams numeric;price numeric;res jsonb;reg uuid;shift uuid;sale uuid;quality_req uuid:=gen_random_uuid();unit_cost numeric;
BEGIN
 BEGIN
 SELECT "Id" INTO wh FROM warehouses WHERE "TenantId"=t AND "BranchId"=b AND "Code"='QA-FAB3D';
 SELECT d.balance_id,d.spool_id,s."RemainingWeightGrams",sb."OnHandQuantity" INTO bal,sp,before_grams,before_stock FROM manufacturing_spool_details d JOIN manufacturing_spools s ON s."Id"=d.spool_id AND s."TenantId"=d.tenant_id JOIN stock_balances sb ON sb."Id"=d.balance_id AND sb."TenantId"=d.tenant_id WHERE d.tenant_id=t AND d.branch_id=b AND s."Color"='PRETO' AND s."RemainingWeightGrams">100 ORDER BY d.sequence_no LIMIT 1;
 SELECT "Id" INTO printer FROM manufacturing_printers WHERE "TenantId"=t AND "BranchId"=b AND "Status"=1 ORDER BY "Code" LIMIT 1;
 p:=jsonb_build_object('mode','CATALOG','kind',5,'policy',0,'name','QA Suporte produzido','variant','QA Preto','code','QA-OUTPUT-'||left(req::text,8),'brand','QA Fábrica 3D','category','QA Produto acabado','price',25,'barcode','','description','QA teste');
 r:=public.catalog_intake_v7(t,b,u,req,p);sku:=(r->>'skuId')::uuid;
 p:=jsonb_build_object('purpose','STOCK','targetSkuId',sku,'targetWarehouseId',wh,'customerId',null,'printerId',printer,'title','QA estoque 3D','notes','','quantity',2,'seconds',3600,'laborSeconds',0,'tariff',1,'laborHour',0,'other',0,'wastePct',0,'marginPct',0,'feePct',0,'plan',jsonb_build_array(jsonb_build_object('balanceId',bal,'spoolId',sp,'quantity',20)));
 r:=public.factory_preview_order_v2(t,b,u,p);p:=p||jsonb_build_object('estimateFingerprint',r->>'fingerprint');
 r:=public.factory_create_order_v2(t,b,u,gen_random_uuid(),p);ord:=(r->>'id')::uuid;
 IF EXISTS(SELECT 1 FROM stock_balances WHERE "TenantId"=t AND "ProductSkuId"=sku) OR (SELECT "Type" FROM manufacturing_orders WHERE "Id"=ord)<>1 THEN RAISE EXCEPTION 'Premature finished goods stock';END IF;
 SELECT id INTO alloc FROM manufacturing_material_allocations WHERE tenant_id=t AND branch_id=b AND order_id=ord;
 r:=public.factory_start_attempt_v2(t,b,u,gen_random_uuid(),jsonb_build_object('orderId',ord,'printerId',printer,'seconds',3600,'version',1));att:=(r->>'attemptId')::uuid;
 PERFORM public.factory_finish_attempt_v2(t,b,u,gen_random_uuid(),jsonb_build_object('orderId',ord,'attemptId',att,'version',2,'success',true,'seconds',3600,'laborSeconds',0,'producedQuantity',2,'notes','','actuals',jsonb_build_array(jsonb_build_object('allocationId',alloc,'quantity',20))));
 IF EXISTS(SELECT 1 FROM stock_balances WHERE "TenantId"=t AND "ProductSkuId"=sku) THEN RAISE EXCEPTION 'Stock credited before quality';END IF;
 p:=jsonb_build_object('orderId',ord,'version',3,'approvedQuantity',2,'rejectedQuantity',0,'laborSeconds',0,'notes','QA','actuals','[]'::jsonb);
 r:=public.factory_quality_v2(t,b,u,quality_req,p);
 IF r<>public.factory_quality_v2(t,b,u,quality_req,p) THEN RAISE EXCEPTION 'Quality replay';END IF;
 SELECT balance_id INTO outbal FROM manufacturing_factory_stock_output_v7 WHERE order_id=ord AND accounting_state='POSTED';
 IF outbal IS NULL OR (SELECT "OnHandQuantity" FROM stock_balances WHERE "Id"=outbal)<>2 OR (SELECT count(*) FROM stock_movements WHERE "TenantId"=t AND "CorrelationId"=ord AND "MovementType"=11)<>1 THEN RAISE EXCEPTION 'Finished stock output';END IF;
 IF (SELECT "OnHandQuantity" FROM stock_balances WHERE "Id"=bal)<>before_stock-0.02 OR (SELECT "RemainingWeightGrams" FROM manufacturing_spools WHERE "Id"=sp)<>before_grams-20 THEN RAISE EXCEPTION 'Material stock duplication';END IF;
 IF (SELECT count(*) FROM factory_material_capitalization_v5 WHERE order_id=ord)<>1 THEN RAISE EXCEPTION 'Capitalization missing';END IF;
 SELECT "Id" INTO reg FROM cash_registers WHERE "TenantId"=t AND "BranchId"=b AND "Code"='QA-CK-001';
 SELECT "shiftId" INTO shift FROM cash_enterprise_open_shift(t,b,u,'qa@example.invalid',reg,0,gen_random_uuid(),'QA stock sale');
 p:=jsonb_build_object('shiftId',shift,'orderId',ord,'version',4,'cashConfirmed',true,'tendered',25,'expectedTotal',25,'items','[]'::jsonb);
 BEGIN PERFORM public.internal_checkout_cash_v5(t,b,u,gen_random_uuid(),p);RAISE EXCEPTION 'Stock order billed directly';EXCEPTION WHEN check_violation THEN NULL;END;
 p:=jsonb_build_object('shiftId',shift,'cashConfirmed',true,'tendered',25,'expectedTotal',25,'items',jsonb_build_array(jsonb_build_object('balanceId',outbal,'quantity',1)));
 r:=public.internal_checkout_cash_v5(t,b,u,gen_random_uuid(),p);sale:=(r->>'saleId')::uuid;
 IF (SELECT "OnHandQuantity" FROM stock_balances WHERE "Id"=outbal)<>1 OR (SELECT "OnHandQuantity" FROM stock_balances WHERE "Id"=bal)<>before_stock-0.02 THEN RAISE EXCEPTION 'Sale did not use finished goods stock';END IF;
 IF (SELECT "CurrentBalance" FROM cash_shifts WHERE "Id"=shift)<>25 THEN RAISE EXCEPTION 'Sale cash mismatch';END IF;
 res:=jsonb_build_object('passed',true,'produced',2,'approvedStock',2,'sold',1,'remaining',1,'consumedGrams',20,'cash',25,'noDuplicateRawIssue',true,'fixturesRolledBack',true);
 RAISE EXCEPTION 'rollback' USING ERRCODE='ZX001';
 EXCEPTION WHEN SQLSTATE 'ZX001' THEN NULL;END;
 RETURN res;
END $function$;
SELECT factory_qa.run_stock_output_v7() result;
ROLLBACK;
