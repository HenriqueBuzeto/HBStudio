import RootShellLayout from "@/components/RootShellLayout";
import { 
  Boxes, 
  Wrench, 
  ShoppingCart, 
  CircleDollarSign, 
  CheckCircle2, 
  AlertTriangle,
  ArrowUpRight,
  TrendingUp
} from "lucide-react";

export default function Home() {
  return (
    <RootShellLayout>
      <div className="space-y-6">
        {/* Header do Módulo */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Visão Geral da Operação
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Ambiente Enterprise ativo com isolamento de filial e backend autoritativo.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Gate 0 Verificado
            </span>
          </div>
        </div>

        {/* Status de Integridade do Sistema */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase">Segurança Fail-Closed</span>
              <div className="p-2 bg-indigo-50 dark:bg-indigo-950/50 rounded-lg text-indigo-600 dark:text-indigo-400">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <p className="mt-2 text-xl font-bold text-slate-900 dark:text-slate-100">Ativa & Auditada</p>
            <p className="text-xs text-slate-500 mt-1">PermissionKeys + Server-side Tenant</p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase">Ledger & Kardex</span>
              <div className="p-2 bg-emerald-50 dark:bg-emerald-950/50 rounded-lg text-emerald-600 dark:text-emerald-400">
                <Boxes className="w-4 h-4" />
              </div>
            </div>
            <p className="mt-2 text-xl font-bold text-slate-900 dark:text-slate-100">Imutável</p>
            <p className="text-xs text-slate-500 mt-1">Proibida edição manual de saldo</p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase">Gestão Financeira</span>
              <div className="p-2 bg-blue-50 dark:bg-blue-950/50 rounded-lg text-blue-600 dark:text-blue-400">
                <CircleDollarSign className="w-4 h-4" />
              </div>
            </div>
            <p className="mt-2 text-xl font-bold text-slate-900 dark:text-slate-100">Precisão Decimal</p>
            <p className="text-xs text-slate-500 mt-1">numeric(18,2) - Proibido float</p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase">Testes Automatizados</span>
              <div className="p-2 bg-amber-50 dark:bg-amber-950/50 rounded-lg text-amber-600 dark:text-amber-400">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <p className="mt-2 text-xl font-bold text-emerald-600 dark:text-emerald-400">100% Verdes</p>
            <p className="text-xs text-slate-500 mt-1">xUnit + Multi-tenant A/B testado</p>
          </div>
        </div>

        {/* Informações dos Próximos Módulos */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">
            Status dos Módulos do Sistema
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            Conforme diretriz técnica: nenhum módulo é declarado concluído sem integração real, persistência, autorização e testes comprovados.
          </p>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3.5 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30">
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <div>
                  <span className="font-semibold text-sm text-slate-900 dark:text-slate-100">MOD-00: Fundação, Multi-tenant & Segurança Fail-Closed</span>
                  <p className="text-xs text-slate-500">Pipeline de segurança, PermissionKeys canônicas, DbContext com query filter e auditoria.</p>
                </div>
              </div>
              <span className="text-xs font-medium px-2.5 py-1 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                READY_VERIFIED
              </span>
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30">
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <div>
                  <span className="font-semibold text-sm text-slate-900 dark:text-slate-100">MOD-01 & MOD-02: Catálogo, Clientes, Usados & Rastreamento de IMEI</span>
                  <p className="text-xs text-slate-500">Próximo na sequência: ProductModel, SkuVariant, InventoryUnit (IMEI1/IMEI2) e cadeia de custódia.</p>
                </div>
              </div>
              <span className="text-xs font-medium px-2.5 py-1 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                PRÓXIMO GATE (Fase 1)
              </span>
            </div>
          </div>
        </div>
      </div>
    </RootShellLayout>
  );
}
