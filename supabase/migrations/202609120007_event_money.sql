alter table public.events
 add column if not exists income_cents bigint check(income_cents>=0),
 add column if not exists expenses_cents bigint check(expenses_cents>=0),
 add column if not exists other_expenses_cents bigint check(other_expenses_cents>=0),
 add column if not exists client_paid boolean,
 add column if not exists invoice_number text,
 add column if not exists finance_source jsonb;
notify pgrst,'reload schema';
