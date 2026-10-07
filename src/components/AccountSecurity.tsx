import React, { useEffect, useState } from "react";
import { supabase } from "../services/supabaseClient";
export function AccountSecurity() {
  const [factors, setFactors] = useState<{ id: string; status: string }[]>([]);
  const [enrollment, setEnrollment] = useState<{
    id: string;
    qr: string;
  } | null>(null);
  const [code, setCode] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const load = async () => {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) throw error;
    setFactors(data.totp);
  };
  useEffect(() => {
    void load().catch((error) => setMessage(error.message));
  }, []);
  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      await action();
      await load();
    } catch (error: any) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <details className="bg-slate-800 rounded p-3 mb-3">
      <summary>Seguridad de la cuenta · verificación en dos pasos</summary>
      <p className="text-xs my-3">
        La identidad y sus factores se comparten con SQP-Financing. Conserva
        acceso a tu aplicación autenticadora y consulta al responsable si
        pierdes el dispositivo.
      </p>
      {factors.map((factor) => (
        <div key={factor.id} className="flex gap-3 my-2">
          <span>
            {factor.status === "verified"
              ? "Autenticador activo"
              : "Configuración pendiente"}
          </span>
          <button
            disabled={busy}
            className="underline"
            onClick={() =>
              void run(async () => {
                if (
                  !confirm(
                    "¿Eliminar este factor de autenticación de la cuenta compartida?",
                  )
                )
                  return;
                const { error } = await supabase.auth.mfa.unenroll({
                  factorId: factor.id,
                });
                if (error) throw error;
                setEnrollment(null);
              })
            }
          >
            Eliminar factor
          </button>
        </div>
      ))}
      {!enrollment && (
        <button
          disabled={busy}
          className="border rounded p-2"
          onClick={() =>
            void run(async () => {
              const { data, error } = await supabase.auth.mfa.enroll({
                factorType: "totp",
                friendlyName: "Para Legal",
              });
              if (error) throw error;
              setEnrollment({ id: data.id, qr: data.totp.qr_code });
            })
          }
        >
          Configurar autenticador
        </button>
      )}
      {enrollment && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void run(async () => {
              const { error } = await supabase.auth.mfa.challengeAndVerify({
                factorId: enrollment.id,
                code,
              });
              if (error) throw error;
              setEnrollment(null);
              setCode("");
              setMessage("Verificación en dos pasos activada.");
            });
          }}
        >
          <img
            alt="Código QR para vincular la cuenta a tu autenticador"
            className="bg-white w-48 my-3"
            src={
              enrollment.qr.startsWith("data:")
                ? enrollment.qr
                : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(enrollment.qr)}`
            }
          />
          <label>
            Código de seis dígitos
            <input
              className="text-slate-900 border rounded p-2 ml-2"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              required
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
          </label>
          <button disabled={busy} className="border rounded p-2 ml-2">
            Verificar y activar
          </button>
        </form>
      )}
      {message && (
        <p role="status" className="text-sm mt-3">
          {message}
        </p>
      )}
    </details>
  );
}
