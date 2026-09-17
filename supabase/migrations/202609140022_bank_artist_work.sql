begin;
create function public.bank_artist_work_link() returns trigger language plpgsql security invoker set search_path=public as $$begin
 if new.status='reconciled' and new.event_id is not null and new.talent_id is not null and exists(select 1 from public.expense_payments where bank_movement_id=new.id) then
  insert into public.event_talent(organization_id,event_id,talent_id,notes)
   values(new.organization_id,new.event_id,new.talent_id,'Trabajo identificado en pago bancario · '||new.source_file||' · fila '||new.source_row)
   on conflict(event_id,talent_id) do nothing;
 end if;return new;end $$;
create trigger bank_artist_work after update of status,event_id,talent_id on public.bank_movements for each row execute function public.bank_artist_work_link();
notify pgrst,'reload schema';
commit;
