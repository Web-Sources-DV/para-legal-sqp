import { createClient } from '@supabase/supabase-js';

// The public app always uses the anon key, even if this browser has an old account session.
export const publicSupabase = createClient(
  import.meta.env?.VITE_SUPABASE_URL || 'https://fipcnxfxxngdjunrlbat.supabase.co',
  import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_2cK8fX6MV8F21xLM4A8gMg_hRCp3-9I',
  { auth: { storageKey: 'para-legal-public', persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
);
