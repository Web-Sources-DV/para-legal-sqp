create index pl_usage_user on public.pl_usage(user_id);
drop policy pl_resources_manage on public.pl_resources;
create policy pl_resources_insert on public.pl_resources for insert to authenticated with check ((select pl_private.current_role()) = 'owner');
create policy pl_resources_update on public.pl_resources for update to authenticated using ((select pl_private.current_role()) = 'owner') with check ((select pl_private.current_role()) = 'owner');
create policy pl_resources_delete on public.pl_resources for delete to authenticated using ((select pl_private.current_role()) = 'owner');

