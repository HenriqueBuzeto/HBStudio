"use client";

import React, { useState } from "react";
import RootShellLayout from "@/components/RootShellLayout";
import { 
  Warehouse, 
  Layers, 
  ArrowLeftRight, 
  CheckSquare, 
  Plus, 
  Search, 
  ShieldCheck, 
  CheckCircle2, 
  AlertTriangle, 
  Eye, 
  EyeOff, 
  Clock, 
  FileText,
  Boxes,
  Barcode,
  RotateCcw
} from "lucide-react";

export type WarehouseType = "GeneralStore" | "CentralDeposit" | "TechnicalBench" | "Manufacturing3D" | "Quarantine";
export type StockMovementType = "InitialBalance" | "PurchaseReceipt" | "CustomerBuyback" | "SaleIssue" | "TransferOut" | "TransferIn" | "PositiveAdjustment" | "NegativeAdjustment" | "TechnicalConsumption" | "Manufacturing3DIssue";
export type ReservationStatus = "Active" | "Consumed" | "Released" | "Expired";
export type TransferStatus = "Draft" | "Submitted" | "InTransit" | "Received" | "Cancelled";
export type InventoryCountStatus = "Draft" | "InProgress" | "PendingApproval" | "ApprovedAndPosted" | "Cancelled";

export interface StockBalance {
  id: string;
  branchId: string;
  warehouseId: string;
  warehouseName: string;
  warehouseLocationId?: string;
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
  movementType: StockMovementType;
  quantity: number;
  unitCost?: number;
  totalCost?: number;
  balanceAfterQuantity: number;
  documentReference: string;
  reason?: string;
  createdAtUtc: string;
  createdByUserId: string;
}

export interface StockReservation {
  id: string;
  branchId: string;
  reservationNumber: string;
  status: ReservationStatus;
  reason: string;
  documentReference?: string;
  expiresAtUtc: string;
  createdAtUtc: string;
  version: number;
  itemsCount: number;
}

export interface StockTransfer {
  id: string;
  transferNumber: string;
  sourceBranchId: string;
  sourceWarehouseId: string;
  targetBranchId: string;
  targetWarehouseId: string;
  status: TransferStatus;
  notes?: string;
  createdAtUtc: string;
}

export interface InventoryCount {
  id: string;
  countNumber: string;
  branchId: string;
  warehouseId: string;
  status: InventoryCountStatus;
  description: string;
  postedAtUtc?: string;
  createdAtUtc: string;
}

const mockBalances: StockBalance[] = [
  {
    id: "bal-01",
    branchId: "branch-matriz",
    warehouseId: "wh-01",
    warehouseName: "Loja Principal Matriz",
    locationCode: "A1-P2-G01",
    productSkuId: "sku-01",
    skuCode: "IPH14PM-128-PURPLE",
    skuVariantName: "iPhone 14 Pro Max 128GB Roxo",
    onHandQuantity: 3,
    reservedQuantity: 1,
    blockedQuantity: 0,
    availableQuantity: 2,
    averageCost: 3850.00,
    totalValuedAmount: 11550.00,
    lastMovementAtUtc: "2026-11-14T02:00:00.000Z",
    version: 1
  },
  {
    id: "bal-02",
    branchId: "branch-matriz",
    warehouseId: "wh-02",
    warehouseName: "Bancada Manutenção",
    locationCode: "TEC-B1",
    productSkuId: "sku-02",
    skuCode: "TEL-S21-OLED",
    skuVariantName: "Display OLED Samsung S21 Original",
    onHandQuantity: 8,
    reservedQuantity: 2,
    blockedQuantity: 0,
    availableQuantity: 6,
    averageCost: 320.00,
    totalValuedAmount: 2560.00,
    lastMovementAtUtc: "2026-11-14T01:30:00.000Z",
    version: 1
  },
  {
    id: "bal-03",
    branchId: "branch-matriz",
    warehouseId: "wh-03",
    warehouseName: "Almoxarifado Manufatura 3D",
    locationCode: "3D-R01",
    productSkuId: "sku-03",
    skuCode: "PLA-BLACK-1KG",
    skuVariantName: "Filamento PLA Preto 1.75mm 1kg",
    onHandQuantity: 15.5,
    reservedQuantity: 0.5,
    blockedQuantity: 0,
    availableQuantity: 15.0,
    averageCost: 65.00,
    totalValuedAmount: 1007.50,
    lastMovementAtUtc: "2026-11-14T01:15:00.000Z",
    version: 1
  }
];

const mockKardex: StockMovement[] = [
  {
    id: "mov-01",
    branchId: "branch-matriz",
    warehouseId: "wh-01",
    warehouseName: "Loja Principal Matriz",
    locationCode: "A1-P2-G01",
    productSkuId: "sku-01",
    skuCode: "IPH14PM-128-PURPLE",
    inventoryUnitId: "unit-01",
    serialOrImei: "354890123456789",
    movementType: "CustomerBuyback",
    quantity: 1,
    unitCost: 3850.00,
    totalCost: 3850.00,
    balanceAfterQuantity: 3,
    documentReference: "RECOMPRA-BALCAO-1092",
    reason: "Aparelho recebido na troca por iPhone 15",
    createdAtUtc: "2026-11-14T02:00:00.000Z",
    createdByUserId: "user-tecnico"
  },
  {
    id: "mov-02",
    branchId: "branch-matriz",
    warehouseId: "wh-02",
    warehouseName: "Bancada Manutenção",
    locationCode: "TEC-B1",
    productSkuId: "sku-02",
    skuCode: "TEL-S21-OLED",
    movementType: "TransferIn",
    quantity: 2,
    unitCost: 320.00,
    totalCost: 640.00,
    balanceAfterQuantity: 8,
    documentReference: "TRANSF-TRF-001",
    reason: "Recebimento do Depósito Central",
    createdAtUtc: "2026-11-14T01:30:00.000Z",
    createdByUserId: "user-almoxarife"
  },
  {
    id: "mov-03",
    branchId: "branch-matriz",
    warehouseId: "wh-03",
    warehouseName: "Almoxarifado Manufatura 3D",
    locationCode: "3D-R01",
    productSkuId: "sku-03",
    skuCode: "PLA-BLACK-1KG",
    movementType: "InitialBalance",
    quantity: 16.0,
    unitCost: 65.00,
    totalCost: 1040.00,
    balanceAfterQuantity: 16.0,
    documentReference: "NF-FORN-9982",
    reason: "Carga de fornecedor Creality",
    createdAtUtc: "2026-11-14T01:00:00.000Z",
    createdByUserId: "user-estoquista"
  }
];

export default function InventoryDashboardPage() {
  const [activeTab, setActiveTab] = useState<"balances" | "kardex" | "receipt" | "reservations" | "transfers" | "counts">("balances");
  const [canViewCost, setCanViewCost] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [balances, setBalances] = useState<StockBalance[]>(mockBalances);
  const [kardex, setKardex] = useState<StockMovement[]>(mockKardex);

  // Formulário Entrada Inicial
  const [receiptForm, setReceiptForm] = useState({
    skuCode: "",
    quantity: "1",
    unitCost: "100.00",
    documentReference: "",
    warehouseName: "Loja Principal Matriz",
    serialNumber: "",
    imei1: "",
    reason: ""
  });
  const [receiptSuccess, setReceiptSuccess] = useState<string | null>(null);

  const handleCreateReceipt = (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseFloat(receiptForm.quantity);
    const cost = parseFloat(receiptForm.unitCost);

    const newMov: StockMovement = {
      id: "mov-" + Date.now(),
      branchId: "branch-matriz",
      warehouseId: "wh-01",
      warehouseName: receiptForm.warehouseName,
      productSkuId: "sku-custom",
      skuCode: receiptForm.skuCode.toUpperCase(),
      serialOrImei: receiptForm.imei1 || receiptForm.serialNumber || undefined,
      movementType: "InitialBalance",
      quantity: qty,
      unitCost: cost,
      totalCost: qty * cost,
      balanceAfterQuantity: qty,
      documentReference: receiptForm.documentReference,
      reason: receiptForm.reason,
      createdAtUtc: "2026-11-14T02:10:00.000Z",
      createdByUserId: "user-admin"
    };

    setKardex([newMov, ...kardex]);

    const newBal: StockBalance = {
      id: "bal-" + Date.now(),
      branchId: "branch-matriz",
      warehouseId: "wh-01",
      warehouseName: receiptForm.warehouseName,
      productSkuId: "sku-custom",
      skuCode: receiptForm.skuCode.toUpperCase(),
      skuVariantName: "Item cadastrado no Kardex",
      onHandQuantity: qty,
      reservedQuantity: 0,
      blockedQuantity: 0,
      availableQuantity: qty,
      averageCost: cost,
      totalValuedAmount: qty * cost,
      lastMovementAtUtc: "2026-11-14T02:10:00.000Z",
      version: 1
    };

    setBalances([newBal, ...balances]);
    setReceiptSuccess(`Entrada de ${qty}x ${receiptForm.skuCode} registrada com sucesso no Kardex.`);
    setReceiptForm({
      skuCode: "",
      quantity: "1",
      unitCost: "100.00",
      documentReference: "",
      warehouseName: "Loja Principal Matriz",
      serialNumber: "",
      imei1: "",
      reason: ""
    });
  };

  const totalOnHand = balances.reduce((acc, b) => acc + b.onHandQuantity, 0);
  const totalReserved = balances.reduce((acc, b) => acc + b.reservedQuantity, 0);
  const totalAvailable = balances.reduce((acc, b) => acc + b.availableQuantity, 0);
  const totalValued = balances.reduce((acc, b) => acc + (b.totalValuedAmount || 0), 0);

  const filteredBalances = balances.filter(b => 
    b.skuCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.skuVariantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.warehouseName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <RootShellLayout>
      <div className="space-y-6">
        {/* Cabeçalho */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-xl">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-lg border border-blue-500/20">
                <Warehouse className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  Estoque & Kardex Imutável
                </h1>
                <p className="text-sm text-slate-400">
                  Almoxarifados, rastreabilidade física de seriais (IMEI), reservas atômicas e inventário
                </p>
              </div>
            </div>
          </div>

          {/* Ações */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCanViewCost(!canViewCost)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors shadow-xs"
            >
              {canViewCost ? <Eye className="w-3.5 h-3.5 text-purple-600" /> : <EyeOff className="w-3.5 h-3.5 text-slate-400" />}
              <span>{canViewCost ? "Custos Visíveis" : "Custos Ocultos"}</span>
            </button>
            <button
              onClick={() => setActiveTab("receipt")}
              className="flex items-center gap-1.5 bg-gradient-to-r from-violet-600 to-purple-700 hover:from-violet-700 hover:to-purple-800 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-md shadow-purple-600/20"
            >
              <Plus className="w-4 h-4" />
              <span>Recebimento / Kardex</span>
            </button>
          </div>
        </div>

        {/* KPIs Operacionais */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
            <span className="text-xs font-medium text-slate-400">Total Físico (On Hand)</span>
            <div className="text-2xl font-bold text-white mt-1">
              {totalOnHand.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} un
            </div>
            <span className="text-xs text-slate-500 mt-1 block">Estoque em todos os armazéns</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
            <span className="text-xs font-medium text-amber-400">Alocado em Reservas</span>
            <div className="text-2xl font-bold text-amber-300 mt-1">
              {totalReserved.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} un
            </div>
            <span className="text-xs text-slate-500 mt-1 block">Comprometido com pedidos/OS</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
            <span className="text-xs font-medium text-emerald-400">Disponível para Venda</span>
            <div className="text-2xl font-bold text-emerald-300 mt-1">
              {totalAvailable.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} un
            </div>
            <span className="text-xs text-slate-500 mt-1 block">Livre para faturamento imediato</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
            <span className="text-xs font-medium text-blue-400">Estoque Valorizado</span>
            <div className="text-2xl font-bold text-blue-300 mt-1">
              {canViewCost 
                ? totalValued.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) 
                : "••••••"}
            </div>
            <span className="text-xs text-slate-500 mt-1 block">
              {canViewCost ? "Custo médio ponderado" : "Restrito por política de segurança"}
            </span>
          </div>
        </div>

        {/* Navegação de Abas */}
        <div className="flex border-b border-slate-800 gap-2">
          <button
            onClick={() => setActiveTab("balances")}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "balances"
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-slate-400 hover:text-slate-300"
            }`}
          >
            <Boxes className="w-4 h-4" />
            <span>Saldos por Armazém</span>
          </button>

          <button
            onClick={() => setActiveTab("kardex")}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "kardex"
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-slate-400 hover:text-slate-300"
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Kardex Imutável ({kardex.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("receipt")}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "receipt"
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-slate-400 hover:text-slate-300"
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>Entrada / Carga Inicial</span>
          </button>

          <button
            onClick={() => setActiveTab("reservations")}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "reservations"
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-slate-400 hover:text-slate-300"
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Motor de Reservas</span>
          </button>

          <button
            onClick={() => setActiveTab("transfers")}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "transfers"
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-slate-400 hover:text-slate-300"
            }`}
          >
            <ArrowLeftRight className="w-4 h-4" />
            <span>Transferências</span>
          </button>

          <button
            onClick={() => setActiveTab("counts")}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "counts"
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-slate-400 hover:text-slate-300"
            }`}
          >
            <CheckSquare className="w-4 h-4" />
            <span>Inventário Físico</span>
          </button>
        </div>

        {/* Tab 1: Saldos */}
        {activeTab === "balances" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Filtrar por SKU, armazém ou descrição..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-800/50 text-slate-400 font-medium text-xs uppercase tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="px-5 py-3">Armazém / Localização</th>
                    <th className="px-5 py-3">Código SKU / Descrição</th>
                    <th className="px-5 py-3 text-right">Físico (On Hand)</th>
                    <th className="px-5 py-3 text-right">Reservado</th>
                    <th className="px-5 py-3 text-right">Disponível</th>
                    <th className="px-5 py-3 text-right">Custo Médio</th>
                    <th className="px-5 py-3 text-right">Valor Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredBalances.map(bal => (
                    <tr key={bal.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="font-medium text-white">{bal.warehouseName}</div>
                        <div className="text-xs text-slate-500">{bal.locationCode || "Local Geral"}</div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="font-mono text-xs font-semibold text-blue-400">{bal.skuCode}</div>
                        <div className="text-xs text-slate-400">{bal.skuVariantName}</div>
                      </td>
                      <td className="px-5 py-3.5 text-right font-medium text-white">
                        {bal.onHandQuantity} un
                      </td>
                      <td className="px-5 py-3.5 text-right text-amber-400">
                        {bal.reservedQuantity > 0 ? `${bal.reservedQuantity} un` : "—"}
                      </td>
                      <td className="px-5 py-3.5 text-right font-semibold text-emerald-400">
                        {bal.availableQuantity} un
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono text-xs text-slate-300">
                        {canViewCost && bal.averageCost ? bal.averageCost.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "••••••"}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono text-xs font-semibold text-slate-200">
                        {canViewCost && bal.totalValuedAmount ? bal.totalValuedAmount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "••••••"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Kardex */}
        {activeTab === "kardex" && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="p-4 bg-slate-800/30 border-b border-slate-800 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-slate-400">
                Razão Geral de Movimentos de Estoque (Append-Only Ledger)
              </span>
              <span className="text-xs text-slate-500">
                Imutável • Sem exclusões ou modificações retroativas
              </span>
            </div>
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-800/50 text-slate-400 font-medium text-xs uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-5 py-3">Data / Hora (UTC)</th>
                  <th className="px-5 py-3">Armazém</th>
                  <th className="px-5 py-3">SKU / Serial</th>
                  <th className="px-5 py-3">Tipo / Documento</th>
                  <th className="px-5 py-3 text-right">Qtd</th>
                  <th className="px-5 py-3 text-right">Custo Un</th>
                  <th className="px-5 py-3 text-right">Saldo Pós</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {kardex.map(mov => (
                  <tr key={mov.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-5 py-3 text-xs text-slate-400 font-mono">
                      {new Date(mov.createdAtUtc).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-5 py-3 text-xs text-white">
                      {mov.warehouseName}
                    </td>
                    <td className="px-5 py-3">
                      <div className="font-mono text-xs font-semibold text-blue-400">{mov.skuCode}</div>
                      {mov.serialOrImei && (
                        <div className="text-xs text-amber-400 font-mono">IMEI: {mov.serialOrImei}</div>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${
                        mov.quantity > 0 ? "bg-emerald-500/10 text-emerald-300" : "bg-red-500/10 text-red-300"
                      }`}>
                        {mov.movementType}
                      </span>
                      <div className="text-xs text-slate-500 mt-0.5">{mov.documentReference}</div>
                    </td>
                    <td className={`px-5 py-3 text-right font-semibold ${
                      mov.quantity > 0 ? "text-emerald-400" : "text-red-400"
                    }`}>
                      {mov.quantity > 0 ? `+${mov.quantity}` : mov.quantity} un
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-xs text-slate-400">
                      {canViewCost && mov.unitCost ? mov.unitCost.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "••••••"}
                    </td>
                    <td className="px-5 py-3 text-right font-bold text-white">
                      {mov.balanceAfterQuantity} un
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 3: Entrada / Carga Inicial */}
        {activeTab === "receipt" && (
          <div className="max-w-2xl bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-white">Carga Inicial de Estoque & Kardex</h2>
              <p className="text-xs text-slate-400">
                Registra a entrada oficial no armazém gerando simultaneamente a linha no Kardex e atualizando a projeção de saldo.
              </p>
            </div>

            {receiptSuccess && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm rounded-lg flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{receiptSuccess}</span>
              </div>
            )}

            <form onSubmit={handleCreateReceipt} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Código SKU *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: IPH14PM-128-PURPLE"
                    value={receiptForm.skuCode}
                    onChange={e => setReceiptForm({ ...receiptForm, skuCode: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Armazém Destino *</label>
                  <select
                    value={receiptForm.warehouseName}
                    onChange={e => setReceiptForm({ ...receiptForm, warehouseName: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="Loja Principal Matriz">Loja Principal Matriz</option>
                    <option value="Bancada Manutenção">Bancada Manutenção</option>
                    <option value="Almoxarifado Manufatura 3D">Almoxarifado Manufatura 3D</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Quantidade *</label>
                  <input
                    type="number"
                    step="0.0001"
                    min="0.0001"
                    required
                    value={receiptForm.quantity}
                    onChange={e => setReceiptForm({ ...receiptForm, quantity: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Custo Unitário (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={receiptForm.unitCost}
                    onChange={e => setReceiptForm({ ...receiptForm, unitCost: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Documento de Origem *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: NF-10492 ou BALCAO-RECOMPRA-99"
                  value={receiptForm.documentReference}
                  onChange={e => setReceiptForm({ ...receiptForm, documentReference: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">IMEI 1 (Opcional p/ Celular)</label>
                  <input
                    type="text"
                    maxLength={15}
                    placeholder="Ex: 354890123456789"
                    value={receiptForm.imei1}
                    onChange={e => setReceiptForm({ ...receiptForm, imei1: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Número de Série (Opcional)</label>
                  <input
                    type="text"
                    placeholder="Ex: SN-A19028348"
                    value={receiptForm.serialNumber}
                    onChange={e => setReceiptForm({ ...receiptForm, serialNumber: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Justificativa / Motivo</label>
                <textarea
                  rows={2}
                  placeholder="Motivo do lançamento no razão..."
                  value={receiptForm.reason}
                  onChange={e => setReceiptForm({ ...receiptForm, reason: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-lg text-sm font-semibold transition-colors shadow-lg shadow-blue-600/20"
              >
                Gravar Entrada no Kardex & Atualizar Saldo
              </button>
            </form>
          </div>
        )}

        {/* Tab 4: Reservas */}
        {activeTab === "reservations" && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Motor de Reservas Atômicas</h2>
                <p className="text-xs text-slate-400">
                  Garante que o saldo disponível seja bloqueado imediatamente, impedindo venda duplicada de smartphones ou peças.
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-800/40 border border-slate-700/50 rounded-lg space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
                <CheckCircle2 className="w-4 h-4" />
                <span>Proteção contra Over-Selling Ativa</span>
              </div>
              <p className="text-xs text-slate-400">
                Qualquer requisição de reserva é executada em transação ACID com bloqueio pessimista ou controle otimista via token <code className="text-blue-400 font-mono">xmin</code> do PostgreSQL, validando <code className="text-emerald-400 font-mono">AvailableQuantity = OnHand - Reserved - Blocked</code>.
              </p>
            </div>
          </div>
        )}

        {/* Tab 5: Transferências */}
        {activeTab === "transfers" && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Transferências de Mercadorias</h2>
              <p className="text-xs text-slate-400">
                Máquina de estados segura: Rascunho → Submetido → Em Trânsito (Baixa Origem) → Recebido (Entrada Destino).
              </p>
            </div>
          </div>
        )}

        {/* Tab 6: Inventário Físico */}
        {activeTab === "counts" && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Inventário Físico & Reconciliação</h2>
              <p className="text-xs text-slate-400">
                Contagem periódica por armazém com cálculo de divergências e postagem transacional de ajustes positivos e negativos no Kardex.
              </p>
            </div>
          </div>
        )}
      </div>
    </RootShellLayout>
  );
}
