-- Public visitors share records but cannot access account/admin data.
begin;
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claims','{"role":"anon"}',true);
set local role anon;
do $$
declare revision integer; doc_count integer;
begin
  perform public.pl_public_save_entity('clients','{"id":"public-client","fullName":"PUBLIC CLIENT","passportNumber":"PUBLIC001","docType":"pasaporte"}'::jsonb,null);
  perform public.pl_public_save_entity('templates','{"id":"public-template","name":"PUBLIC TEMPLATE","placeholders":[],"fileData":"VEVTVA=="}'::jsonb,null);
  if not exists(select 1 from public.pl_public_list_entities('clients') where id='public-client') then raise exception 'Public client missing'; end if;
  if not exists(select 1 from public.pl_public_list_entities('templates') where id='public-template' and approved) then raise exception 'Public template not approved'; end if;
  select e.revision into revision from public.pl_public_list_entities('clients') e where id='public-client';
  perform public.pl_public_save_entity('clients','{"id":"public-client","fullName":"EDITED PUBLIC CLIENT","passportNumber":"PUBLIC001","docType":"pasaporte"}'::jsonb,revision);
  begin
    perform public.pl_public_save_entity('clients','{"id":"public-client","fullName":"STALE","passportNumber":"PUBLIC001","docType":"pasaporte"}'::jsonb,revision);
    raise exception 'Stale revision accepted';
  exception when others then if sqlerrm='Stale revision accepted' then raise; end if; end;
  insert into storage.objects(bucket_id,name) values('para-legal-private','shared/documents/00000000-0000-0000-0000-000000000090');
  perform public.pl_public_record_document('{"id":"public-document","clientId":"public-client","templateId":"public-template","fileName":"public.docx","filePath":"shared/documents/00000000-0000-0000-0000-000000000090"}'::jsonb);
  perform public.pl_public_record_document('{"id":"public-document","clientId":"public-client","templateId":"public-template","fileName":"public.docx","filePath":"shared/documents/00000000-0000-0000-0000-000000000090"}'::jsonb);
  select count(*) into doc_count from public.pl_public_list_entities('documents') where id='public-document';
  if doc_count<>1 then raise exception 'Public retry duplicated'; end if;
  if public.pl_public_entity_file('templates','public-template')->>'data'<>'VEVTVA==' then raise exception 'Public file unavailable'; end if;
  if public.pl_public_entity_counts()->>'clients' is null then raise exception 'Missing counts'; end if;
  perform public.pl_public_changes(0);
  select e.revision into revision from public.pl_public_list_entities('documents') e where id='public-document';
  perform public.pl_public_update_document_title('public-document','PUBLIC TITLE',revision);
  perform public.pl_public_delete_document('public-document');
  select e.revision into revision from public.pl_public_list_entities('clients') e where id='public-client';
  perform public.pl_public_archive_entity('clients','public-client',revision);
  if exists(select 1 from public.pl_public_list_entities('clients') where id='public-client') then raise exception 'Archived client still visible'; end if;
  begin perform 1 from public.pl_profiles; raise exception 'Public profiles exposed'; exception when insufficient_privilege then null; end;
  begin perform 1 from public.pl_backups; raise exception 'Public backups exposed'; exception when insufficient_privilege then null; end;
  begin perform public.pl_restore_database('{"clients":[],"templates":[],"documents":[]}'::jsonb); raise exception 'Public restoration exposed'; exception when insufficient_privilege then null; end;
  begin insert into storage.objects(bucket_id,name) values('other-app','shared/documents/00000000-0000-0000-0000-000000000090'); raise exception 'Other bucket writable'; exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
  if exists(select 1 from public.pl_usage where id='public-document') then raise exception 'Anonymous account usage event created'; end if;
end $$;
rollback;
