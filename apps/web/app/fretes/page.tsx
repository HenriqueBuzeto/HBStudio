"use client";

import React, { useState } from "react";
import RootShellLayout from "@/components/RootShellLayout";
import {
  Truck,
  MapPin,
  Fuel,
  Wrench,
  DollarSign,
  TrendingUp,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldCheck,
  ChevronRight,
  RefreshCw,
  Sliders,
  Sparkles,
  Calendar,
  FileText,
  User,
  CreditCard
} from "lucide-react";

interface Vehicle {
  id: string;
  plate: string;
  brand: string;
  model: string;
  year: number;
  ownership: string;
  fuel: string;
  currentOdometerKm: number;
  status: string;
  isAvailable: boolean;
}

interface Trip {
  id: string;
  tripNumber: string;
  vehicleId: string;
  vehiclePlate?: string;
  driverName: string;
  purpose: string;
  originCity: string;
  destinationCity: string;
  startOdometerKm: number;
  endOdometerKm?: number;
  distanceKm?: number;
  status: string;
  startedAtUtc: string;
  completedAtUtc?: string;
  notes?: string;
}

interface MaintenancePlan {
  id: string;
  vehicleId: string;
  planName: string;
  targetType: string;
  intervalKm?: number;
  intervalDays?: number;
  lastServiceOdometerKm?: number;
  nextServiceOdometerKm?: number;
  evaluationStatus: string; // UpToDate, Upcoming, Overdue
  kmRemaining?: number;
  daysRemaining?: number;
}

export default function FretesPage() {
  const [activeTab, setActiveTab] = useState<"trips" | "fueling" | "vehicles" | "maintenance" | "pricing">("trips");
  
  // Sem fixtures: toda informação de frota deve vir de persistência real.
  const [vehicles] = useState<Vehicle[]>([]);
  const [trips] = useState<Trip[]>([]);
  const [plans] = useState<MaintenancePlan[]>([]);

  // Modal states
  const [showNewTripModal, setShowNewTripModal] = useState(false);
  const [showFuelingModal, setShowFuelingModal] = useState(false);
  const [showCloseTripModal, setShowCloseTripModal] = useState<Trip | null>(null);

  // Forms
  const [newTripForm, setNewTripForm] = useState({
    vehicleId: "",
    driverName: "",
    purpose: "",
    originCity: "",
    destinationCity: "",
    startOdometerKm: 0,
    notes: ""
  });

  const [closeTripEndKm, setCloseTripEndKm] = useState(0);

  const [fuelingForm, setFuelingForm] = useState({
    vehicleId: "",
    totalAmount: 0,
    liters: "",
    fuelType: "Gasoline",
    paymentMethod: "CompanyPix",
    gasStationName: "",
    isTripDirectCost: true
  });

  // Simulador inicialmente vazio, sem inventar produto, IMEI ou custo
  const [pricingSim, setPricingSim] = useState({
    imei: "",
    model: "",
    baseCost: 0,
    freightAllocated: 0,
    targetAcquisitionDiscountPct: 0,
    targetMarkupPct: 0,
    maxCounterDiscountPct: 0,
    rounding: "EndingIn90"
  });

  // Calculate pricing simulation dynamically
  const totalBaseCost = pricingSim.baseCost + pricingSim.freightAllocated;
  const markupMultiplier = 1 + (pricingSim.targetMarkupPct / 100);
  const rawListPrice = totalBaseCost * markupMultiplier;
  
  let finalSuggestedPrice = rawListPrice;
  if (pricingSim.rounding === "EndingIn90") {
    finalSuggestedPrice = Math.floor(rawListPrice) + 0.90;
    if (finalSuggestedPrice < rawListPrice) finalSuggestedPrice += 1.00;
  } else if (pricingSim.rounding === "EndingIn99") {
    finalSuggestedPrice = Math.floor(rawListPrice) + 0.99;
    if (finalSuggestedPrice < rawListPrice) finalSuggestedPrice += 1.00;
  }

  const counterDiscountAmount = finalSuggestedPrice * (pricingSim.maxCounterDiscountPct / 100);
  const maxDiscountedPrice = finalSuggestedPrice - counterDiscountAmount;
  const profitAtMaxDiscount = maxDiscountedPrice - totalBaseCost;
  const marginPctAtMaxDiscount = maxDiscountedPrice > 0 ? (profitAtMaxDiscount / maxDiscountedPrice) * 100 : 0;

  // Bloquear escritas locais sem backend: nunca informar persistência fictícia.
  const handleCreateTrip = (e: React.FormEvent) => {
    e.preventDefault();
    window.alert("Cadastro de viagens indisponível até a integração com o Neon.");
  };

  const handleCloseTrip = (_trip: Trip) => {
    window.alert("Conclusão de viagens indisponível até a integração com o Neon.");
  };

  const handleCreateFueling = (e: React.FormEvent) => {
    e.preventDefault();
    window.alert("Lançamento de combustível indisponível até integração financeira real.");
  };

  return (
    <RootShellLayout>
      <div className="space-y-6">
        
        {/* Top Header Card estilo HBVisionX */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200/90 shadow-xs">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200">
                Logística & Frota
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                MOD-16 Enterprise
              </span>
            </div>
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900 mt-1">
              Gestão de Fretes, Frota & Custos de Deslocamento
            </h1>
            <p className="text-xs text-slate-500">
              Controle de viagens, abastecimentos, manutenção e rateio de frete. Integração de dados operacionais pendente.
            </p>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              disabled
              title="Aguardando integração com Neon"
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-900 transition-colors shadow-xs"
            >
              <Fuel className="w-3.5 h-3.5 text-amber-600" />
              <span>Abastecer (indisponível)</span>
            </button>
            <button
              disabled
              title="Aguardando integração com Neon"
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-purple-700 hover:from-violet-700 hover:to-purple-800 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-purple-600/20"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nova Viagem</span>
            </button>
          </div>
        </div>

        {/* KPI Cards Estilo HBVisionX */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
              <span>Frota Ativa</span>
              <div className="p-2 rounded-xl bg-purple-50 text-purple-700">
                <Truck className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-900 mt-2">
              —
            </div>
            <div className="text-xs text-emerald-600 font-semibold mt-1 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Dados de disponibilidade não integrados
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
              <span>Km Rodados no Mês</span>
              <div className="p-2 rounded-xl bg-cyan-50 text-cyan-700">
                <MapPin className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-900 mt-2">
              —
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Sem métricas integradas
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
              <span>Custo Total de Fretes</span>
              <div className="p-2 rounded-xl bg-amber-50 text-amber-700">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-900 mt-2">
              —
            </div>
            <div className="text-xs text-purple-600 font-semibold mt-1">
              Custo ainda não integrado
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
              <span>Semáforo de Manutenção</span>
              <div className="p-2 rounded-xl bg-rose-50 text-rose-700">
                <Wrench className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-amber-600 mt-2">
              —
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Sem histórico de manutenção integrado
            </div>
          </div>
        </div>

        {/* Tabs de Navegação Estilo HBVisionX */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-3 overflow-x-auto text-xs font-bold">
          <button
            onClick={() => setActiveTab("trips")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all ${
              activeTab === "trips"
                ? "bg-purple-600 text-white shadow-sm"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80"
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            Viagens & Deslocamentos
          </button>

          <button
            onClick={() => setActiveTab("fueling")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all ${
              activeTab === "fueling"
                ? "bg-purple-600 text-white shadow-sm"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80"
            }`}
          >
            <Fuel className="w-3.5 h-3.5" />
            Abastecimentos & Despesas
          </button>

          <button
            onClick={() => setActiveTab("vehicles")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all ${
              activeTab === "vehicles"
                ? "bg-purple-600 text-white shadow-sm"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80"
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            Frota & Hodômetros
          </button>

          <button
            onClick={() => setActiveTab("maintenance")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all ${
              activeTab === "maintenance"
                ? "bg-purple-600 text-white shadow-sm"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80"
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            Manutenção & Troca de Óleo
          </button>

          <button
            onClick={() => setActiveTab("pricing")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all ${
              activeTab === "pricing"
                ? "bg-gradient-to-r from-violet-600 to-purple-700 text-white shadow-sm"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            Motor de Precificação Inteligente
          </button>
        </div>

        {/* Tab 1: Viagens */}
        {activeTab === "trips" && (
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-extrabold text-slate-900">Registro de Viagens de Campo e Logística</h2>
                <p className="text-xs text-slate-500">Histórico de saídas, condutores e cálculo automático de quilometragem.</p>
              </div>
              <span className="text-xs font-bold text-slate-400">Total não integrado</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-bold text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Nº Viagem</th>
                    <th className="py-3 px-4">Veículo / Placa</th>
                    <th className="py-3 px-4">Condutor</th>
                    <th className="py-3 px-4">Finalidade</th>
                    <th className="py-3 px-4">Trajeto</th>
                    <th className="py-3 px-4 text-right">Hodômetros</th>
                    <th className="py-3 px-4 text-right">Distância</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {trips.length === 0 && (
                    <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-500">Nenhuma viagem cadastrada. Integração com Neon pendente.</td></tr>
                  )}
                  {trips.map((trip) => (
                    <tr key={trip.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-purple-700">
                        {trip.tripNumber}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-extrabold text-slate-900">{trip.vehiclePlate}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-700 font-medium">{trip.driverName}</td>
                      <td className="py-3 px-4 max-w-xs truncate text-slate-600" title={trip.purpose}>
                        {trip.purpose}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {trip.originCity} <ArrowRight className="inline w-3 h-3 text-purple-600" /> {trip.destinationCity}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-[11px]">
                        <div>Início: <span className="text-slate-800 font-bold">{trip.startOdometerKm.toLocaleString()} km</span></div>
                        {trip.endOdometerKm && (
                          <div>Fim: <span className="text-emerald-600 font-bold">{trip.endOdometerKm.toLocaleString()} km</span></div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-black text-slate-900 text-sm">
                        {trip.distanceKm ? `${trip.distanceKm} km` : "—"}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {trip.status === "Completed" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Concluída
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
                            Em Andamento
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {trip.status === "InProgress" && (
                          <button
                            onClick={() => {
                              setCloseTripEndKm(trip.startOdometerKm + 50);
                              setShowCloseTripModal(trip);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-all"
                          >
                            Concluir Viagem
                          </button>
                        )}
                        {trip.status === "Completed" && (
                          <span className="text-[11px] font-semibold text-slate-400">Auditada</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Abastecimentos */}
        {activeTab === "fueling" && (
          <div className="space-y-4">
            <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200">
              <h3 className="text-sm font-bold text-amber-900 flex items-center gap-2">
                <Fuel className="w-4 h-4 text-amber-600" />
                Regra de Abastecimento Rápido da HB Studio
              </h3>
              <p className="text-xs text-amber-800 mt-1">
                O lançamento de despesas ficará disponível somente após integrar frota, financeiro e DRE ao Neon.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 space-y-4">
              <h4 className="text-sm font-extrabold text-slate-900">Últimos Lançamentos de Combustível & Despesas</h4>
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-5 text-xs text-slate-500">
                Nenhum lançamento demonstrativo será exibido. Histórico aguardando integração com Neon.
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Veículos */}
        {activeTab === "vehicles" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {vehicles.length === 0 && (
              <div className="col-span-full rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500 text-sm">
                Nenhum veículo cadastrado. Integração com Neon pendente.
              </div>
            )}
            {vehicles.map((v) => (
              <div key={v.id} className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-900 font-mono font-black text-sm border border-slate-200">
                      {v.plate}
                    </span>
                    <h3 className="text-base font-extrabold text-slate-900 mt-2">{v.brand} {v.model}</h3>
                    <p className="text-xs text-slate-500">Ano: {v.year} • Combustível: {v.fuel} • Propriedade: HB Studio</p>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {v.status}
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                  <div className="text-xs text-slate-600 flex items-center justify-between">
                    <span className="font-medium">Hodômetro Atual:</span>
                    <span className="font-mono font-black text-slate-900 text-base">{v.currentOdometerKm.toLocaleString()} km</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div className="bg-purple-600 h-2 rounded-full" style={{ width: "65%" }}></div>
                  </div>
                  <div className="text-[11px] text-slate-500 flex justify-between">
                    <span>Última revisão: 50.000 km</span>
                    <span className="font-semibold text-purple-700">Próxima troca de óleo: 60.000 km</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab 4: Manutenção */}
        {activeTab === "maintenance" && (
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <Wrench className="w-4 h-4 text-purple-600" />
              Semáforo Preventivo de Manutenção & Troca de Óleo
            </h3>

            <div className="space-y-3">
              {plans.length === 0 && (
              <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-slate-500 text-sm">
                Nenhum plano de manutenção cadastrado. Integração com Neon pendente.
              </div>
            )}
            {plans.map((p) => {
                const isOverdue = p.evaluationStatus === "Overdue";
                const isUpcoming = p.evaluationStatus === "Upcoming";

                return (
                  <div
                    key={p.id}
                    className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                      isOverdue
                        ? "bg-rose-50 border-rose-200"
                        : isUpcoming
                        ? "bg-amber-50 border-amber-200"
                        : "bg-emerald-50 border-emerald-200"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${
                          isOverdue ? "bg-rose-600 animate-ping" : isUpcoming ? "bg-amber-500" : "bg-emerald-500"
                        }`} />
                        <h4 className="text-sm font-bold text-slate-900">{p.planName}</h4>
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Intervalo: a cada {p.intervalKm?.toLocaleString()} km ou {p.intervalDays} dias
                      </p>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <div className="text-[11px] text-slate-500">Restante para revisão:</div>
                        <div className={`text-sm font-mono font-extrabold ${
                          isOverdue ? "text-rose-700" : isUpcoming ? "text-amber-800" : "text-emerald-700"
                        }`}>
                          {p.kmRemaining?.toLocaleString()} km • {p.daysRemaining} dias
                        </div>
                      </div>

                      <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                        isOverdue
                          ? "bg-rose-100 text-rose-800 border-rose-300"
                          : isUpcoming
                          ? "bg-amber-100 text-amber-800 border-amber-300"
                          : "bg-emerald-100 text-emerald-800 border-emerald-300"
                      }`}>
                        {isOverdue ? "VENCIDA" : isUpcoming ? "PRÓXIMA" : "EM DIA"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 5: Precificação Inteligente */}
        {activeTab === "pricing" && (
          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-gradient-to-r from-purple-50 via-indigo-50 to-purple-50 border border-purple-200">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-700 border border-purple-200 mb-2">
                <Sparkles className="w-3.5 h-3.5" /> MOTOR ENTERPRISE DE PRECIFICAÇÃO DINÂMICA
              </div>
              <h2 className="text-lg font-extrabold text-slate-900">
                Composição Exata: Custo de Aquisição + Rateio de Frete + Margem Alvo
              </h2>
              <p className="text-xs text-slate-600 max-w-3xl mt-1">
                Conforme o CPC 16(R1), o frete de retirada integra o custo de estoque do celular. O motor calcula o preço sugerido de vitrine garantindo a margem da empresa mesmo com o desconto negociado em balcão.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Parâmetros */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-purple-600" />
                  Parâmetros do Aparelho & Política
                </h3>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Aparelho Selecionado</label>
                    <input
                      type="text"
                      value={pricingSim.model}
                      readOnly
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-semibold"
                    />
                    <span className="text-[11px] text-slate-400 font-mono mt-0.5 block">IMEI: {pricingSim.imei}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Custo Compra (R$)</label>
                      <input
                        type="number"
                        value={pricingSim.baseCost}
                        onChange={(e) => setPricingSim({ ...pricingSim, baseCost: Number(e.target.value) })}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono text-slate-900 font-bold"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Frete Rateado (R$)</label>
                      <input
                        type="number"
                        value={pricingSim.freightAllocated}
                        onChange={(e) => setPricingSim({ ...pricingSim, freightAllocated: Number(e.target.value) })}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono text-cyan-700 font-bold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Desc. Compra (%)</label>
                      <input
                        type="number"
                        value={pricingSim.targetAcquisitionDiscountPct}
                        onChange={(e) => setPricingSim({ ...pricingSim, targetAcquisitionDiscountPct: Number(e.target.value) })}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono text-slate-900"
                        title="Desconto-alvo para negociar a compra de usados"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Markup (%)</label>
                      <input
                        type="number"
                        value={pricingSim.targetMarkupPct}
                        onChange={(e) => setPricingSim({ ...pricingSim, targetMarkupPct: Number(e.target.value) })}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono text-emerald-700 font-bold"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Desc. Balcão (%)</label>
                      <input
                        type="number"
                        value={pricingSim.maxCounterDiscountPct}
                        onChange={(e) => setPricingSim({ ...pricingSim, maxCounterDiscountPct: Number(e.target.value) })}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono text-amber-700 font-bold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Arredondamento Comercial</label>
                    <select
                      value={pricingSim.rounding}
                      onChange={(e) => setPricingSim({ ...pricingSim, rounding: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800"
                    >
                      <option value="EndingIn90">Terminação Comercial em ,90 (Ex: R$ 4.999,90)</option>
                      <option value="EndingIn99">Terminação Comercial em ,99 (Ex: R$ 4.999,99)</option>
                      <option value="Exact">Exato sem Arredondamento</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Memória de Cálculo */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 mb-4">Memória de Cálculo Auditável</h3>
                  
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-500">Custo Base de Compra:</span>
                      <span className="font-mono text-slate-800 font-semibold">R$ {pricingSim.baseCost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-500">(+) Frete Rateado (Viagem SP):</span>
                      <span className="font-mono text-cyan-700 font-semibold">R$ {pricingSim.freightAllocated.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-100 font-bold">
                      <span className="text-slate-900">(=) Custo Contábil de Estoque:</span>
                      <span className="font-mono text-emerald-700">R$ {totalBaseCost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-500">(+) Markup de Revenda ({pricingSim.targetMarkupPct}%):</span>
                      <span className="font-mono text-slate-800">R$ {(finalSuggestedPrice - totalBaseCost).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-500">(-) Desconto Máx. Balcão ({pricingSim.maxCounterDiscountPct}%):</span>
                      <span className="font-mono text-amber-700">- R$ {counterDiscountAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-100 text-slate-500">
                      <span>Rentabilidade no Pior Cenário de Balcão:</span>
                      <span className="font-mono text-emerald-700 font-bold">{marginPctAtMaxDiscount.toFixed(1)}% líquida</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 p-4 rounded-xl bg-purple-50 border border-purple-200 text-center">
                  <span className="text-[10px] uppercase font-bold text-purple-700 tracking-wider">
                    Preço Sugerido de Vitrine (PDV / Catálogo)
                  </span>
                  <div className="text-3xl font-black text-slate-900 mt-1">
                    R$ {finalSuggestedPrice.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-2">
                    Preço piso no balcão: <strong className="text-amber-800">R$ {maxDiscountedPrice.toFixed(2)}</strong>.
                    Mesmo com o desconto máximo permitido de {pricingSim.maxCounterDiscountPct}%, a empresa retém <strong className="text-emerald-700 font-bold">R$ {profitAtMaxDiscount.toFixed(2)} ({marginPctAtMaxDiscount.toFixed(1)}%)</strong> de lucro líquido!
                  </p>
                  <button
                    disabled title="Precificação ainda não vinculada ao Catálogo e PDV reais"
                    className="mt-3.5 w-full py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-700 hover:from-violet-700 hover:to-purple-800 text-white font-bold text-xs transition-all shadow-md shadow-purple-600/20"
                  >
                    Aprovar & Publicar no Catálogo / PDV
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Iniciar Viagem */}
        {showNewTripModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
            <div className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 p-6 shadow-xl space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <h3 className="text-sm font-extrabold text-slate-900">Iniciar Viagem de Campo</h3>
                <button onClick={() => setShowNewTripModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
              </div>

              <form onSubmit={handleCreateTrip} className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Veículo</label>
                  <select
                    value={newTripForm.vehicleId}
                    onChange={(e) => setNewTripForm({ ...newTripForm, vehicleId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
                  >
                    {vehicles.map(v => (
                      <option key={v.id} value={v.id}>{v.brand} {v.model} ({v.plate})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Condutor</label>
                  <input
                    type="text"
                    value={newTripForm.driverName}
                    onChange={(e) => setNewTripForm({ ...newTripForm, driverName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
                    required
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Finalidade</label>
                  <input
                    type="text"
                    value={newTripForm.purpose}
                    onChange={(e) => setNewTripForm({ ...newTripForm, purpose: e.target.value })}
                    placeholder="Ex: Retirada de iPhone em São Paulo"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Cidade Origem</label>
                    <input
                      type="text"
                      value={newTripForm.originCity}
                      onChange={(e) => setNewTripForm({ ...newTripForm, originCity: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
                      required
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Cidade Destino</label>
                    <input
                      type="text"
                      value={newTripForm.destinationCity}
                      onChange={(e) => setNewTripForm({ ...newTripForm, destinationCity: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Hodômetro Inicial (km)</label>
                  <input
                    type="number"
                    value={newTripForm.startOdometerKm}
                    onChange={(e) => setNewTripForm({ ...newTripForm, startOdometerKm: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900"
                    required
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowNewTripModal(false)}
                    className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-gradient-to-r from-violet-600 to-purple-700 text-white rounded-xl text-xs font-bold shadow-md shadow-purple-600/20"
                  >
                    Registrar Saída
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Concluir Viagem */}
        {showCloseTripModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
            <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 p-6 shadow-xl space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <h3 className="text-sm font-extrabold text-slate-900">Concluir Viagem {showCloseTripModal.tripNumber}</h3>
                <button onClick={() => setShowCloseTripModal(null)} className="text-slate-400 hover:text-slate-600">✕</button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 space-y-1">
                  <div>Veículo: <strong className="text-slate-900">{showCloseTripModal.vehiclePlate}</strong></div>
                  <div>Hodômetro Inicial: <strong className="text-slate-900">{showCloseTripModal.startOdometerKm.toLocaleString()} km</strong></div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Hodômetro Final (km)</label>
                  <input
                    type="number"
                    value={closeTripEndKm}
                    onChange={(e) => setCloseTripEndKm(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono text-slate-900 font-bold"
                    min={showCloseTripModal.startOdometerKm}
                  />
                </div>

                <div className="p-3 rounded-xl bg-purple-50 border border-purple-200 text-center">
                  <div className="text-[11px] font-bold text-purple-700">Distância Calculada</div>
                  <div className="text-2xl font-black text-slate-900">
                    {Math.max(0, closeTripEndKm - showCloseTripModal.startOdometerKm)} km
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowCloseTripModal(null)}
                    className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCloseTrip(showCloseTripModal)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs"
                  >
                    Finalizar & Gravar Km
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Abastecimento Rápido */}
        {showFuelingModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
            <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 p-6 shadow-xl space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <Fuel className="w-4 h-4 text-amber-600" />
                  Lançamento Rápido de Combustível
                </h3>
                <button onClick={() => setShowFuelingModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
              </div>

              <form onSubmit={handleCreateFueling} className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Veículo</label>
                  <select
                    value={fuelingForm.vehicleId}
                    onChange={(e) => setFuelingForm({ ...fuelingForm, vehicleId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
                  >
                    {vehicles.map(v => (
                      <option key={v.id} value={v.id}>{v.brand} {v.model} ({v.plate})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Valor Total Pago (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={fuelingForm.totalAmount}
                    onChange={(e) => setFuelingForm({ ...fuelingForm, totalAmount: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-base font-black text-emerald-600"
                    required
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Litros Abastecidos (Opcional)</label>
                  <input
                    type="number"
                    step="0.001"
                    placeholder="Deixe em branco se abasteceu sem olhar os litros"
                    value={fuelingForm.liters}
                    onChange={(e) => setFuelingForm({ ...fuelingForm, liters: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Forma de Pagamento</label>
                  <select
                    value={fuelingForm.paymentMethod}
                    onChange={(e) => setFuelingForm({ ...fuelingForm, paymentMethod: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800"
                  >
                    <option value="CompanyPix">Pix da Empresa (Débito Imediato)</option>
                    <option value="PartnerReimbursement">Pago pelo Sócio (Reembolso Societário)</option>
                    <option value="CompanyCreditCard">Cartão Corporativo (Contas a Pagar)</option>
                    <option value="Cash">Dinheiro Físico do Caixa</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Posto / Local</label>
                  <input
                    type="text"
                    value={fuelingForm.gasStationName}
                    onChange={(e) => setFuelingForm({ ...fuelingForm, gasStationName: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowFuelingModal(false)}
                    className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs"
                  >
                    Salvar Abastecimento
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
