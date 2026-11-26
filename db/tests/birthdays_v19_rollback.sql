-- QA isolated, no external message.
DO $qa$
DECLARE t uuid;b uuid;u uuid;p uuid:=gen_random_uuid();other uuid:=gen_random_uuid();v text;d date:=(now() AT TIME ZONE 'America/Sao_Paulo')::date;y integer:=extract(year from (now() AT TIME ZONE 'America/Sao_Paulo'))::int;born date;out jsonb;
BEGIN
 IF current_setting('neon.branch_id',true) IS DISTINCT FROM 'br-empty-dew-b63jpig9' THEN RAISE EXCEPTION 'QA_ONLY';END IF;
 SELECT x."TenantId",x."DefaultBranchId",x."Id" INTO t,b,u FROM users x JOIN tenants te ON te."Id"=x."TenantId" WHERE te."Name"='HB Studio Tecnologia' AND x."IsActive" AND EXISTS(SELECT 1 FROM user_roles ur JOIN role_permissions rp ON rp."TenantId"=ur."TenantId" AND rp."RoleId"=ur."RoleId" WHERE ur."TenantId"=x."TenantId" AND ur."UserId"=x."Id" AND rp."PermissionKey"='crm.campaign.send') LIMIT 1;
 IF u IS NULL THEN RAISE EXCEPTION 'QA_MISSING';END IF;
 IF birthday_occurrence_v19(date '2000-02-29',2027)<>date '2027-02-28' OR birthday_occurrence_v19(date '2000-02-29',2028)<>date '2028-02-29' THEN RAISE EXCEPTION 'QA_LEAP';END IF;
 BEGIN
 INSERT INTO parties("Id","TenantId","Type","Name","IsActive","CreatedAtUtc") VALUES(p,t,1,'QA birthday rollback',true,now());
 INSERT INTO customer_profiles("Id","TenantId","PartyId","TotalSalesValue","CompletedRepairsCount","CreatedAtUtc") VALUES(gen_random_uuid(),t,p,0,0,now());
 IF EXISTS(SELECT 1 FROM birthday_calendar_v19(t,d) WHERE party_id=p) THEN RAISE EXCEPTION 'QA_NULL';END IF;
 SELECT xmin::text INTO v FROM parties WHERE "Id"=p;
 born:=make_date(2000,extract(month from d)::int,extract(day from d)::int);
 PERFORM birthday_command_v19(t,b,u,p,'DATE',jsonb_build_object('version',v,'birthDate',born::text));
 IF NOT EXISTS(SELECT 1 FROM birthday_calendar_v19(t,d) WHERE party_id=p AND days_left=0) OR NOT EXISTS(SELECT 1 FROM erp_notifications_v18(t,b,u) WHERE notification_key='birthday:'||p||':'||y) THEN RAISE EXCEPTION 'QA_CALENDAR';END IF;
 IF EXISTS(SELECT 1 FROM birthday_calendar_v19(other,d) WHERE party_id=p) OR EXISTS(SELECT 1 FROM erp_notifications_v18(other,b,u) WHERE notification_key LIKE 'birthday:'||p||':%') THEN RAISE EXCEPTION 'QA_SCOPE';END IF;
 BEGIN PERFORM birthday_command_v19(t,b,u,p,'DATE',jsonb_build_object('version',v,'birthDate',(d+1)::text));RAISE EXCEPTION 'QA_FUTURE_NOT_BLOCKED';EXCEPTION WHEN invalid_parameter_value THEN NULL;END;
 INSERT INTO party_contacts("Id","TenantId","PartyId","Name","WhatsApp","IsPrimary","CreatedAtUtc") VALUES(gen_random_uuid(),t,p,'QA','11999999999',true,now());
 BEGIN PERFORM birthday_command_v19(t,b,u,p,'PREPARE','{}');RAISE EXCEPTION 'QA_CONSENT_NOT_BLOCKED';EXCEPTION WHEN check_violation THEN IF SQLERRM NOT LIKE '%BIRTHDAY_NO_CONSENT_OR_PHONE%' THEN RAISE;END IF;END;
 SELECT xmin::text INTO v FROM parties WHERE "Id"=p;
 PERFORM birthday_command_v19(t,b,u,p,'CONSENT',jsonb_build_object('version',v,'optIn',true,'evidence','QA rollback consent'));
 out:=birthday_command_v19(t,b,u,p,'PREPARE','{}');
 IF out->>'status'<>'PREPARED' OR out->>'phone'<>'5511999999999' THEN RAISE EXCEPTION 'QA_PREPARE';END IF;
 PERFORM birthday_command_v19(t,b,u,p,'RELEASE','{"notSent":true}');
 PERFORM birthday_command_v19(t,b,u,p,'PREPARE','{}');
 PERFORM birthday_command_v19(t,b,u,p,'CONFIRM','{"confirmed":true}');
 IF EXISTS(SELECT 1 FROM erp_notifications_v18(t,b,u) WHERE notification_key='birthday:'||p||':'||y) THEN RAISE EXCEPTION 'QA_CONFIRMED_ALERT';END IF;
 BEGIN PERFORM birthday_command_v19(t,b,u,p,'PREPARE','{}');RAISE EXCEPTION 'QA_DUPLICATE';EXCEPTION WHEN check_violation THEN IF SQLERRM NOT LIKE '%BIRTHDAY_ALREADY_HANDLED%' THEN RAISE;END IF;END;
 SELECT xmin::text INTO v FROM parties WHERE "Id"=p;
 PERFORM birthday_command_v19(t,b,u,p,'CONSENT',jsonb_build_object('version',v,'optIn',false,'evidence','QA rollback revoke'));
 IF (SELECT consented FROM birthday_contact_eligibility_v19(t,p)) THEN RAISE EXCEPTION 'QA_REVOKE';END IF;
 SELECT xmin::text INTO v FROM parties WHERE "Id"=p;
 PERFORM birthday_command_v19(t,b,u,p,'DATE',jsonb_build_object('version',v,'birthDate',null));
 IF EXISTS(SELECT 1 FROM birthday_calendar_v19(t,d) WHERE party_id=p) THEN RAISE EXCEPTION 'QA_CLEAR';END IF;
 RAISE EXCEPTION 'QA_ROLLBACK' USING ERRCODE='P0011';EXCEPTION WHEN SQLSTATE 'P0011' THEN NULL;END;
 IF EXISTS(SELECT 1 FROM parties WHERE "Id"=p) OR EXISTS(SELECT 1 FROM crm_birthday_contacts_v19 WHERE party_id=p) THEN RAISE EXCEPTION 'QA_ROLLBACK_FAILED';END IF;
END $qa$;
