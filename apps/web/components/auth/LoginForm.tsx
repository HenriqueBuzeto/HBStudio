"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { PasswordField } from "./PasswordField";
import { AuthFeedback } from "./AuthFeedback";
import { Loader2, ArrowRight } from "lucide-react";

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
      // Chamada à API de autenticação do backend oficial
      const res = await fetch("http://localhost:5000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password: password,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        login(data.accessToken, data.user);
        router.push("/");
      } else if (res.status === 401 || res.status === 403) {
        // Mensagem genérica padronizada: segurança contra enumeração de contas
        setFeedback("Não foi possível entrar. Verifique suas credenciais ou procure o responsável pelo acesso.");
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
          className="block text-xs font-bold text-slate-700 tracking-tight"
        >
          E-mail Corporativo
        </label>
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
          placeholder="seu@email.com"
          className={`w-full px-4 py-2.5 text-sm bg-slate-50/70 hover:bg-slate-50 focus:bg-white border ${
            fieldErrors.email
              ? "border-rose-400 focus:ring-rose-500/20"
              : "border-slate-200 focus:ring-purple-500/20 focus:border-purple-600"
          } rounded-xl focus:outline-none focus:ring-2 text-slate-900 transition-all placeholder:text-slate-400 shadow-2xs`}
        />
        {fieldErrors.email && (
          <p className="text-[11px] font-semibold text-rose-500 animate-fadeIn">
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

      {/* Botão Entrar no Sistema */}
      <div className="pt-2">
        <button
          type="submit"
          disabled={loading}
          className="w-full h-11 bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-800 hover:to-indigo-800 active:scale-[0.99] text-white font-extrabold text-sm rounded-xl transition-all shadow-md hover:shadow-purple-700/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-white" />
              <span>Verificando credenciais...</span>
            </>
          ) : (
            <>
              <span>Entrar no sistema</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </form>
  );
}
