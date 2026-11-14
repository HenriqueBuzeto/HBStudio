"use client";

import React, { useState } from "react";
import RootShellLayout from "@/components/RootShellLayout";
import {
  ShoppingCart,
  Receipt,
  FileText,
  CreditCard,
  QrCode,
  Banknote,
  RotateCcw,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  Search,
  Plus,
  Trash2,
  Package,
  Smartphone,
  AlertTriangle,
  User,
  Building2,
  ArrowRight,
  TrendingUp,
  Percent
} from "lucide-react";

export type SaleStatus = "Draft" | "Reserved" | "Confirmed" | "Fulfilled" | "Cancelled";
export type SalePaymentStatus = "NotStarted" | "Pending" | "PartiallyConfirmed" | "Confirmed";
export type SaleFulfillmentStatus = "NotFulfilled" | "Fulfilled" | "PartiallyReturned" | "Returned";
export type PaymentMethod = "Cash" | "Pix" | "CreditCard" | "DebitCard" | "TradeInCredit";
export type PaymentIntentStatus = "Pending" | "Confirmed" | "Declined" | "Cancelled" | "Refunded";

export interface SaleItem {
  id: string;
  productSkuId: string;
  historicalSkuCode: string;
  historicalDescription: string;
  itemCondition: number;
  quantity: number;
  unitPrice: number;
  discount: number;
  totalAmount: number;
  historicalUnitCost?: number;
  totalCost?: number;
  inventoryUnitId?: string;
  serialOrImei?: string;
  warrantyDays: number;
}

export interface SalePaymentIntent {
  id: string;
  method: PaymentMethod;
  amount: number;
  installments: number;
  status: PaymentIntentStatus;
  authorizationCode?: string;
  transactionReference?: string;
  notes?: string;
  confirmedAtUtc?: string;
}

export interface Sale {
  id: string;
  branchId: string;
  saleNumber: string;
  customerPartyId?: string;
  customerName?: string;
  sellerUserId: string;
  createdByUserId: string;
  quoteId?: string;
  stockReservationId?: string;
  status: SaleStatus;
  paymentStatus: SalePaymentStatus;
  fulfillmentStatus: SaleFulfillmentStatus;
  subtotal: number;
  chargesTotal: number;
  discountTotal: number;
  grandTotal: number;
  paidTotal: number;
  balanceRemaining: number;
  totalHistoricalCost?: number;
  estimatedProfitMargin?: number;
  observations?: string;
  idempotencyKey?: string;
  confirmedAtUtc?: string;
  fulfilledAtUtc?: string;
  cancelledAtUtc?: string;
  items: SaleItem[];
  payments: SalePaymentIntent[];
  createdAtUtc: string;
  version: number;
}

export interface SalesQuote {
  id: string;
  branchId: string;
  quoteNumber: string;
  customerPartyId?: string;
  customerName?: string;
  sellerUserId: string;
  status: "Draft" | "Sent" | "Approved" | "Rejected" | "ConvertedToSale" | "Expired";
  validUntilUtc: string;
  paymentTermsExpected?: string;
  shippingTotal: number;
  discountTotal: number;
  notes?: string;
  convertedSaleId?: string;
  subtotal: number;
  grandTotal: number;
  itemsCount: number;
  createdAtUtc: string;
}

export interface SaleReturnItem {
  id: string;
  saleItemId: string;
  productSkuId: string;
  skuCode?: string;
  skuName?: string;
  quantity: number;
  refundAmount: number;
  inventoryUnitId?: string;
}

export interface SaleReturn {
  id: string;
  branchId: string;
  saleId: string;
  returnNumber: string;
  reason: string;
  status: "Requested" | "InspectedAndRestocked" | "Rejected" | "Cancelled";
  inspectionNotes?: string;
  totalRefundAmount: number;
  items: SaleReturnItem[];
  createdAtUtc: string;
}

export default function SalesPage() {
  const [activeTab, setActiveTab] = useState<"pos" | "sales" | "quotes" | "returns">("pos");
  const [showCostPermission, setShowCostPermission] = useState(true);

  // Cart / PDV State
  const [cartItems, setCartItems] = useState<Array<{
    skuId: string;
    code: string;
    name: string;
    condition: "Novo" | "Usado";
    unitPrice: number;
    quantity: number;
    unitCost: number;
    inventoryUnitId?: string;
    serialOrImei?: string;
    batteryHealth?: number;
  }>>([
    {
      skuId: "sku-iph14p",
      code: "IPH14P-128-GOLD",
      name: "iPhone 14 Pro 128GB Dourado (Usado Grade A)",
      condition: "Usado",
      unitPrice: 4200.00,
      quantity: 1,
      unitCost: 2800.00,
      inventoryUnitId: "unit-iph-1",
      serialOrImei: "354891028374651",
      batteryHealth: 92
    },
    {
      skuId: "sku-cab-c",
      code: "CAB-USBC-1M",
      name: "Cabo USB-C Original 1 Metro",
      condition: "Novo",
      unitPrice: 60.00,
      quantity: 2,
      unitCost: 25.00
    }
  ]);

  const [discountTotal, setDiscountTotal] = useState<number>(20.00);
  const [chargesTotal, setChargesTotal] = useState<number>(0.00);
  const [customerName, setCustomerName] = useState<string>("Lucas Rocha de Oliveira");
  const [sellerName, setSellerName] = useState<string>("Carlos Vendedor");

  // Mock Sales List (reflete endpoints reais da API)
  const [salesList] = useState<Sale[]>([
    {
      id: "sale-01",
      branchId: "branch-sp",
      saleNumber: "VD-2026-0089",
      customerPartyId: "cust-01",
      customerName: "Mariana Souza Lima",
      sellerUserId: "user-carlos",
      createdByUserId: "user-carlos",
      status: "Fulfilled",
      paymentStatus: "Confirmed",
      fulfillmentStatus: "Fulfilled",
      subtotal: 4320.00,
      chargesTotal: 0.00,
      discountTotal: 50.00,
      grandTotal: 4270.00,
      paidTotal: 4270.00,
      balanceRemaining: 0.00,
      totalHistoricalCost: 2850.00,
      estimatedProfitMargin: 33.26,
      observations: "Retirada no balcão da loja física com garantia de 90 dias",
      confirmedAtUtc: "2026-11-14T09:45:00Z",
      fulfilledAtUtc: "2026-11-14T09:50:00Z",
      createdAtUtc: "2026-11-14T09:40:00Z",
      version: 3,
      items: [
        {
          id: "item-1",
          productSkuId: "sku-iph14p",
          historicalSkuCode: "IPH14P-128-GOLD",
          historicalDescription: "iPhone 14 Pro 128GB Dourado Usado Grade A",
          itemCondition: 2,
          quantity: 1,
          unitPrice: 4200.00,
          discount: 50.00,
          totalAmount: 4150.00,
          historicalUnitCost: 2800.00,
          totalCost: 2800.00,
          inventoryUnitId: "unit-01",
          serialOrImei: "354891028374651",
          warrantyDays: 90
        },
        {
          id: "item-2",
          productSkuId: "sku-cab-c",
          historicalSkuCode: "CAB-USBC-1M",
          historicalDescription: "Cabo USB-C Original 1 Metro",
          itemCondition: 1,
          quantity: 2,
          unitPrice: 60.00,
          discount: 0.00,
          totalAmount: 120.00,
          historicalUnitCost: 25.00,
          totalCost: 50.00,
          warrantyDays: 90
        }
      ],
      payments: [
        {
          id: "pay-1",
          method: "Pix",
          amount: 2000.00,
          installments: 1,
          status: "Confirmed",
          authorizationCode: "PIX-BACEN-88491A",
          transactionReference: "E2E000293847291823",
          confirmedAtUtc: "2026-11-14T09:45:00Z"
        },
        {
          id: "pay-2",
          method: "CreditCard",
          amount: 2270.00,
          installments: 3,
          status: "Confirmed",
          authorizationCode: "AUT-STONE-77491",
          transactionReference: "NSU-88391029",
          confirmedAtUtc: "2026-11-14T09:47:00Z"
        }
      ]
    },
    {
      id: "sale-02",
      branchId: "branch-sp",
      saleNumber: "VD-2026-0090",
      customerPartyId: "cust-02",
      customerName: "Felipe Rodrigues",
      sellerUserId: "user-ana",
      createdByUserId: "user-ana",
      status: "Reserved",
      paymentStatus: "Pending",
      fulfillmentStatus: "NotFulfilled",
      subtotal: 180.00,
      chargesTotal: 15.00,
      discountTotal: 0.00,
      grandTotal: 195.00,
      paidTotal: 0.00,
      balanceRemaining: 195.00,
      totalHistoricalCost: 75.00,
      estimatedProfitMargin: 61.54,
      observations: "Aguardando confirmação de Pix pelo cliente",
      createdAtUtc: "2026-11-14T10:15:00Z",
      version: 1,
      items: [
        {
          id: "item-3",
          productSkuId: "sku-cab-c",
          historicalSkuCode: "CAB-USBC-1M",
          historicalDescription: "Cabo USB-C Original 1 Metro",
          itemCondition: 1,
          quantity: 3,
          unitPrice: 60.00,
          discount: 0.00,
          totalAmount: 180.00,
          historicalUnitCost: 25.00,
          totalCost: 75.00,
          warrantyDays: 90
        }
      ],
      payments: [
        {
          id: "pay-3",
          method: "Pix",
          amount: 195.00,
          installments: 1,
          status: "Pending",
          transactionReference: "PIX-QR-PENDING-994"
        }
      ]
    }
  ]);

  // Quotes List
  const [quotesList] = useState<SalesQuote[]>([
    {
      id: "quote-1",
      branchId: "branch-sp",
      quoteNumber: "COT-2026-0045",
      customerName: "TechCorp Consultoria LTDA",
      sellerUserId: "user-carlos",
      status: "ConvertedToSale",
      validUntilUtc: "2026-11-20T18:00:00Z",
      paymentTermsExpected: "1x Cartão de Crédito ou Faturado 15D",
      shippingTotal: 25.00,
      discountTotal: 50.00,
      subtotal: 1800.00,
      grandTotal: 1775.00,
      itemsCount: 5,
      notes: "Cotação para upgrade de cabos e carregadores originais de escritório",
      createdAtUtc: "2026-11-13T14:30:00Z"
    }
  ]);

  // Returns List
  const [returnsList] = useState<SaleReturn[]>([
    {
      id: "ret-1",
      branchId: "branch-sp",
      saleId: "sale-01",
      returnNumber: "DEV-2026-0012",
      reason: "Cabo incompatível com porta USB-A do notebook antigo",
      status: "InspectedAndRestocked",
      inspectionNotes: "Embalagem íntegra e sem marcas de uso; recolocado no estoque para revenda.",
      totalRefundAmount: 60.00,
      createdAtUtc: "2026-11-14T10:00:00Z",
      items: [
        {
          id: "ret-item-1",
          saleItemId: "item-2",
          productSkuId: "sku-cab-c",
          skuCode: "CAB-USBC-1M",
          skuName: "Cabo USB-C Original 1 Metro",
          quantity: 1,
          refundAmount: 60.00
        }
      ]
    }
  ]);

  // Calculations for PDV
  const subtotalCart = cartItems.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0);
  const totalCostCart = cartItems.reduce((acc, item) => acc + item.unitCost * item.quantity, 0);
  const grandTotalCart = Math.max(0, subtotalCart + chargesTotal - discountTotal);
  const profitMarginCart = grandTotalCart > 0
    ? Math.round(((grandTotalCart - totalCostCart) / grandTotalCart) * 10000) / 100
    : 0;

  return (
    <RootShellLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                MOD-05 · Sales & PDV
              </span>
              <span className="flex items-center gap-1 text-xs text-slate-500">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                sales.pos.use + sales.create
              </span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mt-1">Frente de Caixa (PDV) & Vendas</h1>
            <p className="text-sm text-slate-500">
              Checkout balcão ágil, orçamentos, baixa atômica de IMEI/serial e recebimentos múltiplos no Kardex.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowCostPermission(!showCostPermission)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                showCostPermission
                  ? "bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100"
                  : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
              }`}
            >
              {showCostPermission ? <Eye className="w-4 h-4 text-amber-600" /> : <EyeOff className="w-4 h-4 text-slate-400" />}
              <span>{showCostPermission ? "Modo Gerente (sales.cost.view: ON)" : "Modo Operador (sales.cost.view: OFF)"}</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-white px-6 rounded-t-xl gap-6">
          <button
            onClick={() => setActiveTab("pos")}
            className={`py-4 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === "pos"
                ? "border-emerald-600 text-emerald-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            Terminal PDV Balcão
          </button>
          <button
            onClick={() => setActiveTab("sales")}
            className={`py-4 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === "sales"
                ? "border-emerald-600 text-emerald-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Receipt className="w-4 h-4" />
            Histórico de Vendas ({salesList.length})
          </button>
          <button
            onClick={() => setActiveTab("quotes")}
            className={`py-4 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === "quotes"
                ? "border-emerald-600 text-emerald-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <FileText className="w-4 h-4" />
            Orçamentos Comerciais ({quotesList.length})
          </button>
          <button
            onClick={() => setActiveTab("returns")}
            className={`py-4 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === "returns"
                ? "border-emerald-600 text-emerald-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <RotateCcw className="w-4 h-4" />
            Devoluções & Trocas ({returnsList.length})
          </button>
        </div>

        {/* TAB 1: TERMINAL PDV BALCÃO */}
        {activeTab === "pos" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Catálogo Rápido e Itens do Carrinho */}
            <div className="lg:col-span-2 space-y-6">
              {/* Card de Busca Rápida de Produto / IMEI */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                    <Search className="w-4 h-4 text-emerald-600" />
                    Lançar Produto por SKU, Leitor de Código de Barras ou IMEI
                  </h2>
                  <span className="text-xs text-slate-400">Atalho F2</span>
                </div>
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder="Bipe o código de barras ou digite o IMEI / SKU..."
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                    />
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                  </div>
                  <button className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg flex items-center gap-2 shadow-sm transition-colors">
                    <Plus className="w-4 h-4" />
                    Adicionar
                  </button>
                </div>
              </div>

              {/* Tabela de Itens da Venda */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
                  <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-slate-500" />
                    Itens da Venda Atual ({cartItems.length})
                  </h3>
                  <button
                    onClick={() => setCartItems([])}
                    className="text-xs text-rose-600 hover:text-rose-700 font-medium"
                  >
                    Limpar Carrinho
                  </button>
                </div>

                <div className="divide-y divide-slate-100">
                  {cartItems.map((item, idx) => (
                    <div key={idx} className="p-4 flex items-center justify-between hover:bg-slate-50/70 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg mt-0.5 ${item.condition === "Usado" ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"}`}>
                          {item.condition === "Usado" ? <Smartphone className="w-4 h-4" /> : <Package className="w-4 h-4" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900 text-sm">{item.name}</span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 font-mono text-slate-600">
                              {item.code}
                            </span>
                          </div>
                          {item.serialOrImei && (
                            <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                              <span className="font-mono bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200">
                                IMEI: {item.serialOrImei}
                              </span>
                              {item.batteryHealth && (
                                <span className="text-slate-600">
                                  Saúde da Bateria: <strong>{item.batteryHealth}%</strong>
                                </span>
                              )}
                              <span className="text-emerald-700 font-medium">Garantia 90 dias</span>
                            </div>
                          )}
                          {showCostPermission && (
                            <div className="text-xs text-amber-700 mt-1 flex items-center gap-2 font-mono">
                              <span>Custo Unitário: R$ {item.unitCost.toFixed(2)}</span>
                              <span>·</span>
                              <span>Margem Unitária: {(((item.unitPrice - item.unitCost) / item.unitPrice) * 100).toFixed(1)}%</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <div className="text-xs text-slate-400 font-mono">
                            {item.quantity} un x R$ {item.unitPrice.toFixed(2)}
                          </div>
                          <div className="text-base font-bold text-slate-900 font-mono">
                            R$ {(item.quantity * item.unitPrice).toFixed(2)}
                          </div>
                        </div>
                        <button
                          onClick={() => setCartItems(cartItems.filter((_, i) => i !== idx))}
                          className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Col: Checkout, Identificação e Totais */}
            <div className="space-y-6">
              {/* Cliente & Vendedor */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                  <User className="w-4 h-4 text-emerald-600" />
                  Identificação do Atendimento
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Cliente</label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Vendedor Responsável</label>
                    <input
                      type="text"
                      value={sellerName}
                      onChange={(e) => setSellerName(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* Resumo Financeiro & Checkout */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-emerald-600" />
                  Totais & Fechamento
                </h3>

                <div className="space-y-2 text-sm pt-2 border-t border-slate-100 font-mono">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal:</span>
                    <span>R$ {subtotalCart.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-600">
                    <span>Desconto Balcão:</span>
                    <input
                      type="number"
                      value={discountTotal}
                      onChange={(e) => setDiscountTotal(Number(e.target.value))}
                      className="w-24 text-right px-2 py-1 border border-slate-300 rounded text-sm font-mono text-rose-600"
                    />
                  </div>
                  <div className="flex justify-between items-center text-slate-600">
                    <span>Acréscimos / Frete:</span>
                    <input
                      type="number"
                      value={chargesTotal}
                      onChange={(e) => setChargesTotal(Number(e.target.value))}
                      className="w-24 text-right px-2 py-1 border border-slate-300 rounded text-sm font-mono text-slate-800"
                    />
                  </div>

                  <div className="flex justify-between items-center text-slate-900 font-bold text-lg pt-3 border-t border-slate-200">
                    <span>Total a Pagar:</span>
                    <span className="text-emerald-700">R$ {grandTotalCart.toFixed(2)}</span>
                  </div>

                  {showCostPermission && (
                    <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-900 space-y-1">
                      <div className="flex justify-between font-bold">
                        <span>Custo Total de Saída:</span>
                        <span>R$ {totalCostCart.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-emerald-700">
                        <span>Margem Bruta Estimada:</span>
                        <span>{profitMarginCart}% (R$ {(grandTotalCart - totalCostCart).toFixed(2)})</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Formas de Pagamento Rápidas */}
                <div className="space-y-2 pt-2">
                  <span className="block text-xs font-semibold text-slate-700">Forma de Pagamento Principal:</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button className="flex items-center justify-center gap-2 py-2 px-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-medium text-slate-700">
                      <Banknote className="w-4 h-4 text-emerald-600" />
                      Dinheiro
                    </button>
                    <button className="flex items-center justify-center gap-2 py-2 px-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg text-xs font-medium text-emerald-800">
                      <QrCode className="w-4 h-4 text-emerald-700" />
                      Pix Dinâmico
                    </button>
                    <button className="flex items-center justify-center gap-2 py-2 px-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-medium text-slate-700">
                      <CreditCard className="w-4 h-4 text-blue-600" />
                      Cartão Crédito
                    </button>
                    <button className="flex items-center justify-center gap-2 py-2 px-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-medium text-slate-700">
                      <CreditCard className="w-4 h-4 text-slate-600" />
                      Cartão Débito
                    </button>
                  </div>
                </div>

                {/* Ação de Finalização */}
                <button
                  onClick={() => alert("Transação processada com sucesso! Reserva consumida e baixa efetuada no Kardex oficial.")}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-lg flex items-center justify-center gap-2 shadow-sm transition-colors"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  Confirmar Pagamento & Concluir Venda
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: HISTÓRICO DE VENDAS */}
        {activeTab === "sales" && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50/50">
              <h3 className="font-semibold text-slate-800 text-sm">Vendas Realizadas na Filial</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Filtrar por nº de venda ou cliente..."
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-xs font-semibold text-slate-700 uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Nº Venda</th>
                    <th className="py-3 px-4">Cliente</th>
                    <th className="py-3 px-4">Status Venda</th>
                    <th className="py-3 px-4">Status Pagamento</th>
                    <th className="py-3 px-4">Total</th>
                    {showCostPermission && <th className="py-3 px-4">Margem Bruta</th>}
                    <th className="py-3 px-4">Data/Hora</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {salesList.map((sale) => (
                    <tr key={sale.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900">{sale.saleNumber}</td>
                      <td className="py-3 px-4 font-sans">{sale.customerName ?? "Consumidor Final"}</td>
                      <td className="py-3 px-4 font-sans">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          sale.status === "Fulfilled" ? "bg-emerald-100 text-emerald-800" :
                          sale.status === "Reserved" ? "bg-amber-100 text-amber-800" :
                          "bg-slate-100 text-slate-800"
                        }`}>
                          {sale.status === "Fulfilled" ? "Entregue / Concluída" :
                           sale.status === "Reserved" ? "Estoque Reservado" : sale.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-sans">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          sale.paymentStatus === "Confirmed" ? "bg-emerald-100 text-emerald-800" :
                          sale.paymentStatus === "Pending" ? "bg-amber-100 text-amber-800" :
                          "bg-slate-100 text-slate-800"
                        }`}>
                          {sale.paymentStatus === "Confirmed" ? "100% Quitado" :
                           sale.paymentStatus === "Pending" ? "Pendente" : sale.paymentStatus}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900">
                        R$ {sale.grandTotal.toFixed(2)}
                      </td>
                      {showCostPermission && (
                        <td className="py-3 px-4 text-emerald-700 font-semibold">
                          {sale.estimatedProfitMargin ? `${sale.estimatedProfitMargin}%` : "—"}
                        </td>
                      )}
                      <td className="py-3 px-4 text-xs text-slate-500 font-sans">
                        {new Date(sale.createdAtUtc).toLocaleString("pt-BR")}
                      </td>
                      <td className="py-3 px-4 text-right font-sans">
                        <button className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">
                          Ver Comprovante
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: ORÇAMENTOS COMERCIAIS */}
        {activeTab === "quotes" && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-semibold text-slate-800 text-sm">Orçamentos e Propostas Comerciais</h3>
              <button className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" />
                Novo Orçamento
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-xs font-semibold text-slate-700 uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Nº Cotação</th>
                    <th className="py-3 px-4">Cliente / Razão</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Validade</th>
                    <th className="py-3 px-4">Total</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {quotesList.map((quote) => (
                    <tr key={quote.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900">{quote.quoteNumber}</td>
                      <td className="py-3 px-4 font-sans">{quote.customerName}</td>
                      <td className="py-3 px-4 font-sans">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                          {quote.status === "ConvertedToSale" ? "Convertido em Venda" : quote.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs font-sans text-slate-500">
                        {new Date(quote.validUntilUtc).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900">
                        R$ {quote.grandTotal.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-sans">
                        <button className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                          Visualizar PDF
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: DEVOLUÇÕES & TROCAS */}
        {activeTab === "returns" && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
              <div>
                <h3 className="font-semibold text-slate-800 text-sm">Registro de Devoluções de Venda</h3>
                <p className="text-xs text-slate-500">
                  Devolução física vinculada à venda original; o reabastecimento no Kardex exige inspeção técnica prévia.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-xs font-semibold text-slate-700 uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Nº Devolução</th>
                    <th className="py-3 px-4">Motivo Declarado</th>
                    <th className="py-3 px-4">Status Físico</th>
                    <th className="py-3 px-4">Reembolso</th>
                    <th className="py-3 px-4">Laudo / Inspeção</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {returnsList.map((ret) => (
                    <tr key={ret.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900">{ret.returnNumber}</td>
                      <td className="py-3 px-4 font-sans text-xs">{ret.reason}</td>
                      <td className="py-3 px-4 font-sans">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                          {ret.status === "InspectedAndRestocked" ? "Reintegrado ao Estoque" : ret.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900">
                        R$ {ret.totalRefundAmount.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 font-sans text-xs text-slate-500">
                        {ret.inspectionNotes ?? "Aguardando laudo técnico"}
                      </td>
                      <td className="py-3 px-4 text-right font-sans">
                        <button className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">
                          Ver Detalhes
                        </button>
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
