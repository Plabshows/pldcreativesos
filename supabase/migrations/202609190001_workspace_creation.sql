create extension if not exists unaccent;

-- A signed-in user may create a separate workspace and becomes its first administrator.
create or replace function public.create_workspace(workspace_name text) returns uuid language plpgsql
security definer set search_path=public,pg_temp as $$
declare result uuid; clean_name text; base_slug text; candidate_slug text; suffix integer:=0;
begin
  if auth.uid() is null then raise exception 'Inicia sesión.'; end if;
  clean_name:=btrim(workspace_name);
  if length(clean_name)<2 or length(clean_name)>80 then raise exception 'El nombre debe tener entre 2 y 80 caracteres.'; end if;
  insert into public.users(id,full_name) values(auth.uid(),'') on conflict(id) do nothing;
  base_slug:=trim(both '-' from regexp_replace(lower(unaccent(clean_name)),'[^a-z0-9]+','-','g'));
  if base_slug='' then base_slug:='espacio'; end if;
  candidate_slug:=base_slug;
  while exists(select 1 from public.organizations where slug=candidate_slug) loop suffix:=suffix+1; candidate_slug:=base_slug||'-'||suffix; end loop;
  insert into public.organizations(name,slug) values(clean_name,candidate_slug) returning id into result;
  insert into public.organization_members(organization_id,user_id,role) values(result,auth.uid(),'admin');
  return result;
end; $$;
revoke all on function public.create_workspace(text) from public;
grant execute on function public.create_workspace(text) to authenticated;
