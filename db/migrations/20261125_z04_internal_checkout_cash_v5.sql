-- Canonical cash checkout for internal QA only; no fiscal authorization or external payment processing.

-- Marker is deliberately NOT created by this migration. Existing production checkout remains fail-closed.

-- Apply after z03. Cash, sale, inventory, customer, loyalty and journal writes are atomic.

BEGIN;

CREATE UNIQUE INDEX ux_checkout_fin_account_scope_v5 ON public.financial_accounts USING btree ("TenantId", "Id");

CREATE UNIQUE INDEX ux_checkout_sale_scope_v5 ON public.sales USING btree ("TenantId", "BranchId", "Id");

CREATE UNIQUE INDEX ux_checkout_sku_scope_v5 ON public.product_skus USING btree ("TenantId", "Id");

CREATE TABLE public.internal_checkout_config_v5 (
 "tenant_id" uuid NOT NULL,
 "branch_id" uuid NOT NULL,
 "cash_account" uuid NOT NULL,
 "goods_revenue_account" uuid NOT NULL,
 "factory_revenue_account" uuid NOT NULL,
 "stock_account" uuid NOT NULL,
 "finished_account" uuid NOT NULL,
 "cogs_account" uuid NOT NULL,
 "waste_account" uuid NOT NULL,
 "factory_sku" uuid NOT NULL,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 CONSTRAINT "internal_checkout_config_v5_pkey" PRIMARY KEY (tenant_id, branch_id),
 CONSTRAINT "internal_checkout_config_v5_tenant_id_cash_account_fkey" FOREIGN KEY (tenant_id, cash_account) REFERENCES financial_accounts("TenantId", "Id"),
 CONSTRAINT "internal_checkout_config_v5_tenant_id_cogs_account_fkey" FOREIGN KEY (tenant_id, cogs_account) REFERENCES financial_accounts("TenantId", "Id"),
 CONSTRAINT "internal_checkout_config_v5_tenant_id_factory_revenue_acco_fkey" FOREIGN KEY (tenant_id, factory_revenue_account) REFERENCES financial_accounts("TenantId", "Id"),
 CONSTRAINT "internal_checkout_config_v5_tenant_id_factory_sku_fkey" FOREIGN KEY (tenant_id, factory_sku) REFERENCES product_skus("TenantId", "Id"),
 CONSTRAINT "internal_checkout_config_v5_tenant_id_finished_account_fkey" FOREIGN KEY (tenant_id, finished_account) REFERENCES financial_accounts("TenantId", "Id"),
 CONSTRAINT "internal_checkout_config_v5_tenant_id_goods_revenue_accoun_fkey" FOREIGN KEY (tenant_id, goods_revenue_account) REFERENCES financial_accounts("TenantId", "Id"),
 CONSTRAINT "internal_checkout_config_v5_tenant_id_stock_account_fkey" FOREIGN KEY (tenant_id, stock_account) REFERENCES financial_accounts("TenantId", "Id"),
 CONSTRAINT "internal_checkout_config_v5_tenant_id_waste_account_fkey" FOREIGN KEY (tenant_id, waste_account) REFERENCES financial_accounts("TenantId", "Id")
);

CREATE TABLE public.internal_checkout_records_v5 (
 "tenant_id" uuid NOT NULL,
 "branch_id" uuid NOT NULL,
 "sale_id" uuid NOT NULL,
 "request_id" uuid NOT NULL,
 "actor_id" uuid NOT NULL,
 "shift_id" uuid NOT NULL,
 "order_id" uuid,
 "customer_id" uuid,
 "payload" jsonb NOT NULL,
 "total" numeric(18,2) NOT NULL,
 "tendered" numeric(18,2) NOT NULL,
 "change_amount" numeric(18,2) NOT NULL,
 "material_cost" numeric(18,2) NOT NULL,
 "managerial_cost" numeric(24,6) NOT NULL,
 "payment_id" uuid NOT NULL,
 "cash_movement_id" uuid NOT NULL,
 "revenue_entry_id" uuid NOT NULL,
 "cogs_entry_id" uuid,
 "state" text NOT NULL,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 "cancelled_at" timestamp with time zone,
 CONSTRAINT "internal_checkout_records_v5_check" CHECK ((tendered >= total)),
 CONSTRAINT "internal_checkout_records_v5_check1" CHECK ((change_amount = (tendered - total))),
 CONSTRAINT "internal_checkout_records_v5_managerial_cost_check" CHECK ((managerial_cost >= (0)::numeric)),
 CONSTRAINT "internal_checkout_records_v5_material_cost_check" CHECK ((material_cost >= (0)::numeric)),
 CONSTRAINT "internal_checkout_records_v5_pkey" PRIMARY KEY (tenant_id, branch_id, sale_id),
 CONSTRAINT "internal_checkout_records_v5_state_check" CHECK ((state = ANY (ARRAY['REGISTERED'::text, 'DELIVERED'::text, 'CANCELLED'::text]))),
 CONSTRAINT "internal_checkout_records_v5_tenant_id_branch_id_order_id_fkey" FOREIGN KEY (tenant_id, branch_id, order_id) REFERENCES manufacturing_orders("TenantId", "BranchId", "Id"),
 CONSTRAINT "internal_checkout_records_v5_tenant_id_branch_id_request_id_key" UNIQUE (tenant_id, branch_id, request_id),
 CONSTRAINT "internal_checkout_records_v5_tenant_id_branch_id_sale_id_fkey" FOREIGN KEY (tenant_id, branch_id, sale_id) REFERENCES sales("TenantId", "BranchId", "Id"),
 CONSTRAINT "internal_checkout_records_v5_total_check" CHECK ((total > (0)::numeric))
);

CREATE TABLE public.internal_checkout_stock_lines_v5 (
 "tenant_id" uuid NOT NULL,
 "branch_id" uuid NOT NULL,
 "sale_id" uuid NOT NULL,
 "sale_item_id" uuid NOT NULL,
 "balance_id" uuid NOT NULL,
 "quantity" numeric(20,6) NOT NULL,
 "cost" numeric(18,2) NOT NULL,
 CONSTRAINT "internal_checkout_stock_lines__tenant_id_branch_id_sale_id_fkey" FOREIGN KEY (tenant_id, branch_id, sale_id) REFERENCES internal_checkout_records_v5(tenant_id, branch_id, sale_id),
 CONSTRAINT "internal_checkout_stock_lines_tenant_id_branch_id_balance__fkey" FOREIGN KEY (tenant_id, branch_id, balance_id) REFERENCES stock_balances("TenantId", "BranchId", "Id"),
 CONSTRAINT "internal_checkout_stock_lines_v5_cost_check" CHECK ((cost >= (0)::numeric)),
 CONSTRAINT "internal_checkout_stock_lines_v5_pkey" PRIMARY KEY (tenant_id, branch_id, sale_item_id),
 CONSTRAINT "internal_checkout_stock_lines_v5_quantity_check" CHECK ((quantity > (0)::numeric))
);

CREATE TABLE public.factory_material_capitalization_v5 (
 "tenant_id" uuid NOT NULL,
 "branch_id" uuid NOT NULL,
 "order_id" uuid NOT NULL,
 "productive_cost" numeric(18,2) NOT NULL,
 "waste_cost" numeric(18,2) NOT NULL,
 "productive_entry" uuid,
 "waste_entry" uuid,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 CONSTRAINT "factory_material_capitalizati_tenant_id_branch_id_order_id_fkey" FOREIGN KEY (tenant_id, branch_id, order_id) REFERENCES manufacturing_orders("TenantId", "BranchId", "Id"),
 CONSTRAINT "factory_material_capitalization_v5_pkey" PRIMARY KEY (tenant_id, branch_id, order_id),
 CONSTRAINT "factory_material_capitalization_v5_productive_cost_check" CHECK ((productive_cost >= (0)::numeric)),
 CONSTRAINT "factory_material_capitalization_v5_waste_cost_check" CHECK ((waste_cost >= (0)::numeric))
);

CREATE TABLE public.internal_checkout_actions_v5 (
 "tenant_id" uuid NOT NULL,
 "branch_id" uuid NOT NULL,
 "request_id" uuid NOT NULL,
 "sale_id" uuid NOT NULL,
 "actor_id" uuid NOT NULL,
 "action" text NOT NULL,
 "payload" jsonb NOT NULL,
 "result" jsonb NOT NULL,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 CONSTRAINT "internal_checkout_actions_v5_action_check" CHECK ((action = ANY (ARRAY['DELIVER'::text, 'CANCEL'::text]))),
 CONSTRAINT "internal_checkout_actions_v5_pkey" PRIMARY KEY (tenant_id, branch_id, request_id),
 CONSTRAINT "internal_checkout_actions_v5_tenant_id_branch_id_sale_id_fkey" FOREIGN KEY (tenant_id, branch_id, sale_id) REFERENCES internal_checkout_records_v5(tenant_id, branch_id, sale_id)
);

CREATE UNIQUE INDEX ux_checkout_active_factory_order_v5 ON public.internal_checkout_records_v5 USING btree (tenant_id, branch_id, order_id) WHERE ((order_id IS NOT NULL) AND (state <> 'CANCELLED'::text));

CREATE FUNCTION public.internal_checkout_action_v5(t uuid, b uuid, u uuid, req uuid, p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE act text;sid uuid;prior public.internal_checkout_actions_v5%ROWTYPE;c public.internal_checkout_records_v5%ROWTYPE;s public.sales%ROWTYPE;sh public.cash_shifts%ROWTYPE;o public.manufacturing_orders%ROWTYPE;sl record;sb public.stock_balances%ROWTYPE;m public.stock_movements%ROWTYPE;reason text;mid uuid:=gen_random_uuid();result jsonb;avg_new numeric;
BEGIN
 IF req IS NULL OR jsonb_typeof(p) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'CHECKOUT_ACTION_INVALID' USING ERRCODE='22023';END IF;
 act:=p->>'action';sid:=(p->>'saleId')::uuid;
 IF act IS NULL OR act NOT IN('DELIVER','CANCEL') THEN RAISE EXCEPTION 'CHECKOUT_ACTION_INVALID' USING ERRCODE='22023';END IF;
 PERFORM public.internal_checkout_authorize_v5(t,b,u,CASE WHEN act='CANCEL' THEN 'sales.cancel' ELSE 'sales.create' END);
 PERFORM pg_advisory_xact_lock(hashtextextended(t::text||b::text||req::text,7));
 SELECT * INTO prior FROM public.internal_checkout_actions_v5 WHERE tenant_id=t AND branch_id=b AND request_id=req;
 IF FOUND THEN IF (prior.payload,prior.actor_id,prior.sale_id,prior.action) IS DISTINCT FROM (p,u,sid,act) THEN RAISE EXCEPTION 'CHECKOUT_ACTION_IDEMPOTENCY' USING ERRCODE='23514';END IF;RETURN prior.result;END IF;
 -- Same lock order as checkout: shift, then OS/stock; sale is already unique.
 SELECT * INTO c FROM public.internal_checkout_records_v5 WHERE tenant_id=t AND branch_id=b AND sale_id=sid;
 IF NOT FOUND THEN RAISE EXCEPTION 'CHECKOUT_SALE_NOT_FOUND' USING ERRCODE='22023';END IF;
 IF act='CANCEL' THEN
  reason:=public.factory_text_v2(p,'reason',4,500);
  IF jsonb_typeof(p->'cashReturned') IS DISTINCT FROM 'boolean' OR (p->>'cashReturned')::boolean IS NOT TRUE OR jsonb_typeof(p->'goodsRetained') IS DISTINCT FROM 'boolean' OR (p->>'goodsRetained')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'CHECKOUT_REFUND_CONFIRMATION_REQUIRED' USING ERRCODE='22023';END IF;
  SELECT * INTO sh FROM public.cash_shifts WHERE "TenantId"=t AND "BranchId"=b AND "Id"=c.shift_id FOR UPDATE;
  IF NOT FOUND OR sh."Status"<>1 OR sh."OperatorUserId"<>u OR sh."CurrentBalance"<c.total THEN RAISE EXCEPTION 'CHECKOUT_REFUND_SHIFT_INVALID' USING ERRCODE='23514';END IF;
 END IF;
 SELECT * INTO c FROM public.internal_checkout_records_v5 WHERE tenant_id=t AND branch_id=b AND sale_id=sid FOR UPDATE;
 SELECT * INTO s FROM public.sales WHERE "TenantId"=t AND "BranchId"=b AND "Id"=sid FOR UPDATE;
 IF c.state<>'REGISTERED' OR s."Status"<>4 OR s."PaymentStatus"<>4 OR s."FulfillmentStatus"<>2 THEN RAISE EXCEPTION 'CHECKOUT_ACTION_STATE_CONFLICT' USING ERRCODE='23514';END IF;
 IF c.order_id IS NOT NULL THEN
  SELECT * INTO o FROM public.manufacturing_orders WHERE "TenantId"=t AND "BranchId"=b AND "Id"=c.order_id FOR UPDATE;
  IF NOT FOUND OR o."Status"<>12 OR o."SalesOrderId" IS DISTINCT FROM sid THEN RAISE EXCEPTION 'CHECKOUT_ORDER_LINK_CONFLICT' USING ERRCODE='23514';END IF;
 END IF;
 PERFORM set_config('hbstudio.checkout_command',sid::text,true);
 IF act='DELIVER' THEN
  UPDATE public.sales SET "Status"=5,"FulfillmentStatus"=3,"FulfilledAtUtc"=now(),"UpdatedAtUtc"=now() WHERE "TenantId"=t AND "BranchId"=b AND "Id"=sid;
  UPDATE public.internal_checkout_records_v5 SET state='DELIVERED' WHERE tenant_id=t AND branch_id=b AND sale_id=sid;
  result:=jsonb_build_object('saleId',sid,'state','DELIVERED');
 ELSE
  FOR sl IN SELECT * FROM public.internal_checkout_stock_lines_v5 WHERE tenant_id=t AND branch_id=b AND sale_id=sid ORDER BY balance_id LOOP
   SELECT * INTO sb FROM public.stock_balances WHERE "TenantId"=t AND "BranchId"=b AND "Id"=sl.balance_id FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'CHECKOUT_STOCK_NOT_FOUND' USING ERRCODE='23514';END IF;
   SELECT * INTO m FROM public.stock_movements WHERE "TenantId"=t AND "BranchId"=b AND "IdempotencyKey"='QA-SALE-OUT-'||sl.sale_item_id::text AND "MovementType"=4;
   IF NOT FOUND OR m."ProductSkuId"<>sb."ProductSkuId" OR m."WarehouseId"<>sb."WarehouseId" OR m."WarehouseLocationId" IS DISTINCT FROM sb."WarehouseLocationId" OR m."Quantity"<>-sl.quantity THEN RAISE EXCEPTION 'CHECKOUT_STOCK_RECONCILIATION' USING ERRCODE='23514';END IF;
   avg_new:=round((sb."AverageCost"*sb."OnHandQuantity"+m."UnitCost"*sl.quantity)/(sb."OnHandQuantity"+sl.quantity),4);
   UPDATE public.stock_balances SET "OnHandQuantity"="OnHandQuantity"+sl.quantity,"AverageCost"=avg_new,"LastMovementAtUtc"=now(),"UpdatedAtUtc"=now() WHERE "TenantId"=t AND "BranchId"=b AND "Id"=sl.balance_id;
   INSERT INTO public.stock_movements("Id","TenantId","BranchId","WarehouseId","WarehouseLocationId","ProductSkuId","MovementType","Quantity","UnitCost","TotalCost","BalanceAfterQuantity","DocumentReference","Reason","CorrelationId","IdempotencyKey","CreatedByUserId","CreatedAtUtc") VALUES(gen_random_uuid(),t,b,sb."WarehouseId",sb."WarehouseLocationId",sb."ProductSkuId",7,sl.quantity,m."UnitCost",sl.cost,sb."OnHandQuantity"+sl.quantity,s."SaleNumber",'Reversão de venda QA antes da entrega',sid,'QA-SALE-RETURN-'||sl.sale_item_id::text,u,now());
  END LOOP;
  IF c.order_id IS NOT NULL THEN
   PERFORM set_config('hbstudio.factory_order_command',c.order_id::text,true);
   UPDATE public.manufacturing_orders SET "SalesOrderId"=NULL,"UpdatedAtUtc"=now() WHERE "TenantId"=t AND "BranchId"=b AND "Id"=c.order_id;
   UPDATE public.manufacturing_factory_order_details SET version=version+1 WHERE tenant_id=t AND branch_id=b AND order_id=c.order_id;
  END IF;
  PERFORM public.internal_checkout_reverse_journal_v5(t,b,u,sid,c.revenue_entry_id,'QA_SALE_REVENUE_REV',s."SaleNumber",'Estorno de receita QA');
  PERFORM public.internal_checkout_reverse_journal_v5(t,b,u,sid,c.cogs_entry_id,'QA_SALE_COGS_REV',s."SaleNumber",'Estorno de custo vendido QA');
  INSERT INTO public.cash_movements("Id","TenantId","BranchId","CashRegisterId","CashShiftId","MovementType","Direction","Amount","SourceType","SourceId","DocumentReference","Reason","CreatedByUserId","CorrelationId","IdempotencyKey","ReversalOfMovementId","CreatedAtUtc") VALUES(mid,t,b,sh."CashRegisterId",sh."Id",3,2,c.total,'SALE_REFUND',c.payment_id::text,s."SaleNumber",reason,u,sid::text,'QA-SALE-REFUND-'||sid::text,c.cash_movement_id,now());
  UPDATE public.cash_shifts SET "CurrentBalance"="CurrentBalance"-c.total,"TotalCashOut"="TotalCashOut"+c.total,"UpdatedAtUtc"=now() WHERE "TenantId"=t AND "BranchId"=b AND "Id"=sh."Id";
  IF c.customer_id IS NOT NULL THEN
   UPDATE public.customer_profiles SET "TotalSalesValue"="TotalSalesValue"-c.total,"UpdatedAtUtc"=now() WHERE "TenantId"=t AND "PartyId"=c.customer_id AND "TotalSalesValue">=c.total;
   IF NOT FOUND THEN RAISE EXCEPTION 'CHECKOUT_CUSTOMER_TOTAL_CONFLICT' USING ERRCODE='23514';END IF;
  END IF;
  UPDATE public.sale_payment_intents SET "Status"=5,"UpdatedAtUtc"=now() WHERE "TenantId"=t AND "SaleId"=sid AND "Id"=c.payment_id AND "Status"=2;
  IF NOT FOUND THEN RAISE EXCEPTION 'CHECKOUT_PAYMENT_CONFLICT' USING ERRCODE='23514';END IF;
  UPDATE public.sales SET "Status"=6,"PaymentStatus"=7,"FulfillmentStatus"=4,"CancelledAtUtc"=now(),"UpdatedAtUtc"=now() WHERE "TenantId"=t AND "BranchId"=b AND "Id"=sid;
  UPDATE public.internal_checkout_records_v5 SET state='CANCELLED',cancelled_at=now() WHERE tenant_id=t AND branch_id=b AND sale_id=sid;
  result:=jsonb_build_object('saleId',sid,'state','CANCELLED','refund',c.total,'reason',reason);
 END IF;
 INSERT INTO public.internal_checkout_actions_v5(tenant_id,branch_id,request_id,sale_id,actor_id,action,payload,result) VALUES(t,b,req,sid,u,act,p,result);
 INSERT INTO public.audit_events("Id","TenantId","BranchId","EntityType","EntityId","Action","ActorId","ActorEmail","CorrelationId","AfterStateJson","CreatedAtUtc","Version") SELECT gen_random_uuid(),t,b,'InternalCheckout',sid::text,act,u,x."Email",req::text,result,now(),1 FROM public.users x WHERE x."Id"=u;
 RETURN result;
END $function$;

CREATE FUNCTION public.internal_checkout_authorize_v5(t uuid, b uuid, u uuid, perm text)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
 IF NOT public.internal_checkout_qa_enabled_v5() THEN RAISE EXCEPTION 'CHECKOUT_QA_ONLY' USING ERRCODE='42501';END IF;
 PERFORM public.factory_assert_actor_v2(t,b,u);
 IF EXISTS(SELECT 1 FROM unnest(ARRAY['sales.pos.use',perm]) k WHERE NOT EXISTS(SELECT 1 FROM public.user_roles ur JOIN public.role_permissions rp ON rp."TenantId"=ur."TenantId" AND rp."RoleId"=ur."RoleId" WHERE ur."TenantId"=t AND ur."UserId"=u AND rp."PermissionKey"=k)) THEN RAISE EXCEPTION 'CHECKOUT_PERMISSION' USING ERRCODE='42501';END IF;
END $function$;

CREATE FUNCTION public.internal_checkout_cash_v5(t uuid, b uuid, u uuid, req uuid, p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE prev public.internal_checkout_records_v5%ROWTYPE; cfg public.internal_checkout_config_v5%ROWTYPE; sh public.cash_shifts%ROWTYPE;
 o public.manufacturing_orders%ROWTYPE; d public.manufacturing_factory_order_details%ROWTYPE; cap public.factory_material_capitalization_v5%ROWTYPE;
 sb public.stock_balances%ROWTYPE; line jsonb; rows jsonb:='[]'::jsonb; lr jsonb; customer uuid; ord uuid; shift_id uuid;
 sid uuid:=gen_random_uuid();pid uuid:=gen_random_uuid();mid uuid:=gen_random_uuid();eid uuid;cid uuid;item_id uuid; bal uuid;sku uuid;
 code text;descr text;kind integer;serial_policy integer;unit_price numeric;unit_cost numeric;qty numeric;cost numeric;total numeric:=0;stock_cost numeric:=0;managerial numeric:=0;waste_cost numeric:=0;tendered numeric;expected numeric;number text;rev_account uuid;asset_account uuid;ref text;result jsonb;
BEGIN
 PERFORM public.internal_checkout_authorize_v5(t,b,u,'sales.create');
 IF req IS NULL OR jsonb_typeof(p) IS DISTINCT FROM 'object' OR jsonb_typeof(p->'cashConfirmed') IS DISTINCT FROM 'boolean' OR (p->>'cashConfirmed')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'CHECKOUT_CASH_CONFIRMATION_REQUIRED' USING ERRCODE='22023';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(t::text||b::text||req::text,6));
 SELECT * INTO prev FROM public.internal_checkout_records_v5 WHERE tenant_id=t AND branch_id=b AND request_id=req;
 IF FOUND THEN
  IF prev.payload<>p OR prev.actor_id<>u THEN RAISE EXCEPTION 'CHECKOUT_IDEMPOTENCY_CONFLICT' USING ERRCODE='23514';END IF;
  RETURN jsonb_build_object('saleId',prev.sale_id,'number',(SELECT z."SaleNumber" FROM public.sales z WHERE z."TenantId"=t AND z."BranchId"=b AND z."Id"=prev.sale_id),'total',prev.total,'change',prev.change_amount,'state',prev.state,'fiscalIssued',false,'replayed',true);
 END IF;
 cfg:=public.internal_checkout_config_get_v5(t,b);
 shift_id:=(p->>'shiftId')::uuid;ord:=(p->>'orderId')::uuid;customer:=(p->>'customerId')::uuid;
 tendered:=public.factory_number_v2(p,'tendered',0.01,1000000);expected:=public.factory_number_v2(p,'expectedTotal',0.01,1000000);
 IF tendered<>round(tendered,2) OR expected<>round(expected,2) THEN RAISE EXCEPTION 'CHECKOUT_CENTS_REQUIRED' USING ERRCODE='22023';END IF;
 SELECT * INTO sh FROM public.cash_shifts WHERE "TenantId"=t AND "BranchId"=b AND "Id"=shift_id FOR UPDATE;
 IF NOT FOUND OR sh."Status"<>1 OR sh."OperatorUserId"<>u OR NOT EXISTS(SELECT 1 FROM public.cash_registers cr WHERE cr."TenantId"=t AND cr."BranchId"=b AND cr."Id"=sh."CashRegisterId" AND cr."Status"=1) THEN RAISE EXCEPTION 'CHECKOUT_SHIFT_NOT_OPEN' USING ERRCODE='23514';END IF;
 IF ord IS NOT NULL THEN
  IF p ? 'items' AND p->'items'<>'[]'::jsonb THEN RAISE EXCEPTION 'CHECKOUT_FACTORY_NO_MIXED_CART' USING ERRCODE='22023';END IF;
  SELECT * INTO o FROM public.manufacturing_orders WHERE "TenantId"=t AND "BranchId"=b AND "Id"=ord FOR UPDATE;
  IF NOT FOUND OR o."Status"<>12 OR o."SalesOrderId" IS NOT NULL OR o."ApprovedQuantity"<>o."PlannedQuantity" THEN RAISE EXCEPTION 'CHECKOUT_ORDER_NOT_READY' USING ERRCODE='23514';END IF;
  SELECT * INTO d FROM public.manufacturing_factory_order_details WHERE tenant_id=t AND branch_id=b AND order_id=ord;
  IF NOT FOUND OR d.version<>public.factory_number_v2(p,'version',1,2147483647,true) OR (customer IS NOT NULL AND customer<>d.customer_id) OR EXISTS(SELECT 1 FROM public.manufacturing_material_allocations a WHERE a.tenant_id=t AND a.branch_id=b AND a.order_id=ord AND a.state='RESERVED') THEN RAISE EXCEPTION 'CHECKOUT_ORDER_CONFLICT' USING ERRCODE='23514';END IF;
  customer:=d.customer_id;total:=d.approved_price;managerial:=o."ActualMaterialCost"+o."ActualWasteCost"+o."ActualEnergyCost"+o."ActualMachineCost"+o."ActualLaborCost";
  SELECT * INTO cap FROM public.factory_material_capitalization_v5 WHERE tenant_id=t AND branch_id=b AND order_id=ord;
  IF NOT FOUND THEN
   IF EXISTS(SELECT 1 FROM public.manufacturing_material_allocations a WHERE a.tenant_id=t AND a.branch_id=b AND a.order_id=ord AND a.state='CONSUMED' AND NOT EXISTS(SELECT 1 FROM public.stock_movements m WHERE m."TenantId"=t AND m."BranchId"=b AND m."IdempotencyKey"='FAB-CONSUME-'||a.id::text AND m."MovementType"=10)) THEN RAISE EXCEPTION 'CHECKOUT_MISSING_KARDEX' USING ERRCODE='23514';END IF;
   SELECT coalesce(sum(m."TotalCost") FILTER(WHERE NOT a.waste),0),coalesce(sum(m."TotalCost") FILTER(WHERE a.waste),0) INTO stock_cost,waste_cost FROM public.manufacturing_material_allocations a JOIN public.stock_movements m ON m."TenantId"=a.tenant_id AND m."BranchId"=a.branch_id AND m."IdempotencyKey"='FAB-CONSUME-'||a.id::text AND m."MovementType"=10 WHERE a.tenant_id=t AND a.branch_id=b AND a.order_id=ord AND a.state='CONSUMED';
   eid:=public.internal_checkout_journal_v5(t,b,u,'FACTORY_MATERIAL_COMPLETE',ord,o."OrderNumber",'Apropriação de material ao produto acabado',cfg.finished_account,cfg.stock_account,stock_cost);
   cid:=public.internal_checkout_journal_v5(t,b,u,'FACTORY_MATERIAL_WASTE',ord,o."OrderNumber",'Refugo de material na produção',cfg.waste_account,cfg.stock_account,waste_cost);
   INSERT INTO public.factory_material_capitalization_v5(tenant_id,branch_id,order_id,productive_cost,waste_cost,productive_entry,waste_entry) VALUES(t,b,ord,stock_cost,waste_cost,eid,cid);
  ELSE stock_cost:=cap.productive_cost;END IF;
  SELECT s."SkuCode" INTO code FROM public.product_skus s WHERE s."TenantId"=t AND s."Id"=cfg.factory_sku;
  rows:=jsonb_build_array(jsonb_build_object('sku',cfg.factory_sku,'code',code,'description',left(d.title||' — '||o."ApprovedQuantity"||' peça(s) · '||o."OrderNumber",300),'quantity',1,'price',total,'unitCost',stock_cost,'balance',null));
  rev_account:=cfg.factory_revenue_account;asset_account:=cfg.finished_account;
 ELSE
  IF jsonb_typeof(p->'items') IS DISTINCT FROM 'array' OR jsonb_array_length(p->'items') NOT BETWEEN 1 AND 100 OR EXISTS(SELECT 1 FROM jsonb_array_elements(p->'items') x GROUP BY (x->>'balanceId')::uuid HAVING count(*)>1) THEN RAISE EXCEPTION 'CHECKOUT_ITEMS_INVALID' USING ERRCODE='22023';END IF;
  FOR line IN SELECT x FROM jsonb_array_elements(p->'items') x ORDER BY (x->>'balanceId')::uuid LOOP
   bal:=(line->>'balanceId')::uuid;qty:=public.factory_number_v2(line,'quantity',1,100000,true);
   SELECT * INTO sb FROM public.stock_balances WHERE "TenantId"=t AND "BranchId"=b AND "Id"=bal FOR UPDATE;
   IF NOT FOUND OR qty>sb."OnHandQuantity"-sb."ReservedQuantity"-sb."BlockedQuantity" OR EXISTS(SELECT 1 FROM public.manufacturing_material_balance_configs c WHERE c.tenant_id=t AND c.branch_id=b AND c.balance_id=bal) OR NOT EXISTS(SELECT 1 FROM public.warehouses w WHERE w."TenantId"=t AND w."BranchId"=b AND w."Id"=sb."WarehouseId" AND w."IsActive") THEN RAISE EXCEPTION 'CHECKOUT_STOCK_UNAVAILABLE' USING ERRCODE='23514';END IF;
   SELECT s."Id",s."SkuCode",left(m."Name"||' · '||s."VariantName",300),s."DefaultPrice",m."Kind",m."SerializationPolicy" INTO sku,code,descr,unit_price,kind,serial_policy FROM public.product_skus s JOIN public.product_models m ON m."Id"=s."ProductModelId" AND m."TenantId"=t AND m."IsActive" WHERE s."TenantId"=t AND s."Id"=sb."ProductSkuId" AND s."IsActive";
   IF NOT FOUND OR kind<>1 OR serial_policy<>0 OR unit_price<=0 OR unit_price<>round(unit_price,2) OR sb."AverageCost"<0 OR sb."AverageCost"<>round(sb."AverageCost",2) THEN RAISE EXCEPTION 'CHECKOUT_SKU_NOT_SUPPORTED' USING ERRCODE='23514';END IF;
   unit_cost:=round(sb."AverageCost",2);cost:=round(qty*sb."AverageCost",2);total:=total+qty*unit_price;stock_cost:=stock_cost+cost;managerial:=managerial+qty*sb."AverageCost";
   rows:=rows||jsonb_build_array(jsonb_build_object('sku',sku,'code',code,'description',descr,'quantity',qty,'price',unit_price,'unitCost',unit_cost,'cost',cost,'balance',bal));
  END LOOP;
  rev_account:=cfg.goods_revenue_account;asset_account:=cfg.stock_account;
 END IF;
 IF customer IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.parties x JOIN public.customer_profiles cp ON cp."TenantId"=x."TenantId" AND cp."PartyId"=x."Id" WHERE x."TenantId"=t AND x."Id"=customer AND x."IsActive") THEN RAISE EXCEPTION 'CHECKOUT_CUSTOMER_INVALID' USING ERRCODE='22023';END IF;
 IF total<>expected OR total<=0 OR tendered<total THEN RAISE EXCEPTION 'CHECKOUT_PRICE_OR_TENDER_CONFLICT' USING ERRCODE='23514';END IF;
 number:='QA-VD-'||upper(replace(sid::text,'-',''));
 INSERT INTO public.sales("Id","TenantId","BranchId","SaleNumber","CustomerPartyId","SellerUserId","CreatedByUserId","Status","PaymentStatus","FulfillmentStatus","DiscountTotal","ChargesTotal","Observations","IdempotencyKey","CreatedAtUtc") VALUES(sid,t,b,number,customer,u,u,1,1,1,0,0,'Homologação interna isolada; sem emissão fiscal.','QA-CHECKOUT-'||req::text,now());
 FOR lr IN SELECT x FROM jsonb_array_elements(rows) x LOOP
  item_id:=gen_random_uuid();bal:=(lr->>'balance')::uuid;qty:=(lr->>'quantity')::numeric;
  INSERT INTO public.sale_items("Id","TenantId","SaleId","ProductSkuId","HistoricalSkuCode","HistoricalDescription","ItemCondition","Quantity","UnitPrice","Discount","HistoricalUnitCost","WarrantyDays","CreatedAtUtc")
  VALUES(item_id,t,sid,(lr->>'sku')::uuid,lr->>'code',lr->>'description',1,qty,(lr->>'price')::numeric,0,(lr->>'unitCost')::numeric,0,now());
  IF bal IS NOT NULL THEN
   SELECT * INTO sb FROM public.stock_balances WHERE "TenantId"=t AND "BranchId"=b AND "Id"=bal FOR UPDATE;
   UPDATE public.stock_balances SET "OnHandQuantity"="OnHandQuantity"-qty,"LastMovementAtUtc"=now(),"UpdatedAtUtc"=now() WHERE "TenantId"=t AND "BranchId"=b AND "Id"=bal;
   INSERT INTO public.stock_movements("Id","TenantId","BranchId","WarehouseId","WarehouseLocationId","ProductSkuId","MovementType","Quantity","UnitCost","TotalCost","BalanceAfterQuantity","DocumentReference","Reason","CorrelationId","IdempotencyKey","CreatedByUserId","CreatedAtUtc") VALUES(gen_random_uuid(),t,b,sb."WarehouseId",sb."WarehouseLocationId",sb."ProductSkuId",4,-qty,sb."AverageCost",(lr->>'cost')::numeric,sb."OnHandQuantity"-qty,number,'Venda interna QA',sid,'QA-SALE-OUT-'||item_id::text,u,now());
  END IF;
 END LOOP;
 INSERT INTO public.sale_payment_intents("Id","TenantId","SaleId","Method","Amount","Installments","Status","AuthorizationCode","Notes","ConfirmedAtUtc","CreatedAtUtc") VALUES(pid,t,sid,1,total,1,2,'OPERATOR-CASH-QA','Dinheiro registrado pelo operador em homologação',now(),now());
 INSERT INTO public.cash_movements("Id","TenantId","BranchId","CashRegisterId","CashShiftId","MovementType","Direction","Amount","SourceType","SourceId","DocumentReference","Reason","CreatedByUserId","CorrelationId","IdempotencyKey","CreatedAtUtc") VALUES(mid,t,b,sh."CashRegisterId",shift_id,2,1,total,'SALE_PAYMENT',pid::text,number,'Recebimento em dinheiro QA',u,sid::text,'QA-SALE-CASH-'||sid::text,now());
 UPDATE public.cash_shifts SET "CurrentBalance"="CurrentBalance"+total,"TotalCashIn"="TotalCashIn"+total,"UpdatedAtUtc"=now() WHERE "TenantId"=t AND "BranchId"=b AND "Id"=shift_id;
 eid:=public.internal_checkout_journal_v5(t,b,u,'QA_SALE_REVENUE',sid,number,'Receita em dinheiro — homologação',cfg.cash_account,rev_account,total);
 cid:=public.internal_checkout_journal_v5(t,b,u,'QA_SALE_COGS',sid,number,'Custo de estoque vendido — homologação',cfg.cogs_account,asset_account,stock_cost);
 INSERT INTO public.internal_checkout_records_v5(tenant_id,branch_id,sale_id,request_id,actor_id,shift_id,order_id,customer_id,payload,total,tendered,change_amount,material_cost,managerial_cost,payment_id,cash_movement_id,revenue_entry_id,cogs_entry_id,state)
 VALUES(t,b,sid,req,u,shift_id,ord,customer,p,total,tendered,tendered-total,stock_cost,managerial,pid,mid,eid,cid,'REGISTERED');
 FOR lr IN SELECT x FROM jsonb_array_elements(rows) x WHERE x->>'balance' IS NOT NULL LOOP
  SELECT i."Id" INTO item_id FROM public.sale_items i JOIN public.stock_movements m ON m."IdempotencyKey"='QA-SALE-OUT-'||i."Id"::text AND m."TenantId"=t AND m."BranchId"=b JOIN public.stock_balances z ON z."TenantId"=t AND z."BranchId"=b AND z."Id"=(lr->>'balance')::uuid AND z."WarehouseId"=m."WarehouseId" AND z."WarehouseLocationId" IS NOT DISTINCT FROM m."WarehouseLocationId" AND z."ProductSkuId"=m."ProductSkuId" WHERE i."TenantId"=t AND i."SaleId"=sid AND i."ProductSkuId"=(lr->>'sku')::uuid;
  INSERT INTO public.internal_checkout_stock_lines_v5(tenant_id,branch_id,sale_id,sale_item_id,balance_id,quantity,cost) VALUES(t,b,sid,item_id,(lr->>'balance')::uuid,(lr->>'quantity')::numeric,(lr->>'cost')::numeric);
 END LOOP;
 IF ord IS NOT NULL THEN
  PERFORM set_config('hbstudio.factory_order_command',ord::text,true);
  UPDATE public.manufacturing_orders SET "SalesOrderId"=sid,"UpdatedAtUtc"=now() WHERE "TenantId"=t AND "BranchId"=b AND "Id"=ord;
  UPDATE public.manufacturing_factory_order_details SET version=version+1 WHERE tenant_id=t AND branch_id=b AND order_id=ord;
 END IF;
 IF customer IS NOT NULL THEN UPDATE public.customer_profiles SET "TotalSalesValue"="TotalSalesValue"+total,"UpdatedAtUtc"=now() WHERE "TenantId"=t AND "PartyId"=customer;END IF;
 PERFORM set_config('hbstudio.checkout_command',sid::text,true);
 UPDATE public.sales SET "Status"=4,"PaymentStatus"=4,"FulfillmentStatus"=2,"ConfirmedAtUtc"=now(),"UpdatedAtUtc"=now() WHERE "Id"=sid AND "TenantId"=t AND "BranchId"=b;
 result:=jsonb_build_object('saleId',sid,'number',number,'total',total,'change',tendered-total,'state','REGISTERED','fiscalIssued',false,'replayed',false);
 INSERT INTO public.audit_events("Id","TenantId","BranchId","EntityType","EntityId","Action","ActorId","ActorEmail","CorrelationId","AfterStateJson","CreatedAtUtc","Version") SELECT gen_random_uuid(),t,b,'InternalCheckout',sid::text,'CashRegistered',u,x."Email",req::text,result,now(),1 FROM public.users x WHERE x."Id"=u;
 RETURN result;
END $function$;

CREATE FUNCTION public.internal_checkout_config_get_v5(t uuid, b uuid)
 RETURNS internal_checkout_config_v5
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE c public.internal_checkout_config_v5%ROWTYPE;
BEGIN
 SELECT * INTO c FROM public.internal_checkout_config_v5 WHERE tenant_id=t AND branch_id=b FOR SHARE;
 IF NOT FOUND OR (SELECT count(DISTINCT v) FROM unnest(ARRAY[c.cash_account,c.goods_revenue_account,c.factory_revenue_account,c.stock_account,c.finished_account,c.cogs_account,c.waste_account]) v)<>7 OR
 EXISTS(SELECT 1 FROM (VALUES(c.cash_account,1),(c.goods_revenue_account,4),(c.factory_revenue_account,4),(c.stock_account,1),(c.finished_account,1),(c.cogs_account,5),(c.waste_account,5)) a(id,typ) WHERE NOT EXISTS(SELECT 1 FROM public.financial_accounts f WHERE f."TenantId"=t AND f."Id"=a.id AND f."IsActive" AND f."Type"=a.typ))
 OR NOT EXISTS(SELECT 1 FROM public.product_skus s JOIN public.product_models m ON m."Id"=s."ProductModelId" AND m."TenantId"=s."TenantId" WHERE s."TenantId"=t AND s."Id"=c.factory_sku AND s."IsActive" AND m."IsActive" AND m."Kind"=5 AND m."SerializationPolicy"=0) THEN RAISE EXCEPTION 'CHECKOUT_ACCOUNT_CONFIG' USING ERRCODE='23514';END IF;
 RETURN c;
END $function$;

CREATE FUNCTION public.internal_checkout_guard_detail_v5()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE sid uuid;tid uuid;
BEGIN
 IF TG_OP='INSERT' THEN sid:=NEW."SaleId";tid:=NEW."TenantId";ELSE sid:=OLD."SaleId";tid:=OLD."TenantId";END IF;
 IF EXISTS(SELECT 1 FROM public.internal_checkout_records_v5 r WHERE r.tenant_id=tid AND r.sale_id=sid) AND (TG_OP='DELETE' OR current_setting('hbstudio.checkout_command',true) IS DISTINCT FROM sid::text) THEN RAISE EXCEPTION 'CHECKOUT_MANAGED_DETAIL' USING ERRCODE='23514';END IF;
 IF TG_OP='DELETE' THEN RETURN OLD;END IF;RETURN NEW;
END $function$;

CREATE FUNCTION public.internal_checkout_guard_sale_v5()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
 IF EXISTS(SELECT 1 FROM public.internal_checkout_records_v5 r WHERE r.tenant_id=OLD."TenantId" AND r.branch_id=OLD."BranchId" AND r.sale_id=OLD."Id") THEN
  IF TG_OP='DELETE' OR current_setting('hbstudio.checkout_command',true) IS DISTINCT FROM OLD."Id"::text THEN RAISE EXCEPTION 'CHECKOUT_MANAGED_SALE' USING ERRCODE='23514';END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD;END IF;RETURN NEW;
END $function$;

CREATE FUNCTION public.internal_checkout_journal_v5(t uuid, b uuid, u uuid, source text, source_id uuid, doc text, descr text, dr uuid, cr uuid, amt numeric, rev uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE eid uuid:=gen_random_uuid();
BEGIN
 IF amt=0 THEN RETURN NULL;END IF;
 IF amt IS NULL OR amt<0 OR amt<>round(amt,2) OR dr=cr OR (SELECT count(*) FROM public.financial_accounts WHERE "TenantId"=t AND "IsActive" AND "Id" IN(dr,cr))<>2 THEN RAISE EXCEPTION 'CHECKOUT_ACCOUNT_CONFIG' USING ERRCODE='23514';END IF;
 INSERT INTO public.financial_journal_entries("Id","TenantId","BranchId","CompetenceDateUtc","DocumentNumber","SourceType","SourceId","Description","TotalAmount","CreatedByUserId","CorrelationId","IdempotencyKey","ReversalOfEntryId","CreatedAtUtc")
 VALUES(eid,t,b,now(),doc,source,source_id::text,descr,amt,u,source_id::text,source||':'||source_id::text,rev,now());
 INSERT INTO public.financial_journal_lines("Id","TenantId","FinancialJournalEntryId","FinancialAccountId","Direction","Amount","Memo","CreatedAtUtc")
 VALUES(gen_random_uuid(),t,eid,dr,1,amt,descr,now()),(gen_random_uuid(),t,eid,cr,2,amt,descr,now());
 RETURN eid;
END $function$;

CREATE FUNCTION public.internal_checkout_qa_enabled_v5()
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE ok boolean;
BEGIN
 IF to_regclass('factory_qa.environment_guard') IS NULL THEN RETURN false;END IF;
 EXECUTE 'SELECT EXISTS(SELECT 1 FROM factory_qa.environment_guard WHERE name=$1)' INTO ok USING 'qa-factory-operational-v2-20261125';
 RETURN coalesce(ok,false);
END $function$;

CREATE FUNCTION public.internal_checkout_reverse_journal_v5(t uuid, b uuid, u uuid, sid uuid, original uuid, source text, doc text, descr text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE e public.financial_journal_entries%ROWTYPE;dr uuid;cr uuid;
BEGIN
 IF original IS NULL THEN RETURN NULL;END IF;
 SELECT * INTO e FROM public.financial_journal_entries WHERE "TenantId"=t AND "BranchId"=b AND "Id"=original FOR SHARE;
 IF NOT FOUND OR e."SourceId"<>sid::text OR EXISTS(SELECT 1 FROM public.financial_journal_entries WHERE "TenantId"=t AND "BranchId"=b AND "ReversalOfEntryId"=original) THEN RAISE EXCEPTION 'CHECKOUT_JOURNAL_REVERSAL_CONFLICT' USING ERRCODE='23514';END IF;
 IF (SELECT count(*) FROM public.financial_journal_lines WHERE "TenantId"=t AND "FinancialJournalEntryId"=original)<>2 THEN RAISE EXCEPTION 'CHECKOUT_JOURNAL_INVALID' USING ERRCODE='23514';END IF;
 SELECT "FinancialAccountId" INTO dr FROM public.financial_journal_lines WHERE "TenantId"=t AND "FinancialJournalEntryId"=original AND "Direction"=2 AND "Amount"=e."TotalAmount";
 SELECT "FinancialAccountId" INTO cr FROM public.financial_journal_lines WHERE "TenantId"=t AND "FinancialJournalEntryId"=original AND "Direction"=1 AND "Amount"=e."TotalAmount";
 IF dr IS NULL OR cr IS NULL THEN RAISE EXCEPTION 'CHECKOUT_JOURNAL_INVALID' USING ERRCODE='23514';END IF;
 RETURN public.internal_checkout_journal_v5(t,b,u,source,sid,doc,descr,dr,cr,e."TotalAmount",original);
END $function$;

CREATE TRIGGER internal_checkout_guard_items_v5 BEFORE INSERT OR DELETE OR UPDATE ON public.sale_items FOR EACH ROW EXECUTE FUNCTION internal_checkout_guard_detail_v5();

CREATE TRIGGER internal_checkout_guard_payments_v5 BEFORE INSERT OR DELETE OR UPDATE ON public.sale_payment_intents FOR EACH ROW EXECUTE FUNCTION internal_checkout_guard_detail_v5();

CREATE TRIGGER internal_checkout_guard_sale_v5 BEFORE DELETE OR UPDATE ON public.sales FOR EACH ROW EXECUTE FUNCTION internal_checkout_guard_sale_v5();

COMMIT;
