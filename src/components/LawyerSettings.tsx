import { useUnsavedChanges } from "../hooks/useUnsavedChanges";
import React, { useEffect, useState } from "react";
import type { Idoneo } from "../types";
import { supabase } from "../services/supabaseClient";
import { forceCloudSyncNow } from "../services/storageService";
export function LawyerSettings() {
  const [members, setMembers] = useState<Idoneo[]>([]),
    [editing, setEditing] = useState<Idoneo | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  useUnsavedChanges(editing !== null);
  const load = async () => {
    const { data, error } = await supabase.rpc("pl_list_lawyers");
    if (error) throw error;
    setMembers(data || []);
  };
  useEffect(() => {
    void load().catch((error) => setMessage(error.message));
  }, []);
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const { error } = await supabase.rpc("pl_save_lawyer", {
        document: editing,
        expected_revision: editing.revision ?? null,
      });
      if (error) throw error;
      await load();
      await forceCloudSyncNow();
      setEditing(null);
      setMessage(
        "Datos del letrado actualizados. Los documentos archivados conservan su contenido.",
      );
    } catch (error: any) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  };
  const add = () =>
    setEditing({
      id: crypto.randomUUID(),
      name: "",
      formalTitle: "",
      gender: "M",
      role: "Abogado Idóneo",
      colegiado: "",
      cedula: "",
      idoneidad: "",
      email: "",
      phone: "",
      initials: "",
      color: "amber",
      badgeBg: "bg-amber-50 text-amber-800 border-amber-200",
      badgeText: "text-amber-700",
      description: "",
    });
  return (
    <section className="border rounded-xl p-4 space-y-3">
      <h3 className="font-bold">Letrados e idoneidades</h3>
      <p className="text-sm">
        Revisa las credenciales antes de guardar. Los cambios se usarán en
        nuevos documentos.
      </p>
      {message && <p role="status">{message}</p>}
      <button className="border rounded p-2" disabled={busy} onClick={add}>
        Añadir letrado
      </button>
      <ul>
        {members.map((member) => (
          <li key={member.id} className="flex justify-between py-2">
            <span>
              {member.name} · {member.idoneidad}
            </span>
            <button
              className="underline"
              disabled={busy}
              onClick={() => setEditing({ ...member })}
            >
              Editar
            </button>
          </li>
        ))}
      </ul>
      {editing && (
        <form onSubmit={save} className="grid sm:grid-cols-2 gap-3">
          {(
            [
              "name",
              "formalTitle",
              "cedula",
              "idoneidad",
              "colegiado",
              "email",
              "phone",
              "role",
            ] as const
          ).map((field) => (
            <label key={field}>
              {
                {
                  name: "Nombre",
                  formalTitle: "Nombre formal y título",
                  cedula: "Cédula",
                  idoneidad: "Idoneidad",
                  colegiado: "Credenciales visibles",
                  email: "Correo",
                  phone: "Teléfono",
                  role: "Cargo",
                }[field]
              }
              <input
                className="border rounded p-2 w-full"
                required={field === "name" || field === "formalTitle"}
                value={editing[field] || ""}
                maxLength={200}
                onChange={(event) =>
                  setEditing({ ...editing, [field]: event.target.value })
                }
              />
            </label>
          ))}
          <button disabled={busy} className="border rounded p-2">
            Guardar letrado
          </button>
          <button
            disabled={busy}
            type="button"
            onClick={() => setEditing(null)}
          >
            Cancelar
          </button>
        </form>
      )}
    </section>
  );
}
