"use client";

import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
import { readSidebarPosition, saveSidebarPosition, restoreSidebarPosition, sidebarStorageKey } from "@/lib/sidebar-scroll";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import NotificationBell from "./NotificationBell";
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
  Search,
  Sparkles,
  TrendingUp,
  Receipt,
  ShieldCheck,
  UserCheck,
  MessageSquare,
  Printer,
  Code2,
  Moon,
  Clock,
  ArrowRightLeft,
  Truck,
  FileText
} from "lucide-react";

interface NavSection {
  title: string;
  items: {
    name: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
    anyPermissions?: string[];
  }[];
}

const navSections: NavSection[] = [
  {
    title: "PRINCIPAL",
    items: [
      { name: "Visão Geral", href: "/", icon: LayoutDashboard },
      { name: "PDV Balcão", href: "/sales", icon: ShoppingCart, badge: "PDV" },
      { name: "Impressoras & Documentos", href: "/documents/printers", icon: Printer, anyPermissions: ["sales.pos.use","repairs.view"] },
    ],
  },
  {
    title: "OPERAÇÃO & PRODUTOS",
    items: [
      { name: "Clientes & Fornecedores", href: "/parties", icon: Users },
      { name: "Catálogo & Aparelhos", href: "/catalog", icon: Boxes },
      { name: "Estoque & Kardex", href: "/inventory", icon: Package },
      { name: "Compras & Entrada", href: "/procurement", icon: Receipt },
      { name: "Fiscal & NFC-e", href: "/fiscal", icon: FileText, badge: "Zeus" },
      { name: "Fretes & Frota", href: "/fretes", icon: Truck, badge: "Frota" },
      { name: "Assistência Técnica (OS)", href: "/repairs", icon: Wrench, badge: "OS" },
      { name: "Fábrica 3D & Custos", href: "/manufacturing", icon: Printer, badge: "3D" },
      { name: "Projetos Digitais & Dev", href: "/projects", icon: Code2, badge: "Dev" },
    ],
  },
  {
    title: "COMERCIAL & INTELIGÊNCIA",
    items: [
      { name: "CRM & Fila de Desejo", href: "/crm", icon: Target, badge: "Smart" },
      { name: "Mensageria & WhatsApp", href: "/messaging", icon: MessageSquare, badge: "Meta" },
    ],
  },
  {
    title: "FINANCEIRO & GOVERNANÇA",
    items: [
      { name: "Caixa & Turnos", href: "/cash", icon: CircleDollarSign },
      { name: "Financeiro & DRE", href: "/financial", icon: TrendingUp },
      { name: "Crédito / Débito & Pix", href: "/financial/acquirers", icon: Receipt,
        anyPermissions: ["finance.reports.view","finance.banks.manage"] },
      { name: "Sócios & Capital", href: "/partners", icon: Building2, anyPermissions: ["partners.view"] },
      { name: "Relatórios & Inteligência", href: "/reports", icon: FileText, anyPermissions: ["sales.pos.use","sales.cost.view","cash.shift.view","cash.movement.view","inventory.view","inventory.cost.view","purchases.view","purchases.cost.view","finance.reports.view","finance.payables.view","finance.receivables.view","finance.journal.view","finance.banks.manage","partners.view","manufacturing.view","manufacturing.costs.view","repairs.view","projects.view","fleet.view","fleet.reports.view","fleet.cost.view","crm.view","messaging.view","customers.view","suppliers.view","loyalty.view","fiscal.documents.view","audit.view"] },
      { name: "Usuários & Senhas", href: "/users", icon: UserCheck, badge: "Master" },
    ],
  },
];

export default function RootShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, isLoading, logout, hasPermission } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile,setIsMobile]=useState(false);
  useEffect(()=>{const media=window.matchMedia("(max-width: 767px)");const update=()=>setIsMobile(media.matches);update();media.addEventListener("change",update);return()=>media.removeEventListener("change",update);},[]);
  const navRef = useRef<HTMLElement>(null);
  const storageKey = user && isAuthenticated ? sidebarStorageKey(user.tenantId, user.id, user.branchId) : null;
  // Pages currently mount their own shell; restore before the new sidebar is painted.
  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav || !storageKey || isLoading) return;
    const saved = readSidebarPosition(storageKey);
    if (saved !== null) {
      restoreSidebarPosition(nav, saved);
    } else {
      // Direct entry into a deep route: reveal only the active item inside the menu.
      const active = nav.querySelector<HTMLElement>('[aria-current="page"]');
      if (active) {
        const bounds = nav.getBoundingClientRect(), item = active.getBoundingClientRect();
        if (item.bottom > bounds.bottom) restoreSidebarPosition(nav, nav.scrollTop + item.bottom - bounds.bottom + 12);
        else if (item.top < bounds.top) restoreSidebarPosition(nav, nav.scrollTop + item.top - bounds.top - 12);
      }
      saveSidebarPosition(storageKey, nav.scrollTop);
    }
  }, [storageKey, isLoading, pathname]);
  const rememberSidebar = () => {
    if (storageKey && navRef.current) saveSidebarPosition(storageKey, navRef.current.scrollTop);
  };

  useEffect(() => {
    // Redireciona para o login se a sessão não for confirmada
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#070b14] text-slate-400 font-medium text-xs">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-purple-600 border-t-transparent animate-spin" />
          <span>Verificando sessão segura...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={"h-screen w-screen overflow-hidden bg-[#f8fafc] text-[#0f172a] flex flex-col md:flex-row font-sans "+((pathname==="/reports"||pathname==="/partners")?"print:block print:h-auto print:w-auto print:overflow-visible print:bg-white":"")}>
      {/* Mobile Top Header */}
      <header className={"md:hidden flex items-center justify-between p-3.5 bg-[#090e1a] text-white border-b border-[#1e293b] flex-shrink-0 z-50 "+((pathname==="/reports"||pathname==="/partners")?"print:hidden":"")}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-purple-800 flex items-center justify-center font-bold text-white shadow-md shadow-purple-900/30">
            HB
          </div>
          <div>
            <span className="font-bold tracking-tight text-base text-white">HB Studio</span>
            <span className="text-[10px] text-purple-400 font-semibold block uppercase tracking-wider">Sistema de Gestão</span>
          </div>
        </div>
        <div className="flex items-center gap-2">{isMobile&&<NotificationBell mobile/>}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-lg text-slate-300 hover:bg-[#1e293b]"
          aria-label="Menu"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button></div>
      </header>

      {/* Sidebar FIXA HB Studio Style */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-40 w-72 bg-[#090e1a] text-slate-300 border-r border-[#1a2236] flex flex-col transition-transform duration-300 ease-in-out
          md:static md:translate-x-0 md:h-screen md:flex-shrink-0
          ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"} ${(pathname==="/reports"||pathname==="/partners")?"print:hidden":""}
        `}
      >
        {/* Brand Header */}
        <div className="p-5 border-b border-[#161f33] hidden md:flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 flex items-center justify-center font-extrabold text-white text-lg shadow-lg shadow-purple-600/30">
              HB
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold tracking-tight text-white text-lg">HB Studio</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  ERP
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">Gestão & Inteligência</p>
            </div>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav ref={navRef} onScroll={rememberSidebar} aria-label="Menu principal" className="flex-1 min-h-0 px-3.5 py-5 space-y-6 overflow-y-auto overscroll-y-contain dark-scrollbar">
          {navSections.map((section) => (
            <div key={section.title} className="space-y-1.5">
              <h3 className="px-3.5 text-xs font-bold uppercase tracking-wider text-slate-400">
                {section.title}
              </h3>
              <div className="space-y-1 pt-1">
                {section.items.map((item) => {
                  if(item.anyPermissions?.length && !item.anyPermissions.some(key=>hasPermission(key)))return null;
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      aria-current={isActive ? "page" : undefined}
                      scroll={false}
                      onClick={() => { rememberSidebar(); setMobileMenuOpen(false); }}
                      className={`flex items-center gap-3.5 px-3.5 py-3 rounded-2xl text-sm font-semibold transition-all group relative ${
                        isActive
                          ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg shadow-purple-600/35"
                          : "text-slate-300 hover:bg-[#131c31] hover:text-white"
                      }`}
                    >
                      {isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-2 h-7 bg-white rounded-r-full shadow-md"></span>
                      )}
                      <Icon
                        className={`w-5 h-5 transition-colors ${
                          isActive ? "text-white" : "text-slate-400 group-hover:text-purple-400"
                        }`}
                      />
                      <span className="flex-1 truncate text-sm font-semibold">{item.name}</span>
                      {item.badge && (
                        <span
                          className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
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

        {/* User Session Footer */}
        <div className="p-4 border-t border-[#161f33] bg-[#070b14] flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-600 to-purple-700 text-white font-extrabold flex items-center justify-center text-sm shadow-md">
              {user?.fullName?.charAt(0)?.toUpperCase() ?? "S"}
            </div>
            <div className="truncate">
              <p className="text-sm font-bold text-white truncate">{user?.fullName ?? "Sócio Autorizado"}</p>
              <p className="text-xs text-slate-400 truncate">{user?.jobTitle || "CEO"} • HB Studio</p>
            </div>
          </div>
          <button
            onClick={logout}
            title="Encerrar Sessão"
            className="p-2 text-slate-400 hover:text-rose-400 hover:bg-[#131c31] rounded-xl transition-colors cursor-pointer"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </aside>

      {/* Main Content Viewport com Fundo Quadriculado Sutil */}
      <div className={"flex-1 flex flex-col min-w-0 h-full overflow-hidden hb-grid-background "+((pathname==="/reports"||pathname==="/partners")?"print:block print:h-auto print:overflow-visible print:bg-none":"")}>
        {/* Top Navbar IDÊNTICO AO DESIGN SYSTEM HBVISIONX */}
        <header className={"h-16 bg-white border-b border-slate-200/90 px-6 hidden md:flex items-center justify-between flex-shrink-0 z-30 shadow-xs "+((pathname==="/reports"||pathname==="/partners")?"print:hidden":"")}>
          {/* Lado Esquerdo: Saudação, Data e Status do Caixa */}
          <div className="flex items-center gap-4">
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-sm font-extrabold text-slate-900 tracking-tight">
                  Olá, {user?.fullName?.split(" ")[0] ?? "Sócio"}
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-xs font-medium text-slate-500">
                  {new Date().toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })}
                </span>
              </div>
              <span className="text-[11px] text-slate-400">
                Painel Geral de Controle e Retaguarda
              </span>
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
            {!isMobile&&<NotificationBell/>}

            <div className="h-6 w-px bg-slate-200"></div>

            {/* Perfil Operador - Estilo HBVisionX */}
            <div className="flex items-center gap-3 pl-1">
              <div className="text-right leading-tight">
                <span className="text-xs font-extrabold text-slate-900 block tracking-tight">
                  {user?.fullName ?? "Sócio Autorizado"}
                </span>
                <span className="text-[10px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200/80 inline-block mt-0.5">
                  {user?.jobTitle || "CEO"}
                </span>
              </div>

              {/* Avatar com Badge Numérico estilo HBVision */}
              <div className="relative">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-900 to-slate-800 text-white font-extrabold flex items-center justify-center text-xs shadow-md border-2 border-white ring-1 ring-slate-200">
                  {user?.fullName?.charAt(0)?.toUpperCase() ?? "S"}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white" title="Online"></span>
              </div>
            </div>
          </div>
        </header>

        {/* Page Container com Scroll Vertical Próprio */}
        <main className={"flex-1 overflow-y-auto p-4 md:p-6 lg:p-7 w-full mx-auto space-y-6 "+(pathname==="/sales"?"max-w-[1600px] ":"max-w-7xl ")+((pathname==="/reports"||pathname==="/partners")?"print:overflow-visible print:max-w-none print:p-0":"")}>
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
