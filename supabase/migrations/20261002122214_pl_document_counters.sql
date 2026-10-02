alter table public.pl_clients add column document_count integer not null default 0;
alter table public.pl_templates add column usage_count integer not null default 0;
create index pl_document_client on public.pl_documents ((payload->>'clientId'));
create index pl_document_template on public.pl_documents ((payload->>'templateId'));
-- Users edit entity fields, never the server-maintained counters.
revoke insert, update on public.pl_clients, public.pl_templates from authenticated;
grant insert(id,payload,updated_at), update(id,payload,updated_at) on public.pl_clients, public.pl_templates to authenticated;
create function pl_private.refresh_document_counts() returns trigger language plpgsql security definer set search_path = '' as $$
declare old_client text; old_template text; new_client text; new_template text;
begin
  if auth.uid() is null or pl_private.current_role() is null then raise exception 'Acceso denegado'; end if;
  if tg_op <> 'INSERT' then old_client := old.payload->>'clientId'; old_template := old.payload->>'templateId'; end if;
  if tg_op <> 'DELETE' then new_client := new.payload->>'clientId'; new_template := new.payload->>'templateId'; end if;
  update public.pl_clients c set document_count = (select count(*) from public.pl_documents d where d.payload->>'clientId'=c.id)
  where c.id = old_client or c.id = new_client;
  update public.pl_templates t set usage_count = (select count(*) from public.pl_documents d where d.payload->>'templateId'=t.id)
  where t.id = old_template or t.id = new_template;
  return null;
end;
$$;
revoke all on function pl_private.refresh_document_counts() from public, anon, authenticated;
create trigger pl_document_counts after insert or update or delete on public.pl_documents for each row execute function pl_private.refresh_document_counts();

