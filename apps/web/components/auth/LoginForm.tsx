"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { PasswordField } from "./PasswordField";
import { AuthFeedback } from "./AuthFeedback";
import { Loader2, Mail } from "lucide-react";

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
        setFeedback("Credenciais inválidas ou usuário administrativo inativo.");
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
        <div className="relative">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
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
            placeholder="hbdevstudio@gmail.com"
            className={`w-full pl-10 pr-4 py-3 text-sm bg-slate-900/90 hover:bg-slate-900 focus:bg-slate-950 border ${
              fieldErrors.email
                ? "border-rose-500/80 focus:ring-rose-500/30"
                : "border-slate-800 focus:border-cyan-500 focus:ring-cyan-500/20"
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
        label="Senha Master ou Suporte"
        value={password}
        onChange={(e) => {
          setPassword(e.target.value);
          if (fieldErrors.password) setFieldErrors({ ...fieldErrors, password: undefined });
        }}
        disabled={loading}
        autoComplete="current-password"
        placeholder="••••••••"
        error={fieldErrors.password}
      />

      {/* Botão de Ação com gradiente ciano / azul conforme a imagem de referência */}
      <div className="pt-2">
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 px-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 active:from-cyan-600 active:to-blue-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-cyan-500/20 transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-white" />
              <span>Autenticando...</span>
            </>
          ) : (
            <span>Continuar para Desafio MFA</span>
          )}
        </button>
      </div>
    </form>
  );
}
