import React from "react";
import { Eye, EyeOff } from "lucide-react";

interface PasswordFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export function PasswordField({ label, error, className, ...props }: PasswordFieldProps) {
  const [showPassword, setShowPassword] = React.useState(false);

  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-bold text-slate-700 tracking-tight">
        {label}
      </label>
      <div className="relative">
        <input
          {...props}
          type={showPassword ? "text" : "password"}
          className={`w-full px-4 py-2.5 pr-11 text-sm bg-slate-50/70 hover:bg-slate-50 focus:bg-white border ${
            error ? "border-rose-400 focus:ring-rose-500/20" : "border-slate-200 focus:ring-purple-500/20 focus:border-purple-600"
          } rounded-xl focus:outline-none focus:ring-2 text-slate-900 transition-all placeholder:text-slate-400 shadow-2xs font-mono`}
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          tabIndex={-1}
          aria-label={showPassword ? "Ocultar senha" : "Ver senha"}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors"
        >
          {showPassword ? (
            <EyeOff className="w-4 h-4" />
          ) : (
            <Eye className="w-4 h-4" />
          )}
        </button>
      </div>
      {error && (
        <p className="text-[11px] font-semibold text-rose-500 animate-fadeIn">{error}</p>
      )}
    </div>
  );
}
