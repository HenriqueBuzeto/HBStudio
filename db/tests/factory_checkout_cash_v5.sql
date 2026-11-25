BEGIN;
CREATE SCHEMA IF NOT EXISTS factory_qa;
CREATE OR REPLACE FUNCTION factory_qa.run_checkout_cash_v5()
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE t uuid:='a0000000-0000-0000-0000-000000000001';b uuid:='b0000000-0000-0000-0000-000000000001';u uuid:='d0000000-0000-0000-0000-000000000001';acct uuid[]:=ARRAY[]::uuid[];a uuid;model uuid:=gen_random_uuid();sku uuid:=gen_random_uuid();retail_model uuid:=gen_random_uuid();retail_sku uuid:=gen_random_uuid();retail_balance uuid:=gen_random_uuid();register_id uuid:=gen_random_uuid();sh uuid;ord uuid;cust uuid;v_version integer;total numeric;req uuid:=gen_random_uuid();p jsonb;r jsonb;sid uuid;retail_sid uuid;before_stock jsonb;brand uuid;category uuid;warehouse uuid;cnt integer;i integer;customer_before numeric;result jsonb;cancel_req uuid:=gen_random_uuid();deliver_req uuid:=gen_random_uuid();
BEGIN
 BEGIN
 SELECT "BrandId","CategoryId" INTO brand,category FROM product_models WHERE "TenantId"=t LIMIT 1;
 SELECT "Id" INTO warehouse FROM warehouses WHERE "TenantId"=t AND "BranchId"=b AND "Code"='QA-FAB3D';
 FOR i IN 1..7 LOOP a:=gen_random_uuid();acct:=array_append(acct,a);INSERT INTO financial_accounts("Id","TenantId","Code","Name","Type","IsActive","CreatedAtUtc") VALUES(a,t,'QA-TEMP-'||i||'-'||left(req::text,8),'QA conta transiente '||i,(ARRAY[1,4,4,1,1,5,5])[i],true,now());END LOOP;
 INSERT INTO product_models("Id","Name","Kind","SerializationPolicy","BrandId","CategoryId","IsActive","CreatedAtUtc","TenantId") VALUES(model,'QA produto 3D transiente',5,0,brand,category,true,now(),t),(retail_model,'QA revenda transiente',1,0,brand,category,true,now(),t);
 INSERT INTO product_skus("Id","ProductModelId","SkuCode","VariantName","DefaultPrice","IsActive","CreatedAtUtc","TenantId") VALUES(sku,model,'QA-CHECKOUT-3D-'||left(req::text,8),'Lote fabricado',0,true,now(),t),(retail_sku,retail_model,'QA-CHECKOUT-GOOD-'||left(req::text,8),'Mercadoria QA',12.5,true,now(),t);
 INSERT INTO stock_balances("Id","BranchId","WarehouseId","ProductSkuId","OnHandQuantity","ReservedQuantity","BlockedQuantity","AverageCost","LastMovementAtUtc","CreatedAtUtc","TenantId") VALUES(retail_balance,b,warehouse,retail_sku,5,1,0,4,now(),now(),t);
 IF NOT EXISTS(SELECT 1 FROM internal_checkout_config_v5 WHERE tenant_id=t AND branch_id=b) THEN INSERT INTO internal_checkout_config_v5(tenant_id,branch_id,cash_account,goods_revenue_account,factory_revenue_account,stock_account,finished_account,cogs_account,waste_account,factory_sku) VALUES(t,b,acct[1],acct[2],acct[3],acct[4],acct[5],acct[6],acct[7],sku);END IF;
 INSERT INTO cash_registers("Id","TenantId","BranchId","Code","Name","Status","CreatedAtUtc") VALUES(register_id,t,b,'QA-CK-'||left(req::text,8),'Caixa QA transiente',1,now());
 SELECT "shiftId" INTO sh FROM cash_enterprise_open_shift(t,b,u,'qa@example.invalid',register_id,0,gen_random_uuid(),req::text);
 SELECT o."Id",d.customer_id,d.version,d.approved_price INTO ord,cust,v_version,total FROM manufacturing_orders o JOIN manufacturing_factory_order_details d ON d.order_id=o."Id" AND d.tenant_id=o."TenantId" AND d.branch_id=o."BranchId" WHERE o."TenantId"=t AND o."BranchId"=b AND o."Status"=12 AND o."SalesOrderId" IS NULL LIMIT 1;
 IF ord IS NULL THEN RAISE EXCEPTION 'Ready QA order required';END IF;
 SELECT "TotalSalesValue" INTO customer_before FROM customer_profiles WHERE "TenantId"=t AND "PartyId"=cust;
 SELECT jsonb_object_agg(s."Id"::text,s."OnHandQuantity") INTO before_stock FROM stock_balances s WHERE s."TenantId"=t AND s."BranchId"=b;
 p:=jsonb_build_object('shiftId',sh,'orderId',ord,'version',v_version,'customerId',cust,'cashConfirmed',true,'tendered',20,'expectedTotal',total,'items','[]'::jsonb);
 BEGIN PERFORM internal_checkout_cash_v5(t,b,u,gen_random_uuid(),p||jsonb_build_object('cashConfirmed',false));RAISE EXCEPTION 'Unconfirmed cash accepted';EXCEPTION WHEN invalid_parameter_value THEN NULL;END;
 BEGIN PERFORM internal_checkout_cash_v5(t,b,u,gen_random_uuid(),p||jsonb_build_object('expectedTotal',total+1));RAISE EXCEPTION 'Incorrect price accepted';EXCEPTION WHEN check_violation THEN NULL;END;
 IF EXISTS(SELECT 1 FROM factory_material_capitalization_v5 WHERE order_id=ord) THEN RAISE EXCEPTION 'Price conflict failed rollback';END IF;
 r:=internal_checkout_cash_v5(t,b,u,req,p);sid:=(r->>'saleId')::uuid;
 IF (r->>'total')::numeric<>total OR (r->>'change')::numeric<>20-total THEN RAISE EXCEPTION 'Total or change mismatch';END IF;
 IF (internal_checkout_cash_v5(t,b,u,req,p)->>'saleId')::uuid<>sid THEN RAISE EXCEPTION 'Replay failed';END IF;
 BEGIN PERFORM internal_checkout_cash_v5(t,b,u,req,p||jsonb_build_object('tendered',21));RAISE EXCEPTION 'Changed request accepted';EXCEPTION WHEN check_violation THEN NULL;END;
 BEGIN PERFORM internal_checkout_cash_v5(t,b,u,gen_random_uuid(),p);RAISE EXCEPTION 'Duplicate OS billed';EXCEPTION WHEN check_violation THEN NULL;END;
 IF (SELECT "SalesOrderId" FROM manufacturing_orders WHERE "Id"=ord) IS DISTINCT FROM sid OR (SELECT "CurrentBalance" FROM cash_shifts WHERE "Id"=sh)<>total OR (SELECT "TotalSalesValue" FROM customer_profiles WHERE "TenantId"=t AND "PartyId"=cust)<>customer_before+total THEN RAISE EXCEPTION 'Integration mismatch';END IF;
 IF before_stock IS DISTINCT FROM (SELECT jsonb_object_agg(s."Id"::text,s."OnHandQuantity") FROM stock_balances s WHERE s."TenantId"=t AND s."BranchId"=b) THEN RAISE EXCEPTION 'Factory duplicated stock issue';END IF;
 IF (SELECT count(*) FROM cash_movements WHERE "TenantId"=t AND "CashShiftId"=sh AND "MovementType"=2)<>1 OR (SELECT count(*) FROM sale_payment_intents WHERE "TenantId"=t AND "SaleId"=sid AND "Status"=2)<>1 THEN RAISE EXCEPTION 'Duplicate payment';END IF;
 IF EXISTS(SELECT 1 FROM financial_journal_entries e JOIN financial_journal_lines l ON l."FinancialJournalEntryId"=e."Id" AND l."TenantId"=e."TenantId" WHERE e."TenantId"=t AND e."SourceId" IN(sid::text,ord::text) GROUP BY e."Id",e."TotalAmount" HAVING sum(CASE WHEN l."Direction"=1 THEN l."Amount" ELSE -l."Amount" END)<>0 OR sum(l."Amount")<>2*e."TotalAmount") THEN RAISE EXCEPTION 'Journal unbalanced';END IF;
 PERFORM set_config('hbstudio.checkout_command','',true);
 BEGIN UPDATE sales SET "Status"=6 WHERE "Id"=sid;RAISE EXCEPTION 'Legacy bypass accepted';EXCEPTION WHEN check_violation THEN NULL;END;
 p:=jsonb_build_object('shiftId',sh,'customerId',cust,'cashConfirmed',true,'tendered',30,'expectedTotal',25,'items',jsonb_build_array(jsonb_build_object('balanceId',retail_balance,'quantity',2)));
 r:=internal_checkout_cash_v5(t,b,u,gen_random_uuid(),p);retail_sid:=(r->>'saleId')::uuid;
 IF (SELECT "OnHandQuantity" FROM stock_balances WHERE "Id"=retail_balance)<>3 OR (SELECT "ReservedQuantity" FROM stock_balances WHERE "Id"=retail_balance)<>1 OR (SELECT "CurrentBalance" FROM cash_shifts WHERE "Id"=sh)<>total+25 THEN RAISE EXCEPTION 'Retail stock/cash mismatch';END IF;
 IF (SELECT count(*) FROM stock_movements WHERE "TenantId"=t AND "CorrelationId"=retail_sid AND "MovementType"=4 AND "Quantity"=-2)<>1 THEN RAISE EXCEPTION 'Retail Kardex missing';END IF;
 BEGIN PERFORM internal_checkout_cash_v5(t,b,u,gen_random_uuid(),p||jsonb_build_object('expectedTotal',37.5,'items',jsonb_build_array(jsonb_build_object('balanceId',retail_balance,'quantity',3))));RAISE EXCEPTION 'Reserved inventory sold';EXCEPTION WHEN check_violation THEN NULL;END;
 BEGIN PERFORM internal_checkout_cash_v5(gen_random_uuid(),b,u,gen_random_uuid(),p);RAISE EXCEPTION 'Cross tenant accepted';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 IF EXISTS(SELECT 1 FROM fiscal_documents WHERE "SaleId" IN(sid,retail_sid)) THEN RAISE EXCEPTION 'Unexpected fiscal document';END IF;
 p:=jsonb_build_object('saleId',sid,'action','CANCEL','reason','Cancelamento QA antes da entrega','cashReturned',true,'goodsRetained',true);
 BEGIN PERFORM internal_checkout_action_v5(t,b,u,gen_random_uuid(),p||jsonb_build_object('cashReturned',false));RAISE EXCEPTION 'Refund without confirmation accepted';EXCEPTION WHEN invalid_parameter_value THEN NULL;END;
 r:=internal_checkout_action_v5(t,b,u,cancel_req,p);
 IF r<>internal_checkout_action_v5(t,b,u,cancel_req,p) OR (SELECT "CurrentBalance" FROM cash_shifts WHERE "Id"=sh)<>25 OR (SELECT "SalesOrderId" FROM manufacturing_orders WHERE "Id"=ord) IS NOT NULL OR (SELECT "TotalSalesValue" FROM customer_profiles WHERE "TenantId"=t AND "PartyId"=cust)<>customer_before+25 THEN RAISE EXCEPTION 'Factory cancellation integration';END IF;
 IF (SELECT count(*) FROM factory_material_capitalization_v5 WHERE order_id=ord)<>1 OR EXISTS(SELECT 1 FROM stock_movements WHERE "TenantId"=t AND "CorrelationId"=sid) THEN RAISE EXCEPTION 'Factory cancellation invalid material return';END IF;
 IF (SELECT count(*) FROM financial_journal_entries WHERE "TenantId"=t AND "SourceId"=sid::text AND "ReversalOfEntryId" IS NOT NULL)<>2 THEN RAISE EXCEPTION 'Reversal journal count';END IF;
 SELECT version INTO v_version FROM manufacturing_factory_order_details WHERE tenant_id=t AND branch_id=b AND order_id=ord;
 p:=jsonb_build_object('shiftId',sh,'orderId',ord,'version',v_version,'customerId',cust,'cashConfirmed',true,'tendered',20,'expectedTotal',total,'items','[]'::jsonb);
 r:=internal_checkout_cash_v5(t,b,u,gen_random_uuid(),p);sid:=(r->>'saleId')::uuid;
 IF (SELECT count(*) FROM factory_material_capitalization_v5 WHERE order_id=ord)<>1 THEN RAISE EXCEPTION 'Material capitalized twice';END IF;
 p:=jsonb_build_object('saleId',retail_sid,'action','CANCEL','reason','Cancelamento mercadoria QA','cashReturned',true,'goodsRetained',true);
 PERFORM internal_checkout_action_v5(t,b,u,gen_random_uuid(),p);
 IF (SELECT "OnHandQuantity" FROM stock_balances WHERE "Id"=retail_balance)<>5 OR (SELECT "ReservedQuantity" FROM stock_balances WHERE "Id"=retail_balance)<>1 OR (SELECT "CurrentBalance" FROM cash_shifts WHERE "Id"=sh)<>total THEN RAISE EXCEPTION 'Retail reversal';END IF;
 p:=jsonb_build_object('saleId',sid,'action','DELIVER');
 r:=internal_checkout_action_v5(t,b,u,deliver_req,p);
 IF r<>internal_checkout_action_v5(t,b,u,deliver_req,p) OR (SELECT "Status" FROM sales WHERE "Id"=sid)<>5 THEN RAISE EXCEPTION 'Delivery failed';END IF;
 BEGIN PERFORM internal_checkout_action_v5(t,b,u,gen_random_uuid(),jsonb_build_object('saleId',sid,'action','CANCEL','reason','Tentativa após entrega','cashReturned',true,'goodsRetained',true));RAISE EXCEPTION 'Delivered sale cancelled';EXCEPTION WHEN check_violation THEN NULL;END;
 result:=jsonb_build_object('passed',true,'refunds',2,'delivered',true,'finalCash',total,'factoryRebilledWithoutDuplicateCost',true,'factoryTotal',total,'retailTotal',25,'cashTotal',total+25,'retailStockRemaining',3,'factoryStockUnchanged',true,'balancedJournals',true,'fixturesRolledBack',true);
 RAISE EXCEPTION 'rollback fixtures' USING ERRCODE='ZX001';
 EXCEPTION WHEN SQLSTATE 'ZX001' THEN NULL;
 END;
 RETURN result;
END $function$;
SELECT factory_qa.run_checkout_cash_v5() AS result;
ROLLBACK;
