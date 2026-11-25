"use client";

import React, { useState } from "react";
import RootShellLayout from "@/components/RootShellLayout";
import {
  Printer,
  Layers,
  Calculator,
  Plus,
  Play,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Clock,
  Weight,
  Coins,
  ShieldCheck,
  FolderCode,
  Sparkles,
  Search,
  Activity
} from "lucide-react";

interface PrinterItem {
  id: string;
  name: string;
  code: string;
  technology: string;
  nominalPowerWatts: number;
  hourlyRateCost: number;
  status: "Available" | "Printing" | "Maintenance" | "OutOfService";
  currentJobNote?: string;
}

interface ManufacturingOrderView {
  id: string;
  orderNumber: string;
  assetName: string;
  stlVersion: string;
  customerName: string;
  quantity: number;
  status: "Planned" | "Ready" | "InProduction" | "QualityInspection" | "Completed" | "Cancelled";
  plannedMassGrams: number;
  actualMassGrams: number;
  wastedMassGrams: number;
  totalCost: number;
  unitCost: number;
  targetDate: string;
}


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

export default function ManufacturingPage() {
  const [activeTab, setActiveTab] = useState<"orders" | "printers" | "quote" | "library">("orders");

  // Nenhuma impressora demonstrativa: equipamento só pode existir após cadastro persistido.
  const [printers] = useState<PrinterItem[]>([]);

  const [orders, setOrders] = useState<ManufacturingOrderView[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<ManufacturingOrderView | null>(null);

  // Modal para Nova Ordem de Produção
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [newOrderAsset, setNewOrderAsset] = useState("");
  const [newOrderCustomer, setNewOrderCustomer] = useState("");
  const [newOrderQty, setNewOrderQty] = useState(1);
  const [newOrderMass, setNewOrderMass] = useState(0);

  // Modal para Registro de Falha / Refugo
  const [showFailureModal, setShowFailureModal] = useState(false);
  const [failureReason, setFailureReason] = useState("");
  const [failureWastedGrams, setFailureWastedGrams] = useState(0);
  const [failureWastedMinutes, setFailureWastedMinutes] = useState(0);

  // Escritas operacionais bloqueadas até integração com o banco Neon.
  const handleCreateOrder = (e: React.FormEvent) => {
    e.preventDefault();
    window.alert("Ordens de produção aguardam integração real com Neon; nenhum registro foi criado.");
  };
  const handleStartOrder = (_opId: string) => {
    window.alert("Operação indisponível sem persistência no Neon.");
  };
  const handleCompleteOrder = (_opId: string) => {
    window.alert("Operação indisponível sem persistência no Neon.");
  };
  const handleRegisterFailure = (e: React.FormEvent) => {
    e.preventDefault();
    window.alert("Refugos aguardam integração com o Neon.");
  };

  return (
    <RootShellLayout>
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50/50">
        {/* Top Header */}
        <div className="px-6 py-4 bg-white border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold tracking-wider text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200/60 uppercase">
                MOD-10 • Indústria 4.0
              </span>
              <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> Estimativas industriais
              </span>
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight mt-1 flex items-center gap-2">
              <Printer className="w-5 h-5 text-purple-600" />
              Fábrica 3D & Apuração de Custos
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Calculadora de estimativas industriais. Ordens e estoque ainda aguardam integração operacional.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setActiveTab("quote")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm hover:bg-slate-50 hover:border-slate-400 transition-all"
            >
              <Calculator className="w-3.5 h-3.5 text-purple-600" />
              Calculadora 3D
            </button>
            <button
              disabled title="Aguardando integração com Neon"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-purple-600 rounded-lg shadow-sm hover:bg-purple-700 shadow-purple-600/20 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              Nova Ordem (OP)
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 bg-white border-b border-slate-200 flex items-center gap-6 text-xs font-semibold">
          <button
            onClick={() => setActiveTab("orders")}
            className={`py-3 flex items-center gap-1.5 border-b-2 transition-colors ${
              activeTab === "orders"
                ? "border-purple-600 text-purple-700"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            <Layers className="w-4 h-4" />
            Ordens de Produção ({orders.length})
          </button>
          <button
            onClick={() => setActiveTab("printers")}
            className={`py-3 flex items-center gap-1.5 border-b-2 transition-colors ${
              activeTab === "printers"
                ? "border-purple-600 text-purple-700"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            <Printer className="w-4 h-4" />
            Parque de Impressoras ({printers.length})
          </button>
          <button
            onClick={() => setActiveTab("quote")}
            className={`py-3 flex items-center gap-1.5 border-b-2 transition-colors ${
              activeTab === "quote"
                ? "border-purple-600 text-purple-700"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            <Calculator className="w-4 h-4" />
            Calculadora de Orçamentos
          </button>
          <button
            onClick={() => setActiveTab("library")}
            className={`py-3 flex items-center gap-1.5 border-b-2 transition-colors ${
              activeTab === "library"
                ? "border-purple-600 text-purple-700"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            <FolderCode className="w-4 h-4" />
            Biblioteca de Arquivos STL / 3MF
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-auto p-6">
          {activeTab === "orders" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
              {/* Left Column: Orders List */}
              <div className="lg:col-span-2 flex flex-col bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">Fila Operacional de Produção</span>
                    <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-semibold">
                      {orders.length} cadastradas
                    </span>
                  </div>
                </div>

                <div className="flex-1 overflow-auto">
                  {orders.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400">
                      <Layers className="w-12 h-12 text-slate-300 mb-3" />
                      <p className="text-sm font-semibold text-slate-700">Nenhuma Ordem de Produção Ativa</p>
                      <p className="text-xs text-slate-500 max-w-sm mt-1">
                        Crie uma nova OP vinculando insumos de filamento para acompanhar o tempo de máquina e custo real.
                      </p>
                      <button
                        disabled title="Aguardando integração com Neon"
                        className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Criar primeira ordem de produção
                      </button>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {orders.map((op) => (
                        <div
                          key={op.id}
                          onClick={() => setSelectedOrder(op)}
                          className={`p-4 cursor-pointer transition-colors flex items-center justify-between ${
                            selectedOrder?.id === op.id ? "bg-purple-50/60" : "hover:bg-slate-50"
                          }`}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-slate-900">{op.orderNumber}</span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                                  op.status === "Completed"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : op.status === "InProduction"
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-slate-100 text-slate-700"
                                }`}
                              >
                                {op.status}
                              </span>
                            </div>
                            <h3 className="text-sm font-semibold text-slate-800">{op.assetName}</h3>
                            <div className="flex items-center gap-3 text-xs text-slate-500">
                              <span>Cliente: {op.customerName}</span>
                              <span>•</span>
                              <span>Massa: {op.plannedMassGrams}g</span>
                              <span>•</span>
                              <span>Prazo: {op.targetDate}</span>
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="text-sm font-bold text-slate-900">
                              R$ {op.totalCost.toFixed(2)}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              R$ {op.unitCost.toFixed(2)} / un
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Order Details & Actions */}
              <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5 flex flex-col justify-between">
                {selectedOrder ? (
                  <div className="space-y-4">
                    <div className="border-b border-slate-100 pb-3">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
                          {selectedOrder.orderNumber}
                        </span>
                        <span className="text-xs font-semibold text-slate-500">{selectedOrder.targetDate}</span>
                      </div>
                      <h2 className="text-base font-bold text-slate-900 mt-2">{selectedOrder.assetName}</h2>
                      <p className="text-xs text-slate-500">Versão de fatiamento: {selectedOrder.stlVersion}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                        <span className="text-slate-400 block font-medium">Massa Planejada</span>
                        <span className="text-slate-800 font-bold text-sm">{selectedOrder.plannedMassGrams} g</span>
                      </div>
                      <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                        <span className="text-slate-400 block font-medium">Refugo Acumulado</span>
                        <span className="text-rose-600 font-bold text-sm">{selectedOrder.wastedMassGrams} g</span>
                      </div>
                      <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                        <span className="text-slate-400 block font-medium">Custo Total Incorrido</span>
                        <span className="text-purple-700 font-bold text-sm">R$ {selectedOrder.totalCost.toFixed(2)}</span>
                      </div>
                      <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                        <span className="text-slate-400 block font-medium">Status Atual</span>
                        <span className="text-slate-800 font-bold text-sm">{selectedOrder.status}</span>
                      </div>
                    </div>

                    <div className="space-y-2 pt-2">
                      <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Ações de Chão de Fábrica</h3>

                      {selectedOrder.status === "Planned" && (
                        <button
                          onClick={() => handleStartOrder(selectedOrder.id)}
                          className="w-full flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
                        >
                          <Play className="w-3.5 h-3.5" />
                          Iniciar Produção na Máquina
                        </button>
                      )}

                      {selectedOrder.status === "InProduction" && (
                        <div className="space-y-2">
                          <button
                            onClick={() => handleCompleteOrder(selectedOrder.id)}
                            className="w-full flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Aprovar Inspeção & Finalizar OP
                          </button>
                          <button
                            onClick={() => setShowFailureModal(true)}
                            className="w-full flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors"
                          >
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                            Apontar Falha / Refugo de Impressão
                          </button>
                        </div>
                      )}

                      {selectedOrder.status === "Completed" && (
                        <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 text-xs text-emerald-800 font-medium flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                          <span>Peça inspecionada e entrada oficial realizada no Kardex do Estoque.</span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 p-6">
                    <Printer className="w-10 h-10 text-slate-300 mb-2" />
                    <p className="text-xs font-medium">Selecione uma ordem de produção para visualizar os detalhes e apontamentos técnicos.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "printers" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {printers.map((p) => (
                <div key={p.id} className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
                        <Printer className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">{p.name}</h3>
                        <span className="text-[10px] font-mono text-slate-500">{p.code}</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 uppercase">
                      {p.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                      <span className="text-slate-400 block text-[10px]">Tecnologia</span>
                      <span className="font-semibold text-slate-700">{p.technology}</span>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                      <span className="text-slate-400 block text-[10px]">Potência Máxima</span>
                      <span className="font-semibold text-slate-700">{p.nominalPowerWatts} W</span>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                      <span className="text-slate-400 block text-[10px]">Taxa Hora-Máquina</span>
                      <span className="font-semibold text-purple-700">R$ {p.hourlyRateCost.toFixed(2)}/h</span>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                      <span className="text-slate-400 block text-[10px]">Depreciação Ativa</span>
                      <span className="font-semibold text-slate-700">Incluída no Custo</span>
                    </div>
                  </div>

                  <div className="text-xs text-slate-500 bg-slate-50/80 p-2.5 rounded-lg border border-slate-100">
                    <span className="font-semibold text-slate-700 block mb-0.5">Diagnóstico Operacional:</span>
                    {p.currentJobNote}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === "quote" && <FactoryEstimate />}

          {activeTab === "library" && (
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-6 text-center text-slate-500">
              <FolderCode className="w-12 h-12 text-slate-300 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-slate-800">Biblioteca Central de Ativos 3D (STL / 3MF)</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                Catálogo de modelos digitais com rastreamento de revisões técnicas e hash SHA-256 para integridade dos arquivos fatiados.
              </p>
            </div>
          )}
        </div>

        {/* Modal Nova Ordem */}
        {showNewOrderModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900">Nova Ordem de Produção (OP)</h3>
                <button onClick={() => setShowNewOrderModal(false)} className="text-slate-400 hover:text-slate-600">
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateOrder} className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Nome da Peça / Modelo *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Suporte Articulado Magsafe Desk"
                    value={newOrderAsset}
                    onChange={(e) => setNewOrderAsset(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-purple-600"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Cliente / Destino</label>
                  <input
                    type="text"
                    placeholder="Ex: Carlos Silva ou 'Estoque Loja'"
                    value={newOrderCustomer}
                    onChange={(e) => setNewOrderCustomer(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-purple-600"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">Quantidade</label>
                    <input
                      type="number"
                      min="1"
                      value={newOrderQty}
                      onChange={(e) => setNewOrderQty(Number(e.target.value))}
                      className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-purple-600"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">Massa Unitária (g)</label>
                    <input
                      type="number"
                      min="1"
                      value={newOrderMass}
                      onChange={(e) => setNewOrderMass(Number(e.target.value))}
                      className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-purple-600"
                    />
                  </div>
                </div>

                <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowNewOrderModal(false)}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-sm"
                  >
                    Salvar Ordem
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Falha de Impressão */}
        {showFailureModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <h3 className="text-sm font-bold text-slate-900">Apontamento de Falha / Refugo</h3>
                </div>
                <button onClick={() => setShowFailureModal(false)} className="text-slate-400 hover:text-slate-600">
                  ✕
                </button>
              </div>

              <form onSubmit={handleRegisterFailure} className="space-y-3">
                <p className="text-xs text-slate-500">
                  O custo dos insumos perdidos será retido na OP como custo contábil de refugo sem criar estoques paralelos.
                </p>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Motivo Técnico da Falha *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Descolamento da primeira camada (Warping)"
                    value={failureReason}
                    onChange={(e) => setFailureReason(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-purple-600"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">Massa Perdida (g)</label>
                    <input
                      type="number"
                      value={failureWastedGrams}
                      onChange={(e) => setFailureWastedGrams(Number(e.target.value))}
                      className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">Tempo Perdido (min)</label>
                    <input
                      type="number"
                      value={failureWastedMinutes}
                      onChange={(e) => setFailureWastedMinutes(Number(e.target.value))}
                      className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg"
                    />
                  </div>
                </div>

                <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowFailureModal(false)}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm"
                  >
                    Registrar Refugo
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </RootShellLayout>
  );
}
