begin;
alter table public.inventory_event_allocations add constraint inventory_rental_nonnegative check (rental_revenue >= 0);
create function public.guard_inventory_item_availability() returns trigger
language plpgsql security invoker set search_path=public,pg_temp as $$
begin
  if new.status='AVAILABLE' and old.status is distinct from new.status then
    if exists(select 1 from public.inventory_event_allocations where inventory_item_id=new.id and status in ('RESERVED','OUT')) then
      raise exception 'Devuelve o cancela la reserva desde el evento antes de liberar la pieza';
    end if;
    if exists(select 1 from public.inventory_repairs where inventory_item_id=new.id and status<>'DONE') then
      raise exception 'Resuelve la incidencia antes de liberar la pieza';
    end if;
  end if;
  return new;
end $$;
revoke all on function public.guard_inventory_item_availability() from public;
create trigger inventory_item_availability before update of status on public.inventory_items for each row execute function public.guard_inventory_item_availability();
notify pgrst,'reload schema';
commit;

