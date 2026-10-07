begin;
-- Apply before deploying the updated browser application. Existing blobs remain readable.
alter table public.pl_clients add column revision integer not null default 1;
alter table public.pl_templates add column revision integer not null default 1;
alter table public.pl_documents add column revision integer not null default 1;
alter table public.pl_clients add column archived boolean not null default false;
alter table public.pl_templates add column archived boolean not null default false;
alter table public.pl_templates add column approved boolean not null default true;
alter table public.pl_templates add column submitted_by uuid references auth.users(id);

-- A global monotonic revision prevents stale forms matching a restored record.
create sequence public.pl_revision_seq;
select setval('public.pl_revision_seq', greatest(1,(select coalesce(max(revision),1) from (select revision from public.pl_clients union all select revision from public.pl_templates union all select revision from public.pl_documents) r)));
alter table public.pl_clients alter column revision set default nextval('public.pl_revision_seq');
alter table public.pl_templates alter column revision set default nextval('public.pl_revision_seq');
alter table public.pl_documents alter column revision set default nextval('public.pl_revision_seq');

create table public.pl_audit (
  id bigint generated always as identity primary key,
  actor uuid references auth.users(id), entity text not null, entity_id text not null,
  operation text not null, revision integer, created_at timestamptz not null default now()
);
create table public.pl_backups (
  id uuid primary key default gen_random_uuid(), created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(), reason text not null, backup jsonb not null
);
alter table public.pl_audit enable row level security;
alter table public.pl_backups enable row level security;
create policy pl_audit_owner on public.pl_audit for select to authenticated using ((select pl_private.current_role())='owner');
create policy pl_backups_owner on public.pl_backups for select to authenticated using ((select pl_private.current_role())='owner');
grant select on public.pl_audit, public.pl_backups to authenticated;
revoke all on public.pl_audit, public.pl_backups from anon;

create function pl_private.audit_change() returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.pl_audit(actor,entity,entity_id,operation,revision)
  values(auth.uid(),tg_table_name,coalesce(new.id,old.id)::text,tg_op,case when tg_table_name='pl_profiles' then null else coalesce(to_jsonb(new)->>'revision',to_jsonb(old)->>'revision')::integer end);
  return null;
end $$;
revoke all on function pl_private.audit_change() from public,anon,authenticated;
create trigger pl_client_audit after insert or update or delete on public.pl_clients for each row execute function pl_private.audit_change();
create trigger pl_template_audit after insert or update or delete on public.pl_templates for each row execute function pl_private.audit_change();
create trigger pl_documents_audit after insert or update or delete on public.pl_documents for each row execute function pl_private.audit_change();
create trigger pl_profiles_audit after insert or update or delete on public.pl_profiles for each row execute function pl_private.audit_change();

create function public.pl_list_entities(entity text, after_id text default '', page_size integer default 100, query text default '', include_archived boolean default false)
returns table(id text,payload jsonb,revision integer,archived boolean,approved boolean,sort_key text) language plpgsql security invoker set search_path='' as $$
begin
  if page_size < 1 or page_size > 1000 then raise exception 'Tamaño de página inválido'; end if;
  if entity='clients' then
    return query select c.id,c.payload-'passportImageBase64'||jsonb_build_object('documentCount',c.document_count),c.revision,c.archived,true,c.id
      from public.pl_clients c where c.id>after_id and (include_archived or not c.archived)
      and (query='' or c.payload->>'fullName' ilike '%'||query||'%' or c.payload->>'passportNumber' ilike '%'||query||'%') order by c.id limit page_size;
  elsif entity='templates' then
    return query select t.id,t.payload-'fileData'||jsonb_build_object('usageCount',t.usage_count),t.revision,t.archived,t.approved,t.id
      from public.pl_templates t where t.id>after_id and (include_archived or not t.archived) and (t.approved or pl_private.current_role()='owner' or t.submitted_by=auth.uid())
      and (query='' or t.payload->>'name' ilike '%'||query||'%') order by t.id limit page_size;
  elsif entity='documents' then
    return query select d.id,d.payload-'fileBase64',d.revision,false,true,d.created_at::text||'|'||d.id from public.pl_documents d
      where (after_id='' or (d.created_at,d.id)<(nullif(split_part(after_id,'|',1),'')::timestamptz,split_part(after_id,'|',2))) and (query='' or d.payload->>'clientName' ilike '%'||query||'%' or d.payload->>'title' ilike '%'||query||'%') order by d.created_at desc,d.id desc limit page_size;
  else raise exception 'Entidad inválida'; end if;
end $$;

create function public.pl_entity_file(entity text, entity_id text) returns jsonb language plpgsql security invoker set search_path='' as $$
begin
  if entity='clients' then return (select jsonb_build_object('data',payload->>'passportImageBase64','path',payload->>'imagePath') from public.pl_clients where id=entity_id);
  elsif entity='templates' then return (select jsonb_build_object('data',payload->>'fileData','path',payload->>'filePath') from public.pl_templates where id=entity_id);
  elsif entity='documents' then return (select jsonb_build_object('data',payload->>'fileBase64','path',payload->>'filePath') from public.pl_documents where id=entity_id);
  else raise exception 'Entidad inválida'; end if;
end $$;

create function public.pl_save_entity(entity text, document jsonb, expected_revision integer default null) returns integer
language plpgsql security definer set search_path='' as $$
declare result integer; entity_id text:=document->>'id'; field text; parsed_date date;
begin
  if pl_private.current_role() is null then raise exception 'Acceso denegado'; end if;
  if jsonb_typeof(document) is distinct from 'object' or coalesce(entity_id,'')='' then raise exception 'Datos inválidos'; end if;
  if entity='clients' then
    foreach field in array array['fullName','passportNumber','firstName','lastName','docType','nationality','issuingCountry','birthDate','expiryDate','sex','email','phone','address','city','notes'] loop
      if document ? field and jsonb_typeof(document->field) is distinct from 'string' then raise exception 'Tipo inválido: %',field; end if;
    end loop;
    document:=jsonb_build_object('firstName','','lastName','','nationality','','issuingCountry','','birthDate','','expiryDate','','sex','','createdAt',now(),'updatedAt',now())||document;
    if coalesce(document->>'fullName','')='' or coalesce(document->>'passportNumber','')='' or coalesce(document->>'docType','') not in ('pasaporte','cedula','dni','nie','otro') then raise exception 'Cliente inválido'; end if;
    foreach field in array array['birthDate','issueDate','expiryDate'] loop
      if coalesce(document->>field,'')<>'' then
        if document->>field !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Fecha inválida: %',field; end if;
        parsed_date:=(document->>field)::date;
        if field='birthDate' and parsed_date>current_date then raise exception 'Nacimiento en el futuro'; end if;
      end if;
    end loop;
    if coalesce(document->>'issueDate','')<>'' and coalesce(document->>'expiryDate','')<>'' and (document->>'issueDate')::date>(document->>'expiryDate')::date then raise exception 'Emisión posterior al vencimiento'; end if;
    if exists(select 1 from public.pl_clients c where c.id<>entity_id and not c.archived and upper(c.payload->>'passportNumber')=upper(document->>'passportNumber') and c.payload->>'docType'=document->>'docType' and coalesce(c.payload->>'issuingCountry','')=coalesce(document->>'issuingCountry','')) then raise exception 'Ya existe un cliente con esa identidad y país emisor'; end if;
    if expected_revision is null then
      insert into public.pl_clients(id,payload) values(entity_id,document) returning revision into result;
    else
      update public.pl_clients set payload=payload||document,revision=nextval('public.pl_revision_seq'),updated_at=now()
      where id=entity_id and revision=expected_revision and not archived returning revision into result;
    end if;
  elsif entity='templates' then
    if jsonb_typeof(document->'name') is distinct from 'string' or jsonb_typeof(document->'placeholders') is distinct from 'array' then raise exception 'Plantilla inválida'; end if;
    if exists(select 1 from jsonb_array_elements(document->'placeholders') v where jsonb_typeof(v) is distinct from 'string') then raise exception 'Marcadores inválidos'; end if;
    document:=jsonb_build_object('description','','category','General','placeholderDefs','[]'::jsonb,'createdAt',now(),'updatedAt',now())||document||jsonb_build_object('version',coalesce((select (payload->>'version')::integer from public.pl_templates where id=entity_id),0)+1);
    if coalesce(document->>'name','')='' or (coalesce(document->>'fileData','')='' and coalesce(document->>'filePath','')='') then raise exception 'Plantilla inválida'; end if;
    if expected_revision is null then
      insert into public.pl_templates(id,payload,approved,submitted_by) values(entity_id,document,pl_private.current_role()='owner',auth.uid()) returning revision into result;
    else
      update public.pl_templates set payload=payload||document,revision=nextval('public.pl_revision_seq'),updated_at=now(),approved=pl_private.current_role()='owner',submitted_by=auth.uid()
      where id=entity_id and revision=expected_revision and not archived returning revision into result;
    end if;
  else raise exception 'Entidad inválida'; end if;
  if result is null then raise exception 'El registro cambió o fue archivado. Actualiza antes de guardar.'; end if;
  return result;
end $$;

-- All client/template writes go through validated, revision-guarded functions.
revoke insert,update,delete on public.pl_clients,public.pl_templates from authenticated;
revoke insert(id,payload,updated_at),update(id,payload,updated_at) on public.pl_clients,public.pl_templates from authenticated;
create unique index pl_client_identity_unique on public.pl_clients
  (upper(trim(payload->>'passportNumber')), (payload->>'docType'), upper(trim(coalesce(payload->>'issuingCountry',''))))
  where not archived and coalesce(payload->>'passportNumber','')<>'';

create function public.pl_archive_entity(entity text,entity_id text,expected_revision integer) returns void language plpgsql security definer set search_path='' as $$
declare changed integer;
begin
  if pl_private.current_role() is distinct from 'owner' then raise exception 'Solo el propietario puede archivar'; end if;
  if entity='clients' then update public.pl_clients set archived=true,revision=nextval('public.pl_revision_seq'),updated_at=now() where id=entity_id and revision=expected_revision;
  elsif entity='templates' then update public.pl_templates set archived=true,revision=nextval('public.pl_revision_seq'),updated_at=now() where id=entity_id and revision=expected_revision;
  else raise exception 'Entidad inválida'; end if;
  get diagnostics changed=row_count;
  if changed<>1 then raise exception 'El registro cambió. Actualiza antes de archivar.'; end if;
end $$;

create function public.pl_approve_template(entity_id text,expected_revision integer) returns void language plpgsql security definer set search_path='' as $$
begin
  if pl_private.current_role() is distinct from 'owner' then raise exception 'Solo el propietario puede aprobar'; end if;
  update public.pl_templates set approved=true,revision=nextval('public.pl_revision_seq') where id=entity_id and revision=expected_revision and not archived;
  if not found then raise exception 'La plantilla cambió. Actualiza antes de aprobar.'; end if;
end $$;

create function public.pl_export_database() returns jsonb language plpgsql security invoker set search_path='' as $$
begin
  if pl_private.current_role() is distinct from 'owner' then raise exception 'Solo el propietario puede exportar'; end if;
  return jsonb_build_object('version','4.0','exportedAt',now(),
    'clients',(select coalesce(jsonb_agg(payload||jsonb_build_object('archived',archived,'revision',revision)),'[]') from public.pl_clients),
    'templates',(select coalesce(jsonb_agg(payload||jsonb_build_object('archived',archived,'approved',approved,'revision',revision)),'[]') from public.pl_templates),
    'documents',(select coalesce(jsonb_agg(payload),'[]') from public.pl_documents),
    'lawyers',(select coalesce(jsonb_agg(payload||jsonb_build_object('revision',revision)),'[]') from public.pl_lawyers));
end $$;

create function public.pl_backup_before_restore(backup_reason text) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
  if pl_private.current_role() is distinct from 'owner' then raise exception 'Solo el propietario puede respaldar'; end if;
  insert into public.pl_backups(created_by,reason,backup) values(auth.uid(),backup_reason,public.pl_export_database()) returning id into result;
  return result;
end $$;

create or replace function public.pl_record_document(document jsonb) returns void language plpgsql security invoker set search_path='' as $$
begin
  if pl_private.current_role() is null then raise exception 'Acceso denegado'; end if;
  if exists(select 1 from public.pl_documents where id=document->>'id') then
    if not exists(select 1 from public.pl_documents where id=document->>'id' and created_by=auth.uid()) then raise exception 'Identificador ya utilizado'; end if;
    return;
  end if;
  if not exists(select 1 from public.pl_clients where id=document->>'clientId' and not archived) then raise exception 'Cliente no disponible'; end if;
  if not exists(select 1 from public.pl_templates where id=document->>'templateId' and not archived and approved) then raise exception 'Plantilla no disponible o pendiente de aprobación'; end if;
  if jsonb_typeof(document) is distinct from 'object' or coalesce(document->>'id','')='' or coalesce(document->>'fileName','')='' or (coalesce(document->>'fileBase64','')='' and coalesce(document->>'filePath','')='') then raise exception 'Documento inválido'; end if;
  if coalesce(document->>'filePath','')<>'' then
    if document->>'filePath' not like auth.uid()::text||'/documents/%' or not exists(select 1 from storage.objects where bucket_id='para-legal-private' and name=document->>'filePath') then raise exception 'Ruta de documento inválida'; end if;
  end if;
  begin insert into public.pl_documents(id,payload) values(document->>'id',document);
  exception when unique_violation then null; end;
end $$;

create function public.pl_weekly_usage(week_start timestamptz) returns table(user_id uuid,day integer,total bigint) language sql stable security invoker set search_path='' as $$
  select u.user_id,floor(extract(epoch from (u.created_at-week_start))/86400)::integer,count(*) from public.pl_usage u
  where u.created_at>=week_start and u.created_at<week_start+interval '7 days' group by 1,2;
$$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('para-legal-private','para-legal-private',false,15728640,array['application/vnd.openxmlformats-officedocument.wordprocessingml.document','image/jpeg','image/png','image/webp','image/bmp']) on conflict(id) do nothing;
create policy pl_file_insert on storage.objects for insert to authenticated with check (bucket_id='para-legal-private' and (select pl_private.current_role()) is not null and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy pl_file_read on storage.objects for select to authenticated using (bucket_id='para-legal-private' and (select pl_private.current_role()) is not null and ((storage.foldername(name))[2] in ('clients','templates') or (storage.foldername(name))[2]='documents' and ((select pl_private.current_role()) in ('admin','owner') or (storage.foldername(name))[1]=(select auth.uid())::text)));
-- No browser DELETE/UPDATE policies: archived files and backups remain recoverable.

revoke all on function public.pl_list_entities(text,text,integer,text,boolean),public.pl_entity_file(text,text),public.pl_save_entity(text,jsonb,integer),public.pl_archive_entity(text,text,integer),public.pl_approve_template(text,integer),public.pl_export_database(),public.pl_backup_before_restore(text),public.pl_restore_database(jsonb),public.pl_weekly_usage(timestamptz) from public,anon;
grant execute on function public.pl_list_entities(text,text,integer,text,boolean),public.pl_entity_file(text,text),public.pl_save_entity(text,jsonb,integer),public.pl_archive_entity(text,text,integer),public.pl_approve_template(text,integer),public.pl_export_database(),public.pl_backup_before_restore(text),public.pl_restore_database(jsonb),public.pl_weekly_usage(timestamptz) to authenticated;

-- The browser cannot spoof the document timestamp displayed in history.
create or replace function pl_private.stamp_document() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  new.created_by:=auth.uid(); new.created_at:=now();
  if new.generated_live then new.payload:=new.payload||jsonb_build_object('generatedAt',new.created_at);
  elsif coalesce(new.payload->>'generatedAt','')<>'' then new.created_at:=(new.payload->>'generatedAt')::timestamptz;
  end if;
  return new;
end $$;

create index pl_audit_entity on public.pl_audit(entity,entity_id,id);
create function public.pl_sync_cursor() returns bigint language plpgsql stable security definer set search_path='' as $$
begin
  if pl_private.current_role() is null then raise exception 'Acceso denegado'; end if;
  return (select coalesce(max(id),0) from public.pl_audit);
end $$;
create function public.pl_entity_counts() returns jsonb language plpgsql stable security invoker set search_path='' as $$
begin
  if pl_private.current_role() is null then raise exception 'Acceso denegado'; end if;
  return jsonb_build_object('clients',(select count(*) from public.pl_clients where not archived),'templates',(select count(*) from public.pl_templates where not archived and (approved or pl_private.current_role()='owner' or submitted_by=auth.uid())),'documents',(select count(*) from public.pl_documents));
end $$;
create function public.pl_changes(after_cursor bigint) returns table(cursor bigint,entity text,id text,record jsonb) language plpgsql stable security definer set search_path='' as $$
begin
  if pl_private.current_role() is null then raise exception 'Acceso denegado'; end if;
  return query select a.id,case a.entity when 'pl_clients' then 'clients' when 'pl_templates' then 'templates' when 'pl_documents' then 'documents' else 'other' end,case when a.entity in ('pl_clients','pl_templates') or a.entity='pl_documents' and pl_private.current_role() in ('admin','owner') then a.entity_id else '' end,
    case a.entity
      when 'pl_clients' then (select jsonb_build_object('id',c.id,'payload',c.payload-'passportImageBase64'||jsonb_build_object('documentCount',c.document_count),'revision',c.revision,'archived',c.archived,'approved',true) from public.pl_clients c where c.id=a.entity_id)
      when 'pl_templates' then (select jsonb_build_object('id',t.id,'payload',t.payload-'fileData'||jsonb_build_object('usageCount',t.usage_count),'revision',t.revision,'archived',t.archived,'approved',t.approved) from public.pl_templates t where t.id=a.entity_id and (t.approved or pl_private.current_role()='owner' or t.submitted_by=auth.uid()))
      when 'pl_documents' then (select jsonb_build_object('id',d.id,'payload',d.payload-'fileBase64','revision',d.revision,'archived',false,'approved',true) from public.pl_documents d where d.id=a.entity_id and pl_private.current_role() in ('admin','owner'))
      else null end
    from public.pl_audit a where a.id>after_cursor order by a.id limit 1000;
end $$;
create function public.pl_update_document_title(entity_id text,title text,expected_revision integer) returns void language plpgsql security definer set search_path='' as $$
begin
  if pl_private.current_role() is distinct from 'owner' then raise exception 'Solo el propietario puede modificar el historial'; end if;
  if length(trim(title)) not between 1 and 300 then raise exception 'Título inválido'; end if;
  update public.pl_documents set payload=payload||jsonb_build_object('title',trim(title)),revision=nextval('public.pl_revision_seq') where id=entity_id and revision=expected_revision;
  if not found then raise exception 'El documento cambió. Actualiza antes de editar.'; end if;
end $$;
revoke all on function public.pl_sync_cursor(),public.pl_entity_counts(),public.pl_changes(bigint),public.pl_update_document_title(text,text,integer) from public,anon;
grant execute on function public.pl_sync_cursor(),public.pl_entity_counts(),public.pl_changes(bigint),public.pl_update_document_title(text,text,integer) to authenticated;
revoke insert,update on public.pl_documents from authenticated;
alter function public.pl_record_document(jsonb) security definer;

-- Replacement accepts both historical inline files and current private paths.
create or replace function public.pl_restore_database(backup jsonb) returns void language plpgsql security definer set search_path='' as $$
declare item jsonb;
begin
  if pl_private.current_role() is distinct from 'owner' then raise exception 'Solo el propietario puede restaurar'; end if;
  if jsonb_typeof(backup->'clients') is distinct from 'array' or jsonb_typeof(backup->'templates') is distinct from 'array' or jsonb_typeof(backup->'documents') is distinct from 'array' then raise exception 'Respaldo inválido'; end if;
  if backup ? 'version' and backup->>'version' not in ('3.0','3.0.0','4.0') then raise exception 'Versión de respaldo incompatible'; end if;
  for item in select value from jsonb_array_elements(backup->'clients') loop
    if coalesce(item->>'id','')='' or coalesce(item->>'fullName','')='' or coalesce(item->>'passportNumber','')='' then raise exception 'Cliente inválido'; end if;
  end loop;
  for item in select value from jsonb_array_elements(backup->'templates') loop
    if coalesce(item->>'id','')='' or coalesce(item->>'name','')='' or (coalesce(item->>'fileData','')='' and coalesce(item->>'filePath','')='') then raise exception 'Plantilla inválida'; end if;
  end loop;
  for item in select value from jsonb_array_elements(backup->'documents') loop
    if coalesce(item->>'id','')='' or coalesce(item->>'fileName','')='' then raise exception 'Documento inválido'; end if;
  end loop;
  if backup ? 'lawyers' then
    if jsonb_typeof(backup->'lawyers') is distinct from 'array' or jsonb_array_length(backup->'lawyers')=0 then raise exception 'Lista de letrados inválida'; end if;
    for item in select value from jsonb_array_elements(backup->'lawyers') loop
      if coalesce(item->>'id','')='' or coalesce(item->>'name','')='' or coalesce(item->>'formalTitle','')='' then raise exception 'Letrado inválido'; end if;
    end loop;
  end if;
  lock table public.pl_clients,public.pl_templates,public.pl_documents in exclusive mode;
  perform public.pl_backup_before_restore('before-restore');
  delete from public.pl_documents; delete from public.pl_clients; delete from public.pl_templates;
  insert into public.pl_clients(id,payload,archived,revision)
    select value->>'id',value,coalesce((value->>'archived')::boolean,false),nextval('public.pl_revision_seq') from jsonb_array_elements(backup->'clients');
  insert into public.pl_templates(id,payload,archived,approved,revision)
    select value->>'id',value,coalesce((value->>'archived')::boolean,false),coalesce((value->>'approved')::boolean,true),nextval('public.pl_revision_seq') from jsonb_array_elements(backup->'templates');
  insert into public.pl_documents(id,payload,generated_live) select value->>'id',value,false from jsonb_array_elements(backup->'documents');
  if backup ? 'lawyers' then
    delete from public.pl_lawyers;
    insert into public.pl_lawyers(id,payload) select value->>'id',value from jsonb_array_elements(backup->'lawyers');
  end if;
end $$;
create function public.pl_restore_saved_backup(backup_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare snapshot jsonb;
begin
  if pl_private.current_role() is distinct from 'owner' then raise exception 'Solo el propietario puede restaurar'; end if;
  select backup into snapshot from public.pl_backups where id=backup_id;
  if snapshot is null then raise exception 'Respaldo no encontrado'; end if;
  perform public.pl_restore_database(snapshot);
end $$;
revoke all on function public.pl_restore_saved_backup(uuid) from public,anon;
grant execute on function public.pl_restore_saved_backup(uuid) to authenticated;

-- Enrolled accounts require their second factor at the database boundary too.
create or replace function pl_private.current_role() returns text language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null then return null; end if;
  if exists(select 1 from auth.mfa_factors where user_id=auth.uid() and status='verified') and coalesce(auth.jwt()->>'aal','aal1')<>'aal2' then return null; end if;
  return (select role from public.pl_profiles where id=auth.uid() and active);
end $$;
create function public.pl_schema_version() returns integer language sql immutable set search_path='' as $$select 2$$;
revoke all on function public.pl_schema_version() from public;
grant execute on function public.pl_schema_version() to anon,authenticated;

create table public.pl_lawyers(id text primary key,payload jsonb not null check(jsonb_typeof(payload)='object' and payload->>'id'=id),revision integer not null default nextval('public.pl_revision_seq'));
alter table public.pl_lawyers enable row level security;
create policy pl_lawyers_read on public.pl_lawyers for select to authenticated using((select pl_private.current_role()) is not null);
grant select on public.pl_lawyers to authenticated;
create trigger pl_lawyers_audit after insert or update or delete on public.pl_lawyers for each row execute function pl_private.audit_change();
create function public.pl_list_lawyers() returns jsonb language sql stable security invoker set search_path='' as $$ select coalesce(jsonb_agg(payload||jsonb_build_object('revision',revision) order by payload->>'name'),'[]') from public.pl_lawyers $$;
create function public.pl_save_lawyer(document jsonb,expected_revision integer default null) returns void language plpgsql security definer set search_path='' as $$
begin
  if pl_private.current_role() is distinct from 'owner' then raise exception 'Solo el propietario puede gestionar letrados'; end if;
  if jsonb_typeof(document) is distinct from 'object' or coalesce(document->>'id','')='' or jsonb_typeof(document->'name') is distinct from 'string' or jsonb_typeof(document->'formalTitle') is distinct from 'string' or length(trim(document->>'name')) not between 1 and 200 or length(trim(document->>'formalTitle')) not between 1 and 200 then raise exception 'Datos del letrado inválidos'; end if;
  if expected_revision is null then insert into public.pl_lawyers(id,payload) values(document->>'id',document);
  else update public.pl_lawyers set payload=document,revision=nextval('public.pl_revision_seq') where id=document->>'id' and revision=expected_revision;
    if not found then raise exception 'El letrado cambió. Actualiza antes de guardar.'; end if;
  end if;
end $$;
revoke all on function public.pl_list_lawyers(),public.pl_save_lawyer(jsonb,integer) from public,anon;
grant execute on function public.pl_list_lawyers(),public.pl_save_lawyer(jsonb,integer) to authenticated;

insert into public.pl_lawyers(id,payload) values
('antony-talla','{"id":"antony-talla","name":"Antony Talla","formalTitle":"Lcdo. Antony Nathanael Talla Copris","gender":"M","role":"Abogado Idóneo / Consultor Legal","colegiado":"Idoneidad 30553 · Cédula 8-849-2485","cedula":"8-849-2485","idoneidad":"30553","email":"antony.talla@sqplegal.com","phone":"+507 830-5220","initials":"AT","color":"rose","badgeBg":"bg-rose-50 text-rose-800 border-rose-200","badgeText":"text-rose-700","description":"Especialista en Tramitación Notarial, Extranjería, Migración y Poderes de Representación."}'::jsonb),
('susana-sabalza','{"id":"susana-sabalza","name":"Susana Sabalza","formalTitle":"Licda. Susana Sabalza","gender":"F","role":"Abogada Idónea / Letrada Directora","colegiado":"Idoneidad 29811 · Cédula 8-740-1290","cedula":"8-740-1290","idoneidad":"29811","email":"susana.sabalza@sqplegal.com","phone":"+507 830-5221","initials":"SS","color":"emerald","badgeBg":"bg-emerald-50 text-emerald-800 border-emerald-200","badgeText":"text-emerald-700","description":"Especialista en Poderes Notariales, Contratos de Asesoría Jurídica y Representación Legal."}'::jsonb),
('marta-aparicio','{"id":"marta-aparicio","name":"Marta Aparicio","formalTitle":"Licda. Marta Aparicio","gender":"F","role":"Abogada Idónea / Consultora Legal","colegiado":"Idoneidad 31042 · Cédula 8-802-1455","cedula":"8-802-1455","idoneidad":"31042","email":"marta.aparicio@sqplegal.com","phone":"+507 830-5222","initials":"MA","color":"blue","badgeBg":"bg-blue-50 text-blue-800 border-blue-200","badgeText":"text-blue-700","description":"Especialista en Derecho Migratorio, Solicitudes de Residencia, Extranjería y Nacionalidad."}'::jsonb),
('lizohar-godoy','{"id":"lizohar-godoy","name":"Lizohar Godoy","formalTitle":"Licda. Lizohar Godoy","gender":"F","role":"Abogada Idónea / Consultora Legal","colegiado":"Idoneidad 28940 · Cédula 4-725-1903","cedula":"4-725-1903","idoneidad":"28940","email":"lizohar.godoy@sqplegal.com","phone":"+507 830-5223","initials":"LG","color":"purple","badgeBg":"bg-purple-50 text-purple-800 border-purple-200","badgeText":"text-purple-700","description":"Especialista en Contratos de Prestación de Servicios, Cláusulas Civiles y Defensa Jurídica."}'::jsonb),
('martin-downer','{"id":"martin-downer","name":"Martín Downer","formalTitle":"Lic. Martín Downer","gender":"M","role":"Abogado Idóneo / Consultor Legal","colegiado":"Idoneidad 30114 · Cédula 8-780-2219","cedula":"8-780-2219","idoneidad":"30114","email":"martin.downer@sqplegal.com","phone":"+507 830-5224","initials":"MD","color":"amber","badgeBg":"bg-amber-50 text-amber-900 border-amber-200","badgeText":"text-amber-700","description":"Especialista en Derecho Corporativo, Poderes de Representación Notarial y Trámites Internacionales."}'::jsonb);

commit;
