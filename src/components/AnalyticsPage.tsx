import React, { useEffect, useState } from 'react';
import { listAppUsers, loadUsage } from '../services/accountManagement';
import { AppUser } from '../services/accessPolicy';
import { UsageEvent } from '../services/usageMetrics';
import { UsageDashboard } from './UsageDashboard';
export function AnalyticsPage() {
  const [members, setMembers] = useState<AppUser[]>([]);
  const [events, setEvents] = useState<UsageEvent[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const load = async () => {
    setLoading(true); setError('');
    try { const [users, usage] = await Promise.all([listAppUsers(), loadUsage()]); setMembers(users); setEvents(usage); }
    catch(e: any) { setError(e.message); } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  return <div><button disabled={loading} className="border bg-white rounded-lg p-2 mb-4" onClick={load}>Actualizar estadísticas</button>{loading ? <p>Cargando estadísticas…</p> : error ? <p role="alert">{error}</p> : <UsageDashboard events={events} members={members} />}</div>;
}

