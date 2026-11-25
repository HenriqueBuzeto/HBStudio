-- Dedicated QA only; do not run on production. Existing marker required.
BEGIN;
CREATE OR REPLACE FUNCTION factory_qa.seed_library_v3()
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE t uuid:='a0000000-0000-0000-0000-000000000001';b uuid:='b0000000-0000-0000-0000-000000000001';u uuid:='d0000000-0000-0000-0000-000000000001';a record;vid uuid;wb uuid;bb uuid;supplies uuid[];i integer:=0;secs integer;g1 numeric;g2 numeric;body bytea;metadata jsonb;p jsonb;r jsonb;done integer:=0;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM factory_qa.environment_guard WHERE name='qa-factory-operational-v2-20261125') THEN RAISE EXCEPTION 'QA marker required';END IF;
 IF NOT EXISTS(SELECT 1 FROM factory_qa.seed_runs WHERE name='factory-demo-v2') THEN RAISE EXCEPTION 'Prior QA seed required';END IF;
 IF EXISTS(SELECT 1 FROM factory_qa.seed_runs WHERE name='factory-library-v3') THEN RETURN jsonb_build_object('alreadySeeded',true);END IF;
 SELECT balance_id INTO wb FROM manufacturing_material_balance_configs WHERE tenant_id=t AND branch_id=b AND kind='FILAMENT' AND color='BRANCO';
 SELECT balance_id INTO bb FROM manufacturing_material_balance_configs WHERE tenant_id=t AND branch_id=b AND kind='FILAMENT' AND color='PRETO';
 SELECT array_agg(balance_id ORDER BY material_type) INTO supplies FROM manufacturing_material_balance_configs WHERE tenant_id=t AND branch_id=b AND kind='SUPPLY';
 IF wb IS NULL OR bb IS NULL OR cardinality(supplies)<5 THEN RAISE EXCEPTION 'QA inventory seed missing';END IF;
 FOR a IN SELECT "Id","Code" FROM manufacturing_design_assets WHERE "TenantId"=t AND "BranchId"=b AND "Code" LIKE 'QA-DESIGN-%' ORDER BY "Code" LOOP
  i:=i+1;secs:=3391+i*60;g1:=14.37+i;g2:=10+i;
  body:=convert_to('; QA metadata only - not a printable toolpath'||chr(10)||'; total estimated time: '||secs||chr(10)||'; filament used [g] = '||g1||','||g2||chr(10)||'; filament_colour = #FFFFFF;#000000'||chr(10)||'; filament_type = PLA;PLA'||chr(10)||'; total filament used [g] = '||(g1+g2)||chr(10),'UTF8');
  metadata:=jsonb_build_object('source','GCODE','plates',jsonb_build_array(jsonb_build_object('index',1,'seconds',secs,'preparationSeconds',null,'totalGrams',g1+g2,'filaments',jsonb_build_array(jsonb_build_object('slot',1,'grams',g1,'color','#FFFFFF','material','PLA'),jsonb_build_object('slot',2,'grams',g2,'color','#000000','material','PLA')),'warnings','[]'::jsonb)),'warnings',jsonb_build_array('Arquivo fictício de homologação; somente metadados, não contém percurso de impressão.'));
  p:=jsonb_build_object('assetId',a."Id",'filename',lower(a."Code")||'-metadata.gcode','format','GCODE','revision','QA-V1','sha256',encode(sha256(body),'hex'),'metadata',metadata,'seconds',secs,'grams',g1+g2,'notes','Arquivo fictício de homologação, não imprimir.');
  r:=public.factory_create_version_v3(t,b,u,gen_random_uuid(),p,body);vid:=(r->>'id')::uuid;
  PERFORM public.factory_create_recipe_v3(t,b,u,gen_random_uuid(),jsonb_build_object('versionId',vid,'batchQuantity',1,'seconds',secs,'laborSeconds',600,'notes','Ficha fictícia QA; sem uso comercial.','lines',jsonb_build_array(jsonb_build_object('balanceId',wb,'quantity',g1),jsonb_build_object('balanceId',bb,'quantity',g2),jsonb_build_object('balanceId',supplies[i],'quantity',1))));
  done:=done+1;
 END LOOP;
 IF done<>5 THEN RAISE EXCEPTION 'Expected five QA assets';END IF;
 INSERT INTO factory_qa.seed_runs(name,details) VALUES('factory-library-v3',jsonb_build_object('versions',done,'recipes',done,'commercial',false));
 RETURN jsonb_build_object('versions',done,'recipes',done,'commercial',false);
END $function$;
SELECT factory_qa.seed_library_v3() AS result;
COMMIT;
