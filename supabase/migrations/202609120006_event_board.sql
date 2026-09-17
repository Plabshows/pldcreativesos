alter table public.events add column if not exists board_position numeric not null default 0;
alter table public.events add column if not exists wardrobe_notes text;
create table if not exists public.event_talent (
 organization_id uuid not null references public.organizations(id),
 event_id uuid not null references public.events(id) on delete cascade,
 talent_id uuid not null references public.talent(id),
 role text, status text not null default 'requested', agreed_cost_cents bigint not null default 0, notes text,
 primary key(event_id,talent_id)
);
alter table public.event_talent enable row level security;
create policy event_talent_board_read on public.event_talent for select to authenticated using(public.has_org_role(organization_id,array['admin','producer','sales']));
create policy event_talent_board_write on public.event_talent for all to authenticated using(public.has_org_role(organization_id,array['admin','producer'])) with check(public.has_org_role(organization_id,array['admin','producer']));
create trigger event_talent_board_tenant before insert or update on public.event_talent for each row execute function public.enforce_tenant_references();
create policy event_shows_board_delete on public.event_shows for delete to authenticated using(public.has_org_role(organization_id,array['admin','producer']));
grant select,insert,update,delete on public.event_talent to authenticated;
notify pgrst,'reload schema';
