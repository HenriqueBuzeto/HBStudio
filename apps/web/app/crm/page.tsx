"use client";

import React, { useState } from "react";
import RootShellLayout from "@/components/RootShellLayout";
import {
  Users,
  Target,
  Plus,
  TrendingUp,
  FolderOpen
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

interface OpportunityView {
  id: string;
  title: string;
  leadName?: string;
  stageId: string;
  stageName: string;
  estimatedValue: number;
  confidenceScore: number;
  expectedClosingDate?: string;
  assignedUserName?: string;
}

interface PurchaseIntentView {
  id: string;
  leadName?: string;
  desiredModelName: string;
  desiredColor?: string;
  desiredStorage?: string;
  minBatteryHealthPercentage?: number;
  maxBudget: number;
  status: string;
}

const standardStages: PipelineStageView[] = [
  { id: "stage-1", name: "Prospecção / Lead", orderIndex: 1, isWonStage: false, isLostStage: false },
  { id: "stage-2", name: "Qualificação & Desejo", orderIndex: 2, isWonStage: false, isLostStage: false },
  { id: "stage-3", name: "Proposta / Matching", orderIndex: 3, isWonStage: false, isLostStage: false },
  { id: "stage-4", name: "Negociação", orderIndex: 4, isWonStage: false, isLostStage: false },
  { id: "stage-5", name: "Ganho (Fechado)", orderIndex: 5, isWonStage: true, isLostStage: false }
];

export default function CrmPage() {
  const [activeTab, setActiveTab] = useState<"kanban" | "intents" | "matching" | "leads">("kanban");
  const [stages] = useState<PipelineStageView[]>(standardStages);
  const [opportunities, setOpportunities] = useState<OpportunityView[]>([]);
  const [intents, setIntents] = useState<PurchaseIntentView[]>([]);
  const [leads, setLeads] = useState<LeadView[]>([]);
  const [showModal, setShowModal] = useState(false);

  // Form Oportunidade
  const [oppTitle, setOppTitle] = useState("");
  const [oppLead, setOppLead] = useState("");
  const [oppValue, setOppValue] = useState("");

  const handleCreateOpp = (e: React.FormEvent) => {
    e.preventDefault();
    window.alert("Cadastro de oportunidades indisponível até integração com Neon.");
  };

  const totalEstimatedPipeline = opportunities.reduce((acc, curr) => acc + curr.estimatedValue, 0);

  return (
    <RootShellLayout>
      <div className="space-y-6">
        {/* Header estilo HBVisionX */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-700 bg-purple-50 px-2.5 py-1 rounded-full border border-purple-200">
                Inteligência Comercial
              </span>
            </div>
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900 mt-1">
              Funil de Vendas & Intenções de Compra
            </h1>
            <p className="text-xs text-slate-500">
              Módulo de CRM aguardando integração real com Neon.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              disabled title="Aguardando integração com Neon"
              className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-violet-600 to-purple-700 hover:from-violet-700 hover:to-purple-800 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-purple-600/20"
            >
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
              <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                {opportunities.length} negociações abertas
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500"></div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Fila de Espera (Intenções)
              </span>
              <div className="text-lg font-extrabold text-blue-600">{intents.length} Clientes</div>
              <p className="text-[10px] text-slate-400 mt-1">Aguardando especificações</p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500"></div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Matches no Estoque Real
              </span>
              <div className="text-lg font-extrabold text-amber-600">0 Aparelhos</div>
              <p className="text-[10px] text-slate-400 mt-1">Aguardando fila de interesse</p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500"></div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Leads Qualificados LGPD
              </span>
              <div className="text-lg font-extrabold text-slate-900">{leads.length}</div>
              <p className="text-[10px] text-slate-400 mt-1">Consentimento de contato</p>
            </div>
          </div>
        </div>

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
            Intenções de Compra & Fila de Espera
          </button>
          <button
            onClick={() => setActiveTab("leads")}
            className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${
              activeTab === "leads"
                ? "border-purple-600 text-purple-700"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            Leads & Contatos
          </button>
        </div>

        {/* Tab 1: Funil Kanban */}
        {activeTab === "kanban" && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3.5">
            {stages.map(stage => {
              const stageOpps = opportunities.filter(o => o.stageId === stage.id);
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
                        <div className="text-[11px] text-slate-500">{opp.leadName}</div>
                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                          <span className="font-extrabold text-slate-900">
                            {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(opp.estimatedValue)}
                          </span>
                        </div>
                      </div>
                    ))}
                    {stageOpps.length === 0 && (
                      <div className="h-28 flex items-center justify-center text-[11px] text-slate-400 border border-dashed border-slate-300 rounded-xl">
                        Nenhuma oportunidade
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal Nova Oportunidade */}
        {showModal && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-slate-200 max-w-sm w-full p-6 shadow-xl space-y-4">
              <h3 className="text-sm font-extrabold text-slate-900">Nova Oportunidade Comercial</h3>
              <form onSubmit={handleCreateOpp} className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Título da Negociação *</label>
                  <input
                    type="text"
                    required
                    value={oppTitle}
                    onChange={(e) => setOppTitle(e.target.value)}
                    placeholder="Ex: iPhone 15 Pro 128GB"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Cliente / Interessado</label>
                  <input
                    type="text"
                    value={oppLead}
                    onChange={(e) => setOppLead(e.target.value)}
                    placeholder="Nome do cliente"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Valor Estimado (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={oppValue}
                    onChange={(e) => setOppValue(e.target.value)}
                    placeholder="Ex: 5800.00"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:outline-none"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-gradient-to-r from-violet-600 to-purple-700 text-white rounded-xl text-xs font-bold shadow-md shadow-purple-600/20"
                  >
                    Criar Negociação
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
