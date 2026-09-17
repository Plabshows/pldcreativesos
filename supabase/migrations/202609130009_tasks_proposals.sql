begin;
-- Quote documents are versioned snapshots. Clients, shows and events remain their existing entities.
create table if not exists public.proposals (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 proposal_code text not null, title text not null check(length(trim(title)) between 1 and 200),
 client_id uuid references public.clients(id), opportunity_id uuid references public.opportunities(id),
 event_id uuid references public.events(id), owner_id uuid references public.users(id), created_by uuid references public.users(id),
 status text not null default 'draft' check(status in ('draft','ready','sent','viewed','follow_up','accepted','declined','expired')),
 document jsonb not null check(jsonb_typeof(document)='object'), version integer not null default 1 check(version>0),
 deleted_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(organization_id,proposal_code)
);
alter table public.proposals enable row level security;
create policy proposals_read on public.proposals for select to authenticated using(public.has_org_role(organization_id,array['admin','producer','sales']));
create policy proposals_insert on public.proposals for insert to authenticated with check(public.has_org_role(organization_id,array['admin','producer','sales']));
create policy proposals_update on public.proposals for update to authenticated using(public.has_org_role(organization_id,array['admin','producer','sales'])) with check(public.has_org_role(organization_id,array['admin','producer','sales']));
grant select,insert,update on public.proposals to authenticated;
create trigger proposals_tenant before insert or update on public.proposals for each row execute function public.enforce_tenant_references();
create trigger proposals_updated before update on public.proposals for each row execute function public.crm_set_updated_at();
create function public.validate_proposal_shows() returns trigger language plpgsql set search_path=public,pg_temp as $$
declare opt jsonb; item jsonb; show_id_text text;
begin
 if jsonb_typeof(new.document->'options') is distinct from 'array' then raise exception 'Faltan las opciones'; end if;
 for opt in select * from jsonb_array_elements(new.document->'options') loop
  for item in select * from jsonb_array_elements(opt->'lines') loop
   for show_id_text in select jsonb_array_elements_text(item->'show_ids') loop
    if not exists(select 1 from public.shows where id=show_id_text::uuid and organization_id=new.organization_id) then raise exception 'Show no disponible en esta organización'; end if;
   end loop;
  end loop;
 end loop;
 return new;
end $$;
create trigger proposals_shows before insert or update on public.proposals for each row execute function public.validate_proposal_shows();

alter table public.tasks add column if not exists talent_id uuid references public.talent(id);
alter table public.tasks add column if not exists proposal_id uuid references public.proposals(id);
alter table public.tasks add column if not exists lead_id uuid references public.leads(id);
alter table public.tasks add column if not exists opportunity_id uuid references public.opportunities(id);
alter table public.tasks add column if not exists completed_at timestamptz;
alter table public.tasks add column if not exists version integer not null default 1;
alter table public.tasks enable row level security;
drop policy if exists tasks_all on public.tasks;
create policy tasks_team_read on public.tasks for select to authenticated using(public.has_org_role(organization_id,array['admin','producer','sales']));
create policy tasks_team_insert on public.tasks for insert to authenticated with check(public.has_org_role(organization_id,array['admin','producer','sales']));
create policy tasks_team_update on public.tasks for update to authenticated using(public.has_org_role(organization_id,array['admin','producer','sales'])) with check(public.has_org_role(organization_id,array['admin','producer','sales']));
grant select,insert,update on public.tasks to authenticated;
create trigger tasks_tenant before insert or update on public.tasks for each row execute function public.enforce_tenant_references();
create trigger tasks_updated before update on public.tasks for each row execute function public.crm_set_updated_at();
create index if not exists tasks_org_deadline on public.tasks(organization_id,deadline) where deleted_at is null;
create index proposals_org_updated on public.proposals(organization_id,updated_at desc);

-- One transaction for accepted quote → original event + show links + opportunity.
create function public.proposal_create_event(proposal_uuid uuid) returns uuid language plpgsql security invoker set search_path=public,pg_temp as $$
declare p public.proposals; op public.opportunities; chosen jsonb; item jsonb; new_event uuid; show_text text; revenue bigint:=0;
begin
 select * into p from public.proposals where id=proposal_uuid and deleted_at is null for update;
 if not found or not public.has_org_role(p.organization_id,array['admin','producer']) then raise exception 'No tienes permiso para crear este evento'; end if;
 if p.event_id is not null then return p.event_id; end if;
 if p.status<>'accepted' or p.client_id is null or nullif(p.document->>'event_date','') is null then raise exception 'Se necesita propuesta aceptada, cliente y fecha'; end if;
 if not exists(select 1 from public.clients where id=p.client_id and organization_id=p.organization_id and deleted_at is null) then raise exception 'Cliente no disponible'; end if;
 if p.opportunity_id is not null then
  select * into op from public.opportunities where id=p.opportunity_id and organization_id=p.organization_id and deleted_at is null for update;
  if not found then raise exception 'Oportunidad no disponible'; end if;
  if op.client_id is not null and op.client_id<>p.client_id then raise exception 'El cliente no coincide con la oportunidad'; end if;
  if op.event_id is not null then
   if not exists(select 1 from public.events where id=op.event_id and deleted_at is null) then raise exception 'El evento de la oportunidad está archivado'; end if;
   update public.proposals set event_id=op.event_id,version=version+1 where id=p.id; return op.event_id;
  end if;
 end if;
 select value into chosen from jsonb_array_elements(p.document->'options') where value->>'id'=p.document->>'selected_option_id';
 if chosen is null then raise exception 'Selecciona una opción'; end if;
 if jsonb_array_length(chosen->'lines')=0 then raise exception 'La opción no tiene partidas'; end if;
 for item in select * from jsonb_array_elements(chosen->'lines') loop
  if item->>'unit_price_cents' is null then raise exception 'Falta un precio'; end if;
  if (item->>'quantity')::int<1 or (item->>'units')::int<1 or (item->>'unit_price_cents')::bigint<0 then raise exception 'Importe no válido'; end if;
  if item->>'unit' in ('performer_event','package') and (item->>'units')::int<>1 then raise exception 'El paquete o evento no se multiplica por pases'; end if;
  revenue:=revenue+(item->>'quantity')::bigint*(item->>'units')::bigint*(item->>'unit_price_cents')::bigint;
 end loop;
 revenue:=revenue-coalesce((chosen->>'discount_cents')::bigint,0);
 if revenue<0 then raise exception 'Descuento no válido'; end if;
 insert into public.events(organization_id,event_code,event_name,client_id,event_date,venue,city,owner_id,status,income_cents,internal_notes)
 values(p.organization_id,'EV-QUOTE-'||p.id,p.title,p.client_id,(p.document->>'event_date')::date,p.document->>'venue',p.document->>'city',auth.uid(),'production',revenue,p.document->>'internal_notes') returning id into new_event;
 for item in select * from jsonb_array_elements(chosen->'lines') loop
  for show_text in select jsonb_array_elements_text(item->'show_ids') loop
   insert into public.event_shows(organization_id,event_id,show_id) values(p.organization_id,new_event,show_text::uuid) on conflict(event_id,show_id) do nothing;
  end loop;
 end loop;
 update public.proposals set event_id=new_event,version=version+1 where id=p.id;
 if p.opportunity_id is not null then
  update public.opportunities set event_id=new_event,stage='won' where id=p.opportunity_id;
  insert into public.crm_activities(organization_id,opportunity_id,actor_id,kind,body) values(p.organization_id,p.opportunity_id,auth.uid(),'event_created','Evento creado desde propuesta '||p.proposal_code);
 end if;
 return new_event;
end $$;
revoke all on function public.proposal_create_event(uuid) from public;
grant execute on function public.proposal_create_event(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
