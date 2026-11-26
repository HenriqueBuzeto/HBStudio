BEGIN;
CREATE UNIQUE INDEX IF NOT EXISTS ux_partner_scope_v10 ON public.partners("TenantId","Id");

CREATE TABLE IF NOT EXISTS public.partner_user_links_v10(tenant_id uuid NOT NULL,partner_id uuid NOT NULL,user_id uuid NOT NULL,PRIMARY KEY(tenant_id,partner_id),UNIQUE(tenant_id,user_id),FOREIGN KEY(tenant_id,partner_id) REFERENCES public.partners("TenantId","Id") ON DELETE RESTRICT,FOREIGN KEY(tenant_id,user_id) REFERENCES public.users("TenantId","Id") ON DELETE RESTRICT);

CREATE TABLE IF NOT EXISTS public.partner_investment_profiles_v10(tenant_id uuid NOT NULL,partner_id uuid NOT NULL,base_cents bigint NOT NULL CHECK(base_cents>=0),monthly_cents bigint NOT NULL CHECK(monthly_cents>=0),PRIMARY KEY(tenant_id,partner_id),FOREIGN KEY(tenant_id,partner_id) REFERENCES public.partners("TenantId","Id") ON DELETE RESTRICT);

CREATE TABLE IF NOT EXISTS public.partner_investments_v10(tenant_id uuid NOT NULL,id uuid NOT NULL,name text NOT NULL CHECK(length(name) BETWEEN 1 AND 200),category text NOT NULL CHECK(category IN('WORKS','STOCK','CASH','EQUIPMENT','OTHER')),amount_cents bigint NOT NULL CHECK(amount_cents>0),invested_on date NOT NULL,reference text NOT NULL,notes text NOT NULL,created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(tenant_id,id),FOREIGN KEY(tenant_id,created_by) REFERENCES public.users("TenantId","Id"));

CREATE TABLE IF NOT EXISTS public.partner_investment_shares_v10(tenant_id uuid NOT NULL,investment_id uuid NOT NULL,partner_id uuid NOT NULL,principal_cents bigint NOT NULL CHECK(principal_cents>0),PRIMARY KEY(tenant_id,investment_id,partner_id),FOREIGN KEY(tenant_id,investment_id) REFERENCES public.partner_investments_v10(tenant_id,id),FOREIGN KEY(tenant_id,partner_id) REFERENCES public.partners("TenantId","Id"));

CREATE TABLE IF NOT EXISTS public.partner_investment_payments_v10(tenant_id uuid NOT NULL,id uuid NOT NULL,branch_id uuid NOT NULL,mode text NOT NULL CHECK(mode IN('PERSONAL','COLLECTIVE','REVERSAL')),source text NOT NULL CHECK(source IN('EXTERNAL','SETTLEMENT','REVERSAL')),reference text NOT NULL,paid_on date NOT NULL,amount_cents bigint NOT NULL CHECK(amount_cents>0),requested_cents bigint NOT NULL CHECK(requested_cents>=amount_cents),settlement_id uuid REFERENCES public.financial_settlements("Id"),reverses_id uuid,created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(tenant_id,id),UNIQUE(tenant_id,settlement_id),UNIQUE(tenant_id,reverses_id),FOREIGN KEY(tenant_id,reverses_id) REFERENCES public.partner_investment_payments_v10(tenant_id,id),FOREIGN KEY(tenant_id,created_by) REFERENCES public.users("TenantId","Id"),CHECK((source='SETTLEMENT')=(settlement_id IS NOT NULL)),CHECK((mode='REVERSAL')=(reverses_id IS NOT NULL)),CHECK((mode='REVERSAL')=(source='REVERSAL')));

CREATE UNIQUE INDEX IF NOT EXISTS ux_partner_investment_external_ref_v10 ON public.partner_investment_payments_v10(tenant_id,lower(reference)) WHERE source='EXTERNAL';

CREATE TABLE IF NOT EXISTS public.partner_investment_payment_lines_v10(tenant_id uuid NOT NULL,payment_id uuid NOT NULL,investment_id uuid NOT NULL,partner_id uuid NOT NULL,amount_cents bigint NOT NULL CHECK(amount_cents<>0),PRIMARY KEY(tenant_id,payment_id,investment_id,partner_id),FOREIGN KEY(tenant_id,payment_id) REFERENCES public.partner_investment_payments_v10(tenant_id,id),FOREIGN KEY(tenant_id,investment_id,partner_id) REFERENCES public.partner_investment_shares_v10(tenant_id,investment_id,partner_id));

CREATE INDEX IF NOT EXISTS ix_partner_investment_lines_share_v10 ON public.partner_investment_payment_lines_v10(tenant_id,investment_id,partner_id);

CREATE TABLE IF NOT EXISTS public.partner_investment_requests_v10(tenant_id uuid NOT NULL,request_id uuid NOT NULL,actor_id uuid NOT NULL,branch_id uuid NOT NULL,action text NOT NULL,payload jsonb NOT NULL,result jsonb NOT NULL,PRIMARY KEY(tenant_id,request_id));

CREATE OR REPLACE VIEW public.partner_investment_balances_v10 AS SELECT s.tenant_id,s.investment_id,s.partner_id,s.principal_cents,coalesce(sum(l.amount_cents),0)::bigint paid_cents,(s.principal_cents-coalesce(sum(l.amount_cents),0))::bigint balance_cents FROM public.partner_investment_shares_v10 s LEFT JOIN public.partner_investment_payment_lines_v10 l ON(l.tenant_id,l.investment_id,l.partner_id)=(s.tenant_id,s.investment_id,s.partner_id) GROUP BY s.tenant_id,s.investment_id,s.partner_id,s.principal_cents;

CREATE OR REPLACE FUNCTION public.partner_investment_immutable_v10() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'PARTNER_IMMUTABLE' USING ERRCODE='23514';END $$;

DO $$ DECLARE n text; BEGIN FOREACH n IN ARRAY ARRAY['partner_investments_v10','partner_investment_shares_v10','partner_investment_payments_v10','partner_investment_payment_lines_v10','partner_investment_requests_v10'] LOOP IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid=('public.'||n)::regclass AND tgname='partner_immutable_v10') THEN EXECUTE format('CREATE TRIGGER partner_immutable_v10 BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.partner_investment_immutable_v10()',n);END IF;END LOOP;END $$;
ALTER TABLE public.partner_investments_v10 ADD COLUMN IF NOT EXISTS payable_id uuid REFERENCES public.accounts_payable("Id") ON DELETE RESTRICT;

CREATE UNIQUE INDEX IF NOT EXISTS ux_partner_investment_payable_v10 ON public.partner_investments_v10(tenant_id,payable_id) WHERE payable_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.partner_investment_integrity_v10()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$ DECLARE k uuid; j uuid; expected bigint; actual bigint; BEGIN
 IF TG_TABLE_NAME='partner_investments_v10' OR TG_TABLE_NAME='partner_investment_shares_v10' THEN
 k:=CASE WHEN TG_TABLE_NAME='partner_investments_v10' THEN (to_jsonb(NEW)->>'id')::uuid ELSE (to_jsonb(NEW)->>'investment_id')::uuid END;
 SELECT amount_cents INTO expected FROM public.partner_investments_v10 WHERE tenant_id=NEW.tenant_id AND id=k;
 SELECT coalesce(sum(principal_cents),0) INTO actual FROM public.partner_investment_shares_v10 WHERE tenant_id=NEW.tenant_id AND investment_id=k;
 ELSE
 k:=CASE WHEN TG_TABLE_NAME='partner_investment_payments_v10' THEN (to_jsonb(NEW)->>'id')::uuid ELSE (to_jsonb(NEW)->>'payment_id')::uuid END;
 SELECT CASE WHEN mode='REVERSAL' THEN -amount_cents ELSE amount_cents END INTO expected FROM public.partner_investment_payments_v10 WHERE tenant_id=NEW.tenant_id AND id=k;
 SELECT coalesce(sum(amount_cents),0) INTO actual FROM public.partner_investment_payment_lines_v10 WHERE tenant_id=NEW.tenant_id AND payment_id=k;
 IF EXISTS(SELECT 1 FROM public.partner_investment_payment_lines_v10 l JOIN public.partner_investment_balances_v10 v ON(v.tenant_id,v.investment_id,v.partner_id)=(l.tenant_id,l.investment_id,l.partner_id) WHERE l.tenant_id=NEW.tenant_id AND l.payment_id=k AND (v.balance_cents<0 OR v.paid_cents<0 OR sign(l.amount_cents)<>sign(expected))) THEN RAISE EXCEPTION 'PARTNER_BALANCE_INTEGRITY' USING ERRCODE='23514';END IF;
 END IF;
 IF expected IS DISTINCT FROM actual THEN RAISE EXCEPTION 'PARTNER_TOTAL_INTEGRITY' USING ERRCODE='23514';END IF;RETURN NEW;END $function$;

DO $$ DECLARE n text; BEGIN FOREACH n IN ARRAY ARRAY['partner_investments_v10','partner_investment_shares_v10','partner_investment_payments_v10','partner_investment_payment_lines_v10'] LOOP IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid=('public.'||n)::regclass AND tgname='partner_integrity_v10') THEN EXECUTE format('CREATE CONSTRAINT TRIGGER partner_integrity_v10 AFTER INSERT ON public.%I DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.partner_investment_integrity_v10()',n);END IF;END LOOP;END $$;

CREATE OR REPLACE VIEW public.partner_monthly_funding_v10 AS SELECT p."TenantId" AS tenant_id,
    p."Id" AS partner_id,
    p."Name" AS name,
    p."Status" AS status,
    COALESCE(f.base_cents, 0::bigint) AS base_cents,
    COALESCE(f.monthly_cents, 0::bigint) AS monthly_cents,
    COALESCE(v.principal, 0::numeric)::bigint AS principal_cents,
    COALESCE(v.paid, 0::numeric)::bigint AS paid_cents,
    COALESCE(v.balance, 0::numeric)::bigint AS balance_cents,
    LEAST(COALESCE(f.monthly_cents, 0::bigint)::numeric, COALESCE(v.balance, 0::numeric))::bigint AS planned_cents,
    GREATEST(0::numeric, COALESCE(f.monthly_cents, 0::bigint)::numeric - COALESCE(v.balance, 0::numeric))::bigint AS released_cents
   FROM partners p
     LEFT JOIN partner_investment_profiles_v10 f ON f.tenant_id = p."TenantId" AND f.partner_id = p."Id"
     LEFT JOIN LATERAL ( SELECT sum(x.principal_cents) AS principal,
            sum(x.paid_cents) AS paid,
            sum(x.balance_cents) AS balance
           FROM partner_investment_balances_v10 x
          WHERE x.tenant_id = p."TenantId" AND x.partner_id = p."Id") v ON true;

CREATE TABLE IF NOT EXISTS public.partner_monthly_closings_v10(tenant_id uuid NOT NULL,id uuid NOT NULL,branch_id uuid NOT NULL,month date NOT NULL CHECK(extract(day from month)=1),request_id uuid NOT NULL,created_by uuid NOT NULL,inputs jsonb NOT NULL,snapshot jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(tenant_id,id),UNIQUE(tenant_id,request_id),UNIQUE(tenant_id,month),FOREIGN KEY(tenant_id,created_by) REFERENCES public.users("TenantId","Id"));

DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.partner_monthly_closings_v10'::regclass AND tgname='partner_immutable_v10') THEN CREATE TRIGGER partner_immutable_v10 BEFORE UPDATE OR DELETE ON public.partner_monthly_closings_v10 FOR EACH ROW EXECUTE FUNCTION public.partner_investment_immutable_v10();END IF;END $$;

CREATE OR REPLACE FUNCTION public.partner_investment_command_v10(t uuid, b uuid, u uuid, req uuid, act text, p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE perms text[]; actor_email text; prev public.partner_investment_requests_v10%ROWTYPE; pid uuid; uid uuid; party uuid; inv uuid; pay uuid; oldpay public.partner_investment_payments_v10%ROWTYPE; nm text; doc text; em text; ref text; cat text; memo text; typ int; cap bigint; base bigint; monthly bigint; amt bigint; budget bigint; allocated bigint; remaining bigint; share bigint; n int; idx int; d date; mode text; src text; sid uuid; selected uuid[]; rowx record; result jsonb; oldp public.partners%ROWTYPE; existing_uid uuid; old_base bigint; old_monthly bigint; payable uuid; match_count int; lines jsonb:='[]'::jsonb;
BEGIN
 SELECT x."Email",ARRAY(SELECT DISTINCT rp."PermissionKey" FROM public.user_roles ur JOIN public.role_permissions rp ON rp."TenantId"=ur."TenantId" AND rp."RoleId"=ur."RoleId" WHERE ur."TenantId"=t AND ur."UserId"=u) INTO actor_email,perms FROM public.users x JOIN public.branches br ON br."TenantId"=t AND br."Id"=b AND br."IsActive" JOIN public.tenants te ON te."Id"=t AND te."IsActive" WHERE x."TenantId"=t AND x."Id"=u AND x."DefaultBranchId"=b AND x."IsActive" AND EXISTS(SELECT 1 FROM public.partners pp WHERE pp."TenantId"=t AND lower(pp."Email")=lower(x."Email") AND pp."Status"=1 AND pp."IsErpAccessEnabled");
 IF NOT FOUND OR NOT ('partners.view'=ANY(perms)) OR NOT (CASE WHEN act='PARTNER' THEN 'partners.manage'=ANY(perms) WHEN act IN('INVEST','PAY','REVERSE') THEN 'partners.capital.manage'=ANY(perms) AND 'finance.reports.view'=ANY(perms) ELSE false END) THEN RAISE EXCEPTION 'PARTNER_FORBIDDEN' USING ERRCODE='42501';END IF;
 IF req IS NULL OR jsonb_typeof(p) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'PARTNER_INVALID' USING ERRCODE='22023';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('partner-investment-v10:'||t::text,0));
 SELECT * INTO prev FROM public.partner_investment_requests_v10 x WHERE x.tenant_id=t AND x.request_id=req;
 IF FOUND THEN IF (prev.actor_id,prev.branch_id,prev.action,prev.payload) IS DISTINCT FROM (u,b,act,p) THEN RAISE EXCEPTION 'PARTNER_IDEMPOTENCY_CONFLICT' USING ERRCODE='23514';END IF;RETURN prev.result;END IF;
 IF act='PARTNER' THEN
  pid:=nullif(p->>'id','')::uuid;uid:=nullif(p->>'userId','')::uuid;nm:=btrim(coalesce(p->>'name',''));doc:=regexp_replace(coalesce(p->>'document',''),'[^0-9]','','g');em:=lower(btrim(coalesce(p->>'email','')));typ:=(p->>'type')::int;cap:=coalesce((p->>'capCents')::bigint,0);base:=coalesce((p->>'baseCents')::bigint,0);monthly:=coalesce((p->>'monthlyCents')::bigint,0);memo:=coalesce(btrim(p->>'notes'),'');
  IF length(nm) NOT BETWEEN 2 AND 200 OR length(doc) NOT IN(11,14) OR typ IS NULL OR typ NOT BETWEEN 1 AND 4 OR least(cap,base,monthly)<0 OR greatest(cap,base,monthly)>100000000000 OR base>cap OR length(memo)>1000 THEN RAISE EXCEPTION 'PARTNER_INVALID_PROFILE' USING ERRCODE='22023';END IF;
  IF pid IS NOT NULL THEN SELECT * INTO oldp FROM public.partners x WHERE x."TenantId"=t AND x."Id"=pid FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'PARTNER_NOT_FOUND' USING ERRCODE='22023';END IF;END IF;
  IF pid IS NOT NULL THEN
    SELECT x.user_id INTO existing_uid FROM public.partner_user_links_v10 x WHERE x.tenant_id=t AND x.partner_id=pid;
    IF existing_uid IS NOT NULL AND uid IS NULL THEN SELECT lower(x."Email") INTO em FROM public.users x WHERE x."TenantId"=t AND x."Id"=existing_uid; END IF;
    SELECT coalesce(x.base_cents,0),coalesce(x.monthly_cents,0) INTO old_base,old_monthly FROM public.partner_investment_profiles_v10 x WHERE x.tenant_id=t AND x.partner_id=pid;
  END IF;
  IF NOT (p ? 'capCents') THEN cap:=coalesce(oldp."MonthlyCompensationCap"*100,0);END IF;
  IF NOT (p ? 'baseCents') THEN base:=coalesce(old_base,0);END IF;
  IF NOT (p ? 'monthlyCents') THEN monthly:=coalesce(old_monthly,0);END IF;
  IF base>cap THEN RAISE EXCEPTION 'PARTNER_INVALID_PROFILE' USING ERRCODE='22023';END IF;
  IF (cap<>coalesce(oldp."MonthlyCompensationCap"*100,0) OR base<>coalesce(old_base,0) OR monthly<>coalesce(old_monthly,0)) AND NOT ('partners.compensation.manage'=ANY(perms)) THEN RAISE EXCEPTION 'PARTNER_COMPENSATION_FORBIDDEN' USING ERRCODE='42501';END IF;
  IF uid IS NOT NULL THEN IF NOT ('access.manage'=ANY(perms)) THEN RAISE EXCEPTION 'PARTNER_LINK_FORBIDDEN' USING ERRCODE='42501';END IF;
   SELECT lower(x."Email") INTO em FROM public.users x WHERE x."TenantId"=t AND x."Id"=uid AND x."IsActive";IF NOT FOUND THEN RAISE EXCEPTION 'PARTNER_INVALID_USER' USING ERRCODE='22023';END IF;
  ELSIF pid IS NOT NULL AND oldp."IsErpAccessEnabled" THEN em:=lower(oldp."Email");END IF;
  IF em<>'' AND (length(em)>255 OR em !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$') THEN RAISE EXCEPTION 'PARTNER_INVALID_EMAIL' USING ERRCODE='22023';END IF;
  IF EXISTS(SELECT 1 FROM public.partners x WHERE x."TenantId"=t AND x."Id" IS DISTINCT FROM pid AND (regexp_replace(x."DocumentNumber",'[^0-9]','','g')=doc OR (em<>'' AND lower(x."Email")=em))) THEN RAISE EXCEPTION 'PARTNER_DUPLICATE' USING ERRCODE='23505';END IF;
  IF pid IS NOT NULL AND oldp."IsErpAccessEnabled" AND lower(oldp."Email")<>em THEN RAISE EXCEPTION 'PARTNER_ACTIVE_ACCESS_CHANGE' USING ERRCODE='23514';END IF;
  IF pid IS NOT NULL AND EXISTS(SELECT 1 FROM public.partner_user_links_v10 x WHERE x.tenant_id=t AND x.partner_id=pid AND uid IS NOT NULL AND x.user_id<>uid) THEN RAISE EXCEPTION 'PARTNER_EXISTING_LINK' USING ERRCODE='23514';END IF;
  SELECT count(*),min(x."Id"::text)::uuid INTO match_count,party FROM public.parties x WHERE x."TenantId"=t AND regexp_replace(coalesce(x."DocumentNumber",''),'[^0-9]','','g')=doc;
  IF match_count>1 THEN RAISE EXCEPTION 'PARTNER_AMBIGUOUS_DOCUMENT' USING ERRCODE='23514';END IF;
  IF pid IS NOT NULL AND EXISTS(SELECT 1 FROM public.parties x WHERE x."TenantId"=t AND x."Id"=oldp."PartyId") THEN IF party IS DISTINCT FROM oldp."PartyId" THEN RAISE EXCEPTION 'PARTNER_DOCUMENT_CHANGE' USING ERRCODE='23514';END IF;party:=oldp."PartyId";END IF;
  IF party IS NULL THEN party:=CASE WHEN pid IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.parties x WHERE x."Id"=oldp."PartyId") THEN oldp."PartyId" ELSE gen_random_uuid() END;INSERT INTO public.parties("Id","TenantId","Type","Name","DocumentNumber","IsActive","CreatedAtUtc") VALUES(party,t,CASE WHEN length(doc)=11 THEN 1 ELSE 2 END,nm,doc,true,now());END IF;
  IF EXISTS(SELECT 1 FROM public.partners x WHERE x."TenantId"=t AND x."PartyId"=party AND x."Id" IS DISTINCT FROM pid) THEN RAISE EXCEPTION 'PARTNER_DUPLICATE_PARTY' USING ERRCODE='23505';END IF;
  IF pid IS NULL THEN pid:=gen_random_uuid();INSERT INTO public.partners("Id","TenantId","PartyId","Name","DocumentNumber","Email","Type","Status","AdmissionDate","MonthlyCompensationCap","IsErpAccessEnabled","Notes","CreatedAtUtc") VALUES(pid,t,party,nm,doc,em,typ,1,now(),cap/100.0,false,memo,now());
  ELSE UPDATE public.partners SET "PartyId"=party,"Name"=nm,"DocumentNumber"=doc,"Email"=em,"Type"=typ,"MonthlyCompensationCap"=cap/100.0,"Notes"=memo,"UpdatedAtUtc"=now() WHERE "TenantId"=t AND "Id"=pid;END IF;
  IF uid IS NOT NULL THEN INSERT INTO public.partner_user_links_v10 VALUES(t,pid,uid) ON CONFLICT(tenant_id,partner_id) DO NOTHING;END IF;
  IF p->>'enableAccess'='true' THEN IF uid IS NULL OR NOT ('access.manage'=ANY(perms)) OR NOT EXISTS(SELECT 1 FROM public.user_roles r WHERE r."TenantId"=t AND r."UserId"=uid) THEN RAISE EXCEPTION 'PARTNER_LINK_FORBIDDEN' USING ERRCODE='42501';END IF;UPDATE public.partners SET "IsErpAccessEnabled"=true WHERE "TenantId"=t AND "Id"=pid AND "Status"=1;END IF;
  INSERT INTO public.partner_investment_profiles_v10 VALUES(t,pid,base,monthly) ON CONFLICT(tenant_id,partner_id) DO UPDATE SET base_cents=excluded.base_cents,monthly_cents=excluded.monthly_cents;
  result:=jsonb_build_object('id',pid);
 ELSIF act='INVEST' THEN
  nm:=btrim(coalesce(p->>'name',''));cat:=p->>'category';amt:=(p->>'amountCents')::bigint;d:=(p->>'date')::date;ref:=btrim(coalesce(p->>'reference',''));memo:=btrim(coalesce(p->>'notes',''));
  IF length(nm) NOT BETWEEN 1 AND 200 OR cat IS NULL OR cat NOT IN('WORKS','STOCK','CASH','EQUIPMENT','OTHER') OR amt IS NULL OR amt NOT BETWEEN 1 AND 100000000000 OR d IS NULL OR d>(now() AT TIME ZONE 'America/Sao_Paulo')::date OR length(ref) NOT BETWEEN 3 AND 250 OR length(memo)>1000 OR jsonb_typeof(p->'partnerIds') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'PARTNER_INVALID_INVESTMENT' USING ERRCODE='22023';END IF;
  SELECT array_agg(DISTINCT x::uuid ORDER BY x::uuid) INTO selected FROM jsonb_array_elements_text(p->'partnerIds') x;
  n:=coalesce(cardinality(selected),0);IF n=0 OR n>100 OR amt<n OR n<>jsonb_array_length(p->'partnerIds') OR (SELECT count(*) FROM public.partners x WHERE x."TenantId"=t AND x."Status"=1 AND x."Id"=ANY(selected))<>n THEN RAISE EXCEPTION 'PARTNER_INVALID_PARTICIPANTS' USING ERRCODE='22023';END IF;
  payable:=nullif(p->>'payableId','')::uuid;
  IF payable IS NOT NULL AND (NOT ('finance.payables.view'=ANY(perms)) OR NOT EXISTS(SELECT 1 FROM public.accounts_payable x WHERE x."TenantId"=t AND x."BranchId"=b AND x."Id"=payable AND x."Status" IN(2,3,4) AND x."OriginalAmount"*100=amt)) THEN RAISE EXCEPTION 'PARTNER_INVALID_PAYABLE' USING ERRCODE='23514';END IF;
  inv:=gen_random_uuid();INSERT INTO public.partner_investments_v10(tenant_id,id,name,category,amount_cents,invested_on,reference,notes,created_by,payable_id) VALUES(t,inv,nm,cat,amt,d,ref,memo,u,payable);
  INSERT INTO public.partner_investment_shares_v10 SELECT t,inv,x,amt/n+CASE WHEN ord<=amt%n THEN 1 ELSE 0 END FROM unnest(selected) WITH ORDINALITY AS a(x,ord);
  result:=jsonb_build_object('id',inv,'amountCents',amt,'participants',n);
 ELSIF act='PAY' THEN
  mode:=p->>'mode';src:=p->>'source';sid:=nullif(p->>'settlementId','')::uuid;pid:=nullif(p->>'partnerId','')::uuid;inv:=nullif(p->>'investmentId','')::uuid;amt:=(p->>'amountCents')::bigint;d:=(p->>'date')::date;ref:=btrim(coalesce(p->>'reference',''));
  IF mode IS NULL OR mode NOT IN('PERSONAL','COLLECTIVE') OR src IS NULL OR src NOT IN('EXTERNAL','SETTLEMENT') OR amt IS NULL OR amt NOT BETWEEN 1 AND 100000000000 OR d IS NULL OR d>(now() AT TIME ZONE 'America/Sao_Paulo')::date OR length(ref) NOT BETWEEN 3 AND 250 OR p->>'confirmed' IS DISTINCT FROM 'true' OR (mode='PERSONAL')<>(pid IS NOT NULL) OR (src='SETTLEMENT')<>(sid IS NOT NULL) THEN RAISE EXCEPTION 'PARTNER_INVALID_PAYMENT' USING ERRCODE='22023';END IF;
  IF src='SETTLEMENT' THEN IF NOT ('finance.payables.view'=ANY(perms) AND 'finance.settle'=ANY(perms)) OR NOT EXISTS(SELECT 1 FROM public.financial_settlements f JOIN public.accounts_payable a ON a."TenantId"=f."TenantId" AND a."BranchId"=f."BranchId" AND a."Id"=f."AccountPayableId" WHERE f."TenantId"=t AND f."BranchId"=b AND f."Id"=sid AND f."Type"=1 AND f."Amount"*100=amt AND EXISTS(SELECT 1 FROM public.partner_investments_v10 i WHERE i.tenant_id=t AND i.id=inv AND i.payable_id=f."AccountPayableId") AND (f."SettlementDateUtc" AT TIME ZONE 'America/Sao_Paulo')::date=d) THEN RAISE EXCEPTION 'PARTNER_INVALID_SETTLEMENT' USING ERRCODE='23514';END IF;END IF;
  SELECT array_agg(DISTINCT x.partner_id ORDER BY x.partner_id) INTO selected FROM public.partner_investment_balances_v10 x JOIN public.partner_investments_v10 i ON(i.tenant_id,i.id)=(x.tenant_id,x.investment_id) WHERE x.tenant_id=t AND (inv IS NULL OR x.investment_id=inv) AND (pid IS NULL OR x.partner_id=pid) AND i.invested_on<=d AND (src='SETTLEMENT' OR i.payable_id IS NULL);
  n:=coalesce(cardinality(selected),0);IF n=0 THEN RAISE EXCEPTION 'PARTNER_NO_SHARES' USING ERRCODE='23514';END IF;
  allocated:=0;idx:=0;
  FOREACH pid IN ARRAY selected LOOP
   idx:=idx+1;budget:=amt/n+CASE WHEN idx<=amt%n THEN 1 ELSE 0 END;remaining:=budget;
   FOR rowx IN SELECT x.* FROM public.partner_investment_balances_v10 x JOIN public.partner_investments_v10 i ON(i.tenant_id,i.id)=(x.tenant_id,x.investment_id) WHERE x.tenant_id=t AND x.partner_id=pid AND (inv IS NULL OR x.investment_id=inv) AND i.invested_on<=d AND (src='SETTLEMENT' OR i.payable_id IS NULL) AND x.balance_cents>0 ORDER BY i.invested_on,i.created_at,i.id LOOP
    share:=least(remaining,rowx.balance_cents);IF share<=0 THEN EXIT;END IF;lines:=lines||jsonb_build_array(jsonb_build_object('investment',rowx.investment_id,'partner',pid,'amount',share));allocated:=allocated+share;remaining:=remaining-share;
   END LOOP;
  END LOOP;
  IF allocated=0 OR (mode='PERSONAL' AND allocated<>amt) OR (allocated<>amt AND p->>'acceptPartial' IS DISTINCT FROM 'true') THEN RAISE EXCEPTION 'PARTNER_OVERPAYMENT' USING ERRCODE='23514';END IF;
  IF src='SETTLEMENT' AND allocated<>amt THEN RAISE EXCEPTION 'PARTNER_UNALLOCATED_SETTLEMENT' USING ERRCODE='23514';END IF;
  pay:=gen_random_uuid();INSERT INTO public.partner_investment_payments_v10(tenant_id,id,branch_id,mode,source,reference,paid_on,amount_cents,requested_cents,settlement_id,created_by) VALUES(t,pay,b,mode,src,ref,d,allocated,amt,sid,u);
  INSERT INTO public.partner_investment_payment_lines_v10 SELECT t,pay,x.investment,x.partner,x.amount FROM jsonb_to_recordset(lines) x(investment uuid,partner uuid,amount bigint);
  result:=jsonb_build_object('id',pay,'allocatedCents',allocated,'unallocatedCents',amt-allocated);
 ELSIF act='REVERSE' THEN
  pay:=(p->>'paymentId')::uuid;ref:=btrim(coalesce(p->>'reference',''));IF length(ref) NOT BETWEEN 5 AND 250 THEN RAISE EXCEPTION 'PARTNER_INVALID_REVERSAL' USING ERRCODE='22023';END IF;
  SELECT * INTO oldpay FROM public.partner_investment_payments_v10 x WHERE x.tenant_id=t AND x.id=pay AND x.branch_id=b AND x.mode<>'REVERSAL';
  IF NOT FOUND OR oldpay.source='SETTLEMENT' OR EXISTS(SELECT 1 FROM public.partner_investment_payments_v10 x WHERE x.tenant_id=t AND x.reverses_id=pay) THEN RAISE EXCEPTION 'PARTNER_REVERSAL_NOT_ALLOWED' USING ERRCODE='23514';END IF;
  inv:=gen_random_uuid();INSERT INTO public.partner_investment_payments_v10(tenant_id,id,branch_id,mode,source,reference,paid_on,amount_cents,requested_cents,reverses_id,created_by) VALUES(t,inv,b,'REVERSAL','REVERSAL',ref,(now() AT TIME ZONE 'America/Sao_Paulo')::date,oldpay.amount_cents,oldpay.amount_cents,pay,u);
  INSERT INTO public.partner_investment_payment_lines_v10 SELECT t,inv,x.investment_id,x.partner_id,-x.amount_cents FROM public.partner_investment_payment_lines_v10 x WHERE x.tenant_id=t AND x.payment_id=pay;
  result:=jsonb_build_object('id',inv);
 END IF;
 INSERT INTO public.partner_investment_requests_v10 VALUES(t,req,u,b,act,p,result);
 INSERT INTO public.audit_events("Id","TenantId","BranchId","EntityType","EntityId","Action","ActorId","ActorEmail","CorrelationId","AfterStateJson","CreatedAtUtc","Version") VALUES(gen_random_uuid(),t,b,'PartnerInvestment',result->>'id','PartnerInvestment'||act,u,actor_email,req::text,result,now(),1);
 RETURN result;
END $function$;

CREATE OR REPLACE FUNCTION public.partner_monthly_plan_v10(t uuid, b uuid, u uuid, req uuid, p jsonb, save boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE perms text[]; email text; m date; today date:=(now() AT TIME ZONE 'America/Sao_Paulo')::date; cash_res bigint; stock_res bigint; other_res bigint; bank bigint; bank_count int; outstanding bigint; revenue bigint; expense bigint; journals int; bad_journals int; funding bigint; base_total bigint; monthly_total bigint; pool bigint; lines jsonb; snap jsonb; prior public.partner_monthly_closings_v10%ROWTYPE; new_id uuid; eligible boolean;
BEGIN
 SELECT x."Email",ARRAY(SELECT DISTINCT rp."PermissionKey" FROM public.user_roles ur JOIN public.role_permissions rp ON rp."TenantId"=ur."TenantId" AND rp."RoleId"=ur."RoleId" WHERE ur."TenantId"=t AND ur."UserId"=u) INTO email,perms FROM public.users x JOIN public.tenants te ON te."Id"=t AND te."IsActive" JOIN public.branches br ON br."TenantId"=t AND br."Id"=b AND br."IsActive" WHERE x."TenantId"=t AND x."Id"=u AND x."DefaultBranchId"=b AND x."IsActive" AND EXISTS(SELECT 1 FROM public.partners pp WHERE pp."TenantId"=t AND lower(pp."Email")=lower(x."Email") AND pp."Status"=1 AND pp."IsErpAccessEnabled");
 IF NOT FOUND OR NOT (ARRAY['partners.view','partners.capital.manage','partners.compensation.manage','finance.reports.view','finance.journal.view','finance.payables.view','finance.banks.manage']<@perms) OR (save AND NOT ('partners.distribution.approve'=ANY(perms))) THEN RAISE EXCEPTION 'PARTNER_FORBIDDEN' USING ERRCODE='42501';END IF;
 IF (SELECT count(*) FROM public.branches x WHERE x."TenantId"=t AND x."IsActive")<>1 THEN RAISE EXCEPTION 'PARTNER_CONSOLIDATION_REQUIRED' USING ERRCODE='23514';END IF;
 IF jsonb_typeof(p) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'PARTNER_INVALID_PLAN' USING ERRCODE='22023';END IF;
 m:=(p->>'month')::date;cash_res:=(p->>'cashReserveCents')::bigint;stock_res:=(p->>'stockReserveCents')::bigint;other_res:=(p->>'otherReserveCents')::bigint;
 IF m IS NULL OR extract(day from m)<>1 OR m>date_trunc('month',today)::date OR least(cash_res,stock_res,other_res)<0 OR greatest(cash_res,stock_res,other_res)>100000000000 OR cash_res IS NULL OR stock_res IS NULL OR other_res IS NULL THEN RAISE EXCEPTION 'PARTNER_INVALID_PLAN' USING ERRCODE='22023';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('partner-investment-v10:'||t::text,0));
 IF save THEN
  IF req IS NULL OR p->>'confirmed' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'PARTNER_CONFIRM_PLAN' USING ERRCODE='22023';END IF;
  SELECT * INTO prior FROM public.partner_monthly_closings_v10 x WHERE x.tenant_id=t AND x.request_id=req;
  IF FOUND THEN IF (prior.created_by,prior.branch_id,prior.inputs) IS DISTINCT FROM (u,b,p) THEN RAISE EXCEPTION 'PARTNER_IDEMPOTENCY_CONFLICT' USING ERRCODE='23514';END IF;RETURN prior.snapshot||jsonb_build_object('id',prior.id);END IF;
 END IF;
 SELECT count(*)::int,coalesce(round(sum(least("CurrentBalance","ReconciledBalance"))*100),0)::bigint INTO bank_count,bank FROM public.bank_accounts WHERE "TenantId"=t AND "BranchId"=b AND "IsActive";
 SELECT coalesce(round(sum(greatest(0,"OriginalAmount"-"PaidAmount"))*100),0)::bigint INTO outstanding FROM public.accounts_payable WHERE "TenantId"=t AND "BranchId"=b AND "Status" IN(2,3);
 SELECT count(*)::int,count(*) FILTER(WHERE cnt<2 OR debit<>credit OR debit<>total)::int,coalesce(round(sum(rev)*100),0)::bigint,coalesce(round(sum(exp)*100),0)::bigint INTO journals,bad_journals,revenue,expense FROM (
 SELECT e."Id",e."TotalAmount" total,count(l."Id") cnt,coalesce(sum(l."Amount") FILTER(WHERE l."Direction"=1),0) debit,coalesce(sum(l."Amount") FILTER(WHERE l."Direction"=2),0) credit,coalesce(sum(CASE WHEN a."Type"=4 THEN CASE l."Direction" WHEN 2 THEN l."Amount" ELSE -l."Amount" END ELSE 0 END),0) rev,coalesce(sum(CASE WHEN a."Type"=5 THEN CASE l."Direction" WHEN 1 THEN l."Amount" ELSE -l."Amount" END ELSE 0 END),0) exp FROM public.financial_journal_entries e LEFT JOIN public.financial_journal_lines l ON l."TenantId"=e."TenantId" AND l."FinancialJournalEntryId"=e."Id" LEFT JOIN public.financial_accounts a ON a."TenantId"=e."TenantId" AND a."Id"=l."FinancialAccountId" WHERE e."TenantId"=t AND e."BranchId"=b AND e."CompetenceDateUtc">=(m::timestamp AT TIME ZONE 'America/Sao_Paulo') AND e."CompetenceDateUtc"<((m+interval '1 month')::timestamp AT TIME ZONE 'America/Sao_Paulo') GROUP BY e."Id") j;
 SELECT coalesce(sum(base_cents),0)::bigint,coalesce(sum(monthly_cents),0)::bigint INTO base_total,monthly_total FROM public.partner_monthly_funding_v10 WHERE tenant_id=t AND status=1;
 funding:=greatest(0,bank-outstanding-cash_res-stock_res-other_res);
 pool:=greatest(0,least(funding-base_total,revenue-expense));
 eligible:=bank_count>0 AND journals>0 AND bad_journals=0 AND m<date_trunc('month',today)::date AND pool>=monthly_total AND funding>=base_total AND monthly_total+base_total>0;
 SELECT coalesce(jsonb_agg(jsonb_build_object('partnerId',partner_id,'name',name,'balanceCents',balance_cents,'baseCents',base_cents,'monthlyCents',monthly_cents,'amortizeCents',CASE WHEN eligible THEN planned_cents ELSE 0 END,'releaseCents',CASE WHEN eligible THEN released_cents ELSE 0 END,'potentialCents',CASE WHEN eligible THEN base_cents+released_cents ELSE 0 END) ORDER BY name,partner_id),'[]'::jsonb) INTO lines FROM public.partner_monthly_funding_v10 WHERE tenant_id=t AND status=1;
 snap:=jsonb_build_object('month',m,'bankCents',bank,'bankCount',bank_count,'payablesCents',outstanding,'revenueCents',revenue,'expenseCents',expense,'resultCents',revenue-expense,'journalCount',journals,'unbalancedCount',bad_journals,'cashReserveCents',cash_res,'stockReserveCents',stock_res,'otherReserveCents',other_res,'availableCents',funding,'baseCents',base_total,'monthlyCents',monthly_total,'poolCents',pool,'eligible',eligible,'lines',lines,'snapshotAt',now(),'kind','PLANNING_ONLY');
 IF save THEN
  IF p->'expected' IS DISTINCT FROM (snap-'snapshotAt') THEN RAISE EXCEPTION 'PARTNER_PLAN_CHANGED' USING ERRCODE='23514';END IF;
  IF NOT eligible OR length(btrim(coalesce(p->>'reference','')))<5 OR length(btrim(coalesce(p->>'reference','')))>250 THEN RAISE EXCEPTION 'PARTNER_PLAN_NOT_APPROVABLE' USING ERRCODE='23514';END IF;
  new_id:=gen_random_uuid();
  INSERT INTO public.partner_monthly_closings_v10(tenant_id,id,branch_id,month,request_id,created_by,inputs,snapshot) VALUES(t,new_id,b,m,req,u,p,snap);
  INSERT INTO public.audit_events("Id","TenantId","BranchId","EntityType","EntityId","Action","ActorId","ActorEmail","CorrelationId","AfterStateJson","CreatedAtUtc","Version") VALUES(gen_random_uuid(),t,b,'PartnerMonthlyPlan',new_id::text,'PartnerMonthlyPlanApproved',u,email,req::text,snap,now(),1);
  RETURN snap||jsonb_build_object('id',new_id);
 END IF;
 RETURN snap;
END $function$;

INSERT INTO public.partner_user_links_v10(tenant_id,partner_id,user_id)
 SELECT p."TenantId",p."Id",u."Id" FROM public.partners p JOIN public.users u ON u."TenantId"=p."TenantId" AND lower(u."Email")=lower(p."Email")
 WHERE p."Email"<>'' AND (SELECT count(*) FROM public.partners x WHERE x."TenantId"=p."TenantId" AND lower(x."Email")=lower(p."Email"))=1 AND (SELECT count(*) FROM public.users x WHERE x."TenantId"=u."TenantId" AND lower(x."Email")=lower(u."Email"))=1 ON CONFLICT DO NOTHING;
INSERT INTO public.parties("Id","TenantId","Type","Name","DocumentNumber","IsActive","CreatedAtUtc")
 SELECT p."PartyId",p."TenantId",CASE WHEN length(regexp_replace(p."DocumentNumber",'[^0-9]','','g'))=11 THEN 1 ELSE 2 END,p."Name",regexp_replace(p."DocumentNumber",'[^0-9]','','g'),true,now()
 FROM public.partners p WHERE length(regexp_replace(p."DocumentNumber",'[^0-9]','','g')) IN(11,14)
 AND NOT EXISTS(SELECT 1 FROM public.parties x WHERE x."Id"=p."PartyId" OR (x."TenantId"=p."TenantId" AND regexp_replace(coalesce(x."DocumentNumber",''),'[^0-9]','','g')=regexp_replace(p."DocumentNumber",'[^0-9]','','g')))
 AND (SELECT count(*) FROM public.partners z WHERE z."PartyId"=p."PartyId")=1
 AND (SELECT count(*) FROM public.partners z WHERE z."TenantId"=p."TenantId" AND regexp_replace(z."DocumentNumber",'[^0-9]','','g')=regexp_replace(p."DocumentNumber",'[^0-9]','','g'))=1
 ON CONFLICT DO NOTHING;

DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='fk_partner_payment_branch_v10' AND conrelid='public.partner_investment_payments_v10'::regclass) THEN ALTER TABLE public.partner_investment_payments_v10 ADD CONSTRAINT fk_partner_payment_branch_v10 FOREIGN KEY(tenant_id,branch_id) REFERENCES public.branches("TenantId","Id") ON DELETE RESTRICT; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='fk_partner_monthly_branch_v10' AND conrelid='public.partner_monthly_closings_v10'::regclass) THEN ALTER TABLE public.partner_monthly_closings_v10 ADD CONSTRAINT fk_partner_monthly_branch_v10 FOREIGN KEY(tenant_id,branch_id) REFERENCES public.branches("TenantId","Id") ON DELETE RESTRICT; END IF;
END $$;
COMMIT;
