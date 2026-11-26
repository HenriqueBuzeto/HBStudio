-- Additive governance; canonical user_roles/role_permissions and cost centers remain authoritative.
CREATE UNIQUE INDEX IF NOT EXISTS ux_governance_role_scope_v11 ON public.roles("TenantId","Id");

CREATE UNIQUE INDEX IF NOT EXISTS ux_governance_center_scope_v11 ON public.financial_cost_centers("TenantId","Id");

CREATE TABLE IF NOT EXISTS public.organization_positions_v11(tenant_id uuid NOT NULL REFERENCES public.tenants("Id"),id uuid NOT NULL DEFAULT gen_random_uuid(),name varchar(100) NOT NULL CHECK(length(trim(name))>=2),description varchar(500) NOT NULL DEFAULT '',created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(tenant_id,id));

CREATE UNIQUE INDEX IF NOT EXISTS ux_governance_position_name_v11 ON public.organization_positions_v11(tenant_id,lower(name));

CREATE TABLE IF NOT EXISTS public.governance_roles_v11(tenant_id uuid NOT NULL,role_id uuid NOT NULL,PRIMARY KEY(tenant_id,role_id),FOREIGN KEY(tenant_id,role_id) REFERENCES public.roles("TenantId","Id"));

CREATE TABLE IF NOT EXISTS public.user_work_profiles_v11(tenant_id uuid NOT NULL,user_id uuid NOT NULL,position_id uuid,admission_date date,phone varchar(40) NOT NULL DEFAULT '',notes varchar(1000) NOT NULL DEFAULT '',base_cents bigint CHECK(base_cents BETWEEN 0 AND 100000000000),PRIMARY KEY(tenant_id,user_id),FOREIGN KEY(tenant_id,user_id) REFERENCES public.users("TenantId","Id"),FOREIGN KEY(tenant_id,position_id) REFERENCES public.organization_positions_v11(tenant_id,id));

CREATE TABLE IF NOT EXISTS public.sector_responsibilities_v11(tenant_id uuid NOT NULL,id uuid NOT NULL DEFAULT gen_random_uuid(),center_id uuid NOT NULL,user_id uuid NOT NULL,valid_from timestamptz NOT NULL DEFAULT now(),valid_to timestamptz,PRIMARY KEY(tenant_id,id),CHECK(valid_to IS NULL OR valid_to>=valid_from),FOREIGN KEY(tenant_id,center_id) REFERENCES public.financial_cost_centers("TenantId","Id"),FOREIGN KEY(tenant_id,user_id) REFERENCES public.users("TenantId","Id"));

CREATE UNIQUE INDEX IF NOT EXISTS ux_governance_current_center_v11 ON public.sector_responsibilities_v11(tenant_id,center_id) WHERE valid_to IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_governance_current_user_v11 ON public.sector_responsibilities_v11(tenant_id,user_id) WHERE valid_to IS NULL;

CREATE OR REPLACE FUNCTION public.user_governance_command_v11(t uuid,b uuid,actor uuid,act text,p jsonb) RETURNS jsonb LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE perms text[]; targetperms text[]; wanted text[]; ids uuid[]; uid uuid; rid uuid; pos uuid; center uuid; pid uuid; olduser public.users%ROWTYPE; oldrole public.roles%ROWTYPE; partner public.partners%ROWTYPE; name text; email text; title text; code text; description text; base bigint; cap bigint; monthly bigint; oldcenter uuid; stamp timestamptz:=clock_timestamp(); result jsonb; actor_email text; change_roles boolean; oldids uuid[]; isnew boolean;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(t::text||':user-governance-v11',0));
 SELECT u."Email" INTO actor_email FROM public.users u JOIN public.branches br ON br."TenantId"=t AND br."Id"=b AND br."IsActive" WHERE u."TenantId"=t AND u."Id"=actor AND u."IsActive" AND u."DefaultBranchId"=b AND EXISTS(SELECT 1 FROM public.partners x WHERE x."TenantId"=t AND lower(x."Email")=lower(u."Email") AND x."Status"=1 AND x."IsErpAccessEnabled");
 SELECT ARRAY(SELECT DISTINCT rp."PermissionKey"::text FROM public.user_roles ur JOIN public.role_permissions rp ON rp."TenantId"=ur."TenantId" AND rp."RoleId"=ur."RoleId" WHERE ur."TenantId"=t AND ur."UserId"=actor) INTO perms;
 IF actor_email IS NULL OR NOT ('access.manage'=ANY(perms)) THEN RAISE EXCEPTION 'GOV_FORBIDDEN' USING ERRCODE='42501'; END IF;
 name:=btrim(coalesce(p->>'name','')); description:=btrim(coalesce(p->>'description',''));
 IF act='POSITION' THEN
  IF length(name) NOT BETWEEN 2 AND 100 OR length(description)>500 THEN RAISE EXCEPTION 'GOV_VALIDATION' USING ERRCODE='22023';END IF;
  pos:=gen_random_uuid();INSERT INTO public.organization_positions_v11(tenant_id,id,name,description) VALUES(t,pos,name,description);result:=jsonb_build_object('id',pos);
 ELSIF act='CENTER' THEN
  IF NOT ('finance.costcenters.manage'=ANY(perms)) THEN RAISE EXCEPTION 'GOV_FORBIDDEN' USING ERRCODE='42501';END IF;
  code:=upper(btrim(coalesce(p->>'code','')));
  IF length(name) NOT BETWEEN 2 AND 150 OR length(code) NOT BETWEEN 1 AND 50 OR length(description)>500 THEN RAISE EXCEPTION 'GOV_VALIDATION' USING ERRCODE='22023';END IF;
  center:=gen_random_uuid();INSERT INTO public.financial_cost_centers("Id","TenantId","Code","Name","Description","IsActive","CreatedAtUtc") VALUES(center,t,code,name,description,true,stamp);result:=jsonb_build_object('id',center);
 ELSIF act='ROLE' THEN
  rid:=nullif(p->>'id','')::uuid;
  IF length(name) NOT BETWEEN 2 AND 100 OR length(description)>500 OR jsonb_typeof(p->'permissions') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'GOV_VALIDATION' USING ERRCODE='22023';END IF;
  SELECT ARRAY(SELECT DISTINCT x FROM jsonb_array_elements_text(p->'permissions') x ORDER BY x) INTO wanted;
  IF cardinality(wanted)=0 OR NOT wanted<@perms THEN RAISE EXCEPTION 'GOV_PERMISSION_ESCALATION' USING ERRCODE='42501';END IF;
  IF EXISTS(SELECT 1 FROM public.roles r WHERE r."TenantId"=t AND lower(r."Name")=lower(name) AND r."Id" IS DISTINCT FROM rid) THEN RAISE EXCEPTION 'GOV_DUPLICATE' USING ERRCODE='23505';END IF;
  IF rid IS NULL THEN rid:=gen_random_uuid();INSERT INTO public.roles("Id","TenantId","Name","Description","CreatedAtUtc") VALUES(rid,t,name,description,stamp);INSERT INTO public.governance_roles_v11 VALUES(t,rid);
  ELSE
   SELECT * INTO oldrole FROM public.roles r WHERE r."TenantId"=t AND r."Id"=rid FOR UPDATE;
   IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.governance_roles_v11 g WHERE g.tenant_id=t AND g.role_id=rid) THEN RAISE EXCEPTION 'GOV_SYSTEM_ROLE' USING ERRCODE='42501';END IF;
   IF coalesce(oldrole."UpdatedAtUtc",oldrole."CreatedAtUtc") IS DISTINCT FROM (p->>'version')::timestamptz THEN RAISE EXCEPTION 'GOV_CONFLICT' USING ERRCODE='23514';END IF;
   IF EXISTS(SELECT 1 FROM public.user_roles ur WHERE ur."TenantId"=t AND ur."RoleId"=rid AND ur."UserId"=actor) OR EXISTS(SELECT 1 FROM public.user_roles a JOIN public.user_roles ur ON ur."TenantId"=a."TenantId" AND ur."UserId"=a."UserId" JOIN public.role_permissions rp ON rp."TenantId"=ur."TenantId" AND rp."RoleId"=ur."RoleId" WHERE a."TenantId"=t AND a."RoleId"=rid AND NOT rp."PermissionKey"=ANY(perms)) OR EXISTS(SELECT 1 FROM public.role_permissions rp WHERE rp."TenantId"=t AND rp."RoleId"=rid AND NOT rp."PermissionKey"=ANY(perms)) THEN RAISE EXCEPTION 'GOV_PROTECTED_ROLE' USING ERRCODE='42501';END IF;
   UPDATE public.roles SET "Name"=name,"Description"=description,"UpdatedAtUtc"=stamp WHERE "TenantId"=t AND "Id"=rid;
   DELETE FROM public.role_permissions WHERE "TenantId"=t AND "RoleId"=rid;
   UPDATE public.users u SET "SecurityStamp"=greatest(u."SecurityStamp",1)+1,"UpdatedAtUtc"=stamp WHERE u."TenantId"=t AND EXISTS(SELECT 1 FROM public.user_roles ur WHERE ur."TenantId"=t AND ur."RoleId"=rid AND ur."UserId"=u."Id");
  END IF;
  INSERT INTO public.role_permissions("TenantId","RoleId","PermissionKey","Id","CreatedAtUtc","Version") SELECT t,rid,x,gen_random_uuid(),stamp,1 FROM unnest(wanted) x;result:=jsonb_build_object('id',rid,'permissions',wanted);
 ELSIF act IN('USER','PASSWORD','STATUS') THEN
  uid:=nullif(p->>'id','')::uuid;isnew:=uid IS NULL;
  IF NOT isnew THEN
   SELECT * INTO olduser FROM public.users u WHERE u."TenantId"=t AND u."Id"=uid FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'GOV_NOT_FOUND' USING ERRCODE='22023';END IF;
   SELECT ARRAY(SELECT DISTINCT rp."PermissionKey"::text FROM public.user_roles ur JOIN public.role_permissions rp ON rp."TenantId"=ur."TenantId" AND rp."RoleId"=ur."RoleId" WHERE ur."TenantId"=t AND ur."UserId"=uid) INTO targetperms;
   IF NOT targetperms<@perms THEN RAISE EXCEPTION 'GOV_PERMISSION_ESCALATION' USING ERRCODE='42501';END IF;
   IF coalesce(olduser."UpdatedAtUtc",olduser."CreatedAtUtc") IS DISTINCT FROM (p->>'version')::timestamptz THEN RAISE EXCEPTION 'GOV_CONFLICT' USING ERRCODE='23514';END IF;
  ELSIF act<>'USER' THEN RAISE EXCEPTION 'GOV_VALIDATION' USING ERRCODE='22023';END IF;
  IF act='STATUS' THEN
   IF uid=actor OR jsonb_typeof(p->'active') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'GOV_PROTECTED_USER' USING ERRCODE='42501';END IF;
   UPDATE public.users SET "IsActive"=(p->>'active')::boolean,"SecurityStamp"=greatest("SecurityStamp",1)+1,"UpdatedAtUtc"=stamp WHERE "TenantId"=t AND "Id"=uid;result:=jsonb_build_object('id',uid,'active',(p->>'active')::boolean);
  ELSIF act='PASSWORD' THEN
   IF p->>'hash' IS NULL OR p->>'hash' !~ '^v1[.]600000[.][A-Za-z0-9+/=]+[.][A-Za-z0-9+/=]+$' THEN RAISE EXCEPTION 'GOV_VALIDATION' USING ERRCODE='22023';END IF;
   UPDATE public.users SET "PasswordHash"=p->>'hash',"SecurityStamp"=greatest("SecurityStamp",1)+1,"UpdatedAtUtc"=stamp WHERE "TenantId"=t AND "Id"=uid;result:=jsonb_build_object('id',uid,'passwordReset',true);
  ELSE
   email:=lower(btrim(coalesce(p->>'email','')));pos:=nullif(p->>'positionId','')::uuid;center:=nullif(p->>'centerId','')::uuid;pid:=nullif(p->>'partnerId','')::uuid;
   IF length(name) NOT BETWEEN 2 AND 200 OR length(email)>250 OR email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' OR length(coalesce(p->>'phone',''))>40 OR length(coalesce(p->>'notes',''))>1000 OR jsonb_typeof(p->'roleIds') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'GOV_VALIDATION' USING ERRCODE='22023';END IF;
   IF pos IS NOT NULL THEN SELECT x.name INTO title FROM public.organization_positions_v11 x WHERE x.tenant_id=t AND x.id=pos;IF NOT FOUND THEN RAISE EXCEPTION 'GOV_INVALID_POSITION' USING ERRCODE='22023';END IF;ELSE title:=olduser."JobTitle";END IF;
   IF title IS NULL OR (isnew AND pos IS NULL) THEN RAISE EXCEPTION 'GOV_INVALID_POSITION' USING ERRCODE='22023';END IF;
   SELECT ARRAY(SELECT DISTINCT x::uuid FROM jsonb_array_elements_text(p->'roleIds') x ORDER BY x::uuid) INTO ids;
   SELECT ARRAY(SELECT ur."RoleId" FROM public.user_roles ur WHERE ur."TenantId"=t AND ur."UserId"=uid ORDER BY ur."RoleId") INTO oldids;
   change_roles:=ids IS DISTINCT FROM oldids;
   IF (SELECT count(*) FROM public.roles r WHERE r."TenantId"=t AND r."Id"=ANY(ids))<>cardinality(ids) OR EXISTS(SELECT 1 FROM public.role_permissions rp WHERE rp."TenantId"=t AND rp."RoleId"=ANY(ids) AND NOT rp."PermissionKey"=ANY(perms)) THEN RAISE EXCEPTION 'GOV_PERMISSION_ESCALATION' USING ERRCODE='42501';END IF;
   IF uid=actor AND change_roles THEN RAISE EXCEPTION 'GOV_PROTECTED_USER' USING ERRCODE='42501';END IF;
   IF NOT isnew THEN
    SELECT l.partner_id INTO pid FROM public.partner_user_links_v10 l WHERE l.tenant_id=t AND l.user_id=uid;
    IF pid IS NULL THEN SELECT x."Id" INTO pid FROM public.partners x WHERE x."TenantId"=t AND lower(x."Email")=lower(olduser."Email") AND x."Status"=1 AND x."IsErpAccessEnabled"; END IF;
    IF lower(olduser."Email")<>email THEN RAISE EXCEPTION 'GOV_EMAIL_PROTECTED' USING ERRCODE='23514';END IF;
   END IF;
   IF pid IS NOT NULL THEN SELECT * INTO partner FROM public.partners x WHERE x."TenantId"=t AND x."Id"=pid FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'GOV_INVALID_PARTNER' USING ERRCODE='22023';END IF;END IF;
   IF isnew THEN
    IF pid IS NULL OR partner."Status"<>1 OR NOT ('partners.manage'=ANY(perms)) OR cardinality(ids)=0 OR lower(partner."Email")<>email OR EXISTS(SELECT 1 FROM public.partner_user_links_v10 l WHERE l.tenant_id=t AND l.partner_id=pid) OR p->>'hash' IS NULL OR p->>'hash' !~ '^v1[.]600000[.][A-Za-z0-9+/=]+[.][A-Za-z0-9+/=]+$' OR EXISTS(SELECT 1 FROM public.users u WHERE lower(u."Email")=email) THEN RAISE EXCEPTION 'GOV_INVALID_PARTNER' USING ERRCODE='23514';END IF;
    uid:=gen_random_uuid();INSERT INTO public.users("Id","TenantId","FullName","Email","PasswordHash","IsActive","DefaultBranchId","CreatedAtUtc","SecurityStamp","JobTitle") VALUES(uid,t,name,email,p->>'hash',true,b,stamp,1,title);
    INSERT INTO public.partner_user_links_v10 VALUES(t,pid,uid);
    UPDATE public.partners SET "IsErpAccessEnabled"=true,"UpdatedAtUtc"=stamp WHERE "TenantId"=t AND "Id"=pid;
   ELSE UPDATE public.users SET "FullName"=name,"JobTitle"=title,"UpdatedAtUtc"=stamp,"SecurityStamp"=CASE WHEN change_roles THEN greatest("SecurityStamp",1)+1 ELSE "SecurityStamp" END WHERE "TenantId"=t AND "Id"=uid;END IF;
   IF change_roles OR isnew THEN
    DELETE FROM public.user_roles WHERE "TenantId"=t AND "UserId"=uid;
    INSERT INTO public.user_roles("TenantId","UserId","RoleId","Id","CreatedAtUtc","Version") SELECT t,uid,x,gen_random_uuid(),stamp,1 FROM unnest(ids) x;
   END IF;
   IF p ? 'baseCents' THEN
    IF NOT ('partners.compensation.manage'=ANY(perms)) THEN RAISE EXCEPTION 'GOV_FORBIDDEN' USING ERRCODE='42501';END IF;
    base:=(p->>'baseCents')::bigint;IF base IS NULL OR base NOT BETWEEN 0 AND 100000000000 THEN RAISE EXCEPTION 'GOV_VALIDATION' USING ERRCODE='22023';END IF;
    IF pid IS NOT NULL THEN
     cap:=(p->>'capCents')::bigint;monthly:=(p->>'monthlyCents')::bigint;
     IF cap IS NULL OR monthly IS NULL OR cap NOT BETWEEN 0 AND 100000000000 OR monthly NOT BETWEEN 0 AND 100000000000 OR base>cap THEN RAISE EXCEPTION 'GOV_VALIDATION' USING ERRCODE='22023';END IF;
     UPDATE public.partners SET "MonthlyCompensationCap"=cap/100.0,"UpdatedAtUtc"=stamp WHERE "TenantId"=t AND "Id"=pid;
     INSERT INTO public.partner_investment_profiles_v10 VALUES(t,pid,base,monthly) ON CONFLICT(tenant_id,partner_id) DO UPDATE SET base_cents=excluded.base_cents,monthly_cents=excluded.monthly_cents;
    END IF;
   END IF;
   INSERT INTO public.user_work_profiles_v11(tenant_id,user_id,position_id,admission_date,phone,notes,base_cents) VALUES(t,uid,pos,nullif(p->>'admissionDate','')::date,coalesce(p->>'phone',''),coalesce(p->>'notes',''),CASE WHEN pid IS NULL THEN base END) ON CONFLICT(tenant_id,user_id) DO UPDATE SET position_id=excluded.position_id,admission_date=excluded.admission_date,phone=excluded.phone,notes=excluded.notes,base_cents=CASE WHEN pid IS NOT NULL THEN NULL WHEN p ? 'baseCents' THEN excluded.base_cents ELSE user_work_profiles_v11.base_cents END;
   SELECT s.center_id INTO oldcenter FROM public.sector_responsibilities_v11 s WHERE s.tenant_id=t AND s.user_id=uid AND s.valid_to IS NULL;
   IF oldcenter IS DISTINCT FROM center THEN
    IF NOT ('finance.costcenters.manage'=ANY(perms)) THEN RAISE EXCEPTION 'GOV_FORBIDDEN' USING ERRCODE='42501';END IF;
    IF center IS NOT NULL AND (NOT EXISTS(SELECT 1 FROM public.financial_cost_centers c WHERE c."TenantId"=t AND c."Id"=center AND c."IsActive") OR EXISTS(SELECT 1 FROM public.sector_responsibilities_v11 s WHERE s.tenant_id=t AND s.center_id=center AND s.valid_to IS NULL AND s.user_id<>uid)) THEN RAISE EXCEPTION 'GOV_CENTER_ASSIGNED' USING ERRCODE='23514';END IF;
    UPDATE public.sector_responsibilities_v11 SET valid_to=stamp WHERE tenant_id=t AND user_id=uid AND valid_to IS NULL;
    IF center IS NOT NULL THEN INSERT INTO public.sector_responsibilities_v11(tenant_id,center_id,user_id,valid_from) VALUES(t,center,uid,stamp);END IF;
   END IF;
   result:=jsonb_build_object('id',uid,'positionId',pos,'centerId',center,'roleIds',ids,'partnerId',pid);
  END IF;
 ELSE RAISE EXCEPTION 'GOV_VALIDATION' USING ERRCODE='22023';END IF;
 INSERT INTO public.audit_events("Id","TenantId","BranchId","EntityType","EntityId","Action","ActorId","ActorEmail","AfterStateJson","CreatedAtUtc","Version") VALUES(gen_random_uuid(),t,b,'UserGovernance',result->>'id','Governance'||act,actor,actor_email,result,stamp,1);
 RETURN result;
END $fn$;
