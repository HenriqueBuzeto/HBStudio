"use client";

import React, { useState } from "react";
import RootShellLayout from "@/components/RootShellLayout";
import { 
  DollarSign, 
  ArrowDownRight, 
  ArrowUpRight, 
  Lock, 
  Unlock, 
  AlertCircle, 
  ShieldCheck, 
  Calculator, 
  Clock, 
  Building2,
  CheckCircle2,
  XCircle,
  FileText,
  Plus,
  Coins,
  Receipt
} from "lucide-react";

export default function CashPage() {
  const [activeTab, setActiveTab] = useState<"overview" | "movements" | "count">("overview");

  return (
    <RootShellLayout>
      <div className="space-y-6">
        {/* Header estilo HBVisionX */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200/90 shadow-xs">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200">
                Frente de Loja
              </span>
            </div>
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900 mt-1">
              Caixa & Gestão de Turnos
            </h1>
            <p className="text-xs text-slate-500">
              Terminal operacional balcão, conferência cega de valores, sangrias e suprimentos.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 transition-colors shadow-xs">
              <ArrowDownRight className="w-3.5 h-3.5 text-rose-500" />
              Sangria
            </button>
            <button className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 transition-colors shadow-xs">
              <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" />
              Suprimento
            </button>
            <button className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-violet-600 to-purple-700 hover:from-violet-700 hover:to-purple-800 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-purple-600/20">
              <Lock className="w-3.5 h-3.5" />
              Fechar Caixa
            </button>
          </div>
        </div>

        {/* Indicadores Topo estilo HBVisionX */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <Coins className="w-3.5 h-3.5 text-purple-600" />
              Disponibilidade em Caixa (Turno 01)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500"></div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Saldo Físico (Dinheiro Gaveta)
              </span>
              <div className="text-lg font-extrabold text-slate-900">R$ 1.840,00</div>
              <p className="text-[10px] text-emerald-600 font-semibold mt-1">Conferência em dia</p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500"></div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Fundo de Troco Inicial
              </span>
              <div className="text-lg font-extrabold text-slate-900">R$ 200,00</div>
              <p className="text-[10px] text-slate-500 mt-1">Abertura: 08:30</p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-purple-600"></div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Entradas em Dinheiro
              </span>
              <div className="text-lg font-extrabold text-purple-700">R$ 1.640,00</div>
              <p className="text-[10px] text-slate-500 mt-1">Vendas PDV e serviços</p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500"></div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                PIX & Cartões (Registrados)
              </span>
              <div className="text-lg font-extrabold text-slate-900">R$ 12.450,00</div>
              <p className="text-[10px] text-slate-500 mt-1">Conciliação eletrônica</p>
            </div>
          </div>
        </div>

        {/* Tabela de Movimentações */}
        <div className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-purple-600" />
              Lançamentos do Turno Atual
            </h3>
            <span className="text-xs text-slate-500">Operador: Henrique Barreto</span>
          </div>

          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-bold text-[10px]">
              <tr>
                <th className="py-3 px-4">Hora</th>
                <th className="py-3 px-4">Tipo</th>
                <th className="py-3 px-4">Valor</th>
                <th className="py-3 px-4">Documento / Venda</th>
                <th className="py-3 px-4">Justificativa / Motivo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr className="hover:bg-slate-50/80 transition-colors">
                <td className="py-3 px-4 text-slate-500">08:30</td>
                <td className="py-3 px-4">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700">
                    Abertura / Fundo
                  </span>
                </td>
                <td className="py-3 px-4 font-bold text-slate-900">R$ 200,00</td>
                <td className="py-3 px-4 font-mono text-slate-600">TURNO-01</td>
                <td className="py-3 px-4 text-slate-500">Troco para início das operações</td>
              </tr>
              <tr className="hover:bg-slate-50/80 transition-colors">
                <td className="py-3 px-4 text-slate-500">11:15</td>
                <td className="py-3 px-4">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700">
                    Venda PDV
                  </span>
                </td>
                <td className="py-3 px-4 font-bold text-emerald-600">+ R$ 650,00</td>
                <td className="py-3 px-4 font-mono text-slate-600">VENDA-0087</td>
                <td className="py-3 px-4 text-slate-500">Acessórios Apple e capa protetora</td>
              </tr>
              <tr className="hover:bg-slate-50/80 transition-colors">
                <td className="py-3 px-4 text-slate-500">14:40</td>
                <td className="py-3 px-4">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700">
                    Entrada OS
                  </span>
                </td>
                <td className="py-3 px-4 font-bold text-emerald-600">+ R$ 990,00</td>
                <td className="py-3 px-4 font-mono text-slate-600">OS-2026-0001</td>
                <td className="py-3 px-4 text-slate-500">Troca de display iPhone 14 Pro</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </RootShellLayout>
  );
}
