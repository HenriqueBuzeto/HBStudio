"use client";

import React, { useState } from "react";
import {
  Users,
  PieChart,
  ShieldCheck,
  TrendingUp,
  Wallet,
  HandCoins,
  ArrowUpRight,
  ArrowDownRight,
  FileCheck2,
  AlertTriangle,
  Scale,
  Award,
  Layers,
  Banknote,
  Percent,
  CheckCircle2,
  Building2
} from "lucide-react";

interface PartnerView {
  id: string;
  name: string;
  document: string;
  role: string;
  equityPercentage: number;
  quotas: number;
  nominalValue: number;
  monthlyProLaboreCap: number;
  active: boolean;
  notes: string;
}

interface ContributionView {
  id: string;
  partnerName: string;
  date: string;
  amount: number;
  paymentMethod: string;
  status: "Subscrito" | "Integralizado";
  destinationAccount: string;
  legalDocNumber: string;
}

interface LoanView {
  id: string;
  partnerName: string;
  agreementDate: string;
  principalAmount: number;
  balanceDue: number;
  interestRateAnnual: number;
  status: "Ativo" | "Amortizado";
  contractReference: string;
}

interface DistributionProposalView {
  id: string;
  fiscalPeriod: string;
  calculatedAccountingProfit: number;
  proposedTotalDistribution: number;
  retainedEarningsForWorkingCapital: number;
  status: "Minuta" | "Aprovada em Ata" | "Paga";
  governanceMeetingMinutesRef: string;
  simulatedAvailableLiquidity: number;
}

export default function PartnersCapitalPage() {
  const [activeTab, setActiveTab] = useState<"cap-table" | "contributions" | "loans" | "pro-labore" | "distributions" | "simulator">("cap-table");

  // Sócios Fundadores da HB Studio
  const partners: PartnerView[] = [
    {
      id: "p-01",
      name: "Sócio A (Estratégia & Operações)",
      document: "000.111.222-33",
      role: "Diretor Executivo",
      equityPercentage: 40.0,
      quotas: 40000,
      nominalValue: 40000.0,
      monthlyProLaboreCap: 5000.0,
      active: true,
      notes: "Sócio administrador com poder de assinatura de deliberações."
    },
    {
      id: "p-02",
      name: "Sócio B (Engenharia & Assistência Técnica)",
      document: "333.444.555-66",
      role: "Diretor de Operações Técnicas",
      equityPercentage: 35.0,
      quotas: 35000,
      nominalValue: 35000.0,
      monthlyProLaboreCap: 4500.0,
      active: true,
      notes: "Gestão dos serviços de bancada, laboratório e qualidade."
    },
    {
      id: "p-03",
      name: "Sócio C (Comercial, Manufatura 3D & Expansão)",
      document: "666.777.888-99",
      role: "Diretor Comercial & Produto",
      equityPercentage: 25.0,
      quotas: 25000,
      nominalValue: 25000.0,
      monthlyProLaboreCap: 4000.0,
      active: true,
      notes: "Gestão das frentes de fabricação aditiva e expansão B2B."
    }
  ];

  const totalEquity = partners.reduce((sum, p) => sum + p.equityPercentage, 0);
  const totalNominalCapital = partners.reduce((sum, p) => sum + p.nominalValue, 0);
  const totalQuotas = partners.reduce((sum, p) => sum + p.quotas, 0);

  // Aportes de Capital Social (Patrimônio Líquido - Isentos de trânsito em DRE)
  const contributions: ContributionView[] = [
    {
      id: "cont-01",
      partnerName: "Sócio A",
      date: "2026-01-15",
      amount: 40000.0,
      paymentMethod: "Transferência Bancária / TED",
      status: "Integralizado",
      destinationAccount: "Banco Cora (Conta Capital Social)",
      legalDocNumber: "Contrato Social Registrado - Cláusula 5"
    },
    {
      id: "cont-02",
      partnerName: "Sócio B",
      date: "2026-01-15",
      amount: 35000.0,
      paymentMethod: "Transferência Bancária / PIX PJ",
      status: "Integralizado",
      destinationAccount: "Banco Cora (Conta Capital Social)",
      legalDocNumber: "Contrato Social Registrado - Cláusula 5"
    },
    {
      id: "cont-03",
      partnerName: "Sócio C",
      date: "2026-01-15",
      amount: 25000.0,
      paymentMethod: "Transferência Bancária / PIX PJ",
      status: "Integralizado",
      destinationAccount: "Banco Cora (Conta Capital Social)",
      legalDocNumber: "Contrato Social Registrado - Cláusula 5"
    }
  ];

  // Empréstimos Mútuos (Passivo Exigível - Isento de DRE na captação e amortização)
  const loans: LoanView[] = [
    {
      id: "loan-01",
      partnerName: "Sócio A",
      agreementDate: "2026-03-01",
      principalAmount: 20000.0,
      balanceDue: 12000.0,
      interestRateAnnual: 6.5,
      status: "Ativo",
      contractReference: "MUTUO-SOC-2026-01 (Auditoria Jurídica OK)"
    }
  ];

  // Propostas de Distribuição de Lucros
  const proposals: DistributionProposalView[] = [
    {
      id: "prop-2026-Q1",
      fiscalPeriod: "2026-Q1",
      calculatedAccountingProfit: 45000.0,
      proposedTotalDistribution: 20000.0,
      retainedEarningsForWorkingCapital: 25000.0,
      status: "Aprovada em Ata",
      governanceMeetingMinutesRef: "Ata da Reunião de Sócios nº 04/2026",
      simulatedAvailableLiquidity: 38000.0
    }
  ];

  // Simulador de Liquidez
  const [currentCash, setCurrentCash] = useState<number>(50000.0);
  const [reservedWorkingCapital, setReservedWorkingCapital] = useState<number>(30000.0);
  const [periodNetProfit, setPeriodNetProfit] = useState<number>(25000.0);
  const [distributionTarget, setDistributionTarget] = useState<number>(15000.0);

  const availableLiquidity = Math.max(0, currentCash - reservedWorkingCapital);
  const maxAllowableDistribution = Math.min(availableLiquidity, periodNetProfit);
  const isPrudent = distributionTarget <= maxAllowableDistribution && distributionTarget <= periodNetProfit;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 space-y-6">
      {/* Top Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-500/10 text-purple-400 rounded-xl border border-purple-500/20">
            <Users className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-white flex items-center gap-2">
              Gestão Societária, Capital Social & Governança
              <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">
                Governança Ativa
              </span>
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Controle estrito de quotas (100%), separação fiduciária, aportes de capital, mútuos, pró-labore e dividendos.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-slate-950 border border-slate-800 px-4 py-2 rounded-xl text-right">
            <span className="text-xs text-slate-400 block font-medium">Capital Social Subscrito</span>
            <span className="text-lg font-bold text-white">
              R$ {totalNominalCapital.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="bg-slate-950 border border-slate-800 px-4 py-2 rounded-xl text-right">
            <span className="text-xs text-slate-400 block font-medium">Equilíbrio de Quotas</span>
            <span className={`text-lg font-bold ${totalEquity === 100.0 ? "text-emerald-400" : "text-rose-400"}`}>
              {totalEquity.toFixed(2)}%
            </span>
          </div>
        </div>
      </header>

      {/* Principais Diretrizes Fiduciárias */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl flex items-start gap-3">
          <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-white">Separação Patrimonial Estrita</h4>
            <p className="text-xs text-slate-400 mt-1">
              O patrimônio dos sócios não se confunde com o da HB Studio. Aportes e mútuos não transitam pela DRE operacional.
            </p>
          </div>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl flex items-start gap-3">
          <Scale className="w-6 h-6 text-purple-400 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-white">Soma Exata de Quotas (100.00%)</h4>
            <p className="text-xs text-slate-400 mt-1">
              Bloqueio matemático contra diluições não deliberadas ou divergências de soma percentual no contrato social.
            </p>
          </div>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl flex items-start gap-3">
          <TrendingUp className="w-6 h-6 text-blue-400 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-white">Lucro Real e Liquidez Comprovada</h4>
            <p className="text-xs text-slate-400 mt-1">
              Distribuição de lucros limitada estritamente ao resultado líquido positivo apurado na DRE e ao caixa livre.
            </p>
          </div>
        </div>
      </section>

      {/* Navegação de Abas */}
      <nav className="flex space-x-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab("cap-table")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "cap-table"
              ? "bg-purple-600 text-white shadow-lg shadow-purple-500/20"
              : "text-slate-400 hover:text-white hover:bg-slate-900"
          }`}
        >
          <PieChart className="w-4 h-4 inline mr-2" />
          Cap Table & Sócios
        </button>
        <button
          onClick={() => setActiveTab("contributions")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "contributions"
              ? "bg-purple-600 text-white shadow-lg shadow-purple-500/20"
              : "text-slate-400 hover:text-white hover:bg-slate-900"
          }`}
        >
          <Wallet className="w-4 h-4 inline mr-2" />
          Aportes (Capital Social)
        </button>
        <button
          onClick={() => setActiveTab("loans")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "loans"
              ? "bg-purple-600 text-white shadow-lg shadow-purple-500/20"
              : "text-slate-400 hover:text-white hover:bg-slate-900"
          }`}
        >
          <HandCoins className="w-4 h-4 inline mr-2" />
          Mútuos de Sócios (Passivo)
        </button>
        <button
          onClick={() => setActiveTab("pro-labore")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "pro-labore"
              ? "bg-purple-600 text-white shadow-lg shadow-purple-500/20"
              : "text-slate-400 hover:text-white hover:bg-slate-900"
          }`}
        >
          <Banknote className="w-4 h-4 inline mr-2" />
          Pró-Labore & Tetos
        </button>
        <button
          onClick={() => setActiveTab("distributions")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "distributions"
              ? "bg-purple-600 text-white shadow-lg shadow-purple-500/20"
              : "text-slate-400 hover:text-white hover:bg-slate-900"
          }`}
        >
          <Award className="w-4 h-4 inline mr-2" />
          Distribuição de Lucros
        </button>
        <button
          onClick={() => setActiveTab("simulator")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "simulator"
              ? "bg-purple-600 text-white shadow-lg shadow-purple-500/20"
              : "text-slate-400 hover:text-white hover:bg-slate-900"
          }`}
        >
          <TrendingUp className="w-4 h-4 inline mr-2" />
          Simulador de Prudência
        </button>
      </nav>

      {/* Conteúdo das Abas */}

      {/* ABA 1: Cap Table & Sócios */}
      {activeTab === "cap-table" && (
        <section className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-lg font-semibold text-white">Quadro de Participação Societária (Cap Table)</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Distribuição de quotas societárias e participações proporcionais registradas em contrato.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-medium">Total de Quotas:</span>
                <span className="text-sm font-bold text-white bg-slate-950 px-3 py-1 rounded-lg border border-slate-800">
                  {totalQuotas.toLocaleString("pt-BR")}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {partners.map((partner) => (
                <div
                  key={partner.id}
                  className="bg-slate-950/70 border border-slate-800 rounded-xl p-5 hover:border-purple-500/50 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="font-bold text-white text-base">{partner.name}</h4>
                        <span className="text-xs text-purple-400 font-medium">{partner.role}</span>
                      </div>
                      <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-full border border-emerald-500/20 font-bold">
                        {partner.equityPercentage.toFixed(1)}%
                      </span>
                    </div>

                    <div className="text-xs text-slate-400 space-y-1.5 mt-4 border-t border-slate-900 pt-3">
                      <div className="flex justify-between">
                        <span>Documento (CPF):</span>
                        <span className="text-slate-200 font-mono">{partner.document}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Quotas Tituladas:</span>
                        <span className="text-slate-200 font-medium">{partner.quotas.toLocaleString("pt-BR")}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Valor Nominal do Capital:</span>
                        <span className="text-slate-200 font-medium">
                          R$ {partner.nominalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Teto Mensal Pró-Labore:</span>
                        <span className="text-emerald-400 font-medium">
                          R$ {partner.monthlyProLaboreCap.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 mt-4 italic bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/60">
                    {partner.notes}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ABA 2: Aportes de Capital Social */}
      {activeTab === "contributions" && (
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex justify-between items-center mb-2">
            <div>
              <h3 className="text-lg font-semibold text-white">Registro de Aportes e Integralização</h3>
              <p className="text-xs text-slate-400 mt-1">
                Lançamentos no Patrimônio Líquido com entrada direta em conta bancária, sem transitar pela DRE operacional.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/60 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="p-3">Sócio</th>
                  <th className="p-3">Data</th>
                  <th className="p-3">Valor Aportado</th>
                  <th className="p-3">Forma de Pagamento</th>
                  <th className="p-3">Conta Destino</th>
                  <th className="p-3">Documento Jurídico</th>
                  <th className="p-3">Status Contábil</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {contributions.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="p-3 font-semibold text-white">{c.partnerName}</td>
                    <td className="p-3 font-mono text-xs">{c.date}</td>
                    <td className="p-3 font-bold text-emerald-400">
                      R$ {c.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 text-xs">{c.paymentMethod}</td>
                    <td className="p-3 text-xs font-mono text-slate-400">{c.destinationAccount}</td>
                    <td className="p-3 text-xs text-purple-300">{c.legalDocNumber}</td>
                    <td className="p-3">
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                        {c.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ABA 3: Mútuos de Sócios (Passivo) */}
      {activeTab === "loans" && (
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex justify-between items-center mb-2">
            <div>
              <h3 className="text-lg font-semibold text-white">Contratos de Mútuo & Empréstimos de Sócios</h3>
              <p className="text-xs text-slate-400 mt-1">
                Recursos emprestados pelos sócios à empresa registrados no Passivo Exigível. Captação e amortização não alteram a DRE.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/60 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="p-3">Sócio Credor</th>
                  <th className="p-3">Data do Mútuo</th>
                  <th className="p-3">Valor Principal</th>
                  <th className="p-3">Saldo Devedor Atual</th>
                  <th className="p-3">Juros Anuais</th>
                  <th className="p-3">Instrumento Jurídico</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {loans.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="p-3 font-semibold text-white">{l.partnerName}</td>
                    <td className="p-3 font-mono text-xs">{l.agreementDate}</td>
                    <td className="p-3 font-medium text-white">
                      R$ {l.principalAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 font-bold text-amber-400">
                      R$ {l.balanceDue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 text-xs">{l.interestRateAnnual}% a.a.</td>
                    <td className="p-3 text-xs text-purple-300">{l.contractReference}</td>
                    <td className="p-3">
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium">
                        {l.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ABA 4: Pró-Labore & Tetos */}
      {activeTab === "pro-labore" && (
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-white">Governança de Pró-Labore dos Sócios</h3>
            <p className="text-xs text-slate-400 mt-1">
              Remuneração pelo trabalho operacional executado na empresa, gerando títulos no Contas a Pagar e despesa operacional na DRE.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {partners.map((p) => (
              <div key={p.id} className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-white">{p.name}</h4>
                  <span className="text-xs text-slate-400 font-mono">{p.role}</span>
                </div>
                <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                  <span className="text-xs text-slate-400 block">Teto Mensal Autorizado</span>
                  <span className="text-xl font-bold text-emerald-400">
                    R$ {p.monthlyProLaboreCap.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="text-xs text-slate-400 space-y-1">
                  <div className="flex justify-between">
                    <span>Incidência INSS / IRPF:</span>
                    <span className="text-slate-200">Retido na Fonte</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Integração Financeira:</span>
                    <span className="text-purple-400">Gera Conta a Pagar</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ABA 5: Distribuição de Lucros */}
      {activeTab === "distributions" && (
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-white">Deliberações de Distribuição de Lucros (Dividendos)</h3>
            <p className="text-xs text-slate-400 mt-1">
              Exigência estrita de aprovação formal em ata e apuração prévia de Lucro Contábil positivo na DRE.
            </p>
          </div>

          <div className="space-y-4">
            {proposals.map((prop) => (
              <div key={prop.id} className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex flex-col md:flex-row justify-between md:items-center gap-2">
                  <div>
                    <h4 className="font-bold text-white text-base">Período: {prop.fiscalPeriod}</h4>
                    <span className="text-xs text-purple-400 font-medium">{prop.governanceMeetingMinutesRef}</span>
                  </div>
                  <span className="text-xs px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold self-start md:self-auto">
                    {prop.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-900/50 p-4 rounded-xl border border-slate-800/80">
                  <div>
                    <span className="text-xs text-slate-400 block">Lucro Apurado na DRE</span>
                    <span className="text-sm font-bold text-white">
                      R$ {prop.calculatedAccountingProfit.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 block">Distribuição Deliberada</span>
                    <span className="text-sm font-bold text-emerald-400">
                      R$ {prop.proposedTotalDistribution.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 block">Reserva de Capital de Giro</span>
                    <span className="text-sm font-bold text-blue-400">
                      R$ {prop.retainedEarningsForWorkingCapital.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 block">Liquidez Livre no Período</span>
                    <span className="text-sm font-bold text-purple-400">
                      R$ {prop.simulatedAvailableLiquidity.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Repartição por Sócio */}
                <div className="border-t border-slate-800/80 pt-3">
                  <h5 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Repartição Proporcional Conforme Cap Table
                  </h5>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {partners.map((p) => {
                      const share = (prop.proposedTotalDistribution * p.equityPercentage) / 100;
                      return (
                        <div key={p.id} className="bg-slate-900/80 p-3 rounded-lg border border-slate-800 flex justify-between items-center">
                          <div>
                            <span className="text-xs font-bold text-white block">{p.name}</span>
                            <span className="text-xs text-slate-400">{p.equityPercentage}%</span>
                          </div>
                          <span className="text-sm font-bold text-emerald-400">
                            R$ {share.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ABA 6: Simulador de Prudência & Liquidez */}
      {activeTab === "simulator" && (
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-white">Simulador de Prudência Financeira & Liquidez Livre</h3>
            <p className="text-xs text-slate-400 mt-1">
              Avaliação em tempo real se uma distribuição planejada preserva a continuidade operacional e respeita os lucros da DRE.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4 bg-slate-950 p-5 rounded-xl border border-slate-800">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Saldo em Caixa & Bancos (R$)</label>
                <input
                  type="number"
                  value={currentCash}
                  onChange={(e) => setCurrentCash(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-sm"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Reserva Mínima de Capital de Giro / Riscos (R$)</label>
                <input
                  type="number"
                  value={reservedWorkingCapital}
                  onChange={(e) => setReservedWorkingCapital(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-sm"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Lucro Líquido Contábil Apurado na DRE (R$)</label>
                <input
                  type="number"
                  value={periodNetProfit}
                  onChange={(e) => setPeriodNetProfit(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-sm"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Proposta Pretendida de Distribuição (R$)</label>
                <input
                  type="number"
                  value={distributionTarget}
                  onChange={(e) => setDistributionTarget(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-sm"
                />
              </div>
            </div>

            <div className="flex flex-col justify-between bg-slate-950 p-5 rounded-xl border border-slate-800">
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Parecer do Algoritmo Fiduciário</h4>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-slate-800">
                    <span className="text-slate-400">Liquidez Livre (Caixa - Reserva):</span>
                    <span className="font-bold text-white font-mono">
                      R$ {availableLiquidity.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-800">
                    <span className="text-slate-400">Teto Máximo Prudencial Permitido:</span>
                    <span className="font-bold text-purple-400 font-mono">
                      R$ {maxAllowableDistribution.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-800">
                    <span className="text-slate-400">Distribuição Pretendida:</span>
                    <span className="font-bold text-white font-mono">
                      R$ {distributionTarget.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                <div className={`p-4 rounded-xl border ${isPrudent ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300" : "bg-rose-500/10 border-rose-500/30 text-rose-300"}`}>
                  <div className="flex items-center gap-2 font-bold mb-1">
                    {isPrudent ? (
                      <>
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        <span>Distribuição Homologável & Segura</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-5 h-5 text-rose-400" />
                        <span>Risco de Descapitalização ou Violação Societária</span>
                      </>
                    )}
                  </div>
                  <p className="text-xs mt-1">
                    {isPrudent
                      ? "A distribuição proposta está 100% coberta pelo lucro real apurado na DRE e não compromete a reserva de giro indispensável para a HB Studio."
                      : "A distribuição excede o lucro contábil apurado ou a liquidez livre real da empresa. Ajuste o valor para não comprometer a saúde financeira da empresa."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
