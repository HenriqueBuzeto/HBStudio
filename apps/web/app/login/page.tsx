import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/LoginForm";
import { ShieldCheck, Lock } from "lucide-react";

export const metadata: Metadata = {
  title: "Login de Sócios | HB Studio ERP",
  description: "Acesso exclusivo aos sócios e diretores executivos da HB Studio",
};

export default function LoginPage() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 relative hb-grid-background">
      {/* Container Central com Estética HBVisionX */}
      <div className="w-full max-w-[420px] bg-white rounded-3xl border border-slate-200/90 shadow-xl overflow-hidden relative z-10 transition-all">
        {/* Faixa decorativa superior com gradiente sutil da HB Studio */}
        <div className="h-2 w-full bg-gradient-to-r from-purple-700 via-indigo-600 to-purple-800" />

        <div className="p-8 sm:p-9 space-y-6">
          {/* Área de Identidade Visual */}
          <div className="space-y-2 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-purple-700 text-white font-extrabold text-xl shadow-md shadow-purple-700/20 mb-2">
              HB
            </div>
            <div className="flex items-center justify-center gap-2">
              <span className="text-xs font-black tracking-widest text-slate-900 uppercase">
                HB Studio
              </span>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                ERP
              </span>
            </div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Gestão Empresarial
            </p>
          </div>

          {/* Título de Boas-vindas */}
          <div className="space-y-1 text-center">
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Bem-vindo de volta
            </h1>
            <p className="text-xs text-slate-500 leading-relaxed">
              Acesse sua conta para entrar no sistema de gestão da HB Studio.
            </p>
          </div>

          {/* Formulário de Autenticação */}
          <LoginForm />

          {/* Rodapé Institucional e de Governança */}
          <div className="pt-4 border-t border-slate-100 space-y-2 text-center">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-500 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200/80">
              <Lock className="w-3.5 h-3.5 text-purple-600" />
              <span>Acesso restrito aos sócios autorizados da HB Studio.</span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono">
              Ambiente Seguro • Blueprint Enterprise 1.0
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
