-- QA ONLY. Synthetic fiscal policy is rolled back; not legal approval.
DO $qa$
DECLARE t uuid;b uuid;u uuid;c uuid;k uuid;bal uuid;cash uuid;asset uuid;rev uuid;ex uuid;li uuid;reg uuid:=gen_random_uuid();shift uuid:=gen_random_uuid();issuer uuid:=gen_random_uuid();policy uuid:=gen_random_uuid();s1 uuid;s2 uuid;req uuid:=gen_random_uuid();ar uuid:=gen_random_uuid();out jsonb;p jsonb;price bigint;onhand numeric;before_sales bigint;before_j bigint;before_m bigint;credit bigint;spend bigint;discount bigint:=50;total bigint;balance bigint;
BEGIN
 IF current_setting('neon.branch_id',true) IS DISTINCT FROM 'br-empty-dew-b63jpig9' THEN RAISE EXCEPTION 'QA_ONLY';END IF;
 SELECT x."TenantId",x."DefaultBranchId",x."Id" INTO t,b,u FROM users x JOIN tenants te ON te."Id"=x."TenantId" WHERE te."Name"='HB Studio Tecnologia' AND EXISTS(SELECT 1 FROM user_roles ur JOIN role_permissions rp ON rp."TenantId"=ur."TenantId" AND rp."RoleId"=ur."RoleId" WHERE ur."TenantId"=x."TenantId" AND ur."UserId"=x."Id" AND rp."PermissionKey"='loyalty.manage') LIMIT 1;
 SELECT x."Id" INTO c FROM parties x JOIN customer_profiles cp ON cp."TenantId"=x."TenantId" AND cp."PartyId"=x."Id" WHERE x."TenantId"=t AND x."IsActive" AND x."Type"=1 AND commercial_cpf_valid_v17(x."DocumentNumber") LIMIT 1;
 SELECT x."Id",x."ProductSkuId",x."OnHandQuantity",round(sk."DefaultPrice"*100)::bigint INTO bal,k,onhand,price FROM stock_balances x JOIN warehouses w ON w."TenantId"=x."TenantId" AND w."BranchId"=x."BranchId" AND w."Id"=x."WarehouseId" AND w."IsActive" JOIN product_skus sk ON sk."TenantId"=x."TenantId" AND sk."Id"=x."ProductSkuId" AND sk."IsActive" JOIN product_models m ON m."TenantId"=sk."TenantId" AND m."Id"=sk."ProductModelId" AND m."IsActive" AND m."Kind"=1 AND m."SerializationPolicy"=0 WHERE x."TenantId"=t AND x."BranchId"=b AND x."OnHandQuantity"-x."ReservedQuantity"-x."BlockedQuantity">=2 AND x."AverageCost">0 AND sk."DefaultPrice">=10 AND sk."DefaultPrice"=round(sk."DefaultPrice",2) AND NOT EXISTS(SELECT 1 FROM manufacturing_material_balance_configs z WHERE z.tenant_id=t AND z.branch_id=b AND z.balance_id=x."Id") LIMIT 1;
 SELECT "Id" INTO cash FROM financial_accounts WHERE "TenantId"=t AND "Type"=1 AND "IsActive" ORDER BY "Id" LIMIT 1;
 SELECT "Id" INTO asset FROM financial_accounts WHERE "TenantId"=t AND "Type"=1 AND "IsActive" AND "Id"<>cash ORDER BY "Id" LIMIT 1;
 SELECT "Id" INTO rev FROM financial_accounts WHERE "TenantId"=t AND "Type"=4 AND "IsActive" LIMIT 1;
 SELECT "Id" INTO ex FROM financial_accounts WHERE "TenantId"=t AND "Type"=5 AND "IsActive" LIMIT 1;
 SELECT "Id" INTO li FROM financial_accounts WHERE "TenantId"=t AND "Type"=2 AND "IsActive" LIMIT 1;
 IF c IS NULL OR k IS NULL OR u IS NULL OR cash IS NULL OR asset IS NULL OR rev IS NULL OR ex IS NULL OR li IS NULL THEN RAISE EXCEPTION 'QA_MISSING_FIXTURE';END IF;
 IF EXISTS(SELECT 1 FROM fiscal_establishments WHERE "TenantId"=t AND "BranchId"=b) OR EXISTS(SELECT 1 FROM commercial_checkout_config_v17 WHERE tenant_id=t AND branch_id=b) OR EXISTS(SELECT 1 FROM loyalty_settings WHERE "TenantId"=t) THEN RAISE EXCEPTION 'QA_EXISTING_SETTINGS';END IF;
 SELECT count(*) INTO before_sales FROM sales;SELECT count(*) INTO before_j FROM financial_journal_entries;SELECT count(*) INTO before_m FROM stock_movements;
 BEGIN
 INSERT INTO commercial_checkout_config_v17(tenant_id,branch_id,enabled,cash_account,revenue_account,stock_account,cogs_account,version) VALUES(t,b,true,cash,rev,asset,ex,1);
 p:=jsonb_build_object('customerId',c,'shiftId',shift,'cashConfirmed',true,'fiscalRequested',false,'operationType','LOCAL_GOODS','discountCents',0,'cashbackCents',0,'expectedTotalCents',price,'tenderedCents',price,'items',jsonb_build_array(jsonb_build_object('balanceId',bal,'quantity',1,'unitPriceCents',price)));
 BEGIN PERFORM commercial_checkout_cash_v17(t,b,u,req,p);RAISE EXCEPTION 'QA_FISCAL_GATE_MISSING';EXCEPTION WHEN check_violation THEN IF SQLERRM NOT LIKE '%COMMERCIAL_FISCAL_REQUIRED%' THEN RAISE;END IF;END;
 -- Synthetic tax approval only inside rollback in isolated QA; not an actual fiscal opinion.
 INSERT INTO fiscal_establishments("Id","TenantId","BranchId","CorporateName","TradeName","Cnpj","StateRegistration","MunicipalRegistration","Cnae","Regime","Street","Number","Neighborhood","CityCodeIbge","CityName","State","PostalCode","Environment","QrVersion","NfceDefaultSeries","NfceNextNumber","IsNfceEnabled","IsActive","CreatedAtUtc") VALUES(issuer,t,b,'QA ROLLBACK','QA ROLLBACK','00000000000000','QA','QA','QA',4,'QA','0','QA','0000000','QA','SP','00000000',2,2,1,1,false,true,now());
 INSERT INTO fiscal_receipt_exemption_policies("Id","TenantId","BranchId","FiscalEstablishmentId","Regime","BuyerType","OperationType","LegalBasis","ApprovalReference","ApprovedByUserId","ApprovedAtUtc","ValidFromUtc","ValidUntilUtc","IsActive") VALUES(policy,t,b,issuer,4,'PF','LOCAL_GOODS','QA ONLY NOT LEGAL APPROVAL','QA ROLLBACK',u,now(),now()-interval '1 day',now()+interval '1 day',true);
 INSERT INTO cash_registers("Id","TenantId","BranchId","Code","Name","Status","CreatedAtUtc") VALUES(reg,t,b,'QA-LOY17','QA rollback',1,now());
 INSERT INTO cash_shifts("Id","TenantId","BranchId","CashRegisterId","OperatorUserId","OpenedByUserId","OpenedAtUtc","OpeningFloat","Status","CurrentBalance","TotalCashIn","TotalCashOut","CreatedAtUtc") VALUES(shift,t,b,reg,u,u,now(),0,1,0,0,0,now());
 PERFORM loyalty_command_v16(t,b,u,gen_random_uuid(),'SETTINGS',jsonb_build_object('version',0,'enabled',true,'earnEveryCents',500,'pointsPerStep',1,'silver',null,'gold',null,'diamond',null));
 INSERT INTO loyalty_cashback_policy_v16(tenant_id,branch_id,enabled,enabled_since,rate_bps,expense_account,liability_account,version) VALUES(t,b,true,now(),500,ex,li,1);
 out:=commercial_checkout_cash_v17(t,b,u,req,p);s1:=(out->>'saleId')::uuid;
 SET CONSTRAINTS ALL IMMEDIATE;
 credit:=floor(price::numeric*500/10000)::bigint;
 IF (SELECT balance_cents FROM loyalty_cashback_accounts_v16 WHERE tenant_id=t AND branch_id=b AND party_id=c) IS DISTINCT FROM credit OR (SELECT "CurrentBalance" FROM cash_shifts WHERE "Id"=shift)<>price/100.0 OR (SELECT "OnHandQuantity" FROM stock_balances WHERE "Id"=bal)<>onhand-1 OR EXISTS(SELECT 1 FROM fiscal_documents WHERE "SaleId"=s1) THEN RAISE EXCEPTION 'QA_FIRST_SALE';END IF;
 IF (commercial_checkout_cash_v17(t,b,u,req,p)->>'saleId')::uuid IS DISTINCT FROM s1 THEN RAISE EXCEPTION 'QA_IDEMPOTENCY';END IF;
 spend:=least(credit,100);total:=price-spend-discount;
 p:=p||jsonb_build_object('discountCents',discount,'cashbackCents',spend,'expectedTotalCents',total,'tenderedCents',total);
 SET CONSTRAINTS ALL DEFERRED;
 out:=commercial_checkout_cash_v17(t,b,u,gen_random_uuid(),p);s2:=(out->>'saleId')::uuid;
 SET CONSTRAINTS ALL IMMEDIATE;
 balance:=credit-spend+floor(total::numeric*500/10000)::bigint;
 IF (SELECT balance_cents FROM loyalty_cashback_accounts_v16 WHERE tenant_id=t AND branch_id=b AND party_id=c)<>balance OR (SELECT "DiscountTotal" FROM sales WHERE "Id"=s2)<>(discount+spend)/100.0 OR NOT EXISTS(SELECT 1 FROM commercial_cashback_events_v17 WHERE sale_id=s2 AND kind='SPEND' AND delta_cents=-spend) OR (SELECT "CurrentBalance" FROM cash_shifts WHERE "Id"=shift)<>(price+total)/100.0 THEN RAISE EXCEPTION 'QA_SPEND';END IF;
 p:=jsonb_build_object('action','CANCEL','saleId',s2,'reason','QA rollback de venda','cashReturned',true,'goodsRetained',true);
 SET CONSTRAINTS ALL DEFERRED;
 out:=commercial_checkout_action_v17(t,b,u,ar,p);
 SET CONSTRAINTS ALL IMMEDIATE;
 IF commercial_checkout_action_v17(t,b,u,ar,p) IS DISTINCT FROM out OR (SELECT balance_cents FROM loyalty_cashback_accounts_v16 WHERE tenant_id=t AND branch_id=b AND party_id=c)<>credit OR (SELECT "OnHandQuantity" FROM stock_balances WHERE "Id"=bal)<>onhand-1 OR (SELECT "CurrentBalance" FROM cash_shifts WHERE "Id"=shift)<>price/100.0 OR NOT EXISTS(SELECT 1 FROM commercial_cashback_events_v17 WHERE sale_id=s2 AND kind='REFUND' AND delta_cents=spend) THEN RAISE EXCEPTION 'QA_CANCEL';END IF;
 PERFORM commercial_checkout_action_v17(t,b,u,gen_random_uuid(),jsonb_build_object('action','DELIVER','saleId',s1));
 IF (SELECT "Status" FROM sales WHERE "Id"=s1)<>5 THEN RAISE EXCEPTION 'QA_DELIVER';END IF;
 RAISE EXCEPTION 'QA_ROLLBACK' USING ERRCODE='P0011';
 EXCEPTION WHEN SQLSTATE 'P0011' THEN NULL;END;
 IF (SELECT count(*) FROM sales)<>before_sales OR (SELECT count(*) FROM financial_journal_entries)<>before_j OR (SELECT count(*) FROM stock_movements)<>before_m OR EXISTS(SELECT 1 FROM fiscal_establishments WHERE "Id"=issuer) OR EXISTS(SELECT 1 FROM cash_shifts WHERE "Id"=shift) THEN RAISE EXCEPTION 'QA_ROLLBACK_FAILED';END IF;
END $qa$;
