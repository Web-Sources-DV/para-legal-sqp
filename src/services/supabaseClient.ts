import { createClient } from '@supabase/supabase-js';

// Public browser credentials. Database RLS is the authorization boundary.
export const supabase = createClient(
  'https://fipcnxfxxngdjunrlbat.supabase.co',
  'sb_publishable_2cK8fX6MV8F21xLM4A8gMg_hRCp3-9I',
  { auth: { storageKey: 'para-legal-auth', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } },
);

