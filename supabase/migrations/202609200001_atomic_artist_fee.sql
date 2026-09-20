begin;
-- One database transaction: either every budget write succeeds, or none does.
create or replace function public.set_artist_budget(target_org uuid,target_event uuid,target_talent uuid,fee bigint)
returns void language plpgsql security invoker set search_path=public,pg_temp as $$
declare payment_id uuid; payment_count integer; total bigint;
begin
 if auth.uid() is null or not public.has_org_role(target_org,array['admin','producer']) then
  raise exception 'No tienes permiso para editar este espacio.';
 end if;
 if fee is null or fee<0 or fee>100000000 then raise exception 'Indica un importe válido. El importe desconocido no equivale a cero.'; end if;
 perform 1 from public.events where id=target_event and organization_id=target_org and deleted_at is null for update;
 if not found then raise exception 'Evento no disponible.'; end if;
 perform 1 from public.event_talent where organization_id=target_org and event_id=target_event and talent_id=target_talent for update;
 if not found then raise exception 'El artista no está asignado al evento.'; end if;
 perform 1 from public.payments where organization_id=target_org and event_id=target_event and talent_id=target_talent and kind='artist' and direction='outbound' for update;
 if exists(select 1 from public.payments where organization_id=target_org and event_id=target_event and talent_id=target_talent and kind='artist' and status='paid')
 or exists(select 1 from public.expenses where organization_id=target_org and event_id=target_event and talent_id=target_talent and status<>'cancelled') then
  raise exception 'Este trabajo tiene historial financiero. Gestiona su importe desde Facturación & Gastos.';
 end if;
 select count(*) into payment_count from public.payments where organization_id=target_org and event_id=target_event and talent_id=target_talent and kind='artist' and direction='outbound';
 if payment_count>1 then raise exception 'Hay varios registros para este trabajo. Revisa su historial.'; end if;
 select id into payment_id from public.payments where organization_id=target_org and event_id=target_event and talent_id=target_talent and kind='artist' and direction='outbound';
 update public.event_talent set agreed_cost_cents=fee where organization_id=target_org and event_id=target_event and talent_id=target_talent;
 if payment_id is null then
  insert into public.payments(organization_id,event_id,talent_id,kind,direction,amount_cents,status) values(target_org,target_event,target_talent,'artist','outbound',fee,'pending');
 else
  update public.payments set amount_cents=fee where id=payment_id and organization_id=target_org;
 end if;
 select case when count(*) filter(where amount is null)>0 then null else coalesce(sum(amount),0) end into total from (
  select agreed_cost_cents amount from public.event_talent where organization_id=target_org and event_id=target_event
  union all select total_cents from public.expenses where organization_id=target_org and event_id=target_event and talent_id is null and status<>'cancelled'
 ) costs;
 update public.events set expenses_cents=total,updated_at=now() where id=target_event and organization_id=target_org;
end $$;
revoke all on function public.set_artist_budget(uuid,uuid,uuid,bigint) from public;
grant execute on function public.set_artist_budget(uuid,uuid,uuid,bigint) to authenticated;
notify pgrst,'reload schema';
commit;
