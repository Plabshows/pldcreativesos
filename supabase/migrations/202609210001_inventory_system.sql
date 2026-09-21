begin;

create extension if not exists unaccent;

-- 1. Inventory Concepts
create table if not exists public.inventory_concepts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade not null,
  name text not null,
  category text not null check (category in ('Characters','Costumes','Heads','Props','Accessories','Technical','Other')),
  description text,
  main_image text,
  total_units integer default 0,
  default_location text default 'Ibiza Warehouse',
  production_cost bigint,
  replacement_value bigint,
  suggested_rental_price bigint,
  active boolean default true,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Physical Inventory Items
create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade not null,
  concept_id uuid references public.inventory_concepts(id) on delete cascade not null,
  item_code text not null,
  name text,
  size text,
  condition text default 'GOOD' check (condition in ('NEW','EXCELLENT','GOOD','USED','DAMAGED')),
  status text default 'AVAILABLE' check (status in ('AVAILABLE','RESERVED','OUT','REPAIR','CLEANING','LOST','RETIRED')),
  location text default 'Ibiza Warehouse',
  purchase_or_build_date date,
  production_cost bigint,
  replacement_value bigint,
  main_image text,
  notes text,
  last_event_id uuid references public.events(id) on delete set null,
  last_used_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. Inventory Repairs
create table if not exists public.inventory_repairs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade not null,
  inventory_item_id uuid references public.inventory_items(id) on delete cascade not null,
  date_reported date default current_date,
  problem text not null,
  status text default 'PENDING' check (status in ('PENDING','IN_PROGRESS','DONE','NOT_REPAIRABLE')),
  estimated_cost bigint,
  actual_cost bigint,
  assigned_to text,
  date_completed date,
  before_image text,
  after_image text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 4. Event Inventory Allocations
create table if not exists public.inventory_event_allocations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade not null,
  event_id uuid references public.events(id) on delete cascade not null,
  concept_id uuid references public.inventory_concepts(id) on delete cascade not null,
  inventory_item_id uuid references public.inventory_items(id) on delete set null,
  quantity integer default 1 check (quantity > 0),
  status text default 'RESERVED' check (status in ('RESERVED','OUT','RETURNED','CANCELLED')),
  out_at timestamptz,
  returned_at timestamptz,
  rental_revenue bigint,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Trigger Function: Update Concept total_units
create or replace function public.sync_inventory_concept_units()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if (TG_OP = 'DELETE') then
    update public.inventory_concepts
    set total_units = (
      select count(*) from public.inventory_items
      where concept_id = OLD.concept_id and status <> 'RETIRED'
    )
    where id = OLD.concept_id;
    return OLD;
  else
    update public.inventory_concepts
    set total_units = (
      select count(*) from public.inventory_items
      where concept_id = NEW.concept_id and status <> 'RETIRED'
    )
    where id = NEW.concept_id;
    if (TG_OP = 'UPDATE' and OLD.concept_id <> NEW.concept_id) then
      update public.inventory_concepts
      set total_units = (
        select count(*) from public.inventory_items
        where concept_id = OLD.concept_id and status <> 'RETIRED'
      )
      where id = OLD.concept_id;
    end if;
    return NEW;
  end if;
end;
$$;

drop trigger if exists trg_sync_inventory_concept_units on public.inventory_items;
create trigger trg_sync_inventory_concept_units
after insert or update of concept_id, status or delete
on public.inventory_items
for each row
execute function public.sync_inventory_concept_units();

-- Enable RLS
alter table public.inventory_concepts enable row level security;
alter table public.inventory_items enable row level security;
alter table public.inventory_repairs enable row level security;
alter table public.inventory_event_allocations enable row level security;

-- Policies for inventory_concepts
drop policy if exists inventory_concepts_policy on public.inventory_concepts;
create policy inventory_concepts_policy on public.inventory_concepts
  for all using (public.has_org_role(organization_id, array['admin','producer','sales']));

-- Policies for inventory_items
drop policy if exists inventory_items_policy on public.inventory_items;
create policy inventory_items_policy on public.inventory_items
  for all using (public.has_org_role(organization_id, array['admin','producer','sales']));

-- Policies for inventory_repairs
drop policy if exists inventory_repairs_policy on public.inventory_repairs;
create policy inventory_repairs_policy on public.inventory_repairs
  for all using (public.has_org_role(organization_id, array['admin','producer','sales']));

-- Policies for inventory_event_allocations
drop policy if exists inventory_event_allocations_policy on public.inventory_event_allocations;
create policy inventory_event_allocations_policy on public.inventory_event_allocations
  for all using (public.has_org_role(organization_id, array['admin','producer','sales']));

-- Seed default concepts for all existing organizations
do $$
declare
  org record;
begin
  for org in select id from public.organizations loop
    insert into public.inventory_concepts (organization_id, name, category, default_location)
    values
      (org.id, 'TV HEADS', 'Heads', 'Ibiza Warehouse'),
      (org.id, 'BOOMBOX HEADS', 'Heads', 'Ibiza Warehouse'),
      (org.id, 'POM POM MONSTERS', 'Characters', 'Ibiza Warehouse'),
      (org.id, 'MIRROR MEN', 'Characters', 'Ibiza Warehouse'),
      (org.id, 'MIRROR WOMAN', 'Characters', 'Ibiza Warehouse'),
      (org.id, 'MIRROR RABBITS', 'Characters', 'Ibiza Warehouse'),
      (org.id, 'MIRROR UNICORNS', 'Characters', 'Ibiza Warehouse'),
      (org.id, 'MIRROR BALL HEADS', 'Heads', 'Ibiza Warehouse'),
      (org.id, 'TEDDY MONSTER', 'Characters', 'Ibiza Warehouse'),
      (org.id, 'TEDDY BEAR', 'Characters', 'Ibiza Warehouse'),
      (org.id, 'TEDDY GIRLS', 'Characters', 'Ibiza Warehouse'),
      (org.id, 'HUMANOIDS', 'Characters', 'Ibiza Warehouse'),
      (org.id, 'THE FACE', 'Characters', 'Ibiza Warehouse'),
      (org.id, 'HEDGE / BUSH', 'Props', 'Ibiza Warehouse'),
      (org.id, 'SLINKY', 'Props', 'Ibiza Warehouse'),
      (org.id, 'SMILEYS', 'Costumes', 'Ibiza Warehouse'),
      (org.id, 'INFLATABLE GORILLAS', 'Characters', 'Ibiza Warehouse'),
      (org.id, 'SHAMANS', 'Characters', 'Ibiza Warehouse'),
      (org.id, 'ROLLER LAB', 'Other', 'Ibiza Warehouse')
    on conflict do nothing;
  end loop;
end;
$$;

notify pgrst, 'reload schema';
commit;
