begin;

-- The event board is a quick planning surface.  Creating a supplier, its
-- expense and recalculating the event must therefore be one transaction.
create extension if not exists unaccent;

create or replace function public.set_event_provider_expense(
  target_org uuid,
  target_event uuid,
  target_expense uuid,
  target_supplier uuid,
  target_supplier_name text,
  target_amount bigint,
  remove_expense boolean default false
) returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  event_row public.events;
  expense_row public.expenses;
  supplier_row public.suppliers;
  category_uuid uuid;
  resulting_expense uuid;
  provider_name text;
  normalized text;
  total bigint;
begin
  if auth.uid() is null or not public.has_org_role(target_org, array['admin','producer']) then
    raise exception 'No tienes permiso para modificar los gastos del evento';
  end if;
  if target_amount is not null and target_amount < 0 then
    raise exception 'Indica un importe válido';
  end if;

  select * into event_row
  from public.events
  where id = target_event and organization_id = target_org and deleted_at is null
  for update;
  if not found then raise exception 'Evento no disponible'; end if;

  if target_expense is not null then
    select * into expense_row
    from public.expenses
    where id = target_expense and organization_id = target_org and event_id = target_event and talent_id is null
    for update;
    if not found then raise exception 'Gasto de proveedor no disponible'; end if;

    if exists(select 1 from public.expense_payments where expense_id = expense_row.id and organization_id = target_org) then
      raise exception 'Este gasto ya tiene pagos. Modifícalo desde Facturación & Gastos.';
    end if;

    if remove_expense then
      update public.expenses set status = 'cancelled' where id = expense_row.id;
      select coalesce(sum(total_cents), 0) into total
      from public.expenses
      where organization_id = target_org and event_id = target_event and talent_id is null and status <> 'cancelled';
      if exists(select 1 from public.expenses where organization_id = target_org and event_id = target_event and talent_id is null and status <> 'cancelled' and total_cents is null) then total := null; end if;
      update public.events set expenses_cents = total, updated_at = now() where id = target_event and organization_id = target_org;
      return expense_row.id;
    end if;
  elsif remove_expense then
    raise exception 'Gasto de proveedor no disponible';
  end if;

  if target_supplier is not null then
    select * into supplier_row
    from public.suppliers
    where id = target_supplier and organization_id = target_org and deleted_at is null and merged_into is null
    for update;
    if not found then raise exception 'Proveedor no disponible'; end if;
    provider_name := supplier_row.name;
  elsif nullif(trim(coalesce(target_supplier_name, '')), '') is not null then
    provider_name := trim(target_supplier_name);
    normalized := lower(regexp_replace(unaccent(provider_name), '[^a-zA-Z0-9]+', '', 'g'));
    select * into supplier_row
    from public.suppliers
    where organization_id = target_org and normalized_name = normalized and deleted_at is null and merged_into is null
    for update;
    if not found then
      insert into public.suppliers(organization_id, name, normalized_name)
      values(target_org, provider_name, normalized)
      returning * into supplier_row;
    end if;
    provider_name := supplier_row.name;
  elsif expense_row.id is not null then
    provider_name := expense_row.supplier_name;
    if expense_row.supplier_id is not null then
      select * into supplier_row from public.suppliers where id = expense_row.supplier_id and organization_id = target_org;
    end if;
  else
    raise exception 'Indica el proveedor o servicio';
  end if;

  if target_expense is null then
    select id into category_uuid
    from public.expense_categories
    where organization_id = target_org and name = 'Otros'
    order by id
    limit 1;
    if category_uuid is null then raise exception 'Falta la categoría «Otros» para registrar este gasto'; end if;

    insert into public.expenses(
      organization_id, event_id, supplier_id, supplier_name, category_id,
      expense_date, concept, total_cents, estimated_cents, currency, status, created_by
    ) values (
      target_org, target_event, supplier_row.id, provider_name, category_uuid,
      coalesce(event_row.event_date, current_date), 'Proveedor · ' || provider_name,
      target_amount, target_amount, 'EUR', 'pending', auth.uid()
    ) returning id into resulting_expense;
  else
    update public.expenses
    set supplier_id = coalesce(supplier_row.id, supplier_id),
        supplier_name = provider_name,
        total_cents = target_amount,
        estimated_cents = target_amount
    where id = expense_row.id
    returning id into resulting_expense;
  end if;

  select coalesce(sum(total_cents), 0) into total
  from public.expenses
  where organization_id = target_org and event_id = target_event and talent_id is null and status <> 'cancelled';
  if exists(select 1 from public.expenses where organization_id = target_org and event_id = target_event and talent_id is null and status <> 'cancelled' and total_cents is null) then total := null; end if;
  update public.events set expenses_cents = total, updated_at = now() where id = target_event and organization_id = target_org;
  return resulting_expense;
end;
$$;

revoke all on function public.set_event_provider_expense(uuid,uuid,uuid,uuid,text,bigint,boolean) from public, anon;
grant execute on function public.set_event_provider_expense(uuid,uuid,uuid,uuid,text,bigint,boolean) to authenticated;
notify pgrst, 'reload schema';
commit;
