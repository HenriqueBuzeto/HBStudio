"use client";

import React, { useState } from "react";
import RootShellLayout from "@/components/RootShellLayout";
import { 
  Users, 
  UserPlus, 
  Search, 
  Smartphone, 
  Truck, 
  ShieldCheck, 
  Phone, 
  Mail, 
  MapPin, 
  Plus, 
  CheckCircle2, 
  AlertCircle,
  FileText,
  Clock
} from "lucide-react";

export interface PartyContact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  whatsApp?: string;
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

export interface Party {
  id: string;
  type: 1 | 2; // 1 = PF, 2 = PJ
  name: string;
  tradeName?: string;
  documentNumber?: string;
  stateRegistration?: string;
  birthDate?: string;
  isActive: boolean;
  notes?: string;
  isCustomer: boolean;
  isSupplier: boolean;
  contacts: PartyContact[];
  equipments: CustomerEquipment[];
  consents: PartyConsent[];
  createdAtUtc: string;
  version: number;
}

export default function CustomersPage() {
  const [activeTab, setActiveTab] = useState<"all" | "customers" | "suppliers">("customers");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedParty, setSelectedParty] = useState<Party | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEquipmentModal, setShowEquipmentModal] = useState(false);

  // Form states
  const [newName, setNewName] = useState("");
  const [newDoc, setNewDoc] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [isCustomerCheck, setIsCustomerCheck] = useState(true);
  const [isSupplierCheck, setIsSupplierCheck] = useState(false);
  const [supplyCategories, setSupplyCategories] = useState("");

  // Equipment form states
  const [eqType, setEqType] = useState("Celular");
  const [eqBrand, setEqBrand] = useState("Apple");
  const [eqModel, setEqModel] = useState("");
  const [eqImei, setEqImei] = useState("");
  const [eqNotes, setEqNotes] = useState("");

  // Lista local alimentada para validação interativa imediata no cliente
  const [parties, setParties] = useState<Party[]>([
    {
      id: "c1",
      type: 1,
      name: "Carlos Eduardo Silva",
      documentNumber: "12345678901",
      isActive: true,
      notes: "Cliente balcão fidelizado",
      isCustomer: true,
      isSupplier: false,
      contacts: [{ id: "ct1", name: "Carlos", phone: "11987654321", isPrimary: true }],
      equipments: [
        { id: "eq1", equipmentType: "Celular", brand: "Apple", model: "iPhone 14 Pro Max", imei1: "354890123456789", color: "Roxo", notes: "Tela piscando" }
      ],
      consents: [
        { id: "cs1", channel: "WHATSAPP", purpose: "Marketing", isOptIn: true, origin: "Balcão", eventDateUtc: "2026-11-13T21:40:00Z" }
      ],
      createdAtUtc: "2026-11-13T20:00:00Z",
      version: 1
    },
    {
      id: "c2",
      type: 2,
      name: "Tech Parts & Serviços LTDA",
      tradeName: "TechParts",
      documentNumber: "12345678000199",
      stateRegistration: "123456789",
      isActive: true,
      notes: "Fornecedor de telas e cliente de manutenção",
      isCustomer: true,
      isSupplier: true,
      contacts: [{ id: "ct2", name: "Comercial Tech", email: "contato@techparts.com", phone: "1133334444", isPrimary: true }],
      equipments: [],
      consents: [],
      createdAtUtc: "2026-11-13T20:30:00Z",
      version: 1
    }
  ]);

  const filteredParties = parties.filter((p) => {
    if (activeTab === "customers" && !p.isCustomer) return false;
    if (activeTab === "suppliers" && !p.isSupplier) return false;
    if (searchTerm) {
      const matchName = p.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchDoc = p.documentNumber?.includes(searchTerm);
      return matchName || matchDoc;
    }
    return true;
  });

  const handleCreateParty = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName) return;

    const newParty: Party = {
      id: "p_" + Date.now(),
      type: newDoc.length > 11 ? 2 : 1,
      name: newName,
      documentNumber: newDoc,
      isActive: true,
      isCustomer: isCustomerCheck,
      isSupplier: isSupplierCheck,
      contacts: newPhone ? [{ id: "ct_" + Date.now(), name: newName, phone: newPhone, email: newEmail, isPrimary: true }] : [],
      equipments: [],
      consents: [
        { id: "cs_" + Date.now(), channel: "WHATSAPP", purpose: "Operacional", isOptIn: true, origin: "Cadastro Inicial", eventDateUtc: new Date().toISOString() }
      ],
      createdAtUtc: new Date().toISOString(),
      version: 1
    };

    setParties([newParty, ...parties]);
    setShowCreateModal(false);
    setSelectedParty(newParty);
    setNewName("");
    setNewDoc("");
    setNewPhone("");
    setNewEmail("");
  };

  const handleAddEquipment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedParty || !eqModel) return;

    const newEq: CustomerEquipment = {
      id: "eq_" + Date.now(),
      equipmentType: eqType,
      brand: eqBrand,
      model: eqModel,
      imei1: eqImei,
      notes: eqNotes
    };

    const updated = {
      ...selectedParty,
      equipments: [...selectedParty.equipments, newEq]
    };

    setParties(parties.map(p => p.id === selectedParty.id ? updated : p));
    setSelectedParty(updated);
    setShowEquipmentModal(false);
    setEqModel("");
    setEqImei("");
    setEqNotes("");
  };

  return (
    <RootShellLayout>
      <div className="space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Users className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
              Gestão de Pessoas (Clientes & Fornecedores)
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Módulo MOD-01: Cadastro unificado, equipamentos do cliente, preferências de privacidade e histórico integrado.
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-colors shadow-sm"
          >
            <UserPlus className="w-4 h-4" />
            Novo Cadastro
          </button>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-1 p-1 bg-slate-200/60 dark:bg-slate-800/60 rounded-lg w-full sm:w-auto">
            <button
              onClick={() => setActiveTab("customers")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                activeTab === "customers" ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm" : "text-slate-600 dark:text-slate-400"
              }`}
            >
              Clientes ({parties.filter(p => p.isCustomer).length})
            </button>
            <button
              onClick={() => setActiveTab("suppliers")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                activeTab === "suppliers" ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm" : "text-slate-600 dark:text-slate-400"
              }`}
            >
              Fornecedores ({parties.filter(p => p.isSupplier).length})
            </button>
            <button
              onClick={() => setActiveTab("all")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                activeTab === "all" ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm" : "text-slate-600 dark:text-slate-400"
              }`}
            >
              Todos ({parties.length})
            </button>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar por nome ou CPF/CNPJ..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Content Layout: Master-Detail */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Table / List */}
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 text-xs uppercase font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Nome / Razão</th>
                    <th className="px-4 py-3">Documento</th>
                    <th className="px-4 py-3">Perfis</th>
                    <th className="px-4 py-3">Contato</th>
                    <th className="px-4 py-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredParties.map((p) => {
                    const primaryContact = p.contacts.find(c => c.isPrimary) || p.contacts[0];
                    const isSelected = selectedParty?.id === p.id;
                    return (
                      <tr
                        key={p.id}
                        onClick={() => setSelectedParty(p)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? "bg-indigo-50/60 dark:bg-indigo-950/30" : "hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                        }`}
                      >
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-900 dark:text-slate-100">{p.name}</p>
                          {p.tradeName && <p className="text-xs text-slate-400">{p.tradeName}</p>}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-400">
                          {p.documentNumber || "Não informado"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            {p.isCustomer && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                                Cliente
                              </span>
                            )}
                            {p.isSupplier && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300">
                                Fornecedor
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400">
                          {primaryContact?.phone || primaryContact?.email || "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                            Ativo
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Details Pane */}
          <div className="lg:col-span-5 space-y-4">
            {selectedParty ? (
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-5">
                <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{selectedParty.name}</h3>
                    <p className="text-xs text-slate-500 font-mono">
                      {selectedParty.documentNumber ? `Doc: ${selectedParty.documentNumber}` : "Sem documento cadastrado"}
                    </p>
                  </div>
                  <span className="text-xs font-semibold px-2 py-1 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 rounded">
                    {selectedParty.type === 1 ? "Pessoa Física" : "Pessoa Jurídica"}
                  </span>
                </div>

                {/* Equipamentos do Cliente */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <Smartphone className="w-3.5 h-3.5 text-indigo-500" />
                      Equipamentos do Cliente ({selectedParty.equipments.length})
                    </h4>
                    <button
                      onClick={() => setShowEquipmentModal(true)}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Adicionar
                    </button>
                  </div>
                  {selectedParty.equipments.length === 0 ? (
                    <div className="p-3 bg-slate-50 dark:bg-slate-950/40 rounded-lg text-xs text-slate-500 text-center">
                      Nenhum equipamento registrado (CustomerEquipment não é mercadoria vendável da empresa).
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selectedParty.equipments.map(eq => (
                        <div key={eq.id} className="p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 text-xs">
                          <p className="font-semibold text-slate-900 dark:text-slate-100">{eq.brand} {eq.model}</p>
                          <p className="text-slate-500 font-mono mt-0.5">IMEI: {eq.imei1 || "Não informado"} | Tipo: {eq.equipmentType}</p>
                          {eq.notes && <p className="text-slate-400 mt-1 italic">{eq.notes}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Consentimentos & Privacidade LGPD */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 mb-2">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                    Consentimentos & Privacidade LGPD
                  </h4>
                  <div className="space-y-2">
                    {selectedParty.consents.map(c => (
                      <div key={c.id} className="p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                        <div>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{c.channel} ({c.purpose})</span>
                          <p className="text-[10px] text-slate-400">Origem: {c.origin}</p>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          {c.isOptIn ? "Opt-in Autorizado" : "Revogado"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-8 text-center text-slate-400 shadow-sm">
                <Users className="w-10 h-10 mx-auto mb-2 text-slate-300 dark:text-slate-700" />
                <p className="text-sm font-medium">Selecione uma pessoa para visualizar os detalhes cadastrais e equipamentos vinculados.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Criação de Pessoa */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 max-w-lg w-full p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Novo Cadastro Unificado (MOD-01)</h3>
            <form onSubmit={handleCreateParty} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Nome Completo / Razão Social *</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">CPF ou CNPJ</label>
                  <input
                    type="text"
                    value={newDoc}
                    onChange={(e) => setNewDoc(e.target.value)}
                    placeholder="Somente dígitos"
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">WhatsApp / Celular</label>
                  <input
                    type="text"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="DDD + Número"
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg mt-1"
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-2">
                <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isCustomerCheck}
                    onChange={(e) => setIsCustomerCheck(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  Habilitar Perfil Cliente
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isSupplierCheck}
                    onChange={(e) => setIsSupplierCheck(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  Habilitar Perfil Fornecedor
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-sm"
                >
                  Salvar Cadastro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Adicionar Equipamento */}
      {showEquipmentModal && selectedParty && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Vincular Equipamento ao Cliente</h3>
            <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
              Nota: CustomerEquipment é propriedade do cliente e não entra no estoque vendável da loja.
            </p>
            <form onSubmit={handleAddEquipment} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Tipo</label>
                  <select
                    value={eqType}
                    onChange={(e) => setEqType(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg mt-1"
                  >
                    <option value="Celular">Celular</option>
                    <option value="Notebook">Notebook</option>
                    <option value="PC Gamer">PC Gamer</option>
                    <option value="Videogame">Videogame</option>
                    <option value="Caixa de Som">Caixa de Som</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Marca</label>
                  <input
                    type="text"
                    required
                    value={eqBrand}
                    onChange={(e) => setEqBrand(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg mt-1"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Modelo *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: iPhone 14 Pro Max 256GB"
                  value={eqModel}
                  onChange={(e) => setEqModel(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">IMEI ou Número de Série</label>
                <input
                  type="text"
                  placeholder="IMEI1 ou Serial"
                  value={eqImei}
                  onChange={(e) => setEqImei(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Observações / Estado do Aparelho</label>
                <textarea
                  value={eqNotes}
                  onChange={(e) => setEqNotes(e.target.value)}
                  rows={2}
                  placeholder="Ex: Vidro traseiro trincado, sem carregador"
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg mt-1"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEquipmentModal(false)}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-sm"
                >
                  Vincular Equipamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </RootShellLayout>
  );
}
