import { createClient } from '@supabase/supabase-js';

// Public browser credentials. Database RLS is the authorization boundary.
export const supabase = createClient(
  import.meta.env?.VITE_SUPABASE_URL || 'https://fipcnxfxxngdjunrlbat.supabase.co',
  import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_2cK8fX6MV8F21xLM4A8gMg_hRCp3-9I',
  { auth: { storageKey: 'para-legal-auth', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } },
);
