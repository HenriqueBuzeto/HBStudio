import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import {
  CrmApiError, requireCrmSession, requireUuid, requireString, optionalString,
  requireValue, optionalDate, type CrmSession,
} from "@/lib/crm-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function guardedId(value: string): string { return requireUuid(value, "Identificador"); }
function checkedPriority(value: unknown): number {
  const n = Number(value ?? 2);
  if (![1,2,3,4].includes(n)) throw new CrmApiError(400,"VALIDATION_ERROR","Prioridade inválida.");
  return n;
}
function json(request: unknown, status = 200) { return NextResponse.json(request, { status, headers: { "Cache-Control": "no-store" } }); }
function normalizeRows(rows: any[]) { return rows.map(r => ({ ...r, version: String(r.version) })); }
function ensureMutationOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const site = req.headers.get("sec-fetch-site");
  if (site === "cross-site" || !origin || !host) throw new CrmApiError(403,"CSRF_BLOCKED","Origem da requisição não autorizada.");
  let originHost: string;
  try { originHost = new URL(origin).host; } catch { throw new CrmApiError(403,"CSRF_BLOCKED","Origem inválida."); }
  if (originHost.toLowerCase() !== host.toLowerCase()) throw new CrmApiError(403,"CSRF_BLOCKED","Origem não autorizada.");
}
async function safeBody(request: NextRequest): Promise<Record<string, unknown>> {
  const length = Number(request.headers.get("content-length") || "0");
  if (length > 20000) throw new CrmApiError(413,"PAYLOAD_TOO_LARGE","Requisição muito grande.");
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new CrmApiError(400,"VALIDATION_ERROR","JSON inválido.");
  return body as Record<string, unknown>;
}
function fail(error: unknown, requestId: string) {
  if (error instanceof CrmApiError)
    return NextResponse.json({ code: error.code, error: error.message }, { status: error.status, headers: {"X-Correlation-Id": requestId, "Cache-Control":"no-store"} });
  console.error("[CRM][" + requestId + "] Falha no serviço:", error instanceof Error ? error.message : "unknown");
  return NextResponse.json({ code:"CRM_DATABASE_ERROR", error:"Falha ao processar dados do CRM. Nenhuma alteração foi confirmada." }, { status:503, headers: {"X-Correlation-Id":requestId, "Cache-Control":"no-store"} });
}

async function board(ctx: CrmSession) {
  const {db,tenantId,branchId}=ctx;
  const [pipelines,stages,opps] = await Promise.all([
    db.query('SELECT "Id"::text AS id,"Name" AS name,"PipelineType" AS type FROM crm_pipelines WHERE "TenantId"=$1::uuid AND "IsActive"=true ORDER BY "CreatedAtUtc" ASC',[tenantId]),
    db.query('SELECT s."Id"::text AS id,s."PipelineId"::text AS "pipelineId",s."Name" AS name,s."OrderIndex" AS "orderIndex",s."IsWonStage" AS "isWonStage",s."IsLostStage" AS "isLostStage" FROM crm_pipeline_stages s JOIN crm_pipelines p ON p."Id"=s."PipelineId" AND p."TenantId"=s."TenantId" WHERE s."TenantId"=$1::uuid AND p."IsActive"=true ORDER BY s."OrderIndex" ASC',[tenantId]),
    db.query('SELECT o."Id"::text AS id,o."PipelineId"::text AS "pipelineId",o."StageId"::text AS "stageId",o."PartyId"::text AS "partyId",o."LeadId"::text AS "leadId",o."AssignedSellerUserId"::text AS "assignedUserId",o."Title" AS title,o."Description" AS description,o."Origin" AS origin,o."EstimatedValue"::float8 AS value,o."ExpectedClosingDate" AS "expectedClosingDate",o."Priority" AS priority,o."Status" AS status,o."LossReason" AS "lossReason",o."CreatedAtUtc" AS "createdAt",o."UpdatedAtUtc" AS "updatedAt",o.xmin::text AS version, COALESCE(pa."Name",le."Name") AS "contactName",u."FullName" AS "assignedName", (SELECT count(*)::int FROM crm_opportunity_activities a WHERE a."OpportunityId"=o."Id" AND a."TenantId"=o."TenantId" AND a."BranchId"=o."BranchId" AND a."Status"=1) AS "pendingActivities" FROM crm_opportunities o JOIN crm_pipelines p ON p."Id"=o."PipelineId" AND p."TenantId"=o."TenantId" AND p."IsActive"=true LEFT JOIN parties pa ON pa."Id"=o."PartyId" AND pa."TenantId"=o."TenantId" LEFT JOIN crm_leads le ON le."Id"=o."LeadId" AND le."TenantId"=o."TenantId" AND le."BranchId"=o."BranchId" LEFT JOIN users u ON u."Id"=o."AssignedSellerUserId" AND u."TenantId"=o."TenantId" WHERE o."TenantId"=$1::uuid AND o."BranchId"=$2::uuid ORDER BY o."CreatedAtUtc" DESC LIMIT 1000',[tenantId,branchId])
  ]);
  return { pipelines,stages,opportunities:normalizeRows(opps) };
}
async function contacts(ctx: CrmSession) {
  const [leads,parties,users]=await Promise.all([
    ctx.db.query('SELECT "Id"::text AS id,"Name" AS name,"Phone" AS phone,"Email" AS email,"Source" AS source,"MainInterest" AS interest,"Status" AS status FROM crm_leads WHERE "TenantId"=$1::uuid AND "BranchId"=$2::uuid ORDER BY "CreatedAtUtc" DESC LIMIT 500',[ctx.tenantId,ctx.branchId]),
    ctx.db.query('SELECT "Id"::text AS id,"Name" AS name,"DocumentNumber" AS document FROM parties WHERE "TenantId"=$1::uuid AND "IsActive"=true ORDER BY "Name" LIMIT 500',[ctx.tenantId]),
    ctx.db.query('SELECT "Id"::text AS id,"FullName" AS name FROM users WHERE "TenantId"=$1::uuid AND "IsActive"=true ORDER BY "FullName"',[ctx.tenantId])
  ]);
  return {leads,parties,users};
}
async function activities(ctx:CrmSession, opportunityId:string) {
  const rows=await ctx.db.query('SELECT a."Id"::text AS id,a."Title" AS title,a."Description" AS description,a."ActivityType" AS type,a."Status" AS status,a."ScheduledForUtc" AS "scheduledFor",a."CompletedAtUtc" AS "completedAt",a."CompletionNotes" AS "completionNotes",a."CreatedAtUtc" AS "createdAt",a.xmin::text AS version FROM crm_opportunity_activities a JOIN crm_opportunities o ON o."Id"=a."OpportunityId" AND o."TenantId"=a."TenantId" AND o."BranchId"=a."BranchId" WHERE o."TenantId"=$1::uuid AND o."BranchId"=$2::uuid AND o."Id"=$3::uuid ORDER BY a."CreatedAtUtc" DESC',[ctx.tenantId,ctx.branchId,opportunityId]);
  return normalizeRows(rows);
}
async function history(ctx:CrmSession, opportunityId:string) {
  return await ctx.db.query('SELECT a."Id"::text AS id,a."Action" AS action,a."ActorEmail" AS actor,a."BeforeStateJson" AS before,a."AfterStateJson" AS after,a."CreatedAtUtc" AS "createdAt" FROM audit_events a WHERE a."TenantId"=$1::uuid AND a."BranchId"=$2::uuid AND a."EntityType"=\'CrmOpportunity\' AND a."EntityId"=$3 ORDER BY a."CreatedAtUtc" DESC LIMIT 100',[ctx.tenantId,ctx.branchId,opportunityId]);
}
function defaultStages(): Array<{name:string;orderIndex:number;won:boolean;lost:boolean}> {
  return [
    {name:"Prospecção",orderIndex:1,won:false,lost:false},
    {name:"Qualificação",orderIndex:2,won:false,lost:false},
    {name:"Proposta enviada",orderIndex:3,won:false,lost:false},
    {name:"Negociação",orderIndex:4,won:false,lost:false},
    {name:"Ganho",orderIndex:5,won:true,lost:false},
    {name:"Perdido",orderIndex:6,won:false,lost:true},
  ];
}
async function createPipeline(ctx:CrmSession, body:Record<string,unknown>, correlationId:string) {
  const name=requireString(body.name,"Nome do funil",120);
  const rawStages=body.stages;
  const stages=Array.isArray(rawStages) && rawStages.length>0 ? rawStages.map((x,i) => ({
    name:requireString(x?.name,"Nome da etapa",80),orderIndex:i+1,won:x?.won===true,lost:x?.lost===true
  })) : defaultStages();
  if(stages.length<2||stages.length>15||stages.filter(x=>x.won).length!==1||stages.filter(x=>x.lost).length!==1||stages.some(x=>x.won&&x.lost))
    throw new CrmApiError(400,"VALIDATION_ERROR","O funil exige de 2 a 15 etapas, uma ganha e uma perdida.");
  const rows=await ctx.db.query(
    'WITH p AS (INSERT INTO crm_pipelines ("Id","TenantId","Name","PipelineType","IsActive","CreatedAtUtc") VALUES(gen_random_uuid(),$1::uuid,$2,5,true,now()) RETURNING "Id","TenantId"),' +
    ' s AS (INSERT INTO crm_pipeline_stages ("Id","TenantId","PipelineId","Name","OrderIndex","IsWonStage","IsLostStage","CreatedAtUtc") SELECT gen_random_uuid(),p."TenantId",p."Id",x.name,x.ord,x.won,x.lost,now() FROM p CROSS JOIN jsonb_to_recordset($3::jsonb) AS x(name text,ord integer,won boolean,lost boolean) RETURNING "Id"),' +
    ' a AS (INSERT INTO audit_events ("Id","TenantId","BranchId","EntityType","EntityId","Action","ActorId","ActorEmail","CorrelationId","AfterStateJson","CreatedAtUtc","Version") SELECT gen_random_uuid(),$1::uuid,$4::uuid,\'CrmPipeline\',p."Id"::text,\'Created\',$5::uuid,$6,$7,jsonb_build_object(\'name\',$2),now(),1 FROM p RETURNING "Id")' +
    ' SELECT p."Id"::text AS id,(SELECT count(*) FROM s) AS stages_created,(SELECT count(*) FROM a) AS audit_count FROM p',
    [ctx.tenantId,name,JSON.stringify(stages.map(s=>({name:s.name,ord:s.orderIndex,won:s.won,lost:s.lost}))),ctx.branchId,ctx.userId,ctx.actorEmail,correlationId]
  );
  return rows[0];
}
async function createLead(ctx:CrmSession, body:Record<string,unknown>, correlationId:string) {
  const name=requireString(body.name,"Nome do lead",180);
  const phone=optionalString(body.phone,40),email=optionalString(body.email,200),source=optionalString(body.source,100)||"Cadastro CRM",interest=optionalString(body.interest,300);
  const rows=await ctx.db.query(
    'WITH l AS (INSERT INTO crm_leads ("Id","TenantId","BranchId","Name","Phone","Email","Source","MainInterest","Status","CreatedAtUtc") VALUES(gen_random_uuid(),$1::uuid,$2::uuid,$3,$4,$5,$6,$7,1,now()) RETURNING "Id","Name"),' +
    ' a AS (INSERT INTO audit_events ("Id","TenantId","BranchId","EntityType","EntityId","Action","ActorId","ActorEmail","CorrelationId","AfterStateJson","CreatedAtUtc","Version") SELECT gen_random_uuid(),$1::uuid,$2::uuid,\'CrmLead\',l."Id"::text,\'Created\',$8::uuid,$9,$10,jsonb_build_object(\'name\',$3),now(),1 FROM l RETURNING "Id")' +
    ' SELECT l."Id"::text AS id,l."Name" AS name FROM l CROSS JOIN a',
    [ctx.tenantId,ctx.branchId,name,phone,email,source,interest,ctx.userId,ctx.actorEmail,correlationId]
  );
  return rows[0];
}
async function createOpportunity(ctx:CrmSession, body:Record<string,unknown>, correlationId:string) {
  const pipelineId=requireUuid(body.pipelineId,"Funil"), stageId=requireUuid(body.stageId,"Etapa");
  const partyId=body.partyId ? requireUuid(body.partyId,"Cliente"):null;
  const leadId=body.leadId ? requireUuid(body.leadId,"Lead"):null;
  if((partyId?1:0)+(leadId?1:0)!==1) throw new CrmApiError(400,"VALIDATION_ERROR","Selecione um cliente ou um lead.");
  const title=requireString(body.title,"Título da oportunidade",200);
  const value=requireValue(body.value);
  const priority=checkedPriority(body.priority);
  const description=optionalString(body.description);
  const origin=optionalString(body.origin,100)||"CRM";
  const due=optionalDate(body.expectedClosingDate);
  const assignedUserId=body.assignedUserId?requireUuid(body.assignedUserId,"Responsável"):ctx.userId;
  const rows=await ctx.db.query(
    'WITH o AS (INSERT INTO crm_opportunities ("Id","TenantId","BranchId","PartyId","LeadId","PipelineId","StageId","AssignedSellerUserId","Title","Description","Origin","EstimatedValue","ExpectedClosingDate","Priority","Status","CreatedAtUtc")' +
    ' SELECT gen_random_uuid(),$1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,$6::uuid,$7::uuid,$8,$9,$10,$11::numeric,$12::timestamptz,$13::int,1,now()' +
    ' WHERE EXISTS(SELECT 1 FROM crm_pipeline_stages s JOIN crm_pipelines p ON p."Id"=s."PipelineId" AND p."TenantId"=s."TenantId" WHERE s."Id"=$6::uuid AND s."PipelineId"=$5::uuid AND s."TenantId"=$1::uuid AND NOT s."IsWonStage" AND NOT s."IsLostStage" AND p."IsActive"=true)' +
    ' AND ($3::uuid IS NULL OR EXISTS(SELECT 1 FROM parties pa WHERE pa."Id"=$3::uuid AND pa."TenantId"=$1::uuid AND pa."IsActive"=true))' +
    ' AND ($4::uuid IS NULL OR EXISTS(SELECT 1 FROM crm_leads le WHERE le."Id"=$4::uuid AND le."TenantId"=$1::uuid AND le."BranchId"=$2::uuid))' +
    ' AND EXISTS(SELECT 1 FROM users u WHERE u."Id"=$7::uuid AND u."TenantId"=$1::uuid AND u."IsActive"=true) RETURNING "Id","Title"),' +
    ' a AS (INSERT INTO audit_events ("Id","TenantId","BranchId","EntityType","EntityId","Action","ActorId","ActorEmail","CorrelationId","AfterStateJson","CreatedAtUtc","Version") SELECT gen_random_uuid(),$1::uuid,$2::uuid,\'CrmOpportunity\',o."Id"::text,\'Created\',$14::uuid,$15,$16,jsonb_build_object(\'title\',o."Title",\'stageId\',$6,\'value\',$11),now(),1 FROM o RETURNING "Id")' +
    ' SELECT o."Id"::text AS id FROM o CROSS JOIN a',
    [ctx.tenantId,ctx.branchId,partyId,leadId,pipelineId,stageId,assignedUserId,title,description,origin,value,due,priority,ctx.userId,ctx.actorEmail,correlationId]
  );
  if(!rows.length)throw new CrmApiError(409,"CRM_REFERENCE_INVALID","Funil, etapa, responsável ou contato inválido. Atualize a página.");
  return rows[0];
}
async function updateOpportunity(ctx:CrmSession, id:string, body:Record<string,unknown>, correlationId:string) {
  const action=String(body.action||"");
  const version=requireString(body.expectedVersion,"Versão",32);
  if(!/^\d+$/.test(version))throw new CrmApiError(400,"VALIDATION_ERROR","Versão inválida.");
  let sql="";
  let values:unknown[]=[];
  let auditAction="";
  if(action==="move"){
    const stageId=requireUuid(body.stageId,"Nova etapa");
    const lossReason=optionalString(body.lossReason,400);
    sql='UPDATE crm_opportunities o SET "StageId"=$4::uuid,"Status"=CASE WHEN s."IsWonStage" THEN 2 WHEN s."IsLostStage" THEN 3 ELSE 1 END,"ClosedAtUtc"=CASE WHEN s."IsWonStage" OR s."IsLostStage" THEN now() ELSE NULL END,"LossReason"=CASE WHEN s."IsLostStage" THEN $5 ELSE NULL END,"UpdatedAtUtc"=now() FROM crm_pipeline_stages s WHERE o."Id"=$3::uuid AND o."TenantId"=$1::uuid AND o."BranchId"=$2::uuid AND o."Status"=1 AND o.xmin::text=$6 AND s."Id"=$4::uuid AND s."PipelineId"=o."PipelineId" AND s."TenantId"=o."TenantId" AND (NOT s."IsLostStage" OR NULLIF(btrim($5),\'\') IS NOT NULL) RETURNING o."Id",o."StageId",o."Status"';
    values=[ctx.tenantId,ctx.branchId,id,stageId,lossReason,version];auditAction="StageChanged";
  }else if(action==="edit"){
    const title=requireString(body.title,"Título",200);
    const value=requireValue(body.value);
    const priority=checkedPriority(body.priority);
    const description=optionalString(body.description);
    const due=optionalDate(body.expectedClosingDate);
    const assignedId=body.assignedUserId?requireUuid(body.assignedUserId,"Responsável"):ctx.userId;
    sql='UPDATE crm_opportunities o SET "Title"=$4,"EstimatedValue"=$5::numeric,"Priority"=$6,"Description"=$7,"ExpectedClosingDate"=$8::timestamptz,"AssignedSellerUserId"=$9::uuid,"UpdatedAtUtc"=now() WHERE o."Id"=$3::uuid AND o."TenantId"=$1::uuid AND o."BranchId"=$2::uuid AND o."Status"=1 AND o.xmin::text=$10 AND EXISTS(SELECT 1 FROM users u WHERE u."Id"=$9::uuid AND u."TenantId"=o."TenantId" AND u."IsActive"=true) RETURNING o."Id",o."StageId",o."Status"';
    values=[ctx.tenantId,ctx.branchId,id,title,value,priority,description,due,assignedId,version];auditAction="Updated";
  }else if(action==="reopen" || action==="archive"){
    const reason=requireString(body.reason,"Justificativa",400);
    sql='UPDATE crm_opportunities o SET "Status"=$4::int,"ClosedAtUtc"=CASE WHEN $4::int=1 THEN NULL ELSE now() END,"LossReason"=CASE WHEN $4::int=1 THEN NULL ELSE $5 END,"UpdatedAtUtc"=now() WHERE o."Id"=$3::uuid AND o."TenantId"=$1::uuid AND o."BranchId"=$2::uuid AND o.xmin::text=$6 AND '+(action==="reopen"?'o."Status"<>1':'o."Status"=1')+' RETURNING o."Id",o."StageId",o."Status"';
    values=[ctx.tenantId,ctx.branchId,id,action==="reopen"?1:4,reason,version];auditAction=action==="reopen"?"Reopened":"Archived";
  }else throw new CrmApiError(400,"VALIDATION_ERROR","Ação inválida.");

  // A escrita e o evento de auditoria executam na MESMA instrução PostgreSQL.
  const params=values.length;
  const rows=await ctx.db.query(
    'WITH updated AS ('+sql+'),' +
    ' audit AS (INSERT INTO audit_events ("Id","TenantId","BranchId","EntityType","EntityId","Action","ActorId","ActorEmail","CorrelationId","AfterStateJson","CreatedAtUtc","Version") SELECT gen_random_uuid(),$1::uuid,$2::uuid,\'CrmOpportunity\',updated."Id"::text,$'+(params+1)+',$'+(params+2)+'::uuid,$'+(params+3)+',$'+(params+4)+',jsonb_build_object(\'stageId\',updated."StageId",\'status\',updated."Status"),now(),1 FROM updated RETURNING "Id")' +
    ' SELECT updated."Id"::text AS id, updated."Status" AS status FROM updated CROSS JOIN audit',
    [...values,auditAction,ctx.userId,ctx.actorEmail,correlationId]
  );
  if(!rows.length)throw new CrmApiError(409,"CRM_CONFLICT","Registro alterado por outro usuário ou operação não permitida. Recarregue o Kanban.");
  return rows[0];
}
async function createActivity(ctx:CrmSession, opportunityId:string, body:Record<string,unknown>, correlationId:string) {
  const title=requireString(body.title,"Atividade",180);
  const desc=optionalString(body.description,1000);
  const date=optionalDate(body.scheduledFor);
  if(!date)throw new CrmApiError(400,"VALIDATION_ERROR","Informe a data da atividade.");
  const type=Number(body.type??8);
  if(!Number.isInteger(type)||type<1||type>8)throw new CrmApiError(400,"VALIDATION_ERROR","Tipo inválido.");
  const rows=await ctx.db.query(
    'WITH a AS (INSERT INTO crm_opportunity_activities ("Id","TenantId","BranchId","OpportunityId","ActivityType","Title","Description","ScheduledForUtc","AssignedUserId","Priority","Status","CreatedAtUtc") SELECT gen_random_uuid(),$1::uuid,$2::uuid,o."Id",$4::int,$5,$6,$7::timestamptz,$8::uuid,2,1,now() FROM crm_opportunities o WHERE o."Id"=$3::uuid AND o."TenantId"=$1::uuid AND o."BranchId"=$2::uuid AND o."Status"=1 RETURNING "Id","OpportunityId"),' +
    ' log AS (INSERT INTO audit_events ("Id","TenantId","BranchId","EntityType","EntityId","Action","ActorId","ActorEmail","CorrelationId","AfterStateJson","CreatedAtUtc","Version") SELECT gen_random_uuid(),$1::uuid,$2::uuid,\'CrmOpportunity\',a."OpportunityId"::text,\'ActivityCreated\',$9::uuid,$10,$11,jsonb_build_object(\'activityId\',a."Id",\'title\',$5),now(),1 FROM a RETURNING "Id") SELECT a."Id"::text AS id FROM a CROSS JOIN log',
    [ctx.tenantId,ctx.branchId,opportunityId,type,title,desc,date,ctx.userId,ctx.userId,ctx.actorEmail,correlationId]
  );
  if(!rows.length)throw new CrmApiError(409,"CRM_CONFLICT","Oportunidade indisponível ou encerrada.");
  return rows[0];
}
async function completeActivity(ctx:CrmSession, id:string, body:Record<string,unknown>, correlationId:string) {
  const version=requireString(body.expectedVersion,"Versão",32);
  if(!/^\d+$/.test(version))throw new CrmApiError(400,"VALIDATION_ERROR","Versão inválida.");
  const notes=optionalString(body.notes,800);
  const rows=await ctx.db.query(
    'WITH done AS (UPDATE crm_opportunity_activities a SET "Status"=3,"CompletedAtUtc"=now(),"CompletionNotes"=$5,"UpdatedAtUtc"=now() FROM crm_opportunities o WHERE a."Id"=$3::uuid AND a."OpportunityId"=o."Id" AND a."TenantId"=$1::uuid AND a."BranchId"=$2::uuid AND o."TenantId"=$1::uuid AND o."BranchId"=$2::uuid AND a."Status" IN (1,2) AND a.xmin::text=$4 RETURNING a."Id",a."OpportunityId"),' +
    ' log AS (INSERT INTO audit_events ("Id","TenantId","BranchId","EntityType","EntityId","Action","ActorId","ActorEmail","CorrelationId","AfterStateJson","CreatedAtUtc","Version") SELECT gen_random_uuid(),$1::uuid,$2::uuid,\'CrmOpportunity\',done."OpportunityId"::text,\'ActivityCompleted\',$6::uuid,$7,$8,jsonb_build_object(\'activityId\',done."Id"),now(),1 FROM done RETURNING "Id") SELECT done."Id"::text AS id FROM done CROSS JOIN log',
    [ctx.tenantId,ctx.branchId,id,version,notes,ctx.userId,ctx.actorEmail,correlationId]
  );
  if(!rows.length)throw new CrmApiError(409,"CRM_CONFLICT","Atividade já foi concluída ou alterada por outro usuário.");
  return rows[0];
}

async function handle(request:NextRequest, segments:string[],method:"GET"|"POST"|"PATCH") {
  const correlationId=request.headers.get("x-correlation-id") || crypto.randomUUID();
  try {
    if(method!=="GET")ensureMutationOrigin(request);
    const permission=method==="GET"?"crm.view":"crm.manage";
    const ctx=await requireCrmSession(request,permission);
    let result:unknown;
    let status=200;
    if(method==="GET") {
      if(segments.length===1 && segments[0]==="board")result=await board(ctx);
      else if(segments.length===1 && segments[0]==="contacts")result=await contacts(ctx);
      else if(segments.length===1 && segments[0]==="leads")result=(await contacts(ctx)).leads;
      else if(segments.length===3 && segments[0]==="opportunities" && idPattern.test(segments[1]) && segments[2]==="activities")result=await activities(ctx,guardedId(segments[1]));
      else if(segments.length===3 && segments[0]==="opportunities" && idPattern.test(segments[1]) && segments[2]==="history")result=await history(ctx,guardedId(segments[1]));
      else throw new CrmApiError(404,"NOT_FOUND","Recurso CRM não encontrado.");
    }else {
      const body=await safeBody(request);
      if(method==="POST") {
        if(segments.length===1 && segments[0]==="pipelines")result=await createPipeline(ctx,body,correlationId);
        else if(segments.length===1 && segments[0]==="leads")result=await createLead(ctx,body,correlationId);
        else if(segments.length===1 && segments[0]==="opportunities")result=await createOpportunity(ctx,body,correlationId);
        else if(segments.length===3 && segments[0]==="opportunities" && idPattern.test(segments[1]) && segments[2]==="activities")result=await createActivity(ctx,guardedId(segments[1]),body,correlationId);
        else throw new CrmApiError(404,"NOT_FOUND","Recurso CRM não encontrado.");
        status=201;
      } else if(method==="PATCH") {
        if(segments.length===2 && segments[0]==="opportunities" && idPattern.test(segments[1]))result=await updateOpportunity(ctx,guardedId(segments[1]),body,correlationId);
        else if(segments.length===2 && segments[0]==="activities" && idPattern.test(segments[1]))result=await completeActivity(ctx,guardedId(segments[1]),body,correlationId);
        else throw new CrmApiError(404,"NOT_FOUND","Recurso CRM não encontrado.");
      }
    }
    const response=json(result,status);
    response.headers.set("X-Correlation-Id",correlationId);
    return response;
  }catch(error){return fail(error,correlationId);}
}
type RouteContext={params:Promise<{path:string[]}>};
export async function GET(request:NextRequest,ctx:RouteContext){return handle(request,(await ctx.params).path,"GET");}
export async function POST(request:NextRequest,ctx:RouteContext){return handle(request,(await ctx.params).path,"POST");}
export async function PATCH(request:NextRequest,ctx:RouteContext){return handle(request,(await ctx.params).path,"PATCH");}
