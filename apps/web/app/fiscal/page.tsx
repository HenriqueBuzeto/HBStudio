"use client";

import React, { useState, useEffect } from "react";
import RootShellLayout from "@/components/RootShellLayout";
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
  Building,
  UploadCloud,
  Check,
  Save,
  Lock,
  Layers,
  FileCheck2,
  AlertTriangle,
  Info
} from "lucide-react";

export default function FiscalPage() {
  const [activeTab, setActiveTab] = useState<"overview" | "cadastros" | "documents" | "inbound">("overview");
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  // Dados do Estabelecimento Fiscal Carregados do Neon
  const [fiscalData, setFiscalData] = useState<any>(null);

  // Formulário: Dados da Empresa / Estabelecimento
  const [corporateName, setCorporateName] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [stateRegistration, setStateRegistration] = useState("");
  const [municipalRegistration, setMunicipalRegistration] = useState("");
  const [cnae, setCnae] = useState("");
  const [regime, setRegime] = useState("1"); // 1 = Simples Nacional
  const [environment, setEnvironment] = useState("2"); // Homologação somente
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [complement, setComplement] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [cityName, setCityName] = useState("");
  const [state, setState] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [cityCodeIbge, setCityCodeIbge] = useState("");
  const [nfceDefaultSeries, setNfceDefaultSeries] = useState("1");
  const [nfceNextNumber, setNfceNextNumber] = useState("1");

  // Formulário: Certificado Digital A1
  const [pfxFile, setPfxFile] = useState<File | null>(null);
  const [pfxPassword, setPfxPassword] = useState("");

  // Formulário: Código de Segurança do Contribuinte (CSC)
  const [cscId, setCscId] = useState("");
  const [cscToken, setCscToken] = useState("");

  // Carregar status fiscal diretamente do Neon
  const loadFiscalStatus = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/fiscal/status");
      if (res.ok) {
        const data = await res.json();
        setFiscalData(data);
        if (data.configured && data.establishment) {
          const e = data.establishment;
          setCorporateName(e.corporateName || "");
          setTradeName(e.tradeName || "");
          setCnpj(e.cnpj || "");
          setStateRegistration(e.stateRegistration || "");
          setMunicipalRegistration(e.municipalRegistration || "");
          setCnae(e.cnae || "");
          setRegime(String(e.regime || ""));
          setEnvironment(String(e.environment || 2));
          setCityCodeIbge(e.cityCodeIbge || "");
          setComplement(e.complement || "");
          setStreet(e.street || "");
          setNumber(e.number || "");
          setNeighborhood(e.neighborhood || "");
          setCityName(e.cityName || "");
          setState(e.state || "");
          setPostalCode(e.postalCode || "");
          setCscId(data.csc?.cscId || "");
          setNfceDefaultSeries(String(e.nfceDefaultSeries || 1));
          setNfceNextNumber(String(e.nfceNextNumber || 1));
        }
      }
    } catch (err) {
      console.error("Erro ao carregar status fiscal:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFiscalStatus();
  }, []);

  // Salvar Dados do Estabelecimento
  const handleSaveEstablishment = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatusMsg(null);

    try {
      const res = await fetch("/api/fiscal/establishment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          corporateName,
          tradeName,
          cnpj,
          stateRegistration,
          municipalRegistration,
          cnae,
          regime: Number(regime),
          street,
          number,
          complement,
          neighborhood,
          cityName,
          state,
          cityCodeIbge,
          postalCode,
          environment: Number(environment),
          nfceDefaultSeries: Number(nfceDefaultSeries),
          nfceNextNumber: Number(nfceNextNumber),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setStatusMsg({ type: "success", text: "Estabelecimento registrado em homologação. Emissão permanece bloqueada até autorização real da SEFAZ." });
        loadFiscalStatus();
      } else {
        setStatusMsg({ type: "error", text: data.error || "Erro ao salvar estabelecimento fiscal." });
      }
    } catch {
      setStatusMsg({ type: "error", text: "Não foi possível conectar ao servidor para salvar os dados fiscais." });
    } finally {
      setSaving(false);
    }
  };

  // Salvar Token CSC
  const handleSaveCsc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cscId || !cscToken) return;

    setSaving(true);
    setStatusMsg(null);

    try {
      const res = await fetch("/api/fiscal/csc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cscId,
          cscToken,
          environment: Number(environment),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setStatusMsg({ type: "success", text: "CSC protegido no cofre fiscal. A validação oficial da SEFAZ continua pendente." });
        setCscToken("");
        loadFiscalStatus();
      } else {
        setStatusMsg({ type: "error", text: data.error || "Erro ao cadastrar CSC." });
      }
    } catch {
      setStatusMsg({ type: "error", text: "Erro ao comunicar com o servidor para registro de CSC." });
    } finally {
      setSaving(false);
    }
  };

  // Salvar Certificado Digital A1 (.pfx)
  const handleUploadCert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pfxFile || !pfxPassword) {
      setStatusMsg({ type: "error", text: "Selecione o arquivo .pfx e digite a senha do certificado." });
      return;
    }

    setSaving(true);
    setStatusMsg(null);

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1];
      try {
        const res = await fetch("/api/fiscal/certificate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pfxBase64: base64,
            password: pfxPassword,
          }),
        });

        const data = await res.json();
        if (res.ok) {
          setStatusMsg({ type: "success", text: "PFX armazenado. Ainda não habilitado para emissão: requer validação ICP-Brasil e homologação." });
          setPfxFile(null);
          setPfxPassword("");
          loadFiscalStatus();
        } else {
          setStatusMsg({ type: "error", text: data.error || "Erro ao enviar certificado digital." });
        }
      } catch {
        setStatusMsg({ type: "error", text: "Falha ao enviar certificado digital." });
      } finally {
        setSaving(false);
      }
    };
    reader.readAsDataURL(pfxFile);
  };

  const hasConfig = fiscalData?.configured;
  const est = fiscalData?.establishment;
  const cert = fiscalData?.certificate;
  const csc = fiscalData?.csc;

  return (
    <RootShellLayout>
      <div className="space-y-6">
        {/* Header do Módulo Fiscal */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-700 bg-purple-50 px-3 py-1 rounded-full border border-purple-200">
                Módulo Fiscal & Tributário
              </span>
              <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                MOD-14 • Integração SEFAZ pendente
              </span>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                Transmissão ainda bloqueada
              </span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 mt-2">
              Emissão de NFC-e, XML & Cadastros Fiscais
            </h1>
            <p className="text-xs text-slate-500 mt-1 max-w-3xl">
              Configuração oficial do estabelecimento comercial, credenciamento na Fazenda Estadual (SEFAZ-SP), gestão do Certificado Digital A1 e Código de Segurança do Contribuinte (CSC).
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadFiscalStatus}
              className="p-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl transition-all cursor-pointer"
              title="Recarregar dados fiscais"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-purple-600" : ""}`} />
            </button>
            <button
              onClick={() => setActiveTab("cadastros")}
              className="px-5 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white text-xs font-extrabold rounded-xl shadow-md shadow-purple-600/20 flex items-center gap-2 transition-all cursor-pointer"
            >
              <Building className="w-4 h-4" />
              <span>Configurar Estabelecimento</span>
            </button>
          </div>
        </div>

        {/* Feedback de Status */}
        {statusMsg && (
          <div
            className={`p-4 rounded-2xl border text-xs font-semibold flex items-center gap-2 animate-in fade-in ${
              statusMsg.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : statusMsg.type === "error"
                ? "bg-rose-50 border-rose-200 text-rose-800"
                : "bg-blue-50 border-blue-200 text-blue-800"
            }`}
          >
            {statusMsg.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{statusMsg.text}</span>
          </div>
        )}

        {/* Abas de Navegação */}
        <div className="flex items-center gap-1 border-b border-slate-200 pb-1">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-4 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "overview"
                ? "bg-purple-50 text-purple-700 border border-purple-200 shadow-xs"
                : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Visão Geral & Indicadores</span>
          </button>

          <button
            onClick={() => setActiveTab("cadastros")}
            className={`px-4 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "cadastros"
                ? "bg-purple-50 text-purple-700 border border-purple-200 shadow-xs"
                : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <Building className="w-4 h-4" />
            <span>Cadastros Fiscais & Certificados</span>
          </button>

          <button
            onClick={() => setActiveTab("documents")}
            className={`px-4 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "documents"
                ? "bg-purple-50 text-purple-700 border border-purple-200 shadow-xs"
                : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>NFC-e Emitidas no Balcão ({fiscalData?.stats?.totalIssued || 0})</span>
          </button>
        </div>

        {/* ABA 1: VISÃO GERAL & INDICADORES DE CONFORMIDADE */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* 4 Cards de Indicadores */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Estabelecimento */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-2">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider">Estabelecimento</span>
                  <Building className="w-4 h-4 text-purple-600" />
                </div>
                <div className="font-extrabold text-slate-900 text-sm">
                  {hasConfig ? est.tradeName || est.corporateName : "Não Configurado"}
                </div>
                <div className="text-[11px] text-slate-500">
                  {hasConfig ? `CNPJ: ${est.cnpj} • ${est.state}` : "Preencha na aba Cadastros Fiscais"}
                </div>
              </div>

              {/* Card 2: Certificado Digital A1 */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-2">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider">Certificado A1</span>
                  <ShieldCheck className={`w-4 h-4 $"text-amber-500"`} />
                </div>
                <div className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5">
                  {cert ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                      <span>Armazenado • validação pendente</span>
                    </>
                  ) : (
                    <>
                      <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                      <span>Pendente de Envio</span>
                    </>
                  )}
                </div>
                <div className="text-[11px] text-slate-500">
                  {cert ? `Validade: ${new Date(cert.validUntilUtc).toLocaleDateString("pt-BR")}` : "Carregue o arquivo .pfx"}
                </div>
              </div>

              {/* Card 3: QR Code & CSC */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-2">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider">QR Code NFC-e</span>
                  <QrCode className="w-4 h-4 text-indigo-600" />
                </div>
                <div className="font-extrabold text-slate-900 text-sm">
                  {csc ? "CSC cadastrado • não verificado na SEFAZ" : "CSC Pendente"}
                </div>
                <div className="text-[11px] text-slate-500">
                  {csc ? `Token ID: ${csc.cscId} (${csc.cscTokenMasked})` : "Exige CSC da SEFAZ"}
                </div>
              </div>

              {/* Card 4: Sequência & Série */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-2">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider">Sequência Atual</span>
                  <FileCode className="w-4 h-4 text-purple-600" />
                </div>
                <div className="font-extrabold text-slate-900 text-sm font-mono">
                  Série {hasConfig ? est.nfceDefaultSeries : "—"} • Nº {hasConfig ? est.nfceNextNumber : "—"}
                </div>
                <div className="text-[11px] text-slate-500">
                  {hasConfig ? (est.environment === 2 ? "Homologação" : "Produção bloqueada") : "Não configurado"}
                </div>
              </div>
            </div>

            {/* Banner de Arquitetura Fiscal */}
            <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white p-6 rounded-3xl border border-slate-800 shadow-xl space-y-4">
              <div className="flex items-center gap-2 text-purple-300 font-extrabold text-xs uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4" />
                <span>Integração Fiscal Vercel + Neon • Em desenvolvimento</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                <div className="space-y-1.5">
                  <h4 className="font-bold text-sm text-white">1. Comunicação SEFAZ pendente</h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Ainda não existe transmissão autenticada homologada. Nenhuma NFC-e pode ser considerada autorizada sem resposta oficial da SEFAZ.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <h4 className="font-bold text-sm text-white">2. Contingência indisponível</h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Contingência fiscal ainda não homologada. Nunca serão gerados protocolos ou eventos fictícios.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <h4 className="font-bold text-sm text-white">3. Cofre fiscal AES-256-GCM</h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Novas credenciais são protegidas com AES-256-GCM e chave separada de autenticação. A ativação exige validação e homologação externa.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ABA 2: CADASTROS FISCAIS COMPLETOS */}
        {activeTab === "cadastros" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Coluna 1 e 2: Dados Cadastrais da Empresa */}
            <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200/90 shadow-xs space-y-5">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-base font-black text-slate-900">
                  Dados do Estabelecimento Fiscal (Emissor)
                </h3>
                <p className="text-xs text-slate-500">
                  Preencha rigorosamente conforme o Cartão CNPJ e a Inscrição Estadual (CADESP) de São Paulo.
                </p>
              </div>

              <form onSubmit={handleSaveEstablishment} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-xs font-extrabold text-slate-700">Razão Social *</label>
                    <input
                      type="text"
                      value={corporateName}
                      onChange={(e) => setCorporateName(e.target.value)}
                      required
                      placeholder="Ex: HB STUDIO LTDA"
                      className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500/20"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-extrabold text-slate-700">Nome Fantasia</label>
                    <input
                      type="text"
                      value={tradeName}
                      onChange={(e) => setTradeName(e.target.value)}
                      placeholder="Ex: HB Studio"
                      className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500/20"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="block text-xs font-extrabold text-slate-700">CNPJ (14 dígitos) *</label>
                    <input
                      type="text"
                      value={cnpj}
                      onChange={(e) => setCnpj(e.target.value)}
                      required
                      placeholder="00.000.000/0000-00"
                      className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-extrabold text-slate-700">Inscrição Estadual (IE) *</label>
                    <input
                      type="text"
                      value={stateRegistration}
                      onChange={(e) => setStateRegistration(e.target.value)}
                      required
                      placeholder="Ex: 111.222.333.444"
                      className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-extrabold text-slate-700">Inscrição Municipal</label>
                    <input
                      type="text"
                      value={municipalRegistration}
                      onChange={(e) => setMunicipalRegistration(e.target.value)}
                      placeholder="Opcional para comércio"
                      className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="block text-xs font-extrabold text-slate-700">Regime Tributário</label>
                    <select
                      value={regime}
                      onChange={(e) => setRegime(e.target.value)}
                      className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                    >
                      <option value="1">Simples Nacional</option>
                      <option value="2">Simples Nacional - Excesso Sublimite</option>
                      <option value="3">Regime Normal (Presumido/Real)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-extrabold text-slate-700">Ambiente SEFAZ</label>
                    <select
                      value={environment}
                      onChange={(e) => setEnvironment(e.target.value)}
                      className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold text-purple-700"
                    >
                      <option value="1" disabled>Produção indisponível até homologação SEFAZ</option>
                      <option value="2">Homologação (Testes sem valor fiscal)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-extrabold text-slate-700">CNAE Principal</label>
                    <input
                      type="text"
                      value={cnae}
                      onChange={(e) => setCnae(e.target.value)}
                      placeholder="4751-2/01"
                      className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono"
                    />
                  </div>
                </div>

                {/* Endereço do Estabelecimento */}
                <div className="pt-2 border-t border-slate-100 space-y-3">
                  <span className="text-xs font-extrabold text-slate-700 block">Endereço da Loja / Filial</span>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="sm:col-span-2 space-y-1">
                      <input
                        type="text"
                        placeholder="Logradouro (Ex: Av. Paulista)"
                        value={street}
                        onChange={(e) => setStreet(e.target.value)}
                        className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                      />
                    </div>
                    <div className="space-y-1">
                      <input
                        type="text"
                        placeholder="Número (Ex: 1000)"
                        value={number}
                        onChange={(e) => setNumber(e.target.value)}
                        className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                      />
                    </div>
                    <div className="space-y-1">
                      <input
                        type="text"
                        placeholder="Bairro (Ex: Bela Vista)"
                        value={neighborhood}
                        onChange={(e) => setNeighborhood(e.target.value)}
                        className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <input
                        type="text"
                        placeholder="Município (Ex: São Paulo)"
                        value={cityName}
                        onChange={(e) => setCityName(e.target.value)}
                        className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                      />
                    </div>
                    <div className="space-y-1">
                      <input
                        type="text"
                        placeholder="UF (Ex: SP)"
                        value={state}
                        onChange={(e) => setState(e.target.value)}
                        className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-xl uppercase"
                      />
                    </div>
                    <div className="space-y-1">
                      <input
                        type="text"
                        placeholder="CEP (Ex: 01310-100)"
                        value={postalCode}
                        onChange={(e) => setPostalCode(e.target.value)}
                        className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Séries e Numeração */}
                <div className="pt-2 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-xs font-extrabold text-slate-700">Série Padrão NFC-e</label>
                    <input
                      type="number"
                      value={nfceDefaultSeries}
                      onChange={(e) => setNfceDefaultSeries(e.target.value)}
                      className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-extrabold text-slate-700">Próximo Número NFC-e</label>
                    <input
                      type="number"
                      value={nfceNextNumber}
                      onChange={(e) => setNfceNextNumber(e.target.value)}
                      className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono"
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex justify-end">
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-6 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white text-xs font-extrabold rounded-xl shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    <span>{saving ? "Salvando..." : "Salvar Estabelecimento no Neon"}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Coluna 3: Certificado Digital A1 e CSC */}
            <div className="space-y-6">
              {/* Card Certificado A1 */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-xs space-y-4">
                <div className="flex items-center gap-2 text-purple-700">
                  <ShieldCheck className="w-5 h-5" />
                  <h3 className="text-sm font-black text-slate-900">Certificado Digital A1 (.pfx)</h3>
                </div>

                <p className="text-xs text-slate-500">
                  O PFX fica criptografado com AES-256-GCM e inativo até validação ICP-Brasil e homologação. Nunca envie sua senha pelo chat.
                </p>

                {cert ? (
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600" /> Certificado armazenado, NÃO habilitado
                    </div>
                    <div className="text-[11px] text-slate-600 font-mono truncate">
                      Thumbprint: {cert.thumbprint}
                    </div>
                    <div className="text-[11px] text-slate-600">
                      Válido até: <strong>{new Date(cert.validUntilUtc).toLocaleDateString("pt-BR")}</strong>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Nenhum certificado A1 verificado. Emissão indisponível.</span>
                  </div>
                )}

                <form onSubmit={handleUploadCert} className="space-y-3 pt-2">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-700">Arquivo PFX/P12</label>
                    <input
                      type="file"
                      accept=".pfx,.p12"
                      onChange={(e) => setPfxFile(e.target.files?.[0] || null)}
                      className="w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-700">Senha do Certificado</label>
                    <input
                      type="password"
                      placeholder="Senha do .pfx"
                      value={pfxPassword}
                      onChange={(e) => setPfxPassword(e.target.value)}
                      className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={saving || !pfxFile || !pfxPassword}
                    className="w-full py-2.5 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <UploadCloud className="w-4 h-4 text-purple-400" />
                    <span>Carregar Certificado A1</span>
                  </button>
                </form>
              </div>

              {/* Card Código de Segurança do Contribuinte (CSC) */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-xs space-y-4">
                <div className="flex items-center gap-2 text-indigo-700">
                  <KeyRound className="w-5 h-5" />
                  <h3 className="text-sm font-black text-slate-900">Código de Segurança (CSC)</h3>
                </div>

                <p className="text-xs text-slate-500">
                  O CSC é fornecido no portal da SEFAZ-SP para geração do QR Code de consulta do consumidor no cupom fiscal.
                </p>

                {csc ? (
                  <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-200 text-xs text-indigo-900 space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600" /> CSC armazenado, não verificado na SEFAZ
                    </div>
                    <div className="text-[11px] font-mono text-slate-600">
                      ID: {csc.cscId} • Token: {csc.cscTokenMasked}
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>CSC ainda não cadastrado.</span>
                  </div>
                )}

                <form onSubmit={handleSaveCsc} className="space-y-3 pt-2">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-700">ID do CSC</label>
                    <input
                      type="text"
                      placeholder="000001"
                      value={cscId}
                      onChange={(e) => setCscId(e.target.value)}
                      className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-700">Código Token CSC (16 a 36 caracteres)</label>
                    <input
                      type="password"
                      placeholder="Cole o código gerado no CADESP"
                      value={cscToken}
                      onChange={(e) => setCscToken(e.target.value)}
                      className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={saving || !cscToken}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Lock className="w-4 h-4" />
                    <span>Registrar Token CSC</span>
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* ABA 3: DOCUMENTOS EMITIDOS */}
        {activeTab === "documents" && (
          <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  Cupons Fiscais NFC-e Emitidos
                </h3>
                <p className="text-xs text-slate-500">
                  Rastreabilidade completa de autorização na SEFAZ-SP, chaves de acesso de 44 dígitos e protocolos.
                </p>
              </div>
            </div>

            <div className="p-8 text-center text-slate-400 space-y-2">
              <FileCheck2 className="w-10 h-10 text-slate-300 mx-auto" />
              <div className="font-bold text-sm text-slate-600">Nenhum cupom fiscal emitido ainda</div>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                A autorização real ainda exige XML assinado, transmissão, validação e protocolo oficial confirmado na SEFAZ-SP.
              </p>
            </div>
          </div>
        )}
      </div>
    </RootShellLayout>
  );
}
