begin;
-- Public document workspace. Account, backup and audit APIs remain restricted.
alter table public.pl_documents alter column created_by drop not null;
update public.pl_templates set approved=true,revision=nextval('public.pl_revision_seq') where not approved;


create function public.pl_public_list_entities(entity text, after_id text default '', page_size integer default 100, query text default '', include_archived boolean default false)
returns table(id text,payload jsonb,revision integer,archived boolean,approved boolean,sort_key text) language plpgsql security definer set search_path='' as $$
begin
  if page_size < 1 or page_size > 1000 then raise exception 'Tamaño de página inválido'; end if;
  if entity='clients' then
    return query select c.id,c.payload-'passportImageBase64'||jsonb_build_object('documentCount',c.document_count),c.revision,c.archived,true,c.id
      from public.pl_clients c where c.id>after_id and (include_archived or not c.archived)
      and (query='' or c.payload->>'fullName' ilike '%'||query||'%' or c.payload->>'passportNumber' ilike '%'||query||'%') order by c.id limit page_size;
  elsif entity='templates' then
    return query select t.id,t.payload-'fileData'||jsonb_build_object('usageCount',t.usage_count),t.revision,t.archived,t.approved,t.id
      from public.pl_templates t where t.id>after_id and (include_archived or not t.archived)
      and (query='' or t.payload->>'name' ilike '%'||query||'%') order by t.id limit page_size;
  elsif entity='documents' then
    return query select d.id,d.payload-'fileBase64',d.revision,false,true,d.created_at::text||'|'||d.id from public.pl_documents d
      where (after_id='' or (d.created_at,d.id)<(nullif(split_part(after_id,'|',1),'')::timestamptz,split_part(after_id,'|',2))) and (query='' or d.payload->>'clientName' ilike '%'||query||'%' or d.payload->>'title' ilike '%'||query||'%') order by d.created_at desc,d.id desc limit page_size;
  else raise exception 'Entidad inválida'; end if;
end $$;

revoke all on function public.pl_public_list_entities(text,text,integer,text,boolean) from public;
grant execute on function public.pl_public_list_entities(text,text,integer,text,boolean) to anon,authenticated;

create function public.pl_public_entity_file(entity text, entity_id text) returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if entity='clients' then return (select jsonb_build_object('data',payload->>'passportImageBase64','path',payload->>'imagePath') from public.pl_clients where id=entity_id);
  elsif entity='templates' then return (select jsonb_build_object('data',payload->>'fileData','path',payload->>'filePath') from public.pl_templates where id=entity_id);
  elsif entity='documents' then return (select jsonb_build_object('data',payload->>'fileBase64','path',payload->>'filePath') from public.pl_documents where id=entity_id);
  else raise exception 'Entidad inválida'; end if;
end $$;

revoke all on function public.pl_public_entity_file(text,text) from public;
grant execute on function public.pl_public_entity_file(text,text) to anon,authenticated;

create function public.pl_public_save_entity(entity text, document jsonb, expected_revision integer default null) returns integer
language plpgsql security definer set search_path='' as $$
declare result integer; entity_id text:=document->>'id'; field text; parsed_date date;
begin
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
      insert into public.pl_templates(id,payload,approved,submitted_by) values(entity_id,document,true,auth.uid()) returning revision into result;
    else
      update public.pl_templates set payload=payload||document,revision=nextval('public.pl_revision_seq'),updated_at=now(),approved=true,submitted_by=auth.uid()
      where id=entity_id and revision=expected_revision and not archived returning revision into result;
    end if;
  else raise exception 'Entidad inválida'; end if;
  if result is null then raise exception 'El registro cambió o fue archivado. Actualiza antes de guardar.'; end if;
  return result;
end $$;

revoke all on function public.pl_public_save_entity(text,jsonb,integer) from public;
grant execute on function public.pl_public_save_entity(text,jsonb,integer) to anon,authenticated;

create function public.pl_public_archive_entity(entity text,entity_id text,expected_revision integer) returns void language plpgsql security definer set search_path='' as $$
declare changed integer;
begin
  if entity='clients' then update public.pl_clients set archived=true,revision=nextval('public.pl_revision_seq'),updated_at=now() where id=entity_id and revision=expected_revision;
  elsif entity='templates' then update public.pl_templates set archived=true,revision=nextval('public.pl_revision_seq'),updated_at=now() where id=entity_id and revision=expected_revision;
  else raise exception 'Entidad inválida'; end if;
  get diagnostics changed=row_count;
  if changed<>1 then raise exception 'El registro cambió. Actualiza antes de archivar.'; end if;
end $$;

revoke all on function public.pl_public_archive_entity(text,text,integer) from public;
grant execute on function public.pl_public_archive_entity(text,text,integer) to anon,authenticated;

create function public.pl_public_approve_template(entity_id text,expected_revision integer) returns void language plpgsql security definer set search_path='' as $$
begin
  update public.pl_templates set approved=true,revision=nextval('public.pl_revision_seq') where id=entity_id and revision=expected_revision and not archived;
  if not found then raise exception 'La plantilla cambió. Actualiza antes de aprobar.'; end if;
end $$;

revoke all on function public.pl_public_approve_template(text,integer) from public;
grant execute on function public.pl_public_approve_template(text,integer) to anon,authenticated;

create or replace function public.pl_public_record_document(document jsonb) returns void language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from public.pl_documents where id=document->>'id') then
    
    return;
  end if;
  if not exists(select 1 from public.pl_clients where id=document->>'clientId' and not archived) then raise exception 'Cliente no disponible'; end if;
  if not exists(select 1 from public.pl_templates where id=document->>'templateId' and not archived and approved) then raise exception 'Plantilla no disponible o pendiente de aprobación'; end if;
  if jsonb_typeof(document) is distinct from 'object' or coalesce(document->>'id','')='' or coalesce(document->>'fileName','')='' or (coalesce(document->>'fileBase64','')='' and coalesce(document->>'filePath','')='') then raise exception 'Documento inválido'; end if;
  if coalesce(document->>'filePath','')<>'' then
    if document->>'filePath' not like 'shared/documents/%' or not exists(select 1 from storage.objects where bucket_id='para-legal-private' and name=document->>'filePath') then raise exception 'Ruta de documento inválida'; end if;
  end if;
  begin insert into public.pl_documents(id,payload) values(document->>'id',document);
  exception when unique_violation then null; end;
end $$;

revoke all on function public.pl_public_record_document(jsonb) from public;
grant execute on function public.pl_public_record_document(jsonb) to anon,authenticated;

create function public.pl_public_sync_cursor() returns bigint language plpgsql stable security definer set search_path='' as $$
begin
  return (select coalesce(max(id),0) from public.pl_audit);
end $$;

revoke all on function public.pl_public_sync_cursor() from public;
grant execute on function public.pl_public_sync_cursor() to anon,authenticated;

create function public.pl_public_entity_counts() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  return jsonb_build_object('clients',(select count(*) from public.pl_clients where not archived),'templates',(select count(*) from public.pl_templates where not archived),'documents',(select count(*) from public.pl_documents));
end $$;

revoke all on function public.pl_public_entity_counts() from public;
grant execute on function public.pl_public_entity_counts() to anon,authenticated;

create function public.pl_public_changes(after_cursor bigint) returns table(cursor bigint,entity text,id text,record jsonb) language plpgsql stable security definer set search_path='' as $$
begin
  return query select a.id,case a.entity when 'pl_clients' then 'clients' when 'pl_templates' then 'templates' when 'pl_documents' then 'documents' else 'other' end,case when a.entity in ('pl_clients','pl_templates') or a.entity='pl_documents' then a.entity_id else '' end,
    case a.entity
      when 'pl_clients' then (select jsonb_build_object('id',c.id,'payload',c.payload-'passportImageBase64'||jsonb_build_object('documentCount',c.document_count),'revision',c.revision,'archived',c.archived,'approved',true) from public.pl_clients c where c.id=a.entity_id)
      when 'pl_templates' then (select jsonb_build_object('id',t.id,'payload',t.payload-'fileData'||jsonb_build_object('usageCount',t.usage_count),'revision',t.revision,'archived',t.archived,'approved',t.approved) from public.pl_templates t where t.id=a.entity_id)
      when 'pl_documents' then (select jsonb_build_object('id',d.id,'payload',d.payload-'fileBase64','revision',d.revision,'archived',false,'approved',true) from public.pl_documents d where d.id=a.entity_id)
      else null end
    from public.pl_audit a where a.id>after_cursor order by a.id limit 1000;
end $$;

revoke all on function public.pl_public_changes(bigint) from public;
grant execute on function public.pl_public_changes(bigint) to anon,authenticated;

create function public.pl_public_update_document_title(entity_id text,title text,expected_revision integer) returns void language plpgsql security definer set search_path='' as $$
begin
  if length(trim(title)) not between 1 and 300 then raise exception 'Título inválido'; end if;
  update public.pl_documents set payload=payload||jsonb_build_object('title',trim(title)),revision=nextval('public.pl_revision_seq') where id=entity_id and revision=expected_revision;
  if not found then raise exception 'El documento cambió. Actualiza antes de editar.'; end if;
end $$;

revoke all on function public.pl_public_update_document_title(text,text,integer) from public;
grant execute on function public.pl_public_update_document_title(text,text,integer) to anon,authenticated;

create function public.pl_public_list_lawyers() returns jsonb language sql stable security definer set search_path='' as $$ select coalesce(jsonb_agg(payload||jsonb_build_object('revision',revision) order by payload->>'name'),'[]') from public.pl_lawyers $$;

revoke all on function public.pl_public_list_lawyers() from public;
grant execute on function public.pl_public_list_lawyers() to anon,authenticated;

create or replace function pl_private.refresh_document_counts() returns trigger language plpgsql security definer set search_path = '' as $$
declare old_client text; old_template text; new_client text; new_template text;
begin
  if tg_op <> 'INSERT' then old_client := old.payload->>'clientId'; old_template := old.payload->>'templateId'; end if;
  if tg_op <> 'DELETE' then new_client := new.payload->>'clientId'; new_template := new.payload->>'templateId'; end if;
  if tg_op = 'DELETE' or (tg_op = 'UPDATE' and old_client is distinct from new_client) then
    update public.pl_clients set document_count=greatest(0,document_count-1) where id=old_client;
  end if;
  if tg_op = 'INSERT' or (tg_op = 'UPDATE' and old_client is distinct from new_client) then
    update public.pl_clients set document_count=document_count+1 where id=new_client;
  end if;
  if tg_op = 'DELETE' or (tg_op = 'UPDATE' and old_template is distinct from new_template) then
    update public.pl_templates set usage_count=greatest(0,usage_count-1) where id=old_template;
  end if;
  if tg_op = 'INSERT' or (tg_op = 'UPDATE' and old_template is distinct from new_template) then
    update public.pl_templates set usage_count=usage_count+1 where id=new_template;
  end if;
  return null;
end;
$$;
revoke all on function pl_private.refresh_document_counts() from public, anon, authenticated;




-- Anonymous documents have no individual author; no account usage event is created.
create or replace function pl_private.record_usage() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.generated_live and new.created_by is not null then
    insert into public.pl_usage(id,user_id,created_at) values(new.id,new.created_by,new.created_at) on conflict(id) do nothing;
  end if;
  return null;
end $$;
revoke all on function pl_private.record_usage() from public,anon,authenticated;
create function public.pl_public_delete_document(entity_id text) returns void language plpgsql security definer set search_path='' as $$
begin
  delete from public.pl_documents where id=entity_id;
end $$;
revoke all on function public.pl_public_delete_document(text) from public;
grant execute on function public.pl_public_delete_document(text) to anon,authenticated;
grant usage on schema storage to anon;
grant select,insert on storage.objects to anon;
-- Public visitors may read existing and new Para Legal objects, but never other buckets.
create policy pl_public_file_read on storage.objects for select to anon,authenticated
using (bucket_id='para-legal-private');
create policy pl_public_file_insert on storage.objects for insert to anon,authenticated
with check (bucket_id='para-legal-private' and name ~ '^shared/(clients|templates|documents)/[0-9a-f-]{36}$');
-- No public object overwrite or deletion. Profiles, backups, audit and other apps stay protected.
create or replace function public.pl_schema_version() returns integer language sql immutable set search_path='' as $$select 3$$;
commit;
