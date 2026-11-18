"use client";
import React,{useCallback,useEffect,useState} from "react";
import Link from "next/link";
import {useAuth} from "@/lib/auth";
import {Gift,Coins,History,RefreshCw,AlertTriangle,CheckCircle2,ShieldCheck} from "lucide-react";

type LoyaltyDetail={customerId:string;pointsBalance:number;lifetimeEarned:number;lifetimeRedeemed:number;ledger:Array<{id:string;kind:string;pointsDelta:number;reason:string;createdAt:string;saleNumber:string|null}>;redemptions:Array<{id:string;title:string;status:string;pointsSpent:number;createdAt:string}>};
type Reward={id:string;title:string;description:string|null;kind:string;pointsCost:number;discountCents:number|null;discountPercent:number|null;stockTotal:number|null;stockAllocated:number;isActive:boolean};
type Settings={configured:boolean;settings:{enabled:boolean;earnEveryCents:number;pointsPerStep:number}|null};
export default function CustomerLoyaltyPanel({partyId,name}:{partyId:string;name:string}){
 const {hasPermission}=useAuth();
 const canView=hasPermission("loyalty.view"),canRedeem=hasPermission("loyalty.redeem");
 const [detail,setDetail]=useState<LoyaltyDetail|null>(null),[rewards,setRewards]=useState<Reward[]>([]),[policy,setPolicy]=useState<Settings|null>(null);
 const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const load=useCallback(async()=>{
  if(!canView){setLoading(false);return;}
  setLoading(true);setError("");
  try{
   const requests=[fetch("/api/loyalty/customers/"+partyId,{cache:"no-store"}),fetch("/api/loyalty/rewards",{cache:"no-store"}),fetch("/api/loyalty/settings",{cache:"no-store"})];
   const responses=await Promise.all(requests);
   for(const response of responses)if(!response.ok){
    const data=await response.json().catch(()=>({}));
    throw new Error(data.error||"Consulta de fidelidade indisponível. HTTP "+response.status);
   }
   const [customer,rewardData,policyData]=await Promise.all(responses.map(r=>r.json()));
   setDetail(customer);setRewards(rewardData.rewards||[]);setPolicy(policyData);
  }catch(e){setDetail(null);setError(e instanceof Error?e.message:"Falha ao consultar fidelidade no Neon.");}
  finally{setLoading(false);}
 },[partyId,canView]);
 useEffect(()=>{void load();},[load]);
 async function redeem(reward:Reward){
  if(!canRedeem||!detail||saving)return;
  if(!window.confirm("Reservar "+reward.title+" por "+reward.pointsCost+" pontos de "+name+"? O benefício não será automaticamente aplicado no PDV."))return;
  setSaving(true);setError("");setNotice("");
  try{
   const response=await fetch("/api/loyalty/redemptions",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({partyId,rewardId:reward.id,idempotencyKey:crypto.randomUUID()})});
   const data=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(data.error||"Não foi possível reservar a recompensa.");
   setNotice("Reserva de benefício confirmada. Pontos debitados no Neon; entrega e descontos continuam pendentes.");
   await load();
  }catch(e){setError(e instanceof Error?e.message:"Resgate não efetuado.");}
  finally{setSaving(false);}
 }
 if(!canView)return <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-xs text-amber-700">A consulta exige a permissão <strong>loyalty.view</strong>. Nenhum saldo foi inventado.</div>;
 return <div className="space-y-5">
  <div className="rounded-3xl bg-gradient-to-r from-violet-900 via-purple-900 to-indigo-950 p-6 text-white shadow-lg">
   <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="flex items-center gap-2 text-[11px] font-black uppercase text-purple-200"><Gift className="h-4 w-4"/> Clube HB • Conta real</p><h2 className="mt-2 text-xl font-black">{name}</h2><p className="mt-2 text-xs text-purple-200">{policy?.settings?.enabled?"Programa ativo • "+policy.settings.pointsPerStep+" ponto(s) a cada R$ "+(policy.settings.earnEveryCents/100).toFixed(2):"Programa não configurado ou desativado"}</p></div>
    <div className="rounded-2xl border border-white/20 bg-white/10 p-4"><p className="text-[10px] font-bold uppercase text-purple-200">Saldo real em pontos</p><p className="mt-1 text-3xl font-black text-amber-300">{loading?"—":detail?Number(detail.pointsBalance).toLocaleString("pt-BR"):"Indisponível"} <span className="text-xs text-purple-100">pts</span></p></div></div>
  </div>
  {error&&<div role="alert" className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700"><AlertTriangle className="h-4 w-4"/>{error}</div>}
  {notice&&<div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-700"><CheckCircle2 className="h-4 w-4"/>{notice}</div>}
  <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-slate-600">Benefícios reservados não são descontos financeiros aplicados no PDV.</p><div className="flex gap-2"><button type="button" onClick={()=>void load()} disabled={loading} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold"><RefreshCw className="h-3.5 w-3.5"/> Atualizar</button><Link href="/loyalty" className="rounded-xl bg-purple-700 px-3 py-2 text-xs font-bold text-white">Gerenciar clube</Link></div></div>
  {detail&&<><div className="grid gap-3 md:grid-cols-3">{[["Pontos recebidos",detail.lifetimeEarned],["Pontos em benefícios",detail.lifetimeRedeemed],["Saldo restante",detail.pointsBalance]].map(([title,value])=><div key={String(title)} className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-[11px] font-bold text-slate-500">{title}</p><strong className="mt-2 block text-xl font-black text-purple-700">{Number(value).toLocaleString("pt-BR")} pts</strong></div>)}</div>
   <div className="rounded-2xl border border-slate-200 bg-white p-5"><h3 className="flex items-center gap-2 text-sm font-black"><Gift className="h-4 w-4 text-violet-700"/> Brindes, vales e descontos cadastrados</h3>
   <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{rewards.length===0?<p className="text-xs text-slate-400">Nenhum benefício cadastrado no Neon.</p>:rewards.map(r=>{
    const availability=r.stockTotal===null||r.stockAllocated<r.stockTotal;
    const canUse=!!policy?.settings?.enabled&&canRedeem&&Number(detail.pointsBalance)>=Number(r.pointsCost)&&availability;
    return <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4" key={r.id}><div><p className="text-sm font-black text-slate-900">{r.title}</p><p className="mt-1 text-xs text-slate-500">{r.description||"Sem descrição"}</p><p className="mt-2 text-xs font-bold text-violet-700">{Number(r.pointsCost).toLocaleString("pt-BR")} pts • {r.kind==="GIFT"?"Brinde":r.kind==="DISCOUNT_FIXED"?"Vale de R$ "+(Number(r.discountCents)/100).toFixed(2):r.discountPercent+"% de desconto"}</p></div>
    <button type="button" disabled={!canUse||saving} onClick={()=>void redeem(r)} className="mt-4 rounded-xl bg-purple-700 px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300">{!availability?"Esgotado":!canRedeem?"Acesso limitado":!policy?.settings?.enabled?"Programa inativo":Number(detail.pointsBalance)<Number(r.pointsCost)?"Saldo insuficiente":"Reservar benefício"}</button></div>;
   })}</div></div>
   <div className="rounded-2xl border border-slate-200 bg-white p-5"><h3 className="flex items-center gap-2 text-sm font-black"><History className="h-4 w-4 text-violet-700"/> Extrato auditável de pontos</h3>
    <div className="mt-4 divide-y divide-slate-100">{detail.ledger.length===0?<p className="py-6 text-xs text-slate-400">Nenhum lançamento de pontos registrado até agora.</p>:detail.ledger.map(x=><div key={x.id} className="flex justify-between gap-3 py-3 text-xs"><div><p className="font-bold text-slate-800">{x.reason}</p><p className="text-[10px] text-slate-400">{new Date(x.createdAt).toLocaleString("pt-BR")} {x.saleNumber?"• "+x.saleNumber:""}</p></div><strong className={Number(x.pointsDelta)>=0?"text-emerald-700":"text-rose-600"}>{Number(x.pointsDelta)>0?"+":""}{Number(x.pointsDelta).toLocaleString("pt-BR")} pts</strong></div>)}</div></div>
   <div className="rounded-2xl border border-slate-200 bg-white p-5"><h3 className="flex items-center gap-2 text-sm font-black"><ShieldCheck className="h-4 w-4 text-purple-700"/> Resgates do cliente</h3><div className="mt-3 space-y-2">{detail.redemptions.length===0?<p className="text-xs text-slate-400">Nenhum resgate.</p>:detail.redemptions.map(r=><div key={r.id} className="flex justify-between gap-3 border-b border-slate-100 p-2 text-xs"><span>{r.title}</span><span className="font-bold">{r.status==="RESERVED"?"Reservado":r.status==="FULFILLED"?"Entregue":"Cancelado"} • {r.pointsSpent} pts</span></div>)}</div></div>
  </>}
 </div>;
}
