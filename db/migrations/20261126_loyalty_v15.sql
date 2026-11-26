-- V15: loyalty integration, deferred commercial events and audited commands.
ALTER TABLE public.loyalty_ledger ADD COLUMN IF NOT EXISTS "EarnBaseCents" bigint, ADD COLUMN IF NOT EXISTS "EarnEveryCents" integer, ADD COLUMN IF NOT EXISTS "PointsPerStep" integer;

ALTER TABLE public.loyalty_settings ADD COLUMN IF NOT EXISTS "Version" integer NOT NULL DEFAULT 1, ADD COLUMN IF NOT EXISTS "SilverThreshold" bigint, ADD COLUMN IF NOT EXISTS "GoldThreshold" bigint, ADD COLUMN IF NOT EXISTS "DiamondThreshold" bigint;

CREATE TABLE IF NOT EXISTS public.loyalty_commands_v15(tenant_id uuid NOT NULL,branch_id uuid NOT NULL,request_id uuid NOT NULL,actor_id uuid NOT NULL,action text NOT NULL,payload jsonb NOT NULL,result jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(tenant_id,request_id),FOREIGN KEY(tenant_id,branch_id) REFERENCES public.branches("TenantId","Id"),FOREIGN KEY(tenant_id,actor_id) REFERENCES public.users("TenantId","Id"));

CREATE OR REPLACE FUNCTION public.loyalty_accrue_sale(p_sale_id uuid) RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE s public.sales%ROWTYPE;c public.loyalty_settings%ROWTYPE;net bigint;paid bigint;pts bigint;written uuid;
BEGIN
 SELECT * INTO s FROM public.sales WHERE "Id"=p_sale_id FOR UPDATE;
 IF NOT FOUND OR s."CustomerPartyId" IS NULL OR s."Status" NOT IN(4,5) OR s."PaymentStatus"<>4 OR s."ConfirmedAtUtc" IS NULL OR coalesce(s."IdempotencyKey",'') LIKE 'QA-CHECKOUT-%' OR coalesce(s."IdempotencyKey",'') LIKE 'TRAINING-%' THEN RETURN;END IF;
 SELECT * INTO c FROM public.loyalty_settings WHERE "TenantId"=s."TenantId" AND "Enabled" FOR SHARE;
 IF NOT FOUND OR c."EnabledSinceUtc" IS NULL OR s."ConfirmedAtUtc"<c."EnabledSinceUtc" THEN RETURN;END IF;
 IF NOT EXISTS(SELECT 1 FROM public.parties p JOIN public.customer_profiles cp ON cp."TenantId"=p."TenantId" AND cp."PartyId"=p."Id" WHERE p."TenantId"=s."TenantId" AND p."Id"=s."CustomerPartyId" AND p."IsActive") THEN RETURN;END IF;
 SELECT greatest(0,round((coalesce(sum(i."Quantity"*i."UnitPrice"-i."Discount"),0)-s."DiscountTotal"+s."ChargesTotal")*100)::bigint) INTO net FROM public.sale_items i WHERE i."TenantId"=s."TenantId" AND i."SaleId"=s."Id";
 SELECT round(coalesce(sum(p."Amount"),0)*100)::bigint INTO paid FROM public.sale_payment_intents p WHERE p."TenantId"=s."TenantId" AND p."SaleId"=s."Id" AND p."Status"=2 AND p."ConfirmedAtUtc" IS NOT NULL;
 IF net<=0 OR paid<net THEN RETURN;END IF;
 pts:=(net/c."EarnEveryCents")*c."PointsPerStep";IF pts<=0 THEN RETURN;END IF;
 INSERT INTO public.loyalty_accounts("TenantId","PartyId") VALUES(s."TenantId",s."CustomerPartyId") ON CONFLICT DO NOTHING;
 PERFORM 1 FROM public.loyalty_accounts WHERE "TenantId"=s."TenantId" AND "PartyId"=s."CustomerPartyId" FOR UPDATE;
 INSERT INTO public.loyalty_ledger("TenantId","PartyId","EventKey","Kind","PointsDelta","SaleId","Reason","EarnBaseCents","EarnEveryCents","PointsPerStep") VALUES(s."TenantId",s."CustomerPartyId",'SALE_EARN:'||s."Id",'SALE_EARN',pts,s."Id",'Venda comercial paga e confirmada',net,c."EarnEveryCents",c."PointsPerStep") ON CONFLICT("TenantId","EventKey") DO NOTHING RETURNING "Id" INTO written;
 IF written IS NOT NULL THEN UPDATE public.loyalty_accounts SET "PointsBalance"="PointsBalance"+pts,"LifetimeEarned"="LifetimeEarned"+pts,"UpdatedAtUtc"=now() WHERE "TenantId"=s."TenantId" AND "PartyId"=s."CustomerPartyId";END IF;
END $fn$;

CREATE OR REPLACE FUNCTION public.loyalty_reverse_sale(p_sale_id uuid) RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE s public.sales%ROWTYPE;party uuid;pts bigint;written uuid;
BEGIN SELECT * INTO s FROM public.sales WHERE "Id"=p_sale_id FOR UPDATE;
 IF NOT FOUND OR (s."Status" NOT IN(6,8) AND s."PaymentStatus"<>7) THEN RETURN;END IF;
 SELECT "PartyId" INTO party FROM public.loyalty_ledger WHERE "TenantId"=s."TenantId" AND "SaleId"=s."Id" AND "Kind"='SALE_EARN';IF NOT FOUND THEN RETURN;END IF;
 PERFORM 1 FROM public.loyalty_accounts WHERE "TenantId"=s."TenantId" AND "PartyId"=party FOR UPDATE;
 SELECT coalesce(sum("PointsDelta"),0)::bigint INTO pts FROM public.loyalty_ledger WHERE "TenantId"=s."TenantId" AND "SaleId"=s."Id" AND "Kind" IN('SALE_EARN','SALE_REVERSAL','RETURN_REVERSAL');
 IF pts<=0 THEN RETURN;END IF;
 INSERT INTO public.loyalty_ledger("TenantId","PartyId","EventKey","Kind","PointsDelta","SaleId","Reason") VALUES(s."TenantId",party,'SALE_REVERSAL:'||s."Id",'SALE_REVERSAL',-pts,s."Id",'Estorno de venda cancelada ou integralmente devolvida') ON CONFLICT("TenantId","EventKey") DO NOTHING RETURNING "Id" INTO written;
 IF written IS NOT NULL THEN UPDATE public.loyalty_accounts SET "PointsBalance"="PointsBalance"-pts,"UpdatedAtUtc"=now() WHERE "TenantId"=s."TenantId" AND "PartyId"=party;END IF;
END $fn$;

CREATE OR REPLACE FUNCTION public.loyalty_reverse_return(p_return_id uuid) RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE r public.sale_returns%ROWTYPE;s public.sales%ROWTYPE;e public.loyalty_ledger%ROWTYPE;refund numeric;already bigint;target bigint;delta bigint;written uuid;
BEGIN SELECT * INTO r FROM public.sale_returns WHERE "Id"=p_return_id AND "Status"=2;
 IF NOT FOUND THEN RETURN;END IF;
 SELECT * INTO s FROM public.sales WHERE "Id"=r."SaleId" AND "TenantId"=r."TenantId" AND "BranchId"=r."BranchId" FOR UPDATE;
 IF NOT FOUND THEN RETURN;END IF;
 IF s."Status" IN(6,8) OR s."PaymentStatus"=7 THEN PERFORM public.loyalty_reverse_sale(s."Id");RETURN;END IF;
 SELECT * INTO e FROM public.loyalty_ledger WHERE "TenantId"=s."TenantId" AND "SaleId"=s."Id" AND "Kind"='SALE_EARN';
 IF NOT FOUND OR e."EarnBaseCents" IS NULL OR e."EarnBaseCents"<=0 THEN RETURN;END IF;
 PERFORM 1 FROM public.loyalty_accounts WHERE "TenantId"=s."TenantId" AND "PartyId"=e."PartyId" FOR UPDATE;
 SELECT coalesce(sum(greatest(0,i."RefundAmount")),0)*100 INTO refund FROM public.sale_returns x JOIN public.sale_return_items i ON i."TenantId"=x."TenantId" AND i."SaleReturnId"=x."Id" JOIN public.sale_items si ON si."TenantId"=i."TenantId" AND si."Id"=i."SaleItemId" AND si."SaleId"=s."Id" WHERE x."TenantId"=s."TenantId" AND x."BranchId"=s."BranchId" AND x."SaleId"=s."Id" AND x."Status"=2;
 target:=floor(e."PointsDelta"*least(1,refund/e."EarnBaseCents"))::bigint;
 SELECT -coalesce(sum("PointsDelta"),0)::bigint INTO already FROM public.loyalty_ledger WHERE "TenantId"=s."TenantId" AND "SaleId"=s."Id" AND "Kind" IN('RETURN_REVERSAL','SALE_REVERSAL');
 delta:=target-already;IF delta<=0 THEN RETURN;END IF;
 INSERT INTO public.loyalty_ledger("TenantId","PartyId","EventKey","Kind","PointsDelta","SaleId","Reason") VALUES(s."TenantId",e."PartyId",'RETURN_REVERSAL:'||p_return_id||':'||target,'RETURN_REVERSAL',-delta,s."Id",'Estorno proporcional acumulado de devoluções aprovadas') ON CONFLICT("TenantId","EventKey") DO NOTHING RETURNING "Id" INTO written;
 IF written IS NOT NULL THEN UPDATE public.loyalty_accounts SET "PointsBalance"="PointsBalance"-delta,"UpdatedAtUtc"=now() WHERE "TenantId"=s."TenantId" AND "PartyId"=e."PartyId";END IF;
END $fn$;

CREATE OR REPLACE FUNCTION public.loyalty_sale_event() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$ BEGIN PERFORM public.loyalty_accrue_sale(NEW."Id");PERFORM public.loyalty_reverse_sale(NEW."Id");RETURN NEW;END $fn$;

CREATE OR REPLACE FUNCTION public.loyalty_payment_event() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$ BEGIN PERFORM public.loyalty_accrue_sale(NEW."SaleId");PERFORM public.loyalty_reverse_sale(NEW."SaleId");RETURN NEW;END $fn$;

CREATE OR REPLACE FUNCTION public.loyalty_return_event() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$ BEGIN PERFORM public.loyalty_reverse_return(NEW."Id");RETURN NEW;END $fn$;

CREATE OR REPLACE FUNCTION public.loyalty_return_item_event_v15() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$ BEGIN PERFORM public.loyalty_reverse_return(NEW."SaleReturnId");RETURN NEW;END $fn$;

DROP TRIGGER IF EXISTS "TR_loyalty_sale_event" ON public.sales;

CREATE CONSTRAINT TRIGGER "TR_loyalty_sale_event" AFTER INSERT OR UPDATE OF "Status","PaymentStatus","ConfirmedAtUtc","CustomerPartyId" ON public.sales DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.loyalty_sale_event();

DROP TRIGGER IF EXISTS "TR_loyalty_payment_event" ON public.sale_payment_intents;

CREATE CONSTRAINT TRIGGER "TR_loyalty_payment_event" AFTER INSERT OR UPDATE OF "Status","ConfirmedAtUtc" ON public.sale_payment_intents DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.loyalty_payment_event();

DROP TRIGGER IF EXISTS "TR_loyalty_return_event" ON public.sale_returns;

CREATE CONSTRAINT TRIGGER "TR_loyalty_return_event" AFTER INSERT OR UPDATE OF "Status" ON public.sale_returns DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.loyalty_return_event();

DROP TRIGGER IF EXISTS "TR_loyalty_return_item_v15" ON public.sale_return_items;

CREATE CONSTRAINT TRIGGER "TR_loyalty_return_item_v15" AFTER INSERT OR UPDATE ON public.sale_return_items DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.loyalty_return_item_event_v15();

DROP TRIGGER IF EXISTS "TR_loyalty_commands_immutable_v15" ON public.loyalty_commands_v15;

CREATE TRIGGER "TR_loyalty_commands_immutable_v15" BEFORE UPDATE OR DELETE ON public.loyalty_commands_v15 FOR EACH ROW EXECUTE FUNCTION public.loyalty_ledger_immutable();

CREATE OR REPLACE FUNCTION public.loyalty_command_v15(t uuid,b uuid,u uuid,req uuid,act text,p jsonb) RETURNS jsonb LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE perms text[];email text;old public.loyalty_commands_v15%ROWTYPE;setting public.loyalty_settings%ROWTYPE;reward public.loyalty_rewards%ROWTYPE;red public.loyalty_redemptions%ROWTYPE;party uuid;rid uuid;v integer;enabled boolean;every integer;step integer;silver bigint;gold bigint;diamond bigint;title text;description text;points bigint;stock integer;active boolean;out jsonb;
BEGIN
 SELECT x."Email" INTO email FROM public.users x JOIN public.branches z ON z."TenantId"=x."TenantId" AND z."Id"=b AND z."IsActive" WHERE x."TenantId"=t AND x."Id"=u AND x."DefaultBranchId"=b AND x."IsActive" AND EXISTS(SELECT 1 FROM public.partners a WHERE a."TenantId"=t AND lower(a."Email")=lower(x."Email") AND a."Status"=1 AND a."IsErpAccessEnabled");
 IF NOT FOUND THEN RAISE EXCEPTION 'LOYALTY_FORBIDDEN' USING ERRCODE='42501';END IF;
 SELECT coalesce(array_agg(DISTINCT rp."PermissionKey"),ARRAY[]::text[]) INTO perms FROM public.user_roles ur JOIN public.role_permissions rp ON rp."TenantId"=ur."TenantId" AND rp."RoleId"=ur."RoleId" WHERE ur."TenantId"=t AND ur."UserId"=u;
 IF NOT(ARRAY['loyalty.view','customers.view']<@perms) OR (act IN('SETTINGS','REWARD') AND NOT('loyalty.manage'=ANY(perms))) OR (act IN('RESERVE','CANCEL','FULFILL_GIFT') AND NOT('loyalty.redeem'=ANY(perms))) THEN RAISE EXCEPTION 'LOYALTY_FORBIDDEN' USING ERRCODE='42501';END IF;
 IF req IS NULL OR jsonb_typeof(p) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'LOYALTY_INVALID' USING ERRCODE='22023';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(t::text||':loyalty-command',0));
 SELECT * INTO old FROM public.loyalty_commands_v15 WHERE tenant_id=t AND request_id=req;
 IF FOUND THEN IF old.actor_id<>u OR old.branch_id<>b OR old.action<>act OR old.payload IS DISTINCT FROM p THEN RAISE EXCEPTION 'LOYALTY_CONFLICT' USING ERRCODE='23514';END IF;RETURN old.result;END IF;
 IF act='SETTINGS' THEN
  v:=(p->>'version')::integer;enabled:=(p->>'enabled')::boolean;every:=(p->>'earnEveryCents')::integer;step:=(p->>'pointsPerStep')::integer;silver:=(p->>'silver')::bigint;gold:=(p->>'gold')::bigint;diamond:=(p->>'diamond')::bigint;
  IF enabled IS NULL OR every IS NULL OR every NOT BETWEEN 1 AND 100000000 OR step IS NULL OR step NOT BETWEEN 1 AND 100 OR NOT ((silver IS NULL AND gold IS NULL AND diamond IS NULL) OR (silver>0 AND gold>silver AND diamond>gold AND diamond<=1000000000 AND silver IS NOT NULL AND gold IS NOT NULL AND diamond IS NOT NULL)) THEN RAISE EXCEPTION 'LOYALTY_INVALID' USING ERRCODE='22023';END IF;
  SELECT * INTO setting FROM public.loyalty_settings WHERE "TenantId"=t FOR UPDATE;
  IF coalesce(setting."Version",0) IS DISTINCT FROM v THEN RAISE EXCEPTION 'LOYALTY_STALE' USING ERRCODE='23514';END IF;
  INSERT INTO public.loyalty_settings("TenantId","Enabled","EnabledSinceUtc","EarnEveryCents","PointsPerStep","SilverThreshold","GoldThreshold","DiamondThreshold","Version") VALUES(t,enabled,CASE WHEN enabled THEN now() END,every,step,silver,gold,diamond,v+1) ON CONFLICT("TenantId") DO UPDATE SET "Enabled"=enabled,"EnabledSinceUtc"=CASE WHEN enabled AND NOT setting."Enabled" THEN now() ELSE setting."EnabledSinceUtc" END,"EarnEveryCents"=every,"PointsPerStep"=step,"SilverThreshold"=silver,"GoldThreshold"=gold,"DiamondThreshold"=diamond,"Version"=v+1,"UpdatedAtUtc"=now();
  out:=jsonb_build_object('version',v+1);
 ELSIF act='REWARD' THEN
  rid:=(p->>'id')::uuid;v:=(p->>'version')::integer;title:=btrim(p->>'title');description:=p->>'description';points:=(p->>'pointsCost')::bigint;stock:=(p->>'stockTotal')::integer;active:=(p->>'active')::boolean;
  IF rid IS NULL OR title IS NULL OR length(title) NOT BETWEEN 1 AND 140 OR length(coalesce(description,''))>600 OR points IS NULL OR points NOT BETWEEN 1 AND 1000000000 OR stock IS NULL OR stock NOT BETWEEN 0 AND 1000000 OR active IS NULL THEN RAISE EXCEPTION 'LOYALTY_INVALID' USING ERRCODE='22023';END IF;
  SELECT * INTO reward FROM public.loyalty_rewards WHERE "TenantId"=t AND "Id"=rid FOR UPDATE;
  IF coalesce(reward."Version",0) IS DISTINCT FROM v OR (v>0 AND reward."Kind"<>'GIFT') OR stock<coalesce(reward."StockAllocated",0) THEN RAISE EXCEPTION 'LOYALTY_STALE' USING ERRCODE='23514';END IF;
  IF v=0 THEN INSERT INTO public.loyalty_rewards("Id","TenantId","Title","Description","Kind","PointsCost","StockTotal","IsActive") VALUES(rid,t,title,description,'GIFT',points,stock,active);
  ELSE UPDATE public.loyalty_rewards SET "Title"=title,"Description"=description,"PointsCost"=points,"StockTotal"=stock,"IsActive"=active,"Version"=v+1,"UpdatedAtUtc"=now() WHERE "TenantId"=t AND "Id"=rid;END IF;
  out:=jsonb_build_object('id',rid,'version',v+1);
 ELSIF act IN('RESERVE','CANCEL','FULFILL_GIFT') THEN
  party:=(p->>'partyId')::uuid;rid:=(p->>'id')::uuid;
  IF NOT EXISTS(SELECT 1 FROM public.parties x JOIN public.customer_profiles c ON c."TenantId"=x."TenantId" AND c."PartyId"=x."Id" WHERE x."TenantId"=t AND x."Id"=party AND (act='CANCEL' OR x."IsActive")) THEN RAISE EXCEPTION 'LOYALTY_INVALID' USING ERRCODE='22023';END IF;
  IF act='RESERVE' THEN
   IF NOT EXISTS(SELECT 1 FROM public.loyalty_settings WHERE "TenantId"=t AND "Enabled") THEN RAISE EXCEPTION 'LOYALTY_DISABLED' USING ERRCODE='23514';END IF;
   SELECT * INTO reward FROM public.loyalty_rewards WHERE "TenantId"=t AND "Id"=rid AND "Kind"='GIFT';
   IF NOT FOUND OR reward."StockTotal" IS NULL OR reward."Version" IS DISTINCT FROM (p->>'version')::integer THEN RAISE EXCEPTION 'LOYALTY_STALE' USING ERRCODE='23514';END IF;
   INSERT INTO public.loyalty_accounts("TenantId","PartyId") VALUES(t,party) ON CONFLICT DO NOTHING;PERFORM 1 FROM public.loyalty_accounts WHERE "TenantId"=t AND "PartyId"=party FOR UPDATE;SELECT * INTO reward FROM public.loyalty_rewards WHERE "TenantId"=t AND "Id"=rid AND "Kind"='GIFT' FOR UPDATE;IF NOT FOUND OR reward."Version" IS DISTINCT FROM (p->>'version')::integer THEN RAISE EXCEPTION 'LOYALTY_STALE' USING ERRCODE='23514';END IF;rid:=public.loyalty_reserve_reward(t,party,rid,u,req::text);out:=jsonb_build_object('id',rid,'status','RESERVED');
  ELSE
   SELECT * INTO red FROM public.loyalty_redemptions WHERE "TenantId"=t AND "PartyId"=party AND "Id"=rid;
   IF NOT FOUND THEN RAISE EXCEPTION 'LOYALTY_INVALID' USING ERRCODE='22023';END IF;
   PERFORM public.loyalty_update_redemption(t,rid,u,act);out:=jsonb_build_object('id',rid,'status',CASE WHEN act='CANCEL' THEN 'CANCELLED' ELSE 'FULFILLED' END);
  END IF;
 ELSE RAISE EXCEPTION 'LOYALTY_INVALID' USING ERRCODE='22023';END IF;
 INSERT INTO public.loyalty_commands_v15(tenant_id,branch_id,request_id,actor_id,action,payload,result) VALUES(t,b,req,u,act,p,out);
 INSERT INTO public.audit_events("Id","TenantId","BranchId","EntityType","EntityId","Action","ActorId","ActorEmail","CorrelationId","AfterStateJson","CreatedAtUtc","Version") VALUES(gen_random_uuid(),t,b,'Loyalty',req::text,act,u,email,req::text,out,now(),1);
 RETURN out;
END $fn$;
