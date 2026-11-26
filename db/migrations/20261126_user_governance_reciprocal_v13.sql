-- v13: reciprocal compensation conflict checks and final-state deferred position validation.
CREATE OR REPLACE FUNCTION public.validate_work_position_v12() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$ BEGIN IF NOT EXISTS(SELECT 1 FROM public.user_work_profiles_v11 w JOIN public.users u ON u."TenantId"=w.tenant_id AND u."Id"=w.user_id JOIN public.organization_positions_v11 p ON p.tenant_id=w.tenant_id AND p.id=w.position_id WHERE w.tenant_id=NEW.tenant_id AND w.user_id=NEW.user_id AND u."JobTitle"=p.name AND p.active) THEN RAISE EXCEPTION 'GOV_POSITION_MISMATCH' USING ERRCODE='23514';END IF;RETURN NEW;END $$;

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
  IF length(nm) NOT BETWEEN 2 AND 200 OR length(doc) NOT IN(11,14) OR typ IS NULL OR typ NOT BETWEEN 1 AND 4 OR least(cap,base,monthly)<0 OR greatest(cap,base,monthly)>100000000000 OR length(memo)>1000 THEN RAISE EXCEPTION 'PARTNER_INVALID_PROFILE' USING ERRCODE='22023';END IF;
  IF pid IS NOT NULL THEN SELECT * INTO oldp FROM public.partners x WHERE x."TenantId"=t AND x."Id"=pid FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'PARTNER_NOT_FOUND' USING ERRCODE='22023';END IF;END IF;
  IF pid IS NOT NULL THEN
    SELECT x.user_id INTO existing_uid FROM public.partner_user_links_v10 x WHERE x.tenant_id=t AND x.partner_id=pid;
    IF existing_uid IS NOT NULL AND uid IS NULL THEN SELECT lower(x."Email") INTO em FROM public.users x WHERE x."TenantId"=t AND x."Id"=existing_uid; END IF;
    SELECT x.base_cents,x.monthly_cents INTO old_base,old_monthly FROM public.partner_investment_profiles_v10 x WHERE x.tenant_id=t AND x.partner_id=pid;
    IF p ?| ARRAY['baseCents','capCents','monthlyCents'] THEN
     IF jsonb_typeof(p->'expectedComp') IS DISTINCT FROM 'object' OR ((p->'expectedComp')->>'baseCents')::bigint IS DISTINCT FROM old_base OR ((p->'expectedComp')->>'capCents')::bigint IS DISTINCT FROM (oldp."MonthlyCompensationCap"*100)::bigint OR ((p->'expectedComp')->>'monthlyCents')::bigint IS DISTINCT FROM old_monthly THEN RAISE EXCEPTION 'PARTNER_COMP_CONFLICT' USING ERRCODE='23514';END IF;
    END IF;
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
  IF p ?| ARRAY['baseCents','monthlyCents'] THEN INSERT INTO public.partner_investment_profiles_v10 VALUES(t,pid,base,monthly) ON CONFLICT(tenant_id,partner_id) DO UPDATE SET base_cents=excluded.base_cents,monthly_cents=excluded.monthly_cents;END IF;
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
