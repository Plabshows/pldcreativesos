begin;

-- Keep closed usage history and its financial meaning stable.
create function public.guard_inventory_allocation_history() returns trigger
language plpgsql security invoker set search_path=public,pg_temp as $$
begin
  if old.status in ('RETURNED','CANCELLED') and new.status is distinct from old.status then
    raise exception 'La reserva está cerrada. Crea otra reserva para un nuevo uso.';
  end if;
  if new.event_id is distinct from old.event_id or new.concept_id is distinct from old.concept_id
    or new.inventory_item_id is distinct from old.inventory_item_id or new.quantity is distinct from old.quantity then
    raise exception 'No se puede trasladar una asignación. Cancela la reserva activa y crea otra.';
  end if;
  return new;
end $$;
revoke all on function public.guard_inventory_allocation_history() from public;
create trigger inventory_allocation_history before update on public.inventory_event_allocations
for each row execute function public.guard_inventory_allocation_history();

-- Recompute from ALL unresolved incidents, rather than the last one edited.
create or replace function public.sync_inventory_incident() returns trigger
language plpgsql security invoker set search_path=public,pg_temp as $$
declare current_state text; incident_state text; allocation_state text;
begin
  select status into current_state from public.inventory_items
    where id=new.inventory_item_id and organization_id=new.organization_id for update;
  if current_state='RETIRED' then return new; end if;
  select case when r.incident_type='lost' then 'LOST'
    when r.incident_type='cleaning' and r.status<>'NOT_REPAIRABLE' then 'CLEANING' else 'REPAIR' end
    into incident_state from public.inventory_repairs r
    where r.inventory_item_id=new.inventory_item_id and r.organization_id=new.organization_id and r.status<>'DONE'
    order by case when r.incident_type='lost' then 0 when r.status='NOT_REPAIRABLE' or r.incident_type in ('damage','repair') then 1 else 2 end,r.id limit 1;
  if incident_state is not null then
    update public.inventory_items set status=incident_state
      where id=new.inventory_item_id and organization_id=new.organization_id;
  elsif new.status='DONE' and current_state in ('REPAIR','CLEANING','LOST') then
    select case when a.status='OUT' then 'OUT' else 'RESERVED' end into allocation_state
      from public.inventory_event_allocations a
      where a.inventory_item_id=new.inventory_item_id and a.organization_id=new.organization_id and a.status in ('OUT','RESERVED')
      order by a.id limit 1;
    update public.inventory_items set status=coalesce(allocation_state,'AVAILABLE')
      where id=new.inventory_item_id and organization_id=new.organization_id;
  end if;
  return new;
end $$;
notify pgrst,'reload schema';
commit;
