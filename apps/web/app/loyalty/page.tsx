"use client";
import React,{useCallback,useEffect,useMemo,useState} from "react";
import RootShellLayout from "@/components/RootShellLayout";
import CustomerLoyaltyPanel from "@/components/CustomerLoyaltyPanel";
import {useAuth} from "@/lib/auth";
import {Award,Gift,Coins,WalletCards,RefreshCw,Plus,Search,ShieldCheck,AlertTriangle,CheckCircle2,Users,Settings2,BookOpen,Clock3,ChevronRight,LockKeyhole,Package,Percent,X,Check,Undo2} from "lucide-react";

type Program={id:string;enabled:boolean;earnCentsPerPoint:number;cashbackBps:number;silverAtPoints:number;goldAtPoints:number;diamondAtPoints:number;version:number};
type Reward={id:string;kind:"GIFT"|"SERVICE"|"VOUCHER"|"DISCOUNT";title:string;description:string|null;pointsCost:number;valueCents:string|number;stockAvailable:number|null;isActive:boolean;startsAtUtc:string|null;endsAtUtc:string|null;version:number};
type Summary={activeAccounts:number;availablePoints:string|number;lifetimeEarned:string|number;lifetimeRedeemed:string|number;cashbackCents:string|number;rewardedPurchases:string|number};
type Client={id:string;name:string;isActive:boolean;points:string|number;earned:string|number;redeemed:string|number;cashbackCents:string|number;spentCents:string|number;purchases:number};
type Redemption={id:string;partyId:string;customerName:string;title:string;points:number;kind:string;status:string;code:string;createdAtUtc:string;fulfilledAtUtc:string|null;notes:string|null};
type Ledger={id:string;partyId:string;customerName:string;kind:string;points:string|number;cashbackCents:string|number;eventKey:string;saleId:string|null;createdAtUtc:string};
type Overview={program:Program|null;rewards:Reward[];summary:Summary;customers:Client[];redemptions:Redemption[];ledger:Ledger[];capabilities:{manage:boolean;redeem:boolean;fulfill:boolean;voucherCheckout:boolean};information:string};
type RewardForm={kind:Reward["kind"];title:string;description:string;pointsCost:string;valueReais:string;stockAvailable:string;isActive:boolean;startsAtUtc:string;endsAtUtc:string};
const emptyReward:RewardForm={kind:"GIFT",title:"",description:"",pointsCost:"",valueReais:"",stockAvailable:"",isActive:false,startsAtUtc:"",endsAtUtc:""};
const kindLabel:Record<string,string>={GIFT:"Brinde físico",SERVICE:"Serviço gratuito",VOUCHER:"Vale-compra",DISCOUNT:"Desconto no PDV"};
const eventName:Record<string,string>={SALE_EARN:"Venda quitada",SALE_REVERSAL:"Estorno integral",REDEEM:"Reserva de brinde",REDEEM_REFUND:"Resgate cancelado"};
const currency=(c:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(c/100);
const nfmt=(v:string|number)=>Number(v).toLocaleString("pt-BR");
const date=(s:string)=>new Date(s).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"});
const field="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100";
const label="block space-y-1 text-[11px] font-bold text-slate-700";
const primary="rounded-xl bg-gradient-to-r from-violet-600 to-purple-700 px-4 py-2.5 text-xs font-extrabold text-white shadow-md shadow-purple-200 disabled:opacity-40";
const secondary="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-extrabold text-slate-700 hover:bg-slate-50 disabled:opacity-40";
async function req(url:string,method:"GET"|"POST"|"PUT"|"PATCH"="GET",payload?:unknown){
 const res=await fetch(url,{method,credentials:"same-origin",cache:"no-store",headers:payload?{"Content-Type":"application/json"}:undefined,body:payload?JSON.stringify(payload):undefined});
 const data=await res.json().catch(()=>({}));
 if(!res.ok)throw new Error(data.error||"Falha HTTP "+res.status+" na operação.");
 return data;
}
function Popup({title,onClose,children}:{title:string;onClose:()=>void;children:React.ReactNode}){
 return <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950/65 p-4 backdrop-blur-sm" onMouseDown={e=>{if(e.currentTarget===e.target)onClose();}}>
   <section role="dialog" aria-modal="true" aria-label={title} className="my-auto max-h-[94vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
    <div className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-100 bg-white p-5"><h3 className="text-base font-black text-slate-900">{title}</h3><button type="button" onClick={onClose} aria-label="Fechar"><X className="h-4 w-4"/></button></div>
    <div className="space-y-4 p-5">{children}</div>
   </section>
 </div>;
}
export default function LoyaltyPage(){
 const {hasPermission,isLoading:authLoading}=useAuth();
 const allowed=hasPermission("loyalty.view");
 const [data,setData]=useState<Overview|null>(null),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false);
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const [tab,setTab]=useState<"overview"|"rewards"|"redemptions"|"ledger"|"settings">("overview");
 const [search,setSearch]=useState("");
 const [selectedCustomer,setSelectedCustomer]=useState<string|null>(null);
 const [editingReward,setEditingReward]=useState<Reward|null>(null),[rewardOpen,setRewardOpen]=useState(false);
 const [rewardForm,setRewardForm]=useState<RewardForm>(emptyReward);
 const [policy,setPolicy]=useState<Program|null>(null);
 const [redemptionAction,setRedemptionAction]=useState<{id:string;title:string;code:string;action:"FULFILL"|"CANCEL"}|null>(null);
 const [actionNotes,setActionNotes]=useState("");
 const load=useCallback(async()=>{
  if(!allowed){setLoading(false);return;}
  setLoading(true);setError("");
  try{
   const d=await req("/api/loyalty/overview") as Overview;
   setData(d);setPolicy(d.program);
  }catch(e){setError(e instanceof Error?e.message:"Falha ao consultar o programa.");}
  finally{setLoading(false);}
 },[allowed]);
 useEffect(()=>{if(!authLoading)void load();},[authLoading,load]);
 const customers=useMemo(()=>data?.customers.filter(c=>c.name.toLowerCase().includes(search.toLowerCase()))||[],[data,search]);
 const summary=data?.summary;
 const openReward=(reward:Reward|null)=>{
  setEditingReward(reward);
  setRewardForm(reward?{
   kind:reward.kind,title:reward.title,description:reward.description||"",
   pointsCost:String(reward.pointsCost),valueReais:(Number(reward.valueCents)/100).toFixed(2),
   stockAvailable:reward.stockAvailable===null?"":String(reward.stockAvailable),
   isActive:reward.isActive,startsAtUtc:reward.startsAtUtc?reward.startsAtUtc.slice(0,16):"",endsAtUtc:reward.endsAtUtc?reward.endsAtUtc.slice(0,16):""
  }:{...emptyReward});
  setRewardOpen(true);
 };
 const saveReward=async(e:React.FormEvent)=>{
  e.preventDefault();
  if(!data?.capabilities.manage||saving)return;
  setSaving(true);setError("");
  try{
   const body={
    kind:rewardForm.kind,title:rewardForm.title,description:rewardForm.description||null,
    pointsCost:Number(rewardForm.pointsCost),valueCents:Math.round(Number(rewardForm.valueReais||0)*100),
    stockAvailable:rewardForm.stockAvailable===""?null:Number(rewardForm.stockAvailable),
    isActive:rewardForm.isActive,
    startsAtUtc:rewardForm.startsAtUtc?new Date(rewardForm.startsAtUtc).toISOString():null,
    endsAtUtc:rewardForm.endsAtUtc?new Date(rewardForm.endsAtUtc).toISOString():null,
    ...(editingReward?{expectedVersion:editingReward.version}:{})
   };
   const wasEditing=!!editingReward;
   await req(wasEditing?"/api/loyalty/rewards/"+editingReward!.id:"/api/loyalty/rewards",wasEditing?"PUT":"POST",body);
   setRewardOpen(false);setEditingReward(null);
   await load();
   setNotice(wasEditing?"Recompensa atualizada e auditada.":"Recompensa cadastrada inativa. Revise e ative para disponibilizar o resgate.");
  }catch(err){setError(err instanceof Error?err.message:"Não foi possível salvar a recompensa.");}
  finally{setSaving(false);}
 };
 const saveProgram=async(e:React.FormEvent)=>{
  e.preventDefault();
  if(!policy||saving||!data?.capabilities.manage)return;
  setSaving(true);setError("");
  try{
   await req("/api/loyalty/program","PUT",{enabled:policy.enabled,earnCentsPerPoint:Number(policy.earnCentsPerPoint),
    cashbackBps:Number(policy.cashbackBps),silverAtPoints:Number(policy.silverAtPoints),goldAtPoints:Number(policy.goldAtPoints),diamondAtPoints:Number(policy.diamondAtPoints),expectedVersion:policy.version});
   await load();setNotice("Política atualizada no Neon. As vendas antigas mantêm sua regra original no extrato.");
  }catch(err){setError(err instanceof Error?err.message:"Erro ao salvar regras.");}
  finally{setSaving(false);}
 };
 const finishRedemption=async(e:React.FormEvent)=>{
  e.preventDefault();
  if(!redemptionAction||saving)return;
  setSaving(true);setError("");
  try{
   const action=redemptionAction;
   await req("/api/loyalty/redemptions/"+action.id,"PATCH",{action:action.action,notes:actionNotes});
   setRedemptionAction(null);setActionNotes("");
   await load();
   setNotice(action.action==="FULFILL"?"Entrega registrada e auditada.":"Reserva cancelada; os pontos e a cota promocional foram devolvidos.");
  }catch(err){setError(err instanceof Error?err.message:"Não foi possível confirmar a operação.");}
  finally{setSaving(false);}
 };
 return <RootShellLayout>
  <div className="space-y-5">
   <header className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-xs">
    <div>
     <div className="flex items-center gap-2"><span className="rounded-full bg-purple-50 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-purple-700">Clube de Vantagens</span><span className="rounded-full border border-slate-200 px-2.5 py-1 text-[10px] font-bold text-slate-600">MOD Loyalty Enterprise</span></div>
     <h1 className="mt-2 text-xl font-black tracking-tight text-slate-950">Gamificação, Brindes & Cashback</h1>
     <p className="mt-1 max-w-2xl text-xs text-slate-500">Pontos calculados em vendas quitadas, extrato auditável por cliente, brindes com reserva real e políticas personalizadas no PostgreSQL Neon.</p>
    </div>
    <div className="flex items-center gap-2"><button type="button" onClick={()=>void load()} disabled={loading} className={secondary}><RefreshCw className="mr-1 inline h-3.5 w-3.5"/> Atualizar</button>
      {data?.capabilities.manage&&<button type="button" onClick={()=>openReward(null)} className={primary}><Plus className="mr-1 inline h-4 w-4"/> Novo Brinde / Benefício</button>}</div>
   </header>
   {error&&<div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-800"><AlertTriangle className="mr-2 inline h-4 w-4"/>{error}</div>}
   {notice&&<div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800"><CheckCircle2 className="mr-2 inline h-4 w-4"/>{notice}<button type="button" className="ml-3 underline" onClick={()=>setNotice("")}>Fechar</button></div>}
   {authLoading||loading?<div className="rounded-2xl border border-slate-200 bg-white p-14 text-center text-xs text-slate-500">Carregando dados de clientes, pontos e recompensas do Neon...</div>:
   !allowed?<div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-sm text-amber-800">A visualização requer a permissão canônica <code>loyalty.view</code>.</div>:
   data&&<React.Fragment>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
     {[
      {title:"Pontos em circulação",value:nfmt(summary?.availablePoints||0),sub:"Saldo resgatável agregado",icon:Coins,color:"text-purple-700 bg-purple-50"},
      {title:"Pontos concedidos",value:nfmt(summary?.lifetimeEarned||0),sub:"Histórico de créditos",icon:Award,color:"text-blue-700 bg-blue-50"},
      {title:"Resgatados",value:nfmt(summary?.lifetimeRedeemed||0),sub:"Resgates efetivados/reservados",icon:Gift,color:"text-amber-700 bg-amber-50"},
      {title:"Cashback acumulado",value:currency(Number(summary?.cashbackCents||0)),sub:"Não é dinheiro sacável",icon:WalletCards,color:"text-emerald-700 bg-emerald-50"}
     ].map(item=><div key={item.title} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs"><div className="flex items-center justify-between gap-2"><span className="text-[11px] font-bold text-slate-500">{item.title}</span><div className={"rounded-xl p-2 "+item.color}><item.icon className="h-4 w-4"/></div></div><p className="mt-2 text-2xl font-black text-slate-950">{item.value}</p><p className="mt-1 text-[10px] text-slate-500">{item.sub}</p></div>)}
    </div>
    <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-1.5">
     {([
      ["overview","Visão Geral",Users],["rewards","Catálogo de Brindes",Gift],["redemptions","Entregas & Resgates",Package],["ledger","Extrato de Pontos",BookOpen],["settings","Regras & Cashback",Settings2]
     ] as const).map(([value,title,Icon])=><button type="button" key={value} onClick={()=>setTab(value)}
      className={"flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-[11px] font-bold transition-colors "+(tab===value?"bg-purple-600 text-white shadow-md":"text-slate-600 hover:bg-purple-50")}>
      <Icon className="h-3.5 w-3.5"/>{title}</button>)}
    </div>
    {tab==="overview"&&<div className="grid gap-4 lg:grid-cols-3">
     <section className="rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-sm font-black text-slate-900">Clientes participantes</h2><p className="mt-1 text-xs text-slate-500">Registros vinculados diretamente à tabela <code>parties</code>. Clientes sem compras pontuadas ainda não possuem conta.</p></div><span className="text-xs font-bold text-purple-700">{nfmt(summary?.activeAccounts||0)} participantes</span></div>
      <div className="relative mt-4"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400"/><input className={field+" pl-9"} placeholder="Buscar cliente participante..." value={search} onChange={e=>setSearch(e.target.value)} /></div>
      <div className="mt-3 divide-y divide-slate-100">
       {customers.map(c=><button type="button" key={c.id} onClick={()=>setSelectedCustomer(c.id)} className="flex w-full items-center justify-between gap-3 px-2 py-3 text-left hover:bg-purple-50/60">
        <div><p className="text-xs font-black text-slate-900">{c.name}</p><p className="mt-1 text-[10px] text-slate-500">{nfmt(c.purchases)} compras • {nfmt(c.earned)} pontos conquistados</p></div>
        <div className="flex items-center gap-3"><span className="font-mono text-sm font-black text-purple-700">{nfmt(c.points)} pts</span><ChevronRight className="h-4 w-4 text-slate-400"/></div></button>)}
       {!customers.length&&<p className="py-10 text-center text-xs text-slate-500">Nenhum participante correspondente. O extrato será criado automaticamente na primeira venda paga elegível.</p>}
      </div>
     </section>
     <section className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="flex items-center gap-2 text-sm font-black"><ShieldCheck className="h-4 w-4 text-emerald-600"/> Regra vigente</h2>
       <p className="mt-3 text-xl font-black text-purple-700">{data.program?currency(data.program.earnCentsPerPoint):"Não configurada"} <span className="text-xs text-slate-500">= 1 ponto</span></p>
       <p className="mt-2 text-xs text-slate-600">Cashback adicional: {data.program?(data.program.cashbackBps/100).toFixed(2):"0.00"}% do valor elegível confirmado.</p>
       <p className="mt-2 text-xs font-bold text-slate-500">Programa: {data.program?.enabled?"Ativo":"Inativo / não configurado"}</p>
       <button type="button" onClick={()=>setTab("settings")} className="mt-3 text-xs font-bold text-purple-700 underline">Configurar regras</button>
      </div>
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><h3 className="flex items-center gap-2 text-xs font-black text-amber-900"><LockKeyhole className="h-4 w-4"/> Proteções do checkout</h3><p className="mt-2 text-xs leading-relaxed text-amber-800">Vouchers e descontos podem ser cadastrados, mas seu uso fica bloqueado até que pagamentos, estoque e liquidação estejam homologados no PDV. Nenhum desconto falso será aplicado.</p></div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5"><h3 className="text-xs font-bold text-slate-700">Vendas pontuadas</h3><p className="mt-1 text-2xl font-black">{nfmt(summary?.rewardedPurchases||0)}</p><p className="text-[11px] text-slate-500">Sem pontuação sobre orçamentos ou vendas pendentes.</p></div>
     </section>
    </div>}
    {tab==="rewards"&&<section className="space-y-4">
     <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-sm font-black text-slate-900">Brindes, serviços, vales e descontos</h2><p className="text-xs text-slate-500">Cada item possui regra de pontos, período, estoque promocional e status auditável.</p></div><span className="text-xs font-bold text-purple-700">{data.rewards.length} cadastrados</span></div>
     <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {data.rewards.map(r=><article key={r.id} className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-xs"><div><div className="flex items-center justify-between gap-3">
       <span className="rounded-lg bg-purple-50 px-2 py-1 text-[10px] font-extrabold text-purple-700">{kindLabel[r.kind]}</span><span className={"rounded-lg px-2 py-1 text-[10px] font-bold "+(r.isActive?"bg-emerald-50 text-emerald-700":"bg-slate-100 text-slate-500")}>{r.isActive?"Ativo":"Inativo"}</span>
      </div><h3 className="mt-3 text-sm font-black">{r.title}</h3><p className="mt-1 min-h-9 text-xs text-slate-500">{r.description||"Sem descrição"}</p><div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3"><span className="font-mono text-lg font-black text-purple-700">{nfmt(r.pointsCost)} <span className="text-xs">pts</span></span><span className="text-xs font-bold text-slate-500">{currency(Number(r.valueCents))}</span></div>
       <p className="mt-2 text-[11px] text-slate-500">{r.stockAvailable===null?"Cota de estoque não definida":"Disponíveis: "+r.stockAvailable}</p>
       {(r.kind==="VOUCHER"||r.kind==="DISCOUNT")&&<p className="mt-2 text-[11px] font-bold text-amber-700">Aplicação no PDV pendente de homologação</p>}</div>
       <button type="button" onClick={()=>openReward(r)} disabled={!data.capabilities.manage} className={secondary+" mt-4 w-full"}>Editar cadastro</button>
      </article>)}
      {!data.rewards.length&&<div className="col-span-full rounded-2xl border border-dashed border-slate-200 bg-white p-14 text-center text-xs text-slate-500"><Gift className="mx-auto mb-2 h-8 w-8 text-slate-300"/>Nenhuma recompensa cadastrada ainda. Use “Novo Brinde / Benefício”.</div>}
     </div>
    </section>}
    {tab==="redemptions"&&<section className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
     <div className="p-5"><h2 className="text-sm font-black">Fila de resgates e entregas</h2><p className="mt-1 text-xs text-slate-500">Reservas reais: pontuação debitada, cota promocional reservada e entrega com comprovação.</p></div>
     <table className="w-full text-left text-xs"><thead className="bg-slate-50 text-slate-500"><tr>{["Cliente","Brinde / Serviço","Código","Pontos","Situação","Ações"].map(t=><th key={t} className="px-3 py-3">{t}</th>)}</tr></thead><tbody>
     {data.redemptions.map(r=><tr key={r.id} className="border-t border-slate-100"><td className="px-3 py-3 font-bold">{r.customerName}</td><td className="px-3 py-3">{r.title}<span className="block text-[10px] text-slate-500">{date(r.createdAtUtc)}</span></td><td className="px-3 py-3 font-mono">{r.code}</td><td className="px-3 py-3 font-black text-purple-700">−{r.points}</td><td className="px-3 py-3"><span className="rounded-lg bg-slate-100 px-2 py-1 font-bold">{r.status==="RESERVED"?"Aguardando entrega":r.status==="FULFILLED"?"Entregue":"Cancelado"}</span></td>
      <td className="px-3 py-3"><div className="flex gap-2">{r.status==="RESERVED"&&data.capabilities.fulfill&&<><button type="button" onClick={()=>{setRedemptionAction({id:r.id,title:r.title,code:r.code,action:"FULFILL"});setActionNotes("");}} className="rounded-lg bg-emerald-50 px-2 py-1.5 font-bold text-emerald-800">Confirmar entrega</button><button type="button" onClick={()=>{setRedemptionAction({id:r.id,title:r.title,code:r.code,action:"CANCEL"});setActionNotes("");}} className="rounded-lg bg-rose-50 px-2 py-1.5 font-bold text-rose-800">Cancelar</button></>}</div></td></tr>)}
     {!data.redemptions.length&&<tr><td colSpan={6} className="p-10 text-center text-slate-500">Nenhuma reserva de brinde ou serviço no Neon.</td></tr>}
     </tbody></table>
    </section>}
    {tab==="ledger"&&<section className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
     <div className="p-5"><h2 className="text-sm font-black">Livro-razão de pontuação</h2><p className="mt-1 text-xs text-slate-500">Histórico somente leitura. Estornos são lançamentos compensatórios, nunca exclusões.</p></div>
     <table className="w-full text-left text-xs"><thead className="bg-slate-50 text-slate-500"><tr>{["Data","Cliente","Origem","Pontos","Cashback"].map(t=><th key={t} className="px-3 py-3">{t}</th>)}</tr></thead>
      <tbody>{data.ledger.map(l=><tr key={l.id} className="border-t border-slate-100"><td className="px-3 py-3 whitespace-nowrap">{date(l.createdAtUtc)}</td><td className="px-3 py-3 font-bold">{l.customerName}</td><td className="px-3 py-3">{eventName[l.kind]||l.kind}<span className="block font-mono text-[10px] text-slate-400">{l.eventKey}</span></td><td className={"px-3 py-3 font-mono font-black "+(Number(l.points)>=0?"text-emerald-700":"text-rose-700")}>{Number(l.points)>0?"+":""}{nfmt(l.points)}</td><td className="px-3 py-3">{currency(Number(l.cashbackCents))}</td></tr>)}
      {!data.ledger.length&&<tr><td colSpan={5} className="p-12 text-center text-slate-500">Nenhum lançamento. O programa não atribui pontos a orçamentos ou vendas não pagas.</td></tr>}
      </tbody></table>
    </section>}
    {tab==="settings"&&<section className="grid gap-4 lg:grid-cols-3">
     <form onSubmit={saveProgram} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-2">
      <div><h2 className="text-sm font-black">Política oficial de fidelidade</h2><p className="mt-1 text-xs text-slate-500">Regras versionadas. Alterações valem somente para próximas vendas confirmadas.</p></div>
      {!policy?<p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">Programa não provisionado para esta empresa. É necessária migração segura do Neon.</p>:<>
       <label className="flex items-center gap-2 text-xs font-bold text-slate-700"><input type="checkbox" checked={policy.enabled} onChange={e=>setPolicy({...policy,enabled:e.target.checked})}/> Programa de pontos habilitado</label>
       <div className="grid gap-3 sm:grid-cols-2">
        <label className={label}>Valor necessário para ganhar 1 ponto (centavos R$)<input type="number" min={1} max={1000000} required className={field} value={policy.earnCentsPerPoint} onChange={e=>setPolicy({...policy,earnCentsPerPoint:Number(e.target.value)})}/></label>
        <label className={label}>Cashback adicional (pontos-base: 100 = 1%)<input type="number" min={0} max={3000} required className={field} value={policy.cashbackBps} onChange={e=>setPolicy({...policy,cashbackBps:Number(e.target.value)})}/></label>
       </div>
       <div className="grid gap-3 sm:grid-cols-3">
        {(["silverAtPoints","goldAtPoints","diamondAtPoints"] as const).map((key,i)=><label className={label} key={key}>{["Prata","Ouro","Diamante"][i]} a partir de<input type="number" min={1} required className={field} value={policy[key]} onChange={e=>setPolicy({...policy,[key]:Number(e.target.value)})}/></label>)}
       </div>
       <button type="submit" disabled={!data.capabilities.manage||saving} className={primary}>{saving?"Salvando no Neon...":"Salvar política auditável"}</button>
      </>}
     </form>
     <aside className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-xs leading-relaxed text-amber-900"><h3 className="font-black">Regras de segurança</h3><p>Somente vendas pagas, confirmadas e vinculadas a um cliente ativo geram pontos. Uma mesma venda nunca pontua duas vezes.</p><p>Cancelamentos integrais produzem um estorno no extrato. Se o cliente já gastou os pontos, seu saldo pode ficar negativo para impedir novos resgates.</p><p>Devoluções parciais exigem reconciliação antes de liberar novos resgates. Vouchers e cashback não são usados no PDV até que o checkout seja homologado.</p></aside>
    </section>}
   </React.Fragment>}
   {selectedCustomer&&<Popup title="Ficha de Fidelidade do Cliente" onClose={()=>setSelectedCustomer(null)}><CustomerLoyaltyPanel partyId={selectedCustomer}/></Popup>}
   {rewardOpen&&<Popup title={editingReward?"Editar Recompensa":"Cadastrar Brinde, Serviço ou Desconto"} onClose={()=>setRewardOpen(false)}>
    <form onSubmit={saveReward} className="space-y-4">
     <label className={label}>Tipo do benefício<select className={field} value={rewardForm.kind} onChange={e=>setRewardForm({...rewardForm,kind:e.target.value as RewardForm["kind"]})}>{Object.entries(kindLabel).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
     <label className={label}>Nome do brinde / benefício *<input required maxLength={160} className={field} value={rewardForm.title} onChange={e=>setRewardForm({...rewardForm,title:e.target.value})}/></label>
     <label className={label}>Descrição e regras de utilização<textarea rows={3} maxLength={1000} className={field} value={rewardForm.description} onChange={e=>setRewardForm({...rewardForm,description:e.target.value})}/></label>
     <div className="grid gap-3 sm:grid-cols-3">
      <label className={label}>Pontos necessários *<input type="number" min={1} max={100000000} required className={field} value={rewardForm.pointsCost} onChange={e=>setRewardForm({...rewardForm,pointsCost:e.target.value})}/></label>
      <label className={label}>Valor comercial (R$)<input type="number" min={0} step="0.01" max={1000000} className={field} value={rewardForm.valueReais} onChange={e=>setRewardForm({...rewardForm,valueReais:e.target.value})}/></label>
      <label className={label}>Cota de brindes disponível<input type="number" min={0} max={1000000} placeholder="Sem limite" className={field} value={rewardForm.stockAvailable} onChange={e=>setRewardForm({...rewardForm,stockAvailable:e.target.value})}/></label>
     </div>
     <div className="grid gap-3 sm:grid-cols-2"><label className={label}>Início (opcional)<input type="datetime-local" className={field} value={rewardForm.startsAtUtc} onChange={e=>setRewardForm({...rewardForm,startsAtUtc:e.target.value})}/></label><label className={label}>Fim (opcional)<input type="datetime-local" className={field} value={rewardForm.endsAtUtc} onChange={e=>setRewardForm({...rewardForm,endsAtUtc:e.target.value})}/></label></div>
     {editingReward?<label className="flex items-center gap-2 text-xs font-bold text-slate-700"><input type="checkbox" checked={rewardForm.isActive} onChange={e=>setRewardForm({...rewardForm,isActive:e.target.checked})}/> Benefício ativo e visível aos clientes</label>:
      <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">Um novo benefício é criado inativo até que você revise e ative o cadastro.</p>}
     {(rewardForm.kind==="VOUCHER"||rewardForm.kind==="DISCOUNT")&&<p className="rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-800">Vale ou desconto pode ser cadastrado, porém o resgate ficará bloqueado até integração transacional com o PDV.</p>}
     <div className="flex justify-end gap-2 pt-2"><button type="button" className={secondary} onClick={()=>setRewardOpen(false)}>Cancelar</button><button type="submit" className={primary} disabled={saving}>{saving?"Salvando...":"Gravar no Neon"}</button></div>
    </form>
   </Popup>}
   {redemptionAction&&<Popup title={redemptionAction.action==="FULFILL"?"Confirmar entrega do brinde":"Cancelar reserva"} onClose={()=>setRedemptionAction(null)}>
    <form onSubmit={finishRedemption} className="space-y-4">
     <p className="text-xs text-slate-600">{redemptionAction.title} • <span className="font-mono">{redemptionAction.code}</span></p>
     <p className="text-xs font-semibold text-amber-900">{redemptionAction.action==="FULFILL"?"Confirme a entrega real ao cliente. Esse ato não faz baixa automática no Kardex físico.":"Essa ação somente é permitida antes da entrega, devolvendo pontos e a cota promocional."}</p>
     <label className={label}>Registro / justificativa<textarea className={field} rows={3} required={redemptionAction.action==="FULFILL"} minLength={redemptionAction.action==="FULFILL"?10:0} maxLength={600} value={actionNotes} onChange={e=>setActionNotes(e.target.value)} placeholder="Identificação de entrega, atendente, conferência do cliente..." /></label>
     <div className="flex justify-end gap-2"><button type="button" onClick={()=>setRedemptionAction(null)} className={secondary}>Voltar</button><button type="submit" disabled={saving} className={primary}>{saving?"Processando...":redemptionAction.action==="FULFILL"?"Confirmar entrega":"Confirmar cancelamento"}</button></div>
    </form>
   </Popup>}
  </div>
 </RootShellLayout>;
}
