begin;

-- Global / org-scoped pricing configuration table for Performance Lab OS
create table if not exists public.pricing_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  settings jsonb not null check (jsonb_typeof(settings) = 'object'),
  version integer not null default 1 check (version > 0),
  updated_at timestamptz not null default now()
);

alter table public.pricing_settings enable row level security;

create policy pricing_settings_read on public.pricing_settings
  for select to authenticated
  using (public.has_org_role(organization_id, array['admin','producer','sales']));

create policy pricing_settings_insert on public.pricing_settings
  for insert to authenticated
  with check (public.has_org_role(organization_id, array['admin','producer']));

create policy pricing_settings_update on public.pricing_settings
  for update to authenticated
  using (public.has_org_role(organization_id, array['admin','producer']))
  with check (public.has_org_role(organization_id, array['admin','producer']));

grant select, insert, update on public.pricing_settings to authenticated;

create trigger pricing_settings_updated before update on public.pricing_settings
  for each row execute function public.crm_set_updated_at();

commit;
