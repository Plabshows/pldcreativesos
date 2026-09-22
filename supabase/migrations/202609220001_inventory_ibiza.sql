begin;

alter table public.inventory_concepts
  add column subcategory text,
  add column family text,
  add column unit_kind text not null default 'unit' check (unit_kind in ('unit','set','components')),
  add column declared_quantity integer check (declared_quantity >= 0),
  add column owner_name text,
  add column inventory_month text,
  add column inventory_source text,
  add column review_status text,
  add column duplicate_review text,
  add column quantity_confirmation text,
  add column performer_price bigint check (performer_price >= 0);

alter table public.inventory_items
  add column sublocation text,
  add column purchase_cost bigint check (purchase_cost >= 0),
  add column estimated_value bigint check (estimated_value >= 0);
alter table public.inventory_items drop constraint inventory_items_condition_check;
alter table public.inventory_items add constraint inventory_items_condition_check
  check (condition in ('UNCHECKED','NEW','EXCELLENT','GOOD','USED','DAMAGED'));
alter table public.inventory_items drop constraint inventory_items_status_check;
alter table public.inventory_items add constraint inventory_items_status_check
  check (status in ('AVAILABLE','RESERVED','OUT','RENTED','REPAIR','CLEANING','LOST','RETIRED'));
alter table public.inventory_repairs add column incident_type text not null default 'damage'
  check (incident_type in ('damage','lost','repair','cleaning'));

-- Serialize reservations at concept level. Existing rows and historical links survive.
create or replace function public.save_inventory_allocation(target_org uuid, payload jsonb)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare
  c public.inventory_concepts; e public.events; a public.inventory_event_allocations;
  picked uuid[]; uid uuid; result jsonb := '[]'::jsonb;
  wanted integer := coalesce((payload->>'quantity')::integer,1);
  next_status text := coalesce(payload->>'status','RESERVED');
  old_id uuid := (payload->>'id')::uuid;
  return_state text := coalesce(payload->>'return_item_status','AVAILABLE');
begin
  if not public.has_org_role(target_org,array['admin','producer','sales']) then raise exception 'Sin permiso de inventario'; end if;
  if next_status not in ('RESERVED','OUT','RETURNED','CANCELLED') or wanted < 1 then raise exception 'Asignación no válida'; end if;
  if return_state not in ('AVAILABLE','REPAIR','CLEANING','LOST') then raise exception 'Devolución no válida'; end if;
  select * into c from public.inventory_concepts where id=(payload->>'concept_id')::uuid and organization_id=target_org for update;
  if not found then raise exception 'Concepto no encontrado'; end if;
  select * into e from public.events where id=(payload->>'event_id')::uuid and organization_id=target_org for update;
  if not found then raise exception 'Evento no encontrado'; end if;
  if next_status in ('RESERVED','OUT') and (e.status::text in ('completed','cancelled') or e.deleted_at is not null or not c.active) then
    raise exception 'El evento o artículo no está activo';
  end if;
  if old_id is not null then
    select * into a from public.inventory_event_allocations where id=old_id and organization_id=target_org for update;
    if not found or a.event_id<>e.id or a.concept_id<>c.id then raise exception 'Asignación no encontrada'; end if;
    if next_status in ('RESERVED','OUT') and a.status not in ('RESERVED','OUT') then raise exception 'Crea una nueva reserva para reutilizar este material'; end if;
    if wanted<>a.quantity then raise exception 'Cancela la reserva y vuelve a asignar la cantidad necesaria'; end if;
    if a.inventory_item_id is not null and next_status='RETURNED' and return_state<>'AVAILABLE' then
      update public.inventory_items set status=return_state where id=a.inventory_item_id and organization_id=target_org;
    end if;
    update public.inventory_event_allocations set status=next_status,
      rental_revenue=case when payload ? 'rental_revenue' then (payload->>'rental_revenue')::bigint else rental_revenue end,
      notes=case when payload ? 'notes' then payload->>'notes' else notes end,
      out_at=case when next_status='OUT' then coalesce(out_at,now()) else out_at end,
      returned_at=case when next_status='RETURNED' then now() else returned_at end, updated_at=now()
      where id=a.id returning * into a;
    return to_jsonb(a);
  end if;
  if next_status not in ('RESERVED','OUT') then raise exception 'Una reserva nueva debe estar reservada o en evento'; end if;
  if payload->>'inventory_item_id' is not null and wanted<>1 then raise exception 'Selecciona una sola pieza'; end if;
  -- Legacy quantity-only reservations also consume stock until returned/cancelled.
  select array_agg(id order by item_code,id) into picked from (
    select i.id,i.item_code from public.inventory_items i where i.concept_id=c.id and i.organization_id=target_org
      and i.status='AVAILABLE'
      and (payload->>'inventory_item_id' is null or i.id=(payload->>'inventory_item_id')::uuid)
      and not exists(select 1 from public.inventory_event_allocations x where x.inventory_item_id=i.id and x.status in ('RESERVED','OUT'))
    order by i.item_code,i.id limit wanted for update
  ) q;
  if coalesce(array_length(picked,1),0)<wanted or
    (select count(*) from public.inventory_items where concept_id=c.id and status='AVAILABLE') -
    coalesce((select sum(quantity) from public.inventory_event_allocations where concept_id=c.id and inventory_item_id is null and status in ('RESERVED','OUT')),0)<wanted
  then raise exception 'No hay suficientes unidades disponibles. Devuelve o cancela las reservas anteriores.'; end if;
  foreach uid in array picked loop
    insert into public.inventory_event_allocations(organization_id,event_id,concept_id,inventory_item_id,quantity,status,rental_revenue,notes,out_at)
      values(target_org,e.id,c.id,uid,1,next_status,
      case when uid=picked[1] then (payload->>'rental_revenue')::bigint when payload->>'rental_revenue' is not null then 0 else null end,
      payload->>'notes',case when next_status='OUT' then now() else null end) returning * into a;
    result := result || jsonb_build_array(to_jsonb(a));
  end loop;
  return result;
end $$;
revoke all on function public.save_inventory_allocation(uuid,jsonb) from public,anon;
grant execute on function public.save_inventory_allocation(uuid,jsonb) to authenticated;

create function public.sync_inventory_allocation_status() returns trigger
language plpgsql security invoker set search_path=public,pg_temp as $$
declare target_item uuid; next_state text;
begin
  target_item:=new.inventory_item_id;
  if target_item is null then return new; end if;
  select status into next_state from public.inventory_items where id=target_item for update;
  if new.status in ('RESERVED','OUT') then
    if next_state not in ('AVAILABLE','RESERVED','OUT','RENTED') then raise exception 'La pieza tiene una incidencia o está retirada'; end if;
    if exists(select 1 from public.inventory_event_allocations where inventory_item_id=target_item and id<>new.id and status in ('RESERVED','OUT')) then raise exception 'Esta pieza ya tiene una reserva activa'; end if;
    update public.inventory_items set status=new.status,last_event_id=new.event_id,
      last_used_at=case when new.status='OUT' then now() else last_used_at end where id=target_item;
  elsif new.status in ('RETURNED','CANCELLED') and next_state in ('RESERVED','OUT','RENTED') then
    if not exists(select 1 from public.inventory_repairs where inventory_item_id=target_item and status in ('PENDING','IN_PROGRESS')) then
      update public.inventory_items set status='AVAILABLE' where id=target_item;
    end if;
  end if;
  return new;
end $$;
revoke all on function public.sync_inventory_allocation_status() from public;
create trigger inventory_allocation_status after insert or update of status on public.inventory_event_allocations
for each row execute function public.sync_inventory_allocation_status();

create function public.complete_event_inventory() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if new.status::text in ('completed','cancelled') and new.status is distinct from old.status then
    update public.inventory_event_allocations set status=case when new.status::text='completed' then 'RETURNED' else 'CANCELLED' end,
      returned_at=case when new.status::text='completed' then now() else returned_at end,updated_at=now()
      where event_id=new.id and organization_id=new.organization_id and status in ('RESERVED','OUT');
  end if;
  return new;
end $$;
revoke all on function public.complete_event_inventory() from public;
create trigger complete_event_inventory after update of status on public.events for each row execute function public.complete_event_inventory();

create function public.sync_inventory_incident() returns trigger
language plpgsql security invoker set search_path=public,pg_temp as $$
begin
  if new.status in ('PENDING','IN_PROGRESS','NOT_REPAIRABLE') then
    update public.inventory_items set status=case when new.incident_type='lost' then 'LOST' when new.incident_type='cleaning' then 'CLEANING' else 'REPAIR' end
      where id=new.inventory_item_id and organization_id=new.organization_id;
  elsif new.status='DONE' and not exists(select 1 from public.inventory_repairs where inventory_item_id=new.inventory_item_id and id<>new.id and status<>'DONE') then
    update public.inventory_items set status=coalesce((select case when a.status='OUT' then 'OUT' else 'RESERVED' end from public.inventory_event_allocations a
      where a.inventory_item_id=new.inventory_item_id and a.status in ('OUT','RESERVED') limit 1),'AVAILABLE')
      where id=new.inventory_item_id and organization_id=new.organization_id and status in ('REPAIR','CLEANING','LOST');
  end if;
  return new;
end $$;
revoke all on function public.sync_inventory_incident() from public;
create trigger inventory_incident_status after insert or update on public.inventory_repairs for each row execute function public.sync_inventory_incident();
notify pgrst,'reload schema';
commit;
