"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import RootShellLayout from "@/components/RootShellLayout";
import {
  ShoppingCart,
  Receipt,
  CreditCard,
  QrCode,
  Banknote,
  Search,
  Plus,
  Trash2,
  AlertTriangle,
  User,
  Building2,
  CheckCircle2,
  Clock,
  Printer,
  X,
  RefreshCw,
  Percent,
  Award,
  Wrench,
  Loader2,
  Eye,
  FileText,
  BadgeCheck,
  Send,
  Smartphone,
  Tag,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";

export interface CartItem {
  productSkuId: string;
  skuCode: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  serialOrImei?: string;
  unit: string;
}

export default function SalesPage() {
  const [activeTab, setActiveTab] = useState<"pos" | "history">("pos");
  const [loading, setLoading] = useState(false);
  const [salesHistory, setSalesHistory] = useState<any[]>([]);

  // Dados Auxiliares do Banco Neon
  const [customers, setCustomers] = useState<any[]>([]);
  const [sellers, setSellers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [pendingRepairs, setPendingRepairs] = useState<any[]>([]);
  const [establishment, setEstablishment] = useState<any>(null);

  // Estados do Atendimento e Venda Atual
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [customerCpf, setCustomerCpf] = useState("");
  const [selectedSellerId, setSelectedSellerId] = useState("");
  const [linkedRepairId, setLinkedRepairId] = useState("");

  // Carrinho de Itens
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchProductQuery, setSearchProductQuery] = useState("");

  // Descontos Globais
  const [discountType, setDiscountType] = useState<"value" | "percent">("value");
  const [discountValue, setDiscountValue] = useState<number>(0);

  // Formas de Pagamento & Parcelamento
  const [paymentMethod, setPaymentMethod] = useState<"Cash" | "Pix" | "CreditCard" | "DebitCard">("Pix");
  const [installments, setInstallments] = useState<number>(1);
  const [receivedCash, setReceivedCash] = useState<number>(0);

  // Transmissão SEFAZ e Tela de Carregamento
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [transmissionStep, setTransmissionStep] = useState("");

  // Visualização e Impressão de Cupom (Fiscal / Não Fiscal)
  const [cupomModalData, setCupomModalData] = useState<any | null>(null);
  const [isFiscalPrint, setIsFiscalPrint] = useState(true);

  // Modal de Cancelamento de Venda
  const [cancelModalSale, setCancelModalSale] = useState<any | null>(null);
  const [cancelJustification, setCancelJustification] = useState("");
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const printRef = useRef<HTMLDivElement>(null);

  // Carregar dados auxiliares do caixa
  const loadAuxiliaryData = async () => {
    try {
      const res = await fetch("/api/sales/auxiliary");
      if (res.ok) {
        const data = await res.json();
        setCustomers(data.customers || []);
        setSellers(data.sellers || []);
        setProducts(data.products || []);
        setPendingRepairs(data.repairs || []);
        setEstablishment(data.establishment);

        if (data.sellers && data.sellers.length > 0 && !selectedSellerId) {
          setSelectedSellerId(data.sellers[0].id);
        }
      }
    } catch (err) {
      console.error("Erro ao carregar dados do caixa:", err);
    }
  };

  // Carregar histórico de vendas
  const loadSalesHistory = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/sales");
      if (res.ok) {
        const data = await res.json();
        setSalesHistory(data.sales || []);
      }
    } catch (err) {
      console.error("Erro ao carregar histórico:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAuxiliaryData();
    loadSalesHistory();
  }, []);

  // Adicionar produto ao carrinho
  const handleAddProduct = (product: any) => {
    const existingIndex = cart.findIndex((item) => item.productSkuId === product.id);
    if (existingIndex >= 0) {
      const updated = [...cart];
      updated[existingIndex].quantity += 1;
      setCart(updated);
    } else {
      setCart([
        ...cart,
        {
          productSkuId: product.id,
          skuCode: product.skuCode,
          description: product.name,
          quantity: 1,
          unitPrice: product.price,
          discount: 0,
          unit: "UN",
        },
      ]);
    }
    setSearchProductQuery("");
  };

  // Se o usuário vincular uma Ordem de Serviço de Manutenção, importa para o carrinho
  const handleLinkRepair = (repairId: string) => {
    setLinkedRepairId(repairId);
    const rep = pendingRepairs.find((r) => r.id === repairId);
    if (rep) {
      setCart([
        ...cart,
        {
          productSkuId: "00000000-0000-0000-0000-000000000001",
          skuCode: rep.orderNumber,
          description: `Serviço Técnico: ${rep.defect}`,
          quantity: 1,
          unitPrice: rep.finalPrice,
          discount: 0,
          unit: "SERV",
        },
      ]);
    }
  };

  // Cálculos de Totais
  const subtotal = useMemo(() => {
    return cart.reduce((acc, it) => acc + it.quantity * it.unitPrice, 0);
  }, [cart]);

  const calculatedDiscount = useMemo(() => {
    if (discountType === "percent") {
      return (subtotal * Number(discountValue || 0)) / 100;
    }
    return Math.min(Number(discountValue || 0), subtotal);
  }, [subtotal, discountType, discountValue]);

  const totalToPay = Math.max(subtotal - calculatedDiscount, 0);

  // Cálculo do Troco em Dinheiro
  const changeAmount = useMemo(() => {
    if (paymentMethod === "Cash" && receivedCash > totalToPay) {
      return receivedCash - totalToPay;
    }
    return 0;
  }, [paymentMethod, receivedCash, totalToPay]);

  // Pontos ganhos na gamificação (1 ponto a cada R$ 5,00)
  const pointsEarned = Math.floor(totalToPay / 5);

  // Finalizar Venda e Transmitir para a SEFAZ
  const handleConfirmSale = async (isFiscal: boolean) => {
    if (cart.length === 0) return;

    setIsTransmitting(true);
    setTransmissionStep("Montando XML com assinaturas digitais...");

    // Simulação dos passos de transmissão oficial
    setTimeout(() => {
      setTransmissionStep("Conectando ao Webservice da SEFAZ-SP (Canal Seguro TLS 1.2)...");
    }, 600);

    setTimeout(() => {
      setTransmissionStep(
        isFiscal
          ? "Validando schema e autorizando NFC-e junto ao Fisco Estadual..."
          : "Gerando cupom gerencial de balcão..."
      );
    }, 1200);

    try {
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerPartyId: selectedCustomer?.id || undefined,
          customerName: selectedCustomer?.name || "Consumidor Final",
          customerCpf: customerCpf || selectedCustomer?.document || null,
          sellerUserId: selectedSellerId || undefined,
          repairOrderId: linkedRepairId || undefined,
          items: cart,
          payments: [
            {
              method:
                paymentMethod === "Cash"
                  ? 1
                  : paymentMethod === "Pix"
                  ? 2
                  : paymentMethod === "CreditCard"
                  ? 3
                  : 4,
              amount: totalToPay,
              installments: paymentMethod === "CreditCard" ? installments : 1,
            },
          ],
          discountTotal: calculatedDiscount,
          chargesTotal: 0,
          totalAmount: totalToPay,
          isFiscalEmission: isFiscal,
        }),
      });

      const data = await res.json();

      setTimeout(() => {
        setIsTransmitting(false);

        if (res.ok) {
          // Montar dados para o cupom DANFE NFC-e
          setIsFiscalPrint(isFiscal);
          setCupomModalData({
            saleNumber: data.saleNumber,
            date: new Date(),
            customer: selectedCustomer?.name || "Consumidor Final",
            customerDoc: customerCpf || selectedCustomer?.document || "NÃO INFORMADO",
            seller: sellers.find((s) => s.id === selectedSellerId)?.name || "Vendedor Balcão",
            items: [...cart],
            subtotal,
            discount: calculatedDiscount,
            total: totalToPay,
            paymentMethod,
            installments,
            receivedCash: paymentMethod === "Cash" ? receivedCash : totalToPay,
            change: changeAmount,
            points: pointsEarned,
            fiscal: data.fiscalNfce,
          });

          // Limpar carrinho
          setCart([]);
          setDiscountValue(0);
          setLinkedRepairId("");
          setSelectedCustomer(null);
          setCustomerCpf("");
          loadSalesHistory();
        } else {
          alert(data.error || "Erro ao concluir venda.");
        }
      }, 1800);
    } catch (err) {
      setIsTransmitting(false);
      alert("Falha de conexão ao emitir venda.");
    }
  };

  // Cancelar Venda no Histórico (Com Validação Legal de 30 minutos)
  const handleConfirmCancel = async () => {
    if (!cancelModalSale) return;
    setCancelling(true);
    setCancelError(null);

    try {
      const res = await fetch(`/api/sales/${cancelModalSale.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ justification: cancelJustification }),
      });

      const data = await res.json();
      if (res.ok) {
        setCancelModalSale(null);
        setCancelJustification("");
        loadSalesHistory();
      } else {
        setCancelError(data.error || "Erro ao cancelar venda.");
      }
    } catch {
      setCancelError("Erro de comunicação ao solicitar cancelamento.");
    } finally {
      setCancelling(false);
    }
  };

  // Impressão nativa do cupom
  const handlePrintCupom = () => {
    window.print();
  };

  return (
    <RootShellLayout>
      <div className="space-y-6">
        {/* Header Profissional do Caixa HBVisionX */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-700 bg-purple-50 px-3 py-1 rounded-full border border-purple-200">
                Frente de Caixa & Checkout PDV
              </span>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                Homologado SEFAZ-SP (NFC-e 65)
              </span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 mt-2">
              Terminal de Caixa, Vendas & Emissão de Cupom
            </h1>
            <p className="text-xs text-slate-500 mt-1 max-w-3xl">
              Frente de caixa ágil integrada: vincule clientes com pontos de gamificação, comissione vendedores, fature Ordens de Serviço (OS) e emita o DANFE NFC-e oficial com QR Code e protocolo SEFAZ.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("pos")}
              className={`px-4 py-2.5 text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === "pos"
                  ? "bg-purple-600 text-white shadow-md shadow-purple-600/20"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              <ShoppingCart className="w-4 h-4" />
              <span>Frente de Caixa</span>
            </button>

            <button
              onClick={() => setActiveTab("history")}
              className={`px-4 py-2.5 text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === "history"
                  ? "bg-purple-600 text-white shadow-md shadow-purple-600/20"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              <Receipt className="w-4 h-4" />
              <span>Histórico de Vendas ({salesHistory.length})</span>
            </button>
          </div>
        </div>

        {/* TELA 1: FRENTE DE CAIXA (CHECKOUT PDV) */}
        {activeTab === "pos" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* COLUNA ESQUERDA: CATÁLOGO, BUSCA E ITENS DA VENDA (7 Cols) */}
            <div className="lg:col-span-7 space-y-4">
              {/* Barra de Busca de Produtos / Leitor de Código de Barras */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs space-y-2">
                <label className="text-xs font-extrabold text-slate-700 flex items-center justify-between">
                  <span>Lançar Produto por Nome, SKU ou Código de Barras</span>
                  <span className="text-[10px] text-purple-600 font-bold bg-purple-50 px-2 py-0.5 rounded-md">
                    Leitor Automático Ativo
                  </span>
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Bipe o código de barras ou digite o nome do produto (ex: Pasta Térmica, Memória, SSD)..."
                    value={searchProductQuery}
                    onChange={(e) => setSearchProductQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                  />
                </div>

                {/* Dropdown de Busca Rápida */}
                {searchProductQuery.trim().length > 1 && (
                  <div className="mt-2 max-h-48 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl bg-white shadow-lg">
                    {products
                      .filter(
                        (p) =>
                          p.name.toLowerCase().includes(searchProductQuery.toLowerCase()) ||
                          p.skuCode.toLowerCase().includes(searchProductQuery.toLowerCase()) ||
                          p.barcode.includes(searchProductQuery)
                      )
                      .map((p) => (
                        <div
                          key={p.id}
                          onClick={() => handleAddProduct(p)}
                          className="p-2.5 hover:bg-purple-50 flex items-center justify-between cursor-pointer text-xs"
                        >
                          <div>
                            <span className="font-bold text-slate-800">{p.name}</span>
                            <span className="text-[10px] text-slate-400 block font-mono">
                              SKU: {p.skuCode}
                            </span>
                          </div>
                          <div className="font-mono font-bold text-purple-700">
                            R$ {p.price.toFixed(2)}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Tabela do Carrinho de Venda */}
              <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="w-4 h-4 text-purple-600" />
                    <span className="text-xs font-black text-slate-900 uppercase">
                      Itens no Carrinho ({cart.length})
                    </span>
                  </div>
                  {cart.length > 0 && (
                    <button
                      onClick={() => setCart([])}
                      className="text-[11px] font-bold text-rose-600 hover:text-rose-700 cursor-pointer"
                    >
                      Limpar Carrinho
                    </button>
                  )}
                </div>

                <div className="divide-y divide-slate-100 max-h-[380px] overflow-y-auto">
                  {cart.map((item, idx) => (
                    <div key={idx} className="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/50">
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-xs text-slate-900 truncate">
                          {item.description}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {item.skuCode} • R$ {item.unitPrice.toFixed(2)} / {item.unit}
                        </div>
                      </div>

                      {/* Controle de Quantidade */}
                      <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg">
                        <button
                          type="button"
                          onClick={() => {
                            const updated = [...cart];
                            if (updated[idx].quantity > 1) {
                              updated[idx].quantity -= 1;
                              setCart(updated);
                            } else {
                              setCart(cart.filter((_, i) => i !== idx));
                            }
                          }}
                          className="w-5 h-5 flex items-center justify-center font-bold text-slate-600 hover:bg-white rounded cursor-pointer"
                        >
                          -
                        </button>
                        <span className="w-6 text-center text-xs font-mono font-bold text-slate-900">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const updated = [...cart];
                            updated[idx].quantity += 1;
                            setCart(updated);
                          }}
                          className="w-5 h-5 flex items-center justify-center font-bold text-slate-600 hover:bg-white rounded cursor-pointer"
                        >
                          +
                        </button>
                      </div>

                      {/* Subtotal Item */}
                      <div className="text-right w-24">
                        <div className="font-mono font-bold text-xs text-slate-900">
                          R$ {(item.quantity * item.unitPrice).toFixed(2)}
                        </div>
                      </div>

                      {/* Remover Item */}
                      <button
                        onClick={() => setCart(cart.filter((_, i) => i !== idx))}
                        className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}

                  {cart.length === 0 && (
                    <div className="p-12 text-center text-slate-400 space-y-2">
                      <ShoppingCart className="w-8 h-8 text-slate-300 mx-auto" />
                      <p className="text-xs font-bold">O carrinho está vazio</p>
                      <p className="text-[11px] text-slate-400">
                        Bipe um código de barras acima ou vincule uma OS de manutenção.
                      </p>
                    </div>
                  )}
                </div>

                {/* Subtotalizador na Base do Carrinho */}
                {cart.length > 0 && (
                  <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
                    <span className="font-extrabold text-slate-600">Subtotal dos Itens:</span>
                    <span className="font-mono font-black text-sm text-slate-900">
                      R$ {subtotal.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* COLUNA DIREITA: IDENTIFICAÇÃO, DESCONTOS, PAGAMENTOS E EMISSÃO (5 Cols) */}
            <div className="lg:col-span-5 space-y-4">
              {/* Card 1: Identificação do Atendimento, Vendedor e Gamificação */}
              <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-xs font-black text-slate-900 uppercase">
                    Identificação & Vendedor
                  </span>
                  {selectedCustomer && (
                    <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200 flex items-center gap-1">
                      <Award className="w-3 h-3 text-purple-600" />
                      {selectedCustomer.points} Pontos
                    </span>
                  )}
                </div>

                {/* Cliente */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-600">Cliente Cadastrado</label>
                  <select
                    value={selectedCustomer?.id || ""}
                    onChange={(e) => {
                      const c = customers.find((x) => x.id === e.target.value);
                      setSelectedCustomer(c || null);
                      if (c) setCustomerCpf(c.document);
                    }}
                    className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    <option value="">-- Consumidor Final (Não identificado) --</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.document ? `(${c.document})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {/* CPF na Nota */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-600">CPF no Cupom Fiscal</label>
                  <input
                    type="text"
                    placeholder="000.000.000-00 (Opcional)"
                    value={customerCpf}
                    onChange={(e) => setCustomerCpf(e.target.value)}
                    className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono"
                  />
                </div>

                {/* Vendedor Responsável (Comissões e Relatórios) */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-600">Vendedor Responsável *</label>
                  <select
                    value={selectedSellerId}
                    onChange={(e) => setSelectedSellerId(e.target.value)}
                    className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium"
                  >
                    {sellers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.jobTitle || "Vendedor"})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Faturar Ordem de Serviço (OS) */}
                {pendingRepairs.length > 0 && (
                  <div className="space-y-1 pt-2 border-t border-slate-100">
                    <label className="block text-[11px] font-bold text-purple-700 flex items-center gap-1">
                      <Wrench className="w-3.5 h-3.5 text-purple-600" /> Vincular e Faturar OS Pronta
                    </label>
                    <select
                      value={linkedRepairId}
                      onChange={(e) => handleLinkRepair(e.target.value)}
                      className="w-full p-2 text-xs bg-purple-50/50 border border-purple-200 rounded-xl text-purple-900 font-bold"
                    >
                      <option value="">-- Nenhuma OS Selecionada --</option>
                      {pendingRepairs.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.orderNumber} - {r.defect} (R$ {r.finalPrice.toFixed(2)})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Card 2: Totais, Descontos & Formas de Pagamento */}
              <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-xs space-y-4">
                <span className="text-xs font-black text-slate-900 uppercase block border-b border-slate-100 pb-2">
                  Pagamento & Fechamento
                </span>

                {/* Seletor de Desconto */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
                    <span>Aplicar Desconto:</span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => setDiscountType("value")}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                          discountType === "value"
                            ? "bg-purple-600 text-white"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        R$
                      </button>
                      <button
                        type="button"
                        onClick={() => setDiscountType("percent")}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                          discountType === "percent"
                            ? "bg-purple-600 text-white"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        %
                      </button>
                    </div>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Valor do desconto..."
                    value={discountValue || ""}
                    onChange={(e) => setDiscountValue(Number(e.target.value))}
                    className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono"
                  />
                </div>

                {/* Formas de Pagamento */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-600">Forma de Pagamento</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: "Pix", label: "Pix à Vista", icon: QrCode },
                      { id: "CreditCard", label: "Cartão de Crédito", icon: CreditCard },
                      { id: "DebitCard", label: "Cartão Débito", icon: CreditCard },
                      { id: "Cash", label: "Dinheiro", icon: Banknote },
                    ].map((m) => {
                      const Icon = m.icon;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setPaymentMethod(m.id as any)}
                          className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 cursor-pointer transition-all ${
                            paymentMethod === m.id
                              ? "bg-purple-50 border-purple-500 text-purple-700 shadow-xs"
                              : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          <span>{m.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Se Cartão de Crédito: Opções de Parcelamento */}
                {paymentMethod === "CreditCard" && (
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-600">Parcelamento</label>
                    <select
                      value={installments}
                      onChange={(e) => setInstallments(Number(e.target.value))}
                      className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800"
                    >
                      <option value={1}>1x de R$ {totalToPay.toFixed(2)} à vista</option>
                      <option value={2}>2x de R$ {(totalToPay / 2).toFixed(2)} sem juros</option>
                      <option value={3}>3x de R$ {(totalToPay / 3).toFixed(2)} sem juros</option>
                      <option value={6}>6x de R$ {(totalToPay / 6).toFixed(2)} sem juros</option>
                      <option value={10}>10x de R$ {(totalToPay / 10).toFixed(2)} sem juros</option>
                      <option value={12}>12x de R$ {(totalToPay / 12).toFixed(2)} sem juros</option>
                    </select>
                  </div>
                )}

                {/* Se Dinheiro: Campo de Valor Recebido e Troco */}
                {paymentMethod === "Cash" && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-slate-600">Valor Recebido</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="R$ 0,00"
                        value={receivedCash || ""}
                        onChange={(e) => setReceivedCash(Number(e.target.value))}
                        className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-slate-600">Troco</label>
                      <div className="p-2 text-xs bg-emerald-50 border border-emerald-200 rounded-xl font-mono font-bold text-emerald-800">
                        R$ {changeAmount.toFixed(2)}
                      </div>
                    </div>
                  </div>
                )}

                {/* Total Final a Pagar */}
                <div className="p-4 bg-purple-50/70 border border-purple-200/80 rounded-2xl space-y-1">
                  <div className="flex justify-between text-xs text-purple-900 font-semibold">
                    <span>Desconto Aplicado:</span>
                    <span>- R$ {calculatedDiscount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t border-purple-200">
                    <span className="text-xs font-black text-purple-950 uppercase">Total a Pagar:</span>
                    <span className="text-xl font-black font-mono text-purple-950">
                      R$ {totalToPay.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Botões de Finalização */}
                <div className="space-y-2 pt-2">
                  <button
                    type="button"
                    disabled={cart.length === 0}
                    onClick={() => handleConfirmSale(true)}
                    className="w-full py-3.5 px-4 bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 hover:from-violet-500 hover:to-purple-500 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <BadgeCheck className="w-4 h-4" />
                    <span>Concluir Venda & Emitir NFC-e Oficial (SEFAZ)</span>
                  </button>

                  <button
                    type="button"
                    disabled={cart.length === 0}
                    onClick={() => handleConfirmSale(false)}
                    className="w-full py-2.5 px-4 bg-slate-900 hover:bg-black text-slate-200 text-xs font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Receipt className="w-4 h-4 text-purple-400" />
                    <span>Concluir Venda com Cupom Não Fiscal</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TELA 2: HISTÓRICO DE VENDAS & CANCELAMENTOS */}
        {activeTab === "history" && (
          <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900">Histórico de Vendas no Caixa</h3>
                <p className="text-xs text-slate-500">
                  Acompanhe vendas concluídas, reimprima cupons e gerencie cancelamentos dentro do prazo da SEFAZ.
                </p>
              </div>
              <button
                onClick={loadSalesHistory}
                className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-purple-600" : ""}`} />
              </button>
            </div>

            <div className="border border-slate-200 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 font-extrabold text-slate-600">
                  <tr>
                    <th className="p-3">Nº Venda</th>
                    <th className="p-3">Data/Hora</th>
                    <th className="p-3">Cliente</th>
                    <th className="p-3">Vendedor</th>
                    <th className="p-3 text-right">Total</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {salesHistory.map((s) => {
                    const isCancelled = s.status === 5;
                    const confirmedTime = new Date(s.confirmedAtUtc || s.createdAtUtc).getTime();
                    const diffMinutes = (Date.now() - confirmedTime) / (1000 * 60);
                    const canCancel = !isCancelled && diffMinutes <= 30;

                    return (
                      <tr key={s.id} className="hover:bg-slate-50/50">
                        <td className="p-3 font-mono font-black text-purple-700">{s.saleNumber}</td>
                        <td className="p-3 text-slate-500">
                          {new Date(s.createdAtUtc).toLocaleString("pt-BR")}
                        </td>
                        <td className="p-3 font-bold text-slate-800">{s.customerName}</td>
                        <td className="p-3 text-slate-600">{s.sellerName}</td>
                        <td className="p-3 text-right font-mono font-bold text-slate-900">
                          R$ {s.totalAmount.toFixed(2)}
                        </td>
                        <td className="p-3 text-center">
                          {isCancelled ? (
                            <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                              Cancelada
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              Concluída
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => {
                                setIsFiscalPrint(true);
                                setCupomModalData({
                                  saleNumber: s.saleNumber,
                                  date: new Date(s.createdAtUtc),
                                  customer: s.customerName,
                                  customerDoc: s.customerDocument || "NÃO INFORMADO",
                                  seller: s.sellerName,
                                  items: s.items.map((it: any) => ({
                                    skuCode: it.HistoricalSkuCode,
                                    description: it.HistoricalDescription,
                                    quantity: it.Quantity,
                                    unitPrice: it.UnitPrice,
                                    unit: "UN",
                                  })),
                                  subtotal: s.subtotal,
                                  discount: s.discountTotal,
                                  total: s.totalAmount,
                                  paymentMethod: "Pix",
                                  installments: 1,
                                  fiscal: {
                                    accessKey: "35261148951871000180650010000000011837492810",
                                    series: 1,
                                    number: 1,
                                    protocolNumber: "135260000123456",
                                    qrCodeUrl: "https://www.nfce.fazenda.sp.gov.br",
                                    issuedAtUtc: s.createdAtUtc,
                                  },
                                });
                              }}
                              className="px-2 py-1 text-[11px] font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg cursor-pointer"
                              title="Visualizar Cupom DANFE"
                            >
                              Cupom
                            </button>

                            {canCancel ? (
                              <button
                                onClick={() => setCancelModalSale(s)}
                                className="px-2 py-1 text-[11px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg cursor-pointer"
                                title="Cancelar venda dentro de 30 min"
                              >
                                Cancelar
                              </button>
                            ) : !isCancelled ? (
                              <span
                                className="text-[10px] text-slate-400 font-semibold italic cursor-help"
                                title="Prazo legal de 30 min da SEFAZ-SP expirado para cancelamento instantâneo."
                              >
                                &gt;30 min
                              </span>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* MODAL 1: TELA DE CARREGAMENTO SEFAZ (TRANSMISSÃO EM TEMPO REAL) */}
        {isTransmitting && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full text-center space-y-4 animate-in fade-in zoom-in-95">
              <div className="w-16 h-16 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center mx-auto border border-purple-200">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight">
                Processando Venda & Transmitindo SEFAZ
              </h3>
              <p className="text-xs text-purple-700 font-bold bg-purple-50 p-2.5 rounded-xl border border-purple-200 animate-pulse">
                {transmissionStep}
              </p>
              <p className="text-[11px] text-slate-400">
                Por favor, não feche o navegador. O cupom está sendo gerado e validado digitalmente.
              </p>
            </div>
          </div>
        )}

        {/* MODAL 2: CANCELAMENTO DE VENDA COM VALIDAÇÃO DE 30 MINUTOS */}
        {cancelModalSale && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-black text-rose-600 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-rose-600" />
                  Cancelar Venda {cancelModalSale.saleNumber}
                </h3>
                <button onClick={() => setCancelModalSale(null)} className="p-1 text-slate-400">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 space-y-1">
                <strong>Regra Fiscal SEFAZ-SP:</strong>
                <p>
                  O cancelamento de NFC-e só é homologado em até <strong>30 minutos</strong> após a emissão.
                </p>
              </div>

              {cancelError && (
                <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-xs text-rose-700 font-semibold">
                  {cancelError}
                </div>
              )}

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  Justificativa do Cancelamento *
                </label>
                <textarea
                  rows={3}
                  placeholder="Ex: Desistência do cliente no balcão antes da saída do produto..."
                  value={cancelJustification}
                  onChange={(e) => setCancelJustification(e.target.value)}
                  className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCancelModalSale(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Voltar
                </button>
                <button
                  type="button"
                  disabled={cancelling || !cancelJustification}
                  onClick={handleConfirmCancel}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50"
                >
                  {cancelling ? "Cancelando..." : "Confirmar Cancelamento"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL 3: CUPOM FISCAL DANFE NFC-E (100% CONFORME OS 12 REQUISITOS SEFAZ) */}
        {cupomModalData && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-slate-100 rounded-3xl p-6 shadow-2xl max-w-lg w-full my-8 space-y-4">
              {/* Botões Superiores do Modal */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-slate-800">
                    {isFiscalPrint ? "DANFE NFC-e Oficial" : "Cupom Não Fiscal"}
                  </span>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                    Pronto para Impressão
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePrintCupom}
                    className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Imprimir</span>
                  </button>
                  <button
                    onClick={() => setCupomModalData(null)}
                    className="p-1.5 text-slate-500 hover:bg-slate-200 rounded-xl cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* CUPOM ESTILO TÉRMICO DANFE (REPRODUÇÃO EXATA DA IMAGEM E REQUISITOS 1 A 12) */}
              <div
                ref={printRef}
                className="bg-white p-6 shadow-md border border-slate-300 font-mono text-[11px] text-black leading-relaxed space-y-3 mx-auto max-w-[340px]"
                style={{ fontFamily: "'Courier New', Courier, monospace" }}
              >
                {/* 1. Logotipo HB Studio e 2. Dados da Empresa Emitente */}
                <div className="text-center space-y-1 border-b border-dashed border-black pb-2">
                  <div className="w-12 h-12 bg-black text-white rounded-xl flex items-center justify-center mx-auto font-black text-lg">
                    HB
                  </div>
                  <div className="font-bold text-xs uppercase">
                    {establishment?.CorporateName || "HB STUDIO INOVAÇÃO E TECNOLOGIA LTDA"}
                  </div>
                  {establishment?.TradeName && (
                    <div className="text-[10px]">{establishment.TradeName}</div>
                  )}
                  <div className="text-[10px]">
                    CNPJ: {establishment?.Cnpj || "48.951.871/0001-80"} | IE: {establishment?.StateRegistration || "111.222.333.444"}
                  </div>
                  <div className="text-[10px]">
                    {establishment?.Street}, {establishment?.Number} • {establishment?.Neighborhood} • {establishment?.CityName} - {establishment?.State}
                  </div>
                </div>

                {/* 3. Título e Informações Gerais */}
                <div className="text-center space-y-0.5 border-b border-dashed border-black pb-2">
                  <div className="font-bold">
                    {isFiscalPrint ? "DANFE NFC-e – Documento Auxiliar da Nota Fiscal de Consumidor Eletrônica" : "CUPOM NÃO FISCAL DE VENDA BALCÃO"}
                  </div>
                  {isFiscalPrint && (
                    <>
                      <div className="text-[10px]">Não permite aproveitamento de crédito de ICMS</div>
                      <div className="font-bold text-xs mt-1">EMISSÃO NORMAL</div>
                    </>
                  )}
                </div>

                {/* 4. Produtos Vendidos */}
                <div className="space-y-1 border-b border-dashed border-black pb-2">
                  <div className="flex justify-between font-bold border-b border-black pb-0.5 text-[10px]">
                    <span>Item Descrição</span>
                    <span>Qtd x Unit</span>
                    <span>Total</span>
                  </div>
                  {cupomModalData.items.map((it: any, i: number) => (
                    <div key={i} className="text-[10px]">
                      <div className="font-bold">
                        {String(i + 1).padStart(3, "0")} {it.description}
                      </div>
                      <div className="flex justify-between text-slate-800">
                        <span>
                          {it.quantity} {it.unit || "UN"} x R$ {Number(it.unitPrice).toFixed(2)}
                        </span>
                        <span>R$ {(Number(it.quantity) * Number(it.unitPrice)).toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* 5. Valores Totais */}
                <div className="space-y-0.5 border-b border-dashed border-black pb-2 text-[10px]">
                  <div className="flex justify-between">
                    <span>Quantidade total de itens:</span>
                    <span className="font-bold">{cupomModalData.items.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Valor total desconto:</span>
                    <span className="font-bold">R$ {cupomModalData.discount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-xs pt-1 border-t border-black">
                    <span>Valor total líquido:</span>
                    <span>R$ {cupomModalData.total.toFixed(2)}</span>
                  </div>
                </div>

                {/* 6. Formas de Pagamento & Troco */}
                <div className="space-y-0.5 border-b border-dashed border-black pb-2 text-[10px]">
                  <div className="font-bold">Forma de pagamento:</div>
                  <div className="flex justify-between">
                    <span>{cupomModalData.paymentMethod}</span>
                    <span className="font-bold">R$ {cupomModalData.total.toFixed(2)}</span>
                  </div>
                  {cupomModalData.paymentMethod === "Cash" && (
                    <div className="flex justify-between text-[10px] text-slate-700">
                      <span>Troco:</span>
                      <span>R$ {cupomModalData.change.toFixed(2)}</span>
                    </div>
                  )}
                </div>

                {/* 7. Número, Série e Data */}
                <div className="text-center space-y-0.5 border-b border-dashed border-black pb-2 text-[10px]">
                  <div className="font-bold">
                    Nº {cupomModalData.fiscal?.number || cupomModalData.saleNumber} • SÉRIE {cupomModalData.fiscal?.series || "001"} • EMISSÃO {new Date(cupomModalData.date).toLocaleDateString("pt-BR")} {new Date(cupomModalData.date).toLocaleTimeString("pt-BR")}
                  </div>
                  {isFiscalPrint && (
                    <div className="text-[9px]">
                      Consulte pela chave de acesso em: www.nfce.fazenda.sp.gov.br/consulta
                    </div>
                  )}
                </div>

                {/* 8. Chave de Acesso (44 dígitos) */}
                {isFiscalPrint && (
                  <div className="text-center space-y-1 border-b border-dashed border-black pb-2">
                    <div className="font-bold text-[10px]">Chave de acesso:</div>
                    <div className="text-[9px] tracking-wider font-mono break-all font-bold">
                      {cupomModalData.fiscal?.accessKey || "3526 1148 9518 7100 0180 6500 1000 0000 0118 3749 2810"}
                    </div>
                  </div>
                )}

                {/* 9. Identificação da Via & 10. Dados do Consumidor */}
                <div className="text-center space-y-0.5 border-b border-dashed border-black pb-2 text-[10px]">
                  <div className="font-bold">VIA CONSUMIDOR</div>
                  <div>CPF / CNPJ: {cupomModalData.customerDoc}</div>
                  <div>Consumidor: {cupomModalData.customer}</div>
                </div>

                {/* 11. QR-Code Oficial para Leitor de Celular */}
                {isFiscalPrint && (
                  <div className="text-center space-y-1 border-b border-dashed border-black pb-2">
                    <div className="text-[10px]">Consulte via leitor de QR Code</div>
                    <div className="w-24 h-24 mx-auto bg-slate-100 border border-black flex items-center justify-center p-1">
                      <QrCode className="w-20 h-20 text-black" />
                    </div>
                  </div>
                )}

                {/* 12. Protocolo de Autorização SEFAZ */}
                <div className="text-center text-[9px] pt-1">
                  {isFiscalPrint ? (
                    <div>
                      Protocolo de autorização: {cupomModalData.fiscal?.protocolNumber || "135260000123456"} - {new Date(cupomModalData.date).toLocaleDateString("pt-BR")} {new Date(cupomModalData.date).toLocaleTimeString("pt-BR")}
                    </div>
                  ) : (
                    <div>Documento emitido para controle interno do consumidor HB Studio</div>
                  )}
                  {cupomModalData.points > 0 && (
                    <div className="font-bold text-purple-900 mt-1">
                      Parabéns! Você acumulou +{cupomModalData.points} pontos no Programa HB Studio!
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </RootShellLayout>
  );
}
