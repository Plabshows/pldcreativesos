create table if not exists public.client_groups (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id),
 name text not null check(length(trim(name)) between 1 and 120),
 position numeric not null default 0,
 color text not null default '#0073ea',
 unique(organization_id,name)
);
alter table public.client_groups enable row level security;
create policy client_groups_read on public.client_groups for select to authenticated using(public.has_org_role(organization_id,array['admin','producer','sales']));
create policy client_groups_insert on public.client_groups for insert to authenticated with check(public.has_org_role(organization_id,array['admin','producer','sales']));
create policy client_groups_update on public.client_groups for update to authenticated using(public.has_org_role(organization_id,array['admin','producer','sales'])) with check(public.has_org_role(organization_id,array['admin','producer','sales']));
alter table public.clients
 add column if not exists group_id uuid references public.client_groups(id),
 add column if not exists position numeric not null default 0,
 add column if not exists contact_name text,
 add column if not exists phone text,
 add column if not exists email text,
 add column if not exists company text,
 add column if not exists fiscal_data text,
 add column if not exists monday_source jsonb;
create index if not exists clients_group_position on public.clients(organization_id,group_id,position);
create trigger client_groups_tenant before insert or update on public.client_groups for each row execute function public.enforce_tenant_references();
-- Validates group references even on older installations without the baseline trigger.
drop trigger if exists clients_board_tenant on public.clients;
create trigger clients_board_tenant before insert or update on public.clients for each row execute function public.enforce_tenant_references();
grant select,insert,update on public.client_groups to authenticated;
