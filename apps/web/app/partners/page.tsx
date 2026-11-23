"use client";

import React, { useState } from "react";
import RootShellLayout from "@/components/RootShellLayout";
import {formatCpf} from "@/lib/br-format";
import {
  Users,
  Building2,
  Plus,
  FolderOpen
} from "lucide-react";

interface PartnerView {
  id: string;
  name: string;
  document: string;
  role: string;
  equityPercentage: number;
  quotas: number;
  nominalValue: number;
  monthlyProLaboreCap: number;
  active: boolean;
  notes: string;
}

export default function PartnersPage() {
  const [partners, setPartners] = useState<PartnerView[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [doc, setDoc] = useState("");
  const [role, setRole] = useState("Sócio Administrador");
  const [percentage, setPercentage] = useState("");
  const [capital, setCapital] = useState("");

  const totalEquity = partners.reduce((acc, p) => acc + p.equityPercentage, 0);
  const totalNominalCapital = partners.reduce((acc, p) => acc + p.nominalValue, 0);

  const handleAddPartner = (e: React.FormEvent) => {
    e.preventDefault();
    window.alert("Cadastro societário indisponível até integração com Neon e validação do contrato social.");
  };

  return (
    <RootShellLayout>
      <div className="space-y-6">
        {/* Header estilo HBVisionX */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200/90 shadow-xs">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200">
                Governança & Capital
              </span>
            </div>
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900 mt-1">
              Sócios & Capital Social
            </h1>
            <p className="text-xs text-slate-500">
              Quotas societárias (100%), integralização de capital, mútuos, pró-labore e distribuição de resultados.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              disabled title="Aguardando integração societária com Neon"
              className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-violet-600 to-purple-700 hover:from-violet-700 hover:to-purple-800 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-purple-600/20"
            >
              <Plus className="w-3.5 h-3.5" />
              Cadastrar Sócio
            </button>
          </div>
        </div>

        {/* Indicadores Topo estilo HBVisionX */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-purple-600" />
              Estrutura Societária Consolidada
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-purple-600"></div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Capital Social Subscrito
              </span>
              <div className="text-lg font-extrabold text-slate-900">
                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totalNominalCapital)}
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Capital integralizado</p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500"></div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Soma de Quotas
              </span>
              <div className="text-lg font-extrabold text-emerald-600">{totalEquity}%</div>
              <p className="text-[10px] text-slate-400 mt-1">{totalEquity === 100 ? "Equilíbrio exato 100%" : "Cadastre os sócios"}</p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500"></div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Sócios Registrados
              </span>
              <div className="text-lg font-extrabold text-slate-900">{partners.length} Sócios</div>
              <p className="text-[10px] text-slate-400 mt-1">Acordo societário</p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500"></div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Teto Pró-Labore
              </span>
              <div className="text-lg font-extrabold text-slate-900">R$ 0,00</div>
              <p className="text-[10px] text-slate-400 mt-1">Remuneração mensal</p>
            </div>
          </div>
        </div>

        {/* Tabela de Sócios */}
        <div className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-600" />
              Quadro Societário & Participação
            </h3>
            <span className="text-xs text-slate-500 font-medium">Contrato Social Vigente</span>
          </div>

          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-bold text-[10px]">
              <tr>
                <th className="py-3 px-4">Sócio</th>
                <th className="py-3 px-4">Papel / Função</th>
                <th className="py-3 px-4">Participação</th>
                <th className="py-3 px-4">Quotas</th>
                <th className="py-3 px-4">Valor Nominal</th>
                <th className="py-3 px-4">Teto Pró-Labore</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {partners.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="font-extrabold text-slate-900">{p.name}</div>
                    <div className="text-[10px] font-mono text-slate-400">{formatCpf(p.document)}</div>
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 font-medium">{p.role}</td>
                  <td className="py-3.5 px-4 font-extrabold text-purple-700 text-sm">
                    {p.equityPercentage}%
                  </td>
                  <td className="py-3.5 px-4 font-mono text-slate-700">
                    {p.quotas.toLocaleString("pt-BR")}
                  </td>
                  <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(p.nominalValue)}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-slate-600">
                    {p.monthlyProLaboreCap > 0
                      ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(p.monthlyProLaboreCap)
                      : "Sem pró-labore"}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Regular
                    </span>
                  </td>
                </tr>
              ))}
              {partners.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400">
                    <FolderOpen className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                    <p className="font-bold text-slate-700">Nenhum sócio cadastrado</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Quadro societário aguardando integração com Neon. O vínculo de autenticação atual foi preservado.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Modal Cadastrar Sócio */}
        {showModal && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-slate-200 max-w-sm w-full p-6 shadow-xl space-y-4">
              <h3 className="text-sm font-extrabold text-slate-900">Cadastrar Sócio</h3>
              <form onSubmit={handleAddPartner} className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Nome Completo *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nome do sócio"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">CPF</label>
                  <input
                    type="text"
                    value={doc}
                    onChange={(e) => setDoc(formatCpf(e.target.value))}
                    placeholder="000.000.000-00"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Participação (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      required
                      value={percentage}
                      onChange={(e) => setPercentage(e.target.value)}
                      placeholder="Ex: 50"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Aporte Nominal (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={capital}
                      onChange={(e) => setCapital(e.target.value)}
                      placeholder="50000.00"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:outline-none"
                    />
                  </div>
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
                    Salvar
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
