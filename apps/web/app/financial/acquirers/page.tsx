"use client";
import {useCallback,useEffect,useMemo,useState} from "react";
import RootShellLayout from "@/components/RootShellLayout";
import {useAuth} from "@/lib/auth";
import {calculateAcquirerFee,type AcquirerRate,type FeeMethod} from "@/lib/acquirer-fees";
import {CreditCard,Wallet,RefreshCw,Save,Plus,AlertTriangle,CheckCircle2,Calculator,ShieldCheck} from "lucide-react";

type Profile={id:string;name:string;provider:string;isActive:boolean;version:number;createdAt:string;updatedAt:string};
type RuleData={profileId:string;version:number;versionId:string;method:FeeMethod;installments:number;
 mdrBps:number;anticipationBps:number;fixedFeeCents:number;settlementDays:number;
 settlementMode:"SINGLE"|"MONTHLY";enabled:boolean};
type SettingsResponse={profiles:Profile[];rules:RuleData[];canManage:boolean;note:string};
type FormRule={method:FeeMethod;installments:number;mdrPercent:string;anticipationPercent:string;fixedFee:string;
 settlementDays:string;settlementMode:"SINGLE"|"MONTHLY";enabled:boolean};
const moneyCents=(v:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(v/100);
const basis=(v:number)=>(v/100).toFixed(2);
const initialRules=():FormRule[]=>([
 {method:"PIX" as const,installments:1},{method:"DEBIT" as const,installments:1},
 ...Array.from({length:18},(_,i)=>({method:"CREDIT" as const,installments:i+1}))
]).map(x=>({...x,mdrPercent:"0.00",anticipationPercent:"0.00",fixedFee:"0.00",
 settlementDays:"0",settlementMode:"SINGLE" as const,enabled:false}));
const field="w-full min-w-0 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-800 focus:border-violet-600 focus:outline-none";
export default function AcquirerFeesPage(){
 const {isLoading:authLoading,hasPermission}=useAuth();
 const canView=hasPermission("finance.reports.view"),canEdit=hasPermission("finance.banks.manage");
 const [data,setData]=useState<SettingsResponse|null>(null),[loading,setLoading]=useState(false),[saving,setSaving]=useState(false);
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const [profileId,setProfileId]=useState("");
 const [newName,setNewName]=useState(""),[newProvider,setNewProvider]=useState("");
 const [tab,setTab]=useState<FeeMethod>("CREDIT"),[rows,setRows]=useState<FormRule[]>(initialRules);
 const [notes,setNotes]=useState(""),[previewGross,setPreviewGross]=useState("1000.00");
 const [previewInstallments,setPreviewInstallments]=useState(1);
 const load=useCallback(async()=>{
  setLoading(true);setError("");
  try{
   const res=await fetch("/api/financial/acquirers",{cache:"no-store"});
   const payload=await res.json().catch(()=>({}));
   if(!res.ok)throw new Error(payload.error||"Não foi possível consultar as taxas.");
   setData(payload);
  }catch(err){setError(err instanceof Error?err.message:"Falha na leitura do Neon.");setData(null);}
  finally{setLoading(false);}
 },[]);
 useEffect(()=>{if(!authLoading&&canView)void load();},[authLoading,canView,load]);
 const profile=data?.profiles.find(p=>p.id===profileId)||null;
 useEffect(()=>{
  if(!data)return;
  if(data.profiles.length===0){setProfileId("");setRows(initialRules());return;}
  const selected=data.profiles.find(p=>p.id===profileId)||data.profiles[0];
  if(selected.id!==profileId)setProfileId(selected.id);
  const existing=data.rules.filter(r=>r.profileId===selected.id);
  const defaults=initialRules();
  setRows(defaults.map(r=>{
   const saved=existing.find(x=>x.method===r.method&&x.installments===r.installments);
   if(!saved)return r;
   return {...r,mdrPercent:basis(saved.mdrBps),anticipationPercent:basis(saved.anticipationBps),
    fixedFee:(saved.fixedFeeCents/100).toFixed(2),settlementDays:String(saved.settlementDays),
    settlementMode:saved.settlementMode,enabled:saved.enabled};
  }));
 },[data,profileId]);
 const formRows=rows.filter(r=>r.method===tab);
 const selectedRule=rows.find(r=>r.method===tab&&r.installments===(tab==="CREDIT"?previewInstallments:1));
 const preview=useMemo(()=>{
  if(!selectedRule||!selectedRule.enabled)return null;
  try {
   const gross=String(previewGross).trim().replace(",",".");
   if(!/^\d{1,9}(?:\.\d{1,2})?$/.test(gross))return null;
   const rate:AcquirerRate={
    method:selectedRule.method,installments:selectedRule.installments,
    mdrBps:Math.round(Number(selectedRule.mdrPercent)*100),
    anticipationBps:Math.round(Number(selectedRule.anticipationPercent)*100),
    fixedFeeCents:Math.round(Number(selectedRule.fixedFee)*100),
    settlementDays:Number(selectedRule.settlementDays),
    settlementMode:selectedRule.settlementMode,enabled:selectedRule.enabled
   };
   return calculateAcquirerFee(Math.round(Number(gross)*100),rate);
  }catch{return null;}
 },[selectedRule,previewGross]);
 const patch=(method:FeeMethod,installments:number,value:Partial<FormRule>)=>{
  setRows(prev=>prev.map(r=>r.method===method&&r.installments===installments?{...r,...value}:r));
 };
 const create=async(e:React.FormEvent)=>{
  e.preventDefault();if(saving)return;setSaving(true);setError("");setNotice("");
  try{
   const res=await fetch("/api/financial/acquirers",{method:"POST",
    headers:{"Content-Type":"application/json"},body:JSON.stringify({name:newName,provider:newProvider})});
   const payload=await res.json().catch(()=>({}));
   if(!res.ok)throw new Error(payload.error||"Não foi possível criar a adquirente.");
   setNewName("");setNewProvider("");setNotice("Maquininha cadastrada. Configure e publique a tabela de taxas para ativá-la.");
   await load();setProfileId(payload.id);
  }catch(e){setError(e instanceof Error?e.message:"Falha na criação.");}
  finally{setSaving(false);}
 };
 const publish=async()=>{
  if(!profile||saving)return;
  if(!window.confirm("Publicar a nova versão das taxas? Valores já utilizados no histórico não serão recalculados."))return;
  setSaving(true);setError("");setNotice("");
  try{
   const res=await fetch("/api/financial/acquirers",{method:"PUT",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({profileId:profile.id,expectedVersion:profile.version,
     notes,rules:rows.map(r=>({...r,mdrPercent:r.mdrPercent.replace(",","."),anticipationPercent:r.anticipationPercent.replace(",","."),fixedFee:r.fixedFee.replace(",","."),settlementDays:Number(r.settlementDays)}))})});
   const payload=await res.json().catch(()=>({}));
   if(!res.ok)throw new Error(payload.error||"Não foi possível publicar.");
   setNotice("Tabela versão "+payload.version+" salva com 20 modalidades e auditoria.");
   await load();
  }catch(e){setError(e instanceof Error?e.message:"Não foi possível salvar.");}
  finally{setSaving(false);}
 };
 if(!authLoading&&!canView)return <RootShellLayout><div role="alert" className="rounded-xl bg-amber-50 p-5 text-sm text-amber-900">Sem permissão para consultar taxas financeiras.</div></RootShellLayout>;
 return <RootShellLayout>
  <div className="space-y-5 pb-12">
   <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3">
     <div><span className="rounded-md bg-violet-50 px-2 py-1 text-[10px] font-black uppercase text-violet-700">Financeiro & Governança</span>
      <h1 className="mt-2 flex items-center gap-2 text-xl font-black text-slate-900"><CreditCard className="h-6 w-6 text-violet-700"/>Taxas de maquininha — Crédito, Débito & Pix</h1>
      <p className="mt-1 max-w-3xl text-xs text-slate-600">Configure o contrato real da sua adquirente. O cliente paga o valor integral sem juros; o sistema estima os descontos da operadora e o líquido a receber.</p></div>
     <button type="button" onClick={()=>void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold disabled:opacity-40"><RefreshCw className="h-4 w-4"/>Atualizar</button>
    </div>
   </header>
   {error&&<div role="alert" className="flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><AlertTriangle className="h-4 w-4 shrink-0"/>{error}</div>}
   {notice&&<div role="status" className="flex gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><CheckCircle2 className="h-4 w-4 shrink-0"/>{notice}</div>}
   <section className="grid gap-3 lg:grid-cols-2">
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
     <h2 className="mb-3 text-sm font-extrabold">Maquininha / adquirente</h2>
     <select value={profileId} onChange={e=>{setProfileId(e.target.value);setNotice("");}} className={field} aria-label="Selecionar maquininha">
      {!data?.profiles.length&&<option value="">Nenhuma operadora cadastrada</option>}
      {data?.profiles.map(p=><option key={p.id} value={p.id}>{p.name} — {p.provider} (v{p.version})</option>)}
     </select>
     <p className="mt-2 text-xs text-slate-500">{profile?.version?"Versão vigente publicada: "+profile.version:"Não há tabela publicada nesta maquininha."}</p>
    </div>
    <form onSubmit={e=>void create(e)} className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4">
     <h2 className="text-sm font-extrabold">Cadastrar outra maquininha</h2>
     <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <input required disabled={!canEdit||saving} minLength={2} maxLength={120} className={field} value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Nome: Caixa Matriz / Terminal 1"/>
      <input required disabled={!canEdit||saving} minLength={2} maxLength={120} className={field} value={newProvider} onChange={e=>setNewProvider(e.target.value)} placeholder="Adquirente: Stone, Cielo, Rede..."/>
     </div>
     <button type="submit" disabled={!canEdit||saving} className="inline-flex items-center gap-2 rounded-lg bg-violet-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-40"><Plus className="h-4 w-4"/>Cadastrar maquininha</button>
    </form>
   </section>
   {profile&&<>
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
     <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
      <div><h2 className="text-sm font-extrabold">Tabela contratada de taxas</h2>
       <p className="mt-1 text-xs text-slate-600">Todas as 20 linhas devem estar configuradas. Desative parcelas não contratadas. Taxa de antecipação: percentual efetivo sobre o valor após MDR.</p></div>
      <div className="flex gap-2">
       {(["PIX","DEBIT","CREDIT"] as FeeMethod[]).map(t=><button key={t} type="button" onClick={()=>{setTab(t);setPreviewInstallments(1);}} className={"rounded-lg border px-3 py-2 text-xs font-bold "+(tab===t?"border-violet-700 bg-violet-50 text-violet-800":"border-slate-200")}>{t==="PIX"?"Pix":t==="DEBIT"?"Débito":"Crédito (1–18x)"}</button>)}
      </div>
     </div>
     <div className="overflow-x-auto p-3">
      <table className="w-full min-w-[820px] text-xs">
       <thead className="bg-slate-50 text-left text-slate-600">
        <tr><th className="p-2">Modalidade</th><th className="p-2">Ativo</th><th className="p-2">MDR %</th><th className="p-2">Antecipação efetiva %</th><th className="p-2">Fixo R$</th><th className="p-2">Prazo D+</th><th className="p-2">Repasse</th></tr>
       </thead>
       <tbody className="divide-y divide-slate-100">{formRows.map(r=><tr key={r.method+"-"+r.installments} className={r.enabled?"":"opacity-70"}>
        <td className="p-2 font-bold">{r.method==="CREDIT"?r.installments+"x":r.method==="PIX"?"Pix":"Débito"}</td>
        <td className="p-2"><input type="checkbox" disabled={!canEdit||saving} aria-label={"Habilitar "+r.method+" "+r.installments} checked={r.enabled} onChange={e=>patch(r.method,r.installments,{enabled:e.target.checked})}/></td>
        {(["mdrPercent","anticipationPercent","fixedFee","settlementDays"] as const).map((k,i)=><td className="p-2" key={k}>
         <input type="number" min="0" max={k==="settlementDays"?365:k==="fixedFee"?10000:99.99}
          step={k==="settlementDays"?"1":"0.01"} disabled={!canEdit||saving} aria-label={k+" "+r.method+" "+r.installments}
          value={r[k]} onChange={e=>patch(r.method,r.installments,{[k]:e.target.value})} className={field}/>
        </td>)}
        <td className="p-2">
         <select className={field} value={r.settlementMode} disabled={!canEdit||saving}
          onChange={e=>patch(r.method,r.installments,{settlementMode:e.target.value as "SINGLE"|"MONTHLY"})}>
          <option value="SINGLE">Único</option>{r.method==="CREDIT"&&<option value="MONTHLY">Mensal (estimado)</option>}
         </select>
        </td>
       </tr>)}</tbody>
      </table>
     </div>
     <footer className="space-y-3 border-t bg-slate-50 p-4">
      <label className="block text-xs font-bold">Referência do contrato ou observação da revisão
       <input value={notes} onChange={e=>setNotes(e.target.value)} disabled={!canEdit||saving}
        maxLength={500} className={"mt-1 "+field} placeholder="Contrato adquirido, data e condições de antecipação"/>
      </label>
      <button type="button" onClick={()=>void publish()} disabled={!canEdit||saving}
       className="inline-flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-40">
       <Save className="h-4 w-4"/>{saving?"Publicando...":"Publicar nova versão das 20 taxas"}
      </button>
      <p className="text-xs text-slate-500">Uma nova versão não reescreve taxas históricas. O contrato oficial da adquirente é a fonte dos percentuais; nenhuma taxa é preenchida automaticamente com valores de mercado.</p>
     </footer>
    </section>
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
     <h2 className="mb-3 flex items-center gap-2 text-sm font-black"><Calculator className="h-4 w-4 text-violet-700"/>Simulador de líquido da loja — sem juros para o cliente</h2>
     <div className="flex flex-wrap items-end gap-3">
      <label className="text-xs font-bold">Valor bruto da venda (R$)
       <input type="number" step="0.01" min="0.01" value={previewGross} onChange={e=>setPreviewGross(e.target.value)}
        className={"mt-1 w-40 "+field}/>
      </label>
      {tab==="CREDIT"&&<label className="text-xs font-bold">Parcelas
       <select value={previewInstallments} onChange={e=>setPreviewInstallments(Number(e.target.value))} className={"mt-1 "+field}>
        {Array.from({length:18},(_,i)=>i+1).map(x=><option key={x} value={x}>{x}x</option>)}
       </select>
      </label>}
     </div>
     {preview?<div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div><p className="text-xs text-slate-500">Cliente paga</p><p className="font-black">{moneyCents(preview.grossCents)}</p></div>
      <div><p className="text-xs text-slate-500">Taxa MDR</p><p className="font-black text-rose-700">− {moneyCents(preview.mdrFeeCents)}</p></div>
      <div><p className="text-xs text-slate-500">Antecipação + fixo</p><p className="font-black text-rose-700">− {moneyCents(preview.anticipationFeeCents+preview.fixedFeeCents)}</p></div>
      <div><p className="text-xs text-slate-500">Líquido previsto para a loja</p><p className="font-black text-emerald-700">{moneyCents(preview.netExpectedCents)}</p></div>
      <p className="col-span-full text-xs text-slate-500">Repasse contratual: {preview.settlementMode==="MONTHLY"?"mensal (parcelas previstas)":"único"} • primeiro prazo D+{preview.settlementDays}. Não representa dinheiro conciliado.</p>
     </div>:<p className="mt-3 text-xs text-amber-700">Habilite e preencha a modalidade para simular. Esta simulação não grava recebimentos.</p>}
    </section>
   </>}
   <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
    <ShieldCheck className="mr-2 inline h-4 w-4"/>Taxas contratuais e previsões não são repasses bancários. Somente um retorno verificável da adquirente e a conciliação poderão confirmar o valor efetivamente liquidado. Nenhuma venda é finalizada nesta tela.
   </div>
  </div>
 </RootShellLayout>;
}
