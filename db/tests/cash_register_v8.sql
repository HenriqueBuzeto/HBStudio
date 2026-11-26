BEGIN;
CREATE SCHEMA IF NOT EXISTS factory_qa;
CREATE OR REPLACE FUNCTION factory_qa.run_cash_register_v8()
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE t uuid:='a0000000-0000-0000-0000-000000000001';b uuid:='b0000000-0000-0000-0000-000000000001';u uuid:='d0000000-0000-0000-0000-000000000001';req uuid:=gen_random_uuid();p jsonb;r jsonb;reg uuid;sh uuid;replay uuid;openreq uuid:=gen_random_uuid();res jsonb;
BEGIN
 BEGIN
 p:=jsonb_build_object('code','QA-REG-'||left(req::text,8),'name','QA caixa novo','notes','teste isolado');
 r:=public.cash_register_create_v8(t,b,u,req,p);reg:=(r->>'id')::uuid;
 IF r<>public.cash_register_create_v8(t,b,u,req,p) OR EXISTS(SELECT 1 FROM cash_shifts WHERE "CashRegisterId"=reg) THEN RAISE EXCEPTION 'register replay or phantom shift';END IF;
 BEGIN PERFORM public.cash_register_create_v8(t,b,u,gen_random_uuid(),p);RAISE EXCEPTION 'duplicate accepted';EXCEPTION WHEN unique_violation THEN NULL;END;
 BEGIN PERFORM public.cash_register_create_v8(t,b,u,req,p||jsonb_build_object('name','alterado'));RAISE EXCEPTION 'changed replay accepted';EXCEPTION WHEN check_violation THEN NULL;END;
 BEGIN PERFORM public.cash_register_create_v8(t,gen_random_uuid(),u,gen_random_uuid(),p);RAISE EXCEPTION 'cross branch accepted';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 SELECT "shiftId" INTO sh FROM public.cash_enterprise_open_shift(t,b,u,'qa@example.invalid',reg,50,openreq,'qa-v8');
 SELECT "shiftId" INTO replay FROM public.cash_enterprise_open_shift(t,b,u,'qa@example.invalid',reg,50,openreq,'qa-v8');
 IF sh IS DISTINCT FROM replay THEN RAISE EXCEPTION 'open replay';END IF;
 BEGIN PERFORM public.cash_enterprise_open_shift(t,b,u,'qa@example.invalid',reg,50,gen_random_uuid(),'qa-v8');RAISE EXCEPTION 'duplicate shift accepted';EXCEPTION WHEN unique_violation THEN NULL;END;
 PERFORM public.cash_enterprise_move(t,b,u,'qa@example.invalid',sh,'SUPPLY',20,'Teste suprimento',gen_random_uuid(),'qa-v8',50);
 PERFORM public.cash_enterprise_move(t,b,u,'qa@example.invalid',sh,'WITHDRAWAL',10,'Teste sangria',gen_random_uuid(),'qa-v8',70);
 IF (SELECT "CurrentBalance" FROM cash_shifts WHERE "Id"=sh)<>60 OR (SELECT count(*) FROM cash_movements WHERE "CashShiftId"=sh)<>3 THEN RAISE EXCEPTION 'ledger mismatch';END IF;
 BEGIN PERFORM public.cash_enterprise_close_shift(t,b,u,'qa@example.invalid',sh,59,60,'QA diferença',gen_random_uuid(),'qa-v8');RAISE EXCEPTION 'discrepant close accepted';EXCEPTION WHEN check_violation THEN NULL;END;
 PERFORM public.cash_enterprise_close_shift(t,b,u,'qa@example.invalid',sh,60,60,'QA conferido',gen_random_uuid(),'qa-v8');
 IF (SELECT "Status" FROM cash_shifts WHERE "Id"=sh)<>5 THEN RAISE EXCEPTION 'close failed';END IF;
 res:=jsonb_build_object('passed',true,'opening',50,'supply',20,'withdrawal',10,'closing',60,'duplicateProtected',true,'scopeProtected',true,'rolledBack',true);
 RAISE EXCEPTION 'rollback' USING ERRCODE='ZX001';
 EXCEPTION WHEN SQLSTATE 'ZX001' THEN NULL;END;
 RETURN res;
END $function$;
SELECT factory_qa.run_cash_register_v8() result;
ROLLBACK;
