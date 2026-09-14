begin;
alter table public.talent
 add column aliases text[] not null default '{}',
 add column tax_id text not null default '',
 add column iban text not null default '',
 add column billing_supplier_id uuid references public.suppliers(id),
 add column billing_confidence text not null default 'review' check(billing_confidence in('confirmed','review')),
 add column identity_sources jsonb not null default '[]',
 add column merged_into uuid references public.talent(id),
 add constraint talent_merge_self check(merged_into is distinct from id);
alter table public.suppliers add column deleted_at timestamptz,add column merged_into uuid references public.suppliers(id),add constraint supplier_merge_self check(merged_into is distinct from id);
create function public.identity_reference_guard() returns trigger language plpgsql set search_path=public as $$
declare target_org uuid;begin
 if new.merged_into is not null then
  execute format('select organization_id from public.%I where id=$1 and merged_into is null',tg_table_name) into target_org using new.merged_into;
  if target_org is distinct from new.organization_id then raise exception 'Ficha principal fuera del espacio o ya fusionada';end if;
  if new.deleted_at is null then raise exception 'Una ficha fusionada debe permanecer archivada';end if;
 end if;
 if tg_table_name='talent' and (to_jsonb(new)->>'billing_supplier_id') is not null then
  select organization_id into target_org from public.suppliers where id=(to_jsonb(new)->>'billing_supplier_id')::uuid and merged_into is null;
  if target_org is distinct from new.organization_id then raise exception 'Proveedor fuera del espacio';end if;
 end if;return new;end $$;
create trigger talent_identity_guard before insert or update on public.talent for each row execute function public.identity_reference_guard();
create trigger supplier_identity_guard before insert or update on public.suppliers for each row execute function public.identity_reference_guard();

-- An existing expense remains one invoice; links never replicate its monetary total.
create table public.expense_artists(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),
 expense_id uuid not null references public.expenses(id),event_id uuid not null references public.events(id),talent_id uuid not null references public.talent(id),
 allocated_fee_cents bigint check(allocated_fee_cents>=0),source_note text not null default '',
 unique(expense_id,event_id,talent_id)
);
alter table public.expenses add column covered_by_expense_id uuid references public.expenses(id),add constraint expense_coverage_self check(covered_by_expense_id is distinct from id);
create function public.expense_coverage_guard() returns trigger language plpgsql set search_path=public as $$begin
 if new.covered_by_expense_id is not null and not exists(select 1 from public.expenses p where p.id=new.covered_by_expense_id and p.organization_id=new.organization_id and p.covered_by_expense_id is null and p.status<>'cancelled') then raise exception 'Factura que cubre este fee no disponible';end if;
 return new;end $$;
create trigger expense_coverage_guard before insert or update on public.expenses for each row execute function public.expense_coverage_guard();
alter table public.expense_artists enable row level security;
grant select,insert,update,delete on public.expense_artists to authenticated;
create policy expense_artist_read on public.expense_artists for select to authenticated using(public.has_org_role(organization_id,array['admin','producer','sales','wardrobe','artist','freelancer']));
create policy expense_artist_write on public.expense_artists for all to authenticated using(public.has_org_role(organization_id,array['admin','producer'])) with check(public.has_org_role(organization_id,array['admin','producer']));
create trigger expense_artist_tenant before insert or update on public.expense_artists for each row execute function public.enforce_tenant_references();
create function public.expense_artist_guard() returns trigger language plpgsql set search_path=public as $$begin
 if not exists(select 1 from public.event_talent where event_id=new.event_id and talent_id=new.talent_id and organization_id=new.organization_id) then raise exception 'Primero asigna el artista al evento';end if;
 return new;end $$;
create trigger expense_artist_guard before insert or update on public.expense_artists for each row execute function public.expense_artist_guard();

create function public.merge_identity(main_id uuid,duplicate_id uuid,entity text,review_note text default '') returns jsonb language plpgsql security definer set search_path=public as $$
declare a jsonb;b jsonb;org uuid;col record;v jsonb;before_counts jsonb;aliases_all text[];tbl text;refs bigint;begin
 if entity not in('talent','suppliers') or main_id=duplicate_id then raise exception 'Selecciona dos fichas distintas';end if;
 tbl:=entity;
 perform pg_advisory_xact_lock(hashtext('identity-merge'));
 execute format('select to_jsonb(t) from public.%I t where id=$1 for update',tbl) into a using main_id;
 execute format('select to_jsonb(t) from public.%I t where id=$1 for update',tbl) into b using duplicate_id;
 org:=(a->>'organization_id')::uuid;
 if a is null or b is null or org is distinct from (b->>'organization_id')::uuid or not public.has_org_role(org,array['admin','producer']) then raise exception 'No tienes acceso a estas fichas';end if;
 if a->>'deleted_at' is not null or a->>'merged_into' is not null or b->>'merged_into' is not null then raise exception 'Revisa el estado actual de las fichas';end if;
 if nullif(a->>'tax_id','') is not null and nullif(b->>'tax_id','') is not null and upper(regexp_replace(a->>'tax_id','[^a-zA-Z0-9]','','g'))<>upper(regexp_replace(b->>'tax_id','[^a-zA-Z0-9]','','g')) then raise exception 'Los documentos fiscales son distintos: corrígelos tras confirmar antes de fusionar';end if;
 if review_note='' then raise exception 'Indica la evidencia que confirma esta fusión';end if;
 if tbl='talent' and exists(select 1 from public.expenses x join public.expenses y on x.event_id=y.event_id and x.organization_id=y.organization_id where x.talent_id=main_id and y.talent_id=duplicate_id and x.status<>'cancelled' and y.status<>'cancelled') then raise exception 'Ambas fichas tienen gastos en el mismo evento: revisa los importes antes de fusionar';end if;
 if tbl='talent' and exists(select 1 from public.event_talent x join public.event_talent y using(event_id) where x.talent_id=main_id and y.talent_id=duplicate_id and x.agreed_cost_cents>0 and y.agreed_cost_cents>0 and x.agreed_cost_cents<>y.agreed_cost_cents) then raise exception 'Conflicto de fee en un mismo evento';end if;
 select array_agg(distinct x) into aliases_all from (select jsonb_array_elements_text(coalesce(a->'aliases','[]')) x union select jsonb_array_elements_text(coalesce(b->'aliases','[]')) union select coalesce(b->>'real_name',b->>'name') union select nullif(b->>'stage_name','')) q where x is not null;
 -- Fill only empty primary fields; the full duplicate remains retained and audited.
 for col in select column_name,udt_name from information_schema.columns where table_schema='public' and table_name=tbl and column_name not in('id','organization_id','talent_code','real_name','name','normalized_name','created_at','updated_at','deleted_at','merged_into','aliases','notes','identity_sources') loop
  if a->col.column_name in('null'::jsonb,'""'::jsonb,'[]'::jsonb) and b->col.column_name is not null and b->col.column_name<>'null'::jsonb then
   execute format('update public.%I set %I=(jsonb_populate_record(null::public.%I,$1)).%I where id=$2',tbl,col.column_name,tbl,col.column_name) using jsonb_build_object(col.column_name,b->col.column_name),main_id;
  end if;
 end loop;
 execute format('update public.%I set aliases=$1,notes=concat_ws(E''\n'',nullif(notes,''''),$2,$3) where id=$4',tbl) using aliases_all,nullif(b->>'notes',''),'Fusión verificada: '||coalesce(b->>'real_name',b->>'name')||' → '||coalesce(a->>'real_name',a->>'name')||'. '||review_note,main_id;
 if tbl='talent' then
  update public.talent set email=(select string_agg(distinct trim(x),'; ') from regexp_split_to_table(concat_ws(';',nullif(a->>'email',''),nullif(b->>'email','')),'[;,]') x where trim(x)<>'') where id=main_id;
  update public.talent set identity_sources=identity_sources||jsonb_build_array(jsonb_build_object('merged_record',b,'reason',review_note,'at',now())) ,skills=array(select distinct unnest(coalesce(skills,'{}')||coalesce((select skills from public.talent where id=duplicate_id),'{}'))),updated_at=now() where id=main_id;
  update public.event_talent x set agreed_cost_cents=greatest(x.agreed_cost_cents,y.agreed_cost_cents),notes=concat_ws(E'\n',x.notes,y.notes,'Registro fusionado: '||duplicate_id) from public.event_talent y where x.event_id=y.event_id and x.talent_id=main_id and y.talent_id=duplicate_id;
  delete from public.event_talent y where y.talent_id=duplicate_id and exists(select 1 from public.event_talent x where x.event_id=y.event_id and x.talent_id=main_id);
  update public.event_talent set talent_id=main_id where talent_id=duplicate_id;
  delete from public.expense_artists y where y.talent_id=duplicate_id and exists(select 1 from public.expense_artists x where x.expense_id=y.expense_id and x.event_id=y.event_id and x.talent_id=main_id) and y.allocated_fee_cents is null;
  update public.expense_artists set talent_id=main_id where talent_id=duplicate_id;
  for tbl in select distinct table_name from information_schema.columns where table_schema='public' and column_name='talent_id' and table_name not in('event_talent','expense_artists') loop
   execute format('update public.%I set talent_id=$1 where talent_id=$2',tbl) using main_id,duplicate_id;
  end loop;tbl:='talent';
 else
  for tbl in select distinct table_name from information_schema.columns where table_schema='public' and column_name in('supplier_id','billing_supplier_id') loop
   if tbl='talent' then update public.talent set billing_supplier_id=main_id where billing_supplier_id=duplicate_id;
   else execute format('update public.%I set supplier_id=$1 where supplier_id=$2',tbl) using main_id,duplicate_id;end if;
  end loop;tbl:='suppliers';
 end if;
 -- Verification precedes archival; any failure rolls the entire transaction back.
 for col in select table_name,column_name from information_schema.columns where table_schema='public' and column_name=(case when entity='talent' then 'talent_id' else 'supplier_id' end) loop
  execute format('select count(*) from public.%I where %I=$1',col.table_name,col.column_name) into refs using duplicate_id;
  if refs>0 then raise exception 'Quedan relaciones sin trasladar';end if;
 end loop;
 execute format('update public.%I set merged_into=$1,deleted_at=now() where id=$2',entity) using main_id,duplicate_id;
 return jsonb_build_object('main_id',main_id,'archived_id',duplicate_id,'verified',true);
end $$;
revoke all on function public.merge_identity(uuid,uuid,text,text) from public;
grant execute on function public.merge_identity(uuid,uuid,text,text) to authenticated;
notify pgrst,'reload schema';
commit;
