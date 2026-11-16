"use client";

import React, { useState } from "react";
import RootShellLayout from "@/components/RootShellLayout";
import { 
  Package, 
  Search, 
  Plus, 
  TrendingUp, 
  Eye, 
  EyeOff, 
  Warehouse,
  FolderOpen
} from "lucide-react";

export interface StockBalance {
  id: string;
  skuCode: string;
  skuDescription: string;
  warehouseName: string;
  onHandQuantity: number;
  reservedQuantity: number;
  blockedQuantity: number;
  availableQuantity: number;
  averageUnitCost: number;
  totalValuation: number;
}

export interface StockMovement {
  id: string;
  movementDateUtc: string;
  skuCode: string;
  skuDescription: string;
  movementType: string;
  quantity: number;
  unitCost: number;
  serialNumberOrImei?: string;
  documentReference: string;
  reason: string;
}

export default function InventoryPage() {
  const [balances, setBalances] = useState<StockBalance[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [activeTab, setActiveTab] = useState<"balances" | "kardex">("balances");
  const [search, setSearch] = useState("");
  const [canViewCost, setCanViewCost] = useState(true);

  const totalOnHand = balances.reduce((acc, curr) => acc + curr.onHandQuantity, 0);
  const totalReserved = balances.reduce((acc, curr) => acc + curr.reservedQuantity, 0);
  const totalAvailable = balances.reduce((acc, curr) => acc + curr.availableQuantity, 0);
  const totalValuation = balances.reduce((acc, curr) => acc + curr.totalValuation, 0);

  return (
    <RootShellLayout>
      <div className="space-y-6">
        {/* Header estilo HBVisionX */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200/90 shadow-xs">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200">
                Logística & Estoque
              </span>
            </div>
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900 mt-1">
              Estoque Físico & Kardex Imutável
            </h1>
            <p className="text-xs text-slate-500">
              Controle de saldos físicos em tempo real, rastreamento de IMEI, reservas para venda e histórico de movimentações.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCanViewCost(!canViewCost)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors shadow-xs"
            >
              {canViewCost ? <EyeOff className="w-3.5 h-3.5 text-purple-600" /> : <Eye className="w-3.5 h-3.5 text-slate-400" />}
              <span>{canViewCost ? "Ocultar Custos" : "Ver Custos Reais"}</span>
            </button>
          </div>
        </div>

        {/* Indicadores Topo estilo HBVisionX */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <Warehouse className="w-3.5 h-3.5 text-purple-600" />
              Posição Física Consolidada
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-slate-900"></div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Saldo Físico (On Hand)
              </span>
              <div className="text-lg font-extrabold text-slate-900">{totalOnHand} un</div>
              <p className="text-[10px] text-slate-400 mt-1">Presente fisicamente na loja</p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500"></div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Reservado em Vendas / OS
              </span>
              <div className="text-lg font-extrabold text-amber-600">{totalReserved} un</div>
              <p className="text-[10px] text-slate-400 mt-1">Comprometido em pedidos</p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500"></div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Disponível para Venda
              </span>
              <div className="text-lg font-extrabold text-emerald-600">{totalAvailable} un</div>
              <p className="text-[10px] text-slate-400 mt-1">Livre para faturamento</p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-purple-600"></div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Valoração Total (Custo)
              </span>
              <div className="text-lg font-extrabold text-purple-700">
                {canViewCost
                  ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totalValuation)
                  : "••••••"}
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Custo médio ponderado</p>
            </div>
          </div>
        </div>

        {/* Abas e Busca */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 p-1 bg-white rounded-xl border border-slate-200/80 shadow-xs">
            <button
              onClick={() => setActiveTab("balances")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === "balances"
                  ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Saldos por Depósito ({balances.length})
            </button>
            <button
              onClick={() => setActiveTab("kardex")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === "kardex"
                  ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Kardex de Movimentações ({movements.length})
            </button>
          </div>

          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por SKU, descrição ou documento..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 text-slate-800 transition-all shadow-xs"
            />
          </div>
        </div>

        {/* Tab 1: Saldos */}
        {activeTab === "balances" && (
          <div className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-bold text-[10px]">
                <tr>
                  <th className="py-3 px-4">Código SKU / Descrição</th>
                  <th className="py-3 px-4">Localização / Depósito</th>
                  <th className="py-3 px-4">Físico (On Hand)</th>
                  <th className="py-3 px-4">Reservado</th>
                  <th className="py-3 px-4">Disponível</th>
                  {canViewCost && <th className="py-3 px-4">Custo Médio</th>}
                  {canViewCost && <th className="py-3 px-4">Valoração Total</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {balances.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-mono font-bold text-slate-900">{b.skuCode}</div>
                      <div className="text-slate-500">{b.skuDescription}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-700 font-medium">{b.warehouseName}</td>
                    <td className="py-3 px-4 font-bold text-slate-900">{b.onHandQuantity} un</td>
                    <td className="py-3 px-4 font-bold text-amber-600">{b.reservedQuantity} un</td>
                    <td className="py-3 px-4 font-extrabold text-emerald-600">{b.availableQuantity} un</td>
                    {canViewCost && (
                      <td className="py-3 px-4 font-mono text-slate-600">
                        {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(b.averageUnitCost)}
                      </td>
                    )}
                    {canViewCost && (
                      <td className="py-3 px-4 font-mono font-bold text-purple-700">
                        {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(b.totalValuation)}
                      </td>
                    )}
                  </tr>
                ))}
                {balances.length === 0 && (
                  <tr>
                    <td colSpan={canViewCost ? 7 : 5} className="py-16 text-center text-slate-400">
                      <FolderOpen className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                      <p className="font-bold text-slate-700">Estoque inicial zerado</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Dê entrada em produtos via Compras ou Recebimento para alimentar o Kardex.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: Kardex */}
        {activeTab === "kardex" && (
          <div className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-bold text-[10px]">
                <tr>
                  <th className="py-3 px-4">Data / Hora</th>
                  <th className="py-3 px-4">SKU / Aparelho</th>
                  <th className="py-3 px-4">Tipo de Movimento</th>
                  <th className="py-3 px-4">Qtd</th>
                  <th className="py-3 px-4">Documento / Ref</th>
                  <th className="py-3 px-4">Motivo / Histórico</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {movements.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 text-slate-500 font-medium">{m.movementDateUtc}</td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{m.skuDescription}</div>
                      {m.serialNumberOrImei && (
                        <div className="text-[10px] font-mono text-purple-700">IMEI: {m.serialNumberOrImei}</div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                        {m.movementType}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono font-extrabold text-slate-900">
                      {m.quantity > 0 ? `+${m.quantity}` : m.quantity} un
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">{m.documentReference}</td>
                    <td className="py-3 px-4 text-slate-500">{m.reason}</td>
                  </tr>
                ))}
                {movements.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-slate-400">
                      <FolderOpen className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                      <p className="font-bold text-slate-700">Nenhum movimento registrado no Kardex</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Todo lançamento oficial de estoque fica gravado de forma imutável aqui.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </RootShellLayout>
  );
}
