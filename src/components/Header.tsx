import React from 'react';
import { Scale, FileText, Users, FolderOpen, Database, Sparkles, PlusCircle, LayoutDashboard, FileCode2, BookOpen, Cloud, RefreshCw, Download } from 'lucide-react';
import { ActiveTab, DatabaseStats } from '../types';
import { CloudSyncState } from '../services/storageService';
import { AppLogo } from './AppLogo';

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
  stats = {
    totalClients: 0,
    totalTemplates: 0,
    totalGeneratedDocs: 0,
    storageUsageEstimateKb: 0,
  },
  syncState,
  onStartNewDocument,
}) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-30 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20 gap-4">
          {/* Logo & Brand */}
          <div
            className="flex items-center gap-3.5 cursor-pointer group"
            onClick={() => setActiveTab('wizard')}
            title="Ir al Asistente de Inicio"
          >
            <div className="p-1 rounded-xl bg-slate-800/90 border border-slate-700/80 group-hover:border-amber-500/50 flex items-center justify-center shadow-md transition-all shrink-0">
              <AppLogo size={42} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-serif font-bold text-lg sm:text-xl tracking-tight text-slate-50 group-hover:text-amber-300 transition-colors">
                  SQP PARA LEGAL
                </span>
                <span className="text-[11px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-sans font-semibold hidden sm:inline-block">
                  OCR y plantillas Word
                </span>
              </div>
              <p className="text-xs text-slate-400 font-sans tracking-wide">
                Gestión Documental Legal · Extracción OCR / IA & Plantillas Word
              </p>
            </div>
          </div>

          {/* Quick Action Button & Cloud Badge */}
          <div className="flex items-center gap-3">
            {/* Database Status Indicator */}
            <div
              title="Almacenamiento local activo. Firebase desvinculado; listo para conectar tu nueva base de datos."
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/90 border border-slate-700/80 text-xs text-slate-300 shadow-sm"
            >
              <Database className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[11px] font-medium text-slate-200">
                BD Local (Listo para migrar)
              </span>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
            </div>

            <a
              href="./sqp-para-legal.html"
              download="sqp-para-legal.html"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/40 text-xs font-semibold shadow-sm transition-all"
              title="Descargar la versión HTML anterior; sus funciones son independientes de esta app"
            >
              <Download className="w-3.5 h-3.5 text-amber-400" />
              <span>Versión HTML anterior</span>
            </a>

            <button
              id="btn-quick-new-doc"
              onClick={onStartNewDocument}
              className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs sm:text-sm shadow-lg shadow-amber-500/25 transition-all active:scale-95 shrink-0"
            >
              <Sparkles className="w-4 h-4 text-slate-950" />
              <span>Nuevo Documento</span>
            </button>
          </div>
        </div>

        {/* Intuitive Navigation Tabs */}
        <div className="flex items-center space-x-1 sm:space-x-2 border-t border-slate-800/90 overflow-x-auto py-2.5 scrollbar-none">
          <button
            id="nav-tab-wizard"
            onClick={() => setActiveTab('wizard')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
              activeTab === 'wizard'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-bold'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Asistente Guiado (Paso a Paso)</span>
          </button>

          <button
            id="nav-tab-generator"
            onClick={() => setActiveTab('generator')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
              activeTab === 'generator'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-bold'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
            }`}
          >
            <FileCode2 className="w-4 h-4" />
            <span>Generador Directo</span>
          </button>

          <button
            id="nav-tab-clients"
            onClick={() => setActiveTab('clients')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === 'clients'
                ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Directorio de Clientes</span>
            <span className={`ml-1 text-[11px] px-2 py-0.5 rounded-full font-bold ${
              activeTab === 'clients' ? 'bg-slate-950 text-amber-400' : 'bg-slate-800 text-slate-300 border border-slate-700'
            }`}>
              {stats.totalClients}
            </span>
          </button>

          <button
            id="nav-tab-templates"
            onClick={() => setActiveTab('templates')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === 'templates'
                ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Plantillas Word (.docx)</span>
            <span className={`ml-1 text-[11px] px-2 py-0.5 rounded-full font-bold ${
              activeTab === 'templates' ? 'bg-slate-950 text-amber-400' : 'bg-slate-800 text-slate-300 border border-slate-700'
            }`}>
              {stats.totalTemplates}
            </span>
          </button>

          <button
            id="nav-tab-history"
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === 'history'
                ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
            }`}
          >
            <FolderOpen className="w-4 h-4" />
            <span>Historial Documentos</span>
            <span className={`ml-1 text-[11px] px-2 py-0.5 rounded-full font-bold ${
              activeTab === 'history' ? 'bg-slate-950 text-amber-400' : 'bg-slate-800 text-slate-300 border border-slate-700'
            }`}>
              {stats.totalGeneratedDocs}
            </span>
          </button>

          <button
            id="nav-tab-database"
            onClick={() => setActiveTab('database')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === 'database'
                ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>Base de Datos</span>
          </button>

          <button
            id="nav-tab-manual"
            onClick={() => setActiveTab('manual')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap border ${
              activeTab === 'manual'
                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md font-bold'
                : 'text-amber-300 bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/20 hover:text-amber-200'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Manual de Uso</span>
          </button>
        </div>
      </div>
    </header>
  );
};
