import React, { useState } from 'react';
import {
  Database,
  Download,
  Upload,
  RotateCcw,
  HardDrive,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  FileCode,
  FileSpreadsheet,
  Layers,
  Save,
  Cloud,
  RefreshCw,
} from 'lucide-react';
import saveAs from 'file-saver';
import { DatabaseStats } from '../types';
import {
  exportFullDatabaseJson,
  importDatabaseJson,
  resetDatabaseToDefaults,
  forceCloudSyncNow,
  CloudSyncState,
} from '../services/storageService';

interface DatabaseSettingsProps {
  stats?: DatabaseStats;
  syncState?: CloudSyncState;
  onDatabaseReload: () => void;
}

export const DatabaseSettings: React.FC<DatabaseSettingsProps> = ({
  stats = {
    totalClients: 0,
    totalTemplates: 0,
    totalGeneratedDocs: 0,
    storageUsageEstimateKb: 0,
  },
  syncState,
  onDatabaseReload,
}) => {
  const [isForceSyncing, setIsForceSyncing] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const handleForceSync = async () => {
    setIsForceSyncing(true);
    try {
      const res = await forceCloudSyncNow();
      if (res.success) {
        setFeedbackMessage({ type: 'success', text: res.message });
        onDatabaseReload();
      } else {
        setFeedbackMessage({ type: 'error', text: res.message });
      }
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message });
    } finally {
      setIsForceSyncing(false);
    }
  };

  const handleExportBackup = () => {
    try {
      const json = exportFullDatabaseJson();
      const blob = new Blob([json], { type: 'application/json' });
      const dateStr = new Date().toISOString().split('T')[0];
      saveAs(blob, `Legal_Backup_Completo_${dateStr}.json`);
      setFeedbackMessage({
        type: 'success',
        text: '¡Copia de seguridad descargada exitosamente en formato JSON!',
      });
      onDatabaseReload();
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: `Error al exportar respaldo: ${err.message}`,
      });
    }
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        const res = importDatabaseJson(text);
        if (res.success) {
          setFeedbackMessage({ type: 'success', text: res.message });
          onDatabaseReload();
        } else {
          setFeedbackMessage({ type: 'error', text: res.message });
        }
      }
    };
    reader.readAsText(file);
  };

  const handleReset = () => {
    if (
      confirm(
        '¿Deseas reiniciar la base de datos a un estado completamente limpio? (Se limpiarán los clientes, plantillas y registros generados en este navegador)'
      )
    ) {
      resetDatabaseToDefaults();
      onDatabaseReload();
      setFeedbackMessage({
        type: 'success',
        text: 'La base de datos se ha reiniciado y limpiado con éxito.',
      });
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Card */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-3 rounded-xl bg-amber-50 text-amber-600 border border-amber-200/60">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-serif font-bold text-slate-900 text-xl">
              Almacenamiento y Base de Datos
            </h3>
            <p className="text-xs text-slate-500">
              Persistencia local de alto rendimiento activa para SQP PARA LEGAL. Firebase ha sido desvinculado; listo para integrar tu nueva base de datos.
            </p>
          </div>
        </div>

        {/* Database Status Banner */}
        <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 text-white border border-slate-700/80 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs sm:text-sm text-slate-100">
                  Base de Datos Firebase Desvinculada
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Listo para Nueva BD
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Tus plantillas, clientes e historial se mantienen seguros en almacenamiento local. Puedes conectar tu nueva base de datos (PostgreSQL, Supabase, Cloud SQL, etc.) cuando lo desees.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleForceSync}
            disabled={isForceSyncing}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-sm transition-all active:scale-95 disabled:opacity-50 shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isForceSyncing ? 'animate-spin' : ''}`} />
            <span>{isForceSyncing ? 'Verificando...' : 'Verificar Almacenamiento'}</span>
          </button>
        </div>

        {/* Feedback alert */}
        {feedbackMessage && (
          <div
            className={`mt-4 p-4 rounded-xl flex items-center gap-3 text-xs font-semibold ${
              feedbackMessage.type === 'success'
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                : 'bg-red-50 border border-red-200 text-red-700'
            }`}
          >
            {feedbackMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
            )}
            <span>{feedbackMessage.text}</span>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
              Clientes en Base
            </span>
            <span className="font-serif font-bold text-2xl text-slate-900">
              {stats.totalClients}
            </span>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
              Plantillas Word
            </span>
            <span className="font-serif font-bold text-2xl text-slate-900">
              {stats.totalTemplates}
            </span>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
              Docs Generados
            </span>
            <span className="font-serif font-bold text-2xl text-slate-900">
              {stats.totalGeneratedDocs}
            </span>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
              Espacio Ocupado
            </span>
            <span className="font-mono font-bold text-2xl text-amber-700">
              {stats.storageUsageEstimateKb} KB
            </span>
          </div>
        </div>
      </div>

      {/* Backup & Restore Operations */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Export Backup Card */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center mb-3 border border-blue-200">
              <Download className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-slate-900 text-sm mb-1">
              Exportar Copia de Seguridad
            </h4>
            <p className="text-xs text-slate-500 leading-relaxed mb-4">
              Descarga un archivo JSON consolidado con todos tus clientes, plantillas e historial para archivar o migrar.
            </p>
          </div>

          <button
            id="btn-export-backup-json"
            onClick={handleExportBackup}
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition-colors shadow-sm"
          >
            <Download className="w-4 h-4 text-amber-400" />
            <span>Descargar Respaldo JSON</span>
          </button>
        </div>

        {/* Import Backup Card */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center mb-3 border border-amber-200">
              <Upload className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-slate-900 text-sm mb-1">
              Restaurar Copia de Seguridad
            </h4>
            <p className="text-xs text-slate-500 leading-relaxed mb-4">
              Carga un archivo de respaldo JSON previo para restaurar clientes y documentos en este navegador.
            </p>
          </div>

          <label
            htmlFor="backup-file-input"
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer transition-colors shadow-sm"
          >
            <Upload className="w-4 h-4" />
            <span>Cargar Archivo JSON</span>
            <input
              id="backup-file-input"
              type="file"
              accept=".json,application/json"
              onChange={handleImportBackup}
              className="hidden"
            />
          </label>
        </div>

        {/* Standalone HTML File Card */}
        <div className="bg-amber-50/70 rounded-2xl p-6 border border-amber-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center mb-3 border border-amber-300">
              <FileCode className="w-5 h-5 text-amber-700" />
            </div>
            <h4 className="font-bold text-slate-900 text-sm mb-1">
              Descargar App en Archivo HTML
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              Obtén toda la aplicación encapsulada en el archivo <code className="font-mono font-bold text-amber-900">sqp-para-legal.html</code> para abrirla con doble clic en cualquier equipo sin conexión a internet ni servidor.
            </p>
          </div>

          <a
            href="/sqp-para-legal.html"
            download="sqp-para-legal.html"
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs transition-colors shadow-sm"
          >
            <Download className="w-4 h-4 text-slate-950" />
            <span>Descargar sqp-para-legal.html</span>
          </a>
        </div>
      </div>

      {/* Reset Section */}
      <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
            Preparar para Producción / Limpieza de Datos
          </h4>
          <p className="text-xs text-slate-500 mt-0.5">
            Deja la base de datos totalmente limpia (0 clientes, 0 documentos y plantillas oficiales en blanco listas para usar).
          </p>
        </div>

        <button
          id="btn-clean-database"
          onClick={handleReset}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-colors shrink-0 shadow-xs"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Limpiar Todos los Datos (0 Clientes)</span>
        </button>
      </div>
    </div>
  );
};
