-- Phase A. Additive only. Live preflight 2026-09-13: leads/client_contacts absent.
begin;
-- Support the repaired live schema as well as installations of the initial migration.
create table if not exists public.client_contacts (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
  client_id uuid not null references public.clients(id), full_name text not null,
  role text,email text,phone text,whatsapp text,instagram text,is_primary boolean not null default false,
  created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),
  client_id uuid references public.clients(id),title text not null check(length(trim(title)) between 1 and 200),
  stage text not null default 'new_lead',
  estimated_value_cents bigint not null default 0 check(estimated_value_cents>=0),
  probability_percent numeric not null default 10 check(probability_percent between 0 and 100),
  owner_id uuid references public.users(id),next_action text,next_action_at timestamptz,last_activity_at timestamptz,
  notes text,deleted_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create or replace function public.crm_set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at=now();return new;end $$;
alter table public.client_contacts enable row level security;
alter table public.leads enable row level security;
create policy leads_crm_team on public.leads for all to authenticated using(public.has_org_role(organization_id,array['admin','producer','sales'])) with check(public.has_org_role(organization_id,array['admin','producer','sales']));
create policy contacts_crm_team on public.client_contacts for all to authenticated using(public.has_org_role(organization_id,array['admin','producer','sales'])) with check(public.has_org_role(organization_id,array['admin','producer','sales']));
grant select,insert,update on public.leads,public.client_contacts to authenticated;
create trigger leads_crm_tenant before insert or update on public.leads for each row execute function public.enforce_tenant_references();
create trigger contacts_crm_tenant before insert or update on public.client_contacts for each row execute function public.enforce_tenant_references();
create trigger leads_crm_updated before update on public.leads for each row execute function public.crm_set_updated_at();
alter table public.leads
  add column if not exists company_name text not null default '',
  add column if not exists contact_id uuid references public.client_contacts(id),
  add column if not exists contact_name text not null default '',
  add column if not exists email text not null default '',
  add column if not exists phone text not null default '',
  add column if not exists whatsapp text not null default '',
  add column if not exists event_type text not null default '',
  add column if not exists event_date date,
  add column if not exists city text not null default '',
  add column if not exists country text not null default '',
  add column if not exists venue text not null default '',
  add column if not exists source text not null default 'Other',
  add column if not exists crm_stage text not null default 'new_lead',
  add column if not exists expected_close_date date,
  add column if not exists next_action_date date,
  add column if not exists next_action_owner_id uuid references public.users(id),
  add column if not exists lost_reason text not null default '';
-- Legacy stage remains intact; map only recognised stages into the new pipeline.
update public.leads set crm_stage=case when stage::text in ('new_lead','contacted','follow_up','negotiation','won','lost') then stage::text when stage::text='proposal' then 'proposal_needed' else 'new_lead' end;
update public.leads set next_action_date=(next_action_at at time zone 'Europe/Madrid')::date,next_action_owner_id=owner_id where next_action_at is not null;
alter table public.leads add constraint leads_crm_stage_check check(crm_stage in('new_lead','contacted','qualified','proposal_needed','proposal_sent','follow_up','negotiation','verbal_yes','won','lost'));
create table public.opportunities (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
  lead_id uuid unique references public.leads(id), client_id uuid references public.clients(id), contact_id uuid references public.client_contacts(id),
  event_id uuid references public.events(id), owner_id uuid references public.users(id),
  title text not null check(length(trim(title)) between 1 and 200),
  company_name text not null default '',contact_name text not null default '',email text not null default '',phone text not null default '',whatsapp text not null default '',
  event_type text not null default '',event_date date,city text not null default '',country text not null default '',venue text not null default '',
  estimated_value_cents bigint not null default 0 check(estimated_value_cents>=0),probability_percent numeric not null default 10 check(probability_percent between 0 and 100),
  source text not null default 'Other',stage text not null default 'new_lead' check(stage in('new_lead','contacted','qualified','proposal_needed','proposal_sent','follow_up','negotiation','verbal_yes','won','lost')),
  expected_close_date date,next_action text,next_action_date date,next_action_owner_id uuid references public.users(id),
  notes text,lost_reason text not null default '',last_activity_at timestamptz,
  created_at timestamptz not null default now(),updated_at timestamptz not null default now(),deleted_at timestamptz
);
create table public.crm_activities (
  id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),
  lead_id uuid references public.leads(id),opportunity_id uuid references public.opportunities(id),
  actor_id uuid references public.users(id),kind text not null,body text not null check(length(trim(body)) between 1 and 10000),created_at timestamptz not null default now(),
  check(num_nonnulls(lead_id,opportunity_id)=1)
);
create index opportunities_org_stage on public.opportunities(organization_id,stage) where deleted_at is null;
create index crm_activities_org_time on public.crm_activities(organization_id,created_at desc);
alter table public.opportunities enable row level security;
alter table public.crm_activities enable row level security;
create policy opportunities_team on public.opportunities for all to authenticated using(public.has_org_role(organization_id,array['admin','producer','sales'])) with check(public.has_org_role(organization_id,array['admin','producer','sales']));
create policy crm_activities_read on public.crm_activities for select to authenticated using(public.has_org_role(organization_id,array['admin','producer','sales']));
create policy crm_activities_insert on public.crm_activities for insert to authenticated with check(public.has_org_role(organization_id,array['admin','producer','sales']) and actor_id=auth.uid());
grant select,insert,update on public.opportunities to authenticated;
grant select,insert on public.crm_activities to authenticated;
create trigger opportunities_tenant before insert or update on public.opportunities for each row execute function public.enforce_tenant_references();
create trigger crm_activities_tenant before insert or update on public.crm_activities for each row execute function public.enforce_tenant_references();
create trigger opportunities_updated before update on public.opportunities for each row execute function public.crm_set_updated_at();
-- Activity and status history are recorded atomically with the business write.
create function public.crm_record_change() returns trigger language plpgsql set search_path=public as $$
declare new_stage text; old_stage text; begin
  new_stage:=coalesce(to_jsonb(new)->>'crm_stage',to_jsonb(new)->>'stage');
  if tg_op='UPDATE' then old_stage:=coalesce(to_jsonb(old)->>'crm_stage',to_jsonb(old)->>'stage'); end if;
  if tg_op='INSERT' or new_stage is distinct from old_stage then
    insert into public.crm_activities(organization_id,lead_id,opportunity_id,actor_id,kind,body)
    values(new.organization_id,case when tg_table_name='leads' then new.id end,case when tg_table_name='opportunities' then new.id end,auth.uid(),case when tg_op='INSERT' then 'created' else 'status' end,case when tg_op='INSERT' then 'Registro creado' else old_stage||' → '||new_stage end);
  end if; return new;
end $$;
create trigger leads_crm_history after insert or update on public.leads for each row execute function public.crm_record_change();
create trigger opportunities_crm_history after insert or update on public.opportunities for each row execute function public.crm_record_change();
create function public.crm_touch_activity() returns trigger language plpgsql set search_path=public as $$
begin
  if new.lead_id is not null then update public.leads set last_activity_at=new.created_at where id=new.lead_id; end if;
  if new.opportunity_id is not null then update public.opportunities set last_activity_at=new.created_at where id=new.opportunity_id; end if;
  return new;
end $$;
create trigger crm_activity_touch after insert on public.crm_activities for each row execute function public.crm_touch_activity();
notify pgrst,'reload schema';
commit;
