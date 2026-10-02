import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AppUser, canView, canManage } from '../src/services/accessPolicy';
import { reportingWeek, weeklyUsage } from '../src/services/usageMetrics';

test('normal users cannot access protected areas; administrators can only read', () => {
  const normal: AppUser = { id: '1', displayName: 'Daryl Villa', role: 'user', active: true };
  const admin: AppUser = { ...normal, role: 'admin' };
  for (const area of ['history', 'database', 'legacy', 'databaseStatus', 'users', 'analytics'] as const) {
    assert.equal(canView(normal, area), false);
    assert.equal(canManage(admin, area), false);
    assert.equal(canView(admin, area), !['users', 'analytics'].includes(area));
    assert.equal(canView({ ...admin, role: 'owner' }, area), true);
    assert.equal(canManage({ ...admin, role: 'owner', active: false }, area), false);
  }
  assert.equal(canView(null, 'history'), false);
});

test('weekly ranking uses Panama Monday boundaries, rejects duplicates and handles empty weeks', () => {
  const date = new Date('2026-10-05T04:59:59Z'); // Sunday in Panama
  assert.equal(reportingWeek(date).start.toISOString(), '2026-09-28T05:00:00.000Z');
  const members = [{ id: 'a', displayName: 'A' }, { id: 'b', displayName: 'B' }];
  const events = [
    { id: '1', userId: 'a', createdAt: '2026-09-28T05:00:00Z', kind: 'document_generated' as const },
    { id: '2', userId: 'a', createdAt: '2026-10-04T23:00:00Z', kind: 'document_generated' as const },
    { id: '3', userId: 'b', createdAt: '2026-10-05T04:59:59Z', kind: 'document_generated' as const },
    { id: '4', userId: 'b', createdAt: '2026-10-05T05:00:00Z', kind: 'document_generated' as const },
  ];
  const usage = weeklyUsage([...events, events[0]], members, date);
  assert.equal(usage.total, 3);
  assert.equal(usage.ranking[0].id, 'a');
  assert.equal(usage.ranking[0].percentage, 200 / 3);
  assert.deepEqual(usage.daily, [1, 0, 0, 0, 0, 0, 2]);
  assert.equal(weeklyUsage([], members, date).ranking[0].percentage, 0);
});

