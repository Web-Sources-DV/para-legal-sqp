create or replace function pl_private.refresh_document_counts() returns trigger language plpgsql security definer set search_path = '' as $$
declare old_client text; old_template text; new_client text; new_template text;
begin
  if auth.uid() is null or pl_private.current_role() is null then raise exception 'Acceso denegado'; end if;
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

