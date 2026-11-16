"use client";

import React, { useState } from "react";
import RootShellLayout from "@/components/RootShellLayout";
import {
  Users,
  PieChart,
  ShieldCheck,
  TrendingUp,
  Wallet,
  HandCoins,
  ArrowUpRight,
  ArrowDownRight,
  FileCheck2,
  AlertTriangle,
  Scale,
  Award,
  Layers,
  Banknote,
  Percent,
  CheckCircle2,
  Building2,
  Plus
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

const partnersData: PartnerView[] = [
  {
    id: "p1",
    name: "Henrique Barreto",
    document: "123.456.789-00",
    role: "Sócio Administrador / Operação",
    equityPercentage: 50.0,
    quotas: 50000,
    nominalValue: 50000.0,
    monthlyProLaboreCap: 8000.0,
    active: true,
    notes: "Responsável pela administração geral, laboratório e frente comercial."
  },
  {
    id: "p2",
    name: "Sócio Estratégico & Investidor",
    document: "987.654.321-99",
    role: "Sócio Investidor / Financeiro",
    equityPercentage: 50.0,
    quotas: 50000,
    nominalValue: 50000.0,
    monthlyProLaboreCap: 0.0,
    active: true,
    notes: "Aporte financeiro inicial e estratégia de expansão."
  }
];

export default function PartnersPage() {
  const [activeTab, setActiveTab] = useState<"quotas" | "contributions" | "loans" | "distribution">("quotas");

  const totalEquity = partnersData.reduce((acc, p) => acc + p.equityPercentage, 0);
  const totalNominalCapital = partnersData.reduce((acc, p) => acc + p.nominalValue, 0);

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
            <button className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-violet-600 to-purple-700 hover:from-violet-700 hover:to-purple-800 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-purple-600/20">
              <Plus className="w-3.5 h-3.5" />
              Novo Aporte / Mútuo
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
              <p className="text-[10px] text-emerald-600 font-semibold mt-1">100% Integralizado</p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500"></div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Soma de Quotas
              </span>
              <div className="text-lg font-extrabold text-emerald-600">{totalEquity}%</div>
              <p className="text-[10px] text-emerald-600 font-semibold mt-1">Equilíbrio exato 100%</p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500"></div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Sócios Registrados
              </span>
              <div className="text-lg font-extrabold text-slate-900">{partnersData.length} Sócios</div>
              <p className="text-[10px] text-slate-500 mt-1">Acordo societário ativo</p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500"></div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Teto Pró-Labore
              </span>
              <div className="text-lg font-extrabold text-slate-900">R$ 8.000,00</div>
              <p className="text-[10px] text-slate-500 mt-1">Remuneração operacional</p>
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
              {partnersData.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="font-extrabold text-slate-900">{p.name}</div>
                    <div className="text-[10px] font-mono text-slate-400">{p.document}</div>
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
            </tbody>
          </table>
        </div>
      </div>
    </RootShellLayout>
  );
}
