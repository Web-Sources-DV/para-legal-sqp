import { RecoveryPanel } from "./RecoveryPanel";
import React, { useState } from "react";
import saveAs from "file-saver";
import { DatabaseStats } from "../types";
import {
  CloudSyncState,
  exportFullDatabaseJson,
  importDatabaseJson,
  resetDatabaseToDefaults,
  forceCloudSyncNow,
  downloadLegacyHtml,
  replaceLegacyHtml,
} from "../services/storageService";

interface Props {
  canEdit?: boolean;
  stats?: DatabaseStats;
  syncState?: CloudSyncState;
  onDatabaseReload: () => void;
}
export function DatabaseSettings({
  canEdit = false,
  stats,
  syncState,
  onDatabaseReload,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const run = async (action: () => Promise<void> | void) => {
    setBusy(true);
    setMessage("");
    try {
      await action();
      onDatabaseReload();
    } catch (e: any) {
      setMessage(e.message || "No se pudo completar la operación.");
    } finally {
      setBusy(false);
    }
  };
  const restore = async (text: string) => {
    if (!canEdit) return;
    if (
      !confirm(
        "Este respaldo reemplazará los clientes, plantillas e historial compartidos. Descarga primero un respaldo actual. ¿Continuar?",
      )
    )
      return;
    const result = await importDatabaseJson(text);
    if (!result.success) throw new Error(result.message);
    setMessage(result.message);
  };
  return (
    <section className="max-w-4xl mx-auto space-y-5">
      <div className="bg-white rounded-2xl border p-6">
        <h2 className="text-xl font-bold">Base de datos</h2>
        <p className="text-sm text-slate-600 mt-2">
          Datos compartidos entre dispositivos con permisos por usuario.
        </p>
        <p className="text-xs text-slate-500">
          Los respaldos JSON contienen datos personales y documentos. Guárdalos
          en una ubicación privada con acceso restringido.
        </p>
        {!canEdit && (
          <p className="mt-3 bg-amber-50 rounded-lg p-3 text-sm">
            Acceso de consulta. Solo Daryl Villa puede restaurar, modificar o
            eliminar estos datos.
          </p>
        )}
        <div className="grid grid-cols-3 gap-3 my-5">
          {[
            ["Clientes", stats?.totalClients || 0],
            ["Plantillas", stats?.totalTemplates || 0],
            ["Documentos", stats?.totalGeneratedDocs || 0],
          ].map(([label, total]) => (
            <div key={label} className="rounded-xl bg-slate-50 p-4">
              <strong className="text-2xl block">{total}</strong>
              <span className="text-sm">{label}</span>
            </div>
          ))}
        </div>
        <p className="text-sm">
          Estado: {syncState?.isConnected ? "Conectada" : "Sin conexión"} ·
          Última actualización: {syncState?.lastSyncTime || "Pendiente"}
        </p>
        <button
          disabled={busy}
          className="border rounded-lg px-3 py-2 mt-4"
          onClick={() =>
            void run(async () => {
              const result = await forceCloudSyncNow();
              setMessage(result.message);
            })
          }
        >
          Actualizar consulta
        </button>
      </div>
      {canEdit && (
        <div className="bg-white rounded-2xl border p-6 space-y-4">
          <h3 className="font-bold">Administración de datos · Daryl Villa</h3>
          <button
            disabled={busy}
            className="border rounded-lg p-3"
            id="btn-export-backup-json"
            onClick={() =>
              void run(async () => {
                saveAs(
                  new Blob([await exportFullDatabaseJson()], {
                    type: "application/json",
                  }),
                  "ParaLegal-respaldo-" +
                    new Date().toISOString().slice(0, 10) +
                    ".json",
                );
                setMessage("Respaldo descargado.");
              })
            }
          >
            Descargar respaldo completo
          </button>
          <label className="block">
            Restaurar respaldo JSON
            <input
              disabled={busy}
              type="file"
              accept=".json,application/json"
              className="block mt-2"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file)
                  void run(async () => {
                    if (file.size > 30 * 1024 * 1024)
                      throw new Error("El respaldo supera 30 MB.");
                    await restore(await file.text());
                  });
              }}
            />
          </label>
          <button
            disabled={busy}
            className="border rounded-lg p-3"
            onClick={() =>
              void run(async () => {
                const keys = {
                  clients: "sqp_clients_v2",
                  templates: "sqp_templates_v2",
                  documents: "sqp_generated_docs_v2",
                };
                const backup = Object.fromEntries(
                  Object.entries(keys).map(([field, key]) => [
                    field,
                    JSON.parse(localStorage.getItem(key) || "[]"),
                  ]),
                );
                if (
                  !backup.clients.length &&
                  !backup.templates.length &&
                  !backup.documents.length
                )
                  throw new Error(
                    "No hay datos antiguos en este navegador. Abre este panel desde el navegador donde usabas la app.",
                  );
                saveAs(
                  new Blob([JSON.stringify(backup)], {
                    type: "application/json",
                  }),
                  "ParaLegal-datos-locales-antes-de-migrar.json",
                );
                await restore(JSON.stringify(backup));
              })
            }
          >
            Migrar datos del navegador anterior
          </button>
          <p className="text-xs text-slate-500">
            La migración descarga un respaldo local y solicita confirmación
            antes de reemplazar los datos compartidos. No copia usuarios ni
            inventa estadísticas históricas.
          </p>
          <button
            disabled={busy}
            className="border border-red-300 text-red-700 rounded-lg p-3"
            onClick={() => {
              if (
                confirm(
                  "¿Vaciar clientes, plantillas e historial compartidos? Conserva un respaldo antes. Las cuentas y estadísticas permanecerán.",
                )
              )
                void run(async () => {
                  await resetDatabaseToDefaults();
                  setMessage("Datos vaciados.");
                });
            }}
          >
            Vaciar datos compartidos
          </button>
        </div>
      )}
      <div className="bg-white rounded-2xl border p-6 space-y-3">
        <h3 className="font-bold">Versión HTML anterior</h3>
        <p className="text-sm text-slate-600">
          Aplicación antigua independiente. Una copia descargada no incorpora
          las cuentas ni permisos de esta versión.
        </p>
        <button
          disabled={busy}
          className="border rounded-lg p-3"
          onClick={() =>
            void run(async () => {
              saveAs(
                new Blob([await downloadLegacyHtml()], { type: "text/html" }),
                "sqp-para-legal.html",
              );
            })
          }
        >
          Descargar versión anterior
        </button>
        {canEdit && (
          <label className="block text-sm">
            Reemplazar archivo HTML anterior
            <input
              disabled={busy}
              type="file"
              accept=".html,text/html"
              className="block mt-2"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (
                  file &&
                  confirm(
                    "¿Reemplazar el archivo anterior disponible para administradores?",
                  )
                )
                  void run(async () => {
                    await replaceLegacyHtml(await file.text());
                    setMessage("Archivo anterior actualizado.");
                  });
              }}
            />
          </label>
        )}
      </div>
      {canEdit && <RecoveryPanel />}
      {message && (
        <p
          role="status"
          className="bg-amber-50 text-amber-900 border rounded-lg p-4"
        >
          {message}
        </p>
      )}
    </section>
  );
}
