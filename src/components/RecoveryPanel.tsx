import React, { useEffect, useState } from "react";
import { supabase } from "../services/supabaseClient";
import { forceCloudSyncNow } from "../services/storageService";

interface BackupSummary {
  id: string;
  created_at: string;
  reason: string;
}
interface AuditEntry {
  id: number;
  actor: string;
  entity: string;
  entity_id: string;
  operation: string;
  created_at: string;
}
export function RecoveryPanel() {
  const [backups, setBackups] = useState<BackupSummary[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const load = async () => {
    const [saved, changes] = await Promise.all([
      supabase
        .from("pl_backups")
        .select("id,created_at,reason")
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("pl_audit")
        .select("id,actor,entity,entity_id,operation,created_at")
        .order("id", { ascending: false })
        .limit(50),
    ]);
    if (saved.error || changes.error) throw saved.error || changes.error;
    setBackups(saved.data || []);
    setAudit(changes.data || []);
  };
  useEffect(() => {
    void load().catch((error) => setMessage(error.message));
  }, []);
  const restore = async (id: string) => {
    if (
      busy ||
      !confirm(
        "¿Restaurar este respaldo del servidor? Se guardará automáticamente el estado actual antes de reemplazar los datos.",
      )
    )
      return;
    setBusy(true);
    setMessage("");
    try {
      const { error } = await supabase.rpc("pl_restore_saved_backup", {
        backup_id: id,
      });
      if (error) throw error;
      await forceCloudSyncNow();
      await load();
      setMessage(
        "Respaldo restaurado. El estado anterior también quedó respaldado.",
      );
    } catch (error: any) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  };
  const date = (value: string) =>
    new Date(value).toLocaleString("es-PA", { timeZone: "America/Panama" });
  return (
    <section className="bg-white rounded-2xl border p-6 space-y-4">
      <h3 className="font-bold">Recuperación y auditoría</h3>
      <p className="text-sm">
        Los respaldos previos a restauraciones conservan referencias a archivos
        privados. Exporta también una copia JSON independiente. La auditoría
        registra autor y operación, sin duplicar datos de identidad.
      </p>
      {message && <p role="status">{message}</p>}
      <button
        disabled={busy}
        className="border rounded p-2"
        onClick={() => void load().catch((error) => setMessage(error.message))}
      >
        Actualizar registros
      </button>
      <ul>
        {backups.map((backup) => (
          <li key={backup.id} className="flex justify-between gap-3 py-2">
            <span>
              {date(backup.created_at)} · {backup.reason}
            </span>
            <button
              disabled={busy}
              className="underline"
              onClick={() => void restore(backup.id)}
            >
              Restaurar
            </button>
          </li>
        ))}
      </ul>
      <details>
        <summary>Últimas 50 operaciones</summary>
        <div className="overflow-auto">
          <table className="text-xs w-full">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Autor</th>
                <th>Entidad</th>
                <th>Operación</th>
              </tr>
            </thead>
            <tbody>
              {audit.map((entry) => (
                <tr key={entry.id}>
                  <td>{date(entry.created_at)}</td>
                  <td>{entry.actor}</td>
                  <td>
                    {entry.entity} · {entry.entity_id}
                  </td>
                  <td>{entry.operation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
