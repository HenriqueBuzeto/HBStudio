BEGIN;
CREATE SCHEMA IF NOT EXISTS factory_qa;
CREATE OR REPLACE FUNCTION factory_qa.run_warehouse_v7()
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE t uuid:='a0000000-0000-0000-0000-000000000001';b uuid:='b0000000-0000-0000-0000-000000000001';u uuid:='d0000000-0000-0000-0000-000000000001';req uuid:=gen_random_uuid();p jsonb;r jsonb;result jsonb;
BEGIN
 BEGIN
 p:=jsonb_build_object('code','QA-DEP-'||left(req::text,8),'name','QA depósito sem saldo '||left(req::text,8),'type',1,'description','QA');
 r:=public.inventory_create_warehouse_v7(t,b,u,req,p);
 IF r<>public.inventory_create_warehouse_v7(t,b,u,req,p) OR EXISTS(SELECT 1 FROM stock_balances WHERE "WarehouseId"=(r->>'id')::uuid) THEN RAISE EXCEPTION 'Warehouse creation/replay failed';END IF;
 BEGIN PERFORM public.inventory_create_warehouse_v7(t,b,u,gen_random_uuid(),p);RAISE EXCEPTION 'Duplicate warehouse accepted';EXCEPTION WHEN unique_violation THEN NULL;END;
 result:=jsonb_build_object('passed',true,'emptyWarehouse',true,'idempotent',true);
 RAISE EXCEPTION 'rollback' USING ERRCODE='ZX001';
 EXCEPTION WHEN SQLSTATE 'ZX001' THEN NULL;END;
 RETURN result;
END $function$;
SELECT factory_qa.run_warehouse_v7() result;
ROLLBACK;
