"use client";

import React, { useState } from "react";
import RootShellLayout from "@/components/RootShellLayout";
import {
  Code2,
  FolderGit2,
  Clock,
  Coins,
  CheckCircle2,
  AlertCircle,
  FileCode,
  ShieldCheck,
  Plus,
  ArrowRight,
  TrendingUp,
  FileCheck,
  GitBranch,
  Calendar,
  Layers,
  Sparkles
} from "lucide-react";

interface ProjectItem {
  id: string;
  projectCode: string;
  name: string;
  description: string;
  type: string;
  pricingModel: string;
  status: "Draft" | "Approved" | "InProgress" | "Completed" | "Closed";
  customerName: string;
  leadTechnicianName: string;
  contractedPrice: number;
  estimatedHours: number;
  totalActualLaborCost: number;
  invoicedAmount: number;
  paidAmount: number;
}

export default function DigitalProjectsPage() {
  const [activeTab, setActiveTab] = useState<"projects" | "timesheet" | "deliverables" | "contracts" | "rentability">("projects");

  const [projects, setProjects] = useState<ProjectItem[]>([
    {
      id: "1",
      projectCode: "PRJ-2026-001",
      name: "Portal Institucional & E-commerce HB Studio",
      description: "Desenvolvimento de frontend Next.js 16, backend .NET 10 e checkout integrado",
      type: "CustomSoftware",
      pricingModel: "FixedPrice",
      status: "InProgress",
      customerName: "Henrique Barreto",
      leadTechnicianName: "Henrique Barreto",
      contractedPrice: 8500.00,
      estimatedHours: 60.0,
      totalActualLaborCost: 1250.00,
      invoicedAmount: 3000.00,
      paidAmount: 3000.00
    }
  ]);

  const [selectedProject, setSelectedProject] = useState<ProjectItem | null>(projects[0]);

  // Modal Novo Projeto
  const [showNewModal, setShowNewModal] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [price, setPrice] = useState(5000);
  const [hours, setHours] = useState(40);
  const [client, setClient] = useState("");

  // Modal Apontamento de Horas (Timesheet)
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [timeHours, setTimeHours] = useState(4);
  const [hourlyRate, setHourlyRate] = useState(55);
  const [timeDesc, setTimeDesc] = useState("");

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    const newPrj: ProjectItem = {
      id: crypto.randomUUID(),
      projectCode: `PRJ-2026-${String(projects.length + 1).padStart(3, "0")}`,
      name,
      description: desc || "Projeto de software e serviços digitais",
      type: "CustomSoftware",
      pricingModel: "FixedPrice",
      status: "Draft",
      customerName: client || "Cliente Geral",
      leadTechnicianName: "Henrique Barreto",
      contractedPrice: Number(price),
      estimatedHours: Number(hours),
      totalActualLaborCost: 0,
      invoicedAmount: 0,
      paidAmount: 0
    };

    setProjects([newPrj, ...projects]);
    setSelectedProject(newPrj);
    setShowNewModal(false);
    setName("");
    setDesc("");
  };

  const handleRecordTime = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;

    const addedCost = timeHours * hourlyRate;
    const updated = {
      ...selectedProject,
      totalActualLaborCost: selectedProject.totalActualLaborCost + addedCost
    };

    setProjects(projects.map(p => p.id === selectedProject.id ? updated : p));
    setSelectedProject(updated);
    setShowTimeModal(false);
    setTimeDesc("");
  };

  return (
    <RootShellLayout>
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50/50">
        {/* Header Superior */}
        <div className="px-6 py-4 bg-white border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold tracking-wider text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200/60 uppercase">
                MOD-11 • Software & Serviços Digitais
              </span>
              <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> CPC 47 & Governança Jurídica
              </span>
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight mt-1 flex items-center gap-2">
              <Code2 className="w-5 h-5 text-purple-600" />
              Gestão de Projetos Digitais & Contratos
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Escopos versionados, tarefas técnicas, timesheet real com custo histórico e apuração contínua de rentabilidade.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setShowTimeModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm hover:bg-slate-50 hover:border-slate-400 transition-all"
            >
              <Clock className="w-3.5 h-3.5 text-purple-600" />
              Apontar Horas (Timesheet)
            </button>
            <button
              onClick={() => setShowNewModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-purple-600 rounded-lg shadow-sm hover:bg-purple-700 shadow-purple-600/20 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              Novo Projeto
            </button>
          </div>
        </div>

        {/* Abas de Navegação */}
        <div className="px-6 bg-white border-b border-slate-200 flex items-center gap-6 text-xs font-semibold">
          <button
            onClick={() => setActiveTab("projects")}
            className={`py-3 flex items-center gap-1.5 border-b-2 transition-colors ${
              activeTab === "projects"
                ? "border-purple-600 text-purple-700"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            <Layers className="w-4 h-4" />
            Carteira de Projetos ({projects.length})
          </button>
          <button
            onClick={() => setActiveTab("timesheet")}
            className={`py-3 flex items-center gap-1.5 border-b-2 transition-colors ${
              activeTab === "timesheet"
                ? "border-purple-600 text-purple-700"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            <Clock className="w-4 h-4" />
            Horas & Apontamentos
          </button>
          <button
            onClick={() => setActiveTab("deliverables")}
            className={`py-3 flex items-center gap-1.5 border-b-2 transition-colors ${
              activeTab === "deliverables"
                ? "border-purple-600 text-purple-700"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            <FileCode className="w-4 h-4" />
            Entregáveis & Código-Fonte
          </button>
          <button
            onClick={() => setActiveTab("rentability")}
            className={`py-3 flex items-center gap-1.5 border-b-2 transition-colors ${
              activeTab === "rentability"
                ? "border-purple-600 text-purple-700"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            Rentabilidade & Margem
          </button>
        </div>

        {/* Corpo de Conteúdo */}
        <div className="flex-1 overflow-auto p-6">
          {activeTab === "projects" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
              {/* Lista de Projetos */}
              <div className="lg:col-span-2 flex flex-col bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-sm">Projetos em Andamento</span>
                  <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-semibold">
                    {projects.length} ativos
                  </span>
                </div>

                <div className="divide-y divide-slate-100 overflow-auto flex-1">
                  {projects.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => setSelectedProject(p)}
                      className={`p-4 cursor-pointer transition-colors flex items-center justify-between ${
                        selectedProject?.id === p.id ? "bg-purple-50/60" : "hover:bg-slate-50"
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-slate-900">{p.projectCode}</span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                              p.status === "Completed"
                                ? "bg-emerald-100 text-emerald-800"
                                : p.status === "InProgress"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {p.status}
                          </span>
                        </div>
                        <h3 className="text-sm font-semibold text-slate-800">{p.name}</h3>
                        <div className="flex items-center gap-3 text-xs text-slate-500">
                          <span>Cliente: {p.customerName}</span>
                          <span>•</span>
                          <span>Responsável: {p.leadTechnicianName}</span>
                          <span>•</span>
                          <span>Preço: R$ {p.contractedPrice.toFixed(2)}</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-xs font-bold text-purple-700">
                          {p.estimatedHours}h estimadas
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Custo Real: R$ {p.totalActualLaborCost.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Detalhes do Projeto Selecionado */}
              <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5 flex flex-col justify-between">
                {selectedProject ? (
                  <div className="space-y-4">
                    <div className="border-b border-slate-100 pb-3">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
                          {selectedProject.projectCode}
                        </span>
                        <span className="text-xs font-semibold text-slate-500">{selectedProject.type}</span>
                      </div>
                      <h2 className="text-base font-bold text-slate-900 mt-2">{selectedProject.name}</h2>
                      <p className="text-xs text-slate-500 mt-1">{selectedProject.description}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                        <span className="text-slate-400 block font-medium">Preço Contratado</span>
                        <span className="text-slate-900 font-bold text-sm">
                          R$ {selectedProject.contractedPrice.toFixed(2)}
                        </span>
                      </div>
                      <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                        <span className="text-slate-400 block font-medium">Custo Incorrido Real</span>
                        <span className="text-purple-700 font-bold text-sm">
                          R$ {selectedProject.totalActualLaborCost.toFixed(2)}
                        </span>
                      </div>
                      <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                        <span className="text-slate-400 block font-medium">Total Faturado</span>
                        <span className="text-emerald-700 font-bold text-sm">
                          R$ {selectedProject.invoicedAmount.toFixed(2)}
                        </span>
                      </div>
                      <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                        <span className="text-slate-400 block font-medium">Lucro Bruto Real</span>
                        <span className="text-emerald-600 font-bold text-sm">
                          R$ {(selectedProject.contractedPrice - selectedProject.totalActualLaborCost).toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Ações de Gestão</h3>
                      <button
                        onClick={() => setShowTimeModal(true)}
                        className="w-full flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        Apontar Horas neste Projeto
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center text-slate-400">
                    <Code2 className="w-10 h-10 text-slate-300 mb-2" />
                    <p className="text-xs">Selecione um projeto para inspecionar os detalhes.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "timesheet" && (
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-6 space-y-4">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-purple-600" />
                Apontamentos Reais de Horas (Timesheet Autoritativo)
              </h2>
              <p className="text-xs text-slate-500">
                Cada hora registrada preserva a taxa de custo histórica vigente para impedir distorções contábeis em recálculos posteriores.
              </p>
              <div className="p-4 bg-purple-50/50 rounded-xl border border-purple-100 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-purple-900 block">Horas Realizadas no Mês Atual:</span>
                  <span className="text-xl font-extrabold text-purple-700">25.0 h</span>
                </div>
                <button
                  onClick={() => setShowTimeModal(true)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-lg"
                >
                  Novo Apontamento
                </button>
              </div>
            </div>
          )}

          {activeTab === "deliverables" && (
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-6 space-y-4 text-center text-slate-500">
              <FileCode className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="text-sm font-bold text-slate-800">Repositórios & Entregáveis Digitais</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Armazenamento de referências técnicas, releases com hash SHA-256 e termos de aceite formal assinado pelo contratante.
              </p>
            </div>
          )}

          {activeTab === "rentability" && (
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-6 space-y-4">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
                Matriz de Rentabilidade por Projeto (Previsto vs Realizado)
              </h2>
              <div className="divide-y divide-slate-100 text-xs">
                {projects.map(p => {
                  const marginPct = p.contractedPrice > 0 ? ((p.contractedPrice - p.totalActualLaborCost) / p.contractedPrice) * 100 : 0;
                  return (
                    <div key={p.id} className="py-3 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-900 text-sm block">{p.name}</span>
                        <span className="text-slate-500">{p.projectCode} • Cliente: {p.customerName}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-slate-900 block text-sm">
                          Margem Bruta: {marginPct.toFixed(1)}%
                        </span>
                        <span className="text-emerald-600 font-semibold">
                          Lucro: R$ {(p.contractedPrice - p.totalActualLaborCost).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Novo Projeto */}
        {showNewModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900">Novo Projeto Digital</h3>
                <button onClick={() => setShowNewModal(false)} className="text-slate-400 hover:text-slate-600">
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateProject} className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Nome do Projeto *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Landing Page Imobiliária Alta Conversão"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-purple-600"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Cliente Contratante</label>
                  <input
                    type="text"
                    placeholder="Ex: Tech Parts ou Carlos Silva"
                    value={client}
                    onChange={(e) => setClient(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-purple-600"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">Preço Contratado (R$)</label>
                    <input
                      type="number"
                      value={price}
                      onChange={(e) => setPrice(Number(e.target.value))}
                      className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">Horas Estimadas</label>
                    <input
                      type="number"
                      value={hours}
                      onChange={(e) => setHours(Number(e.target.value))}
                      className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg"
                    />
                  </div>
                </div>

                <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowNewModal(false)}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-sm"
                  >
                    Salvar Projeto
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Apontamento de Horas */}
        {showTimeModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900">Apontar Horas (Timesheet)</h3>
                <button onClick={() => setShowTimeModal(false)} className="text-slate-400 hover:text-slate-600">
                  ✕
                </button>
              </div>

              <form onSubmit={handleRecordTime} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">Duração (Horas) *</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      value={timeHours}
                      onChange={(e) => setTimeHours(Number(e.target.value))}
                      className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">Custo Horário Interno (R$/h)</label>
                    <input
                      type="number"
                      value={hourlyRate}
                      onChange={(e) => setHourlyRate(Number(e.target.value))}
                      className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Descrição do Trabalho Realizado</label>
                  <textarea
                    rows={2}
                    placeholder="Ex: Modelagem e implementação de endpoints da API"
                    value={timeDesc}
                    onChange={(e) => setTimeDesc(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-purple-600"
                  />
                </div>

                <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowTimeModal(false)}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-sm"
                  >
                    Registrar Horas
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
