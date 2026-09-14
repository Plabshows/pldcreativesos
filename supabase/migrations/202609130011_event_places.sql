begin;
create table public.event_places (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id),
 kind text not null check(kind in ('city','venue')),
 name text not null check(length(trim(name)) between 1 and 500),
 name_key text generated always as (lower(trim(name))) stored,
 created_at timestamptz not null default now(),
 unique(organization_id,kind,name_key)
);
alter table public.event_places enable row level security;
create policy places_read on public.event_places for select to authenticated using(public.has_org_role(organization_id,array['admin','producer','sales']));
create policy places_insert on public.event_places for insert to authenticated with check(public.has_org_role(organization_id,array['admin','producer']));
grant select,insert on public.event_places to authenticated;
insert into public.event_places(organization_id,kind,name)
select organization_id,'city',trim(city) from public.events where nullif(trim(city),'') is not null
union select organization_id,'venue',trim(venue) from public.events where nullif(trim(venue),'') is not null
on conflict do nothing;
notify pgrst,'reload schema';
commit;
