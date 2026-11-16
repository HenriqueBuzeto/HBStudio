"use client";

import React, { useState } from "react";
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
  AlertCircle
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
  status: string; // Active, Fulfilled, Expired, Cancelled
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
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/10 text-blue-600 dark:text-blue-400 rounded-xl">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">CRM & Inteligência Comercial</h1>
              <p className="text-sm text-muted-foreground">
                Funil de vendas, intenções de compra, matching automatizado com estoque serializado real e follow-ups.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-3.5 py-2 border rounded-lg text-sm font-medium hover:bg-muted/50 transition-colors">
            <Search className="w-4 h-4" />
            Pesquisar
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm transition-colors">
            <Plus className="w-4 h-4" />
            Nova Oportunidade
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 border rounded-xl bg-card shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Pipeline em Aberto</span>
            <DollarSign className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold">
            {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totalEstimatedPipeline)}
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
            {mockOpportunities.length} oportunidades ativas
          </p>
        </div>

        <div className="p-5 border rounded-xl bg-card shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Intenções / Fila de Espera</span>
            <Target className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold">{mockPurchaseIntents.length}</div>
          <p className="text-xs text-muted-foreground">Clientes aguardando especificações exatas</p>
        </div>

        <div className="p-5 border rounded-xl bg-card shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Matches com Estoque Real</span>
            <Sparkles className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold">{mockMatches.length}</div>
          <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
            Aparelhos aprovados prontos para reserva
          </p>
        </div>

        <div className="p-5 border rounded-xl bg-card shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Leads Qualificados</span>
            <Flame className="w-4 h-4 text-orange-500" />
          </div>
          <div className="text-2xl font-bold">{mockLeads.length}</div>
          <p className="text-xs text-muted-foreground">Com consentimento LGPD de contato</p>
        </div>
      </div>

      {/* Reservation Notification */}
      {reservationMessage && (
        <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">{reservationMessage}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b space-x-6">
        <button
          onClick={() => setActiveTab("kanban")}
          className={`pb-3 text-sm font-medium transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === "kanban"
              ? "border-blue-600 text-blue-600 dark:text-blue-400"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Kanban className="w-4 h-4" />
          Funil Comercial (Kanban)
        </button>
        <button
          onClick={() => setActiveTab("intents")}
          className={`pb-3 text-sm font-medium transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === "intents"
              ? "border-blue-600 text-blue-600 dark:text-blue-400"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Target className="w-4 h-4" />
          Intenções de Compra & Fila de Espera
        </button>
        <button
          onClick={() => setActiveTab("matching")}
          className={`pb-3 text-sm font-medium transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === "matching"
              ? "border-blue-600 text-blue-600 dark:text-blue-400"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Sparkles className="w-4 h-4" />
          Matching com Estoque Real
        </button>
        <button
          onClick={() => setActiveTab("leads")}
          className={`pb-3 text-sm font-medium transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === "leads"
              ? "border-blue-600 text-blue-600 dark:text-blue-400"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Users className="w-4 h-4" />
          Leads & Contatos
        </button>
      </div>

      {/* Tab: Funil Kanban */}
      {activeTab === "kanban" && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {mockStages.map(stage => {
            const stageOpps = mockOpportunities.filter(o => o.stageId === stage.id);
            const stageTotal = stageOpps.reduce((acc, curr) => acc + curr.estimatedValue, 0);

            return (
              <div key={stage.id} className="flex flex-col bg-muted/40 rounded-xl p-3 border space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                    {stage.name}
                  </h3>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-muted font-bold text-muted-foreground">
                    {stageOpps.length}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground font-medium border-b pb-2">
                  Total: {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(stageTotal)}
                </div>

                <div className="space-y-3 min-h-[300px]">
                  {stageOpps.map(opp => (
                    <div
                      key={opp.id}
                      className="p-3.5 bg-card rounded-lg border shadow-sm space-y-3 hover:border-blue-500/50 transition-all cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-sm font-semibold leading-tight line-clamp-2">{opp.title}</h4>
                      </div>

                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <Users className="w-3.5 h-3.5 text-muted-foreground" />
                          <span>{opp.leadName || opp.partyName}</span>
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                          <span>Previsão: {opp.expectedClosingDate || "A definir"}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t text-xs">
                        <span className="font-bold text-foreground">
                          {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(opp.estimatedValue)}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium">
                          {opp.confidenceScore}% prob.
                        </span>
                      </div>

                      {opp.activities && opp.activities.length > 0 && (
                        <div className="pt-1 text-[11px] text-muted-foreground flex items-center gap-1.5">
                          <Clock className="w-3 h-3 text-amber-500" />
                          <span className="truncate">{opp.activities[0].summary}</span>
                        </div>
                      )}
                    </div>
                  ))}
                  {stageOpps.length === 0 && (
                    <div className="h-32 flex items-center justify-center text-xs text-muted-foreground border border-dashed rounded-lg">
                      Nenhuma oportunidade
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tab: Intenções de Compra */}
      {activeTab === "intents" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Intenções Registradas & Fila de Espera</h2>
            <button className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors">
              <Plus className="w-3.5 h-3.5" />
              Cadastrar Intenção
            </button>
          </div>

          <div className="border rounded-xl bg-card overflow-hidden shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 border-b text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-3 px-4 font-semibold">Cliente / Lead</th>
                  <th className="py-3 px-4 font-semibold">Modelo Desejado</th>
                  <th className="py-3 px-4 font-semibold">Especificações</th>
                  <th className="py-3 px-4 font-semibold">Saúde Bateria</th>
                  <th className="py-3 px-4 font-semibold">Teto Orçamento</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y text-xs">
                {mockPurchaseIntents.map(intent => (
                  <tr key={intent.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 font-medium">{intent.leadName || intent.partyName}</td>
                    <td className="py-3 px-4 font-semibold text-blue-600 dark:text-blue-400">
                      {intent.desiredModelName}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      {intent.desiredStorage || "Qualquer capacidade"} • {intent.desiredColor || "Qualquer cor"}
                    </td>
                    <td className="py-3 px-4">
                      {intent.minBatteryHealthPercentage ? (
                        <span className="inline-flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                          <BatteryCharging className="w-3.5 h-3.5" />
                          &ge; {intent.minBatteryHealthPercentage}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Sem restrição</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-medium">
                      {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(intent.maxBudget)}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        {intent.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => {
                          setSelectedIntent(intent);
                          setActiveTab("matching");
                        }}
                        className="px-2.5 py-1 text-xs border rounded-lg hover:bg-muted font-medium transition-colors flex items-center gap-1 ml-auto"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        Ver Matches
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Matching com Estoque Real */}
      {activeTab === "matching" && (
        <div className="space-y-6">
          <div className="p-4 border rounded-xl bg-blue-500/5 border-blue-500/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase px-2 py-0.5 rounded bg-blue-600 text-white">
                  Intenção Selecionada
                </span>
                <span className="text-sm font-bold text-foreground">
                  {selectedIntent.desiredModelName} ({selectedIntent.desiredStorage || "Qualquer"} • {selectedIntent.desiredColor || "Qualquer"})
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Cliente: <strong className="text-foreground">{selectedIntent.leadName || selectedIntent.partyName}</strong> •
                Bateria Mínima: <strong className="text-foreground">{selectedIntent.minBatteryHealthPercentage}%</strong> •
                Teto Orçamento: <strong className="text-foreground">{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(selectedIntent.maxBudget)}</strong>
              </p>
            </div>

            <button
              onClick={() => setActiveTab("intents")}
              className="text-xs px-3 py-1.5 border rounded-lg hover:bg-muted transition-colors font-medium self-start md:self-auto"
            >
              Trocar Intenção
            </button>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-blue-600" />
                Unidades Serializadas Compatíveis no Estoque Real (ApprovedForSale)
              </h3>
              <span className="text-xs text-muted-foreground">
                Ordenado por Score de Aderência Algorítmica
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {mockMatches.map(match => {
                const isReservedByUi = reservedUnits[match.inventoryUnitId];
                return (
                  <div
                    key={match.inventoryUnitId}
                    className="p-5 border rounded-xl bg-card shadow-sm space-y-4 hover:border-blue-500/40 transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-semibold text-muted-foreground">
                            {match.skuCode}
                          </span>
                          <span className="px-2 py-0.5 text-[10px] rounded-full font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400">
                            Match Score: {match.matchScore}%
                          </span>
                        </div>
                        <h4 className="text-base font-bold mt-1">{match.modelName}</h4>
                        <p className="text-xs font-mono text-muted-foreground mt-0.5">
                          IMEI / Serial: <strong>{match.serialNumberOrImei}</strong>
                        </p>
                      </div>

                      <div className="text-right">
                        <div className="text-lg font-bold text-foreground">
                          {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(match.retailPrice)}
                        </div>
                        <span className="text-[11px] text-emerald-600 font-medium">Dentro do Orçamento</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 py-2 px-3 bg-muted/40 rounded-lg text-xs">
                      <div>
                        <span className="text-muted-foreground block text-[10px]">Saúde Bateria</span>
                        <span className="font-bold flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                          <BatteryCharging className="w-3.5 h-3.5" />
                          {match.batteryHealthPercentage}%
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[10px]">Grau Cosmético</span>
                        <span className="font-semibold">{match.cosmeticGrade}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[10px]">Condição</span>
                        <span className="font-semibold">{match.condition}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        <span className="text-xs text-muted-foreground">
                          {isReservedByUi ? "Reservado Oficialmente" : "Disponível para Reserva"}
                        </span>
                      </div>

                      {isReservedByUi ? (
                        <button
                          disabled
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium cursor-not-allowed"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Reserva Ativa (48h)
                        </button>
                      ) : (
                        <button
                          onClick={() => handleReserveMatch(match)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors"
                        >
                          <BookmarkCheck className="w-3.5 h-3.5" />
                          Reservar Unidade no Estoque
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Leads & Contatos */}
      {activeTab === "leads" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Leads Cadastrados & Base de Contatos</h2>
            <button className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors">
              <Plus className="w-3.5 h-3.5" />
              Novo Lead
            </button>
          </div>

          <div className="border rounded-xl bg-card overflow-hidden shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 border-b text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-3 px-4 font-semibold">Nome</th>
                  <th className="py-3 px-4 font-semibold">Contato</th>
                  <th className="py-3 px-4 font-semibold">Canal / Origem</th>
                  <th className="py-3 px-4 font-semibold">Campanha</th>
                  <th className="py-3 px-4 font-semibold">LGPD Marketing</th>
                  <th className="py-3 px-4 font-semibold">Status Party</th>
                  <th className="py-3 px-4 font-semibold text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y text-xs">
                {mockLeads.map(lead => (
                  <tr key={lead.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 font-semibold">{lead.name}</td>
                    <td className="py-3 px-4 text-muted-foreground">
                      <div>{lead.phone}</div>
                      {lead.email && <div className="text-[11px] text-muted-foreground">{lead.email}</div>}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-muted font-medium">{lead.channel}</span>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">{lead.sourceCampaign || "Orgânico / Direto"}</td>
                    <td className="py-3 px-4">
                      {lead.lgpdMarketingOptIn ? (
                        <span className="inline-flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Autorizado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-medium text-amber-600 dark:text-amber-400">
                          <AlertCircle className="w-3.5 h-3.5" />
                          Opt-Out
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {lead.convertedPartyId ? (
                        <span className="px-2 py-0.5 rounded-full font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400">
                          Cliente Vinculado
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full font-medium bg-muted text-muted-foreground">
                          Lead Prospect
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {!lead.convertedPartyId && (
                        <button className="px-2.5 py-1 text-xs border rounded-lg hover:bg-muted font-medium transition-colors">
                          Converter em Cliente
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
