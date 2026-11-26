"use client";

import React, { useState } from "react";
import RootShellLayout from "@/components/RootShellLayout";
import BirthdayPanel from "./BirthdayPanel";
import {localToday,validBirthDate} from "@/lib/birthday-date";
import LoyaltyPanel,{useLoyaltySummaries} from "./LoyaltyPanel";
import {useAuth} from "@/lib/auth";
import {formatCpfCnpj,formatPhoneBr,formatCep,formatDateBr,onlyDigits,normalizeDocument,normalizePhoneBr,normalizeCep,maskPhoneInput} from "@/lib/br-format";
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
  Edit3,
  MessageCircle,
  Maximize2,
  Minimize2,
  Trash2,
  Check,
  Percent,
  Coins,
  History,
  Info,
  Shield,
  ArrowRight,
  Sliders,
  Filter
} from "lucide-react";

export interface PartyContact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  whatsApp?: string;
  role?: string;
  isPrimary: boolean;
}

export interface PartyAddress {
  id: string;
  type?: "Principal" | "Entrega" | "Cobrança" | "Faturamento";
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
  batteryHealth?: number;
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
  pointsBalance?: number;
  tier?: "Bronze" | "Prata" | "Ouro" | "Diamante";
  totalSpent?: number;
  cashbackAvailable?: number;
  ordersCount?: number;
  repairsCount?: number;
  lifetimeValue?: number;
  lastPointsEarnedDate?: string;
}

export interface CustomerHistoryItem {
  id: string;
  type: "Venda" | "OS" | "Pontos" | "Resgate";
  title: string;
  dateUtc: string;
  amount: number;
  pointsDelta?: number;
  status: string;
  details: string;
}

export interface RewardItem {
  id: string;
  title: string;
  category: "Acessório" | "Vale-Compras" | "Serviço" | "Brinde";
  pointsRequired: number;
  estimatedValue: number;
  description: string;
  inStock: boolean;
}

export interface Party {
  id: string;
  type: 1 | 2; // 1 = PF, 2 = PJ
  name: string;
  tradeName?: string;
  documentNumber?: string; // CPF ou CNPJ
  rgNumber?: string;
  stateRegistration?: string; // Inscrição Estadual (IE)
  municipalRegistration?: string; // Inscrição Municipal
  birthDate?: string;
  gender?: string;
  maritalStatus?: string;
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
  gamification?: CustomerGamification;
  history: CustomerHistoryItem[];
  createdAtUtc: string;
}

export default function PartiesPage() {
  const [parties, setParties] = useState<Party[]>([]);
  const {hasPermission}=useAuth();
  const [loyaltyOpen,setLoyaltyOpen]=useState(false),[loyaltyRefresh,setLoyaltyRefresh]=useState(0);
  const summaries=useLoyaltySummaries(parties.filter(p=>p.isCustomer).map(p=>p.id),loyaltyRefresh);
  const loyaltyById=new Map(summaries.map(s=>[s.id,s]));
  const changedLoyalty=()=>setLoyaltyRefresh(v=>v+1);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Paginação e busca no servidor
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | "customers" | "suppliers">("customers");
  const [selectedTierFilter, setSelectedTierFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Carregar Clientes Reais do Backend via BFF com Paginação e Busca no Servidor
  const loadParties = React.useCallback(async (targetPage = 1, currentSearch = search, currentFilter = filterType) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const params = new URLSearchParams();
      params.set("page", targetPage.toString());
      params.set("pageSize", pageSize.toString());

      if (currentSearch.trim()) {
        params.set("search", currentSearch.trim());
      }
      if (currentFilter === "customers") {
        params.set("onlyCustomers", "true");
      } else if (currentFilter === "suppliers") {
        params.set("onlySuppliers", "true");
      }

      const res = await fetch(`/api/parties?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        const mapped: Party[] = data.map((item: any) => ({
          id: item.id,
          type: item.type === 2 ? 2 : 1,
          name: item.name,
          tradeName: item.tradeName,
          documentNumber: item.documentNumber,
          stateRegistration: item.stateRegistration,
          municipalRegistration: item.municipalRegistration,
          birthDate: item.birthDate,
          isActive: item.isActive ?? true,
          isCustomer: item.isCustomer ?? true,
          isSupplier: item.isSupplier ?? false,
          notes: item.notes,
          creditLimit: undefined,
          paymentTerms: undefined,
          createdAtUtc: item.createdAtUtc,
          contacts: (item.contacts || []).map((c: any) => ({
            id: c.id,
            name: c.name,
            phone: c.phone,
            whatsApp: c.whatsApp || c.phone,
            email: c.email,
            role: "Principal",
            isPrimary: c.isPrimary ?? false
          })),
          addresses: (item.addresses || []).map((a: any) => ({
            id: a.id,
            type: "Principal",
            street: a.street,
            number: a.number,
            complement: a.complement,
            neighborhood: a.neighborhood,
            city: a.city,
            state: a.state,
            postalCode: a.postalCode,
            isPrimary: a.isPrimary ?? false
          })),
          equipments: (item.equipments || []).map((e: any) => ({
            id: e.id,
            equipmentType: e.equipmentType || "Smartphone",
            brand: e.brand,
            model: e.model,
            color: e.color,
            imei1: e.ime1 || e.imei1,
            notes: e.notes
          })),
          consents: (item.consents || []).map((cs: any) => ({
            id: cs.id,
            channel: cs.channel,
            purpose: cs.purpose,
            isOptIn: cs.isOptIn,
            origin: cs.origin,
            eventDateUtc: cs.eventDateUtc
          })),
          gamification: undefined,
          history: []
        }));
        setParties(mapped);
        setPage(targetPage);
      } else {
        const err = await res.json().catch(() => ({}));
        setErrorMsg(err.error || "Erro ao carregar clientes do servidor.");
      }
    } catch {
      setErrorMsg("Falha na conexão com o servidor. Verifique se o backend está ativo.");
    } finally {
      setIsLoading(false);
    }
  }, [search, filterType]);

  React.useEffect(() => {
    loadParties(1, search, filterType);
  }, [filterType]);

  // Visualização e Detalhes
  const [fullScreenParty, setFullScreenParty] = useState<Party | null>(null);
  const [activeTab, setActiveTab] = useState<"cadastral" | "gamification" | "history" | "equipments" | "financial">("cadastral");
  const [redemptionSuccessMsg, setRedemptionSuccessMsg] = useState<string | null>(null);

  // Modal Novo Cadastro
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formStep, setFormStep] = useState<"general" | "address" | "equipment">("general");

  // Form State
  const [newType, setNewType] = useState<1 | 2>(1);
  const [newName, setNewName] = useState("");
  const [newTradeName, setNewTradeName] = useState("");
  const [newDoc, setNewDoc] = useState("");
  const [newRg, setNewRg] = useState("");
  const [newStateReg, setNewStateReg] = useState("");
  const [newBirthDate, setNewBirthDate] = useState("");
  const [newGender, setNewGender] = useState("");
  const [newMaritalStatus, setNewMaritalStatus] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPostalCode, setNewPostalCode] = useState("");
  const [newStreet, setNewStreet] = useState("");
  const [newNumber, setNewNumber] = useState("");
  const [newComplement, setNewComplement] = useState("");
  const [newNeighborhood, setNewNeighborhood] = useState("");
  const [newCity, setNewCity] = useState("");
  const [newState, setNewState] = useState("SP");
  const [newEquipmentBrand, setNewEquipmentBrand] = useState("Apple");
  const [newEquipmentModel, setNewEquipmentModel] = useState("");
  const [newEquipmentImei, setNewEquipmentImei] = useState("");
  const [newEquipmentColor, setNewEquipmentColor] = useState("");
  const [newCreditLimit, setNewCreditLimit] = useState("3000");
  const [newNotes, setNewNotes] = useState("");
  const [isCustomerCheck, setIsCustomerCheck] = useState(true);
  const [isSupplierCheck, setIsSupplierCheck] = useState(false);

  // Grava todos os vínculos juntos para evitar clientes incompletos.
  const handleCreateParty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      setErrorMsg("Informe o nome completo ou razão social antes de salvar.");
      setFormStep("general");
      return;
    }
    if (newStreet.trim() && (!newNeighborhood.trim() || !newCity.trim()
      || !newState.trim() || !newPostalCode.trim())) {
      setErrorMsg("Preencha rua, bairro, cidade, estado e CEP ou remova o endereço incompleto.");
      setFormStep("address");
      return;
    }

    if(newType===1&&isCustomerCheck&&newBirthDate&&!validBirthDate(newBirthDate)){setErrorMsg("Informe uma data de nascimento válida.");setFormStep("general");return;}
    setIsSaving(true);
    setErrorMsg(null);
    const payload = {
      type: newType,
      name: newName.trim(),
      tradeName: newType === 2 ? newTradeName.trim() : null,
      documentNumber: normalizeDocument(newDoc),
      stateRegistration: newType === 2 ? newStateReg.trim() : null,
      municipalRegistration: null,
      birthDate: newType===1&&isCustomerCheck&&newBirthDate ? newBirthDate : null,
      notes: newNotes.trim() || null,
      enableCustomer: isCustomerCheck,
      enableSupplier: isSupplierCheck,
      customerNotes: newNotes.trim() || null,
      supplyCategories: null,
      paymentTerms: null,
      primaryPhone: normalizePhoneBr(newPhone),
      primaryEmail: newEmail.trim() || null,
      address: newStreet.trim() ? {
        street: newStreet.trim(),
        number: newNumber.trim() || "S/N",
        complement: newComplement.trim() || null,
        neighborhood: newNeighborhood.trim(),
        city: newCity.trim(),
        state: newState.trim().toUpperCase(),
        postalCode: normalizeCep(newPostalCode)
      } : null,
      equipment: newEquipmentModel.trim() ? {
        equipmentType: "Smartphone",
        brand: newEquipmentBrand,
        model: newEquipmentModel.trim(),
        color: newEquipmentColor.trim() || null,
        imei1: newEquipmentImei.trim() || null
      } : null
    };

    try {
      const res = await fetch("/api/parties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setErrorMsg(err.error || `Falha ao salvar cadastro (HTTP ${res.status}).`);
        return;
      }

      setShowCreateModal(false);
      setSuccessMsg(`Cadastro de "${newName}" salvo com sucesso no banco de dados.`);
      setNewName("");
      setNewTradeName("");
      setNewDoc("");
      setNewRg("");
      setNewStateReg("");
      setNewBirthDate("");
      setNewGender("");
      setNewMaritalStatus("");
      setNewPhone("");
      setNewEmail("");
      setNewPostalCode("");
      setNewStreet("");
      setNewNumber("");
      setNewComplement("");
      setNewNeighborhood("");
      setNewCity("");
      setNewState("SP");
      setNewEquipmentBrand("Apple");
      setNewEquipmentModel("");
      setNewEquipmentImei("");
      setNewEquipmentColor("");
      setNewNotes("");
      setFormStep("general");
      await loadParties(1, "", "all");
      setFilterType("all");
    } catch {
      setErrorMsg("Falha de conexão ao salvar cadastro. Verifique sua conexão e tente novamente.");
    } finally {
      setIsSaving(false);
    }
  };

  // Filtragem avançada
  const filteredParties = parties.filter((p) => {
    if (filterType === "customers" && !p.isCustomer) return false;
    if (filterType === "suppliers" && !p.isSupplier) return false;
    if (selectedTierFilter !== "all" && loyaltyById.get(p.id)?.tier !== selectedTierFilter) return false;

    if (!search.trim()) return true;
    const term = search.toLowerCase();

    const matchName = p.name.toLowerCase().includes(term);
    const matchTrade = p.tradeName?.toLowerCase().includes(term);
    const digits=onlyDigits(term);
    const matchDoc = digits.length>0 && !!p.documentNumber && onlyDigits(p.documentNumber).includes(digits);
    const matchPhone = digits.length>0 && p.contacts.some(c =>
      (c.phone&&onlyDigits(c.phone).includes(digits))||(c.whatsApp&&onlyDigits(c.whatsApp).includes(digits)));
    const matchEmail = p.contacts.some(c => c.email?.toLowerCase().includes(term));
    const matchEquipment = p.equipments.some(e =>
      e.model.toLowerCase().includes(term) ||
      e.imei1?.includes(term) ||
      e.serialNumber?.toLowerCase().includes(term)
    );

    return matchName || matchTrade || matchDoc || matchPhone || matchEmail || matchEquipment;
  });

  const getTierColor = (tier: string) => {
    switch (tier) {
      case "Diamante":
        return "bg-cyan-100 text-cyan-800 border-cyan-300";
      case "Ouro":
        return "bg-amber-100 text-amber-800 border-amber-300";
      case "Prata":
        return "bg-slate-200 text-slate-800 border-slate-300";
      default:
        return "bg-orange-100 text-orange-800 border-orange-300";
    }
  };

  return (
    <RootShellLayout>
      <div className="space-y-6">
        {/* Notificações de Sucesso e Erro Globais */}
        {errorMsg && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between text-rose-800 text-xs font-bold animate-in fade-in">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg(null)} className="text-rose-500 hover:text-rose-700 font-extrabold cursor-pointer">
              ✕
            </button>
          </div>
        )}

        {successMsg && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-emerald-800 text-xs font-bold animate-in fade-in">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-700 font-extrabold cursor-pointer">
              ✕
            </button>
          </div>
        )}

        {/* Header Enterprise HB Studio */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200/90 shadow-xs">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200">
                Gestão 360º de Clientes & Pessoas
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                Clube de fidelidade
              </span>
            </div>
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900 mt-1">
              Clientes & Fornecedores Enterprise
            </h1>
            <p className="text-xs text-slate-500">
              Cadastro de clientes e fornecedores, pontos de vendas pagas e recompensas vinculados ao Neon.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {hasPermission("loyalty.view")&&hasPermission("customers.view")&&<button type="button" onClick={()=>setLoyaltyOpen(v=>!v)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-violet-700"><Gift className="w-4 h-4"/> {loyaltyOpen?"Fechar clube":"Clube de fidelidade"}</button>}
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-600 to-purple-700 hover:from-violet-700 hover:to-purple-800 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-purple-600/25"
            >
              <UserPlus className="w-4 h-4" />
              Novo Cadastro Completo
            </button>
          </div>
        </div>

        {loyaltyOpen&&<LoyaltyPanel onChanged={changedLoyalty}/>}
        {/* Barra de Filtros, Categorias e Busca Rápida */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Filtro Tipo */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                onClick={() => setFilterType("customers")}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${filterType === "customers"
                  ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
                  }`}
              >
                Clientes ({parties.filter(p => p.isCustomer).length})
              </button>
              <button
                onClick={() => setFilterType("suppliers")}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${filterType === "suppliers"
                  ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
                  }`}
              >
                Fornecedores ({parties.filter(p => p.isSupplier).length})
              </button>
              <button
                onClick={() => setFilterType("all")}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${filterType === "all"
                  ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
                  }`}
              >
                Todos ({parties.length})
              </button>
            </div>

            {/* Filtro Tier Fidelidade */}
            <div className="flex items-center gap-1.5 ml-2">
              <span className="text-[11px] font-bold text-slate-400">Nível:</span>
              <select
                value={selectedTierFilter}
                onChange={(e) => setSelectedTierFilter(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-purple-500"
              >
                <option value="all">Todos os Níveis</option>
                <option value="Bronze">Bronze</option>
                <option value="Prata">Prata</option>
                <option value="Ouro">Ouro</option>
                <option value="Diamante">Diamante</option>
              </select>
            </div>
          </div>

          {/* Campo de Busca Rápida por Nome, CPF/CNPJ, Telefone ou IMEI */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              loadParties(1, search, filterType);
            }}
            className="relative w-full md:w-96"
          >
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nome, CPF/CNPJ ou telefone (Enter para buscar)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50/70 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 text-slate-800 transition-all"
            />
          </form>
        </div>

        {/* Tabela Completa de Clientes Nível Senior (Largura Total) */}
        <div className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-xs">
          <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-600" />
              <span className="text-xs font-bold text-slate-800">
                Registros Cadastrais Ativos
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-purple-100 text-purple-700 font-bold">
                {filteredParties.length} cadastros listados
              </span>
            </div>
            <span className="text-[11px] text-slate-400 italic">
              Clique em qualquer cliente para abrir a ficha cadastral completa na tela inteira
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/40 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-4">Cliente / Razão Social</th>
                  <th className="py-3.5 px-4">Documento (CPF / CNPJ)</th>
                  <th className="py-3.5 px-4">Contato Principal</th>
                  <th className="py-3.5 px-4">Nível Clube & Pontos</th>
                  <th className="py-3.5 px-4">Dispositivos</th>
                  <th className="py-3.5 px-4">LTV / Total Comprado</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredParties.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      Nenhum cliente ou fornecedor encontrado com os filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  filteredParties.map((party) => {
                    const primaryContact = party.contacts.find(c => c.isPrimary) || party.contacts[0];
                    return (
                      <tr
                        key={party.id}
                        onClick={() => {
                          setFullScreenParty(party);
                          setActiveTab("cadastral");
                        }}
                        className="hover:bg-purple-50/40 cursor-pointer transition-colors group"
                      >
                        {/* Nome & Tipo */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-violet-600 to-purple-600 text-white font-extrabold flex items-center justify-center text-xs shadow-xs">
                              {party.name.charAt(0)}
                            </div>
                            <div>
                              <div className="font-extrabold text-slate-900 group-hover:text-purple-700 transition-colors flex items-center gap-1.5">
                                {party.name}
                                {party.isCustomer && (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    Cliente
                                  </span>
                                )}
                                {party.isSupplier && (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                    Fornecedor
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-slate-400 font-mono">
                                {party.type === 1 ? "Pessoa Física (PF)" : `PJ • ${party.tradeName || "Nome Fantasia"}`}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Documento */}
                        <td className="py-3.5 px-4 font-mono text-slate-600 font-semibold">
                          {party.documentNumber?formatCpfCnpj(party.documentNumber,party.type):"Não informado"}
                        </td>

                        {/* Contato */}
                        <td className="py-3.5 px-4">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 text-slate-800 font-medium">
                              <Phone className="w-3.5 h-3.5 text-purple-600" />
                              <span>{primaryContact?.phone||primaryContact?.whatsApp?formatPhoneBr(primaryContact?.phone||primaryContact?.whatsApp):"Sem telefone"}</span>
                            </div>
                            {primaryContact?.email && (
                              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                                <Mail className="w-3 h-3" />
                                <span>{primaryContact.email}</span>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Gamificação & Pontos por CPF */}
                        <td className="py-3.5 px-4">
                          {loyaltyById.has(party.id)?<div className="space-y-1"><span className="text-xs font-extrabold text-violet-700">{loyaltyById.get(party.id)!.balance.toLocaleString("pt-BR")} pts</span><p className="text-[10px] text-slate-500">{loyaltyById.get(party.id)!.tier??"Nível não configurado"}</p></div>:<span className="text-xs text-slate-400">{party.isCustomer?"Não confirmado":"Não aplicável"}</span>}
                        </td>

                        {/* Aparelhos */}
                        <td className="py-3.5 px-4">
                          {party.equipments && party.equipments.length > 0 ? (
                            <div className="flex items-center gap-1.5 text-slate-700">
                              <Smartphone className="w-3.5 h-3.5 text-slate-400" />
                              <span className="font-semibold">{party.equipments[0].model}</span>
                              {party.equipments.length > 1 && (
                                <span className="px-1.5 py-0.2 rounded bg-slate-100 text-[10px] font-bold text-slate-600">
                                  +{party.equipments.length - 1}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">Nenhum aparelho</span>
                          )}
                        </td>

                        {/* LTV */}
                        <td className="py-3.5 px-4">
                          {party.gamification ? (
                            <>
                              <div className="font-extrabold text-slate-900 font-mono">
                                R$ {(party.gamification.lifetimeValue || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {party.gamification.ordersCount || 0} compras • {party.gamification.repairsCount || 0} OS
                              </div>
                            </>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">Dados indisponíveis</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4 text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold ${party.isActive
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-rose-50 text-rose-700 border border-rose-200"
                            }`}>
                            {party.isActive ? "Ativo" : "Inativo"}
                          </span>
                        </td>

                        {/* Ação */}
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setFullScreenParty(party);
                              setActiveTab("cadastral");
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-purple-600 hover:text-white text-slate-700 text-xs font-bold transition-all shadow-2xs"
                          >
                            <Maximize2 className="w-3.5 h-3.5" />
                            Abrir Cadastro
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Paginação Real no Servidor */}
          <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
            <div>
              Página <span className="font-bold text-slate-900">{page}</span> ({filteredParties.length} registros nesta página)
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => loadParties(Math.max(1, page - 1), search, filterType)}
                disabled={page <= 1 || isLoading}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-bold hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ← Anterior
              </button>
              <button
                type="button"
                onClick={() => loadParties(page + 1, search, filterType)}
                disabled={filteredParties.length < pageSize || isLoading}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-bold hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Próxima →
              </button>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* TELA CHEIA: CADASTRO COMPLETO NÍVEL SENIOR DO CLIENTE                     */}
        {/* ========================================================================= */}
        {fullScreenParty && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
            <div className="bg-slate-50 w-full max-w-7xl h-[95vh] rounded-3xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden">

              {/* Topbar da Tela Cheia */}
              <div className="p-5 bg-white border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-violet-600 to-purple-700 text-white font-black text-2xl flex items-center justify-center shadow-lg shadow-purple-600/30">
                    {fullScreenParty.name.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-black text-slate-900 tracking-tight">
                        {fullScreenParty.name}
                      </h2>
                      {loyaltyById.get(fullScreenParty.id)?.tier&&<span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-violet-50 text-violet-700">Clube {loyaltyById.get(fullScreenParty.id)?.tier}</span>}
                      <button
                        type="button"
                        onClick={async () => {
                          const newStatus = !fullScreenParty.isActive;
                          try {
                            const res = await fetch(`/api/parties/${fullScreenParty.id}/status`, {
                              method: "PUT",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ isActive: newStatus }),
                            });
                            if (res.ok) {
                              const updated = { ...fullScreenParty, isActive: newStatus };
                              setFullScreenParty(updated);
                              setParties(parties.map((p) => (p.id === updated.id ? updated : p)));
                              setSuccessMsg(`Status alterado com sucesso para ${newStatus ? "Ativo" : "Inativo"}.`);
                              setTimeout(() => setSuccessMsg(null), 4000);
                            } else {
                              const err = await res.json().catch(() => ({}));
                              setErrorMsg(err.error || "Falha ao alterar status.");
                            }
                          } catch {
                            setErrorMsg("Erro de comunicação ao alterar status.");
                          }
                        }}
                        className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold border transition-colors ${fullScreenParty.isActive
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200"
                          : "bg-rose-50 text-rose-700 border-rose-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200"
                          }`}
                        title="Clique para alternar status ativo/inativo no banco"
                      >
                        {fullScreenParty.isActive ? "Cadastro Ativo (Clique p/ Inativar)" : "Cadastro Inativo (Clique p/ Ativar)"}
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 font-mono mt-1">
                      <span>{fullScreenParty.type === 1 ? "Pessoa Física" : "Pessoa Jurídica"}</span>
                      <span>•</span>
                      <span>Doc: {fullScreenParty.documentNumber?formatCpfCnpj(fullScreenParty.documentNumber,fullScreenParty.type):"Não cadastrado"}</span>
                      {fullScreenParty.rgNumber && (
                        <>
                          <span>•</span>
                          <span>RG: {fullScreenParty.rgNumber}</span>
                        </>
                      )}
                      <span>•</span>
                      <span>Cliente desde {new Date(fullScreenParty.createdAtUtc).toLocaleDateString("pt-BR")}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {fullScreenParty.contacts[0]?.whatsApp && (
                    <a
                      href={`https://wa.me/55${fullScreenParty.contacts[0].whatsApp.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
                    >
                      <MessageCircle className="w-4 h-4" />
                      Conversar no WhatsApp
                    </a>
                  )}
                  <button
                    onClick={() => setFullScreenParty(null)}
                    className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 hover:text-slate-800 transition-colors"
                    title="Fechar tela cheia"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* KPIs Rápidos do Cliente */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-100/70 border-b border-slate-200">
                <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
                  <div className="flex items-center justify-between text-purple-600 mb-1">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Pontos Fidelidade</span>
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div className="text-xl font-black text-purple-700 font-mono">
                    {loyaltyById.has(fullScreenParty.id)?loyaltyById.get(fullScreenParty.id)!.balance.toLocaleString("pt-BR")+" pts":"—"}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Compras pagas vinculadas ao cliente
                  </div>
                </div>

                <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
                  <div className="flex items-center justify-between text-emerald-600 mb-1">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Cashback Disponível</span>
                    <Coins className="w-4 h-4" />
                  </div>
                  <div className="text-xl font-black text-emerald-600 font-mono">
                    {fullScreenParty.gamification && fullScreenParty.gamification.cashbackAvailable !== undefined
                      ? `R$ ${fullScreenParty.gamification.cashbackAvailable.toFixed(2)}`
                      : "—"}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Não habilitado no checkout
                  </div>
                </div>

                <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
                  <div className="flex items-center justify-between text-blue-600 mb-1">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Total Faturado (LTV)</span>
                    <DollarSign className="w-4 h-4" />
                  </div>
                  <div className="text-xl font-black text-slate-900 font-mono">
                    {fullScreenParty.gamification && fullScreenParty.gamification.lifetimeValue !== undefined
                      ? `R$ ${fullScreenParty.gamification.lifetimeValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                      : "—"}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {fullScreenParty.gamification?.ordersCount ?? "—"} pedidos faturados
                  </div>
                </div>

                <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
                  <div className="flex items-center justify-between text-amber-600 mb-1">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Ordens de Serviço</span>
                    <Wrench className="w-4 h-4" />
                  </div>
                  <div className="text-xl font-black text-slate-900 font-mono">
                    {fullScreenParty.gamification?.repairsCount ?? "—"} Reparos
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Assistência técnica concluída
                  </div>
                </div>
              </div>

              {/* Mensagem de sucesso de resgate */}
              {redemptionSuccessMsg && (
                <div className="mx-6 mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-emerald-800 text-xs font-bold animate-in fade-in">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>{redemptionSuccessMsg}</span>
                  </div>
                  <button onClick={() => setRedemptionSuccessMsg(null)}>
                    <X className="w-4 h-4 text-emerald-600 hover:text-emerald-900" />
                  </button>
                </div>
              )}

              {/* Abas de Navegação Senior */}
              <div className="px-6 pt-3 bg-white border-b border-slate-200 flex gap-2 overflow-x-auto">
                <button
                  onClick={() => setActiveTab("cadastral")}
                  className={`flex items-center gap-2 py-3 px-4 border-b-2 font-bold text-xs transition-colors whitespace-nowrap ${activeTab === "cadastral"
                    ? "border-purple-600 text-purple-700"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                    }`}
                >
                  <FileText className="w-4 h-4" />
                  Dados Cadastrais & Endereços
                </button>
                <button
                  onClick={() => setActiveTab("gamification")}
                  className={`flex items-center gap-2 py-3 px-4 border-b-2 font-bold text-xs transition-colors whitespace-nowrap ${activeTab === "gamification"
                    ? "border-purple-600 text-purple-700"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                    }`}
                >
                  <Gift className="w-4 h-4 text-amber-500" />
                  Fidelidade & Recompensas
                </button>
                <button
                  onClick={() => setActiveTab("history")}
                  className={`flex items-center gap-2 py-3 px-4 border-b-2 font-bold text-xs transition-colors whitespace-nowrap ${activeTab === "history"
                    ? "border-purple-600 text-purple-700"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                    }`}
                >
                  <History className="w-4 h-4" />
                  Histórico de Vendas & OS ({fullScreenParty.history.length})
                </button>
                <button
                  onClick={() => setActiveTab("equipments")}
                  className={`flex items-center gap-2 py-3 px-4 border-b-2 font-bold text-xs transition-colors whitespace-nowrap ${activeTab === "equipments"
                    ? "border-purple-600 text-purple-700"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                    }`}
                >
                  <Smartphone className="w-4 h-4" />
                  Aparelhos Registrados ({fullScreenParty.equipments.length})
                </button>
                <button
                  onClick={() => setActiveTab("financial")}
                  className={`flex items-center gap-2 py-3 px-4 border-b-2 font-bold text-xs transition-colors whitespace-nowrap ${activeTab === "financial"
                    ? "border-purple-600 text-purple-700"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                    }`}
                >
                  <CreditCard className="w-4 h-4" />
                  Limites, Financeiro & LGPD
                </button>
              </div>

              {/* Conteúdo das Abas (Scrollável) */}
              <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 space-y-6">

                {/* ========================================================= */}
                {/* ABA 1: DADOS CADASTRAIS & ENDEREÇOS COMPLETO              */}
                {/* ========================================================= */}
                {(activeTab==="cadastral"||activeTab==="history")&&fullScreenParty.isCustomer&&fullScreenParty.type===1&&<BirthdayPanel key={fullScreenParty.id} partyId={fullScreenParty.id} onChanged={value=>{setFullScreenParty(p=>p?{...p,birthDate:value??undefined}:p);setParties(old=>old.map(p=>p.id===fullScreenParty.id?{...p,birthDate:value??undefined}:p));}}/>}
                {activeTab === "cadastral" && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                      {/* Cartão de Identificação */}
                      <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
                        <div className="flex items-center gap-2 text-slate-800 font-extrabold text-sm border-b border-slate-100 pb-3">
                          <Users className="w-4 h-4 text-purple-600" />
                          Identificação Principal & Fiscal
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-xs">
                          <div>
                            <span className="text-slate-400 font-medium block">Nome Completo:</span>
                            <span className="font-bold text-slate-800">{fullScreenParty.name}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 font-medium block">Tipo de Pessoa:</span>
                            <span className="font-bold text-slate-800">{fullScreenParty.type === 1 ? "Pessoa Física (PF)" : "Pessoa Jurídica (PJ)"}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 font-medium block">{fullScreenParty.type === 1 ? "CPF:" : "CNPJ:"}</span>
                            <span className="font-bold font-mono text-slate-800">{fullScreenParty.documentNumber?formatCpfCnpj(fullScreenParty.documentNumber,fullScreenParty.type):"Não informado"}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 font-medium block">{fullScreenParty.type === 1 ? "RG / Órgão Emissor:" : "Inscrição Estadual (IE):"}</span>
                            <span className="font-bold font-mono text-slate-800">{fullScreenParty.type === 1 ? (fullScreenParty.rgNumber || "Não informado") : (fullScreenParty.stateRegistration || "Isento")}</span>
                          </div>
                          {fullScreenParty.type === 1 ? (
                            <>
                              <div>
                                <span className="text-slate-400 font-medium block">Data de Nascimento:</span>
                                <span className="font-bold text-slate-800">{fullScreenParty.birthDate?formatDateBr(fullScreenParty.birthDate):"Não informado"}</span>
                              </div>
                              <div>
                                <span className="text-slate-400 font-medium block">Gênero / Estado Civil:</span>
                                <span className="font-bold text-slate-800">{fullScreenParty.gender || "Não inf."} • {fullScreenParty.maritalStatus || "Não inf."}</span>
                              </div>
                            </>
                          ) : (
                            <>
                              <div>
                                <span className="text-slate-400 font-medium block">Nome Fantasia:</span>
                                <span className="font-bold text-slate-800">{fullScreenParty.tradeName || "Não informado"}</span>
                              </div>
                              <div>
                                <span className="text-slate-400 font-medium block">Inscrição Municipal:</span>
                                <span className="font-bold text-slate-800">{fullScreenParty.municipalRegistration || "Não informado"}</span>
                              </div>
                            </>
                          )}
                        </div>

                        {/* Observações Comerciais */}
                        <div className="pt-2 border-t border-slate-100">
                          <span className="text-slate-400 font-medium block text-xs">Observações do Atendimento:</span>
                          <p className="text-xs text-slate-700 bg-amber-50/50 border border-amber-200/60 p-2.5 rounded-xl mt-1">
                            {fullScreenParty.notes || "Sem observações adicionais registradas para este cadastro."}
                          </p>
                        </div>
                      </div>

                      {/* Canais de Contato */}
                      <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                          <div className="flex items-center gap-2 text-slate-800 font-extrabold text-sm">
                            <Phone className="w-4 h-4 text-purple-600" />
                            Canais de Contato Homologados
                          </div>
                        </div>

                        <div className="space-y-3">
                          {fullScreenParty.contacts.map((contact) => (
                            <div key={contact.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-900 text-xs">{contact.name}</span>
                                  {contact.isPrimary && (
                                    <span className="px-2 py-0.2 rounded text-[9px] font-bold bg-purple-100 text-purple-700">
                                      Principal
                                    </span>
                                  )}
                                  {contact.role && (
                                    <span className="text-[10px] text-slate-400 font-mono">({contact.role})</span>
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-slate-600">
                                  {contact.phone && (
                                    <div className="flex items-center gap-1">
                                      <Phone className="w-3 h-3 text-slate-400" />
                                      <span>{formatPhoneBr(contact.phone)}</span>
                                    </div>
                                  )}
                                  {contact.whatsApp && (
                                    <div className="flex items-center gap-1 text-emerald-700 font-semibold">
                                      <MessageCircle className="w-3 h-3 text-emerald-600" />
                                      <span>{formatPhoneBr(contact.whatsApp)}</span>
                                    </div>
                                  )}
                                  {contact.email && (
                                    <div className="flex items-center gap-1">
                                      <Mail className="w-3 h-3 text-slate-400" />
                                      <span>{contact.email}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Endereços de Entrega, Faturamento e Cobrança */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2 text-slate-800 font-extrabold text-sm">
                          <MapPin className="w-4 h-4 text-purple-600" />
                          Endereços Registrados (Cobrança, Entrega & Faturamento)
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {fullScreenParty.addresses.map((addr) => (
                          <div key={addr.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl relative">
                            <div className="flex items-center justify-between mb-2">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700">
                                {addr.type || "Principal"}
                              </span>
                              {addr.isPrimary && (
                                <span className="text-[10px] font-bold text-emerald-600">Endereço Padrão</span>
                              )}
                            </div>
                            <div className="text-xs font-bold text-slate-800">
                              {addr.street}, Nº {addr.number} {addr.complement && `(${addr.complement})`}
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5">
                              {addr.neighborhood} — {addr.city} / {addr.state}
                            </div>
                            <div className="text-xs font-mono text-purple-700 font-bold mt-1">
                              CEP: {formatCep(addr.postalCode)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* ========================================================= */}
                {/* ABA 2: MÓDULO GAMIFICAÇÃO & RESGATE DE BRINDES            */}
                {/* ========================================================= */}
                {activeTab === "gamification" && (fullScreenParty.isCustomer?<LoyaltyPanel key={fullScreenParty.id} partyId={fullScreenParty.id} onChanged={changedLoyalty}/>:<div className="rounded-xl border border-slate-200 bg-white p-5 text-xs text-slate-500">Fidelidade disponível apenas para clientes cadastrados.</div>)}

                {/* ========================================================= */}
                {/* ABA 3: HISTÓRICO DE VENDAS & OS                           */}
                {/* ========================================================= */}
                {activeTab === "history" && (
                  <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div>
                        <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                          <History className="w-4 h-4 text-purple-600" />
                          Linha do Tempo de Compras, Consertos e Pontuações
                        </h4>
                        <p className="text-xs text-slate-500">
                          Rastreabilidade completa de todas as transações vinculadas ao CPF do cliente.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {fullScreenParty.history.length === 0 ? (
                        <div className="text-center py-8 text-slate-400 text-xs">
                          O histórico de transações ainda não está integrado a esta ficha; consulte os módulos de Vendas e Assistência.
                        </div>
                      ) : (
                        fullScreenParty.history.map((item) => (
                          <div key={item.id} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${item.type === "Venda" ? "bg-emerald-100 text-emerald-800" :
                                  item.type === "OS" ? "bg-blue-100 text-blue-800" :
                                    item.type === "Resgate" ? "bg-amber-100 text-amber-800" :
                                      "bg-purple-100 text-purple-800"
                                  }`}>
                                  {item.type}
                                </span>
                                <span className="font-extrabold text-slate-900 text-xs">{item.title}</span>
                              </div>
                              <p className="text-xs text-slate-600">{item.details}</p>
                              <div className="text-[10px] text-slate-400 font-mono">
                                Data: {new Date(item.dateUtc).toLocaleString("pt-BR")} • Status: {item.status}
                              </div>
                            </div>

                            <div className="text-right">
                              {item.amount > 0 && (
                                <div className="text-sm font-black text-slate-900 font-mono">
                                  R$ {item.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                </div>
                              )}
                              {item.pointsDelta !== undefined && (
                                <div className={`text-xs font-black font-mono ${item.pointsDelta >= 0 ? "text-purple-700" : "text-amber-600"}`}>
                                  {item.pointsDelta >= 0 ? `+${item.pointsDelta} pts` : `${item.pointsDelta} pts`}
                                </div>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* ========================================================= */}
                {/* ABA 4: APARELHOS DO CLIENTE                               */}
                {/* ========================================================= */}
                {activeTab === "equipments" && (
                  <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div>
                        <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                          <Smartphone className="w-4 h-4 text-purple-600" />
                          Equipamentos e Dispositivos Registrados
                        </h4>
                        <p className="text-xs text-slate-500">
                          Aparelhos vinculados para emissão rápida de Ordens de Serviço e controle de garantia.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {fullScreenParty.equipments.length === 0 ? (
                        <div className="col-span-2 text-center py-8 text-slate-400 text-xs">
                          Nenhum aparelho cadastrado para este cliente.
                        </div>
                      ) : (
                        fullScreenParty.equipments.map((eq) => (
                          <div key={eq.id} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-extrabold text-slate-900 text-sm">
                                {eq.brand} {eq.model}
                              </span>
                              {eq.color && (
                                <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-bold">
                                  {eq.color}
                                </span>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs font-mono text-slate-600">
                              <div>
                                <span className="text-slate-400 text-[10px] block font-sans">IMEI 1:</span>
                                <span>{eq.imei1 || "Não cadastrado"}</span>
                              </div>
                              {eq.imei2 && (
                                <div>
                                  <span className="text-slate-400 text-[10px] block font-sans">IMEI 2:</span>
                                  <span>{eq.imei2}</span>
                                </div>
                              )}
                              {eq.serialNumber && (
                                <div>
                                  <span className="text-slate-400 text-[10px] block font-sans">Número de Série:</span>
                                  <span>{eq.serialNumber}</span>
                                </div>
                              )}
                              {eq.batteryHealth && (
                                <div>
                                  <span className="text-slate-400 text-[10px] block font-sans">Saúde Bateria:</span>
                                  <span className="text-emerald-600 font-bold">{eq.batteryHealth}%</span>
                                </div>
                              )}
                            </div>
                            {eq.notes && (
                              <p className="text-xs text-slate-500 bg-white p-2 rounded-lg border border-slate-200/60 mt-1">
                                {eq.notes}
                              </p>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* ========================================================= */}
                {/* ABA 5: FINANCEIRO, LIMITES & LGPD                         */}
                {/* ========================================================= */}
                {activeTab === "financial" && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
                        <div className="flex items-center gap-2 text-slate-800 font-extrabold text-sm border-b border-slate-100 pb-3">
                          <CreditCard className="w-4 h-4 text-purple-600" />
                          Condições Financeiras & Limite de Crédito
                        </div>
                        <div className="space-y-3 text-xs">
                          <div className="flex justify-between items-center py-2 border-b border-slate-100">
                            <span className="text-slate-500">Limite Aprovado no Balcão:</span>
                            <span className="font-bold text-slate-800 font-mono text-xs">
                              {fullScreenParty.creditLimit !== undefined
                                ? `R$ ${fullScreenParty.creditLimit.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                                : "Não configurado"}
                            </span>
                          </div>
                          <div className="flex justify-between items-center py-2 border-b border-slate-100">
                            <span className="text-slate-500">Condição Padrão de Pagamento:</span>
                            <span className="font-bold text-slate-800">
                              {fullScreenParty.paymentTerms || "Não configurada"}
                            </span>
                          </div>
                          <div className="flex justify-between items-center py-2 border-b border-slate-100">
                            <span className="text-slate-500">Situação Cadastral de Crédito:</span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Liberado sem restrições
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Privacidade & LGPD */}
                      <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
                        <div className="flex items-center gap-2 text-slate-800 font-extrabold text-sm border-b border-slate-100 pb-3">
                          <ShieldCheck className="w-4 h-4 text-emerald-600" />
                          Privacidade de Dados & Termos LGPD
                        </div>
                        <div className="space-y-3">
                          {fullScreenParty.consents.map((cs) => (
                            <div key={cs.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                              <div>
                                <span className="font-bold text-slate-800 text-xs block">{cs.purpose}</span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  Canal: {cs.channel} • Origem: {cs.origin}
                                </span>
                              </div>
                              <span className="px-2 py-0.5 rounded text-[9px] font-extrabold bg-emerald-100 text-emerald-800">
                                Opt-in Autorizado
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL: NOVO CADASTRO COMPLETO NÍVEL SENIOR                                */}
        {/* ========================================================================= */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
            <div className="bg-white w-full min-w-0 max-w-3xl rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[calc(100dvh-1rem)] sm:max-h-[90vh]">

              {/* Modal Header */}
              <div className="p-3 sm:p-5 border-b border-slate-200 flex justify-between items-center gap-2 bg-slate-50/50">
                <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold">
                    <UserPlus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-base">Novo Cadastro Completo</h3>
                    <p className="text-xs text-slate-500">Cadastre clientes ou fornecedores com dados fiscais, endereço e clube de pontos.</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="shrink-0 p-1.5 hover:bg-slate-200 rounded-xl text-slate-400 hover:text-slate-700 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Steps */}
              <div className="flex min-w-0 shrink-0 overflow-x-auto border-b border-slate-200 bg-white px-2 sm:px-6" aria-label="Etapas do cadastro">
                <button
                  type="button"
                  onClick={() => setFormStep("general")}
                  className={`shrink-0 whitespace-nowrap py-3 px-3 sm:px-4 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                    formStep === "general" ? "border-purple-600 text-purple-700" : "border-transparent text-slate-400 hover:text-slate-700"
                  }`}
                >
                  1. Dados Pessoais / Fiscais
                </button>
                <button
                  type="button"
                  onClick={() => setFormStep("address")}
                  className={`shrink-0 whitespace-nowrap py-3 px-3 sm:px-4 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                    formStep === "address" ? "border-purple-600 text-purple-700" : "border-transparent text-slate-400 hover:text-slate-700"
                  }`}
                >
                  2. Endereço Completo
                </button>
                <button
                  type="button"
                  onClick={() => setFormStep("equipment")}
                  className={`shrink-0 whitespace-nowrap py-3 px-3 sm:px-4 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                    formStep === "equipment" ? "border-purple-600 text-purple-700" : "border-transparent text-slate-400 hover:text-slate-700"
                  }`}
                >
                  3. Aparelho & Vínculos Iniciais
                </button>
              </div>

              {/* Alerta de Erro no Próprio Modal se houver */}
              {errorMsg && (
                <div className="mx-6 mt-4 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between text-rose-800 text-xs font-bold">
                  <div className="flex items-center gap-2">
                    <Info className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                  <button type="button" onClick={() => setErrorMsg(null)} className="text-rose-500 hover:text-rose-700">✕</button>
                </div>
              )}

              {/* Form Body */}
              <form onSubmit={handleCreateParty} className="min-w-0 min-h-0 p-3 sm:p-6 space-y-4 overflow-y-auto flex-1">
                {formStep === "general" && (
                  <div className="space-y-4 animate-in fade-in">
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                        <input
                          type="radio"
                          name="personType"
                          checked={newType === 1}
                          onChange={() => {setNewType(1);setNewDoc(formatCpfCnpj(newDoc,1));}}
                          className="text-purple-600"
                        />
                        Pessoa Física (PF)
                      </label>
                      <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                        <input
                          type="radio"
                          name="personType"
                          checked={newType === 2}
                          onChange={() => {setNewType(2);setNewBirthDate("");setNewDoc(formatCpfCnpj(newDoc,2));}}
                          className="text-purple-600"
                        />
                        Pessoa Jurídica (PJ)
                      </label>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          {newType === 1 ? "Nome Completo *" : "Razão Social *"}
                        </label>
                        <input
                          type="text"
                          required
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          placeholder={newType === 1 ? "Ex: Henrique Barreto" : "Ex: Tech Distribuidora LTDA"}
                          className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                        />
                      </div>

                      {newType === 2 && (
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">Nome Fantasia</label>
                          <input
                            type="text"
                            value={newTradeName}
                            onChange={(e) => setNewTradeName(e.target.value)}
                            placeholder="Ex: HB Studio Tech"
                            className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                          />
                        </div>
                      )}

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          {newType === 1 ? "CPF *" : "CNPJ *"}
                        </label>
                        <input
                          type="text"
                          value={newDoc}
                          inputMode="numeric"
                          autoComplete="off"
                          maxLength={newType===1?14:18}
                          onChange={(e) => setNewDoc(formatCpfCnpj(e.target.value,newType))}
                          placeholder={newType === 1 ? "000.000.000-00" : "00.000.000/0000-00"}
                          className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          {newType === 1 ? "RG" : "Inscrição Estadual (IE)"}
                        </label>
                        <input
                          type="text"
                          value={newType === 1 ? newRg : newStateReg}
                          onChange={(e) => newType === 1 ? setNewRg(e.target.value) : setNewStateReg(e.target.value)}
                          placeholder={newType === 1 ? "Ex: 45.123.890-X" : "Ex: 114.892.301.110"}
                          className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">WhatsApp / Telefone *</label>
                        <input
                          type="text"
                          value={newPhone}
                          inputMode="tel"
                          autoComplete="tel"
                          maxLength={15}
                          onChange={(e) => setNewPhone(maskPhoneInput(e.target.value))}
                          placeholder="(17) 99999-9999"
                          className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">E-mail</label>
                        <input
                          type="email"
                          value={newEmail}
                          onChange={(e) => setNewEmail(e.target.value)}
                          placeholder="cliente@exemplo.com.br"
                          className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                        />
                      </div>
                    </div>

                    {newType===1&&isCustomerCheck&&<label className="block text-xs font-bold text-slate-700">Data de nascimento (opcional)<input type="date" min="1900-01-01" max={localToday()} value={newBirthDate} onChange={e=>setNewBirthDate(e.target.value)} className="mt-1 w-full sm:max-w-xs text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20"/><span className="block mt-1 font-normal text-slate-500">Usada para lembretes de aniversário no CRM. Não autoriza mensagens automaticamente.</span></label>}
                    <div className="flex items-center gap-6 pt-2">
                      <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isCustomerCheck}
                          onChange={(e) => setIsCustomerCheck(e.target.checked)}
                          className="rounded text-purple-600"
                        />
                        É Cliente (Acumula pontos no CPF)
                      </label>
                      <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isSupplierCheck}
                          onChange={(e) => setIsSupplierCheck(e.target.checked)}
                          className="rounded text-purple-600"
                        />
                        É Fornecedor de Peças / Aparelhos
                      </label>
                    </div>

                    <div className="flex justify-end pt-3">
                      <button
                        type="button"
                        onClick={() => setFormStep("address")}
                        className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all"
                      >
                        Próximo: Endereço →
                      </button>
                    </div>
                  </div>
                )}

                {formStep === "address" && (
                  <div className="space-y-4 animate-in fade-in">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">CEP</label>
                        <input
                          type="text"
                          value={newPostalCode}
                           inputMode="numeric"
                           autoComplete="postal-code"
                           maxLength={9}
                          onChange={(e) => setNewPostalCode(formatCep(e.target.value))}
                          placeholder="00000-000"
                          className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 font-mono"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-bold text-slate-700 mb-1">Logradouro / Rua</label>
                        <input
                          type="text"
                          value={newStreet}
                          onChange={(e) => setNewStreet(e.target.value)}
                          placeholder="Ex: Av. Paulista"
                          className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Número</label>
                        <input
                          type="text"
                          value={newNumber}
                          onChange={(e) => setNewNumber(e.target.value)}
                          placeholder="1842"
                          className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Complemento</label>
                        <input
                          type="text"
                          value={newComplement}
                          onChange={(e) => setNewComplement(e.target.value)}
                          placeholder="Apto / Conjunto"
                          className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Bairro</label>
                        <input
                          type="text"
                          value={newNeighborhood}
                          onChange={(e) => setNewNeighborhood(e.target.value)}
                          placeholder="Bela Vista"
                          className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Cidade</label>
                        <input
                          type="text"
                          value={newCity}
                          onChange={(e) => setNewCity(e.target.value)}
                          placeholder="Ex: São Paulo, Campinas..."
                          className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Estado (UF)</label>
                        <input
                          type="text"
                          value={newState}
                          onChange={(e) => setNewState(e.target.value)}
                          placeholder="UF (ex: SP, RJ)"
                          maxLength={2}
                          className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 uppercase"
                        />
                      </div>
                    </div>

                    <div className="flex justify-between pt-3">
                      <button
                        type="button"
                        onClick={() => setFormStep("general")}
                        className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50"
                      >
                        ← Voltar
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormStep("equipment")}
                        className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all"
                      >
                        Próximo: Aparelho →
                      </button>
                    </div>
                  </div>
                )}

                {formStep === "equipment" && (
                  <div className="space-y-4 animate-in fade-in">
                    <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-xs text-purple-900 font-medium">
                      Cadastre o smartphone ou smartwatch principal do cliente para agilizar ordens de serviço futuras.
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Marca</label>
                        <select
                          value={newEquipmentBrand}
                          onChange={(e) => setNewEquipmentBrand(e.target.value)}
                          className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                        >
                          <option value="Apple">Apple</option>
                          <option value="Samsung">Samsung</option>
                          <option value="Xiaomi">Xiaomi</option>
                          <option value="Motorola">Motorola</option>
                          <option value="Outro">Outro</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Modelo</label>
                        <input
                          type="text"
                          value={newEquipmentModel}
                          onChange={(e) => setNewEquipmentModel(e.target.value)}
                          placeholder="Ex: iPhone 16 Pro Max 256GB"
                          className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">IMEI ou Número de Série</label>
                        <input
                          type="text"
                          value={newEquipmentImei}
                          onChange={(e) => setNewEquipmentImei(e.target.value)}
                          placeholder="354928119028123"
                          className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Cor do Aparelho</label>
                        <input
                          type="text"
                          value={newEquipmentColor}
                          onChange={(e) => setNewEquipmentColor(e.target.value)}
                          placeholder="Ex: Titânio Natural"
                          className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Observações Comerciais</label>
                      <textarea
                        rows={2}
                        value={newNotes}
                        onChange={(e) => setNewNotes(e.target.value)}
                        placeholder="Ex: Cliente VIP, prefere atendimento com agendamento."
                        className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                      />
                    </div>

                    <div className="flex justify-between pt-3">
                      <button
                        type="button"
                        onClick={() => setFormStep("address")}
                        className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                      >
                        ← Voltar
                      </button>
                      <button
                        type="submit"
                        disabled={isSaving}
                        className="px-6 py-2.5 bg-gradient-to-r from-violet-600 to-purple-700 hover:from-violet-700 hover:to-purple-800 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-md shadow-purple-600/20 flex items-center gap-2 cursor-pointer"
                      >
                        {isSaving && <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                        <span>{isSaving ? "Salvando..." : "Salvar Cadastro Completo"}</span>
                      </button>
                    </div>
                  </div>
                )}
              </form>

            </div>
          </div>
        )}

      </div>
    </RootShellLayout>
  );
}
