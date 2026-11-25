-- Fábrica 3D: decimal, side-effect-free estimate only. Not a posted cost or approved quote.
-- Input prices are estimates; actual costs must come from scoped historical stock snapshots.
-- Machine rate excludes energy and labor; waste provision applies only to filament.
CREATE FUNCTION public.manufacturing_estimate_cost_v1(p_filaments jsonb, p_supplies jsonb, p_seconds integer, p_watts numeric, p_tariff numeric, p_machine_hour numeric, p_labor_seconds integer, p_labor_hour numeric, p_other numeric, p_waste_pct numeric, p_margin_pct numeric, p_fee_pct numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE f numeric; s numeric; e numeric; m numeric; l numeric; w numeric; c numeric; price numeric;
BEGIN
 IF p_filaments IS NULL OR p_supplies IS NULL OR jsonb_typeof(p_filaments)<>'array' OR jsonb_typeof(p_supplies)<>'array' THEN RAISE EXCEPTION 'Invalid material arrays' USING ERRCODE='22023'; END IF;
 IF jsonb_array_length(p_filaments)>100 OR jsonb_array_length(p_supplies)>100 THEN RAISE EXCEPTION 'Too many materials' USING ERRCODE='22023'; END IF;
 IF p_seconds IS NULL OR p_labor_seconds IS NULL OR p_seconds<0 OR p_labor_seconds<0 OR p_seconds>31536000 OR p_labor_seconds>31536000 OR
 EXISTS(SELECT 1 FROM unnest(ARRAY[p_watts,p_tariff,p_machine_hour,p_labor_hour,p_other,p_waste_pct,p_margin_pct,p_fee_pct]) v WHERE v IS NULL OR v::text IN ('NaN','Infinity','-Infinity') OR v<0 OR v>1000000)
 OR p_waste_pct>100 OR p_margin_pct+p_fee_pct>=100 THEN RAISE EXCEPTION 'Invalid pricing parameters' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_filaments) x WHERE jsonb_typeof(x->'grams') IS DISTINCT FROM 'number' OR jsonb_typeof(x->'costPerKg') IS DISTINCT FROM 'number')
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_supplies) x WHERE jsonb_typeof(x->'quantity') IS DISTINCT FROM 'number' OR jsonb_typeof(x->'unitCost') IS DISTINCT FROM 'number') THEN RAISE EXCEPTION 'Invalid material fields' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_filaments) x WHERE (x->>'grams')::numeric<=0 OR (x->>'grams')::numeric>1000000 OR (x->>'costPerKg')::numeric<0 OR (x->>'costPerKg')::numeric>1000000)
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_supplies) x WHERE (x->>'quantity')::numeric<=0 OR (x->>'quantity')::numeric>1000000 OR (x->>'unitCost')::numeric<0 OR (x->>'unitCost')::numeric>1000000) THEN RAISE EXCEPTION 'Invalid material quantities or costs' USING ERRCODE='22023'; END IF;
 SELECT coalesce(sum((x->>'grams')::numeric*(x->>'costPerKg')::numeric/1000),0) INTO f FROM jsonb_array_elements(p_filaments) x;
 SELECT coalesce(sum((x->>'quantity')::numeric*(x->>'unitCost')::numeric),0) INTO s FROM jsonb_array_elements(p_supplies) x;
 e:=p_watts*p_seconds*p_tariff/3600000; m:=p_machine_hour*p_seconds/3600; l:=p_labor_hour*p_labor_seconds/3600; w:=f*p_waste_pct/100;
 c:=f+s+e+m+l+w+p_other; price:=ceil(c*100/(1-(p_margin_pct+p_fee_pct)/100))/100;
 RETURN jsonb_build_object('filament',round(f,6),'supplies',round(s,6),'energy',round(e,6),'machine',round(m,6),'labor',round(l,6),'wasteProvision',round(w,6),'other',round(p_other,6),'totalCost',round(c,6),'suggestedPrice',price,'contribution',round(price*(1-p_fee_pct/100)-c,6));
END $function$;

-- Migration-time regression assertions (no business records created).
DO $$ DECLARE r jsonb; BEGIN
r:=public.manufacturing_estimate_cost_v1('[{"grams":20,"costPerKg":80},{"grams":15,"costPerKg":100}]','[{"quantity":1,"unitCost":0.2},{"quantity":1,"unitCost":1.2},{"quantity":1,"unitCost":0.3}]',3600,150,1,1.5,600,18,0,0,40,0);
IF (r->>'totalCost')::numeric<>9.45 OR (r->>'suggestedPrice')::numeric<>15.75 OR (r->>'filament')::numeric<>3.1 THEN RAISE EXCEPTION 'multicolor estimate mismatch'; END IF;
r:=public.manufacturing_estimate_cost_v1('[]','[{"quantity":100,"unitCost":0.2}]',0,0,0,0,0,0,0,0,0,0);
IF (r->>'supplies')::numeric<>20 THEN RAISE EXCEPTION 'supplies mismatch'; END IF;
r:=public.manufacturing_estimate_cost_v1('[{"grams":14.37,"costPerKg":80}]','[]',3391,150,1,0,0,0,0,0,0,0);
IF (r->>'filament')::numeric<>1.1496 OR (r->>'energy')::numeric<>0.141292 THEN RAISE EXCEPTION 'precision mismatch'; END IF;
BEGIN PERFORM public.manufacturing_estimate_cost_v1('[]','[]',0,0,0,0,0,0,0,0,80,20); RAISE EXCEPTION 'invalid margin accepted'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
BEGIN PERFORM public.manufacturing_estimate_cost_v1('[{"grams":-1,"costPerKg":80}]','[]',0,0,0,0,0,0,0,0,0,0); RAISE EXCEPTION 'negative grams accepted'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
BEGIN PERFORM public.manufacturing_estimate_cost_v1('[{"grams":1}]','[]',0,0,0,0,0,0,0,0,0,0); RAISE EXCEPTION 'missing price accepted'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
END $$;
