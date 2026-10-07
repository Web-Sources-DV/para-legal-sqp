import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../services/supabaseClient";
import { AppUser } from "../services/accessPolicy";
import { readProfile, setActiveUser } from "../services/authService";

const AuthContext = createContext<AppUser | null>(null);
export const useAppUser = () => useContext(AuthContext)!;

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [factor, setFactor] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [recovery, setRecovery] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    let revision = 0;
    const load = async () => {
      const request = ++revision;
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error && data.user) throw error;
        if (data.user) {
          const { data: assurance, error: assuranceError } =
            await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
          if (assuranceError) throw assuranceError;
          if (
            assurance?.nextLevel === "aal2" &&
            assurance.currentLevel !== "aal2"
          ) {
            const { data: factors, error: factorError } =
              await supabase.auth.mfa.listFactors();
            if (factorError) throw factorError;
            const verified = factors.totp.find(
              (item) => item.status === "verified",
            );
            if (!verified)
              throw new Error(
                "La cuenta requiere un factor distinto de TOTP. Contacta al responsable para recuperar el acceso.",
              );
            if (active && request === revision) {
              setFactor(verified.id);
              setActiveUser(null);
              setUser(null);
              return;
            }
          }
        }
        if (active && request === revision) setFactor(null);
        const profile = data.user ? await readProfile(data.user.id) : null;
        if (!active || request !== revision) return;
        setActiveUser(profile);
        setUser(profile);
      } catch (error: any) {
        if (!active || request !== revision) return;
        setActiveUser(null);
        setUser(null);
        setMessage(error.message);
      } finally {
        if (active && request === revision) setLoading(false);
      }
    };
    void load();
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        revision++;
        if (active) {
          setActiveUser(null);
          setUser(null);
          setRecovery(false);
          setFactor(null);
          setMfaCode("");
          setPassword("");
          setNewPassword("");
          setMessage("");
          setLoading(false);
        }
        return;
      }
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      // Supabase auth callbacks must not await another auth request.
      setTimeout(() => {
        if (active) void load();
      }, 0);
    });
    const timer = window.setInterval(load, 20000);
    window.addEventListener("focus", load);
    return () => {
      active = false;
      revision++;
      data.subscription.unsubscribe();
      clearInterval(timer);
      window.removeEventListener("focus", load);
      setActiveUser(null);
    };
  }, []);

  const login = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      setPassword("");
    } catch {
      setMessage(
        "No se pudo iniciar sesión. Comprueba el correo y la contraseña.",
      );
    } finally {
      setBusy(false);
    }
  };
  const reset = async () => {
    if (!email.trim()) {
      setMessage("Escribe primero tu correo.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin + window.location.pathname,
    });
    setMessage(
      error
        ? error.message
        : "Si la cuenta existe, recibirás un enlace para cambiar la contraseña.",
    );
    setBusy(false);
  };
  if (loading)
    return (
      <div className="min-h-screen grid place-items-center">
        Verificando sesión…
      </div>
    );
  if (factor)
    return (
      <div className="min-h-screen grid place-items-center bg-slate-100 p-6">
        <form
          className="bg-white rounded-xl p-6 space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            if (busy) return;
            setBusy(true);
            try {
              const { error } = await supabase.auth.mfa.challengeAndVerify({
                factorId: factor,
                code: mfaCode,
              });
              if (error) throw error;
              setMfaCode("");
              setFactor(null);
            } catch (error: any) {
              setMessage(error.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <h1 className="font-bold">Verificación en dos pasos</h1>
          <label>
            Código del autenticador
            <input
              className="border rounded p-3 block"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              required
              value={mfaCode}
              onChange={(event) => setMfaCode(event.target.value)}
            />
          </label>
          <button
            disabled={busy}
            className="bg-slate-900 text-white rounded p-3"
          >
            Verificar
          </button>
          <button type="button" onClick={() => void supabase.auth.signOut()}>
            Cerrar sesión
          </button>
          <p role="status">{message}</p>
        </form>
      </div>
    );
  if (recovery)
    return (
      <div className="min-h-screen bg-slate-100 grid place-items-center p-6">
        <form
          className="bg-white rounded-2xl p-8 space-y-4 max-w-md w-full"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const { error } = await supabase.auth.updateUser({
              password: newPassword,
            });
            if (error) setMessage(error.message);
            else {
              setRecovery(false);
              setNewPassword("");
              setMessage("Contraseña actualizada.");
            }
            setBusy(false);
          }}
        >
          <h1 className="font-bold text-xl">Nueva contraseña</h1>
          <input
            className="border rounded-lg p-3 w-full"
            aria-label="Nueva contraseña"
            type="password"
            minLength={12}
            required
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <button
            disabled={busy}
            className="bg-slate-900 text-white rounded-lg p-3 w-full"
          >
            Guardar contraseña
          </button>
          <p role="status">{message}</p>
        </form>
      </div>
    );
  if (user)
    return (
      <AuthContext.Provider value={user}>
        <React.Fragment key={user.id}>{children}</React.Fragment>
      </AuthContext.Provider>
    );
  return (
    <div className="min-h-screen bg-slate-100 grid place-items-center p-6">
      <form
        onSubmit={login}
        className="bg-white border rounded-2xl p-8 max-w-md w-full space-y-4 shadow-sm"
      >
        <h1 className="text-2xl font-serif font-bold">SQP PARA LEGAL</h1>
        <p className="text-sm text-slate-600">
          Accede con una cuenta habilitada por Daryl Villa.
        </p>
        <label className="block">
          Correo
          <input
            className="border rounded-lg p-3 w-full mt-1"
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="block">
          Contraseña
          <input
            className="border rounded-lg p-3 w-full mt-1"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <button
          disabled={busy}
          className="bg-slate-900 text-white rounded-lg p-3 w-full disabled:opacity-50"
        >
          {busy ? "Verificando…" : "Iniciar sesión"}
        </button>
        <button
          disabled={busy}
          type="button"
          className="text-amber-800 text-sm"
          onClick={reset}
        >
          Olvidé mi contraseña
        </button>
        <button
          type="button"
          className="text-slate-500 text-sm ml-4"
          onClick={() => void supabase.auth.signOut()}
        >
          Cerrar sesión anterior
        </button>
        {message && (
          <p role="status" className="text-sm text-amber-900">
            {message}
          </p>
        )}
      </form>
    </div>
  );
}
