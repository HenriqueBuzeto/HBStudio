import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/LoginForm";
import { Lock } from "lucide-react";

export const metadata: Metadata = {
  title: "Acesso Administrativo | HB Studio ERP",
  description: "Acesso exclusivo aos sócios e diretores executivos da HB Studio",
};

export default function LoginPage() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 relative bg-[#040711] overflow-hidden select-none">
      {/* Background Decorativo com Brilhos e Gradientes Roxo e Azul Escuro */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Glow Central Superior Roxo */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[500px] bg-purple-900/20 blur-[130px] rounded-full" />
        {/* Glow Lateral Azul/Ciano */}
        <div className="absolute bottom-1/4 left-1/3 w-[500px] h-[400px] bg-blue-950/30 blur-[120px] rounded-full" />
        {/* Grid Sutil Dark */}
        <div className="absolute inset-0 bg-[radial-gradient(#1e1b4b_1px,transparent_1px)] [background-size:32px_32px] opacity-25" />
      </div>

      {/* Card Central com Estética Idêntica à Imagem de Referência */}
      <div className="w-full max-w-[460px] bg-[#0b101f]/90 rounded-[28px] border border-[#1e293b]/70 shadow-2xl shadow-black/80 backdrop-blur-xl p-8 sm:p-10 relative z-10 transition-all space-y-6">
        
        {/* Logo / Ícone Superior com Gradiente Azul e Brilho */}
        <div className="flex flex-col items-center justify-center text-center space-y-3">
          <div className="relative group">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-400 via-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/30">
              <span className="text-white font-extrabold text-2xl tracking-tighter">A</span>
            </div>
            {/* Glow sutil atrás do ícone */}
            <div className="absolute inset-0 rounded-2xl bg-cyan-400/30 blur-md -z-10" />
          </div>

          <div className="space-y-1">
            <h1 className="text-2xl font-extrabold text-white tracking-tight">
              Acesso Administrativo
            </h1>
            <p className="text-xs font-medium text-slate-400">
              HBVisionX Control Plane Enterprise
            </p>
          </div>
        </div>

        {/* Formulário de Login */}
        <LoginForm />

        {/* Rodapé Seguro e Discreto */}
        <div className="pt-2 flex items-center justify-center gap-1.5 text-[11px] font-medium text-slate-500">
          <Lock className="w-3.5 h-3.5 text-slate-500" />
          <span>Ambiente Seguro Criptografado • HB Studio</span>
        </div>
      </div>
    </div>
  );
}
