begin;
alter table public.invoices alter column issue_date drop not null, alter column due_date drop not null;
alter table public.invoices add column retention_cents bigint check(retention_cents>=0);
alter table public.financial_documents add column extracted_data jsonb, add column processed_at timestamptz;
notify pgrst,'reload schema';
commit;
