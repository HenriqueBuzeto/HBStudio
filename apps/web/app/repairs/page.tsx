"use client";

import React, { useState } from "react";
import {
  Wrench,
  Smartphone,
  ShieldCheck,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Search,
  Plus,
  Package,
  UserCheck,
  Cpu,
  CheckSquare,
  DollarSign,
  ChevronRight,
  Filter
} from "lucide-react";

interface RepairOrderView {
  id: string;
  orderNumber: string;
  status: number; // 1: IntakeRegistered, 2: DiagnosisInProgress, 3: EstimateReady, 4: ApprovedByCustomer, 5: InRepair, 6: QualityCheck, 7: ReadyForPickup, 8: Delivered, 9: Cancelled
  statusName: string;
  customerName: string;
  customerPhone: string;
  equipmentDescription: string;
  imeiOrSerial: string;
  faultDescription: string;
  deviceAccessMethod?: string; // Protocolo seguro: 'Desbloqueio presencial pelo cliente', 'Modo Manutenção / Diagnóstico sem senha'
  assignedTechnicianName?: string;
  intakeNotes?: string;
  rootCauseAnalysis?: string;
  totalEstimate: number;
  partsCost: number;
  laborCost: number;
  approvedAtUtc?: string;
  legalWarrantyDays: number;
  contractualWarrantyDays: number;
  openedAt: string;
  deliveredAt?: string;
  checklists: Array<{
    category: string;
    item: string;
    status: number; // 1: OK, 2: Damaged, 3: NotWorking, 4: NotTested
    notes?: string;
    isOutput: boolean;
  }>;
  parts: Array<{
    description: string;
    sku: string;
    serial?: string;
    quantity: number;
    unitPrice: number;
    inventoryTracked: boolean;
  }>;
}

const STATUS_CONFIG: Record<number, { label: string; color: string; badge: string }> = {
  1: { label: "Triagem Balcão", color: "border-sky-500/40 bg-sky-500/10 text-sky-400", badge: "bg-sky-500/20 text-sky-300" },
  2: { label: "Bancada Diagnóstico", color: "border-amber-500/40 bg-amber-500/10 text-amber-400", badge: "bg-amber-500/20 text-amber-300" },
  3: { label: "Aguardando Aprovação", color: "border-purple-500/40 bg-purple-500/10 text-purple-400", badge: "bg-purple-500/20 text-purple-300" },
  4: { label: "Orçamento Aprovado", color: "border-indigo-500/40 bg-indigo-500/10 text-indigo-400", badge: "bg-indigo-500/20 text-indigo-300" },
  5: { label: "Em Reparo / Laboratório", color: "border-blue-500/40 bg-blue-500/10 text-blue-400", badge: "bg-blue-500/20 text-blue-300" },
  6: { label: "Controle de Qualidade (QA)", color: "border-yellow-500/40 bg-yellow-500/10 text-yellow-400", badge: "bg-yellow-500/20 text-yellow-300" },
  7: { label: "Pronto para Retirada", color: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400", badge: "bg-emerald-500/20 text-emerald-300" },
  8: { label: "Entregue ao Cliente", color: "border-slate-500/40 bg-slate-500/10 text-slate-400", badge: "bg-slate-500/20 text-slate-300" },
  9: { label: "Cancelado / Devolvido", color: "border-rose-500/40 bg-rose-500/10 text-rose-400", badge: "bg-rose-500/20 text-rose-300" }
};

export default function RepairServicePage() {
  const [selectedOrder, setSelectedOrder] = useState<RepairOrderView | null>(null);
  const [activeTab, setActiveTab] = useState<"details" | "checklist" | "budget" | "parts" | "qa" | "warranty">("details");
  const [searchFilter, setSearchFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<number | "ALL">("ALL");

  const [orders, setOrders] = useState<RepairOrderView[]>([
    {
      id: "ord-001",
      orderNumber: "OS-2026-0841",
      status: 5,
      statusName: "Em Reparo / Laboratório",
      customerName: "Lucas Mendonça Silva",
      customerPhone: "(11) 98765-4321",
      equipmentDescription: "iPhone 15 Pro Max 256GB Titânio Natural",
      imeiOrSerial: "354928110293841",
      faultDescription: "Display quebrado após queda. Face ID funcional antes da queda. Conector USB-C oxidado.",
      deviceAccessMethod: "Desbloqueado presencialmente pelo cliente para testes de bancada",
      assignedTechnicianName: "Carlos Henrique (Técnico Nível 3)",
      intakeNotes: "Aparelho recebido com película de vidro trincada e marcas nas quinas. Cliente assinou termo de custódia.",
      rootCauseAnalysis: "Vidro cerâmico do display partido com perda parcial de sensibilidade no touch. Módulo original de display danificado.",
      totalEstimate: 1850.00,
      partsCost: 1450.00,
      laborCost: 400.00,
      approvedAtUtc: "2026-11-15T10:15:00Z",
      legalWarrantyDays: 90,
      contractualWarrantyDays: 90,
      openedAt: "2026-11-15T09:00:00Z",
      checklists: [
        { category: "Tela", item: "Touch Screen e Display", status: 3, notes: "Touch com zonas cegas no quadrante inferior", isOutput: false },
        { category: "Biometria", item: "Face ID / Câmera TrueDepth", status: 1, notes: "Operacional nos testes de bancada", isOutput: false },
        { category: "Áudio", item: "Alto-falantes estéreo e microfones", status: 1, notes: "Áudio limpo", isOutput: false },
        { category: "Conectividade", item: "Carga USB-C e wireless Qi", status: 2, notes: "Porta USB-C com leve oxidação superficial", isOutput: false }
      ],
      parts: [
        { description: "Módulo Frontal Original OLED iPhone 15 Pro Max", sku: "PEC-DISP-IP15PM", serial: "DISP-2026-X8", quantity: 1, unitPrice: 1450.00, inventoryTracked: true }
      ]
    },
    {
      id: "ord-002",
      orderNumber: "OS-2026-0842",
      status: 2,
      statusName: "Bancada Diagnóstico",
      customerName: "Beatriz Nogueira Duarte",
      customerPhone: "(11) 97112-9988",
      equipmentDescription: "MacBook Air M2 13'' Cinza-espacial",
      imeiOrSerial: "C02G901KQ16R",
      faultDescription: "Não liga após derramamento de café sobre o teclado. Luz indicadora MagSafe laranja piscando.",
      deviceAccessMethod: "Apple Diagnostics Mode (Sem necessidade de credencial pessoal)",
      assignedTechnicianName: "Mariana Alencar (Especialista Apple Silicon)",
      intakeNotes: "Aparelho desligado imediatamente. Sem tentativas de recarga pelo cliente.",
      totalEstimate: 0.00,
      partsCost: 0.00,
      laborCost: 0.00,
      legalWarrantyDays: 90,
      contractualWarrantyDays: 0,
      openedAt: "2026-11-15T11:20:00Z",
      checklists: [
        { category: "Carcaça", item: "Integridade de bordas e dobradiça", status: 1, isOutput: false },
        { category: "Teclado", item: "Teclas grudentas e resíduos de líquido", status: 2, notes: "Resíduo de café perceptível no lado direito", isOutput: false }
      ],
      parts: []
    },
    {
      id: "ord-003",
      orderNumber: "OS-2026-0840",
      status: 7,
      statusName: "Pronto para Retirada",
      customerName: "Rodrigo Sanches Prado",
      customerPhone: "(11) 94002-8922",
      equipmentDescription: "Samsung Galaxy S24 Ultra 512GB Titânio Preto",
      imeiOrSerial: "359128330918239",
      faultDescription: "Substituição preventiva de bateria original (degradação abaixo de 79%).",
      assignedTechnicianName: "Carlos Henrique (Técnico Nível 3)",
      intakeNotes: "Aparelho sem nenhum risco. Película aplicada preservada.",
      rootCauseAnalysis: "Saúde de bateria medida em 76% com 840 ciclos. Célula substituída por peça original homologada.",
      totalEstimate: 520.00,
      partsCost: 370.00,
      laborCost: 150.00,
      approvedAtUtc: "2026-11-14T14:00:00Z",
      legalWarrantyDays: 90,
      contractualWarrantyDays: 90,
      openedAt: "2026-11-14T11:00:00Z",
      checklists: [
        { category: "Bateria", item: "Capacidade e carregamento rápido 45W", status: 1, notes: "Bateria calibrada 100% OK", isOutput: true },
        { category: "Vedação", item: "Teste estanqueidade e IP68", status: 1, notes: "Gaxeta original aplicada e testada no barômetro", isOutput: true }
      ],
      parts: [
        { description: "Bateria Original Samsung S24 Ultra 5000mAh", sku: "PEC-BAT-S24U", serial: "BAT-SAM-09192", quantity: 1, unitPrice: 370.00, inventoryTracked: true }
      ]
    }
  ]);

  const filteredOrders = orders.filter(o => {
    const matchesSearch = 
      o.orderNumber.toLowerCase().includes(searchFilter.toLowerCase()) ||
      o.customerName.toLowerCase().includes(searchFilter.toLowerCase()) ||
      o.imeiOrSerial.toLowerCase().includes(searchFilter.toLowerCase()) ||
      o.equipmentDescription.toLowerCase().includes(searchFilter.toLowerCase());
    
    const matchesStatus = statusFilter === "ALL" || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const activeCount = orders.filter(o => o.status >= 1 && o.status <= 7).length;
  const inDiagnosisCount = orders.filter(o => o.status === 2).length;
  const awaitingApprovalCount = orders.filter(o => o.status === 3).length;
  const inLabCount = orders.filter(o => o.status === 5).length;
  const readyPickupCount = orders.filter(o => o.status === 7).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 space-y-6">
      {/* Header com Regras Legais e Operacionais */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-sky-500/10 border border-sky-500/20 rounded-xl text-sky-400">
              <Wrench className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                Assistência Técnica & Laboratório
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-medium">
                  MOD-07 Enterprise
                </span>
              </h1>
              <p className="text-sm text-slate-400 mt-0.5">
                Custódia de aparelhos de clientes, checklists, orçamentos (CDC Art. 40), baixa no estoque e garantias (CDC Art. 26).
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-400 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Custódia Técnica ≠ Estoque Mercantil</span>
          </div>
          <button 
            onClick={() => alert("Formulário de Abertura de OS em Balcão (Apenas Equipamento do Cliente)")}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium text-sm transition-colors shadow-lg shadow-sky-600/20"
          >
            <Plus className="w-4 h-4" />
            Nova Ordem de Serviço
          </button>
        </div>
      </div>

      {/* Métricas do Painel Operacional */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Ordens Ativas</span>
            <Smartphone className="w-4 h-4 text-sky-400" />
          </div>
          <p className="text-2xl font-bold text-white mt-2">{activeCount}</p>
          <span className="text-[11px] text-slate-500">Em laboratório ou balcão</span>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Em Diagnóstico</span>
            <Cpu className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-bold text-amber-400 mt-2">{inDiagnosisCount}</p>
          <span className="text-[11px] text-slate-500">Análise técnica preliminar</span>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Aguardando Cliente</span>
            <Clock className="w-4 h-4 text-purple-400" />
          </div>
          <p className="text-2xl font-bold text-purple-400 mt-2">{awaitingApprovalCount}</p>
          <span className="text-[11px] text-slate-500">Orçamento prévio CDC Art. 40</span>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Em Bancada</span>
            <Wrench className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-blue-400 mt-2">{inLabCount}</p>
          <span className="text-[11px] text-slate-500">Reparo e troca de peças</span>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Pronto p/ Retirada</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-emerald-400 mt-2">{readyPickupCount}</p>
          <span className="text-[11px] text-slate-500">QA aprovado e notificado</span>
        </div>
      </div>

      {/* Filtros e Busca */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/40 p-3 rounded-xl border border-slate-800">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Buscar por OS (ex: OS-2026-0841), cliente, IMEI ou modelo..."
            className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-500" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value === "ALL" ? "ALL" : Number(e.target.value))}
            className="bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-300 px-3 py-2 focus:outline-none focus:border-sky-500"
          >
            <option value="ALL">Todos os Status</option>
            <option value={1}>1. Triagem Balcão</option>
            <option value={2}>2. Bancada Diagnóstico</option>
            <option value={3}>3. Aguardando Aprovação</option>
            <option value={4}>4. Orçamento Aprovado</option>
            <option value={5}>5. Em Reparo / Laboratório</option>
            <option value={6}>6. QA Qualidade</option>
            <option value={7}>7. Pronto para Retirada</option>
            <option value={8}>8. Entregue</option>
          </select>
        </div>
      </div>

      {/* Grid com Tabela e Drawer Lateral de Detalhes */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Lista de Ordens de Serviço */}
        <div className={`space-y-3 ${selectedOrder ? "lg:col-span-6" : "lg:col-span-12"}`}>
          {filteredOrders.length === 0 ? (
            <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-8 text-center text-slate-500">
              Nenhuma ordem de serviço encontrada com os critérios informados.
            </div>
          ) : (
            filteredOrders.map((order) => {
              const statusCfg = STATUS_CONFIG[order.status] || STATUS_CONFIG[1];
              const isSelected = selectedOrder?.id === order.id;

              return (
                <div
                  key={order.id}
                  onClick={() => setSelectedOrder(order)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? "bg-slate-900 border-sky-500/80 shadow-lg shadow-sky-500/10"
                      : "bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900/90"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sky-400 text-sm">{order.orderNumber}</span>
                        <span className={`text-[11px] px-2 py-0.5 rounded font-medium ${statusCfg.badge}`}>
                          {statusCfg.label}
                        </span>
                      </div>
                      <h3 className="text-base font-semibold text-white mt-1">{order.equipmentDescription}</h3>
                      <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                        <span className="font-mono text-slate-300">IMEI: {order.imeiOrSerial}</span>
                        <span>•</span>
                        <span>Cliente: {order.customerName}</span>
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-xs text-slate-500">Valor Orçado</span>
                      <p className="text-sm font-mono font-semibold text-emerald-400">
                        {order.totalEstimate > 0
                          ? `R$ ${order.totalEstimate.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                          : "Aguardando Laudo"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <UserCheck className="w-3.5 h-3.5 text-slate-500" />
                        {order.assignedTechnicianName || "Sem técnico alocado"}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        Abertura: {new Date(order.openedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-sky-400 group">
                      <span>Ver Ficha Técnica</span>
                      <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Painel de Gestão Completa da OS Selecionada */}
        {selectedOrder && (
          <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5 sticky top-6">
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-lg font-bold text-sky-400">{selectedOrder.orderNumber}</span>
                  <span className={`text-xs px-2.5 py-0.5 rounded font-medium ${STATUS_CONFIG[selectedOrder.status].badge}`}>
                    {STATUS_CONFIG[selectedOrder.status].label}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Cliente: <strong className="text-slate-200">{selectedOrder.customerName}</strong> ({selectedOrder.customerPhone})
                </p>
              </div>

              <button
                onClick={() => setSelectedOrder(null)}
                className="text-xs text-slate-500 hover:text-slate-300 px-2 py-1 bg-slate-800/60 rounded"
              >
                Fechar
              </button>
            </div>

            {/* Abas da Ficha da OS */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
              <button
                onClick={() => setActiveTab("details")}
                className={`flex-1 py-1.5 px-2 rounded font-medium transition-colors ${
                  activeTab === "details" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Laudo & Ficha
              </button>
              <button
                onClick={() => setActiveTab("checklist")}
                className={`flex-1 py-1.5 px-2 rounded font-medium transition-colors ${
                  activeTab === "checklist" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Checklists ({selectedOrder.checklists.length})
              </button>
              <button
                onClick={() => setActiveTab("budget")}
                className={`flex-1 py-1.5 px-2 rounded font-medium transition-colors ${
                  activeTab === "budget" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Orçamento (CDC 40)
              </button>
              <button
                onClick={() => setActiveTab("parts")}
                className={`flex-1 py-1.5 px-2 rounded font-medium transition-colors ${
                  activeTab === "parts" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Peças ({selectedOrder.parts.length})
              </button>
              <button
                onClick={() => setActiveTab("warranty")}
                className={`flex-1 py-1.5 px-2 rounded font-medium transition-colors ${
                  activeTab === "warranty" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Garantia (CDC 26)
              </button>
            </div>

            {/* Conteúdo da Aba */}
            {activeTab === "details" && (
              <div className="space-y-4 text-xs">
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800/80 space-y-2">
                  <span className="font-semibold text-slate-300 block">Identificação do Equipamento em Custódia</span>
                  <div className="grid grid-cols-2 gap-2 text-slate-400">
                    <div>
                      <span>Modelo:</span>
                      <p className="text-slate-200 font-medium">{selectedOrder.equipmentDescription}</p>
                    </div>
                    <div>
                      <span>IMEI / Serial Técnico:</span>
                      <p className="text-slate-200 font-mono font-medium">{selectedOrder.imeiOrSerial}</p>
                    </div>
                    <div className="col-span-2">
                      <span>Método de Acesso para Testes:</span>
                      <p className="text-emerald-400 font-medium">{selectedOrder.deviceAccessMethod || "Acesso assistido / Modo Diagnóstico"}</p>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800/80 space-y-1">
                  <span className="font-semibold text-slate-300 block">Defeito Reclamado pelo Cliente:</span>
                  <p className="text-slate-300 leading-relaxed">{selectedOrder.faultDescription}</p>
                </div>

                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800/80 space-y-1">
                  <span className="font-semibold text-sky-400 block">Diagnóstico Técnico & Causa Raiz:</span>
                  <p className="text-slate-300 leading-relaxed">
                    {selectedOrder.rootCauseAnalysis || "Diagnóstico em andamento pelo laboratório."}
                  </p>
                </div>

                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800/80 flex items-center justify-between text-slate-400">
                  <span>Técnico Responsável:</span>
                  <span className="text-slate-200 font-medium">{selectedOrder.assignedTechnicianName || "Pendente"}</span>
                </div>
              </div>
            )}

            {activeTab === "checklist" && (
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-300">Checklist Contextual de Entrada e Saída</span>
                  <span className="text-[11px] text-slate-500">Conformidade e Prevenção de Litígios</span>
                </div>

                {selectedOrder.checklists.map((item, idx) => (
                  <div key={idx} className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase font-bold text-slate-500 px-1.5 py-0.2 bg-slate-900 rounded">
                          {item.category}
                        </span>
                        <span className="font-medium text-slate-200">{item.item}</span>
                        {item.isOutput && (
                          <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded font-semibold">
                            QA Saída
                          </span>
                        )}
                      </div>
                      {item.notes && <p className="text-slate-400 text-[11px]">{item.notes}</p>}
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold whitespace-nowrap ${
                        item.status === 1
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : item.status === 2
                          ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                          : item.status === 3
                          ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {item.status === 1 ? "Operacional OK" : item.status === 2 ? "Avariado / Risco" : item.status === 3 ? "Não Funciona" : "Não Testado"}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "budget" && (
              <div className="space-y-4 text-xs">
                <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-300 flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0 text-indigo-400" />
                  <p>
                    <strong>Conformidade CDC Art. 40:</strong> O orçamento prévio discrimina peças e mão de obra de forma expressa,
                    com validade de 10 dias corridos e proibição de cobrança sem prévia aprovação do cliente.
                  </p>
                </div>

                <div className="bg-slate-950 rounded-lg border border-slate-800 p-3 space-y-2">
                  <div className="flex justify-between text-slate-400">
                    <span>Custo Estimado de Peças:</span>
                    <span className="text-slate-200 font-mono">
                      R$ {selectedOrder.partsCost.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Mão de Obra Técnica Especializada:</span>
                    <span className="text-slate-200 font-mono">
                      R$ {selectedOrder.laborCost.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-slate-800 flex justify-between font-semibold text-sm">
                    <span className="text-white">Total do Orçamento:</span>
                    <span className="text-emerald-400 font-mono text-base">
                      R$ {selectedOrder.totalEstimate.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between">
                  <span className="text-slate-400">Status de Aprovação:</span>
                  {selectedOrder.approvedAtUtc ? (
                    <span className="text-emerald-400 flex items-center gap-1 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Aprovado em {new Date(selectedOrder.approvedAtUtc).toLocaleDateString("pt-BR")}
                    </span>
                  ) : (
                    <span className="text-amber-400 flex items-center gap-1 font-medium">
                      <Clock className="w-3.5 h-3.5" />
                      Aguardando Confirmação do Cliente
                    </span>
                  )}
                </div>
              </div>
            )}

            {activeTab === "parts" && (
              <div className="space-y-3 text-xs">
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800/80 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-slate-300 block">Peças Vinculadas com Baixa no Kardex</span>
                    <p className="text-[11px] text-slate-500">
                      O consumo é registrado no serviço oficial de estoque do MOD-03 como saída por assistência técnica.
                    </p>
                  </div>
                  <Package className="w-5 h-5 text-sky-400" />
                </div>

                {selectedOrder.parts.length === 0 ? (
                  <p className="text-slate-500 text-center py-4">Nenhuma peça consumida até o momento.</p>
                ) : (
                  selectedOrder.parts.map((p, idx) => (
                    <div key={idx} className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1">
                      <div className="flex justify-between">
                        <span className="font-medium text-slate-200">{p.description}</span>
                        <span className="font-mono text-emerald-400 font-semibold">
                          R$ {p.unitPrice.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-slate-400">
                        <span className="font-mono">SKU: {p.sku}</span>
                        {p.serial && <span>Serial: {p.serial}</span>}
                        <span>Qtd: {p.quantity}</span>
                        <span className="text-sky-400 font-medium">✓ Kardex Baixado</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === "warranty" && (
              <div className="space-y-4 text-xs">
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Termo de Garantia e CDC Art. 26</span>
                  </div>
                  <p className="text-slate-400 leading-relaxed">
                    Aparelhos reparados possuem prazo decadencial de garantia legal de <strong>90 dias</strong> para vícios aparentes em produtos duráveis (CDC Art. 26, II).
                    <span className="block mt-1 text-slate-500">
                      <em>Nota Jurídica CDC:</em> A fluência de 90 dias não extingue direitos em casos de vícios ocultos (§ 3º) nem substitui a análise técnica individualizada de reclamações.
                    </span>
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-center">
                    <span className="text-slate-500 block text-[11px]">Garantia Legal Obrigatória</span>
                    <p className="text-xl font-bold font-mono text-emerald-400 mt-1">{selectedOrder.legalWarrantyDays} dias</p>
                    <span className="text-[10px] text-slate-500">CDC Art. 26</span>
                  </div>
                  <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-center">
                    <span className="text-slate-500 block text-[11px]">Garantia Contratual HB</span>
                    <p className="text-xl font-bold font-mono text-sky-400 mt-1">
                      {selectedOrder.contractualWarrantyDays > 0 ? `${selectedOrder.contractualWarrantyDays} dias` : "Padrão"}
                    </p>
                    <span className="text-[10px] text-slate-500">Complementar</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between">
                  <span className="text-slate-400">Emissão de Termo de Retirada:</span>
                  <button 
                    onClick={() => alert("Gerando comprovante de custódia e certificado de garantia...")}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5 text-sky-400" />
                    Imprimir Termo
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
