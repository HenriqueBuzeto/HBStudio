"use client";

import React, { useState } from "react";
import RootShellLayout from "@/components/RootShellLayout";
import {
  Wrench,
  Smartphone,
  ShieldCheck,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Search,
  Plus,
  Package,
  UserCheck,
  Cpu,
  CheckSquare,
  DollarSign,
  ChevronRight,
  Filter,
  Check,
  AlertCircle
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
  intakeNotes?: string;
  rootCauseAnalysis?: string;
  totalEstimate: number;
  partsCost: number;
  laborCost: number;
  approvedAtUtc?: string;
  legalWarrantyDays: number;
  contractualWarrantyDays: number;
  openedAt: string;
  deliveredAt?: string;
  checklists: Array<{
    category: string;
    item: string;
    status: number;
    notes?: string;
    isOutput: boolean;
  }>;
  parts: Array<{
    description: string;
    sku: string;
    serial?: string;
    quantity: number;
    unitPrice: number;
    inventoryTracked: boolean;
  }>;
}

const mockOrders: RepairOrderView[] = [
  {
    id: "os-001",
    orderNumber: "OS-2026-0001",
    status: 4,
    statusName: "Aprovado / Em Reparo",
    customerName: "Rodrigo Silveira",
    customerPhone: "(11) 98765-4321",
    equipmentDescription: "iPhone 14 Pro 128GB Roxo",
    imeiOrSerial: "354891029384756",
    faultDescription: "Display quebrado após queda e touch falhando intermitente",
    deviceAccessMethod: "Apple Diagnostics Mode (Sem senha pessoal)",
    assignedTechnicianName: "Lucas Mendes",
    intakeNotes: "Aparelho recebido com trincos no canto superior direito do vidro.",
    totalEstimate: 1450.00,
    partsCost: 950.00,
    laborCost: 500.00,
    legalWarrantyDays: 90,
    contractualWarrantyDays: 90,
    openedAt: "2026-11-15 10:30",
    checklists: [
      { category: "Funcional", item: "FaceID / Sensores", status: 1, isOutput: false },
      { category: "Funcional", item: "Câmera Traseira & Foco", status: 1, isOutput: false },
      { category: "Tela", item: "Touch Screen & Calibração", status: 3, notes: "Falha intermitente", isOutput: false },
      { category: "Bateria", item: "Saúde da Bateria", status: 1, notes: "89% original", isOutput: false }
    ],
    parts: [
      {
        description: "Tela OLED iPhone 14 Pro Original Refurbished",
        sku: "DISP-IPH14P-OLED",
        serial: "SN-SCR-98231",
        quantity: 1,
        unitPrice: 950.00,
        inventoryTracked: true
      }
    ]
  },
  {
    id: "os-002",
    orderNumber: "OS-2026-0002",
    status: 1,
    statusName: "Recepção / Triagem",
    customerName: "Camila Guimarães",
    customerPhone: "(11) 97123-9988",
    equipmentDescription: "MacBook Air M1 256GB Cinza Espacial",
    imeiOrSerial: "C02XYZ123ABC",
    faultDescription: "Não segura carga desconectado da tomada (bateria estufando)",
    deviceAccessMethod: "Desbloqueio presencial pelo cliente no balcão",
    totalEstimate: 850.00,
    partsCost: 600.00,
    laborCost: 250.00,
    legalWarrantyDays: 90,
    contractualWarrantyDays: 90,
    openedAt: "2026-11-15 14:15",
    checklists: [],
    parts: []
  }
];

export default function RepairsPage() {
  const [activeTab, setActiveTab] = useState<"list" | "detail" | "new">("list");
  const [selectedOrder, setSelectedOrder] = useState<RepairOrderView>(mockOrders[0]);

  return (
    <RootShellLayout>
      <div className="space-y-6">
        {/* Top Header Card HBVisionX */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-600 bg-purple-50 px-2.5 py-1 rounded-full border border-purple-200">
                Módulo 07 • Assistência Técnica & Laboratório
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
            <button className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 transition-colors shadow-xs">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              Filtrar Status
            </button>
            <button className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-violet-600 to-purple-700 hover:from-violet-700 hover:to-purple-800 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-purple-600/20">
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
              <div className="text-lg font-extrabold text-slate-900">8 Aparelhos</div>
              <p className="text-[10px] text-amber-600 font-semibold mt-1">Triagem, diagnóstico e reparo</p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-purple-600"></div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Orçamentos Aprovados
              </span>
              <div className="text-lg font-extrabold text-purple-600">R$ 4.350,00</div>
              <p className="text-[10px] text-slate-500 mt-1">Aguardando peças ou montagem</p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500"></div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Prontos para Retirada
              </span>
              <div className="text-lg font-extrabold text-emerald-600">3 Aparelhos</div>
              <p className="text-[10px] text-slate-500 mt-1">Checklist de saída aprovado</p>
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
            <span className="text-xs text-slate-500">Filial Matriz SP</span>
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
              {mockOrders.map((os) => (
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
            </tbody>
          </table>
        </div>

        {/* Detalhes da OS Selecionada com Conformidade CDC Art. 26 */}
        {selectedOrder && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
              <div>
                <span className="text-[10px] font-mono font-bold text-purple-700 uppercase">
                  Detalhamento Técnico da Ordem
                </span>
                <h3 className="text-base font-extrabold text-slate-900">
                  {selectedOrder.orderNumber} — {selectedOrder.equipmentDescription}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
                  {selectedOrder.statusName}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-1 text-xs">
                <span className="text-slate-400 font-bold uppercase text-[10px]">Técnico Responsável</span>
                <p className="font-bold text-slate-800">{selectedOrder.assignedTechnicianName || "Aguardando Alocação"}</p>
                <p className="text-slate-500">Aberto em: {selectedOrder.openedAt}</p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-1 text-xs">
                <span className="text-slate-400 font-bold uppercase text-[10px]">Composição do Orçamento</span>
                <p className="text-slate-700">Peças: {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(selectedOrder.partsCost)}</p>
                <p className="text-slate-700">Mão de Obra: {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(selectedOrder.laborCost)}</p>
                <p className="font-extrabold text-slate-900 pt-1 border-t border-slate-200">
                  Total: {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(selectedOrder.totalEstimate)}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-purple-50/60 border border-purple-200 space-y-1.5 text-xs">
                <span className="text-purple-800 font-extrabold uppercase text-[10px] flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                  Garantias & Vícios Ocultos (CDC Art. 26)
                </span>
                <p className="text-slate-700">Garantia Legal: <strong>{selectedOrder.legalWarrantyDays} dias</strong></p>
                <p className="text-slate-700">Garantia Comercial: <strong>{selectedOrder.contractualWarrantyDays} dias</strong></p>
                <p className="text-[10px] text-purple-900/80 leading-tight">
                  Nos termos do Art. 26 § 3º do CDC, em caso de vício oculto o prazo decadencial inicia-se no momento em que ficar evidenciado o defeito.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </RootShellLayout>
  );
}
