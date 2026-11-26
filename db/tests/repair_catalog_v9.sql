BEGIN;
CREATE SCHEMA IF NOT EXISTS factory_qa;
CREATE OR REPLACE FUNCTION factory_qa.run_repair_catalog_v9()
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE t uuid:='a0000000-0000-0000-0000-000000000001';b uuid:='b0000000-0000-0000-0000-000000000001';u uuid:='d0000000-0000-0000-0000-000000000001';req uuid:=gen_random_uuid();p jsonb;r jsonb;service uuid;part uuid;bal uuid;ord uuid;old_item uuid;items jsonb;historic jsonb;res jsonb;cust uuid;
BEGIN
 BEGIN
 p:=jsonb_build_object('mode','CATALOG','kind',4,'policy',0,'name','QA Limpeza notebook','variant','Execução','code','QA-SRV-'||left(req::text,8),'brand','QA Serviço','category','QA Serviços','price',80,'barcode','','description','Limpeza','serviceUnit','EXECUTION','serviceMinutes',60);
 r:=public.catalog_intake_v7(t,b,u,req,p);service:=(r->>'skuId')::uuid;
 IF (SELECT "TechnicalSpecsJson"->>'serviceMinutes' FROM product_skus WHERE "Id"=service)<>'60' OR EXISTS(SELECT 1 FROM stock_balances WHERE "ProductSkuId"=service) THEN RAISE EXCEPTION 'service config';END IF;
 p:=p||jsonb_build_object('mode','STOCK','kind',3,'name','QA Peça notebook','variant','Unidade','code','QA-PART-'||left(req::text,8),'price',25,'warehouseName','QA repair depot '||left(req::text,8),'quantity',3,'totalCost',30,'physicalConfirmed',true,'reference','QA-REPAIR-'||req::text,'reason','Teste estoque');
 r:=public.catalog_intake_v7(t,b,u,gen_random_uuid(),p);part:=(r->>'skuId')::uuid;bal:=(r->>'balanceId')::uuid;
 items:=jsonb_build_array(jsonb_build_object('itemType',1,'description','alterado pelo cliente','quantity',1,'unitPrice',80,'productSkuId',service),jsonb_build_object('itemType',2,'description','peça','quantity',2,'unitPrice',25,'productSkuId',part));
 r:=public.repair_catalog_items_v9(t,b,NULL,items);
 IF r->0->>'description'<>'QA Limpeza notebook · Execução' THEN RAISE EXCEPTION 'description not normalized';END IF;
 BEGIN PERFORM public.repair_catalog_items_v9(t,b,NULL,items||jsonb_build_array(items->1));RAISE EXCEPTION 'aggregate stock accepted';EXCEPTION WHEN check_violation THEN NULL;END;
 BEGIN PERFORM public.repair_catalog_items_v9(t,b,NULL,jsonb_build_array((items->0)||jsonb_build_object('unitPrice',1)));RAISE EXCEPTION 'price changed';EXCEPTION WHEN check_violation THEN NULL;END;
 BEGIN PERFORM public.repair_catalog_items_v9(t,b,NULL,jsonb_build_array((items->0)||jsonb_build_object('itemType',2)));RAISE EXCEPTION 'service as stock accepted';EXCEPTION WHEN check_violation THEN NULL;END;
 BEGIN PERFORM public.repair_catalog_items_v9(t,gen_random_uuid(),NULL,jsonb_build_array(items->1));RAISE EXCEPTION 'wrong branch accepted';EXCEPTION WHEN check_violation THEN NULL;END;
 SELECT "PartyId" INTO cust FROM customer_profiles WHERE "TenantId"=t LIMIT 1;
 SELECT id INTO ord FROM public.repair_enterprise_create(t,b,u,'qa@example.invalid','qa-v9',cust,NULL,'Notebook','QA','QA',NULL,NULL,NULL,'Limpeza QA',NULL,items,gen_random_uuid());
 IF (SELECT "FinalPrice" FROM repair_orders WHERE "Id"=ord)<>130 THEN RAISE EXCEPTION 'order total';END IF;
 SELECT "Id" INTO old_item FROM repair_estimate_items WHERE "RepairOrderId"=ord AND "ItemType"=1;
 SELECT jsonb_agg(jsonb_build_object('id',i."Id",'itemType',i."ItemType",'description',i."Description",'quantity',i."Quantity",'unitPrice',i."UnitPrice",'productSkuId',i."ProductSkuId")) INTO historic FROM repair_estimate_items i WHERE i."RepairOrderId"=ord;
 UPDATE product_skus SET "DefaultPrice"=90 WHERE "Id"=service;
 PERFORM public.repair_enterprise_update(t,b,u,'qa@example.invalid','qa-v9',ord,1,NULL,NULL,NULL,NULL,NULL,historic||jsonb_build_array((items->0)||jsonb_build_object('unitPrice',90)),NULL,NULL);
 IF (SELECT "FinalPrice" FROM repair_orders WHERE "Id"=ord)<>220 OR NOT EXISTS(SELECT 1 FROM repair_estimate_items WHERE "Id"=old_item AND "UnitPrice"=80) OR (SELECT "OnHandQuantity" FROM stock_balances WHERE "Id"=bal)<>3 THEN RAISE EXCEPTION 'historic or stock';END IF;
 res:=jsonb_build_object('passed',true,'initialTotal',130,'updatedTotal',220,'stockUnchanged',true,'priceSnapshot',true,'wrongBranchRejected',true,'rolledBack',true);
 RAISE EXCEPTION 'rollback' USING ERRCODE='ZX001';
 EXCEPTION WHEN SQLSTATE 'ZX001' THEN NULL;END;
 RETURN res;
END $function$;
SELECT factory_qa.run_repair_catalog_v9() result;
ROLLBACK;
