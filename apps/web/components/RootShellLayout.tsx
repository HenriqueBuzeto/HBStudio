"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Boxes,
  ShoppingCart,
  Wrench,
  Package,
  Target,
  CircleDollarSign,
  Building2,
  Menu,
  X,
  ChevronDown,
  ChevronRight,
  LogOut,
  Bell,
  Search,
  Moon,
  Sparkles,
  TrendingUp,
  Receipt,
  Printer,
  ShieldCheck,
  CheckCircle2,
  Store,
  Layers
} from "lucide-react";

interface NavSubItem {
  name: string;
  href: string;
}

interface NavSection {
  title: string;
  items: {
    name: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
    subItems?: NavSubItem[];
  }[];
}

const navSections: NavSection[] = [
  {
    title: "PRINCIPAL",
    items: [
      { name: "Visão Geral", href: "/", icon: LayoutDashboard },
      { name: "PDV Balcão", href: "/sales", icon: ShoppingCart, badge: "PDV" },
    ],
  },
  {
    title: "OPERAÇÃO & PRODUTOS",
    items: [
      { name: "Clientes & Fornecedores", href: "/parties", icon: Users },
      { name: "Catálogo & Aparelhos", href: "/catalog", icon: Boxes },
      { name: "Estoque & Kardex", href: "/inventory", icon: Package },
      { name: "Compras & Entrada", href: "/procurement", icon: Receipt },
      { name: "Assistência Técnica (OS)", href: "/repairs", icon: Wrench, badge: "OS" },
    ],
  },
  {
    title: "COMERCIAL & INTELIGÊNCIA",
    items: [
      { name: "CRM & Fila de Desejo", href: "/crm", icon: Target, badge: "Smart" },
    ],
  },
  {
    title: "FINANCEIRO & GOVERNANÇA",
    items: [
      { name: "Caixa & Turnos", href: "/cash", icon: CircleDollarSign },
      { name: "Financeiro & DRE", href: "/financial", icon: TrendingUp },
      { name: "Sócios & Capital", href: "/partners", icon: Building2 },
    ],
  },
];

export default function RootShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentBranch, setCurrentBranch] = useState("Matriz Principal (SP)");
  const [isCashOpen, setIsCashOpen] = useState(true);

  return (
    <div className="min-h-screen bg-[#f1f5f9] text-[#0f172a] flex flex-col md:flex-row font-sans">
      {/* Mobile Top Header */}
      <header className="md:hidden flex items-center justify-between p-3.5 bg-[#090e1a] text-white border-b border-[#1e293b] sticky top-0 z-50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-purple-800 flex items-center justify-center font-bold text-white shadow-md shadow-purple-900/30">
            HB
          </div>
          <div>
            <span className="font-bold tracking-tight text-base text-white">HBVisionX</span>
            <span className="text-[10px] text-purple-400 font-semibold block uppercase tracking-wider">Enterprise ERP</span>
          </div>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-lg text-slate-300 hover:bg-[#1e293b]"
          aria-label="Menu"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </header>

      {/* Sidebar HBVisionX Style */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-40 w-64 bg-[#090e1a] text-slate-300 border-r border-[#1a2236] flex flex-col transition-transform duration-300 ease-in-out md:static md:translate-x-0 dark-scrollbar overflow-y-auto
          ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Brand Header */}
        <div className="p-4 border-b border-[#161f33] hidden md:flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 flex items-center justify-center font-extrabold text-white text-base shadow-lg shadow-purple-600/25">
              HB
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold tracking-tight text-white text-base">HBVisionX</span>
                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30">
                  ERP
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium">Enterprise Retaguarda</p>
            </div>
          </div>
        </div>

        {/* Branch / Filial Switcher */}
        <div className="p-3 mx-3 mt-3 rounded-xl bg-[#0f172a] border border-[#1e293b]">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
            <span>Filial de Operação</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-white">
            <Store className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
            <select
              value={currentBranch}
              onChange={(e) => setCurrentBranch(e.target.value)}
              className="bg-transparent text-xs text-white font-medium focus:outline-none cursor-pointer w-full"
            >
              <option value="Matriz Principal (SP)" className="bg-[#0f172a] text-white">Matriz Principal (SP)</option>
              <option value="Filial Loja 02 (Moema)" className="bg-[#0f172a] text-white">Filial Loja 02 (Moema)</option>
            </select>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
          {navSections.map((section) => (
            <div key={section.title} className="space-y-1">
              <h3 className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {section.title}
              </h3>
              <div className="space-y-0.5 pt-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all group relative ${
                        isActive
                          ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-md shadow-purple-600/30"
                          : "text-slate-300 hover:bg-[#131c31] hover:text-white"
                      }`}
                    >
                      {isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-5 bg-white rounded-r-full shadow-sm"></span>
                      )}
                      <Icon
                        className={`w-4 h-4 transition-colors ${
                          isActive ? "text-white" : "text-slate-400 group-hover:text-purple-400"
                        }`}
                      />
                      <span className="flex-1 truncate">{item.name}</span>
                      {item.badge && (
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                            isActive
                              ? "bg-white/20 text-white"
                              : "bg-[#1e293b] text-purple-300 border border-purple-500/20"
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* CTA Upgrade / Assistência Banner estilo HBVision */}
        <div className="p-3 m-3 rounded-xl bg-gradient-to-br from-violet-950/60 to-purple-900/40 border border-purple-500/30 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-white">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span>HBVisionX v2.4</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-tight">
            Motor de matching e estoque serializado sincronizados.
          </p>
          <button className="w-full py-1.5 px-3 bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 text-white text-[11px] font-bold rounded-lg shadow-sm transition-all flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            Auditoria Ativa
          </button>
        </div>

        {/* User Session Footer */}
        <div className="p-3 border-t border-[#161f33] bg-[#070b14] flex items-center justify-between">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-600 to-purple-700 text-white font-bold flex items-center justify-center text-xs shadow-md">
              H
            </div>
            <div className="truncate">
              <p className="text-xs font-bold text-white truncate">Henrique Barreto</p>
              <p className="text-[10px] text-slate-400 truncate">Operador Master • Admin</p>
            </div>
          </div>
          <button
            title="Encerrar Sessão"
            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-[#131c31] rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#f8fafc]">
        {/* Top Navbar HBVisionX Style */}
        <header className="h-14 bg-white border-b border-slate-200 px-6 hidden md:flex items-center justify-between sticky top-0 z-30 shadow-xs">
          {/* Breadcrumb & Context */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
              <span className="font-bold text-slate-900">Boa tarde, Henrique</span>
              <span className="text-slate-300">•</span>
              <span>Sex, 16 de Nov • 21:50</span>
            </div>

            {/* Status do Caixa Pill */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
              <span>Caixa Aberto (Turno 01)</span>
            </div>
          </div>

          {/* Quick Search & Actions */}
          <div className="flex items-center gap-3">
            <div className="relative w-72">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar clientes, IMEI, peças ou OS..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 text-slate-800 transition-all"
              />
            </div>

            <div className="h-4 w-px bg-slate-200"></div>

            <button className="p-2 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 relative transition-colors">
              <Bell className="w-4 h-4" />
              <span className="w-2 h-2 rounded-full bg-purple-600 absolute top-1.5 right-1.5 ring-2 ring-white" />
            </button>

            {/* User Dropdown Preview */}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <div className="w-7 h-7 rounded-full bg-slate-900 text-white font-bold flex items-center justify-center text-xs">
                H
              </div>
              <div className="text-left text-xs leading-none">
                <span className="font-bold block text-slate-800">Henrique</span>
                <span className="text-[10px] text-slate-500">Diretoria</span>
              </div>
            </div>
          </div>
        </header>

        {/* Page Container */}
        <main className="flex-1 p-4 md:p-6 lg:p-7 max-w-7xl w-full mx-auto space-y-6">
          {children}
        </main>
      </div>

      {/* Backdrop for mobile */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-30 md:hidden"
        />
      )}
    </div>
  );
}
