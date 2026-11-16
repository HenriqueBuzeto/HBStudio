import RootShellLayout from "@/components/RootShellLayout";
import { 
  Boxes, 
  Wrench, 
  ShoppingCart, 
  CircleDollarSign, 
  CheckCircle2, 
  ArrowUpRight,
  TrendingUp,
  Target,
  Sparkles,
  ShieldCheck,
  ChevronRight,
  Building2,
  Package,
  Layers,
  ArrowRight
} from "lucide-react";
import Link from "next/link";

export default function Home() {
  const modules = [
    { id: "MOD-00", name: "Fundação & Multi-tenant Fail-Closed", status: "READY_VERIFIED", desc: "Segurança de tenant rígida, PermissionKeys e auditoria", href: "/" },
    { id: "MOD-01", name: "Pessoas & Contatos (Parties)", status: "READY_VERIFIED", desc: "Unificação de clientes, fornecedores e equipamentos", href: "/parties" },
    { id: "MOD-02", name: "Catálogo & Serialização (IMEI)", status: "READY_VERIFIED", desc: "Modelos, SKUs, graus cosméticos e saúde de bateria", href: "/catalog" },
    { id: "MOD-03", name: "Estoque & Kardex Imutável", status: "READY_VERIFIED", desc: "Partidas de estoque, saldos físicos e histórico blindado", href: "/inventory" },
    { id: "MOD-04", name: "Compras & Recebimento", status: "READY_VERIFIED", desc: "Fornecedores, pedidos de compra e entrada de aparelhos", href: "/procurement" },
    { id: "MOD-05", name: "Vendas & PDV Balcão", status: "READY_VERIFIED", desc: "Frente de caixa, intents de pagamento e saída serializada", href: "/sales" },
    { id: "MOD-06", name: "Caixa & Turnos Físicos", status: "READY_VERIFIED", desc: "Abertura, suprimentos, sangrias e conferência cega", href: "/cash" },
    { id: "MOD-07", name: "Assistência Técnica & OS", status: "READY_VERIFIED", desc: "Diagnóstico, orçamentos, consumo de peças e garantias CDC", href: "/repairs" },
    { id: "MOD-08", name: "CRM & Intenção de Compra", status: "READY_VERIFIED", desc: "Funil de vendas, fila de espera e matching inteligente com estoque", href: "/crm" },
    { id: "MOD-12", name: "Financeiro Geral & DRE", status: "READY_VERIFIED", desc: "Partidas dobradas, DRE gerencial e conciliação", href: "/financial" },
    { id: "MOD-13", name: "Sócios & Gestão de Capital", status: "READY_VERIFIED", desc: "Quotas societárias 100%, aportes, mútuos e pro-labore", href: "/partners" },
  ];

  return (
    <RootShellLayout>
      <div className="space-y-6">
        {/* Top Header Card estilo HBVisionX */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-700 bg-purple-50 px-2.5 py-1 rounded-full border border-purple-200">
                HB Studio Retaguarda
              </span>
              <span className="text-[10px] font-bold text-slate-400">Build v2.4.0</span>
            </div>
            <h1 className="text-xl md:text-2xl font-extrabold tracking-tight text-slate-900 mt-2">
              Visão Estratégica da Operação
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Painel executivo com status em tempo real de conformidade, módulos certificados e indicadores operacionais.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              63/63 Testes Automatizados Homologados
            </span>
          </div>
        </div>

        {/* Indicadores Comerciais Hoje (Cards Estilo Imagem HBVisionX) */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-purple-600" />
              Indicadores de Performance da Loja
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Vendas Hoje */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs relative overflow-hidden group hover:border-purple-300 transition-all">
              <div className="absolute top-0 left-0 right-0 h-1 bg-purple-600"></div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Vendas Faturadas (Hoje)
                </span>
                <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
                  <ShoppingCart className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-extrabold text-slate-900 mt-2">
                R$ 14.890,00
              </div>
              <p className="text-[11px] text-emerald-600 font-semibold mt-1 flex items-center gap-1">
                <ArrowUpRight className="w-3.5 h-3.5" />
                +18.4% vs média diária
              </p>
            </div>

            {/* Aparelhos Serializados */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs relative overflow-hidden group hover:border-blue-300 transition-all">
              <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500"></div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Aparelhos em Estoque Real
                </span>
                <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                  <Package className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-extrabold text-slate-900 mt-2">
                42 Unidades
              </div>
              <p className="text-[11px] text-blue-600 font-medium mt-1">
                Rastreamento por IMEI & Laudo
              </p>
            </div>

            {/* Ordens de Serviço */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs relative overflow-hidden group hover:border-amber-300 transition-all">
              <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500"></div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  OS em Bancada Técnica
                </span>
                <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                  <Wrench className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-extrabold text-slate-900 mt-2">
                8 Reparos
              </div>
              <p className="text-[11px] text-amber-600 font-medium mt-1">
                Modo diagnóstico ativo (sem senhas)
              </p>
            </div>

            {/* Fila de Matching CRM */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs relative overflow-hidden group hover:border-emerald-300 transition-all">
              <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500"></div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Matches CRM com Estoque
                </span>
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                  <Sparkles className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-extrabold text-slate-900 mt-2">
                5 Compatíveis
              </div>
              <p className="text-[11px] text-emerald-600 font-medium mt-1">
                Prontos para reserva e contato
              </p>
            </div>
          </div>
        </div>

        {/* Grade de Módulos Homologados estilo HBVision */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-extrabold text-slate-900">
                Arquitetura de Módulos Enterprise Concluídos
              </h2>
              <p className="text-xs text-slate-500">
                Cada módulo possui persistência real no PostgreSQL 18.3, integridade transacional e testes de gate aprovados.
              </p>
            </div>
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
              11 Módulos Concluídos
            </span>
          </div>

          <div className="divide-y divide-slate-100 text-xs">
            {modules.map((m) => (
              <Link
                key={m.id}
                href={m.href}
                className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <span className="w-16 font-mono font-bold text-slate-500 group-hover:text-purple-600 transition-colors">
                    {m.id}
                  </span>
                  <div>
                    <h3 className="font-bold text-slate-900 group-hover:text-purple-700 transition-colors">
                      {m.name}
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">{m.desc}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    {m.status}
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-purple-600 group-hover:translate-x-0.5 transition-all" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </RootShellLayout>
  );
}
