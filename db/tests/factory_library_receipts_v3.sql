BEGIN;
CREATE SCHEMA IF NOT EXISTS factory_qa;
CREATE OR REPLACE FUNCTION factory_qa.run_library_receipt_v3()
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE t uuid:='a0000000-0000-0000-0000-000000000001';b uuid:='b0000000-0000-0000-0000-000000000001';u uuid:='d0000000-0000-0000-0000-000000000001';a uuid;v uuid;req uuid:=gen_random_uuid();vr uuid:=gen_random_uuid();p jsonb;r jsonb;bytes bytea:=convert_to('; QA GCODE','UTF8');bal uuid;sku uuid;wh uuid;loc uuid;sup uuid:=gen_random_uuid();rec uuid:=gen_random_uuid();item uuid:=gen_random_uuid();sp uuid;result jsonb;before_stock numeric; cust uuid; printer uuid; ord uuid; att uuid; alloc uuid; plan jsonb;
BEGIN
 BEGIN
 SELECT c.balance_id,s."ProductSkuId",s."WarehouseId",s."WarehouseLocationId",s."OnHandQuantity" INTO bal,sku,wh,loc,before_stock FROM manufacturing_material_balance_configs c JOIN stock_balances s ON s."Id"=c.balance_id WHERE c.tenant_id=t AND c.branch_id=b AND c.kind='FILAMENT' AND c.color='PRETO' LIMIT 1;
 IF bal IS NULL THEN RAISE EXCEPTION 'QA fixture missing';END IF;
 p:=jsonb_build_object('code','QA-TEST-'||left(req::text,8),'title','QA temporary design','category','QA','description','','license','QA permitted','commercialAllowed',true,'author','QA');
 r:=public.factory_create_asset_v3(t,b,u,req,p);a:=(r->>'id')::uuid;
 IF r<>public.factory_create_asset_v3(t,b,u,req,p) THEN RAISE EXCEPTION 'asset retry';END IF;
 p:=jsonb_build_object('assetId',a,'filename','qa.gcode','format','GCODE','revision','V1','sha256',encode(sha256(bytes),'hex'),'metadata',jsonb_build_object('source','QA','plates','[]'::jsonb),'seconds',3600,'grams',35,'notes','');
 r:=public.factory_create_version_v3(t,b,u,vr,p,bytes);v:=(r->>'id')::uuid;
 IF r<>public.factory_create_version_v3(t,b,u,vr,p,bytes) THEN RAISE EXCEPTION 'version retry';END IF;
 IF (SELECT content FROM manufacturing_factory_files WHERE tenant_id=t AND branch_id=b AND version_id=v)<>bytes THEN RAISE EXCEPTION 'file mismatch';END IF;
 BEGIN PERFORM public.factory_create_version_v3(t,b,u,gen_random_uuid(),p,convert_to('tampered','UTF8'));RAISE EXCEPTION 'wrong digest accepted';EXCEPTION WHEN invalid_parameter_value THEN NULL;END;
 p:=jsonb_build_object('versionId',v,'batchQuantity',1,'seconds',3600,'laborSeconds',600,'notes','QA','lines',jsonb_build_array(jsonb_build_object('balanceId',bal,'quantity',15)));
 PERFORM public.factory_create_recipe_v3(t,b,u,gen_random_uuid(),p);
 IF (SELECT quantity FROM manufacturing_factory_recipe_lines WHERE tenant_id=t AND branch_id=b AND version_id=v)<>15 THEN RAISE EXCEPTION 'BOM mismatch';END IF;
 BEGIN UPDATE manufacturing_factory_recipe_lines SET quantity=16 WHERE tenant_id=t AND branch_id=b AND version_id=v;RAISE EXCEPTION 'immutable BOM bypass';EXCEPTION WHEN check_violation THEN NULL;END;
 INSERT INTO parties("Id","Type","Name","IsActive","CreatedAtUtc","TenantId") VALUES(sup,1,'QA fornecedor transiente',true,now(),t);
 INSERT INTO goods_receipts("Id","BranchId","WarehouseId","WarehouseLocationId","SupplierPartyId","ReceiptNumber","InvoiceOrDocumentNumber","Status","ReceivedByUserId","CreatedAtUtc","TenantId") VALUES(rec,b,wh,loc,sup,'QA-REC-'||rec::text,'QA-NF-'||rec::text,2,u,now(),t);
 INSERT INTO goods_receipt_items("Id","GoodsReceiptId","ProductSkuId","QuantityReceived","RealUnitCost","CreatedAtUtc","TenantId") VALUES(item,rec,sku,2,75,now(),t);
 UPDATE stock_balances SET "OnHandQuantity"="OnHandQuantity"+2 WHERE "Id"=bal;
 p:=jsonb_build_object('receiptItemId',item,'balanceId',bal,'count',1,'grams',1000,'tare',200,'batch','QA receipt');
 req:=gen_random_uuid();r:=public.factory_register_received_spools_v3(t,b,u,req,p);sp:=(r->0->>'id')::uuid;
 IF r<>public.factory_register_received_spools_v3(t,b,u,req,p) THEN RAISE EXCEPTION 'receipt retry';END IF;
 IF (SELECT cost_per_gram FROM manufacturing_spool_details WHERE tenant_id=t AND branch_id=b AND spool_id=sp)<>0.075 THEN RAISE EXCEPTION 'receipt cost snapshot';END IF;
 IF (SELECT "OnHandQuantity" FROM stock_balances WHERE "Id"=bal)<>before_stock+2 THEN RAISE EXCEPTION 'duplicate central receipt';END IF;
 BEGIN PERFORM public.factory_register_received_spools_v3(t,b,u,gen_random_uuid(),p||jsonb_build_object('count',2));RAISE EXCEPTION 'receipt over-allocation accepted';EXCEPTION WHEN check_violation THEN NULL;END;
 SELECT "Id" INTO cust FROM parties WHERE "TenantId"=t AND "Name" LIKE 'QA · Cliente Fábrica %' ORDER BY "Name" LIMIT 1;
 SELECT "Id" INTO printer FROM manufacturing_printers WHERE "TenantId"=t AND "BranchId"=b AND "Status"=1 ORDER BY "Code" LIMIT 1;
 plan:=jsonb_build_array(jsonb_build_object('balanceId',bal,'spoolId',sp,'quantity',20));
 p:=jsonb_build_object('designVersionId',v,'customerId',cust,'printerId',printer,'title','QA lot cost order','notes','','quantity',1,'seconds',60,'laborSeconds',0,'tariff',1,'laborHour',0,'other',0,'wastePct',0,'marginPct',40,'feePct',0,'plan',plan);
 r:=public.factory_preview_order_v2(t,b,u,p);
 IF (r->'estimate'->>'filament')::numeric<>1.5 THEN RAISE EXCEPTION 'receipt estimate mismatch';END IF;
 p:=p||jsonb_build_object('approvedPrice',(r->'estimate'->>'suggestedPrice')::numeric,'estimateFingerprint',r->>'fingerprint');
 r:=public.factory_create_order_v2(t,b,u,gen_random_uuid(),p);ord:=(r->>'id')::uuid;
 IF (SELECT "DesignVersionId" FROM manufacturing_orders WHERE "Id"=ord) IS DISTINCT FROM v THEN RAISE EXCEPTION 'design link missing';END IF;
 SELECT id INTO alloc FROM manufacturing_material_allocations WHERE tenant_id=t AND branch_id=b AND order_id=ord;
 r:=public.factory_start_attempt_v2(t,b,u,gen_random_uuid(),jsonb_build_object('orderId',ord,'printerId',printer,'seconds',60,'version',1));att:=(r->>'attemptId')::uuid;
 PERFORM public.factory_finish_attempt_v2(t,b,u,gen_random_uuid(),jsonb_build_object('orderId',ord,'attemptId',att,'version',2,'success',true,'seconds',60,'laborSeconds',0,'producedQuantity',1,'notes','','actuals',jsonb_build_array(jsonb_build_object('allocationId',alloc,'quantity',20))));
 IF (SELECT actual_managerial_cost FROM manufacturing_material_allocations WHERE id=alloc)<>1.5 OR (SELECT actual_stock_cost FROM manufacturing_material_allocations WHERE id=alloc)<>2 OR (SELECT "ActualMaterialCost" FROM manufacturing_orders WHERE "Id"=ord)<>1.5 THEN RAISE EXCEPTION 'cost basis separation mismatch';END IF;
 PERFORM public.factory_quality_v2(t,b,u,gen_random_uuid(),jsonb_build_object('orderId',ord,'version',3,'approvedQuantity',1,'rejectedQuantity',0,'laborSeconds',0,'notes','QA','actuals','[]'::jsonb));
 result:=jsonb_build_object('passed',true,'managerialCost20g',1.5,'stockCost20g',2,'designLinked',true,'recipeGrams',15,'receiptCostPerKg',75,'centralStockAddedByRegistration',0,'fixturesRolledBack',true);
 RAISE EXCEPTION 'rollback fixtures' USING ERRCODE='ZX001';
 EXCEPTION WHEN SQLSTATE 'ZX001' THEN NULL;END;
 RETURN result;
END $function$;
SELECT factory_qa.run_library_receipt_v3() AS result;
ROLLBACK;
