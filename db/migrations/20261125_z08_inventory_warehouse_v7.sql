BEGIN;
CREATE OR REPLACE FUNCTION public.inventory_create_warehouse_v7(t uuid, b uuid, u uuid, req uuid, p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE prior jsonb;wid uuid;code text;name text;kind integer;result jsonb;description text;
BEGIN
 PERFORM public.factory_assert_actor_v2(t,b,u);
 IF EXISTS(SELECT 1 FROM unnest(ARRAY['inventory.view','inventory.adjust']) k WHERE NOT EXISTS(SELECT 1 FROM public.user_roles ur JOIN public.role_permissions rp ON rp."TenantId"=ur."TenantId" AND rp."RoleId"=ur."RoleId" WHERE ur."TenantId"=t AND ur."UserId"=u AND rp."PermissionKey"=k)) THEN RAISE EXCEPTION 'Warehouse permission required' USING ERRCODE='42501';END IF;
 prior:=public.factory_begin_command_v2(t,b,u,req,'CreateWarehouseV7',p);IF prior IS NOT NULL THEN RETURN prior;END IF;
 code:=upper(public.factory_text_v2(p,'code',1,50));name:=public.factory_text_v2(p,'name',1,150);kind:=public.factory_number_v2(p,'type',1,5,true);description:=public.factory_text_v2(p,'description',0,500);
 IF code !~ '^[A-Z0-9][A-Z0-9._-]{0,49}$' THEN RAISE EXCEPTION 'Invalid warehouse code' USING ERRCODE='22023';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(t::text||b::text||'warehouse-v7',18));
 IF EXISTS(SELECT 1 FROM public.warehouses w WHERE w."TenantId"=t AND w."BranchId"=b AND (upper(w."Code")=code OR lower(btrim(w."Name"))=lower(name))) THEN RAISE EXCEPTION 'Warehouse already exists' USING ERRCODE='23505';END IF;
 wid:=gen_random_uuid();INSERT INTO public.warehouses("Id","TenantId","BranchId","Code","Name","Type","Description","IsActive","CreatedAtUtc") VALUES(wid,t,b,code,name,kind,nullif(description,''),true,now());
 result:=jsonb_build_object('id',wid,'code',code,'name',name,'type',kind);
 RETURN public.factory_end_command_v2(t,b,u,req,'CreateWarehouseV7',p,result,'Warehouse',wid);
END $function$;
COMMIT;
