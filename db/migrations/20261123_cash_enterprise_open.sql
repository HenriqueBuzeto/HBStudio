-- Enterprise Cash Core — additive, reversible migration.
-- APPLY FIRST ON NEON QA. Does not change sales, financial journal or stock.
CREATE TABLE IF NOT EXISTS cash_open_requests (
 "TenantId" uuid NOT NULL REFERENCES tenants("Id") ON DELETE RESTRICT,
 "RequestKey" uuid NOT NULL,
 "PayloadFingerprint" text NOT NULL,
 "CashShiftId" uuid NOT NULL REFERENCES cash_shifts("Id") ON DELETE RESTRICT,
 "CreatedAtUtc" timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY ("TenantId","RequestKey")
);

-- Guard against concurrent opens per physical register. Existing data checked before applying.
CREATE UNIQUE INDEX IF NOT EXISTS "UX_cash_shifts_open_register"
 ON cash_shifts ("TenantId","BranchId","CashRegisterId") WHERE "Status"=1;

CREATE OR REPLACE FUNCTION cash_enterprise_open_shift(
 p_tenant uuid,p_branch uuid,p_actor uuid,p_email text,p_register uuid,
 p_float numeric,p_request uuid,p_correlation text
) RETURNS TABLE ("shiftId" uuid,"openingFloat" numeric)
LANGUAGE plpgsql AS $cash$
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
     AND s."BranchId"=p_branch AND s."CashRegisterId"=p_register AND s."Status"=1
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
     'CashShift',v_shift::text,'OPEN-'||v_shift::text,'Fundo inicial',
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
END $cash$;

REVOKE ALL ON FUNCTION cash_enterprise_open_shift(uuid,uuid,uuid,text,uuid,numeric,uuid,text) FROM PUBLIC;
