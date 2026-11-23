"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import RootShellLayout from "@/components/RootShellLayout";
import { useAuth } from "@/lib/auth";
import {
  Wrench,
  Smartphone,
  Cpu,
  Tv,
  Plus,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  X,
  PlusCircle,
  Trash2,
  Maximize2,
  ArrowRight,
  User,
  Hash,
  Laptop,
  Check,
  ChevronRight,
  Package,
} from "lucide-react";

// Categorias do Kanban requisitadas pelo cliente
const KANBAN_STAGES = [
  { id: "nao_iniciado", label: "Não Iniciado / Triagem", statuses: [1, 2], color: "from-slate-500 to-slate-600", border: "border-slate-300", badge: "bg-slate-100 text-slate-700" },
  { id: "iniciado", label: "Iniciado / Em Bancada", statuses: [3, 8], color: "from-blue-600 to-indigo-600", border: "border-blue-400", badge: "bg-blue-50 text-blue-700" },
  { id: "aguardando_peca", label: "Aguardando Peça", statuses: [7], color: "from-amber-500 to-amber-600", border: "border-amber-400", badge: "bg-amber-50 text-amber-700" },
  { id: "aguardando_cliente", label: "Aguardando Cliente", statuses: [4], color: "from-purple-500 to-purple-600", border: "border-purple-400", badge: "bg-purple-50 text-purple-700" },
  { id: "pronto", label: "Pronto / Testado", statuses: [10, 11], color: "from-emerald-500 to-emerald-600", border: "border-emerald-400", badge: "bg-emerald-50 text-emerald-700" },
  { id: "entregue", label: "Entregue", statuses: [12], color: "from-teal-600 to-teal-700", border: "border-teal-300", badge: "bg-teal-50 text-teal-700" },
];

export default function RepairsPage() {
  const {hasPermission,isLoading:authLoading}=useAuth();
  const canView=hasPermission("repairs.view");
  const canCreate=hasPermission("repairs.create");
  const canQuote=hasPermission("repairs.quote");
  const canExecute=hasPermission("repairs.execute");
  const canQuality=hasPermission("repairs.quality");
  const canDeliver=hasPermission("repairs.deliver");
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const createRequestKey = useRef<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deliveryRequest, setDeliveryRequest] = useState<string | null>(null);
  const [deliveryRecipient, setDeliveryRecipient] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [itemDraft,setItemDraft]=useState<{orderId:string;itemType:1|2;description:string;quantity:string;unitPrice:string}|null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [tvMode, setTvMode] = useState(false);
  const [filterQuery, setFilterQuery] = useState("");
  const [filterType, setFilterType] = useState("all");

  // Dados auxiliares para vincular cliente e produtos
  const [auxCustomers, setAuxCustomers] = useState<{ id: string; name: string }[]>([]);
  const [auxProducts, setAuxProducts] = useState<{ id: string; name: string; skuCode: string; price: number }[]>([]);

  // Modais
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);

  // Form de Criação de OS
  const [createCustomerName, setCreateCustomerName] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [equipmentType, setEquipmentType] = useState("Computador");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [color, setColor] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [equipmentDetails, setEquipmentDetails] = useState("");
  const [reportedDefect, setReportedDefect] = useState("");
  const [initialItems, setInitialItems] = useState<Array<{ itemType: number; description: string; quantity: number; unitPrice: number; productSkuId?: string }>>([]);

  // Erros de API nunca devem ser interpretados como listas vazias.
  const readApi = async (response: Response) => {
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || `Falha na operação (HTTP ${response.status})`);
    return body;
  };
  const loadOrders = async () => {
    try {
      setLoading(true);
      const data = await readApi(await fetch("/api/repairs/orders", { cache: "no-store" }));
      setOrders(data.orders || []);
    } catch(err) {
      setErrorMessage(err instanceof Error ? err.message : "Falha ao consultar OS no Neon.");
    } finally { setLoading(false); }
  };
  const loadAuxData = async () => {
    try {
      const data = await readApi(await fetch("/api/repairs/auxiliary", { cache: "no-store" }));
      setAuxCustomers(data.customers || []);
      setAuxProducts(data.products || []);
    } catch(err) {
      setErrorMessage(err instanceof Error ? err.message : "Falha ao consultar dados auxiliares.");
    }
  };
  useEffect(() => {
    if(authLoading||!canView)return;
    void loadOrders();
    void loadAuxData();
    const interval = setInterval(() => { void loadOrders(); }, 30000);
    return () => clearInterval(interval);
  }, [authLoading,canView]);
  const handleAddInitialItem = (type: number) => {
    setInitialItems(previous => [...previous, {itemType:type,description:"",quantity:1,unitPrice:0}]);
  };
  const handleCreateSubmit = async (event:React.FormEvent) => {
    event.preventDefault();
    if(saving) return;
    if (!reportedDefect.trim() || (!selectedCustomerId && !createCustomerName.trim())) {
      setErrorMessage("Informe o cliente e o defeito relatado.");
      return;
    }
    try {
      setSaving(true); setErrorMessage(null);setSuccessMessage(null);
      if (!createRequestKey.current) createRequestKey.current = crypto.randomUUID();
      const data = await readApi(await fetch("/api/repairs/orders",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({requestKey:createRequestKey.current,customerId:selectedCustomerId||undefined,customerName:createCustomerName.trim()||undefined,
          equipmentType,brand,model,color,serialNumber,equipmentDetails,reportedDefect,items:initialItems})
      }));
      setShowCreateModal(false);
      resetCreateForm();
      createRequestKey.current = "";
      setSuccessMessage(`OS ${data.orderNumber} cadastrada no Neon.`);
      await loadOrders();
    } catch(err) {
      setErrorMessage(err instanceof Error ? err.message : "Erro ao cadastrar OS.");
    } finally {setSaving(false);}
  };
  const resetCreateForm = () => {
    setCreateCustomerName("");setSelectedCustomerId("");setEquipmentType("Computador");
    setBrand("");setModel("");setColor("");setSerialNumber("");setEquipmentDetails("");
    setReportedDefect("");setInitialItems([]);
  };
  const handleMoveStatus = async (orderId:string,newStatus:number,delivery?:{recipient:string;notes:string}) => {
    if(newStatus===12 && !delivery) {
      setErrorMessage(null);setDeliveryRequest(orderId);return;
    }
    if(newStatus===12 && (!delivery?.recipient.trim() || delivery.recipient.trim().length<2)) {
      setErrorMessage("Informe o nome de quem está retirando o equipamento.");return;
    }
    const current=orders.find(o=>o.id===orderId);
    if(!current || saving) return;
    try {
      setSaving(true);setErrorMessage(null);setSuccessMessage(null);
      await readApi(await fetch(`/api/repairs/orders/${encodeURIComponent(orderId)}`,{
        method:"PUT",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({status:newStatus,expectedStatus:current.status,
          expectedUpdatedAtUtc:current.updatedAtUtc||null,
          deliveredToPersonName:delivery?.recipient||null,deliveryNotes:delivery?.notes||null})
      }));
      setSuccessMessage("Status da OS atualizado e auditado.");
      if(newStatus===12) {setDeliveryRequest(null);setDeliveryRecipient("");setDeliveryNotes("");}
      await loadOrders();
      setSelectedOrder((prev:any)=>prev?.id===orderId?{...prev,status:newStatus}:prev);
    } catch(err) {
      setErrorMessage(err instanceof Error ? err.message : "Erro ao atualizar status.");
      await loadOrders();
    } finally {setSaving(false);}
  };
  const handleSaveOrderItems = async (orderId:string,updatedItems:any[]) => {
    const current=orders.find(o=>o.id===orderId);
    if(!current || saving) return false;
    try {
      setSaving(true);setErrorMessage(null);setSuccessMessage(null);
      await readApi(await fetch(`/api/repairs/orders/${encodeURIComponent(orderId)}`,{
        method:"PUT",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({items:updatedItems.map(i=>({itemType:i.itemType,
          description:i.description,quantity:i.quantity,unitPrice:i.unitPrice,productSkuId:i.productSkuId||null})),
          expectedStatus:current.status,expectedUpdatedAtUtc:current.updatedAtUtc||null})
      }));
      setSuccessMessage("Itens e totais da OS atualizados com sucesso.");
      await loadOrders();
      setSelectedOrder((prev:any)=>prev?.id===orderId?{...prev,items:updatedItems}:prev);
      return true;
    } catch(err) {
      setErrorMessage(err instanceof Error?err.message:"Erro ao salvar itens.");
      await loadOrders();
      return false;
    } finally {setSaving(false);}
  };

  // Filtragem de ordens
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const q = filterQuery.toLowerCase();
      const matchText =
        o.orderNumber.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.equipmentDetails.toLowerCase().includes(q) ||
        o.serialNumber.toLowerCase().includes(q) ||
        o.reportedDefect.toLowerCase().includes(q);

      const matchType =
        filterType === "all" ||
        (filterType === "pc" && (o.equipmentType.toLowerCase().includes("pc") || o.equipmentType.toLowerCase().includes("computador"))) ||
        (filterType === "celular" && (o.equipmentType.toLowerCase().includes("celular") || o.equipmentType.toLowerCase().includes("smart") || o.equipmentType.toLowerCase().includes("phone")));

      return matchText && matchType;
    });
  }, [orders, filterQuery, filterType]);

  if(!authLoading&&!canView) return <RootShellLayout><div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">Sem permissão para visualizar as ordens de serviço.</div></RootShellLayout>;

  // Se estiver no Modo TV Sala de Manutenção
  if (tvMode) {
    return (
      <div className="min-h-screen bg-[#070b14] text-white p-6 flex flex-col font-sans select-none">
        {/* TV Mode Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-violet-600 to-purple-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Tv className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-black tracking-tight text-white uppercase">
                  HB Studio • Painel de Manutenção em Tempo Real
                </h1>
                <span className="bg-emerald-500/20 text-emerald-400 text-xs px-2.5 py-0.5 rounded-full font-bold border border-emerald-500/30 flex items-center gap-1.5 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span> Ao Vivo na TV
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Monitoramento contínuo de bancada: Computadores, Pastas Térmicas, Limpezas e Smartphones.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-xl font-mono font-bold text-purple-400">
                {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </div>
              <div className="text-[10px] text-slate-400 uppercase font-semibold">
                Total em Processo: {orders.length}
              </div>
            </div>
            <button
              onClick={() => setTvMode(false)}
              className="p-3 bg-white/10 hover:bg-white/20 rounded-xl text-slate-300 hover:text-white transition-all cursor-pointer"
              title="Sair do Modo TV"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* TV Grid - Kanban 6 Colunas Amplas */}
        <div className="flex-1 grid grid-cols-6 gap-4 overflow-hidden">
          {KANBAN_STAGES.map((stage) => {
            const stageOrders = filteredOrders.filter((o) => stage.statuses.includes(o.status));
            return (
              <div key={stage.id} className="bg-[#0b1220] rounded-2xl border border-white/5 flex flex-col overflow-hidden shadow-2xl">
                <div className={`p-3.5 bg-gradient-to-r ${stage.color} text-white font-black text-xs uppercase tracking-wider flex items-center justify-between`}>
                  <span>{stage.label}</span>
                  <span className="bg-black/30 text-white px-2 py-0.5 rounded-full text-[11px] font-mono">
                    {stageOrders.length}
                  </span>
                </div>

                <div className="flex-1 p-3 space-y-3 overflow-y-auto">
                  {stageOrders.map((o) => (
                    <div
                      key={o.id}
                      className="bg-[#121b2d] border border-white/10 rounded-xl p-3.5 shadow-md space-y-2 hover:border-purple-500/50 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-black text-purple-400 bg-purple-950/60 border border-purple-500/30 px-2 py-0.5 rounded-md">
                          {o.orderNumber}
                        </span>
                        <span className="text-[10px] font-semibold text-slate-400">
                          {o.equipmentType}
                        </span>
                      </div>

                      <div className="font-bold text-sm text-slate-100 line-clamp-1">
                        {o.equipmentDetails || `${o.brand} ${o.model}`}
                      </div>

                      <div className="text-xs text-slate-300 line-clamp-2 bg-black/20 p-2 rounded-lg border border-white/5">
                        <span className="text-slate-400 font-semibold">Defeito:</span> {o.reportedDefect}
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[11px] text-slate-400">
                        <span className="truncate max-w-[120px] font-medium text-slate-300">
                          👤 {o.customerName}
                        </span>
                        <span className="font-mono font-bold text-emerald-400">
                          R$ {o.finalPrice.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}

                  {stageOrders.length === 0 && (
                    <div className="h-32 flex items-center justify-center text-slate-600 text-xs italic">
                      Nenhum equipamento
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Visualização Padrão ERP HB Studio
  return (
    <RootShellLayout>
      <div className="space-y-6">
        {errorMessage && <div role="alert" className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900">{errorMessage}<button type="button" onClick={()=>setErrorMessage(null)} className="ml-3 font-bold underline">Fechar</button></div>}
        {successMessage && <div role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900">{successMessage}<button type="button" onClick={()=>setSuccessMessage(null)} className="ml-3 font-bold underline">Fechar</button></div>}
        {/* Header Oficial do Módulo HBVisionX */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-700 bg-purple-50 px-3 py-1 rounded-full border border-purple-200">
                Oficina & Laboratório Técnico
              </span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 mt-2">
              Módulo Manutenção & Assistência Técnica
            </h1>
            <p className="text-xs text-slate-500 mt-1 max-w-3xl">
              Controle absoluto de reparos para computadores gamers, celulares e periféricos. Gere número de OS exclusivo para cada máquina, acompanhe o fluxo no Kanban em tempo real e projete na TV da oficina.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 self-start md:self-center">
            <button
              onClick={() => setTvMode(true)}
              className="h-10 px-4 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap"
            >
              <Tv className="w-4 h-4 text-purple-400" />
              <span>Modo TV Oficina</span>
            </button>

            <button
              onClick={loadOrders}
              className="h-10 w-10 flex items-center justify-center bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl transition-all cursor-pointer shrink-0 shadow-xs"
              title="Atualizar dados"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-purple-600" : ""}`} />
            </button>

            <button
              onClick={() => {setErrorMessage(null);createRequestKey.current="";setShowCreateModal(true);}}
              disabled={!canCreate}
              className="h-10 px-5 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white text-xs font-extrabold rounded-xl shadow-md shadow-purple-600/20 flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Nova Ordem de Serviço</span>
            </button>
          </div>
        </div>

        {/* Barra de Filtros e Busca Rápida */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por OS, cliente, equipamento (ex: PC Gamer Ryzen 7) ou serial..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs text-slate-400 font-semibold flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" /> Filtrar:
            </span>
            <button
              onClick={() => setFilterType("all")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                filterType === "all" ? "bg-purple-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Todos ({orders.length})
            </button>
            <button
              onClick={() => setFilterType("pc")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                filterType === "pc" ? "bg-purple-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Computadores
            </button>
            <button
              onClick={() => setFilterType("celular")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                filterType === "celular" ? "bg-purple-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Smartphones
            </button>
          </div>
        </div>

        {/* Quadro Kanban Operacional (6 Fases) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 items-start">
          {KANBAN_STAGES.map((stage) => {
            const stageOrders = filteredOrders.filter((o) => stage.statuses.includes(o.status));

            return (
              <div
                key={stage.id}
                className="bg-slate-50/80 rounded-2xl border border-slate-200/90 flex flex-col min-h-[580px] overflow-hidden"
              >
                {/* Header da Coluna */}
                <div className="p-3.5 bg-white border-b border-slate-200/80 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full bg-gradient-to-r ${stage.color}`}></span>
                    <span className="font-extrabold text-xs text-slate-800 tracking-tight">
                      {stage.label}
                    </span>
                  </div>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${stage.badge}`}>
                    {stageOrders.length}
                  </span>
                </div>

                {/* Lista de Cards da Coluna */}
                <div className="p-3 space-y-3 flex-1 overflow-y-auto">
                  {stageOrders.map((order) => (
                    <div
                      key={order.id}
                      onClick={() => setSelectedOrder(order)}
                      className="bg-white p-4 rounded-xl border border-slate-200/80 hover:border-purple-400 hover:shadow-md transition-all cursor-pointer space-y-2.5 group"
                    >
                      {/* Topo do Card: Número da OS e Tipo */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-black text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200/60">
                          {order.orderNumber}
                        </span>
                        <span className="text-[10px] font-semibold text-slate-400 uppercase">
                          {order.equipmentType}
                        </span>
                      </div>

                      {/* Descrição Detalhada do Computador / Smartphone */}
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 group-hover:text-purple-600 transition-colors line-clamp-2">
                          {order.equipmentDetails || `${order.brand} ${order.model}`}
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2 bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                          <strong className="text-slate-600">Serviço/Defeito:</strong> {order.reportedDefect}
                        </p>
                      </div>

                      {/* Peças e Serviços Vinculados */}
                      {order.items && order.items.length > 0 && (
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-600 bg-purple-50/50 px-2 py-1 rounded-md border border-purple-100">
                          <Package className="w-3 h-3 text-purple-600" />
                          <span>{order.items.length} item(ns) incluído(s)</span>
                        </div>
                      )}

                      {/* Rodapé: Cliente e Valor Total */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                        <span className="text-slate-600 text-[11px] truncate max-w-[110px]" title={order.customerName}>
                          👤 {order.customerName}
                        </span>
                        <span className="font-mono font-extrabold text-slate-900">
                          R$ {order.finalPrice.toFixed(2)}
                        </span>
                      </div>

                      {/* Ações Rápidas de Avanço de Status */}
                      <div className="pt-1 flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        <select
                          value={order.status}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => handleMoveStatus(order.id, Number(e.target.value))}
                          disabled={saving||!(canExecute||canQuality||canDeliver)}
                          className="text-[10px] font-bold bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-md px-1.5 py-1 text-slate-700 cursor-pointer"
                        >
                          <option value={1}>Triagem / Não Iniciado</option>
                          <option value={8}>Em Bancada / Iniciado</option>
                          <option value={7}>Aguardando Peça</option>
                          <option value={4}>Aguardando Cliente</option>
                          <option value={10}>Pronto / Testado</option>
                          <option value={12}>Entregue</option>
                        </select>
                      </div>
                    </div>
                  ))}

                  {stageOrders.length === 0 && (
                    <div className="h-40 flex flex-col items-center justify-center text-slate-400 text-xs italic border-2 border-dashed border-slate-200 rounded-xl p-4 text-center">
                      <span>Nenhuma OS nesta etapa</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* MODAL 1: Nova Ordem de Serviço */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white w-full max-w-2xl rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xl overflow-y-auto max-h-[calc(100dvh-1rem)] my-2 sm:my-8 animate-in fade-in zoom-in-95">
              <div className="p-6 bg-gradient-to-r from-purple-700 to-indigo-700 text-white flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black tracking-tight">Criar Nova Ordem de Serviço (OS)</h3>
                  <p className="text-xs text-purple-200 mt-0.5">
                    Geração automática de documento de OS integrado com vendas, clientes e produtos.
                  </p>
                </div>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-2 text-purple-200 hover:text-white rounded-xl hover:bg-white/10 transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateSubmit} className="p-3 sm:p-6 space-y-5">
                {errorMessage && <div role="alert" className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-900">{errorMessage}</div>}
                {/* 1. Cliente */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-extrabold text-slate-700">
                    Cliente Solicitante *
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={selectedCustomerId}
                      onChange={(e) => {
                        setSelectedCustomerId(e.target.value);
                        const c = auxCustomers.find((x) => x.id === e.target.value);
                        if (c) setCreateCustomerName(c.name);
                      }}
                      className="w-1/2 p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500/20"
                    >
                      <option value="">-- Selecione cliente cadastrado --</option>
                      {auxCustomers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>

                    <input
                      type="text"
                      placeholder="Ou digite o nome do cliente..."
                      value={createCustomerName}
                      onChange={(e) => {
                        setCreateCustomerName(e.target.value);
                        setSelectedCustomerId("");
                      }}
                      className="w-1/2 p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500/20"
                    />
                  </div>
                </div>

                {/* 2. Equipamento */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-xs font-extrabold text-slate-700">Tipo de Equipamento</label>
                    <select
                      value={equipmentType}
                      onChange={(e) => setEquipmentType(e.target.value)}
                      className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                    >
                      <option value="Computador Gamer">Computador Gamer / Desktop</option>
                      <option value="Notebook">Notebook</option>
                      <option value="Smartphone">Smartphone / Celular</option>
                      <option value="Console / Periférico">Console / Periférico</option>
                      <option value="Impressora 3D">Impressora 3D</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-extrabold text-slate-700">Serial / IMEI (Opcional)</label>
                    <input
                      type="text"
                      placeholder="Ex: S/N ou IMEI"
                      value={serialNumber}
                      onChange={(e) => setSerialNumber(e.target.value)}
                      className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                    />
                  </div>
                </div>

                {/* 3. Detalhes Identificadores na OS (Ex: PC Gamer Branco Ryzen 7) */}
                <div className="space-y-1">
                  <label className="block text-xs font-extrabold text-slate-700">
                    Descrição Detalhada na OS (Identificação da Máquina) *
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: PC Gamer Branco Ryzen 7 5700X, Gabinete Aquário, RTX 4060"
                    value={equipmentDetails}
                    onChange={(e) => setEquipmentDetails(e.target.value)}
                    required
                    className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                  />
                  <p className="text-[10px] text-slate-400">
                    Esse texto será a identidade visual do computador no Kanban e na TV da oficina.
                  </p>
                </div>

                {/* 4. Defeito / Serviço Relatado */}
                <div className="space-y-1">
                  <label className="block text-xs font-extrabold text-slate-700">
                    Defeito Relatado / Serviços Solicitados *
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Ex: Troca de pasta térmica, limpeza profunda dos coolers, upgrade de SSD..."
                    value={reportedDefect}
                    onChange={(e) => setReportedDefect(e.target.value)}
                    required
                    className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>

                {/* 5. Peças & Serviços Iniciais */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5 text-purple-600" /> Itens, Peças e Serviços Previstos
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleAddInitialItem(1)}
                        className="text-[11px] font-bold text-purple-600 hover:text-purple-700 bg-purple-50 px-2 py-1 rounded-lg cursor-pointer"
                      >
                        + Adicionar Serviço
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddInitialItem(2)}
                        className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-2 py-1 rounded-lg cursor-pointer"
                      >
                        + Adicionar Peça/Produto
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                    {initialItems.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-white border border-slate-200">
                          {item.itemType === 1 ? "Mão de Obra" : "Produto"}
                        </span>
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => {
                            const copy = [...initialItems];
                            copy[idx].description = e.target.value;
                            setInitialItems(copy);
                          }}
                          className="flex-1 p-1 text-xs bg-white border border-slate-200 rounded-lg"
                        />
                        <div className="w-16">
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => {
                              const copy = [...initialItems];
                              copy[idx].quantity = Number(e.target.value);
                              setInitialItems(copy);
                            }}
                            className="w-full p-1 text-xs bg-white border border-slate-200 rounded-lg text-center font-mono"
                          />
                        </div>
                        <div className="w-24">
                          <input
                            type="number"
                            step="0.01"
                            value={item.unitPrice}
                            onChange={(e) => {
                              const copy = [...initialItems];
                              copy[idx].unitPrice = Number(e.target.value);
                              setInitialItems(copy);
                            }}
                            className="w-full p-1 text-xs bg-white border border-slate-200 rounded-lg font-mono text-right"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => setInitialItems(initialItems.filter((_, i) => i !== idx))}
                          className="p-1 text-rose-500 hover:bg-rose-50 rounded-md cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Botões do Modal */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving||!canCreate}
                    className="px-5 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white text-xs font-extrabold rounded-xl shadow-md hover:from-violet-500 hover:to-purple-500 disabled:opacity-50 cursor-pointer"
                  >
                    {saving ? "Salvando OS..." : "Gerar Ordem de Serviço"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 2: Visualizar e Editar Ordem de Serviço (Adicionar/Remover Peças e Alterar Status) */}
        {selectedOrder && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white w-full max-w-3xl rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xl overflow-y-auto max-h-[calc(100dvh-1rem)] my-2 sm:my-8 animate-in fade-in zoom-in-95">
              {/* Header com Número da OS e Status */}
              <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-black text-purple-400 bg-purple-950 px-2.5 py-0.5 rounded-lg border border-purple-500/40">
                      {selectedOrder.orderNumber}
                    </span>
                    <span className="text-xs text-slate-300">
                      {selectedOrder.equipmentType}
                    </span>
                  </div>
                  <h3 className="text-lg font-black mt-1">
                    {selectedOrder.equipmentDetails || `${selectedOrder.brand} ${selectedOrder.model}`}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Corpo da OS com Edição de Peças e Serviços */}
              <div className="p-6 space-y-6">
                {/* Linha de Status Kanban Interativa */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2">
                  <label className="text-xs font-extrabold text-slate-700 block">
                    Etapa Atual no Processo da Oficina:
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                    {[
                      { s: 1, name: "Não Iniciado" },
                      { s: 8, name: "Em Bancada" },
                      { s: 7, name: "Aguardando Peça" },
                      { s: 4, name: "Aguardando Cliente" },
                      { s: 10, name: "Pronto / Testado" },
                      { s: 12, name: "Entregue" },
                    ].map((step) => (
                      <button
                        key={step.s}
                        type="button"
                        onClick={() => handleMoveStatus(selectedOrder.id, step.s)}
                        disabled={saving||!(step.s===12?canDeliver:step.s===10?canQuality:canExecute)}
                        className={`p-2 text-center rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                          selectedOrder.status === step.s
                            ? "bg-purple-600 text-white border-purple-600 shadow-sm"
                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        {step.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Dados da Máquina e Cliente */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1">
                    <span className="font-extrabold text-slate-500 uppercase text-[10px]">Cliente Solicitante</span>
                    <div className="font-bold text-slate-900 text-sm">{selectedOrder.customerName}</div>
                    <div className="text-slate-500">ID Cliente: {selectedOrder.customerId}</div>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1">
                    <span className="font-extrabold text-slate-500 uppercase text-[10px]">Identificação da Máquina</span>
                    <div className="font-bold text-slate-900 text-sm">{selectedOrder.serialNumber || "Sem Serial"}</div>
                    <div className="text-slate-500">Defeito: {selectedOrder.reportedDefect}</div>
                  </div>
                </div>

                {/* Gestão Dinâmica de Peças & Serviços (Adicionar/Remover Conforme Requisitado) */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight">
                        Peças, Produtos & Serviços Utilizados na OS
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Adicione ou remova itens conforme o técnico executa a manutenção na bancada.
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {setErrorMessage(null);setItemDraft({orderId:selectedOrder.id,itemType:1,description:"",quantity:"1",unitPrice:""});}}
                        disabled={saving||!canQuote||[10,11,12].includes(selectedOrder.status)}
                        className="text-xs font-bold text-purple-600 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-xl cursor-pointer"
                      >
                        + Adicionar Serviço
                      </button>
                      <button
                        type="button"
                        onClick={() => {setErrorMessage(null);setItemDraft({orderId:selectedOrder.id,itemType:2,description:"",quantity:"1",unitPrice:""});}}
                        disabled={saving||!canQuote||[10,11,12].includes(selectedOrder.status)}
                        className="text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-xl cursor-pointer"
                      >
                        + Adicionar Peça
                      </button>
                    </div>
                  </div>

                  {/* Tabela de Itens */}
                  <div className="border border-slate-200 rounded-2xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 font-extrabold text-slate-600">
                        <tr>
                          <th className="p-3">Tipo</th>
                          <th className="p-3">Descrição do Produto/Serviço</th>
                          <th className="p-3 text-center">Qtd</th>
                          <th className="p-3 text-right">Valor Unit.</th>
                          <th className="p-3 text-right">Subtotal</th>
                          <th className="p-3 text-center">Ação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedOrder.items && selectedOrder.items.map((it: any, i: number) => (
                          <tr key={i} className="hover:bg-slate-50/50">
                            <td className="p-3">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                it.itemType === 1 ? "bg-purple-50 text-purple-700" : "bg-indigo-50 text-indigo-700"
                              }`}>
                                {it.itemType === 1 ? "Mão de Obra" : "Peça"}
                              </span>
                            </td>
                            <td className="p-3 font-medium text-slate-800">{it.description}</td>
                            <td className="p-3 text-center font-mono">{it.quantity}</td>
                            <td className="p-3 text-right font-mono">R$ {Number(it.unitPrice).toFixed(2)}</td>
                            <td className="p-3 text-right font-mono font-bold text-slate-900">
                              R$ {(Number(it.quantity) * Number(it.unitPrice)).toFixed(2)}
                            </td>
                            <td className="p-3 text-center">
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = selectedOrder.items.filter((_: any, idx: number) => idx !== i);
                                  handleSaveOrderItems(selectedOrder.id, updated);
                                }}
                                className="p-1 text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer"
                                disabled={saving||!canQuote||[10,11,12].includes(selectedOrder.status)}
                                title="Remover este item da OS"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}

                        {(!selectedOrder.items || selectedOrder.items.length === 0) && (
                          <tr>
                            <td colSpan={6} className="p-4 text-center text-slate-400 italic">
                              Nenhuma peça ou serviço vinculado ainda.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Totalizador da OS */}
                  <div className="flex items-center justify-between p-4 bg-purple-50 rounded-2xl border border-purple-100">
                    <div>
                      <span className="text-xs font-bold text-purple-900">Valor Total da Manutenção:</span>
                      <p className="text-[10px] text-purple-700">Garantia legal de 90 dias conforme CDC.</p>
                    </div>
                    <div className="text-xl font-black font-mono text-purple-950">
                      R$ {selectedOrder.finalPrice.toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Botões do Rodapé */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setSelectedOrder(null)}
                    className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                  >
                    Fechar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedOrder(null);
                      loadOrders();
                    }}
                    className="px-5 py-2.5 bg-slate-900 text-white text-xs font-extrabold rounded-xl hover:bg-black cursor-pointer"
                  >
                    Fechar detalhes da OS
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        {deliveryRequest && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/70 p-3" role="dialog" aria-modal="true" aria-label="Confirmar entrega da OS">
            <form onSubmit={(e)=>{e.preventDefault();void handleMoveStatus(deliveryRequest,12,{recipient:deliveryRecipient,notes:deliveryNotes});}}
              className="w-full max-w-md space-y-4 rounded-2xl bg-white p-5 shadow-xl">
              <h3 className="text-base font-black text-slate-900">Confirmar entrega do equipamento</h3>
              <p className="text-xs text-slate-600">A entrega encerra o fluxo normal da OS. Informe quem recebeu o equipamento para manter a rastreabilidade.</p>
              {errorMessage && <div role="alert" className="rounded-lg bg-rose-50 p-3 text-xs font-bold text-rose-800">{errorMessage}</div>}
              <label className="block text-xs font-bold text-slate-700">Nome de quem retirou
                <input value={deliveryRecipient} onChange={(e)=>setDeliveryRecipient(e.target.value)}
                  required minLength={2} maxLength={180}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-sm" placeholder="Nome completo do responsável"/>
              </label>
              <label className="block text-xs font-bold text-slate-700">Observações de entrega
                <textarea value={deliveryNotes} onChange={(e)=>setDeliveryNotes(e.target.value)}
                  maxLength={1000} rows={3}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-sm"/>
              </label>
              <div className="flex justify-end gap-2">
                <button type="button" disabled={saving} onClick={()=>{setDeliveryRequest(null);setErrorMessage(null);}}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold">Cancelar</button>
                <button type="submit" disabled={saving} className="rounded-xl bg-purple-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">
                  {saving?"Registrando...":"Confirmar entrega"}
                </button>
              </div>
            </form>
          </div>
        )}
        {itemDraft && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/70 p-3" role="dialog" aria-modal="true" aria-label="Adicionar item à OS">
            <form onSubmit={async(e)=>{
              e.preventDefault();
              if(!selectedOrder||selectedOrder.id!==itemDraft.orderId)return;
              const quantity=Number(itemDraft.quantity),unitPrice=Number(itemDraft.unitPrice);
              if(!itemDraft.description.trim()||!Number.isFinite(quantity)||quantity<=0||!Number.isFinite(unitPrice)||unitPrice<0||Math.abs(Math.round(unitPrice*100)-unitPrice*100)>0.000001){
                setErrorMessage("Informe descrição, quantidade e preço válido em centavos.");return;
              }
              const ok=await handleSaveOrderItems(itemDraft.orderId,[...(selectedOrder.items||[]),{
                itemType:itemDraft.itemType,description:itemDraft.description.trim(),quantity,unitPrice
              }]);
              if(ok)setItemDraft(null);
            }} className="w-full max-w-md space-y-4 rounded-2xl bg-white p-5 shadow-xl">
              <h3 className="text-base font-black text-slate-900">Adicionar {itemDraft.itemType===1?"serviço":"peça"} à OS</h3>
              {errorMessage && <div role="alert" className="rounded-lg bg-rose-50 p-3 text-xs font-bold text-rose-800">{errorMessage}</div>}
              <label className="block text-xs font-bold text-slate-700">Descrição
                <input required maxLength={400} value={itemDraft.description} onChange={e=>setItemDraft({...itemDraft,description:e.target.value})}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-sm"/>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-bold text-slate-700">Quantidade
                  <input required type="number" min="0.001" step="0.001" max="10000" value={itemDraft.quantity}
                    onChange={e=>setItemDraft({...itemDraft,quantity:e.target.value})}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-sm"/>
                </label>
                <label className="block text-xs font-bold text-slate-700">Preço unitário (R$)
                  <input required type="number" min="0" step="0.01" max="100000000" value={itemDraft.unitPrice}
                    onChange={e=>setItemDraft({...itemDraft,unitPrice:e.target.value})}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-sm"/>
                </label>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" disabled={saving} onClick={()=>{setItemDraft(null);setErrorMessage(null);}}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold">Cancelar</button>
                <button type="submit" disabled={saving} className="rounded-xl bg-purple-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">
                  {saving?"Salvando...":"Adicionar à OS"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </RootShellLayout>
  );
}
