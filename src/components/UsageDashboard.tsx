import { loadWeeklyReport } from "../services/weeklyReport";
import React, { useMemo, useState, useEffect } from "react";
import { UsageEvent, UsageMember, weeklyUsage } from "../services/usageMetrics";

export function UsageDashboard({
  events = [],
  members,
  remote = false,
}: {
  events?: UsageEvent[];
  members: UsageMember[];
  remote?: boolean;
}) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [report, setReport] = useState<Awaited<
    ReturnType<typeof loadWeeklyReport>
  > | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!remote) return;
    let active = true;
    setLoading(true);
    setError("");
    void loadWeeklyReport(
      members,
      new Date(Date.now() + weekOffset * 7 * 86400000),
    )
      .then((value) => {
        if (active) setReport(value);
      })
      .catch((error) => {
        if (active) setError(error.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [remote, members, weekOffset]);
  const local = useMemo(
    () =>
      weeklyUsage(
        events,
        members,
        new Date(Date.now() + weekOffset * 7 * 86400000),
      ),
    [events, members, weekOffset],
  );
  const usage = remote && report ? report : local;
  const max = Math.max(1, ...usage.daily);
  const format = (date: Date) =>
    date.toLocaleDateString("es-PA", { timeZone: "America/Panama" });
  return (
    <section className="space-y-6">
      {loading && <p role="status">Cargando semana…</p>}
      {error && <p role="alert">{error}</p>}
      <div className="rounded-2xl bg-white border border-slate-200 p-6">
        <h2 className="text-xl font-bold text-slate-900">
          Uso semanal de la app
        </h2>
        <p className="text-sm text-slate-600 mt-2">
          Documentos generados correctamente por usuario. Semana de lunes a
          domingo, hora de Panamá.
        </p>
        <div className="flex flex-wrap gap-3 items-center mt-4">
          <button
            className="border rounded-lg px-3 py-2"
            onClick={() => setWeekOffset((value) => value - 1)}
          >
            Semana anterior
          </button>
          <span>
            {format(usage.start)} – {format(new Date(+usage.end - 1))}
          </span>
          <button
            className="border rounded-lg px-3 py-2 disabled:opacity-40"
            disabled={weekOffset === 0}
            onClick={() => setWeekOffset((value) => Math.min(0, value + 1))}
          >
            Semana siguiente
          </button>
          <button
            className="border rounded-lg px-3 py-2"
            onClick={() => setWeekOffset(0)}
          >
            Esta semana
          </button>
        </div>
        <p className="font-bold text-amber-700 mt-4">
          {usage.total} documentos generados
        </p>
        <div
          className="flex gap-3 h-52 mt-5 items-end"
          role="img"
          aria-label={`Documentos por día: ${usage.daily.join(", ")}`}
        >
          {usage.daily.map((count, i) => (
            <div
              key={i}
              className="flex-1 flex flex-col items-center justify-end h-full gap-2"
            >
              <span className="text-sm font-semibold">{count}</span>
              <div
                className="bg-amber-500 w-full max-w-20 rounded-t-lg"
                style={{ height: `${(count / max) * 140}px`, minHeight: 2 }}
              />
              <span className="text-xs">
                {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"][i]}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-2xl bg-white border border-slate-200 p-6">
        <h3 className="font-bold text-lg">Usuarios con mayor uso</h3>
        <p className="text-sm text-slate-600 my-2">
          Cada porcentaje representa la participación en el total de documentos
          de la semana.
        </p>
        {!usage.total && (
          <p className="p-4 bg-slate-50 rounded-lg">
            Todavía no hay documentos generados en esta semana.
          </p>
        )}
        <ol className="space-y-4 mt-4">
          {usage.ranking.map((user, i) => (
            <li key={user.id}>
              <div className="flex justify-between gap-3 text-sm">
                <span>
                  {i + 1}. {user.name}
                </span>
                <span>
                  {user.count} · {user.percentage.toFixed(1)}%
                </span>
              </div>
              <progress
                className="w-full h-3 mt-2 accent-amber-500"
                max={100}
                value={user.percentage}
                aria-label={`Participación de ${user.name}`}
              />
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
