export type UserRole = 'user' | 'admin' | 'owner';
export interface AppUser {
  id: string;
  displayName: string;
  role: UserRole;
  active: boolean;
}
export type ProtectedArea = 'history' | 'database' | 'legacy' | 'databaseStatus' | 'users' | 'analytics';

// Roles must come from the authenticated backend, never from a name or editable local storage.
export function canView(user: AppUser | null, area: ProtectedArea): boolean {
  if (!user?.active) return false;
  if (user.role === 'owner') return true;
  return user.role === 'admin' && ['history', 'database', 'legacy', 'databaseStatus'].includes(area);
}

export function canManage(user: AppUser | null, area: ProtectedArea): boolean {
  return Boolean(user?.active && user.role === 'owner');
}

export function canOpenTab(user: AppUser | null, tab: string): boolean {
  if (!user?.active) return false;
  return ['history', 'database', 'users', 'analytics'].includes(tab) ? canView(user, tab as ProtectedArea) : true;
}

