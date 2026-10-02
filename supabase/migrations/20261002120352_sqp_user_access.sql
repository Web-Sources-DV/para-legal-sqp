-- Para Legal uses its own tables. Existing SQP-Financing tables are untouched.
create schema if not exists pl_private;
revoke all on schema pl_private from public;
grant usage on schema pl_private to authenticated;

create table public.pl_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (length(display_name) between 1 and 120),
  role text not null default 'user' check (role in ('user','admin','owner')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index pl_one_owner on public.pl_profiles(role) where role = 'owner';
alter table public.pl_profiles enable row level security;

create function pl_private.current_role() returns text language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then return null; end if;
  return (select role from public.pl_profiles where id = auth.uid() and active);
end;
$$;
revoke all on function pl_private.current_role() from public, anon;
grant execute on function pl_private.current_role() to authenticated;

create policy pl_profile_read on public.pl_profiles for select to authenticated
using (id = (select auth.uid()) or (select pl_private.current_role()) = 'owner');
create policy pl_profile_insert on public.pl_profiles for insert to authenticated
with check ((select pl_private.current_role()) = 'owner' and role <> 'owner');
create policy pl_profile_update on public.pl_profiles for update to authenticated
using ((select pl_private.current_role()) = 'owner' and role <> 'owner')
with check ((select pl_private.current_role()) = 'owner' and role <> 'owner');
grant select, insert, update on public.pl_profiles to authenticated;
revoke all on public.pl_profiles from anon;

create table public.pl_clients (id text primary key, payload jsonb not null check (jsonb_typeof(payload) = 'object' and payload->>'id' = id), updated_at timestamptz not null default now());
create table public.pl_templates (id text primary key, payload jsonb not null check (jsonb_typeof(payload) = 'object' and payload->>'id' = id), updated_at timestamptz not null default now());
create table public.pl_documents (
  id text primary key, payload jsonb not null check (jsonb_typeof(payload) = 'object' and payload->>'id' = id),
  created_by uuid not null default auth.uid() references public.pl_profiles(id),
  created_at timestamptz not null default now(), generated_live boolean not null default true
);
create index pl_documents_creator on public.pl_documents(created_by);
create table public.pl_usage (
  id text primary key, user_id uuid not null references public.pl_profiles(id),
  created_at timestamptz not null default now(), kind text not null default 'document_generated' check (kind = 'document_generated')
);
create index pl_usage_week on public.pl_usage(created_at, user_id);
create table public.pl_resources (id text primary key, content text not null, updated_at timestamptz not null default now());

alter table public.pl_clients enable row level security;
alter table public.pl_templates enable row level security;
alter table public.pl_documents enable row level security;
alter table public.pl_usage enable row level security;
alter table public.pl_resources enable row level security;

create policy pl_clients_access on public.pl_clients for all to authenticated
using ((select pl_private.current_role()) is not null) with check ((select pl_private.current_role()) is not null);
create policy pl_templates_access on public.pl_templates for all to authenticated
using ((select pl_private.current_role()) is not null) with check ((select pl_private.current_role()) is not null);
create policy pl_documents_read on public.pl_documents for select to authenticated using ((select pl_private.current_role()) in ('admin','owner'));
create policy pl_documents_create on public.pl_documents for insert to authenticated
with check ((select pl_private.current_role()) is not null and created_by = (select auth.uid()) and (generated_live or (select pl_private.current_role()) = 'owner'));
create policy pl_documents_update on public.pl_documents for update to authenticated
using ((select pl_private.current_role()) = 'owner') with check ((select pl_private.current_role()) = 'owner');
create policy pl_documents_delete on public.pl_documents for delete to authenticated using ((select pl_private.current_role()) = 'owner');
create policy pl_usage_read on public.pl_usage for select to authenticated using ((select pl_private.current_role()) = 'owner');
create policy pl_resources_read on public.pl_resources for select to authenticated using ((select pl_private.current_role()) in ('admin','owner'));
create policy pl_resources_manage on public.pl_resources for all to authenticated
using ((select pl_private.current_role()) = 'owner') with check ((select pl_private.current_role()) = 'owner');
grant select, insert, update, delete on public.pl_clients, public.pl_templates, public.pl_documents, public.pl_resources to authenticated;
grant select on public.pl_usage to authenticated;
revoke all on public.pl_clients, public.pl_templates, public.pl_documents, public.pl_usage, public.pl_resources from anon;

-- Only a successful first document insert creates a usage event. No editable client-side counters.
create function pl_private.record_usage() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or pl_private.current_role() is null then raise exception 'Acceso denegado'; end if;
  if not new.generated_live then return new; end if;
  insert into public.pl_usage(id,user_id,created_at) values(new.id,new.created_by,new.created_at) on conflict(id) do nothing;
  return new;
end;
$$;
revoke all on function pl_private.record_usage() from public, anon, authenticated;
create trigger pl_document_usage after insert on public.pl_documents for each row execute function pl_private.record_usage();

create function pl_private.stamp_document() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.created_by := auth.uid();
  new.created_at := now();
  return new;
end;
$$;
revoke all on function pl_private.stamp_document() from public, anon, authenticated;
create trigger pl_document_stamp before insert on public.pl_documents for each row execute function pl_private.stamp_document();

-- Owner-only atomic database replacement, including validation before any writes.
create function public.pl_restore_database(backup jsonb) returns void language plpgsql security invoker set search_path = '' as $$
declare item jsonb;
begin
  if pl_private.current_role() is distinct from 'owner' then raise exception 'Solo Daryl Villa puede restaurar la base de datos'; end if;
  if jsonb_typeof(backup->'clients') is distinct from 'array' or jsonb_typeof(backup->'templates') is distinct from 'array' or jsonb_typeof(backup->'documents') is distinct from 'array' then raise exception 'Respaldo inválido'; end if;
  for item in select value from jsonb_array_elements(backup->'clients') loop
    if coalesce(item->>'id','') = '' or coalesce(item->>'fullName','') = '' or coalesce(item->>'passportNumber','') = '' then raise exception 'Cliente inválido'; end if;
  end loop;
  for item in select value from jsonb_array_elements(backup->'templates') loop
    if coalesce(item->>'id','') = '' or coalesce(item->>'name','') = '' or coalesce(item->>'fileData','') = '' then raise exception 'Plantilla inválida'; end if;
  end loop;
  for item in select value from jsonb_array_elements(backup->'documents') loop
    if coalesce(item->>'id','') = '' or coalesce(item->>'fileName','') = '' then raise exception 'Documento inválido'; end if;
  end loop;
  delete from public.pl_documents;
  delete from public.pl_clients;
  delete from public.pl_templates;
  insert into public.pl_clients(id,payload) select value->>'id',value from jsonb_array_elements(backup->'clients');
  insert into public.pl_templates(id,payload) select value->>'id',value from jsonb_array_elements(backup->'templates');
  insert into public.pl_documents(id,payload,generated_live) select value->>'id',value,false from jsonb_array_elements(backup->'documents');
end;
$$;
revoke all on function public.pl_restore_database(jsonb) from public, anon;
grant execute on function public.pl_restore_database(jsonb) to authenticated;

