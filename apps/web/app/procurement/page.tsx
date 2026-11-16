"use client";

import React, { useState } from "react";
import RootShellLayout from "@/components/RootShellLayout";
import {
  ShoppingCart,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Eye,
  EyeOff,
  Plus,
  Search,
  Truck,
  RotateCcw,
  Smartphone,
  PackageCheck,
  DollarSign,
  AlertTriangle,
  Building2,
  FileText
} from "lucide-react";

export type PurchaseRequestStatus = "Draft" | "Submitted" | "Approved" | "Rejected" | "ConvertedToOrder" | "Cancelled";
export type QuotationStatus = "Open" | "Accepted" | "Rejected" | "Expired";
export type PurchaseOrderStatus = "Draft" | "Submitted" | "Approved" | "Ordered" | "PartiallyReceived" | "Received" | "Closed" | "Cancelled";
export type GoodsReceiptStatus = "ReceivedInInspection" | "ApprovedAndPosted" | "Rejected";
export type UsedDeviceStatus = "Evaluating" | "Approved" | "ReceivedInStock" | "Rejected";
export type SupplierReturnStatus = "Requested" | "DispatchedAndPosted" | "Cancelled";

export interface PurchaseOrderItem {
  id: string;
  productSkuId: string;
  historicalSkuCode: string;
  historicalDescription: string;
  quantityOrdered: number;
  quantityReceived: number;
  quantityPending: number;
  unitCost?: number;
  discount?: number;
  totalAmount?: number;
}

export interface PurchaseOrder {
  id: string;
  branchId: string;
  supplierPartyId: string;
  supplierName?: string;
  orderNumber: string;
  status: PurchaseOrderStatus;
  expectedDeliveryDateUtc?: string;
  paymentTerms?: string;
  shippingCost?: number;
  otherExpenses?: number;
  totalDiscount?: number;
  itemsSubtotal?: number;
  totalOrderAmount?: number;
  notes?: string;
  items: PurchaseOrderItem[];
  createdAtUtc: string;
  version: number;
}

export interface GoodsReceiptItem {
  id: string;
  productSkuId: string;
  skuCode?: string;
  skuName?: string;
  quantityReceived: number;
  realUnitCost?: number;
  totalCost?: number;
  inventoryUnitId?: string;
  serialOrImei?: string;
  notes?: string;
}

export interface GoodsReceipt {
  id: string;
  branchId: string;
  warehouseId: string;
  warehouseName?: string;
  purchaseOrderId?: string;
  orderNumber?: string;
  supplierPartyId: string;
  supplierName?: string;
  receiptNumber: string;
  invoiceOrDocumentNumber: string;
  status: GoodsReceiptStatus;
  idempotencyKey?: string;
  notes?: string;
  items: GoodsReceiptItem[];
  createdAtUtc: string;
  version: number;
}

export interface UsedDeviceAcquisition {
  id: string;
  branchId: string;
  sellerPartyId: string;
  sellerName?: string;
  productSkuId: string;
  skuCode?: string;
  skuName?: string;
  inventoryUnitId?: string;
  acquisitionNumber: string;
  serialNumber: string;
  imei1?: string;
  imei2?: string;
  condition: string;
  grade: string;
  batteryHealthPercentage?: number;
  negotiatedPrice?: number;
  attributableExpenses?: number;
  totalAcquisitionCost?: number;
  checklistInspectionJson: string;
  status: UsedDeviceStatus;
  notes?: string;
  createdAtUtc: string;
  version: number;
}

export default function ProcurementPage() {
  const [activeTab, setActiveTab] = useState<"orders" | "receipts" | "used_devices" | "quotations" | "requests" | "returns">("orders");
  const [searchTerm, setSearchTerm] = useState("");
  const [canViewCost, setCanViewCost] = useState(true);

  // Exemplo estruturado dos registros reais homologados - Inicializado zerado (sem mock)
  const [orders] = useState<PurchaseOrder[]>([]);
  const [receipts] = useState<GoodsReceipt[]>([]);
  const [usedDevices] = useState<UsedDeviceAcquisition[]>([]);

  return (
    <RootShellLayout>
      <div className="space-y-6">
        {/* Header e KPIs de Procurement */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-5">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <ShoppingCart className="w-7 h-7 text-indigo-600" />
              Procurement & Compras de Usados
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Gestão de requisições, cotações, pedidos de compra, recebimento físico com Kardex oficial e aquisição de usados no balcão.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setCanViewCost(!canViewCost)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                canViewCost
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : "bg-slate-100 text-slate-600 border-slate-300"
              }`}
              title="Alternar visibilidade de custos (purchases.cost.view)"
            >
              {canViewCost ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              {canViewCost ? "Custos Visíveis" : "Custos Ocultos"}
            </button>

            <button className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-sm transition">
              <Plus className="w-4 h-4" />
              Novo Pedido / Aquisição
            </button>
          </div>
        </div>

        {/* Métricas Rápidas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-600 to-purple-600"></div>
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
              <span>Pedidos em Aberto</span>
              <ShoppingCart className="w-4 h-4 text-purple-600" />
            </div>
            <div className="mt-2 text-2xl font-extrabold text-slate-900">{orders.length}</div>
            <div className="text-xs text-slate-500 mt-1 font-medium">Aguardando entrega ou cotação</div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-600"></div>
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
              <span>Recebimentos no Mês</span>
              <PackageCheck className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="mt-2 text-2xl font-extrabold text-slate-900">{receipts.length}</div>
            <div className="text-xs text-emerald-600 mt-1 font-medium">100% postados no Kardex</div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 to-pink-600"></div>
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
              <span>Recompras de Balcão</span>
              <Smartphone className="w-4 h-4 text-purple-600" />
            </div>
            <div className="mt-2 text-2xl font-extrabold text-slate-900">{usedDevices.length}</div>
            <div className="text-xs text-purple-600 mt-1 font-medium">Laudo e IMEI validados</div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-orange-600"></div>
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
              <span>Valor Comprometido</span>
              <DollarSign className="w-4 h-4 text-amber-600" />
            </div>
            <div className="mt-2 text-2xl font-extrabold text-slate-900">
              {canViewCost ? "R$ 0,00" : "••••••"}
            </div>
            <div className="text-xs text-slate-500 mt-1 font-medium">Sem pedidos pendentes</div>
          </div>
        </div>

        {/* Navegação por Abas */}
        <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-6 rounded-t-2xl pt-2 shadow-xs">
          <button
            onClick={() => setActiveTab("orders")}
            className={`py-3 px-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === "orders"
                ? "border-purple-600 text-purple-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            Pedidos de Compra ({orders.length})
          </button>

          <button
            onClick={() => setActiveTab("receipts")}
            className={`py-3 px-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === "receipts"
                ? "border-purple-600 text-purple-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <PackageCheck className="w-4 h-4" />
            Conferência & Recebimentos ({receipts.length})
          </button>

          <button
            onClick={() => setActiveTab("used_devices")}
            className={`py-3 px-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === "used_devices"
                ? "border-purple-600 text-purple-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Smartphone className="w-4 h-4" />
            Aquisição de Usados ({usedDevices.length})
          </button>
        </div>

        {/* Conteúdo da Aba Ativa */}
        {activeTab === "orders" && (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between gap-4 bg-slate-50/50">
              <div className="relative w-full max-w-xs">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por número ou fornecedor..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            {orders.length === 0 ? (
              <div className="p-16 text-center">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600 mb-3 border border-purple-100">
                  <ShoppingCart className="w-7 h-7" />
                </div>
                <h4 className="text-sm font-bold text-slate-800">Nenhum Pedido de Compra Ativo</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                  Abra requisições de compras para reposição de peças, carcaças ou lotes de aparelhos seminovos.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Pedido / Data</th>
                      <th className="py-3 px-4">Fornecedor</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Previsão Entrega</th>
                      <th className="py-3 px-4">Condição</th>
                      <th className="py-3 px-4">Total</th>
                      <th className="py-3 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {orders.map((po) => (
                      <tr key={po.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">{po.orderNumber}</div>
                          <div className="text-xs text-slate-400">
                            {new Date(po.createdAtUtc).toLocaleDateString("pt-BR")}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-800">
                          {po.supplierName}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                            po.status === "Received" ? "bg-emerald-100 text-emerald-800" :
                            po.status === "PartiallyReceived" ? "bg-amber-100 text-amber-800" :
                            po.status === "Approved" ? "bg-blue-100 text-blue-800" :
                            "bg-slate-100 text-slate-700"
                          }`}>
                            {po.status === "PartiallyReceived" ? "Parcialmente Recebido" :
                             po.status === "Approved" ? "Aprovado" : po.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600">
                          {po.expectedDeliveryDateUtc ? new Date(po.expectedDeliveryDateUtc).toLocaleDateString("pt-BR") : "A combinar"}
                        </td>
                        <td className="py-3 px-4 text-xs font-medium text-slate-700">
                          {po.paymentTerms ?? "Padrão"}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          {canViewCost && po.totalOrderAmount !== undefined
                            ? `R$ ${po.totalOrderAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                            : "••••••"}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button className="text-purple-600 hover:text-purple-800 text-xs font-semibold">
                            Detalhes & Receber
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === "receipts" && (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 font-bold text-slate-800 text-sm bg-slate-50/50">
              Conferências de Recebimento Físico com Entrada Oficial no Kardex
            </div>

            {receipts.length === 0 ? (
              <div className="p-16 text-center">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600 mb-3 border border-purple-100">
                  <PackageCheck className="w-7 h-7" />
                </div>
                <h4 className="text-sm font-bold text-slate-800">Nenhum Recebimento Físico Pendente</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                  Notas fiscais de entrada e conferências cegas bipadas serão exibidas aqui para lançamento no Kardex.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Nº Recebimento / NF</th>
                      <th className="py-3 px-4">Fornecedor</th>
                      <th className="py-3 px-4">Depósito Destino</th>
                      <th className="py-3 px-4">Pedido Vinculado</th>
                      <th className="py-3 px-4">Status Conferência</th>
                      <th className="py-3 px-4">Qtd Itens</th>
                      <th className="py-3 px-4">Custo Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {receipts.map((gr) => (
                      <tr key={gr.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">{gr.receiptNumber}</div>
                          <div className="text-xs text-purple-600 font-mono">{gr.invoiceOrDocumentNumber}</div>
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-800">
                          {gr.supplierName}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-700 font-medium">
                          {gr.warehouseName}
                        </td>
                        <td className="py-3 px-4 text-xs font-mono text-slate-600">
                          {gr.orderNumber ?? "Avulso"}
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                            Postado no Kardex
                          </span>
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-800">
                          {gr.items.reduce((acc, i) => acc + i.quantityReceived, 0)} un
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          {canViewCost
                            ? `R$ ${gr.items.reduce((acc, i) => acc + (i.totalCost ?? 0), 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                            : "••••••"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === "used_devices" && (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 font-bold text-slate-800 text-sm bg-slate-50/50">
              Aparelhos Usados Adquiridos no Balcão com Laudo Técnico de Inspeção
            </div>

            {usedDevices.length === 0 ? (
              <div className="p-16 text-center">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600 mb-3 border border-purple-100">
                  <Smartphone className="w-7 h-7" />
                </div>
                <h4 className="text-sm font-bold text-slate-800">Nenhum Aparelho Usado Registrado</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                  Faça compras no balcão com checklist de 25 pontos, validação de IMEI na Anatel e cálculo de margem.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Nº Aquisição</th>
                      <th className="py-3 px-4">Vendedor (Pessoa)</th>
                      <th className="py-3 px-4">Modelo / Sku</th>
                      <th className="py-3 px-4">Serial / IMEI</th>
                      <th className="py-3 px-4">Grau / Bateria</th>
                      <th className="py-3 px-4">Custo Aquisição Real</th>
                      <th className="py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {usedDevices.map((ud) => (
                      <tr key={ud.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-4 font-semibold text-slate-900 font-mono">
                          {ud.acquisitionNumber}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-800">
                          {ud.sellerName}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">{ud.skuCode}</div>
                          <div className="text-xs text-slate-500">{ud.skuName}</div>
                        </td>
                        <td className="py-3 px-4 text-xs font-mono text-slate-700">
                          <div>SN: {ud.serialNumber}</div>
                          {ud.imei1 && <div className="text-slate-500">IMEI: {ud.imei1}</div>}
                        </td>
                        <td className="py-3 px-4 text-xs">
                          <span className="font-semibold text-slate-800">{ud.grade}</span> • Saúde {ud.batteryHealthPercentage}%
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          {canViewCost && ud.totalAcquisitionCost !== undefined
                            ? `R$ ${ud.totalAcquisitionCost.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                            : "••••••"}
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">
                            {ud.status === "ReceivedInStock" ? "Recebido no Estoque" : ud.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </RootShellLayout>
  );
}
