"use client";

import React, { useState, useEffect } from "react";
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
  Sparkles
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
  
  // Data states
  const [vehicles, setVehicles] = useState<Vehicle[]>([
    {
      id: "veh-1",
      plate: "BRA2E19",
      brand: "Volkswagen",
      model: "Gol 1.0 Flex",
      year: 2022,
      ownership: "CompanyOwned",
      fuel: "Flex",
      currentOdometerKm: 54300,
      status: "Active",
      isAvailable: true
    },
    {
      id: "veh-2",
      plate: "RIO1A23",
      brand: "Fiat",
      model: "Fiorino 1.4 EVO",
      year: 2023,
      ownership: "CompanyOwned",
      fuel: "Flex",
      currentOdometerKm: 32150,
      status: "Active",
      isAvailable: true
    }
  ]);

  const [trips, setTrips] = useState<Trip[]>([
    {
      id: "trip-1",
      tripNumber: "VIG-202611-0001",
      vehicleId: "veh-1",
      vehiclePlate: "BRA2E19",
      driverName: "Henrique Barreto",
      purpose: "Retirada de Lote de iPhones Usados em São Paulo",
      originCity: "Campinas",
      destinationCity: "São Paulo",
      startOdometerKm: 54200,
      endOdometerKm: 54300,
      distanceKm: 100,
      status: "Completed",
      startedAtUtc: "2026-11-16T10:00:00Z",
      completedAtUtc: "2026-11-16T13:30:00Z",
      notes: "Viagem concluída. 5 iPhones 14 Pro 128GB coletados e inspecionados."
    }
  ]);

  const [plans, setPlans] = useState<MaintenancePlan[]>([
    {
      id: "plan-1",
      vehicleId: "veh-1",
      planName: "Troca de Óleo Motor 5W30 + Filtros",
      targetType: "OilChange",
      intervalKm: 10000,
      intervalDays: 180,
      lastServiceOdometerKm: 50000,
      nextServiceOdometerKm: 60000,
      evaluationStatus: "UpToDate",
      kmRemaining: 5700,
      daysRemaining: 120
    },
    {
      id: "plan-2",
      vehicleId: "veh-2",
      planName: "Revisão Freios e Pastilhas",
      targetType: "Brakes",
      intervalKm: 20000,
      intervalDays: 365,
      lastServiceOdometerKm: 15000,
      nextServiceOdometerKm: 35000,
      evaluationStatus: "Upcoming",
      kmRemaining: 2850,
      daysRemaining: 25
    }
  ]);

  // Modal states
  const [showNewTripModal, setShowNewTripModal] = useState(false);
  const [showFuelingModal, setShowFuelingModal] = useState(false);
  const [showCloseTripModal, setShowCloseTripModal] = useState<Trip | null>(null);

  // Forms
  const [newTripForm, setNewTripForm] = useState({
    vehicleId: "veh-1",
    driverName: "Henrique Barreto",
    purpose: "Retirada de Aparelhos",
    originCity: "Campinas",
    destinationCity: "São Paulo",
    startOdometerKm: 54300,
    notes: ""
  });

  const [closeTripEndKm, setCloseTripEndKm] = useState(54400);

  const [fuelingForm, setFuelingForm] = useState({
    vehicleId: "veh-1",
    totalAmount: 50.00,
    liters: "",
    fuelType: "Gasoline",
    paymentMethod: "CompanyPix",
    gasStationName: "Posto Shell Rodoanel",
    isTripDirectCost: true
  });

  // Precificação Inteligente Demo State
  const [pricingSim, setPricingSim] = useState({
    imei: "354891092837481",
    model: "iPhone 14 Pro 128GB Roxo Profundo",
    baseCost: 3200.00,
    freightAllocated: 75.00,
    targetDiscountPct: 15.0,
    targetMarkupPct: 30.0,
    rounding: "EndingIn90"
  });

  // Calculate pricing simulation dynamically
  const totalBaseCost = pricingSim.baseCost + pricingSim.freightAllocated;
  const markupMultiplier = 1 + (pricingSim.targetMarkupPct / 100);
  const rawTargetNet = totalBaseCost * markupMultiplier;
  const discountMultiplier = 1 - (pricingSim.targetDiscountPct / 100);
  const rawListPrice = discountMultiplier > 0 ? (rawTargetNet / discountMultiplier) : rawTargetNet;
  
  let finalSuggestedPrice = rawListPrice;
  if (pricingSim.rounding === "EndingIn90") {
    finalSuggestedPrice = Math.floor(rawListPrice) + 0.90;
    if (finalSuggestedPrice < rawListPrice) finalSuggestedPrice += 1.00;
  } else if (pricingSim.rounding === "EndingIn99") {
    finalSuggestedPrice = Math.floor(rawListPrice) + 0.99;
    if (finalSuggestedPrice < rawListPrice) finalSuggestedPrice += 1.00;
  }

  const handleCreateTrip = (e: React.FormEvent) => {
    e.preventDefault();
    const created: Trip = {
      id: `trip-${Date.now()}`,
      tripNumber: `VIG-202611-${String(trips.length + 1).padStart(4, "0")}`,
      vehicleId: newTripForm.vehicleId,
      vehiclePlate: vehicles.find(v => v.id === newTripForm.vehicleId)?.plate || "BRA2E19",
      driverName: newTripForm.driverName,
      purpose: newTripForm.purpose,
      originCity: newTripForm.originCity,
      destinationCity: newTripForm.destinationCity,
      startOdometerKm: Number(newTripForm.startOdometerKm),
      status: "InProgress",
      startedAtUtc: new Date().toISOString(),
      notes: newTripForm.notes
    };
    setTrips([created, ...trips]);
    setShowNewTripModal(false);
  };

  const handleCloseTrip = (trip: Trip) => {
    const endKm = Number(closeTripEndKm);
    const dist = endKm - trip.startOdometerKm;
    setTrips(trips.map(t => t.id === trip.id ? {
      ...t,
      status: "Completed",
      endOdometerKm: endKm,
      distanceKm: dist,
      completedAtUtc: new Date().toISOString()
    } : t));

    // Atualiza hodometro do veiculo
    setVehicles(vehicles.map(v => v.id === trip.vehicleId ? { ...v, currentOdometerKm: endKm } : v));
    setShowCloseTripModal(null);
  };

  const handleCreateFueling = (e: React.FormEvent) => {
    e.preventDefault();
    alert(`Abastecimento registrado com sucesso!\nValor: R$ ${fuelingForm.totalAmount.toFixed(2)}\nForma de Pagamento: ${fuelingForm.paymentMethod}\nFinanceiro e DRE alimentados sem duplicidade.`);
    setShowFuelingModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-2">
            <Truck className="w-3.5 h-3.5" />
            MOD-16 • LOGÍSTICA & FRETES ENTERPRISE
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
            Gestão de Fretes, Frota & Custos de Deslocamento
          </h1>
          <p className="text-sm text-slate-400">
            Controle de veículos, viagens, abastecimentos rápidos (R$ 50), planos de manutenção e rateio de frete para composição de custo e precificação inteligente.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowFuelingModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-sm font-semibold transition-all shadow-sm"
          >
            <Fuel className="w-4 h-4 text-amber-400" />
            Abastecimento Rápido (R$ 50)
          </button>
          <button
            onClick={() => setShowNewTripModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold transition-all shadow-lg shadow-purple-600/30"
          >
            <Plus className="w-4 h-4" />
            Iniciar Nova Viagem
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-md">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Frota Ativa</span>
            <Truck className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-2">
            {vehicles.length} Veículos
          </div>
          <div className="text-xs text-emerald-400 mt-1 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> 100% Operacionais & Disponíveis
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-md">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Km Rodados no Mês</span>
            <MapPin className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-2">
            1.420 km
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Média de 71 km por deslocamento
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-md">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Custo Total de Fretes</span>
            <DollarSign className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-2">
            R$ 890,00
          </div>
          <div className="text-xs text-cyan-400 mt-1">
            Alocados em compras e entregas
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-md">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Semáforo de Manutenção</span>
            <Wrench className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400 mt-2">
            1 Próxima
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Óleo em dia • Freios a revisar
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab("trips")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            activeTab === "trips"
              ? "bg-purple-600 text-white shadow-md shadow-purple-600/20"
              : "text-slate-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <MapPin className="w-4 h-4" />
          Viagens & Deslocamentos
        </button>

        <button
          onClick={() => setActiveTab("fueling")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            activeTab === "fueling"
              ? "bg-purple-600 text-white shadow-md shadow-purple-600/20"
              : "text-slate-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <Fuel className="w-4 h-4" />
          Abastecimentos & Despesas
        </button>

        <button
          onClick={() => setActiveTab("vehicles")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            activeTab === "vehicles"
              ? "bg-purple-600 text-white shadow-md shadow-purple-600/20"
              : "text-slate-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <Truck className="w-4 h-4" />
          Frota & Hodômetros
        </button>

        <button
          onClick={() => setActiveTab("maintenance")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            activeTab === "maintenance"
              ? "bg-purple-600 text-white shadow-md shadow-purple-600/20"
              : "text-slate-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <Wrench className="w-4 h-4" />
          Manutenção & Troca de Óleo
        </button>

        <button
          onClick={() => setActiveTab("pricing")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            activeTab === "pricing"
              ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-600/20"
              : "text-slate-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <Sparkles className="w-4 h-4 text-amber-300" />
          Motor de Precificação Inteligente
        </button>
      </div>

      {/* Tab: Viagens */}
      {activeTab === "trips" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">Registro de Viagens de Campo e Logística</h2>
              <span className="text-xs text-slate-400">Total: {trips.length} viagens registradas</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-white/[0.03] text-xs font-semibold uppercase text-slate-400 border-b border-white/10">
                  <tr>
                    <th className="px-4 py-3">Nº Viagem</th>
                    <th className="px-4 py-3">Veículo / Placa</th>
                    <th className="px-4 py-3">Condutor</th>
                    <th className="px-4 py-3">Finalidade</th>
                    <th className="px-4 py-3">Trajeto</th>
                    <th className="px-4 py-3 text-right">Hodômetros</th>
                    <th className="px-4 py-3 text-right">Distância</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {trips.map((trip) => (
                    <tr key={trip.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3.5 font-mono text-purple-400 font-medium">
                        {trip.tripNumber}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="font-semibold text-white">{trip.vehiclePlate}</span>
                      </td>
                      <td className="px-4 py-3.5">{trip.driverName}</td>
                      <td className="px-4 py-3.5 max-w-xs truncate text-slate-300" title={trip.purpose}>
                        {trip.purpose}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-400">
                        {trip.originCity} <ArrowRight className="inline w-3 h-3 text-purple-400" /> {trip.destinationCity}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-xs">
                        <div>Início: <span className="text-white">{trip.startOdometerKm.toLocaleString()} km</span></div>
                        {trip.endOdometerKm && (
                          <div>Fim: <span className="text-emerald-400">{trip.endOdometerKm.toLocaleString()} km</span></div>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right font-bold text-white">
                        {trip.distanceKm ? `${trip.distanceKm} km` : "—"}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        {trip.status === "Completed" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Concluída
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse">
                            Em Andamento
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        {trip.status === "InProgress" && (
                          <button
                            onClick={() => {
                              setCloseTripEndKm(trip.startOdometerKm + 50);
                              setShowCloseTripModal(trip);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-all"
                          >
                            Concluir Viagem
                          </button>
                        )}
                        {trip.status === "Completed" && (
                          <span className="text-xs text-slate-500">Auditada</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Abastecimentos */}
      {activeTab === "fueling" && (
        <div className="space-y-4">
          <div className="p-5 rounded-2xl bg-amber-500/[0.04] border border-amber-500/20">
            <h3 className="text-base font-bold text-amber-300 flex items-center gap-2">
              <Fuel className="w-5 h-5 text-amber-400" />
              Regra de Abastecimento Rápido da HB Studio
            </h3>
            <p className="text-xs text-slate-300 mt-1">
              "Abasteci R$ 50,00 de gasolina no posto sem olhar os litros". O sistema aceita lançamentos sem litros obrigatórios, registra a despesa na DRE, atualiza o financeiro conforme a forma de pagamento (se pago por sócio, entra como reembolso societário sem duplicar despesa).
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <h4 className="text-sm font-semibold text-white mb-3">Últimos Lançamentos de Combustível</h4>
            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                    <Fuel className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">Posto Shell Rodoanel • Gasolina Comum</div>
                    <div className="text-xs text-slate-400">Veículo: Gol 1.0 Flex (BRA2E19) • Condutor: Henrique Barreto</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-emerald-400">R$ 50,00</div>
                  <div className="text-xs text-slate-400">Pix Empresa (Liquidado à Vista)</div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">Pedágio Rodovia dos Bandeirantes</div>
                    <div className="text-xs text-slate-400">Despesa de Viagem: Retirada de iPhones em SP</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-white">R$ 12,40</div>
                  <div className="text-xs text-purple-300">Sem Parar (A Pagar na Fatura)</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Veículos */}
      {activeTab === "vehicles" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {vehicles.map((v) => (
            <div key={v.id} className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <span className="px-2.5 py-1 rounded-md bg-white/10 text-white font-mono font-bold text-sm border border-white/20">
                    {v.plate}
                  </span>
                  <h3 className="text-lg font-bold text-white mt-2">{v.brand} {v.model}</h3>
                  <p className="text-xs text-slate-400">Ano: {v.year} • Combustível: {v.fuel} • Propriedade: HB Studio</p>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {v.status}
                </span>
              </div>

              <div className="p-4 rounded-xl bg-black/30 border border-white/5 space-y-2">
                <div className="text-xs text-slate-400 flex items-center justify-between">
                  <span>Hodômetro Oficial:</span>
                  <span className="font-mono font-bold text-white text-base">{v.currentOdometerKm.toLocaleString()} km</span>
                </div>
                <div className="w-full bg-white/5 rounded-full h-2">
                  <div className="bg-purple-500 h-2 rounded-full" style={{ width: "65%" }}></div>
                </div>
                <div className="text-[11px] text-slate-500 flex justify-between">
                  <span>Última revisão: 50.000 km</span>
                  <span>Próxima troca de óleo: 60.000 km</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Manutenção */}
      {activeTab === "maintenance" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <h3 className="text-base font-bold text-white flex items-center gap-2 mb-4">
              <Wrench className="w-5 h-5 text-purple-400" />
              Semáforo Preventivo de Manutenção & Troca de Óleo
            </h3>

            <div className="space-y-3">
              {plans.map((p) => {
                const isOverdue = p.evaluationStatus === "Overdue";
                const isUpcoming = p.evaluationStatus === "Upcoming";
                const isOk = p.evaluationStatus === "UpToDate";

                return (
                  <div
                    key={p.id}
                    className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                      isOverdue
                        ? "bg-rose-500/5 border-rose-500/30"
                        : isUpcoming
                        ? "bg-amber-500/5 border-amber-500/30"
                        : "bg-emerald-500/5 border-emerald-500/20"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${
                          isOverdue ? "bg-rose-500 animate-ping" : isUpcoming ? "bg-amber-400" : "bg-emerald-400"
                        }`} />
                        <h4 className="text-sm font-bold text-white">{p.planName}</h4>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        Intervalo: a cada {p.intervalKm?.toLocaleString()} km ou {p.intervalDays} dias
                      </p>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <div className="text-xs text-slate-400">Restante para revisão:</div>
                        <div className={`text-sm font-mono font-bold ${
                          isOverdue ? "text-rose-400" : isUpcoming ? "text-amber-300" : "text-emerald-400"
                        }`}>
                          {p.kmRemaining?.toLocaleString()} km • {p.daysRemaining} dias
                        </div>
                      </div>

                      <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                        isOverdue
                          ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                          : isUpcoming
                          ? "bg-amber-500/10 text-amber-300 border-amber-500/30"
                          : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      }`}>
                        {isOverdue ? "VENCIDA" : isUpcoming ? "PRÓXIMA" : "EM DIA"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Precificação Inteligente */}
      {activeTab === "pricing" && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-gradient-to-r from-purple-950/40 via-indigo-950/30 to-purple-950/40 border border-purple-500/30 relative overflow-hidden">
            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-amber-400/10 text-amber-300 border border-amber-400/20 mb-2">
                <Sparkles className="w-3.5 h-3.5" /> MOTOR ENTERPRISE DE PRECIFICAÇÃO DINÂMICA
              </div>
              <h2 className="text-xl font-bold text-white">
                Composição Exata: Custo de Aquisição + Rateio de Frete + Margem Alvo
              </h2>
              <p className="text-sm text-slate-300 max-w-3xl mt-1">
                Conforme o CPC 16(R1), o custo do produto engloba o preço pago ao fornecedor/cliente usado mais o frete de retirada rateado. O preço sugerido de vitrine protege a margem líquida da empresa mesmo após o desconto negociado no balcão.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Parâmetros de Simulação */}
            <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-purple-400" />
                Parâmetros do Aparelho & Política
              </h3>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-400">Aparelho Selecionado</label>
                  <input
                    type="text"
                    value={pricingSim.model}
                    readOnly
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white font-medium"
                  />
                  <span className="text-[11px] text-slate-500 font-mono">IMEI: {pricingSim.imei}</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-400">Custo de Aquisição (R$)</label>
                    <input
                      type="number"
                      value={pricingSim.baseCost}
                      onChange={(e) => setPricingSim({ ...pricingSim, baseCost: Number(e.target.value) })}
                      className="w-full mt-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-400">Frete Alocado (R$)</label>
                    <input
                      type="number"
                      value={pricingSim.freightAllocated}
                      onChange={(e) => setPricingSim({ ...pricingSim, freightAllocated: Number(e.target.value) })}
                      className="w-full mt-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-400">Margem Markup Desejada (%)</label>
                    <input
                      type="number"
                      value={pricingSim.targetMarkupPct}
                      onChange={(e) => setPricingSim({ ...pricingSim, targetMarkupPct: Number(e.target.value) })}
                      className="w-full mt-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-400">Margem de Negociação / Choro (%)</label>
                    <input
                      type="number"
                      value={pricingSim.targetDiscountPct}
                      onChange={(e) => setPricingSim({ ...pricingSim, targetDiscountPct: Number(e.target.value) })}
                      className="w-full mt-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400">Regra de Arredondamento Comercial</label>
                  <select
                    value={pricingSim.rounding}
                    onChange={(e) => setPricingSim({ ...pricingSim, rounding: e.target.value })}
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-sm text-white"
                  >
                    <option value="EndingIn90">Terminação Comercial em ,90 (Ex: R$ 4.999,90)</option>
                    <option value="EndingIn99">Terminação Comercial em ,99 (Ex: R$ 4.999,99)</option>
                    <option value="Exact">Exato sem Arredondamento</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Memória de Cálculo & Preço Sugerido */}
            <div className="p-5 rounded-2xl bg-gradient-to-b from-white/[0.04] to-white/[0.01] border border-white/10 flex flex-col justify-between">
              <div>
                <h3 className="text-base font-bold text-white mb-4">Memória de Cálculo Auditável</h3>
                
                <div className="space-y-2.5 text-sm">
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-slate-400">Custo Base de Compra:</span>
                    <span className="font-mono text-white">R$ {pricingSim.baseCost.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-slate-400">(+) Frete Rateado (Viagem SP):</span>
                    <span className="font-mono text-cyan-400">R$ {pricingSim.freightAllocated.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5 font-semibold">
                    <span className="text-white">(=) Custo Contábil de Estoque:</span>
                    <span className="font-mono text-emerald-400">R$ {totalBaseCost.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-slate-400">(+) Lucro Mínimo ({pricingSim.targetMarkupPct}%):</span>
                    <span className="font-mono text-white">R$ {(rawTargetNet - totalBaseCost).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-slate-400">(+) Margem de Desconto ({pricingSim.targetDiscountPct}%):</span>
                    <span className="font-mono text-amber-300">R$ {(rawListPrice - rawTargetNet).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 p-4 rounded-xl bg-purple-600/10 border border-purple-500/30 text-center">
                <span className="text-xs uppercase font-semibold text-purple-300 tracking-wider">
                  Preço Sugerido de Vitrine (PDV / Catálogo)
                </span>
                <div className="text-3xl font-extrabold text-white mt-1">
                  R$ {finalSuggestedPrice.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  Se o cliente pedir o desconto máximo de {pricingSim.targetDiscountPct}%, o aparelho sai a 
                  <strong className="text-emerald-400"> R$ {(finalSuggestedPrice * (1 - pricingSim.targetDiscountPct / 100)).toFixed(2)}</strong>, 
                  garantindo integralmente os {pricingSim.targetMarkupPct}% de lucro líquido da empresa!
                </p>
                <button
                  onClick={() => alert("Preço aprovado pelo sócio! Atualizado oficialmente no Catálogo e PDV Balcão sem expor custos ao cliente.")}
                  className="mt-4 w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-sm transition-all shadow-md shadow-purple-600/30"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-white/10 p-6 space-y-4">
            <h3 className="text-lg font-bold text-white">Iniciar Viagem de Campo</h3>
            <form onSubmit={handleCreateTrip} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-300">Veículo</label>
                <select
                  value={newTripForm.vehicleId}
                  onChange={(e) => setNewTripForm({ ...newTripForm, vehicleId: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white"
                >
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>{v.brand} {v.model} ({v.plate})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300">Condutor</label>
                <input
                  type="text"
                  value={newTripForm.driverName}
                  onChange={(e) => setNewTripForm({ ...newTripForm, driverName: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300">Finalidade</label>
                <input
                  type="text"
                  value={newTripForm.purpose}
                  onChange={(e) => setNewTripForm({ ...newTripForm, purpose: e.target.value })}
                  placeholder="Ex: Retirada de iPhone em São Paulo"
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300">Cidade Origem</label>
                  <input
                    type="text"
                    value={newTripForm.originCity}
                    onChange={(e) => setNewTripForm({ ...newTripForm, originCity: e.target.value })}
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300">Cidade Destino</label>
                  <input
                    type="text"
                    value={newTripForm.destinationCity}
                    onChange={(e) => setNewTripForm({ ...newTripForm, destinationCity: e.target.value })}
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300">Hodômetro Inicial (km)</label>
                <input
                  type="number"
                  value={newTripForm.startOdometerKm}
                  onChange={(e) => setNewTripForm({ ...newTripForm, startOdometerKm: Number(e.target.value) })}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white"
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowNewTripModal(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-sm text-white font-semibold"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-white/10 p-6 space-y-4">
            <h3 className="text-lg font-bold text-white">Concluir Viagem {showCloseTripModal.tripNumber}</h3>
            <p className="text-xs text-slate-400">
              Informe o hodômetro final do veículo na chegada para cálculo da distância efetiva percorrida.
            </p>

            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-white/5 text-xs text-slate-300 space-y-1">
                <div>Veículo: <strong className="text-white">{showCloseTripModal.vehiclePlate}</strong></div>
                <div>Hodômetro Inicial: <strong className="text-white">{showCloseTripModal.startOdometerKm.toLocaleString()} km</strong></div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300">Hodômetro Final (km)</label>
                <input
                  type="number"
                  value={closeTripEndKm}
                  onChange={(e) => setCloseTripEndKm(Number(e.target.value))}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white"
                  min={showCloseTripModal.startOdometerKm}
                />
              </div>

              <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-center">
                <div className="text-xs text-purple-300">Distância Calculada</div>
                <div className="text-xl font-bold text-white">
                  {Math.max(0, closeTripEndKm - showCloseTripModal.startOdometerKm)} km
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCloseTripModal(null)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => handleCloseTrip(showCloseTripModal)}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-sm text-white font-semibold"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-white/10 p-6 space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Fuel className="w-5 h-5 text-amber-400" />
              Lançamento Rápido de Combustível
            </h3>

            <form onSubmit={handleCreateFueling} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-300">Veículo</label>
                <select
                  value={fuelingForm.vehicleId}
                  onChange={(e) => setFuelingForm({ ...fuelingForm, vehicleId: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white"
                >
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>{v.brand} {v.model} ({v.plate})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300">Valor Total Pago (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={fuelingForm.totalAmount}
                  onChange={(e) => setFuelingForm({ ...fuelingForm, totalAmount: Number(e.target.value) })}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-lg font-bold text-emerald-400"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300">Litros Abastecidos (Opcional)</label>
                <input
                  type="number"
                  step="0.001"
                  placeholder="Deixe em branco se abasteceu sem olhar os litros"
                  value={fuelingForm.liters}
                  onChange={(e) => setFuelingForm({ ...fuelingForm, liters: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300">Forma de Pagamento</label>
                <select
                  value={fuelingForm.paymentMethod}
                  onChange={(e) => setFuelingForm({ ...fuelingForm, paymentMethod: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-sm text-white"
                >
                  <option value="CompanyPix">Pix da Empresa (Débito Imediato Caixa/Banco)</option>
                  <option value="PartnerReimbursement">Pago pelo Sócio do Próprio Bolso (Gerar Reembolso)</option>
                  <option value="CompanyCreditCard">Cartão Corporativo (Contas a Pagar)</option>
                  <option value="Cash">Dinheiro Físico do Caixa da Loja</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300">Posto / Local</label>
                <input
                  type="text"
                  value={fuelingForm.gasStationName}
                  onChange={(e) => setFuelingForm({ ...fuelingForm, gasStationName: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowFuelingModal(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-sm text-white font-semibold"
                >
                  Salvar Abastecimento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
