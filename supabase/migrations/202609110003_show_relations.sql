-- Shows are first-class records so the same show can be linked to many events.
create table if not exists public.shows (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  show_code text not null,
  name text not null,
  category text,
  description text,
  public_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, show_code),
  unique (organization_id, name),
  check (length(trim(name)) between 1 and 200)
);

create table if not exists public.event_shows (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  show_id uuid not null references public.shows(id) on delete restrict,
  quantity integer not null default 1 check (quantity > 0),
  notes text,
  created_at timestamptz not null default now(),
  unique (event_id, show_id)
);

alter table public.shows enable row level security;
alter table public.event_shows enable row level security;

create policy shows_read on public.shows for select to authenticated
  using (public.has_org_role(organization_id, array['admin','producer','sales']));
create policy shows_insert on public.shows for insert to authenticated
  with check (public.has_org_role(organization_id, array['admin','producer']));
create policy shows_update on public.shows for update to authenticated
  using (public.has_org_role(organization_id, array['admin','producer']))
  with check (public.has_org_role(organization_id, array['admin','producer']));

create policy event_shows_read on public.event_shows for select to authenticated
  using (public.has_org_role(organization_id, array['admin','producer','sales','wardrobe']));
create policy event_shows_insert on public.event_shows for insert to authenticated
  with check (public.has_org_role(organization_id, array['admin','producer']));
create policy event_shows_update on public.event_shows for update to authenticated
  using (public.has_org_role(organization_id, array['admin','producer']))
  with check (public.has_org_role(organization_id, array['admin','producer']));

create trigger shows_enforce_tenant before insert or update on public.shows
  for each row execute function public.enforce_tenant_references();
create trigger event_shows_enforce_tenant before insert or update on public.event_shows
  for each row execute function public.enforce_tenant_references();
create trigger shows_audit_change after insert or update on public.shows
  for each row execute function public.audit_business_change();

