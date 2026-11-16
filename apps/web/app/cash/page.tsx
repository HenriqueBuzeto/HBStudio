"use client";

import React, { useState } from "react";
import RootShellLayout from "@/components/RootShellLayout";
import { 
  DollarSign, 
  ArrowDownRight, 
  ArrowUpRight, 
  Lock, 
  Coins, 
  Receipt,
  FolderOpen
} from "lucide-react";

interface CashMovement {
  id: string;
  time: string;
  type: string;
  amount: number;
  doc: string;
  reason: string;
}

export default function CashPage() {
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [cashBalance, setCashBalance] = useState<number>(0.00);
  const [initialFloat, setInitialFloat] = useState<number>(0.00);
  const [cashIn, setCashIn] = useState<number>(0.00);
  const [electronicSales, setElectronicSales] = useState<number>(0.00);
  const [isShiftOpen, setIsShiftOpen] = useState(false);
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [floatInput, setFloatInput] = useState("");

  const handleOpenShift = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(floatInput) || 0;
    setInitialFloat(val);
    setCashBalance(val);
    setIsShiftOpen(true);
    setShowOpenModal(false);
    setMovements([
      {
        id: `m-${Date.now()}`,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        type: "Abertura / Fundo",
        amount: val,
        doc: "TURNO-01",
        reason: "Fundo de troco inicial para abertura do caixa"
      }
    ]);
  };

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
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isShiftOpen ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-500"}`}>
                {isShiftOpen ? "Turno Aberto" : "Caixa Fechado"}
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
            {!isShiftOpen ? (
              <button
                onClick={() => setShowOpenModal(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-violet-600 to-purple-700 hover:from-violet-700 hover:to-purple-800 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-purple-600/20"
              >
                <Lock className="w-3.5 h-3.5" />
                Abrir Caixa (Turno 01)
              </button>
            ) : (
              <>
                <button className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 transition-colors shadow-xs">
                  <ArrowDownRight className="w-3.5 h-3.5 text-rose-500" />
                  Sangria
                </button>
                <button className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 transition-colors shadow-xs">
                  <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" />
                  Suprimento
                </button>
                <button
                  onClick={() => setIsShiftOpen(false)}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
                >
                  <Lock className="w-3.5 h-3.5" />
                  Fechar Turno
                </button>
              </>
            )}
          </div>
        </div>

        {/* Indicadores Topo estilo HBVisionX */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <Coins className="w-3.5 h-3.5 text-purple-600" />
              Disponibilidade em Caixa
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500"></div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Saldo Físico (Dinheiro Gaveta)
              </span>
              <div className="text-lg font-extrabold text-slate-900">
                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cashBalance)}
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Conferência física</p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500"></div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Fundo de Troco Inicial
              </span>
              <div className="text-lg font-extrabold text-slate-900">
                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(initialFloat)}
              </div>
              <p className="text-[10px] text-slate-400 mt-1">{isShiftOpen ? "Turno em andamento" : "Aguardando abertura"}</p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-purple-600"></div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Entradas em Dinheiro
              </span>
              <div className="text-lg font-extrabold text-purple-700">
                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cashIn)}
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Vendas PDV e serviços</p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500"></div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                PIX & Cartões (Registrados)
              </span>
              <div className="text-lg font-extrabold text-slate-900">
                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(electronicSales)}
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Conciliação eletrônica</p>
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
              {movements.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 text-slate-500">{m.time}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700">
                      {m.type}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-bold text-slate-900">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(m.amount)}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-600">{m.doc}</td>
                  <td className="py-3 px-4 text-slate-500">{m.reason}</td>
                </tr>
              ))}
              {movements.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-slate-400">
                    <FolderOpen className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                    <p className="font-bold text-slate-700">Nenhum movimento no turno</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Abra o caixa e lance as primeiras vendas ou suprimentos do balcão.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Modal de Abertura de Caixa */}
        {showOpenModal && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-slate-200 max-w-sm w-full p-6 shadow-xl space-y-4">
              <h3 className="text-sm font-extrabold text-slate-900">Abertura de Caixa (Turno 01)</h3>
              <form onSubmit={handleOpenShift} className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Fundo de Troco Inicial (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={floatInput}
                    onChange={(e) => setFloatInput(e.target.value)}
                    placeholder="Ex: 200,00"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowOpenModal(false)}
                    className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-gradient-to-r from-violet-600 to-purple-700 text-white rounded-xl text-xs font-bold shadow-md shadow-purple-600/20"
                  >
                    Confirmar Abertura
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
