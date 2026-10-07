import { LawyerSettings } from "./LawyerSettings";
import React, { useEffect, useState } from "react";
import { AppUser } from "../services/accessPolicy";
import {
  createAppUser,
  listAppUsers,
  updateAppUser,
} from "../services/accountManagement";

export function UserManagement() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"user" | "admin">("user");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const reload = async () => setUsers(await listAppUsers());
  useEffect(() => {
    void reload().catch((e) => setMessage(e.message));
  }, []);
  const change = async (user: AppUser) => {
    setBusy(true);
    setMessage("");
    try {
      await updateAppUser(user);
      await reload();
      setMessage("Permisos actualizados.");
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="bg-white rounded-2xl border p-6 space-y-5">
      <LawyerSettings />
      <h2 className="text-xl font-bold">Gestión de usuarios</h2>
      <p className="text-sm text-slate-600">
        Los administradores consultan historial y base de datos. Solo Daryl
        Villa gestiona esos datos, los usuarios y las estadísticas.
      </p>
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setMessage("");
          try {
            const result = await createAppUser({
              email: email.trim(),
              displayName: displayName.trim(),
              password,
              role,
            });
            await reload();
            setPassword("");
            setEmail("");
            setDisplayName("");
            setMessage(
              result.existingAccount
                ? "Usuario habilitado. Su cuenta ya existía y conserva su contraseña anterior."
                : "Usuario habilitado. Entrega su contraseña por un canal privado.",
            );
          } catch (e: any) {
            setMessage(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Nombre
          <input
            className="border rounded-lg p-2 w-full"
            required
            maxLength={120}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </label>
        <label>
          Correo
          <input
            className="border rounded-lg p-2 w-full"
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Contraseña inicial
          <input
            className="border rounded-lg p-2 w-full"
            required
            minLength={12}
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <label>
          Permiso
          <select
            className="border rounded-lg p-2 w-full"
            value={role}
            onChange={(e) => setRole(e.target.value as "user" | "admin")}
          >
            <option value="user">Usuario</option>
            <option value="admin">Administrador de consulta</option>
          </select>
        </label>
        <button
          disabled={busy}
          className="bg-slate-900 text-white rounded-lg p-3 disabled:opacity-50"
        >
          Habilitar usuario
        </button>
      </form>
      <p role="status" className="text-sm text-amber-900">
        {message}
      </p>
      <ul className="divide-y">
        {users.map((user) => (
          <li
            key={user.id}
            className="py-4 flex flex-wrap items-center gap-4 justify-between"
          >
            <span className="font-semibold">
              {user.displayName}{" "}
              <span className="font-normal text-xs">
                {user.active ? "Activo" : "Desactivado"}
              </span>
            </span>
            {user.role === "owner" ? (
              <span>Acceso completo · Cuenta protegida</span>
            ) : (
              <div className="flex gap-3">
                <button
                  disabled={busy}
                  className="border rounded-lg px-3"
                  onClick={() => {
                    const name = prompt(
                      "Nombre del usuario:",
                      user.displayName,
                    );
                    if (name?.trim())
                      void change({ ...user, displayName: name.trim() });
                  }}
                >
                  Editar nombre
                </button>
                <select
                  aria-label={`Permiso de ${user.displayName}`}
                  disabled={busy}
                  className="border rounded-lg p-2"
                  value={user.role}
                  onChange={(e) =>
                    void change({
                      ...user,
                      role: e.target.value as "user" | "admin",
                    })
                  }
                >
                  <option value="user">Usuario</option>
                  <option value="admin">Administrador de consulta</option>
                </select>
                <button
                  disabled={busy}
                  className="border rounded-lg px-3"
                  onClick={() => void change({ ...user, active: !user.active })}
                >
                  {user.active ? "Desactivar" : "Activar"}
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
