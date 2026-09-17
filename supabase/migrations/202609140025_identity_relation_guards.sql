begin;
alter table public.suppliers add column identity_sources jsonb not null default '[]';
create or replace function public.merge_identity(main_id uuid,duplicate_id uuid,entity text,review_note text default '') returns jsonb language plpgsql security definer set search_path=public as $$
declare a jsonb;b jsonb;org uuid;col record;v jsonb;before_counts jsonb;aliases_all text[];tbl text;refs bigint;related_sources jsonb:='[]';related_rows jsonb;begin
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
 -- Preserve all original related rows, including overlapping assignments and fee allocations.
 for col in select table_name,column_name from information_schema.columns where table_schema='public' and column_name=(case when entity='talent' then 'talent_id' else 'supplier_id' end) loop
  execute format('select coalesce(jsonb_agg(to_jsonb(r)),''[]''::jsonb) from public.%I r where %I=$1',col.table_name,col.column_name) into related_rows using duplicate_id;
  if jsonb_array_length(related_rows)>0 then related_sources:=related_sources||jsonb_build_array(jsonb_build_object('table',col.table_name,'rows',related_rows));end if;
 end loop;
 execute format('update public.%I set identity_sources=identity_sources||$1 where id=$2',entity) using jsonb_build_array(jsonb_build_object('merged_record',b,'relationships',related_sources,'reason',review_note,'at',now())),main_id;
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
  update public.talent set skills=array(select distinct unnest(coalesce(skills,'{}')||coalesce((select skills from public.talent where id=duplicate_id),'{}'))),updated_at=now() where id=main_id;
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
 execute format('update public.%I set merged_into=$1 where merged_into=$2',entity) using main_id,duplicate_id;
 execute format('update public.%I set merged_into=$1,deleted_at=now() where id=$2',entity) using main_id,duplicate_id;
 return jsonb_build_object('main_id',main_id,'archived_id',duplicate_id,'verified',true);
end $$;
create function public.active_identity_relation_guard() returns trigger language plpgsql set search_path=public as $$
declare col text;target text;ref uuid;previous uuid;begin
 foreach col in array array['talent_id','supplier_id','billing_supplier_id'] loop
  ref:=nullif(to_jsonb(new)->>col,'')::uuid;
  if tg_op='UPDATE' then previous:=nullif(to_jsonb(old)->>col,'')::uuid;else previous:=null;end if;
  if ref is not null and ref is distinct from previous then
   target:=case when col='talent_id' then 'talent' else 'suppliers' end;
   if not exists(select 1 from information_schema.columns where table_schema='public' and table_name=target and column_name='merged_into') then continue;end if;
   execute format('select id from public.%I where id=$1 and organization_id=$2 and merged_into is null',target) into previous using ref,new.organization_id;
   if previous is null then raise exception 'Esta ficha ha sido fusionada: selecciona la ficha principal';end if;
  end if;
 end loop;return new;end $$;
do $$declare t text;begin
 for t in select distinct c.table_name from information_schema.columns c where c.table_schema='public' and c.column_name in('talent_id','supplier_id','billing_supplier_id') and exists(select 1 from information_schema.columns o where o.table_schema='public' and o.table_name=c.table_name and o.column_name='organization_id') loop
  execute format('create trigger active_identity_relation before insert or update on public.%I for each row execute function public.active_identity_relation_guard()',t);
 end loop;end $$;
notify pgrst,'reload schema';
commit;
