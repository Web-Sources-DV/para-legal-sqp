import { supabase } from './supabaseClient';
import { AppUser } from './accessPolicy';

let currentUser: AppUser | null = null;
export function getActiveUser() { return currentUser; }
export function setActiveUser(user: AppUser | null) { currentUser = user; }
export async function readProfile(id: string): Promise<AppUser> {
  const { data, error } = await supabase.from('pl_profiles').select('id,display_name,role,active').eq('id', id).single();
  if (error || !data?.active) throw new Error('Tu cuenta no tiene acceso activo a Para Legal. Contacta a Daryl Villa.');
  return { id: data.id, displayName: data.display_name, role: data.role, active: data.active };
}

