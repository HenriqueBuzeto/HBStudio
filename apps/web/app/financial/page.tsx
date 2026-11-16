"use client";

import React, { useState } from "react";
import RootShellLayout from "@/components/RootShellLayout";
import {
  TrendingUp,
  CreditCard,
  Building,
  ArrowUpRight,
  ArrowDownRight,
  FileSpreadsheet,
  PieChart,
  DollarSign,
  ShieldAlert,
  CheckCircle2,
  Calendar,
  Layers,
  Sparkles,
  Search,
  Filter,
  Download,
  AlertTriangle,
  Receipt,
  Wallet
} from "lucide-react";

export default function FinancialPage() {
  const [activeTab, setActiveTab] = useState<"overview" | "dre" | "payables" | "receivables" | "reconciliation">("overview");

  const dreData = {
    grossRevenue: 34500.00,
    deductions: 850.00,
    netRevenue: 33650.00,
    cmv: 18200.00,
    grossProfit: 15450.00,
    grossMarginPercent: 45.9,
    operatingExpenses: 6800.00,
    netResult: 8650.00,
    netMarginPercent: 25.7
  };

  const payables = [
    {
      id: "pay-1",
      supplier: "Distribuidora Tech Brasil",
      titleNumber: "NF-FORN-9876",
      description: "Fornecimento de Telas OLED e Baterias",
      dueDate: "2026-11-25",
      originalAmount: 3000.00,
      paidAmount: 1000.00,
      balance: 2000.00,
      status: "Parcialmente Pago"
    },
    {
      id: "pay-2",
      supplier: "Imobiliária Matriz",
      titleNumber: "ALUG-11-2026",
      description: "Aluguel Ponto Comercial Loja Moema",
      dueDate: "2026-11-20",
      originalAmount: 4500.00,
      paidAmount: 0.00,
      balance: 4500.00,
      status: "Em Aberto"
    }
  ];

  const receivables = [
    {
      id: "rec-1",
      customer: "Rodrigo Silveira",
      titleNumber: "VENDA-0089",
      description: "iPhone 15 Pro 256GB - 2ª Parcela Cartão",
      dueDate: "2026-12-10",
      originalAmount: 2845.00,
      balance: 2845.00,
      status: "A Vencer"
    },
    {
      id: "rec-2",
      customer: "Camila Guimarães",
      titleNumber: "OS-0042",
      description: "Reparo Display MacBook Air",
      dueDate: "2026-11-18",
      originalAmount: 1200.00,
      balance: 1200.00,
      status: "A Vencer"
    }
  ];

  return (
    <RootShellLayout>
      <div className="space-y-6">
        {/* Top Header estilo HBVision */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-700 bg-purple-50 px-2.5 py-1 rounded-full border border-purple-200">
                Controladoria & Finanças
              </span>
            </div>
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900 mt-1">
              Financeiro Geral & DRE Gerencial
            </h1>
            <p className="text-xs text-slate-500">
              Controle de partidas dobradas, conciliação bancária, fluxo de caixa e obrigações.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 transition-colors shadow-xs">
              <Download className="w-3.5 h-3.5 text-slate-500" />
              Exportar Relatório
            </button>
            <button className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-violet-600 to-purple-700 hover:from-violet-700 hover:to-purple-800 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-purple-600/20">
              <Receipt className="w-3.5 h-3.5" />
              Novo Lançamento
            </button>
          </div>
        </div>

        {/* Indicadores Topo (Cards Estilo HBVisionX) */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5 text-purple-600" />
              Finanças & Liquidez em Tempo Real
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            {/* Card 1 */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500"></div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Faturamento Líquido
              </span>
              <div className="text-lg font-extrabold text-slate-900">
                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(dreData.netRevenue)}
              </div>
              <p className="text-[10px] text-emerald-600 font-semibold mt-1 flex items-center gap-0.5">
                <ArrowUpRight className="w-3 h-3" />
                +14.2% vs mês anterior
              </p>
            </div>

            {/* Card 2 */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-purple-600"></div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Lucro Operacional
              </span>
              <div className="text-lg font-extrabold text-slate-900">
                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(dreData.netResult)}
              </div>
              <p className="text-[10px] text-purple-600 font-semibold mt-1">
                Margem Líquida: {dreData.netMarginPercent}%
              </p>
            </div>

            {/* Card 3 */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-rose-500"></div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Contas a Pagar (30d)
              </span>
              <div className="text-lg font-extrabold text-rose-600">
                R$ 6.500,00
              </div>
              <p className="text-[10px] text-slate-500 mt-1">2 títulos pendentes</p>
            </div>

            {/* Card 4 */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500"></div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Contas a Receber (30d)
              </span>
              <div className="text-lg font-extrabold text-blue-600">
                R$ 4.045,00
              </div>
              <p className="text-[10px] text-slate-500 mt-1">Cartões e faturados</p>
            </div>

            {/* Card 5 */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-slate-800"></div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Saldo Disponível (Bancos)
              </span>
              <div className="text-lg font-extrabold text-slate-900">
                R$ 19.820,00
              </div>
              <p className="text-[10px] text-emerald-600 font-semibold mt-1">100% Conciliado</p>
            </div>
          </div>
        </div>

        {/* Abas Estilo HBVisionX */}
        <div className="flex border-b border-slate-200 space-x-2 bg-white px-4 pt-3 rounded-t-2xl shadow-xs">
          <button
            onClick={() => setActiveTab("overview")}
            className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${
              activeTab === "overview"
                ? "border-purple-600 text-purple-700"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            Visão Geral
          </button>
          <button
            onClick={() => setActiveTab("dre")}
            className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${
              activeTab === "dre"
                ? "border-purple-600 text-purple-700"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            DRE Gerencial
          </button>
          <button
            onClick={() => setActiveTab("payables")}
            className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${
              activeTab === "payables"
                ? "border-purple-600 text-purple-700"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <ArrowDownRight className="w-3.5 h-3.5 text-rose-500" />
            Contas a Pagar
          </button>
          <button
            onClick={() => setActiveTab("receivables")}
            className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${
              activeTab === "receivables"
                ? "border-purple-600 text-purple-700"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5 text-blue-500" />
            Contas a Receber
          </button>
        </div>

        {/* Tab Content: DRE */}
        {activeTab === "dre" && (
          <div className="bg-white rounded-b-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Demonstração do Resultado do Exercício (DRE)</h3>
                <p className="text-xs text-slate-500">Mês Corrente • Regime de Competência Oficial</p>
              </div>
              <span className="text-[10px] font-bold px-2.5 py-1 rounded bg-purple-50 text-purple-700 border border-purple-200">
                Oficial HB Studio
              </span>
            </div>

            <div className="divide-y divide-slate-100 text-xs">
              <div className="py-2.5 flex justify-between font-semibold">
                <span className="text-slate-700">(+) Receita Bruta de Vendas e Serviços</span>
                <span className="text-slate-900">{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(dreData.grossRevenue)}</span>
              </div>
              <div className="py-2.5 flex justify-between text-slate-600">
                <span>(-) Deduções e Devoluções</span>
                <span className="text-rose-600">- {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(dreData.deductions)}</span>
              </div>
              <div className="py-2.5 flex justify-between font-bold bg-slate-50 px-3 rounded-lg">
                <span className="text-slate-900">(=) Receita Operacional Líquida</span>
                <span className="text-slate-900">{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(dreData.netRevenue)}</span>
              </div>
              <div className="py-2.5 flex justify-between text-slate-600">
                <span>(-) Custo das Mercadorias Vendidas (CMV Real do Kardex)</span>
                <span className="text-rose-600">- {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(dreData.cmv)}</span>
              </div>
              <div className="py-2.5 flex justify-between font-bold bg-purple-50/50 px-3 rounded-lg text-purple-900">
                <span>(=) Lucro Bruto Comercial</span>
                <span>{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(dreData.grossProfit)} ({dreData.grossMarginPercent}%)</span>
              </div>
              <div className="py-2.5 flex justify-between text-slate-600">
                <span>(-) Despesas Operacionais e Administrativas</span>
                <span className="text-rose-600">- {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(dreData.operatingExpenses)}</span>
              </div>
              <div className="py-3 flex justify-between font-extrabold text-sm bg-gradient-to-r from-emerald-50 to-emerald-100/50 px-3 rounded-xl text-emerald-900 border border-emerald-200">
                <span>(=) Resultado Líquido do Período</span>
                <span>{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(dreData.netResult)} ({dreData.netMarginPercent}%)</span>
              </div>
            </div>
          </div>
        )}

        {/* Tab Content: Contas a Pagar */}
        {(activeTab === "payables" || activeTab === "overview") && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                <ArrowDownRight className="w-4 h-4 text-rose-500" />
                Contas a Pagar e Compromissos com Fornecedores
              </h3>
              <span className="text-xs text-slate-500 font-medium">Próximos Vencimentos</span>
            </div>
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-bold text-[10px]">
                <tr>
                  <th className="py-3 px-4">Fornecedor / Título</th>
                  <th className="py-3 px-4">Descrição</th>
                  <th className="py-3 px-4">Vencimento</th>
                  <th className="py-3 px-4">Valor Original</th>
                  <th className="py-3 px-4">Saldo em Aberto</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payables.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-800">{item.supplier}</td>
                    <td className="py-3 px-4 text-slate-600">{item.description}</td>
                    <td className="py-3 px-4 font-medium">{item.dueDate}</td>
                    <td className="py-3 px-4 text-slate-600">
                      {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(item.originalAmount)}
                    </td>
                    <td className="py-3 px-4 font-extrabold text-rose-600">
                      {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(item.balance)}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        {item.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button className="px-2.5 py-1 text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors">
                        Liquidar
                      </button>
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
