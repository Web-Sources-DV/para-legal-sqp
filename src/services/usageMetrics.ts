export interface UsageEvent {
  id: string;
  userId: string;
  createdAt: string;
  kind: 'document_generated';
}
export interface UsageMember { id: string; displayName: string }

// Panama uses UTC-5 throughout the year. A reporting week starts Monday at 00:00.
const PANAMA_OFFSET_MS = 5 * 60 * 60 * 1000;
export function reportingWeek(date: Date): { start: Date; end: Date } {
  const local = new Date(date.getTime() - PANAMA_OFFSET_MS);
  const weekday = (local.getUTCDay() + 6) % 7;
  const start = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - weekday) + PANAMA_OFFSET_MS);
  return { start, end: new Date(start.getTime() + 7 * 86400000) };
}

export function weeklyUsage(events: UsageEvent[], members: UsageMember[], date = new Date()) {
  const { start, end } = reportingWeek(date);
  const counts = new Map<string, number>();
  const daily = Array.from({ length: 7 }, () => 0);
  const seen = new Set<string>();
  for (const event of events) {
    const at = Date.parse(event.createdAt);
    if (event.kind !== 'document_generated' || !event.userId || seen.has(event.id) || !Number.isFinite(at) || at < +start || at >= +end) continue;
    seen.add(event.id);
    counts.set(event.userId, (counts.get(event.userId) || 0) + 1);
    daily[Math.floor((at - +start) / 86400000)]++;
  }
  const total = daily.reduce((sum, count) => sum + count, 0);
  const names = new Map(members.map(member => [member.id, member.displayName]));
  const userIds = new Set([...names.keys(), ...counts.keys()]);
  const ranking = [...userIds].map(id => ({
    id, name: names.get(id) || 'Usuario sin perfil disponible', count: counts.get(id) || 0,
    percentage: total ? ((counts.get(id) || 0) * 100 / total) : 0,
  })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  return { start, end, total, daily, ranking };
}

