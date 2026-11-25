BEGIN;
CREATE SCHEMA IF NOT EXISTS factory_qa;
CREATE OR REPLACE FUNCTION factory_qa.seed_purchase_v6()
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE t uuid:='a0000000-0000-0000-0000-000000000001';b uuid:='b0000000-0000-0000-0000-000000000001';a uuid:=gen_random_uuid();sup uuid;i integer;
BEGIN
 IF NOT public.internal_checkout_qa_enabled_v5() OR NOT EXISTS(SELECT 1 FROM factory_qa.seed_runs WHERE name='factory-checkout-v5') THEN RAISE EXCEPTION 'QA marker and checkout seed required';END IF;
 IF EXISTS(SELECT 1 FROM factory_qa.seed_runs WHERE name='factory-purchase-v6') THEN RETURN jsonb_build_object('alreadySeeded',true);END IF;
 INSERT INTO financial_accounts("Id","TenantId","Code","Name","Type","IsActive","CreatedAtUtc") VALUES(a,t,'QA-PAYABLE','QA · Fornecedores a pagar',2,true,now());
 INSERT INTO factory_purchase_config_v6(tenant_id,branch_id,payable_account) VALUES(t,b,a);
 FOR i IN 1..5 LOOP sup:=gen_random_uuid();INSERT INTO parties("Id","TenantId","Type","Name","IsActive","Notes","CreatedAtUtc") VALUES(sup,t,1,'QA · Fornecedor Fábrica '||i,true,'Fornecedor fictício de homologação',now());INSERT INTO supplier_profiles("Id","TenantId","PartyId","SupplyCategories","PaymentTerms","LeadTimeDays","CreatedAtUtc") VALUES(gen_random_uuid(),t,sup,'Filamentos e acessórios','30 dias',3,now());END LOOP;
 INSERT INTO factory_qa.seed_runs(name,details) VALUES('factory-purchase-v6',jsonb_build_object('suppliers',5,'payableAccount',a,'commercial',false));
 RETURN jsonb_build_object('suppliers',5,'commercial',false);
END $function$;
SELECT factory_qa.seed_purchase_v6() AS result;
COMMIT;
