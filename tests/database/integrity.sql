begin;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
set local role authenticated;
select public.pl_save_entity('clients','{"id":"client-a","fullName":"TEST CLIENT","passportNumber":"TEST001","docType":"pasaporte","issuingCountry":"PANAMÁ"}',null);
select public.pl_save_entity('templates','{"id":"template-a","name":"TEST TEMPLATE","fileData":"VEVTVA==","placeholders":[],"version":1}',null);
do $$ begin
  if (select payload ? 'fileData' from public.pl_list_entities('templates') where id='template-a') then raise exception 'Metadata leaked binary'; end if;
  if (public.pl_entity_file('templates','template-a')->>'data') <> 'VEVTVA==' then raise exception 'Legacy file inaccessible'; end if;
  perform public.pl_save_entity('clients','{"id":"client-a","fullName":"UPDATED","passportNumber":"TEST001","docType":"pasaporte","issuingCountry":"PANAMÁ"}',(select revision from public.pl_clients where id='client-a'));
  begin
    perform public.pl_save_entity('clients','{"id":"client-a","fullName":"STALE","passportNumber":"TEST001","docType":"pasaporte"}',1);
    raise exception 'Stale revision accepted';
  exception when others then if sqlerrm='Stale revision accepted' then raise; end if; end;
  begin
    perform public.pl_save_entity('clients','{"id":"client-b","fullName":"DUPLICATE","passportNumber":"TEST001","docType":"pasaporte","issuingCountry":"PANAMÁ"}',null);
    raise exception 'Duplicate identity accepted';
  exception when others then if sqlerrm='Duplicate identity accepted' then raise; end if; end;
  if jsonb_array_length(public.pl_list_lawyers())<>5 then raise exception 'Initial lawyer configuration missing'; end if;
  if (select count(*) from public.pl_changes(0) where entity='clients')<1 then raise exception 'No incremental changes'; end if;
end $$;
reset role;
insert into public.pl_profiles(id,display_name,role) values('00000000-0000-0000-0000-000000000002','TEST MEMBER','user');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
select public.pl_save_entity('templates','{"id":"template-pending","name":"PENDING","fileData":"VEVTVA==","placeholders":[]}',null);
do $$ begin
  if not exists(select 1 from public.pl_list_entities('templates') where id='template-pending' and approved=false) then raise exception 'Proposer cannot see pending status'; end if;
  begin update public.pl_templates set approved=true where id='template-pending'; raise exception 'Approval bypassed'; exception when insufficient_privilege then null; end;
  begin perform public.pl_archive_entity('clients','client-a',(select revision from public.pl_clients where id='client-a')); raise exception 'Member archived client'; exception when others then if sqlerrm='Member archived client' then raise; end if; end;
  begin perform public.pl_save_lawyer('{"id":"forged","name":"FORGED","formalTitle":"FORGED"}',null); raise exception 'Member changed credentials'; exception when others then if sqlerrm='Member changed credentials' then raise; end if; end;
  if exists(select 1 from public.pl_audit) then raise exception 'Audit leaked'; end if;
  if exists(select 1 from public.pl_backups) then raise exception 'Backup leaked'; end if;
end $$;
insert into storage.objects(bucket_id,name) values('para-legal-private','00000000-0000-0000-0000-000000000002/documents/test.docx');
select public.pl_record_document('{"id":"doc-a","fileName":"test.docx","filePath":"00000000-0000-0000-0000-000000000002/documents/test.docx","clientId":"client-a","templateId":"template-a","generatedAt":"1900-01-01"}');
select public.pl_record_document('{"id":"doc-a","fileName":"test.docx","filePath":"00000000-0000-0000-0000-000000000002/documents/test.docx"}');
do $$ begin
  if public.pl_entity_file('documents','doc-a') is not null then raise exception 'Member can read history file metadata'; end if;
  if exists(select 1 from public.pl_changes(0) where entity='documents' and record is not null) then raise exception 'History leaked in delta'; end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
select public.pl_approve_template('template-pending',(select revision from public.pl_templates where id='template-pending'));
select public.pl_archive_entity('clients','client-a',(select revision from public.pl_clients where id='client-a'));
do $$ begin
  if exists(select 1 from public.pl_list_entities('clients') where id='client-a') then raise exception 'Archived client visible'; end if;
  if not exists(select 1 from public.pl_documents where id='doc-a') then raise exception 'Archive destroyed history'; end if;
  if (select count(*) from public.pl_usage where id='doc-a')<>1 then raise exception 'Retry duplicated usage'; end if;
  if (select (payload->>'generatedAt')::timestamptz<now()-interval '1 minute' from public.pl_documents where id='doc-a') then raise exception 'Spoofed timestamp'; end if;
  perform public.pl_update_document_title('doc-a','Correct title',(select revision from public.pl_documents where id='doc-a'));
  begin perform public.pl_update_document_title('doc-a','Stale title',1); raise exception 'Stale history update accepted'; exception when others then if sqlerrm='Stale history update accepted' then raise; end if; end;
  perform public.pl_restore_database('{"clients":[],"templates":[],"documents":[]}');
  if not exists(select 1 from public.pl_backups where backup->'clients' @> '[{"id":"client-a"}]') then raise exception 'Previous state not preserved'; end if;
  perform public.pl_restore_saved_backup((select id from public.pl_backups where backup->'clients' @> '[{"id":"client-a"}]' order by created_at desc limit 1));
  if not exists(select 1 from public.pl_clients where id='client-a' and archived) then raise exception 'Saved backup did not restore archived state'; end if;
  if (select count(*) from public.pl_usage where id='doc-a')<>1 then raise exception 'Recovery altered usage'; end if;
end $$;
rollback;
select 'PASS: revisions, duplicates, metadata, legacy files, deltas, approvals, archives, audit, backup, timestamps, idempotency' as result;
