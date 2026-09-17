begin;
create table public.invoices (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 client_id uuid not null references public.clients(id),event_id uuid references public.events(id),proposal_id uuid references public.proposals(id),
 number text not null check(length(trim(number)) between 1 and 200),
 issue_date date not null,due_date date not null,concept text not null default '',
 base_cents bigint check(base_cents>=0),tax_cents bigint check(tax_cents>=0),total_cents bigint not null check(total_cents>0),
 currency text not null check(currency ~ '^[A-Z]{3}$'), status text not null default 'draft' check(status in('draft','sent','pending','cancelled')),
 document_url text not null default '',notes text not null default '',version integer not null default 1,
 created_by uuid not null references public.users(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(organization_id,number),check(due_date>=issue_date)
);
create table public.invoice_payments (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),invoice_id uuid not null references public.invoices(id),
 payment_date date not null,amount_cents bigint not null check(amount_cents>0),currency text not null check(currency ~ '^[A-Z]{3}$'),
 method text not null default '',reference text not null default '',note text not null default '',created_by uuid not null references public.users(id),created_at timestamptz not null default now()
);
create table public.invoice_followups (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),invoice_id uuid not null references public.invoices(id),
 followup_date date not null,kind text not null check(kind in('email','whatsapp','call','reply','promise','reminder','other')),
 note text not null check(length(trim(note))>0),next_action text not null default '',next_action_date date,
 created_by uuid not null references public.users(id),created_at timestamptz not null default now()
);
create table public.invoice_history (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),invoice_id uuid not null references public.invoices(id),
 kind text not null,body text not null,created_by uuid references public.users(id),created_at timestamptz not null default now()
);
create index invoice_client on public.invoices(organization_id,client_id);
create index invoice_event on public.invoices(organization_id,event_id);
create index invoice_payments_parent on public.invoice_payments(invoice_id);
create index invoice_followups_parent on public.invoice_followups(invoice_id,followup_date desc,created_at desc);
do $$ declare t text;begin
 foreach t in array array['invoices','invoice_payments','invoice_followups','invoice_history'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('create policy team_read on public.%I for select to authenticated using(public.has_org_role(organization_id,array[''admin'',''producer'',''sales'']))',t);
  execute format('grant select on public.%I to authenticated',t);
 end loop;
 foreach t in array array['invoices','invoice_payments','invoice_followups'] loop
  execute format('create policy team_insert on public.%I for insert to authenticated with check(public.has_org_role(organization_id,array[''admin'',''producer'',''sales'']) and created_by=auth.uid())',t);
  execute format('grant insert on public.%I to authenticated',t);
 end loop;
end $$;
create policy invoice_update on public.invoices for update to authenticated using(public.has_org_role(organization_id,array['admin','producer','sales'])) with check(public.has_org_role(organization_id,array['admin','producer','sales']));
grant update on public.invoices to authenticated;
create function public.invoice_guard() returns trigger language plpgsql set search_path=public as $$
declare parent public.invoices; paid bigint;begin
 if tg_table_name='invoices' then
  if not exists(select 1 from public.clients where id=new.client_id and organization_id=new.organization_id) then raise exception 'Cliente no disponible';end if;
  if new.event_id is not null and not exists(select 1 from public.events where id=new.event_id and organization_id=new.organization_id and (client_id is null or client_id=new.client_id)) then raise exception 'El evento no pertenece al cliente';end if;
  if new.proposal_id is not null and not exists(select 1 from public.proposals where id=new.proposal_id and organization_id=new.organization_id and (client_id is null or client_id=new.client_id)) then raise exception 'La propuesta no pertenece al cliente';end if;
  if tg_op='UPDATE' then
   if new.organization_id<>old.organization_id or new.created_by<>old.created_by then raise exception 'Identidad inmutable';end if;
   select coalesce(sum(amount_cents),0) into paid from public.invoice_payments where invoice_id=new.id;
   if paid>0 and (new.currency<>old.currency or new.total_cents<paid or new.status in('draft','cancelled')) then raise exception 'La factura tiene pagos: revisa el importe y el estado';end if;
   new.version:=old.version+1;new.updated_at:=now();
  end if;
 else
  select * into parent from public.invoices where id=new.invoice_id and organization_id=new.organization_id for update;
  if not found then raise exception 'Factura no disponible';end if;
  if tg_table_name='invoice_payments' then
   if parent.status in('draft','cancelled') then raise exception 'Marca la factura como enviada antes de registrar pagos';end if;
   if new.currency<>parent.currency then raise exception 'El pago debe tener la moneda de la factura';end if;
   select coalesce(sum(amount_cents),0) into paid from public.invoice_payments where invoice_id=parent.id;
   if paid+new.amount_cents>parent.total_cents then raise exception 'El pago supera el saldo pendiente';end if;
  end if;
 end if;
 return new;
end $$;
create trigger invoice_guard before insert or update on public.invoices for each row execute function public.invoice_guard();
create trigger payment_guard before insert on public.invoice_payments for each row execute function public.invoice_guard();
create trigger followup_guard before insert on public.invoice_followups for each row execute function public.invoice_guard();
create function public.invoice_record_history() returns trigger language plpgsql security definer set search_path=public as $$
declare msg text;begin
 if tg_op='INSERT' then msg:='Factura registrada';elsif new.status is distinct from old.status then msg:=case new.status when 'sent' then 'Factura enviada' when 'pending' then 'Factura pendiente' when 'cancelled' then 'Factura cancelada' else 'Factura en borrador' end;else msg:='Datos de la factura actualizados';end if;
 insert into public.invoice_history(organization_id,invoice_id,kind,body,created_by) values(new.organization_id,new.id,'invoice',msg,auth.uid());return new;
end $$;
create trigger invoice_history after insert or update on public.invoices for each row execute function public.invoice_record_history();
notify pgrst,'reload schema';
commit;
