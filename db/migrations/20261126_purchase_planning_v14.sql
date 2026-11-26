-- Purchase planning V14: scoped rules, immutable evidence, atomic canonical draft orders.
CREATE TABLE IF NOT EXISTS public.purchase_planning_rules_v14 (
 tenant_id uuid NOT NULL,branch_id uuid NOT NULL,sku_id uuid NOT NULL,supplier_id uuid,lead_days integer NOT NULL CHECK(lead_days BETWEEN 1 AND 90),coverage_days integer NOT NULL CHECK(coverage_days BETWEEN 1 AND 90),safety_days integer NOT NULL CHECK(safety_days BETWEEN 0 AND 30),min_qty integer NOT NULL CHECK(min_qty BETWEEN 1 AND 10000),multiple_qty integer NOT NULL CHECK(multiple_qty BETWEEN 1 AND 10000),max_qty integer NOT NULL CHECK(max_qty BETWEEN 1 AND 10000 AND max_qty>=min_qty AND max_qty>=multiple_qty),updated_by uuid NOT NULL,version bigint NOT NULL DEFAULT 1,updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(tenant_id,branch_id,sku_id),FOREIGN KEY(tenant_id,branch_id) REFERENCES public.branches("TenantId","Id"),FOREIGN KEY(tenant_id,sku_id) REFERENCES public.product_skus("TenantId","Id"),FOREIGN KEY(tenant_id,supplier_id) REFERENCES public.parties("TenantId","Id"),FOREIGN KEY(tenant_id,updated_by) REFERENCES public.users("TenantId","Id"));

CREATE TABLE IF NOT EXISTS public.purchase_planning_events_v14 (
 tenant_id uuid NOT NULL,branch_id uuid NOT NULL,id uuid NOT NULL,actor_id uuid NOT NULL,kind text NOT NULL CHECK(kind IN('RULE','SNAPSHOT','DRAFT')),payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object'),created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(tenant_id,branch_id,id),FOREIGN KEY(tenant_id,branch_id) REFERENCES public.branches("TenantId","Id"),FOREIGN KEY(tenant_id,actor_id) REFERENCES public.users("TenantId","Id"));

CREATE INDEX IF NOT EXISTS ix_purchase_planning_events_v14 ON public.purchase_planning_events_v14(tenant_id,branch_id,created_at DESC);

CREATE OR REPLACE FUNCTION public.purchase_planning_immutable_v14() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$ BEGIN RAISE EXCEPTION 'PLAN_IMMUTABLE' USING ERRCODE='23514';END $$;

DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.purchase_planning_events_v14'::regclass AND tgname='tr_purchase_planning_immutable_v14') THEN CREATE TRIGGER tr_purchase_planning_immutable_v14 BEFORE UPDATE OR DELETE ON public.purchase_planning_events_v14 FOR EACH ROW EXECUTE FUNCTION public.purchase_planning_immutable_v14();END IF;END $$;

CREATE OR REPLACE FUNCTION public.purchase_planning_command_v14(t uuid,b uuid,u uuid,req uuid,act text,p jsonb) RETURNS jsonb LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE perms text[];ev public.purchase_planning_events_v14%ROWTYPE;prior public.purchase_planning_rules_v14%ROWTYPE;k uuid;sup uuid;lead integer;cover integer;safety integer;mn integer;mult integer;mx integer;v bigint;res jsonb;actor_email text;stamp timestamptz:=clock_timestamp();snap public.purchase_planning_events_v14%ROWTYPE;line jsonb;evidence jsonb;qty integer;cost bigint;total numeric:=0;oid uuid:=gen_random_uuid();num text;sku_row record;stock numeric;open_qty numeric;saved_rule bigint;budget bigint;line_count integer;rule_min integer;rule_multiple integer;rule_max integer;observed30 numeric;observed90 numeric;observed_sales bigint;
BEGIN
 SELECT x."Email" INTO actor_email FROM public.users x JOIN public.branches z ON z."TenantId"=x."TenantId" AND z."Id"=b AND z."IsActive" WHERE x."TenantId"=t AND x."Id"=u AND x."DefaultBranchId"=b AND x."IsActive" AND EXISTS(SELECT 1 FROM public.partners a WHERE a."TenantId"=t AND lower(a."Email")=lower(x."Email") AND a."Status"=1 AND a."IsErpAccessEnabled");
 IF NOT FOUND THEN RAISE EXCEPTION 'PLAN_FORBIDDEN' USING ERRCODE='42501';END IF;
 SELECT coalesce(array_agg(DISTINCT rp."PermissionKey"),ARRAY[]::text[]) INTO perms FROM public.user_roles ur JOIN public.role_permissions rp ON rp."TenantId"=ur."TenantId" AND rp."RoleId"=ur."RoleId" WHERE ur."TenantId"=t AND ur."UserId"=u;
 IF NOT (ARRAY['purchases.view','inventory.view','finance.reports.view']<@perms) OR (act='RULE' AND NOT('purchases.approve'=ANY(perms))) OR (act IN('SNAPSHOT','DRAFT') AND NOT(ARRAY['purchases.cost.view','inventory.cost.view','sales.cost.view']<@perms)) OR (act='DRAFT' AND NOT('purchases.create'=ANY(perms))) THEN RAISE EXCEPTION 'PLAN_FORBIDDEN' USING ERRCODE='42501';END IF;
 IF req IS NULL OR jsonb_typeof(p) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'PLAN_INVALID' USING ERRCODE='22023';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(t::text||':'||b::text||':purchase-plan',0));
 SELECT * INTO ev FROM public.purchase_planning_events_v14 WHERE tenant_id=t AND branch_id=b AND id=req;
 IF FOUND THEN IF ev.actor_id<>u OR ev.kind<>act OR ev.payload->'request' IS DISTINCT FROM p THEN RAISE EXCEPTION 'PLAN_CONFLICT' USING ERRCODE='23514';END IF;RETURN ev.payload->'result';END IF;
 IF act='RULE' THEN
  k:=(p->>'skuId')::uuid;sup:=nullif(p->>'supplierId','')::uuid;lead:=(p->>'lead')::integer;cover:=(p->>'coverage')::integer;safety:=(p->>'safety')::integer;mn:=(p->>'min')::integer;mult:=(p->>'multiple')::integer;mx:=(p->>'max')::integer;v:=(p->>'version')::bigint;
  IF NOT EXISTS(SELECT 1 FROM public.product_skus x JOIN public.product_models m ON m."TenantId"=x."TenantId" AND m."Id"=x."ProductModelId" WHERE x."TenantId"=t AND x."Id"=k AND x."IsActive" AND m."IsActive" AND m."Kind" IN(1,3,5)) OR (sup IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.parties x JOIN public.supplier_profiles y ON y."TenantId"=x."TenantId" AND y."PartyId"=x."Id" WHERE x."TenantId"=t AND x."Id"=sup AND x."IsActive")) THEN RAISE EXCEPTION 'PLAN_INVALID_REFERENCE' USING ERRCODE='22023';END IF;
  SELECT * INTO prior FROM public.purchase_planning_rules_v14 WHERE tenant_id=t AND branch_id=b AND sku_id=k FOR UPDATE;
  IF coalesce(prior.version,0) IS DISTINCT FROM v THEN RAISE EXCEPTION 'PLAN_STALE_RULE' USING ERRCODE='23514';END IF;
  INSERT INTO public.purchase_planning_rules_v14(tenant_id,branch_id,sku_id,supplier_id,lead_days,coverage_days,safety_days,min_qty,multiple_qty,max_qty,updated_by,version,updated_at) VALUES(t,b,k,sup,lead,cover,safety,mn,mult,mx,u,v+1,stamp) ON CONFLICT(tenant_id,branch_id,sku_id) DO UPDATE SET supplier_id=excluded.supplier_id,lead_days=excluded.lead_days,coverage_days=excluded.coverage_days,safety_days=excluded.safety_days,min_qty=excluded.min_qty,multiple_qty=excluded.multiple_qty,max_qty=excluded.max_qty,updated_by=u,version=excluded.version,updated_at=stamp;
  res:=jsonb_build_object('skuId',k,'version',v+1);
 ELSIF act='SNAPSHOT' THEN
  IF jsonb_typeof(p->'rows') IS DISTINCT FROM 'array' OR jsonb_array_length(p->'rows')>5000 OR p->>'algorithm' IS DISTINCT FROM 'purchase-v2.0' THEN RAISE EXCEPTION 'PLAN_INVALID' USING ERRCODE='22023';END IF;
  res:=jsonb_build_object('snapshotId',req,'count',jsonb_array_length(p->'rows'));
 ELSIF act='DRAFT' THEN
  sup:=(p->>'supplierId')::uuid;budget:=(p->>'budgetCents')::bigint;
  SELECT * INTO snap FROM public.purchase_planning_events_v14 WHERE tenant_id=t AND branch_id=b AND id=(p->>'snapshotId')::uuid AND kind='SNAPSHOT' AND actor_id=u;
  IF NOT FOUND OR snap.created_at<stamp-interval '15 minutes' THEN RAISE EXCEPTION 'PLAN_STALE_SNAPSHOT' USING ERRCODE='23514';END IF;
  IF NOT EXISTS(SELECT 1 FROM public.parties x JOIN public.supplier_profiles y ON y."TenantId"=x."TenantId" AND y."PartyId"=x."Id" WHERE x."TenantId"=t AND x."Id"=sup AND x."IsActive") OR budget IS NULL OR budget<1 OR budget>100000000000 OR jsonb_typeof(p->'items') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'PLAN_INVALID' USING ERRCODE='22023';END IF;
  line_count:=jsonb_array_length(p->'items');IF line_count NOT BETWEEN 1 AND 100 OR (SELECT count(DISTINCT x->>'id') FROM jsonb_array_elements(p->'items') x)<>line_count THEN RAISE EXCEPTION 'PLAN_INVALID' USING ERRCODE='22023';END IF;
  -- Lock canonical order tables briefly, including concurrent legacy writes. No stock/financial mutation.
  PERFORM set_config('lock_timeout','3s',true);
  LOCK TABLE public.purchase_orders,public.purchase_order_items IN SHARE ROW EXCLUSIVE MODE;
  LOCK TABLE public.stock_balances IN SHARE MODE;
  FOR line IN SELECT x FROM jsonb_array_elements(p->'items') x LOOP
   k:=(line->>'id')::uuid;qty:=(line->>'quantity')::integer;cost:=(line->>'unitCostCents')::bigint;
   SELECT x INTO evidence FROM jsonb_array_elements(snap.payload->'request'->'rows') x WHERE x->>'id'=k::text;
   IF NOT FOUND OR evidence->>'state' NOT IN('buy','review') OR qty IS NULL OR qty NOT BETWEEN 1 AND 10000 OR cost IS NULL OR cost NOT BETWEEN 1 AND 10000000000 OR (evidence->>'state'='buy' AND qty>(evidence->>'quantity')::integer) OR (evidence->>'state'='review' AND coalesce((line->>'reviewConfirmed')::boolean,false)=false) THEN RAISE EXCEPTION 'PLAN_INVALID_ITEM' USING ERRCODE='22023';END IF;
   IF nullif(evidence->>'supplierId','') IS NOT NULL AND (evidence->>'supplierId')::uuid<>sup THEN RAISE EXCEPTION 'PLAN_INVALID_REFERENCE' USING ERRCODE='22023';END IF;
   SELECT coalesce((SELECT version FROM public.purchase_planning_rules_v14 WHERE tenant_id=t AND branch_id=b AND sku_id=k),0) INTO saved_rule;
   IF saved_rule IS DISTINCT FROM (evidence->>'ruleVersion')::bigint THEN RAISE EXCEPTION 'PLAN_STALE_RULE' USING ERRCODE='23514';END IF;
   IF saved_rule>0 THEN SELECT min_qty,multiple_qty,max_qty INTO rule_min,rule_multiple,rule_max FROM public.purchase_planning_rules_v14 WHERE tenant_id=t AND branch_id=b AND sku_id=k;IF qty<rule_min OR qty>rule_max OR mod(qty,rule_multiple)<>0 THEN RAISE EXCEPTION 'PLAN_INVALID_ITEM' USING ERRCODE='22023';END IF;END IF;
   SELECT sum(x."OnHandQuantity"-x."ReservedQuantity"-x."BlockedQuantity") INTO stock FROM public.stock_balances x JOIN public.warehouses w ON w."TenantId"=x."TenantId" AND w."BranchId"=x."BranchId" AND w."Id"=x."WarehouseId" AND w."IsActive" WHERE x."TenantId"=t AND x."BranchId"=b AND x."ProductSkuId"=k;
   IF stock IS DISTINCT FROM (evidence->>'available')::numeric THEN RAISE EXCEPTION 'PLAN_STALE_STOCK' USING ERRCODE='23514';END IF;
   SELECT coalesce(sum(greatest(0,i."QuantityOrdered"-i."QuantityReceived")),0) INTO open_qty FROM public.purchase_order_items i JOIN public.purchase_orders a ON a."TenantId"=i."TenantId" AND a."Id"=i."PurchaseOrderId" WHERE a."TenantId"=t AND a."BranchId"=b AND a."Status" IN(1,2,3,4,5) AND i."ProductSkuId"=k;
   IF open_qty IS DISTINCT FROM (evidence->>'incoming')::numeric OR coalesce((evidence->>'pending')::numeric,0)>0 THEN RAISE EXCEPTION 'PLAN_STALE_ORDERS' USING ERRCODE='23514';END IF;
   SELECT coalesce(sum(i."Quantity") FILTER(WHERE a."ConfirmedAtUtc">=stamp-interval '30 days'),0),coalesce(sum(i."Quantity"),0),count(DISTINCT a."Id") INTO observed30,observed90,observed_sales FROM public.sales a JOIN public.sale_items i ON i."TenantId"=a."TenantId" AND i."SaleId"=a."Id" WHERE a."TenantId"=t AND a."BranchId"=b AND a."Status" IN(4,5) AND a."ConfirmedAtUtc">=stamp-interval '90 days' AND a."ConfirmedAtUtc"<=stamp AND i."ProductSkuId"=k;
   IF observed30 IS DISTINCT FROM (evidence->>'q30')::numeric OR observed90 IS DISTINCT FROM (evidence->>'q90')::numeric OR observed_sales IS DISTINCT FROM (evidence->>'salesCount')::bigint THEN RAISE EXCEPTION 'PLAN_STALE_DEMAND' USING ERRCODE='23514';END IF;
   SELECT x."SkuCode" sku,concat_ws(' · ',m."Name",x."VariantName") description INTO sku_row FROM public.product_skus x JOIN public.product_models m ON m."TenantId"=x."TenantId" AND m."Id"=x."ProductModelId" WHERE x."TenantId"=t AND x."Id"=k AND x."IsActive" AND m."IsActive" AND m."Kind" IN(1,3,5);
   IF NOT FOUND THEN RAISE EXCEPTION 'PLAN_INVALID_REFERENCE' USING ERRCODE='22023';END IF;
   total:=total+qty::numeric*cost;
  END LOOP;
  IF total>budget THEN RAISE EXCEPTION 'PLAN_BUDGET_EXCEEDED' USING ERRCODE='23514';END IF;
  num:='PLAN-'||upper(replace(req::text,'-',''));
  INSERT INTO public.purchase_orders("Id","TenantId","BranchId","SupplierPartyId","OrderNumber","Status","ShippingCost","OtherExpenses","TotalDiscount","Notes","CreatedByUserId","CreatedAtUtc") VALUES(oid,t,b,sup,num,1,0,0,0,'Rascunho de sugestão auditada '||snap.id::text||'. Conferir condições, frete e tributos antes de aprovar.',u,stamp);
  INSERT INTO public.purchase_order_items("Id","TenantId","PurchaseOrderId","ProductSkuId","HistoricalSkuCode","HistoricalDescription","QuantityOrdered","QuantityReceived","UnitCost","Discount","CreatedAtUtc") SELECT gen_random_uuid(),t,oid,x."Id",x."SkuCode",left(concat_ws(' · ',m."Name",x."VariantName"),300),(j->>'quantity')::integer,0,(j->>'unitCostCents')::bigint/100.0,0,stamp FROM jsonb_array_elements(p->'items') j JOIN public.product_skus x ON x."TenantId"=t AND x."Id"=(j->>'id')::uuid JOIN public.product_models m ON m."TenantId"=t AND m."Id"=x."ProductModelId";
  res:=jsonb_build_object('orderId',oid,'orderNumber',num,'totalCents',total,'status','Draft');
 ELSE RAISE EXCEPTION 'PLAN_INVALID' USING ERRCODE='22023';END IF;
 INSERT INTO public.purchase_planning_events_v14(tenant_id,branch_id,id,actor_id,kind,payload,created_at) VALUES(t,b,req,u,act,jsonb_build_object('request',p,'result',res),stamp);
 INSERT INTO public.audit_events("Id","TenantId","BranchId","EntityType","EntityId","Action","ActorId","ActorEmail","CorrelationId","AfterStateJson","CreatedAtUtc","Version") VALUES(gen_random_uuid(),t,b,'PurchasePlanning',req::text,act,u,actor_email,req::text,res,stamp,1);
 RETURN res;
END $fn$;
