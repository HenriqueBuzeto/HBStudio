-- Fábrica 3D: additive operational core; apply after 20261125_manufacturing_estimate_cost_v1.sql.

-- Tested in Neon QA. Existing material balances retain their native stock units.

-- No payment, fiscal authorization, supplier invoice or finished-good entry is generated.

-- Deploy only after EF compatibility, app permission and E2E gates pass.

BEGIN;

CREATE UNIQUE INDEX ux_factory_attempt_scope_v2 ON public.manufacturing_print_attempts USING btree ("TenantId", "Id");

CREATE UNIQUE INDEX ux_factory_order_scope_v2 ON public.manufacturing_orders USING btree ("TenantId", "BranchId", "Id");

CREATE UNIQUE INDEX ux_factory_party_scope_v2 ON public.parties USING btree ("TenantId", "Id");

CREATE UNIQUE INDEX ux_factory_printer_code_v2 ON public.manufacturing_printers USING btree ("TenantId", "BranchId", upper(btrim("Code")));

CREATE UNIQUE INDEX ux_factory_printer_scope_v2 ON public.manufacturing_printers USING btree ("TenantId", "BranchId", "Id");

CREATE UNIQUE INDEX ux_factory_reservation_scope_v2 ON public.stock_reservations USING btree ("TenantId", "BranchId", "Id");

CREATE UNIQUE INDEX ux_factory_spool_scope_v2 ON public.manufacturing_spools USING btree ("TenantId", "BranchId", "Id");

CREATE UNIQUE INDEX ux_factory_stock_scope_v2 ON public.stock_balances USING btree ("TenantId", "BranchId", "Id");

CREATE TABLE public.manufacturing_material_balance_configs (
 "tenant_id" uuid NOT NULL,
 "branch_id" uuid NOT NULL,
 "balance_id" uuid NOT NULL,
 "kind" text NOT NULL,
 "material_type" text NOT NULL,
 "color" text NOT NULL,
 "units_per_stock_unit" numeric(18,6) NOT NULL,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 CONSTRAINT "manufacturing_material_balanc_tenant_id_branch_id_balance__fkey" FOREIGN KEY (tenant_id, branch_id, balance_id) REFERENCES stock_balances("TenantId", "BranchId", "Id"),
 CONSTRAINT "manufacturing_material_balance_confi_units_per_stock_unit_check" CHECK ((units_per_stock_unit > (0)::numeric)),
 CONSTRAINT "manufacturing_material_balance_configs_check" CHECK ((((kind = 'SUPPLY'::text) AND (units_per_stock_unit = (1)::numeric) AND (color = ''::text)) OR ((kind = 'FILAMENT'::text) AND (length(color) > 0)))),
 CONSTRAINT "manufacturing_material_balance_configs_color_check" CHECK ((length(color) <= 80)),
 CONSTRAINT "manufacturing_material_balance_configs_kind_check" CHECK ((kind = ANY (ARRAY['FILAMENT'::text, 'SUPPLY'::text]))),
 CONSTRAINT "manufacturing_material_balance_configs_material_type_check" CHECK (((length(material_type) >= 1) AND (length(material_type) <= 80))),
 CONSTRAINT "manufacturing_material_balance_configs_pkey" PRIMARY KEY (tenant_id, branch_id, balance_id)
);

CREATE TABLE public.manufacturing_spool_details (
 "tenant_id" uuid NOT NULL,
 "branch_id" uuid NOT NULL,
 "spool_id" uuid NOT NULL,
 "balance_id" uuid NOT NULL,
 "group_key" text NOT NULL,
 "sequence_no" bigint NOT NULL,
 "cost_per_gram" numeric(24,10) NOT NULL,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 CONSTRAINT "manufacturing_spool_details_cost_per_gram_check" CHECK ((cost_per_gram >= (0)::numeric)),
 CONSTRAINT "manufacturing_spool_details_pkey" PRIMARY KEY (tenant_id, branch_id, spool_id),
 CONSTRAINT "manufacturing_spool_details_sequence_no_check" CHECK ((sequence_no > 0)),
 CONSTRAINT "manufacturing_spool_details_tenant_id_branch_id_balance_id__key" UNIQUE (tenant_id, branch_id, balance_id, spool_id),
 CONSTRAINT "manufacturing_spool_details_tenant_id_branch_id_balance_id_fkey" FOREIGN KEY (tenant_id, branch_id, balance_id) REFERENCES manufacturing_material_balance_configs(tenant_id, branch_id, balance_id),
 CONSTRAINT "manufacturing_spool_details_tenant_id_branch_id_group_key_s_key" UNIQUE (tenant_id, branch_id, group_key, sequence_no),
 CONSTRAINT "manufacturing_spool_details_tenant_id_branch_id_spool_id_fkey" FOREIGN KEY (tenant_id, branch_id, spool_id) REFERENCES manufacturing_spools("TenantId", "BranchId", "Id")
);

CREATE TABLE public.manufacturing_spool_registration_requests (
 "tenant_id" uuid NOT NULL,
 "branch_id" uuid NOT NULL,
 "request_id" uuid NOT NULL,
 "request_payload" jsonb NOT NULL,
 "result" jsonb NOT NULL,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 CONSTRAINT "manufacturing_spool_registration_requests_pkey" PRIMARY KEY (tenant_id, branch_id, request_id)
);

CREATE TABLE public.manufacturing_material_allocations (
 "tenant_id" uuid NOT NULL,
 "branch_id" uuid NOT NULL,
 "id" uuid NOT NULL,
 "order_id" uuid NOT NULL,
 "balance_id" uuid NOT NULL,
 "spool_id" uuid,
 "reservation_id" uuid NOT NULL,
 "planned_quantity" numeric(18,6) NOT NULL,
 "units_per_stock_unit" numeric(18,6) NOT NULL,
 "planned_stock_quantity" numeric(18,4) NOT NULL,
 "unit_cost_snapshot" numeric(24,10) NOT NULL,
 "state" text NOT NULL,
 "actual_quantity" numeric(18,6),
 "actual_stock_quantity" numeric(18,4),
 "actual_stock_cost" numeric(18,6),
 "settlement_request_id" uuid,
 "waste" boolean,
 "attempt_id" uuid,
 "created_by" uuid NOT NULL,
 "settled_by" uuid,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 "settled_at" timestamp with time zone,
 CONSTRAINT "manufacturing_material_alloc_tenant_id_branch_id_balance__fkey1" FOREIGN KEY (tenant_id, branch_id, balance_id, spool_id) REFERENCES manufacturing_spool_details(tenant_id, branch_id, balance_id, spool_id),
 CONSTRAINT "manufacturing_material_alloca_tenant_id_branch_id_balance__fkey" FOREIGN KEY (tenant_id, branch_id, balance_id) REFERENCES manufacturing_material_balance_configs(tenant_id, branch_id, balance_id),
 CONSTRAINT "manufacturing_material_alloca_tenant_id_branch_id_order_id_fkey" FOREIGN KEY (tenant_id, branch_id, order_id) REFERENCES manufacturing_orders("TenantId", "BranchId", "Id"),
 CONSTRAINT "manufacturing_material_alloca_tenant_id_branch_id_reservat_fkey" FOREIGN KEY (tenant_id, branch_id, reservation_id) REFERENCES stock_reservations("TenantId", "BranchId", "Id"),
 CONSTRAINT "manufacturing_material_alloca_tenant_id_branch_id_reservati_key" UNIQUE (tenant_id, branch_id, reservation_id),
 CONSTRAINT "manufacturing_material_alloca_tenant_id_branch_id_settlemen_key" UNIQUE (tenant_id, branch_id, settlement_request_id),
 CONSTRAINT "manufacturing_material_allocations_check" CHECK ((((state = 'RESERVED'::text) AND (actual_quantity IS NULL) AND (settlement_request_id IS NULL) AND (settled_at IS NULL)) OR ((state = 'CONSUMED'::text) AND (actual_quantity > (0)::numeric) AND (actual_quantity <= planned_quantity) AND (actual_stock_quantity > (0)::numeric) AND (actual_stock_cost >= (0)::numeric) AND (settlement_request_id IS NOT NULL) AND (settled_at IS NOT NULL)) OR ((state = 'RELEASED'::text) AND (actual_quantity = (0)::numeric) AND (actual_stock_quantity = (0)::numeric) AND (actual_stock_cost = (0)::numeric) AND (settlement_request_id IS NOT NULL) AND (settled_at IS NOT NULL)))),
 CONSTRAINT "manufacturing_material_allocations_pkey" PRIMARY KEY (tenant_id, branch_id, id),
 CONSTRAINT "manufacturing_material_allocations_planned_quantity_check" CHECK ((planned_quantity > (0)::numeric)),
 CONSTRAINT "manufacturing_material_allocations_planned_stock_quantity_check" CHECK ((planned_stock_quantity > (0)::numeric)),
 CONSTRAINT "manufacturing_material_allocations_state_check" CHECK ((state = ANY (ARRAY['RESERVED'::text, 'CONSUMED'::text, 'RELEASED'::text]))),
 CONSTRAINT "manufacturing_material_allocations_unit_cost_snapshot_check" CHECK ((unit_cost_snapshot >= (0)::numeric)),
 CONSTRAINT "manufacturing_material_allocations_units_per_stock_unit_check" CHECK ((units_per_stock_unit > (0)::numeric))
);

CREATE TABLE public.manufacturing_factory_commands (
 "tenant_id" uuid NOT NULL,
 "branch_id" uuid NOT NULL,
 "request_id" uuid NOT NULL,
 "action" text NOT NULL,
 "payload" jsonb NOT NULL,
 "result" jsonb NOT NULL,
 "actor_id" uuid NOT NULL,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 CONSTRAINT "manufacturing_factory_commands_pkey" PRIMARY KEY (tenant_id, branch_id, request_id)
);

CREATE TABLE public.manufacturing_factory_order_details (
 "tenant_id" uuid NOT NULL,
 "branch_id" uuid NOT NULL,
 "order_id" uuid NOT NULL,
 "sequence_no" bigint NOT NULL,
 "customer_id" uuid NOT NULL,
 "title" text NOT NULL,
 "notes" text NOT NULL,
 "due_at" timestamp with time zone,
 "estimated_seconds" integer NOT NULL,
 "estimated_labor_seconds" integer NOT NULL,
 "tariff" numeric(18,6) NOT NULL,
 "labor_hour" numeric(18,6) NOT NULL,
 "other_estimate" numeric(18,6) NOT NULL,
 "waste_pct" numeric(8,4) NOT NULL,
 "margin_pct" numeric(8,4) NOT NULL,
 "fee_pct" numeric(8,4) NOT NULL,
 "approved_price" numeric(18,2) NOT NULL,
 "price_recorded_by" uuid NOT NULL,
 "price_recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
 "estimate_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
 "version" integer DEFAULT 1 NOT NULL,
 "cancel_reason" text,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 CONSTRAINT "manufacturing_factory_order_d_tenant_id_branch_id_order_id_fkey" FOREIGN KEY (tenant_id, branch_id, order_id) REFERENCES manufacturing_orders("TenantId", "BranchId", "Id"),
 CONSTRAINT "manufacturing_factory_order_d_tenant_id_branch_id_sequence__key" UNIQUE (tenant_id, branch_id, sequence_no),
 CONSTRAINT "manufacturing_factory_order_detai_estimated_labor_seconds_check" CHECK ((estimated_labor_seconds >= 0)),
 CONSTRAINT "manufacturing_factory_order_details_approved_price_check" CHECK ((approved_price > (0)::numeric)),
 CONSTRAINT "manufacturing_factory_order_details_check" CHECK (((margin_pct + fee_pct) < (100)::numeric)),
 CONSTRAINT "manufacturing_factory_order_details_estimated_seconds_check" CHECK ((estimated_seconds > 0)),
 CONSTRAINT "manufacturing_factory_order_details_fee_pct_check" CHECK ((fee_pct >= (0)::numeric)),
 CONSTRAINT "manufacturing_factory_order_details_labor_hour_check" CHECK ((labor_hour >= (0)::numeric)),
 CONSTRAINT "manufacturing_factory_order_details_margin_pct_check" CHECK ((margin_pct >= (0)::numeric)),
 CONSTRAINT "manufacturing_factory_order_details_notes_check" CHECK ((length(notes) <= 4000)),
 CONSTRAINT "manufacturing_factory_order_details_other_estimate_check" CHECK ((other_estimate >= (0)::numeric)),
 CONSTRAINT "manufacturing_factory_order_details_pkey" PRIMARY KEY (tenant_id, branch_id, order_id),
 CONSTRAINT "manufacturing_factory_order_details_sequence_no_check" CHECK ((sequence_no > 0)),
 CONSTRAINT "manufacturing_factory_order_details_tariff_check" CHECK ((tariff >= (0)::numeric)),
 CONSTRAINT "manufacturing_factory_order_details_tenant_id_customer_id_fkey" FOREIGN KEY (tenant_id, customer_id) REFERENCES parties("TenantId", "Id"),
 CONSTRAINT "manufacturing_factory_order_details_title_check" CHECK (((length(title) >= 1) AND (length(title) <= 160))),
 CONSTRAINT "manufacturing_factory_order_details_version_check" CHECK ((version > 0)),
 CONSTRAINT "manufacturing_factory_order_details_waste_pct_check" CHECK (((waste_pct >= (0)::numeric) AND (waste_pct <= (100)::numeric)))
);

CREATE TABLE public.manufacturing_factory_attempt_details (
 "tenant_id" uuid NOT NULL,
 "branch_id" uuid NOT NULL,
 "order_id" uuid NOT NULL,
 "attempt_id" uuid NOT NULL,
 "estimated_seconds" integer NOT NULL,
 "power_watts" numeric(18,6) NOT NULL,
 "machine_hour" numeric(18,6) NOT NULL,
 "tariff" numeric(18,6) NOT NULL,
 "labor_hour" numeric(18,6) NOT NULL,
 "actual_seconds" integer,
 "labor_seconds" integer,
 "energy_cost" numeric(18,6),
 "machine_cost" numeric(18,6),
 "labor_cost" numeric(18,6),
 "produced_quantity" integer,
 "closed_at" timestamp with time zone,
 CONSTRAINT "manufacturing_factory_attempt_details_actual_seconds_check" CHECK ((actual_seconds >= 0)),
 CONSTRAINT "manufacturing_factory_attempt_details_estimated_seconds_check" CHECK ((estimated_seconds > 0)),
 CONSTRAINT "manufacturing_factory_attempt_details_labor_hour_check" CHECK ((labor_hour >= (0)::numeric)),
 CONSTRAINT "manufacturing_factory_attempt_details_labor_seconds_check" CHECK ((labor_seconds >= 0)),
 CONSTRAINT "manufacturing_factory_attempt_details_machine_hour_check" CHECK ((machine_hour >= (0)::numeric)),
 CONSTRAINT "manufacturing_factory_attempt_details_pkey" PRIMARY KEY (tenant_id, branch_id, attempt_id),
 CONSTRAINT "manufacturing_factory_attempt_details_power_watts_check" CHECK ((power_watts > (0)::numeric)),
 CONSTRAINT "manufacturing_factory_attempt_details_produced_quantity_check" CHECK ((produced_quantity >= 0)),
 CONSTRAINT "manufacturing_factory_attempt_details_tariff_check" CHECK ((tariff >= (0)::numeric)),
 CONSTRAINT "manufacturing_factory_attempt_details_tenant_id_attempt_id_fkey" FOREIGN KEY (tenant_id, attempt_id) REFERENCES manufacturing_print_attempts("TenantId", "Id"),
 CONSTRAINT "manufacturing_factory_attempt_tenant_id_branch_id_order_id_fkey" FOREIGN KEY (tenant_id, branch_id, order_id) REFERENCES manufacturing_factory_order_details(tenant_id, branch_id, order_id)
);

CREATE TABLE public.manufacturing_factory_quality_events (
 "tenant_id" uuid NOT NULL,
 "branch_id" uuid NOT NULL,
 "request_id" uuid NOT NULL,
 "order_id" uuid NOT NULL,
 "approved_quantity" integer NOT NULL,
 "rejected_quantity" integer NOT NULL,
 "notes" text NOT NULL,
 "labor_seconds" integer NOT NULL,
 "labor_cost" numeric(18,6) NOT NULL,
 "actor_id" uuid NOT NULL,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 CONSTRAINT "manufacturing_factory_quality_events_approved_quantity_check" CHECK ((approved_quantity >= 0)),
 CONSTRAINT "manufacturing_factory_quality_events_labor_cost_check" CHECK ((labor_cost >= (0)::numeric)),
 CONSTRAINT "manufacturing_factory_quality_events_labor_seconds_check" CHECK ((labor_seconds >= 0)),
 CONSTRAINT "manufacturing_factory_quality_events_pkey" PRIMARY KEY (tenant_id, branch_id, request_id),
 CONSTRAINT "manufacturing_factory_quality_events_rejected_quantity_check" CHECK ((rejected_quantity >= 0)),
 CONSTRAINT "manufacturing_factory_quality_tenant_id_branch_id_order_id_fkey" FOREIGN KEY (tenant_id, branch_id, order_id) REFERENCES manufacturing_factory_order_details(tenant_id, branch_id, order_id)
);

CREATE TABLE public.manufacturing_factory_printer_profiles (
 "tenant_id" uuid NOT NULL,
 "branch_id" uuid NOT NULL,
 "printer_id" uuid NOT NULL,
 "slot_count" integer NOT NULL,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 CONSTRAINT "manufacturing_factory_printer_profiles_pkey" PRIMARY KEY (tenant_id, branch_id, printer_id),
 CONSTRAINT "manufacturing_factory_printer_profiles_slot_count_check" CHECK (((slot_count >= 1) AND (slot_count <= 32))),
 CONSTRAINT "manufacturing_factory_printer_tenant_id_branch_id_printer__fkey" FOREIGN KEY (tenant_id, branch_id, printer_id) REFERENCES manufacturing_printers("TenantId", "BranchId", "Id")
);

CREATE TABLE public.manufacturing_factory_printer_slots (
 "tenant_id" uuid NOT NULL,
 "branch_id" uuid NOT NULL,
 "printer_id" uuid NOT NULL,
 "slot_no" integer NOT NULL,
 "spool_id" uuid NOT NULL,
 "assigned_by" uuid NOT NULL,
 "assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
 CONSTRAINT "manufacturing_factory_printe_tenant_id_branch_id_printer__fkey1" FOREIGN KEY (tenant_id, branch_id, printer_id) REFERENCES manufacturing_printers("TenantId", "BranchId", "Id"),
 CONSTRAINT "manufacturing_factory_printer__tenant_id_branch_id_spool_id_key" UNIQUE (tenant_id, branch_id, spool_id),
 CONSTRAINT "manufacturing_factory_printer_slots_pkey" PRIMARY KEY (tenant_id, branch_id, printer_id, slot_no),
 CONSTRAINT "manufacturing_factory_printer_slots_slot_no_check" CHECK (((slot_no >= 1) AND (slot_no <= 32))),
 CONSTRAINT "manufacturing_factory_printer_tenant_id_branch_id_spool_id_fkey" FOREIGN KEY (tenant_id, branch_id, spool_id) REFERENCES manufacturing_spool_details(tenant_id, branch_id, spool_id)
);

CREATE INDEX ix_factory_alloc_balance_v2 ON public.manufacturing_material_allocations USING btree (tenant_id, branch_id, balance_id, state);

CREATE INDEX ix_factory_alloc_order_v2 ON public.manufacturing_material_allocations USING btree (tenant_id, branch_id, order_id);

CREATE INDEX ix_factory_alloc_spool_v2 ON public.manufacturing_material_allocations USING btree (tenant_id, branch_id, spool_id, state);

CREATE FUNCTION public.factory_add_material_v2(t uuid, b uuid, u uuid, req uuid, p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE prior jsonb;r jsonb;ord uuid;d public.manufacturing_factory_order_details%ROWTYPE;o public.manufacturing_orders%ROWTYPE;sp uuid;
BEGIN
 prior:=public.factory_begin_command_v2(t,b,u,req,'AddMaterial',p);IF prior IS NOT NULL THEN RETURN prior;END IF;
 ord:=(p->>'orderId')::uuid;sp:=(p->>'spoolId')::uuid;
 SELECT * INTO o FROM public.manufacturing_orders WHERE "TenantId"=t AND "BranchId"=b AND "Id"=ord FOR UPDATE;
 SELECT * INTO d FROM public.manufacturing_factory_order_details WHERE tenant_id=t AND branch_id=b AND order_id=ord;
 IF NOT FOUND OR o."Status" NOT IN(7,8,10) OR public.factory_number_v2(p,'version',1,2147483647,true)<>d.version OR (o."Status"=10 AND sp IS NOT NULL) THEN RAISE EXCEPTION 'Order not accepting material or stale' USING ERRCODE='23514';END IF;
 r:=public.factory_reserve_material_v2(t,b,u,req,ord,(p->>'balanceId')::uuid,sp,public.factory_number_v2(p,'quantity',0.001,1000000));
 UPDATE public.manufacturing_factory_order_details SET version=version+1 WHERE tenant_id=t AND branch_id=b AND order_id=ord;
 r:=r||jsonb_build_object('orderId',ord,'version',d.version+1);
 RETURN public.factory_end_command_v2(t,b,u,req,'AddMaterial',p,r,'FactoryOrder',ord);
END $function$;

CREATE FUNCTION public.factory_assert_actor_v2(t uuid, b uuid, u uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.users x JOIN public.branches y ON y."Id"=b AND y."TenantId"=t AND y."IsActive" JOIN public.tenants z ON z."Id"=t AND z."IsActive" WHERE x."Id"=u AND x."TenantId"=t AND x."DefaultBranchId"=b AND x."IsActive") THEN RAISE EXCEPTION 'Invalid actor scope' USING ERRCODE='42501'; END IF;
END $function$;

CREATE FUNCTION public.factory_assign_slot_v2(t uuid, b uuid, u uuid, req uuid, p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE prior jsonb;r jsonb;prid uuid;sp uuid;pr public.manufacturing_printers%ROWTYPE;slot integer;max_slots integer;
BEGIN
 prior:=public.factory_begin_command_v2(t,b,u,req,'AssignSlot',p);IF prior IS NOT NULL THEN RETURN prior;END IF;
 prid:=(p->>'printerId')::uuid;sp:=(p->>'spoolId')::uuid;
 SELECT * INTO pr FROM public.manufacturing_printers WHERE "TenantId"=t AND "BranchId"=b AND "Id"=prid FOR UPDATE;
 IF NOT FOUND OR pr."Status"<>1 THEN RAISE EXCEPTION 'Printer not available for slot change' USING ERRCODE='23514';END IF;
 SELECT slot_count INTO max_slots FROM public.manufacturing_factory_printer_profiles WHERE tenant_id=t AND branch_id=b AND printer_id=prid;
 max_slots:=coalesce(max_slots,1);slot:=public.factory_number_v2(p,'slot',1,max_slots,true);
 IF sp IS NOT NULL THEN
  PERFORM 1 FROM public.manufacturing_spools s JOIN public.manufacturing_spool_details d ON d.spool_id=s."Id" AND d.tenant_id=t AND d.branch_id=b WHERE s."TenantId"=t AND s."BranchId"=b AND s."Id"=sp AND s."IsActive" FOR UPDATE OF s;
  IF NOT FOUND THEN RAISE EXCEPTION 'Spool unavailable' USING ERRCODE='22023';END IF;
  INSERT INTO public.manufacturing_factory_printer_slots(tenant_id,branch_id,printer_id,slot_no,spool_id,assigned_by) VALUES(t,b,prid,slot,sp,u)
  ON CONFLICT(tenant_id,branch_id,printer_id,slot_no) DO UPDATE SET spool_id=EXCLUDED.spool_id,assigned_by=EXCLUDED.assigned_by,assigned_at=now();
 ELSE
  DELETE FROM public.manufacturing_factory_printer_slots WHERE tenant_id=t AND branch_id=b AND printer_id=prid AND slot_no=slot;
 END IF;
 r:=jsonb_build_object('printerId',prid,'slot',slot,'spoolId',sp);
 RETURN public.factory_end_command_v2(t,b,u,req,'AssignSlot',p,r,'FactoryPrinter',prid);
END $function$;

CREATE FUNCTION public.factory_begin_command_v2(t uuid, b uuid, u uuid, req uuid, act text, p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE prior public.manufacturing_factory_commands%ROWTYPE;
BEGIN
 PERFORM public.factory_assert_actor_v2(t,b,u);
 IF req IS NULL OR p IS NULL OR jsonb_typeof(p)<>'object' THEN RAISE EXCEPTION 'Invalid command' USING ERRCODE='22023';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(t::text||b::text||req::text,3));
 SELECT * INTO prior FROM public.manufacturing_factory_commands WHERE tenant_id=t AND branch_id=b AND request_id=req;
 IF FOUND THEN IF (prior.action,prior.payload,prior.actor_id) IS DISTINCT FROM (act,p,u) THEN RAISE EXCEPTION 'Command idempotency mismatch' USING ERRCODE='23514';END IF;RETURN prior.result;END IF;
 RETURN NULL;
END $function$;

CREATE FUNCTION public.factory_cancel_order_v2(t uuid, b uuid, u uuid, req uuid, p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE prior jsonb;r jsonb;ord uuid;o public.manufacturing_orders%ROWTYPE;d public.manufacturing_factory_order_details%ROWTYPE;reason text;line record;
BEGIN
 prior:=public.factory_begin_command_v2(t,b,u,req,'CancelOrder',p);IF prior IS NOT NULL THEN RETURN prior;END IF;
 ord:=(p->>'orderId')::uuid;reason:=public.factory_text_v2(p,'reason',4,1000);
 SELECT * INTO o FROM public.manufacturing_orders WHERE "TenantId"=t AND "BranchId"=b AND "Id"=ord FOR UPDATE;
 SELECT * INTO d FROM public.manufacturing_factory_order_details WHERE tenant_id=t AND branch_id=b AND order_id=ord;
 IF NOT FOUND OR o."Status" NOT IN (7,10) OR o."SalesOrderId" IS NOT NULL OR public.factory_number_v2(p,'version',1,2147483647,true)<>d.version THEN RAISE EXCEPTION 'Order cannot be cancelled; close active attempts first' USING ERRCODE='23514';END IF;
 FOR line IN SELECT id FROM public.manufacturing_material_allocations WHERE tenant_id=t AND branch_id=b AND order_id=ord AND state='RESERVED' ORDER BY balance_id,spool_id,id LOOP
  PERFORM public.factory_settle_material_v2(t,b,u,gen_random_uuid(),line.id,0,false,NULL);
 END LOOP;
 PERFORM set_config('hbstudio.factory_order_command',ord::text,true);
 UPDATE public.manufacturing_orders SET "Status"=13,"FinishedAtUtc"=now(),"UpdatedAtUtc"=now() WHERE "Id"=ord;
 UPDATE public.manufacturing_factory_order_details SET cancel_reason=reason,version=version+1 WHERE tenant_id=t AND branch_id=b AND order_id=ord;
 r:=jsonb_build_object('orderId',ord,'status',13,'version',d.version+1);
 RETURN public.factory_end_command_v2(t,b,u,req,'CancelOrder',p,r,'FactoryOrder',ord);
END $function$;

CREATE FUNCTION public.factory_configure_material_v2(t uuid, b uuid, u uuid, bal uuid, k text, mat text, col text, factor numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE sb public.stock_balances%ROWTYPE; c public.manufacturing_material_balance_configs%ROWTYPE; inserted_count integer;
BEGIN
 PERFORM public.factory_assert_actor_v2(t,b,u);
 mat:=upper(btrim(mat));col:=upper(btrim(coalesce(col,'')));
 IF k IS NULL OR k NOT IN ('FILAMENT','SUPPLY') OR mat IS NULL OR length(mat) NOT BETWEEN 1 AND 80 OR length(col)>80 OR factor IS NULL OR factor::text IN ('NaN','Infinity','-Infinity') OR factor<=0 OR factor>1000000 OR factor<>round(factor,6) OR (k='SUPPLY' AND (factor<>1 OR col<>'')) OR (k='FILAMENT' AND col='') THEN RAISE EXCEPTION 'Invalid material config' USING ERRCODE='22023'; END IF;
 SELECT x.* INTO sb FROM public.stock_balances x JOIN public.product_skus sku ON sku."Id"=x."ProductSkuId" AND sku."TenantId"=t AND sku."IsActive" JOIN public.product_models model ON model."Id"=sku."ProductModelId" AND model."TenantId"=t AND model."SerializationPolicy"=0 AND model."IsActive" JOIN public.warehouses w ON w."Id"=x."WarehouseId" AND w."TenantId"=t AND w."BranchId"=b AND w."IsActive" WHERE x."Id"=bal AND x."TenantId"=t AND x."BranchId"=b FOR UPDATE OF x;
 IF NOT FOUND THEN RAISE EXCEPTION 'Stock balance unavailable' USING ERRCODE='22023'; END IF;
 INSERT INTO public.manufacturing_material_balance_configs(tenant_id,branch_id,balance_id,kind,material_type,color,units_per_stock_unit) VALUES(t,b,bal,k,mat,col,factor) ON CONFLICT DO NOTHING;
 GET DIAGNOSTICS inserted_count=ROW_COUNT;
 SELECT * INTO c FROM public.manufacturing_material_balance_configs WHERE tenant_id=t AND branch_id=b AND balance_id=bal;
 IF (c.kind,c.material_type,c.color,c.units_per_stock_unit) IS DISTINCT FROM (k,mat,col,factor) THEN RAISE EXCEPTION 'Existing unit/material configuration differs' USING ERRCODE='23514'; END IF;
 IF inserted_count=1 THEN
 INSERT INTO public.audit_events("Id","TenantId","BranchId","EntityType","EntityId","Action","ActorId","ActorEmail","CorrelationId","AfterStateJson","CreatedAtUtc","Version") SELECT gen_random_uuid(),t,b,'FactoryMaterialConfig',bal::text,'Configured',u,x."Email",gen_random_uuid()::text,jsonb_build_object('kind',k,'materialType',mat,'color',col,'unitsPerStockUnit',factor),now(),1 FROM public.users x WHERE x."Id"=u;
 END IF;
 RETURN jsonb_build_object('balanceId',bal,'kind',k,'materialType',mat,'color',col,'unitsPerStockUnit',factor);
END $function$;

CREATE FUNCTION public.factory_create_order_v2(t uuid, b uuid, u uuid, req uuid, p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE prior jsonb;r jsonb;new_order_id uuid:=gen_random_uuid();cust uuid;printer_id uuid;pr public.manufacturing_printers%ROWTYPE;seq bigint;number text;qty integer;secs integer;labsecs integer;tariff numeric;labor numeric;other numeric;waste numeric;margin numeric;fees numeric;price numeric;grams numeric;mat_sku uuid;f jsonb;s jsonb;est jsonb;line jsonb;due timestamptz;
BEGIN
 prior:=public.factory_begin_command_v2(t,b,u,req,'CreateOrder',p);IF prior IS NOT NULL THEN RETURN prior;END IF;
 cust:=(p->>'customerId')::uuid;printer_id:=(p->>'printerId')::uuid;
 IF NOT EXISTS(SELECT 1 FROM public.parties x JOIN public.customer_profiles cp ON cp."TenantId"=x."TenantId" AND cp."PartyId"=x."Id" WHERE x."TenantId"=t AND x."Id"=cust AND x."IsActive") THEN RAISE EXCEPTION 'Customer unavailable' USING ERRCODE='22023';END IF;
 SELECT * INTO pr FROM public.manufacturing_printers WHERE "TenantId"=t AND "BranchId"=b AND "Id"=printer_id AND "Status" NOT IN (7,8);
 IF NOT FOUND OR pr."AveragePowerWatts"<=0 OR pr."ConfiguredHourlyMachineCost"<0 THEN RAISE EXCEPTION 'Printer unavailable or invalid costs' USING ERRCODE='22023';END IF;
 qty:=public.factory_number_v2(p,'quantity',1,100000,true);secs:=public.factory_number_v2(p,'seconds',1,31536000,true);labsecs:=public.factory_number_v2(p,'laborSeconds',0,31536000,true);
 tariff:=public.factory_number_v2(p,'tariff',0,1000000);labor:=public.factory_number_v2(p,'laborHour',0,1000000);other:=public.factory_number_v2(p,'other',0,1000000);waste:=public.factory_number_v2(p,'wastePct',0,100);margin:=public.factory_number_v2(p,'marginPct',0,99.9999);fees:=public.factory_number_v2(p,'feePct',0,99.9999);price:=public.factory_number_v2(p,'approvedPrice',0.01,100000000);
 IF margin+fees>=100 OR price<>round(price,2) THEN RAISE EXCEPTION 'Invalid price or margin' USING ERRCODE='22023';END IF;
 IF jsonb_typeof(p->'plan') IS DISTINCT FROM 'array' OR jsonb_array_length(p->'plan') NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Material plan required' USING ERRCODE='22023';END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p->'plan') l GROUP BY l->>'balanceId',coalesce(l->>'spoolId','') HAVING count(*)>1) THEN RAISE EXCEPTION 'Duplicate material line' USING ERRCODE='22023';END IF;
 SELECT x."ProductSkuId" INTO mat_sku FROM jsonb_array_elements(p->'plan') l JOIN public.manufacturing_material_balance_configs c ON c.tenant_id=t AND c.branch_id=b AND c.balance_id=(l->>'balanceId')::uuid AND c.kind='FILAMENT' JOIN public.stock_balances x ON x."Id"=c.balance_id WHERE l->>'spoolId' IS NOT NULL LIMIT 1;
 IF mat_sku IS NULL THEN RAISE EXCEPTION 'At least one filament spool required' USING ERRCODE='22023';END IF;
 IF p->>'dueAt' IS NOT NULL AND p->>'dueAt'<>'' THEN due:=(p->>'dueAt')::timestamptz;END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(t::text||b::text||'factory-order',4));
 SELECT coalesce(max(sequence_no),0)+1 INTO seq FROM public.manufacturing_factory_order_details WHERE tenant_id=t AND branch_id=b;
 number:='OS3D-'||lpad(seq::text,greatest(6,length(seq::text)),'0');
 INSERT INTO public.manufacturing_orders("Id","OrderNumber","Type","Status","AssignedPrinterId","MaterialProductSkuId","PlannedQuantity","ProducedQuantity","ApprovedQuantity","RejectedQuantity","EstimatedFilamentGrams","EstimatedPrintTimeMinutes","TotalEstimatedCost","ActualMaterialCost","ActualEnergyCost","ActualMachineCost","ActualLaborCost","ActualWasteCost","CreatedAtUtc","TenantId","BranchId") VALUES(new_order_id,number,2,7,printer_id,mat_sku,qty,0,0,0,0,secs/60::numeric,0,0,0,0,0,0,now(),t,b);
 INSERT INTO public.manufacturing_factory_order_details(tenant_id,branch_id,order_id,sequence_no,customer_id,title,notes,due_at,estimated_seconds,estimated_labor_seconds,tariff,labor_hour,other_estimate,waste_pct,margin_pct,fee_pct,approved_price,price_recorded_by) VALUES(t,b,new_order_id,seq,cust,public.factory_text_v2(p,'title',1,160),public.factory_text_v2(p,'notes',0,4000),due,secs,labsecs,tariff,labor,other,waste,margin,fees,price,u);
 FOR line IN SELECT l FROM jsonb_array_elements(p->'plan') l ORDER BY l->>'balanceId',coalesce(l->>'spoolId','') LOOP
  PERFORM public.factory_reserve_material_v2(t,b,u,gen_random_uuid(),new_order_id,(line->>'balanceId')::uuid,(line->>'spoolId')::uuid,public.factory_number_v2(line,'quantity',0.001,1000000));
 END LOOP;
 SELECT coalesce(jsonb_agg(jsonb_build_object('grams',a.planned_quantity,'costPerKg',a.unit_cost_snapshot*1000)) FILTER(WHERE a.spool_id IS NOT NULL),'[]'::jsonb),coalesce(jsonb_agg(jsonb_build_object('quantity',a.planned_quantity,'unitCost',a.unit_cost_snapshot)) FILTER(WHERE a.spool_id IS NULL),'[]'::jsonb),coalesce(sum(a.planned_quantity) FILTER(WHERE a.spool_id IS NOT NULL),0) INTO f,s,grams FROM public.manufacturing_material_allocations a WHERE a.tenant_id=t AND a.branch_id=b AND a.order_id=new_order_id;
 est:=public.manufacturing_estimate_cost_v1(f,s,secs,pr."AveragePowerWatts",tariff,pr."ConfiguredHourlyMachineCost",labsecs,labor,other,waste,margin,fees);
 IF p ? 'estimateFingerprint' AND p->>'estimateFingerprint' IS DISTINCT FROM md5(est::text) THEN RAISE EXCEPTION 'Estimate changed; recalculate before approval' USING ERRCODE='23514';END IF;
 PERFORM set_config('hbstudio.factory_order_command',new_order_id::text,true);
 UPDATE public.manufacturing_orders SET "EstimatedFilamentGrams"=grams,"TotalEstimatedCost"=(est->>'totalCost')::numeric,"UpdatedAtUtc"=now() WHERE "Id"=new_order_id;
 UPDATE public.manufacturing_factory_order_details SET estimate_snapshot=est WHERE tenant_id=t AND branch_id=b AND order_id=new_order_id;
 r:=jsonb_build_object('id',new_order_id,'number',number,'status',7);
 RETURN public.factory_end_command_v2(t,b,u,req,'CreateOrder',p,r,'FactoryOrder',new_order_id);
END $function$;

CREATE FUNCTION public.factory_preview_order_v2(t uuid, b uuid, u uuid, p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE pr public.manufacturing_printers%ROWTYPE;line jsonb;c public.manufacturing_material_balance_configs%ROWTYPE;sb public.stock_balances%ROWTYPE;sp public.manufacturing_spools%ROWTYPE;d public.manufacturing_spool_details%ROWTYPE;qty numeric;already numeric;f jsonb:='[]';s jsonb:='[]';est jsonb;
BEGIN
 PERFORM public.factory_assert_actor_v2(t,b,u);
 IF jsonb_typeof(p->'plan') IS DISTINCT FROM 'array' OR jsonb_array_length(p->'plan') NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Material plan required' USING ERRCODE='22023';END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p->'plan') l GROUP BY l->>'balanceId',coalesce(l->>'spoolId','') HAVING count(*)>1) THEN RAISE EXCEPTION 'Duplicate material line' USING ERRCODE='22023';END IF;
 SELECT * INTO pr FROM public.manufacturing_printers WHERE "TenantId"=t AND "BranchId"=b AND "Id"=(p->>'printerId')::uuid AND "Status" NOT IN(7,8);
 IF NOT FOUND OR pr."AveragePowerWatts"<=0 OR pr."ConfiguredHourlyMachineCost"<0 THEN RAISE EXCEPTION 'Printer unavailable' USING ERRCODE='22023';END IF;
 FOR line IN SELECT l FROM jsonb_array_elements(p->'plan') l LOOP
  qty:=public.factory_number_v2(line,'quantity',0.001,1000000);
  SELECT * INTO c FROM public.manufacturing_material_balance_configs WHERE tenant_id=t AND branch_id=b AND balance_id=(line->>'balanceId')::uuid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Material not configured' USING ERRCODE='22023';END IF;
  SELECT * INTO sb FROM public.stock_balances WHERE "TenantId"=t AND "BranchId"=b AND "Id"=c.balance_id;
  IF qty/c.units_per_stock_unit<>round(qty/c.units_per_stock_unit,4) THEN RAISE EXCEPTION 'Unit precision unsupported' USING ERRCODE='22023';END IF;
  IF (SELECT sum(public.factory_number_v2(l,'quantity',0.001,1000000)/c.units_per_stock_unit) FROM jsonb_array_elements(p->'plan') l WHERE (l->>'balanceId')::uuid=c.balance_id)>sb."OnHandQuantity"-sb."ReservedQuantity"-sb."BlockedQuantity" THEN RAISE EXCEPTION 'Insufficient stock' USING ERRCODE='23514';END IF;
  IF c.kind='FILAMENT' THEN
   SELECT * INTO d FROM public.manufacturing_spool_details WHERE tenant_id=t AND branch_id=b AND balance_id=c.balance_id AND spool_id=(line->>'spoolId')::uuid;
   IF NOT FOUND THEN RAISE EXCEPTION 'Spool unavailable' USING ERRCODE='22023';END IF;
   SELECT * INTO sp FROM public.manufacturing_spools WHERE "TenantId"=t AND "BranchId"=b AND "Id"=d.spool_id;
   SELECT coalesce(sum(planned_quantity),0) INTO already FROM public.manufacturing_material_allocations WHERE tenant_id=t AND branch_id=b AND spool_id=d.spool_id AND state='RESERVED';
   IF NOT sp."IsActive" OR qty>sp."RemainingWeightGrams"-already THEN RAISE EXCEPTION 'Insufficient spool' USING ERRCODE='23514';END IF;
   f:=f||jsonb_build_array(jsonb_build_object('grams',qty,'costPerKg',d.cost_per_gram*1000));
  ELSE
   IF line->>'spoolId' IS NOT NULL OR qty<>trunc(qty) THEN RAISE EXCEPTION 'Supply requires whole units' USING ERRCODE='22023';END IF;
   s:=s||jsonb_build_array(jsonb_build_object('quantity',qty,'unitCost',sb."AverageCost"));
  END IF;
 END LOOP;
 IF jsonb_array_length(f)=0 THEN RAISE EXCEPTION 'Filament required' USING ERRCODE='22023';END IF;
 est:=public.manufacturing_estimate_cost_v1(f,s,public.factory_number_v2(p,'seconds',1,31536000,true)::integer,pr."AveragePowerWatts",public.factory_number_v2(p,'tariff',0,1000000),pr."ConfiguredHourlyMachineCost",public.factory_number_v2(p,'laborSeconds',0,31536000,true)::integer,public.factory_number_v2(p,'laborHour',0,1000000),public.factory_number_v2(p,'other',0,1000000),public.factory_number_v2(p,'wastePct',0,100),public.factory_number_v2(p,'marginPct',0,99.9999),public.factory_number_v2(p,'feePct',0,99.9999));
 RETURN jsonb_build_object('estimate',est,'fingerprint',md5(est::text));
END $function$;

CREATE FUNCTION public.factory_create_printer_v2(t uuid, b uuid, u uuid, req uuid, p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE prior jsonb; r jsonb; id uuid:=gen_random_uuid(); code text; nominal numeric; avg_w numeric; tech integer;
BEGIN
 prior:=public.factory_begin_command_v2(t,b,u,req,'CreatePrinter',p);IF prior IS NOT NULL THEN RETURN prior;END IF;
 code:=upper(public.factory_text_v2(p,'code',1,40));nominal:=public.factory_number_v2(p,'nominalWatts',1,100000);avg_w:=public.factory_number_v2(p,'averageWatts',1,nominal);tech:=public.factory_number_v2(p,'technology',1,3,true);
 INSERT INTO public.manufacturing_printers("Id","Code","Name","Manufacturer","Model","SerialNumber","Technology","BuildVolume","ExtruderCount","CompatibleMaterials","NominalPowerWatts","AveragePowerWatts","AcquisitionCost","EstimatedLifespanHours","ConfiguredHourlyMachineCost","Status","StatusUpdatedAtUtc","CreatedAtUtc","TenantId","BranchId")
 VALUES(id,code,public.factory_text_v2(p,'name',1,120),public.factory_text_v2(p,'manufacturer',1,80),public.factory_text_v2(p,'model',1,80),nullif(public.factory_text_v2(p,'serial',0,120),''),tech,public.factory_text_v2(p,'buildVolume',1,80),public.factory_number_v2(p,'extruders',1,32,true),public.factory_text_v2(p,'materials',1,300),nominal,avg_w,public.factory_number_v2(p,'acquisitionCost',0,100000000),public.factory_number_v2(p,'lifespanHours',1,1000000),public.factory_number_v2(p,'machineHour',0,1000000),1,now(),now(),t,b);
 INSERT INTO public.manufacturing_factory_printer_profiles(tenant_id,branch_id,printer_id,slot_count) VALUES(t,b,id,CASE WHEN p ? 'slotCount' THEN public.factory_number_v2(p,'slotCount',1,32,true) ELSE 1 END);
 r:=jsonb_build_object('id',id,'code',code,'status',1);
 RETURN public.factory_end_command_v2(t,b,u,req,'CreatePrinter',p,r,'FactoryPrinter',id);
END $function$;

CREATE FUNCTION public.factory_end_command_v2(t uuid, b uuid, u uuid, req uuid, act text, p jsonb, r jsonb, entity text, eid uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
 INSERT INTO public.manufacturing_factory_commands(tenant_id,branch_id,request_id,action,payload,result,actor_id) VALUES(t,b,req,act,p,r,u);
 INSERT INTO public.audit_events("Id","TenantId","BranchId","EntityType","EntityId","Action","ActorId","ActorEmail","CorrelationId","AfterStateJson","CreatedAtUtc","Version") SELECT gen_random_uuid(),t,b,entity,eid::text,act,u,x."Email",req::text,r,now(),1 FROM public.users x WHERE x."Id"=u;
 RETURN r;
END $function$;

CREATE FUNCTION public.factory_finish_attempt_v2(t uuid, b uuid, u uuid, req uuid, p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE prior jsonb;r jsonb;ord uuid;att uuid;o public.manufacturing_orders%ROWTYPE;d public.manufacturing_factory_order_details%ROWTYPE;ad public.manufacturing_factory_attempt_details%ROWTYPE;pa public.manufacturing_print_attempts%ROWTYPE;success boolean;secs integer;labsecs integer;produced integer;reason text;line record;n integer;given integer;grams numeric:=0;energy numeric;machine numeric;labor numeric;next_status integer;actual numeric;
BEGIN
 prior:=public.factory_begin_command_v2(t,b,u,req,'FinishAttempt',p);IF prior IS NOT NULL THEN RETURN prior;END IF;
 ord:=(p->>'orderId')::uuid;att:=(p->>'attemptId')::uuid;
 SELECT * INTO o FROM public.manufacturing_orders WHERE "TenantId"=t AND "BranchId"=b AND "Id"=ord FOR UPDATE;
 SELECT * INTO d FROM public.manufacturing_factory_order_details WHERE tenant_id=t AND branch_id=b AND order_id=ord;
 IF NOT FOUND OR o."Status"<>8 OR public.factory_number_v2(p,'version',1,2147483647,true)<>d.version THEN RAISE EXCEPTION 'Order not active or version stale' USING ERRCODE='23514';END IF;
 SELECT * INTO ad FROM public.manufacturing_factory_attempt_details WHERE tenant_id=t AND branch_id=b AND order_id=ord AND attempt_id=att FOR UPDATE;
 IF NOT FOUND OR ad.closed_at IS NOT NULL THEN RAISE EXCEPTION 'Attempt unavailable' USING ERRCODE='23514';END IF;
 SELECT * INTO pa FROM public.manufacturing_print_attempts WHERE "TenantId"=t AND "Id"=att AND "ManufacturingOrderId"=ord AND "Status"=3 FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Attempt not running' USING ERRCODE='23514';END IF;
 PERFORM 1 FROM public.manufacturing_printers WHERE "TenantId"=t AND "BranchId"=b AND "Id"=pa."PrinterId" FOR UPDATE;
 IF jsonb_typeof(p->'success') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'Success flag required' USING ERRCODE='22023';END IF;
 success:=(p->>'success')::boolean;secs:=public.factory_number_v2(p,'seconds',0,31536000,true);labsecs:=public.factory_number_v2(p,'laborSeconds',0,31536000,true);produced:=public.factory_number_v2(p,'producedQuantity',0,o."PlannedQuantity",true);reason:=public.factory_text_v2(p,'notes',0,1000);
 IF (success AND (produced<1 OR secs<1)) OR (NOT success AND (produced<>0 OR length(reason)<4)) OR o."ProducedQuantity"-o."RejectedQuantity"+produced>o."PlannedQuantity" THEN RAISE EXCEPTION 'Invalid attempt outcome' USING ERRCODE='22023';END IF;
 IF jsonb_typeof(p->'actuals') IS DISTINCT FROM 'array' OR jsonb_array_length(p->'actuals')>100 THEN RAISE EXCEPTION 'Consumption list required' USING ERRCODE='22023';END IF;
 SELECT count(*) INTO n FROM public.manufacturing_material_allocations WHERE tenant_id=t AND branch_id=b AND order_id=ord AND spool_id IS NOT NULL AND state='RESERVED';
 SELECT count(DISTINCT l->>'allocationId') INTO given FROM jsonb_array_elements(p->'actuals') l;
 IF n=0 OR n<>given OR n<>jsonb_array_length(p->'actuals') THEN RAISE EXCEPTION 'Report each reserved filament once' USING ERRCODE='22023';END IF;
 FOR line IN SELECT a.id,a.planned_quantity,l FROM public.manufacturing_material_allocations a JOIN jsonb_array_elements(p->'actuals') l ON (l->>'allocationId')::uuid=a.id WHERE a.tenant_id=t AND a.branch_id=b AND a.order_id=ord AND a.spool_id IS NOT NULL AND a.state='RESERVED' ORDER BY a.balance_id,a.spool_id,a.id LOOP
  actual:=public.factory_number_v2(line.l,'quantity',0,line.planned_quantity);
  PERFORM public.factory_settle_material_v2(t,b,u,gen_random_uuid(),line.id,actual,NOT success AND actual>0,CASE WHEN actual>0 THEN att ELSE NULL END);
  grams:=grams+actual;given:=given-1;
 END LOOP;
 IF given<>0 OR (success AND grams<=0) THEN RAISE EXCEPTION 'Invalid filament consumption list' USING ERRCODE='22023';END IF;
 energy:=round(ad.power_watts*secs*ad.tariff/3600000,6);machine:=round(ad.machine_hour*secs/3600,6);labor:=round(ad.labor_hour*labsecs/3600,6);
 next_status:=CASE WHEN success AND o."ProducedQuantity"-o."RejectedQuantity"+produced>=o."PlannedQuantity" THEN 10 ELSE 7 END;
 PERFORM set_config('hbstudio.factory_order_command',ord::text,true);
 UPDATE public.manufacturing_print_attempts SET "Status"=CASE WHEN success THEN 5 ELSE 6 END,"ActualDurationMinutes"=secs/60::numeric,"ActualMassGrams"=grams,"FailureCategory"=CASE WHEN success THEN NULL ELSE 99 END,"FailureNotes"=nullif(reason,''),"FinishedAtUtc"=now(),"UpdatedAtUtc"=now() WHERE "Id"=att;
 UPDATE public.manufacturing_factory_attempt_details SET actual_seconds=secs,labor_seconds=labsecs,energy_cost=energy,machine_cost=machine,labor_cost=labor,produced_quantity=produced,closed_at=now() WHERE tenant_id=t AND branch_id=b AND attempt_id=att;
 UPDATE public.manufacturing_orders SET "Status"=next_status,"ProducedQuantity"="ProducedQuantity"+produced,"ActualEnergyCost"="ActualEnergyCost"+energy,"ActualMachineCost"="ActualMachineCost"+machine,"ActualLaborCost"="ActualLaborCost"+labor,"FailureReason"=CASE WHEN success THEN NULL ELSE reason END,"UpdatedAtUtc"=now() WHERE "Id"=ord;
 UPDATE public.manufacturing_printers SET "Status"=1,"StatusNote"=NULL,"StatusUpdatedAtUtc"=now(),"UpdatedAtUtc"=now() WHERE "Id"=pa."PrinterId";
 UPDATE public.manufacturing_factory_order_details SET version=version+1 WHERE tenant_id=t AND branch_id=b AND order_id=ord;
 r:=jsonb_build_object('orderId',ord,'attemptId',att,'status',next_status,'version',d.version+1,'success',success,'producedQuantity',produced);
 RETURN public.factory_end_command_v2(t,b,u,req,'FinishAttempt',p,r,'FactoryOrder',ord);
END $function$;

CREATE FUNCTION public.factory_guard_allocation_v2()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Factory allocation history is immutable' USING ERRCODE='23514'; END IF;
 IF OLD.state<>'RESERVED' OR NEW.state='RESERVED' OR (NEW.tenant_id,NEW.branch_id,NEW.id,NEW.order_id,NEW.balance_id,NEW.spool_id,NEW.reservation_id,NEW.planned_quantity,NEW.units_per_stock_unit,NEW.planned_stock_quantity,NEW.unit_cost_snapshot,NEW.created_by,NEW.created_at) IS DISTINCT FROM (OLD.tenant_id,OLD.branch_id,OLD.id,OLD.order_id,OLD.balance_id,OLD.spool_id,OLD.reservation_id,OLD.planned_quantity,OLD.units_per_stock_unit,OLD.planned_stock_quantity,OLD.unit_cost_snapshot,OLD.created_by,OLD.created_at) THEN RAISE EXCEPTION 'Invalid factory allocation transition' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $function$;

CREATE FUNCTION public.factory_guard_attempt_v2()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
 IF EXISTS(SELECT 1 FROM public.manufacturing_factory_order_details d WHERE d.tenant_id=NEW."TenantId" AND d.order_id=NEW."ManufacturingOrderId") AND current_setting('hbstudio.factory_order_command',true) IS DISTINCT FROM NEW."ManufacturingOrderId"::text THEN RAISE EXCEPTION 'Managed factory attempt requires factory workflow' USING ERRCODE='23514';END IF;
 RETURN NEW;
END $function$;

CREATE FUNCTION public.factory_guard_order_v2()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
 IF EXISTS(SELECT 1 FROM public.manufacturing_factory_order_details d WHERE d.tenant_id=OLD."TenantId" AND d.branch_id=OLD."BranchId" AND d.order_id=OLD."Id") THEN
  IF current_setting('hbstudio.factory_order_command',true) IS DISTINCT FROM OLD."Id"::text OR (NEW."TenantId",NEW."BranchId",NEW."Id",NEW."OrderNumber",NEW."Type",NEW."MaterialProductSkuId",NEW."PlannedQuantity") IS DISTINCT FROM (OLD."TenantId",OLD."BranchId",OLD."Id",OLD."OrderNumber",OLD."Type",OLD."MaterialProductSkuId",OLD."PlannedQuantity") THEN RAISE EXCEPTION 'Managed factory order requires factory workflow' USING ERRCODE='23514';END IF;
 END IF;RETURN NEW;
END $function$;

CREATE FUNCTION public.factory_guard_reservation_v2()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE a public.manufacturing_material_allocations%ROWTYPE;
BEGIN
 SELECT * INTO a FROM public.manufacturing_material_allocations WHERE tenant_id=OLD."TenantId" AND branch_id=OLD."BranchId" AND reservation_id=OLD."Id";
 IF FOUND AND (NEW."Status"<>CASE a.state WHEN 'RESERVED' THEN 1 WHEN 'CONSUMED' THEN 2 ELSE 3 END OR (NEW."TenantId",NEW."BranchId",NEW."Id",NEW."ExpiresAtUtc") IS DISTINCT FROM (OLD."TenantId",OLD."BranchId",OLD."Id",OLD."ExpiresAtUtc")) THEN RAISE EXCEPTION 'Factory reservation must be settled by factory ledger' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $function$;

CREATE FUNCTION public.factory_guard_spool_v2()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE d public.manufacturing_spool_details%ROWTYPE; used numeric;
BEGIN
 SELECT * INTO d FROM public.manufacturing_spool_details WHERE tenant_id=OLD."TenantId" AND branch_id=OLD."BranchId" AND spool_id=OLD."Id";
 IF NOT FOUND THEN RETURN NEW; END IF;
 IF (NEW."TenantId",NEW."BranchId",NEW."Id",NEW."ProductSkuId",NEW."SpoolCode",NEW."MaterialType",NEW."Color",NEW."InitialNetWeightGrams") IS DISTINCT FROM (OLD."TenantId",OLD."BranchId",OLD."Id",OLD."ProductSkuId",OLD."SpoolCode",OLD."MaterialType",OLD."Color",OLD."InitialNetWeightGrams") THEN RAISE EXCEPTION 'Tracked spool identity immutable' USING ERRCODE='23514'; END IF;
 SELECT coalesce(sum(actual_quantity),0) INTO used FROM public.manufacturing_material_allocations WHERE tenant_id=d.tenant_id AND branch_id=d.branch_id AND spool_id=d.spool_id AND state='CONSUMED';
 IF NEW."RemainingWeightGrams"<>NEW."InitialNetWeightGrams"-used OR NEW."RemainingWeightGrams"<0 OR NEW."IsActive"<>(NEW."RemainingWeightGrams">0) THEN RAISE EXCEPTION 'Spool consumption requires factory ledger' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $function$;

CREATE FUNCTION public.factory_guard_stock_v2()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE c public.manufacturing_material_balance_configs%ROWTYPE; physical numeric; reserved numeric;
BEGIN
 SELECT * INTO c FROM public.manufacturing_material_balance_configs WHERE tenant_id=OLD."TenantId" AND branch_id=OLD."BranchId" AND balance_id=OLD."Id";
 IF NOT FOUND THEN RETURN NEW; END IF;
 IF (NEW."TenantId",NEW."BranchId",NEW."Id",NEW."ProductSkuId",NEW."WarehouseId",NEW."WarehouseLocationId") IS DISTINCT FROM (OLD."TenantId",OLD."BranchId",OLD."Id",OLD."ProductSkuId",OLD."WarehouseId",OLD."WarehouseLocationId") THEN RAISE EXCEPTION 'Configured factory stock identity immutable' USING ERRCODE='23514'; END IF;
 SELECT coalesce(sum(s."RemainingWeightGrams"/c.units_per_stock_unit),0) INTO physical FROM public.manufacturing_spool_details d JOIN public.manufacturing_spools s ON s."Id"=d.spool_id WHERE d.tenant_id=c.tenant_id AND d.branch_id=c.branch_id AND d.balance_id=c.balance_id;
 SELECT coalesce(sum(planned_stock_quantity),0) INTO reserved FROM public.manufacturing_material_allocations WHERE tenant_id=c.tenant_id AND branch_id=c.branch_id AND balance_id=c.balance_id AND state='RESERVED';
 IF NEW."OnHandQuantity"<physical OR NEW."ReservedQuantity"<reserved OR NEW."OnHandQuantity"<NEW."ReservedQuantity"+NEW."BlockedQuantity" THEN RAISE EXCEPTION 'Factory stock reconciliation violation' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $function$;

CREATE FUNCTION public.factory_number_v2(p jsonb, k text, lo numeric, hi numeric, whole boolean DEFAULT false)
 RETURNS numeric
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE n numeric;
BEGIN
 IF jsonb_typeof(p->k) IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'Numeric field required: %',k USING ERRCODE='22023';END IF;
 n:=(p->>k)::numeric;
 IF n<lo OR n>hi OR (whole AND n<>trunc(n)) THEN RAISE EXCEPTION 'Invalid number: %',k USING ERRCODE='22023';END IF;
 RETURN n;
END $function$;

CREATE FUNCTION public.factory_quality_v2(t uuid, b uuid, u uuid, req uuid, p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE prior jsonb;r jsonb;ord uuid;o public.manufacturing_orders%ROWTYPE;d public.manufacturing_factory_order_details%ROWTYPE;approved integer;rejected integer;labsecs integer;notes text;pending integer;n integer;given integer;line record;actual numeric;labor numeric;next_status integer;
BEGIN
 prior:=public.factory_begin_command_v2(t,b,u,req,'Quality',p);IF prior IS NOT NULL THEN RETURN prior;END IF;
 ord:=(p->>'orderId')::uuid;
 SELECT * INTO o FROM public.manufacturing_orders WHERE "TenantId"=t AND "BranchId"=b AND "Id"=ord FOR UPDATE;
 SELECT * INTO d FROM public.manufacturing_factory_order_details WHERE tenant_id=t AND branch_id=b AND order_id=ord;
 IF NOT FOUND OR o."Status"<>10 OR public.factory_number_v2(p,'version',1,2147483647,true)<>d.version THEN RAISE EXCEPTION 'Order not in assembly or stale' USING ERRCODE='23514';END IF;
 pending:=o."ProducedQuantity"-o."ApprovedQuantity"-o."RejectedQuantity";
 approved:=public.factory_number_v2(p,'approvedQuantity',0,pending,true);rejected:=public.factory_number_v2(p,'rejectedQuantity',0,pending,true);
 labsecs:=public.factory_number_v2(p,'laborSeconds',0,31536000,true);notes:=public.factory_text_v2(p,'notes',0,1000);
 IF pending<=0 OR approved+rejected<>pending OR (rejected>0 AND length(notes)<4) THEN RAISE EXCEPTION 'Inspect all produced items and document rejection' USING ERRCODE='22023';END IF;
 IF jsonb_typeof(p->'actuals') IS DISTINCT FROM 'array' OR jsonb_array_length(p->'actuals')>100 THEN RAISE EXCEPTION 'Supply consumption list required' USING ERRCODE='22023';END IF;
 SELECT count(*) INTO n FROM public.manufacturing_material_allocations WHERE tenant_id=t AND branch_id=b AND order_id=ord AND spool_id IS NULL AND state='RESERVED';
 SELECT count(DISTINCT l->>'allocationId') INTO given FROM jsonb_array_elements(p->'actuals') l;
 IF n<>given OR n<>jsonb_array_length(p->'actuals') THEN RAISE EXCEPTION 'Report each reserved supply once' USING ERRCODE='22023';END IF;
 FOR line IN SELECT a.id,a.planned_quantity,l FROM public.manufacturing_material_allocations a JOIN jsonb_array_elements(p->'actuals') l ON (l->>'allocationId')::uuid=a.id WHERE a.tenant_id=t AND a.branch_id=b AND a.order_id=ord AND a.spool_id IS NULL AND a.state='RESERVED' ORDER BY a.balance_id,a.id LOOP
  actual:=public.factory_number_v2(line.l,'quantity',0,line.planned_quantity,true);
  PERFORM public.factory_settle_material_v2(t,b,u,gen_random_uuid(),line.id,actual,false,NULL);
  given:=given-1;
 END LOOP;
 IF given<>0 OR EXISTS(SELECT 1 FROM public.manufacturing_material_allocations WHERE tenant_id=t AND branch_id=b AND order_id=ord AND state='RESERVED') THEN RAISE EXCEPTION 'Outstanding material allocations' USING ERRCODE='23514';END IF;
 labor:=round(d.labor_hour*labsecs/3600,6);next_status:=CASE WHEN o."ApprovedQuantity"+approved=o."PlannedQuantity" THEN 12 ELSE 7 END;
 PERFORM set_config('hbstudio.factory_order_command',ord::text,true);
 INSERT INTO public.manufacturing_factory_quality_events(tenant_id,branch_id,request_id,order_id,approved_quantity,rejected_quantity,notes,labor_seconds,labor_cost,actor_id) VALUES(t,b,req,ord,approved,rejected,notes,labsecs,labor,u);
 UPDATE public.manufacturing_orders SET "Status"=next_status,"ApprovedQuantity"="ApprovedQuantity"+approved,"RejectedQuantity"="RejectedQuantity"+rejected,"ActualLaborCost"="ActualLaborCost"+labor,"FailureReason"=CASE WHEN rejected>0 THEN notes ELSE NULL END,"FinishedAtUtc"=CASE WHEN next_status=12 THEN now() ELSE NULL END,"UpdatedAtUtc"=now() WHERE "Id"=ord;
 UPDATE public.manufacturing_factory_order_details SET version=version+1 WHERE tenant_id=t AND branch_id=b AND order_id=ord;
 r:=jsonb_build_object('orderId',ord,'status',next_status,'version',d.version+1,'approvedQuantity',approved,'rejectedQuantity',rejected);
 RETURN public.factory_end_command_v2(t,b,u,req,'Quality',p,r,'FactoryOrder',ord);
END $function$;

CREATE FUNCTION public.factory_register_spools_v2(t uuid, b uuid, u uuid, req uuid, bal uuid, n integer, grams numeric, tare numeric, batch text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE sb public.stock_balances%ROWTYPE;c public.manufacturing_material_balance_configs%ROWTYPE; prior public.manufacturing_spool_registration_requests%ROWTYPE;
 payload jsonb; result jsonb:='[]'::jsonb; grp text; seq bigint; sid uuid; code text; tracked numeric; i integer;
BEGIN
 PERFORM public.factory_assert_actor_v2(t,b,u);
 IF req IS NULL OR n IS NULL OR n NOT BETWEEN 1 AND 100 OR grams IS NULL OR grams::text IN ('NaN','Infinity','-Infinity') OR grams<=0 OR grams>100000 OR grams<>round(grams,3) OR tare IS NULL OR tare::text IN ('NaN','Infinity','-Infinity') OR tare<0 OR tare>100000 OR length(coalesce(batch,''))>120 THEN RAISE EXCEPTION 'Invalid spool registration' USING ERRCODE='22023'; END IF;
 payload:=jsonb_build_object('balance',bal,'count',n,'grams',grams,'tare',tare,'batch',batch);
 PERFORM pg_advisory_xact_lock(hashtextextended(t::text||b::text||req::text,0));
 SELECT * INTO prior FROM public.manufacturing_spool_registration_requests WHERE tenant_id=t AND branch_id=b AND request_id=req;
 IF FOUND THEN IF prior.request_payload<>payload THEN RAISE EXCEPTION 'Idempotency mismatch' USING ERRCODE='23514'; END IF; RETURN prior.result; END IF;
 SELECT * INTO sb FROM public.stock_balances WHERE "TenantId"=t AND "BranchId"=b AND "Id"=bal FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Stock balance unavailable' USING ERRCODE='22023'; END IF;
 SELECT * INTO c FROM public.manufacturing_material_balance_configs WHERE tenant_id=t AND branch_id=b AND balance_id=bal AND kind='FILAMENT';
 IF NOT FOUND THEN RAISE EXCEPTION 'Configure filament stock unit first' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM public.manufacturing_spools s WHERE s."TenantId"=t AND s."BranchId"=b AND s."ProductSkuId"=sb."ProductSkuId" AND s."IsActive" AND NOT EXISTS(SELECT 1 FROM public.manufacturing_spool_details d WHERE d.tenant_id=t AND d.branch_id=b AND d.spool_id=s."Id")) THEN RAISE EXCEPTION 'Reconcile legacy physical spools first' USING ERRCODE='23514'; END IF;
 grp:=c.material_type||chr(31)||c.color;
 PERFORM pg_advisory_xact_lock(hashtextextended(t::text||b::text||grp,1));
 SELECT coalesce(sum(s."RemainingWeightGrams"),0) INTO tracked FROM public.manufacturing_spool_details d JOIN public.manufacturing_spools s ON s."Id"=d.spool_id AND s."TenantId"=t AND s."BranchId"=b WHERE d.tenant_id=t AND d.branch_id=b AND d.balance_id=bal;
 IF (grams/c.units_per_stock_unit)<>round(grams/c.units_per_stock_unit,4) OR tracked+n*grams>(sb."OnHandQuantity"-sb."ReservedQuantity"-sb."BlockedQuantity")*c.units_per_stock_unit THEN RAISE EXCEPTION 'Insufficient unassigned stock or unit precision' USING ERRCODE='23514'; END IF;
 SELECT greatest(coalesce((SELECT max(d.sequence_no) FROM public.manufacturing_spool_details d WHERE d.tenant_id=t AND d.branch_id=b AND d.group_key=grp),0),coalesce((SELECT max(s."SpoolCode"::bigint) FROM public.manufacturing_spools s WHERE s."TenantId"=t AND s."BranchId"=b AND upper(btrim(s."MaterialType"))=c.material_type AND upper(btrim(s."Color"))=c.color AND s."SpoolCode" ~ '^[0-9]{1,12}$'),0)) INTO seq;
 FOR i IN 1..n LOOP
  seq:=seq+1;sid:=gen_random_uuid();code:=lpad(seq::text,greatest(3,length(seq::text)),'0');
  INSERT INTO public.manufacturing_spools("Id","ProductSkuId","SpoolCode","BatchNumber","MaterialType","Color","DiameterMm","InitialNetWeightGrams","RemainingWeightGrams","SpoolTareGrams","IsActive","OpenedAtUtc","CreatedAtUtc","TenantId","BranchId") VALUES(sid,sb."ProductSkuId",code,batch,c.material_type,c.color,1.75,grams,grams,tare,true,now(),now(),t,b);
  INSERT INTO public.manufacturing_spool_details(tenant_id,branch_id,spool_id,balance_id,group_key,sequence_no,cost_per_gram) VALUES(t,b,sid,bal,grp,seq,sb."AverageCost"/c.units_per_stock_unit);
  result:=result||jsonb_build_array(jsonb_build_object('id',sid,'code',code,'remainingGrams',grams));
 END LOOP;
 INSERT INTO public.manufacturing_spool_registration_requests(tenant_id,branch_id,request_id,request_payload,result) VALUES(t,b,req,payload,result);
 INSERT INTO public.audit_events("Id","TenantId","BranchId","EntityType","EntityId","Action","ActorId","ActorEmail","CorrelationId","AfterStateJson","CreatedAtUtc","Version") SELECT gen_random_uuid(),t,b,'FactorySpoolRegistration',req::text,'Registered',u,x."Email",req::text,jsonb_build_object('balanceId',bal,'count',n,'spools',result),now(),1 FROM public.users x WHERE x."Id"=u;
 RETURN result;
END $function$;

CREATE FUNCTION public.factory_reserve_material_v2(t uuid, b uuid, u uuid, req uuid, ord uuid, bal uuid, sp uuid, qty numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE o public.manufacturing_orders%ROWTYPE; sb public.stock_balances%ROWTYPE;c public.manufacturing_material_balance_configs%ROWTYPE;s public.manufacturing_spools%ROWTYPE;d public.manufacturing_spool_details%ROWTYPE;a public.manufacturing_material_allocations%ROWTYPE; stock_qty numeric; unit_cost numeric; already numeric; rid uuid:=gen_random_uuid();
BEGIN
 PERFORM public.factory_assert_actor_v2(t,b,u);
 IF req IS NULL OR qty IS NULL OR qty::text IN ('NaN','Infinity','-Infinity') OR qty<=0 OR qty>1000000 OR qty<>round(qty,3) THEN RAISE EXCEPTION 'Invalid quantity' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(t::text||b::text||req::text,2));
 SELECT * INTO a FROM public.manufacturing_material_allocations WHERE tenant_id=t AND branch_id=b AND id=req;
 IF FOUND THEN
  IF (a.order_id,a.balance_id,a.spool_id,a.planned_quantity) IS DISTINCT FROM (ord,bal,sp,qty) THEN RAISE EXCEPTION 'Idempotency mismatch' USING ERRCODE='23514'; END IF;
  RETURN jsonb_build_object('id',req,'state',a.state,'quantity',a.planned_quantity);
 END IF;
 SELECT * INTO o FROM public.manufacturing_orders WHERE "TenantId"=t AND "BranchId"=b AND "Id"=ord FOR UPDATE;
 IF NOT FOUND OR o."Status" NOT IN (4,5,7,8,10) OR o."MaterialStockReservationId" IS NOT NULL THEN RAISE EXCEPTION 'Order unavailable or uses legacy reservation' USING ERRCODE='23514'; END IF;
 SELECT * INTO sb FROM public.stock_balances WHERE "TenantId"=t AND "BranchId"=b AND "Id"=bal FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Stock balance unavailable' USING ERRCODE='22023'; END IF;
 SELECT * INTO c FROM public.manufacturing_material_balance_configs WHERE tenant_id=t AND branch_id=b AND balance_id=bal;
 IF NOT FOUND THEN RAISE EXCEPTION 'Material not configured' USING ERRCODE='22023'; END IF;
 stock_qty:=qty/c.units_per_stock_unit;
 IF stock_qty<>round(stock_qty,4) OR stock_qty>sb."OnHandQuantity"-sb."ReservedQuantity"-sb."BlockedQuantity" THEN RAISE EXCEPTION 'Insufficient stock or unit precision' USING ERRCODE='23514'; END IF;
 IF c.kind='FILAMENT' THEN
  SELECT * INTO d FROM public.manufacturing_spool_details WHERE tenant_id=t AND branch_id=b AND balance_id=bal AND spool_id=sp;
  IF NOT FOUND THEN RAISE EXCEPTION 'Spool unavailable' USING ERRCODE='22023'; END IF;
  SELECT * INTO s FROM public.manufacturing_spools WHERE "TenantId"=t AND "BranchId"=b AND "Id"=sp FOR UPDATE;
  SELECT coalesce(sum(planned_quantity),0) INTO already FROM public.manufacturing_material_allocations WHERE tenant_id=t AND branch_id=b AND spool_id=sp AND state='RESERVED';
  IF NOT s."IsActive" OR qty>s."RemainingWeightGrams"-already THEN RAISE EXCEPTION 'Insufficient physical spool' USING ERRCODE='23514'; END IF;
  unit_cost:=d.cost_per_gram;
 ELSE
  IF sp IS NOT NULL OR qty<>trunc(qty) THEN RAISE EXCEPTION 'Supply requires whole units and no spool' USING ERRCODE='22023'; END IF;
  unit_cost:=sb."AverageCost";
 END IF;
 INSERT INTO public.stock_reservations("Id","BranchId","ReservationNumber","Status","Reason","DocumentReference","ExpiresAtUtc","IdempotencyKey","CreatedAtUtc","TenantId") VALUES(rid,b,'FAB-'||rid::text,1,'Reserva industrial por material','FAB-OP-'||ord::text,'infinity'::timestamptz,'FAB-'||req::text,now(),t);
 INSERT INTO public.stock_reservation_items("Id","StockReservationId","WarehouseId","WarehouseLocationId","ProductSkuId","Quantity","CreatedAtUtc","TenantId") VALUES(gen_random_uuid(),rid,sb."WarehouseId",sb."WarehouseLocationId",sb."ProductSkuId",stock_qty,now(),t);
 INSERT INTO public.manufacturing_material_allocations(tenant_id,branch_id,id,order_id,balance_id,spool_id,reservation_id,planned_quantity,units_per_stock_unit,planned_stock_quantity,unit_cost_snapshot,state,created_by) VALUES(t,b,req,ord,bal,sp,rid,qty,c.units_per_stock_unit,stock_qty,unit_cost,'RESERVED',u);
 UPDATE public.stock_balances SET "ReservedQuantity"="ReservedQuantity"+stock_qty,"LastMovementAtUtc"=now(),"UpdatedAtUtc"=now() WHERE "Id"=bal AND "TenantId"=t AND "BranchId"=b;
 INSERT INTO public.audit_events("Id","TenantId","BranchId","EntityType","EntityId","Action","ActorId","ActorEmail","CorrelationId","AfterStateJson","CreatedAtUtc","Version") SELECT gen_random_uuid(),t,b,'FactoryMaterialAllocation',req::text,'Reserved',u,x."Email",req::text,jsonb_build_object('order',ord,'balance',bal,'spool',sp,'quantity',qty),now(),1 FROM public.users x WHERE x."Id"=u;
 RETURN jsonb_build_object('id',req,'state','RESERVED','quantity',qty);
END $function$;

CREATE FUNCTION public.factory_set_printer_status_v2(t uuid, b uuid, u uuid, req uuid, p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE prior jsonb;r jsonb;prid uuid;pr public.manufacturing_printers%ROWTYPE;next_status integer;note text;
BEGIN
 prior:=public.factory_begin_command_v2(t,b,u,req,'PrinterStatus',p);IF prior IS NOT NULL THEN RETURN prior;END IF;
 prid:=(p->>'printerId')::uuid;next_status:=public.factory_number_v2(p,'status',1,8,true);note:=public.factory_text_v2(p,'notes',0,1000);
 IF next_status NOT IN(1,7,8) OR (next_status<>1 AND length(note)<4) THEN RAISE EXCEPTION 'Invalid maintenance status' USING ERRCODE='22023';END IF;
 SELECT * INTO pr FROM public.manufacturing_printers WHERE "TenantId"=t AND "BranchId"=b AND "Id"=prid FOR UPDATE;
 IF NOT FOUND OR pr."Status" NOT IN(1,7,8) OR EXISTS(SELECT 1 FROM public.manufacturing_print_attempts WHERE "TenantId"=t AND "PrinterId"=prid AND "Status" IN(2,3,4)) THEN RAISE EXCEPTION 'Printer busy' USING ERRCODE='23514';END IF;
 UPDATE public.manufacturing_printers SET "Status"=next_status,"StatusNote"=nullif(note,''),"StatusUpdatedAtUtc"=now(),"UpdatedAtUtc"=now() WHERE "Id"=prid;
 r:=jsonb_build_object('id',prid,'status',next_status);
 RETURN public.factory_end_command_v2(t,b,u,req,'PrinterStatus',p,r,'FactoryPrinter',prid);
END $function$;

CREATE FUNCTION public.factory_settle_material_v2(t uuid, b uuid, u uuid, req uuid, allocation uuid, actual numeric, waste boolean, attempt uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE a public.manufacturing_material_allocations%ROWTYPE;o public.manufacturing_orders%ROWTYPE;sb public.stock_balances%ROWTYPE;s public.manufacturing_spools%ROWTYPE;rs public.stock_reservations%ROWTYPE; stock_qty numeric; val numeric; new_state text;
BEGIN
 PERFORM public.factory_assert_actor_v2(t,b,u);
 IF req IS NULL OR actual IS NULL OR actual::text IN ('NaN','Infinity','-Infinity') OR actual<0 OR actual<>round(actual,3) OR waste IS NULL OR (actual=0 AND (waste OR attempt IS NOT NULL)) THEN RAISE EXCEPTION 'Invalid settlement' USING ERRCODE='22023'; END IF;
 SELECT * INTO a FROM public.manufacturing_material_allocations WHERE tenant_id=t AND branch_id=b AND id=allocation;
 IF NOT FOUND THEN RAISE EXCEPTION 'Allocation unavailable' USING ERRCODE='22023'; END IF;
 SELECT * INTO o FROM public.manufacturing_orders WHERE "TenantId"=t AND "BranchId"=b AND "Id"=a.order_id FOR UPDATE;
 SELECT * INTO a FROM public.manufacturing_material_allocations WHERE tenant_id=t AND branch_id=b AND id=allocation FOR UPDATE;
 IF a.state<>'RESERVED' THEN
  IF (a.settlement_request_id,a.actual_quantity,a.waste,a.attempt_id) IS DISTINCT FROM (req,actual,waste,attempt) THEN RAISE EXCEPTION 'Already settled or idempotency mismatch' USING ERRCODE='23514'; END IF;
  RETURN jsonb_build_object('id',allocation,'state',a.state,'actual',actual);
 END IF;
 IF actual>a.planned_quantity OR (actual>0 AND o."Status" NOT IN (8,9,10)) OR (actual>0 AND o."MaterialStockReservationId" IS NOT NULL) THEN RAISE EXCEPTION 'Consumption exceeds plan or order state invalid' USING ERRCODE='23514'; END IF;
 IF actual>0 AND a.spool_id IS NOT NULL AND (attempt IS NULL OR NOT EXISTS(SELECT 1 FROM public.manufacturing_print_attempts x WHERE x."Id"=attempt AND x."TenantId"=t AND x."ManufacturingOrderId"=a.order_id AND x."Status" IN (3,4))) THEN RAISE EXCEPTION 'Active print attempt required' USING ERRCODE='23514'; END IF;
 IF attempt IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.manufacturing_print_attempts x WHERE x."Id"=attempt AND x."TenantId"=t AND x."ManufacturingOrderId"=a.order_id) THEN RAISE EXCEPTION 'Attempt unavailable' USING ERRCODE='22023'; END IF;
 IF a.spool_id IS NULL AND actual<>trunc(actual) THEN RAISE EXCEPTION 'Supply requires whole units' USING ERRCODE='22023'; END IF;
 SELECT * INTO sb FROM public.stock_balances WHERE "Id"=a.balance_id AND "TenantId"=t AND "BranchId"=b FOR UPDATE;
 SELECT * INTO rs FROM public.stock_reservations WHERE "Id"=a.reservation_id AND "TenantId"=t AND "BranchId"=b FOR UPDATE;
 stock_qty:=actual/a.units_per_stock_unit;
 IF rs."Status"<>1 OR stock_qty<>round(stock_qty,4) OR sb."ReservedQuantity"<a.planned_stock_quantity OR sb."OnHandQuantity"<stock_qty OR sb."OnHandQuantity"-stock_qty<sb."ReservedQuantity"-a.planned_stock_quantity+sb."BlockedQuantity" THEN RAISE EXCEPTION 'Inventory reconciliation required' USING ERRCODE='23514'; END IF;
 IF a.spool_id IS NOT NULL THEN
  SELECT * INTO s FROM public.manufacturing_spools WHERE "Id"=a.spool_id AND "TenantId"=t AND "BranchId"=b FOR UPDATE;
  IF s."RemainingWeightGrams"<actual THEN RAISE EXCEPTION 'Physical spool insufficient' USING ERRCODE='23514'; END IF;
 END IF;
 val:=round(stock_qty*sb."AverageCost",6);new_state:=CASE WHEN actual=0 THEN 'RELEASED' ELSE 'CONSUMED' END;
 UPDATE public.manufacturing_material_allocations SET state=new_state,actual_quantity=actual,actual_stock_quantity=stock_qty,actual_stock_cost=val,settlement_request_id=req,waste=factory_settle_material_v2.waste,attempt_id=attempt,settled_by=u,settled_at=now() WHERE tenant_id=t AND branch_id=b AND id=allocation;
 IF actual>0 AND a.spool_id IS NOT NULL THEN
  UPDATE public.manufacturing_spools SET "RemainingWeightGrams"="RemainingWeightGrams"-actual,"IsActive"=("RemainingWeightGrams"-actual)>0,"UpdatedAtUtc"=now() WHERE "Id"=a.spool_id AND "TenantId"=t AND "BranchId"=b;
 END IF;
 UPDATE public.stock_balances SET "ReservedQuantity"="ReservedQuantity"-a.planned_stock_quantity,"OnHandQuantity"="OnHandQuantity"-stock_qty,"LastMovementAtUtc"=now(),"UpdatedAtUtc"=now() WHERE "Id"=a.balance_id AND "TenantId"=t AND "BranchId"=b;
 UPDATE public.stock_reservations SET "Status"=CASE WHEN actual=0 THEN 3 ELSE 2 END,"UpdatedAtUtc"=now() WHERE "Id"=a.reservation_id AND "TenantId"=t AND "BranchId"=b;
 IF actual>0 THEN
  INSERT INTO public.stock_movements("Id","BranchId","WarehouseId","WarehouseLocationId","ProductSkuId","MovementType","Quantity","UnitCost","TotalCost","BalanceAfterQuantity","DocumentReference","Reason","CorrelationId","IdempotencyKey","CreatedByUserId","CreatedAtUtc","TenantId") VALUES(gen_random_uuid(),b,sb."WarehouseId",sb."WarehouseLocationId",sb."ProductSkuId",10,-stock_qty,sb."AverageCost",round(val,2),sb."OnHandQuantity"-stock_qty,'FAB-OP-'||a.order_id::text,CASE WHEN waste THEN 'Refugo de fabricação 3D' ELSE 'Consumo de fabricação 3D' END,req,'FAB-CONSUME-'||allocation::text,u,now(),t);
  PERFORM set_config('hbstudio.factory_order_command',a.order_id::text,true);
  UPDATE public.manufacturing_orders SET "ActualMaterialCost"="ActualMaterialCost"+CASE WHEN waste THEN 0 ELSE val END,"ActualWasteCost"="ActualWasteCost"+CASE WHEN waste THEN val ELSE 0 END,"UpdatedAtUtc"=now() WHERE "Id"=a.order_id AND "TenantId"=t AND "BranchId"=b;
 END IF;
 INSERT INTO public.audit_events("Id","TenantId","BranchId","EntityType","EntityId","Action","ActorId","ActorEmail","CorrelationId","AfterStateJson","CreatedAtUtc","Version") SELECT gen_random_uuid(),t,b,'FactoryMaterialAllocation',allocation::text,new_state,u,x."Email",req::text,jsonb_build_object('order',a.order_id,'actual',actual,'waste',waste,'attempt',attempt),now(),1 FROM public.users x WHERE x."Id"=u;
 RETURN jsonb_build_object('id',allocation,'state',new_state,'actual',actual);
END $function$;

CREATE FUNCTION public.factory_start_attempt_v2(t uuid, b uuid, u uuid, req uuid, p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE prior jsonb;r jsonb;ord uuid;prid uuid;att uuid:=gen_random_uuid();o public.manufacturing_orders%ROWTYPE;d public.manufacturing_factory_order_details%ROWTYPE;pr public.manufacturing_printers%ROWTYPE;seq integer;secs integer;grams numeric;
BEGIN
 prior:=public.factory_begin_command_v2(t,b,u,req,'StartAttempt',p);IF prior IS NOT NULL THEN RETURN prior;END IF;
 ord:=(p->>'orderId')::uuid;prid:=(p->>'printerId')::uuid;secs:=public.factory_number_v2(p,'seconds',1,31536000,true);
 SELECT * INTO o FROM public.manufacturing_orders WHERE "TenantId"=t AND "BranchId"=b AND "Id"=ord FOR UPDATE;
 SELECT * INTO d FROM public.manufacturing_factory_order_details WHERE tenant_id=t AND branch_id=b AND order_id=ord;
 IF NOT FOUND OR o."Status"<>7 THEN RAISE EXCEPTION 'Order not in queue' USING ERRCODE='23514';END IF;
 IF public.factory_number_v2(p,'version',1,2147483647,true)<>d.version THEN RAISE EXCEPTION 'Stale order version' USING ERRCODE='23514';END IF;
 SELECT * INTO pr FROM public.manufacturing_printers WHERE "TenantId"=t AND "BranchId"=b AND "Id"=prid FOR UPDATE;
 IF NOT FOUND OR pr."Status"<>1 OR pr."AveragePowerWatts"<=0 OR pr."ConfiguredHourlyMachineCost"<0 THEN RAISE EXCEPTION 'Printer not available' USING ERRCODE='23514';END IF;
 IF EXISTS(SELECT 1 FROM public.manufacturing_print_attempts WHERE "TenantId"=t AND "PrinterId"=prid AND "Status" IN (2,3,4)) THEN RAISE EXCEPTION 'Printer has active attempt' USING ERRCODE='23514';END IF;
 SELECT coalesce(sum(planned_quantity),0) INTO grams FROM public.manufacturing_material_allocations WHERE tenant_id=t AND branch_id=b AND order_id=ord AND spool_id IS NOT NULL AND state='RESERVED';
 IF grams<=0 THEN RAISE EXCEPTION 'Reserve filament before starting' USING ERRCODE='23514';END IF;
 SELECT coalesce(max("AttemptNumber"),0)+1 INTO seq FROM public.manufacturing_print_attempts WHERE "TenantId"=t AND "ManufacturingOrderId"=ord;
 PERFORM set_config('hbstudio.factory_order_command',ord::text,true);
 INSERT INTO public.manufacturing_print_attempts("Id","ManufacturingOrderId","AttemptNumber","PrinterId","Status","EstimatedDurationMinutes","ActualDurationMinutes","EstimatedMassGrams","ActualMassGrams","OperatorName","StartedAtUtc","CreatedAtUtc","TenantId") SELECT att,ord,seq,prid,3,secs/60::numeric,0,grams,0,x."FullName",now(),now(),t FROM public.users x WHERE x."Id"=u;
 INSERT INTO public.manufacturing_factory_attempt_details(tenant_id,branch_id,order_id,attempt_id,estimated_seconds,power_watts,machine_hour,tariff,labor_hour) VALUES(t,b,ord,att,secs,pr."AveragePowerWatts",pr."ConfiguredHourlyMachineCost",d.tariff,d.labor_hour);
 UPDATE public.manufacturing_orders SET "AssignedPrinterId"=prid,"Status"=8,"StartedAtUtc"=coalesce("StartedAtUtc",now()),"UpdatedAtUtc"=now() WHERE "Id"=ord;
 UPDATE public.manufacturing_printers SET "Status"=4,"StatusNote"='Executando '||o."OrderNumber","StatusUpdatedAtUtc"=now(),"UpdatedAtUtc"=now() WHERE "Id"=prid;
 UPDATE public.manufacturing_factory_order_details SET version=version+1 WHERE tenant_id=t AND branch_id=b AND order_id=ord;
 r:=jsonb_build_object('orderId',ord,'attemptId',att,'status',8,'version',d.version+1);
 RETURN public.factory_end_command_v2(t,b,u,req,'StartAttempt',p,r,'FactoryOrder',ord);
END $function$;

CREATE FUNCTION public.factory_text_v2(p jsonb, k text, lo integer, hi integer)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE v text;
BEGIN
 IF jsonb_typeof(p->k) IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'Text field required: %',k USING ERRCODE='22023';END IF;
 v:=btrim(p->>k);
 IF length(v)<lo OR length(v)>hi THEN RAISE EXCEPTION 'Invalid text: %',k USING ERRCODE='22023';END IF;
 RETURN v;
END $function$;

CREATE TRIGGER factory_guard_allocation_v2 BEFORE DELETE OR UPDATE ON public.manufacturing_material_allocations FOR EACH ROW EXECUTE FUNCTION factory_guard_allocation_v2();

CREATE TRIGGER factory_guard_attempt_v2 BEFORE INSERT OR UPDATE ON public.manufacturing_print_attempts FOR EACH ROW EXECUTE FUNCTION factory_guard_attempt_v2();

CREATE TRIGGER factory_guard_order_v2 BEFORE UPDATE ON public.manufacturing_orders FOR EACH ROW EXECUTE FUNCTION factory_guard_order_v2();

CREATE TRIGGER factory_guard_reservation_v2 BEFORE UPDATE ON public.stock_reservations FOR EACH ROW EXECUTE FUNCTION factory_guard_reservation_v2();

CREATE TRIGGER factory_guard_spool_v2 BEFORE UPDATE ON public.manufacturing_spools FOR EACH ROW EXECUTE FUNCTION factory_guard_spool_v2();

CREATE TRIGGER factory_guard_stock_v2 BEFORE UPDATE ON public.stock_balances FOR EACH ROW EXECUTE FUNCTION factory_guard_stock_v2();

COMMIT;
