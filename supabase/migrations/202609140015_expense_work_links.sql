begin;
create or replace function public.generate_artist_expenses(event_uuid uuid) returns void language plpgsql security definer set search_path=public as $$begin
 insert into public.expenses(organization_id,talent_id,event_id,category_id,legacy_payment_id,expense_date,concept,total_cents,estimated_cents,currency,status)
 select e.organization_id,et.talent_id,e.id,c.id,p.id,coalesce(e.event_date,current_date),'Trabajo artístico · '||e.event_name,p.amount_cents,nullif(et.agreed_cost_cents,0),'EUR','missing'
 from public.events e join public.event_talent et on et.event_id=e.id join public.expense_categories c on c.organization_id=e.organization_id and c.name='Otros artistas'
 left join lateral(select id,amount_cents from public.payments where event_id=e.id and talent_id=et.talent_id and direction='outbound' and kind='artist' order by created_at,id limit 1) p on true
 where e.id=event_uuid and e.status='completed' and e.deleted_at is null
 on conflict (organization_id,event_id,talent_id) where event_id is not null and talent_id is not null and status<>'cancelled' do nothing;
end $$;
revoke all on function public.generate_artist_expenses(uuid) from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
