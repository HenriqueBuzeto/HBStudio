"use client";

import React, { useState, useEffect } from "react";
import RootShellLayout from "@/components/RootShellLayout";
import {
  ShoppingCart,
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
  FileText,
  RefreshCw,
  X,
  Layers
} from "lucide-react";

export type PurchaseOrderStatus = "Draft" | "Submitted" | "Approved" | "Ordered" | "PartiallyReceived" | "Received" | "Closed" | "Cancelled";
export type GoodsReceiptStatus = "ReceivedInInspection" | "ApprovedAndPosted" | "Rejected";
export type UsedDeviceStatus = "Evaluating" | "Approved" | "ReceivedInStock" | "Rejected";

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

export interface SupplierOption {
  id: string;
  name: string;
  document: string;
}

export interface WarehouseOption {
  id: string;
  name: string;
  code: string;
}

export interface SkuOption {
  id: string;
  skuCode: string;
  name: string;
  modelName: string;
}

export default function ProcurementPage() {
  const [activeTab, setActiveTab] = useState<"orders" | "receipts" | "used_devices">("orders");
  const [searchTerm, setSearchTerm] = useState("");
  const [canViewCost, setCanViewCost] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Dados reais
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [receipts, setReceipts] = useState<GoodsReceipt[]>([]);
  const [usedDevices, setUsedDevices] = useState<UsedDeviceAcquisition[]>([]);

  // Opções auxiliares
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [skus, setSkus] = useState<SkuOption[]>([]);

  // Modais
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [isUsedModalOpen, setIsUsedModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State: Pedido de Compra
  const [orderForm, setOrderForm] = useState({
    supplierPartyId: "",
    expectedDeliveryDate: "",
    paymentTerms: "30 Dias",
    notes: "",
    productSkuId: "",
    quantityOrdered: 1,
    unitCost: 0
  });

  // Form State: Aquisição de Usado
  const [usedForm, setUsedForm] = useState({
    sellerPartyId: "",
    productSkuId: "",
    serialNumber: "",
    imei1: "",
    imei2: "",
    condition: "UsedGood",
    grade: "GradeA",
    batteryHealthPercentage: 88,
    negotiatedPrice: 0,
    attributableExpenses: 0,
    notes: ""
  });

  const loadData = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [ordRes, recRes, usedRes, partiesRes, whRes, modRes] = await Promise.allSettled([
        fetch("/api/procurement/orders"),
        fetch("/api/procurement/receipts"),
        fetch("/api/procurement/used-devices"),
        fetch("/api/parties"),
        fetch("/api/inventory/warehouses"),
        fetch("/api/catalog/models")
      ]);

      if (ordRes.status === "fulfilled" && ordRes.value.ok) {
        const data = await ordRes.value.json();
        setOrders(Array.isArray(data) ? data : []);
      }
      if (recRes.status === "fulfilled" && recRes.value.ok) {
        const data = await recRes.value.json();
        setReceipts(Array.isArray(data) ? data : []);
      }
      if (usedRes.status === "fulfilled" && usedRes.value.ok) {
        const data = await usedRes.value.json();
        setUsedDevices(Array.isArray(data) ? data : []);
      }

      // Auxiliares
      if (partiesRes.status === "fulfilled" && partiesRes.value.ok) {
        const partiesData = await partiesRes.value.json();
        if (Array.isArray(partiesData)) {
          setSuppliers(partiesData.map((p: any) => ({
            id: p.id,
            name: p.legalName || p.tradeName,
            document: p.taxId || ""
          })));
        }
      }

      if (whRes.status === "fulfilled" && whRes.value.ok) {
        const whData = await whRes.value.json();
        if (Array.isArray(whData)) {
          setWarehouses(whData.map((w: any) => ({
            id: w.id,
            name: w.name,
            code: w.code
          })));
        }
      }

      if (modRes.status === "fulfilled" && modRes.value.ok) {
        const modData = await modRes.value.json();
        if (Array.isArray(modData)) {
          const skuList: SkuOption[] = [];
          modData.forEach((m: any) => {
            if (Array.isArray(m.skus)) {
              m.skus.forEach((s: any) => {
                skuList.push({
                  id: s.id,
                  skuCode: s.skuCode,
                  name: s.name,
                  modelName: m.name
                });
              });
            }
          });
          setSkus(skuList);
        }
      }
    } catch (err: any) {
      setErrorMessage("Erro ao conectar com serviços de Compras e Estoque.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Handlers de Pedido de Compra
  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderForm.supplierPartyId || !orderForm.productSkuId || orderForm.quantityOrdered <= 0) {
      alert("Selecione fornecedor, SKU e quantidade válida.");
      return;
    }

    setIsSubmitting(true);
    try {
      const selectedSku = skus.find((s) => s.id === orderForm.productSkuId);
      const payload = {
        branchId: "b0000000-0000-0000-0000-000000000001",
        supplierPartyId: orderForm.supplierPartyId,
        expectedDeliveryDateUtc: orderForm.expectedDeliveryDate ? new Date(orderForm.expectedDeliveryDate).toISOString() : null,
        paymentTerms: orderForm.paymentTerms,
        notes: orderForm.notes || undefined,
        items: [
          {
            productSkuId: orderForm.productSkuId,
            historicalSkuCode: selectedSku?.skuCode || "SKU",
            historicalDescription: `${selectedSku?.modelName} - ${selectedSku?.name}`,
            quantityOrdered: Number(orderForm.quantityOrdered),
            unitCost: canViewCost ? Number(orderForm.unitCost) : 0,
            discount: 0
          }
        ]
      };

      const res = await fetch("/api/procurement/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || err.title || "Falha ao emitir Pedido de Compra");
      }

      setIsOrderModalOpen(false);
      setOrderForm({
        supplierPartyId: "",
        expectedDeliveryDate: "",
        paymentTerms: "30 Dias",
        notes: "",
        productSkuId: "",
        quantityOrdered: 1,
        unitCost: 0
      });
      await loadData();
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handlers de Aquisição de Usado
  const handleCreateUsedDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usedForm.sellerPartyId || !usedForm.productSkuId || !usedForm.serialNumber) {
      alert("Informe o cliente/vendedor, SKU e número de série/IMEI.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        branchId: "b0000000-0000-0000-0000-000000000001",
        sellerPartyId: usedForm.sellerPartyId,
        productSkuId: usedForm.productSkuId,
        serialNumber: usedForm.serialNumber,
        imei1: usedForm.imei1 || undefined,
        imei2: usedForm.imei2 || undefined,
        condition: usedForm.condition,
        grade: usedForm.grade,
        batteryHealthPercentage: Number(usedForm.batteryHealthPercentage),
        negotiatedPrice: canViewCost ? Number(usedForm.negotiatedPrice) : 0,
        attributableExpenses: canViewCost ? Number(usedForm.attributableExpenses) : 0,
        checklistInspectionJson: JSON.stringify({
          screenCondition: "Original",
          faceIdWorking: true,
          camerasWorking: true,
          biometrics: true,
          waterDamage: false
        }),
        notes: usedForm.notes || undefined
      };

      const res = await fetch("/api/procurement/used-devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || err.title || "Falha ao registrar aquisição de usado");
      }

      setIsUsedModalOpen(false);
      setUsedForm({
        sellerPartyId: "",
        productSkuId: "",
        serialNumber: "",
        imei1: "",
        imei2: "",
        condition: "UsedGood",
        grade: "GradeA",
        batteryHealthPercentage: 88,
        negotiatedPrice: 0,
        attributableExpenses: 0,
        notes: ""
      });
      await loadData();
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApproveReceiveUsed = async (device: UsedDeviceAcquisition) => {
    const defaultWh = warehouses[0]?.id;
    if (!defaultWh) {
      alert("Nenhum depósito cadastrado para receber o aparelho.");
      return;
    }

    if (!confirm(`Confirmar recebimento físico no estoque e lançamento no Kardex para o aparelho SN: ${device.serialNumber}?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/procurement/used-devices/${device.id}/approve-receive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetWarehouseId: defaultWh,
          storageLocationCode: "BALCAO-ENTRADA"
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || err.title || "Erro ao aprovar e receber no estoque");
      }

      alert("Aparelho aprovado e integrado ao Kardex oficial!");
      await loadData();
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    }
  };

  // Filtros
  const filteredOrders = orders.filter((o) =>
    (o.orderNumber || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (o.supplierName || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredReceipts = receipts.filter((r) =>
    (r.receiptNumber || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.invoiceOrDocumentNumber || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.supplierName || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredUsed = usedDevices.filter((u) =>
    (u.acquisitionNumber || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.serialNumber || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.imei1 || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.sellerName || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalCommitted = orders.reduce((sum, o) => sum + (o.totalOrderAmount || 0), 0);

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
              Gestão de pedidos de compra, recebimento físico com Kardex oficial e aquisição de usados no balcão integrados ao PostgreSQL.
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

            <button
              onClick={loadData}
              disabled={isLoading}
              className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 transition"
              title="Recarregar dados reais"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              Atualizar
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsOrderModalOpen(true)}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-xs transition"
              >
                <Plus className="w-4 h-4" />
                Novo Pedido
              </button>

              <button
                onClick={() => setIsUsedModalOpen(true)}
                className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-xs transition"
              >
                <Smartphone className="w-4 h-4" />
                Comprar Usado
              </button>
            </div>
          </div>
        </div>

        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-medium flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Métricas Rápidas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-600 to-purple-600"></div>
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
              <span>Pedidos em Aberto</span>
              <ShoppingCart className="w-4 h-4 text-purple-600" />
            </div>
            <div className="mt-2 text-2xl font-extrabold text-slate-900">{orders.length}</div>
            <div className="text-xs text-slate-500 mt-1 font-medium">Pedidos registrados no ERP</div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-600"></div>
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
              <span>Recebimentos Físicos</span>
              <PackageCheck className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="mt-2 text-2xl font-extrabold text-slate-900">{receipts.length}</div>
            <div className="text-xs text-emerald-600 mt-1 font-medium">Lançamentos no Kardex</div>
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
              <span>Valor Total Pedidos</span>
              <DollarSign className="w-4 h-4 text-amber-600" />
            </div>
            <div className="mt-2 text-2xl font-extrabold text-slate-900">
              {canViewCost
                ? `R$ ${totalCommitted.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                : "••••••"}
            </div>
            <div className="text-xs text-slate-500 mt-1 font-medium">Montante sob compras</div>
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

            {filteredOrders.length === 0 ? (
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
                    {filteredOrders.map((po) => (
                      <tr key={po.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">{po.orderNumber}</div>
                          <div className="text-xs text-slate-400">
                            {new Date(po.createdAtUtc).toLocaleDateString("pt-BR")}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-800">
                          {po.supplierName || "Fornecedor Cadastrado"}
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
                          <span className="text-xs text-slate-400">Registrado no ERP</span>
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

            {filteredReceipts.length === 0 ? (
              <div className="p-16 text-center">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600 mb-3 border border-purple-100">
                  <PackageCheck className="w-7 h-7" />
                </div>
                <h4 className="text-sm font-bold text-slate-800">Nenhum Recebimento Físico Registrado</h4>
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
                    {filteredReceipts.map((gr) => (
                      <tr key={gr.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">{gr.receiptNumber}</div>
                          <div className="text-xs text-purple-600 font-mono">{gr.invoiceOrDocumentNumber}</div>
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-800">
                          {gr.supplierName || "Fornecedor"}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-700 font-medium">
                          {gr.warehouseName || "Depósito Central"}
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
                          {gr.items ? gr.items.reduce((acc, i) => acc + i.quantityReceived, 0) : 0} un
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          {canViewCost && gr.items
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

            {filteredUsed.length === 0 ? (
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
                      <th className="py-3 px-4 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredUsed.map((ud) => (
                      <tr key={ud.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-4 font-semibold text-slate-900 font-mono">
                          {ud.acquisitionNumber}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-800">
                          {ud.sellerName || "Cliente Vendedor"}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">{ud.skuCode || "SKU Usado"}</div>
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
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                            ud.status === "ReceivedInStock"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-purple-100 text-purple-800"
                          }`}>
                            {ud.status === "ReceivedInStock" ? "Recebido no Estoque" : ud.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {ud.status !== "ReceivedInStock" && (
                            <button
                              onClick={() => handleApproveReceiveUsed(ud)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-semibold transition"
                            >
                              Entrar no Estoque
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Modal: Novo Pedido de Compra */}
        {isOrderModalOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg border border-slate-200 overflow-hidden">
              <div className="flex items-center justify-between p-5 border-b border-slate-200">
                <h3 className="font-bold text-slate-900 flex items-center gap-2 text-sm">
                  <ShoppingCart className="w-4 h-4 text-indigo-600" />
                  Emitir Novo Pedido de Compra Oficial
                </h3>
                <button onClick={() => setIsOrderModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateOrder} className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Fornecedor *</label>
                  <select
                    value={orderForm.supplierPartyId}
                    onChange={(e) => setOrderForm({ ...orderForm, supplierPartyId: e.target.value })}
                    required
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Selecione o Fornecedor...</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} {s.document ? `(${s.document})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Produto / SKU *</label>
                  <select
                    value={orderForm.productSkuId}
                    onChange={(e) => setOrderForm({ ...orderForm, productSkuId: e.target.value })}
                    required
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Selecione o SKU do Catálogo...</option>
                    {skus.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.skuCode} - {s.modelName} ({s.name})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Quantidade *</label>
                    <input
                      type="number"
                      min="1"
                      value={orderForm.quantityOrdered}
                      onChange={(e) => setOrderForm({ ...orderForm, quantityOrdered: parseInt(e.target.value) || 1 })}
                      required
                      className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Custo Unitário (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={orderForm.unitCost}
                      onChange={(e) => setOrderForm({ ...orderForm, unitCost: parseFloat(e.target.value) || 0 })}
                      disabled={!canViewCost}
                      className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Condição de Pagamento</label>
                    <input
                      type="text"
                      value={orderForm.paymentTerms}
                      onChange={(e) => setOrderForm({ ...orderForm, paymentTerms: e.target.value })}
                      className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Previsão de Entrega</label>
                    <input
                      type="date"
                      value={orderForm.expectedDeliveryDate}
                      onChange={(e) => setOrderForm({ ...orderForm, expectedDeliveryDate: e.target.value })}
                      className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Observações Internas</label>
                  <textarea
                    rows={2}
                    value={orderForm.notes}
                    onChange={(e) => setOrderForm({ ...orderForm, notes: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setIsOrderModalOpen(false)}
                    className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition flex items-center gap-2"
                  >
                    {isSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    Criar Pedido de Compra
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Comprar Usado no Balcão */}
        {isUsedModalOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg border border-slate-200 overflow-hidden">
              <div className="flex items-center justify-between p-5 border-b border-slate-200">
                <h3 className="font-bold text-slate-900 flex items-center gap-2 text-sm">
                  <Smartphone className="w-4 h-4 text-purple-600" />
                  Aquisição de Aparelho Usado no Balcão
                </h3>
                <button onClick={() => setIsUsedModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateUsedDevice} className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Vendedor / Cliente Cadastrado *</label>
                  <select
                    value={usedForm.sellerPartyId}
                    onChange={(e) => setUsedForm({ ...usedForm, sellerPartyId: e.target.value })}
                    required
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Selecione o Cliente / Pessoa...</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} {s.document ? `(${s.document})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Modelo / SKU Correspondente *</label>
                  <select
                    value={usedForm.productSkuId}
                    onChange={(e) => setUsedForm({ ...usedForm, productSkuId: e.target.value })}
                    required
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Selecione o Modelo do Aparelho...</option>
                    {skus.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.skuCode} - {s.modelName} ({s.name})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Número de Série *</label>
                    <input
                      type="text"
                      value={usedForm.serialNumber}
                      onChange={(e) => setUsedForm({ ...usedForm, serialNumber: e.target.value.toUpperCase() })}
                      required
                      placeholder="Ex: F17XYZ8999"
                      className="w-full text-xs font-mono border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">IMEI 1</label>
                    <input
                      type="text"
                      value={usedForm.imei1}
                      onChange={(e) => setUsedForm({ ...usedForm, imei1: e.target.value })}
                      placeholder="15 dígitos"
                      maxLength={15}
                      className="w-full text-xs font-mono border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Condição</label>
                    <select
                      value={usedForm.condition}
                      onChange={(e) => setUsedForm({ ...usedForm, condition: e.target.value })}
                      className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="UsedLikeNew">Como Novo</option>
                      <option value="UsedGood">Muito Bom</option>
                      <option value="UsedFair">Bom / Sinais de Uso</option>
                      <option value="Defective">Com Defeito / Peças</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Grau Estético</label>
                    <select
                      value={usedForm.grade}
                      onChange={(e) => setUsedForm({ ...usedForm, grade: e.target.value })}
                      className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="GradeA">Grau A (Excelente)</option>
                      <option value="GradeB">Grau B (Marcas Leves)</option>
                      <option value="GradeC">Grau C (Marcas Visíveis)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Saúde Bateria (%)</label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={usedForm.batteryHealthPercentage}
                      onChange={(e) => setUsedForm({ ...usedForm, batteryHealthPercentage: parseInt(e.target.value) || 80 })}
                      className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Preço Negociado (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={usedForm.negotiatedPrice}
                      onChange={(e) => setUsedForm({ ...usedForm, negotiatedPrice: parseFloat(e.target.value) || 0 })}
                      disabled={!canViewCost}
                      className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 disabled:bg-slate-100"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Despesas Atribuíveis (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={usedForm.attributableExpenses}
                      onChange={(e) => setUsedForm({ ...usedForm, attributableExpenses: parseFloat(e.target.value) || 0 })}
                      disabled={!canViewCost}
                      className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 disabled:bg-slate-100"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setIsUsedModalOpen(false)}
                    className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold transition flex items-center gap-2"
                  >
                    {isSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    Registrar Aquisição
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
