"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import RootShellLayout from "@/components/RootShellLayout";
import {formatPhoneBr,maskPhoneInput,normalizePhoneBr} from "@/lib/br-format";
import { useAuth } from "@/lib/auth";
import {
  Plus, Search, RefreshCw, Target, TrendingUp, Users, CalendarClock,
  X, Check, AlertCircle, ArrowRight, Clock, UserRound, Pencil,
  History, CalendarDays, ChevronDown, GripVertical, Filter, MessageSquareText,
  CheckCircle2, ShieldCheck, Archive, RotateCcw, ClipboardList, Layers,
} from "lucide-react";

type Stage = { id:string;pipelineId:string;name:string;orderIndex:number;isWonStage:boolean;isLostStage:boolean };
type Pipeline = { id:string;name:string;type:number };
type Opportunity = {
  id:string;pipelineId:string;stageId:string;partyId:string|null;leadId:string|null;
  assignedUserId:string|null;title:string;description:string|null;origin:string;
  value:number;expectedClosingDate:string|null;priority:number;status:number;
  lossReason:string|null;createdAt:string;updatedAt:string|null;
  version:string;contactName:string|null;assignedName:string|null;pendingActivities:number;
};
type Lead = {id:string;name:string;phone:string|null;email:string|null;source:string;interest:string|null;status:number};
type Contact = {id:string;name:string;document?:string};
type Person = {id:string;name:string};
type Board = {pipelines:Pipeline[];stages:Stage[];opportunities:Opportunity[]};
type Activity = {id:string;title:string;description:string|null;type:number;status:number;scheduledFor:string;completedAt:string|null;completionNotes:string|null;createdAt:string;version:string};
type HistoryEntry = {id:string;action:string;actor:string;before:unknown;after:unknown;createdAt:string};

const money = (v:number) => new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(v);
const shortDate=(d:string|null|undefined)=>d?new Intl.DateTimeFormat("pt-BR",{day:"2-digit",month:"short",year:"numeric"}).format(new Date(d)):"Sem prazo";
const datetimeLocal=(d:string|null|undefined)=>d?new Date(new Date(d).getTime()-new Date(d).getTimezoneOffset()*60000).toISOString().slice(0,16):"";
const initialForm=()=>({title:"",description:"",value:"",priority:"2",partyId:"",leadId:"",assignedUserId:"",expectedClosingDate:"",stageId:""});
const priorityText:Record<number,string>={1:"Baixa",2:"Normal",3:"Alta",4:"Urgente"};
const field="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100";
const fieldLabel="block text-xs font-bold text-slate-600 mb-1.5";
const secondary="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40";
const primary="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-700 px-4 py-2.5 text-xs font-extrabold text-white shadow-md shadow-violet-200 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45";
const badgeColor:Record<number,string>={1:"bg-slate-100 text-slate-700",2:"bg-blue-50 text-blue-700",3:"bg-orange-50 text-orange-700",4:"bg-rose-50 text-rose-700"};
const activityTypes=[{id:1,name:"Ligação"},{id:2,name:"Retorno de orçamento"},{id:3,name:"Verificação de estoque"},{id:4,name:"Confirmação de interesse"},{id:5,name:"Agendar visita"},{id:6,name:"Negociação"},{id:7,name:"Pós-venda"},{id:8,name:"Tarefa geral"}];

async function callApi<T>(path:string,method:"GET"|"POST"|"PATCH"="GET",body?:unknown):Promise<T>{
  const response=await fetch("/api/crm/"+path,{
    method,
    credentials:"same-origin",
    cache:"no-store",
    headers:body?{"Content-Type":"application/json","Accept":"application/json"}:{"Accept":"application/json"},
    body:body?JSON.stringify(body):undefined,
  });
  const data=await response.json().catch(()=>({error:"Resposta inválida do servidor."}));
  if(!response.ok) throw new Error((typeof data.error==="string"?data.error:"Falha de comunicação")+" (HTTP "+response.status+")");
  return data as T;
}

function Modal({title,children,onClose,width="max-w-xl"}:{title:string;children:React.ReactNode;onClose:()=>void;width?:string}){
 return <div role="presentation" onMouseDown={(e)=>{if(e.target===e.currentTarget)onClose();}} className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-sm">
  <section role="dialog" aria-modal="true" aria-label={title} className={"my-auto max-h-[94vh] w-full overflow-y-auto rounded-2xl bg-white shadow-2xl "+width}>
   <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
    <h2 className="text-base font-extrabold text-slate-900">{title}</h2>
    <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4"/></button>
   </div>
   <div className="p-5">{children}</div>
  </section>
 </div>;
}

export default function CrmPage(){
 const {user,hasPermission,isLoading:authLoading}=useAuth();
 const canView=hasPermission("crm.view");
 const canManage=hasPermission("crm.manage");
 const [board,setBoard]=useState<Board>({pipelines:[],stages:[],opportunities:[]});
 const [leads,setLeads]=useState<Lead[]>([]);
 const [parties,setParties]=useState<Contact[]>([]);
 const [users,setUsers]=useState<Person[]>([]);
 const [pipelineId,setPipelineId]=useState("");
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [search,setSearch]=useState("");
 const [filter,setFilter]=useState("open");
 const [priorityFilter,setPriorityFilter]=useState("all");
 const [tab,setTab]=useState<"board"|"leads"|"activities">("board");
 const [openModal,setOpenModal]=useState<"pipeline"|"lead"|"opportunity"|"activity"|"loss"|"archive"|null>(null);
 const [selected,setSelected]=useState<Opportunity|null>(null);
 const [form,setForm]=useState(initialForm);
 const [editMode,setEditMode]=useState(false);
 const [leadForm,setLeadForm]=useState({name:"",phone:"",email:"",source:"Balcão",interest:""});
 const [pipelineName,setPipelineName]=useState("");
 const [actForm,setActForm]=useState({title:"",description:"",type:"8",scheduledFor:""});
 const [activities,setActivities]=useState<Activity[]>([]);
 const [history,setHistory]=useState<HistoryEntry[]>([]);
 const [reason,setReason]=useState("");
 const [targetStage,setTargetStage]=useState("");
 const [dragId,setDragId]=useState<string|null>(null);

 const refresh=useCallback(async()=>{
  if(!canView){setLoading(false);return;}
  setLoading(true);setError("");
  try{
   const [b,c]=await Promise.all([callApi<Board>("board"),callApi<{leads:Lead[];parties:Contact[];users:Person[]}>("contacts")]);
   setBoard(b);setLeads(c.leads);setParties(c.parties);setUsers(c.users);
   setPipelineId(old=>b.pipelines.some(p=>p.id===old)?old:(b.pipelines[0]?.id||""));
   setSelected(old=>old?b.opportunities.find(o=>o.id===old.id)||null:null);
  }catch(e){setError(e instanceof Error?e.message:"Falha ao carregar CRM.");}
  finally{setLoading(false);}
 },[canView]);

 useEffect(()=>{if(!authLoading)void refresh();},[authLoading,refresh]);
 const currentStages=useMemo(()=>board.stages.filter(s=>s.pipelineId===pipelineId).sort((a,b)=>a.orderIndex-b.orderIndex),[board.stages,pipelineId]);
 const currentOpportunities=useMemo(()=>board.opportunities.filter(o=>{
  if(o.pipelineId!==pipelineId)return false;
  if(filter==="open"&&o.status!==1)return false;
  if(filter==="closed"&&o.status===1)return false;
  if(priorityFilter!=="all"&&String(o.priority)!==priorityFilter)return false;
  const term=search.toLocaleLowerCase("pt-BR").trim();
  return !term||[o.title,o.contactName,o.assignedName,o.origin].some(x=>x?.toLocaleLowerCase("pt-BR").includes(term));
 }),[board.opportunities,pipelineId,filter,priorityFilter,search]);
 const currentAll=board.opportunities.filter(o=>o.pipelineId===pipelineId);
 const currentOpen=currentAll.filter(o=>o.status===1);
 const pendingActivities=currentOpen.reduce((v,o)=>v+o.pendingActivities,0);
 const pipelineTotal=currentOpen.reduce((v,o)=>v+Number(o.value),0);
 const won=currentAll.filter(o=>o.status===2);
 const lost=currentAll.filter(o=>o.status===3);

 const execute=async<T,>(task:()=>Promise<T>,onSuccess:(data:T)=>void,success:string)=>{
  setBusy(true);setError("");setNotice("");
  try{const result=await task();onSuccess(result);setNotice(success);await refresh();return true;}
  catch(e){setError(e instanceof Error?e.message:"Operação não realizada.");await refresh();return false;}
  finally{setBusy(false);}
 };
 const openNew=()=>{
  if(!pipelineId){setOpenModal("pipeline");return;}
  setEditMode(false);setForm({...initialForm(),stageId:currentStages.find(s=>!s.isWonStage&&!s.isLostStage)?.id||"",assignedUserId:user?.id||""});setOpenModal("opportunity");
 };
 const editOpportunity=(o:Opportunity)=>{setEditMode(true);setForm({
  title:o.title,description:o.description||"",value:String(o.value),priority:String(o.priority),
  partyId:o.partyId||"",leadId:o.leadId||"",assignedUserId:o.assignedUserId||"",
  expectedClosingDate:datetimeLocal(o.expectedClosingDate),stageId:o.stageId,
 });setOpenModal("opportunity");};
 const loadDetails=useCallback(async(id:string)=>{
  try{
   const [a,h]=await Promise.all([callApi<Activity[]>("opportunities/"+id+"/activities"),callApi<HistoryEntry[]>("opportunities/"+id+"/history")]);
   setActivities(a);setHistory(h);
  }catch(e){setError(e instanceof Error?e.message:"Falha ao carregar histórico.");}
 },[]);
 const choose=(o:Opportunity)=>{setSelected(o);setActivities([]);setHistory([]);void loadDetails(o.id);};
 const switchStage=async(o:Opportunity,stage:Stage)=>{
  if(o.stageId===stage.id||busy||!canManage)return;
  setSelected(o);
  if(o.status!==1){setError("Reabra a oportunidade antes de mudar de etapa.");return;}
  if(stage.isLostStage){setTargetStage(stage.id);setReason("");setOpenModal("loss");return;}
  await execute(()=>callApi("opportunities/"+o.id,"PATCH",{action:"move",stageId:stage.id,expectedVersion:o.version}),()=>{setOpenModal(null);}, "Etapa atualizada e auditada no Neon.");
 };
 const createPipeline=async(e:React.FormEvent)=>{e.preventDefault();await execute(()=>callApi<{id:string}>("pipelines","POST",{name:pipelineName}),result=>{setPipelineId(result.id);setPipelineName("");setOpenModal(null);},"Funil criado com etapas reais no banco.");};
 const createLead=async(e:React.FormEvent)=>{e.preventDefault();await execute(()=>callApi<{id:string}>("leads","POST",{...leadForm,phone:normalizePhoneBr(leadForm.phone)||null}),()=>{setOpenModal(null);setLeadForm({name:"",phone:"",email:"",source:"Balcão",interest:""});},"Lead cadastrado no Neon.");};
 const saveOpportunity=async(e:React.FormEvent)=>{
  e.preventDefault();
  const payload={title:form.title,description:form.description,value:Number(form.value),priority:Number(form.priority),expectedClosingDate:form.expectedClosingDate?new Date(form.expectedClosingDate).toISOString():null,assignedUserId:form.assignedUserId||null};
  if(editMode&&selected){
   await execute(()=>callApi("opportunities/"+selected.id,"PATCH",{...payload,action:"edit",expectedVersion:selected.version}),()=>setOpenModal(null),"Oportunidade atualizada.");
  }else{
   await execute(()=>callApi("opportunities","POST",{...payload,pipelineId,stageId:form.stageId,partyId:form.partyId||null,leadId:form.leadId||null}),()=>setOpenModal(null),"Oportunidade criada e registrada no Neon.");
  }
 };
 const closeAsLost=async(e:React.FormEvent)=>{e.preventDefault();if(!selected)return;await execute(()=>callApi("opportunities/"+selected.id,"PATCH",{action:"move",stageId:targetStage,lossReason:reason,expectedVersion:selected.version}),()=>setOpenModal(null),"Motivo de perda registrado.");};
 const archive=async(e:React.FormEvent)=>{e.preventDefault();if(!selected)return;await execute(()=>callApi("opportunities/"+selected.id,"PATCH",{action:selected.status===1?"archive":"reopen",reason,expectedVersion:selected.version}),()=>{setOpenModal(null);setSelected(null);},"Status atualizado com rastreabilidade.");};
 const createActivity=async(e:React.FormEvent)=>{
  e.preventDefault();if(!selected)return;
  const ok=await execute(()=>callApi("opportunities/"+selected.id+"/activities","POST",{...actForm,type:Number(actForm.type),scheduledFor:new Date(actForm.scheduledFor).toISOString()}),()=>{setOpenModal(null);setActForm({title:"",description:"",type:"8",scheduledFor:""});},"Atividade agendada no Neon.");
  if(ok)void loadDetails(selected.id);
 };
 const completeActivity=async(a:Activity)=>{const ok=await execute(()=>callApi("activities/"+a.id,"PATCH",{expectedVersion:a.version,notes:"Concluída pelo Kanban"}),()=>{},"Atividade concluída.");if(ok&&selected)void loadDetails(selected.id);};

 return <RootShellLayout>
 <div className="space-y-5 pb-10">
  <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
   <div><span className="inline-block rounded-full border border-violet-100 bg-violet-50 px-2.5 py-1 text-[10px] font-extrabold uppercase text-violet-700">Inteligência Comercial • CRM Enterprise</span>
    <h1 className="mt-2 text-xl font-black tracking-tight text-slate-900">Funil de vendas & relacionamento</h1>
    <p className="mt-1 text-xs text-slate-500">Oportunidades, etapas, atividades e histórico persistidos no Neon.</p>
   </div>
   <div className="flex flex-wrap gap-2">
    <button type="button" className={secondary+" inline-flex items-center gap-2"} onClick={()=>void refresh()} disabled={loading}><RefreshCw className={"h-3.5 w-3.5 "+(loading?"animate-spin":"")}/> Atualizar</button>
    {canManage&&<button type="button" className={secondary+" inline-flex items-center gap-2"} onClick={()=>setOpenModal("pipeline")}><Layers className="h-3.5 w-3.5"/> Novo funil</button>}
    {canManage&&<button type="button" className={primary} onClick={openNew}><Plus className="h-4 w-4"/> Nova oportunidade</button>}
   </div>
  </section>

  {(error||notice)&&<div role="alert" className={"flex items-start gap-2 rounded-xl border px-4 py-3 text-xs font-semibold "+(error?"border-rose-200 bg-rose-50 text-rose-700":"border-emerald-200 bg-emerald-50 text-emerald-700")}>
   {error?<AlertCircle className="h-4 w-4 shrink-0"/>:<CheckCircle2 className="h-4 w-4 shrink-0"/>}<span>{error||notice}</span><button className="ml-auto" onClick={()=>{setError("");setNotice("");}} aria-label="Fechar aviso"><X className="h-4 w-4"/></button>
  </div>}
  {!authLoading&&!canView&&<div className="rounded-xl bg-white p-10 text-center text-sm text-slate-500"><ShieldCheck className="mx-auto mb-3 h-8 w-8"/>Você não possui a permissão <strong>crm.view</strong>.</div>}
  {canView&&<>
   <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
    {[
     {name:"Pipeline em aberto",value:loading?"—":money(pipelineTotal),icon:TrendingUp,color:"text-violet-700 bg-violet-50",sub:currentOpen.length+" oportunidades"},
     {name:"Atividades pendentes",value:loading?"—":String(pendingActivities),icon:CalendarClock,color:"text-blue-700 bg-blue-50",sub:"Retornos e acompanhamentos"},
     {name:"Negociações ganhas",value:loading?"—":String(won.length),icon:CheckCircle2,color:"text-emerald-700 bg-emerald-50",sub:money(won.reduce((a,o)=>a+Number(o.value),0))},
     {name:"Negociações perdidas",value:loading?"—":String(lost.length),icon:Target,color:"text-amber-700 bg-amber-50",sub:"Motivos no histórico"},
    ].map(item=><div key={item.name} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
     <div className="flex items-center justify-between gap-2"><span className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500">{item.name}</span><span className={"rounded-xl p-2 "+item.color}><item.icon className="h-4 w-4"/></span></div>
     <div className="mt-2 text-xl font-black text-slate-900">{item.value}</div><p className="mt-1 text-[10px] text-slate-400">{item.sub}</p>
    </div>)}
   </section>

   <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
     <div className="flex flex-wrap items-center gap-2">
      <label className="text-xs font-bold text-slate-600" htmlFor="pipeline-select">Funil</label>
      <select id="pipeline-select" value={pipelineId} onChange={e=>setPipelineId(e.target.value)} className="max-w-[240px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800">
       {board.pipelines.length===0&&<option value="">Nenhum funil cadastrado</option>}
       {board.pipelines.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <div className="ml-1 inline-flex rounded-lg bg-slate-100 p-1">
       {([{id:"board",name:"Kanban"},{id:"leads",name:"Leads"},{id:"activities",name:"Atividades"}] as const).map(t=><button key={t.id} onClick={()=>setTab(t.id)} className={"rounded-md px-3 py-1.5 text-xs font-bold "+(tab===t.id?"bg-white text-violet-700 shadow-sm":"text-slate-500 hover:text-slate-800")}>{t.name}</button>)}
      </div>
     </div>
     <div className="flex flex-wrap items-center gap-2">
      <div className="relative"><Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400"/><input aria-label="Pesquisar oportunidades" placeholder="Buscar oportunidade..." value={search} onChange={e=>setSearch(e.target.value)} className="w-48 rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-xs outline-none focus:border-violet-400"/></div>
      <Filter className="h-3.5 w-3.5 text-slate-400"/>
      <select aria-label="Filtrar por status" value={filter} onChange={e=>setFilter(e.target.value)} className="rounded-xl border border-slate-200 p-2 text-xs"><option value="open">Abertas</option><option value="closed">Encerradas</option><option value="all">Todas</option></select>
      <select aria-label="Filtrar por prioridade" value={priorityFilter} onChange={e=>setPriorityFilter(e.target.value)} className="rounded-xl border border-slate-200 p-2 text-xs"><option value="all">Prioridades</option>{Object.entries(priorityText).map(([v,n])=><option key={v} value={v}>{n}</option>)}</select>
     </div>
    </div>

    {loading?<div className="flex items-center justify-center gap-2 p-16 text-sm text-slate-500"><RefreshCw className="h-4 w-4 animate-spin"/> Carregando dados do Neon...</div>
    :board.pipelines.length===0?<div className="mx-auto max-w-lg px-6 py-20 text-center"><Layers className="mx-auto h-10 w-10 text-violet-400"/><h2 className="mt-4 font-extrabold text-slate-800">Seu CRM está pronto para configurar</h2><p className="mt-2 text-sm text-slate-500">Nenhum funil existe no seu tenant. Crie um para começar sem importar dados de outra empresa.</p>{canManage&&<button className={primary+" mt-5"} onClick={()=>setOpenModal("pipeline")}><Plus className="h-4 w-4"/> Criar meu primeiro funil</button>}</div>
    :tab==="board"?<div className="overflow-x-auto p-4">
      <div className="flex min-w-max items-start gap-3" aria-label="Quadro Kanban">
       {currentStages.map((stage,idx)=>{
        const cards=currentOpportunities.filter(o=>o.stageId===stage.id);
        const total=cards.reduce((s,o)=>s+Number(o.value),0);
        return <section key={stage.id} onDragOver={e=>{if(canManage)e.preventDefault();}} onDrop={e=>{e.preventDefault();if(!dragId)return;const opp=currentOpportunities.find(o=>o.id===dragId);setDragId(null);if(opp)void switchStage(opp,stage);}} className={"flex w-[265px] shrink-0 flex-col rounded-2xl border p-3 transition-colors "+(dragId?"border-violet-200 bg-violet-50/50":"border-slate-200 bg-slate-50")}>
          <div className="mb-3 border-b border-slate-200 pb-3"><div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2"><span className={"h-2.5 w-2.5 rounded-full "+(stage.isWonStage?"bg-emerald-500":stage.isLostStage?"bg-rose-400":idx===0?"bg-violet-500":"bg-blue-400")}/><h3 className="text-[11px] font-black uppercase tracking-wide text-slate-700">{stage.name}</h3></div><span className="rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-bold">{cards.length}</span></div><p className="mt-2 text-xs font-bold text-slate-500">{money(total)}</p></div>
          <div className="min-h-[325px] space-y-2">
           {cards.map(o=><div key={o.id} draggable={canManage&&o.status===1} onDragStart={e=>{setDragId(o.id);e.dataTransfer.effectAllowed="move";}} onDragEnd={()=>setDragId(null)} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-shadow hover:border-violet-300 hover:shadow-md">
             <button onClick={()=>choose(o)} className="block w-full text-left" aria-label={"Abrir oportunidade "+o.title}>
              <div className="flex items-start justify-between gap-2"><span className="line-clamp-2 text-xs font-extrabold text-slate-900">{o.title}</span><GripVertical className="h-4 w-4 shrink-0 text-slate-300"/></div>
              <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500"><UserRound className="h-3 w-3"/>{o.contactName||"Contato vinculado"}</div>
              <div className="mt-2 flex flex-wrap gap-1.5"><span className={"rounded-md px-2 py-0.5 text-[10px] font-bold "+badgeColor[o.priority]}>{priorityText[o.priority]||"Normal"}</span>{o.pendingActivities>0&&<span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">{o.pendingActivities} tarefas</span>}{o.status!==1&&<span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold">{o.status===2?"Ganha":o.status===3?"Perdida":"Arquivada"}</span>}</div>
              <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2"><span className="text-sm font-black text-slate-900">{money(Number(o.value))}</span><span className="flex items-center gap-1 text-[10px] text-slate-400"><CalendarDays className="h-3 w-3"/>{shortDate(o.expectedClosingDate)}</span></div>
             </button>
             {canManage&&o.status===1&&<label className="mt-2 block"><span className="sr-only">Mover etapa</span><select value={o.stageId} aria-label={"Alterar etapa de "+o.title} disabled={busy} onChange={e=>{const dest=currentStages.find(s=>s.id===e.target.value);if(dest)void switchStage(o,dest);}} className="w-full rounded-lg border border-slate-100 bg-slate-50 p-1.5 text-[10px] text-slate-600"><option value={o.stageId}>Mover para...</option>{currentStages.filter(s=>s.id!==o.stageId).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
            </div>)}
           {cards.length===0&&<div className="flex min-h-[130px] items-center justify-center rounded-xl border border-dashed border-slate-300 text-center text-[11px] text-slate-400">Nenhuma oportunidade nesta etapa</div>}
          </div>
         </section>;
       })}
      </div>
      <p className="mt-3 flex items-center gap-2 text-[11px] text-slate-400"><GripVertical className="h-3 w-3"/> Arraste cartões para mudar de etapa ou utilize o seletor. Todas as mudanças são validadas no servidor.</p>
    </div>
    :tab==="leads"?<div className="p-4"><div className="mb-4 flex items-center justify-between"><h3 className="text-sm font-black text-slate-800">Contatos e leads cadastrados</h3>{canManage&&<button className={primary} onClick={()=>setOpenModal("lead")}><Plus className="h-4 w-4"/> Novo lead</button>}</div>
      {leads.length===0?<div className="rounded-xl border border-dashed border-slate-200 p-10 text-center text-sm text-slate-400">Nenhum lead cadastrado neste tenant e filial.</div>:<div className="divide-y divide-slate-100">{leads.filter(l=>!search||l.name.toLowerCase().includes(search.toLowerCase())).map(l=><div key={l.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><div className="text-sm font-bold text-slate-900">{l.name}</div><p className="text-xs text-slate-500">{l.source} • {l.interest||"Interesse não informado"}</p></div><div className="text-xs text-slate-500">{l.phone?formatPhoneBr(l.phone):l.email||"Sem contato"}</div></div>)}</div>}
    </div>
    :<div className="p-4"><h3 className="mb-4 text-sm font-black text-slate-800">Atividades pendentes por oportunidade</h3>{pendingActivities===0?<div className="rounded-xl border border-dashed border-slate-200 p-10 text-center text-sm text-slate-400">Nenhuma atividade pendente.</div>:currentOpen.filter(o=>o.pendingActivities>0).map(o=><button key={o.id} onClick={()=>choose(o)} className="flex w-full items-center justify-between border-b border-slate-100 p-3 text-left hover:bg-violet-50"><span className="text-sm font-bold text-slate-800">{o.title}</span><span className="text-xs font-bold text-blue-700">{o.pendingActivities} pendentes</span></button>)}</div>}
   </section>
  </>}
 </div>

 {selected&&<div className="fixed inset-0 z-[70] flex justify-end bg-slate-950/40" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setSelected(null);}}>
  <aside role="dialog" aria-modal="true" aria-label="Detalhes da oportunidade" className="flex h-full w-full max-w-xl flex-col overflow-y-auto bg-white shadow-2xl">
   <div className="sticky top-0 z-10 border-b border-slate-100 bg-white px-6 py-5"><div className="flex items-start justify-between gap-3"><div><span className="text-[10px] font-extrabold uppercase text-violet-600">Oportunidade</span><h2 className="mt-1 text-lg font-black text-slate-900">{selected.title}</h2><p className="mt-1 text-xs text-slate-500">{selected.contactName||"Contato não identificado"} • {selected.assignedName||"Sem responsável"}</p></div><button onClick={()=>setSelected(null)} aria-label="Fechar detalhes" className="rounded-lg p-2 hover:bg-slate-100"><X className="h-4 w-4"/></button></div>
    <div className="mt-4 flex flex-wrap gap-2">{canManage&&selected.status===1&&<><button className={secondary+" flex items-center gap-1.5"} onClick={()=>editOpportunity(selected)}><Pencil className="h-3.5 w-3.5"/> Editar</button><button className={primary} onClick={()=>{setActForm({title:"",description:"",type:"8",scheduledFor:datetimeLocal(new Date(Date.now()+86400000).toISOString())});setOpenModal("activity");}}><Plus className="h-3.5 w-3.5"/> Agendar tarefa</button></>} {canManage&&<button className={secondary+" flex items-center gap-1.5"} onClick={()=>{setReason("");setOpenModal("archive");}}>{selected.status===1?<Archive className="h-3.5 w-3.5"/>:<RotateCcw className="h-3.5 w-3.5"/>}{selected.status===1?" Arquivar":" Reabrir"}</button>}</div>
   </div>
   <div className="space-y-5 p-6">
    <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4 text-sm"><div><p className="text-[10px] text-slate-500">Valor previsto</p><strong className="text-lg text-slate-900">{money(Number(selected.value))}</strong></div><div><p className="text-[10px] text-slate-500">Fechamento previsto</p><strong className="text-xs">{shortDate(selected.expectedClosingDate)}</strong></div><div><p className="text-[10px] text-slate-500">Etapa</p><strong className="text-xs">{currentStages.find(s=>s.id===selected.stageId)?.name||"—"}</strong></div><div><p className="text-[10px] text-slate-500">Prioridade</p><strong className="text-xs">{priorityText[selected.priority]}</strong></div></div>
    {selected.description&&<div><h3 className="text-xs font-bold text-slate-700">Descrição</h3><p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{selected.description}</p></div>}
    {selected.lossReason&&<div className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700"><strong>Justificativa:</strong> {selected.lossReason}</div>}
    <section><h3 className="mb-3 flex items-center gap-2 text-sm font-black text-slate-800"><ClipboardList className="h-4 w-4 text-violet-600"/> Atividades</h3>{activities.length===0?<p className="rounded-xl border border-dashed border-slate-200 p-5 text-center text-xs text-slate-400">Nenhuma atividade registrada.</p>:<div className="space-y-2">{activities.map(a=><div key={a.id} className="rounded-xl border border-slate-200 p-3"><div className="flex items-start justify-between gap-2"><div><strong className="text-xs text-slate-800">{a.title}</strong><p className="mt-1 text-[11px] text-slate-500">{shortDate(a.scheduledFor)} • {activityTypes.find(t=>t.id===a.type)?.name||"Atividade"}</p></div>{a.status===3?<span className="text-[10px] font-bold text-emerald-700">Concluída</span>:canManage?<button disabled={busy} onClick={()=>void completeActivity(a)} className={secondary+" flex items-center gap-1"}><Check className="h-3 w-3"/> Concluir</button>:<span className="text-[10px] text-amber-600">Pendente</span>}</div>{a.description&&<p className="mt-2 text-xs text-slate-500">{a.description}</p>}</div>)}</div>}</section>
    <section><h3 className="mb-3 flex items-center gap-2 text-sm font-black text-slate-800"><History className="h-4 w-4 text-violet-600"/> Histórico auditável</h3>{history.length===0?<p className="rounded-xl border border-dashed border-slate-200 p-5 text-center text-xs text-slate-400">Nenhum evento de histórico encontrado.</p>:<div className="space-y-3 border-l-2 border-violet-100 pl-4">{history.map(h=><div key={h.id}><p className="text-xs font-bold text-slate-800">{h.action}</p><p className="text-[11px] text-slate-500">{shortDate(h.createdAt)} • {h.actor}</p></div>)}</div>}</section>
   </div>
  </aside>
 </div>}

 {openModal==="pipeline"&&<Modal title="Criar funil comercial" onClose={()=>setOpenModal(null)}>
  <form onSubmit={e=>void createPipeline(e)} className="space-y-4"><p className="text-xs text-slate-500">Crie um funil real com etapas de prospecção, qualificação, proposta, negociação, ganho e perda. Nenhum dado fictício será inserido.</p><label><span className={fieldLabel}>Nome do funil *</span><input required maxLength={120} value={pipelineName} onChange={e=>setPipelineName(e.target.value)} placeholder="Ex.: Vendas HB Studio" className={field}/></label><div className="flex justify-end gap-2"><button type="button" className={secondary} onClick={()=>setOpenModal(null)}>Cancelar</button><button disabled={busy||!pipelineName.trim()} className={primary}>Criar funil</button></div></form>
 </Modal>}
 {openModal==="lead"&&<Modal title="Novo lead" onClose={()=>setOpenModal(null)}>
  <form className="space-y-4" onSubmit={e=>void createLead(e)}><label><span className={fieldLabel}>Nome completo *</span><input required maxLength={180} className={field} value={leadForm.name} onChange={e=>setLeadForm({...leadForm,name:e.target.value})}/></label><div className="grid grid-cols-2 gap-3"><label><span className={fieldLabel}>Telefone</span><input className={field} value={leadForm.phone} onChange={e=>setLeadForm({...leadForm,phone:maskPhoneInput(e.target.value)})} inputMode="tel" autoComplete="tel" maxLength={15}/></label><label><span className={fieldLabel}>E-mail</span><input className={field} type="email" value={leadForm.email} onChange={e=>setLeadForm({...leadForm,email:e.target.value})}/></label></div><label><span className={fieldLabel}>Origem</span><select className={field} value={leadForm.source} onChange={e=>setLeadForm({...leadForm,source:e.target.value})}>{["Balcão","WhatsApp","Instagram","Indicação","Site","Telefone","Outro"].map(n=><option key={n}>{n}</option>)}</select></label><label><span className={fieldLabel}>Interesse principal</span><input className={field} value={leadForm.interest} onChange={e=>setLeadForm({...leadForm,interest:e.target.value})}/></label><div className="flex justify-end gap-2"><button type="button" className={secondary} onClick={()=>setOpenModal(null)}>Cancelar</button><button disabled={busy} className={primary}>Salvar lead</button></div></form>
 </Modal>}
 {openModal==="opportunity"&&<Modal title={editMode?"Editar oportunidade":"Nova oportunidade"} onClose={()=>setOpenModal(null)}>
  <form className="space-y-4" onSubmit={e=>void saveOpportunity(e)}>
   <label><span className={fieldLabel}>Título da negociação *</span><input required maxLength={200} className={field} placeholder="Ex.: Venda de notebook para cliente" value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label>
   {!editMode&&<><div className="grid grid-cols-2 gap-3"><label><span className={fieldLabel}>Tipo de contato *</span><select className={field} value={form.partyId?"party":form.leadId?"lead":"lead"} onChange={e=>setForm({...form,partyId:e.target.value==="party"?parties[0]?.id||"":"",leadId:e.target.value==="lead"?leads[0]?.id||"":""})}><option value="lead">Lead</option><option value="party">Cliente cadastrado</option></select></label><label><span className={fieldLabel}>Lead ou cliente *</span><select required className={field} value={form.partyId||form.leadId} onChange={e=>setForm({...form,partyId:form.partyId?e.target.value:"",leadId:!form.partyId?e.target.value:""})}><option value="">Selecione...</option>{(form.partyId?parties:leads).map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select></label></div><p className="text-xs text-slate-500">Cadastre o lead na aba Leads antes de criar a negociação, se necessário.</p>
    <label><span className={fieldLabel}>Etapa inicial</span><select required className={field} value={form.stageId} onChange={e=>setForm({...form,stageId:e.target.value})}>{currentStages.filter(s=>!s.isWonStage&&!s.isLostStage).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label></>}
   <div className="grid grid-cols-2 gap-3"><label><span className={fieldLabel}>Valor estimado (R$)</span><input required min="0" step="0.01" type="number" className={field} value={form.value} onChange={e=>setForm({...form,value:e.target.value})}/></label><label><span className={fieldLabel}>Prioridade</span><select className={field} value={form.priority} onChange={e=>setForm({...form,priority:e.target.value})}>{Object.entries(priorityText).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label></div>
   <div className="grid grid-cols-2 gap-3"><label><span className={fieldLabel}>Previsão de fechamento</span><input type="datetime-local" className={field} value={form.expectedClosingDate} onChange={e=>setForm({...form,expectedClosingDate:e.target.value})}/></label><label><span className={fieldLabel}>Responsável</span><select className={field} value={form.assignedUserId} onChange={e=>setForm({...form,assignedUserId:e.target.value})}><option value="">Usuário atual</option>{users.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select></label></div>
   <label><span className={fieldLabel}>Descrição / Próximos passos</span><textarea rows={3} className={field} maxLength={2000} value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label>
   <div className="flex justify-end gap-2"><button type="button" className={secondary} onClick={()=>setOpenModal(null)}>Cancelar</button><button disabled={busy||!form.title.trim()||!form.value||( !editMode && !(form.leadId||form.partyId))} className={primary}>{editMode?"Salvar alterações":"Criar oportunidade"}</button></div>
  </form>
 </Modal>}
 {openModal==="activity"&&<Modal title="Agendar atividade" onClose={()=>setOpenModal(null)}>
  <form onSubmit={e=>void createActivity(e)} className="space-y-4"><label><span className={fieldLabel}>Atividade *</span><input required maxLength={180} className={field} value={actForm.title} onChange={e=>setActForm({...actForm,title:e.target.value})}/></label><div className="grid grid-cols-2 gap-3"><label><span className={fieldLabel}>Tipo</span><select className={field} value={actForm.type} onChange={e=>setActForm({...actForm,type:e.target.value})}>{activityTypes.map(t=><option value={t.id} key={t.id}>{t.name}</option>)}</select></label><label><span className={fieldLabel}>Agendar para *</span><input required type="datetime-local" className={field} value={actForm.scheduledFor} onChange={e=>setActForm({...actForm,scheduledFor:e.target.value})}/></label></div><label><span className={fieldLabel}>Observações</span><textarea className={field} rows={3} value={actForm.description} onChange={e=>setActForm({...actForm,description:e.target.value})}/></label><div className="flex justify-end"><button className={primary} disabled={busy}>Agendar atividade</button></div></form>
 </Modal>}
 {openModal==="loss"&&<Modal title="Encerrar oportunidade como perdida" onClose={()=>setOpenModal(null)}><form className="space-y-4" onSubmit={e=>void closeAsLost(e)}><p className="text-sm text-slate-600">A oportunidade será encerrada na etapa de perda do funil. Informe a justificativa para auditoria.</p><label><span className={fieldLabel}>Motivo da perda *</span><textarea required maxLength={400} rows={3} className={field} value={reason} onChange={e=>setReason(e.target.value)}/></label><div className="flex justify-end"><button disabled={busy||!reason.trim()} className={primary}>Confirmar perda</button></div></form></Modal>}
 {openModal==="archive"&&<Modal title={selected?.status===1?"Arquivar oportunidade":"Reabrir oportunidade"} onClose={()=>setOpenModal(null)}><form className="space-y-4" onSubmit={e=>void archive(e)}><p className="text-sm text-slate-600">Esta alteração será registrada com identificação do responsável.</p><label><span className={fieldLabel}>Justificativa *</span><textarea required maxLength={400} rows={3} className={field} value={reason} onChange={e=>setReason(e.target.value)}/></label><div className="flex justify-end"><button disabled={busy||!reason.trim()} className={primary}>Confirmar</button></div></form></Modal>}
 </RootShellLayout>;
}
