begin;
alter table public.clients
 add column strategic_importance integer check(strategic_importance between 1 and 5),
 add column ease_of_work integer check(ease_of_work between 1 and 5),
 add column tax_id text not null default '',
 add column billing_address text not null default '',
 add column postal_code text not null default '',
 add column province text not null default '',
 add column billing_email text not null default '',
 add column accounts_phone text not null default '',
 add column accounts_contact text not null default '',
 add column preferred_currency text not null default 'EUR' check(preferred_currency ~ '^[A-Z]{3}$'),
 add column payment_terms text not null default '',
 add column po_required boolean,
 add column po_process text not null default '',
 add column billing_portal text not null default '',
 add column billing_notes text not null default '';
notify pgrst,'reload schema';
commit;
