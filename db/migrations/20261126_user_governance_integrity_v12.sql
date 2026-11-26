-- v12: migrate real existing titles into canonical positions and protect linked remuneration.
ALTER TABLE public.organization_positions_v11 ADD COLUMN IF NOT EXISTS code varchar(30), ADD COLUMN IF NOT EXISTS level varchar(20) NOT NULL DEFAULT 'OTHER', ADD COLUMN IF NOT EXISTS recommended_role_id uuid, ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true, ADD COLUMN IF NOT EXISTS updated_at timestamptz;

DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.organization_positions_v11'::regclass AND conname='ck_position_level_v12') THEN ALTER TABLE public.organization_positions_v11 ADD CONSTRAINT ck_position_level_v12 CHECK(level IN('EXECUTIVE','MANAGEMENT','OPERATIONAL','OTHER')); END IF;IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.organization_positions_v11'::regclass AND conname='fk_position_recommended_role_v12') THEN ALTER TABLE public.organization_positions_v11 ADD CONSTRAINT fk_position_recommended_role_v12 FOREIGN KEY(tenant_id,recommended_role_id) REFERENCES public.roles("TenantId","Id");END IF;END $$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_position_code_v12 ON public.organization_positions_v11(tenant_id,lower(code)) WHERE code IS NOT NULL;

INSERT INTO public.organization_positions_v11(tenant_id,name) SELECT DISTINCT ON (u."TenantId",lower(btrim(u."JobTitle"))) u."TenantId",btrim(u."JobTitle") FROM public.users u WHERE length(btrim(u."JobTitle"))>=2 ORDER BY u."TenantId",lower(btrim(u."JobTitle")),u."CreatedAtUtc",u."Id" ON CONFLICT(tenant_id,lower(name)) DO NOTHING;

INSERT INTO public.user_work_profiles_v11(tenant_id,user_id,position_id) SELECT u."TenantId",u."Id",p.id FROM public.users u JOIN public.organization_positions_v11 p ON p.tenant_id=u."TenantId" AND lower(p.name)=lower(btrim(u."JobTitle")) ON CONFLICT(tenant_id,user_id) DO UPDATE SET position_id=excluded.position_id WHERE user_work_profiles_v11.position_id IS NULL;

UPDATE public.users u SET "JobTitle"=p.name FROM public.user_work_profiles_v11 w JOIN public.organization_positions_v11 p ON p.tenant_id=w.tenant_id AND p.id=w.position_id WHERE u."TenantId"=w.tenant_id AND u."Id"=w.user_id AND u."JobTitle" IS DISTINCT FROM p.name;

DO $$ BEGIN IF EXISTS(SELECT 1 FROM public.users u LEFT JOIN public.user_work_profiles_v11 w ON w.tenant_id=u."TenantId" AND w.user_id=u."Id" WHERE w.position_id IS NULL) THEN RAISE EXCEPTION 'GOV_BACKFILL_INCOMPLETE';END IF;END $$;

ALTER TABLE public.user_work_profiles_v11 ALTER COLUMN position_id SET NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_legacy_user_position_v12() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$ DECLARE pid uuid; canonical text; BEGIN IF length(btrim(NEW."JobTitle"))<2 THEN RAISE EXCEPTION 'GOV_INVALID_POSITION' USING ERRCODE='22023';END IF; INSERT INTO public.organization_positions_v11(tenant_id,name) VALUES(NEW."TenantId",btrim(NEW."JobTitle")) ON CONFLICT(tenant_id,lower(name)) DO NOTHING; SELECT p.id,p.name INTO pid,canonical FROM public.organization_positions_v11 p WHERE p.tenant_id=NEW."TenantId" AND lower(p.name)=lower(btrim(NEW."JobTitle")) AND p.active; IF pid IS NULL THEN RAISE EXCEPTION 'GOV_INVALID_POSITION' USING ERRCODE='22023';END IF; INSERT INTO public.user_work_profiles_v11(tenant_id,user_id,position_id) VALUES(NEW."TenantId",NEW."Id",pid) ON CONFLICT(tenant_id,user_id) DO UPDATE SET position_id=excluded.position_id; IF NEW."JobTitle" IS DISTINCT FROM canonical THEN UPDATE public.users SET "JobTitle"=canonical WHERE "TenantId"=NEW."TenantId" AND "Id"=NEW."Id";END IF;RETURN NEW;END $$;

DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.users'::regclass AND tgname='tr_sync_legacy_user_position_v12') THEN CREATE TRIGGER tr_sync_legacy_user_position_v12 AFTER INSERT OR UPDATE OF "JobTitle" ON public.users FOR EACH ROW EXECUTE FUNCTION public.sync_legacy_user_position_v12();END IF;END $$;

CREATE OR REPLACE FUNCTION public.validate_work_position_v12() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$ BEGIN IF NOT EXISTS(SELECT 1 FROM public.users u JOIN public.organization_positions_v11 p ON p.tenant_id=NEW.tenant_id AND p.id=NEW.position_id WHERE u."TenantId"=NEW.tenant_id AND u."Id"=NEW.user_id AND u."JobTitle"=p.name AND p.active) THEN RAISE EXCEPTION 'GOV_POSITION_MISMATCH' USING ERRCODE='23514';END IF;RETURN NEW;END $$;

DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.user_work_profiles_v11'::regclass AND tgname='tr_validate_work_position_v12') THEN CREATE CONSTRAINT TRIGGER tr_validate_work_position_v12 AFTER INSERT OR UPDATE ON public.user_work_profiles_v11 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.validate_work_position_v12();END IF;END $$;

CREATE OR REPLACE FUNCTION public.user_governance_command_v11(t uuid,b uuid,actor uuid,act text,p jsonb) RETURNS jsonb LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
<<gov>>
DECLARE perms text[]; targetperms text[]; wanted text[]; ids uuid[]; uid uuid; rid uuid; pos uuid; center uuid; pid uuid; olduser public.users%ROWTYPE; oldrole public.roles%ROWTYPE; partner public.partners%ROWTYPE; name text; email text; title text; code text; description text; base bigint; cap bigint; monthly bigint; oldcenter uuid; stamp timestamptz:=clock_timestamp(); result jsonb; actor_email text; change_roles boolean; oldids uuid[]; isnew boolean; oldpos public.organization_positions_v11%ROWTYPE; suggested uuid; level_code text; position_code text; position_active boolean; previous_base bigint; previous_monthly bigint; previous_cap bigint; expected jsonb; profile_exists boolean;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(t::text||':user-governance-v11',0));
 PERFORM pg_advisory_xact_lock(hashtextextended('partner-investment-v10:'||t::text,0));
 SELECT u."Email" INTO actor_email FROM public.users u JOIN public.branches br ON br."TenantId"=t AND br."Id"=b AND br."IsActive" WHERE u."TenantId"=t AND u."Id"=actor AND u."IsActive" AND u."DefaultBranchId"=b AND EXISTS(SELECT 1 FROM public.partners x WHERE x."TenantId"=t AND lower(x."Email")=lower(u."Email") AND x."Status"=1 AND x."IsErpAccessEnabled");
 SELECT ARRAY(SELECT DISTINCT rp."PermissionKey"::text FROM public.user_roles ur JOIN public.role_permissions rp ON rp."TenantId"=ur."TenantId" AND rp."RoleId"=ur."RoleId" WHERE ur."TenantId"=t AND ur."UserId"=actor) INTO perms;
 IF actor_email IS NULL OR NOT ('access.manage'=ANY(perms)) THEN RAISE EXCEPTION 'GOV_FORBIDDEN' USING ERRCODE='42501'; END IF;
 name:=btrim(coalesce(p->>'name','')); description:=btrim(coalesce(p->>'description',''));
 IF act='POSITION' THEN
  IF length(name) NOT BETWEEN 2 AND 100 OR length(description)>500 THEN RAISE EXCEPTION 'GOV_VALIDATION' USING ERRCODE='22023';END IF;
  pos:=nullif(p->>'id','')::uuid;suggested:=nullif(p->>'recommendedRoleId','')::uuid;level_code:=coalesce(p->>'level','OTHER');position_code:=nullif(upper(btrim(coalesce(p->>'code',''))),'');position_active:=coalesce((p->>'active')::boolean,true);
  IF level_code NOT IN('EXECUTIVE','MANAGEMENT','OPERATIONAL','OTHER') OR length(position_code)>30 THEN RAISE EXCEPTION 'GOV_VALIDATION' USING ERRCODE='22023';END IF;
  IF suggested IS NOT NULL AND (NOT EXISTS(SELECT 1 FROM public.roles r WHERE r."TenantId"=t AND r."Id"=suggested) OR EXISTS(SELECT 1 FROM public.role_permissions rp WHERE rp."TenantId"=t AND rp."RoleId"=suggested AND NOT rp."PermissionKey"=ANY(perms))) THEN RAISE EXCEPTION 'GOV_PERMISSION_ESCALATION' USING ERRCODE='42501';END IF;
  IF pos IS NULL THEN
   pos:=gen_random_uuid();INSERT INTO public.organization_positions_v11(tenant_id,id,name,description,code,level,recommended_role_id,active) VALUES(t,pos,name,description,position_code,level_code,suggested,position_active);
  ELSE
   SELECT * INTO oldpos FROM public.organization_positions_v11 x WHERE x.tenant_id=t AND x.id=pos FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'GOV_NOT_FOUND' USING ERRCODE='22023';END IF;
   IF coalesce(oldpos.updated_at,oldpos.created_at) IS DISTINCT FROM (p->>'version')::timestamptz THEN RAISE EXCEPTION 'GOV_CONFLICT' USING ERRCODE='23514';END IF;
   IF NOT position_active AND EXISTS(SELECT 1 FROM public.user_work_profiles_v11 w WHERE w.tenant_id=t AND w.position_id=pos) THEN RAISE EXCEPTION 'GOV_POSITION_IN_USE' USING ERRCODE='23514';END IF;
   UPDATE public.organization_positions_v11 SET name=gov.name,description=gov.description,code=position_code,level=level_code,recommended_role_id=suggested,active=position_active,updated_at=stamp WHERE tenant_id=t AND id=pos;
   IF oldpos.name IS DISTINCT FROM name THEN
    UPDATE public.users u SET "JobTitle"=name,"UpdatedAtUtc"=stamp WHERE u."TenantId"=t AND EXISTS(SELECT 1 FROM public.user_work_profiles_v11 w WHERE w.tenant_id=t AND w.user_id=u."Id" AND w.position_id=pos);
   END IF;
  END IF;
  result:=jsonb_build_object('id',pos,'active',position_active,'recommendedRoleId',suggested);
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
   IF pos IS NULL THEN RAISE EXCEPTION 'GOV_INVALID_POSITION' USING ERRCODE='22023';END IF;
   SELECT x.name INTO title FROM public.organization_positions_v11 x WHERE x.tenant_id=t AND x.id=pos AND x.active;IF NOT FOUND THEN RAISE EXCEPTION 'GOV_INVALID_POSITION' USING ERRCODE='22023';END IF;
   IF title IS NULL OR (isnew AND pos IS NULL) THEN RAISE EXCEPTION 'GOV_INVALID_POSITION' USING ERRCODE='22023';END IF;
   SELECT ARRAY(SELECT DISTINCT x::uuid FROM jsonb_array_elements_text(p->'roleIds') x ORDER BY x::uuid) INTO ids;
   SELECT ARRAY(SELECT ur."RoleId" FROM public.user_roles ur WHERE ur."TenantId"=t AND ur."UserId"=uid ORDER BY ur."RoleId") INTO oldids;
   change_roles:=ids IS DISTINCT FROM oldids;
   IF (SELECT count(*) FROM public.roles r WHERE r."TenantId"=t AND r."Id"=ANY(ids))<>cardinality(ids) OR EXISTS(SELECT 1 FROM public.role_permissions rp WHERE rp."TenantId"=t AND rp."RoleId"=ANY(ids) AND NOT rp."PermissionKey"=ANY(perms)) THEN RAISE EXCEPTION 'GOV_PERMISSION_ESCALATION' USING ERRCODE='42501';END IF;
   IF uid=actor AND change_roles THEN RAISE EXCEPTION 'GOV_PROTECTED_USER' USING ERRCODE='42501';END IF;
   IF NOT isnew THEN
    SELECT l.partner_id INTO pid FROM public.partner_user_links_v10 l WHERE l.tenant_id=t AND l.user_id=uid;
    IF pid IS DISTINCT FROM nullif(p->>'partnerId','')::uuid THEN RAISE EXCEPTION 'GOV_PARTNER_CHANGED' USING ERRCODE='23514';END IF;
    IF lower(olduser."Email")<>email THEN RAISE EXCEPTION 'GOV_EMAIL_PROTECTED' USING ERRCODE='23514';END IF;
   END IF;
   IF pid IS NOT NULL THEN SELECT * INTO partner FROM public.partners x WHERE x."TenantId"=t AND x."Id"=pid FOR UPDATE;IF NOT FOUND OR lower(partner."Email")<>email THEN RAISE EXCEPTION 'GOV_INVALID_PARTNER' USING ERRCODE='22023';END IF;
    IF cardinality(ids)=0 AND (isnew OR partner."IsErpAccessEnabled" AND olduser."IsActive") THEN RAISE EXCEPTION 'GOV_REQUIRED_ROLE' USING ERRCODE='23514';END IF;
   END IF;
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
   IF p ?| ARRAY['baseCents','capCents','monthlyCents'] THEN
    IF NOT ('partners.compensation.manage'=ANY(perms)) THEN RAISE EXCEPTION 'GOV_FORBIDDEN' USING ERRCODE='42501';END IF;
    IF pid IS NOT NULL THEN
     SELECT f.base_cents,f.monthly_cents INTO previous_base,previous_monthly FROM public.partner_investment_profiles_v10 f WHERE f.tenant_id=t AND f.partner_id=pid;
     profile_exists:=FOUND;previous_cap:=partner."MonthlyCompensationCap"*100;expected:=p->'expectedComp';
     IF jsonb_typeof(expected) IS DISTINCT FROM 'object' OR (expected->>'baseCents')::bigint IS DISTINCT FROM previous_base OR (expected->>'capCents')::bigint IS DISTINCT FROM previous_cap OR (expected->>'monthlyCents')::bigint IS DISTINCT FROM previous_monthly THEN RAISE EXCEPTION 'GOV_COMP_CONFLICT' USING ERRCODE='23514';END IF;
     base:=CASE WHEN p ? 'baseCents' THEN (p->>'baseCents')::bigint ELSE coalesce(previous_base,0) END;
     cap:=CASE WHEN p ? 'capCents' THEN (p->>'capCents')::bigint ELSE previous_cap END;
     monthly:=CASE WHEN p ? 'monthlyCents' THEN (p->>'monthlyCents')::bigint ELSE coalesce(previous_monthly,0) END;
     IF base IS NULL OR cap IS NULL OR monthly IS NULL OR least(base,cap,monthly)<0 OR greatest(base,cap,monthly)>100000000000 OR base>cap THEN RAISE EXCEPTION 'GOV_VALIDATION' USING ERRCODE='22023';END IF;
     IF cap IS DISTINCT FROM previous_cap THEN UPDATE public.partners SET "MonthlyCompensationCap"=cap/100.0,"UpdatedAtUtc"=stamp WHERE "TenantId"=t AND "Id"=pid;END IF;
     IF p ?| ARRAY['baseCents','monthlyCents'] THEN INSERT INTO public.partner_investment_profiles_v10 VALUES(t,pid,base,monthly) ON CONFLICT(tenant_id,partner_id) DO UPDATE SET base_cents=excluded.base_cents,monthly_cents=excluded.monthly_cents;END IF;
    ELSE
     IF p ?| ARRAY['capCents','monthlyCents'] OR NOT (p ? 'baseCents') THEN RAISE EXCEPTION 'GOV_VALIDATION' USING ERRCODE='22023';END IF;
     base:=(p->>'baseCents')::bigint;IF base IS NULL OR base NOT BETWEEN 0 AND 100000000000 THEN RAISE EXCEPTION 'GOV_VALIDATION' USING ERRCODE='22023';END IF;
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
