begin;
-- Deferred checks allow review_bank_movement to update both ends atomically.
create function public.bank_consistency_guard() returns trigger language plpgsql set search_path=public as $$
declare b public.bank_movements;allocated bigint;begin
 if tg_table_name='bank_movements' then
  select * into b from public.bank_movements where id=new.id;
  select coalesce(sum(amount_cents),0) into allocated from public.expense_payments where bank_movement_id=b.id;
  if b.status='reconciled' and (allocated<>b.amount_cents or (cardinality(b.issues)>0 and b.resolution_note='')) then raise exception 'Para conciliar, asigna el pago completo y revisa sus incidencias';end if;
 end if;
 if exists(select 1 from public.expense_payments p join public.expenses e on e.id=p.expense_id join public.bank_movements m on m.id=p.bank_movement_id
  where (case when tg_table_name='expenses' then e.id=new.id else m.id=new.id end) and
   ((m.supplier_id is not null and e.supplier_id is distinct from m.supplier_id) or (m.talent_id is not null and e.talent_id is distinct from m.talent_id) or (m.event_id is not null and e.event_id is distinct from m.event_id))) then raise exception 'Revisa estas relaciones desde el movimiento bancario para actualizar también los gastos';end if;
 return new;end $$;
create constraint trigger bank_consistency after insert or update on public.bank_movements deferrable initially deferred for each row execute function public.bank_consistency_guard();
create constraint trigger expense_bank_consistency after update on public.expenses deferrable initially deferred for each row execute function public.bank_consistency_guard();
notify pgrst,'reload schema';
commit;
