-- V16: cashback accounting foundation (activation gated) and stock-backed rewards.
CREATE TABLE public.loyalty_cashback_policy_v16(tenant_id uuid NOT NULL,branch_id uuid NOT NULL,enabled boolean NOT NULL DEFAULT false,enabled_since timestamptz,rate_bps integer NOT NULL CHECK(rate_bps BETWEEN 1 AND 10000),expense_account uuid NOT NULL,liability_account uuid NOT NULL,version integer NOT NULL CHECK(version>0),updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(tenant_id,branch_id),FOREIGN KEY(tenant_id,branch_id) REFERENCES public.branches("TenantId","Id"),CHECK(expense_account<>liability_account));

CREATE TABLE public.loyalty_cashback_accounts_v16(tenant_id uuid NOT NULL,branch_id uuid NOT NULL,party_id uuid NOT NULL,balance_cents bigint NOT NULL DEFAULT 0,PRIMARY KEY(tenant_id,branch_id,party_id),FOREIGN KEY(tenant_id,branch_id) REFERENCES public.branches("TenantId","Id"),FOREIGN KEY(tenant_id,party_id) REFERENCES public.parties("TenantId","Id"));

CREATE TABLE public.loyalty_cashback_ledger_v16(tenant_id uuid NOT NULL,branch_id uuid NOT NULL,id uuid NOT NULL DEFAULT gen_random_uuid(),party_id uuid NOT NULL,sale_id uuid NOT NULL,event_key text NOT NULL,kind text NOT NULL CHECK(kind IN('EARN','REVERSAL')),delta_cents bigint NOT NULL CHECK(delta_cents<>0),base_cents bigint NOT NULL CHECK(base_cents>0),rate_bps integer NOT NULL CHECK(rate_bps BETWEEN 1 AND 10000),expense_account uuid NOT NULL,liability_account uuid NOT NULL,journal_id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(tenant_id,event_key),UNIQUE(id),FOREIGN KEY(tenant_id,branch_id,party_id) REFERENCES public.loyalty_cashback_accounts_v16(tenant_id,branch_id,party_id),FOREIGN KEY(sale_id) REFERENCES public.sales("Id"),FOREIGN KEY(journal_id) REFERENCES public.financial_journal_entries("Id"),CHECK((kind='EARN' AND delta_cents>0) OR (kind='REVERSAL' AND delta_cents<0)));

CREATE INDEX ix_cashback_customer_v16 ON public.loyalty_cashback_ledger_v16(tenant_id,branch_id,party_id,created_at DESC);

CREATE TRIGGER tr_cashback_immutable_v16 BEFORE UPDATE OR DELETE ON public.loyalty_cashback_ledger_v16 FOR EACH ROW EXECUTE FUNCTION public.loyalty_ledger_immutable();

CREATE TABLE public.loyalty_stock_rewards_v16(tenant_id uuid NOT NULL,branch_id uuid NOT NULL,reward_id uuid NOT NULL,balance_id uuid NOT NULL,qty integer NOT NULL CHECK(qty BETWEEN 1 AND 1000),expense_account uuid NOT NULL,stock_account uuid NOT NULL,version integer NOT NULL CHECK(version>0),updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(tenant_id,branch_id,reward_id),FOREIGN KEY(tenant_id,branch_id) REFERENCES public.branches("TenantId","Id"),FOREIGN KEY(reward_id) REFERENCES public.loyalty_rewards("Id"),FOREIGN KEY(balance_id) REFERENCES public.stock_balances("Id"),CHECK(expense_account<>stock_account));

CREATE TABLE public.loyalty_stock_allocations_v16(tenant_id uuid NOT NULL,branch_id uuid NOT NULL,redemption_id uuid NOT NULL PRIMARY KEY,balance_id uuid NOT NULL,qty integer NOT NULL CHECK(qty>0),expense_account uuid NOT NULL,stock_account uuid NOT NULL,state text NOT NULL CHECK(state IN('RESERVED','FULFILLED','CANCELLED')),movement_id uuid,journal_id uuid,created_at timestamptz NOT NULL DEFAULT now(),FOREIGN KEY(tenant_id,branch_id) REFERENCES public.branches("TenantId","Id"),FOREIGN KEY(redemption_id) REFERENCES public.loyalty_redemptions("Id"),FOREIGN KEY(balance_id) REFERENCES public.stock_balances("Id"),FOREIGN KEY(movement_id) REFERENCES public.stock_movements("Id"),FOREIGN KEY(journal_id) REFERENCES public.financial_journal_entries("Id"));

CREATE OR REPLACE FUNCTION public.loyalty_financial_accounts_v16(t uuid,expense uuid,other uuid,other_type integer) RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$ BEGIN IF expense IS NULL OR other IS NULL OR expense=other OR NOT EXISTS(SELECT 1 FROM public.financial_accounts WHERE "TenantId"=t AND "Id"=expense AND "IsActive" AND "Type"=5) OR NOT EXISTS(SELECT 1 FROM public.financial_accounts WHERE "TenantId"=t AND "Id"=other AND "IsActive" AND "Type"=other_type) THEN RAISE EXCEPTION 'LOYALTY_ACCOUNT_CONFIG' USING ERRCODE='23514';END IF;END $fn$;

CREATE OR REPLACE FUNCTION public.loyalty_cashback_sale_v16(sid uuid) RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE s public.sales%ROWTYPE;c public.loyalty_cashback_policy_v16%ROWTYPE;e public.loyalty_cashback_ledger_v16%ROWTYPE;net bigint;paid bigint;credit bigint;refunded numeric;target bigint;already bigint;delta bigint;j uuid;eid uuid:=gen_random_uuid();actor uuid;
BEGIN
 SELECT * INTO s FROM public.sales WHERE "Id"=sid FOR UPDATE;IF NOT FOUND THEN RETURN;END IF;
 SELECT * INTO e FROM public.loyalty_cashback_ledger_v16 WHERE tenant_id=s."TenantId" AND event_key='EARN:'||sid::text;
 IF FOUND THEN
  IF s."Status" IN(6,8) OR s."PaymentStatus"=7 THEN target:=e.delta_cents;
  ELSE
   SELECT coalesce(sum(greatest(0,i."RefundAmount")),0)*100 INTO refunded FROM public.sale_returns r JOIN public.sale_return_items i ON i."TenantId"=r."TenantId" AND i."SaleReturnId"=r."Id" JOIN public.sale_items si ON si."TenantId"=i."TenantId" AND si."Id"=i."SaleItemId" AND si."SaleId"=sid WHERE r."TenantId"=s."TenantId" AND r."BranchId"=s."BranchId" AND r."SaleId"=sid AND r."Status"=2;
   target:=floor(e.delta_cents*least(1,refunded/e.base_cents))::bigint;
  END IF;
  PERFORM 1 FROM public.loyalty_cashback_accounts_v16 WHERE tenant_id=e.tenant_id AND branch_id=e.branch_id AND party_id=e.party_id FOR UPDATE;
  SELECT -coalesce(sum(delta_cents),0) INTO already FROM public.loyalty_cashback_ledger_v16 WHERE tenant_id=e.tenant_id AND sale_id=sid AND kind='REVERSAL';
  delta:=target-already;IF delta<=0 THEN RETURN;END IF;
  PERFORM public.loyalty_financial_accounts_v16(e.tenant_id,e.expense_account,e.liability_account,2);
  j:=public.internal_checkout_journal_v5(e.tenant_id,e.branch_id,s."CreatedByUserId",'LOYALTY_CASHBACK_REV',eid,s."SaleNumber",'Estorno proporcional do cashback',e.liability_account,e.expense_account,delta/100.0);
  INSERT INTO public.loyalty_cashback_ledger_v16(tenant_id,branch_id,id,party_id,sale_id,event_key,kind,delta_cents,base_cents,rate_bps,expense_account,liability_account,journal_id) VALUES(e.tenant_id,e.branch_id,eid,e.party_id,sid,'REV:'||sid||':'||target,'REVERSAL',-delta,e.base_cents,e.rate_bps,e.expense_account,e.liability_account,j);
  UPDATE public.loyalty_cashback_accounts_v16 SET balance_cents=balance_cents-delta WHERE tenant_id=e.tenant_id AND branch_id=e.branch_id AND party_id=e.party_id;RETURN;
 END IF;
 IF s."CustomerPartyId" IS NULL OR s."Status" NOT IN(4,5) OR s."PaymentStatus"<>4 OR s."ConfirmedAtUtc" IS NULL OR coalesce(s."IdempotencyKey",'') LIKE 'QA-CHECKOUT-%' OR coalesce(s."IdempotencyKey",'') LIKE 'TRAINING-%' THEN RETURN;END IF;
 SELECT * INTO c FROM public.loyalty_cashback_policy_v16 WHERE tenant_id=s."TenantId" AND branch_id=s."BranchId" AND enabled FOR SHARE;
 IF NOT FOUND OR c.enabled_since IS NULL OR s."ConfirmedAtUtc"<c.enabled_since THEN RETURN;END IF;
 IF NOT EXISTS(SELECT 1 FROM public.parties p JOIN public.customer_profiles cp ON cp."TenantId"=p."TenantId" AND cp."PartyId"=p."Id" WHERE p."TenantId"=s."TenantId" AND p."Id"=s."CustomerPartyId" AND p."IsActive") THEN RETURN;END IF;
 SELECT greatest(0,round((coalesce(sum(i."Quantity"*i."UnitPrice"-i."Discount"),0)-s."DiscountTotal"+s."ChargesTotal")*100)::bigint) INTO net FROM public.sale_items i WHERE i."TenantId"=s."TenantId" AND i."SaleId"=sid;
 SELECT round(coalesce(sum(p."Amount"),0)*100)::bigint INTO paid FROM public.sale_payment_intents p WHERE p."TenantId"=s."TenantId" AND p."SaleId"=sid AND p."Status"=2 AND p."ConfirmedAtUtc" IS NOT NULL;
 IF net<=0 OR paid<net THEN RETURN;END IF;
 credit:=floor(net::numeric*c.rate_bps/10000)::bigint;IF credit<=0 THEN RETURN;END IF;
 PERFORM public.loyalty_financial_accounts_v16(c.tenant_id,c.expense_account,c.liability_account,2);
 INSERT INTO public.loyalty_cashback_accounts_v16(tenant_id,branch_id,party_id) VALUES(c.tenant_id,c.branch_id,s."CustomerPartyId") ON CONFLICT DO NOTHING;
 PERFORM 1 FROM public.loyalty_cashback_accounts_v16 WHERE tenant_id=c.tenant_id AND branch_id=c.branch_id AND party_id=s."CustomerPartyId" FOR UPDATE;
 j:=public.internal_checkout_journal_v5(c.tenant_id,c.branch_id,s."CreatedByUserId",'LOYALTY_CASHBACK_EARN',eid,s."SaleNumber",'Crédito promocional de cashback',c.expense_account,c.liability_account,credit/100.0);
 INSERT INTO public.loyalty_cashback_ledger_v16(tenant_id,branch_id,id,party_id,sale_id,event_key,kind,delta_cents,base_cents,rate_bps,expense_account,liability_account,journal_id) VALUES(c.tenant_id,c.branch_id,eid,s."CustomerPartyId",sid,'EARN:'||sid,'EARN',credit,net,c.rate_bps,c.expense_account,c.liability_account,j);
 UPDATE public.loyalty_cashback_accounts_v16 SET balance_cents=balance_cents+credit WHERE tenant_id=c.tenant_id AND branch_id=c.branch_id AND party_id=s."CustomerPartyId";
END $fn$;

CREATE OR REPLACE FUNCTION public.loyalty_cashback_event_v16() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$ DECLARE sid uuid;BEGIN IF TG_TABLE_NAME='sales' THEN sid:=NEW."Id";ELSIF TG_TABLE_NAME='sale_return_items' THEN SELECT "SaleId" INTO sid FROM public.sale_returns WHERE "Id"=NEW."SaleReturnId" AND "TenantId"=NEW."TenantId";ELSE sid:=NEW."SaleId";END IF;IF sid IS NOT NULL THEN PERFORM public.loyalty_cashback_sale_v16(sid);END IF;RETURN NEW;END $fn$;

CREATE CONSTRAINT TRIGGER tr_cashback_sales_v16 AFTER INSERT OR UPDATE OF "Status","PaymentStatus","ConfirmedAtUtc","CustomerPartyId" ON public.sales DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.loyalty_cashback_event_v16();

CREATE CONSTRAINT TRIGGER tr_cashback_payments_v16 AFTER INSERT OR UPDATE OF "Status","ConfirmedAtUtc" ON public.sale_payment_intents DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.loyalty_cashback_event_v16();

CREATE CONSTRAINT TRIGGER tr_cashback_returns_v16 AFTER INSERT OR UPDATE OF "Status" ON public.sale_returns DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.loyalty_cashback_event_v16();

CREATE CONSTRAINT TRIGGER tr_cashback_return_items_v16 AFTER INSERT OR UPDATE ON public.sale_return_items DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.loyalty_cashback_event_v16();

CREATE OR REPLACE FUNCTION public.loyalty_command_v16(t uuid,b uuid,u uuid,req uuid,act text,p jsonb) RETURNS jsonb LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE perms text[];email text;old public.loyalty_commands_v15%ROWTYPE;c public.loyalty_cashback_policy_v16%ROWTYPE;mapping public.loyalty_stock_rewards_v16%ROWTYPE;a public.loyalty_stock_allocations_v16%ROWTYPE;sb public.stock_balances%ROWTYPE;rid uuid;bid uuid;ex uuid;oth uuid;v integer;rate integer;qty integer;enabled boolean;out jsonb;red uuid;mid uuid;j uuid;cost numeric;party uuid;
BEGIN
 SELECT x."Email" INTO email FROM public.users x JOIN public.branches z ON z."TenantId"=x."TenantId" AND z."Id"=b AND z."IsActive" WHERE x."TenantId"=t AND x."Id"=u AND x."DefaultBranchId"=b AND x."IsActive" AND EXISTS(SELECT 1 FROM public.partners partner WHERE partner."TenantId"=t AND lower(partner."Email")=lower(x."Email") AND partner."Status"=1 AND partner."IsErpAccessEnabled");
 IF NOT FOUND THEN RAISE EXCEPTION 'LOYALTY_FORBIDDEN' USING ERRCODE='42501';END IF;
 SELECT coalesce(array_agg(DISTINCT rp."PermissionKey"),ARRAY[]::text[]) INTO perms FROM public.user_roles ur JOIN public.role_permissions rp ON rp."TenantId"=ur."TenantId" AND rp."RoleId"=ur."RoleId" WHERE ur."TenantId"=t AND ur."UserId"=u;
 IF NOT(ARRAY['loyalty.view','customers.view']<@perms) OR (act IN('CASHBACK_POLICY','STOCK_REWARD') AND NOT(ARRAY['loyalty.manage','finance.reports.view','inventory.view']<@perms)) OR (act IN('RESERVE','CANCEL','FULFILL_GIFT') AND NOT('loyalty.redeem'=ANY(perms))) THEN RAISE EXCEPTION 'LOYALTY_FORBIDDEN' USING ERRCODE='42501';END IF;
 IF req IS NULL OR jsonb_typeof(p) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'LOYALTY_INVALID' USING ERRCODE='22023';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(t::text||':loyalty-command',0));
 SELECT * INTO old FROM public.loyalty_commands_v15 WHERE tenant_id=t AND request_id=req;
 IF FOUND THEN IF old.actor_id<>u OR old.branch_id<>b OR old.action<>act OR old.payload IS DISTINCT FROM p THEN RAISE EXCEPTION 'LOYALTY_CONFLICT' USING ERRCODE='23514';END IF;RETURN old.result;END IF;
 IF act='CASHBACK_POLICY' THEN
  v:=(p->>'version')::integer;rate:=(p->>'rateBps')::integer;enabled:=(p->>'enabled')::boolean;ex:=(p->>'expenseAccount')::uuid;oth:=(p->>'liabilityAccount')::uuid;
  IF enabled IS NULL OR rate IS NULL OR rate NOT BETWEEN 1 AND 10000 THEN RAISE EXCEPTION 'LOYALTY_INVALID' USING ERRCODE='22023';END IF;
  PERFORM public.loyalty_financial_accounts_v16(t,ex,oth,2);
  SELECT * INTO c FROM public.loyalty_cashback_policy_v16 WHERE tenant_id=t AND branch_id=b FOR UPDATE;
  IF coalesce(c.version,0) IS DISTINCT FROM v THEN RAISE EXCEPTION 'LOYALTY_STALE' USING ERRCODE='23514';END IF;
  -- Monetary redemption is not yet homologated. Persist only disabled policies.
  IF enabled THEN RAISE EXCEPTION 'CASHBACK_SETTLEMENT_NOT_READY' USING ERRCODE='23514';END IF;
  INSERT INTO public.loyalty_cashback_policy_v16(tenant_id,branch_id,enabled,enabled_since,rate_bps,expense_account,liability_account,version) VALUES(t,b,false,NULL,rate,ex,oth,v+1) ON CONFLICT(tenant_id,branch_id) DO UPDATE SET enabled=false,rate_bps=rate,expense_account=ex,liability_account=oth,version=v+1,updated_at=now();
  out:=jsonb_build_object('version',v+1,'enabled',false);
 ELSIF act='STOCK_REWARD' THEN
  rid:=(p->>'rewardId')::uuid;bid:=(p->>'balanceId')::uuid;qty:=(p->>'quantity')::integer;ex:=(p->>'expenseAccount')::uuid;oth:=(p->>'stockAccount')::uuid;v:=(p->>'version')::integer;
  IF qty IS NULL OR qty NOT BETWEEN 1 AND 1000 OR NOT EXISTS(SELECT 1 FROM public.loyalty_rewards WHERE "TenantId"=t AND "Id"=rid AND "Kind"='GIFT') THEN RAISE EXCEPTION 'LOYALTY_INVALID' USING ERRCODE='22023';END IF;
  PERFORM public.loyalty_financial_accounts_v16(t,ex,oth,1);
  IF NOT EXISTS(SELECT 1 FROM public.stock_balances x JOIN public.warehouses w ON w."TenantId"=x."TenantId" AND w."BranchId"=x."BranchId" AND w."Id"=x."WarehouseId" AND w."IsActive" JOIN public.product_skus k ON k."TenantId"=x."TenantId" AND k."Id"=x."ProductSkuId" AND k."IsActive" JOIN public.product_models m ON m."TenantId"=k."TenantId" AND m."Id"=k."ProductModelId" AND m."IsActive" AND m."Kind"=1 AND m."SerializationPolicy"=0 WHERE x."TenantId"=t AND x."BranchId"=b AND x."Id"=bid AND NOT EXISTS(SELECT 1 FROM public.manufacturing_material_balance_configs q WHERE q.tenant_id=t AND q.branch_id=b AND q.balance_id=bid)) THEN RAISE EXCEPTION 'LOYALTY_STOCK_INVALID' USING ERRCODE='23514';END IF;
  SELECT * INTO mapping FROM public.loyalty_stock_rewards_v16 WHERE tenant_id=t AND branch_id=b AND reward_id=rid FOR UPDATE;
  IF coalesce(mapping.version,0) IS DISTINCT FROM v THEN RAISE EXCEPTION 'LOYALTY_STALE' USING ERRCODE='23514';END IF;
  INSERT INTO public.loyalty_stock_rewards_v16(tenant_id,branch_id,reward_id,balance_id,qty,expense_account,stock_account,version) VALUES(t,b,rid,bid,qty,ex,oth,v+1) ON CONFLICT(tenant_id,branch_id,reward_id) DO UPDATE SET balance_id=excluded.balance_id,qty=excluded.qty,expense_account=excluded.expense_account,stock_account=excluded.stock_account,version=excluded.version,updated_at=now();
  out:=jsonb_build_object('id',rid,'version',v+1);
 ELSIF act='RESERVE' THEN
  rid:=(p->>'id')::uuid;
  SELECT * INTO mapping FROM public.loyalty_stock_rewards_v16 WHERE tenant_id=t AND branch_id=b AND reward_id=rid;
  IF NOT FOUND THEN
   IF EXISTS(SELECT 1 FROM public.loyalty_stock_rewards_v16 WHERE tenant_id=t AND reward_id=rid) THEN RAISE EXCEPTION 'LOYALTY_STOCK_BRANCH' USING ERRCODE='23514';END IF;
   RETURN public.loyalty_command_v15(t,b,u,req,act,p);
  END IF;
  PERFORM public.loyalty_financial_accounts_v16(t,mapping.expense_account,mapping.stock_account,1);
  SELECT * INTO sb FROM public.stock_balances WHERE "TenantId"=t AND "BranchId"=b AND "Id"=mapping.balance_id FOR UPDATE;
  IF NOT FOUND OR sb."OnHandQuantity"-sb."ReservedQuantity"-sb."BlockedQuantity"<mapping.qty OR sb."AverageCost"<=0 OR NOT EXISTS(SELECT 1 FROM public.warehouses WHERE "TenantId"=t AND "BranchId"=b AND "Id"=sb."WarehouseId" AND "IsActive") THEN RAISE EXCEPTION 'LOYALTY_STOCK_UNAVAILABLE' USING ERRCODE='23514';END IF;
  out:=public.loyalty_command_v15(t,b,u,req,act,p);red:=(out->>'id')::uuid;
  UPDATE public.stock_balances SET "ReservedQuantity"="ReservedQuantity"+mapping.qty,"UpdatedAtUtc"=now() WHERE "TenantId"=t AND "BranchId"=b AND "Id"=sb."Id";
  INSERT INTO public.loyalty_stock_allocations_v16(tenant_id,branch_id,redemption_id,balance_id,qty,expense_account,stock_account,state) VALUES(t,b,red,sb."Id",mapping.qty,mapping.expense_account,mapping.stock_account,'RESERVED');RETURN out;
 ELSIF act IN('CANCEL','FULFILL_GIFT') THEN
  red:=(p->>'id')::uuid;
  SELECT * INTO a FROM public.loyalty_stock_allocations_v16 WHERE tenant_id=t AND redemption_id=red FOR UPDATE;
  IF NOT FOUND THEN RETURN public.loyalty_command_v15(t,b,u,req,act,p);END IF;
  IF a.branch_id<>b OR a.state<>'RESERVED' THEN RAISE EXCEPTION 'LOYALTY_STOCK_BRANCH' USING ERRCODE='23514';END IF;
  SELECT * INTO sb FROM public.stock_balances WHERE "TenantId"=t AND "BranchId"=b AND "Id"=a.balance_id FOR UPDATE;
  IF NOT FOUND OR sb."ReservedQuantity"<a.qty OR (act='FULFILL_GIFT' AND (sb."OnHandQuantity"-sb."BlockedQuantity"<a.qty OR sb."AverageCost"<=0)) THEN RAISE EXCEPTION 'LOYALTY_STOCK_UNAVAILABLE' USING ERRCODE='23514';END IF;
  out:=public.loyalty_command_v15(t,b,u,req,act,p);
  IF act='CANCEL' THEN
   UPDATE public.stock_balances SET "ReservedQuantity"="ReservedQuantity"-a.qty,"UpdatedAtUtc"=now() WHERE "TenantId"=t AND "BranchId"=b AND "Id"=sb."Id";
   UPDATE public.loyalty_stock_allocations_v16 SET state='CANCELLED' WHERE redemption_id=red;
  ELSE
   PERFORM public.loyalty_financial_accounts_v16(t,a.expense_account,a.stock_account,1);
   cost:=round(sb."AverageCost"*a.qty,2);IF cost<=0 THEN RAISE EXCEPTION 'LOYALTY_STOCK_UNAVAILABLE' USING ERRCODE='23514';END IF;
   mid:=gen_random_uuid();
   UPDATE public.stock_balances SET "ReservedQuantity"="ReservedQuantity"-a.qty,"OnHandQuantity"="OnHandQuantity"-a.qty,"LastMovementAtUtc"=now(),"UpdatedAtUtc"=now() WHERE "TenantId"=t AND "BranchId"=b AND "Id"=sb."Id";
   INSERT INTO public.stock_movements("Id","TenantId","BranchId","WarehouseId","WarehouseLocationId","ProductSkuId","MovementType","Quantity","UnitCost","TotalCost","BalanceAfterQuantity","DocumentReference","Reason","CorrelationId","IdempotencyKey","CreatedByUserId","CreatedAtUtc") VALUES(mid,t,b,sb."WarehouseId",sb."WarehouseLocationId",sb."ProductSkuId",12,-a.qty,sb."AverageCost",cost,sb."OnHandQuantity"-a.qty,'BRINDE-'||red::text,'Entrega de recompensa de fidelidade',red,'LOYALTY-GIFT-'||red::text,u,now());
   j:=public.internal_checkout_journal_v5(t,b,u,'LOYALTY_GIFT',red,'BRINDE-'||red::text,'Custo de recompensa entregue',a.expense_account,a.stock_account,cost);
   UPDATE public.loyalty_stock_allocations_v16 SET state='FULFILLED',movement_id=mid,journal_id=j WHERE redemption_id=red;
  END IF;RETURN out;
 ELSE RETURN public.loyalty_command_v15(t,b,u,req,act,p);
 END IF;
 INSERT INTO public.loyalty_commands_v15(tenant_id,branch_id,request_id,actor_id,action,payload,result) VALUES(t,b,req,u,act,p,out);
 INSERT INTO public.audit_events("Id","TenantId","BranchId","EntityType","EntityId","Action","ActorId","ActorEmail","CorrelationId","AfterStateJson","CreatedAtUtc","Version") VALUES(gen_random_uuid(),t,b,'Loyalty',req::text,act,u,email,req::text,out,now(),1);
 RETURN out;
END $fn$;
