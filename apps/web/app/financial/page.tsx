"use client";

import {useCallback,useEffect,useMemo,useState} from "react";
import RootShellLayout from "@/components/RootShellLayout";
import {useAuth} from "@/lib/auth";
import {Wallet,FileSpreadsheet,RefreshCw,AlertTriangle,LockKeyhole,Receipt,ArrowDownRight,ArrowUpRight} from "lucide-react";

type TitleRow={id:string;titleNumber:string;description:string;dueDate:string;originalAmount:number;settledAmount:number;balance:number;status:number;party:string};
type JournalRow={id:string;documentNumber:string;description:string;sourceType:string;competenceDate:string;recordedTotal:number;debits:number;credits:number;lineCount:number};
type Report={journals:JournalRow[];payables:TitleRow[];receivables:TitleRow[];
 allowed:{payables:boolean;receivables:boolean};journalIntegrity:{reviewed:number;inconsistent:number;unbalancedEntryIds:string[]};dreAvailable:false;note:string};
const money=(n:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(n);
const date=(s:string)=>new Intl.DateTimeFormat("pt-BR",{dateStyle:"short"}).format(new Date(s));
const nav="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700";
export default function FinancialPage(){
 const {hasPermission,isLoading:authLoading}=useAuth();
 const canView=hasPermission("finance.reports.view");
 const [report,setReport]=useState<Report|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState("");
 const [tab,setTab]=useState<"journal"|"payables"|"receivables"|"dre">("journal");
 const load=useCallback(async()=>{
  setLoading(true);setError("");
  try{
   const res=await fetch("/api/financial/overview",{cache:"no-store"});
   const json=await res.json().catch(()=>({}));
   if(!res.ok)throw new Error(json.error||"Não foi possível consultar o financeiro.");
   setReport(json);
  }catch(e){setReport(null);setError(e instanceof Error?e.message:"Dados financeiros indisponíveis.");}
  finally{setLoading(false);}
 },[]);
 useEffect(()=>{if(!authLoading&&canView)void load();},[authLoading,canView,load]);
 const totalPayables=useMemo(()=>report?.payables.reduce((n,p)=>n+p.balance,0)||0,[report]);
 const totalReceivables=useMemo(()=>report?.receivables.reduce((n,p)=>n+p.balance,0)||0,[report]);
 if(!authLoading&&!canView)return <RootShellLayout><div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">Sem permissão para consultar relatórios financeiros.</div></RootShellLayout>;
 return <RootShellLayout>
  <div className="space-y-5">
   <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div><span className="rounded-lg bg-violet-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-violet-700">Controladoria e Financeiro</span>
     <h1 className="mt-2 text-xl font-extrabold text-slate-900">Financeiro Geral & Integridade Contábil</h1>
     <p className="mt-1 max-w-xl text-xs text-slate-500">Contas e partidas contábeis persistidas no Neon, separadas por empresa e filial.</p></div>
    <button onClick={()=>void load()} disabled={loading} className={nav+" inline-flex items-center gap-2 disabled:opacity-50"}><RefreshCw className="h-4 w-4"/>{loading?"Consultando...":"Atualizar"}</button>
   </header>
   {error&&<div role="alert" className="flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-800"><AlertTriangle className="h-4 w-4 shrink-0"/>{error}</div>}
   <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
    <div className="rounded-2xl border border-slate-200 bg-white p-5"><ArrowDownRight className="h-5 w-5 text-rose-600"/><div className="mt-2 text-2xl font-black text-slate-900">{report&&report.allowed.payables?money(totalPayables):"—"}</div><p className="text-xs text-slate-500">Saldo dos títulos a pagar consultados</p></div>
    <div className="rounded-2xl border border-slate-200 bg-white p-5"><ArrowUpRight className="h-5 w-5 text-blue-600"/><div className="mt-2 text-2xl font-black text-slate-900">{report&&report.allowed.receivables?money(totalReceivables):"—"}</div><p className="text-xs text-slate-500">Saldo dos títulos a receber consultados</p></div>
    <div className="rounded-2xl border border-slate-200 bg-white p-5"><FileSpreadsheet className="h-5 w-5 text-violet-700"/><div className="mt-2 text-2xl font-black text-slate-900">{report?report.journalIntegrity.inconsistent:"—"}</div><p className="text-xs text-slate-500">Lançamentos com divergência contábil</p></div>
   </section>
   <nav className="flex flex-wrap gap-2" aria-label="Seções financeiras">
    <button onClick={()=>setTab("journal")} className={nav+(tab==="journal"?" border-violet-500 bg-violet-50 text-violet-700":"")}>Razão e integridade</button>
    <button onClick={()=>setTab("payables")} disabled={!!report&&!report.allowed.payables} className={nav+(tab==="payables"?" border-violet-500 bg-violet-50 text-violet-700":"")+" disabled:opacity-40"}>A pagar</button>
    <button onClick={()=>setTab("receivables")} disabled={!!report&&!report.allowed.receivables} className={nav+(tab==="receivables"?" border-violet-500 bg-violet-50 text-violet-700":"")+" disabled:opacity-40"}>A receber</button>
    <button onClick={()=>setTab("dre")} className={nav+(tab==="dre"?" border-violet-500 bg-violet-50 text-violet-700":"")}>DRE — em homologação</button>
   </nav>
   <section className="rounded-2xl border border-slate-200 bg-white p-5">
    {!report?<div className="p-4 text-sm text-slate-500">{loading?"Consultando os registros...":"Dados indisponíveis; não serão exibidos valores artificiais."}</div>:tab==="dre"?
     <div className="space-y-3 p-4"><LockKeyhole className="h-6 w-6 text-amber-700"/><h2 className="font-extrabold text-slate-900">DRE gerencial ainda não homologada</h2><p className="text-sm text-slate-600">O plano de contas precisa ser classificado por receita, deduções, custos, despesas e competência antes de gerar margem ou lucro. Valores zerados não significam resultado financeiro real.</p></div>:
     tab==="journal"?<>
      <div className="mb-3 flex flex-wrap justify-between gap-2"><h2 className="font-extrabold text-slate-900">Lançamentos contábeis</h2><span className="text-xs text-slate-500">{report.journalIntegrity.reviewed} registros consultados (até 150)</span></div>
      {report.journalIntegrity.inconsistent>0&&<div role="alert" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-800">Foram identificados {report.journalIntegrity.inconsistent} lançamentos com débito/crédito divergente, total incompatível ou menos de duas partidas.</div>}
      {report.journals.length===0?<p className="text-sm text-slate-500">Não há lançamentos contábeis nesta filial.</p>:
       <div className="overflow-x-auto"><table className="w-full min-w-[660px] text-left text-xs">
        <thead className="bg-slate-50 text-slate-600"><tr><th className="p-3">Documento</th><th className="p-3">Competência</th><th className="p-3">Origem</th><th className="p-3 text-right">Débitos</th><th className="p-3 text-right">Créditos</th><th className="p-3">Validação</th></tr></thead>
        <tbody className="divide-y divide-slate-100">{report.journals.map(e=><tr key={e.id}><td className="p-3 font-bold">{e.documentNumber}<p className="mt-1 max-w-xs truncate font-normal text-slate-500">{e.description}</p></td><td className="p-3">{date(e.competenceDate)}</td><td className="p-3">{e.sourceType}</td><td className="p-3 text-right">{money(e.debits)}</td><td className="p-3 text-right">{money(e.credits)}</td>
         <td className={"p-3 font-bold "+(report.journalIntegrity.unbalancedEntryIds.includes(e.id)?"text-rose-700":"text-emerald-700")}>{report.journalIntegrity.unbalancedEntryIds.includes(e.id)?"Revisar":"Balanceado"}</td></tr>)}</tbody>
       </table></div>}
     </>:<>
      <h2 className="mb-3 font-extrabold text-slate-900">{tab==="payables"?"Contas a Pagar":"Contas a Receber"}</h2>
      {!(tab==="payables"?report.allowed.payables:report.allowed.receivables)?<p className="text-sm text-slate-500">Acesso não autorizado.</p>:
       (tab==="payables"?report.payables:report.receivables).length===0?<p className="text-sm text-slate-500">Nenhum título encontrado nesta filial.</p>:
       <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-xs"><thead className="bg-slate-50 text-slate-600"><tr><th className="p-3">Título</th><th className="p-3">Pessoa</th><th className="p-3">Vencimento</th><th className="p-3 text-right">Original</th><th className="p-3 text-right">Quitado</th><th className="p-3 text-right">Saldo</th></tr></thead>
        <tbody className="divide-y divide-slate-100">{(tab==="payables"?report.payables:report.receivables).map(t=><tr key={t.id}><td className="p-3 font-bold">{t.titleNumber}</td><td className="p-3">{t.party}</td><td className="p-3">{date(t.dueDate)}</td><td className="p-3 text-right">{money(t.originalAmount)}</td><td className="p-3 text-right">{money(t.settledAmount)}</td><td className="p-3 text-right font-extrabold">{money(t.balance)}</td></tr>)}</tbody>
       </table></div>}
     </>}
   </section>
   <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800"><Receipt className="mr-2 inline h-4 w-4"/>Não há criação de pagamentos, alteração de títulos, conciliação bancária ou lançamento contábil nesta tela até o fluxo PDV–Caixa–Financeiro ser homologado. A consulta é limitada aos 150 registros mais recentes por tipo.</div>
  </div>
 </RootShellLayout>;
}
