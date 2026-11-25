BEGIN;
CREATE SCHEMA IF NOT EXISTS factory_qa;
CREATE OR REPLACE FUNCTION factory_qa.seed_checkout_v5()
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE t uuid:='a0000000-0000-0000-0000-000000000001';b uuid:='b0000000-0000-0000-0000-000000000001';u uuid:='d0000000-0000-0000-0000-000000000001';accounts uuid[]:=ARRAY[]::uuid[];codes text[]:=ARRAY['QA-CASH','QA-REV-GOODS','QA-REV-3D','QA-RAW-STOCK','QA-FINISHED','QA-COGS','QA-WASTE'];names text[]:=ARRAY['QA · Caixa','QA · Receita mercadorias','QA · Receita fábrica 3D','QA · Estoque matérias e mercadorias','QA · Produtos acabados','QA · Custo dos produtos vendidos','QA · Perdas de produção'];types integer[]:=ARRAY[1,4,4,1,1,5,5];a uuid;model uuid:=gen_random_uuid();sku uuid:=gen_random_uuid();retail_model uuid:=gen_random_uuid();retail_sku uuid;bal uuid;brand uuid;cat uuid;wh uuid;reg uuid:=gen_random_uuid();i integer;cost numeric;price numeric;
BEGIN
 IF NOT public.internal_checkout_qa_enabled_v5() OR NOT EXISTS(SELECT 1 FROM factory_qa.seed_runs WHERE name='factory-demo-v2') THEN RAISE EXCEPTION 'QA marker and prior seed required';END IF;
 IF EXISTS(SELECT 1 FROM factory_qa.seed_runs WHERE name='factory-checkout-v5') THEN RETURN jsonb_build_object('alreadySeeded',true);END IF;
 IF EXISTS(SELECT 1 FROM internal_checkout_config_v5 WHERE tenant_id=t AND branch_id=b) THEN RAISE EXCEPTION 'Checkout already configured; no override';END IF;
 SELECT "BrandId","CategoryId" INTO brand,cat FROM product_models WHERE "TenantId"=t AND "Name"='QA Matéria-prima e acessórios';
 SELECT "Id" INTO wh FROM warehouses WHERE "TenantId"=t AND "BranchId"=b AND "Code"='QA-FAB3D';
 IF brand IS NULL OR cat IS NULL OR wh IS NULL THEN RAISE EXCEPTION 'QA catalog not found';END IF;
 FOR i IN 1..7 LOOP a:=gen_random_uuid();accounts:=array_append(accounts,a);INSERT INTO financial_accounts("Id","TenantId","Code","Name","Type","IsActive","CreatedAtUtc") VALUES(a,t,codes[i],names[i],types[i],true,now());END LOOP;
 INSERT INTO product_models("Id","Name","Kind","SerializationPolicy","BrandId","CategoryId","IsActive","CreatedAtUtc","TenantId") VALUES(model,'QA · Fabricação personalizada 3D',5,0,brand,cat,true,now(),t),(retail_model,'QA · Mercadorias de homologação',1,0,brand,cat,true,now(),t);
 INSERT INTO product_skus("Id","ProductModelId","SkuCode","VariantName","DefaultPrice","IsActive","CreatedAtUtc","TenantId") VALUES(sku,model,'QA-F3D-BILLING','Lote de fabricação sob encomenda',0,true,now(),t);
 FOR i IN 1..5 LOOP
  retail_sku:=gen_random_uuid();bal:=gen_random_uuid();cost:=i*2;price:=i*5+2.5;
  INSERT INTO product_skus("Id","ProductModelId","SkuCode","VariantName","DefaultPrice","IsActive","CreatedAtUtc","TenantId") VALUES(retail_sku,retail_model,'QA-RETAIL-'||lpad(i::text,3,'0'),'QA · Mercadoria '||i,price,true,now(),t);
  INSERT INTO stock_balances("Id","BranchId","WarehouseId","ProductSkuId","OnHandQuantity","ReservedQuantity","BlockedQuantity","AverageCost","LastMovementAtUtc","CreatedAtUtc","TenantId") VALUES(bal,b,wh,retail_sku,10,0,0,cost,now(),now(),t);
  INSERT INTO stock_movements("Id","TenantId","BranchId","WarehouseId","ProductSkuId","MovementType","Quantity","UnitCost","TotalCost","BalanceAfterQuantity","DocumentReference","Reason","IdempotencyKey","CreatedByUserId","CreatedAtUtc") VALUES(gen_random_uuid(),t,b,wh,retail_sku,1,10,cost,10*cost,10,'QA-RETAIL-OPEN-'||i,'Carga inicial isolada QA','QA-RETAIL-OPEN-'||i,u,now());
 END LOOP;
 INSERT INTO internal_checkout_config_v5(tenant_id,branch_id,cash_account,goods_revenue_account,factory_revenue_account,stock_account,finished_account,cogs_account,waste_account,factory_sku) VALUES(t,b,accounts[1],accounts[2],accounts[3],accounts[4],accounts[5],accounts[6],accounts[7],sku);
 INSERT INTO cash_registers("Id","TenantId","BranchId","Code","Name","Status","Notes","CreatedAtUtc") VALUES(reg,t,b,'QA-CK-001','QA · Caixa de homologação',1,'Abertura manual obrigatória; não representa caixa comercial.',now());
 INSERT INTO factory_qa.seed_runs(name,details) VALUES('factory-checkout-v5',jsonb_build_object('accounts',accounts,'retailSkus',5,'factorySku',sku,'cashRegister',reg,'commercial',false));
 RETURN jsonb_build_object('accounts',7,'retailSkus',5,'cashRegister',reg,'commercial',false);
END $function$;
SELECT factory_qa.seed_checkout_v5() AS result;
COMMIT;
