"use client";

import React, { useState } from "react";
import { 
  Building2, 
  Store, 
  ShoppingCart, 
  Wrench, 
  Boxes, 
  Users, 
  CircleDollarSign, 
  Printer, 
  Code2, 
  ShieldCheck, 
  Menu, 
  X, 
  ChevronRight,
  LogOut,
  Bell
} from "lucide-react";

interface NavigationItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: string;
  badge?: string;
}

const navigation: NavigationItem[] = [
  { name: "Dashboard Executivo", href: "/dashboard", icon: Building2 },
  { name: "Clientes & Fornecedores", href: "/parties", icon: Users },
  { name: "Catálogo & Produtos", href: "/catalog", icon: Boxes },
  { name: "PDV & Vendas", href: "/sales", icon: ShoppingCart },
  { name: "Assistência Técnica (OS)", href: "/repairs", icon: Wrench },
  { name: "Estoque & Kardex", href: "/inventory", icon: Boxes },
  { name: "CRM & Interesses", href: "/crm", icon: Users },
  { name: "Financeiro & Sócios", href: "/finance", icon: CircleDollarSign },
  { name: "Fábrica 3D", href: "/manufacturing", icon: Printer },
  { name: "Projetos Digitais", href: "/projects", icon: Code2 },
  { name: "Administração & Acesso", href: "/admin", icon: ShieldCheck },
];

export default function RootShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentBranch, setCurrentBranch] = useState("Matriz Principal (SP)");

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col md:flex-row">
      {/* Mobile Top Header */}
      <header className="md:hidden flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <Store className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          <span className="font-bold tracking-tight text-lg">HB Enterprise ERP</span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label="Abrir menu"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </header>

      {/* Sidebar Navigation */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-40 w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col transition-transform duration-300 ease-in-out md:static md:translate-x-0
          ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 hidden md:flex items-center gap-2">
          <Store className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          <span className="font-bold tracking-tight text-lg">HB Enterprise ERP</span>
        </div>

        {/* Tenant & Filial Scope Selector */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
          <label className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 block mb-1">
            Filial Ativa
          </label>
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
            <Building2 className="w-4 h-4 text-slate-400" />
            <select
              value={currentBranch}
              onChange={(e) => setCurrentBranch(e.target.value)}
              className="bg-transparent border-0 text-sm font-medium focus:ring-0 cursor-pointer w-full"
            >
              <option value="Matriz Principal (SP)">Matriz Principal (SP)</option>
              <option value="Filial Loja 02">Filial Loja 02</option>
            </select>
          </div>
        </div>

        {/* Menu Items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <a
                key={item.name}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors group"
              >
                <Icon className="w-5 h-5 text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400" />
                <span className="flex-1">{item.name}</span>
                <ChevronRight className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
            );
          })}
        </nav>

        {/* User Session Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold flex items-center justify-center text-xs flex-shrink-0">
              AD
            </div>
            <div className="truncate">
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">Administrador</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">admin@hbtech.com.br</p>
            </div>
          </div>
          <button 
            title="Encerrar Sessão"
            className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors rounded-lg"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur px-6 hidden md:flex items-center justify-between sticky top-0 z-30">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <span>Enterprise System</span>
            <span>/</span>
            <span className="text-slate-800 dark:text-slate-200 font-semibold">Painel Geral</span>
          </div>
          <div className="flex items-center gap-4">
            <button className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 relative">
              <Bell className="w-4 h-4" />
              <span className="w-2 h-2 rounded-full bg-indigo-600 absolute top-1.5 right-1.5 ring-2 ring-white dark:ring-slate-900" />
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Backdrop for mobile */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-30 md:hidden"
        />
      )}
    </div>
  );
}
