-- Run only on isolated QA. Fixtures and test schema changes are rolled back.
BEGIN;
CREATE SCHEMA IF NOT EXISTS factory_qa;
CREATE OR REPLACE FUNCTION factory_qa.run_workflow_v2()
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE t uuid:=gen_random_uuid();b uuid:=gen_random_uuid();u uuid:=gen_random_uuid();cust uuid:=gen_random_uuid();brand uuid:=gen_random_uuid();cat uuid:=gen_random_uuid();model uuid:=gen_random_uuid();whouse uuid:=gen_random_uuid();black_sku uuid:=gen_random_uuid();white_sku uuid:=gen_random_uuid();supply_sku uuid:=gen_random_uuid();nfc_sku uuid:=gen_random_uuid();pack_sku uuid:=gen_random_uuid();bal uuid:=gen_random_uuid();white_bal uuid:=gen_random_uuid();supply_bal uuid:=gen_random_uuid();nfc_bal uuid:=gen_random_uuid();pack_bal uuid:=gen_random_uuid();pr uuid;ord uuid;att uuid;bl uuid;bl2 uuid;wh uuid;r jsonb;plan jsonb;p jsonb;request_id uuid:=gen_random_uuid();finish_id uuid:=gen_random_uuid();retry_bl uuid:=gen_random_uuid();retry_wh uuid:=gen_random_uuid();actuals jsonb;second_order uuid;result jsonb;key text:=left(t::text,8);
BEGIN
 BEGIN
 INSERT INTO public.tenants("Id","Name","Code","IsActive","CreatedAtUtc") VALUES(t,'QA Factory transient','QA-'||key,true,now());
 INSERT INTO public.branches("Id","Name","Code","IsHeadquarters","IsActive","CreatedAtUtc","TenantId") VALUES(b,'QA Branch','QA-'||key,true,true,now(),t);
 INSERT INTO public.users("Id","FullName","Email","PasswordHash","IsActive","DefaultBranchId","CreatedAtUtc","TenantId") VALUES(u,'QA Factory transient','qa-'||u::text||'@example.invalid','unusable-fixture',true,b,now(),t);
 INSERT INTO public.parties("Id","Type","Name","IsActive","CreatedAtUtc","TenantId") VALUES(cust,1,'QA cliente transiente',true,now(),t);
 INSERT INTO public.customer_profiles("Id","PartyId","TotalSalesValue","CompletedRepairsCount","CreatedAtUtc","TenantId") VALUES(gen_random_uuid(),cust,0,0,now(),t);
 INSERT INTO public.product_brands("Id","Name","IsActive","CreatedAtUtc","TenantId") VALUES(brand,'QA Brand',true,now(),t);
 INSERT INTO public.product_categories("Id","Name","Slug","IsActive","CreatedAtUtc","TenantId") VALUES(cat,'QA Materials','qa-'||key,true,now(),t);
 INSERT INTO public.product_models("Id","Name","Kind","SerializationPolicy","BrandId","CategoryId","IsActive","CreatedAtUtc","TenantId") VALUES(model,'QA Model',1,0,brand,cat,true,now(),t);
 INSERT INTO public.warehouses("Id","BranchId","Code","Name","Type","IsActive","CreatedAtUtc","TenantId") VALUES(whouse,b,'QA-'||key,'QA Warehouse',1,true,now(),t);
 INSERT INTO public.product_skus("Id","ProductModelId","SkuCode","VariantName","DefaultPrice","IsActive","CreatedAtUtc","TenantId") VALUES(black_sku,model,'QA-BLACK-'||key,'QA preto 1kg',100,true,now(),t),(white_sku,model,'QA-WHITE-'||key,'QA branco 1kg',80,true,now(),t),(supply_sku,model,'QA-RINGS-'||key,'QA argolas',0.2,true,now(),t),(nfc_sku,model,'QA-NFC-'||key,'QA NFC',1.2,true,now(),t),(pack_sku,model,'QA-PACK-'||key,'QA embalagem',0.3,true,now(),t);
 INSERT INTO public.stock_balances("Id","BranchId","WarehouseId","ProductSkuId","OnHandQuantity","ReservedQuantity","BlockedQuantity","AverageCost","LastMovementAtUtc","CreatedAtUtc","TenantId") VALUES(bal,b,whouse,black_sku,2,0,0,100,now(),now(),t),(white_bal,b,whouse,white_sku,3,0,0,80,now(),now(),t),(supply_bal,b,whouse,supply_sku,100,0,0,0.2,now(),now(),t),(nfc_bal,b,whouse,nfc_sku,50,0,0,1.2,now(),now(),t),(pack_bal,b,whouse,pack_sku,100,0,0,0.3,now(),now(),t);
 PERFORM public.factory_configure_material_v2(t,b,u,bal,'FILAMENT','PLA','Preto',1000);
 PERFORM public.factory_configure_material_v2(t,b,u,white_bal,'FILAMENT','PLA','Branco',1000);
 PERFORM public.factory_configure_material_v2(t,b,u,supply_bal,'SUPPLY','Argolas','',1);
 PERFORM public.factory_configure_material_v2(t,b,u,nfc_bal,'SUPPLY','NFC','',1);
 PERFORM public.factory_configure_material_v2(t,b,u,pack_bal,'SUPPLY','Embalagem','',1);
 r:=public.factory_register_spools_v2(t,b,u,gen_random_uuid(),bal,2,1000,200,'QA');bl:=(r->0->>'id')::uuid;bl2:=(r->1->>'id')::uuid;
 IF r->0->>'code'<>'001' OR r->1->>'code'<>'002' THEN RAISE EXCEPTION 'black sequence';END IF;
 r:=public.factory_register_spools_v2(t,b,u,gen_random_uuid(),white_bal,3,1000,200,'QA');wh:=(r->0->>'id')::uuid;
 IF r->0->>'code'<>'001' OR r->2->>'code'<>'003' THEN RAISE EXCEPTION 'white sequence';END IF;
 p:=jsonb_build_object('code','QA-'||key,'name','QA Printer','manufacturer','QA','model','QA FDM','serial','','technology',1,'buildVolume','250x250x250','extruders',1,'materials','PLA','nominalWatts',350,'averageWatts',150,'acquisitionCost',5000,'lifespanHours',5000,'machineHour',1.5);
 r:=public.factory_create_printer_v2(t,b,u,gen_random_uuid(),p);pr:=(r->>'id')::uuid;
 plan:=jsonb_build_array(jsonb_build_object('balanceId',bal,'spoolId',bl,'quantity',15),jsonb_build_object('balanceId',white_bal,'spoolId',wh,'quantity',20),jsonb_build_object('balanceId',supply_bal,'spoolId',null,'quantity',1),jsonb_build_object('balanceId',nfc_bal,'spoolId',null,'quantity',1),jsonb_build_object('balanceId',pack_bal,'spoolId',null,'quantity',1));
 p:=jsonb_build_object('customerId',cust,'printerId',pr,'title','Chaveiro QA','notes','Personalização teste','quantity',1,'seconds',3600,'laborSeconds',600,'tariff',1,'laborHour',18,'other',0,'wastePct',0,'marginPct',40,'feePct',0,'approvedPrice',15.75,'plan',plan);
 r:=public.factory_preview_order_v2(t,b,u,p);
 IF (r->'estimate'->>'totalCost')::numeric<>9.45 THEN RAISE EXCEPTION 'preview mismatch';END IF;
 p:=p||jsonb_build_object('estimateFingerprint',r->>'fingerprint');
 r:=public.factory_create_order_v2(t,b,u,request_id,p);ord:=(r->>'id')::uuid;
 IF r<>public.factory_create_order_v2(t,b,u,request_id,p) THEN RAISE EXCEPTION 'order replay';END IF;
 IF (SELECT "EstimatedFilamentGrams" FROM public.manufacturing_orders WHERE "Id"=ord)<>35 OR (SELECT "TotalEstimatedCost" FROM public.manufacturing_orders WHERE "Id"=ord)<>9.45 THEN RAISE EXCEPTION 'order estimate';END IF;
 r:=public.factory_start_attempt_v2(t,b,u,gen_random_uuid(),jsonb_build_object('orderId',ord,'printerId',pr,'seconds',3600,'version',1));att:=(r->>'attemptId')::uuid;
 IF (SELECT "Status" FROM public.manufacturing_printers WHERE "Id"=pr)<>4 THEN RAISE EXCEPTION 'printer not busy';END IF;
 SELECT jsonb_agg(jsonb_build_object('allocationId',id,'quantity',CASE WHEN spool_id=bl THEN 5 ELSE 8 END)) INTO actuals FROM public.manufacturing_material_allocations WHERE order_id=ord AND spool_id IS NOT NULL AND state='RESERVED';
 p:=jsonb_build_object('orderId',ord,'attemptId',att,'version',2,'success',false,'seconds',600,'laborSeconds',0,'producedQuantity',0,'notes','Falha de aderência','actuals',actuals);
 r:=public.factory_finish_attempt_v2(t,b,u,finish_id,p);
 IF r<>public.factory_finish_attempt_v2(t,b,u,finish_id,p) OR (r->>'status')::integer<>7 THEN RAISE EXCEPTION 'failure retry';END IF;
 IF (SELECT "ActualWasteCost" FROM public.manufacturing_orders WHERE "Id"=ord)<>1.14 THEN RAISE EXCEPTION 'waste cost';END IF;
 PERFORM public.factory_reserve_material_v2(t,b,u,retry_bl,ord,bal,bl,15);
 PERFORM public.factory_reserve_material_v2(t,b,u,retry_wh,ord,white_bal,wh,20);
 r:=public.factory_start_attempt_v2(t,b,u,gen_random_uuid(),jsonb_build_object('orderId',ord,'printerId',pr,'seconds',3600,'version',3));att:=(r->>'attemptId')::uuid;
 p:=jsonb_build_object('orderId',ord,'attemptId',att,'version',4,'success',true,'seconds',3600,'laborSeconds',600,'producedQuantity',1,'notes','','actuals',jsonb_build_array(jsonb_build_object('allocationId',retry_bl,'quantity',15),jsonb_build_object('allocationId',retry_wh,'quantity',20)));
 r:=public.factory_finish_attempt_v2(t,b,u,gen_random_uuid(),p);IF (r->>'status')::integer<>10 THEN RAISE EXCEPTION 'assembly state';END IF;
 SELECT jsonb_agg(jsonb_build_object('allocationId',id,'quantity',1)) INTO actuals FROM public.manufacturing_material_allocations WHERE order_id=ord AND spool_id IS NULL AND state='RESERVED';
 r:=public.factory_quality_v2(t,b,u,gen_random_uuid(),jsonb_build_object('orderId',ord,'version',5,'approvedQuantity',1,'rejectedQuantity',0,'laborSeconds',60,'notes','OK','actuals',actuals));
 IF (r->>'status')::integer<>12 OR (SELECT "ApprovedQuantity" FROM public.manufacturing_orders WHERE "Id"=ord)<>1 THEN RAISE EXCEPTION 'completion';END IF;
 IF (SELECT "RemainingWeightGrams" FROM public.manufacturing_spools WHERE "Id"=bl)<>980 OR (SELECT "RemainingWeightGrams" FROM public.manufacturing_spools WHERE "Id"=wh)<>972 OR (SELECT "OnHandQuantity" FROM public.stock_balances WHERE "Id"=supply_bal)<>99 THEN RAISE EXCEPTION 'actual balances';END IF;
 IF (SELECT "ActualMaterialCost"+"ActualWasteCost"+"ActualEnergyCost"+"ActualMachineCost"+"ActualLaborCost" FROM public.manufacturing_orders WHERE "Id"=ord)<>11.165 THEN RAISE EXCEPTION 'actual total';END IF;
 IF (SELECT approved_price FROM public.manufacturing_factory_order_details WHERE order_id=ord)<>15.75 THEN RAISE EXCEPTION 'approved price drift';END IF;
 PERFORM set_config('hbstudio.factory_order_command','',true);
 BEGIN UPDATE public.manufacturing_orders SET "Status"=8 WHERE "Id"=ord;RAISE EXCEPTION 'legacy bypass';EXCEPTION WHEN check_violation THEN NULL;END;
 p:=jsonb_build_object('customerId',cust,'printerId',pr,'title','Cancelamento QA','notes','','quantity',1,'seconds',3600,'laborSeconds',600,'tariff',1,'laborHour',18,'other',0,'wastePct',0,'marginPct',40,'feePct',0,'approvedPrice',15.75,'plan',plan);
 r:=public.factory_create_order_v2(t,b,u,gen_random_uuid(),p);second_order:=(r->>'id')::uuid;
 r:=public.factory_cancel_order_v2(t,b,u,gen_random_uuid(),jsonb_build_object('orderId',second_order,'version',1,'reason','Cliente cancelou'));
 IF (r->>'status')::integer<>13 OR EXISTS(SELECT 1 FROM public.manufacturing_material_allocations WHERE order_id=second_order AND state<>'RELEASED') OR (SELECT "RemainingWeightGrams" FROM public.manufacturing_spools WHERE "Id"=bl)<>980 THEN RAISE EXCEPTION 'cancel release';END IF;
 result:=jsonb_build_object('passed',true,'estimate',9.45,'actualCost',11.165,'approvedPrice',15.75,'blackRemaining',980,'whiteRemaining',972,'ringsRemaining',99,'failureWaste',1.14,'state',12,'cancellation',13,'fixturesRolledBack',true);
 RAISE EXCEPTION 'fixture rollback' USING ERRCODE='ZX001';
 EXCEPTION WHEN SQLSTATE 'ZX001' THEN NULL;
 END;
 RETURN result;
END $function$;
SELECT factory_qa.run_workflow_v2() AS result;
ROLLBACK;
