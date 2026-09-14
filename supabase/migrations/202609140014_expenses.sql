begin;
create table public.expense_categories(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),name text not null,category_group text not null check(category_group in('Artistas','Producción','Viajes','Empresa')),unique(organization_id,name));
create table public.expenses (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),talent_id uuid references public.talent(id),supplier_name text not null default '',
 event_id uuid references public.events(id),category_id uuid not null references public.expense_categories(id),legacy_payment_id uuid unique references public.payments(id),
 number text not null default '',expense_date date not null,due_date date,concept text not null,
 base_cents bigint check(base_cents>=0),tax_cents bigint check(tax_cents>=0),total_cents bigint check(total_cents>=0),estimated_cents bigint check(estimated_cents>=0),
 currency text not null check(currency ~ '^[A-Z]{3}$'),status text not null default 'missing' check(status in('missing','received','pending','cancelled')),
 document_url text not null default '',notes text not null default '',version integer not null default 1,
 created_by uuid references public.users(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(talent_id is not null or length(trim(supplier_name))>0)
);
create unique index expense_artist_work on public.expenses(organization_id,event_id,talent_id) where event_id is not null and talent_id is not null and status<>'cancelled';
create table public.expense_payments(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),expense_id uuid not null references public.expenses(id),payment_date date not null,amount_cents bigint not null check(amount_cents>0),currency text not null,method text not null default '',reference text not null default '',note text not null default '',created_by uuid not null references public.users(id),created_at timestamptz not null default now());
create table public.expense_followups(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),expense_id uuid not null references public.expenses(id),followup_date date not null,kind text not null check(kind in('email','whatsapp','call','reply','promise','reminder','other')),note text not null,next_action text not null default '',next_action_date date,created_by uuid not null references public.users(id),created_at timestamptz not null default now());
create table public.expense_history(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),expense_id uuid not null references public.expenses(id),body text not null,created_at timestamptz not null default now(),created_by uuid references public.users(id));
do $$ declare t text;begin
 foreach t in array array['expenses','expense_categories','expense_payments','expense_followups','expense_history'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('create policy expense_read on public.%I for select to authenticated using(public.has_org_role(organization_id,array[''admin'',''producer'',''sales'']))',t);
  execute format('grant select on public.%I to authenticated',t);
 end loop;
 foreach t in array array['expenses','expense_categories','expense_payments','expense_followups'] loop
  execute format('create policy expense_insert on public.%I for insert to authenticated with check(public.has_org_role(organization_id,array[''admin'',''producer'']))',t);
  execute format('grant insert on public.%I to authenticated',t);
  execute format('create trigger expense_tenant before insert or update on public.%I for each row execute function public.enforce_tenant_references()',t);
 end loop;
end $$;
create policy expense_update on public.expenses for update to authenticated using(public.has_org_role(organization_id,array['admin','producer'])) with check(public.has_org_role(organization_id,array['admin','producer']));
grant update on public.expenses to authenticated;
insert into public.expense_categories(organization_id,name,category_group)
select o.id,c.name,c.grp from public.organizations o cross join (values
 ('Bailarines','Artistas'),('Performers','Artistas'),('DJs','Artistas'),('Músicos','Artistas'),('Circo','Artistas'),('Presentadores','Artistas'),('Otros artistas','Artistas'),
 ('Vestuario','Producción'),('Props','Producción'),('Decoración','Producción'),('Producción','Producción'),('Técnico','Producción'),('Material','Producción'),
 ('Vuelos','Viajes'),('Ferry','Viajes'),('Hotel','Viajes'),('Taxi','Viajes'),('Gasolina','Viajes'),('Alquiler de coche','Viajes'),('Dietas','Viajes'),
 ('Software','Empresa'),('Almacenamiento','Empresa'),('Marketing','Empresa'),('Oficina','Empresa'),('Gestoría','Empresa'),('Seguros','Empresa'),('Otros','Empresa')) c(name,grp);
create function public.expense_guard() returns trigger language plpgsql set search_path=public as $$
declare parent public.expenses;paid bigint;oldpaid bigint;begin
 if tg_table_name='expenses' then
  if tg_op='UPDATE' then
   if new.organization_id<>old.organization_id or new.legacy_payment_id is distinct from old.legacy_payment_id then raise exception 'Identidad inmutable';end if;
   select coalesce(sum(amount_cents),0) into paid from public.expense_payments where expense_id=new.id;
   select coalesce(sum(amount_cents),0) into oldpaid from public.payments where id=new.legacy_payment_id and status='paid';
   if paid+oldpaid>0 and (new.currency<>old.currency or new.total_cents is null or new.total_cents<paid+oldpaid or new.status='cancelled') then raise exception 'El gasto tiene pagos. Revisa su total o estado';end if;
   new.version:=old.version+1;new.updated_at:=now();
  end if;
 else
  select * into parent from public.expenses where id=new.expense_id and organization_id=new.organization_id for update;
  if not found then raise exception 'Gasto no disponible';end if;
  if tg_table_name='expense_payments' then
   select coalesce(sum(amount_cents),0) into paid from public.expense_payments where expense_id=parent.id;
   select coalesce(sum(amount_cents),0) into oldpaid from public.payments where id=parent.legacy_payment_id and status='paid';
   if parent.status='cancelled' or parent.total_cents is null or new.currency<>parent.currency or paid+oldpaid+new.amount_cents>parent.total_cents then raise exception 'Revisa el saldo, importe y moneda del gasto';end if;
  end if;
 end if;return new;
end $$;
create trigger expense_guard before insert or update on public.expenses for each row execute function public.expense_guard();
create trigger expense_payment_guard before insert on public.expense_payments for each row execute function public.expense_guard();
create trigger expense_followup_guard before insert on public.expense_followups for each row execute function public.expense_guard();
create function public.expense_history_record() returns trigger language plpgsql security definer set search_path=public as $$begin
 insert into public.expense_history(organization_id,expense_id,body,created_by) values(new.organization_id,new.id,case when tg_op='INSERT' then 'Gasto registrado · pendiente de revisar factura' when new.status is distinct from old.status then case new.status when 'missing' then 'Pendiente de recibir factura' when 'received' then 'Factura recibida' when 'pending' then 'Pendiente de pago' else 'Gasto cancelado' end else 'Gasto actualizado' end,auth.uid());return new;end $$;
create trigger expense_history after insert or update on public.expenses for each row execute function public.expense_history_record();
-- Existing artist payment remains the authoritative historical record; reference it, never copy its cash movement.
insert into public.expenses(organization_id,talent_id,event_id,category_id,legacy_payment_id,expense_date,concept,total_cents,estimated_cents,currency,status)
select p.organization_id,p.talent_id,p.event_id,c.id,p.id,coalesce(e.event_date,p.created_at::date),'Trabajo artístico · '||e.event_name,p.amount_cents,et.agreed_cost_cents,'EUR','missing'
from public.payments p join public.events e on e.id=p.event_id join public.expense_categories c on c.organization_id=p.organization_id and c.name='Otros artistas'
left join public.event_talent et on et.event_id=p.event_id and et.talent_id=p.talent_id
where p.direction='outbound' and p.kind='artist' and p.talent_id is not null;
create function public.generate_artist_expenses(event_uuid uuid) returns void language plpgsql security definer set search_path=public as $$begin
 insert into public.expenses(organization_id,talent_id,event_id,category_id,expense_date,concept,total_cents,estimated_cents,currency,status)
 select e.organization_id,et.talent_id,e.id,c.id,coalesce(e.event_date,current_date),'Trabajo artístico · '||e.event_name,null,nullif(et.agreed_cost_cents,0),'EUR','missing'
 from public.events e join public.event_talent et on et.event_id=e.id join public.expense_categories c on c.organization_id=e.organization_id and c.name='Otros artistas'
 where e.id=event_uuid and e.status='completed' and e.deleted_at is null
 on conflict (organization_id,event_id,talent_id) where event_id is not null and talent_id is not null and status<>'cancelled' do nothing;
end $$;
revoke all on function public.generate_artist_expenses(uuid) from public,anon,authenticated;
create function public.expense_on_event() returns trigger language plpgsql security definer set search_path=public as $$begin
 perform public.generate_artist_expenses(case when tg_table_name='events' then (to_jsonb(new)->>'id')::uuid else (to_jsonb(new)->>'event_id')::uuid end);return new;end $$;
create trigger event_expenses after update of status on public.events for each row execute function public.expense_on_event();
create trigger assignment_expenses after insert on public.event_talent for each row execute function public.expense_on_event();
select public.generate_artist_expenses(id) from public.events where status='completed' and deleted_at is null;
notify pgrst,'reload schema';
commit;
