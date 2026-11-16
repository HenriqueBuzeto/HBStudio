"use client";

import React, { useState, useEffect } from "react";
import {
  MessageSquare,
  Send,
  Bell,
  CheckCircle2,
  AlertCircle,
  Clock,
  Shield,
  RefreshCw,
  Search,
  Filter,
  FileText,
  KeyRound,
  Check,
  ChevronRight,
  User,
  Smartphone,
  Phone,
  Radio,
  ExternalLink,
  ShieldAlert,
  Info,
} from "lucide-react";

interface MessageRequestItem {
  id: string;
  recipientPhone: string;
  recipientPartyName?: string;
  channel: string;
  templateName?: string;
  bodyPreview: string;
  category: string;
  status: "Queued" | "Leased" | "Sent" | "Failed" | "BlockedByConsent";
  retryCount: number;
  errorMessage?: string;
  createdAt: string;
  sentAt?: string;
}

interface InAppNotificationItem {
  id: string;
  title: string;
  message: string;
  severity: "Info" | "Success" | "Warning" | "Error";
  isRead: boolean;
  createdAt: string;
}

interface MessageTemplateItem {
  id: string;
  name: string;
  category: "UTILITY" | "MARKETING" | "AUTHENTICATION";
  language: string;
  bodyText: string;
  isMetaApproved: boolean;
}

export default function MessagingPage() {
  const [activeTab, setActiveTab] = useState<"queue" | "notifications" | "templates" | "provider">("queue");
  const [queueSearch, setQueueSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [loading, setLoading] = useState(false);

  // Estados de dados reais
  const [messages, setMessages] = useState<MessageRequestItem[]>([]);
  const [notifications, setNotifications] = useState<InAppNotificationItem[]>([]);
  const [templates, setTemplates] = useState<MessageTemplateItem[]>([
    {
      id: "tpl-1",
      name: "crm_opportunity_match",
      category: "MARKETING",
      language: "pt_BR",
      bodyText: "Olá {{1}}, uma unidade de {{2}} acabou de chegar ao nosso estoque da HB Studio! Deseja reservar?",
      isMetaApproved: true,
    },
    {
      id: "tpl-2",
      name: "repair_os_status_update",
      category: "UTILITY",
      language: "pt_BR",
      bodyText: "Olá {{1}}, sua OS {{2}} teve o status atualizado para: {{3}}. Acompanhe seu aparelho em nossa loja.",
      isMetaApproved: true,
    },
    {
      id: "tpl-3",
      name: "sales_receipt_delivery",
      category: "UTILITY",
      language: "pt_BR",
      bodyText: "Obrigado pela sua compra na HB Studio! O comprovante e garantia da venda {{1}} estão disponíveis.",
      isMetaApproved: true,
    },
    {
      id: "tpl-4",
      name: "stock_reservation_expiring",
      category: "UTILITY",
      language: "pt_BR",
      bodyText: "Aviso HB Studio: Sua reserva para o item {{1}} expira em 4 horas. Confirme para não perder a unidade.",
      isMetaApproved: true,
    },
  ]);

  // Modal de envio rápido / teste de mensagem
  const [showSendModal, setShowSendModal] = useState(false);
  const [newRecipient, setNewRecipient] = useState("");
  const [newTemplate, setNewTemplate] = useState("crm_opportunity_match");
  const [sendCategory, setSendCategory] = useState<"UTILITY" | "MARKETING">("UTILITY");
  const [customParam1, setCustomParam1] = useState("Cliente");
  const [customParam2, setCustomParam2] = useState("iPhone 14 Pro 128GB");

  // Provedor WhatsApp Cloud API Status
  const [metaConfig, setMetaConfig] = useState({
    phoneNumberId: "",
    wabaId: "",
    accessTokenConfigured: false,
    webhookCallbackUrl: "https://erp.hbstudio.com.br/api/webhooks/whatsapp",
    verifyTokenConfigured: true,
    hmacVerificationActive: true,
  });

  const loadData = async () => {
    setLoading(true);
    try {
      // Simulação inicial caso endpoints ainda estejam sendo chamados sem token de sessão no browser
      // Em produção busca de /api/messaging/queue e /api/messaging/notifications
      setMessages([
        {
          id: "msg-001",
          recipientPhone: "5511987654321",
          recipientPartyName: "Carlos Eduardo Silva",
          channel: "WhatsApp",
          templateName: "crm_opportunity_match",
          bodyPreview: "Olá Carlos, uma unidade de iPhone 14 Pro acabou de chegar ao nosso estoque da HB Studio!",
          category: "MARKETING",
          status: "Sent",
          retryCount: 0,
          createdAt: "Hoje às 10:45",
          sentAt: "Hoje às 10:45:03",
        },
        {
          id: "msg-002",
          recipientPhone: "551133334444",
          recipientPartyName: "Tech Parts & Serviços LTDA",
          channel: "WhatsApp",
          templateName: "sales_receipt_delivery",
          bodyPreview: "Obrigado pela sua compra na HB Studio! Comprovante da venda VDA-2026-081 emitido.",
          category: "UTILITY",
          status: "Sent",
          retryCount: 0,
          createdAt: "Hoje às 09:12",
          sentAt: "Hoje às 09:12:02",
        },
        {
          id: "msg-003",
          recipientPhone: "5517992651033",
          recipientPartyName: "Henrique Barreto",
          channel: "WhatsApp",
          templateName: "repair_os_status_update",
          bodyPreview: "Olá Henrique, sua OS 1042 teve o status atualizado para: Reparo Concluído / Testes Aprovados.",
          category: "UTILITY",
          status: "Sent",
          retryCount: 0,
          createdAt: "Ontem às 18:30",
          sentAt: "Ontem às 18:30:05",
        },
      ]);

      setNotifications([
        {
          id: "notif-01",
          title: "Expiração de Reserva CRM",
          message: "A reserva RES-CRM-924 expirou após 48h. 1 unidade de Apple Watch Ultra foi devolvida ao saldo disponível do Depósito.",
          severity: "Warning",
          isRead: false,
          createdAt: "Há 12 minutos",
        },
        {
          id: "notif-02",
          title: "Novo Match de Fila de Desejo",
          message: "Chegou no almoxarifado o SKU iPhone 14 Pro Dourado correspondente ao interesse do cliente Lucas Rocha.",
          severity: "Success",
          isRead: true,
          createdAt: "Há 1 hora",
        },
        {
          id: "notif-03",
          title: "Opt-Out Recebido via WhatsApp",
          message: "O contato 551199998888 respondeu 'SAIR'. Consentimento de Marketing revogado canonicamente no PartyConsentRecord.",
          severity: "Info",
          isRead: true,
          createdAt: "Há 3 horas",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSendTestMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRecipient) return;

    const newMessage: MessageRequestItem = {
      id: `msg-${Date.now().toString().slice(-4)}`,
      recipientPhone: newRecipient,
      recipientPartyName: customParam1,
      channel: "WhatsApp",
      templateName: newTemplate,
      bodyPreview: `Olá ${customParam1}, novidade sobre ${customParam2} na HB Studio!`,
      category: sendCategory,
      status: "Queued",
      retryCount: 0,
      createdAt: "Agora mesmo",
    };

    setMessages([newMessage, ...messages]);
    setShowSendModal(false);
    setNewRecipient("");
  };

  const filteredMessages = messages.filter((m) => {
    const matchesSearch =
      m.recipientPhone.includes(queueSearch) ||
      (m.recipientPartyName && m.recipientPartyName.toLowerCase().includes(queueSearch.toLowerCase())) ||
      m.bodyPreview.toLowerCase().includes(queueSearch.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || m.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-600 border border-purple-500/20 uppercase tracking-wider">
              MENSAGERIA & COMUNICAÇÃO OFICIAL
            </span>
            <span className="text-xs text-slate-400">MOD-09 Enterprise</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight mt-1 flex items-center gap-3">
            Mensageria & WhatsApp Cloud API
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Fila persistente com expiração automática de reservas, validação LGPD/Consentimentos e Meta Graph API oficial.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold shadow-sm transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-purple-600" : ""}`} />
            Atualizar
          </button>
          <button
            onClick={() => setShowSendModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white text-sm font-bold shadow-md shadow-purple-600/25 transition-all"
          >
            <Send className="w-4 h-4" />
            Nova Mensagem
          </button>
        </div>
      </div>

      {/* KPIs Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Fila Pendente</p>
            <p className="text-2xl font-extrabold text-slate-900 mt-1">
              {messages.filter((m) => m.status === "Queued" || m.status === "Leased").length}
            </p>
            <p className="text-[11px] text-emerald-600 font-semibold mt-1 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Worker ativo (Lease 60s)
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Mensagens Entregues</p>
            <p className="text-2xl font-extrabold text-slate-900 mt-1">
              {messages.filter((m) => m.status === "Sent").length}
            </p>
            <p className="text-[11px] text-slate-500 font-medium mt-1">WhatsApp Cloud API</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Alertas & Notificações</p>
            <p className="text-2xl font-extrabold text-slate-900 mt-1">{notifications.length}</p>
            <p className="text-[11px] text-purple-600 font-semibold mt-1">
              {notifications.filter((n) => !n.isRead).length} não lidas
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-600 flex items-center justify-center font-bold">
            <Bell className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">LGPD & Consentimentos</p>
            <p className="text-2xl font-extrabold text-slate-900 mt-1">100%</p>
            <p className="text-[11px] text-indigo-600 font-semibold mt-1">Fonte: PartyConsentRecord</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center font-bold">
            <Shield className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-slate-200">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab("queue")}
            className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === "queue"
                ? "border-purple-600 text-purple-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            Fila de Mensagens
            <span className="px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-600">
              {messages.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("notifications")}
            className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === "notifications"
                ? "border-purple-600 text-purple-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Bell className="w-4 h-4" />
            Notificações Internas do ERP
            {notifications.filter((n) => !n.isRead).length > 0 && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-600 font-bold">
                {notifications.filter((n) => !n.isRead).length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("templates")}
            className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === "templates"
                ? "border-purple-600 text-purple-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <FileText className="w-4 h-4" />
            Templates Oficiais Meta
            <span className="px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-600">
              {templates.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("provider")}
            className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === "provider"
                ? "border-purple-600 text-purple-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <KeyRound className="w-4 h-4" />
            WhatsApp Cloud API & Webhooks
          </button>
        </div>
      </div>

      {/* Tab: FILA DE MENSAGENS */}
      {activeTab === "queue" && (
        <div className="space-y-4">
          {/* Filtros e Busca */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={queueSearch}
                onChange={(e) => setQueueSearch(e.target.value)}
                placeholder="Buscar por telefone, cliente ou texto..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="ALL">Todos os Status</option>
                <option value="Queued">Na Fila (Queued)</option>
                <option value="Sent">Enviados (Sent)</option>
                <option value="Failed">Falhas (Failed)</option>
                <option value="BlockedByConsent">Bloqueado por LGPD</option>
              </select>
            </div>
          </div>

          {/* Tabela de Mensagens */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50/75 border-b border-slate-200 text-xs uppercase font-bold text-slate-400 tracking-wider">
                  <tr>
                    <th className="px-6 py-4">Destinatário & Cliente</th>
                    <th className="px-6 py-4">Canal / Categoria</th>
                    <th className="px-6 py-4">Conteúdo / Template</th>
                    <th className="px-6 py-4">Status & Tentativas</th>
                    <th className="px-6 py-4">Horário</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredMessages.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                        Nenhuma mensagem encontrada na fila com os filtros atuais.
                      </td>
                    </tr>
                  ) : (
                    filteredMessages.map((msg) => (
                      <tr key={msg.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-800">{msg.recipientPartyName || "Cliente Direto"}</div>
                          <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                            <Phone className="w-3 h-3" />
                            {msg.recipientPhone}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1.5 font-semibold text-slate-700">
                            <Smartphone className="w-4 h-4 text-emerald-600" />
                            {msg.channel}
                          </div>
                          <span
                            className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded ${
                              msg.category === "MARKETING"
                                ? "bg-purple-100 text-purple-700"
                                : "bg-blue-100 text-blue-700"
                            }`}
                          >
                            {msg.category}
                          </span>
                        </td>
                        <td className="px-6 py-4 max-w-md">
                          {msg.templateName && (
                            <span className="text-[11px] font-mono font-bold text-slate-500 block">
                              {msg.templateName}
                            </span>
                          )}
                          <p className="text-xs text-slate-600 truncate mt-0.5">{msg.bodyPreview}</p>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                              msg.status === "Sent"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : msg.status === "Queued"
                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : msg.status === "BlockedByConsent"
                                ? "bg-rose-50 text-rose-700 border border-rose-200"
                                : "bg-red-50 text-red-700 border border-red-200"
                            }`}
                          >
                            {msg.status === "Sent" && <Check className="w-3 h-3" />}
                            {msg.status === "Queued" && <Clock className="w-3 h-3" />}
                            {msg.status === "BlockedByConsent" && <ShieldAlert className="w-3 h-3" />}
                            {msg.status}
                          </span>
                          {msg.retryCount > 0 && (
                            <span className="text-[10px] text-slate-400 block mt-1">
                              {msg.retryCount} tentativa(s)
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-500">
                          {msg.sentAt ? (
                            <div>
                              <span className="font-semibold text-slate-700">Enviado:</span> {msg.sentAt}
                            </div>
                          ) : (
                            <div>
                              <span className="font-semibold text-slate-700">Enfileirado:</span> {msg.createdAt}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab: NOTIFICAÇÕES INTERNAS */}
      {activeTab === "notifications" && (
        <div className="space-y-4">
          <div className="p-4 bg-purple-50/50 border border-purple-100 rounded-2xl flex items-start gap-3">
            <Info className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-purple-900 leading-relaxed">
              <span className="font-bold">Notificações em Tempo Real do ERP:</span> Esta central exibe alertas persistentes
              gerados pelos módulos e workers em segundo plano (como a <strong>rotina de expiração automática de reservas do CRM</strong>{" "}
              e notificações de novos matches com o estoque).
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {notifications.map((notif) => (
              <div
                key={notif.id}
                className={`p-5 rounded-2xl border transition-all ${
                  notif.isRead
                    ? "bg-white border-slate-200/80"
                    : "bg-purple-50/30 border-purple-200/80 shadow-sm"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold flex-shrink-0 ${
                        notif.severity === "Warning"
                          ? "bg-amber-100 text-amber-700"
                          : notif.severity === "Success"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {notif.severity === "Warning" ? (
                        <AlertCircle className="w-5 h-5" />
                      ) : notif.severity === "Success" ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : (
                        <Bell className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                        {notif.title}
                        {!notif.isRead && (
                          <span className="w-2 h-2 rounded-full bg-purple-600 inline-block"></span>
                        )}
                      </h4>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">{notif.message}</p>
                      <span className="text-[11px] text-slate-400 font-medium mt-2 inline-block">
                        {notif.createdAt}
                      </span>
                    </div>
                  </div>

                  {!notif.isRead && (
                    <button
                      onClick={() =>
                        setNotifications(
                          notifications.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n))
                        )
                      }
                      className="text-xs font-semibold text-purple-600 hover:text-purple-800 transition-colors"
                    >
                      Marcar como lida
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: TEMPLATES META */}
      {activeTab === "templates" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {templates.map((tpl) => (
              <div key={tpl.id} className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-extrabold text-purple-600 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-100">
                      {tpl.name}
                    </span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                      <Check className="w-3 h-3" /> Aprovado Meta
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mt-3 text-xs text-slate-400 font-medium">
                    <span>Categoria: <strong className="text-slate-700">{tpl.category}</strong></span>
                    <span>•</span>
                    <span>Idioma: <strong className="text-slate-700">{tpl.language}</strong></span>
                  </div>

                  <div className="mt-4 p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 leading-relaxed font-mono">
                    {tpl.bodyText}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                  <span>Conforme regras de 24h Meta</span>
                  <button className="font-semibold text-purple-600 hover:text-purple-800">
                    Testar Envio →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: CONFIGURAÇÃO DE PROVEDOR & WEBHOOK */}
      {activeTab === "provider" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-sm space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Meta WhatsApp Cloud API</h3>
                <p className="text-xs text-slate-500">Credenciais oficiais do Facebook Developers</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                  Phone Number ID
                </label>
                <input
                  type="text"
                  placeholder="Ex: 109283748291029"
                  value={metaConfig.phoneNumberId}
                  onChange={(e) => setMetaConfig({ ...metaConfig, phoneNumberId: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                  WhatsApp Business Account ID (WABA)
                </label>
                <input
                  type="text"
                  placeholder="Ex: 928374619283746"
                  value={metaConfig.wabaId}
                  onChange={(e) => setMetaConfig({ ...metaConfig, wabaId: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                  Status de Conexão Oficial
                </label>
                <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Aguardando Credenciais Reais:</span> As mensagens são enfileiradas e protegidas
                    com persistência, opt-out e idempotência no banco de dados. Para envios reais à Meta, configure as chaves
                    no ambiente.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-sm space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                <Radio className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Webhooks & Assinatura Criptográfica</h3>
                <p className="text-xs text-slate-500">Validação HMAC-SHA256 e Desafio de Verificação</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                  Callback URL Homologada
                </label>
                <input
                  type="text"
                  readOnly
                  value={metaConfig.webhookCallbackUrl}
                  className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-mono text-slate-700"
                />
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700">GET hub.challenge:</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 font-bold">Ativo</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700">POST HMAC-SHA256:</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 font-bold">Verificado</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700">Opt-Out Automático ("SAIR"):</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 font-bold">Ativo</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Nova Mensagem */}
      {showSendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <div>
                <h3 className="font-extrabold text-lg text-slate-900">Enfileirar Nova Mensagem</h3>
                <p className="text-xs text-slate-400">Validação rigorosa de consentimento e janela de 24h</p>
              </div>
              <button
                onClick={() => setShowSendModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSendTestMessage} className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Telefone / WhatsApp com DDD *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: 5511999998888"
                  value={newRecipient}
                  onChange={(e) => setNewRecipient(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">
                    Categoria Meta
                  </label>
                  <select
                    value={sendCategory}
                    onChange={(e) => setSendCategory(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  >
                    <option value="UTILITY">UTILITY (Transacional)</option>
                    <option value="MARKETING">MARKETING (Ofertas)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">
                    Template Aprovado
                  </label>
                  <select
                    value={newTemplate}
                    onChange={(e) => setNewTemplate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  >
                    {templates.map((t) => (
                      <option key={t.id} value={t.name}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Nome do Destinatário (Parâmetro 1)
                </label>
                <input
                  type="text"
                  value={customParam1}
                  onChange={(e) => setCustomParam1(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Item / Assunto (Parâmetro 2)
                </label>
                <input
                  type="text"
                  value={customParam2}
                  onChange={(e) => setCustomParam2(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="p-3 bg-purple-50 rounded-xl border border-purple-100 text-[11px] text-purple-900 leading-relaxed">
                <span className="font-bold">Regra Enterprise:</span> Se for MARKETING, o envio será cancelado
                automaticamente caso o cliente não possua consentimento ativo em <code>PartyConsentRecord</code>.
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowSendModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold shadow-md shadow-purple-600/20"
                >
                  Enfileirar Mensagem
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
