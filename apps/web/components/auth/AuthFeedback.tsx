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
      className={`p-3.5 rounded-xl border flex items-start gap-3 transition-all ${
        isError
          ? "bg-rose-50/80 border-rose-200 text-rose-800"
          : "bg-amber-50/80 border-amber-200 text-amber-800"
      }`}
    >
      {isError ? (
        <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
      ) : (
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
      )}
      <div className="text-xs leading-relaxed font-medium">
        {message}
      </div>
    </div>
  );
}
