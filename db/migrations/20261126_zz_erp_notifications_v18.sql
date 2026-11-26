CREATE TABLE public.erp_notification_reads_v18 (
 tenant_id uuid NOT NULL, branch_id uuid NOT NULL, user_id uuid NOT NULL,
 notification_key text NOT NULL CHECK(length(notification_key) BETWEEN 1 AND 220),
 read_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,branch_id,user_id,notification_key),
 FOREIGN KEY(tenant_id,branch_id) REFERENCES public.branches("TenantId","Id"),
 FOREIGN KEY(tenant_id,user_id) REFERENCES public.users("TenantId","Id"));

CREATE FUNCTION public.erp_notifications_v18(t uuid,b uuid,u uuid)
RETURNS TABLE(notification_key text,category text,severity text,title text,description text,href text,event_at timestamptz,read_at timestamptz)
LANGUAGE sql STABLE SET search_path=pg_catalog,public AS $fn$
WITH access AS (
 SELECT coalesce(array_agg(DISTINCT rp."PermissionKey") FILTER(WHERE rp."PermissionKey" IS NOT NULL),ARRAY[]::text[]) perms
 FROM public.users x JOIN public.branches br ON br."TenantId"=x."TenantId" AND br."Id"=b AND br."IsActive"
 LEFT JOIN public.user_roles ur ON ur."TenantId"=x."TenantId" AND ur."UserId"=x."Id"
 LEFT JOIN public.role_permissions rp ON rp."TenantId"=ur."TenantId" AND rp."RoleId"=ur."RoleId"
 WHERE x."TenantId"=t AND x."Id"=u AND x."DefaultBranchId"=b AND x."IsActive"
 AND EXISTS(SELECT 1 FROM public.partners pa WHERE pa."TenantId"=t AND lower(pa."Email")=lower(x."Email") AND pa."Status"=1 AND pa."IsErpAccessEnabled")
), clock AS (SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date today), candidates AS (
SELECT 'payable:'||p."Id"||':'||extract(epoch from p."DueDateUtc")::bigint||':'||CASE WHEN d.due_day<clock.today THEN 'late' ELSE 'due' END k,'finance' cat,CASE WHEN d.due_day<clock.today THEN 'urgent' ELSE 'warning' END sev,CASE WHEN d.due_day<clock.today THEN 'Conta a pagar vencida' ELSE 'Conta a pagar próxima do vencimento' END title,'Título '||p."TitleNumber"||' · vencimento: '||to_char(d.due_day,'DD/MM/YYYY') descr,'/financial' href,p."DueDateUtc" event_at FROM public.accounts_payable p CROSS JOIN access CROSS JOIN clock CROSS JOIN LATERAL(SELECT (p."DueDateUtc" AT TIME ZONE 'America/Sao_Paulo')::date AS due_day)d WHERE p."TenantId"=t AND p."BranchId"=b AND 'finance.payables.view'=ANY(access.perms) AND p."Status" IN(2,3) AND p."OriginalAmount">p."PaidAmount" AND d.due_day<=clock.today+7
UNION ALL
SELECT 'receivable:'||p."Id"||':'||extract(epoch from p."DueDateUtc")::bigint||':'||CASE WHEN d.due_day<clock.today THEN 'late' ELSE 'due' END k,'finance' cat,CASE WHEN d.due_day<clock.today THEN 'urgent' ELSE 'warning' END sev,CASE WHEN d.due_day<clock.today THEN 'Conta a receber vencida' ELSE 'Conta a receber próxima do vencimento' END title,'Título '||p."TitleNumber"||' · vencimento: '||to_char(d.due_day,'DD/MM/YYYY') descr,'/financial' href,p."DueDateUtc" event_at FROM public.accounts_receivable p CROSS JOIN access CROSS JOIN clock CROSS JOIN LATERAL(SELECT (p."DueDateUtc" AT TIME ZONE 'America/Sao_Paulo')::date AS due_day)d WHERE p."TenantId"=t AND p."BranchId"=b AND 'finance.receivables.view'=ANY(access.perms) AND p."Status" IN(2,3) AND p."OriginalAmount">p."ReceivedAmount" AND d.due_day<=clock.today+7
UNION ALL
 SELECT 'stock:'||s."Id"||':'||extract(epoch from max(coalesce(sb."LastMovementAtUtc",sb."CreatedAtUtc")))::bigint,'inventory','warning','Produto sem estoque disponível',concat_ws(' · ',m."Name",s."VariantName",s."SkuCode"),'/inventory',max(coalesce(sb."LastMovementAtUtc",sb."CreatedAtUtc"))
 FROM public.stock_balances sb JOIN public.warehouses w ON w."TenantId"=sb."TenantId" AND w."BranchId"=sb."BranchId" AND w."Id"=sb."WarehouseId" AND w."IsActive"
 JOIN public.product_skus s ON s."TenantId"=sb."TenantId" AND s."Id"=sb."ProductSkuId" AND s."IsActive"
 JOIN public.product_models m ON m."TenantId"=s."TenantId" AND m."Id"=s."ProductModelId" AND m."IsActive" AND m."Kind"=1 AND m."SerializationPolicy"=0 CROSS JOIN access
 WHERE sb."TenantId"=t AND sb."BranchId"=b AND 'inventory.view'=ANY(access.perms)
 GROUP BY s."Id",m."Name",s."VariantName",s."SkuCode" HAVING sum(sb."OnHandQuantity"-sb."ReservedQuantity"-sb."BlockedQuantity")<=0
UNION ALL
 SELECT 'repair:'||r."Id"||':'||r."Status"||':'||extract(epoch from coalesce(r."UpdatedAtUtc",r."CreatedAtUtc"))::bigint,'repairs',CASE WHEN r."Status"=11 THEN 'info' WHEN r."Status"=7 THEN 'warning' ELSE 'urgent' END,CASE WHEN r."Status"=11 THEN 'OS pronta para retirada' WHEN r."Status"=7 THEN 'OS aguardando peças' ELSE 'OS com prazo vencido' END,'Ordem '||r."OrderNumber",'/repairs',coalesce(r."UpdatedAtUtc",r."CreatedAtUtc")
 FROM public.repair_orders r CROSS JOIN access CROSS JOIN clock WHERE r."TenantId"=t AND r."BranchId"=b AND 'repairs.view'=ANY(access.perms) AND (r."Status" IN(7,11) OR (r."Status" IN(1,2,3,4,5,8,9,10,14) AND (r."EstimatedCompletionUtc" AT TIME ZONE 'America/Sao_Paulo')::date<clock.today))
UNION ALL
 SELECT 'purchase:'||p."Id"||':'||extract(epoch from p."ExpectedDeliveryDateUtc")::bigint,'purchases','warning','Pedido de compra em atraso','Pedido '||p."OrderNumber"||' · previsão '||to_char(p."ExpectedDeliveryDateUtc" AT TIME ZONE 'America/Sao_Paulo','DD/MM/YYYY'),'/procurement',p."ExpectedDeliveryDateUtc"
 FROM public.purchase_orders p CROSS JOIN access CROSS JOIN clock WHERE p."TenantId"=t AND p."BranchId"=b AND 'purchases.view'=ANY(access.perms) AND p."Status" IN(4,5) AND (p."ExpectedDeliveryDateUtc" AT TIME ZONE 'America/Sao_Paulo')::date<clock.today
UNION ALL
 SELECT 'cash:'||s."Id"||':'||s."Status"||':'||extract(epoch from coalesce(s."UpdatedAtUtc",s."OpenedAtUtc"))::bigint,'cash','warning','Conferência de caixa pendente','Turno iniciado em '||to_char(s."OpenedAtUtc" AT TIME ZONE 'America/Sao_Paulo','DD/MM HH24:MI'),'/cash',coalesce(s."UpdatedAtUtc",s."OpenedAtUtc")
 FROM public.cash_shifts s CROSS JOIN access WHERE s."TenantId"=t AND s."BranchId"=b AND 'cash.shift.view'=ANY(access.perms) AND (s."OperatorUserId"=u OR 'cash.shift.approve'=ANY(access.perms)) AND s."Status" IN(2,3)
UNION ALL
 SELECT 'manufacturing:'||m."Id"||':'||m."Status"||':'||extract(epoch from coalesce(m."UpdatedAtUtc",m."CreatedAtUtc"))::bigint,'manufacturing',CASE WHEN m."Status"=14 THEN 'urgent' ELSE 'warning' END,CASE m."Status" WHEN 6 THEN 'Produção aguardando material' WHEN 10 THEN 'Produção aguardando inspeção' ELSE 'Falha na produção 3D' END,'Ordem '||m."OrderNumber",'/manufacturing',coalesce(m."UpdatedAtUtc",m."CreatedAtUtc")
 FROM public.manufacturing_orders m CROSS JOIN access WHERE m."TenantId"=t AND m."BranchId"=b AND 'manufacturing.view'=ANY(access.perms) AND m."Status" IN(6,10,14)
UNION ALL
 SELECT 'fleet:'||p."Id"||':'||extract(epoch from coalesce(p."UpdatedAtUtc",p."CreatedAtUtc"))::bigint||':'||CASE WHEN d.overdue THEN 'late' ELSE 'due' END,'fleet',CASE WHEN d.overdue THEN 'urgent' ELSE 'warning' END,CASE WHEN d.overdue THEN 'Manutenção de veículo vencida' ELSE 'Manutenção de veículo próxima' END,concat_ws(' · ',v."Brand",v."Model",p."PlanName"),'/fretes',coalesce(p."NextServiceDateUtc",p."UpdatedAtUtc",p."CreatedAtUtc")
 FROM public.fleet_maintenance_plans p JOIN public.fleet_vehicles v ON v."TenantId"=p."TenantId" AND v."Id"=p."VehicleId" CROSS JOIN access CROSS JOIN clock
 CROSS JOIN LATERAL(SELECT coalesce((p."NextServiceDateUtc" AT TIME ZONE 'America/Sao_Paulo')::date<clock.today,false) OR coalesce(v."CurrentOdometerKm">=p."NextServiceOdometerKm",false) AS overdue)d
 WHERE p."TenantId"=t AND v."BranchId"=b AND 'fleet.view'=ANY(access.perms) AND p."IsActive" AND (d.overdue OR (p."NextServiceDateUtc" AT TIME ZONE 'America/Sao_Paulo')::date<=clock.today+30 OR p."NextServiceOdometerKm"-v."CurrentOdometerKm"<=1000)
)
SELECT c.k,c.cat,c.sev,c.title,c.descr,c.href,c.event_at,r.read_at FROM candidates c LEFT JOIN public.erp_notification_reads_v18 r ON r.tenant_id=t AND r.branch_id=b AND r.user_id=u AND r.notification_key=c.k
$fn$;

CREATE FUNCTION public.erp_notifications_read_v18(t uuid,b uuid,u uuid,keys text[],all_active boolean)
RETURNS integer LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE n integer;BEGIN
 IF all_active IS NULL OR (NOT all_active AND (keys IS NULL OR cardinality(keys) NOT BETWEEN 1 AND 100)) THEN RAISE EXCEPTION 'NOTIFICATION_INVALID' USING ERRCODE='22023';END IF;
 INSERT INTO public.erp_notification_reads_v18(tenant_id,branch_id,user_id,notification_key)
 SELECT t,b,u,x.notification_key FROM public.erp_notifications_v18(t,b,u) x WHERE x.read_at IS NULL AND (all_active OR x.notification_key=ANY(keys))
 ON CONFLICT DO NOTHING; GET DIAGNOSTICS n=ROW_COUNT; RETURN n;
END $fn$;
