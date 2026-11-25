BEGIN;
CREATE SCHEMA IF NOT EXISTS factory_qa;
CREATE OR REPLACE FUNCTION factory_qa.run_purchase_v6()
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE t uuid:='a0000000-0000-0000-0000-000000000001';b uuid:='b0000000-0000-0000-0000-000000000001';u uuid:='d0000000-0000-0000-0000-000000000001';sup uuid:=gen_random_uuid();liab uuid:=gen_random_uuid();bal uuid;white uuid;ord uuid;req uuid:=gen_random_uuid();receive_req uuid:=gen_random_uuid();p jsonb;r jsonb;old_supply numeric;old_white numeric;old_cash bigint;old_spools bigint;receipt uuid;payable uuid;sp uuid;result jsonb;
BEGIN
 BEGIN
 IF NOT EXISTS(SELECT 1 FROM factory_purchase_config_v6 WHERE tenant_id=t AND branch_id=b) THEN
  INSERT INTO financial_accounts("Id","TenantId","Code","Name","Type","IsActive","CreatedAtUtc") VALUES(liab,t,'QA-TEMP-AP-'||left(req::text,8),'QA fornecedores transiente',2,true,now());
  INSERT INTO factory_purchase_config_v6(tenant_id,branch_id,payable_account) VALUES(t,b,liab);
 END IF;
 INSERT INTO parties("Id","TenantId","Type","Name","IsActive","CreatedAtUtc") VALUES(sup,t,1,'QA fornecedor transiente',true,now());
 INSERT INTO supplier_profiles("Id","TenantId","PartyId","LeadTimeDays","CreatedAtUtc") VALUES(gen_random_uuid(),t,sup,3,now());
 SELECT c.balance_id,s."OnHandQuantity" INTO bal,old_supply FROM manufacturing_material_balance_configs c JOIN stock_balances s ON s."Id"=c.balance_id WHERE c.tenant_id=t AND c.branch_id=b AND c.material_type='ARGOLAS';
 SELECT c.balance_id,s."OnHandQuantity" INTO white,old_white FROM manufacturing_material_balance_configs c JOIN stock_balances s ON s."Id"=c.balance_id WHERE c.tenant_id=t AND c.branch_id=b AND c.kind='FILAMENT' AND c.color='BRANCO';
 SELECT count(*) INTO old_cash FROM cash_movements WHERE "TenantId"=t AND "BranchId"=b;
 SELECT count(*) INTO old_spools FROM manufacturing_spool_details WHERE tenant_id=t AND branch_id=b AND balance_id=white;
 p:=jsonb_build_object('supplierId',sup,'balanceId',bal,'quantity',100,'total',20,'dueAt',(now()+interval '30 days')::text,'notes','QA argolas');
 r:=public.factory_purchase_create_v6(t,b,u,req,p);ord:=(r->>'id')::uuid;
 IF (r->>'unitCost')::numeric<>0.20 OR r<>public.factory_purchase_create_v6(t,b,u,req,p) THEN RAISE EXCEPTION 'Purchase pricing/replay';END IF;
 BEGIN PERFORM public.factory_purchase_receive_v6(t,b,u,gen_random_uuid(),jsonb_build_object('orderId',ord,'version',1,'document','QA-UNAPPROVED','batch',''));RAISE EXCEPTION 'Unapproved receipt accepted';EXCEPTION WHEN check_violation THEN NULL;END;
 PERFORM public.factory_purchase_approve_v6(t,b,u,gen_random_uuid(),jsonb_build_object('orderId',ord,'version',1));
 p:=jsonb_build_object('orderId',ord,'version',2,'document','QA-ARGOLAS-'||left(req::text,8),'batch','');
 r:=public.factory_purchase_receive_v6(t,b,u,receive_req,p);receipt:=(r->>'receiptId')::uuid;payable:=(r->>'payableId')::uuid;
 IF r<>public.factory_purchase_receive_v6(t,b,u,receive_req,p) OR (SELECT "OnHandQuantity" FROM stock_balances WHERE "Id"=bal)<>old_supply+100 THEN RAISE EXCEPTION 'Supply receipt stock';END IF;
 IF (SELECT "OriginalAmount" FROM accounts_payable WHERE "Id"=payable)<>20 OR (SELECT "PaidAmount" FROM accounts_payable WHERE "Id"=payable)<>0 OR (SELECT "Status" FROM accounts_payable WHERE "Id"=payable)<>2 THEN RAISE EXCEPTION 'Payable mismatch';END IF;
 IF (SELECT count(*) FROM stock_movements WHERE "TenantId"=t AND "CorrelationId"=receipt AND "MovementType"=2)<>1 THEN RAISE EXCEPTION 'Receipt Kardex duplicate';END IF;
 p:=jsonb_build_object('supplierId',sup,'balanceId',white,'rollCount',2,'gramsPerRoll',1000,'tareGrams',200,'total',150,'dueAt',(now()+interval '30 days')::text,'notes','QA filamentos');
 r:=public.factory_purchase_create_v6(t,b,u,gen_random_uuid(),p);ord:=(r->>'id')::uuid;
 PERFORM public.factory_purchase_approve_v6(t,b,u,gen_random_uuid(),jsonb_build_object('orderId',ord,'version',1));
 BEGIN PERFORM public.factory_purchase_receive_v6(t,b,u,gen_random_uuid(),jsonb_build_object('orderId',ord,'version',2,'document','QA-ARGOLAS-'||left(req::text,8),'batch',''));RAISE EXCEPTION 'Duplicate supplier document accepted';EXCEPTION WHEN check_violation THEN NULL;END;
 r:=public.factory_purchase_receive_v6(t,b,u,gen_random_uuid(),jsonb_build_object('orderId',ord,'version',2,'document','QA-WHITE-'||left(req::text,8),'batch','QA lote 75'));
 IF jsonb_array_length(r->'rolls')<>2 OR (SELECT count(*) FROM manufacturing_spool_details WHERE tenant_id=t AND branch_id=b AND balance_id=white)<>old_spools+2 OR (SELECT "OnHandQuantity" FROM stock_balances WHERE "Id"=white)<>old_white+2 THEN RAISE EXCEPTION 'Spool receiving mismatch';END IF;
 sp:=(r->'rolls'->0->>'id')::uuid;
 IF (SELECT cost_per_gram FROM manufacturing_spool_details WHERE spool_id=sp)<>0.075 THEN RAISE EXCEPTION 'Historical acquisition cost';END IF;
 IF (SELECT count(*) FROM cash_movements WHERE "TenantId"=t AND "BranchId"=b)<>old_cash THEN RAISE EXCEPTION 'Unexpected payment';END IF;
 IF EXISTS(SELECT 1 FROM financial_journal_entries e JOIN financial_journal_lines l ON l."FinancialJournalEntryId"=e."Id" AND l."TenantId"=e."TenantId" WHERE e."TenantId"=t AND e."SourceType"='QA_PURCHASE_RECEIPT' GROUP BY e."Id",e."TotalAmount" HAVING sum(CASE WHEN l."Direction"=1 THEN l."Amount" ELSE -l."Amount" END)<>0 OR sum(l."Amount")<>2*e."TotalAmount") THEN RAISE EXCEPTION 'Unbalanced purchase ledger';END IF;
 result:=jsonb_build_object('passed',true,'ringsPurchased',100,'ringsCost',20,'ringUnitCost',0.20,'rollsPurchased',2,'rollsCost',150,'rollCostPerKg',75,'newPayables',170,'cashUnchanged',true,'fixturesRolledBack',true);
 RAISE EXCEPTION 'rollback' USING ERRCODE='ZX001';
 EXCEPTION WHEN SQLSTATE 'ZX001' THEN NULL;
 END;
 RETURN result;
END $function$;
SELECT factory_qa.run_purchase_v6() AS result;
ROLLBACK;
