-- V19: canonical party birth date, annual customer relationship record, no external sends.
CREATE FUNCTION public.birthday_date_valid_v19(d timestamptz,typ integer) RETURNS boolean LANGUAGE sql STABLE SET search_path=pg_catalog,public AS $f$
 SELECT d IS NULL OR (typ=1 AND isfinite(d) AND (d AT TIME ZONE 'UTC')::date BETWEEN DATE '1900-01-01' AND (now() AT TIME ZONE 'America/Sao_Paulo')::date)
$f$;
CREATE FUNCTION public.birthday_guard_v19() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $f$
BEGIN IF NOT public.birthday_date_valid_v19(NEW."BirthDate",NEW."Type") THEN RAISE EXCEPTION 'BIRTH_DATE_INVALID' USING ERRCODE='23514';END IF;
 IF NEW."BirthDate" IS NOT NULL THEN NEW."BirthDate":=(NEW."BirthDate" AT TIME ZONE 'UTC')::date::timestamp AT TIME ZONE 'UTC';END IF;RETURN NEW;END $f$;
CREATE TRIGGER tr_party_birthday_v19 BEFORE INSERT OR UPDATE OF "BirthDate","Type" ON public.parties FOR EACH ROW EXECUTE FUNCTION public.birthday_guard_v19();
CREATE FUNCTION public.birthday_occurrence_v19(d date,y integer) RETURNS date LANGUAGE sql IMMUTABLE STRICT SET search_path=pg_catalog,public AS $f$
 SELECT make_date(y,extract(month from d)::int,least(extract(day from d)::int,extract(day from (make_date(y,extract(month from d)::int,1)+interval '1 month - 1 day'))::int))
$f$;
CREATE TABLE public.crm_birthday_contacts_v19(
 tenant_id uuid NOT NULL,party_id uuid NOT NULL,celebration_year integer NOT NULL CHECK(celebration_year BETWEEN 1900 AND 9999),branch_id uuid NOT NULL,actor_id uuid NOT NULL,
 status text NOT NULL CHECK(status IN('PREPARED','CONFIRMED','RELEASED')),prepared_at timestamptz NOT NULL DEFAULT now(),confirmed_at timestamptz,
 PRIMARY KEY(tenant_id,party_id,celebration_year),FOREIGN KEY(party_id) REFERENCES public.parties("Id"),FOREIGN KEY(tenant_id,branch_id) REFERENCES public.branches("TenantId","Id"),FOREIGN KEY(tenant_id,actor_id) REFERENCES public.users("TenantId","Id"),
 CHECK((status='CONFIRMED')=(confirmed_at IS NOT NULL))
);
CREATE FUNCTION public.birthday_contact_eligibility_v19(t uuid,p uuid) RETURNS TABLE(phone text,consented boolean) LANGUAGE sql STABLE SET search_path=pg_catalog,public AS $f$
 WITH contacts AS(SELECT regexp_replace(coalesce(c."WhatsApp",''),'[^0-9]','','g') digits,c."IsPrimary",c."CreatedAtUtc",c."Id" FROM public.party_contacts c WHERE c."TenantId"=t AND c."PartyId"=p),
 valid AS(SELECT CASE WHEN length(digits) IN(10,11) THEN '55'||digits WHEN digits~'^55[0-9]{10,11}$' THEN digits END phone,"IsPrimary","CreatedAtUtc","Id" FROM contacts),
 consent AS(SELECT c."IsOptIn" AND lower(c."Purpose")='marketing' ok FROM public.party_consent_records c WHERE c."TenantId"=t AND c."PartyId"=p AND lower(c."Channel")='whatsapp' AND (lower(c."Purpose")='marketing' OR (lower(c."Purpose")='all' AND NOT c."IsOptIn")) ORDER BY c."EventDateUtc" DESC,c."IsOptIn" ASC,c."CreatedAtUtc" DESC,c."Id" DESC LIMIT 1)
 SELECT (SELECT v.phone FROM valid v WHERE v.phone~'^55[1-9][0-9][2-9][0-9]{7,8}$' ORDER BY v."IsPrimary" DESC,v."CreatedAtUtc",v."Id" LIMIT 1),coalesce((SELECT ok FROM consent),false)
$f$;
CREATE FUNCTION public.birthday_calendar_v19(t uuid,today date) RETURNS TABLE(party_id uuid,name text,birthday date,celebration_year integer,days_left integer,status text)
LANGUAGE sql STABLE SET search_path=pg_catalog,public AS $f$
 WITH people AS(SELECT p."Id",p."Name",(p."BirthDate" AT TIME ZONE 'UTC')::date d FROM public.parties p JOIN public.customer_profiles c ON c."TenantId"=p."TenantId" AND c."PartyId"=p."Id" WHERE p."TenantId"=t AND p."Type"=1 AND p."IsActive" AND p."BirthDate" IS NOT NULL AND public.birthday_date_valid_v19(p."BirthDate",p."Type")),
 dates AS(SELECT x.*,public.birthday_occurrence_v19(x.d,extract(year from today)::int) this_year FROM people x),
 next_dates AS(SELECT x.*,CASE WHEN x.this_year<today THEN public.birthday_occurrence_v19(x.d,extract(year from today)::int+1) ELSE x.this_year END next_day FROM dates x)
 SELECT n."Id",n."Name",n.next_day,extract(year from n.next_day)::int,n.next_day-today,coalesce(r.status,'PENDING') FROM next_dates n LEFT JOIN public.crm_birthday_contacts_v19 r ON r.tenant_id=t AND r.party_id=n."Id" AND r.celebration_year=extract(year from n.next_day)::int WHERE n.next_day<=today+30
$f$;
CREATE FUNCTION public.birthday_command_v19(t uuid,b uuid,u uuid,p uuid,act text,body jsonb) RETURNS jsonb LANGUAGE plpgsql SET search_path=pg_catalog,public AS $f$
DECLARE perms text[];email text;customer public.parties%ROWTYPE;v text;d date;today date:=(now() AT TIME ZONE 'America/Sao_Paulo')::date;y integer;elig record;r public.crm_birthday_contacts_v19%ROWTYPE;out jsonb;opt boolean;evidence text;cid uuid:=gen_random_uuid();
BEGIN
 SELECT x."Email" INTO email FROM public.users x JOIN public.branches z ON z."TenantId"=x."TenantId" AND z."Id"=b AND z."IsActive" WHERE x."TenantId"=t AND x."Id"=u AND x."DefaultBranchId"=b AND x."IsActive" AND EXISTS(SELECT 1 FROM public.partners a WHERE a."TenantId"=t AND lower(a."Email")=lower(x."Email") AND a."Status"=1 AND a."IsErpAccessEnabled");
 IF NOT FOUND THEN RAISE EXCEPTION 'BIRTHDAY_FORBIDDEN' USING ERRCODE='42501';END IF;
 SELECT coalesce(array_agg(DISTINCT rp."PermissionKey"),ARRAY[]::text[]) INTO perms FROM public.user_roles ur JOIN public.role_permissions rp ON rp."TenantId"=ur."TenantId" AND rp."RoleId"=ur."RoleId" WHERE ur."TenantId"=t AND ur."UserId"=u;
 IF NOT('customers.view'=ANY(perms)) OR (act IN('DATE','CONSENT') AND NOT('customers.edit'=ANY(perms))) OR (act='DATE' AND NOT('customers.sensitive.view'=ANY(perms))) OR (act IN('PREPARE','CONFIRM','RELEASE') AND NOT(ARRAY['crm.view','crm.campaign.send','messaging.send']<@perms)) THEN RAISE EXCEPTION 'BIRTHDAY_FORBIDDEN' USING ERRCODE='42501';END IF;
 SELECT x.* INTO customer FROM public.parties x JOIN public.customer_profiles cp ON cp."TenantId"=x."TenantId" AND cp."PartyId"=x."Id" WHERE x."TenantId"=t AND x."Id"=p AND x."Type"=1 FOR UPDATE OF x;
 IF NOT FOUND THEN RAISE EXCEPTION 'BIRTHDAY_NOT_FOUND' USING ERRCODE='23514';END IF;
 IF act IN('DATE','CONSENT') THEN
  SELECT x.xmin::text INTO v FROM public.parties x WHERE x."TenantId"=t AND x."Id"=p;
  IF v IS DISTINCT FROM body->>'version' THEN RAISE EXCEPTION 'BIRTHDAY_STALE' USING ERRCODE='23514';END IF;
  IF act='DATE' THEN
   IF NOT(body?'birthDate') OR (body->'birthDate'<>'null'::jsonb AND (body->>'birthDate')!~'^\d{4}-\d{2}-\d{2}$') THEN RAISE EXCEPTION 'BIRTH_DATE_INVALID' USING ERRCODE='22023';END IF;
   d:=(body->>'birthDate')::date;IF d IS NOT NULL AND (d<DATE '1900-01-01' OR d>today) THEN RAISE EXCEPTION 'BIRTH_DATE_INVALID' USING ERRCODE='22023';END IF;
   UPDATE public.parties SET "BirthDate"=d::timestamp AT TIME ZONE 'UTC',"UpdatedAtUtc"=now() WHERE "TenantId"=t AND "Id"=p;
   out:=jsonb_build_object('hasBirthDate',d IS NOT NULL);
  ELSE
   opt:=(body->>'optIn')::boolean;evidence:=btrim(body->>'evidence');
   IF opt IS NULL OR length(coalesce(evidence,'')) NOT BETWEEN 5 AND 500 THEN RAISE EXCEPTION 'BIRTHDAY_CONSENT_INVALID' USING ERRCODE='22023';END IF;
   INSERT INTO public.party_consent_records("Id","TenantId","PartyId","Channel","Purpose","IsOptIn","Origin","Evidence","EventDateUtc","CreatedAtUtc") VALUES(gen_random_uuid(),t,p,'WHATSAPP','Marketing',opt,'CRM_BIRTHDAY',evidence,clock_timestamp(),clock_timestamp());
   UPDATE public.parties SET "UpdatedAtUtc"=now() WHERE "TenantId"=t AND "Id"=p;
   out:=jsonb_build_object('optIn',opt);
  END IF;
 ELSIF act IN('PREPARE','CONFIRM','RELEASE') THEN
  y:=extract(year from today)::int;
  SELECT * INTO r FROM public.crm_birthday_contacts_v19 WHERE tenant_id=t AND party_id=p AND celebration_year=y FOR UPDATE;
  IF act='PREPARE' THEN
   IF NOT customer."IsActive" OR customer."BirthDate" IS NULL OR public.birthday_occurrence_v19((customer."BirthDate" AT TIME ZONE 'UTC')::date,y)<>today THEN RAISE EXCEPTION 'BIRTHDAY_NOT_TODAY' USING ERRCODE='23514';END IF;
   SELECT * INTO elig FROM public.birthday_contact_eligibility_v19(t,p);
   IF NOT elig.consented OR elig.phone IS NULL THEN RAISE EXCEPTION 'BIRTHDAY_NO_CONSENT_OR_PHONE' USING ERRCODE='23514';END IF;
   IF r.status='CONFIRMED' OR (r.status='PREPARED' AND (r.actor_id<>u OR r.branch_id<>b)) THEN RAISE EXCEPTION 'BIRTHDAY_ALREADY_HANDLED' USING ERRCODE='23514';END IF;
   INSERT INTO public.crm_birthday_contacts_v19(tenant_id,party_id,celebration_year,branch_id,actor_id,status) VALUES(t,p,y,b,u,'PREPARED') ON CONFLICT(tenant_id,party_id,celebration_year) DO UPDATE SET branch_id=b,actor_id=u,status='PREPARED',prepared_at=now(),confirmed_at=NULL WHERE crm_birthday_contacts_v19.status='RELEASED';
   out:=jsonb_build_object('status','PREPARED','phone',elig.phone,'name',customer."Name");
  ELSE
   IF r.status IS DISTINCT FROM 'PREPARED' OR r.actor_id<>u OR r.branch_id<>b THEN RAISE EXCEPTION 'BIRTHDAY_ALREADY_HANDLED' USING ERRCODE='23514';END IF;
   IF act='CONFIRM' AND body->'confirmed' IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION 'BIRTHDAY_CONFIRM_REQUIRED' USING ERRCODE='22023';END IF;
   IF act='RELEASE' AND body->'notSent' IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION 'BIRTHDAY_CONFIRM_REQUIRED' USING ERRCODE='22023';END IF;
   UPDATE public.crm_birthday_contacts_v19 SET status=CASE WHEN act='CONFIRM' THEN 'CONFIRMED' ELSE 'RELEASED' END,confirmed_at=CASE WHEN act='CONFIRM' THEN now() ELSE NULL END WHERE tenant_id=t AND party_id=p AND celebration_year=y;
   out:=jsonb_build_object('status',CASE WHEN act='CONFIRM' THEN 'CONFIRMED' ELSE 'RELEASED' END);
  END IF;
 ELSE RAISE EXCEPTION 'BIRTHDAY_INVALID' USING ERRCODE='22023';END IF;
 INSERT INTO public.audit_events("Id","TenantId","BranchId","EntityType","EntityId","Action","ActorId","ActorEmail","CorrelationId","AfterStateJson","CreatedAtUtc","Version") VALUES(cid,t,b,'CustomerBirthday',p::text,act,u,email,cid::text,out-'phone'-'name',now(),1);
 RETURN out;
END $f$;

CREATE OR REPLACE FUNCTION public.erp_notifications_v18(t uuid,b uuid,u uuid)
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
UNION ALL
 SELECT 'birthday:'||d.party_id||':'||d.celebration_year,'crm','info','Aniversário de cliente hoje',d.name,'/crm?tab=birthdays',d.birthday::timestamp AT TIME ZONE 'America/Sao_Paulo'
 FROM clock CROSS JOIN access CROSS JOIN LATERAL public.birthday_calendar_v19(t,clock.today) d WHERE ARRAY['crm.view','customers.view']<@access.perms::text[] AND d.days_left=0 AND d.status<>'CONFIRMED'
)
SELECT c.k,c.cat,c.sev,c.title,c.descr,c.href,c.event_at,r.read_at FROM candidates c LEFT JOIN public.erp_notification_reads_v18 r ON r.tenant_id=t AND r.branch_id=b AND r.user_id=u AND r.notification_key=c.k
$fn$;

