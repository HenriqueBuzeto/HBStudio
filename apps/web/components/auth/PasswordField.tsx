import React from "react";
import { Eye, EyeOff, Lock } from "lucide-react";

interface PasswordFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export function PasswordField({ label, error, className, ...props }: PasswordFieldProps) {
  const [showPassword, setShowPassword] = React.useState(false);

  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold text-slate-300 tracking-tight">
        {label}
      </label>
      <div className="relative">
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
          <Lock className="w-4 h-4" />
        </div>
        <input
          {...props}
          type={showPassword ? "text" : "password"}
          className={`w-full pl-10 pr-11 py-3 text-sm bg-slate-900/90 hover:bg-slate-900 focus:bg-slate-950 border ${
            error
              ? "border-rose-500/80 focus:ring-rose-500/30"
              : "border-slate-800 focus:border-cyan-500 focus:ring-cyan-500/20"
          } rounded-xl focus:outline-none focus:ring-2 text-white transition-all placeholder:text-slate-500 font-mono shadow-inner`}
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          tabIndex={-1}
          aria-label={showPassword ? "Ocultar senha" : "Ver senha"}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1 rounded-md transition-colors"
        >
          {showPassword ? (
            <EyeOff className="w-4 h-4" />
          ) : (
            <Eye className="w-4 h-4" />
          )}
        </button>
      </div>
      {error && (
        <p className="text-[11px] font-semibold text-rose-400 animate-fadeIn">{error}</p>
      )}
    </div>
  );
}
