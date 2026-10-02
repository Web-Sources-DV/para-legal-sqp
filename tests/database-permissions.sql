-- Run through an administrative SQL connection. Everything rolls back.
begin;
select set_config('pl_test.owner', (select id::text from public.pl_profiles where role='owner'), true);
select set_config('pl_test.member', (select id::text from auth.users where id not in (select id from public.pl_profiles) limit 1), true);
do $$ begin
  if nullif(current_setting('pl_test.member'), '') is null then raise exception 'A second Auth account is required for this test'; end if;
end $$;
insert into public.pl_profiles(id,display_name,role) values(current_setting('pl_test.member')::uuid,'PRUEBA DE PERMISOS','user');
insert into public.pl_resources(id,content) values('pl-permission-fixture','TEST');
insert into public.pl_clients(id,payload) values('test','{"id":"test","fullName":"PRUEBA","passportNumber":"TEST"}');
insert into public.pl_templates(id,payload) values('test','{"id":"test","name":"PRUEBA"}');

set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('pl_test.member'),true);
do $$ begin
  if (select count(*) from public.pl_resources) <> 0 then raise exception 'Normal user can read resources'; end if;
  if (select count(*) from public.pl_profiles) <> 1 then raise exception 'Normal user can read other profiles'; end if;
  begin
    perform public.pl_restore_database('{"clients":[],"templates":[],"documents":[]}'::jsonb);
    raise exception 'Normal user restored database';
  exception when others then
    if sqlerrm = 'Normal user restored database' then raise; end if;
  end;
end $$;
select public.pl_record_document('{"id":"pl-permission-test","fileName":"prueba.docx","fileBase64":"VEVTVA==","title":"PRUEBA","generatedAt":"2026-10-02","dataSnapshot":{},"clientId":"test","clientName":"PRUEBA","templateId":"test","templateName":"PRUEBA","passportNumber":"TEST","fileSizeFormatted":"4 B"}'::jsonb);
select public.pl_record_document('{"id":"pl-permission-test","fileName":"prueba.docx","fileBase64":"VEVTVA=="}'::jsonb);
do $$ begin
  if (select count(*) from public.pl_documents) <> 0 then raise exception 'Normal user can read history'; end if;
  if (select count(*) from public.pl_usage) <> 0 then raise exception 'Normal user can read statistics'; end if;
  if (select document_count from public.pl_clients where id='test') <> 1 then raise exception 'Client count wrong'; end if;
  if (select usage_count from public.pl_templates where id='test') <> 1 then raise exception 'Template count wrong'; end if;
  update public.pl_profiles set role='owner' where id=auth.uid();
  if pl_private.current_role() <> 'user' then raise exception 'Normal user escalated privilege'; end if;
end $$;

reset role;
update public.pl_profiles set role='admin' where id=current_setting('pl_test.member')::uuid;
set local role authenticated;
do $$ begin
  if (select count(*) from public.pl_documents where id='pl-permission-test') <> 1 then raise exception 'Admin cannot read history'; end if;
  if (select count(*) from public.pl_resources where id='pl-permission-fixture') <> 1 then raise exception 'Admin cannot read resources'; end if;
  delete from public.pl_documents where id='pl-permission-test';
  update public.pl_resources set content='MODIFIED' where id='pl-permission-fixture';
  if (select count(*) from public.pl_documents where id='pl-permission-test') <> 1 then raise exception 'Admin deleted history'; end if;
  if (select content from public.pl_resources where id='pl-permission-fixture') <> 'TEST' then raise exception 'Admin changed resource'; end if;
  begin
    perform public.pl_restore_database('{"clients":[],"templates":[],"documents":[]}'::jsonb);
    raise exception 'Admin restored database';
  exception when others then
    if sqlerrm = 'Admin restored database' then raise; end if;
  end;
  if (select count(*) from public.pl_usage) <> 0 then raise exception 'Admin read statistics'; end if;
end $$;

select set_config('request.jwt.claim.sub',current_setting('pl_test.owner'),true);
do $$ begin
  if (select count(*) from public.pl_usage where id='pl-permission-test') <> 1 then raise exception 'Duplicate usage event or owner cannot read'; end if;
  update public.pl_resources set content='OWNER' where id='pl-permission-fixture';
  if (select content from public.pl_resources where id='pl-permission-fixture') <> 'OWNER' then raise exception 'Owner cannot edit resource'; end if;
  update public.pl_profiles set role='user' where id=auth.uid();
  if pl_private.current_role() <> 'owner' then raise exception 'Owner account was demoted'; end if;
  delete from public.pl_documents where id='pl-permission-test';
  if (select count(*) from public.pl_documents where id='pl-permission-test') <> 0 then raise exception 'Owner cannot delete history'; end if;
  if (select count(*) from public.pl_usage where id='pl-permission-test') <> 1 then raise exception 'History deletion destroyed usage audit'; end if;
  if (select document_count from public.pl_clients where id='test') <> 0 then raise exception 'Deletion did not decrement count'; end if;
  begin
    perform public.pl_restore_database('{"clients":[{"id":"broken"}],"templates":[],"documents":[]}'::jsonb);
    raise exception 'Invalid backup accepted';
  exception when others then
    if sqlerrm = 'Invalid backup accepted' then raise; end if;
  end;
  if not exists(select 1 from public.pl_clients where id='test') then raise exception 'Invalid backup destroyed data'; end if;
  perform public.pl_restore_database('{"clients":[{"id":"restored","fullName":"PRUEBA","passportNumber":"TEST"}],"templates":[],"documents":[{"id":"restored-document","fileName":"prueba.docx"}]}'::jsonb);
  if exists(select 1 from public.pl_usage where id='restored-document') then raise exception 'Restored history invented usage'; end if;
  if not exists(select 1 from public.pl_clients where id='restored') then raise exception 'Owner cannot restore'; end if;
end $$;

reset role;
update public.pl_profiles set active=false where id=current_setting('pl_test.member')::uuid;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('pl_test.member'),true);
do $$ begin
  if pl_private.current_role() is not null then raise exception 'Disabled account still has permissions'; end if;
  if (select count(*) from public.pl_resources) <> 0 then raise exception 'Disabled account still reads data'; end if;
end $$;
reset role;
rollback;
select 'PASS: normal, admin, owner, inactive, no role escalation, immutable usage, idempotent document registration' as result;

