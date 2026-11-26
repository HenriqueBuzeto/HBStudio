-- Isolated QA, rollback only.
DO $qa$
DECLARE t uuid;b uuid;u uuid;id uuid:=gen_random_uuid();k text;other uuid:=gen_random_uuid();n integer;initial_count bigint;
BEGIN
 IF current_setting('neon.branch_id',true) IS DISTINCT FROM 'br-empty-dew-b63jpig9' THEN RAISE EXCEPTION 'QA_ONLY';END IF;
 SELECT x."TenantId",x."DefaultBranchId",x."Id" INTO t,b,u FROM users x JOIN tenants te ON te."Id"=x."TenantId" WHERE te."Name"='HB Studio Tecnologia' AND x."IsActive" AND EXISTS(SELECT 1 FROM user_roles ur JOIN role_permissions rp ON rp."TenantId"=ur."TenantId" AND rp."RoleId"=ur."RoleId" WHERE ur."TenantId"=x."TenantId" AND ur."UserId"=x."Id" AND rp."PermissionKey"='finance.payables.view') LIMIT 1;
 IF u IS NULL THEN RAISE EXCEPTION 'QA_FIXTURE_MISSING';END IF;
 SELECT count(*) INTO initial_count FROM erp_notification_reads_v18;
 BEGIN
 INSERT INTO accounts_payable("Id","TenantId","BranchId","TitleNumber","Description","IssueDateUtc","DueDateUtc","OriginalAmount","PaidAmount","Status","CreatedAtUtc") VALUES(id,t,b,'QA-NOTIFY-'||left(id::text,8),'QA rollback',now(),now()-interval '2 days',100,0,2,now());
 SELECT notification_key INTO k FROM erp_notifications_v18(t,b,u) WHERE notification_key LIKE 'payable:'||id::text||':%' AND severity='urgent' AND read_at IS NULL;
 IF k IS NULL THEN RAISE EXCEPTION 'QA_ALERT_MISSING';END IF;
 IF EXISTS(SELECT 1 FROM erp_notifications_v18(t,b,other)) OR EXISTS(SELECT 1 FROM erp_notifications_v18(t,other,u)) OR EXISTS(SELECT 1 FROM erp_notifications_v18(other,b,u)) THEN RAISE EXCEPTION 'QA_SCOPE_LEAK';END IF;
 IF erp_notifications_read_v18(t,b,other,ARRAY[k],false)<>0 OR erp_notifications_read_v18(t,b,u,ARRAY['invalid-key'],false)<>0 THEN RAISE EXCEPTION 'QA_UNAUTHORIZED_READ';END IF;
 IF erp_notifications_read_v18(t,b,u,ARRAY[k],false)<>1 OR erp_notifications_read_v18(t,b,u,ARRAY[k],false)<>0 THEN RAISE EXCEPTION 'QA_IDEMPOTENCY';END IF;
 IF NOT EXISTS(SELECT 1 FROM erp_notifications_v18(t,b,u) WHERE notification_key=k AND read_at IS NOT NULL) THEN RAISE EXCEPTION 'QA_READ_NOT_PERSISTED';END IF;
 UPDATE accounts_payable SET "DueDateUtc"=now()+interval '2 days' WHERE "Id"=id;
 IF NOT EXISTS(SELECT 1 FROM erp_notifications_v18(t,b,u) WHERE notification_key LIKE 'payable:'||id::text||':%' AND notification_key<>k AND severity='warning' AND read_at IS NULL) THEN RAISE EXCEPTION 'QA_CHANGED_DEADLINE';END IF;
 PERFORM erp_notifications_read_v18(t,b,u,NULL,true);
 IF EXISTS(SELECT 1 FROM erp_notifications_v18(t,b,u) WHERE read_at IS NULL) THEN RAISE EXCEPTION 'QA_ALL';END IF;
 UPDATE accounts_payable SET "PaidAmount"=100,"Status"=4 WHERE "Id"=id;
 IF EXISTS(SELECT 1 FROM erp_notifications_v18(t,b,u) WHERE notification_key LIKE 'payable:'||id::text||':%') THEN RAISE EXCEPTION 'QA_RESOLVED';END IF;
 RAISE EXCEPTION 'QA_ROLLBACK' USING ERRCODE='P0011';
 EXCEPTION WHEN SQLSTATE 'P0011' THEN NULL;END;
 IF EXISTS(SELECT 1 FROM accounts_payable WHERE "Id"=id) OR (SELECT count(*) FROM erp_notification_reads_v18)<>initial_count THEN RAISE EXCEPTION 'QA_ROLLBACK_FAILED';END IF;
END $qa$;
