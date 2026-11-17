"use client";

import React, { useState, useEffect, useCallback } from "react";
import RootShellLayout from "@/components/RootShellLayout";
import { 
  Package, 
  Search, 
  Plus, 
  Eye, 
  EyeOff, 
  Warehouse,
  FolderOpen,
  ArrowDownRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle
} from "lucide-react";

export interface StockBalance {
  id: string;
  branchId: string;
  warehouseId: string;
  warehouseName: string;
  locationCode?: string;
  productSkuId: string;
  skuCode: string;
  skuVariantName: string;
  onHandQuantity: number;
  reservedQuantity: number;
  blockedQuantity: number;
  availableQuantity: number;
  averageCost?: number;
  totalValuedAmount?: number;
  lastMovementAtUtc: string;
  version: number;
}

export interface StockMovement {
  id: string;
  branchId: string;
  warehouseId: string;
  warehouseName: string;
  locationCode?: string;
  productSkuId: string;
  skuCode: string;
  inventoryUnitId?: string;
  serialOrImei?: string;
  movementType: number;
  quantity: number;
  unitCost?: number;
  totalCost?: number;
  balanceAfterQuantity: number;
  documentReference: string;
  reason?: string;
  createdAtUtc: string;
}

export interface WarehouseItem {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}

export interface ProductSkuOption {
  id: string;
  skuCode: string;
  variantName: string;
  defaultPrice: number;
}

export default function InventoryPage() {
  const [balances, setBalances] = useState<StockBalance[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([]);
  const [skus, setSkus] = useState<ProductSkuOption[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"balances" | "kardex">("balances");
  const [search, setSearch] = useState("");
  const [canViewCost, setCanViewCost] = useState(true);

  // Modal Entrada Inicial
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  const [selectedSkuId, setSelectedSkuId] = useState("");
  const [receiptQuantity, setReceiptQuantity] = useState("1");
  const [receiptUnitCost, setReceiptUnitCost] = useState("");
  const [receiptDocRef, setReceiptDocRef] = useState("");
  const [receiptReason, setReceiptReason] = useState("");
  const [receiptSerialOrImei, setReceiptSerialOrImei] = useState("");

  const loadInventoryData = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const [balRes, kardexRes, whRes, modelRes] = await Promise.all([
        fetch("/api/inventory/balances"),
        fetch("/api/inventory/kardex"),
        fetch("/api/inventory/warehouses"),
        fetch("/api/catalog/models")
      ]);

      if (balRes.ok) {
        setBalances(await balRes.json());
      }
      if (kardexRes.ok) {
        setMovements(await kardexRes.json());
      }
      if (whRes.ok) {
        const whData = await whRes.json();
        setWarehouses(whData);
        if (whData.length > 0 && !selectedWarehouseId) {
          setSelectedWarehouseId(whData[0].id);
        }
      }
      if (modelRes.ok) {
        const models = await modelRes.json();
        const extractedSkus: ProductSkuOption[] = [];
        models.forEach((m: any) => {
          (m.skus || []).forEach((s: any) => {
            extractedSkus.push({
              id: s.id,
              skuCode: s.skuCode,
              variantName: `${m.name} - ${s.variantName}`,
              defaultPrice: s.defaultPrice
            });
          });
        });
        setSkus(extractedSkus);
        if (extractedSkus.length > 0 && !selectedSkuId) {
          setSelectedSkuId(extractedSkus[0].id);
        }
      }
    } catch {
      setErrorMsg("Falha ao comunicar com o serviço de estoque.");
    } finally {
      setIsLoading(false);
    }
  }, [selectedWarehouseId, selectedSkuId]);

  useEffect(() => {
    loadInventoryData();
  }, [loadInventoryData]);

  // Handler: Realizar Recebimento Inicial Oficial (Kardex Append-Only)
  const handleInitialReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWarehouseId || !selectedSkuId || !receiptQuantity || !receiptUnitCost || !receiptDocRef.trim()) {
      setErrorMsg("Preencha depósito, SKU, quantidade, custo unitário e documento de referência.");
      return;
    }

    try {
      const payload = {
        branchId: "b0000000-0000-0000-0000-000000000001",
        warehouseId: selectedWarehouseId,
        warehouseLocationId: null,
        productSkuId: selectedSkuId,
        quantity: parseFloat(receiptQuantity),
        unitCost: parseFloat(receiptUnitCost),
        documentReference: receiptDocRef.trim(),
        reason: receiptReason.trim() || "Recebimento e conferência de estoque físico",
        serialOrImei: receiptSerialOrImei.trim() || null,
        idempotencyKey: `rcpt-${Date.now()}`
      };

      const res = await fetch("/api/inventory/initial-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setErrorMsg(err.error || "Erro ao registrar entrada no estoque.");
        return;
      }

      setSuccessMsg("Entrada de estoque registrada no Kardex oficial com sucesso!");
      setTimeout(() => setSuccessMsg(null), 4000);

      setIsReceiptOpen(false);
      setReceiptQuantity("1");
      setReceiptUnitCost("");
      setReceiptDocRef("");
      setReceiptReason("");
      setReceiptSerialOrImei("");
      await loadInventoryData();
    } catch {
      setErrorMsg("Erro de comunicação ao registrar entrada no estoque.");
    }
  };

  const totalOnHand = balances.reduce((acc, curr) => acc + (curr.onHandQuantity || 0), 0);
  const totalReserved = balances.reduce((acc, curr) => acc + (curr.reservedQuantity || 0), 0);
  const totalAvailable = balances.reduce((acc, curr) => acc + (curr.availableQuantity || 0), 0);
  const totalValuation = balances.reduce((acc, curr) => acc + (curr.totalValuedAmount || 0), 0);

  const filteredBalances = balances.filter(b => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return b.skuCode.toLowerCase().includes(term) || 
           b.skuVariantName.toLowerCase().includes(term) || 
           b.warehouseName.toLowerCase().includes(term);
  });

  const filteredMovements = movements.filter(m => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return m.skuCode.toLowerCase().includes(term) || 
           (m.serialOrImei && m.serialOrImei.toLowerCase().includes(term)) ||
           m.documentReference.toLowerCase().includes(term);
  });

  const getMovementTypeName = (type: number) => {
    switch (type) {
      case 1: return "Entrada Inicial / Compra";
      case 2: return "Entrada por Transferência";
      case 3: return "Entrada por Devolução";
      case 4: return "Ajuste Positivo Inventário";
      case 5: return "Saída por Venda";
      case 6: return "Saída por Transferência";
      case 7: return "Ajuste Negativo Inventário";
      case 8: return "Consumo Ordem de Serviço";
      case 9: return "Consumo Fabricação 3D";
      default: return "Movimentação";
    }
  };

  return (
    <RootShellLayout>
      <div className="space-y-6">
        {/* Notificações */}
        {errorMsg && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs font-bold flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg(null)} className="text-rose-500 hover:text-rose-700">✕</button>
          </div>
        )}

        {successMsg && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-bold flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-700">✕</button>
          </div>
        )}

        {/* Header estilo HBVisionX */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200/90 shadow-xs">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200">
                Logística & Estoque Oficial
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                Kardex Imutável Neon
              </span>
            </div>
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900 mt-1">
              Estoque Físico & Kardex Transacional
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
            <button
              onClick={() => setIsReceiptOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-violet-600 to-purple-700 hover:from-violet-700 hover:to-purple-800 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-purple-600/20"
            >
              <Plus className="w-3.5 h-3.5" />
              Entrada Oficial no Kardex
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
                Reservado para Pedidos
              </span>
              <div className="text-lg font-extrabold text-amber-700">{totalReserved} un</div>
              <p className="text-[10px] text-slate-400 mt-1">Aguardando faturamento no PDV</p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500"></div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Disponível para Venda
              </span>
              <div className="text-lg font-extrabold text-emerald-700">{totalAvailable} un</div>
              <p className="text-[10px] text-slate-400 mt-1">Livre para novas vendas</p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-purple-600"></div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Valuation Total de Estoque
              </span>
              <div className="text-lg font-extrabold text-purple-700 font-mono">
                {canViewCost
                  ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totalValuation)
                  : "••••••"}
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Custo médio ponderado CPC 16</p>
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
              Saldos por SKU ({balances.length})
            </button>
            <button
              onClick={() => setActiveTab("kardex")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === "kardex"
                  ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Kardex & Rastreabilidade ({movements.length})
            </button>
          </div>

          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por SKU, depósito ou documento..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 text-slate-800 transition-all shadow-xs"
            />
          </div>
        </div>

        {/* Tabela de Saldos */}
        {activeTab === "balances" && (
          <div className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-bold text-[10px]">
                <tr>
                  <th className="py-3 px-4">Código SKU / Descrição</th>
                  <th className="py-3 px-4">Depósito</th>
                  <th className="py-3 px-4">Físico (On Hand)</th>
                  <th className="py-3 px-4">Reservado</th>
                  <th className="py-3 px-4">Disponível</th>
                  {canViewCost && (
                    <>
                      <th className="py-3 px-4 font-mono">Custo Médio</th>
                      <th className="py-3 px-4 font-mono">Valor Total</th>
                    </>
                  )}
                  <th className="py-3 px-4">Última Movimentação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={canViewCost ? 8 : 6} className="py-12 text-center text-slate-400">
                      Carregando saldos de estoque do PostgreSQL...
                    </td>
                  </tr>
                ) : filteredBalances.length === 0 ? (
                  <tr>
                    <td colSpan={canViewCost ? 8 : 6} className="py-16 text-center text-slate-400">
                      <FolderOpen className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                      <p className="font-bold text-slate-700">Nenhum saldo registrado em estoque</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Realize uma entrada oficial no Kardex ou aprove o recebimento de compras.</p>
                    </td>
                  </tr>
                ) : (
                  filteredBalances.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-slate-900">{item.skuCode}</div>
                        <div className="text-[11px] text-slate-500">{item.skuVariantName}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-700">{item.warehouseName}</span>
                      </td>
                      <td className="py-3 px-4 font-extrabold text-slate-900">{item.onHandQuantity} un</td>
                      <td className="py-3 px-4 font-bold text-amber-700">{item.reservedQuantity} un</td>
                      <td className="py-3 px-4 font-extrabold text-emerald-700">{item.availableQuantity} un</td>
                      {canViewCost && (
                        <>
                          <td className="py-3 px-4 font-mono font-bold text-slate-700">
                            {item.averageCost !== undefined
                              ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(item.averageCost)
                              : "—"}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-purple-700">
                            {item.totalValuedAmount !== undefined
                              ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(item.totalValuedAmount)
                              : "—"}
                          </td>
                        </>
                      )}
                      <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                        {new Date(item.lastMovementAtUtc).toLocaleString("pt-BR")}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tabela Kardex */}
        {activeTab === "kardex" && (
          <div className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-bold text-[10px]">
                <tr>
                  <th className="py-3 px-4">Data / Hora</th>
                  <th className="py-3 px-4">Tipo Movimentação</th>
                  <th className="py-3 px-4">SKU / Aparelho</th>
                  <th className="py-3 px-4">Quantidade</th>
                  <th className="py-3 px-4">Saldo Posterior</th>
                  {canViewCost && <th className="py-3 px-4 font-mono">Custo Unitário</th>}
                  <th className="py-3 px-4">Documento / Motivo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={canViewCost ? 7 : 6} className="py-12 text-center text-slate-400">
                      Carregando movimentações do Kardex...
                    </td>
                  </tr>
                ) : filteredMovements.length === 0 ? (
                  <tr>
                    <td colSpan={canViewCost ? 7 : 6} className="py-16 text-center text-slate-400">
                      <FolderOpen className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                      <p className="font-bold text-slate-700">Kardex sem movimentações registradas</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Todas as entradas, saídas e reservas são gravadas de forma permanente e auditável.</p>
                    </td>
                  </tr>
                ) : (
                  filteredMovements.map((mov) => (
                    <tr key={mov.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                        {new Date(mov.createdAtUtc).toLocaleString("pt-BR")}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          mov.movementType <= 4
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-rose-50 text-rose-700 border border-rose-200"
                        }`}>
                          {getMovementTypeName(mov.movementType)}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-slate-900">{mov.skuCode}</div>
                        {mov.serialOrImei && (
                          <div className="text-[10px] font-mono text-purple-700">IMEI: {mov.serialOrImei}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 font-extrabold text-slate-900">
                        {mov.quantity > 0 ? `+${mov.quantity}` : mov.quantity} un
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-800">
                        {mov.balanceAfterQuantity} un
                      </td>
                      {canViewCost && (
                        <td className="py-3 px-4 font-mono text-slate-700">
                          {mov.unitCost !== undefined
                            ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(mov.unitCost)
                            : "—"}
                        </td>
                      )}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800 font-mono text-[11px]">{mov.documentReference}</div>
                        <div className="text-[10px] text-slate-400">{mov.reason || "Sem observação"}</div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Modal: Entrada Oficial no Kardex */}
        {isReceiptOpen && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 shadow-xl space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <h3 className="text-sm font-extrabold text-slate-900">Entrada Oficial no Estoque (Kardex)</h3>
                <button onClick={() => setIsReceiptOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
              </div>

              <form onSubmit={handleInitialReceipt} className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Depósito de Destino *</label>
                  <select
                    required
                    value={selectedWarehouseId}
                    onChange={(e) => setSelectedWarehouseId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">SKU do Produto *</label>
                  <select
                    required
                    value={selectedSkuId}
                    onChange={(e) => setSelectedSkuId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
                  >
                    {skus.map((s) => (
                      <option key={s.id} value={s.id}>{s.skuCode} - {s.variantName}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Quantidade *</label>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      required
                      value={receiptQuantity}
                      onChange={(e) => setReceiptQuantity(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Custo Unitário Real (R$) *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={receiptUnitCost}
                      onChange={(e) => setReceiptUnitCost(e.target.value)}
                      placeholder="3500.00"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-rose-700"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">IMEI / Número de Série (Opcional se serializado)</label>
                  <input
                    type="text"
                    value={receiptSerialOrImei}
                    onChange={(e) => setReceiptSerialOrImei(e.target.value)}
                    placeholder="354891828374659"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-purple-700 font-bold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Documento de Origem (NF / Recibo) *</label>
                    <input
                      type="text"
                      required
                      value={receiptDocRef}
                      onChange={(e) => setReceiptDocRef(e.target.value)}
                      placeholder="NF-e 004128"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Motivo da Entrada</label>
                    <input
                      type="text"
                      value={receiptReason}
                      onChange={(e) => setReceiptReason(e.target.value)}
                      placeholder="Compra direta de fornecedor"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsReceiptOpen(false)}
                    className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-gradient-to-r from-violet-600 to-purple-700 text-white rounded-xl text-xs font-bold shadow-xs"
                  >
                    Gravar no Kardex
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
