BEGIN;
CREATE SCHEMA IF NOT EXISTS factory_qa;
CREATE OR REPLACE FUNCTION factory_qa.run_catalog_intake_v7()
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE t uuid:='a0000000-0000-0000-0000-000000000001';b uuid:='b0000000-0000-0000-0000-000000000001';u uuid:='d0000000-0000-0000-0000-000000000001';req uuid:=gen_random_uuid();p jsonb;r jsonb;bal uuid;sku uuid;wh uuid;result jsonb;
BEGIN
 BEGIN
 p:=jsonb_build_object('mode','FILAMENT','kind',2,'policy',0,'name','QA Test PLA','variant','QA Laranja 1kg','code','QA-NEW-'||left(req::text,8),'brand','QA nova marca','category','QA nova categoria','price',89.90,'barcode','','description','','physicalConfirmed',true,'reference','QA-OPEN-'||req::text,'reason','Teste carga inicial','totalCost',160,'count',2,'grams',1000,'tare',200,'batch','QA-LOT','material','PLA','color','QA-LARANJA','warehouseName','QA depósito novo');
 r:=public.catalog_intake_v7(t,b,u,req,p);bal:=(r->>'balanceId')::uuid;sku:=(r->>'skuId')::uuid;wh:=(r->>'warehouseId')::uuid;
 IF r<>public.catalog_intake_v7(t,b,u,req,p) OR jsonb_array_length(r->'spools')<>2 OR r->'spools'->0->>'code'<>'001' OR r->'spools'->1->>'code'<>'002' THEN RAISE EXCEPTION 'Spool idempotency or sequence';END IF;
 IF (SELECT "OnHandQuantity" FROM stock_balances WHERE "Id"=bal)<>2 OR (SELECT sum(s."RemainingWeightGrams") FROM manufacturing_spools s JOIN manufacturing_spool_details d ON d.spool_id=s."Id" AND d.tenant_id=s."TenantId" WHERE d.balance_id=bal)<>2000 OR (SELECT min(cost_per_gram) FROM manufacturing_spool_details WHERE balance_id=bal)<>0.08 THEN RAISE EXCEPTION 'Filament cost or balance mismatch';END IF;
 IF (SELECT count(*) FROM stock_movements WHERE "TenantId"=t AND "CorrelationId"=req)<>1 THEN RAISE EXCEPTION 'Kardex duplicate';END IF;
 BEGIN PERFORM public.catalog_intake_v7(t,b,u,req,p||jsonb_build_object('count',3));RAISE EXCEPTION 'Changed retry accepted';EXCEPTION WHEN check_violation THEN NULL;END;
 BEGIN PERFORM public.catalog_intake_v7(t,b,u,gen_random_uuid(),p||jsonb_build_object('skuId',sku,'warehouseId',wh));RAISE EXCEPTION 'Duplicate opening accepted';EXCEPTION WHEN check_violation THEN NULL;END;
 p:=p||jsonb_build_object('mode','SUPPLY','name','QA Argolas novas','variant','Unidade','code','QA-SUP-'||left(req::text,8),'material','Argolas','quantity',100,'totalCost',20,'warehouseId',wh);
 r:=public.catalog_intake_v7(t,b,u,gen_random_uuid(),p);
 IF (r->>'unitCost')::numeric<>0.20 OR (SELECT "OnHandQuantity" FROM stock_balances WHERE "Id"=(r->>'balanceId')::uuid)<>100 THEN RAISE EXCEPTION 'Supply mismatch';END IF;
 p:=p||jsonb_build_object('mode','STOCK','kind',5,'name','QA Suporte 3D','variant','Laranja','code','QA-FAB-'||left(req::text,8),'price',25,'quantity',5,'totalCost',15);
 r:=public.catalog_intake_v7(t,b,u,gen_random_uuid(),p);
 IF (r->>'unitCost')::numeric<>3 OR (SELECT "OnHandQuantity" FROM stock_balances WHERE "Id"=(r->>'balanceId')::uuid)<>5 THEN RAISE EXCEPTION 'Finished stock mismatch';END IF;
 p:=p||jsonb_build_object('mode','CATALOG','kind',4,'name','QA Serviço','variant','Unidade','code','QA-SER-'||left(req::text,8),'price',50);
 r:=public.catalog_intake_v7(t,b,u,gen_random_uuid(),p);
 IF (r->>'stockCreated')::boolean OR EXISTS(SELECT 1 FROM stock_balances WHERE "ProductSkuId"=(r->>'skuId')::uuid) THEN RAISE EXCEPTION 'Service stock invalid';END IF;
 BEGIN PERFORM public.catalog_intake_v7(t,b,u,gen_random_uuid(),p||jsonb_build_object('mode','STOCK','code','QA-INVALID-'||left(req::text,8)));RAISE EXCEPTION 'Service stock accepted';EXCEPTION WHEN invalid_parameter_value THEN NULL;END;
 IF EXISTS(SELECT 1 FROM product_skus WHERE "TenantId"=t AND "SkuCode"='QA-INVALID-'||left(req::text,8)) THEN RAISE EXCEPTION 'Failed product persisted';END IF;
 result:=jsonb_build_object('passed',true,'rolls',2,'grams',2000,'costPerGram',0.08,'supplyUnitCost',0.2,'finishedStock',5,'catalogOnlyService',true,'retrySafe',true,'fixturesRolledBack',true);
 RAISE EXCEPTION 'rollback' USING ERRCODE='ZX001';
 EXCEPTION WHEN SQLSTATE 'ZX001' THEN NULL;END;
 RETURN result;
END $function$;
SELECT factory_qa.run_catalog_intake_v7() result;
ROLLBACK;
