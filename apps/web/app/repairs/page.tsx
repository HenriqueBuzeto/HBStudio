"use client";

import React, { useState } from "react";
import RootShellLayout from "@/components/RootShellLayout";
import {
  Wrench,
  Smartphone,
  ShieldCheck,
  Plus,
  Filter,
  FolderOpen
} from "lucide-react";

interface RepairOrderView {
  id: string;
  orderNumber: string;
  status: number;
  statusName: string;
  customerName: string;
  customerPhone: string;
  equipmentDescription: string;
  imeiOrSerial: string;
  faultDescription: string;
  deviceAccessMethod?: string;
  assignedTechnicianName?: string;
  totalEstimate: number;
  partsCost: number;
  laborCost: number;
  legalWarrantyDays: number;
  contractualWarrantyDays: number;
  openedAt: string;
}

export default function RepairsPage() {
  const [orders, setOrders] = useState<RepairOrderView[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<RepairOrderView | null>(null);
  const [showModal, setShowModal] = useState(false);

  // Form OS
  const [custName, setCustName] = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [equip, setEquip] = useState("");
  const [serial, setSerial] = useState("");
  const [fault, setFault] = useState("");
  const [method, setMethod] = useState("Apple Diagnostics Mode (Sem senha pessoal)");

  const handleCreateOS = (e: React.FormEvent) => {
    e.preventDefault();
    if (!custName || !equip) return;

    const newOS: RepairOrderView = {
      id: `os-${Date.now()}`,
      orderNumber: `OS-2026-${String(orders.length + 1).padStart(4, "0")}`,
      status: 1,
      statusName: "Recepção / Triagem",
      customerName: custName,
      customerPhone: custPhone,
      equipmentDescription: equip,
      imeiOrSerial: serial || "N/A",
      faultDescription: fault,
      deviceAccessMethod: method,
      assignedTechnicianName: "Henrique Barreto",
      totalEstimate: 0,
      partsCost: 0,
      laborCost: 0,
      legalWarrantyDays: 90,
      contractualWarrantyDays: 90,
      openedAt: new Date().toLocaleDateString("pt-BR")
    };

    setOrders([newOS, ...orders]);
    setSelectedOrder(newOS);
    setShowModal(false);
    setCustName("");
    setCustPhone("");
    setEquip("");
    setSerial("");
    setFault("");
  };

  return (
    <RootShellLayout>
      <div className="space-y-6">
        {/* Header estilo HBVisionX */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-700 bg-purple-50 px-2.5 py-1 rounded-full border border-purple-200">
                Bancada Técnica & Laboratório
              </span>
            </div>
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900 mt-1">
              Gestão de Ordens de Serviço (OS) & Garantias
            </h1>
            <p className="text-xs text-slate-500">
              Checklist de entrada, laudo técnico, rastreamento de peças serializadas e conformidade rigorosa com CDC Art. 26.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-violet-600 to-purple-700 hover:from-violet-700 hover:to-purple-800 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-purple-600/20"
            >
              <Plus className="w-3.5 h-3.5" />
              Nova Ordem de Serviço
            </button>
          </div>
        </div>

        {/* Indicadores Topo estilo HBVisionX */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <Wrench className="w-3.5 h-3.5 text-purple-600" />
              Status da Bancada Técnica
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500"></div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                OS em Andamento
              </span>
              <div className="text-lg font-extrabold text-slate-900">{orders.length} Aparelhos</div>
              <p className="text-[10px] text-slate-400 mt-1">Triagem e bancada</p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-purple-600"></div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Orçamentos Aprovados
              </span>
              <div className="text-lg font-extrabold text-purple-600">
                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                  orders.reduce((acc, o) => acc + o.totalEstimate, 0)
                )}
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Aguardando montagem</p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500"></div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Prontos para Retirada
              </span>
              <div className="text-lg font-extrabold text-emerald-600">0 Aparelhos</div>
              <p className="text-[10px] text-slate-400 mt-1">Checklist de saída aprovado</p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500"></div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Segurança de Dados
              </span>
              <div className="text-lg font-extrabold text-slate-900">Zero Senhas</div>
              <p className="text-[10px] text-emerald-600 font-semibold mt-1">Diagnóstico assistido / sem PIN</p>
            </div>
          </div>
        </div>

        {/* Tabela de Ordens de Serviço */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-purple-600" />
              Ordens de Serviço Registradas
            </h3>
            <span className="text-xs text-slate-500">Unidade Operacional</span>
          </div>

          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-bold text-[10px]">
              <tr>
                <th className="py-3 px-4">Nº OS</th>
                <th className="py-3 px-4">Cliente</th>
                <th className="py-3 px-4">Equipamento / IMEI</th>
                <th className="py-3 px-4">Defeito Relatado</th>
                <th className="py-3 px-4">Método de Acesso</th>
                <th className="py-3 px-4">Valor Orçado</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.map((os) => (
                <tr key={os.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-purple-700">{os.orderNumber}</td>
                  <td className="py-3 px-4">
                    <div className="font-bold text-slate-900">{os.customerName}</div>
                    <div className="text-[10px] text-slate-400">{os.customerPhone}</div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-800">{os.equipmentDescription}</div>
                    <div className="text-[10px] font-mono text-slate-400">{os.imeiOrSerial}</div>
                  </td>
                  <td className="py-3 px-4 text-slate-600 max-w-xs truncate">{os.faultDescription}</td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                      <ShieldCheck className="w-3 h-3 text-blue-600" />
                      {os.deviceAccessMethod}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-extrabold text-slate-900">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(os.totalEstimate)}
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                      {os.statusName}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => setSelectedOrder(os)}
                      className="px-2.5 py-1 text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors"
                    >
                      Ver Detalhes
                    </button>
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400">
                    <FolderOpen className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                    <p className="font-bold text-slate-700">Nenhuma Ordem de Serviço aberta</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Clique em "Nova Ordem de Serviço" para abrir um atendimento de bancada.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Modal Nova OS */}
        {showModal && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-xl space-y-4">
              <h3 className="text-sm font-extrabold text-slate-900">Abertura de Ordem de Serviço</h3>
              <form onSubmit={handleCreateOS} className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Nome do Cliente *</label>
                    <input
                      type="text"
                      required
                      value={custName}
                      onChange={(e) => setCustName(e.target.value)}
                      placeholder="Nome do cliente"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Telefone</label>
                    <input
                      type="text"
                      value={custPhone}
                      onChange={(e) => setCustPhone(e.target.value)}
                      placeholder="(11) 90000-0000"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Aparelho / Modelo *</label>
                    <input
                      type="text"
                      required
                      value={equip}
                      onChange={(e) => setEquip(e.target.value)}
                      placeholder="Ex: iPhone 14 Pro"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">IMEI ou Serial</label>
                    <input
                      type="text"
                      value={serial}
                      onChange={(e) => setSerial(e.target.value)}
                      placeholder="15 dígitos"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Defeito Relatado</label>
                  <textarea
                    rows={2}
                    value={fault}
                    onChange={(e) => setFault(e.target.value)}
                    placeholder="Descreva o problema constatado pelo cliente"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Protocolo Seguro de Acesso</label>
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none font-medium"
                  >
                    <option value="Apple Diagnostics Mode (Sem senha pessoal)">Apple Diagnostics Mode (Sem senha pessoal)</option>
                    <option value="Desbloqueio presencial pelo cliente no balcão">Desbloqueio presencial pelo cliente no balcão</option>
                  </select>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-gradient-to-r from-violet-600 to-purple-700 text-white rounded-xl text-xs font-bold shadow-md shadow-purple-600/20"
                  >
                    Abrir OS
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
