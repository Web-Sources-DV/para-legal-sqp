import React from "react";
import { Sparkles } from "lucide-react";
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
  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-30 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between min-h-16 sm:min-h-20 gap-3 py-3">
          {/* Logo & Brand */}
          <div
            className="flex items-center gap-3.5 cursor-pointer group"
            onClick={() => setActiveTab("wizard")}
            title="Ir al Asistente de Inicio"
          >
            <div className="p-1 rounded-xl bg-slate-800/90 border border-slate-700/80 group-hover:border-teal-500/50 flex items-center justify-center shadow-md transition-all shrink-0">
              <AppLogo size={42} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-serif font-bold text-lg sm:text-xl tracking-tight text-slate-50 group-hover:text-teal-300 transition-colors">
                  SQP PARA LEGAL
                </span>
                <span className="text-[11px] bg-teal-500/20 text-teal-300 border border-teal-500/30 px-2 py-0.5 rounded-full font-sans font-semibold hidden sm:inline-block">
                  OCR y plantillas Word
                </span>
              </div>
              <p className="text-xs text-slate-400 font-sans tracking-wide">
                Gestión Documental Legal · Extracción OCR local & Plantillas
                Word
              </p>
            </div>
          </div>

          {/* Quick Action Button & Cloud Badge */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <button
              id="btn-quick-new-doc"
              onClick={onStartNewDocument}
              className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-teal-400 hover:from-teal-400 hover:to-teal-500 text-slate-950 font-bold text-xs sm:text-sm shadow-lg shadow-teal-500/25 transition-all active:scale-95 shrink-0"
            >
              <Sparkles className="w-4 h-4 text-slate-950" />
              <span>Nuevo Documento</span>
            </button>
          </div>
        </div>

        <nav
          aria-label="Navegación"
          className="flex items-center justify-between gap-3 border-t border-slate-800 py-2"
        >
          <button
            id="nav-tab-wizard"
            onClick={() => setActiveTab("wizard")}
            className="px-3 py-2 rounded-lg text-sm font-semibold text-teal-300 hover:bg-slate-800"
          >
            Documento
          </button>
          <details
            className="relative"
            onKeyDown={(event) => {
              if (event.key === "Escape")
                event.currentTarget.removeAttribute("open");
            }}
          >
            <summary className="cursor-pointer whitespace-nowrap px-3 py-2 rounded-lg text-sm font-semibold hover:bg-slate-800">
              Herramientas
            </summary>
            <div className="absolute right-0 top-full mt-2 w-56 max-w-[85vw] p-2 rounded-xl border border-slate-700 bg-slate-900 shadow-xl z-40">
              {(
                [
                  ["clients", "Clientes"],
                  ["templates", "Plantillas"],
                  ["history", "Historial"],
                  ["manual", "Ayuda"],
                  ["generator", "Generador avanzado"],
                ] as [ActiveTab, string][]
              ).map(([tab, label]) => (
                <button
                  key={tab}
                  id={`nav-tab-${tab}`}
                  onClick={(event) => {
                    event.currentTarget
                      .closest("details")
                      ?.removeAttribute("open");
                    setActiveTab(tab);
                  }}
                  className={`block w-full px-3 py-2.5 rounded-lg text-left text-sm hover:bg-slate-800 ${activeTab === tab ? "text-teal-300" : "text-slate-200"}`}
                >
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
