"use client";

import React, { useState, useEffect, useCallback } from "react";
import RootShellLayout from "@/components/RootShellLayout";
import {formatCpf,normalizeDocument} from "@/lib/br-format";
import { useAuth } from "@/lib/auth";
import {
  Users,
  UserCheck,
  UserPlus,
  Shield,
  ShieldCheck,
  Key,
  Lock,
  Mail,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Crown,
  Eye,
  EyeOff,
  Sliders,
  Check,
  Building,
  UserX,
  FileText,
  Briefcase
} from "lucide-react";

interface UserItem {
  id: string;
  fullName: string;
  email: string;
  jobTitle?: string;
  isActive: boolean;
  securityStamp: number;
  createdAtUtc: string;
  isPartner: boolean;
  partnerRole?: string;
  roles: string[];
}

export default function UsersManagementPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | "partners" | "operators">("all");

  // Modais
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedUserForPassword, setSelectedUserForPassword] = useState<UserItem | null>(null);

  // Form State Novo Usuário
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isPartner, setIsPartner] = useState(false);
  const [roleTitle, setRoleTitle] = useState("CEO"); // Cargo / O que o usuário é no sistema
  const [documentNumber, setDocumentNumber] = useState("");
  const [showPasswordText, setShowPasswordText] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State Alterar Senha
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showNewPasswordText, setShowNewPasswordText] = useState(false);
  const [passwordErrorMsg, setPasswordErrorMsg] = useState<string | null>(null);

  // Carregar lista de usuários via BFF
  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      } else {
        const problem=await res.json().catch(()=>({}));setUsers([]);setErrorMsg(problem.error||"Não foi possível consultar os usuários.");
      }
    } catch {
      setUsers([]);setErrorMsg("Falha ao consultar usuários. Nenhum dado foi confirmado.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Atualiza cargo padrão sugerido ao alternar checkbox de sócio
  const handlePartnerToggle = (checked: boolean) => {
    setIsPartner(checked);
    if (checked && (!roleTitle || roleTitle === "Vendedor / Atendente PDV" || roleTitle === "Operador Geral")) {
      setRoleTitle("CEO");
    } else if (!checked && (roleTitle === "CEO" || roleTitle === "Sócio Diretor")) {
      setRoleTitle("Vendedor / Atendente PDV");
    }
  };

  // Criar Usuário
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!fullName.trim() || !email.trim() || !password) {
      setErrorMsg("Preencha todos os campos obrigatórios.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg("A confirmação de senha não confere.");
      return;
    }

    if (password.length < 6) {
      setErrorMsg("A senha deve conter no mínimo 6 caracteres.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim(),
          password,
          isPartner,
          roleTitle: roleTitle.trim() || (isPartner ? "CEO" : "Operador Geral"),
          documentNumber: normalizeDocument(documentNumber) || undefined
        })
      });

      if (res.ok) {
        setSuccessMsg(`Usuário ${fullName} criado com sucesso como "${roleTitle}"!`);
        setShowCreateModal(false);
        setFullName("");
        setEmail("");
        setPassword("");
        setConfirmPassword("");
        setIsPartner(false);
        setRoleTitle("Vendedor / Atendente PDV");
        setDocumentNumber("");
        loadUsers();
      } else {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data.error || "Não foi possível criar o usuário.");
      }
    } catch {
      setErrorMsg("Cadastro não confirmado pelo servidor. Nenhum usuário local foi criado.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Alterar Senha de Usuário
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForPassword) return;
    setPasswordErrorMsg(null);

    if (!newPassword || newPassword !== confirmNewPassword) {
      setPasswordErrorMsg("As senhas não coincidem.");
      return;
    }

    if (newPassword.length < 6) {
      setPasswordErrorMsg("A nova senha deve ter no mínimo 6 caracteres.");
      return;
    }

    try {
      const res = await fetch(`/api/users/${selectedUserForPassword.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset-password", newPassword })
      });

      if (res.ok) {
        setSuccessMsg(`Senha do usuário ${selectedUserForPassword.fullName} alterada com sucesso!`);
        setShowPasswordModal(false);
        setNewPassword("");
        setConfirmNewPassword("");
        setSelectedUserForPassword(null);
      } else {
        const data = await res.json().catch(() => ({}));
        setPasswordErrorMsg(data.error || "Erro ao redefinir a senha.");
      }
    } catch {
      setPasswordErrorMsg("Alteração de senha não confirmada.");
    }
  };

  // Ativar / Desativar Acesso
  const handleToggleStatus = async (userToToggle: UserItem) => {
    const confirmAction = window.confirm(
      `Deseja realmente ${userToToggle.isActive ? "desativar" : "reativar"} o acesso de ${userToToggle.fullName}?`
    );
    if (!confirmAction) return;

    try {
      const response=await fetch(`/api/users/${userToToggle.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle-status" })
      });
      if(!response.ok){const problem=await response.json().catch(()=>({}));throw new Error(problem.error||"Alteração não confirmada.");}
      loadUsers();
    } catch (e) {
      setErrorMsg(e instanceof Error?e.message:"Alteração não confirmada.");
    }
  };

  const filteredUsers = users.filter((u) => {
    if (filterType === "partners" && !u.isPartner) return false;
    if (filterType === "operators" && u.isPartner) return false;

    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return u.fullName.toLowerCase().includes(term) || u.email.toLowerCase().includes(term);
  });

  const totalPartners = users.filter(u => u.isPartner).length;
  const totalOperators = users.filter(u => !u.isPartner).length;

  return (
    <RootShellLayout>
      <div className="space-y-6">
        
        {/* Header Enterprise HB Studio */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200/90 shadow-xs">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200">
                Segurança & Controle de Acessos
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
                Permissões por papéis
              </span>
            </div>
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900 mt-1">
              Gestão de Usuários, Senhas & Funções
            </h1>
            <p className="text-xs text-slate-500">
              Defina os usuários, senhas de login, cargos de atuação (CEO, Gerente, Balcão, etc.) e identifique sócios vinculados ao cadastro oficial.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setShowCreateModal(true);
                setRoleTitle("CEO");
                setIsPartner(true);
              }}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-600 to-purple-700 hover:from-violet-700 hover:to-purple-800 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-purple-600/25"
            >
              <UserPlus className="w-4 h-4" />
              Novo Usuário / Sócio
            </button>
          </div>
        </div>

        {errorMsg&&!showCreateModal&&<div role="alert" className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-sm text-rose-800">{errorMsg}</div>}
        {/* Notificação de Sucesso */}
        {successMsg && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-emerald-800 text-xs font-bold animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg(null)} className="text-emerald-600 hover:text-emerald-900">
              ✕
            </button>
          </div>
        )}

        {/* Cards de Métricas */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Total de Usuários</span>
              <span className="text-2xl font-black text-slate-900 font-mono">{users.length}</span>
              <span className="text-[11px] text-slate-400 block mt-0.5">Contas registradas no sistema</span>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Sócios vinculados</span>
              <span className="text-2xl font-black text-amber-600 font-mono">{totalPartners}</span>
              <span className="text-[11px] text-slate-400 block mt-0.5">CEO / Gestão Executiva HB</span>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Crown className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Equipe & Operadores</span>
              <span className="text-2xl font-black text-blue-600 font-mono">{totalOperators}</span>
              <span className="text-[11px] text-slate-400 block mt-0.5">Acesso operacional balcão</span>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Toolbar de Filtros e Busca */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 w-full md:w-auto">
            <button
              onClick={() => setFilterType("all")}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filterType === "all"
                  ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Todos ({users.length})
            </button>
            <button
              onClick={() => setFilterType("partners")}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filterType === "partners"
                  ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Sócios ({totalPartners})
            </button>
            <button
              onClick={() => setFilterType("operators")}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filterType === "operators"
                  ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Operadores ({totalOperators})
            </button>
          </div>

          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nome, cargo ou e-mail..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 text-slate-800 transition-all"
            />
          </div>
        </div>

        {/* Tabela de Usuários */}
        <div className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-xs">
          <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-purple-600" />
              <span className="text-xs font-bold text-slate-800">
                Usuários & Funções Cadastradas
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-purple-100 text-purple-700 font-bold">
                {filteredUsers.length} registros
              </span>
            </div>
            <button
              onClick={loadUsers}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-purple-700 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              Atualizar
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/40 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-4">Usuário</th>
                  <th className="py-3.5 px-4">E-mail de Login</th>
                  <th className="py-3.5 px-4 text-center">Tipo / Vínculo</th>
                  <th className="py-3.5 px-4">Função / Cargo Definido</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      Nenhum usuário encontrado.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((item) => {
                    const primaryRole = item.roles[0] || (item.isPartner ? "CEO" : "Operador");
                    return (
                      <tr key={item.id} className="hover:bg-purple-50/30 transition-colors">
                        {/* Nome */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-extrabold text-xs shadow-xs ${
                              item.isPartner 
                                ? "bg-gradient-to-tr from-amber-500 to-amber-600 text-white" 
                                : "bg-gradient-to-tr from-violet-600 to-purple-600 text-white"
                            }`}>
                              {item.isPartner ? <Crown className="w-4 h-4" /> : item.fullName.charAt(0)}
                            </div>
                            <div>
                              <span className="font-extrabold text-slate-900 block">
                                {item.fullName}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                ID: {item.id.slice(0, 8)}...
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* E-mail */}
                        <td className="py-3.5 px-4 font-mono text-slate-600 font-semibold">
                          {item.email}
                        </td>

                        {/* Vínculo de Sócio */}
                        <td className="py-3.5 px-4 text-center">
                          {item.isPartner ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300 shadow-2xs">
                              <Crown className="w-3 h-3 text-amber-600" />
                              Sócio Ativo
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                              Colaborador
                            </span>
                          )}
                        </td>

                        {/* Cargo Profissional Informativo */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-extrabold ${
                              item.isPartner 
                                ? "bg-purple-50 text-purple-800 border border-purple-200" 
                                : "bg-slate-100 text-slate-800 border border-slate-200"
                            }`}>
                              {item.jobTitle || primaryRole}
                            </span>
                            {item.roles.some(r => r.includes("Master") || r.includes("Administrador")) && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-rose-100 text-rose-800 border border-rose-300" title="Perfil administrativo concedido e auditado">
                                ADMIN
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4 text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                            item.isActive
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-rose-50 text-rose-700 border border-rose-200"
                          }`}>
                            {item.isActive ? "Ativo" : "Bloqueado"}
                          </span>
                        </td>

                        {/* Ações */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                setSelectedUserForPassword(item);
                                setShowPasswordModal(true);
                              }}
                              className="p-1.5 hover:bg-purple-100 text-purple-700 rounded-lg transition-colors"
                              title="Redefinir Senha de Acesso"
                            >
                              <Key className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => handleToggleStatus(item)}
                              className={`p-1.5 rounded-lg transition-colors ${
                                item.isActive 
                                  ? "hover:bg-rose-100 text-rose-600" 
                                  : "hover:bg-emerald-100 text-emerald-600"
                              }`}
                              title={item.isActive ? "Suspender / Desativar Usuário" : "Reativar Usuário"}
                            >
                              {item.isActive ? <XCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* MODAL: NOVO USUÁRIO COM CAMPO "O QUE ELE É NO SISTEMA" (CARGO/FUNÇÃO)     */}
        {/* ========================================================================= */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white w-full max-w-xl rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col">
              
              <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-600 to-purple-700 text-white flex items-center justify-center font-bold">
                    <UserPlus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-base">Novo Cadastro de Usuário</h3>
                    <p className="text-xs text-slate-500">Defina o nome, e-mail, senha e a função/cargo do usuário.</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-1.5 hover:bg-slate-200 rounded-xl text-slate-400 hover:text-slate-700 transition-colors"
                >
                  ✕
                </button>
              </div>

              {errorMsg && (
                <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <form onSubmit={handleCreateUser} className="p-6 space-y-4">
                
                {/* Nome & E-mail */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Nome Completo *</label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Ex: Henrique Buzeto"
                      className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">E-mail de Login *</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="nome@hbstudio.com"
                      className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                    />
                  </div>
                </div>

                {/* FUNÇÃO / O QUE O USUÁRIO É NO SISTEMA */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    O que o usuário é no sistema (Cargo / Função) *
                  </label>
                  <div className="relative">
                    <Briefcase className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={roleTitle}
                      onChange={(e) => setRoleTitle(e.target.value)}
                      placeholder="Ex: CEO, Diretor Operacional, Vendedor Balcão, Técnico de Reparos..."
                      className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 font-semibold text-slate-800"
                    />
                  </div>
                  {/* Atalhos rápidos de cargos */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <span className="text-[10px] text-slate-400 font-bold mr-1">Sugestões:</span>
                    {["CEO", "Diretor Executivo", "Gerente Geral", "Técnico Especialista", "Vendedor Balcão", "Analista Financeiro"].map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          setRoleTitle(tag);
                          if (tag === "CEO" || tag === "Diretor Executivo") {
                            setIsPartner(true);
                          }
                        }}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md border transition-all ${
                          roleTitle === tag
                            ? "bg-purple-600 text-white border-purple-600"
                            : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>

                {/* CHECKBOX DE VÍNCULO SOCIETÁRIO */}
                <div className={`p-4 rounded-2xl border transition-all ${
                  isPartner 
                    ? "bg-amber-50/80 border-amber-300 shadow-xs" 
                    : "bg-slate-50 border-slate-200"
                }`}>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isPartner}
                      onChange={(e) => handlePartnerToggle(e.target.checked)}
                      className="mt-1 w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-slate-900 text-xs">Vínculo Societário Registrado</span>
                        <span className="px-2 py-0.2 rounded-full text-[9px] font-black bg-amber-200 text-amber-900 border border-amber-300">
                          SÓCIO AUDITADO
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Valida o vínculo societário formal no PartnersCapital para habilitação do acesso interativo. Permissões administrativas exigem atribuição explícita de papéis.
                      </p>
                    </div>
                  </label>

                  {isPartner && (
                    <div className="mt-3 pt-3 border-t border-amber-200/80">
                      <label className="block text-[11px] font-bold text-amber-900 mb-1">CPF do Sócio (para conferência no contrato social)</label>
                      <input
                        type="text"
                        value={documentNumber}
                        onChange={(e) => setDocumentNumber(formatCpf(e.target.value))}
                        placeholder="000.000.000-00"
                        className="w-full text-xs px-3 py-2 bg-white rounded-xl border border-amber-300 focus:outline-none font-mono"
                      />
                    </div>
                  )}
                </div>

                {/* Senhas */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Senha de Acesso *</label>
                    <div className="relative">
                      <input
                        type={showPasswordText ? "text" : "password"}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswordText(!showPasswordText)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPasswordText ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Confirmar Senha *</label>
                    <input
                      type={showPasswordText ? "text" : "password"}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-2 bg-gradient-to-r from-violet-600 to-purple-700 hover:from-violet-700 hover:to-purple-800 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-purple-600/20"
                  >
                    {isSubmitting ? "Criando..." : "Salvar Usuário"}
                  </button>
                </div>
              </form>

            </div>
          </div>
        )}

        {/* MODAL: REDEFINIR SENHA */}
        {showPasswordModal && selectedUserForPassword && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white w-full max-w-md rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col">
              
              <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                    <Key className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-base">Redefinir Senha</h3>
                    <p className="text-xs text-slate-500">Usuário: {selectedUserForPassword.fullName}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowPasswordModal(false)}
                  className="p-1.5 hover:bg-slate-200 rounded-xl text-slate-400 hover:text-slate-700"
                >
                  ✕
                </button>
              </div>

              {passwordErrorMsg && (
                <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span>{passwordErrorMsg}</span>
                </div>
              )}

              <form onSubmit={handleResetPassword} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nova Senha *</label>
                  <div className="relative">
                    <input
                      type={showNewPasswordText ? "text" : "password"}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Nova senha segura"
                      className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPasswordText(!showNewPasswordText)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showNewPasswordText ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Confirmar Nova Senha *</label>
                  <input
                    type={showNewPasswordText ? "text" : "password"}
                    required
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="Repita a nova senha"
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowPasswordModal(false)}
                    className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-purple-600/20"
                  >
                    Atualizar Senha
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
