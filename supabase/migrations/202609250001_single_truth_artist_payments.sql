begin;

-- Single Source of Truth for Artist Payments in Performance Lab OS
-- Ensures 1 payment record per (organization_id, event_id, talent_id) with atomic fee and status updates.

create or replace function public.upsert_artist_payment(
  target_org uuid,
  target_event uuid,
  target_talent uuid,
  fee bigint default null,
  new_status text default null,
  new_paid_on timestamptz default null
) returns void language plpgsql security invoker set search_path=public,pg_temp as $$
declare
  payment_id uuid;
  total bigint;
  final_status text;
  final_paid_on timestamptz;
begin
  if auth.uid() is null or not public.has_org_role(target_org, array['admin','producer']) then
    raise exception 'No tienes permiso para editar este espacio.';
  end if;

  if fee is not null and (fee < 0 or fee > 100000000) then
    raise exception 'Indica un importe válido.';
  end if;

  if new_status is not null and new_status not in ('pending','paid') then
    raise exception 'Estado de pago inválido.';
  end if;

  perform 1 from public.events where id = target_event and organization_id = target_org and deleted_at is null for update;
  if not found then
    raise exception 'Evento no disponible.';
  end if;

  perform 1 from public.event_talent where organization_id = target_org and event_id = target_event and talent_id = target_talent for update;
  if not found then
    raise exception 'El artista no está asignado al evento.';
  end if;

  -- 1. Update agreed cost in event_talent if fee is passed
  if fee is not null then
    update public.event_talent set agreed_cost_cents = fee where organization_id = target_org and event_id = target_event and talent_id = target_talent;
  end if;

  -- 2. Locate existing payment record
  select id, status, paid_on into payment_id, final_status, final_paid_on
  from public.payments
  where organization_id = target_org and event_id = target_event and talent_id = target_talent and kind = 'artist' and direction = 'outbound'
  order by created_at desc limit 1;

  final_status := coalesce(new_status, final_status, 'pending');
  if final_status = 'paid' then
    final_paid_on := coalesce(new_paid_on, final_paid_on, now());
  else
    final_paid_on := null;
  end if;

  if payment_id is null then
    insert into public.payments (
      organization_id, event_id, talent_id, kind, direction, amount_cents, status, paid_on, created_at, updated_at
    ) values (
      target_org, target_event, target_talent, 'artist', 'outbound', coalesce(fee, 0), final_status, final_paid_on, now(), now()
    );
  else
    update public.payments
    set amount_cents = coalesce(fee, amount_cents),
        status = final_status,
        paid_on = final_paid_on,
        updated_at = now()
    where id = payment_id and organization_id = target_org;
  end if;

  -- 3. Recalculate event totals
  select case when count(*) filter(where amount is null) > 0 then null else coalesce(sum(amount), 0) end into total from (
    select agreed_cost_cents amount from public.event_talent where organization_id = target_org and event_id = target_event
    union all select total_cents from public.expenses where organization_id = target_org and event_id = target_event and talent_id is null and status <> 'cancelled'
  ) costs;

  update public.events set expenses_cents = total, updated_at = now() where id = target_event and organization_id = target_org;
end $$;

revoke all on function public.upsert_artist_payment(uuid,uuid,uuid,bigint,text,timestamptz) from public;
grant execute on function public.upsert_artist_payment(uuid,uuid,uuid,bigint,text,timestamptz) to authenticated;

notify pgrst, 'reload schema';
commit;
