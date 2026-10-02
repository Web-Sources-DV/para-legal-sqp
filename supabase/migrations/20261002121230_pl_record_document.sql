create function public.pl_record_document(document jsonb) returns void language plpgsql security invoker set search_path = '' as $$
begin
  if pl_private.current_role() is null then raise exception 'Acceso denegado'; end if;
  if jsonb_typeof(document) is distinct from 'object' or coalesce(document->>'id','') = '' or coalesce(document->>'fileName','') = '' or coalesce(document->>'fileBase64','') = '' then raise exception 'Documento inválido'; end if;
  insert into public.pl_documents(id,payload) values(document->>'id',document) on conflict(id) do nothing;
end;
$$;
revoke all on function public.pl_record_document(jsonb) from public, anon;
grant execute on function public.pl_record_document(jsonb) to authenticated;

