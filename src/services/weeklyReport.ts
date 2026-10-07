import { supabase } from "./supabaseClient";
import { reportingWeek, type UsageMember } from "./usageMetrics";
export async function loadWeeklyReport(members: UsageMember[], date: Date) {
  const { start, end } = reportingWeek(date);
  const { data, error } = await supabase.rpc("pl_weekly_usage", {
    week_start: start.toISOString(),
  });
  if (error) throw error;
  const daily = Array<number>(7).fill(0),
    counts = new Map<string, number>();
  for (const row of data || []) {
    const count = Number(row.total);
    daily[row.day] += count;
    counts.set(row.user_id, (counts.get(row.user_id) || 0) + count);
  }
  const total = daily.reduce((sum, count) => sum + count, 0);
  const names = new Map(
    members.map((member) => [member.id, member.displayName]),
  );
  const ranking = [...new Set([...names.keys(), ...counts.keys()])]
    .map((id) => ({
      id,
      name: names.get(id) || "Usuario sin perfil disponible",
      count: counts.get(id) || 0,
      percentage: total ? ((counts.get(id) || 0) * 100) / total : 0,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  return { start, end, total, daily, ranking };
}
