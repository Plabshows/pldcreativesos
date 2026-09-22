begin;
-- One master remains public.shows. Sections are access-scoped extensions, never a second catalogue.
create table public.show_kit_sections (
 show_id uuid not null references public.shows(id) on delete cascade,
 organization_id uuid not null references public.organizations(id) on delete cascade,
 section text not null check(section in ('sales','media','tech','artist','warehouse','maintenance')),
 document jsonb not null default '{"fields":{},"assets":[],"items":[]}',
 version integer not null default 1 check(version>0),
 updated_at timestamptz not null default now(),
 primary key(show_id,section),
 check(jsonb_typeof(document)='object')
);
create function public.validate_show_kit() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from public.shows where id=new.show_id and organization_id=new.organization_id) then raise exception 'Show fuera del espacio de trabajo'; end if;
 if tg_op='UPDATE' then
 if new.show_id<>old.show_id or new.section<>old.section or new.organization_id<>old.organization_id then raise exception 'Referencia inmutable'; end if;
 new.version:=old.version+1;
 end if;
 new.updated_at:=now(); return new;
end $$;
create trigger validate_show_kit before insert or update on public.show_kit_sections for each row execute function public.validate_show_kit();
alter table public.show_kit_sections enable row level security;
grant select,insert,update,delete on public.show_kit_sections to authenticated;
create policy kit_read on public.show_kit_sections for select to authenticated using (
 public.has_org_role(organization_id,array['admin','producer']) or
 section in ('sales','media','tech') and public.has_org_role(organization_id,array['sales']) or
 section in ('warehouse','maintenance') and public.has_org_role(organization_id,array['wardrobe']));
create policy kit_insert on public.show_kit_sections for insert to authenticated with check (
 public.has_org_role(organization_id,array['admin','producer']) or
 section in ('sales','media','tech') and public.has_org_role(organization_id,array['sales']) or
 section in ('warehouse','maintenance') and public.has_org_role(organization_id,array['wardrobe']));
create policy kit_update on public.show_kit_sections for update to authenticated using (
 public.has_org_role(organization_id,array['admin','producer']) or
 section in ('sales','media','tech') and public.has_org_role(organization_id,array['sales']) or
 section in ('warehouse','maintenance') and public.has_org_role(organization_id,array['wardrobe'])) with check (
 public.has_org_role(organization_id,array['admin','producer']) or
 section in ('sales','media','tech') and public.has_org_role(organization_id,array['sales']) or
 section in ('warehouse','maintenance') and public.has_org_role(organization_id,array['wardrobe']));
-- Safe catalogue metadata for warehouse, without granting access to shows pricing columns.
create function public.show_kit_catalogue() returns table(id uuid,name text,category text,description text,public_url text,organization_id uuid)
language sql stable security definer set search_path=public as $$
 select id,name,category,description,public_url,organization_id from public.shows s where active and public.has_org_role(s.organization_id,array['admin','producer','sales','wardrobe']);
$$;
revoke all on function public.show_kit_catalogue() from public,anon;
grant execute on function public.show_kit_catalogue() to authenticated;

create table public.show_kit_shares (
 id uuid primary key default gen_random_uuid(), token uuid not null unique default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 show_id uuid references public.shows(id) on delete cascade,
 audience text not null check(audience in ('artist','client')),
 document jsonb not null, expires_at timestamptz not null default now()+interval '7 days',
 revoked_at timestamptz, created_at timestamptz not null default now()
);
alter table public.show_kit_shares enable row level security;
grant select,insert,update on public.show_kit_shares to authenticated;
create policy shares_read on public.show_kit_shares for select to authenticated using(public.has_org_role(organization_id,array['admin','producer']) or audience='client' and public.has_org_role(organization_id,array['sales']));
create policy shares_insert on public.show_kit_shares for insert to authenticated with check((public.has_org_role(organization_id,array['admin','producer']) or audience='client' and public.has_org_role(organization_id,array['sales'])) and exists(select 1 from public.shows s where s.id=show_id and s.organization_id=show_kit_shares.organization_id));
create policy shares_update on public.show_kit_shares for update to authenticated using(public.has_org_role(organization_id,array['admin','producer']) or audience='client' and public.has_org_role(organization_id,array['sales'])) with check(public.has_org_role(organization_id,array['admin','producer']) or audience='client' and public.has_org_role(organization_id,array['sales']));
create function public.read_show_kit_share(share_token uuid) returns jsonb language sql stable security definer set search_path=public as $$
 select document from public.show_kit_shares where token=share_token and revoked_at is null and expires_at>now();
$$;
revoke all on function public.read_show_kit_share(uuid) from public;
grant execute on function public.read_show_kit_share(uuid) to anon,authenticated;
create table public.event_kit_checklists (
 event_id uuid primary key references public.events(id) on delete cascade,
 organization_id uuid not null references public.organizations(id) on delete cascade,
 checked jsonb not null default '{}', version integer not null default 1, updated_at timestamptz not null default now()
);
alter table public.event_kit_checklists enable row level security;
grant select,insert,update on public.event_kit_checklists to authenticated;
create policy checklist_read on public.event_kit_checklists for select to authenticated using(public.has_org_role(organization_id,array['admin','producer','wardrobe']));
create policy checklist_insert on public.event_kit_checklists for insert to authenticated with check(public.has_org_role(organization_id,array['admin','producer','wardrobe']) and exists(select 1 from public.events e where e.id=event_id and e.organization_id=event_kit_checklists.organization_id));
create policy checklist_update on public.event_kit_checklists for update to authenticated using(public.has_org_role(organization_id,array['admin','producer','wardrobe'])) with check(public.has_org_role(organization_id,array['admin','producer','wardrobe']) and exists(select 1 from public.events e where e.id=event_id and e.organization_id=event_kit_checklists.organization_id));
commit;

