-- QA manufacturing procurement: approved purchase, receipt, stock, lot and payable in one transaction.

-- Existing production checkout and purchasing remain unchanged.

BEGIN;

CREATE UNIQUE INDEX ux_factory_purchase_order_scope_v6 ON public.purchase_orders USING btree ("TenantId", "BranchId", "Id");

CREATE TABLE public.factory_purchase_config_v6 (
 "tenant_id" uuid NOT NULL,
 "branch_id" uuid NOT NULL,
 "payable_account" uuid NOT NULL,
 CONSTRAINT "factory_purchase_config_v6_pkey" PRIMARY KEY (tenant_id, branch_id),
 CONSTRAINT "factory_purchase_config_v6_tenant_id_payable_account_fkey" FOREIGN KEY (tenant_id, payable_account) REFERENCES financial_accounts("TenantId", "Id")
);

CREATE TABLE public.factory_purchase_orders_v6 (
 "tenant_id" uuid NOT NULL,
 "branch_id" uuid NOT NULL,
 "order_id" uuid NOT NULL,
 "balance_id" uuid NOT NULL,
 "planned_stock_quantity" numeric(18,4) NOT NULL,
 "unit_cost" numeric(18,2) NOT NULL,
 "roll_count" integer,
 "grams_per_roll" numeric(18,3),
 "tare_grams" numeric(18,3),
 "due_at" timestamp with time zone NOT NULL,
 "version" integer DEFAULT 1 NOT NULL,
 "receipt_id" uuid,
 "payable_id" uuid,
 "journal_id" uuid,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 CONSTRAINT "factory_purchase_orders_v6_check" CHECK ((((roll_count IS NULL) AND (grams_per_roll IS NULL) AND (tare_grams IS NULL)) OR (((roll_count >= 1) AND (roll_count <= 100)) AND (grams_per_roll > (0)::numeric) AND (tare_grams >= (0)::numeric)))),
 CONSTRAINT "factory_purchase_orders_v6_pkey" PRIMARY KEY (tenant_id, branch_id, order_id),
 CONSTRAINT "factory_purchase_orders_v6_planned_stock_quantity_check" CHECK ((planned_stock_quantity > (0)::numeric)),
 CONSTRAINT "factory_purchase_orders_v6_tenant_id_branch_id_balance_id_fkey" FOREIGN KEY (tenant_id, branch_id, balance_id) REFERENCES manufacturing_material_balance_configs(tenant_id, branch_id, balance_id),
 CONSTRAINT "factory_purchase_orders_v6_tenant_id_branch_id_order_id_fkey" FOREIGN KEY (tenant_id, branch_id, order_id) REFERENCES purchase_orders("TenantId", "BranchId", "Id"),
 CONSTRAINT "factory_purchase_orders_v6_unit_cost_check" CHECK ((unit_cost > (0)::numeric))
);

CREATE FUNCTION public.factory_purchase_approve_v6(t uuid, b uuid, u uuid, req uuid, p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE prior jsonb;id uuid;po public.purchase_orders%ROWTYPE;d public.factory_purchase_orders_v6%ROWTYPE;r jsonb;
BEGIN
 PERFORM public.factory_purchase_authorize_v6(t,b,u,'purchases.approve');
 prior:=public.factory_begin_command_v2(t,b,u,req,'FactoryPurchaseApprove',p);IF prior IS NOT NULL THEN RETURN prior;END IF;
 id:=(p->>'orderId')::uuid;SELECT * INTO po FROM public.purchase_orders WHERE "TenantId"=t AND "BranchId"=b AND "Id"=id FOR UPDATE;
 SELECT * INTO d FROM public.factory_purchase_orders_v6 WHERE tenant_id=t AND branch_id=b AND order_id=id;
 IF NOT FOUND OR po."Status"<>1 OR d.version<>public.factory_number_v2(p,'version',1,2147483647,true) THEN RAISE EXCEPTION 'PURCHASE_APPROVAL_CONFLICT' USING ERRCODE='23514';END IF;
 PERFORM set_config('hbstudio.factory_purchase_command',id::text,true);
 UPDATE public.purchase_orders SET "Status"=3,"ApprovedByUserId"=u,"ApprovedAtUtc"=now(),"UpdatedAtUtc"=now() WHERE "TenantId"=t AND "BranchId"=b AND "Id"=id;
 UPDATE public.factory_purchase_orders_v6 SET version=version+1 WHERE tenant_id=t AND branch_id=b AND order_id=id;
 r:=jsonb_build_object('id',id,'status',3,'version',d.version+1);
 RETURN public.factory_end_command_v2(t,b,u,req,'FactoryPurchaseApprove',p,r,'FactoryPurchase',id);
END $function$;

CREATE FUNCTION public.factory_purchase_authorize_v6(t uuid, b uuid, u uuid, perm text)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
 IF NOT public.internal_checkout_qa_enabled_v5() THEN RAISE EXCEPTION 'PURCHASE_QA_ONLY' USING ERRCODE='42501';END IF;
 PERFORM public.factory_assert_actor_v2(t,b,u);
 IF EXISTS(SELECT 1 FROM unnest(ARRAY['purchases.view',perm,'purchases.cost.view']) k WHERE NOT EXISTS(SELECT 1 FROM public.user_roles ur JOIN public.role_permissions rp ON rp."RoleId"=ur."RoleId" AND rp."TenantId"=ur."TenantId" WHERE ur."TenantId"=t AND ur."UserId"=u AND rp."PermissionKey"=k)) THEN RAISE EXCEPTION 'PURCHASE_PERMISSION' USING ERRCODE='42501';END IF;
END $function$;

CREATE FUNCTION public.factory_purchase_create_v6(t uuid, b uuid, u uuid, req uuid, p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE prior jsonb;bal uuid;sup uuid;sb public.stock_balances%ROWTYPE;c public.manufacturing_material_balance_configs%ROWTYPE;id uuid:=gen_random_uuid();item uuid:=gen_random_uuid();qty numeric;cost numeric;total numeric;n integer;grams numeric;tare numeric;due timestamptz;num text;sku_code text;descr text;r jsonb;
BEGIN
 PERFORM public.factory_purchase_authorize_v6(t,b,u,'purchases.create');
 prior:=public.factory_begin_command_v2(t,b,u,req,'FactoryPurchaseCreate',p);IF prior IS NOT NULL THEN RETURN prior;END IF;
 bal:=(p->>'balanceId')::uuid;sup:=(p->>'supplierId')::uuid;due:=(p->>'dueAt')::timestamptz;
 IF due IS NULL OR due<date_trunc('day',now()) OR NOT EXISTS(SELECT 1 FROM public.parties x JOIN public.supplier_profiles sp ON sp."TenantId"=x."TenantId" AND sp."PartyId"=x."Id" WHERE x."TenantId"=t AND x."Id"=sup AND x."IsActive") THEN RAISE EXCEPTION 'PURCHASE_SUPPLIER_OR_DUE_INVALID' USING ERRCODE='22023';END IF;
 SELECT * INTO c FROM public.manufacturing_material_balance_configs WHERE tenant_id=t AND branch_id=b AND balance_id=bal;
 IF NOT FOUND THEN RAISE EXCEPTION 'PURCHASE_MATERIAL_INVALID' USING ERRCODE='22023';END IF;
 SELECT * INTO sb FROM public.stock_balances WHERE "TenantId"=t AND "BranchId"=b AND "Id"=bal;
 SELECT s."SkuCode",left(m."Name"||' · '||s."VariantName",300) INTO sku_code,descr FROM public.product_skus s JOIN public.product_models m ON m."Id"=s."ProductModelId" AND m."TenantId"=t AND m."IsActive" AND m."SerializationPolicy"=0 WHERE s."TenantId"=t AND s."Id"=sb."ProductSkuId" AND s."IsActive";
 IF NOT FOUND THEN RAISE EXCEPTION 'PURCHASE_SKU_INVALID' USING ERRCODE='22023';END IF;
 IF c.kind='FILAMENT' THEN n:=public.factory_number_v2(p,'rollCount',1,100,true);grams:=public.factory_number_v2(p,'gramsPerRoll',0.001,100000);tare:=public.factory_number_v2(p,'tareGrams',0,100000);qty:=n*grams/c.units_per_stock_unit;IF grams<>round(grams,3) OR tare<>round(tare,3) THEN RAISE EXCEPTION 'PURCHASE_WEIGHT_INVALID' USING ERRCODE='22023';END IF;
 ELSE qty:=public.factory_number_v2(p,'quantity',1,1000000,true);END IF;
 total:=public.factory_number_v2(p,'total',0.01,100000000);cost:=total/qty;
 IF qty<>round(qty,4) OR total<>round(total,2) OR cost<>round(cost,2) THEN RAISE EXCEPTION 'PURCHASE_UNIT_COST_PRECISION' USING ERRCODE='22023';END IF;
 num:='QA-PC-'||upper(replace(id::text,'-',''));
 INSERT INTO public.purchase_orders("Id","TenantId","BranchId","SupplierPartyId","OrderNumber","Status","PaymentTerms","ShippingCost","OtherExpenses","TotalDiscount","Notes","CreatedByUserId","CreatedAtUtc") VALUES(id,t,b,sup,num,1,'A pagar',0,0,0,'Compra interna QA · '||public.factory_text_v2(p,'notes',0,500),u,now());
 INSERT INTO public.purchase_order_items("Id","TenantId","PurchaseOrderId","ProductSkuId","HistoricalSkuCode","HistoricalDescription","QuantityOrdered","QuantityReceived","UnitCost","Discount","CreatedAtUtc") VALUES(item,t,id,sb."ProductSkuId",sku_code,descr,qty,0,cost,0,now());
 INSERT INTO public.factory_purchase_orders_v6(tenant_id,branch_id,order_id,balance_id,planned_stock_quantity,unit_cost,roll_count,grams_per_roll,tare_grams,due_at) VALUES(t,b,id,bal,qty,cost,n,grams,tare,due);
 r:=jsonb_build_object('id',id,'number',num,'total',total,'unitCost',cost,'quantity',qty,'version',1,'status',1);
 RETURN public.factory_end_command_v2(t,b,u,req,'FactoryPurchaseCreate',p,r,'FactoryPurchase',id);
END $function$;

CREATE FUNCTION public.factory_purchase_guard_v6()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE id uuid;tid uuid;
BEGIN
 IF TG_TABLE_NAME='purchase_orders' THEN id:=OLD."Id";tid:=OLD."TenantId";ELSIF TG_OP='INSERT' THEN id:=NEW."PurchaseOrderId";tid:=NEW."TenantId";ELSE id:=OLD."PurchaseOrderId";tid:=OLD."TenantId";END IF;
 IF EXISTS(SELECT 1 FROM public.factory_purchase_orders_v6 d WHERE d.tenant_id=tid AND d.order_id=id) AND (TG_OP='DELETE' OR current_setting('hbstudio.factory_purchase_command',true) IS DISTINCT FROM id::text) THEN RAISE EXCEPTION 'PURCHASE_MANAGED_WORKFLOW' USING ERRCODE='23514';END IF;
 IF TG_OP='DELETE' THEN RETURN OLD;END IF;RETURN NEW;
END $function$;

CREATE FUNCTION public.factory_purchase_receive_v6(t uuid, b uuid, u uuid, req uuid, p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE prior jsonb;id uuid;po public.purchase_orders%ROWTYPE;d public.factory_purchase_orders_v6%ROWTYPE;sb public.stock_balances%ROWTYPE;cfg public.internal_checkout_config_v5%ROWTYPE;pc public.factory_purchase_config_v6%ROWTYPE;receipt uuid:=gen_random_uuid();receipt_item uuid:=gen_random_uuid();payable uuid:=gen_random_uuid();journal uuid;po_item uuid;document text;batch text;num text;total numeric;avg_cost numeric;rolls jsonb:='[]';r jsonb;
BEGIN
 PERFORM public.factory_purchase_authorize_v6(t,b,u,'purchases.receive');
 prior:=public.factory_begin_command_v2(t,b,u,req,'FactoryPurchaseReceive',p);IF prior IS NOT NULL THEN RETURN prior;END IF;
 cfg:=public.internal_checkout_config_get_v5(t,b);
 SELECT * INTO pc FROM public.factory_purchase_config_v6 WHERE tenant_id=t AND branch_id=b;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.financial_accounts WHERE "TenantId"=t AND "Id"=pc.payable_account AND "Type"=2 AND "IsActive") THEN RAISE EXCEPTION 'PURCHASE_ACCOUNT_CONFIG' USING ERRCODE='23514';END IF;
 id:=(p->>'orderId')::uuid;document:=upper(public.factory_text_v2(p,'document',1,100));batch:=public.factory_text_v2(p,'batch',0,120);
 SELECT * INTO po FROM public.purchase_orders WHERE "TenantId"=t AND "BranchId"=b AND "Id"=id FOR UPDATE;
 SELECT * INTO d FROM public.factory_purchase_orders_v6 WHERE tenant_id=t AND branch_id=b AND order_id=id;
 IF NOT FOUND OR po."Status"<>3 OR d.receipt_id IS NOT NULL OR d.version<>public.factory_number_v2(p,'version',1,2147483647,true) THEN RAISE EXCEPTION 'PURCHASE_RECEIPT_CONFLICT' USING ERRCODE='23514';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(t::text||b::text||po."SupplierPartyId"::text||document,9));
 IF EXISTS(SELECT 1 FROM public.goods_receipts WHERE "TenantId"=t AND "BranchId"=b AND "SupplierPartyId"=po."SupplierPartyId" AND upper(btrim("InvoiceOrDocumentNumber"))=document AND "Status"=2) THEN RAISE EXCEPTION 'PURCHASE_DUPLICATE_DOCUMENT' USING ERRCODE='23514';END IF;
 SELECT * INTO sb FROM public.stock_balances WHERE "TenantId"=t AND "BranchId"=b AND "Id"=d.balance_id FOR UPDATE;
 IF NOT FOUND OR sb."OnHandQuantity"<0 OR sb."AverageCost"<0 OR NOT EXISTS(SELECT 1 FROM public.warehouses WHERE "TenantId"=t AND "BranchId"=b AND "Id"=sb."WarehouseId" AND "IsActive") THEN RAISE EXCEPTION 'PURCHASE_STOCK_INVALID' USING ERRCODE='23514';END IF;
 SELECT "Id" INTO po_item FROM public.purchase_order_items WHERE "TenantId"=t AND "PurchaseOrderId"=id AND "ProductSkuId"=sb."ProductSkuId" AND "QuantityOrdered"=d.planned_stock_quantity AND "QuantityReceived"=0 AND "UnitCost"=d.unit_cost;
 IF NOT FOUND OR (SELECT count(*) FROM public.purchase_order_items WHERE "TenantId"=t AND "PurchaseOrderId"=id)<>1 THEN RAISE EXCEPTION 'PURCHASE_ITEM_CONFLICT' USING ERRCODE='23514';END IF;
 total:=round(d.planned_stock_quantity*d.unit_cost,2);avg_cost:=round((sb."OnHandQuantity"*sb."AverageCost"+total)/(sb."OnHandQuantity"+d.planned_stock_quantity),4);num:='QA-RC-'||upper(replace(receipt::text,'-',''));
 INSERT INTO public.goods_receipts("Id","TenantId","BranchId","WarehouseId","WarehouseLocationId","PurchaseOrderId","SupplierPartyId","ReceiptNumber","InvoiceOrDocumentNumber","Status","IdempotencyKey","ReceivedByUserId","CreatedAtUtc") VALUES(receipt,t,b,sb."WarehouseId",sb."WarehouseLocationId",id,po."SupplierPartyId",num,document,2,'QA-PURCHASE-'||req::text,u,now());
 INSERT INTO public.goods_receipt_items("Id","TenantId","GoodsReceiptId","ProductSkuId","QuantityReceived","RealUnitCost","CreatedAtUtc") VALUES(receipt_item,t,receipt,sb."ProductSkuId",d.planned_stock_quantity,d.unit_cost,now());
 UPDATE public.stock_balances SET "OnHandQuantity"="OnHandQuantity"+d.planned_stock_quantity,"AverageCost"=avg_cost,"LastMovementAtUtc"=now(),"UpdatedAtUtc"=now() WHERE "TenantId"=t AND "BranchId"=b AND "Id"=d.balance_id;
 INSERT INTO public.stock_movements("Id","TenantId","BranchId","WarehouseId","WarehouseLocationId","ProductSkuId","MovementType","Quantity","UnitCost","TotalCost","BalanceAfterQuantity","DocumentReference","Reason","CorrelationId","IdempotencyKey","CreatedByUserId","CreatedAtUtc") VALUES(gen_random_uuid(),t,b,sb."WarehouseId",sb."WarehouseLocationId",sb."ProductSkuId",2,d.planned_stock_quantity,d.unit_cost,total,sb."OnHandQuantity"+d.planned_stock_quantity,num,'Recebimento industrial QA',receipt,'QA-RECEIPT-'||receipt_item::text,u,now());
 IF d.roll_count IS NOT NULL THEN rolls:=public.factory_register_received_spools_v3(t,b,u,gen_random_uuid(),jsonb_build_object('receiptItemId',receipt_item,'balanceId',d.balance_id,'count',d.roll_count,'grams',d.grams_per_roll,'tare',d.tare_grams,'batch',batch));END IF;
 INSERT INTO public.accounts_payable("Id","TenantId","BranchId","SupplierPartyId","TitleNumber","Description","IssueDateUtc","DueDateUtc","OriginalAmount","PaidAmount","Status","DocumentReference","PurchaseOrderId","CreatedAtUtc") VALUES(payable,t,b,po."SupplierPartyId",'QA-AP-'||payable::text,'Compra industrial QA '||po."OrderNumber",now(),d.due_at,total,0,2,num,id,now());
 journal:=public.internal_checkout_journal_v5(t,b,u,'QA_PURCHASE_RECEIPT',receipt,num,'Entrada de materiais a pagar — homologação',cfg.stock_account,pc.payable_account,total);
 PERFORM set_config('hbstudio.factory_purchase_command',id::text,true);
 UPDATE public.purchase_order_items SET "QuantityReceived"="QuantityOrdered","UpdatedAtUtc"=now() WHERE "TenantId"=t AND "Id"=po_item;
 UPDATE public.purchase_orders SET "Status"=6,"UpdatedAtUtc"=now() WHERE "TenantId"=t AND "BranchId"=b AND "Id"=id;
 UPDATE public.factory_purchase_orders_v6 SET version=version+1,receipt_id=receipt,payable_id=payable,journal_id=journal WHERE tenant_id=t AND branch_id=b AND order_id=id;
 r:=jsonb_build_object('id',id,'status',6,'version',d.version+1,'receiptId',receipt,'payableId',payable,'total',total,'rolls',rolls);
 RETURN public.factory_end_command_v2(t,b,u,req,'FactoryPurchaseReceive',p,r,'FactoryPurchase',id);
END $function$;

CREATE OR REPLACE FUNCTION public.factory_register_spools_v2(t uuid, b uuid, u uuid, req uuid, bal uuid, n integer, grams numeric, tare numeric, batch text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE sb public.stock_balances%ROWTYPE;c public.manufacturing_material_balance_configs%ROWTYPE; prior public.manufacturing_spool_registration_requests%ROWTYPE;
 payload jsonb; result jsonb:='[]'::jsonb; grp text; seq bigint; sid uuid; code text; tracked numeric; factory_reserved numeric; i integer;
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
 SELECT coalesce(sum(a.planned_stock_quantity),0) INTO factory_reserved FROM public.manufacturing_material_allocations a WHERE a.tenant_id=t AND a.branch_id=b AND a.balance_id=bal AND a.spool_id IS NOT NULL AND a.state='RESERVED';
 IF factory_reserved>sb."ReservedQuantity" OR (grams/c.units_per_stock_unit)<>round(grams/c.units_per_stock_unit,6) OR tracked+n*grams>(sb."OnHandQuantity"-(sb."ReservedQuantity"-factory_reserved)-sb."BlockedQuantity")*c.units_per_stock_unit THEN RAISE EXCEPTION 'Insufficient unassigned stock or unit precision' USING ERRCODE='23514'; END IF;
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

CREATE TRIGGER factory_purchase_guard_items_v6 BEFORE INSERT OR DELETE OR UPDATE ON public.purchase_order_items FOR EACH ROW EXECUTE FUNCTION factory_purchase_guard_v6();

CREATE TRIGGER factory_purchase_guard_order_v6 BEFORE DELETE OR UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION factory_purchase_guard_v6();

COMMIT;
