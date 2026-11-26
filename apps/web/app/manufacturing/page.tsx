"use client";
import React,{useState} from "react";
import RootShellLayout from "@/components/RootShellLayout";
import FactoryWorkspace from "./FactoryWorkspace";

type EstimateLine={id:number;name:string;quantity:string;rate:string};
type EstimateResult={filament:number;supplies:number;energy:number;machine:number;labor:number;wasteProvision:number;other:number;totalCost:number;suggestedPrice:number;contribution:number};
const money=(value:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(value);
function FactoryEstimate(){
 const [filaments,setFilaments]=useState<EstimateLine[]>([{id:1,name:"",quantity:"",rate:""}]);
 const [supplies,setSupplies]=useState<EstimateLine[]>([]);
 const nextId=React.useRef(2);
 const [params,setParams]=useState({seconds:"0",watts:"0",tariff:"0",machineHour:"0",laborSeconds:"0",laborHour:"0",other:"0",wastePct:"0",marginPct:"0",feePct:"0"});
 const [result,setResult]=useState<EstimateResult|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState("");
 const cls="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900";
 const lineGroup=(rows:EstimateLine[],setRows:React.Dispatch<React.SetStateAction<EstimateLine[]>>,isFilament:boolean)=>(
 <div className="space-y-2">
  <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">{isFilament?"Filamentos (por cor ou material)":"Insumos e acessórios"}</h3><button type="button" disabled={rows.length>=100} className="text-xs font-semibold text-purple-700 disabled:opacity-50" onClick={()=>{setRows(old=>[...old,{id:nextId.current++,name:"",quantity:"",rate:""}]);setResult(null);}}>+ Adicionar</button></div>
  {rows.map((line,index)=><div key={line.id} className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_1fr_auto] gap-2 items-end">
   <label className="text-xs text-slate-600">Identificação<input className={cls} value={line.name} maxLength={120} placeholder={isFilament?"Material / cor":"Ex.: argola"} onChange={ev=>setRows(old=>old.map(x=>x.id===line.id?{...x,name:ev.target.value}:x))}/></label>
   <label className="text-xs text-slate-600">{isFilament?"Gramas":"Quantidade"}<input className={cls} type="number" required min="0.001" max="1000000" step="0.001" value={line.quantity} onChange={ev=>setRows(old=>old.map(x=>x.id===line.id?{...x,quantity:ev.target.value}:x))}/></label>
   <label className="text-xs text-slate-600">{isFilament?"R$/kg":"R$/un."}<input className={cls} type="number" required min="0" max="1000000" step="0.000001" value={line.rate} onChange={ev=>setRows(old=>old.map(x=>x.id===line.id?{...x,rate:ev.target.value}:x))}/></label>
   <button type="button" aria-label={"Remover linha "+(index+1)} className="rounded-lg border px-3 py-2 text-xs text-slate-600" onClick={()=>{setRows(old=>old.filter(x=>x.id!==line.id));setResult(null);}}>Remover</button>
  </div>)}
  {rows.length===0&&<p className="text-xs text-slate-500">Nenhum item informado.</p>}
 </div>);
 const submit=async(ev:React.FormEvent)=>{
  ev.preventDefault();if(busy)return;setBusy(true);setError("");setResult(null);
  try{
   const input={...Object.fromEntries(Object.entries(params).map(([k,v])=>[k,Number(v)])),filaments:filaments.map(x=>({grams:Number(x.quantity),costPerKg:Number(x.rate)})),supplies:supplies.map(x=>({quantity:Number(x.quantity),unitCost:Number(x.rate)}))};
   const res=await fetch("/api/manufacturing/estimate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(input),cache:"no-store"});
   const data=await res.json();if(!res.ok)throw new Error(data.error||"Não foi possível calcular.");
   if(data.version!==1||!data.estimate||!Number.isFinite(data.estimate.totalCost)||!Number.isFinite(data.estimate.suggestedPrice))throw new Error("Resposta de cálculo inválida.");
   setResult(data.estimate);
  }catch(err){setError(err instanceof Error?err.message:"Falha ao calcular.");}finally{setBusy(false);}
 };
 const fields:[keyof typeof params,string,string][]=[["seconds","Tempo total (segundos)","1"],["watts","Potência média (W)","0.01"],["tariff","Energia (R$/kWh)","0.000001"],["machineHour","Máquina (R$/h, sem energia e mão de obra)","0.000001"],["laborSeconds","Tempo de trabalho humano (segundos)","1"],["laborHour","Mão de obra (R$/h)","0.000001"],["other","Outros custos diretos (R$)","0.000001"],["wastePct","Provisão de desperdício de filamento (%)","0.01"],["marginPct","Margem sobre a venda (%)","0.01"],["feePct","Taxas sobre a venda (%)","0.01"]];
 return <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
  <form onSubmit={submit} onChange={()=>setResult(null)} className="lg:col-span-2 rounded-xl border bg-white p-6 space-y-4">
   <h2 className="text-base font-bold">Estimativa de fabricação</h2><p className="text-xs text-slate-500">Valores manuais para precificação. Não registra OS, reserva material nem efetua baixa de estoque.</p>
   <fieldset disabled={busy} className="space-y-5">
    {lineGroup(filaments,setFilaments,true)}{lineGroup(supplies,setSupplies,false)}
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{fields.map(([key,label,step])=><label key={key} className="text-xs text-slate-600">{label}<input className={cls} type="number" min="0" max={key.endsWith("Pct")?100:key.endsWith("Seconds")||key==="seconds"?31536000:1000000} step={step} required value={params[key]} onChange={ev=>setParams(old=>({...old,[key]:ev.target.value}))}/></label>)}</div>
    <button type="submit" className="rounded-lg bg-purple-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy?"Calculando…":"Calcular estimativa"}</button>
   </fieldset>
   {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
  </form>
  <div className="rounded-xl border bg-white p-6 space-y-3" aria-live="polite"><h3 className="font-bold text-sm">Composição do custo estimado</h3>
   {!result?<p className="text-xs text-slate-500">Informe os parâmetros e calcule no servidor.</p>:<>
    {([["Filamentos",result.filament],["Insumos",result.supplies],["Energia",result.energy],["Máquina",result.machine],["Mão de obra",result.labor],["Provisão de desperdício",result.wasteProvision],["Outros",result.other]] as [string,number][]).map(([label,value])=><div key={label} className="flex justify-between border-b border-slate-100 py-2 text-xs"><span>{label}</span><strong>{money(value)}</strong></div>)}
    <div className="flex justify-between text-sm"><span>Custo estimado</span><strong>{money(result.totalCost)}</strong></div>
    <div className="flex justify-between text-sm"><span>Contribuição estimada</span><strong>{money(result.contribution)}</strong></div>
    <div className="flex justify-between text-base font-bold text-purple-700"><span>Preço sugerido</span><strong>{money(result.suggestedPrice)}</strong></div>
    <p className="text-xs text-slate-500">Estimativa v1 — preço arredondado para cima em centavos. Componentes exibidos em centavos; apuração interna com precisão decimal.</p>
   </>}
  </div>
 </div>;
}


export default function ManufacturingPage(){return <RootShellLayout><FactoryWorkspace estimator={<FactoryEstimate/>}/></RootShellLayout>;}
