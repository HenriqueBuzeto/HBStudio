"use client";

import React, { useState } from "react";
import RootShellLayout from "@/components/RootShellLayout";
import { 
  Users, 
  UserPlus, 
  Search, 
  Smartphone, 
  Phone, 
  Mail, 
  Plus, 
  CheckCircle2, 
  ShieldCheck,
  FolderOpen,
  MapPin,
  Building,
  Award,
  Sparkles,
  CreditCard,
  ShoppingBag,
  Wrench,
  Clock,
  Star,
  FileText,
  Eye,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Tag,
  DollarSign,
  Gift,
  Calendar,
  X,
  Edit3
} from "lucide-react";

export interface PartyContact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  whatsApp?: string;
  isPrimary: boolean;
}

export interface PartyAddress {
  id: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  postalCode: string;
  isPrimary: boolean;
}

export interface CustomerEquipment {
  id: string;
  equipmentType: string;
  brand: string;
  model: string;
  serialNumber?: string;
  imei1?: string;
  imei2?: string;
  color?: string;
  notes?: string;
}

export interface PartyConsent {
  id: string;
  channel: string;
  purpose: string;
  isOptIn: boolean;
  origin: string;
  eventDateUtc: string;
}

export interface CustomerGamification {
  pointsBalance: number;
  tier: "Bronze" | "Prata" | "Ouro" | "Diamante";
  totalSpent: number;
  cashbackAvailable: number;
  ordersCount: number;
  repairsCount: number;
  lifetimeValue: number;
}

export interface CustomerHistoryItem {
  id: string;
  type: "Venda" | "OS" | "Pontos";
  title: string;
  dateUtc: string;
  amount: number;
  status: string;
  details: string;
}

export interface Party {
  id: string;
  type: 1 | 2; // 1 = PF, 2 = PJ
  name: string;
  tradeName?: string;
  documentNumber?: string; // CPF ou CNPJ
  stateRegistration?: string; // Inscrição Estadual (IE)
  municipalRegistration?: string; // Inscrição Municipal
  birthDate?: string;
  isActive: boolean;
  isCustomer: boolean;
  isSupplier: boolean;
  notes?: string;
  creditLimit?: number;
  paymentTerms?: string;
  customerProfileNotes?: string;
  contacts: PartyContact[];
  addresses: PartyAddress[];
  equipments: CustomerEquipment[];
  consents: PartyConsent[];
  gamification: CustomerGamification;
  history: CustomerHistoryItem[];
  createdAtUtc: string;
}

export default function PartiesPage() {
  const [parties, setParties] = useState<Party[]>([
    {
      id: "p-henrique-01",
      type: 1,
      name: "Henrique Barreto",
      documentNumber: "48951871839",
      birthDate: "1994-08-20",
      isActive: true,
      isCustomer: true,
      isSupplier: false,
      notes: "Cliente VIP de balcão e entusiasta de produtos Apple. Sempre busca lançamentos e revisões preventivas.",
      creditLimit: 5000.00,
      paymentTerms: "À Vista / Pix / Parcelamento 12x",
      createdAtUtc: "2026-11-16T12:00:00Z",
      contacts: [
        {
          id: "c-1",
          name: "Henrique",
          phone: "(17) 99265-1033",
          whatsApp: "(17) 99265-1033",
          email: "henrique@hbstudio.com.br",
          isPrimary: true
        }
      ],
      addresses: [
        {
          id: "a-1",
          street: "Av. Paulista",
          number: "1842",
          complement: "Conjunto 14",
          neighborhood: "Bela Vista",
          city: "São Paulo",
          state: "SP",
          postalCode: "01310-200",
          isPrimary: true
        }
      ],
      equipments: [
        {
          id: "eq-1",
          equipmentType: "Smartphone",
          brand: "Apple",
          model: "iPhone 16 Pro",
          color: "Titânio Deserto",
          imei1: "354928119028123",
          notes: "Aparelho pessoal com AppleCare, película de privacidade aplicada."
        }
      ],
      consents: [
        {
          id: "cs-1",
          channel: "WhatsApp",
          purpose: "Comunicação de Atendimento & OS",
          isOptIn: true,
          origin: "Cadastro Balcão",
          eventDateUtc: "2026-11-16T12:00:00Z"
        },
        {
          id: "cs-2",
          channel: "WhatsApp",
          purpose: "Novidades, Alertas de Estoque & Upgrades",
          isOptIn: true,
          origin: "Termo Assinado",
          eventDateUtc: "2026-11-16T12:00:00Z"
        }
      ],
      gamification: {
        pointsBalance: 1450,
        tier: "Ouro",
        totalSpent: 12890.00,
        cashbackAvailable: 145.00,
        ordersCount: 4,
        repairsCount: 2,
        lifetimeValue: 12890.00
      },
      history: [
        {
          id: "hist-1",
          type: "Venda",
          title: "Venda PDV #VD-2026-0042",
          dateUtc: "2026-11-14T14:30:00Z",
          amount: 8490.00,
          status: "Faturado & Entregue",
          details: "iPhone 16 Pro 128GB + Fonte 20W USB-C"
        },
        {
          id: "hist-2",
          type: "OS",
          title: "Assistência Técnica #OS-2026-0018",
          dateUtc: "2026-11-02T10:15:00Z",
          amount: 650.00,
          status: "Concluído",
          details: "Troca de bateria original homologada iPhone 13"
        },
        {
          id: "hist-3",
          type: "Pontos",
          title: "Crédito Fidelidade Clube HB",
          dateUtc: "2026-11-14T14:30:00Z",
          amount: 145.00,
          status: "Disponível",
          details: "Resgate de cashback ou desconto na próxima revisão"
        }
      ]
    }
  ]);

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | "customers" | "suppliers">("customers");
  const [selectedParty, setSelectedParty] = useState<Party | null>(parties[0] ?? null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [detailTab, setDetailTab] = useState<"overview" | "history" | "equipments" | "financial" | "gamification">("overview");

  // Form State Abas do Cadastro
  const [formStep, setFormStep] = useState<"general" | "address" | "equipments" | "fiscal">("general");
  const [newName, setNewName] = useState("");
  const [newTradeName, setNewTradeName] = useState("");
  const [newType, setNewType] = useState<1 | 2>(1);
  const [newDoc, setNewDoc] = useState("");
  const [newStateReg, setNewStateReg] = useState("");
  const [newBirthDate, setNewBirthDate] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  
  // Endereço
  const [newPostalCode, setNewPostalCode] = useState("");
  const [newStreet, setNewStreet] = useState("");
  const [newNumber, setNewNumber] = useState("");
  const [newComplement, setNewComplement] = useState("");
  const [newNeighborhood, setNewNeighborhood] = useState("");
  const [newCity, setNewCity] = useState("");
  const [newState, setNewState] = useState("SP");

  // Equipamento
  const [newEquipmentModel, setNewEquipmentModel] = useState("");
  const [newEquipmentBrand, setNewEquipmentBrand] = useState("Apple");
  const [newEquipmentImei, setNewEquipmentImei] = useState("");
  const [newEquipmentColor, setNewEquipmentColor] = useState("");

  // Fiscal & Financeiro
  const [newCreditLimit, setNewCreditLimit] = useState("3000.00");
  const [newPaymentTerms, setNewPaymentTerms] = useState("À Vista / PIX / 10x Cartão");
  const [newNotes, setNewNotes] = useState("");
  const [isCust, setIsCust] = useState(true);
  const [isSupp, setIsSupp] = useState(false);

  const filteredParties = parties.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.tradeName && p.tradeName.toLowerCase().includes(search.toLowerCase())) ||
      (p.documentNumber && p.documentNumber.includes(search));

    if (filterType === "customers") return matchesSearch && p.isCustomer;
    if (filterType === "suppliers") return matchesSearch && p.isSupplier;
    return matchesSearch;
  });

  const handleCreateParty = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName) return;

    const newParty: Party = {
      id: `p-${Date.now()}`,
      type: newType,
      name: newName,
      tradeName: newTradeName || undefined,
      documentNumber: newDoc || undefined,
      stateRegistration: newStateReg || undefined,
      birthDate: newBirthDate || undefined,
      isActive: true,
      isCustomer: isCust,
      isSupplier: isSupp,
      creditLimit: parseFloat(newCreditLimit) || 0,
      paymentTerms: newPaymentTerms || "Padrão",
      notes: newNotes || undefined,
      createdAtUtc: new Date().toISOString(),
      contacts: (newPhone || newEmail) ? [{
        id: `c-${Date.now()}`,
        name: newName,
        phone: newPhone || undefined,
        whatsApp: newPhone || undefined,
        email: newEmail || undefined,
        isPrimary: true
      }] : [],
      addresses: newStreet ? [{
        id: `a-${Date.now()}`,
        street: newStreet,
        number: newNumber,
        complement: newComplement || undefined,
        neighborhood: newNeighborhood,
        city: newCity,
        state: newState,
        postalCode: newPostalCode,
        isPrimary: true
      }] : [],
      equipments: newEquipmentModel ? [{
        id: `eq-${Date.now()}`,
        equipmentType: "Smartphone",
        brand: newEquipmentBrand,
        model: newEquipmentModel,
        color: newEquipmentColor || undefined,
        imei1: newEquipmentImei || undefined
      }] : [],
      consents: [
        {
          id: `cs-${Date.now()}`,
          channel: "WhatsApp",
          purpose: "Comunicação de Atendimento & OS",
          isOptIn: true,
          origin: "Cadastro Balcão",
          eventDateUtc: new Date().toISOString()
        }
      ],
      gamification: {
        pointsBalance: 100, // Bônus de primeiro cadastro
        tier: "Bronze",
        totalSpent: 0,
        cashbackAvailable: 0,
        ordersCount: 0,
        repairsCount: 0,
        lifetimeValue: 0
      },
      history: []
    };

    setParties([newParty, ...parties]);
    setSelectedParty(newParty);
    setShowCreateModal(false);
    
    // Reset form
    setNewName("");
    setNewTradeName("");
    setNewDoc("");
    setNewStateReg("");
    setNewBirthDate("");
    setNewPhone("");
    setNewEmail("");
    setNewPostalCode("");
    setNewStreet("");
    setNewNumber("");
    setNewComplement("");
    setNewNeighborhood("");
    setNewCity("");
    setNewEquipmentModel("");
    setNewEquipmentImei("");
    setNewEquipmentColor("");
    setNewNotes("");
    setFormStep("general");
  };

  return (
    <RootShellLayout>
      <div className="space-y-6">
        {/* Header estilo HBVisionX */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200/90 shadow-xs">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200">
                Gestão 360º de Pessoas
              </span>
            </div>
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900 mt-1">
              Clientes & Fornecedores Enterprise
            </h1>
            <p className="text-xs text-slate-500">
              Histórico unificado, compras, ordens de serviço, programa de fidelidade, limites e aparelhos cadastrados.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-600 to-purple-700 hover:from-violet-700 hover:to-purple-800 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-purple-600/25"
            >
              <UserPlus className="w-4 h-4" />
              Novo Cadastro Completo
            </button>
          </div>
        </div>

        {/* Toolbar de Filtro e Busca */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 p-1 bg-white rounded-xl border border-slate-200/80 shadow-xs">
            <button
              onClick={() => setFilterType("customers")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                filterType === "customers"
                  ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Clientes ({parties.filter(p => p.isCustomer).length})
            </button>
            <button
              onClick={() => setFilterType("suppliers")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                filterType === "suppliers"
                  ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Fornecedores ({parties.filter(p => p.isSupplier).length})
            </button>
            <button
              onClick={() => setFilterType("all")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                filterType === "all"
                  ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Todos ({parties.length})
            </button>
          </div>

          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nome, CPF/CNPJ, telefone ou IMEI..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 text-slate-800 transition-all shadow-xs"
            />
          </div>
        </div>

        {/* Master-Detail Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Tabela de Pessoas (Esquerda) */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-xs">
            <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <span className="text-xs font-bold text-slate-700">Lista Cadastral</span>
              <span className="text-[11px] text-slate-500 font-mono">{filteredParties.length} registros</span>
            </div>
            <div className="divide-y divide-slate-100 max-h-[700px] overflow-y-auto">
              {filteredParties.map((p) => {
                const isSelected = selectedParty?.id === p.id;
                const primaryContact = p.contacts.find(c => c.isPrimary) || p.contacts[0];
                return (
                  <div
                    key={p.id}
                    onClick={() => setSelectedParty(p)}
                    className={`p-4 cursor-pointer transition-all ${
                      isSelected
                        ? "bg-purple-50/70 border-l-4 border-l-purple-600"
                        : "hover:bg-slate-50/80 border-l-4 border-l-transparent"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-slate-900 text-sm">{p.name}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold ${
                            p.gamification?.tier === "Ouro" ? "bg-amber-100 text-amber-800 border border-amber-300" :
                            p.gamification?.tier === "Diamante" ? "bg-cyan-100 text-cyan-800 border border-cyan-300" :
                            "bg-slate-100 text-slate-700"
                          }`}>
                            Clube {p.gamification?.tier ?? "Bronze"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 font-mono">
                          <span>{p.documentNumber ? `CPF: ${p.documentNumber}` : "Sem documento"}</span>
                          <span>•</span>
                          <span>{primaryContact?.phone || "Sem telefone"}</span>
                        </div>
                      </div>
                      <ChevronRight className={`w-4 h-4 mt-1 transition-transform ${isSelected ? "text-purple-600 translate-x-1" : "text-slate-300"}`} />
                    </div>

                    {/* Tags Rápidas */}
                    <div className="flex items-center gap-1.5 mt-2.5">
                      {p.isCustomer && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Cliente
                        </span>
                      )}
                      {p.isSupplier && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          Fornecedor
                        </span>
                      )}
                      {p.equipments.length > 0 && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1">
                          <Smartphone className="w-3 h-3" />
                          {p.equipments[0].model}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
              {filteredParties.length === 0 && (
                <div className="py-16 text-center text-slate-400 p-6">
                  <FolderOpen className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                  <p className="font-bold text-slate-700">Nenhum cadastro encontrado</p>
                  <p className="text-[11px] text-slate-400 mt-1">Cadastre novos clientes para acompanhar compras, revisões e pontos de fidelidade.</p>
                </div>
              )}
            </div>
          </div>

          {/* Painel de Detalhes 360º da Pessoa (Direita) */}
          <div className="lg:col-span-7 space-y-4">
            {selectedParty ? (
              <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-6">
                {/* Header do Perfil do Cliente */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-5 border-b border-slate-100">
                  <div className="flex items-center gap-3.5">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 flex items-center justify-center font-extrabold text-white text-xl shadow-lg shadow-purple-600/25">
                      {selectedParty.name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-extrabold text-slate-900">{selectedParty.name}</h2>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Ativo
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500 font-mono mt-0.5">
                        <span>{selectedParty.type === 1 ? "Pessoa Física (PF)" : "Pessoa Jurídica (PJ)"}</span>
                        <span>•</span>
                        <span>Doc: {selectedParty.documentNumber || "Não informado"}</span>
                        {selectedParty.birthDate && (
                          <>
                            <span>•</span>
                            <span>Nasc: {new Date(selectedParty.birthDate).toLocaleDateString("pt-BR")}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => alert("Função de edição rápida ativada.")}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Editar
                    </button>
                  </div>
                </div>

                {/* Cards Rápidos de Gamificação e Histórico de Valor */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-xl bg-purple-50/60 border border-purple-100">
                    <span className="text-[10px] font-bold uppercase text-purple-700 flex items-center gap-1">
                      <Award className="w-3.5 h-3.5 text-purple-600" />
                      Pontos Fidelidade
                    </span>
                    <p className="text-xl font-extrabold text-purple-950 mt-1">
                      {selectedParty.gamification?.pointsBalance ?? 0} pts
                    </p>
                    <span className="text-[10px] text-purple-600 font-semibold">Nível {selectedParty.gamification?.tier ?? "Bronze"}</span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-100">
                    <span className="text-[10px] font-bold uppercase text-emerald-700 flex items-center gap-1">
                      <Gift className="w-3.5 h-3.5 text-emerald-600" />
                      Cashback Disponível
                    </span>
                    <p className="text-xl font-extrabold text-emerald-950 mt-1">
                      R$ {(selectedParty.gamification?.cashbackAvailable ?? 0).toFixed(2)}
                    </p>
                    <span className="text-[10px] text-emerald-600 font-semibold">Livre p/ resgate balcão</span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-100">
                    <span className="text-[10px] font-bold uppercase text-blue-700 flex items-center gap-1">
                      <ShoppingBag className="w-3.5 h-3.5 text-blue-600" />
                      Total Faturado
                    </span>
                    <p className="text-xl font-extrabold text-blue-950 mt-1">
                      R$ {(selectedParty.gamification?.totalSpent ?? 0).toFixed(2)}
                    </p>
                    <span className="text-[10px] text-blue-600 font-semibold">{selectedParty.gamification?.ordersCount ?? 0} compras realizadas</span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-100">
                    <span className="text-[10px] font-bold uppercase text-amber-700 flex items-center gap-1">
                      <Wrench className="w-3.5 h-3.5 text-amber-600" />
                      Ordens de Serviço
                    </span>
                    <p className="text-xl font-extrabold text-amber-950 mt-1">
                      {selectedParty.gamification?.repairsCount ?? 0}
                    </p>
                    <span className="text-[10px] text-amber-600 font-semibold">Reparos concluídos</span>
                  </div>
                </div>

                {/* Abas Internas da Visão do Cliente */}
                <div className="flex border-b border-slate-200 gap-4 text-xs font-bold">
                  <button
                    onClick={() => setDetailTab("overview")}
                    className={`pb-2.5 transition-colors border-b-2 flex items-center gap-1.5 ${
                      detailTab === "overview"
                        ? "border-purple-600 text-purple-700"
                        : "border-transparent text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    Visão Geral & Contatos
                  </button>

                  <button
                    onClick={() => setDetailTab("history")}
                    className={`pb-2.5 transition-colors border-b-2 flex items-center gap-1.5 ${
                      detailTab === "history"
                        ? "border-purple-600 text-purple-700"
                        : "border-transparent text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    Histórico de Compras & OS ({selectedParty.history?.length ?? 0})
                  </button>

                  <button
                    onClick={() => setDetailTab("equipments")}
                    className={`pb-2.5 transition-colors border-b-2 flex items-center gap-1.5 ${
                      detailTab === "equipments"
                        ? "border-purple-600 text-purple-700"
                        : "border-transparent text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    Aparelhos ({selectedParty.equipments.length})
                  </button>

                  <button
                    onClick={() => setDetailTab("financial")}
                    className={`pb-2.5 transition-colors border-b-2 flex items-center gap-1.5 ${
                      detailTab === "financial"
                        ? "border-purple-600 text-purple-700"
                        : "border-transparent text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    Financeiro & Limites
                  </button>
                </div>

                {/* Conteúdo Aba 1: Visão Geral */}
                {detailTab === "overview" && (
                  <div className="space-y-4">
                    {/* Contatos */}
                    <div>
                      <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-2 flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-purple-600" />
                        Canais de Contato Cadastrados
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {selectedParty.contacts.map((c) => (
                          <div key={c.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs space-y-1">
                            <div className="flex justify-between items-center">
                              <span className="font-bold text-slate-900">{c.name}</span>
                              {c.isPrimary && (
                                <span className="px-2 py-0.5 text-[9px] font-bold bg-purple-100 text-purple-700 rounded-full">
                                  Principal
                                </span>
                              )}
                            </div>
                            <p className="text-slate-600 font-mono">Tel/WhatsApp: <strong>{c.phone || c.whatsApp || "—"}</strong></p>
                            <p className="text-slate-500 truncate">E-mail: <strong>{c.email || "—"}</strong></p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Endereço */}
                    <div>
                      <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-2 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-purple-600" />
                        Endereço de Entrega & Faturamento
                      </h4>
                      {selectedParty.addresses && selectedParty.addresses.length > 0 ? (
                        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 text-xs space-y-1">
                          <p className="font-bold text-slate-900">
                            {selectedParty.addresses[0].street}, {selectedParty.addresses[0].number} 
                            {selectedParty.addresses[0].complement ? ` - ${selectedParty.addresses[0].complement}` : ""}
                          </p>
                          <p className="text-slate-600">
                            {selectedParty.addresses[0].neighborhood} • {selectedParty.addresses[0].city} - {selectedParty.addresses[0].state}
                          </p>
                          <p className="text-slate-500 font-mono">CEP: {selectedParty.addresses[0].postalCode}</p>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic">Nenhum endereço cadastrado.</p>
                      )}
                    </div>

                    {/* Observações */}
                    {selectedParty.notes && (
                      <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-900">
                        <span className="font-bold block mb-0.5">Observações Comerciais:</span>
                        {selectedParty.notes}
                      </div>
                    )}

                    {/* Consentimento LGPD */}
                    <div className="pt-2 border-t border-slate-100">
                      <span className="text-[11px] font-extrabold uppercase text-slate-700 block mb-2">Consentimentos LGPD</span>
                      <div className="space-y-1">
                        {selectedParty.consents.map((cs) => (
                          <div key={cs.id} className="flex justify-between items-center text-xs p-2.5 bg-slate-50 rounded-xl border border-slate-200/60">
                            <span className="text-slate-700">{cs.channel}: {cs.purpose}</span>
                            <span className="font-bold text-emerald-600 flex items-center gap-1 text-[11px]">
                              <CheckCircle2 className="w-3 h-3" />
                              Autorizado em {new Date(cs.eventDateUtc).toLocaleDateString("pt-BR")}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Conteúdo Aba 2: Histórico de Vendas & OS */}
                {detailTab === "history" && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">Linha do Tempo de Interações</h4>
                    {selectedParty.history && selectedParty.history.length > 0 ? (
                      <div className="space-y-2">
                        {selectedParty.history.map((h) => (
                          <div key={h.id} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 text-xs flex justify-between items-center hover:bg-slate-100/70 transition-colors">
                            <div className="flex items-start gap-3">
                              <div className={`p-2 rounded-lg ${
                                h.type === "Venda" ? "bg-emerald-100 text-emerald-800" :
                                h.type === "OS" ? "bg-amber-100 text-amber-800" :
                                "bg-purple-100 text-purple-800"
                              }`}>
                                {h.type === "Venda" ? <ShoppingBag className="w-4 h-4" /> :
                                 h.type === "OS" ? <Wrench className="w-4 h-4" /> :
                                 <Award className="w-4 h-4" />}
                              </div>
                              <div>
                                <p className="font-extrabold text-slate-900">{h.title}</p>
                                <p className="text-[11px] text-slate-500 mt-0.5">{h.details}</p>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {new Date(h.dateUtc).toLocaleString("pt-BR")}
                                </span>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-extrabold text-slate-900 font-mono text-sm">
                                R$ {h.amount.toFixed(2)}
                              </p>
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-200 text-slate-700">
                                {h.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-12 text-center text-slate-400">
                        <Clock className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                        <p className="font-bold text-slate-700">Nenhum pedido ou OS registrada ainda</p>
                        <p className="text-[11px] text-slate-400">As vendas finalizadas no PDV e reparos concluídos aparecerão aqui.</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Conteúdo Aba 3: Equipamentos */}
                {detailTab === "equipments" && (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">Aparelhos Vinculados</h4>
                      <button 
                        onClick={() => alert("Adicionar novo aparelho")}
                        className="px-2.5 py-1 text-xs font-bold text-purple-700 bg-purple-50 rounded-lg border border-purple-200 hover:bg-purple-100 flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Vincular Aparelho
                      </button>
                    </div>

                    {selectedParty.equipments.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {selectedParty.equipments.map((eq) => (
                          <div key={eq.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 text-xs space-y-2">
                            <div className="flex justify-between items-start">
                              <div>
                                <span className="text-[10px] font-bold uppercase text-purple-700">{eq.brand}</span>
                                <h5 className="font-extrabold text-slate-900 text-sm">{eq.model}</h5>
                              </div>
                              <Smartphone className="w-4 h-4 text-purple-600" />
                            </div>
                            <div className="text-slate-600 space-y-0.5 font-mono text-[11px]">
                              {eq.color && <p>Cor: <strong>{eq.color}</strong></p>}
                              {eq.imei1 && <p>IMEI 1: <strong>{eq.imei1}</strong></p>}
                              {eq.serialNumber && <p>Serial: <strong>{eq.serialNumber}</strong></p>}
                            </div>
                            {eq.notes && (
                              <p className="text-[10px] text-slate-500 pt-1 border-t border-slate-200">{eq.notes}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-12 text-center text-slate-400">
                        <Smartphone className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                        <p className="font-bold text-slate-700">Nenhum aparelho cadastrado</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Conteúdo Aba 4: Financeiro & Limites */}
                {detailTab === "financial" && (
                  <div className="space-y-4">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">Parâmetros Comerciais & Crédito</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
                        <span className="text-[11px] font-bold text-slate-500">Limite de Crédito Aprovado</span>
                        <p className="text-xl font-extrabold text-slate-900 font-mono">
                          R$ {(selectedParty.creditLimit ?? 0).toFixed(2)}
                        </p>
                        <span className="text-[10px] text-emerald-600 font-semibold">Liberado para faturamento</span>
                      </div>

                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
                        <span className="text-[11px] font-bold text-slate-500">Condições Comerciais Padrão</span>
                        <p className="text-sm font-extrabold text-slate-900">
                          {selectedParty.paymentTerms ?? "À Vista / Pix"}
                        </p>
                        <span className="text-[10px] text-slate-500 font-semibold">Configuração autorizada pelo gerente</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200/90 p-16 text-center text-slate-400 shadow-xs">
                <Users className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <h4 className="font-bold text-slate-800 text-sm">Nenhum cliente selecionado</h4>
                <p className="text-xs text-slate-500 max-w-xs mx-auto mt-1">Selecione um cliente na lista ao lado para inspecionar histórico, pontos e detalhes cadastrais.</p>
              </div>
            )}
          </div>
        </div>

        {/* Modal de Cadastro Completo Enterprise */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl border border-slate-200 max-w-2xl w-full p-6 shadow-2xl space-y-5 animate-in fade-in duration-200">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <div>
                  <span className="text-[10px] font-extrabold uppercase text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                    Módulo de Pessoas (MOD-01)
                  </span>
                  <h3 className="text-base font-extrabold text-slate-900 mt-1">Novo Cadastro Completo de Cliente</h3>
                </div>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Passos do Modal */}
              <div className="grid grid-cols-4 gap-2 text-center text-xs font-bold border-b border-slate-100 pb-3">
                <button
                  type="button"
                  onClick={() => setFormStep("general")}
                  className={`py-1.5 rounded-lg transition-colors ${formStep === "general" ? "bg-purple-600 text-white shadow-xs" : "text-slate-500 hover:bg-slate-100"}`}
                >
                  1. Dados Básicos
                </button>
                <button
                  type="button"
                  onClick={() => setFormStep("address")}
                  className={`py-1.5 rounded-lg transition-colors ${formStep === "address" ? "bg-purple-600 text-white shadow-xs" : "text-slate-500 hover:bg-slate-100"}`}
                >
                  2. Endereço
                </button>
                <button
                  type="button"
                  onClick={() => setFormStep("equipments")}
                  className={`py-1.5 rounded-lg transition-colors ${formStep === "equipments" ? "bg-purple-600 text-white shadow-xs" : "text-slate-500 hover:bg-slate-100"}`}
                >
                  3. Aparelho
                </button>
                <button
                  type="button"
                  onClick={() => setFormStep("fiscal")}
                  className={`py-1.5 rounded-lg transition-colors ${formStep === "fiscal" ? "bg-purple-600 text-white shadow-xs" : "text-slate-500 hover:bg-slate-100"}`}
                >
                  4. Comercial & Limites
                </button>
              </div>

              <form onSubmit={handleCreateParty} className="space-y-4 text-xs">
                {/* ETAPA 1: DADOS BÁSICOS */}
                {formStep === "general" && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">Tipo de Pessoa *</label>
                        <select
                          value={newType}
                          onChange={(e) => setNewType(Number(e.target.value) as 1 | 2)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium"
                        >
                          <option value={1}>Pessoa Física (CPF)</option>
                          <option value={2}>Pessoa Jurídica (CNPJ)</option>
                        </select>
                      </div>

                      <div>
                        <label className="font-bold text-slate-700 block mb-1">
                          {newType === 1 ? "CPF *" : "CNPJ *"}
                        </label>
                        <input
                          type="text"
                          required
                          value={newDoc}
                          onChange={(e) => setNewDoc(e.target.value)}
                          placeholder={newType === 1 ? "000.000.000-00" : "00.000.000/0000-00"}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:border-purple-600 text-slate-800 font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">
                        {newType === 1 ? "Nome Completo do Cliente *" : "Razão Social *"}
                      </label>
                      <input
                        type="text"
                        required
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="Ex: Henrique Barreto"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-semibold"
                      />
                    </div>

                    {newType === 2 && (
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">Nome Fantasia</label>
                        <input
                          type="text"
                          value={newTradeName}
                          onChange={(e) => setNewTradeName(e.target.value)}
                          placeholder="Ex: HB Studio Tecnologia"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">WhatsApp / Celular *</label>
                        <input
                          type="text"
                          required
                          value={newPhone}
                          onChange={(e) => setNewPhone(e.target.value)}
                          placeholder="(11) 90000-0000"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono"
                        />
                      </div>

                      <div>
                        <label className="font-bold text-slate-700 block mb-1">E-mail Principal</label>
                        <input
                          type="email"
                          value={newEmail}
                          onChange={(e) => setNewEmail(e.target.value)}
                          placeholder="cliente@email.com"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">Data de Nascimento</label>
                        <input
                          type="date"
                          value={newBirthDate}
                          onChange={(e) => setNewBirthDate(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
                        />
                      </div>

                      {newType === 2 && (
                        <div>
                          <label className="font-bold text-slate-700 block mb-1">Inscrição Estadual (IE)</label>
                          <input
                            type="text"
                            value={newStateReg}
                            onChange={(e) => setNewStateReg(e.target.value)}
                            placeholder="Isento ou nº estadual"
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ETAPA 2: ENDEREÇO */}
                {formStep === "address" && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">CEP</label>
                        <input
                          type="text"
                          value={newPostalCode}
                          onChange={(e) => setNewPostalCode(e.target.value)}
                          placeholder="00000-000"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="font-bold text-slate-700 block mb-1">Logradouro / Rua</label>
                        <input
                          type="text"
                          value={newStreet}
                          onChange={(e) => setNewStreet(e.target.value)}
                          placeholder="Av. Paulista, Rua das Flores..."
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">Número</label>
                        <input
                          type="text"
                          value={newNumber}
                          onChange={(e) => setNewNumber(e.target.value)}
                          placeholder="123"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="font-bold text-slate-700 block mb-1">Complemento / Apto</label>
                        <input
                          type="text"
                          value={newComplement}
                          onChange={(e) => setNewComplement(e.target.value)}
                          placeholder="Apto 42, Bloco B..."
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">Bairro</label>
                        <input
                          type="text"
                          value={newNeighborhood}
                          onChange={(e) => setNewNeighborhood(e.target.value)}
                          placeholder="Centro"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">Cidade</label>
                        <input
                          type="text"
                          value={newCity}
                          onChange={(e) => setNewCity(e.target.value)}
                          placeholder="São Paulo"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">Estado (UF)</label>
                        <input
                          type="text"
                          value={newState}
                          onChange={(e) => setNewState(e.target.value)}
                          placeholder="SP"
                          maxLength={2}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 uppercase"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* ETAPA 3: APARELHO */}
                {formStep === "equipments" && (
                  <div className="space-y-3">
                    <div className="p-3 bg-purple-50 rounded-xl border border-purple-100 text-xs text-purple-900">
                      Vincule um aparelho inicial para histórico de revisões técnicas, garantia e matching de upgrade.
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">Marca</label>
                        <select
                          value={newEquipmentBrand}
                          onChange={(e) => setNewEquipmentBrand(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
                        >
                          <option value="Apple">Apple</option>
                          <option value="Samsung">Samsung</option>
                          <option value="Xiaomi">Xiaomi</option>
                          <option value="Motorola">Motorola</option>
                          <option value="Dell">Dell</option>
                          <option value="Sony">Sony</option>
                        </select>
                      </div>

                      <div>
                        <label className="font-bold text-slate-700 block mb-1">Modelo do Aparelho</label>
                        <input
                          type="text"
                          value={newEquipmentModel}
                          onChange={(e) => setNewEquipmentModel(e.target.value)}
                          placeholder="Ex: iPhone 16 Pro 128GB"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">IMEI ou Número de Série</label>
                        <input
                          type="text"
                          value={newEquipmentImei}
                          onChange={(e) => setNewEquipmentImei(e.target.value)}
                          placeholder="15 dígitos do IMEI"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono"
                        />
                      </div>

                      <div>
                        <label className="font-bold text-slate-700 block mb-1">Cor do Aparelho</label>
                        <input
                          type="text"
                          value={newEquipmentColor}
                          onChange={(e) => setNewEquipmentColor(e.target.value)}
                          placeholder="Ex: Titânio Natural, Preto..."
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* ETAPA 4: COMERCIAL & LIMITES */}
                {formStep === "fiscal" && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">Limite de Crédito Inicial (R$)</label>
                        <input
                          type="number"
                          value={newCreditLimit}
                          onChange={(e) => setNewCreditLimit(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono"
                        />
                      </div>

                      <div>
                        <label className="font-bold text-slate-700 block mb-1">Condições de Pagamento</label>
                        <input
                          type="text"
                          value={newPaymentTerms}
                          onChange={(e) => setNewPaymentTerms(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Observações Internas</label>
                      <textarea
                        rows={3}
                        value={newNotes}
                        onChange={(e) => setNewNotes(e.target.value)}
                        placeholder="Preferências de atendimento, restrições ou perfil comercial..."
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
                      />
                    </div>

                    <div className="flex gap-4 pt-1">
                      <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                        <input
                          type="checkbox"
                          checked={isCust}
                          onChange={(e) => setIsCust(e.target.checked)}
                          className="rounded text-purple-600 focus:ring-purple-500"
                        />
                        Perfil Ativo como Cliente
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                        <input
                          type="checkbox"
                          checked={isSupp}
                          onChange={(e) => setIsSupp(e.target.checked)}
                          className="rounded text-purple-600 focus:ring-purple-500"
                        />
                        Perfil Ativo como Fornecedor
                      </label>
                    </div>
                  </div>
                )}

                {/* Ações do Modal */}
                <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                  <div>
                    {formStep !== "general" && (
                      <button
                        type="button"
                        onClick={() => {
                          if (formStep === "fiscal") setFormStep("equipments");
                          else if (formStep === "equipments") setFormStep("address");
                          else if (formStep === "address") setFormStep("general");
                        }}
                        className="px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50"
                      >
                        Voltar Etapa
                      </button>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowCreateModal(false)}
                      className="px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50"
                    >
                      Cancelar
                    </button>

                    {formStep !== "fiscal" ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (formStep === "general") setFormStep("address");
                          else if (formStep === "address") setFormStep("equipments");
                          else if (formStep === "equipments") setFormStep("fiscal");
                        }}
                        className="px-4 py-2 bg-purple-600 text-white rounded-xl text-xs font-bold hover:bg-purple-700"
                      >
                        Próxima Etapa
                      </button>
                    ) : (
                      <button
                        type="submit"
                        className="px-5 py-2.5 bg-gradient-to-r from-violet-600 to-purple-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-purple-600/30"
                      >
                        Salvar Cadastro Completo
                      </button>
                    )}
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </RootShellLayout>
  );
}
