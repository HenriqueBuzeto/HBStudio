"use client";

import React, { useState, useEffect } from "react";
import {
  FileText,
  ShieldCheck,
  KeyRound,
  FileCode,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  QrCode,
  Download,
  Ban,
  PlusCircle,
  Building,
  UploadCloud,
  Check,
  Search,
  ExternalLink,
  Layers
} from "lucide-react";

interface FiscalEstablishment {
  id: string;
  branchId: string;
  corporateName: string;
  tradeName: string;
  cnpj: string;
  stateRegistration: string;
  regime: string;
  cityName: string;
  state: string;
  environment: string;
  qrCodeVersion: number;
  nfceDefaultSeries: number;
  nfceNextNumber: number;
  isNfceEnabled: boolean;
  hasCertificate: boolean;
  certificateExpiration: string | null;
  hasCsc: boolean;
  cscMasked: string | null;
}

interface FiscalDocument {
  id: string;
  saleId: string | null;
  documentType: string;
  environment: string;
  status: string;
  series: number;
  number: number;
  accessKey: string;
  issuedAtUtc: string;
  totalAmount: number;
  totalDiscounts: number;
  recipientCpf: string | null;
  protocolNumber: string | null;
  sefazStatusCode: number | null;
  sefazStatusReason: string | null;
  qrCodeUrl: string | null;
  cancellationReason: string | null;
  cancelledAtUtc: string | null;
}

interface InboundDocument {
  id: string;
  accessKey: string;
  number: number;
  series: number;
  issuedAtUtc: string;
  receivedAtUtc: string;
  supplierCnpj: string;
  supplierName: string;
  supplierStateRegistration: string | null;
  recipientCnpj: string;
  totalProductsAmount: number;
  totalInvoiceAmount: number;
  totalIcmsAmount: number;
  isConciliated: boolean;
}

export default function FiscalPage() {
  const [activeTab, setActiveTab] = useState<"overview" | "documents" | "inbound" | "settings">("overview");
  const [establishment, setEstablishment] = useState<FiscalEstablishment | null>(null);
  const [documents, setDocuments] = useState<FiscalDocument[]>([]);
  const [inboundDocs, setInboundDocs] = useState<InboundDocument[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  // Estados dos Formulários
  const [cscToken, setCscToken] = useState("");
  const [cscId, setCscId] = useState("000001");
  const [pfxBase64, setPfxBase64] = useState("");
  const [pfxPassword, setPfxPassword] = useState("");
  const [xmlToImport, setXmlToImport] = useState("");
  const [selectedDocForCancel, setSelectedDocForCancel] = useState<FiscalDocument | null>(null);
  const [cancelJustification, setCancelJustification] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [estRes, docsRes, inRes] = await Promise.all([
        fetch("/api/fiscal/establishment"),
        fetch("/api/fiscal/documents"),
        fetch("/api/fiscal/inbound"),
      ]);

      if (estRes.ok) {
        const estData = await estRes.json();
        setEstablishment(estData);
      }
      if (docsRes.ok) {
        const docsData = await docsRes.json();
        setDocuments(docsData);
      }
      if (inRes.ok) {
        const inData = await inRes.json();
        setInboundDocs(inData);
      }
    } catch {
      setStatusMsg({ type: "error", text: "Erro ao carregar dados fiscais." });
    } finally {
      setLoading(false);
    }
  }

  async function handleRegisterCsc(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setStatusMsg(null);
    try {
      const res = await fetch("/api/fiscal/csc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cscId: cscId.trim(),
          cscToken: cscToken.trim(),
          environment: 2, // Homologação padrão
        }),
      });

      if (res.ok) {
        setStatusMsg({ type: "success", text: "Token CSC de São Paulo homologado e gravado com segurança!" });
        setCscToken("");
        loadData();
      } else {
        const err = await res.json();
        setStatusMsg({ type: "error", text: err.error || "Erro ao registrar token CSC." });
      }
    } catch {
      setStatusMsg({ type: "error", text: "Falha de conexão ao registrar CSC." });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCertificateUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const b64 = (reader.result as string).split(",")[1];
      setPfxBase64(b64);
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmitCertificate(e: React.FormEvent) {
    e.preventDefault();
    if (!pfxBase64) {
      setStatusMsg({ type: "error", text: "Selecione o arquivo .pfx do certificado A1." });
      return;
    }
    setIsSubmitting(true);
    setStatusMsg(null);
    try {
      const res = await fetch("/api/fiscal/certificate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          base64Pfx: pfxBase64,
          password: pfxPassword,
        }),
      });

      if (res.ok) {
        setStatusMsg({ type: "success", text: "Certificado A1 importado e validado via Zeus DFe.NET com criptografia em repouso!" });
        setPfxBase64("");
        setPfxPassword("");
        loadData();
      } else {
        const err = await res.json();
        setStatusMsg({ type: "error", text: err.error || "Erro ao processar Certificado A1." });
      }
    } catch {
      setStatusMsg({ type: "error", text: "Falha na transmissão do certificado." });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCancelDoc(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedDocForCancel) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/fiscal/documents/${selectedDocForCancel.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ justification: cancelJustification }),
      });

      if (res.ok) {
        setStatusMsg({ type: "success", text: "NFC-e cancelada perante a SEFAZ com sucesso!" });
        setSelectedDocForCancel(null);
        setCancelJustification("");
        loadData();
      } else {
        const err = await res.json();
        setStatusMsg({ type: "error", text: err.error || "Erro ao cancelar NFC-e." });
      }
    } catch {
      setStatusMsg({ type: "error", text: "Falha ao enviar cancelamento à SEFAZ." });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleImportInboundXml(e: React.FormEvent) {
    e.preventDefault();
    if (!xmlToImport.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/fiscal/inbound/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawXml: xmlToImport }),
      });

      if (res.ok) {
        setStatusMsg({ type: "success", text: "XML de entrada de fornecedor importado com proteção XXE!" });
        setXmlToImport("");
        loadData();
      } else {
        const err = await res.json();
        setStatusMsg({ type: "error", text: err.error || "Erro ao importar XML de entrada." });
      }
    } catch {
      setStatusMsg({ type: "error", text: "Erro ao importar XML." });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#07090E] text-slate-100 p-6 md:p-10">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-purple-900/30 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
              MOD-14 • FISCAL & NFC-E ZEUS DFE.NET
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
              Versão 2026.9.24.1416
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              LGPL-2.1 Open-Source
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight mt-2 text-white flex items-center gap-2">
            Emissão de NFC-e, XML de Entrada & Motor Fiscal
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Operação de balcão direta sem custo por nota fiscal emitida, homologada para o Estado de São Paulo (SEFAZ-SP).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-800/80 hover:bg-slate-750 text-slate-200 border border-slate-700 text-xs font-medium transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Sincronizar
          </button>
        </div>
      </div>

      {/* Alerta de Feedback */}
      {statusMsg && (
        <div
          className={`mt-4 p-4 rounded-xl border flex items-center gap-3 text-sm ${
            statusMsg.type === "success"
              ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-300"
              : statusMsg.type === "error"
              ? "bg-rose-950/40 border-rose-500/30 text-rose-300"
              : "bg-blue-950/40 border-blue-500/30 text-blue-300"
          }`}
        >
          {statusMsg.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
          )}
          <span>{statusMsg.text}</span>
          <button
            onClick={() => setStatusMsg(null)}
            className="ml-auto text-xs opacity-70 hover:opacity-100"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Navegação de Abas */}
      <div className="flex border-b border-purple-900/20 mt-6 gap-2">
        <button
          onClick={() => setActiveTab("overview")}
          className={`pb-3 px-4 text-sm font-medium transition border-b-2 flex items-center gap-2 ${
            activeTab === "overview"
              ? "border-purple-500 text-purple-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Layers className="w-4 h-4" />
          Visão Geral & Indicadores
        </button>
        <button
          onClick={() => setActiveTab("documents")}
          className={`pb-3 px-4 text-sm font-medium transition border-b-2 flex items-center gap-2 ${
            activeTab === "documents"
              ? "border-purple-500 text-purple-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <FileText className="w-4 h-4" />
          NFC-e Emitidas Balcão ({documents.length})
        </button>
        <button
          onClick={() => setActiveTab("inbound")}
          className={`pb-3 px-4 text-sm font-medium transition border-b-2 flex items-center gap-2 ${
            activeTab === "inbound"
              ? "border-purple-500 text-purple-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <FileCode className="w-4 h-4" />
          XML de Entrada ({inboundDocs.length})
        </button>
        <button
          onClick={() => setActiveTab("settings")}
          className={`pb-3 px-4 text-sm font-medium transition border-b-2 flex items-center gap-2 ${
            activeTab === "settings"
              ? "border-purple-500 text-purple-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <KeyRound className="w-4 h-4" />
          Configurações, Certificado & CSC
        </button>
      </div>

      {/* Conteúdo das Abas */}
      <div className="mt-6">
        {/* ABA: Visão Geral */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Cards de Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-[#0D111A] border border-purple-900/20">
                <div className="flex items-center justify-between text-slate-400 text-xs">
                  <span>ESTABELECIMENTO</span>
                  <Building className="w-4 h-4 text-purple-400" />
                </div>
                <div className="mt-2 text-lg font-bold text-white truncate">
                  {establishment?.tradeName || "Não Configurado"}
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  CNPJ: {establishment?.cnpj || "—"} ({establishment?.state || "SP"})
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#0D111A] border border-purple-900/20">
                <div className="flex items-center justify-between text-slate-400 text-xs">
                  <span>CERTIFICADO A1</span>
                  <ShieldCheck
                    className={`w-4 h-4 ${
                      establishment?.hasCertificate ? "text-emerald-400" : "text-amber-400"
                    }`}
                  />
                </div>
                <div className="mt-2 text-lg font-bold text-white">
                  {establishment?.hasCertificate ? "Ativo & Criptografado" : "Pendente"}
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  {establishment?.certificateExpiration
                    ? `Expira em: ${new Date(establishment.certificateExpiration).toLocaleDateString("pt-BR")}`
                    : "Carregue o .pfx nas configurações"}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#0D111A] border border-purple-900/20">
                <div className="flex items-center justify-between text-slate-400 text-xs">
                  <span>QR CODE NFC-E (NT 2025.001)</span>
                  <QrCode
                    className={`w-4 h-4 ${
                      establishment?.qrCodeVersion === 3 ? "text-emerald-400" : "text-purple-400"
                    }`}
                  />
                </div>
                <div className="mt-2 text-lg font-bold text-white">
                  {establishment?.qrCodeVersion === 3 ? "Versão 3.00 (Ativa)" : "Versão 2.00 (Legado)"}
                </div>
                <div className="text-xs text-slate-400 mt-1 truncate">
                  {establishment?.qrCodeVersion === 3
                    ? "Online sem CSC • Conforme NT 2025.001"
                    : (establishment?.cscMasked || "Exige CSC registrado")}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#0D111A] border border-purple-900/20">
                <div className="flex items-center justify-between text-slate-400 text-xs">
                  <span>SEQUÊNCIA ATUAL</span>
                  <CheckCircle2 className="w-4 h-4 text-purple-400" />
                </div>
                <div className="mt-2 text-lg font-bold text-white">
                  Série {establishment?.nfceDefaultSeries || 1} • Nº {establishment?.nfceNextNumber || 1}
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  SP Nov/2026: Descontinuidade de inutilização
                </div>
              </div>
            </div>

            {/* Guia Operacional */}
            <div className="p-6 rounded-2xl bg-[#0D111A] border border-purple-900/30">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-purple-400" />
                Arquitetura de Emissão Fiscal com Zeus DFe.NET
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4 text-sm text-slate-300">
                <div className="p-4 rounded-xl bg-[#090C14] border border-slate-800">
                  <span className="font-semibold text-purple-300 block mb-1">
                    1. Autonomia & Sem Custos
                  </span>
                  Diferente de APIs pagas que cobram R$ 0,10 a R$ 0,50 por documento, o motor Zeus roda diretamente no runtime .NET 10 do ERP, comunicando com a SEFAZ de forma ilimitada e com código aberto auditado.
                </div>
                <div className="p-4 rounded-xl bg-[#090C14] border border-slate-800">
                  <span className="font-semibold text-purple-300 block mb-1">
                    2. Resiliência & Contingência
                  </span>
                  A emissão balcão gera o QR Code V2 conforme os manuais técnicos de SP. Em oscilações de rede da fazenda estadual, o PDV gera contingência offline e transmite assim que restabelecido.
                </div>
                <div className="p-4 rounded-xl bg-[#090C14] border border-slate-800">
                  <span className="font-semibold text-purple-300 block mb-1">
                    3. Conformidade SEFAZ-SP 2026
                  </span>
                  Totalmente adequado à instrução de São Paulo de 01/11/2026 que dispensou o processo formal de inutilização de números pulados, mantendo integridade sequencial garantida no banco de dados.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ABA: NFC-e Emitidas */}
        {activeTab === "documents" && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-[#0D111A] border border-purple-900/20 overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="text-xs uppercase bg-[#090C14] text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Série / Número</th>
                    <th className="py-3 px-4">Chave de Acesso (44 Dígitos)</th>
                    <th className="py-3 px-4">Data Emissão</th>
                    <th className="py-3 px-4">Valor Total</th>
                    <th className="py-3 px-4">Destinatário</th>
                    <th className="py-3 px-4">Status SEFAZ</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {documents.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500">
                        Nenhuma NFC-e emitida até o momento. Conclua uma venda no PDV Balcão para emitir.
                      </td>
                    </tr>
                  ) : (
                    documents.map((doc) => (
                      <tr key={doc.id} className="hover:bg-slate-850/40 transition">
                        <td className="py-3 px-4 font-mono font-medium text-white">
                          S{doc.series} • Nº {doc.number}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-slate-400 truncate max-w-xs">
                          {doc.accessKey}
                        </td>
                        <td className="py-3 px-4 text-xs">
                          {new Date(doc.issuedAtUtc).toLocaleString("pt-BR")}
                        </td>
                        <td className="py-3 px-4 font-medium text-emerald-400">
                          R$ {doc.totalAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 text-xs">
                          {doc.recipientCpf ? `CPF: ${doc.recipientCpf}` : "Consumidor Não Identificado"}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                              doc.status === "Authorized"
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : doc.status === "Cancelled"
                                ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                            }`}
                          >
                            {doc.status === "Authorized"
                              ? "Autorizada SEFAZ"
                              : doc.status === "Cancelled"
                              ? "Cancelada"
                              : doc.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {doc.qrCodeUrl && (
                              <a
                                href={doc.qrCodeUrl}
                                target="_blank"
                                rel="noreferrer"
                                title="Abrir QR Code Consulta Pública"
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-purple-400 border border-slate-700"
                              >
                                <QrCode className="w-3.5 h-3.5" />
                              </a>
                            )}
                            {doc.status === "Authorized" && (
                              <button
                                onClick={() => setSelectedDocForCancel(doc)}
                                title="Cancelar NFC-e"
                                className="p-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 border border-rose-800/40 text-xs font-medium flex items-center gap-1"
                              >
                                <Ban className="w-3.5 h-3.5" />
                                Cancelar
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Modal de Cancelamento de NFC-e */}
            {selectedDocForCancel && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                <div className="bg-[#0D111A] border border-purple-900/40 rounded-2xl max-w-md w-full p-6 shadow-2xl">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Ban className="w-5 h-5 text-rose-400" />
                    Cancelar NFC-e Nº {selectedDocForCancel.number}
                  </h3>
                  <p className="text-xs text-slate-400 mt-2">
                    A SEFAZ exige justificativa de no mínimo 15 caracteres para deferir o cancelamento.
                  </p>
                  <form onSubmit={handleCancelDoc} className="mt-4 space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Justificativa do Cancelamento
                      </label>
                      <textarea
                        rows={3}
                        required
                        value={cancelJustification}
                        onChange={(e) => setCancelJustification(e.target.value)}
                        placeholder="Ex: Cancelamento em razão de desistência da compra pelo cliente no balcão."
                        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs focus:ring-1 focus:ring-purple-500"
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setSelectedDocForCancel(null)}
                        className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
                      >
                        Abortar
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting || cancelJustification.length < 15}
                        className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-medium text-xs flex items-center gap-2"
                      >
                        {isSubmitting ? "Transmitindo..." : "Confirmar Cancelamento SEFAZ"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ABA: XML de Entrada */}
        {activeTab === "inbound" && (
          <div className="space-y-6">
            {/* Upload e Importação de XML */}
            <div className="p-6 rounded-2xl bg-[#0D111A] border border-purple-900/30">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-purple-400" />
                Importar XML de NF-e de Entrada (Fornecedor)
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                O arquivo é analisado com proteção contra XXE (XML External Entity injection). Vincula dados ao catálogo sem duplicar estoque de forma cega.
              </p>
              <form onSubmit={handleImportInboundXml} className="mt-4 space-y-4">
                <textarea
                  rows={4}
                  value={xmlToImport}
                  onChange={(e) => setXmlToImport(e.target.value)}
                  placeholder="Cole aqui o conteúdo XML da nota fiscal emitida pelo fornecedor..."
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono text-xs focus:ring-1 focus:ring-purple-500"
                />
                <button
                  type="submit"
                  disabled={isSubmitting || !xmlToImport.trim()}
                  className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-medium text-xs flex items-center gap-2"
                >
                  <UploadCloud className="w-4 h-4" />
                  {isSubmitting ? "Importando..." : "Validar e Importar NF-e"}
                </button>
              </form>
            </div>

            {/* Listagem de Notas de Entrada */}
            <div className="p-4 rounded-xl bg-[#0D111A] border border-purple-900/20 overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="text-xs uppercase bg-[#090C14] text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Série / Número</th>
                    <th className="py-3 px-4">Chave de Entrada</th>
                    <th className="py-3 px-4">Fornecedor</th>
                    <th className="py-3 px-4">Data Emissão</th>
                    <th className="py-3 px-4">Total Produtos</th>
                    <th className="py-3 px-4">Total Nota</th>
                    <th className="py-3 px-4">Status Conciliação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {inboundDocs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500">
                        Nenhum XML de entrada importado.
                      </td>
                    </tr>
                  ) : (
                    inboundDocs.map((doc) => (
                      <tr key={doc.id} className="hover:bg-slate-850/40 transition">
                        <td className="py-3 px-4 font-mono font-medium text-white">
                          S{doc.series} • Nº {doc.number}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-slate-400 truncate max-w-xs">
                          {doc.accessKey}
                        </td>
                        <td className="py-3 px-4 text-xs">
                          <span className="font-semibold text-white block">{doc.supplierName}</span>
                          <span className="text-slate-500">CNPJ: {doc.supplierCnpj}</span>
                        </td>
                        <td className="py-3 px-4 text-xs">
                          {new Date(doc.issuedAtUtc).toLocaleDateString("pt-BR")}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs">
                          R$ {doc.totalProductsAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 font-mono font-medium text-emerald-400 text-xs">
                          R$ {doc.totalInvoiceAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            XML Retido & Auditado
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ABA: Configurações, Certificado e CSC */}
        {activeTab === "settings" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Certificado Digital A1 */}
            <div className="p-6 rounded-2xl bg-[#0D111A] border border-purple-900/30">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-purple-400" />
                Certificado Digital A1 (.pfx)
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                O arquivo .pfx e a senha são encriptados com AES-256 em repouso no banco de dados. Nunca trafegam descriptografados.
              </p>
              <form onSubmit={handleSubmitCertificate} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Arquivo do Certificado (.pfx)
                  </label>
                  <input
                    type="file"
                    accept=".pfx,.p12"
                    onChange={handleCertificateUpload}
                    className="w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-purple-600 file:text-white hover:file:bg-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Senha do Certificado A1
                  </label>
                  <input
                    type="password"
                    required
                    value={pfxPassword}
                    onChange={(e) => setPfxPassword(e.target.value)}
                    placeholder="Digite a senha de emissão do certificado..."
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs focus:ring-1 focus:ring-purple-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting || !pfxBase64}
                  className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-medium text-xs flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  {isSubmitting ? "Importando..." : "Importar & Criptografar Certificado"}
                </button>
              </form>
            </div>

            {/* Código de Segurança do Contribuinte (CSC) */}
            <div className="p-6 rounded-2xl bg-[#0D111A] border border-purple-900/30">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-purple-400" />
                Código de Segurança do Contribuinte (CSC - SEFAZ/SP)
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Necessário para o cálculo do hash SHA-1 do QR Code de consulta pública no balcão de vendas.
              </p>
              <form onSubmit={handleRegisterCsc} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Identificador do CSC (IdToken)
                  </label>
                  <input
                    type="text"
                    required
                    value={cscId}
                    onChange={(e) => setCscId(e.target.value)}
                    placeholder="Ex: 000001"
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs focus:ring-1 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Token Alfa-Numérico CSC
                  </label>
                  <input
                    type="password"
                    required
                    value={cscToken}
                    onChange={(e) => setCscToken(e.target.value)}
                    placeholder="Cole o token CSC fornecido pelo portal da SEFAZ-SP..."
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs focus:ring-1 focus:ring-purple-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting || !cscToken.trim()}
                  className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-medium text-xs flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  {isSubmitting ? "Gravando..." : "Homologar e Salvar Token CSC"}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
