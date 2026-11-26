"use client";

import {useCallback,useEffect,useRef,useState} from "react";
import RootShellLayout from "@/components/RootShellLayout";
import {useAuth} from "@/lib/auth";
import {Wallet,RefreshCw,LockKeyhole,AlertTriangle,CheckCircle2,Plus,History} from "lucide-react";

type CashRegister={id:string;code:string;name:string;status:number;available:boolean};
type Shift={id:string;registerId:string;registerName:string;operatorId:string;status:number;openingFloat:number;recordedBalance:number;recordedCashIn:number;recordedCashOut:number;movementNet:number;movementCount:number;openedAtUtc:string;closedAtUtc:string|null;reconciliationMismatch:boolean};
type Overview={registers:CashRegister[];shifts:Shift[];canOpen:boolean;canManageRegisters:boolean;note:string};
const money=(n:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(n);
const date=(d:string)=>new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeStyle:"short"}).format(new Date(d));

export default function CashPage(){
 const {user,hasPermission,isLoading:authLoading}=useAuth();
 const canView=hasPermission("cash.shift.view"),canOpen=hasPermission("cash.open");
 const canSupply=hasPermission("cash.supply"),canWithdraw=hasPermission("cash.withdraw");
 const [data,setData]=useState<Overview|null>(null);
 const [loading,setLoading]=useState(false),[saving,setSaving]=useState(false);
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const [registerId,setRegisterId]=useState(""),[openingFloat,setOpeningFloat]=useState("0.00"),[showOpen,setShowOpen]=useState(false);
 const requestKey=useRef("");
 const [showRegister,setShowRegister]=useState(false),[registerCode,setRegisterCode]=useState(""),[registerName,setRegisterName]=useState(""),[registerNotes,setRegisterNotes]=useState("");
 const registerRequest=useRef<{payload:string;key:string}|null>(null);const registerRunning=useRef(false);
 const movementKey=useRef("");
 const [movementShift,setMovementShift]=useState<Shift|null>(null);
 const [movementType,setMovementType]=useState<"SUPPLY"|"WITHDRAWAL">("SUPPLY");
 const [movementAmount,setMovementAmount]=useState(""),[movementReason,setMovementReason]=useState("");
 const canClose=hasPermission("cash.close");
 const [closingShift,setClosingShift]=useState<Shift|null>(null);
 const [countedAmount,setCountedAmount]=useState("");
 const [closingNotes,setClosingNotes]=useState("");
 const closingKey=useRef("");

 const load=useCallback(async()=>{
  setLoading(true);setError("");
  try{
   const response=await fetch("/api/cash/overview",{cache:"no-store"});
   const result=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(result.error||"Não foi possível consultar os caixas.");
   setData(result);
  }catch(e){setError(e instanceof Error?e.message:"Falha de conexão com Neon.");setData(null);}
  finally{setLoading(false);}
 },[]);
 useEffect(()=>{if(!authLoading&&canView)void load();},[authLoading,canView,load]);
 const createRegister=async(e:React.FormEvent)=>{
  e.preventDefault();if(registerRunning.current||saving||!data?.canManageRegisters)return;
  const payload={code:registerCode.trim().toUpperCase(),name:registerName.trim(),notes:registerNotes.trim()};const fingerprint=JSON.stringify(payload);if(!payload.code||!payload.name){setError("Informe código e nome do caixa.");return;}
  if(registerRequest.current?.payload!==fingerprint)registerRequest.current={payload:fingerprint,key:crypto.randomUUID()};
  registerRunning.current=true;setSaving(true);setError("");setNotice("");try{const response=await fetch("/api/cash/registers",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...payload,requestKey:registerRequest.current.key})});const result=await response.json().catch(()=>({}));if(!response.ok)throw new Error(result.error||"Cadastro não confirmado.");setShowRegister(false);registerRequest.current=null;setNotice("Caixa cadastrado. Agora você pode abrir um turno.");await load();setRegisterId(result.id);}catch(e){setError(e instanceof Error?e.message:"Cadastro não confirmado.");}finally{registerRunning.current=false;setSaving(false);}
 };
 const openShift=async(e:React.FormEvent)=>{
  e.preventDefault();if(saving)return;
  const amount=Number(openingFloat);
  if(!openingFloat.trim()||!registerId||!Number.isFinite(amount)||amount<0||Math.abs(amount*100-Math.round(amount*100))>0.000001){setError("Selecione um caixa e informe o fundo em reais e centavos.");return;}
  if(!requestKey.current)requestKey.current=crypto.randomUUID();
  setSaving(true);setError("");setNotice("");
  try{
   const response=await fetch("/api/cash/overview",{method:"POST",headers:{"Content-Type":"application/json"},
     body:JSON.stringify({registerId,openingFloat:amount,requestKey:requestKey.current})});
   const result=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(result.error||"Abertura de caixa não concluída.");
   setNotice("Caixa aberto com registro auditável no Neon.");
   setShowOpen(false);requestKey.current="";setOpeningFloat("0.00");setRegisterId("");
   await load();
  }catch(e){setError(e instanceof Error?e.message:"Falha ao abrir o caixa. A solicitação pode ser reenviada com segurança.");}
  finally{setSaving(false);}
 };
 const makeMovement=async(e:React.FormEvent)=>{
  e.preventDefault();
  if(!movementShift||saving)return;
  const amount=Number(movementAmount);
  if(!Number.isFinite(amount)||amount<=0||Math.abs(amount*100-Math.round(amount*100))>0.000001||
   movementReason.trim().length<5){setError("Informe valor válido e justificativa de pelo menos 5 caracteres.");return;}
  if(!movementKey.current)movementKey.current=crypto.randomUUID();
  setSaving(true);setError("");setNotice("");
  try{
   const res=await fetch("/api/cash/movements",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({shiftId:movementShift.id,type:movementType,amount,reason:movementReason.trim(),
     expectedBalance:movementShift.recordedBalance,requestKey:movementKey.current})});
   const j=await res.json().catch(()=>({}));
   if(!res.ok)throw new Error(j.error||"Movimentação não registrada.");
   setNotice(movementType==="SUPPLY"?"Suprimento registrado e auditado.":"Sangria registrada e auditada.");
   setMovementShift(null);setMovementAmount("");setMovementReason("");movementKey.current="";
   await load();
  }catch(e){setError(e instanceof Error?e.message:"Não foi possível registrar o movimento.");}
  finally{setSaving(false);}
 };
 const closeShift=async(e:React.FormEvent)=>{
  e.preventDefault();
  if(!closingShift||saving)return;
  const counted=Number(countedAmount);
  if(!Number.isFinite(counted)||counted<0||Math.abs(counted*100-Math.round(counted*100))>0.000001){
   setError("Informe o valor físico contado em reais e centavos.");return;
  }
  if(!closingKey.current)closingKey.current=crypto.randomUUID();
  setSaving(true);setError("");setNotice("");
  try{
   const res=await fetch("/api/cash/close",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({shiftId:closingShift.id,requestKey:closingKey.current,
     expectedBalance:closingShift.recordedBalance,countedAmount:counted,notes:closingNotes})});
   const data=await res.json().catch(()=>({}));
   if(!res.ok)throw new Error(data.error||"Fechamento não realizado.");
   setNotice("Turno encerrado com contagem conferida e auditoria registrada.");
   setClosingShift(null);setCountedAmount("");setClosingNotes("");closingKey.current="";
   await load();
  }catch(e){setError(e instanceof Error?e.message:"Erro no fechamento. Nenhum registro foi presumido.");}
  finally{setSaving(false);}
 };
 if(!authLoading&&!canView)return <RootShellLayout><div className="rounded-xl border border-amber-300 bg-amber-50 p-6 text-sm text-amber-900" role="alert">Sem permissão para visualizar os turnos de caixa.</div></RootShellLayout>;
 const open=data?.shifts.filter(s=>s.status===1)||[];
 const eligible=data?.registers.filter(r=>r.available===true)||[];
 const canRegister=hasPermission("cash.register.manage")&&data?.canManageRegisters===true;
 const openingBlocked=!data?"Carregue os dados do caixa.":!canOpen||!data.canOpen?"Sem permissão para abertura de turno.":data.registers.length===0?"Cadastre um caixa antes de abrir o primeiro turno.":eligible.length===0?"Todos os caixas estão ocupados ou indisponíveis.":"";
 const startRegister=()=>{setError("");setRegisterCode(data?.registers.length===0?"CX-001":"");setRegisterName(data?.registers.length===0?"Caixa Balcão":"");setRegisterNotes("");setShowRegister(true);};
 const mismatch=data?.shifts.filter(s=>s.reconciliationMismatch)||[];
 return <RootShellLayout>
  <div className="space-y-5">
   <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div><span className="rounded-md bg-violet-50 px-2 py-1 text-[10px] font-extrabold uppercase tracking-wider text-violet-700">Frente de Loja • Operação Real</span>
     <h1 className="mt-2 text-xl font-extrabold text-slate-900">Caixa & Gestão de Turnos</h1>
     <p className="mt-1 text-xs text-slate-500">Gerencie os terminais da filial, abertura, movimentações e fechamento com conferência de numerário.</p></div>
    <div className="flex gap-2">
     <button type="button" onClick={()=>void load()} disabled={loading} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-50"><RefreshCw className="h-4 w-4"/>Atualizar</button>
     {canRegister&&<button type="button" onClick={startRegister} disabled={saving||loading} className="flex items-center gap-2 rounded-xl border border-violet-200 px-3 py-2 text-xs font-bold text-violet-700 disabled:opacity-50"><Plus className="h-4 w-4"/>Cadastrar caixa</button>}
     <button type="button" title={openingBlocked||"Abrir turno"} onClick={()=>{requestKey.current="";setError("");setRegisterId(eligible.length===1?eligible[0].id:eligible.some(r=>r.id===registerId)?registerId:"");setShowOpen(true);}} disabled={!!openingBlocked||loading||saving}
      className="flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"><Plus className="h-4 w-4"/>Abrir turno</button>
    </div>
   </header>
   {error&&<div role="alert" className="flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><AlertTriangle className="h-5 w-5 shrink-0"/>{error}</div>}
   {notice&&<div role="status" className="flex gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><CheckCircle2 className="h-5 w-5 shrink-0"/>{notice}</div>}
   {data&&openingBlocked&&<div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><strong>{openingBlocked}</strong>{data.registers.length===0&&<p className="mt-1 text-xs">{canRegister?"Use Cadastrar caixa para criar o primeiro terminal. O cadastro não gera saldo nem abre turno.":"Solicite a um responsável com permissão de gestão de caixas o cadastro de um terminal."}</p>}</div>}
   <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
    <div className="rounded-2xl border border-slate-200 bg-white p-5"><Wallet className="h-5 w-5 text-violet-700"/><div className="mt-2 text-2xl font-black text-slate-900">{data?open.length:"—"}</div><p className="text-xs text-slate-500">Turnos abertos</p></div>
    <div className="rounded-2xl border border-slate-200 bg-white p-5"><History className="h-5 w-5 text-violet-700"/><div className="mt-2 text-2xl font-black text-slate-900">{data?data.registers.length:"—"}</div><p className="text-xs text-slate-500">Caixas cadastrados na filial</p></div>
    <div className="rounded-2xl border border-slate-200 bg-white p-5"><AlertTriangle className="h-5 w-5 text-amber-600"/><div className="mt-2 text-2xl font-black text-slate-900">{data?mismatch.length:"—"}</div><p className="text-xs text-slate-500">Turnos com diferença entre saldo e movimentos</p></div>
   </div>
   {data&&data.registers.length>0&&<section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="font-extrabold text-slate-900">Caixas da filial</h2><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{data.registers.map(r=><div key={r.id} className="rounded-xl border border-slate-200 p-3"><p className="text-xs text-slate-500">{r.code}</p><strong className="text-sm">{r.name}</strong><p className={"mt-1 text-xs "+(r.available?"text-emerald-700":"text-slate-500")}>{r.available?"Disponível":r.status===1?"Turno em andamento":r.status===2?"Inativo":"Manutenção"}</p></div>)}</div></section>}
   <div className="rounded-2xl border border-slate-200 bg-white p-5">
    <h2 className="font-extrabold text-slate-900">Histórico de turnos reais</h2>
    <p className="mt-1 text-xs text-slate-500">O saldo registrado não substitui a conferência física de numerário.</p>
    {!data?<p className="mt-5 text-sm text-slate-500">{loading?"Consultando o banco...":"Dados indisponíveis."}</p>:
     data.shifts.length===0?<p className="mt-5 text-sm text-slate-500">Não há turnos nesta filial.</p>:
     <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[700px] text-left text-xs">
      <thead className="bg-slate-50 font-bold text-slate-600"><tr><th className="p-3">Caixa</th><th className="p-3">Abertura</th><th className="p-3">Estado</th><th className="p-3 text-right">Fundo inicial</th><th className="p-3 text-right">Saldo registrado</th><th className="p-3 text-right">Movimentos</th><th className="p-3">Integridade</th><th className="p-3">Ações</th></tr></thead>
      <tbody className="divide-y divide-slate-100">{data.shifts.map(s=><tr key={s.id}><td className="p-3 font-bold">{s.registerName}</td><td className="p-3">{date(s.openedAtUtc)}</td>
       <td className="p-3">{s.status===1?"Aberto":s.status===5?"Encerrado":`Estado ${s.status}`}</td>
       <td className="p-3 text-right">{money(s.openingFloat)}</td><td className="p-3 text-right font-bold">{money(s.recordedBalance)}</td>
       <td className="p-3 text-right">{s.movementCount}</td><td className={s.reconciliationMismatch?"p-3 font-bold text-rose-700":"p-3 text-emerald-700"}>{s.reconciliationMismatch?"Divergência — revisar":"Soma consistente"}</td><td className="p-3">{s.status===1&&s.operatorId===user?.id?<div className="flex gap-2">{canSupply&&<button type="button" disabled={saving} onClick={()=>{setMovementShift(s);setMovementType("SUPPLY");setError("");movementKey.current="";}} className="rounded-lg bg-violet-50 px-2 py-1 text-[11px] font-bold text-violet-700">Suprimento</button>}{canWithdraw&&<button type="button" disabled={saving} onClick={()=>{setMovementShift(s);setMovementType("WITHDRAWAL");setError("");movementKey.current="";}} className="rounded-lg bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-700">Sangria</button>}{canClose&&<button type="button" disabled={saving} onClick={()=>{setClosingShift(s);setError("");closingKey.current="";setCountedAmount("");setClosingNotes("");}} className="rounded-lg bg-slate-900 px-2 py-1 text-[11px] font-bold text-white">Fechar</button>}</div>:<span className="text-slate-400">—</span>}</td></tr>)}</tbody>
     </table></div>}
   </div>
   <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800"><LockKeyhole className="mr-2 inline h-4 w-4"/>Abertura, suprimentos e sangrias persistem no Neon. Fechamento sem diferença exige contagem física exata; divergências exigem fluxo de aprovação separado. Conciliação bancária, vendas e liquidações seguem bloqueadas até aprovação dos respectivos gates. Esta tela não cria pagamentos.</div>
  </div>
  {showRegister&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/65 p-3" role="dialog" aria-modal="true" aria-label="Cadastrar caixa"><form onSubmit={e=>void createRegister(e)} className="w-full max-w-md space-y-4 rounded-2xl bg-white p-5 shadow-xl"><h2 className="text-lg font-extrabold">Cadastrar caixa</h2><p className="text-xs text-slate-500">Terminal físico da filial. O cadastro não cria movimentações ou fundo inicial.</p>{error&&<div role="alert" className="rounded-lg bg-rose-50 p-3 text-xs text-rose-800">{error}</div>}<fieldset disabled={saving} className="space-y-3"><label className="block text-xs font-bold">Código<input required maxLength={50} pattern="[A-Za-z0-9][A-Za-z0-9._-]*" value={registerCode} onChange={e=>setRegisterCode(e.target.value)} className="mt-1 w-full rounded-lg border p-2.5 text-sm" placeholder="CX-001"/></label><label className="block text-xs font-bold">Nome<input required maxLength={150} value={registerName} onChange={e=>setRegisterName(e.target.value)} className="mt-1 w-full rounded-lg border p-2.5 text-sm" placeholder="Caixa Balcão"/></label><label className="block text-xs font-bold">Observações<textarea maxLength={500} value={registerNotes} onChange={e=>setRegisterNotes(e.target.value)} className="mt-1 w-full rounded-lg border p-2.5 text-sm"/></label></fieldset><div className="flex justify-end gap-2"><button type="button" disabled={saving} onClick={()=>{setShowRegister(false);setError("");}} className="rounded-xl border px-4 py-2 text-xs font-bold">Cancelar</button><button disabled={saving} className="rounded-xl bg-violet-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{saving?"Registrando...":"Cadastrar caixa"}</button></div></form></div>}
  {showOpen&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/65 p-3" role="dialog" aria-modal="true" aria-label="Abrir turno de caixa">
   <form onSubmit={e=>void openShift(e)} className="w-full max-w-md space-y-4 rounded-2xl bg-white p-5 shadow-xl">
    <h2 className="text-lg font-extrabold">Abrir turno no Neon</h2>
    <p className="text-xs text-slate-500">Um caixa só poderá possuir um turno aberto. O fundo inicial será registrado em movimento auditável.</p>
    {error&&<div role="alert" className="rounded-lg bg-rose-50 p-3 text-xs font-semibold text-rose-800">{error}</div>}
    <label className="block text-xs font-bold">Caixa disponível
      <select required value={registerId} onChange={e=>setRegisterId(e.target.value)} className="mt-1 w-full rounded-lg border p-2.5 text-sm">
       <option value="">Selecione um caixa</option>{eligible.map(r=><option key={r.id} value={r.id}>{r.code} • {r.name}</option>)}
      </select>
    </label>
    <label className="block text-xs font-bold">Fundo inicial (R$)
      <input required type="number" min="0" max="1000000" step="0.01" value={openingFloat} onChange={e=>setOpeningFloat(e.target.value)} className="mt-1 w-full rounded-lg border p-2.5 text-sm"/>
    </label>
    <div className="flex justify-end gap-2"><button type="button" disabled={saving} onClick={()=>{setShowOpen(false);setError("");requestKey.current="";}} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold">Cancelar</button>
     <button type="submit" disabled={saving||!registerId} className="rounded-xl bg-violet-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{saving?"Registrando...":"Abrir e auditar"}</button></div>
   </form>
  </div>}
  {movementShift&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/65 p-3" role="dialog" aria-modal="true" aria-label="Movimentação de caixa">
   <form onSubmit={e=>void makeMovement(e)} className="w-full max-w-md space-y-4 rounded-2xl bg-white p-5 shadow-xl">
    <h2 className="text-lg font-extrabold">{movementType==="SUPPLY"?"Suprimento de caixa":"Sangria de caixa"}</h2>
    <p className="text-xs text-slate-500">Turno: {movementShift.registerName} • Saldo registrado: {money(movementShift.recordedBalance)}. Operação auditada e protegida contra duplicidade.</p>
    {error&&<div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-800">{error}</div>}
    <label className="block text-xs font-bold">Valor (R$)
     <input required type="number" min="0.01" step="0.01" max={movementType==="WITHDRAWAL"?movementShift.recordedBalance:1000000}
      value={movementAmount} onChange={e=>setMovementAmount(e.target.value)} className="mt-1 w-full rounded-lg border p-2.5 text-sm"/>
    </label>
    <label className="block text-xs font-bold">Justificativa
     <textarea required minLength={5} maxLength={500} rows={3} value={movementReason} onChange={e=>setMovementReason(e.target.value)}
      className="mt-1 w-full rounded-lg border p-2.5 text-sm" placeholder="Origem ou destino dos valores e motivo da movimentação"/>
    </label>
    <div className="flex justify-end gap-2"><button type="button" disabled={saving} onClick={()=>{setMovementShift(null);setError("");movementKey.current="";}} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold">Cancelar</button>
     <button type="submit" disabled={saving} className="rounded-xl bg-violet-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{saving?"Registrando...":"Confirmar movimento"}</button></div>
   </form>
  </div>}
  {closingShift&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/65 p-3" role="dialog" aria-modal="true" aria-label="Fechamento do turno">
   <form onSubmit={e=>void closeShift(e)} className="w-full max-w-md space-y-4 rounded-2xl bg-white p-5 shadow-xl">
    <h2 className="text-lg font-extrabold">Conferência e fechamento do caixa</h2>
    <p className="text-xs text-slate-500">Conte fisicamente o dinheiro antes de informar o valor. Turnos com diferença não serão encerrados automaticamente.</p>
    {error&&<div role="alert" className="rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-800">{error}</div>}
    <label className="block text-xs font-bold">Total contado em dinheiro (R$)
     <input required type="number" min="0" step="0.01" value={countedAmount}
      onChange={e=>setCountedAmount(e.target.value)} className="mt-1 w-full rounded-lg border p-2.5 text-sm" />
    </label>
    <label className="block text-xs font-bold">Observações
     <textarea maxLength={500} rows={3} value={closingNotes} onChange={e=>setClosingNotes(e.target.value)}
      className="mt-1 w-full rounded-lg border p-2.5 text-sm"/>
    </label>
    <div className="flex justify-end gap-2"><button type="button" disabled={saving}
      onClick={()=>{setClosingShift(null);closingKey.current="";setError("");}}
      className="rounded-xl border px-4 py-2 text-xs font-bold">Cancelar</button>
     <button type="submit" disabled={saving} className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white disabled:opacity-40">
      {saving?"Conferindo...":"Conferir e fechar"}</button></div>
   </form>
  </div>}
 </RootShellLayout>;
}
