"use client";

import React,{useCallback,useEffect,useMemo,useRef,useState} from "react";
import RootShellLayout from "@/components/RootShellLayout";
import {useAuth} from "@/lib/auth";
import {validFleetOverview,type FleetSource} from "@/lib/fleet-source";
import {Truck,Fuel,Wrench,Plus,MapPin,RefreshCw,CheckCircle2,AlertTriangle,ArrowRight,ClipboardList,Pencil,Gauge,Info,X,Car,ShieldCheck,CalendarClock,Calculator,History,SlidersHorizontal} from "lucide-react";

type Vehicle={id:string;name:string;plate:string;brand:string;model:string;year:number;type:number;ownership:number;fuel:number;tankLiters:number|null;kmPerLiter:number|null;initialKm:number;currentKm:number;partnerId:string|null;ownerName:string|null;status:number;notes:string|null;createdAt:string;version:string};
type Trip={id:string;number:string;vehicleId:string;plate:string;vehicleName:string;driver:string;purpose:number;origin:string;destination:string;description:string|null;startKm:number;endKm:number|null;distance:number;status:number;startedAt:string;endedAt:string|null;notes:string|null;fuelExpenses:number;version:string};
type Maintenance={id:string;vehicleId:string;name:string;intervalKm:number;intervalDays:number;nextKm:number|null;nextDate:string|null;active:boolean};
type Fueling={id:string;vehicleId:string;tripId:string|null;date:string;station:string;amount:number;liters:number|null;odometer:number};
type Partner={id:string;name:string};
type Overview={vehicles:Vehicle[];trips:Trip[];maintenance:Maintenance[];fuelings:Fueling[];partners:Partner[];source:FleetSource};
type VehicleForm={name:string;plate:string;brand:string;model:string;year:string;type:string;ownership:string;fuel:string;ownerName:string;partnerId:string;tankLiters:string;kmPerLiter:string;odometer:string;notes:string;status:string};
const types:Record<number,string>={1:"Automóvel",2:"Motocicleta",3:"Utilitário",4:"Van",5:"Caminhão"};
const owns:Record<number,string>={1:"Empresa",2:"Sócio",3:"Colaborador",4:"Locação",5:"Terceirizado"};
const fuels:Record<number,string>={1:"Gasolina",2:"Etanol",3:"Flex",4:"Diesel",5:"Elétrico",6:"Híbrido"};
const statuses:Record<number,string>={1:"Disponível",2:"Em viagem",3:"Manutenção",4:"Inativo",5:"Baixado"};
const purposes:Record<number,string>={1:"Retirada de mercadoria",2:"Entrega de venda",3:"Transporte para assistência",4:"Visita a cliente",5:"Projeto digital",6:"Entrega de fabricação 3D",7:"Administrativo",8:"Múltiplas finalidades"};
const tripStatus:Record<number,string>={1:"Rascunho",2:"Planejada",3:"Em andamento",4:"Concluída",5:"Cancelada",6:"Em revisão"};
const defaultForm=():VehicleForm=>({name:"",plate:"",brand:"",model:"",year:"",type:"1",ownership:"1",fuel:"1",ownerName:"",partnerId:"",tankLiters:"",kmPerLiter:"",odometer:"",notes:"",status:"1"});
const money=(v:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(v);
const num=(v:number,d=1)=>new Intl.NumberFormat("pt-BR",{maximumFractionDigits:d}).format(v);
const date=(v:string|null)=>v?new Intl.DateTimeFormat("pt-BR",{dateStyle:"short"}).format(new Date(v)):"—";
const f="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100";
const label="mb-1.5 block text-xs font-bold text-slate-600";
const primary="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-700 px-4 py-2.5 text-xs font-extrabold text-white shadow-md shadow-violet-200 transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40";
const secondary="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-extrabold text-slate-700 hover:bg-slate-50 disabled:opacity-40";

async function api<T>(path:string,method:"GET"|"POST"|"PATCH"="GET",value?:unknown):Promise<T>{
 const r=await fetch("/api/fleet/"+path,{method,credentials:"same-origin",cache:"no-store",headers:value?{"Content-Type":"application/json"}:undefined,body:value?JSON.stringify(value):undefined});
 const d=await r.json().catch(()=>({error:"Resposta inválida do servidor."}));
 if(!r.ok)throw new Error((d.error||"Operação não concluída.")+" (HTTP "+r.status+")");
 return d as T;
}
function Modal({title,close,children}:{title:string;close:()=>void;children:React.ReactNode}){
 return <div className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-sm" onMouseDown={e=>{if(e.currentTarget===e.target)close();}}>
 <section role="dialog" aria-modal="true" aria-label={title} className="my-auto max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
 <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4"><h3 className="font-black text-slate-900">{title}</h3><button onClick={close} aria-label="Fechar"><X className="h-4 w-4"/></button></div>
 <div className="p-6">{children}</div></section></div>;
}
export default function FretesPage(){
 const {user,hasPermission,isLoading:authLoading}=useAuth();
 const canView=hasPermission("fleet.view");
 const canManagePermission=hasPermission("fleet.vehicles.manage");
 const canTripPermission=hasPermission("fleet.trips.create");
 const canClosePermission=hasPermission("fleet.trips.close");
 const canOdometerPermission=hasPermission("fleet.odometer.correct");
 const canCosts=hasPermission("fleet.cost.view");
 const [tab,setTab]=useState<"vehicles"|"trips"|"fuel"|"maintenance"|"pricing">("vehicles");
 const [snapshot,setSnapshot]=useState<{scope:string;data:Overview}|null>(null);
 const [readError,setReadError]=useState("");
 const scope=[user?.id,user?.tenantId,user?.branchId].join(":");
 const seq=useRef(0),inFlight=useRef(false);
 const confirmed=snapshot?.scope===scope?snapshot.data:null;
 const data=confirmed??{vehicles:[],trips:[],maintenance:[],fuelings:[],partners:[],source:null};
 const writable=!!confirmed?.source.writable;
 const canManage=canManagePermission&&writable,canTrip=canTripPermission&&writable,canClose=canClosePermission&&writable,canOdometer=canOdometerPermission&&writable;
 const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false);
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const [modal,setModal]=useState<"vehicle"|"trip"|"close"|"odometer"|null>(null);
 const [editing,setEditing]=useState<Vehicle|null>(null),[selectedTrip,setSelectedTrip]=useState<Trip|null>(null);
 const [form,setForm]=useState<VehicleForm>(defaultForm);
 const [tripForm,setTripForm]=useState({vehicleId:"",driver:"",purpose:"1",origin:"",destination:"",description:"",estimatedDistance:"",fuelPrice:""});
 const [finalKm,setFinalKm]=useState(""),[completionNotes,setCompletionNotes]=useState("");
 const [odoForm,setOdoForm]=useState({odometer:"",reason:""});
 const [search,setSearch]=useState("");
 const [currentMonth,setCurrentMonth]=useState<number|null>(null);
 const [clock,setClock]=useState(0);
 useEffect(()=>{const now=new Date();setCurrentMonth(now.getFullYear()*12+now.getMonth());setClock(now.getTime());},[]);
 const [pricing,setPricing]=useState({acquisition:"",freight:"",markup:""});
 const load=useCallback(async()=>{
  const ticket=++seq.current;
  if(!canView){setSnapshot(null);setLoading(false);return;}
  setLoading(true);setReadError("");
  try{const next=await api<Overview>("overview");if(!validFleetOverview(next))throw Error("Resposta do banco não confirmada.");if(ticket===seq.current)setSnapshot({scope,data:next});}
  catch(e){if(ticket===seq.current){setSnapshot(null);setReadError(e instanceof Error?e.message:"Falha na leitura do Neon.");}}
  finally{if(ticket===seq.current)setLoading(false);}
 },[canView,scope]);
 useEffect(()=>{if(!authLoading)void load();return()=>{seq.current++;};},[authLoading,load]);
 const ready=!!confirmed&&!loading&&!authLoading&&canView;
 const execute=async<T,>(task:()=>Promise<T>,success:string)=>{
  if(inFlight.current||!ready||!writable)return false;
  inFlight.current=true;setSaving(true);setError("");setNotice("");
  try{await task();setNotice(success);setModal(null);await load();return true;}
  catch(e){setError(e instanceof Error?e.message:"Operação não concluída.");return false;}
  finally{inFlight.current=false;setSaving(false);}
 };
 const showCreate=()=>{if(!ready||!canManage)return;setEditing(null);setForm({...defaultForm(),year:String(new Date().getFullYear())});setModal("vehicle");};
 const showEdit=(v:Vehicle)=>{setEditing(v);setForm({name:v.name,plate:v.plate,brand:v.brand,model:v.model,year:String(v.year),type:String(v.type),ownership:String(v.ownership),fuel:String(v.fuel),ownerName:v.ownerName||"",partnerId:v.partnerId||"",tankLiters:v.tankLiters===null?"":String(v.tankLiters),kmPerLiter:v.kmPerLiter===null?"":String(v.kmPerLiter),odometer:String(v.currentKm),notes:v.notes||"",status:String(v.status)});setModal("vehicle");};
 const saveVehicle=async(e:React.FormEvent)=>{e.preventDefault();
  const body={...form,year:Number(form.year),type:Number(form.type),ownership:Number(form.ownership),fuel:Number(form.fuel),tankLiters:form.tankLiters===""?null:Number(form.tankLiters),kmPerLiter:form.kmPerLiter===""?null:Number(form.kmPerLiter),odometer:Number(form.odometer),partnerId:form.partnerId||null,status:Number(form.status),version:editing?.version};
  await execute(()=>editing?api("vehicles/"+editing.id,"PATCH",body):api("vehicles","POST",body),editing?"Veículo atualizado no Neon.":"Veículo cadastrado e disponível para viagens.");
 };
 const showTrip=()=>{const first=data.vehicles.find(v=>v.status===1);setTripForm({vehicleId:first?.id||"",driver:user?.fullName||"",purpose:"1",origin:"",destination:"",description:"",estimatedDistance:"",fuelPrice:""});setModal("trip");};
 const selectedVehicle=data.vehicles.find(v=>v.id===tripForm.vehicleId);
 const estimateDistance=Number(tripForm.estimatedDistance);
 const liters=selectedVehicle?.kmPerLiter&&estimateDistance>0?estimateDistance/selectedVehicle.kmPerLiter:null;
 const estimateCost=liters!==null&&Number(tripForm.fuelPrice)>0?liters*Number(tripForm.fuelPrice):null;
 const startTrip=async(e:React.FormEvent)=>{e.preventDefault();if(!selectedVehicle)return;
  await execute(()=>api("trips","POST",{vehicleId:selectedVehicle.id,driver:tripForm.driver,purpose:Number(tripForm.purpose),origin:tripForm.origin,destination:tripForm.destination,description:tripForm.description,startKm:selectedVehicle.currentKm}),"Viagem iniciada; veículo marcado como em uso.");
 };
 const completeTrip=async(e:React.FormEvent)=>{e.preventDefault();if(!selectedTrip)return;
  await execute(()=>api("trips/"+selectedTrip.id+"/complete","PATCH",{finalKm:Number(finalKm),notes:completionNotes,version:selectedTrip.version}),"Viagem concluída; distância e hodômetro atualizados.");
 };
 const correctOdo=async(e:React.FormEvent)=>{e.preventDefault();if(!editing)return;
  await execute(()=>api("vehicles/"+editing.id+"/odometer","PATCH",{odometer:Number(odoForm.odometer),reason:odoForm.reason,version:editing.version}),"Correção formal de hodômetro auditada.");
 };
 const vehicles=data.vehicles.filter(v=>[v.name,v.plate,v.brand,v.model,v.ownerName].some(s=>s?.toLowerCase().includes(search.trim().toLowerCase())));
 const available=data.vehicles.filter(v=>v.status===1).length;
 const activeTrips=data.trips.filter(t=>t.status===3);
 const monthDistance=data.trips.filter(t=>t.status===4&&currentMonth!==null&&(new Date(t.endedAt||t.startedAt).getFullYear()*12+new Date(t.endedAt||t.startedAt).getMonth())===currentMonth).reduce((s,t)=>s+t.distance,0);
 const nextMaintenance=data.maintenance.filter(p=>{const vehicle=data.vehicles.find(v=>v.id===p.vehicleId);return (p.nextKm!==null&&vehicle!==undefined&&p.nextKm-vehicle.currentKm<=1000)||(p.nextDate!==null&&clock>0&&new Date(p.nextDate).getTime()-clock<=30*86400000)}).length;
 const fuelTotal=data.fuelings.reduce((s,f)=>s+f.amount,0);
 const totalBase=Number(pricing.acquisition||0)+Number(pricing.freight||0);
 const listPrice=totalBase*(1+Number(pricing.markup||0)/100);
 return <RootShellLayout><div className="space-y-5 pb-10">
  <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
   <div><span className="inline-block rounded-full border border-violet-100 bg-violet-50 px-2.5 py-1 text-[10px] font-extrabold uppercase text-violet-700">Logística & Frota • MOD-16 Enterprise</span>
    <h1 className="mt-2 text-xl font-black tracking-tight text-slate-900">Gestão de fretes, veículos e deslocamentos</h1>
    <p className="mt-1 text-xs text-slate-500">Cadastro, consumo, viagens e hodômetros integrados ao Neon, com rastreabilidade.</p>
   </div>
   <div className="flex flex-wrap gap-2">
    <button className={secondary} onClick={()=>void load()} disabled={loading}><RefreshCw className={"h-4 w-4 "+(loading?"animate-spin":"")}/> Atualizar</button>
    {canManage&&<button className={secondary} disabled={!ready||saving} onClick={showCreate}><Car className="h-4 w-4"/> Novo veículo</button>}
    {canTrip&&<button className={primary} onClick={showTrip} disabled={!ready||saving||available===0}><Plus className="h-4 w-4"/> Nova viagem</button>}
   </div>
  </section>
  {(error||notice)&&<div role="alert" className={"flex items-start gap-2 rounded-xl border px-4 py-3 text-xs font-semibold "+(error?"border-rose-200 bg-rose-50 text-rose-700":"border-emerald-200 bg-emerald-50 text-emerald-700")}>{error?<AlertTriangle className="h-4 w-4 shrink-0"/>:<CheckCircle2 className="h-4 w-4 shrink-0"/>}<span>{error||notice}</span><button className="ml-auto" onClick={()=>{setError("");setNotice("");}}><X className="h-4 w-4"/></button></div>}
  {!authLoading&&!canView?<div className="rounded-2xl bg-white p-12 text-center text-slate-500"><ShieldCheck className="mx-auto mb-2 h-8 w-8"/> Sem permissão fleet.view.</div>:<>
  {ready&&confirmed&&<div className={"flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-xs "+(confirmed.source.database==="main"?"border-slate-200 bg-white text-slate-600":"border-amber-200 bg-amber-50 text-amber-900")}><div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4"/><span><strong>{confirmed.source.database==="main"?"Banco principal":"Banco isolado de homologação"}</strong> · {confirmed.source.branchName}{!confirmed.source.writable?" · Somente leitura":""}{confirmed.source.database==="isolated"?" · Os cadastros do banco principal não são copiados automaticamente.":""}</span></div>{confirmed.source.environment!=="production"&&<a href="https://hbstudio.vercel.app/fretes" className="font-bold text-violet-700 underline">Abrir ambiente oficial</a>}</div>}
  {readError&&<div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800"><div><strong>Não foi possível confirmar os registros no Neon.</strong><p className="mt-1">{readError} Nenhum indicador será apresentado como zero sem consulta confirmada.</p></div><button className={secondary} onClick={()=>void load()} disabled={loading}>Tentar novamente</button></div>}
  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
   {[
    {title:"Veículos disponíveis",value:!ready?"—":String(available)+" / "+data.vehicles.length,subtitle:ready?activeTrips.length+" em viagem":"Aguardando confirmação",icon:Truck,color:"text-violet-600 bg-violet-50"},
    {title:"Quilometragem no mês",value:!ready?"—":num(monthDistance,1)+" km",subtitle:"Viagens concluídas",icon:MapPin,color:"text-cyan-700 bg-cyan-50"},
    {title:"Abastecimentos registrados",value:!ready?"—":canCosts?money(fuelTotal):"Restrito",subtitle:canCosts?"Histórico real do Neon":"Requer fleet.cost.view",icon:Fuel,color:"text-amber-700 bg-amber-50"},
    {title:"Manutenções próximas",value:!ready?"—":String(nextMaintenance),subtitle:"Até 1.000 km ou 30 dias",icon:Wrench,color:"text-rose-700 bg-rose-50"},
   ].map(x=><div key={x.title} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between gap-2"><span className="text-[10px] font-bold uppercase text-slate-500">{x.title}</span><span className={"rounded-xl p-2 "+x.color}><x.icon className="h-4 w-4"/></span></div><div className="mt-2 text-xl font-black text-slate-900">{x.value}</div><div className="mt-1 text-[10px] text-slate-500">{x.subtitle}</div></div>)}
  </div>
  <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
   {([{id:"vehicles",name:"Frota & Hodômetros",icon:Truck},{id:"trips",name:"Viagens & Deslocamentos",icon:MapPin},{id:"fuel",name:"Abastecimentos",icon:Fuel},{id:"maintenance",name:"Manutenção",icon:Wrench},{id:"pricing",name:"Precificação",icon:Calculator}] as const).map(t=><button key={t.id} onClick={()=>setTab(t.id)} className={"flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-bold "+(tab===t.id?"border-violet-600 bg-violet-600 text-white":"border-slate-200 bg-white text-slate-600 hover:bg-slate-50")}><t.icon className="h-4 w-4"/>{t.name}</button>)}
  </div>
  {loading||authLoading?<div className="flex items-center justify-center gap-2 rounded-2xl bg-white p-20 text-sm text-slate-500"><RefreshCw className="h-4 w-4 animate-spin"/> Consultando Neon...</div>
  :!ready?<div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">Dados indisponíveis. Atualize a consulta antes de operar a frota.</div>:tab==="vehicles"?<section className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-sm font-black text-slate-900">Cadastro de veículos</h2><p className="text-xs text-slate-500">Consumo registrado em km/L e disponibilidade operacional.</p></div><div className="flex items-center gap-2"><input aria-label="Pesquisar veículo" value={search} onChange={e=>setSearch(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs" placeholder="Buscar nome, placa ou proprietário"/>{canManage&&<button className={primary} onClick={showCreate}><Plus className="h-4 w-4"/> Cadastrar veículo</button>}</div></div>
    {vehicles.length===0?<div className="rounded-2xl border border-dashed border-slate-200 bg-white p-14 text-center"><Car className="mx-auto h-11 w-11 text-violet-400"/><h3 className="mt-3 font-black text-slate-800">{data.vehicles.length?"Nenhum resultado para a busca":"Nenhum veículo cadastrado neste ambiente"}</h3><p className="mt-1 text-sm text-slate-500">{data.vehicles.length?"Altere o filtro para localizar os veículos cadastrados.":confirmed?.source.database==="isolated"?"Este banco de homologação não possui veículos nesta filial. Consulte o ambiente oficial para ver os registros de produção.":"Nenhum veículo registrado no Neon para esta filial."}</p>{data.vehicles.length?<button className={secondary+" mt-4"} onClick={()=>setSearch("")}>Limpar busca</button>:canManage&&<button className={primary+" mt-4"} onClick={showCreate}><Plus className="h-4 w-4"/> Novo veículo</button>}</div>:
     <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">{vehicles.map(v=><article key={v.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3"><div><span className="rounded-lg bg-slate-900 px-2.5 py-1 font-mono text-sm font-black tracking-wide text-white">{v.plate}</span><h3 className="mt-3 text-base font-black text-slate-900">{v.name}</h3><p className="mt-1 text-xs text-slate-500">{v.brand} {v.model} • {v.year} • {types[v.type]}</p></div><span className={"rounded-full px-2.5 py-1 text-[10px] font-extrabold "+(v.status===1?"bg-emerald-50 text-emerald-700":v.status===2?"bg-blue-50 text-blue-700":"bg-amber-50 text-amber-700")}>{statuses[v.status]||"—"}</span></div>
      <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4">
       <div><span className="text-[10px] uppercase text-slate-500">Proprietário / Responsável</span><p className="mt-1 text-xs font-extrabold text-slate-800">{v.ownerName||"Não informado"}</p><p className="text-[10px] text-slate-500">{owns[v.ownership]}</p></div>
       <div><span className="text-[10px] uppercase text-slate-500">Hodômetro atual</span><p className="mt-1 text-base font-black text-slate-900">{num(v.currentKm)} km</p></div>
       <div><span className="text-[10px] uppercase text-slate-500">Consumo de referência</span><p className="mt-1 text-base font-black text-violet-700">{v.kmPerLiter?num(v.kmPerLiter,2)+" km/L":"Não configurado"}</p></div>
       <div><span className="text-[10px] uppercase text-slate-500">Combustível / Tanque</span><p className="mt-1 text-xs font-black text-slate-800">{fuels[v.fuel]} • {v.tankLiters?num(v.tankLiters)+" L":"Tanque não informado"}</p></div>
      </div>
      {v.notes&&<p className="mt-3 text-xs text-slate-500">{v.notes}</p>}
      <div className="mt-4 flex flex-wrap gap-2">{canManage&&<button className={secondary} onClick={()=>showEdit(v)} disabled={v.status===2}><Pencil className="h-3.5 w-3.5"/> Editar</button>}{canOdometer&&<button className={secondary} disabled={v.status===2} onClick={()=>{setEditing(v);setOdoForm({odometer:String(v.currentKm),reason:""});setModal("odometer");}}><Gauge className="h-3.5 w-3.5"/> Corrigir hodômetro</button>}{canTrip&&v.status===1&&<button className={secondary} onClick={()=>{showTrip();setTripForm(p=>({...p,vehicleId:v.id}));}}><ArrowRight className="h-3.5 w-3.5"/> Nova viagem</button>}</div>
     </article>)}</div>}
   </section>
  :tab==="trips"?<section className="rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-100 p-5"><div><h3 className="text-sm font-black text-slate-900">Viagens registradas</h3><p className="text-xs text-slate-500">Hodômetros e distância final calculados pelo servidor.</p></div>{canTrip&&<button className={primary} onClick={showTrip} disabled={available===0}><Plus className="h-4 w-4"/> Nova viagem</button>}</div>
   {data.trips.length===0?<div className="p-14 text-center text-sm text-slate-500">Nenhuma viagem registrada no Neon.</div>:<div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="bg-slate-50 text-[10px] uppercase text-slate-500"><tr>{["Nº viagem","Veículo","Condutor","Trajeto","Hodômetros","Distância","Status","Ação"].map(h=><th key={h} className="px-4 py-3">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{data.trips.map(t=><tr key={t.id}><td className="px-4 py-3 font-mono font-bold text-violet-700">{t.number}</td><td className="px-4 py-3 font-bold">{t.vehicleName}<div className="text-[10px] text-slate-500">{t.plate}</div></td><td className="px-4 py-3">{t.driver}</td><td className="px-4 py-3">{t.origin} <ArrowRight className="inline h-3 w-3"/> {t.destination}</td><td className="px-4 py-3">{num(t.startKm)} {t.endKm!==null?"→ "+num(t.endKm):"km (aberta)"}</td><td className="px-4 py-3 font-bold">{t.status===4?num(t.distance)+" km":"A calcular"}</td><td className="px-4 py-3"><span className="rounded-lg bg-slate-100 px-2 py-1 font-bold">{tripStatus[t.status]}</span></td><td className="px-4 py-3">{t.status===3&&canClose?<button className={secondary} onClick={()=>{setSelectedTrip(t);setFinalKm(String(t.startKm));setCompletionNotes("");setModal("close");}}>Concluir viagem</button>:t.status===4?<span className="text-emerald-700">Concluída</span>:"—"}</td></tr>)}</tbody></table></div>}
  </section>
  :tab==="fuel"?<section className="rounded-2xl border border-slate-200 bg-white p-5"><h3 className="text-sm font-black text-slate-900">Abastecimentos e histórico</h3><p className="mt-1 text-xs text-slate-500">Os lançamentos efetivos de combustível precisam respeitar financeiro, reembolsos e idempotência. Esta tela exibe apenas registros oficiais já existentes.</p>
   {!hasPermission("fleet.fueling.manage")&&!hasPermission("fleet.fueling.create")?<p className="mt-5 text-xs text-amber-700">Permissão de gerenciamento de combustível necessária para novos lançamentos.</p>:<p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-700">Lançamento de combustível ainda não habilitado neste serviço serverless. Nenhum custo financeiro fictício será criado.</p>}
   {!canCosts?<p className="mt-6 text-center text-xs text-slate-500">Histórico restrito pela permissão de custos.</p>:data.fuelings.length===0?<p className="mt-6 rounded-xl border border-dashed border-slate-200 p-9 text-center text-sm text-slate-400">Nenhum abastecimento registrado.</p>:<div className="mt-4 divide-y divide-slate-100">{data.fuelings.map(t=><div key={t.id} className="flex justify-between py-3 text-xs"><span>{date(t.date)} • {t.station}</span><span>{canCosts?money(t.amount):"Restrito"} • {t.liters!==null?num(t.liters,2)+" L":"Litros não informados"}</span></div>)}</div>}
  </section>
  :tab==="maintenance"?<section className="rounded-2xl border border-slate-200 bg-white p-5"><h3 className="text-sm font-black text-slate-900">Planos preventivos</h3><p className="mt-1 text-xs text-slate-500">Alertas de revisão calculados com base no hodômetro e nas datas cadastradas.</p>{data.maintenance.length===0?<div className="mt-6 rounded-xl border border-dashed border-slate-200 p-10 text-center text-sm text-slate-500">Nenhum plano de manutenção persistido no Neon.</div>:<div className="mt-4 space-y-3">{data.maintenance.map(p=>{const v=data.vehicles.find(x=>x.id===p.vehicleId);const remaining=p.nextKm!==null&&v?p.nextKm-v.currentKm:null;const overdue=(remaining!==null&&remaining<0)||(p.nextDate!==null&&clock>0&&new Date(p.nextDate).getTime()<clock);return <div key={p.id} className="flex flex-wrap justify-between gap-3 rounded-xl border border-slate-200 p-4"><div><strong className="text-sm">{p.name}</strong><p className="text-xs text-slate-500">{v?.name} • A cada {num(p.intervalKm)} km / {p.intervalDays} dias</p></div><div className={"text-xs font-bold "+(overdue?"text-rose-600":"text-violet-700")}>{remaining!==null?num(remaining)+" km restantes":"Sem previsão em km"} • {date(p.nextDate)}</div></div>;})}</div>}</section>
  :<section className="grid gap-5 lg:grid-cols-2"><div className="rounded-2xl border border-slate-200 bg-white p-5"><h3 className="text-sm font-black text-slate-900">Simulação de precificação (não salva)</h3><p className="mt-1 text-xs text-slate-500">Calculadora ilustrativa, sem atualizar catálogo, estoque ou financeiro.</p>{(["acquisition","freight","markup"] as const).map(k=><label key={k} className="mt-4 block"><span className={label}>{k==="acquisition"?"Custo de aquisição (R$)":k==="freight"?"Frete comprovado (R$)":"Markup (%)"}</span><input type="number" min="0" step="0.01" className={f} value={pricing[k]} onChange={e=>setPricing({...pricing,[k]:e.target.value})}/></label>)}</div><div className="rounded-2xl border border-violet-200 bg-violet-50 p-6"><span className="text-xs font-bold text-violet-700">Preço sugerido (simulação)</span><div className="mt-2 text-3xl font-black text-violet-800">{money(listPrice)}</div><p className="mt-4 text-xs text-violet-700">Base: {money(totalBase)} • Markup informado: {pricing.markup||0}%</p><p className="mt-5 text-xs text-slate-600">Não inclui tributos, taxas comerciais ou composição contábil. Nenhum preço é aprovado automaticamente.</p></div></section>}
  </>}
 </div>
 {ready&&writable&&modal==="vehicle"&&<Modal title={editing?"Editar dados do veículo":"Cadastrar novo veículo"} close={()=>setModal(null)}>
 <form onSubmit={e=>void saveVehicle(e)} className="space-y-4">
  <div className="rounded-xl border border-violet-100 bg-violet-50 p-3 text-xs text-violet-700">Informações reais serão gravadas no Neon. Placa, identificação, propriedade e hodômetro inicial são preservados após o cadastro; correções de km têm fluxo auditado.</div>
  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
   <label><span className={label}>Nome / Identificação interna *</span><input required disabled={!!editing} maxLength={65} className={f} placeholder="Carro de entregas 01" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label>
   <label><span className={label}>Placa *</span><input required disabled={!!editing} maxLength={8} className={f} placeholder="ABC1D23" value={form.plate} onChange={e=>setForm({...form,plate:e.target.value.toUpperCase()})}/></label>
   <label><span className={label}>Marca *</span><input required className={f} maxLength={65} placeholder="Fiat" value={form.brand} onChange={e=>setForm({...form,brand:e.target.value})}/></label>
   <label><span className={label}>Modelo *</span><input required className={f} maxLength={100} placeholder="Strada 1.3" value={form.model} onChange={e=>setForm({...form,model:e.target.value})}/></label>
   <label><span className={label}>Ano *</span><input required disabled={!!editing} type="number" min="1950" max="2039" className={f} value={form.year} onChange={e=>setForm({...form,year:e.target.value})}/></label>
   <label><span className={label}>Categoria *</span><select disabled={!!editing} className={f} value={form.type} onChange={e=>setForm({...form,type:e.target.value})}>{Object.entries(types).map(([id,value])=><option key={id} value={id}>{value}</option>)}</select></label>
   <label><span className={label}>Tipo de propriedade *</span><select disabled={!!editing} className={f} value={form.ownership} onChange={e=>setForm({...form,ownership:e.target.value,partnerId:""})}>{Object.entries(owns).map(([id,value])=><option key={id} value={id}>{value}</option>)}</select></label>
   <label><span className={label}>Proprietário / Responsável *</span><input required className={f} maxLength={180} value={form.ownerName} onChange={e=>setForm({...form,ownerName:e.target.value})} placeholder="Nome real do proprietário"/></label>
   {form.ownership==="2"&&<label className="sm:col-span-2"><span className={label}>Sócio proprietário cadastrado *</span><select required disabled={!!editing} className={f} value={form.partnerId} onChange={e=>setForm({...form,partnerId:e.target.value})}><option value="">Selecione o sócio oficial</option>{data.partners.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}
   <label><span className={label}>Combustível *</span><select disabled={!!editing} className={f} value={form.fuel} onChange={e=>setForm({...form,fuel:e.target.value,kmPerLiter:e.target.value==="5"?"":form.kmPerLiter})}>{Object.entries(fuels).map(([id,value])=><option key={id} value={id}>{value}</option>)}</select></label>
   <label><span className={label}>Capacidade do tanque (L)</span><input className={f} type="number" step="0.01" min="0" max="2000" value={form.tankLiters} onChange={e=>setForm({...form,tankLiters:e.target.value})}/></label>
   <label><span className={label}>Consumo médio (km/L)</span><input className={f} disabled={form.fuel==="5"} type="number" step="0.01" min="0.01" max="100" value={form.kmPerLiter} onChange={e=>setForm({...form,kmPerLiter:e.target.value})} placeholder={form.fuel==="5"?"Não aplicável a elétrico":"Ex.: 11.5"}/><span className="text-[10px] text-slate-500">Será usado no cálculo de litros estimados por viagem.</span></label>
   <label><span className={label}>{editing?"Hodômetro atual (km)":"Hodômetro inicial (km) *"}</span><input required disabled={!!editing} type="number" min="0" step="0.1" className={f} value={form.odometer} onChange={e=>setForm({...form,odometer:e.target.value})}/></label>
   {editing&&<label><span className={label}>Situação operacional</span><select className={f} value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>{[1,3,4,5].map(i=><option value={i} key={i}>{statuses[i]}</option>)}</select></label>}
   <label className="sm:col-span-2"><span className={label}>Observações</span><textarea rows={3} maxLength={1500} className={f} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></label>
  </div><div className="flex justify-end gap-2"><button type="button" className={secondary} onClick={()=>setModal(null)}>Cancelar</button><button disabled={saving} className={primary}>{editing?"Salvar alterações":"Cadastrar veículo"}</button></div>
 </form></Modal>}
 {ready&&writable&&modal==="trip"&&<Modal title="Nova viagem e previsão de combustível" close={()=>setModal(null)}><form onSubmit={e=>void startTrip(e)} className="space-y-4">
 <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
 <label className="sm:col-span-2"><span className={label}>Veículo disponível *</span><select required className={f} value={tripForm.vehicleId} onChange={e=>setTripForm({...tripForm,vehicleId:e.target.value})}><option value="">Selecione...</option>{data.vehicles.filter(v=>v.status===1).map(v=><option value={v.id} key={v.id}>{v.name} • {v.plate} • {v.kmPerLiter?num(v.kmPerLiter,2)+" km/L":"Consumo não configurado"}</option>)}</select></label>
 <label><span className={label}>Condutor *</span><input required maxLength={180} className={f} value={tripForm.driver} onChange={e=>setTripForm({...tripForm,driver:e.target.value})}/></label>
 <label><span className={label}>Finalidade *</span><select className={f} value={tripForm.purpose} onChange={e=>setTripForm({...tripForm,purpose:e.target.value})}>{Object.entries(purposes).map(([id,value])=><option key={id} value={id}>{value}</option>)}</select></label>
 <label><span className={label}>Cidade de origem *</span><input required maxLength={140} className={f} value={tripForm.origin} onChange={e=>setTripForm({...tripForm,origin:e.target.value})}/></label>
 <label><span className={label}>Cidade de destino *</span><input required maxLength={140} className={f} value={tripForm.destination} onChange={e=>setTripForm({...tripForm,destination:e.target.value})}/></label>
 <label><span className={label}>Distância estimada da viagem (km)</span><input type="number" min="0" step="0.1" className={f} value={tripForm.estimatedDistance} onChange={e=>setTripForm({...tripForm,estimatedDistance:e.target.value})} placeholder="Informe a distância prevista"/></label>
 <label><span className={label}>Preço de referência por litro (R$)</span><input type="number" min="0" step="0.01" className={f} value={tripForm.fuelPrice} onChange={e=>setTripForm({...tripForm,fuelPrice:e.target.value})} placeholder="Preço informado pelo usuário"/></label>
 <label className="sm:col-span-2"><span className={label}>Descrição / Observações</span><textarea className={f} rows={2} maxLength={1400} value={tripForm.description} onChange={e=>setTripForm({...tripForm,description:e.target.value})}/></label>
 </div>
 <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4"><h4 className="flex items-center gap-2 text-sm font-black text-violet-800"><Calculator className="h-4 w-4"/> Planejamento de combustível</h4><div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4"><div><p className="text-[10px] text-violet-600">Média cadastrada</p><strong className="text-sm">{selectedVehicle?.kmPerLiter?num(selectedVehicle.kmPerLiter,2)+" km/L":"Não configurada"}</strong></div><div><p className="text-[10px] text-violet-600">Distância informada</p><strong className="text-sm">{tripForm.estimatedDistance?num(estimateDistance)+" km":"Não informada"}</strong></div><div><p className="text-[10px] text-violet-600">Litros estimados</p><strong className="text-sm">{liters!==null?num(liters,2)+" L":"Indisponível"}</strong></div><div><p className="text-[10px] text-violet-600">Custo estimado</p><strong className="text-sm">{estimateCost!==null?money(estimateCost):"Indisponível"}</strong></div></div><p className="mt-3 text-[11px] text-slate-600">Estimativa = distância informada ÷ média km/L. Não representa combustível existente no tanque nem lançamento financeiro. A distância real será apurada pelo hodômetro ao concluir.</p></div>
 <div className="flex justify-end gap-2"><button type="button" className={secondary} onClick={()=>setModal(null)}>Cancelar</button><button className={primary} disabled={saving||!tripForm.vehicleId||!tripForm.driver.trim()||!tripForm.origin.trim()||!tripForm.destination.trim()}>Iniciar viagem</button></div>
 </form></Modal>}
 {ready&&writable&&modal==="close"&&selectedTrip&&<Modal title="Concluir viagem e registrar hodômetro" close={()=>setModal(null)}><form className="space-y-4" onSubmit={e=>void completeTrip(e)}><p className="text-sm text-slate-600">{selectedTrip.vehicleName} • {selectedTrip.number} • Hodômetro inicial: <strong>{num(selectedTrip.startKm)} km</strong></p><label><span className={label}>Hodômetro final real (km) *</span><input required type="number" min={selectedTrip.startKm} step="0.1" className={f} value={finalKm} onChange={e=>setFinalKm(e.target.value)}/></label><div className="rounded-xl bg-violet-50 p-4 text-xs font-bold text-violet-700">Distância percorrida: {Math.max(0,Number(finalKm)-selectedTrip.startKm).toLocaleString("pt-BR")} km</div><label><span className={label}>Observações de conclusão</span><textarea className={f} rows={2} value={completionNotes} onChange={e=>setCompletionNotes(e.target.value)}/></label><div className="flex justify-end"><button className={primary} disabled={saving}>Concluir viagem no Neon</button></div></form></Modal>}
 {ready&&writable&&modal==="odometer"&&editing&&<Modal title="Correção formal de hodômetro" close={()=>setModal(null)}><form className="space-y-4" onSubmit={e=>void correctOdo(e)}><div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800"><Info className="mr-2 inline h-4 w-4"/> Correções devem ter justificativa e geram trilha de auditoria. Não use para registrar viagens.</div><label><span className={label}>Novo hodômetro (km) *</span><input required type="number" min="0" step="0.1" className={f} value={odoForm.odometer} onChange={e=>setOdoForm({...odoForm,odometer:e.target.value})}/></label><label><span className={label}>Justificativa obrigatória *</span><textarea required maxLength={400} rows={3} className={f} value={odoForm.reason} onChange={e=>setOdoForm({...odoForm,reason:e.target.value})}/></label><div className="flex justify-end"><button disabled={saving||!odoForm.reason.trim()} className={primary}>Registrar correção auditada</button></div></form></Modal>}
 </RootShellLayout>;
}
