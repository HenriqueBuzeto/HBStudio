"use client";
import React,{useCallback,useEffect,useMemo,useRef,useState} from "react";
import {Award,Gift,Coins,RefreshCw,AlertTriangle,CheckCircle2,Clock3,ShieldCheck,LockKeyhole,ArrowDownUp} from "lucide-react";
import {useAuth} from "@/lib/auth";

type LoyaltyAccount={pointsBalance:string|number;lifetimeEarned:string|number;lifetimeRedeemed:string|number;cashbackCents:string|number;eligibleSpendCents:string|number;purchasesCount:number};
type Reward={id:string;kind:"GIFT"|"SERVICE"|"VOUCHER"|"DISCOUNT";title:string;description:string|null;pointsCost:number;valueCents:string|number;stockAvailable:number|null;isActive:boolean;startsAtUtc:string|null;endsAtUtc:string|null};
type Ledger={id:string;kind:string;points:string|number;cashbackCents:string|number;eligibleSpendCents:string|number;eventKey:string;saleId:string|null;redemptionId:string|null;createdAtUtc:string};
type Redemption={id:string;title:string;kind:string;points:number;code:string;status:string;createdAtUtc:string;fulfilledAtUtc:string|null;notes:string|null};
type Data={party:{id:string;name:string;isActive:boolean};account:LoyaltyAccount;accountExists:boolean;tier:string;program:null|{enabled:boolean;earnCentsPerPoint:number;cashbackBps:number;silverAtPoints:number;goldAtPoints:number;diamondAtPoints:number};rewards:Reward[];ledger:Ledger[];redemptions:Redemption[];capabilities:{redeem:boolean;fulfill:boolean;voucherCheckout:boolean};note:string};
const money=(cents:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(cents/100);
const integer=(v:number|string)=>Number(v).toLocaleString("pt-BR");
const formatDate=(value:string)=>new Date(value).toLocaleString("pt-BR",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});
const kindName:Record<string,string>={GIFT:"Brinde",SERVICE:"Serviço",VOUCHER:"Vale-compra",DISCOUNT:"Desconto"};
const ledgerName:Record<string,string>={SALE_EARN:"Venda confirmada",SALE_REVERSAL:"Estorno de venda",REDEEM:"Resgate reservado",REDEEM_REFUND:"Resgate cancelado"};
async function getJson(url:string,init?:RequestInit){
 const response=await fetch(url,{cache:"no-store",credentials:"same-origin",...init});
 const data=await response.json().catch(()=>null);
 if(!response.ok)throw new Error(data?.error||"Falha HTTP "+response.status+" ao consultar o Neon.");
 return data;
}
export default function CustomerLoyaltyPanel({partyId}:{partyId:string}){
 const {hasPermission,isLoading:authLoading}=useAuth();
 const [data,setData]=useState<Data|null>(null),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false);
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const [tab,setTab]=useState<"rewards"|"ledger"|"redemptions">("rewards");
 const requestKeys=useRef<Record<string,string>>({});
 const reload=useCallback(async()=>{
  setLoading(true);setError("");
  try{setData(await getJson("/api/loyalty/customers/"+encodeURIComponent(partyId)));}
  catch(e){setData(null);setError(e instanceof Error?e.message:"Não foi possível carregar o extrato do cliente.");}
  finally{setLoading(false);}
 },[partyId]);
 useEffect(()=>{if(!authLoading)void reload();},[authLoading,reload]);
 const available=Number(data?.account.pointsBalance||0);
 const progress=useMemo(()=>{
  if(!data?.program)return 0;
  const e=Number(data.account.lifetimeEarned);
  const targets=[data.program.silverAtPoints,data.program.goldAtPoints,data.program.diamondAtPoints];
  const next=targets.find(t=>e<t);
  return next?Math.max(0,Math.min(100,(e/next)*100)):100;
 },[data]);
 const redeem=async(reward:Reward)=>{
  if(!data||saving||!data.capabilities.redeem||reward.kind==="VOUCHER"||reward.kind==="DISCOUNT")return;
  if(!window.confirm("Reservar "+reward.title+" por "+reward.pointsCost+" pontos para "+data.party.name+"? Os pontos serão debitados imediatamente e a entrega ficará pendente."))return;
  const key=requestKeys.current[reward.id]||crypto.randomUUID();
  requestKeys.current[reward.id]=key;
  setSaving(true);setError("");setNotice("");
  try{
   const r=await getJson("/api/loyalty/customers/"+encodeURIComponent(partyId)+"/redeem",{
    method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({rewardId:reward.id,requestKey:key})
   });
   delete requestKeys.current[reward.id];
   setNotice("Reserva "+r.code+" registrada com sucesso. A entrega precisa de confirmação no painel de Fidelidade.");
   await reload();
  }catch(e){setError(e instanceof Error?e.message:"Resgate não confirmado. Tente novamente com a mesma solicitação.");}
  finally{setSaving(false);}
 };
 if(authLoading||loading)return <div role="status" className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-xs text-slate-500">Consultando saldo, regras e extrato reais no Neon...</div>;
 if(!hasPermission("loyalty.view"))return <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">Você precisa da permissão <code>loyalty.view</code> para consultar as informações do clube.</div>;
 if(!data)return <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-xs text-rose-800">{error||"Programa indisponível."} <button onClick={()=>void reload()} className="ml-2 font-bold underline">Tentar novamente</button></div>;
 return <div className="space-y-5">
  {error&&<div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-800">{error}</div>}
  {notice&&<div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800">{notice}</div>}
  <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-900 via-indigo-950 to-slate-950 p-6 text-white shadow-xl">
   <div className="relative z-10 flex flex-wrap items-start justify-between gap-5">
    <div>
     <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-purple-200"><Award className="h-4 w-4"/> Clube HB Studio • {data.tier}</p>
     <h3 className="mt-2 text-xl font-black">{data.party.name}</h3>
     <p className="mt-1 text-xs text-purple-200">{data.program?.enabled?"Programa ativo. Créditos concedidos apenas em vendas confirmadas e pagas.":"Programa não habilitado nesta empresa."}</p>
    </div>
    <div className="rounded-2xl border border-white/20 bg-white/10 p-4 text-right">
     <p className="text-[10px] uppercase tracking-widest text-purple-200">Saldo de pontos</p>
     <p className="text-3xl font-black text-amber-300">{integer(available)} <span className="text-sm">pts</span></p>
     {available<0&&<span className="text-xs text-rose-200">Saldo devedor por estorno — resgate bloqueado</span>}
    </div>
   </div>
   <div className="relative z-10 mt-5 grid grid-cols-2 gap-3 border-t border-white/20 pt-4 sm:grid-cols-4">
    <div><span className="text-[10px] text-purple-200">Pontos acumulados</span><p className="text-lg font-bold">{integer(data.account.lifetimeEarned)}</p></div>
    <div><span className="text-[10px] text-purple-200">Pontos resgatados</span><p className="text-lg font-bold">{integer(data.account.lifetimeRedeemed)}</p></div>
    <div><span className="text-[10px] text-purple-200">Compras pontuadas</span><p className="text-lg font-bold">{integer(data.account.purchasesCount)}</p></div>
    <div><span className="text-[10px] text-purple-200">Cashback acumulado*</span><p className="text-lg font-bold">{money(Number(data.account.cashbackCents))}</p></div>
   </div>
   <div className="relative z-10 mt-4"><div className="h-1.5 rounded-full bg-white/20"><div className="h-full rounded-full bg-amber-300" style={{width:progress+"%"}}/></div><p className="mt-1 text-[10px] text-purple-200">Progresso do nível calculado pelos pontos obtidos, sem pontuações fictícias.</p></div>
  </section>
  <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-600">
   {data.program?("Regra vigente: 1 ponto a cada "+money(data.program.earnCentsPerPoint)+" em valor elegível pago. Cashback configurado: "+(data.program.cashbackBps/100).toFixed(2)+"%. "):"Política não encontrada. "}
   *O cashback mostrado é crédito acumulado; utilização em vendas e vales requer homologação do checkout. Não representa dinheiro disponível para saque.
  </p>
  <div className="flex flex-wrap items-center justify-between gap-2">
   <div className="flex gap-2 rounded-xl border border-slate-200 bg-white p-1 text-xs font-bold">
    {(["rewards","ledger","redemptions"] as const).map(t=><button key={t} onClick={()=>setTab(t)}
      className={"rounded-lg px-3 py-2 "+(tab===t?"bg-purple-600 text-white":"text-slate-600 hover:bg-purple-50")}>{t==="rewards"?"Brindes & Vales":t==="ledger"?"Extrato":"Meus Resgates"}</button>)}
   </div>
   <button type="button" onClick={()=>void reload()} disabled={saving} className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600"><RefreshCw className="h-3.5 w-3.5"/> Atualizar</button>
  </div>
  {tab==="rewards"&&<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
   {!data.rewards.length&&<div className="col-span-full rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-xs text-slate-500">Nenhuma recompensa ativa cadastrada. Gerencie o catálogo na tela Clube & Fidelidade.</div>}
   {data.rewards.map(r=>{
    const notReady=r.kind==="VOUCHER"||r.kind==="DISCOUNT";
    const inDate=(!r.startsAtUtc||Date.parse(r.startsAtUtc)<=Date.now())&&(!r.endsAtUtc||Date.parse(r.endsAtUtc)>Date.now());
    const canRedeem=data.party.isActive&&data.program?.enabled&&data.capabilities.redeem&&!notReady&&inDate&&(r.stockAvailable===null||r.stockAvailable>0)&&available>=r.pointsCost;
    return <article key={r.id} className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
     <div>
      <div className="flex justify-between gap-2"><span className="rounded-lg bg-purple-50 px-2 py-1 text-[10px] font-bold text-purple-700">{kindName[r.kind]}</span><span className="font-mono text-xs font-black text-amber-600">{integer(r.pointsCost)} pts</span></div>
      <h4 className="mt-3 text-sm font-black text-slate-900">{r.title}</h4>
      <p className="mt-1 text-xs text-slate-500">{r.description||"Recompensa promocional cadastrada."}</p>
      <p className="mt-2 text-[11px] text-slate-500">Valor comercial: {money(Number(r.valueCents))} • {r.stockAvailable===null?"Sem cota definida":"Estoque promocional: "+r.stockAvailable}</p>
     </div>
     <button type="button" disabled={!canRedeem||saving} onClick={()=>void redeem(r)} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-purple-600 px-3 py-2.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"><Gift className="h-4 w-4"/>
      {notReady?"Aguarda checkout homologado":!inDate?"Fora do período":r.stockAvailable===0?"Sem estoque":available<r.pointsCost?"Faltam "+integer(r.pointsCost-available)+" pts":!data.capabilities.redeem?"Sem permissão de resgate":"Reservar resgate"}
     </button>
    </article>;
   })}
  </div>}
  {tab==="ledger"&&<div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
   <table className="w-full text-left text-xs"><thead className="bg-slate-50 text-slate-500"><tr><th className="p-3">Data</th><th className="p-3">Evento auditável</th><th className="p-3">Pontos</th><th className="p-3">Crédito cashback</th></tr></thead>
    <tbody>{data.ledger.map(l=><tr key={l.id} className="border-t border-slate-100"><td className="p-3 whitespace-nowrap">{formatDate(l.createdAtUtc)}</td><td className="p-3 font-semibold">{ledgerName[l.kind]||l.kind}<span className="mt-1 block font-mono text-[10px] text-slate-400">{l.saleId?"Venda "+l.saleId.slice(0,8):l.redemptionId?"Resgate "+l.redemptionId.slice(0,8):""}</span></td><td className={"p-3 font-mono font-black "+(Number(l.points)>=0?"text-emerald-700":"text-rose-700")}>{Number(l.points)>0?"+":""}{integer(l.points)}</td><td className="p-3">{money(Number(l.cashbackCents))}</td></tr>)}
     {!data.ledger.length&&<tr><td colSpan={4} className="p-10 text-center text-slate-500">Sem lançamentos de pontos. Apenas vendas efetivamente pagas geram lançamentos.</td></tr>}
    </tbody>
   </table>
  </div>}
  {tab==="redemptions"&&<div className="space-y-3">
   {!data.redemptions.length&&<div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-xs text-slate-500">Nenhum resgate registrado.</div>}
   {data.redemptions.map(r=><div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-xs">
    <div><h4 className="font-extrabold text-slate-900">{r.title}</h4><p className="mt-1 font-mono text-slate-500">{r.code} • {formatDate(r.createdAtUtc)}</p></div>
    <div className="text-right"><span className="block font-black text-purple-700">−{integer(r.points)} pts</span><span className="mt-1 inline-block rounded-lg bg-slate-100 px-2 py-1 font-semibold text-slate-700">{r.status==="RESERVED"?"Aguardando entrega":r.status==="FULFILLED"?"Entregue":r.status==="CANCELLED"?"Cancelado":r.status}</span></div>
   </div>)}
  </div>}
 </div>;
}
