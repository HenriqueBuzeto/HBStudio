BEGIN;
CREATE OR REPLACE FUNCTION public.cash_enterprise_open_shift(p_tenant uuid, p_branch uuid, p_actor uuid, p_email text, p_register uuid, p_float numeric, p_request uuid, p_correlation text)
 RETURNS TABLE("shiftId" uuid, "openingFloat" numeric)
 LANGUAGE plpgsql
AS $function$
DECLARE
 v_fingerprint text;
 v_old record;
 v_shift uuid := gen_random_uuid();
BEGIN
 IF p_tenant IS NULL OR p_branch IS NULL OR p_actor IS NULL
    OR p_request IS NULL OR p_register IS NULL
    OR p_float IS NULL OR p_float<0 OR p_float>1000000
    OR scale(p_float)>2 THEN
   RAISE EXCEPTION 'CASH_INVALID_REQUEST' USING ERRCODE='23514';
 END IF;
 -- Idempotent retry across network failures. Lock the request and register.
 PERFORM pg_advisory_xact_lock(hashtextextended('cash.open:'||p_tenant::text||':'||p_request::text,0));
 v_fingerprint:=md5(jsonb_build_object('branch',p_branch,'actor',p_actor,'register',p_register,'float',p_float)::text);
 SELECT "CashShiftId","PayloadFingerprint" INTO v_old
 FROM cash_open_requests WHERE "TenantId"=p_tenant AND "RequestKey"=p_request;
 IF FOUND THEN
   IF v_old."PayloadFingerprint"<>v_fingerprint THEN
     RAISE EXCEPTION 'CASH_IDEMPOTENCY_CONFLICT' USING ERRCODE='23514';
   END IF;
   RETURN QUERY SELECT v_old."CashShiftId",p_float;
   RETURN;
 END IF;
 -- Prevent different request keys opening the same register in parallel.
 PERFORM pg_advisory_xact_lock(hashtextextended('cash.register:'||p_tenant::text||':'||p_register::text,0));
 IF NOT EXISTS (
   SELECT 1 FROM cash_registers r
   WHERE r."Id"=p_register AND r."TenantId"=p_tenant AND r."BranchId"=p_branch AND r."Status"=1
 ) THEN RAISE EXCEPTION 'CASH_REGISTER_NOT_FOUND' USING ERRCODE='23514'; END IF;
 IF NOT EXISTS (SELECT 1 FROM users u WHERE u."Id"=p_actor AND u."TenantId"=p_tenant AND u."IsActive"=true) THEN
   RAISE EXCEPTION 'CASH_OPERATOR_NOT_FOUND' USING ERRCODE='23514';
 END IF;
 IF EXISTS (
   SELECT 1 FROM cash_shifts s WHERE s."TenantId"=p_tenant
     AND s."BranchId"=p_branch AND s."CashRegisterId"=p_register AND s."Status" IN (1,2,3,4)
 ) THEN RAISE EXCEPTION 'CASH_REGISTER_ALREADY_OPEN' USING ERRCODE='23505'; END IF;
 INSERT INTO cash_shifts (
   "Id","TenantId","BranchId","CashRegisterId","OperatorUserId","OpenedByUserId",
   "OpenedAtUtc","OpeningFloat","OpeningSource","OpeningNotes","Status",
   "CurrentBalance","TotalCashIn","TotalCashOut","CreatedAtUtc"
 ) VALUES (
   v_shift,p_tenant,p_branch,p_register,p_actor,p_actor,
   now(),p_float,'OpeningFloat','Abertura registrada pelo ERP',1,
   p_float,p_float,0,now()
 );
 IF p_float>0 THEN
   INSERT INTO cash_movements (
     "Id","TenantId","BranchId","CashRegisterId","CashShiftId","MovementType",
     "Direction","Amount","SourceType","SourceId","DocumentReference","Reason",
     "CreatedByUserId","CorrelationId","IdempotencyKey","CreatedAtUtc"
   ) VALUES (
     gen_random_uuid(),p_tenant,p_branch,p_register,v_shift,1,1,p_float,
     'OPENING',v_shift::text,'OPEN-'||v_shift::text,'Fundo inicial',
     p_actor,p_correlation,'opening:'||p_request::text,now()
   );
 END IF;
 INSERT INTO audit_events (
   "Id","TenantId","BranchId","EntityType","EntityId","Action","ActorId",
   "ActorEmail","CorrelationId","AfterStateJson","CreatedAtUtc","Version"
 ) VALUES(
   gen_random_uuid(),p_tenant,p_branch,'CashShift',v_shift::text,'CashShiftOpened',
   p_actor,coalesce(p_email,''),p_correlation,
   jsonb_build_object('registerId',p_register,'openingFloat',p_float),now(),1
 );
 INSERT INTO cash_open_requests("TenantId","RequestKey","PayloadFingerprint","CashShiftId")
 VALUES (p_tenant,p_request,v_fingerprint,v_shift);
 RETURN QUERY SELECT v_shift,p_float;
END $function$;

CREATE OR REPLACE FUNCTION public.cash_register_create_v8(t uuid, b uuid, u uuid, req uuid, p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE v_id uuid;v_code text;v_name text;v_notes text;v_email text;v_prior jsonb;v_payload jsonb;v_result jsonb;
BEGIN
 SELECT x."Email" INTO v_email FROM public.users x JOIN public.branches y ON y."Id"=b AND y."TenantId"=t AND y."IsActive" JOIN public.tenants z ON z."Id"=t AND z."IsActive" WHERE x."Id"=u AND x."TenantId"=t AND x."DefaultBranchId"=b AND x."IsActive";
 IF NOT FOUND THEN RAISE EXCEPTION 'CASH_REGISTER_FORBIDDEN' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM unnest(ARRAY['cash.shift.view','cash.register.manage']) AS k(key) WHERE NOT EXISTS(SELECT 1 FROM public.user_roles ur JOIN public.role_permissions rp ON rp."TenantId"=ur."TenantId" AND rp."RoleId"=ur."RoleId" WHERE ur."TenantId"=t AND ur."UserId"=u AND rp."PermissionKey"=k.key)) THEN RAISE EXCEPTION 'CASH_REGISTER_FORBIDDEN' USING ERRCODE='42501'; END IF;
 IF req IS NULL OR jsonb_typeof(p) IS DISTINCT FROM 'object' OR jsonb_typeof(p->'code') IS DISTINCT FROM 'string' OR jsonb_typeof(p->'name') IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'CASH_REGISTER_INVALID' USING ERRCODE='22023'; END IF;
 v_code:=upper(btrim(p->>'code'));v_name:=btrim(p->>'name');v_notes:=coalesce(btrim(p->>'notes'),'');
 IF v_code !~ '^[A-Z0-9][A-Z0-9._-]{0,49}$' OR length(v_name) NOT BETWEEN 1 AND 150 OR length(v_notes)>500 THEN RAISE EXCEPTION 'CASH_REGISTER_INVALID' USING ERRCODE='22023'; END IF;
 v_payload:=jsonb_build_object('code',v_code,'name',v_name,'notes',v_notes);
 PERFORM pg_advisory_xact_lock(hashtextextended('cash.register.create:'||t::text||':'||req::text,0));
 SELECT a."AfterStateJson" INTO v_prior FROM public.audit_events a WHERE a."TenantId"=t AND a."EntityType"='CashRegister' AND a."Action"='CashRegisterCreated' AND a."CorrelationId"='register-create:'||req::text;
 IF FOUND THEN
  IF v_prior->'payload' IS DISTINCT FROM v_payload OR v_prior->>'actorId' IS DISTINCT FROM u::text OR v_prior->>'branchId' IS DISTINCT FROM b::text THEN RAISE EXCEPTION 'CASH_IDEMPOTENCY_CONFLICT' USING ERRCODE='23514'; END IF;
  RETURN v_prior->'result';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('cash.register.code:'||t::text||':'||b::text||':'||v_code,0));
 IF EXISTS(SELECT 1 FROM public.cash_registers r WHERE r."TenantId"=t AND r."BranchId"=b AND upper(r."Code")=v_code) THEN RAISE EXCEPTION 'CASH_REGISTER_CODE_EXISTS' USING ERRCODE='23505'; END IF;
 v_id:=gen_random_uuid();
 INSERT INTO public.cash_registers("Id","TenantId","BranchId","Code","Name","Status","Notes","CreatedAtUtc") VALUES(v_id,t,b,v_code,v_name,1,nullif(v_notes,''),now());
 v_result:=jsonb_build_object('id',v_id,'code',v_code,'name',v_name,'status',1);
 INSERT INTO public.audit_events("Id","TenantId","BranchId","EntityType","EntityId","Action","ActorId","ActorEmail","CorrelationId","AfterStateJson","CreatedAtUtc","Version") VALUES(gen_random_uuid(),t,b,'CashRegister',v_id::text,'CashRegisterCreated',u,v_email,'register-create:'||req::text,jsonb_build_object('payload',v_payload,'result',v_result,'actorId',u,'branchId',b),now(),1);
 RETURN v_result;
END $function$;
COMMIT;
