"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { PasswordField } from "./PasswordField";
import { AuthFeedback } from "./AuthFeedback";
import { Loader2, Mail, ArrowRight, ShieldCheck } from "lucide-react";

export function LoginForm() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  const validate = () => {
    const errors: { email?: string; password?: string } = {};

    if (!email.trim()) {
      errors.email = "O e-mail é obrigatório.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = "Formato de e-mail inválido.";
    }

    if (!password) {
      errors.password = "A senha é obrigatória.";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!validate() || loading) return;

    setLoading(true);

    try {
      // Chamada à rota interna BFF do Next.js (grava Cookie HttpOnly no navegador)
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password: password,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        login(data.user);
        router.push("/");
      } else if (res.status === 401 || res.status === 403) {
        // Mensagem genérica padronizada: segurança contra enumeração de contas
        setFeedback("Credenciais inválidas ou acesso corporativo suspenso.");
      } else {
        setFeedback("Não foi possível conectar ao servidor. Tente novamente.");
      }
    } catch {
      setFeedback("Não foi possível conectar ao servidor. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <AuthFeedback message={feedback ?? undefined} />

      {/* Campo E-mail */}
      <div className="space-y-1.5">
        <label
          htmlFor="email-input"
          className="block text-xs font-semibold text-slate-300 tracking-tight"
        >
          E-mail Corporativo
        </label>
        <div className="relative group">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-purple-400 pointer-events-none transition-colors">
            <Mail className="w-4 h-4" />
          </div>
          <input
            id="email-input"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (fieldErrors.email) setFieldErrors({ ...fieldErrors, email: undefined });
            }}
            disabled={loading}
            autoComplete="email"
            placeholder="usuario@hbstudio.com"
            className={`w-full pl-10 pr-4 py-3 text-sm bg-[#080d1a]/95 hover:bg-[#0b1224] focus:bg-[#070b16] border ${
              fieldErrors.email
                ? "border-rose-500/80 focus:ring-rose-500/30"
                : "border-white/10 focus:border-purple-500 focus:ring-purple-500/25"
            } rounded-xl focus:outline-none focus:ring-2 text-white transition-all placeholder:text-slate-500 shadow-inner`}
          />
        </div>
        {fieldErrors.email && (
          <p className="text-[11px] font-semibold text-rose-400 animate-fadeIn">
            {fieldErrors.email}
          </p>
        )}
      </div>

      {/* Campo Senha */}
      <PasswordField
        id="password-input"
        label="Senha de Acesso"
        value={password}
        onChange={(e) => {
          setPassword(e.target.value);
          if (fieldErrors.password) setFieldErrors({ ...fieldErrors, password: undefined });
        }}
        disabled={loading}
        autoComplete="current-password"
        placeholder="••••••••••••"
        error={fieldErrors.password}
      />

      {/* Botão de Ação Primário com Gradiente Púrpura HB Studio */}
      <div className="pt-2">
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 px-4 bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 hover:from-violet-500 hover:via-purple-500 hover:to-indigo-500 active:from-violet-700 active:to-indigo-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-purple-600/30 hover:shadow-purple-600/50 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed group"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-white" />
              <span>Autenticando...</span>
            </>
          ) : (
            <>
              <span>Acessar Painel HB Studio</span>
              <ArrowRight className="w-4 h-4 text-purple-200 group-hover:translate-x-0.5 transition-transform" />
            </>
          )}
        </button>
      </div>
    </form>
  );
}
