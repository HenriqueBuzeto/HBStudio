import React from "react";
import { AlertCircle, AlertTriangle } from "lucide-react";

interface AuthFeedbackProps {
  message?: string;
  type?: "error" | "warning";
}

export function AuthFeedback({ message, type = "error" }: AuthFeedbackProps) {
  if (!message) return null;

  const isError = type === "error";

  return (
    <div
      role="alert"
      className={`p-3.5 rounded-xl border flex items-center justify-center text-center gap-2.5 transition-all text-xs font-semibold ${
        isError
          ? "bg-rose-950/40 border-rose-900/60 text-rose-400 shadow-inner"
          : "bg-amber-950/40 border-amber-900/60 text-amber-300 shadow-inner"
      }`}
    >
      {isError ? (
        <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
      ) : (
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
      )}
      <span>{message}</span>
    </div>
  );
}
