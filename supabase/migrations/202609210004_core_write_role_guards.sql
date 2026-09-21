begin;
-- Existing permissive membership policies remain for compatibility. These
-- restrictive policies enforce the API's write limits even over direct REST.
create policy events_insert_role_guard on public.events as restrictive
  for insert to authenticated with check (public.has_org_role(organization_id,array['admin','producer']));
create policy events_update_role_guard on public.events as restrictive
  for update to authenticated using (public.has_org_role(organization_id,array['admin','producer']))
  with check (public.has_org_role(organization_id,array['admin','producer']));
create policy events_no_hard_delete on public.events as restrictive
  for delete to authenticated using (false);
create policy clients_insert_role_guard on public.clients as restrictive
  for insert to authenticated with check (public.has_org_role(organization_id,array['admin','producer','sales']));
create policy clients_update_role_guard on public.clients as restrictive
  for update to authenticated using (public.has_org_role(organization_id,array['admin','producer','sales']))
  with check (public.has_org_role(organization_id,array['admin','producer','sales']));
create policy clients_no_hard_delete on public.clients as restrictive
  for delete to authenticated using (false);
notify pgrst,'reload schema';
commit;
