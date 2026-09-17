begin;
-- Evidence from a collection tracker. This is not a bank statement or a second ledger.
create table public.invoice_import_rows (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 source_key text not null, source_file text not null, source_hash text not null,
 source_sheet text not null, source_row integer not null check(source_row>0), source_data jsonb not null,
 invoice_number text not null default '', expected_cents bigint check(expected_cents>0),
 declared_received_cents bigint check(declared_received_cents>=0),
 invoice_id uuid references public.invoices(id), candidate_invoice_ids uuid[] not null default '{}',
 status text not null check(status in('linked','review')), issues text[] not null default '{}',
 note text not null default '', created_by uuid not null references public.users(id), created_at timestamptz not null default now(),
 unique(organization_id,source_key), check(status<>'linked' or invoice_id is not null)
);
alter table public.invoice_payments add column source_import_id uuid references public.invoice_import_rows(id), add column source_key text;
create unique index invoice_receipt_source on public.invoice_payments(organization_id,source_key) where source_key is not null;
alter table public.invoice_import_rows enable row level security;
create policy collection_evidence_read on public.invoice_import_rows for select to authenticated
 using(public.has_org_role(organization_id,array['admin','producer','sales']));
grant select on public.invoice_import_rows to authenticated;
create trigger collection_evidence_tenant before insert or update on public.invoice_import_rows
 for each row execute function public.enforce_tenant_references();
create function public.invoice_receipt_source_guard() returns trigger language plpgsql set search_path=public as $$
begin
 if new.source_import_id is not null and not exists(
  select 1 from public.invoice_import_rows r where r.id=new.source_import_id and r.organization_id=new.organization_id
   and r.status='linked' and r.invoice_id=new.invoice_id
 ) then raise exception 'El origen del cobro no corresponde a esta factura';end if;
 return new;
end $$;
create trigger invoice_receipt_source_guard before insert on public.invoice_payments
 for each row execute function public.invoice_receipt_source_guard();
notify pgrst,'reload schema';
commit;
