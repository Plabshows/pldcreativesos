begin;
create table public.task_inbox_receipts (
 organization_id uuid not null references public.organizations(id),
 task_id uuid not null references public.tasks(id) on delete cascade,
 user_id uuid not null references public.users(id) on delete cascade,
 seen_version integer not null check(seen_version>0), seen_at timestamptz not null default now(),
 primary key(task_id,user_id)
);
alter table public.task_inbox_receipts enable row level security;
create policy inbox_own_read on public.task_inbox_receipts for select to authenticated using(user_id=auth.uid() and public.has_org_role(organization_id,array['admin','producer','sales']));
create policy inbox_own_insert on public.task_inbox_receipts for insert to authenticated with check(user_id=auth.uid() and exists(select 1 from public.tasks t where t.id=task_id and t.organization_id=task_inbox_receipts.organization_id and t.owner_id=auth.uid() and t.deleted_at is null));
create policy inbox_own_update on public.task_inbox_receipts for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid() and exists(select 1 from public.tasks t where t.id=task_id and t.organization_id=task_inbox_receipts.organization_id and t.owner_id=auth.uid() and t.deleted_at is null));
grant select,insert,update on public.task_inbox_receipts to authenticated;
create trigger inbox_tenant before insert or update on public.task_inbox_receipts for each row execute function public.enforce_tenant_references();
create index inbox_owner on public.tasks(organization_id,owner_id) where deleted_at is null;
notify pgrst,'reload schema';
commit;
