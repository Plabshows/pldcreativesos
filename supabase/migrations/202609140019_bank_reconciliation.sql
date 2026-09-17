begin;
create table public.suppliers(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),
 name text not null,normalized_name text not null,client_id uuid references public.clients(id),talent_id uuid references public.talent(id),
 aliases text[] not null default '{}',tax_id text not null default '',iban text not null default '',notes text not null default '',
 created_at timestamptz not null default now(),unique(organization_id,normalized_name)
);
alter table public.expenses add column supplier_id uuid references public.suppliers(id),add column invoice_date date,add column work_date date,add column retention_cents bigint check(retention_cents>=0),add column source_key text;
create unique index expense_import_source on public.expenses(organization_id,source_key) where source_key is not null;
create table public.bank_movements(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),
 source_key text not null,fingerprint text not null,occurrence integer not null check(occurrence>0),source_file text not null,source_hash text not null,source_sheet text not null,source_row integer not null,
 payment_date date not null,amount_cents bigint not null check(amount_cents>0),currency text not null default 'EUR' check(currency ~ '^[A-Z]{3}$'),
 original_reference text not null,original_concept text not null,source_data jsonb not null,
 supplier_id uuid references public.suppliers(id),talent_id uuid references public.talent(id),event_id uuid references public.events(id),
 expected_cents bigint check(expected_cents>=0),suggested_event_ids uuid[] not null default '{}',
 status text not null check(status in('unmatched','review','reconciled')),issues text[] not null default '{}',
 resolution_reason text not null default '' check(resolution_reason in('','partial','multiple','retention','commission','refund','error','other')),
 resolution_note text not null default '',version integer not null default 1,created_by uuid references public.users(id),created_at timestamptz not null default now(),
 unique(organization_id,source_key),unique(organization_id,fingerprint,occurrence)
);
alter table public.expense_payments add column bank_movement_id uuid references public.bank_movements(id);
create unique index bank_expense_allocation on public.expense_payments(bank_movement_id,expense_id) where bank_movement_id is not null;
do $$ declare t text;begin foreach t in array array['suppliers','bank_movements'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('create policy bank_read on public.%I for select to authenticated using(public.has_org_role(organization_id,array[''admin'',''producer'',''sales'']))',t);
 execute format('create policy bank_write on public.%I for insert to authenticated with check(public.has_org_role(organization_id,array[''admin'',''producer'']))',t);
 execute format('create policy bank_update on public.%I for update to authenticated using(public.has_org_role(organization_id,array[''admin'',''producer''])) with check(public.has_org_role(organization_id,array[''admin'',''producer'']))',t);
 execute format('grant select,insert,update on public.%I to authenticated',t);
 execute format('create trigger bank_tenant before insert or update on public.%I for each row execute function public.enforce_tenant_references()',t);
 end loop;end $$;
create function public.bank_identity_guard() returns trigger language plpgsql set search_path=public as $$begin
 if row(new.organization_id,new.source_key,new.fingerprint,new.occurrence,new.payment_date,new.amount_cents,new.currency,new.original_reference,new.original_concept,new.source_data,new.source_file,new.source_hash,new.source_sheet,new.source_row,new.expected_cents,new.created_by) is distinct from row(old.organization_id,old.source_key,old.fingerprint,old.occurrence,old.payment_date,old.amount_cents,old.currency,old.original_reference,old.original_concept,old.source_data,old.source_file,old.source_hash,old.source_sheet,old.source_row,old.expected_cents,old.created_by) then raise exception 'El movimiento original es inmutable';end if;
 new.version:=old.version+1;return new;end $$;
create trigger bank_identity before update on public.bank_movements for each row execute function public.bank_identity_guard();
create function public.bank_allocation_guard() returns trigger language plpgsql set search_path=public as $$
declare b public.bank_movements; e public.expenses;allocated bigint;begin
 if new.bank_movement_id is null then return new;end if;
 select * into b from public.bank_movements where id=new.bank_movement_id and organization_id=new.organization_id for update;
 if not found then raise exception 'Movimiento no disponible';end if;
 select * into e from public.expenses where id=new.expense_id and organization_id=new.organization_id;
 select coalesce(sum(amount_cents),0) into allocated from public.expense_payments where bank_movement_id=b.id;
 if allocated+new.amount_cents>b.amount_cents or new.currency<>b.currency or new.payment_date<>b.payment_date then raise exception 'La asignación supera el pago bancario o cambia su fecha/moneda';end if;
 if b.supplier_id is not null and e.supplier_id is distinct from b.supplier_id then raise exception 'El proveedor del gasto y del movimiento deben coincidir';end if;
 if b.talent_id is not null and e.talent_id is distinct from b.talent_id then raise exception 'El artista del gasto y del movimiento deben coincidir';end if;
 if b.event_id is not null and e.event_id is distinct from b.event_id then raise exception 'El evento del gasto y del movimiento deben coincidir';end if;
 if 'duplicate'=any(b.issues) and b.resolution_note='' then raise exception 'Revisa el posible duplicado antes de asignar el pago';end if;
 return new;end $$;
create trigger bank_allocation before insert on public.expense_payments for each row execute function public.bank_allocation_guard();
create function public.reconcile_bank_payment(movement uuid,expense uuid,amount bigint) returns void language plpgsql security invoker set search_path=public as $$
declare b public.bank_movements; allocated bigint;begin
 select * into b from public.bank_movements where id=movement for update;
 if not found or not public.has_org_role(b.organization_id,array['admin','producer']) then raise exception 'No puedes conciliar este movimiento';end if;
 if amount<=0 then raise exception 'Indica un importe positivo';end if;
 insert into public.expense_payments(organization_id,expense_id,payment_date,amount_cents,currency,method,reference,note,created_by,bank_movement_id)
 values(b.organization_id,expense,b.payment_date,amount,b.currency,'Banco',b.original_reference,'Conciliado con extracto · '||b.source_file,auth.uid(),b.id);
 select coalesce(sum(amount_cents),0) into allocated from public.expense_payments where bank_movement_id=b.id;
 update public.bank_movements set status=case when allocated=amount_cents and (cardinality(issues)=0 or resolution_note<>'') then 'reconciled' else 'review' end where id=b.id;
end $$;
revoke all on function public.reconcile_bank_payment(uuid,uuid,bigint) from public,anon;
grant execute on function public.reconcile_bank_payment(uuid,uuid,bigint) to authenticated;
create function public.review_bank_movement(movement uuid,expected_version integer,supplier uuid,artist uuid,event uuid,reason text,note text) returns void language plpgsql security invoker set search_path=public as $$
declare b public.bank_movements; p record;allocated bigint;begin
 select * into b from public.bank_movements where id=movement for update;
 if not found or not public.has_org_role(b.organization_id,array['admin','producer']) then raise exception 'Movimiento no disponible';end if;
 if b.version<>expected_version then raise exception 'El movimiento ha cambiado. Vuelve a abrirlo';end if;
 for p in select ep.expense_id from public.expense_payments ep where ep.bank_movement_id=b.id loop
  if exists(select 1 from public.expense_payments where expense_id=p.expense_id and bank_movement_id is distinct from b.id) then
   if row(supplier,artist,event) is distinct from row(b.supplier_id,b.talent_id,b.event_id) then raise exception 'Este gasto tiene otros pagos. Revisa primero la ficha del gasto';end if;
  else
   update public.expenses set supplier_id=supplier,supplier_name=coalesce((select name from public.suppliers where id=supplier),supplier_name),talent_id=artist,event_id=event where id=p.expense_id;
  end if;
 end loop;
 select coalesce(sum(amount_cents),0) into allocated from public.expense_payments where bank_movement_id=b.id;
 update public.bank_movements set supplier_id=supplier,talent_id=artist,event_id=event,resolution_reason=reason,resolution_note=trim(note),status=case when allocated=amount_cents and (cardinality(issues)=0 or trim(note)<>'') then 'reconciled' when supplier is null and artist is null and cardinality(issues)=0 then 'unmatched' else 'review' end where id=b.id;
end $$;
revoke all on function public.review_bank_movement(uuid,integer,uuid,uuid,uuid,text,text) from public,anon;
grant execute on function public.review_bank_movement(uuid,integer,uuid,uuid,uuid,text,text) to authenticated;
notify pgrst,'reload schema';
commit;
