"use client";

import React, { useState } from "react";
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
  Layers
} from "lucide-react";

export default function FinancialPage() {
  const [activeTab, setActiveTab] = useState<"overview" | "dre" | "payables" | "receivables" | "reconciliation">("overview");

  // DRE Ilustrativa calculada sobre dados reais do primeiro mês
  const dreData = {
    grossRevenue: 10000.00,
    deductions: 0.00,
    netRevenue: 10000.00,
    cmv: 6000.00,
    grossProfit: 4000.00,
    grossMarginPercent: 40.0,
    operatingExpenses: 2500.00,
    netResult: 1500.00,
    netMarginPercent: 15.0
  };

  // Contas a Pagar
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
      titleNumber: "ALUG-NOV-26",
      description: "Aluguel da Loja Física",
      dueDate: "2026-11-10",
      originalAmount: 2500.00,
      paidAmount: 2500.00,
      balance: 0.00,
      status: "Pago"
    }
  ];

  // Contas a Receber
  const receivables = [
    {
      id: "rec-1",
      customer: "Clínica Vida & Saúde",
      titleNumber: "REC-SOFT-01",
      description: "Desenvolvimento Sistema Web / Landing Page",
      dueDate: "2026-11-20",
      originalAmount: 4500.00,
      receivedAmount: 4500.00,
      balance: 0.00,
      status: "Recebido"
    },
    {
      id: "rec-2",
      customer: "Empresa Alfa",
      titleNumber: "REC-3D-02",
      description: "Lote de Gabinetes Personalizados 3D",
      dueDate: "2026-11-30",
      originalAmount: 1800.00,
      receivedAmount: 0.00,
      balance: 1800.00,
      status: "Em Aberto"
    }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 space-y-6">
      {/* Top Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
            <TrendingUp className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              Gestão Financeira & DRE
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                MOD-12 Ativo
              </span>
            </h1>
            <p className="text-sm text-slate-400">
              Contas a Pagar/Receber · Conciliação Bancária · Razão em Partidas Dobradas · DRE Gerencial
            </p>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-sm overflow-x-auto">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              activeTab === "overview" ? "bg-emerald-600 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            Visão Executiva
          </button>
          <button
            onClick={() => setActiveTab("dre")}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              activeTab === "dre" ? "bg-emerald-600 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            DRE Gerencial
          </button>
          <button
            onClick={() => setActiveTab("payables")}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              activeTab === "payables" ? "bg-emerald-600 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            Contas a Pagar
          </button>
          <button
            onClick={() => setActiveTab("receivables")}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              activeTab === "receivables" ? "bg-emerald-600 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            Contas a Receber
          </button>
        </div>
      </header>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Disponibilidade Bancária</span>
              <div className="mt-2 text-2xl font-black text-emerald-400">
                R$ 28.350,00
              </div>
              <p className="text-xs text-slate-400 mt-2">Saldo conciliado em contas ativas</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Contas a Receber (30d)</span>
              <div className="mt-2 text-2xl font-black text-cyan-400">
                R$ 1.800,00
              </div>
              <p className="text-xs text-slate-400 mt-2">Títulos a vencer confirmados</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Contas a Pagar (30d)</span>
              <div className="mt-2 text-2xl font-black text-rose-400">
                R$ 2.000,00
              </div>
              <p className="text-xs text-slate-400 mt-2">Compromissos pendentes</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Lucro Líquido Gerencial</span>
              <div className="mt-2 text-2xl font-black text-amber-400">
                R$ 1.500,00
              </div>
              <p className="text-xs text-slate-400 mt-2">Margem líquida de 15,0% (DRE)</p>
            </div>
          </div>

          {/* Banner de Inteligência Financeira e Segregação Societária */}
          <div className="bg-emerald-950/30 border border-emerald-500/20 p-5 rounded-2xl space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
              <CheckCircle2 className="w-5 h-5" />
              Diretriz Financeira HBVisionX: Faturamento vs. Lucro vs. Caixa
            </div>
            <p className="text-xs text-emerald-200/90 leading-relaxed">
              O saldo em conta corrente não representa lucro distribuível. Os aportes de capital dos investidores ou sócios são classificados como Patrimônio Líquido/Passivo e não transitam pela DRE como receita operacional. Da mesma forma, aquisições de mercadorias de R$ 35.000 são ativadas em Estoques, sendo reconhecidas na DRE como Custo das Mercadorias Vendidas (CMV) apenas mediante a saída física no Kardex.
            </p>
          </div>
        </div>
      )}

      {/* DRE Gerencial Tab */}
      {activeTab === "dre" && (
        <div className="max-w-4xl mx-auto bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
          <div className="p-6 border-b border-slate-800 flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                Demonstrativo de Resultado do Exercício (DRE Gerencial)
              </h2>
              <p className="text-xs text-slate-400 mt-1">Apuração por regime de competência com custos reais</p>
            </div>
            <span className="text-xs px-3 py-1 bg-slate-800 text-slate-300 rounded-full font-mono">
              Período: Mês 01
            </span>
          </div>

          <div className="p-6 space-y-4 font-mono text-sm">
            <div className="flex justify-between items-center py-2 border-b border-slate-800">
              <span className="text-slate-300 font-bold">(+) Receita Bruta de Vendas e Serviços</span>
              <span className="text-emerald-400 font-bold">R$ {dreData.grossRevenue.toFixed(2)}</span>
            </div>

            <div className="flex justify-between items-center py-2 text-slate-400 pl-4 border-b border-slate-800/60">
              <span>(-) Deduções da Receita / Devoluções</span>
              <span>R$ {dreData.deductions.toFixed(2)}</span>
            </div>

            <div className="flex justify-between items-center py-2 font-bold text-slate-200 bg-slate-950/60 px-3 rounded-lg">
              <span>(=) Receita Líquida</span>
              <span>R$ {dreData.netRevenue.toFixed(2)}</span>
            </div>

            <div className="flex justify-between items-center py-2 text-rose-300 pl-4 border-b border-slate-800/60">
              <span>(-) Custo das Mercadorias Vendidas (CMV Oficial Kardex)</span>
              <span>- R$ {dreData.cmv.toFixed(2)}</span>
            </div>

            <div className="flex justify-between items-center py-2 font-bold text-slate-100 bg-slate-950/80 px-3 rounded-lg">
              <span>(=) Lucro Bruto (Margem: {dreData.grossMarginPercent.toFixed(1)}%)</span>
              <span className="text-emerald-400">R$ {dreData.grossProfit.toFixed(2)}</span>
            </div>

            <div className="flex justify-between items-center py-2 text-rose-300 pl-4 border-b border-slate-800/60">
              <span>(-) Despesas Operacionais e Administrativas (Aluguel, Energia, etc.)</span>
              <span>- R$ {dreData.operatingExpenses.toFixed(2)}</span>
            </div>

            <div className="flex justify-between items-center py-3 font-black text-base bg-emerald-950/40 border border-emerald-500/30 px-4 rounded-xl text-white">
              <span>(=) Resultado Líquido Gerencial do Exercício</span>
              <span className="text-emerald-400 text-lg">R$ {dreData.netResult.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Contas a Pagar Tab */}
      {activeTab === "payables" && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-5 border-b border-slate-800 flex justify-between items-center">
            <h3 className="font-bold text-white flex items-center gap-2">
              <ArrowDownRight className="w-5 h-5 text-rose-400" />
              Títulos e Contas a Pagar
            </h3>
            <span className="text-xs text-slate-400 font-mono">
              Total em Aberto: R$ 2.000,00
            </span>
          </div>

          <div className="divide-y divide-slate-800">
            {payables.map((p) => (
              <div key={p.id} className="p-4 hover:bg-slate-800/40 transition flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-200">{p.description}</div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Fornecedor: {p.supplier} · Título: {p.titleNumber} · Venc: {p.dueDate}
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-bold text-slate-200">R$ {p.originalAmount.toFixed(2)}</div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Saldo: <span className="text-rose-400 font-semibold">R$ {p.balance.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Contas a Receber Tab */}
      {activeTab === "receivables" && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-5 border-b border-slate-800 flex justify-between items-center">
            <h3 className="font-bold text-white flex items-center gap-2">
              <ArrowUpRight className="w-5 h-5 text-cyan-400" />
              Títulos e Contas a Receber
            </h3>
            <span className="text-xs text-slate-400 font-mono">
              Total a Receber: R$ 1.800,00
            </span>
          </div>

          <div className="divide-y divide-slate-800">
            {receivables.map((r) => (
              <div key={r.id} className="p-4 hover:bg-slate-800/40 transition flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-200">{r.description}</div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Cliente: {r.customer} · Título: {r.titleNumber} · Venc: {r.dueDate}
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-bold text-slate-200">R$ {r.originalAmount.toFixed(2)}</div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Saldo: <span className="text-cyan-400 font-semibold">R$ {r.balance.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
