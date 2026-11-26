-- QA only. All fixtures and writes rolled back.
DO $qa$
DECLARE t uuid;b uuid;u uuid;c uuid;k uuid;bal uuid;ex uuid;li uuid;ast uuid;s uuid:=gen_random_uuid();i uuid:=gen_random_uuid();pay uuid:=gen_random_uuid();rw uuid:=gen_random_uuid();req uuid:=gen_random_uuid();red uuid;out jsonb;p jsonb;onhand numeric;reserved numeric;orig_cost numeric;before_j bigint;before_m bigint;ver integer;
BEGIN
 SELECT x."TenantId",x."DefaultBranchId",x."Id" INTO t,b,u FROM users x JOIN tenants te ON te."Id"=x."TenantId" WHERE te."Name"='HB Studio Tecnologia' AND EXISTS(SELECT 1 FROM user_roles ur JOIN role_permissions rp ON rp."TenantId"=ur."TenantId" AND rp."RoleId"=ur."RoleId" WHERE ur."TenantId"=x."TenantId" AND ur."UserId"=x."Id" AND rp."PermissionKey"='loyalty.manage') LIMIT 1;
 SELECT "PartyId" INTO c FROM customer_profiles WHERE "TenantId"=t LIMIT 1;
 SELECT x."Id",x."ProductSkuId",x."OnHandQuantity",x."ReservedQuantity",x."AverageCost" INTO bal,k,onhand,reserved,orig_cost FROM stock_balances x JOIN warehouses w ON w."TenantId"=x."TenantId" AND w."BranchId"=x."BranchId" AND w."Id"=x."WarehouseId" AND w."IsActive" JOIN product_skus sk ON sk."TenantId"=x."TenantId" AND sk."Id"=x."ProductSkuId" AND sk."IsActive" JOIN product_models m ON m."TenantId"=sk."TenantId" AND m."Id"=sk."ProductModelId" AND m."IsActive" AND m."Kind"=1 AND m."SerializationPolicy"=0 WHERE x."TenantId"=t AND x."BranchId"=b AND x."OnHandQuantity"-x."ReservedQuantity"-x."BlockedQuantity">=1 AND x."AverageCost">0 AND NOT EXISTS(SELECT 1 FROM manufacturing_material_balance_configs z WHERE z.tenant_id=t AND z.branch_id=b AND z.balance_id=x."Id") LIMIT 1;
 SELECT "Id" INTO ex FROM financial_accounts WHERE "TenantId"=t AND "Type"=5 AND "IsActive" LIMIT 1;
 SELECT "Id" INTO li FROM financial_accounts WHERE "TenantId"=t AND "Type"=2 AND "IsActive" LIMIT 1;
 SELECT "Id" INTO ast FROM financial_accounts WHERE "TenantId"=t AND "Type"=1 AND "IsActive" LIMIT 1;
 IF c IS NULL OR k IS NULL OR u IS NULL OR ex IS NULL OR li IS NULL OR ast IS NULL THEN RAISE EXCEPTION 'QA_MISSING_FIXTURE';END IF;
 IF EXISTS(SELECT 1 FROM loyalty_settings WHERE "TenantId"=t) THEN RAISE EXCEPTION 'QA_EXISTING_SETTINGS';END IF;
 SELECT count(*) INTO before_j FROM financial_journal_entries;SELECT count(*) INTO before_m FROM stock_movements;
 BEGIN
 PERFORM loyalty_command_v16(t,b,u,gen_random_uuid(),'SETTINGS',jsonb_build_object('version',0,'enabled',true,'earnEveryCents',500,'pointsPerStep',1,'silver',null,'gold',null,'diamond',null));
 p:=jsonb_build_object('version',0,'enabled',false,'rateBps',500,'expenseAccount',ex,'liabilityAccount',li);
 PERFORM loyalty_command_v16(t,b,u,req,'CASHBACK_POLICY',p);
 BEGIN PERFORM loyalty_command_v16(t,b,u,gen_random_uuid(),'CASHBACK_POLICY',p||'{"enabled":true,"version":1}'::jsonb);RAISE EXCEPTION 'QA_ACTIVATION_NOT_BLOCKED';EXCEPTION WHEN check_violation THEN IF SQLERRM NOT LIKE '%CASHBACK_SETTLEMENT_NOT_READY%' THEN RAISE;END IF;END;
 UPDATE loyalty_cashback_policy_v16 SET enabled=true,enabled_since=now() WHERE tenant_id=t AND branch_id=b;
 INSERT INTO sales("Id","TenantId","BranchId","SaleNumber","CustomerPartyId","SellerUserId","CreatedByUserId","Status","PaymentStatus","FulfillmentStatus","DiscountTotal","ChargesTotal","CreatedAtUtc","IdempotencyKey") VALUES(s,t,b,'LOYALTY16-QA-'||s,c,u,u,1,1,1,0,0,now(),'LOYALTY16-TEST-'||s);
 INSERT INTO sale_items("Id","TenantId","SaleId","ProductSkuId","HistoricalSkuCode","HistoricalDescription","ItemCondition","Quantity","UnitPrice","Discount","HistoricalUnitCost","WarrantyDays","CreatedAtUtc") VALUES(i,t,s,k,'QA','QA rollback',1,1,100,0,50,90,now());
 INSERT INTO sale_payment_intents("Id","TenantId","SaleId","Method","Amount","Installments","Status","AuthorizationCode","CreatedAtUtc","ConfirmedAtUtc") VALUES(pay,t,s,1,100,1,2,'QA-ROLLBACK',now(),now());
 UPDATE sales SET "Status"=4,"PaymentStatus"=4,"ConfirmedAtUtc"=now() WHERE "Id"=s;
 SET CONSTRAINTS ALL IMMEDIATE;
 IF (SELECT balance_cents FROM loyalty_cashback_accounts_v16 WHERE tenant_id=t AND branch_id=b AND party_id=c) IS DISTINCT FROM 500 THEN RAISE EXCEPTION 'QA_CASHBACK';END IF;
 PERFORM loyalty_cashback_sale_v16(s);
 IF (SELECT count(*) FROM loyalty_cashback_ledger_v16 WHERE sale_id=s)<>1 THEN RAISE EXCEPTION 'QA_CASHBACK_DUP';END IF;
 IF NOT EXISTS(SELECT 1 FROM loyalty_cashback_ledger_v16 l JOIN financial_journal_entries j ON j."Id"=l.journal_id WHERE l.sale_id=s AND j."TotalAmount"=5 AND (SELECT count(*) FROM financial_journal_lines z WHERE z."FinancialJournalEntryId"=j."Id" AND z."Amount"=5)=2) THEN RAISE EXCEPTION 'QA_CASHBACK_JOURNAL';END IF;
 PERFORM loyalty_command_v16(t,b,u,gen_random_uuid(),'REWARD',jsonb_build_object('id',rw,'version',0,'title','QA rollback','description','QA','pointsCost',8,'stockTotal',2,'active',true));
 p:=jsonb_build_object('rewardId',rw,'balanceId',bal,'quantity',1,'expenseAccount',ex,'stockAccount',ast,'version',0);
 PERFORM loyalty_command_v16(t,b,u,gen_random_uuid(),'STOCK_REWARD',p);
 req:=gen_random_uuid();p:=jsonb_build_object('partyId',c,'id',rw,'version',1);
 out:=loyalty_command_v16(t,b,u,req,'RESERVE',p);red:=(out->>'id')::uuid;
 IF loyalty_command_v16(t,b,u,req,'RESERVE',p) IS DISTINCT FROM out OR (SELECT "ReservedQuantity" FROM stock_balances WHERE "Id"=bal)<>reserved+1 THEN RAISE EXCEPTION 'QA_RESERVE';END IF;
 PERFORM loyalty_command_v16(t,b,u,gen_random_uuid(),'CANCEL',jsonb_build_object('partyId',c,'id',red));
 IF (SELECT "ReservedQuantity" FROM stock_balances WHERE "Id"=bal)<>reserved OR (SELECT "OnHandQuantity" FROM stock_balances WHERE "Id"=bal)<>onhand THEN RAISE EXCEPTION 'QA_RELEASE';END IF;
 SELECT "Version" INTO ver FROM loyalty_rewards WHERE "Id"=rw;
 out:=loyalty_command_v16(t,b,u,gen_random_uuid(),'RESERVE',jsonb_build_object('partyId',c,'id',rw,'version',ver));red:=(out->>'id')::uuid;
 PERFORM loyalty_command_v16(t,b,u,gen_random_uuid(),'FULFILL_GIFT',jsonb_build_object('partyId',c,'id',red));
 IF (SELECT "ReservedQuantity" FROM stock_balances WHERE "Id"=bal)<>reserved OR (SELECT "OnHandQuantity" FROM stock_balances WHERE "Id"=bal)<>onhand-1 OR NOT EXISTS(SELECT 1 FROM loyalty_stock_allocations_v16 a JOIN stock_movements m ON m."Id"=a.movement_id JOIN financial_journal_entries j ON j."Id"=a.journal_id WHERE a.redemption_id=red AND a.state='FULFILLED' AND m."MovementType"=12 AND m."Quantity"=-1 AND j."TotalAmount"=round(orig_cost,2)) THEN RAISE EXCEPTION 'QA_FULFILL';END IF;
 UPDATE sales SET "Status"=6,"PaymentStatus"=7,"CancelledAtUtc"=now() WHERE "Id"=s;
 IF (SELECT balance_cents FROM loyalty_cashback_accounts_v16 WHERE tenant_id=t AND branch_id=b AND party_id=c) IS DISTINCT FROM 0 THEN RAISE EXCEPTION 'QA_CASHBACK_REV';END IF;
 RAISE EXCEPTION 'QA_ROLLBACK' USING ERRCODE='P0011';
 EXCEPTION WHEN SQLSTATE 'P0011' THEN NULL;END;
 IF (SELECT count(*) FROM financial_journal_entries)<>before_j OR (SELECT count(*) FROM stock_movements)<>before_m OR (SELECT "OnHandQuantity" FROM stock_balances WHERE "Id"=bal)<>onhand OR EXISTS(SELECT 1 FROM loyalty_cashback_policy_v16 WHERE tenant_id=t AND branch_id=b) THEN RAISE EXCEPTION 'QA_ROLLBACK_FAILED';END IF;
END $qa$;
