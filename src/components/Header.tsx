import { GuidedTour } from "./GuidedTour";
import React, { useEffect, useRef } from "react";
import {
  Sparkles,
  Users,
  FileText,
  FolderOpen,
  BookOpen,
  FileCode2,
} from "lucide-react";
import { ActiveTab, DatabaseStats } from "../types";
import { CloudSyncState } from "../services/storageService";
import { AppLogo } from "./AppLogo";

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  stats?: DatabaseStats;
  syncState?: CloudSyncState;
  onStartNewDocument?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onStartNewDocument,
}) => {
  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const update = () => {
      if (menu.current) menu.current.open = desktop.matches;
    };
    update();
    desktop.addEventListener("change", update);
    return () => desktop.removeEventListener("change", update);
  }, []);
  return (
    <header className="workspace-header bg-slate-900 border-b border-gold-muted text-white sticky top-0 z-30 shadow-lg">
      <div className="header-inner max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="header-top flex flex-wrap items-center justify-between min-h-16 sm:min-h-20 gap-3 py-3">
          {/* Logo & Brand */}
          <div
            className="header-brand flex items-center gap-3.5 cursor-pointer group"
            onClick={() => setActiveTab("wizard")}
            title="Ir al Asistente de Inicio"
          >
            <div className="p-1 rounded-xl bg-slate-800/90 border border-gold-soft/70 group-hover:border-brand-500 flex items-center justify-center shadow-md transition-all shrink-0">
              <AppLogo size={42} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="header-title font-serif font-bold text-lg sm:text-xl tracking-tight text-slate-50 group-hover:text-brand-300 transition-colors">
                  SQP PARA LEGAL
                </span>
                <span className="header-badge text-[11px] bg-brand-500/20 text-brand-300 border border-brand-500/30 px-2 py-0.5 rounded-full font-sans font-semibold hidden sm:inline-block">
                  OCR y plantillas Word
                </span>
              </div>
              <p className="header-subtitle text-xs text-slate-400">
                Gestión documental legal
              </p>
              <p className="layout-mode">
                <span className="desktop-only">Escritorio organizado</span>
                <span className="mobile-only">Asistente enfocado</span>
              </p>
            </div>
          </div>

          {/* Quick Action Button & Cloud Badge */}
          <div className="header-actions flex flex-wrap items-center gap-2 sm:gap-3">
            <button
              id="btn-quick-new-doc"
              onClick={onStartNewDocument}
              className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-gradient-to-r from-brand-500 to-brand-400 hover:from-brand-400 hover:to-brand-500 text-slate-950 font-bold text-xs sm:text-sm shadow-lg shadow-brand-500/25 transition-all active:scale-95 shrink-0"
            >
              <Sparkles className="w-4 h-4 text-slate-950" />
              <span>Nuevo Documento</span>
            </button>
            <GuidedTour activeTab={activeTab} />
          </div>
        </div>

        <nav
          aria-label="Navegación"
          className="header-nav flex items-center justify-between gap-3 border-t border-slate-800 py-2"
        >
          <button
            id="nav-tab-wizard"
            aria-current={activeTab === "wizard" ? "page" : undefined}
            onClick={() => setActiveTab("wizard")}
            className="px-3 py-2 rounded-lg text-sm font-semibold text-brand-300 hover:bg-slate-800"
          >
            <span className="mobile-only">Documento</span>
            <span className="desktop-only">Crear documento</span>
          </button>
          <p
            data-tour="desktop-tools-label"
            className="desktop-only tools-heading"
          >
            Herramientas
          </p>
          <details
            ref={menu}
            data-tour="tools"
            className="relative"
            onKeyDown={(event) => {
              if (
                event.key === "Escape" &&
                !window.matchMedia("(min-width: 1024px)").matches
              )
                event.currentTarget.removeAttribute("open");
            }}
          >
            <summary className="cursor-pointer whitespace-nowrap px-3 py-2 rounded-lg text-sm font-semibold hover:bg-slate-800">
              Herramientas
            </summary>
            <div className="tools-list absolute right-0 top-full mt-2 w-56 max-w-[85vw] p-2 rounded-xl border border-slate-700 bg-slate-900 shadow-xl z-40">
              {(
                [
                  ["clients", "Clientes", Users],
                  ["templates", "Plantillas", FileText],
                  ["history", "Historial", FolderOpen],
                  ["manual", "Ayuda", BookOpen],
                  ["generator", "Generador avanzado", FileCode2],
                ] as [ActiveTab, string, typeof Users][]
              ).map(([tab, label, Icon]) => (
                <button
                  key={tab}
                  id={`nav-tab-${tab}`}
                  aria-current={activeTab === tab ? "page" : undefined}
                  onClick={(event) => {
                    if (!window.matchMedia("(min-width: 1024px)").matches)
                      event.currentTarget
                        .closest("details")
                        ?.removeAttribute("open");
                    setActiveTab(tab);
                  }}
                  className={`workspace-nav-item flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg text-left text-sm hover:bg-slate-800 ${activeTab === tab ? "text-brand-300" : "text-slate-200"}`}
                >
                  <Icon size={17} aria-hidden="true" />
                  {label}
                </button>
              ))}
            </div>
          </details>
        </nav>
      </div>
    </header>
  );
};
