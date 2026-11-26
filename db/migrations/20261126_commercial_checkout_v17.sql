-- V17: restricted commercial cash checkout candidate; no automatic production activation.
CREATE TABLE public.commercial_checkout_config_v17(tenant_id uuid NOT NULL,branch_id uuid NOT NULL,enabled boolean NOT NULL DEFAULT false,cash_account uuid NOT NULL,revenue_account uuid NOT NULL,stock_account uuid NOT NULL,cogs_account uuid NOT NULL,version integer NOT NULL CHECK(version>0),updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(tenant_id,branch_id),FOREIGN KEY(tenant_id,branch_id) REFERENCES public.branches("TenantId","Id"));

CREATE TABLE public.commercial_checkout_records_v17(tenant_id uuid NOT NULL,branch_id uuid NOT NULL,sale_id uuid PRIMARY KEY,request_id uuid NOT NULL,actor_id uuid NOT NULL,shift_id uuid NOT NULL,party_id uuid NOT NULL,policy_id uuid NOT NULL,policy_snapshot jsonb NOT NULL,payload jsonb NOT NULL,total_cents bigint NOT NULL CHECK(total_cents>0),discount_cents bigint NOT NULL CHECK(discount_cents>=0),cashback_cents bigint NOT NULL CHECK(cashback_cents>=0),payment_id uuid NOT NULL,cash_movement_id uuid NOT NULL,revenue_journal uuid NOT NULL,cogs_journal uuid NOT NULL,stock_cost numeric NOT NULL CHECK(stock_cost>0),state text NOT NULL CHECK(state IN('REGISTERED','DELIVERED','CANCELLED')),created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(tenant_id,branch_id,request_id),FOREIGN KEY(tenant_id,branch_id) REFERENCES public.branches("TenantId","Id"),FOREIGN KEY(tenant_id,actor_id) REFERENCES public.users("TenantId","Id"),FOREIGN KEY(tenant_id,party_id) REFERENCES public.parties("TenantId","Id"),FOREIGN KEY(sale_id) REFERENCES public.sales("Id"),FOREIGN KEY(policy_id) REFERENCES public.fiscal_receipt_exemption_policies("Id"));

CREATE TABLE public.commercial_checkout_lines_v17(sale_id uuid NOT NULL,sale_item_id uuid PRIMARY KEY,balance_id uuid NOT NULL,quantity integer NOT NULL CHECK(quantity>0),unit_cost numeric NOT NULL CHECK(unit_cost>0),cost numeric NOT NULL CHECK(cost>0),FOREIGN KEY(sale_id) REFERENCES public.commercial_checkout_records_v17(sale_id) DEFERRABLE INITIALLY DEFERRED,FOREIGN KEY(sale_item_id) REFERENCES public.sale_items("Id"),FOREIGN KEY(balance_id) REFERENCES public.stock_balances("Id"));

CREATE TABLE public.commercial_checkout_actions_v17(tenant_id uuid NOT NULL,branch_id uuid NOT NULL,request_id uuid NOT NULL,actor_id uuid NOT NULL,sale_id uuid NOT NULL,payload jsonb NOT NULL,result jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(tenant_id,branch_id,request_id),FOREIGN KEY(sale_id) REFERENCES public.commercial_checkout_records_v17(sale_id));

CREATE TRIGGER tr_commercial_actions_immutable_v17 BEFORE UPDATE OR DELETE ON public.commercial_checkout_actions_v17 FOR EACH ROW EXECUTE FUNCTION public.loyalty_ledger_immutable();

CREATE TABLE public.commercial_cashback_events_v17(tenant_id uuid NOT NULL,branch_id uuid NOT NULL,party_id uuid NOT NULL,sale_id uuid NOT NULL,kind text NOT NULL CHECK(kind IN('SPEND','REFUND')),delta_cents bigint NOT NULL,journal_id uuid NOT NULL,expense_account uuid NOT NULL,liability_account uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(sale_id,kind),FOREIGN KEY(tenant_id,branch_id,party_id) REFERENCES public.loyalty_cashback_accounts_v16(tenant_id,branch_id,party_id),FOREIGN KEY(sale_id) REFERENCES public.sales("Id"),FOREIGN KEY(journal_id) REFERENCES public.financial_journal_entries("Id"),CHECK((kind='SPEND' AND delta_cents<0) OR (kind='REFUND' AND delta_cents>0)));

CREATE TRIGGER tr_cashback_use_immutable_v17 BEFORE UPDATE OR DELETE ON public.commercial_cashback_events_v17 FOR EACH ROW EXECUTE FUNCTION public.loyalty_ledger_immutable();

CREATE OR REPLACE FUNCTION public.commercial_checkout_authorize_v17(t uuid,b uuid,u uuid,perm text) RETURNS text[] LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE perms text[];BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.users x JOIN public.branches z ON z."TenantId"=x."TenantId" AND z."Id"=b AND z."IsActive" WHERE x."TenantId"=t AND x."Id"=u AND x."DefaultBranchId"=b AND x."IsActive" AND EXISTS(SELECT 1 FROM public.partners q WHERE q."TenantId"=t AND lower(q."Email")=lower(x."Email") AND q."Status"=1 AND q."IsErpAccessEnabled")) THEN RAISE EXCEPTION 'COMMERCIAL_FORBIDDEN' USING ERRCODE='42501';END IF;
 SELECT coalesce(array_agg(DISTINCT rp."PermissionKey"),ARRAY[]::text[]) INTO perms FROM public.user_roles ur JOIN public.role_permissions rp ON rp."TenantId"=ur."TenantId" AND rp."RoleId"=ur."RoleId" WHERE ur."TenantId"=t AND ur."UserId"=u;
 IF NOT(ARRAY['sales.pos.use',perm]<@perms) THEN RAISE EXCEPTION 'COMMERCIAL_FORBIDDEN' USING ERRCODE='42501';END IF;RETURN perms;END $fn$;

CREATE OR REPLACE FUNCTION public.commercial_cpf_valid_v17(s text) RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog,public AS $fn$
DECLARE d text:=regexp_replace(coalesce(s,''),'[^0-9]','','g');i integer;n integer;v integer;BEGIN IF d!~'^[0-9]{11}$' OR d=repeat(left(d,1),11) THEN RETURN false;END IF;FOR n IN 9..10 LOOP v:=0;FOR i IN 1..n LOOP v:=v+substring(d,i,1)::integer*(n+2-i);END LOOP;v:=mod(v*10,11);IF v=10 THEN v:=0;END IF;IF v<>substring(d,n+1,1)::integer THEN RETURN false;END IF;END LOOP;RETURN true;END $fn$;

CREATE OR REPLACE FUNCTION public.commercial_exemption_v17(t uuid,b uuid,party uuid) RETURNS public.fiscal_receipt_exemption_policies LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE r public.fiscal_receipt_exemption_policies%ROWTYPE;BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.parties p JOIN public.customer_profiles c ON c."TenantId"=p."TenantId" AND c."PartyId"=p."Id" WHERE p."TenantId"=t AND p."Id"=party AND p."IsActive" AND p."Type"=1 AND public.commercial_cpf_valid_v17(p."DocumentNumber")) THEN RAISE EXCEPTION 'COMMERCIAL_FISCAL_REQUIRED' USING ERRCODE='23514';END IF;
 IF (SELECT count(*) FROM public.fiscal_establishments f WHERE f."TenantId"=t AND f."BranchId"=b AND f."IsActive")<>1 THEN RAISE EXCEPTION 'COMMERCIAL_FISCAL_REQUIRED' USING ERRCODE='23514';END IF;
 SELECT p.* INTO r FROM public.fiscal_receipt_exemption_policies p JOIN public.fiscal_establishments f ON f."TenantId"=p."TenantId" AND f."BranchId"=p."BranchId" AND f."Id"=p."FiscalEstablishmentId" WHERE p."TenantId"=t AND p."BranchId"=b AND p."IsActive" AND p."Regime"=4 AND p."BuyerType"='PF' AND p."OperationType"='LOCAL_GOODS' AND p."ApprovedAtUtc"<=now() AND now()>=p."ValidFromUtc" AND now()<p."ValidUntilUtc" AND length(btrim(p."ApprovalReference"))>0 AND length(btrim(p."LegalBasis"))>0 AND f."IsActive" AND f."Regime"=4 AND f."State"='SP' ORDER BY p."ApprovedAtUtc" DESC,p."Id" LIMIT 1 FOR SHARE OF p,f;
 IF NOT FOUND THEN RAISE EXCEPTION 'COMMERCIAL_FISCAL_REQUIRED' USING ERRCODE='23514';END IF;RETURN r;END $fn$;

CREATE OR REPLACE FUNCTION public.commercial_config_v17(t uuid,b uuid) RETURNS public.commercial_checkout_config_v17 LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE c public.commercial_checkout_config_v17%ROWTYPE;BEGIN SELECT * INTO c FROM public.commercial_checkout_config_v17 WHERE tenant_id=t AND branch_id=b AND enabled FOR SHARE;
 IF NOT FOUND OR (SELECT count(DISTINCT x) FROM unnest(ARRAY[c.cash_account,c.revenue_account,c.stock_account,c.cogs_account]) x)<>4 OR EXISTS(SELECT 1 FROM (VALUES(c.cash_account,1),(c.revenue_account,4),(c.stock_account,1),(c.cogs_account,5)) z(id,typ) WHERE NOT EXISTS(SELECT 1 FROM public.financial_accounts a WHERE a."TenantId"=t AND a."Id"=z.id AND a."Type"=z.typ AND a."IsActive")) THEN RAISE EXCEPTION 'COMMERCIAL_CONFIG_NOT_READY' USING ERRCODE='23514';END IF;RETURN c;END $fn$;

CREATE OR REPLACE FUNCTION public.commercial_checkout_cash_v17(t uuid,b uuid,u uuid,req uuid,p jsonb) RETURNS jsonb LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE perms text[];cfg public.commercial_checkout_config_v17%ROWTYPE;prior public.commercial_checkout_records_v17%ROWTYPE;pol public.fiscal_receipt_exemption_policies%ROWTYPE;cb public.loyalty_cashback_policy_v16%ROWTYPE;sh public.cash_shifts%ROWTYPE;sb public.stock_balances%ROWTYPE;party uuid;shift uuid;sid uuid:=gen_random_uuid();pid uuid:=gen_random_uuid();mid uuid:=gen_random_uuid();iid uuid;rev uuid;cogs uuid;j uuid;item jsonb;line jsonb;lines jsonb:='[]';qty integer;bid uuid;sku uuid;code text;descr text;price numeric;unitcost numeric;cost numeric;stockcost numeric:=0;gross bigint:=0;discount bigint;cashback bigint;total bigint;expected bigint;tendered bigint;available bigint;number text;out jsonb;
BEGIN
 perms:=public.commercial_checkout_authorize_v17(t,b,u,'sales.create');
 IF req IS NULL OR jsonb_typeof(p) IS DISTINCT FROM 'object' OR p->'cashConfirmed' IS DISTINCT FROM 'true'::jsonb OR p->'fiscalRequested' IS DISTINCT FROM 'false'::jsonb OR p->>'operationType' IS DISTINCT FROM 'LOCAL_GOODS' THEN RAISE EXCEPTION 'COMMERCIAL_INVALID' USING ERRCODE='22023';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(t::text||b::text||req::text,17));
 SELECT * INTO prior FROM public.commercial_checkout_records_v17 WHERE tenant_id=t AND branch_id=b AND request_id=req;
 IF FOUND THEN IF prior.actor_id<>u OR prior.payload IS DISTINCT FROM p THEN RAISE EXCEPTION 'COMMERCIAL_CONFLICT' USING ERRCODE='23514';END IF;RETURN jsonb_build_object('saleId',prior.sale_id,'totalCents',prior.total_cents,'state',prior.state,'replayed',true);END IF;
 cfg:=public.commercial_config_v17(t,b);
 party:=(p->>'customerId')::uuid;shift:=(p->>'shiftId')::uuid;
 pol:=public.commercial_exemption_v17(t,b,party);
 discount:=(p->>'discountCents')::bigint;cashback:=(p->>'cashbackCents')::bigint;expected:=(p->>'expectedTotalCents')::bigint;tendered:=(p->>'tenderedCents')::bigint;
 IF discount IS NULL OR cashback IS NULL OR expected IS NULL OR tendered IS NULL OR discount NOT BETWEEN 0 AND 100000000 OR cashback NOT BETWEEN 0 AND 100000000 OR expected NOT BETWEEN 1 AND 100000000 OR tendered NOT BETWEEN 1 AND 100000000 OR (discount>0 AND NOT('sales.discount.override'=ANY(perms))) OR (cashback>0 AND NOT('loyalty.redeem'=ANY(perms))) THEN RAISE EXCEPTION 'COMMERCIAL_INVALID' USING ERRCODE='22023';END IF;
 SELECT * INTO sh FROM public.cash_shifts WHERE "TenantId"=t AND "BranchId"=b AND "Id"=shift FOR UPDATE;
 IF NOT FOUND OR sh."Status"<>1 OR sh."OperatorUserId"<>u OR NOT EXISTS(SELECT 1 FROM public.cash_registers r WHERE r."TenantId"=t AND r."BranchId"=b AND r."Id"=sh."CashRegisterId" AND r."Status"=1) THEN RAISE EXCEPTION 'COMMERCIAL_SHIFT_REQUIRED' USING ERRCODE='23514';END IF;
 IF jsonb_typeof(p->'items') IS DISTINCT FROM 'array' OR jsonb_array_length(p->'items') NOT BETWEEN 1 AND 100 OR EXISTS(SELECT 1 FROM jsonb_array_elements(p->'items') x GROUP BY x->>'balanceId' HAVING count(*)>1) THEN RAISE EXCEPTION 'COMMERCIAL_INVALID' USING ERRCODE='22023';END IF;
 FOR item IN SELECT x FROM jsonb_array_elements(p->'items') x ORDER BY (x->>'balanceId')::uuid LOOP
  bid:=(item->>'balanceId')::uuid;qty:=(item->>'quantity')::integer;IF qty IS NULL OR qty NOT BETWEEN 1 AND 100000 THEN RAISE EXCEPTION 'COMMERCIAL_INVALID' USING ERRCODE='22023';END IF;
  SELECT * INTO sb FROM public.stock_balances WHERE "TenantId"=t AND "BranchId"=b AND "Id"=bid FOR UPDATE;
  IF NOT FOUND OR sb."OnHandQuantity"-sb."ReservedQuantity"-sb."BlockedQuantity"<qty OR sb."AverageCost"<=0 OR NOT EXISTS(SELECT 1 FROM public.warehouses w WHERE w."TenantId"=t AND w."BranchId"=b AND w."Id"=sb."WarehouseId" AND w."IsActive") OR EXISTS(SELECT 1 FROM public.manufacturing_material_balance_configs m WHERE m.tenant_id=t AND m.branch_id=b AND m.balance_id=bid) THEN RAISE EXCEPTION 'COMMERCIAL_STOCK_UNAVAILABLE' USING ERRCODE='23514';END IF;
  SELECT k."Id",k."SkuCode",left(concat_ws(' · ',m."Name",k."VariantName"),300),k."DefaultPrice" INTO sku,code,descr,price FROM public.product_skus k JOIN public.product_models m ON m."TenantId"=k."TenantId" AND m."Id"=k."ProductModelId" WHERE k."TenantId"=t AND k."Id"=sb."ProductSkuId" AND k."IsActive" AND m."IsActive" AND m."Kind"=1 AND m."SerializationPolicy"=0;
  IF NOT FOUND OR price<=0 OR price<>round(price,2) OR (item->>'unitPriceCents')::bigint IS DISTINCT FROM round(price*100)::bigint THEN RAISE EXCEPTION 'COMMERCIAL_PRICE_OR_SKU' USING ERRCODE='23514';END IF;
  unitcost:=sb."AverageCost";cost:=round(qty*unitcost,2);IF cost<=0 THEN RAISE EXCEPTION 'COMMERCIAL_STOCK_UNAVAILABLE' USING ERRCODE='23514';END IF;
  gross:=gross+round(qty*price*100)::bigint;stockcost:=stockcost+cost;
  lines:=lines||jsonb_build_array(jsonb_build_object('balance',bid,'sku',sku,'code',code,'description',descr,'quantity',qty,'price',price,'unitCost',unitcost,'cost',cost));
 END LOOP;
 total:=gross-discount-cashback;IF total<=0 OR total<>expected OR tendered<total THEN RAISE EXCEPTION 'COMMERCIAL_TOTAL_CONFLICT' USING ERRCODE='23514';END IF;
 IF cashback>0 THEN
  SELECT * INTO cb FROM public.loyalty_cashback_policy_v16 WHERE tenant_id=t AND branch_id=b AND enabled FOR SHARE;
  IF NOT FOUND OR cb.enabled_since IS NULL THEN RAISE EXCEPTION 'COMMERCIAL_CASHBACK_NOT_READY' USING ERRCODE='23514';END IF;
  PERFORM public.loyalty_financial_accounts_v16(t,cb.expense_account,cb.liability_account,2);
  SELECT balance_cents INTO available FROM public.loyalty_cashback_accounts_v16 WHERE tenant_id=t AND branch_id=b AND party_id=party FOR UPDATE;
  IF NOT FOUND OR available<cashback OR EXISTS(SELECT 1 FROM public.loyalty_cashback_ledger_v16 l WHERE l.tenant_id=t AND l.branch_id=b AND l.party_id=party AND (l.expense_account<>cb.expense_account OR l.liability_account<>cb.liability_account)) THEN RAISE EXCEPTION 'COMMERCIAL_CASHBACK_CONFLICT' USING ERRCODE='23514';END IF;
 END IF;
 number:='VD-'||upper(replace(sid::text,'-',''));
 INSERT INTO public.sales("Id","TenantId","BranchId","SaleNumber","CustomerPartyId","SellerUserId","CreatedByUserId","Status","PaymentStatus","FulfillmentStatus","DiscountTotal","ChargesTotal","Observations","IdempotencyKey","CreatedAtUtc") VALUES(sid,t,b,number,party,u,u,1,1,1,(discount+cashback)/100.0,0,'Venda comercial em dinheiro; comprovante interno somente por política fiscal vigente.','COMMERCIAL-'||req::text,now());
 FOR line IN SELECT x FROM jsonb_array_elements(lines) x LOOP
  iid:=gen_random_uuid();bid:=(line->>'balance')::uuid;qty:=(line->>'quantity')::integer;
  SELECT * INTO sb FROM public.stock_balances WHERE "TenantId"=t AND "BranchId"=b AND "Id"=bid FOR UPDATE;
  INSERT INTO public.sale_items("Id","TenantId","SaleId","ProductSkuId","HistoricalSkuCode","HistoricalDescription","ItemCondition","Quantity","UnitPrice","Discount","HistoricalUnitCost","WarrantyDays","CreatedAtUtc") VALUES(iid,t,sid,(line->>'sku')::uuid,line->>'code',line->>'description',1,qty,(line->>'price')::numeric,0,(line->>'unitCost')::numeric,0,now());
  UPDATE public.stock_balances SET "OnHandQuantity"="OnHandQuantity"-qty,"LastMovementAtUtc"=now(),"UpdatedAtUtc"=now() WHERE "TenantId"=t AND "BranchId"=b AND "Id"=bid;
  INSERT INTO public.stock_movements("Id","TenantId","BranchId","WarehouseId","WarehouseLocationId","ProductSkuId","MovementType","Quantity","UnitCost","TotalCost","BalanceAfterQuantity","DocumentReference","Reason","CorrelationId","IdempotencyKey","CreatedByUserId","CreatedAtUtc") VALUES(gen_random_uuid(),t,b,sb."WarehouseId",sb."WarehouseLocationId",sb."ProductSkuId",4,-qty,(line->>'unitCost')::numeric,(line->>'cost')::numeric,sb."OnHandQuantity"-qty,number,'Venda comercial',sid,'COMMERCIAL-OUT-'||iid::text,u,now());
  INSERT INTO public.commercial_checkout_lines_v17(sale_id,sale_item_id,balance_id,quantity,unit_cost,cost) VALUES(sid,iid,bid,qty,(line->>'unitCost')::numeric,(line->>'cost')::numeric);
 END LOOP;
 INSERT INTO public.sale_payment_intents("Id","TenantId","SaleId","Method","Amount","Installments","Status","AuthorizationCode","Notes","ConfirmedAtUtc","CreatedAtUtc") VALUES(pid,t,sid,1,total/100.0,1,2,'OPERATOR-CASH','Recebimento físico confirmado pelo operador',now(),now());
 INSERT INTO public.cash_movements("Id","TenantId","BranchId","CashRegisterId","CashShiftId","MovementType","Direction","Amount","SourceType","SourceId","DocumentReference","Reason","CreatedByUserId","CorrelationId","IdempotencyKey","CreatedAtUtc") VALUES(mid,t,b,sh."CashRegisterId",shift,2,1,total/100.0,'SALE_PAYMENT',pid::text,number,'Recebimento comercial em dinheiro',u,sid::text,'COMMERCIAL-CASH-'||sid::text,now());
 UPDATE public.cash_shifts SET "CurrentBalance"="CurrentBalance"+total/100.0,"TotalCashIn"="TotalCashIn"+total/100.0,"UpdatedAtUtc"=now() WHERE "TenantId"=t AND "BranchId"=b AND "Id"=shift;
 rev:=public.internal_checkout_journal_v5(t,b,u,'COMMERCIAL_REVENUE',sid,number,'Receita comercial líquida de descontos',cfg.cash_account,cfg.revenue_account,total/100.0);
 cogs:=public.internal_checkout_journal_v5(t,b,u,'COMMERCIAL_COGS',sid,number,'Custo das mercadorias vendidas',cfg.cogs_account,cfg.stock_account,stockcost);
 IF cashback>0 THEN
  j:=public.internal_checkout_journal_v5(t,b,u,'LOYALTY_CASHBACK_SPEND',sid,number,'Utilização de obrigação promocional',cb.liability_account,cb.expense_account,cashback/100.0);
  INSERT INTO public.commercial_cashback_events_v17(tenant_id,branch_id,party_id,sale_id,kind,delta_cents,journal_id,expense_account,liability_account) VALUES(t,b,party,sid,'SPEND',-cashback,j,cb.expense_account,cb.liability_account);
  UPDATE public.loyalty_cashback_accounts_v16 SET balance_cents=balance_cents-cashback WHERE tenant_id=t AND branch_id=b AND party_id=party;
 END IF;
 INSERT INTO public.commercial_checkout_records_v17(tenant_id,branch_id,sale_id,request_id,actor_id,shift_id,party_id,policy_id,policy_snapshot,payload,total_cents,discount_cents,cashback_cents,payment_id,cash_movement_id,revenue_journal,cogs_journal,stock_cost,state) VALUES(t,b,sid,req,u,shift,party,pol."Id",jsonb_build_object('reference',pol."ApprovalReference",'basis',pol."LegalBasis",'validUntil',pol."ValidUntilUtc",'approvedAt',pol."ApprovedAtUtc"),p,total,discount,cashback,pid,mid,rev,cogs,stockcost,'REGISTERED');
 UPDATE public.customer_profiles SET "TotalSalesValue"="TotalSalesValue"+total/100.0,"UpdatedAtUtc"=now() WHERE "TenantId"=t AND "PartyId"=party;
 PERFORM set_config('hbstudio.commercial_command',sid::text,true);
 UPDATE public.sales SET "Status"=4,"PaymentStatus"=4,"FulfillmentStatus"=2,"ConfirmedAtUtc"=now(),"UpdatedAtUtc"=now() WHERE "TenantId"=t AND "BranchId"=b AND "Id"=sid;
 out:=jsonb_build_object('saleId',sid,'number',number,'totalCents',total,'changeCents',tendered-total,'state','REGISTERED','fiscalIssued',false,'replayed',false);
 INSERT INTO public.audit_events("Id","TenantId","BranchId","EntityType","EntityId","Action","ActorId","ActorEmail","CorrelationId","AfterStateJson","CreatedAtUtc","Version") SELECT gen_random_uuid(),t,b,'CommercialCheckout',sid::text,'CashRegistered',u,x."Email",req::text,out,now(),1 FROM public.users x WHERE x."Id"=u AND x."TenantId"=t;
 RETURN out;
END $fn$;

CREATE OR REPLACE FUNCTION public.commercial_checkout_action_v17(t uuid,b uuid,u uuid,req uuid,p jsonb) RETURNS jsonb LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE a public.commercial_checkout_actions_v17%ROWTYPE;c public.commercial_checkout_records_v17%ROWTYPE;s public.sales%ROWTYPE;sh public.cash_shifts%ROWTYPE;sb public.stock_balances%ROWTYPE;sl public.commercial_checkout_lines_v17%ROWTYPE;cb public.commercial_cashback_events_v17%ROWTYPE;sid uuid;act text;reason text;out jsonb;j uuid;
BEGIN
 act:=p->>'action';sid:=(p->>'saleId')::uuid;IF req IS NULL OR sid IS NULL OR act IS NULL OR act NOT IN('DELIVER','CANCEL') THEN RAISE EXCEPTION 'COMMERCIAL_INVALID' USING ERRCODE='22023';END IF;
 PERFORM public.commercial_checkout_authorize_v17(t,b,u,CASE WHEN act='CANCEL' THEN 'sales.cancel' ELSE 'sales.create' END);
 PERFORM pg_advisory_xact_lock(hashtextextended(t::text||b::text||req::text,17));
 SELECT * INTO a FROM public.commercial_checkout_actions_v17 WHERE tenant_id=t AND branch_id=b AND request_id=req;
 IF FOUND THEN IF a.actor_id<>u OR a.payload IS DISTINCT FROM p THEN RAISE EXCEPTION 'COMMERCIAL_CONFLICT' USING ERRCODE='23514';END IF;RETURN a.result;END IF;
 SELECT * INTO c FROM public.commercial_checkout_records_v17 WHERE tenant_id=t AND branch_id=b AND sale_id=sid FOR UPDATE;
 IF NOT FOUND OR c.state<>'REGISTERED' THEN RAISE EXCEPTION 'COMMERCIAL_STATE_CONFLICT' USING ERRCODE='23514';END IF;
 SELECT * INTO s FROM public.sales WHERE "TenantId"=t AND "BranchId"=b AND "Id"=sid FOR UPDATE;
 IF NOT FOUND OR s."Status"<>4 OR s."PaymentStatus"<>4 OR s."FulfillmentStatus"<>2 THEN RAISE EXCEPTION 'COMMERCIAL_STATE_CONFLICT' USING ERRCODE='23514';END IF;
 PERFORM set_config('hbstudio.commercial_command',sid::text,true);
 IF act='DELIVER' THEN
  UPDATE public.sales SET "Status"=5,"FulfillmentStatus"=3,"FulfilledAtUtc"=now(),"UpdatedAtUtc"=now() WHERE "TenantId"=t AND "Id"=sid;
  UPDATE public.commercial_checkout_records_v17 SET state='DELIVERED' WHERE sale_id=sid;
 ELSE
  reason:=btrim(p->>'reason');IF reason IS NULL OR length(reason) NOT BETWEEN 10 AND 500 OR p->'cashReturned' IS DISTINCT FROM 'true'::jsonb OR p->'goodsRetained' IS DISTINCT FROM 'true'::jsonb OR c.actor_id<>u OR EXISTS(SELECT 1 FROM public.fiscal_documents WHERE "TenantId"=t AND "SaleId"=sid) OR EXISTS(SELECT 1 FROM public.sale_returns WHERE "TenantId"=t AND "SaleId"=sid) THEN RAISE EXCEPTION 'COMMERCIAL_CANCEL_CONFLICT' USING ERRCODE='23514';END IF;
  SELECT * INTO sh FROM public.cash_shifts WHERE "TenantId"=t AND "BranchId"=b AND "Id"=c.shift_id FOR UPDATE;
  IF NOT FOUND OR sh."Status"<>1 OR sh."OperatorUserId"<>u OR sh."CurrentBalance"<c.total_cents/100.0 THEN RAISE EXCEPTION 'COMMERCIAL_SHIFT_REQUIRED' USING ERRCODE='23514';END IF;
  FOR sl IN SELECT * FROM public.commercial_checkout_lines_v17 WHERE sale_id=sid ORDER BY balance_id LOOP
   SELECT * INTO sb FROM public.stock_balances WHERE "TenantId"=t AND "BranchId"=b AND "Id"=sl.balance_id FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'COMMERCIAL_STOCK_UNAVAILABLE' USING ERRCODE='23514';END IF;
   UPDATE public.stock_balances SET "AverageCost"=round(("OnHandQuantity"*"AverageCost"+sl.cost)/("OnHandQuantity"+sl.quantity),4),"OnHandQuantity"="OnHandQuantity"+sl.quantity,"LastMovementAtUtc"=now(),"UpdatedAtUtc"=now() WHERE "TenantId"=t AND "BranchId"=b AND "Id"=sl.balance_id;
   INSERT INTO public.stock_movements("Id","TenantId","BranchId","WarehouseId","WarehouseLocationId","ProductSkuId","MovementType","Quantity","UnitCost","TotalCost","BalanceAfterQuantity","DocumentReference","Reason","CorrelationId","IdempotencyKey","CreatedByUserId","CreatedAtUtc") VALUES(gen_random_uuid(),t,b,sb."WarehouseId",sb."WarehouseLocationId",sb."ProductSkuId",7,sl.quantity,sl.unit_cost,sl.cost,sb."OnHandQuantity"+sl.quantity,s."SaleNumber",reason,sid,'COMMERCIAL-RETURN-'||sl.sale_item_id::text,u,now());
  END LOOP;
  PERFORM public.internal_checkout_reverse_journal_v5(t,b,u,sid,c.revenue_journal,'COMMERCIAL_REVENUE_REV',s."SaleNumber",'Estorno da receita comercial');
  PERFORM public.internal_checkout_reverse_journal_v5(t,b,u,sid,c.cogs_journal,'COMMERCIAL_COGS_REV',s."SaleNumber",'Estorno do custo comercial');
  SELECT * INTO cb FROM public.commercial_cashback_events_v17 WHERE sale_id=sid AND kind='SPEND';
  IF FOUND THEN
   PERFORM 1 FROM public.loyalty_cashback_accounts_v16 WHERE tenant_id=t AND branch_id=b AND party_id=c.party_id FOR UPDATE;
   j:=public.internal_checkout_reverse_journal_v5(t,b,u,sid,cb.journal_id,'LOYALTY_CASHBACK_REFUND',s."SaleNumber",'Devolução do cashback utilizado');
   INSERT INTO public.commercial_cashback_events_v17(tenant_id,branch_id,party_id,sale_id,kind,delta_cents,journal_id,expense_account,liability_account) VALUES(t,b,c.party_id,sid,'REFUND',-cb.delta_cents,j,cb.expense_account,cb.liability_account);
   UPDATE public.loyalty_cashback_accounts_v16 SET balance_cents=balance_cents-cb.delta_cents WHERE tenant_id=t AND branch_id=b AND party_id=c.party_id;
  END IF;
  INSERT INTO public.cash_movements("Id","TenantId","BranchId","CashRegisterId","CashShiftId","MovementType","Direction","Amount","SourceType","SourceId","DocumentReference","Reason","CreatedByUserId","CorrelationId","IdempotencyKey","ReversalOfMovementId","CreatedAtUtc") VALUES(gen_random_uuid(),t,b,sh."CashRegisterId",c.shift_id,3,2,c.total_cents/100.0,'SALE_REFUND',c.payment_id::text,s."SaleNumber",reason,u,sid::text,'COMMERCIAL-REFUND-'||sid::text,c.cash_movement_id,now());
  UPDATE public.cash_shifts SET "CurrentBalance"="CurrentBalance"-c.total_cents/100.0,"TotalCashOut"="TotalCashOut"+c.total_cents/100.0,"UpdatedAtUtc"=now() WHERE "TenantId"=t AND "BranchId"=b AND "Id"=c.shift_id;
  UPDATE public.sale_payment_intents SET "Status"=5,"UpdatedAtUtc"=now() WHERE "TenantId"=t AND "SaleId"=sid AND "Id"=c.payment_id AND "Status"=2;
  IF NOT FOUND THEN RAISE EXCEPTION 'COMMERCIAL_STATE_CONFLICT' USING ERRCODE='23514';END IF;
  UPDATE public.customer_profiles SET "TotalSalesValue"="TotalSalesValue"-c.total_cents/100.0,"UpdatedAtUtc"=now() WHERE "TenantId"=t AND "PartyId"=c.party_id;
  UPDATE public.sales SET "Status"=6,"PaymentStatus"=7,"FulfillmentStatus"=4,"CancelledAtUtc"=now(),"UpdatedAtUtc"=now() WHERE "TenantId"=t AND "Id"=sid;
  UPDATE public.commercial_checkout_records_v17 SET state='CANCELLED' WHERE sale_id=sid;
 END IF;
 out:=jsonb_build_object('saleId',sid,'state',CASE WHEN act='DELIVER' THEN 'DELIVERED' ELSE 'CANCELLED' END);
 INSERT INTO public.commercial_checkout_actions_v17(tenant_id,branch_id,request_id,actor_id,sale_id,payload,result) VALUES(t,b,req,u,sid,p,out);
 INSERT INTO public.audit_events("Id","TenantId","BranchId","EntityType","EntityId","Action","ActorId","ActorEmail","CorrelationId","AfterStateJson","CreatedAtUtc","Version") SELECT gen_random_uuid(),t,b,'CommercialCheckout',sid::text,act,u,x."Email",req::text,out,now(),1 FROM public.users x WHERE x."Id"=u AND x."TenantId"=t;
 RETURN out;
END $fn$;

CREATE OR REPLACE FUNCTION public.commercial_guard_v17() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$ DECLARE sid uuid;tid uuid;BEGIN
 IF TG_TABLE_NAME='sales' THEN sid:=OLD."Id";tid:=OLD."TenantId";ELSIF TG_OP='INSERT' THEN sid:=NEW."SaleId";tid:=NEW."TenantId";ELSE sid:=OLD."SaleId";tid:=OLD."TenantId";END IF;
 IF EXISTS(SELECT 1 FROM public.commercial_checkout_records_v17 WHERE tenant_id=tid AND sale_id=sid) AND (TG_OP='DELETE' OR current_setting('hbstudio.commercial_command',true) IS DISTINCT FROM sid::text) THEN RAISE EXCEPTION 'COMMERCIAL_MANAGED_RECORD' USING ERRCODE='23514';END IF;
 IF TG_OP='DELETE' THEN RETURN OLD;END IF;RETURN NEW;END $fn$;

CREATE TRIGGER tr_commercial_sale_guard_v17 BEFORE UPDATE OR DELETE ON public.sales FOR EACH ROW EXECUTE FUNCTION public.commercial_guard_v17();

CREATE TRIGGER tr_commercial_items_guard_v17 BEFORE INSERT OR UPDATE OR DELETE ON public.sale_items FOR EACH ROW EXECUTE FUNCTION public.commercial_guard_v17();

CREATE TRIGGER tr_commercial_payments_guard_v17 BEFORE INSERT OR UPDATE OR DELETE ON public.sale_payment_intents FOR EACH ROW EXECUTE FUNCTION public.commercial_guard_v17();

CREATE OR REPLACE FUNCTION public.commercial_config_save_v17(t uuid,b uuid,u uuid,req uuid,p jsonb) RETURNS jsonb LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE perms text[];prior public.loyalty_commands_v15%ROWTYPE;c public.commercial_checkout_config_v17%ROWTYPE;cash uuid;rev uuid;stock uuid;cogs uuid;v integer;out jsonb;BEGIN
 perms:=public.commercial_checkout_authorize_v17(t,b,u,'sales.create');IF NOT(ARRAY['finance.reconcile','fiscal.settings.manage']<@perms) THEN RAISE EXCEPTION 'COMMERCIAL_FORBIDDEN' USING ERRCODE='42501';END IF;
 IF req IS NULL OR jsonb_typeof(p) IS DISTINCT FROM 'object' OR p->'enabled' IS DISTINCT FROM 'false'::jsonb THEN RAISE EXCEPTION 'COMMERCIAL_INVALID' USING ERRCODE='22023';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(t::text||':loyalty-command',0));
 SELECT * INTO prior FROM public.loyalty_commands_v15 WHERE tenant_id=t AND request_id=req;
 IF FOUND THEN IF prior.actor_id<>u OR prior.branch_id<>b OR prior.action<>'COMMERCIAL_CONFIG' OR prior.payload IS DISTINCT FROM p THEN RAISE EXCEPTION 'COMMERCIAL_CONFLICT' USING ERRCODE='23514';END IF;RETURN prior.result;END IF;
 cash:=(p->>'cashAccount')::uuid;rev:=(p->>'revenueAccount')::uuid;stock:=(p->>'stockAccount')::uuid;cogs:=(p->>'cogsAccount')::uuid;v:=(p->>'version')::integer;
 IF (SELECT count(DISTINCT x) FROM unnest(ARRAY[cash,rev,stock,cogs]) x)<>4 OR EXISTS(SELECT 1 FROM (VALUES(cash,1),(rev,4),(stock,1),(cogs,5)) z(id,typ) WHERE NOT EXISTS(SELECT 1 FROM public.financial_accounts a WHERE a."TenantId"=t AND a."Id"=z.id AND a."Type"=z.typ AND a."IsActive")) THEN RAISE EXCEPTION 'COMMERCIAL_CONFIG_NOT_READY' USING ERRCODE='23514';END IF;
 SELECT * INTO c FROM public.commercial_checkout_config_v17 WHERE tenant_id=t AND branch_id=b FOR UPDATE;
 IF coalesce(c.version,0) IS DISTINCT FROM v THEN RAISE EXCEPTION 'COMMERCIAL_CONFLICT' USING ERRCODE='23514';END IF;
 INSERT INTO public.commercial_checkout_config_v17(tenant_id,branch_id,enabled,cash_account,revenue_account,stock_account,cogs_account,version) VALUES(t,b,false,cash,rev,stock,cogs,v+1) ON CONFLICT(tenant_id,branch_id) DO UPDATE SET enabled=false,cash_account=excluded.cash_account,revenue_account=excluded.revenue_account,stock_account=excluded.stock_account,cogs_account=excluded.cogs_account,version=excluded.version,updated_at=now();
 out:=jsonb_build_object('version',v+1,'enabled',false);
 INSERT INTO public.loyalty_commands_v15(tenant_id,branch_id,request_id,actor_id,action,payload,result) VALUES(t,b,req,u,'COMMERCIAL_CONFIG',p,out);
 INSERT INTO public.audit_events("Id","TenantId","BranchId","EntityType","EntityId","Action","ActorId","ActorEmail","CorrelationId","AfterStateJson","CreatedAtUtc","Version") SELECT gen_random_uuid(),t,b,'CommercialCheckout',b::text,'ConfigSavedDisabled',u,x."Email",req::text,out,now(),1 FROM public.users x WHERE x."Id"=u AND x."TenantId"=t;
 RETURN out;END $fn$;
