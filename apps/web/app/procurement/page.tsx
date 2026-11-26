"use client";

import React, { useState, useEffect } from "react";
import RootShellLayout from "@/components/RootShellLayout";
import CatalogIntakeForm from "@/components/CatalogIntakeForm";
import PurchasePlanningWorkspace from "./PurchasePlanningWorkspace";
import {useAuth} from "@/lib/auth";
import {formatCpfCnpj} from "@/lib/br-format";
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
  Layers,
  Gamepad2,
  Cpu,
  Laptop,
  Tv,
  HardDrive,
  Headphones,
  CheckSquare,
  Square
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
  defaultPrice?: number;
}

export type ElectronicCategory = "smartphone" | "computador_gamer" | "videogame" | "notebook" | "outro";

export default function ProcurementPage() {
  const {hasPermission,user}=useAuth();const [intakeOpen,setIntakeOpen]=useState(false);
  const [activeTab, setActiveTab] = useState<"orders" | "receipts" | "used_devices" | "suggestions">("orders");
  const [searchTerm, setSearchTerm] = useState("");
  const [showCost, setShowCost] = useState(true);
  const canViewCost=showCost&&hasPermission("purchases.cost.view");
  const [ordersReady,setOrdersReady]=useState(false);
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

  // Categoria de eletrônico selecionada para compra de usados
  const [selectedCategory, setSelectedCategory] = useState<ElectronicCategory>("smartphone");

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

  // Form State: Aquisição de Usados & Eletrônicos Multicategorias
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
    notes: "",
    // Especificações e checklist modular para PCs, Consoles e Notebooks
    specs: {
      cpuProcessor: "",
      gpuVideoCard: "",
      ramMemory: "16GB",
      storageDrive: "SSD 512GB NVMe",
      powerSupply: "650W 80 Plus",
      consoleStorage: "1TB",
      controllersCount: 1,
      includedAccessories: "Cabo de força, cabo HDMI",
    },
    checklist: {
      powerOnTest: true,
      displayOutput: true,
      usbPortsWorking: true,
      thermalStressTest: true,
      caseConditionClean: true,
      accessoriesComplete: true,
      controllerResponsive: true,
      anatelClean: true,
    }
  });

  const loadData = async () => {
    setIsLoading(true);
    setOrdersReady(false);
    setErrorMessage(null);

    try {
      const [ordRes, recRes, usedRes, auxRes] = await Promise.allSettled([
        fetch("/api/procurement/orders"),
        fetch("/api/procurement/receipts"),
        fetch("/api/procurement/used-devices"),
        fetch("/api/procurement/auxiliary"),
      ]);

      if (ordRes.status === "fulfilled" && ordRes.value.ok) {
        const data = await ordRes.value.json();
        if(!Array.isArray(data))throw Error("Resposta de pedidos inválida.");
        setOrders(data);setOrdersReady(true);
      }else{setOrders([]);setErrorMessage("Não foi possível confirmar os pedidos oficiais. Atualize a consulta.");}
      if (recRes.status === "fulfilled" && recRes.value.ok) {
        const data = await recRes.value.json();
        setReceipts(Array.isArray(data) ? data : []);
      }
      if (usedRes.status === "fulfilled" && usedRes.value.ok) {
        const data = await usedRes.value.json();
        setUsedDevices(Array.isArray(data) ? data : []);
      }

      // Auxiliares do Neon Serverless
      if (auxRes.status === "fulfilled" && auxRes.value.ok) {
        const aux = await auxRes.value.json();
        if (aux.parties) setSuppliers(aux.parties);
        if (aux.skus) setSkus(aux.skus);
        if (aux.warehouses) setWarehouses(aux.warehouses);
      }
    } catch (err: any) {
      setErrorMessage("Erro ao conectar com serviços de Compras e Estoque.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if(activeTab==="orders")void loadData();
  }, [activeTab]);

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
      if(!user?.branchId||!hasPermission("purchases.create")||!hasPermission("purchases.cost.view"))throw Error("Filial ou permissão de compra não confirmada.");
      const payload = {
        branchId: user.branchId,
        supplierPartyId: orderForm.supplierPartyId,
        shippingCost:0,otherExpenses:0,totalDiscount:0,
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
        throw new Error(err.detail || err.title || "Falha ao registrar pedido de compra");
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

  // Handlers de Aquisição de Usados & Eletrônicos
  const handleCreateUsedDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usedForm.sellerPartyId || !usedForm.productSkuId || !usedForm.serialNumber) {
      alert("Por favor preencha os campos obrigatórios (Vendedor, SKU e Número de Série).");
      return;
    }

    setIsSubmitting(true);
    try {
      // Montar checklist e especificações detalhadas de acordo com a categoria
      const checklistPayload = {
        category: selectedCategory,
        specs: usedForm.specs,
        checklist: usedForm.checklist,
      };

      const payload = {
        branchId: "00000000-0000-0000-0000-000000000001",
        sellerPartyId: usedForm.sellerPartyId,
        productSkuId: usedForm.productSkuId,
        deviceCategory: selectedCategory,
        serialNumber: usedForm.serialNumber,
        imei1: selectedCategory === "smartphone" ? (usedForm.imei1 || undefined) : undefined,
        imei2: selectedCategory === "smartphone" ? (usedForm.imei2 || undefined) : undefined,
        condition: usedForm.condition,
        grade: usedForm.grade,
        batteryHealthPercentage: (selectedCategory === "smartphone" || selectedCategory === "notebook")
          ? Number(usedForm.batteryHealthPercentage)
          : null,
        negotiatedPrice: canViewCost ? Number(usedForm.negotiatedPrice) : 0,
        attributableExpenses: canViewCost ? Number(usedForm.attributableExpenses) : 0,
        checklist: checklistPayload,
        notes: usedForm.notes ? `${usedForm.notes} | Categoria: ${selectedCategory.toUpperCase()}` : `Categoria: ${selectedCategory.toUpperCase()}`
      };

      const res = await fetch("/api/procurement/used-devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || err.detail || err.title || "Falha ao registrar aquisição");
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
        notes: "",
        specs: {
          cpuProcessor: "",
          gpuVideoCard: "",
          ramMemory: "16GB",
          storageDrive: "SSD 512GB NVMe",
          powerSupply: "650W 80 Plus",
          consoleStorage: "1TB",
          controllersCount: 1,
          includedAccessories: "Cabo de força, cabo HDMI",
        },
        checklist: {
          powerOnTest: true,
          displayOutput: true,
          usbPortsWorking: true,
          thermalStressTest: true,
          caseConditionClean: true,
          accessoriesComplete: true,
          controllerResponsive: true,
          anatelClean: true,
        }
      });
      await loadData();
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApproveReceiveUsed = async (device: UsedDeviceAcquisition) => {
    if (!confirm(`Confirmar recebimento físico no estoque e liberação de entrada para o equipamento SN: ${device.serialNumber}?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/procurement/used-devices/${device.id}/approve-receive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || err.detail || err.title || "Erro ao aprovar e receber no estoque");
      }

      alert("Equipamento aprovado e integrado ao estoque!");
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
    (u.sellerName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.skuName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.notes || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalCommitted = orders.reduce((sum, o) => sum + (o.totalOrderAmount || 0), 0);

  // Helper para ícone da categoria do eletrônico
  const getCategoryIcon = (notes?: string, imei?: string) => {
    const text = (notes || "").toLowerCase();
    if (text.includes("videogame") || text.includes("console") || text.includes("playstation") || text.includes("xbox")) {
      return <Gamepad2 className="w-4 h-4 text-indigo-600" />;
    }
    if (text.includes("computador") || text.includes("pc gamer") || text.includes("setup")) {
      return <Cpu className="w-4 h-4 text-purple-600" />;
    }
    if (text.includes("notebook") || text.includes("laptop")) {
      return <Laptop className="w-4 h-4 text-sky-600" />;
    }
    if (imei) {
      return <Smartphone className="w-4 h-4 text-emerald-600" />;
    }
    return <Layers className="w-4 h-4 text-slate-600" />;
  };

  return (
    <RootShellLayout>
      <div className="space-y-6">
        {/* Header e KPIs de Procurement */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <ShoppingCart className="w-7 h-7 text-indigo-600" />
              Procurement & Entrada de Usados
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Entrada de mercadorias, pedidos de reposição e compra de eletrônicos usados (PCs Gamers, Consoles, Smartphones e Notebooks) no balcão.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {hasPermission("catalog.products.manage")&&<button type="button" onClick={()=>setIntakeOpen(true)} className="rounded-xl border px-3 py-2 text-xs font-bold text-purple-700">+ Cadastrar produto</button>}
            <button
              onClick={() => setShowCost(!showCost)}
              disabled={!hasPermission("purchases.cost.view")}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer ${canViewCost
                ? "bg-amber-50 text-amber-700 border-amber-200"
                : "bg-slate-100 text-slate-600 border-slate-300"
                }`}
              title="Alternar visibilidade de custos"
            >
              {canViewCost ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              {canViewCost ? "Custos Visíveis" : "Custos Ocultos"}
            </button>

            <button
              onClick={loadData}
              disabled={isLoading}
              className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-xl text-xs font-semibold border border-slate-300 transition cursor-pointer"
              title="Recarregar dados reais"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              Atualizar
            </button>

            <button
              onClick={() => setIsOrderModalOpen(true)}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Novo Pedido
            </button>

            <button
              onClick={() => setIsUsedModalOpen(true)}
              className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md shadow-purple-600/20 transition cursor-pointer"
            >
              <Gamepad2 className="w-4 h-4" />
              Entrada de Usado / Eletrônico
            </button>
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
            <div className="mt-2 text-2xl font-extrabold text-slate-900">{ordersReady&&!isLoading?orders.filter(o=>["Draft","Submitted","Approved","Ordered","PartiallyReceived"].includes(o.status)).length:"—"}</div>
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
              <span>Eletrônicos & Usados no Balcão</span>
              <Gamepad2 className="w-4 h-4 text-purple-600" />
            </div>
            <div className="mt-2 text-2xl font-extrabold text-slate-900">{usedDevices.length}</div>
            <div className="text-xs text-purple-600 mt-1 font-medium">PCs, Consoles e Aparelhos</div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-orange-600"></div>
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
              <span>Valor Total Pedidos</span>
              <DollarSign className="w-4 h-4 text-amber-600" />
            </div>
            <div className="mt-2 text-2xl font-extrabold text-slate-900">
              {!ordersReady||isLoading?"—":canViewCost
                ? `R$ ${totalCommitted.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                : "••••••"}
            </div>
            <div className="text-xs text-slate-500 mt-1 font-medium">Montante sob compras</div>
          </div>
        </div>

        {/* Navegação por Abas */}
        <div className="flex flex-wrap items-center gap-1 rounded-2xl border border-slate-200 bg-white p-2 shadow-xs">
          <button
            onClick={() => setActiveTab("orders")}
            className={`py-3 px-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${activeTab === "orders"
              ? "border-purple-600 text-purple-700"
              : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
          >
            <ShoppingCart className="w-4 h-4" />
            Pedidos de Compra ({ordersReady&&!isLoading?orders.length:"—"})
          </button>

          <button
            onClick={() => setActiveTab("receipts")}
            className={`py-3 px-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${activeTab === "receipts"
              ? "border-purple-600 text-purple-700"
              : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
          >
            <PackageCheck className="w-4 h-4" />
            Conferência & Recebimentos ({receipts.length})
          </button>

          <button
            onClick={() => setActiveTab("used_devices")}
            className={`py-3 px-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${activeTab === "used_devices"
              ? "border-purple-600 text-purple-700"
              : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
          >
            <Gamepad2 className="w-4 h-4" />
            Aquisição de Usados & Eletrônicos ({usedDevices.length})
          </button>
          {["purchases.view","inventory.view","finance.reports.view"].every(hasPermission)&&<button type="button" aria-pressed={activeTab==="suggestions"} onClick={()=>setActiveTab("suggestions")} className={"rounded-lg px-3 py-3 text-xs font-bold "+(activeTab==="suggestions"?"bg-violet-700 text-white":"text-slate-600 hover:bg-violet-50")}>Sugestão de Compras</button>}
        </div>

        {/* Conteúdo da Aba Ativa */}
        {activeTab === "suggestions" && <PurchasePlanningWorkspace showCosts={canViewCost}/>}
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

            {!ordersReady||isLoading?<div className="p-12 text-center text-sm text-slate-500">{isLoading?"Consultando pedidos oficiais...":"Pedidos indisponíveis. Atualize a consulta."}</div>:filteredOrders.length === 0 ? (
              <div className="p-16 text-center">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600 mb-3 border border-purple-100">
                  <ShoppingCart className="w-7 h-7" />
                </div>
                <h4 className="text-sm font-bold text-slate-800">Nenhum Pedido de Compra Ativo</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                  Abra requisições de compras para reposição de peças, hardware, consoles ou lotes de seminovos.
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
                          {po.supplierName || "Fornecedor"}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${po.status === "Received" ? "bg-emerald-100 text-emerald-800" :
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
            <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
              <div>
                <span className="font-bold text-slate-800 text-sm">
                  Produtos e Eletrônicos Usados Adquiridos no Balcão
                </span>
                <p className="text-xs text-slate-500 mt-0.5">
                  Computadores Gamers, Videogames, Celulares e Notebooks com laudo de teste e número de série rastreável.
                </p>
              </div>

              <div className="relative w-full md:w-72">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filtrar por serial, modelo, cliente..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                />
              </div>
            </div>

            {filteredUsed.length === 0 ? (
              <div className="p-16 text-center">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600 mb-3 border border-purple-100">
                  <Gamepad2 className="w-7 h-7" />
                </div>
                <h4 className="text-sm font-bold text-slate-800">Nenhum Eletrônico Usado Registrado</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                  Cadastre aquisições de PCs Gamers, PS5, Xbox, celulares e notebooks com laudo técnico e valor de recompra.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Nº Aquisição</th>
                      <th className="py-3 px-4">Vendedor / Origem</th>
                      <th className="py-3 px-4">Eletrônico / Modelo</th>
                      <th className="py-3 px-4">Serial / Identificação</th>
                      <th className="py-3 px-4">Grau / Condição</th>
                      <th className="py-3 px-4">Custo de Aquisição</th>
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
                          <div className="flex items-center gap-2">
                            {getCategoryIcon(ud.notes, ud.imei1)}
                            <div>
                              <div className="font-semibold text-slate-900">{ud.skuName || ud.skuCode}</div>
                              <div className="text-[11px] text-slate-400 font-mono">{ud.skuCode}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-xs font-mono text-slate-700">
                          <div className="font-bold text-slate-800">SN: {ud.serialNumber}</div>
                          {ud.imei1 && <div className="text-slate-500">IMEI: {ud.imei1}</div>}
                          {ud.notes && <div className="text-[10px] text-purple-600 truncate max-w-xs">{ud.notes}</div>}
                        </td>
                        <td className="py-3 px-4 text-xs">
                          <span className="font-semibold text-slate-800">{ud.grade}</span>
                          {ud.batteryHealthPercentage ? (
                            <span className="text-slate-500"> • Saúde {ud.batteryHealthPercentage}%</span>
                          ) : (
                            <span className="text-slate-500"> • Testado</span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          {canViewCost && ud.totalAcquisitionCost !== undefined
                            ? `R$ ${ud.totalAcquisitionCost.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                            : "••••••"}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${ud.status === "ReceivedInStock"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-purple-100 text-purple-800"
                            }`}>
                            {ud.status === "ReceivedInStock" ? "No Estoque" : "Em Avaliação"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {ud.status !== "ReceivedInStock" && (
                            <button
                              onClick={() => handleApproveReceiveUsed(ud)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-semibold transition cursor-pointer"
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

        {intakeOpen&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3"><section role="dialog" aria-modal="true" aria-label="Cadastro de produto" className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"><h2 className="mb-4 text-lg font-bold">Cadastro de produto</h2><CatalogIntakeForm onClose={()=>setIntakeOpen(false)} onDone={async()=>{await loadData();setIntakeOpen(false);}}/></section></div>}
        {/* Modal: Novo Pedido de Compra */}
        {isOrderModalOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg border border-slate-200 overflow-hidden">
              <div className="flex items-center justify-between p-5 border-b border-slate-200">
                <h3 className="font-bold text-slate-900 flex items-center gap-2 text-sm">
                  <ShoppingCart className="w-4 h-4 text-indigo-600" />
                  Emitir Novo Pedido de Compra Oficial
                </h3>
                <button onClick={() => setIsOrderModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateOrder} className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Fornecedor / Fabricante *</label>
                  <select
                    value={orderForm.supplierPartyId}
                    onChange={(e) => setOrderForm({ ...orderForm, supplierPartyId: e.target.value })}
                    required
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Selecione o Fornecedor...</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} {s.document ? `(${formatCpfCnpj(s.document)})` : ""}
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
                    <option value="">Selecione o Produto...</option>
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
                    className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition flex items-center gap-2 cursor-pointer"
                  >
                    {isSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    Criar Pedido de Compra
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Comprar Usado no Balcão - Versão Multicategorias (PCs Gamers, Consoles, etc.) */}
        {isUsedModalOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between p-5 border-b border-slate-200 shrink-0">
                <div>
                  <h3 className="font-bold text-slate-900 flex items-center gap-2 text-sm">
                    <Gamepad2 className="w-4 h-4 text-purple-600" />
                    Aquisição de Usado & Eletrônico no Balcão
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Entrada de computadores gamers, consoles de videogame, smartphones e notebooks seminovos.
                  </p>
                </div>
                <button onClick={() => setIsUsedModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Seletor de Categoria do Eletrônico */}
              <div className="px-5 pt-4 pb-2 border-b border-slate-100 bg-slate-50/70 shrink-0">
                <label className="block text-[11px] font-bold uppercase text-slate-500 tracking-wider mb-2">
                  Qual categoria de eletrônico está entrando?
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedCategory("computador_gamer")}
                    className={`p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition cursor-pointer ${selectedCategory === "computador_gamer"
                      ? "bg-purple-600 text-white border-purple-600 shadow-sm"
                      : "bg-white text-slate-700 border-slate-200 hover:border-purple-300"
                      }`}
                  >
                    <Cpu className="w-4 h-4 shrink-0" />
                    <div className="text-xs font-bold leading-tight">PC Gamer / Desktop</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedCategory("videogame")}
                    className={`p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition cursor-pointer ${selectedCategory === "videogame"
                      ? "bg-purple-600 text-white border-purple-600 shadow-sm"
                      : "bg-white text-slate-700 border-slate-200 hover:border-purple-300"
                      }`}
                  >
                    <Gamepad2 className="w-4 h-4 shrink-0" />
                    <div className="text-xs font-bold leading-tight">Videogame / Console</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedCategory("smartphone")}
                    className={`p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition cursor-pointer ${selectedCategory === "smartphone"
                      ? "bg-purple-600 text-white border-purple-600 shadow-sm"
                      : "bg-white text-slate-700 border-slate-200 hover:border-purple-300"
                      }`}
                  >
                    <Smartphone className="w-4 h-4 shrink-0" />
                    <div className="text-xs font-bold leading-tight">Smartphone / Celular</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedCategory("notebook")}
                    className={`p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition cursor-pointer ${selectedCategory === "notebook"
                      ? "bg-purple-600 text-white border-purple-600 shadow-sm"
                      : "bg-white text-slate-700 border-slate-200 hover:border-purple-300"
                      }`}
                  >
                    <Laptop className="w-4 h-4 shrink-0" />
                    <div className="text-xs font-bold leading-tight">Notebook / Laptop</div>
                  </button>
                </div>
              </div>

              <form onSubmit={handleCreateUsedDevice} className="p-5 space-y-4 overflow-y-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                          {s.name} {s.document ? `(${formatCpfCnpj(s.document)})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Modelo / SKU no Catálogo *</label>
                    <select
                      value={usedForm.productSkuId}
                      onChange={(e) => setUsedForm({ ...usedForm, productSkuId: e.target.value })}
                      required
                      className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">Selecione o Modelo Correspondente...</option>
                      {skus.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.skuCode} - {s.modelName} ({s.name})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Campos Específicos por Categoria */}
                {selectedCategory === "computador_gamer" && (
                  <div className="p-3 bg-purple-50/60 border border-purple-200/80 rounded-xl space-y-3">
                    <div className="text-xs font-extrabold text-purple-900 flex items-center gap-1.5">
                      <Cpu className="w-4 h-4 text-purple-600" />
                      Ficha Técnica do Computador Gamer
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">Processador (CPU)</label>
                        <input
                          type="text"
                          placeholder="Ex: Ryzen 7 5700X / Core i7-13700"
                          value={usedForm.specs.cpuProcessor}
                          onChange={(e) => setUsedForm({ ...usedForm, specs: { ...usedForm.specs, cpuProcessor: e.target.value } })}
                          className="w-full text-xs border border-purple-200 rounded-lg p-1.5 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">Placa de Vídeo (GPU)</label>
                        <input
                          type="text"
                          placeholder="Ex: RTX 4060 8GB / RX 6700XT"
                          value={usedForm.specs.gpuVideoCard}
                          onChange={(e) => setUsedForm({ ...usedForm, specs: { ...usedForm.specs, gpuVideoCard: e.target.value } })}
                          className="w-full text-xs border border-purple-200 rounded-lg p-1.5 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">Memória RAM</label>
                        <input
                          type="text"
                          placeholder="Ex: 32GB (2x16GB) DDR4 3200MHz"
                          value={usedForm.specs.ramMemory}
                          onChange={(e) => setUsedForm({ ...usedForm, specs: { ...usedForm.specs, ramMemory: e.target.value } })}
                          className="w-full text-xs border border-purple-200 rounded-lg p-1.5 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">Armazenamento & Fonte</label>
                        <input
                          type="text"
                          placeholder="Ex: SSD 1TB NVMe + Fonte 650W"
                          value={usedForm.specs.storageDrive}
                          onChange={(e) => setUsedForm({ ...usedForm, specs: { ...usedForm.specs, storageDrive: e.target.value } })}
                          className="w-full text-xs border border-purple-200 rounded-lg p-1.5 bg-white"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {selectedCategory === "videogame" && (
                  <div className="p-3 bg-indigo-50/60 border border-indigo-200/80 rounded-xl space-y-3">
                    <div className="text-xs font-extrabold text-indigo-900 flex items-center gap-1.5">
                      <Gamepad2 className="w-4 h-4 text-indigo-600" />
                      Acessórios e Capacidade do Videogame
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">Capacidade</label>
                        <input
                          type="text"
                          placeholder="Ex: 825GB / 1TB / 500GB"
                          value={usedForm.specs.consoleStorage}
                          onChange={(e) => setUsedForm({ ...usedForm, specs: { ...usedForm.specs, consoleStorage: e.target.value } })}
                          className="w-full text-xs border border-indigo-200 rounded-lg p-1.5 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">Qtd. Controles</label>
                        <input
                          type="number"
                          min="0"
                          max="4"
                          value={usedForm.specs.controllersCount}
                          onChange={(e) => setUsedForm({ ...usedForm, specs: { ...usedForm.specs, controllersCount: parseInt(e.target.value) || 0 } })}
                          className="w-full text-xs border border-indigo-200 rounded-lg p-1.5 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">Cabos / Jogos Extras</label>
                        <input
                          type="text"
                          placeholder="Ex: Cabo HDMI, Cabo Força"
                          value={usedForm.specs.includedAccessories}
                          onChange={(e) => setUsedForm({ ...usedForm, specs: { ...usedForm.specs, includedAccessories: e.target.value } })}
                          className="w-full text-xs border border-indigo-200 rounded-lg p-1.5 bg-white"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {selectedCategory === "computador_gamer"
                        ? "Serial / Tag da Máquina *"
                        : selectedCategory === "videogame"
                          ? "Serial do Console (Sony / MS / Nintendo) *"
                          : "Número de Série / Tag *"}
                    </label>
                    <input
                      type="text"
                      value={usedForm.serialNumber}
                      onChange={(e) => setUsedForm({ ...usedForm, serialNumber: e.target.value.toUpperCase() })}
                      required
                      placeholder={selectedCategory === "computador_gamer" ? "Ex: PCG-2026-99" : "Ex: FC7882910"}
                      className="w-full text-xs font-mono border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {selectedCategory === "smartphone" ? "IMEI 1 (Obrigatório em Celulares)" : "Identificador / Etiqueta Adicional"}
                    </label>
                    <input
                      type="text"
                      value={usedForm.imei1}
                      onChange={(e) => setUsedForm({ ...usedForm, imei1: e.target.value })}
                      placeholder={selectedCategory === "smartphone" ? "15 dígitos do IMEI" : "Opcional"}
                      className="w-full text-xs font-mono border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Condição Física</label>
                    <select
                      value={usedForm.condition}
                      onChange={(e) => setUsedForm({ ...usedForm, condition: e.target.value })}
                      className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="UsedLikeNew">Como Novo (Sem marcas)</option>
                      <option value="UsedGood">Muito Bom (Conservado)</option>
                      <option value="UsedFair">Marcas de Uso / Sinais</option>
                      <option value="Refurbished">Recondicionado / Revisado</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Grau Estético</label>
                    <select
                      value={usedForm.grade}
                      onChange={(e) => setUsedForm({ ...usedForm, grade: e.target.value })}
                      className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="GradeA">Grau A (Excelente / Impecável)</option>
                      <option value="GradeB">Grau B (Marcas Leves)</option>
                      <option value="GradeC">Grau C (Marcas Visíveis)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {selectedCategory === "smartphone" || selectedCategory === "notebook"
                        ? "Saúde da Bateria (%)"
                        : "Teste em Bancada"}
                    </label>
                    {selectedCategory === "smartphone" || selectedCategory === "notebook" ? (
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={usedForm.batteryHealthPercentage}
                        onChange={(e) => setUsedForm({ ...usedForm, batteryHealthPercentage: parseInt(e.target.value) || 85 })}
                        className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500"
                      />
                    ) : (
                      <input
                        type="text"
                        disabled
                        value="100% Funcional"
                        className="w-full text-xs border border-slate-200 bg-slate-50 text-slate-600 rounded-lg p-2 font-semibold"
                      />
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Preço Pago / Recompra (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={usedForm.negotiatedPrice}
                      onChange={(e) => setUsedForm({ ...usedForm, negotiatedPrice: parseFloat(e.target.value) || 0 })}
                      disabled={!canViewCost}
                      className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 disabled:bg-slate-100 font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Despesas / Peças / Limpeza (R$)</label>
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

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Observações do Produto / Laudo</label>
                  <textarea
                    rows={2}
                    value={usedForm.notes}
                    onChange={(e) => setUsedForm({ ...usedForm, notes: e.target.value })}
                    placeholder="Ex: PC Gamer Gabinete Branco com RGB, testado em stress test 30 min sem superaquecimento."
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setIsUsedModalOpen(false)}
                    className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-md shadow-purple-600/20"
                  >
                    {isSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    Cadastrar Entrada no Estoque
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
