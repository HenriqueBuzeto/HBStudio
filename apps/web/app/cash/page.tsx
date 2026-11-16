"use client";

import React, { useState } from "react";
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
  FileText
} from "lucide-react";

interface CashRegister {
  id: string;
  code: string;
  name: string;
  status: number;
}

interface CashMovement {
  id: string;
  movementType: number;
  direction: number;
  amount: number;
  documentReference: string;
  reason: string;
  createdAtUtc: string;
}

interface CashShift {
  id: string;
  branchId: string;
  cashRegisterId: string;
  registerCode: string;
  registerName: string;
  openedAtUtc: string;
  openingFloat: number;
  status: number; // 1: Open, 2: Closing, 3: CountSubmitted, 4: Approved, 5: Closed
  currentBalance: number;
  totalCashIn: number;
  totalCashOut: number;
  expectedCashBalance?: number;
  countedCashBalance?: number;
  discrepancyAmount?: number;
  discrepancyType?: number; // 1: Surplus, 2: Shortage
  movements: CashMovement[];
}

export default function CashManagementPage() {
  const [activeTab, setActiveTab] = useState<"overview" | "shift" | "blindCount" | "history">("overview");

  // Mock de estado representativo autenticado
  const [currentShift, setCurrentShift] = useState<CashShift | null>({
    id: "shift-001",
    branchId: "branch-matriz",
    cashRegisterId: "reg-01",
    registerCode: "CX-01",
    registerName: "Caixa Balcão Principal",
    openedAtUtc: "2026-11-14T08:30:00Z",
    openingFloat: 350.00,
    status: 1, // Open
    currentBalance: 850.00,
    totalCashIn: 1050.00,
    totalCashOut: 200.00,
    movements: [
      {
        id: "mov-01",
        movementType: 1, // OpeningFloat
        direction: 1,
        amount: 350.00,
        documentReference: "ABERTURA",
        reason: "Fundo inicial de caixa. Origem: Cofre Central",
        createdAtUtc: "2026-11-14T08:30:00Z"
      },
      {
        id: "mov-02",
        movementType: 2, // CashSaleReceipt
        direction: 1,
        amount: 700.00,
        documentReference: "VENDA-PDV-1002",
        reason: "Recebimento em dinheiro PDV - Venda iPhone 13",
        createdAtUtc: "2026-11-14T09:30:00Z"
      },
      {
        id: "mov-03",
        movementType: 5, // CashWithdrawal (Sangria)
        direction: 2,
        amount: 200.00,
        documentReference: "SANGRIA-143000",
        reason: "Sangria para Cofre: Recolhimento de malote de segurança. Recebedor: Gerente",
        createdAtUtc: "2026-11-14T11:00:00Z"
      }
    ]
  });

  // Estado para Sangria e Suprimento
  const [movModal, setMovModal] = useState<"withdrawal" | "supply" | null>(null);
  const [movAmount, setMovAmount] = useState<string>("");
  const [movReason, setMovReason] = useState<string>("");
  const [movDestOrOrigin, setMovDestOrOrigin] = useState<string>("Cofre");

  // Estado para Conferência Cega
  const [denominations, setDenominations] = useState<{ [key: string]: number }>({
    "100": 5,
    "50": 4,
    "20": 5,
    "10": 4,
    "5": 2,
    "2": 0,
    "1": 0
  });

  const countedTotal = Object.entries(denominations).reduce(
    (acc, [val, qty]) => acc + parseFloat(val) * (qty || 0),
    0
  );

  const handleRecordMovement = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(movAmount);
    if (!amt || amt <= 0 || !currentShift) return;

    if (movModal === "withdrawal" && amt > currentShift.currentBalance) {
      alert("Erro: O valor da sangria não pode exceder o saldo em gaveta!");
      return;
    }

    const isWithdrawal = movModal === "withdrawal";
    const newMov: CashMovement = {
      id: `mov-${Date.now()}`,
      movementType: isWithdrawal ? 5 : 4,
      direction: isWithdrawal ? 2 : 1,
      amount: amt,
      documentReference: `${isWithdrawal ? "SANGRIA" : "SUPRIMENTO"}-${Date.now().toString().slice(-4)}`,
      reason: `${isWithdrawal ? "Sangria para " : "Suprimento de "}${movDestOrOrigin}: ${movReason}`,
      createdAtUtc: new Date().toISOString()
    };

    setCurrentShift({
      ...currentShift,
      currentBalance: isWithdrawal ? currentShift.currentBalance - amt : currentShift.currentBalance + amt,
      totalCashIn: isWithdrawal ? currentShift.totalCashIn : currentShift.totalCashIn + amt,
      totalCashOut: isWithdrawal ? currentShift.totalCashOut + amt : currentShift.totalCashOut,
      movements: [newMov, ...currentShift.movements]
    });

    setMovModal(null);
    setMovAmount("");
    setMovReason("");
  };

  const handleSubmitBlindCount = () => {
    if (!currentShift) return;
    const diff = countedTotal - currentShift.currentBalance;

    setCurrentShift({
      ...currentShift,
      status: 3, // CountSubmitted
      expectedCashBalance: currentShift.currentBalance,
      countedCashBalance: countedTotal,
      discrepancyAmount: Math.abs(diff),
      discrepancyType: diff > 0 ? 1 : diff < 0 ? 2 : undefined
    });

    setActiveTab("shift");
  };

  const handleApproveAndClose = () => {
    if (!currentShift) return;
    setCurrentShift({
      ...currentShift,
      status: 5 // Closed
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 space-y-6">
      {/* Top Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
            <DollarSign className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-white flex items-center gap-2">
              Caixa & Gestão de Turnos
              <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Caixa Aberto
              </span>
            </h1>
            <p className="text-sm text-slate-400">
              Terminal Operacional Balcão · Conferência Cega · Sangrias e Suprimentos
            </p>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-sm">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              activeTab === "overview" ? "bg-amber-600 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            Visão Geral
          </button>
          <button
            onClick={() => setActiveTab("shift")}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              activeTab === "shift" ? "bg-amber-600 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            Caixa Operacional
          </button>
          <button
            onClick={() => setActiveTab("blindCount")}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              activeTab === "blindCount" ? "bg-amber-600 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            Conferência Cega
          </button>
        </div>
      </header>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Status do Terminal</span>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xl font-bold text-white">CX-01 Matriz</span>
                <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 text-xs rounded-full border border-emerald-500/20">
                  Turno Aberto
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-2">Aberto hoje às 08:30 por Operador Balcão</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Dinheiro em Gaveta</span>
              <div className="mt-2 text-2xl font-black text-amber-400">
                R$ {currentShift?.currentBalance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-slate-400 mt-2">Apenas moeda física disponível</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Vendas Eletrônicas (Dia)</span>
              <div className="mt-2 text-2xl font-black text-cyan-400">
                R$ 8.450,00
              </div>
              <p className="text-xs text-slate-400 mt-2">PIX / Cartões (Valores Registrados)</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Auditoria & Divergência</span>
              <div className="mt-2 flex items-center gap-2">
                <ShieldCheck className="w-6 h-6 text-emerald-400" />
                <span className="text-lg font-bold text-slate-200">Em Conformidade</span>
              </div>
              <p className="text-xs text-slate-400 mt-2">Ledger append-only imutável</p>
            </div>
          </div>

          {/* Banner de Segregação Financeira */}
          <div className="bg-amber-950/30 border border-amber-500/20 p-4 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-200/90 leading-relaxed">
              <strong>Regra de Integridade Fiduciária:</strong> O saldo de caixa reflete estritamente o dinheiro físico em custódia na gaveta. Vendas pagas via Pix ou Cartão de Crédito/Débito geram recebíveis eletrônicos e não compõem a conferência física do turno.
            </div>
          </div>
        </div>
      )}

      {/* Caixa Operacional Tab */}
      {activeTab === "shift" && currentShift && (
        <div className="space-y-6">
          {/* Shift Banner & Action Buttons */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white">{currentShift.registerName}</h2>
                <span className="text-xs px-2 py-0.5 bg-slate-800 text-slate-300 rounded font-mono">
                  {currentShift.registerCode}
                </span>
              </div>
              <p className="text-sm text-slate-400 mt-1">
                Fundo Inicial: R$ {currentShift.openingFloat.toFixed(2)} · Abertura: {new Date(currentShift.openedAtUtc).toLocaleTimeString("pt-BR")}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => { setMovModal("withdrawal"); setMovDestOrOrigin("Cofre"); }}
                disabled={currentShift.status !== 1}
                className="flex items-center gap-2 px-4 py-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 rounded-xl text-sm font-medium transition disabled:opacity-50"
              >
                <ArrowDownRight className="w-4 h-4" />
                Realizar Sangria
              </button>

              <button
                onClick={() => { setMovModal("supply"); setMovDestOrOrigin("Cofre"); }}
                disabled={currentShift.status !== 1}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-xl text-sm font-medium transition disabled:opacity-50"
              >
                <ArrowUpRight className="w-4 h-4" />
                Realizar Suprimento
              </button>

              <button
                onClick={() => setActiveTab("blindCount")}
                disabled={currentShift.status === 5}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-sm font-semibold transition disabled:opacity-50"
              >
                <Calculator className="w-4 h-4" />
                Conferência & Fechamento
              </button>
            </div>
          </div>

          {/* Situação da Contagem e Divergência */}
          {currentShift.status >= 3 && (
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-400" />
                Resultado da Conferência de Fechamento
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-xs text-slate-400">Saldo Esperado em Caixa</span>
                  <div className="text-xl font-bold text-slate-200 mt-1">
                    R$ {currentShift.expectedCashBalance?.toFixed(2)}
                  </div>
                </div>

                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-xs text-slate-400">Valor Físico Contado</span>
                  <div className="text-xl font-bold text-amber-400 mt-1">
                    R$ {currentShift.countedCashBalance?.toFixed(2)}
                  </div>
                </div>

                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-xs text-slate-400">Divergência Apurada</span>
                  <div className={`text-xl font-bold mt-1 ${
                    currentShift.discrepancyType === 2 ? "text-rose-400" : currentShift.discrepancyType === 1 ? "text-emerald-400" : "text-slate-400"
                  }`}>
                    {currentShift.discrepancyType === 2 && `Falta de R$ ${currentShift.discrepancyAmount?.toFixed(2)}`}
                    {currentShift.discrepancyType === 1 && `Sobra de R$ ${currentShift.discrepancyAmount?.toFixed(2)}`}
                    {!currentShift.discrepancyType && "Nenhuma (Exato)"}
                  </div>
                </div>
              </div>

              {currentShift.status === 3 && (
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={handleApproveAndClose}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-sm transition"
                  >
                    Aprovar e Encerrar Turno Definitivamente
                  </button>
                </div>
              )}

              {currentShift.status === 5 && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-sm flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5" />
                  Turno homologado e encerrado com sucesso. Lançamentos gravados no livro imutável.
                </div>
              )}
            </div>
          )}

          {/* Histórico Append-Only de Movimentações */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-5 border-b border-slate-800 flex justify-between items-center">
              <h3 className="font-bold text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-slate-400" />
                Ledger Imutável de Movimentações Físicas
              </h3>
              <span className="text-xs text-slate-400">
                {currentShift.movements.length} lançamentos registrados
              </span>
            </div>

            <div className="divide-y divide-slate-800">
              {currentShift.movements.map((m) => (
                <div key={m.id} className="p-4 hover:bg-slate-800/40 transition flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl border ${
                      m.direction === 1
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                    }`}>
                      {m.direction === 1 ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-200">{m.reason}</div>
                      <div className="text-xs text-slate-500 font-mono mt-0.5">
                        Ref: {m.documentReference} · {new Date(m.createdAtUtc).toLocaleTimeString("pt-BR")}
                      </div>
                    </div>
                  </div>

                  <div className={`text-base font-bold ${m.direction === 1 ? "text-emerald-400" : "text-rose-400"}`}>
                    {m.direction === 1 ? "+" : "-"} R$ {m.amount.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Conferência Cega Tab */}
      {activeTab === "blindCount" && (
        <div className="max-w-2xl mx-auto bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-2xl space-y-6">
          <div className="text-center space-y-2 border-b border-slate-800 pb-5">
            <div className="w-12 h-12 bg-amber-500/10 text-amber-400 rounded-2xl border border-amber-500/20 mx-auto flex items-center justify-center">
              <Calculator className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-white">Conferência Cega de Dinheiro</h2>
            <p className="text-xs text-slate-400">
              Conte as cédulas e moedas físicas na gaveta. O saldo esperado do sistema permanece oculto até a submissão.
            </p>
          </div>

          <div className="space-y-3">
            {Object.keys(denominations).map((denom) => (
              <div key={denom} className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="font-semibold text-slate-300">Cédulas de R$ {denom},00</span>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="0"
                    value={denominations[denom]}
                    onChange={(e) => setDenominations({ ...denominations, [denom]: parseInt(e.target.value) || 0 })}
                    className="w-20 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-right font-mono text-white text-sm"
                  />
                  <span className="text-xs text-slate-400 w-24 text-right font-mono">
                    R$ {(parseFloat(denom) * (denominations[denom] || 0)).toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex justify-between items-center">
            <span className="font-bold text-slate-300">Total Físico Contado:</span>
            <span className="text-2xl font-black text-amber-400">
              R$ {countedTotal.toFixed(2)}
            </span>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setActiveTab("shift")}
              className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium transition text-sm"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmitBlindCount}
              className="flex-1 py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-bold transition text-sm shadow-lg shadow-amber-600/20"
            >
              Submeter Contagem Cega
            </button>
          </div>
        </div>
      )}

      {/* Modal de Sangria / Suprimento */}
      {movModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md p-6 rounded-2xl shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              {movModal === "withdrawal" ? <ArrowDownRight className="w-5 h-5 text-rose-400" /> : <ArrowUpRight className="w-5 h-5 text-emerald-400" />}
              {movModal === "withdrawal" ? "Lançar Sangria de Caixa" : "Lançar Suprimento de Caixa"}
            </h3>

            <form onSubmit={handleRecordMovement} className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Valor (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={movAmount}
                  onChange={(e) => setMovAmount(e.target.value)}
                  placeholder="0,00"
                  className="w-full px-4 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-base font-mono"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">
                  {movModal === "withdrawal" ? "Destino Declarado" : "Origem Declarada"}
                </label>
                <input
                  type="text"
                  required
                  value={movDestOrOrigin}
                  onChange={(e) => setMovDestOrOrigin(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Justificativa / Motivo</label>
                <textarea
                  required
                  rows={2}
                  value={movReason}
                  onChange={(e) => setMovReason(e.target.value)}
                  placeholder={movModal === "withdrawal" ? "Ex: Recolhimento de excesso para cofre" : "Ex: Reposição de notas miúdas para troco"}
                  className="w-full px-4 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setMovModal(null)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={`flex-1 py-2.5 text-white font-bold rounded-xl text-sm transition ${
                    movModal === "withdrawal" ? "bg-rose-600 hover:bg-rose-500" : "bg-emerald-600 hover:bg-emerald-500"
                  }`}
                >
                  Confirmar Lançamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
