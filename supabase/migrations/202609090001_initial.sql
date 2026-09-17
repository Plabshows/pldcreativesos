-- Performance Lab OS · PostgreSQL / Supabase
-- Apply with Supabase migrations. All business rows are scoped to an organisation.
create extension if not exists pgcrypto;

create type public.member_role as enum ('admin','producer','sales','wardrobe');
create type public.lead_stage as enum ('new_lead','research','ready_to_contact','contacted','follow_up','replied','meeting','brief_received','proposal','negotiation','won','lost','long_term_nurture');
create type public.event_status as enum ('lead','proposal','confirmed','production','completed','cancelled');
create type public.health_status as enum ('green','orange','red');
create type public.task_status as enum ('todo','in_progress','done','cancelled');
create type public.task_priority as enum ('low','medium','high','urgent');
create type public.proposal_status as enum ('draft','sent','viewed','accepted','rejected','expired');
create type public.payment_status as enum ('pending','invoiced','partial','paid','overdue');
create type public.asset_status as enum ('available','reserved','out','returned','cleaning','repair','missing');

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = timezone('utc', now()); return new; end; $$;

create table public.organizations (
  id uuid primary key default gen_random_uuid(), name text not null, slug text not null unique,
  default_currency char(3) not null default 'EUR', default_vat_percent numeric(5,2) not null default 21 check (default_vat_percent between 0 and 100),
  created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now())
);
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade, full_name text not null default '', phone text,
  created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now())
);
create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade, user_id uuid not null references public.users(id) on delete cascade,
  role public.member_role not null default 'producer', created_at timestamptz not null default timezone('utc', now()),
  primary key (organization_id, user_id)
);

create table public.clients (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  client_code text not null, company_name text not null, client_type text not null default 'Other', lead_source text,
  account_owner uuid references public.users(id) on delete set null, city text, country text default 'España',
  notes text, preferences text, status text not null default 'active' check (status in ('active','inactive','prospect')),
  first_contact date, last_contact date, next_follow_up date, total_revenue_cents bigint not null default 0 check (total_revenue_cents >= 0),
  estimated_profit_cents bigint not null default 0, deleted_at timestamptz, created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now()),
  unique (organization_id, client_code)
);
create table public.client_contacts (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade, full_name text not null, role text, email text,
  phone text, whatsapp text, instagram text, is_primary boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now())
);
create table public.leads (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null, title text not null, stage public.lead_stage not null default 'new_lead',
  estimated_value_cents bigint not null default 0 check (estimated_value_cents >= 0), probability_percent numeric(5,2) not null default 10 check (probability_percent between 0 and 100),
  owner_id uuid references public.users(id) on delete set null, next_action text, next_action_at timestamptz, last_activity_at timestamptz,
  notes text, deleted_at timestamptz, created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now())
);

create table public.events (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  event_code text not null, event_name text not null, client_id uuid references public.clients(id) on delete set null, contact_id uuid references public.client_contacts(id) on delete set null,
  event_date date, start_time time, end_time time, venue text, city text, country text default 'España', event_type text,
  guest_count integer check (guest_count is null or guest_count >= 0), brief text, mood text, theme text, audience text, requested_entertainment text, restrictions text, technical_needs text,
  status public.event_status not null default 'lead', health public.health_status not null default 'orange', owner_id uuid references public.users(id) on delete set null,
  onsite_contact text, call_time timestamptz, internal_notes text, deleted_at timestamptz, created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now()),
  unique (organization_id, event_code)
);
create table public.event_requirements (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, event_id uuid not null references public.events(id) on delete cascade,
  label text not null, category text not null default 'general', is_critical boolean not null default false, is_resolved boolean not null default false, due_at timestamptz, notes text,
  created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now())
);
create table public.event_financials (
  event_id uuid primary key references public.events(id) on delete cascade, organization_id uuid not null references public.organizations(id) on delete cascade,
  client_price_cents bigint not null default 0, artist_costs_cents bigint not null default 0, costume_cost_cents bigint not null default 0, travel_cents bigint not null default 0, accommodation_cents bigint not null default 0,
  production_costs_cents bigint not null default 0, creative_fee_cents bigint not null default 0, management_fee_cents bigint not null default 0, vat_percent numeric(5,2) not null default 21 check (vat_percent between 0 and 100),
  created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now()),
  gross_margin_cents bigint generated always as (client_price_cents - artist_costs_cents - costume_cost_cents - travel_cents - accommodation_cents - production_costs_cents) stored
);

create table public.talent (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, talent_code text not null,
  real_name text not null, stage_name text, phone text, email text, whatsapp text, instagram text, city text, country text default 'España', languages text[],
  height_cm numeric(5,1), clothing_size text, shoe_size text, measurements text, hair text, special_characteristics text, available_to_travel boolean not null default false, own_car boolean not null default false,
  driving_licence boolean not null default false, passport_valid boolean not null default false, base_city text, preferred_areas text[], quality_rating numeric(2,1) check (quality_rating between 1 and 5), reliability_rating numeric(2,1) check (reliability_rating between 1 and 5), professionalism_rating numeric(2,1) check (professionalism_rating between 1 and 5), communication_rating numeric(2,1) check (communication_rating between 1 and 5), stage_presence_rating numeric(2,1) check (stage_presence_rating between 1 and 5), notes text, deleted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now()), unique (organization_id, talent_code)
);
create table public.talent_disciplines (
  organization_id uuid not null references public.organizations(id) on delete cascade, talent_id uuid not null references public.talent(id) on delete cascade, discipline text not null, primary key (talent_id, discipline)
);
create table public.talent_rates (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, talent_id uuid not null references public.talent(id) on delete cascade,
  rate_type text not null, cost_cents bigint not null default 0, sell_cents bigint not null default 0, currency char(3) not null default 'EUR', notes text,
  created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now()), unique (talent_id, rate_type)
);
create table public.talent_media (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, talent_id uuid not null references public.talent(id) on delete cascade,
  media_type text not null, storage_path text not null, label text, is_primary boolean not null default false, created_at timestamptz not null default timezone('utc', now())
);
create table public.event_talent (
  organization_id uuid not null references public.organizations(id) on delete cascade, event_id uuid not null references public.events(id) on delete cascade, talent_id uuid not null references public.talent(id) on delete cascade,
  role text, status text not null default 'requested' check (status in ('requested','held','confirmed','cancelled')), agreed_cost_cents bigint not null default 0, notes text, primary key (event_id, talent_id)
);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, name text not null, company text, category text not null, phone text, email text, city text, rates text, notes text, rating numeric(2,1) check (rating between 1 and 5), deleted_at timestamptz, created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now())
);
create table public.concepts (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, name text not null, category text, description text, available_units integer not null default 1, recommended_performers integer, typical_sets integer, duration_minutes integer, client_sell_price_cents bigint, performer_cost_cents bigint, costume_cost_cents bigint, technical_requirements text, transport_requirements text, available_cities text[], notes text, deleted_at timestamptz, created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now())
);
create table public.storage_locations (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, name text not null, city text, rack text, shelf text, box text, notes text, unique (organization_id, name)
);
create table public.assets (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, asset_code text not null, name text not null, concept_id uuid references public.concepts(id) on delete set null, category text, photo_path text, quantity integer not null default 1 check (quantity >= 0), size text, storage_location_id uuid references public.storage_locations(id) on delete set null, condition text, replacement_value_cents bigint, status public.asset_status not null default 'available', last_used_on date, next_event_id uuid references public.events(id) on delete set null, repair_needed boolean not null default false, cleaning_needed boolean not null default false, notes text, deleted_at timestamptz, created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now()), unique (organization_id, asset_code)
);
create table public.asset_movements (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, asset_id uuid not null references public.assets(id) on delete restrict, event_id uuid references public.events(id) on delete set null, talent_id uuid references public.talent(id) on delete set null, checkout_at timestamptz not null default timezone('utc', now()), expected_return_at timestamptz, returned_at timestamptz, condition_before text, condition_after text, notes text, created_at timestamptz not null default timezone('utc', now())
);

create table public.proposals (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, proposal_code text not null, client_id uuid references public.clients(id) on delete set null, event_id uuid references public.events(id) on delete set null, issued_on date not null default current_date, valid_until date, status public.proposal_status not null default 'draft', client_message text, client_pdf_path text, created_by uuid references public.users(id) on delete set null, deleted_at timestamptz, created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now()), unique (organization_id, proposal_code)
);
create table public.proposal_options (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, proposal_id uuid not null references public.proposals(id) on delete cascade, option_code text not null, title text not null, description text, sort_order integer not null default 0, client_total_cents bigint not null default 0, internal_cost_cents bigint not null default 0, vat_percent numeric(5,2) not null default 21, created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now()), unique (proposal_id, option_code)
);
create table public.proposal_items (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, option_id uuid not null references public.proposal_options(id) on delete cascade, concept_id uuid references public.concepts(id) on delete set null, description text not null, quantity numeric(12,2) not null default 1 check (quantity > 0), sets text, duration_minutes integer, unit_cost_cents bigint not null default 0, unit_price_cents bigint not null default 0, travel_cents bigint not null default 0, accommodation_cents bigint not null default 0, production_cents bigint not null default 0, creative_fee_cents bigint not null default 0, extras_cents bigint not null default 0, created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now())
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, title text not null, description text, owner_id uuid references public.users(id) on delete set null, deadline timestamptz, priority public.task_priority not null default 'medium', status public.task_status not null default 'todo', client_id uuid references public.clients(id) on delete set null, event_id uuid references public.events(id) on delete set null, talent_id uuid references public.talent(id) on delete set null, proposal_id uuid references public.proposals(id) on delete set null, asset_id uuid references public.assets(id) on delete set null, payment_id uuid, completed_at timestamptz, deleted_at timestamptz, created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now())
);
create table public.payments (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, event_id uuid references public.events(id) on delete set null, client_id uuid references public.clients(id) on delete set null, supplier_id uuid references public.suppliers(id) on delete set null, talent_id uuid references public.talent(id) on delete set null, direction text not null check (direction in ('inbound','outbound')), kind text not null check (kind in ('deposit','balance','artist','supplier','other')), amount_cents bigint not null check (amount_cents >= 0), due_on date, paid_on date, status public.payment_status not null default 'pending', invoice_received boolean not null default false, notes text, created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now())
);
alter table public.tasks add constraint tasks_payment_fk foreign key (payment_id) references public.payments(id) on delete set null;
create table public.communications (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, client_id uuid references public.clients(id) on delete set null, event_id uuid references public.events(id) on delete set null, channel text not null check (channel in ('email','whatsapp','phone','meeting','note')), direction text check (direction in ('inbound','outbound')), subject text, body text not null, occurred_at timestamptz not null default timezone('utc', now()), external_id text, created_by uuid references public.users(id) on delete set null, created_at timestamptz not null default timezone('utc', now())
);
create table public.notes (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, client_id uuid references public.clients(id) on delete cascade, event_id uuid references public.events(id) on delete cascade, talent_id uuid references public.talent(id) on delete cascade, body text not null, created_by uuid references public.users(id) on delete set null, created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now())
);
create table public.files (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, storage_path text not null, file_name text not null, mime_type text, size_bytes bigint, client_id uuid references public.clients(id) on delete cascade, event_id uuid references public.events(id) on delete cascade, talent_id uuid references public.talent(id) on delete cascade, proposal_id uuid references public.proposals(id) on delete cascade, created_by uuid references public.users(id) on delete set null, created_at timestamptz not null default timezone('utc', now())
);
create table public.pricing_rules (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, name text not null, category text not null, unit text not null default 'unit', cost_cents bigint not null default 0, sell_cents bigint not null default 0, active boolean not null default true, notes text, created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now()), unique (organization_id, name)
);
create table public.activity_log (
  id bigint generated always as identity primary key, organization_id uuid not null references public.organizations(id) on delete cascade, actor_id uuid references public.users(id) on delete set null, entity_type text not null, entity_id uuid, action text not null, before_data jsonb, after_data jsonb, created_at timestamptz not null default timezone('utc', now())
);
create table public.ai_activity (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, actor_id uuid references public.users(id) on delete set null, action text not null, input_hash text, output jsonb, approved_at timestamptz, created_at timestamptz not null default timezone('utc', now())
);

create index clients_org_status_idx on public.clients(organization_id, status) where deleted_at is null;
create index events_org_date_idx on public.events(organization_id, event_date) where deleted_at is null;
create index events_org_status_idx on public.events(organization_id, status) where deleted_at is null;
create index talent_org_city_idx on public.talent(organization_id, city) where deleted_at is null;
create index tasks_org_deadline_idx on public.tasks(organization_id, deadline) where deleted_at is null and status <> 'done';
create index payments_org_status_idx on public.payments(organization_id, status);
create index activity_org_created_idx on public.activity_log(organization_id, created_at desc);

-- Ensure every authenticated user has a profile row. Organisation creation/invites remain explicit.
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin insert into public.users (id, full_name) values (new.id, coalesce(new.raw_user_meta_data->>'full_name','')); return new; end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.is_org_member(target_org uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.organization_members where organization_id = target_org and user_id = auth.uid());
$$;
create or replace function public.is_org_admin(target_org uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.organization_members where organization_id = target_org and user_id = auth.uid() and role = 'admin');
$$;

-- RLS: all domain tables require membership; admin-only writes are added to configuration tables.
do $$ declare table_name text; begin
  foreach table_name in array array['clients','client_contacts','leads','events','event_requirements','event_financials','talent','talent_disciplines','talent_rates','talent_media','event_talent','suppliers','concepts','storage_locations','assets','asset_movements','proposals','proposal_options','proposal_items','tasks','payments','communications','notes','files','pricing_rules','activity_log','ai_activity'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('create policy %I_member_select on public.%I for select using (public.is_org_member(organization_id))', table_name, table_name);
    execute format('create policy %I_member_insert on public.%I for insert with check (public.is_org_member(organization_id))', table_name, table_name);
    execute format('create policy %I_member_update on public.%I for update using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id))', table_name, table_name);
    execute format('create policy %I_member_delete on public.%I for delete using (public.is_org_member(organization_id))', table_name, table_name);
  end loop;
end $$;
alter table public.organizations enable row level security;
create policy organizations_member_select on public.organizations for select using (public.is_org_member(id));
create policy organizations_member_update on public.organizations for update using (public.is_org_admin(id)) with check (public.is_org_admin(id));
alter table public.users enable row level security;
create policy users_self_or_colleague_select on public.users for select using (id = auth.uid() or exists(select 1 from public.organization_members mine join public.organization_members colleague on colleague.organization_id = mine.organization_id where mine.user_id = auth.uid() and colleague.user_id = users.id));
alter table public.organization_members enable row level security;
create policy members_read_same_org on public.organization_members for select using (public.is_org_member(organization_id));
create policy members_admin_write on public.organization_members for all using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id));

do $$ declare table_name text; begin
  foreach table_name in array array['organizations','users'] loop
    execute format('create trigger %I_updated_at before update on public.%I for each row execute procedure public.set_updated_at()', table_name, table_name);
  end loop;
  foreach table_name in array array['clients','client_contacts','leads','events','event_requirements','event_financials','talent','talent_rates','suppliers','concepts','assets','proposals','proposal_options','proposal_items','tasks','payments','notes','pricing_rules'] loop
    execute format('create trigger %I_updated_at before update on public.%I for each row execute procedure public.set_updated_at()', table_name, table_name);
  end loop;
end $$;
