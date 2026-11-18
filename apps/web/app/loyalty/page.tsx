"use client";
import React,{useCallback,useEffect,useMemo,useState} from "react";
import RootShellLayout from "@/components/RootShellLayout";
import {useAuth} from "@/lib/auth";
import {Gift,Sparkles,Coins,RefreshCw,Users,History,Settings,Plus,Search,ShieldCheck,AlertTriangle,CheckCircle2,TicketPercent,PackageCheck,X,RotateCcw,LockKeyhole} from "lucide-react";

type Reward={id:string;title:string;description:string|null;kind:"GIFT"|"DISCOUNT_FIXED"|"DISCOUNT_PERCENT";pointsCost:number;discountCents:number|null;discountPercent:number|null;stockTotal:number|null;stockAllocated:number;isActive:boolean;version:number};
type Customer={id:string;name:string;pointsBalance:number;lifetimeEarned:number;lifetimeRedeemed:number};
type Entry={id:string;kind:string;pointsDelta:number;reason:string;createdAt:string;saleNumber:string|null;redemptionId:string|null};
type Redemption={id:string;partyId:string;customerName:string;rewardId:string;title:string;kind:string;pointsSpent:number;status:string;createdAt:string;completedAt:string|null};
type CustomerDetail={customerId:string;pointsBalance:number;lifetimeEarned:number;lifetimeRedeemed:number;ledger:Entry[];redemptions:Redemption[]};
type SettingsData={configured:boolean;settings:null|{enabled:boolean;earnEveryCents:number;pointsPerStep:number};checkoutReady:boolean};
type Overview={metrics:{members:number;pointsOutstanding:number;pointsIssued:number;reservedRedemptions:number;activeRewards:number};configured:boolean;settings:SettingsData["settings"];checkoutReady:boolean};
const panel="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm";
const btn="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40";
const primary="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-700 px-4 py-2.5 text-xs font-extrabold text-white shadow-md shadow-violet-200 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40";
const input="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100";
const money=(n:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(n);
const number=(n:unknown)=>Number(n)||0;
const dt=(v:string)=>new Date(v).toLocaleString("pt-BR");
const rewardLabel=(r:Reward)=>r.kind==="GIFT"?"Brinde":r.kind==="DISCOUNT_FIXED"?("Vale-desconto "+money(number(r.discountCents)/100)):("Desconto "+r.discountPercent+"%");
async function api<T>(url:string,method:"GET"|"POST"|"PUT"|"PATCH"="GET",body?:unknown):Promise<T>{
 const res=await fetch(url,{method,cache:"no-store",credentials:"same-origin",headers:body?{"Content-Type":"application/json"}:undefined,body:body===undefined?undefined:JSON.stringify(body)});
 const data=await res.json().catch(()=>null);
 if(!res.ok)throw new Error((data?.error||"Falha ao consultar o Neon")+" (HTTP "+res.status+")");
 return data as T;
}
export default function LoyaltyPage(){
 const {hasPermission,isLoading:authLoading}=useAuth();
 const canView=hasPermission("loyalty.view"),canManage=hasPermission("loyalty.manage"),canRedeem=hasPermission("loyalty.redeem");
 const [tab,setTab]=useState<"overview"|"rewards"|"customers"|"redemptions"|"settings">("overview");
 const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [overview,setOverview]=useState<Overview|null>(null),[rewards,setRewards]=useState<Reward[]>([]),[customers,setCustomers]=useState<Customer[]>([]),[redemptions,setRedemptions]=useState<Redemption[]>([]);
 const [search,setSearch]=useState(""),[customerPage,setCustomerPage]=useState(1),[customerTotal,setCustomerTotal]=useState(0);
 const [selected,setSelected]=useState<Customer|null>(null),[detail,setDetail]=useState<CustomerDetail|null>(null);
 const [createOpen,setCreateOpen]=useState(false),[title,setTitle]=useState(""),[description,setDescription]=useState(""),[kind,setKind]=useState<Reward["kind"]>("GIFT");
 const [pointsCost,setPointsCost]=useState(""),[discount,setDiscount]=useState(""),[stockTotal,setStockTotal]=useState("");
 const [enabled,setEnabled]=useState(false),[earnEvery,setEarnEvery]=useState("5.00"),[pointsPer,setPointsPer]=useState("1");
 const [confirmDelivery,setConfirmDelivery]=useState<Redemption|null>(null),[deliveryNote,setDeliveryNote]=useState("");
 const load=useCallback(async()=>{
  if(!canView){setLoading(false);return;}
  setLoading(true);setError("");
  const endpoints=[
   ["Visão geral","/api/loyalty/overview"],
   ["Brindes e descontos","/api/loyalty/rewards?all=true"],
   ["Clientes","/api/loyalty/customers?search="+encodeURIComponent(search)+"&page="+customerPage],
   ["Resgates","/api/loyalty/redemptions"]
  ] as const;
  const results=await Promise.allSettled(endpoints.map(async([name,url])=>({name,body:await api<any>(url)})));
  const failures:string[]=[];
  for(const r of results){
   if(r.status==="rejected"){failures.push(r.reason instanceof Error?r.reason.message:"Falha de comunicação");continue;}
   const {name,body}=r.value;
   if(name==="Visão geral"){setOverview(body);if(body.settings){setEnabled(body.settings.enabled);setEarnEvery((body.settings.earnEveryCents/100).toFixed(2));setPointsPer(String(body.settings.pointsPerStep));}}
   if(name==="Brindes e descontos")setRewards(body.rewards||[]);
   if(name==="Clientes"){setCustomers(body.customers||[]);setCustomerTotal(body.total||0);}
   if(name==="Resgates")setRedemptions(body.redemptions||[]);
  }
  if(failures.length)setError("Consultas indisponíveis: "+failures.join(" • ")+". Os dados anteriores foram preservados; nenhuma informação fictícia foi inserida.");
  setLoading(false);
 },[canView,search,customerPage]);
 useEffect(()=>{if(!authLoading)void load();},[authLoading,load]);
 const loadDetail=useCallback(async(id:string)=>{
  try{const body=await api<CustomerDetail>("/api/loyalty/customers/"+id);setDetail(body);}
  catch(e){setDetail(null);setError(e instanceof Error?e.message:"Extrato indisponível.");}
 },[]);
 useEffect(()=>{if(selected)void loadDetail(selected.id);},[selected,loadDetail]);
 async function createReward(e:React.FormEvent){
  e.preventDefault();if(!canManage||saving)return;
  setSaving(true);setError("");setNotice("");
  try{
   const pts=Number(pointsCost),d=Number(discount);
   if(!Number.isSafeInteger(pts)||pts<=0)throw new Error("Informe pontos positivos inteiros.");
   const cents=kind==="DISCOUNT_FIXED"?Math.round(d*100):null;
   if(kind!=="GIFT"&&(!Number.isFinite(d)||d<=0||!Number.isSafeInteger(Math.round(d*(kind==="DISCOUNT_FIXED"?100:1)))))throw new Error("Informe o valor de desconto válido.");
   await api("/api/loyalty/rewards","POST",{title,description:description||null,kind,pointsCost:pts,discountCents:cents,discountPercent:kind==="DISCOUNT_PERCENT"?d:null,stockTotal:stockTotal===""?null:Number(stockTotal)});
   setCreateOpen(false);setTitle("");setDescription("");setPointsCost("");setDiscount("");setStockTotal("");
   setNotice("Recompensa cadastrada no Neon.");
   await load();
  }catch(e){setError(e instanceof Error?e.message:"Não foi possível cadastrar a recompensa.");}
  finally{setSaving(false);}
 }
 async function saveSettings(e:React.FormEvent){
  e.preventDefault();if(!canManage||saving)return;
  setSaving(true);setError("");setNotice("");
  try{
   const value=Number(earnEvery),steps=Number(pointsPer);
   if(!Number.isFinite(value)||value<=0||Math.abs(value*100-Math.round(value*100))>0.000001)throw new Error("Informe valor válido em reais.");
   await api("/api/loyalty/settings","PUT",{enabled,earnEveryCents:Math.round(value*100),pointsPerStep:steps});
   setNotice("Política salva no Neon. Ela vale para vendas futuras, confirmadas e efetivamente pagas.");
   await load();
  }catch(e){setError(e instanceof Error?e.message:"Política não alterada.");}
  finally{setSaving(false);}
 }
 async function toggleReward(reward:Reward){
  setSaving(true);setError("");try{
   await api("/api/loyalty/rewards/"+reward.id,"PATCH",{isActive:!reward.isActive,expectedVersion:reward.version});
   await load();
  }catch(e){setError(e instanceof Error?e.message:"Não foi possível alterar recompensa.");}finally{setSaving(false);}
 }
 async function reserveReward(reward:Reward){
  if(!selected||!canRedeem||saving)return;
  if(!window.confirm("Reservar "+reward.title+" por "+reward.pointsCost+" pontos de "+selected.name+"? O brinde não será marcado como entregue e descontos não serão aplicados ao PDV."))return;
  setSaving(true);setError("");setNotice("");
  try{
   const key=crypto.randomUUID();
   await api("/api/loyalty/redemptions","POST",{partyId:selected.id,rewardId:reward.id,idempotencyKey:key});
   setNotice("Resgate reservado e pontos debitados de forma transacional. Não houve desconto em venda.");
   await loadDetail(selected.id);await load();
  }catch(e){setError(e instanceof Error?e.message:"Resgate não confirmado.");}
  finally{setSaving(false);}
 }
 async function updateRedemption(r:Redemption,action:"CANCEL"|"FULFILL_GIFT",evidence?:string){
  if(!canManage||saving)return;
  if(action==="CANCEL"&&!window.confirm("Cancelar a reserva e devolver exatamente "+r.pointsSpent+" pontos?"))return;
  setSaving(true);setError("");setNotice("");
  try{
   await api("/api/loyalty/redemptions/"+r.id,"PATCH",{action,deliveryConfirmation:evidence});
   setConfirmDelivery(null);setDeliveryNote("");
   setNotice(action==="CANCEL"?"Reserva cancelada e pontos restituídos.":"Entrega do brinde registrada em auditoria.");
   if(selected)await loadDetail(selected.id);
   await load();
  }catch(e){setError(e instanceof Error?e.message:"Alteração do resgate não concluída.");}
  finally{setSaving(false);}
 }
 const activeRewards=useMemo(()=>rewards.filter(r=>r.isActive),[rewards]);
 const n=(v:unknown)=>number(v).toLocaleString("pt-BR");
 return <RootShellLayout><div className="space-y-5 pb-12">
  <header className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
   <div><div className="flex items-center gap-2"><span className="rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1 text-[10px] font-extrabold uppercase text-violet-700">Clube HB • Fidelidade</span><span className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold text-slate-600">Neon • Ledger auditável</span></div>
    <h1 className="mt-2 text-xl font-black tracking-tight text-slate-900">Gamificação, Brindes & Cashback em Pontos</h1>
    <p className="mt-1 text-xs text-slate-500">Programa vinculado aos clientes e às vendas efetivamente confirmadas. Brindes, benefícios, resgates e extrato rastreáveis.</p>
   </div><button type="button" className={btn} onClick={()=>void load()} disabled={loading}><RefreshCw className="h-4 w-4"/> Atualizar do Neon</button>
  </header>
  {error&&<div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700"><AlertTriangle className="h-4 w-4 shrink-0"/>{error}<button type="button" className="ml-auto" onClick={()=>setError("")}><X className="h-4 w-4"/></button></div>}
  {notice&&<div role="status" className="flex gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-700"><CheckCircle2 className="h-4 w-4"/>{notice}</div>}
  {!authLoading&&!canView?<div className={panel}><LockKeyhole className="mb-2 h-6 w-6 text-slate-400"/><p className="text-sm font-bold">Acesso negado. Permissão loyalty.view necessária.</p></div>:<>
  <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 bg-white p-1.5">
   {([["overview","Visão geral",Sparkles],["rewards","Brindes & Descontos",Gift],["customers","Clientes & Pontos",Users],["redemptions","Resgates",History],["settings","Configuração",Settings]] as const).map(([key,label,Icon])=>
    <button type="button" key={key} onClick={()=>setTab(key)} className={"inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-extrabold transition-colors "+(tab===key?"bg-gradient-to-r from-violet-600 to-purple-700 text-white":"text-slate-600 hover:bg-slate-50")}><Icon className="h-3.5 w-3.5"/>{label}</button>)}
  </div>
  {!overview&&!error&&loading?<div className={panel}>Consultando dados do Neon...</div>:<>
  {tab==="overview"&&<div className="space-y-5">
   <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
    {([["Clientes pontuados",overview?.metrics?.members,"Cadastros com conta"],["Pontos emitidos",overview?.metrics?.pointsIssued,"Vendas com pagamento confirmado"],["Saldo líquido",overview?.metrics?.pointsOutstanding,"Pode ficar negativo após estorno"],["Reservas abertas",overview?.metrics?.reservedRedemptions,"Brindes ou vouchers ainda pendentes"],["Benefícios ativos",overview?.metrics?.activeRewards,"Catálogo de recompensas"]] as const).map(([label,val,hint])=><div key={label} className={panel}><p className="text-[11px] font-bold text-slate-500">{label}</p><p className="mt-3 text-2xl font-black text-slate-900">{val===undefined?"—":n(val)}</p><p className="mt-1 text-[10px] text-slate-400">{hint}</p></div>)}
   </div>
   <div className="grid gap-4 lg:grid-cols-2">
    <div className={panel}><h2 className="flex items-center gap-2 font-black text-slate-900"><Coins className="h-5 w-5 text-purple-600"/>Política de pontuação</h2>
     <p className="mt-3 text-sm font-bold">{overview?.configured?(overview.settings?.enabled?"Programa habilitado":"Programa desativado"):"Programa ainda não configurado"}</p>
     <p className="mt-2 text-xs text-slate-600">{overview?.settings?"A cada "+money(number(overview.settings.earnEveryCents)/100)+" efetivamente pagos, "+n(overview.settings.pointsPerStep)+" ponto(s) (faixas inteiras).":"Ative e configure a regra de pontuação na aba Configuração."}</p>
     <p className="mt-3 rounded-xl bg-violet-50 p-3 text-xs text-violet-700">O saldo de pontos não é dinheiro depositado. Benefícios de desconto são vouchers reservados; a baixa financeira no PDV depende do checkout homologado.</p>
    </div>
    <div className={panel}><h2 className="flex items-center gap-2 font-black text-slate-900"><ShieldCheck className="h-5 w-5 text-emerald-600"/>Controle Enterprise</h2>
     <p className="mt-3 text-xs leading-6 text-slate-600">Pontos por pagamento verificado, extrato append-only, isolamento por empresa, idempotência, saldo bloqueado contra resgate duplo e reversão após cancelamento ou devolução aprovada.</p>
     <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">Finalização de venda, descontos monetários no PDV e baixa do Kardex ainda não estão habilitados. Nenhuma operação é simulada.</p>
    </div>
   </div>
  </div>}
  {tab==="rewards"&&<div className="space-y-4">
   <div className={panel}><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-black text-slate-900">Catálogo de brindes e benefícios</h2><p className="mt-1 text-xs text-slate-500">Cada benefício possui custo em pontos, disponibilidade e situação auditável.</p></div>
    {canManage&&<button type="button" onClick={()=>setCreateOpen(true)} className={primary}><Plus className="h-4 w-4"/>Cadastrar brinde/desconto</button>}</div></div>
   {rewards.length===0?<div className={panel}><Gift className="mb-2 h-7 w-7 text-slate-300"/><p className="text-xs text-slate-500">Nenhuma recompensa cadastrada no Neon.</p></div>:
   <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{rewards.map(r=><article key={r.id} className={panel}>
    <div className="flex justify-between gap-2"><span className="rounded-lg bg-purple-50 px-2 py-1 text-[10px] font-extrabold text-purple-700">{rewardLabel(r)}</span><span className={"text-[10px] font-bold "+(r.isActive?"text-emerald-700":"text-slate-400")}>{r.isActive?"Ativo":"Inativo"}</span></div>
    <h3 className="mt-3 text-sm font-black text-slate-900">{r.title}</h3><p className="mt-1 min-h-10 text-xs text-slate-500">{r.description||"Sem descrição complementar"}</p>
    <p className="mt-3 text-xl font-black text-violet-700">{n(r.pointsCost)} <span className="text-xs">pontos</span></p>
    <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500"><span>Disponibilidade</span><strong>{r.stockTotal===null?"Sem limite cadastrado":Math.max(0,number(r.stockTotal)-number(r.stockAllocated))+" de "+r.stockTotal}</strong></div>
    {canManage&&<button type="button" disabled={saving} className={btn+" mt-4 w-full"} onClick={()=>void toggleReward(r)}>{r.isActive?"Desativar benefício":"Reativar benefício"}</button>}
   </article>)}</div>}
  </div>}
  {tab==="customers"&&<div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
   <div className={panel}><h2 className="font-black text-slate-900">Clientes cadastrados</h2>
    <div className="relative mt-3"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400"/><input className={input+" pl-9"} value={search} onChange={e=>{setCustomerPage(1);setSearch(e.target.value)}} placeholder="Pesquisar por nome cadastrado" /></div>
    <div className="mt-3 divide-y divide-slate-100">{customers.length===0?<p className="p-5 text-xs text-slate-400">Nenhum cliente encontrado na consulta.</p>:customers.map(c=><button key={c.id} type="button" onClick={()=>{setSelected(c);setDetail(null)}} className={"flex w-full items-center justify-between gap-3 px-2 py-3 text-left text-xs hover:bg-purple-50 "+(selected?.id===c.id?"bg-purple-50":"")}>
      <span className="font-bold text-slate-800">{c.name}</span><span className="whitespace-nowrap font-black text-purple-700">{n(c.pointsBalance)} pts</span>
     </button>)}</div>
    <div className="mt-4 flex items-center justify-between text-xs text-slate-500"><span>{n(customerTotal)} clientes</span><div className="flex gap-1">
     <button className={btn} disabled={customerPage<=1} onClick={()=>setCustomerPage(p=>p-1)}>Anterior</button>
     <span className="px-2 py-2">Página {customerPage}</span>
     <button className={btn} disabled={customerPage*30>=customerTotal} onClick={()=>setCustomerPage(p=>p+1)}>Próxima</button></div></div>
   </div>
   <div className={panel}>{!selected?<div className="py-16 text-center text-xs text-slate-400"><Users className="mx-auto mb-3 h-8 w-8"/>Selecione um cliente para consultar saldo, extrato e resgate.</div>:!detail?<p className="text-xs text-slate-500">Consultando extrato real de {selected.name}...</p>:<>
    <div className="flex items-start justify-between gap-2"><div><h2 className="font-black text-slate-900">{selected.name}</h2><p className="text-[11px] text-slate-500">Conta de fidelidade vinculada ao cadastro oficial</p></div><span className="rounded-xl bg-purple-50 px-3 py-2 text-lg font-black text-purple-700">{n(detail.pointsBalance)} pts</span></div>
    <div className="mt-4 flex justify-between rounded-xl bg-slate-50 p-3 text-xs"><span>Total ganho: <strong>{n(detail.lifetimeEarned)}</strong></span><span>Total resgatado: <strong>{n(detail.lifetimeRedeemed)}</strong></span></div>
    <h3 className="mt-5 text-xs font-black uppercase tracking-wide text-slate-700">Resgatar benefício</h3>
    {!overview?.settings?.enabled?<p className="mt-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-700">O programa não está habilitado. Nenhum resgate pode ser efetuado.</p>:
     <div className="mt-2 max-h-48 space-y-2 overflow-y-auto">{activeRewards.length===0?<p className="text-xs text-slate-400">Nenhum benefício ativo.</p>:activeRewards.map(r=>{
      const available=r.stockTotal===null||number(r.stockAllocated)<number(r.stockTotal);
      const enough=number(detail.pointsBalance)>=number(r.pointsCost);
      return <div key={r.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 p-2.5"><div><p className="text-xs font-extrabold text-slate-800">{r.title}</p><p className="text-[10px] text-slate-500">{rewardLabel(r)} • {n(r.pointsCost)} pts</p></div>
       <button type="button" className={primary} disabled={!available||!enough||!canRedeem||saving} onClick={()=>void reserveReward(r)}>{!available?"Esgotado":!enough?"Saldo insuficiente":"Reservar"}</button></div>;
     })}</div>}
    <h3 className="mt-5 text-xs font-black uppercase tracking-wide text-slate-700">Extrato auditável</h3>
    <div className="mt-2 max-h-72 divide-y divide-slate-100 overflow-y-auto">{detail.ledger.length===0?<p className="text-xs text-slate-400">Ainda não existem movimentações de pontos.</p>:detail.ledger.map(e=><div key={e.id} className="flex justify-between gap-3 py-3 text-xs"><div><p className="font-bold text-slate-700">{e.reason}</p><p className="text-[10px] text-slate-400">{dt(e.createdAt)}{e.saleNumber?" • Venda "+e.saleNumber:""}</p></div><strong className={number(e.pointsDelta)>=0?"text-emerald-600":"text-rose-600"}>{number(e.pointsDelta)>0?"+":""}{n(e.pointsDelta)} pts</strong></div>)}</div>
   </>}</div>
  </div>}
  {tab==="redemptions"&&<div className={panel}><h2 className="font-black text-slate-900">Reservas, entregas e cancelamentos</h2><p className="mt-1 text-xs text-slate-500">Reservar um desconto não altera o valor de nenhuma venda até a liquidação do PDV estar homologada.</p>
   <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-xs"><thead className="border-b bg-slate-50 text-[10px] uppercase text-slate-500"><tr><th className="p-3">Cliente</th><th className="p-3">Benefício</th><th className="p-3">Pontos</th><th className="p-3">Situação</th><th className="p-3">Data</th><th className="p-3">Ações</th></tr></thead><tbody className="divide-y divide-slate-100">{redemptions.map(r=><tr key={r.id}><td className="p-3 font-bold">{r.customerName}</td><td className="p-3">{r.title}</td><td className="p-3 font-black">{n(r.pointsSpent)}</td><td className="p-3">{r.status==="RESERVED"?"Reservado":r.status==="FULFILLED"?"Entregue":"Cancelado"}</td><td className="p-3 text-slate-500">{dt(r.createdAt)}</td><td className="p-3"><div className="flex gap-1">{canManage&&r.status==="RESERVED"&&<><button type="button" className={btn} disabled={saving} onClick={()=>void updateRedemption(r,"CANCEL")}><RotateCcw className="h-3.5 w-3.5"/>Cancelar</button>{r.kind==="GIFT"&&<button type="button" className={btn} disabled={saving} onClick={()=>{setConfirmDelivery(r);setDeliveryNote("")}}><PackageCheck className="h-3.5 w-3.5"/>Registrar entrega</button>}</>}</div></td></tr>)}</tbody></table>{redemptions.length===0&&<p className="p-8 text-center text-xs text-slate-400">Nenhum resgate registrado no Neon.</p>}</div>
  </div>}
  {tab==="settings"&&<div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"><form onSubmit={saveSettings} className={panel+" space-y-4"}><h2 className="font-black text-slate-900">Política de geração de pontos</h2><p className="text-xs text-slate-500">Configurável por empresa. Cálculo inteiro, sem arredondar compras parciais para cima.</p>
   <label className="flex items-center gap-3 text-xs font-bold text-slate-700"><input type="checkbox" checked={enabled} disabled={!canManage} onChange={e=>setEnabled(e.target.checked)}/>Programa ativo para novas vendas confirmadas</label>
   <div className="grid grid-cols-2 gap-3"><label className="text-xs font-bold text-slate-700">A cada (R$)<input required min="1" step="0.01" type="number" disabled={!canManage} className={input+" mt-1"} value={earnEvery} onChange={e=>setEarnEvery(e.target.value)}/></label><label className="text-xs font-bold text-slate-700">Gerar (pontos)<input required min="1" max="100" step="1" type="number" disabled={!canManage} className={input+" mt-1"} value={pointsPer} onChange={e=>setPointsPer(e.target.value)}/></label></div>
   <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">Exemplo: R$ 120,00 com regra de R$ 5,00 = 1 ponto gera 24 pontos, somente após confirmação integral do pagamento.</p>
   {canManage&&<button type="submit" className={primary} disabled={saving}>Salvar política de fidelidade</button>}
  </form><div className={panel}><h2 className="font-black text-slate-900">Regras operacionais</h2><div className="mt-4 space-y-3 text-xs text-slate-600"><p>• A pontuação não é registrada quando o pagamento está pendente ou a venda é um orçamento.</p><p>• Venda cancelada/devolvida gera estorno auditável de pontos, mesmo que o saldo fique negativo.</p><p>• Resgate exige saldo real e evita utilização dupla da mesma chave.</p><p>• Vale-compra e desconto percentual não alteram preço do PDV até a integração de checkout.</p><p>• O brinde entregue é confirmado manualmente com evidência de retirada; não equivale à baixa automática do Kardex.</p><p>• Nenhum ponto ou brinde fictício é criado automaticamente.</p></div></div></div>}
  </>}
  </>}
  {createOpen&&<div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm"><section role="dialog" aria-modal="true" aria-label="Cadastrar benefício" className="max-h-[94vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"><div className="flex justify-between"><h2 className="font-black text-slate-900">Novo brinde ou desconto</h2><button type="button" onClick={()=>setCreateOpen(false)}><X className="h-4 w-4"/></button></div>
    <form className="mt-4 space-y-3" onSubmit={createReward}><label className="block text-xs font-bold">Título *<input required maxLength={140} className={input+" mt-1"} value={title} onChange={e=>setTitle(e.target.value)}/></label><label className="block text-xs font-bold">Descrição<textarea maxLength={600} rows={2} className={input+" mt-1"} value={description} onChange={e=>setDescription(e.target.value)}/></label>
    <label className="block text-xs font-bold">Tipo *<select className={input+" mt-1"} value={kind} onChange={e=>{setKind(e.target.value as Reward["kind"]);setDiscount("")}}><option value="GIFT">Brinde / Produto promocional</option><option value="DISCOUNT_FIXED">Vale-desconto em reais</option><option value="DISCOUNT_PERCENT">Desconto percentual</option></select></label>
    <div className="grid grid-cols-2 gap-3"><label className="block text-xs font-bold">Pontos necessários *<input type="number" min={1} step={1} required className={input+" mt-1"} value={pointsCost} onChange={e=>setPointsCost(e.target.value)}/></label>
    {kind!=="GIFT"&&<label className="block text-xs font-bold">{kind==="DISCOUNT_FIXED"?"Desconto (R$)":"Desconto (%)"} *<input required type="number" min={kind==="DISCOUNT_FIXED"?"0.01":"1"} max={kind==="DISCOUNT_PERCENT"?"100":undefined} step={kind==="DISCOUNT_FIXED"?"0.01":"1"} className={input+" mt-1"} value={discount} onChange={e=>setDiscount(e.target.value)}/></label>}</div>
    <label className="block text-xs font-bold">Quantidade disponível (opcional)<input type="number" min="0" step="1" className={input+" mt-1"} placeholder="Em branco = sem limite operacional" value={stockTotal} onChange={e=>setStockTotal(e.target.value)}/></label>
    <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">Descontos serão vouchers reservados e não alteram o total do PDV. Para brindes vinculados ao estoque físico, a movimentação Kardex exige integração própria.</p>
    <div className="flex justify-end gap-2"><button className={btn} type="button" onClick={()=>setCreateOpen(false)}>Cancelar</button><button className={primary} type="submit" disabled={saving}>Cadastrar no Neon</button></div></form></section></div>}
  {confirmDelivery&&<div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/60 p-4"><section role="dialog" aria-modal="true" aria-label="Confirmar entrega de brinde" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><h2 className="font-black text-slate-900">Registrar entrega física</h2><p className="mt-2 text-xs text-slate-600">{confirmDelivery.title} • {confirmDelivery.customerName}</p><p className="mt-2 text-xs text-amber-700">Confirme somente após entrega verdadeira. Registro não substitui baixa do estoque Kardex.</p><textarea className={input+" mt-3"} rows={3} placeholder="Recebedor, comprovante e detalhes da entrega (mín. 10 caracteres)" value={deliveryNote} onChange={e=>setDeliveryNote(e.target.value)}/><div className="mt-4 flex justify-end gap-2"><button className={btn} type="button" onClick={()=>setConfirmDelivery(null)}>Voltar</button><button className={primary} disabled={saving||deliveryNote.trim().length<10} onClick={()=>void updateRedemption(confirmDelivery,"FULFILL_GIFT",deliveryNote)}>Confirmar entrega</button></div></section></div>}
 </div></RootShellLayout>;
}
