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

  // Exemplo estruturado dos registros reais homologados
  const [orders] = useState<PurchaseOrder[]>([
    {
      id: "po-1",
      branchId: "b1",
      supplierPartyId: "s1",
      supplierName: "Distribuidora Tech Brasil LTDA",
      orderNumber: "PO-2026-0891",
      status: "PartiallyReceived",
      expectedDeliveryDateUtc: "2026-11-20T14:00:00Z",
      paymentTerms: "28/56 Dias Boleto",
      shippingCost: 85.00,
      otherExpenses: 0.00,
      totalDiscount: 50.00,
      itemsSubtotal: 8900.00,
      totalOrderAmount: 8935.00,
      notes: "Prioridade para bancada de reparos e estoque matriz",
      items: [
        {
          id: "poi-1",
          productSkuId: "sku-1",
          historicalSkuCode: "IPH15P-128-NAT",
          historicalDescription: "iPhone 15 Pro - 128GB Titânio Natural",
          quantityOrdered: 5,
          quantityReceived: 2,
          quantityPending: 3,
          unitCost: 1700.00,
          discount: 10.00,
          totalAmount: 8490.00
        },
        {
          id: "poi-2",
          productSkuId: "sku-2",
          historicalSkuCode: "PLA-BLACK-1KG",
          historicalDescription: "Filamento PLA Creality - 1kg Preto",
          quantityOrdered: 10,
          quantityReceived: 10,
          quantityPending: 0,
          unitCost: 41.00,
          discount: 0.00,
          totalAmount: 410.00
        }
      ],
      createdAtUtc: "2026-11-14T02:00:00Z",
      version: 2
    },
    {
      id: "po-2",
      branchId: "b1",
      supplierPartyId: "s2",
      supplierName: "Importadora EletroParts Global",
      orderNumber: "PO-2026-0892",
      status: "Approved",
      expectedDeliveryDateUtc: "2026-11-25T10:00:00Z",
      paymentTerms: "À Vista PIX Antecipado",
      shippingCost: 120.00,
      itemsSubtotal: 4500.00,
      totalOrderAmount: 4620.00,
      items: [
        {
          id: "poi-3",
          productSkuId: "sku-3",
          historicalSkuCode: "DISP-IP13-OLED",
          historicalDescription: "Display OLED iPhone 13 Original Nacional",
          quantityOrdered: 15,
          quantityReceived: 0,
          quantityPending: 15,
          unitCost: 300.00,
          discount: 0.00,
          totalAmount: 4500.00
        }
      ],
      createdAtUtc: "2026-11-14T03:15:00Z",
      version: 1
    }
  ]);

  const [receipts] = useState<GoodsReceipt[]>([
    {
      id: "gr-1",
      branchId: "b1",
      warehouseId: "w1",
      warehouseName: "Depósito Principal Matriz",
      purchaseOrderId: "po-1",
      orderNumber: "PO-2026-0891",
      supplierPartyId: "s1",
      supplierName: "Distribuidora Tech Brasil LTDA",
      receiptNumber: "REC-2026-0412",
      invoiceOrDocumentNumber: "NF-e 001.449.123",
      status: "ApprovedAndPosted",
      idempotencyKey: "IDEMP-NFE-001449123-HB",
      notes: "Conferido por leitor de código de barras e checklist de lacres",
      items: [
        {
          id: "gri-1",
          productSkuId: "sku-1",
          skuCode: "IPH15P-128-NAT",
          skuName: "iPhone 15 Pro Titânio Natural",
          quantityReceived: 2,
          realUnitCost: 1700.00,
          totalCost: 3400.00,
          serialOrImei: "358911029482910"
        },
        {
          id: "gri-2",
          productSkuId: "sku-2",
          skuCode: "PLA-BLACK-1KG",
          skuName: "Filamento PLA 1kg Preto",
          quantityReceived: 10,
          realUnitCost: 41.00,
          totalCost: 410.00
        }
      ],
      createdAtUtc: "2026-11-14T04:20:00Z",
      version: 1
    }
  ]);

  const [usedDevices] = useState<UsedDeviceAcquisition[]>([
    {
      id: "acq-1",
      branchId: "b1",
      sellerPartyId: "c1",
      sellerName: "Carlos Eduardo Mendes (PF)",
      productSkuId: "sku-used-1",
      skuCode: "IPH14P-128-PURPLE-PREOWNED",
      skuName: "iPhone 14 Pro 128GB Roxo Profundo (Usado)",
      inventoryUnitId: "unit-102",
      acquisitionNumber: "ACQ-BALCAO-0091",
      serialNumber: "DNPX9821L09",
      imei1: "356789012345678",
      imei2: "356789012345679",
      condition: "PreOwned",
      grade: "GradeA",
      batteryHealthPercentage: 88,
      negotiatedPrice: 3400.00,
      attributableExpenses: 120.00,
      totalAcquisitionCost: 3520.00,
      checklistInspectionJson: "{\"tela\":\"Original\",\"faceId\":\"OK\",\"bateria\":88,\"cameras\":\"OK\",\"carcaca\":\"Sem marcas\"}",
      status: "ReceivedInStock",
      notes: "Compra de balcão com termo assinado e nota de origem",
      createdAtUtc: "2026-11-14T05:00:00Z",
      version: 1
    }
  ]);

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

        {/* Banner de Conformidade Arquitetural */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-4 text-emerald-800">
          <ShieldCheck className="w-6 h-6 text-emerald-600 shrink-0" />
          <div className="text-xs">
            <span className="font-bold">Integração Transacional Real (MOD-03):</span> O recebimento de mercadorias e a compra de usados não criam tabelas paralelas de saldo. Todo lançamento alimenta diretamente o <strong>Kardex oficial append-only (StockMovements)</strong> e atualiza o saldo materializado (StockBalances) com fail-closed estrito.
          </div>
        </div>

        {/* Métricas Rápidas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
              <span>Pedidos em Aberto</span>
              <ShoppingCart className="w-4 h-4 text-blue-500" />
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900">2</div>
            <div className="text-xs text-blue-600 mt-1 font-medium">1 aguardando entrega parcial</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
              <span>Recebimentos no Mês</span>
              <PackageCheck className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900">1</div>
            <div className="text-xs text-emerald-600 mt-1 font-medium">100% postados no Kardex</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
              <span>Recompras de Balcão</span>
              <Smartphone className="w-4 h-4 text-purple-500" />
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900">1</div>
            <div className="text-xs text-purple-600 mt-1 font-medium">Laudo e IMEI validados</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
              <span>Valor Comprometido</span>
              <DollarSign className="w-4 h-4 text-amber-500" />
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900">
              {canViewCost ? "R$ 13.555,00" : "••••••"}
            </div>
            <div className="text-xs text-slate-500 mt-1 font-medium">Pedidos aprovados pendentes</div>
          </div>
        </div>

        {/* Navegação por Abas */}
        <div className="flex items-center gap-2 border-b border-slate-200">
          <button
            onClick={() => setActiveTab("orders")}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition flex items-center gap-2 ${
              activeTab === "orders"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            Pedidos de Compra
          </button>

          <button
            onClick={() => setActiveTab("receipts")}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition flex items-center gap-2 ${
              activeTab === "receipts"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            <PackageCheck className="w-4 h-4" />
            Conferência & Recebimentos
          </button>

          <button
            onClick={() => setActiveTab("used_devices")}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition flex items-center gap-2 ${
              activeTab === "used_devices"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            <Smartphone className="w-4 h-4" />
            Aquisição de Usados (Balcão)
          </button>

          <button
            onClick={() => setActiveTab("quotations")}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition flex items-center gap-2 ${
              activeTab === "quotations"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            Cotações
          </button>

          <button
            onClick={() => setActiveTab("requests")}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition flex items-center gap-2 ${
              activeTab === "requests"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            <FileText className="w-4 h-4" />
            Requisições Internas
          </button>

          <button
            onClick={() => setActiveTab("returns")}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition flex items-center gap-2 ${
              activeTab === "returns"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            <RotateCcw className="w-4 h-4" />
            Devoluções a Fornecedores
          </button>
        </div>

        {/* Conteúdo da Aba Ativa */}
        {activeTab === "orders" && (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between gap-4">
              <div className="relative w-full max-w-xs">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por número ou fornecedor..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

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
                        <button className="text-indigo-600 hover:text-indigo-800 text-xs font-semibold">
                          Detalhes & Receber
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "receipts" && (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 font-semibold text-slate-800 text-sm">
              Conferências de Recebimento Físico com Entrada Oficial no Kardex
            </div>

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
                        <div className="text-xs text-indigo-600 font-mono">{gr.invoiceOrDocumentNumber}</div>
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
          </div>
        )}

        {activeTab === "used_devices" && (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 font-semibold text-slate-800 text-sm">
              Aparelhos Usados Adquiridos no Balcão com Laudo Técnico de Inspeção
            </div>

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
          </div>
        )}
      </div>
    </RootShellLayout>
  );
}
