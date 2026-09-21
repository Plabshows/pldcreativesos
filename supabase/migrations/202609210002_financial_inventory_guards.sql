begin;

-- Additive containment: no business rows, workspaces or memberships are changed.
alter table public.financial_audit_log enable row level security;
alter table public.invoice_event_allocations enable row level security;
revoke all on public.financial_audit_log, public.invoice_event_allocations from anon, public;
revoke all on public.financial_audit_log from authenticated;
grant select on public.financial_audit_log to authenticated;
revoke all on public.invoice_event_allocations from authenticated;
grant select, insert, update on public.invoice_event_allocations to authenticated;

create policy financial_audit_admin_read on public.financial_audit_log
  for select to authenticated using (public.has_org_role(organization_id, array['admin']));
create policy invoice_allocations_read on public.invoice_event_allocations
  for select to authenticated using (public.has_org_role(organization_id, array['admin','producer','sales']));
create policy invoice_allocations_insert on public.invoice_event_allocations
  for insert to authenticated with check (public.has_org_role(organization_id, array['admin','producer']));
create policy invoice_allocations_update on public.invoice_event_allocations
  for update to authenticated using (public.has_org_role(organization_id, array['admin','producer']))
  with check (public.has_org_role(organization_id, array['admin','producer']));

-- Reuse the existing guard: every referenced record must belong to this org.
do $$ declare t text; begin
  foreach t in array array['inventory_concepts','inventory_items','inventory_repairs','inventory_event_allocations','invoice_event_allocations'] loop
    execute format('create trigger audit_tenant_guard before insert or update on public.%I for each row execute function public.enforce_tenant_references()', t);
  end loop;
end $$;

-- An identified physical unit must match its concept, and cannot represent 4 units.
create function public.inventory_allocation_item_guard() returns trigger
language plpgsql security invoker set search_path=public,pg_temp as $$
begin
  if new.inventory_item_id is not null then
    if new.quantity is distinct from 1 then
      raise exception 'Una unidad física solo puede reservarse con cantidad 1.';
    end if;
    if not exists(select 1 from public.inventory_items i where i.id=new.inventory_item_id
      and i.organization_id=new.organization_id and i.concept_id=new.concept_id) then
      raise exception 'La unidad física no pertenece al concepto seleccionado.';
    end if;
  end if;
  return new;
end $$;
revoke all on function public.inventory_allocation_item_guard() from public;
create trigger allocation_item_guard before insert or update on public.inventory_event_allocations
for each row execute function public.inventory_allocation_item_guard();

create index inventory_items_org_concept on public.inventory_items(organization_id,concept_id);
create index inventory_repairs_org_item on public.inventory_repairs(organization_id,inventory_item_id);
create index inventory_allocations_org_event on public.inventory_event_allocations(organization_id,event_id);
create index inventory_allocations_org_concept on public.inventory_event_allocations(organization_id,concept_id);
notify pgrst, 'reload schema';
commit;
