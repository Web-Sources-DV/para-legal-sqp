begin;
insert into auth.mfa_factors(user_id,status) values('00000000-0000-0000-0000-000000000001','verified');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claims','{"aal":"aal1"}',true);
set local role authenticated;
do $$ begin
  if pl_private.current_role() is not null then raise exception 'MFA bypassed at database boundary'; end if;
  begin perform public.pl_export_database(); raise exception 'AAL1 exported data'; exception when others then if sqlerrm='AAL1 exported data' then raise; end if; end;
end $$;
select set_config('request.jwt.claims','{"aal":"aal2"}',true);
do $$ begin
  if pl_private.current_role()<>'owner' then raise exception 'Verified factor session blocked'; end if;
  begin insert into storage.objects(bucket_id,name) values('para-legal-private','00000000-0000-0000-0000-000000000002/documents/forged.docx');raise exception 'Cross-user upload allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
set local role anon;
do $$ begin
  if public.pl_schema_version()<>3 then raise exception 'Schema compatibility endpoint failed'; end if;
  begin perform public.pl_sync_cursor();raise exception 'Anonymous synchronization allowed';exception when insufficient_privilege then null;end;
end $$;
rollback;
select 'PASS: MFA assurance, private file upload ownership, anonymous denial, schema gate' as result;
