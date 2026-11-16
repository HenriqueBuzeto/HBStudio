import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/LoginForm";
import { ParticleCanvas } from "@/components/auth/ParticleCanvas";
import { ShieldCheck, Sparkles } from "lucide-react";

export const metadata: Metadata = {
  title: "Login Corporativo | HB Studio ERP",
  description: "Portal de autenticação e governança empresarial da HB Studio",
};

export default function LoginPage() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 relative bg-[#04060d] overflow-hidden select-none">
      
      {/* 1. Canvas Dinâmico de Partículas Flutuantes e Conexões Neurais */}
      <ParticleCanvas />

      {/* 2. Efeitos de Iluminação e Atmosfera Dark (Glows Roxo & Azul) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Glow Superior Central Violeta */}
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[650px] h-[550px] bg-gradient-to-b from-purple-600/25 to-transparent blur-[140px] rounded-full" />
        
        {/* Glow Lateral Esquerdo Azul Cósmico */}
        <div className="absolute top-1/3 -left-40 w-[500px] h-[500px] bg-indigo-900/20 blur-[130px] rounded-full" />
        
        {/* Glow Inferior Direito Magenta */}
        <div className="absolute -bottom-32 -right-32 w-[550px] h-[550px] bg-purple-950/30 blur-[150px] rounded-full" />

        {/* Grade Sutil de Fundo HBVisionX */}
        <div className="absolute inset-0 bg-[radial-gradient(rgba(147,51,234,0.15)_1px,transparent_1px)] [background-size:28px_28px] opacity-40" />
      </div>

      {/* 3. Card Central de Login com Estética HBVisionX Dark */}
      <div className="w-full max-w-[440px] bg-[#090e1c]/85 rounded-[28px] border border-white/10 shadow-2xl shadow-purple-950/50 backdrop-blur-2xl p-8 sm:p-10 relative z-10 transition-all space-y-6">
        
        {/* Faixa Superior com Brilho Neon Violeta */}
        <div className="absolute -top-px left-10 right-10 h-[2px] bg-gradient-to-r from-transparent via-purple-500 to-transparent shadow-[0_0_12px_rgba(168,85,247,0.8)]" />

        {/* Cabeçalho da Identidade Visual HB Studio */}
        <div className="flex flex-col items-center justify-center text-center space-y-3.5">
          <div className="relative group">
            {/* Logo Oficial HB Studio */}
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 flex items-center justify-center font-black text-white text-2xl shadow-xl shadow-purple-600/40 border border-purple-400/30">
              HB
            </div>
            {/* Glow pulsante de fundo */}
            <div className="absolute inset-0 rounded-2xl bg-purple-600/30 blur-lg -z-10 animate-pulse" />
          </div>

          <div className="space-y-1">
            <div className="inline-flex items-center gap-2">
              <h1 className="text-2xl font-black text-white tracking-tight">
                HB Studio
              </h1>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded-full border border-purple-500/30">
                ERP
              </span>
            </div>
            <p className="text-xs font-semibold text-slate-400 tracking-wide">
              Gestão & Inteligência Multinegócio
            </p>
          </div>
        </div>

        {/* Formulário de Autenticação */}
        <LoginForm />

        {/* Rodapé de Segurança e Governança */}
        <div className="pt-2 border-t border-white/5 flex flex-col items-center justify-center text-center space-y-1 text-slate-500 text-[11px]">
          <div className="inline-flex items-center gap-1.5 font-medium text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Acesso Seguro com Criptografia de Ponta</span>
          </div>
          <p className="text-[10px] text-slate-500 font-mono">
            HBVisionX Engine • v2.6 Enterprise
          </p>
        </div>
      </div>
    </div>
  );
}
