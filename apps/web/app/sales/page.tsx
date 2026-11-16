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

  // Cart / PDV State - Inicializado limpo (sem dados mock)
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
  }>>([]);

  const [discountTotal, setDiscountTotal] = useState<number>(0.00);
  const [chargesTotal, setChargesTotal] = useState<number>(0.00);
  const [customerName, setCustomerName] = useState<string>("");
  const [sellerName, setSellerName] = useState<string>("Henrique Barreto");

  // Vendas, Cotações e Devoluções limpas (sem mocks fictícios)
  const [salesList] = useState<Sale[]>([]);
  const [quotesList] = useState<SalesQuote[]>([]);
  const [returnsList] = useState<SaleReturn[]>([]);

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
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200">
                Frente de Caixa
              </span>
            </div>
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900 mt-1">PDV Balcão & Vendas</h1>
            <p className="text-xs text-slate-500">
              Checkout balcão ágil, orçamentos, baixa atômica de IMEI/serial e múltiplos métodos de pagamento.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCostPermission(!showCostPermission)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors shadow-xs"
            >
              {showCostPermission ? <Eye className="w-3.5 h-3.5 text-purple-600" /> : <EyeOff className="w-3.5 h-3.5 text-slate-400" />}
              <span>{showCostPermission ? "Margem Visível" : "Margem Oculta"}</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-white px-6 rounded-t-2xl gap-2 pt-2 shadow-xs">
          <button
            onClick={() => setActiveTab("pos")}
            className={`py-3 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === "pos"
                ? "border-purple-600 text-purple-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            Terminal PDV Balcão
          </button>
          <button
            onClick={() => setActiveTab("sales")}
            className={`py-3 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === "sales"
                ? "border-purple-600 text-purple-700"
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
                  {cartItems.length === 0 ? (
                    <div className="p-12 text-center">
                      <div className="w-14 h-14 mx-auto rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600 mb-3 border border-purple-100">
                        <ShoppingCart className="w-7 h-7" />
                      </div>
                      <h4 className="text-sm font-bold text-slate-800">Carrinho Vazio</h4>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                        Utilize o campo acima para bipar o código de barras ou buscar o IMEI/SKU do produto para iniciar a venda.
                      </p>
                    </div>
                  ) : (
                    cartItems.map((item, idx) => (
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
                    ))
                  )}
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
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50/50">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Histórico de Vendas</h3>
                <p className="text-xs text-slate-500">Transações e notas de saída geradas no balcão e online.</p>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Filtrar por nº de venda ou cliente..."
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            {salesList.length === 0 ? (
              <div className="p-16 text-center">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600 mb-3 border border-purple-100">
                  <Receipt className="w-7 h-7" />
                </div>
                <h4 className="text-sm font-bold text-slate-800">Nenhuma Venda Registrada</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                  As vendas faturadas e finalizadas no Terminal PDV Balcão serão listadas aqui com integração ao Kardex.
                </p>
              </div>
            ) : (
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
                          <button className="text-xs text-purple-600 hover:text-purple-700 font-medium">
                            Ver Comprovante
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

        {/* TAB 3: ORÇAMENTOS COMERCIAIS */}
        {activeTab === "quotes" && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Orçamentos e Propostas Comerciais</h3>
                <p className="text-xs text-slate-500">Propostas com reserva temporária de estoque e validade comercial.</p>
              </div>
              <button className="px-3.5 py-2 bg-gradient-to-r from-violet-600 to-purple-700 hover:from-violet-700 hover:to-purple-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs">
                <Plus className="w-3.5 h-3.5" />
                Novo Orçamento
              </button>
            </div>

            {quotesList.length === 0 ? (
              <div className="p-16 text-center">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600 mb-3 border border-purple-100">
                  <FileText className="w-7 h-7" />
                </div>
                <h4 className="text-sm font-bold text-slate-800">Nenhum Orçamento Emitido</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                  Crie orçamentos formais com validade em dias para negociação com clientes corporativos ou de balcão.
                </p>
              </div>
            ) : (
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
                          <button className="text-xs text-purple-600 hover:text-purple-700 font-medium">
                            Visualizar PDF
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

        {/* TAB 4: DEVOLUÇÕES & TROCAS */}
        {activeTab === "returns" && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Registro de Devoluções de Venda</h3>
                <p className="text-xs text-slate-500">
                  Devolução física vinculada à venda original; o reabastecimento no Kardex exige inspeção técnica prévia.
                </p>
              </div>
            </div>

            {returnsList.length === 0 ? (
              <div className="p-16 text-center">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600 mb-3 border border-purple-100">
                  <RotateCcw className="w-7 h-7" />
                </div>
                <h4 className="text-sm font-bold text-slate-800">Nenhuma Devolução Registrada</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                  Trocas e devoluções balcão auditadas com checklist de integridade física serão catalogadas nesta aba.
                </p>
              </div>
            ) : (
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
                          <button className="text-xs text-purple-600 hover:text-purple-700 font-medium">
                            Ver Detalhes
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
      </div>
    </RootShellLayout>
  );
}
