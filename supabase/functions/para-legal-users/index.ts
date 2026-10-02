import { createClient } from 'npm:@supabase/supabase-js@2.117.2';

const cors = { 'Access-Control-Allow-Origin': 'https://web-sources-dv.github.io', 'Access-Control-Allow-Headers': 'authorization,x-client-info,apikey,content-type', 'Access-Control-Allow-Methods': 'POST,OPTIONS' };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return response({ error: 'Método no disponible' },405);
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const authorization = req.headers.get('Authorization') || '';
    if (!authorization.startsWith('Bearer ')) return response({ error: 'Sesión requerida' },401);
    const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
    const { data: identity, error: identityError } = await caller.auth.getUser();
    if (identityError || !identity.user) return response({ error: 'Sesión inválida' },401);
    const { data: profile } = await caller.from('pl_profiles').select('role,active').eq('id',identity.user.id).single();
    if (!profile?.active || profile.role !== 'owner') return response({ error: 'Solo Daryl Villa puede gestionar usuarios' },403);
    const input = await req.json();
    if (typeof input.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email) || input.email.length>254 || typeof input.displayName!=='string' || !input.displayName.trim() || input.displayName.length>120 || !['user','admin'].includes(input.role) || typeof input.password!=='string' || input.password.length<12 || input.password.length>128) return response({ error: 'Completa nombre, correo, permiso y contraseña de 12 a 128 caracteres' },400);
    // Privileged key remains inside the Edge Function. No emails are sent by this endpoint.
    const admin = createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession:false } });
    const email=input.email.trim().toLowerCase();
    let accountId: string | undefined;
    for(let page=1; ; page++) {
      const {data,error}=await admin.auth.admin.listUsers({page,perPage:1000});
      if(error) throw error;
      accountId=data.users.find(user=>user.email?.toLowerCase()===email)?.id;
      if(accountId || data.users.length<1000) break;
    }
    let created=false;
    if(!accountId) {
      const {data,error}=await admin.auth.admin.createUser({email,password:input.password,email_confirm:true});
      if(error || !data.user) return response({error:'No se pudo crear la cuenta. Comprueba el correo y la contraseña.'},400);
      accountId=data.user.id; created=true;
    }
    const {error}=await caller.from('pl_profiles').insert({id:accountId,display_name:input.displayName.trim(),role:input.role,active:true});
    if(error) {
      if(created) await admin.auth.admin.deleteUser(accountId);
      return response({error:'La cuenta ya está habilitada o no se pudo guardar su permiso.'},400);
    }
    return response({success:true,existingAccount:!created});
  } catch { return response({error:'No se pudo gestionar la cuenta. Reintenta.'},500); }
});

