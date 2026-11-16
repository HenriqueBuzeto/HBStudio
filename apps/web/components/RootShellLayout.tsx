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
  ChevronRight,
  LogOut,
  Bell,
  Search,
  Sparkles,
  TrendingUp,
  Receipt,
  ShieldCheck,
  Moon,
  Clock,
  ArrowRightLeft
} from "lucide-react";

interface NavSection {
  title: string;
  items: {
    name: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
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

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#f8fafc] text-[#0f172a] flex flex-col md:flex-row font-sans">
      {/* Mobile Top Header */}
      <header className="md:hidden flex items-center justify-between p-3.5 bg-[#090e1a] text-white border-b border-[#1e293b] flex-shrink-0 z-50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-purple-800 flex items-center justify-center font-bold text-white shadow-md shadow-purple-900/30">
            HB
          </div>
          <div>
            <span className="font-bold tracking-tight text-base text-white">HB Studio</span>
            <span className="text-[10px] text-purple-400 font-semibold block uppercase tracking-wider">Sistema de Gestão</span>
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

      {/* Sidebar FIXA HB Studio Style */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-40 w-64 bg-[#090e1a] text-slate-300 border-r border-[#1a2236] flex flex-col transition-transform duration-300 ease-in-out
          md:static md:translate-x-0 md:h-screen md:flex-shrink-0
          ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Brand Header */}
        <div className="p-4 border-b border-[#161f33] hidden md:flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 flex items-center justify-center font-extrabold text-white text-base shadow-lg shadow-purple-600/25">
              HB
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold tracking-tight text-white text-base">HB Studio</span>
                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30">
                  ERP
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium">Gestão & Inteligência</p>
            </div>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto dark-scrollbar">
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

          {/* CTA Banner */}
          <div className="p-3 rounded-xl bg-gradient-to-br from-violet-950/60 to-purple-900/40 border border-purple-500/30 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-white">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span>HB Studio v2.4</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-tight">
              Motor de matching e estoque serializado sincronizados.
            </p>
            <button className="w-full py-1.5 px-3 bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 text-white text-[11px] font-bold rounded-lg shadow-sm transition-all flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              Auditoria Ativa
            </button>
          </div>
        </nav>

        {/* User Session Footer */}
        <div className="p-3 border-t border-[#161f33] bg-[#070b14] flex items-center justify-between flex-shrink-0">
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
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-[#f8fafc]">
        {/* Top Navbar IDÊNTICO AO DESIGN SYSTEM HBVISIONX */}
        <header className="h-16 bg-white border-b border-slate-200/90 px-6 hidden md:flex items-center justify-between flex-shrink-0 z-30 shadow-xs">
          {/* Lado Esquerdo: Saudação, Data e Status do Caixa */}
          <div className="flex items-center gap-4">
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-sm font-extrabold text-slate-900 tracking-tight">
                  Boa tarde, Henrique
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-xs font-medium text-slate-500">
                  Sex, 16 de Nov
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  22:00
                </span>
              </div>
              <span className="text-[11px] text-slate-400">
                Painel Geral de Controle e Retaguarda
              </span>
            </div>

            <div className="h-7 w-px bg-slate-200"></div>

            {/* Status do Caixa Pill - Estilo Original HBVisionX */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/90 text-xs font-bold shadow-xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>Caixa Aberto (Turno 01)</span>
            </div>
          </div>

          {/* Centro: Barra de Busca Centralizada com Design Clean */}
          <div className="flex-1 max-w-md mx-6">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar páginas, menus, clientes, IMEI ou OS..."
                className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50/80 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-full focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 text-slate-800 transition-all placeholder:text-slate-400 shadow-inner/10"
              />
            </div>
          </div>

          {/* Lado Direito: Notificações, Tema & Perfil com Badge de Cargo */}
          <div className="flex items-center gap-3.5">
            {/* Botão de Notificação */}
            <button
              title="Notificações"
              className="p-2 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-100 relative transition-colors border border-transparent hover:border-slate-200"
            >
              <Bell className="w-4 h-4" />
              <span className="w-2 h-2 rounded-full bg-purple-600 absolute top-1.5 right-1.5 ring-2 ring-white" />
            </button>

            <div className="h-6 w-px bg-slate-200"></div>

            {/* Perfil Operador - Estilo HBVisionX */}
            <div className="flex items-center gap-3 pl-1">
              <div className="text-right leading-tight">
                <span className="text-xs font-extrabold text-slate-900 block tracking-tight">
                  Henrique Barreto
                </span>
                <span className="text-[10px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200/80 inline-block mt-0.5">
                  Operador PDV / Admin
                </span>
              </div>

              {/* Avatar com Badge Numérico estilo HBVision */}
              <div className="relative">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-900 to-slate-800 text-white font-extrabold flex items-center justify-center text-xs shadow-md border-2 border-white ring-1 ring-slate-200">
                  H
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white" title="Online"></span>
              </div>
            </div>
          </div>
        </header>

        {/* Page Container com Scroll Vertical Próprio */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-7 max-w-7xl w-full mx-auto space-y-6">
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
