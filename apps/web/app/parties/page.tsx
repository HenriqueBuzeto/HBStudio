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
  FolderOpen
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
  isCustomer: boolean;
  isSupplier: boolean;
  notes?: string;
  contacts: PartyContact[];
  equipments: CustomerEquipment[];
  consents: PartyConsent[];
}

export default function PartiesPage() {
  const [parties, setParties] = useState<Party[]>([]);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | "customers" | "suppliers">("customers");
  const [selectedParty, setSelectedParty] = useState<Party | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Formulário de Criação Completo
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<1 | 2>(1);
  const [newDoc, setNewDoc] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newEquipmentModel, setNewEquipmentModel] = useState("");
  const [newEquipmentImei, setNewEquipmentImei] = useState("");
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
      documentNumber: newDoc || undefined,
      isActive: true,
      isCustomer: isCust,
      isSupplier: isSupp,
      contacts: (newPhone || newEmail) ? [{
        id: `c-${Date.now()}`,
        name: newName,
        phone: newPhone || undefined,
        email: newEmail || undefined,
        isPrimary: true
      }] : [],
      equipments: newEquipmentModel ? [{
        id: `eq-${Date.now()}`,
        equipmentType: "Smartphone",
        brand: "Apple",
        model: newEquipmentModel,
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
      ]
    };

    setParties([newParty, ...parties]);
    setSelectedParty(newParty);
    setShowCreateModal(false);
    setNewName("");
    setNewDoc("");
    setNewPhone("");
    setNewEmail("");
    setNewEquipmentModel("");
    setNewEquipmentImei("");
  };

  return (
    <RootShellLayout>
      <div className="space-y-6">
        {/* Header estilo HBVisionX */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200/90 shadow-xs">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200">
                Pessoas & Relacionamento
              </span>
            </div>
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900 mt-1">
              Clientes & Fornecedores
            </h1>
            <p className="text-xs text-slate-500">
              Cadastro unificado, histórico de aparelhos do cliente, canais de contato e consentimentos LGPD.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-violet-600 to-purple-700 hover:from-violet-700 hover:to-purple-800 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-purple-600/20"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Novo Cadastro
            </button>
          </div>
        </div>

        {/* Toolbar de Filtro e Busca */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 p-1 bg-white rounded-xl border border-slate-200/80 shadow-xs">
            <button
              onClick={() => setFilterType("customers")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filterType === "customers"
                  ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Clientes ({parties.filter(p => p.isCustomer).length})
            </button>
            <button
              onClick={() => setFilterType("suppliers")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filterType === "suppliers"
                  ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Fornecedores ({parties.filter(p => p.isSupplier).length})
            </button>
            <button
              onClick={() => setFilterType("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filterType === "all"
                  ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Todos ({parties.length})
            </button>
          </div>

          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nome, fantasia ou CPF/CNPJ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 text-slate-800 transition-all shadow-xs"
            />
          </div>
        </div>

        {/* Master-Detail Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Tabela de Pessoas (Esquerda) */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-bold text-[10px]">
                <tr>
                  <th className="py-3 px-4">Nome / Razão</th>
                  <th className="py-3 px-4">Documento</th>
                  <th className="py-3 px-4">Perfis</th>
                  <th className="py-3 px-4">Contato</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredParties.map((p) => {
                  const isSelected = selectedParty?.id === p.id;
                  const primaryContact = p.contacts.find(c => c.isPrimary) || p.contacts[0];
                  return (
                    <tr
                      key={p.id}
                      onClick={() => setSelectedParty(p)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-purple-50/50 hover:bg-purple-50"
                          : "hover:bg-slate-50/80"
                      }`}
                    >
                      <td className="py-3.5 px-4">
                        <div className="font-extrabold text-slate-900">{p.name}</div>
                        {p.tradeName && <div className="text-[10px] text-slate-400">{p.tradeName}</div>}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-600">
                        {p.documentNumber || "Não informado"}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex gap-1">
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
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {primaryContact?.phone || primaryContact?.email || "Sem contato"}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Ativo
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {filteredParties.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-16 text-center text-slate-400">
                      <FolderOpen className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                      <p className="font-bold text-slate-700">Nenhum cadastro registrado</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Clique em "Novo Cadastro" para adicionar o primeiro cliente ou fornecedor.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Painel de Detalhes da Pessoa (Direita) */}
          <div className="lg:col-span-5">
            {selectedParty ? (
              <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-5">
                <div className="flex items-start justify-between pb-4 border-b border-slate-100">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                      {selectedParty.type === 1 ? "Pessoa Física (PF)" : "Pessoa Jurídica (PJ)"}
                    </span>
                    <h3 className="text-base font-extrabold text-slate-900 mt-2">{selectedParty.name}</h3>
                    {selectedParty.documentNumber && (
                      <p className="text-xs font-mono text-slate-500">{selectedParty.documentNumber}</p>
                    )}
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Ativo
                  </span>
                </div>

                {/* Contatos */}
                <div className="space-y-2">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-purple-600" />
                    Canais de Contato
                  </h4>
                  <div className="space-y-1.5">
                    {selectedParty.contacts.map((c) => (
                      <div key={c.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs flex justify-between items-center">
                        <div>
                          <p className="font-bold text-slate-800">{c.name}</p>
                          <p className="text-[11px] text-slate-500">{c.phone || c.email}</p>
                        </div>
                        {c.isPrimary && (
                          <span className="px-1.5 py-0.5 text-[9px] font-bold bg-purple-50 text-purple-700 rounded border border-purple-200">
                            Principal
                          </span>
                        )}
                      </div>
                    ))}
                    {selectedParty.contacts.length === 0 && (
                      <p className="text-xs text-slate-400 italic">Nenhum telefone ou e-mail cadastrado.</p>
                    )}
                  </div>
                </div>

                {/* Equipamentos do Cliente */}
                <div className="space-y-2">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5 text-purple-600" />
                    Aparelhos Vinculados
                  </h4>
                  {selectedParty.equipments.length > 0 ? (
                    <div className="space-y-2">
                      {selectedParty.equipments.map((eq) => (
                        <div key={eq.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="font-extrabold text-slate-900">{eq.brand} {eq.model}</span>
                            <span className="text-[10px] font-mono text-slate-500">{eq.color}</span>
                          </div>
                          {eq.imei1 && (
                            <p className="text-[10px] font-mono text-slate-500">IMEI: <strong>{eq.imei1}</strong></p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 bg-slate-50 rounded-xl text-center text-xs text-slate-400 border border-dashed border-slate-200">
                      Nenhum equipamento registrado para este cliente.
                    </div>
                  )}
                </div>

                {/* Consentimentos LGPD */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                    Consentimentos de Privacidade (LGPD)
                  </h4>
                  <div className="space-y-1">
                    {selectedParty.consents.map((cs) => (
                      <div key={cs.id} className="flex justify-between items-center text-[11px] p-2 bg-slate-50 rounded-lg">
                        <span className="text-slate-600">{cs.channel}: {cs.purpose}</span>
                        <span className="font-bold text-emerald-600 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Autorizado
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200/90 p-8 text-center text-slate-400 shadow-xs">
                <Users className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                <p className="text-xs font-semibold">Selecione uma pessoa na lista para visualizar seus dados.</p>
              </div>
            )}
          </div>
        </div>

        {/* Modal de Cadastro */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 shadow-xl space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <h3 className="text-sm font-extrabold text-slate-900">Novo Cadastro Completo</h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateParty} className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Nome Completo / Razão Social *</label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Ex: João da Silva ou Tech Store LTDA"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 text-slate-800"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Tipo</label>
                    <select
                      value={newType}
                      onChange={(e) => setNewType(Number(e.target.value) as 1 | 2)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none text-slate-800 font-medium"
                    >
                      <option value={1}>Pessoa Física (CPF)</option>
                      <option value={2}>Pessoa Jurídica (CNPJ)</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">CPF ou CNPJ</label>
                    <input
                      type="text"
                      value={newDoc}
                      onChange={(e) => setNewDoc(e.target.value)}
                      placeholder="000.000.000-00"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 text-slate-800"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Telefone / WhatsApp</label>
                    <input
                      type="text"
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      placeholder="(11) 90000-0000"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">E-mail</label>
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="contato@email.com"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none text-slate-800"
                    />
                  </div>
                </div>

                <div className="p-3 bg-purple-50/50 rounded-xl border border-purple-100 space-y-2">
                  <span className="font-bold text-purple-900 block text-[11px]">Vincular Aparelho do Cliente (Opcional)</span>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Modelo (ex: iPhone 14 Pro 128GB)"
                      value={newEquipmentModel}
                      onChange={(e) => setNewEquipmentModel(e.target.value)}
                      className="px-2.5 py-1.5 bg-white border border-purple-200 rounded-lg text-slate-800"
                    />
                    <input
                      type="text"
                      placeholder="IMEI (15 dígitos)"
                      value={newEquipmentImei}
                      onChange={(e) => setNewEquipmentImei(e.target.value)}
                      className="px-2.5 py-1.5 bg-white border border-purple-200 rounded-lg text-slate-800 font-mono"
                    />
                  </div>
                </div>

                <div className="flex gap-4 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                    <input
                      type="checkbox"
                      checked={isCust}
                      onChange={(e) => setIsCust(e.target.checked)}
                      className="rounded text-purple-600 focus:ring-purple-500"
                    />
                    Perfil Cliente
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                    <input
                      type="checkbox"
                      checked={isSupp}
                      onChange={(e) => setIsSupp(e.target.checked)}
                      className="rounded text-purple-600 focus:ring-purple-500"
                    />
                    Perfil Fornecedor
                  </label>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-gradient-to-r from-violet-600 to-purple-700 text-white rounded-xl text-xs font-bold shadow-md shadow-purple-600/20"
                  >
                    Salvar Cadastro
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
