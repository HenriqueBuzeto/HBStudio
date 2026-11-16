"use client";

import React, { useState } from "react";
import RootShellLayout from "@/components/RootShellLayout";
import {
  Users,
  Target,
  Flame,
  Search,
  Plus,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Calendar,
  MessageSquare,
  BookmarkCheck,
  Smartphone,
  BatteryCharging,
  DollarSign,
  TrendingUp,
  Tag,
  Kanban,
  Check,
  AlertCircle,
  Filter
} from "lucide-react";

interface LeadView {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  channel: string;
  sourceCampaign?: string;
  convertedPartyId?: string;
  lgpdMarketingOptIn: boolean;
  notes?: string;
  createdAt: string;
}

interface PipelineStageView {
  id: string;
  name: string;
  orderIndex: number;
  isWonStage: boolean;
  isLostStage: boolean;
}

interface OpportunityActivityView {
  id: string;
  type: string;
  summary: string;
  notes?: string;
  scheduledAtUtc: string;
  isCompleted: boolean;
}

interface OpportunityView {
  id: string;
  title: string;
  leadId?: string;
  leadName?: string;
  partyId?: string;
  partyName?: string;
  stageId: string;
  stageName: string;
  estimatedValue: number;
  confidenceScore: number;
  expectedClosingDate?: string;
  assignedUserName?: string;
  wonAtUtc?: string;
  lostAtUtc?: string;
  activities: OpportunityActivityView[];
}

interface PurchaseIntentView {
  id: string;
  leadId?: string;
  leadName?: string;
  partyId?: string;
  partyName?: string;
  desiredProductModelId?: string;
  desiredModelName: string;
  desiredColor?: string;
  desiredStorage?: string;
  minBatteryHealthPercentage?: number;
  maxBudget: number;
  status: string;
  notes?: string;
  createdAt: string;
}

interface InventoryMatchView {
  inventoryUnitId: string;
  skuCode: string;
  modelName: string;
  serialNumberOrImei: string;
  condition: string;
  cosmeticGrade: string;
  batteryHealthPercentage?: number;
  retailPrice: number;
  isApprovedForSale: boolean;
  isReserved: boolean;
  matchScore: number;
}

const mockStages: PipelineStageView[] = [
  { id: "stage-1", name: "Prospecção / Lead", orderIndex: 1, isWonStage: false, isLostStage: false },
  { id: "stage-2", name: "Qualificação & Desejo", orderIndex: 2, isWonStage: false, isLostStage: false },
  { id: "stage-3", name: "Proposta / Matching", orderIndex: 3, isWonStage: false, isLostStage: false },
  { id: "stage-4", name: "Negociação", orderIndex: 4, isWonStage: false, isLostStage: false },
  { id: "stage-5", name: "Ganho (Fechado)", orderIndex: 5, isWonStage: true, isLostStage: false }
];

const mockLeads: LeadView[] = [
  {
    id: "lead-1",
    name: "Rodrigo Silveira",
    phone: "(11) 98765-4321",
    email: "rodrigo.silveira@email.com",
    channel: "WhatsApp",
    sourceCampaign: "Campanha iPhone 15 Pro Seminovos",
    lgpdMarketingOptIn: true,
    notes: "Procura iPhone 15 Pro Azul ou Titânio Natural com bateria acima de 88%.",
    createdAt: "2026-11-15 14:30"
  },
  {
    id: "lead-2",
    name: "Camila Guimarães",
    phone: "(11) 97123-9988",
    email: "camila.g@designstudio.com",
    channel: "Instagram Direct",
    sourceCampaign: "Stories Upgrade HB Studio",
    lgpdMarketingOptIn: true,
    notes: "Interesse em MacBook Air M2 ou iPad Pro para edição gráfica.",
    createdAt: "2026-11-15 16:15"
  },
  {
    id: "lead-3",
    name: "Bruno Albuquerque",
    phone: "(11) 98844-3322",
    channel: "Balcão / Presencial",
    convertedPartyId: "party-bruno-88",
    lgpdMarketingOptIn: false,
    notes: "Veio presencialmente na filial Moema avaliar um iPhone 13 128GB.",
    createdAt: "2026-11-15 17:40"
  }
];

const mockOpportunities: OpportunityView[] = [
  {
    id: "opp-1",
    title: "iPhone 15 Pro 256GB - Rodrigo Silveira",
    leadId: "lead-1",
    leadName: "Rodrigo Silveira",
    stageId: "stage-3",
    stageName: "Proposta / Matching",
    estimatedValue: 5690.00,
    confidenceScore: 85,
    expectedClosingDate: "2026-11-18",
    assignedUserName: "Carlos Vendedor",
    activities: [
      {
        id: "act-1",
        type: "WhatsApp",
        summary: "Enviado vídeo da saúde da bateria e laudo estético do aparelho",
        scheduledAtUtc: "2026-11-15 15:00",
        isCompleted: true
      },
      {
        id: "act-2",
        type: "FollowUp",
        summary: "Aguardando confirmação do pagamento com entrada via Pix",
        scheduledAtUtc: "2026-11-16 11:00",
        isCompleted: false
      }
    ]
  },
  {
    id: "opp-2",
    title: "MacBook Air M2 16GB - Camila Guimarães",
    leadId: "lead-2",
    leadName: "Camila Guimarães",
    stageId: "stage-2",
    stageName: "Qualificação & Desejo",
    estimatedValue: 7990.00,
    confidenceScore: 60,
    expectedClosingDate: "2026-11-20",
    assignedUserName: "Mariana Comercial",
    activities: [
      {
        id: "act-3",
        type: "Ligação",
        summary: "Validar se aceita modelo Prata ou se exige Cinza Espacial",
        scheduledAtUtc: "2026-11-16 14:00",
        isCompleted: false
      }
    ]
  },
  {
    id: "opp-3",
    title: "iPhone 13 128GB Estelar - Bruno Albuquerque",
    partyId: "party-bruno-88",
    partyName: "Bruno Albuquerque",
    stageId: "stage-4",
    stageName: "Negociação",
    estimatedValue: 3100.00,
    confidenceScore: 90,
    expectedClosingDate: "2026-11-16",
    assignedUserName: "Carlos Vendedor",
    activities: [
      {
        id: "act-4",
        type: "Presencial",
        summary: "Cliente retorna para passar cartão presencialmente na loja",
        scheduledAtUtc: "2026-11-16 16:30",
        isCompleted: false
      }
    ]
  }
];

const mockPurchaseIntents: PurchaseIntentView[] = [
  {
    id: "intent-1",
    leadId: "lead-1",
    leadName: "Rodrigo Silveira",
    desiredModelName: "iPhone 15 Pro",
    desiredColor: "Titânio Natural",
    desiredStorage: "256GB",
    minBatteryHealthPercentage: 88,
    maxBudget: 5800.00,
    status: "Active",
    notes: "Exige estado impecável (Grade A/A+) com caixa original.",
    createdAt: "2026-11-15 14:45"
  },
  {
    id: "intent-2",
    leadId: "lead-2",
    leadName: "Camila Guimarães",
    desiredModelName: "MacBook Air M2",
    desiredColor: "Space Gray",
    desiredStorage: "512GB",
    minBatteryHealthPercentage: 90,
    maxBudget: 8500.00,
    status: "Active",
    notes: "Aguardando entrada de estoque semi-novo com garantia.",
    createdAt: "2026-11-15 16:30"
  }
];

const mockMatches: InventoryMatchView[] = [
  {
    inventoryUnitId: "unit-iphone-15pro-sn01",
    skuCode: "IPH15P-256-NAT",
    modelName: "iPhone 15 Pro 256GB Titânio Natural",
    serialNumberOrImei: "359871234567890",
    condition: "UsedPreOwned",
    cosmeticGrade: "GradeA",
    batteryHealthPercentage: 92,
    retailPrice: 5690.00,
    isApprovedForSale: true,
    isReserved: false,
    matchScore: 96
  },
  {
    inventoryUnitId: "unit-iphone-15pro-sn02",
    skuCode: "IPH15P-256-BLU",
    modelName: "iPhone 15 Pro 256GB Titânio Azul",
    serialNumberOrImei: "359871234567891",
    condition: "UsedPreOwned",
    cosmeticGrade: "GradeB",
    batteryHealthPercentage: 89,
    retailPrice: 5390.00,
    isApprovedForSale: true,
    isReserved: false,
    matchScore: 84
  }
];

export default function CrmPage() {
  const [activeTab, setActiveTab] = useState<"kanban" | "intents" | "matching" | "leads">("kanban");
  const [selectedIntent, setSelectedIntent] = useState<PurchaseIntentView>(mockPurchaseIntents[0]);
  const [reservedUnits, setReservedUnits] = useState<Record<string, boolean>>({});
  const [reservationMessage, setReservationMessage] = useState<string | null>(null);

  const handleReserveMatch = (match: InventoryMatchView) => {
    setReservedUnits(prev => ({ ...prev, [match.inventoryUnitId]: true }));
    setReservationMessage(`Unidade ${match.serialNumberOrImei} (${match.modelName}) reservada com sucesso no InventoryService por 48 horas.`);
    setTimeout(() => setReservationMessage(null), 6000);
  };

  const totalEstimatedPipeline = mockOpportunities.reduce((acc, curr) => acc + curr.estimatedValue, 0);

  return (
    <RootShellLayout>
      <div className="space-y-6">
        {/* Top Header HBVisionX Style */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-600 bg-purple-50 px-2.5 py-1 rounded-full border border-purple-200">
                Módulo 08 • CRM & Inteligência Comercial
              </span>
            </div>
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900 mt-1">
              Funil de Vendas & Intenções de Compra
            </h1>
            <p className="text-xs text-slate-500">
              Matching algorítmico automatizado com aparelhos serializados reais (IMEI) e follow-ups comerciais.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 transition-colors shadow-xs">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              Filtrar Funil
            </button>
            <button className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-violet-600 to-purple-700 hover:from-violet-700 hover:to-purple-800 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-purple-600/20">
              <Plus className="w-3.5 h-3.5" />
              Nova Oportunidade
            </button>
          </div>
        </div>

        {/* Indicadores Topo estilo HBVisionX */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-purple-600" />
              Métricas Comerciais em Tempo Real
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-purple-600"></div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Pipeline Ativo Estimado
              </span>
              <div className="text-lg font-extrabold text-slate-900">
                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totalEstimatedPipeline)}
              </div>
              <p className="text-[10px] text-purple-600 font-semibold mt-1 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                {mockOpportunities.length} negociações abertas
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500"></div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Fila de Espera (Intenções)
              </span>
              <div className="text-lg font-extrabold text-blue-600">{mockPurchaseIntents.length} Clientes</div>
              <p className="text-[10px] text-slate-500 mt-1">Aguardando especificações exatas</p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500"></div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Matches no Estoque Real
              </span>
              <div className="text-lg font-extrabold text-amber-600">{mockMatches.length} Aparelhos</div>
              <p className="text-[10px] text-emerald-600 font-semibold mt-1">Aprovados para venda imediata</p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500"></div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Leads Qualificados LGPD
              </span>
              <div className="text-lg font-extrabold text-slate-900">{mockLeads.length}</div>
              <p className="text-[10px] text-emerald-600 font-semibold mt-1">Consentimento de contato ativo</p>
            </div>
          </div>
        </div>

        {/* Reserva Alert */}
        {reservationMessage && (
          <div className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-800 flex items-center gap-3 shadow-xs">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <p className="text-xs font-bold">{reservationMessage}</p>
          </div>
        )}

        {/* Abas Estilo HBVisionX */}
        <div className="flex border-b border-slate-200 space-x-2 bg-white px-4 pt-3 rounded-t-2xl shadow-xs">
          <button
            onClick={() => setActiveTab("kanban")}
            className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${
              activeTab === "kanban"
                ? "border-purple-600 text-purple-700"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <Kanban className="w-3.5 h-3.5" />
            Funil Comercial (Kanban)
          </button>
          <button
            onClick={() => setActiveTab("intents")}
            className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${
              activeTab === "intents"
                ? "border-purple-600 text-purple-700"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <Target className="w-3.5 h-3.5" />
            Intenções de Compra & Fila de Espera
          </button>
          <button
            onClick={() => setActiveTab("matching")}
            className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${
              activeTab === "matching"
                ? "border-purple-600 text-purple-700"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            Matching com Estoque Real
          </button>
          <button
            onClick={() => setActiveTab("leads")}
            className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${
              activeTab === "leads"
                ? "border-purple-600 text-purple-700"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Leads & Contatos
          </button>
        </div>

        {/* Tab 1: Funil Kanban */}
        {activeTab === "kanban" && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3.5">
            {mockStages.map(stage => {
              const stageOpps = mockOpportunities.filter(o => o.stageId === stage.id);
              const stageTotal = stageOpps.reduce((acc, curr) => acc + curr.estimatedValue, 0);

              return (
                <div key={stage.id} className="flex flex-col bg-slate-100/70 rounded-2xl p-3 border border-slate-200/80 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                    <h3 className="font-bold text-[11px] uppercase tracking-wider text-slate-700">
                      {stage.name}
                    </h3>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white font-bold text-slate-700 border border-slate-200">
                      {stageOpps.length}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-semibold">
                    Total: {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(stageTotal)}
                  </div>

                  <div className="space-y-2.5 min-h-[300px]">
                    {stageOpps.map(opp => (
                      <div
                        key={opp.id}
                        className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs space-y-2.5 hover:border-purple-500/50 hover:shadow-sm transition-all cursor-pointer"
                      >
                        <h4 className="text-xs font-bold text-slate-900 leading-tight">{opp.title}</h4>

                        <div className="space-y-1">
                          <div className="text-[11px] text-slate-500 flex items-center gap-1">
                            <Users className="w-3 h-3 text-slate-400" />
                            <span>{opp.leadName || opp.partyName}</span>
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            <span>Previsão: {opp.expectedClosingDate || "A definir"}</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                          <span className="font-extrabold text-slate-900">
                            {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(opp.estimatedValue)}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-50 text-purple-700 font-bold border border-purple-200">
                            {opp.confidenceScore}% prob.
                          </span>
                        </div>

                        {opp.activities && opp.activities.length > 0 && (
                          <div className="pt-1 text-[10px] text-slate-500 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-amber-500" />
                            <span className="truncate">{opp.activities[0].summary}</span>
                          </div>
                        )}
                      </div>
                    ))}
                    {stageOpps.length === 0 && (
                      <div className="h-28 flex items-center justify-center text-[11px] text-slate-400 border border-dashed border-slate-300 rounded-xl">
                        Nenhuma negociação
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Tab 2: Intenções de Compra */}
        {activeTab === "intents" && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                <Target className="w-4 h-4 text-purple-600" />
                Intenções de Compra Registradas & Fila de Espera
              </h3>
              <button className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-violet-600 to-purple-700 text-white rounded-xl text-xs font-bold shadow-xs">
                <Plus className="w-3.5 h-3.5" />
                Cadastrar Intenção
              </button>
            </div>

            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-bold text-[10px]">
                <tr>
                  <th className="py-3 px-4">Cliente / Lead</th>
                  <th className="py-3 px-4">Modelo Desejado</th>
                  <th className="py-3 px-4">Especificações</th>
                  <th className="py-3 px-4">Saúde Bateria</th>
                  <th className="py-3 px-4">Teto Orçamento</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {mockPurchaseIntents.map(intent => (
                  <tr key={intent.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-800">{intent.leadName || intent.partyName}</td>
                    <td className="py-3 px-4 font-bold text-purple-700">{intent.desiredModelName}</td>
                    <td className="py-3 px-4 text-slate-500">
                      {intent.desiredStorage || "Qualquer capacidade"} • {intent.desiredColor || "Qualquer cor"}
                    </td>
                    <td className="py-3 px-4">
                      {intent.minBatteryHealthPercentage ? (
                        <span className="inline-flex items-center gap-1 font-bold text-emerald-600">
                          <BatteryCharging className="w-3.5 h-3.5" />
                          &ge; {intent.minBatteryHealthPercentage}%
                        </span>
                      ) : (
                        <span className="text-slate-400">Sem restrição</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-extrabold text-slate-900">
                      {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(intent.maxBudget)}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {intent.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => {
                          setSelectedIntent(intent);
                          setActiveTab("matching");
                        }}
                        className="px-2.5 py-1 text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors inline-flex items-center gap-1"
                      >
                        <Sparkles className="w-3 h-3 text-amber-500" />
                        Ver Matches
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 3: Matching com Estoque Real */}
        {activeTab === "matching" && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-50 via-violet-50 to-indigo-50 border border-purple-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-purple-600 text-white">
                    Intenção Ativa
                  </span>
                  <span className="text-sm font-bold text-slate-900">
                    {selectedIntent.desiredModelName} ({selectedIntent.desiredStorage || "Qualquer"} • {selectedIntent.desiredColor || "Qualquer"})
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  Cliente: <strong className="text-slate-900">{selectedIntent.leadName || selectedIntent.partyName}</strong> •
                  Bateria Mínima: <strong className="text-slate-900">{selectedIntent.minBatteryHealthPercentage}%</strong> •
                  Teto Orçamento: <strong className="text-slate-900">{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(selectedIntent.maxBudget)}</strong>
                </p>
              </div>

              <button
                onClick={() => setActiveTab("intents")}
                className="text-xs px-3 py-1.5 border border-purple-200 rounded-xl bg-white hover:bg-purple-50 text-purple-700 font-bold transition-colors shadow-xs"
              >
                Trocar Intenção
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {mockMatches.map(match => {
                const isReservedByUi = reservedUnits[match.inventoryUnitId];
                return (
                  <div
                    key={match.inventoryUnitId}
                    className="p-5 border border-slate-200 rounded-2xl bg-white shadow-xs space-y-4 hover:border-purple-400 transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-slate-500">
                            {match.skuCode}
                          </span>
                          <span className="px-2 py-0.5 text-[10px] rounded-full font-extrabold bg-amber-50 text-amber-700 border border-amber-200">
                            Match Score: {match.matchScore}%
                          </span>
                        </div>
                        <h4 className="text-sm font-extrabold text-slate-900 mt-1">{match.modelName}</h4>
                        <p className="text-xs font-mono text-slate-500 mt-0.5">
                          IMEI / Serial: <strong className="text-slate-900">{match.serialNumberOrImei}</strong>
                        </p>
                      </div>

                      <div className="text-right">
                        <div className="text-base font-extrabold text-slate-900">
                          {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(match.retailPrice)}
                        </div>
                        <span className="text-[10px] text-emerald-600 font-bold">Dentro do Orçamento</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 py-2.5 px-3 bg-slate-50 rounded-xl text-xs border border-slate-100">
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Saúde Bateria</span>
                        <span className="font-extrabold flex items-center gap-1 text-emerald-600">
                          <BatteryCharging className="w-3.5 h-3.5" />
                          {match.batteryHealthPercentage}%
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Grau Estético</span>
                        <span className="font-bold text-slate-800">{match.cosmeticGrade}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Condição</span>
                        <span className="font-bold text-slate-800">{match.condition}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span className="text-xs text-slate-500 font-medium">
                          {isReservedByUi ? "Reservado Oficialmente" : "Disponível para Reserva"}
                        </span>
                      </div>

                      {isReservedByUi ? (
                        <button
                          disabled
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-bold cursor-not-allowed"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Reserva Ativa (48h)
                        </button>
                      ) : (
                        <button
                          onClick={() => handleReserveMatch(match)}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-violet-600 to-purple-700 hover:from-violet-700 hover:to-purple-800 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-purple-600/20"
                        >
                          <BookmarkCheck className="w-3.5 h-3.5" />
                          Reservar no Estoque
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 4: Leads */}
        {activeTab === "leads" && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-600" />
                Base de Leads & Qualificação de Contatos
              </h3>
              <button className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-violet-600 to-purple-700 text-white rounded-xl text-xs font-bold shadow-xs">
                <Plus className="w-3.5 h-3.5" />
                Novo Lead
              </button>
            </div>

            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-bold text-[10px]">
                <tr>
                  <th className="py-3 px-4">Nome</th>
                  <th className="py-3 px-4">Contato</th>
                  <th className="py-3 px-4">Canal / Origem</th>
                  <th className="py-3 px-4">Campanha</th>
                  <th className="py-3 px-4">LGPD Marketing</th>
                  <th className="py-3 px-4">Status Party</th>
                  <th className="py-3 px-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {mockLeads.map(lead => (
                  <tr key={lead.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-800">{lead.name}</td>
                    <td className="py-3 px-4 text-slate-500">
                      <div>{lead.phone}</div>
                      {lead.email && <div className="text-[10px] text-slate-400">{lead.email}</div>}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-slate-100 font-bold text-slate-700">{lead.channel}</span>
                    </td>
                    <td className="py-3 px-4 text-slate-500">{lead.sourceCampaign || "Orgânico / Direto"}</td>
                    <td className="py-3 px-4">
                      {lead.lgpdMarketingOptIn ? (
                        <span className="inline-flex items-center gap-1 font-bold text-emerald-600">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Autorizado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-bold text-amber-600">
                          <AlertCircle className="w-3.5 h-3.5" />
                          Opt-Out
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {lead.convertedPartyId ? (
                        <span className="px-2 py-0.5 rounded-full font-bold bg-purple-50 text-purple-700 border border-purple-200">
                          Cliente Vinculado
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full font-bold bg-slate-100 text-slate-600">
                          Lead Prospect
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {!lead.convertedPartyId && (
                        <button className="px-2.5 py-1 text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors">
                          Converter em Cliente
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </RootShellLayout>
  );
}
