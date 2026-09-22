// Generates a reviewable, transactional import. Does not connect or write to Supabase.
import {readFileSync, writeFileSync} from 'node:fs';
const manifest = JSON.parse(readFileSync(new URL('../lib/inventory-ibiza.json', import.meta.url), 'utf8'));
const output = process.argv[2];
if (!output) throw new Error('Indica el archivo SQL de salida.');
writeFileSync(output, `begin;
create temporary table ibiza_import_report(name text, action text, added integer, review text);
do $import$
declare
  org uuid := '191c90ad-5337-405e-9d1a-abae2ad8c70e';
  entry jsonb; component jsonb; cid uuid; matches uuid[]; existing integer; target integer; idx integer;
  was_new boolean; warnings text; component_name text; existing_source text;
begin
  if not exists(select 1 from organizations where id=org and name='Performance Lab') then raise exception 'Organización incorrecta'; end if;
  perform pg_advisory_xact_lock(hashtext('ibiza-inventory-september-2026'));
  for entry in select value from jsonb_array_elements($manifest$${JSON.stringify(manifest)}$manifest$::jsonb) loop
    select array_agg(id) into matches from inventory_concepts where organization_id=org and
      (lower(trim(name))=lower(entry->>'name') or lower(trim(name)) in
        (select lower(value) from jsonb_array_elements_text(coalesce(entry->'aliases','[]'::jsonb))));
    if coalesce(array_length(matches,1),0)>1 then raise exception 'Varias coincidencias para %; revisar sin fusionar',entry->>'name'; end if;
    cid:=matches[1]; was_new:=cid is null;
    if cid is not null then
      select inventory_source into existing_source from inventory_concepts where id=cid;
      if existing_source='Inventario manual Manuel · Ibiza 2026-09' then
        insert into ibiza_import_report values(entry->>'name','ya importado',0,null); continue;
      end if;
    end if;
    warnings:=null;
    if entry ? 'review' then warnings:='REVISAR DUPLICADO: ' || (select string_agg(value,', ') from jsonb_array_elements_text(entry->'review')); end if;
    if was_new then
      insert into inventory_concepts(organization_id,name,category,default_location) values(org,entry->>'name',entry->>'category','Ibiza') returning id into cid;
    end if;
    update inventory_concepts set subcategory=entry->>'subcategory',family=entry->>'family',
      unit_kind=coalesce(entry->>'kind','unit'),declared_quantity=(entry->>'quantity')::integer,
      default_location='Ibiza',active=true,owner_name='Performance Lab',inventory_month='2026-09',
      inventory_source='Inventario manual Manuel · Ibiza 2026-09',review_status='Por revisar',
      duplicate_review=concat_ws(E'\\n',nullif(duplicate_review,''),warnings),quantity_confirmation=entry->>'confirmation',updated_at=now()
      where id=cid;
    update inventory_concepts set duplicate_review=concat_ws(E'\\n',nullif(duplicate_review,''),'REVISAR DUPLICADO: ' || (entry->>'name'))
      where organization_id=org and lower(name) in (select lower(value) from jsonb_array_elements_text(coalesce(entry->'review','[]'::jsonb))) and id<>cid;
    select count(*) into existing from inventory_items where concept_id=cid;
    if entry ? 'components' then
      if existing>0 then raise exception 'Star Wars ya tiene piezas: comprobar composición antes de importar'; end if;
      target:=0;
      for component in select value from jsonb_array_elements(entry->'components') loop
        component_name:=component->>0;
        for idx in 1..(component->>1)::integer loop
          target:=target+1;
          insert into inventory_items(organization_id,concept_id,item_code,name,condition,status,location,notes)
            values(org,cid,'IBZ-'||left(cid::text,8)||'-'||lpad(target::text,2,'0'),component_name,'UNCHECKED','AVAILABLE','Ibiza','Componente del set Star Wars. Confirmado por Manuel.');
        end loop;
      end loop;
    else
      target:=(entry->>'quantity')::integer;
      if existing>target then
        update inventory_concepts set quantity_confirmation='Cantidad existente superior al recuento manual. No se han eliminado piezas.' where id=cid;
      end if;
      if target>existing then
        for idx in existing+1..target loop
          insert into inventory_items(organization_id,concept_id,item_code,name,condition,status,location,notes)
            values(org,cid,'IBZ-'||left(cid::text,8)||'-'||lpad(idx::text,2,'0'),entry->>'name','UNCHECKED','AVAILABLE','Ibiza',
              case when entry->>'kind'='set' then 'Set completo. Composición interna pendiente de completar.' else null end);
        end loop;
      end if;
    end if;
    insert into ibiza_import_report values(entry->>'name',case when was_new then 'creado' else 'actualizado' end,greatest(0,target-existing),warnings);
  end loop;
  -- Manuel confirmó que las cuatro piezas previas son adicionales; no se modifican.
end $import$;
commit;
select * from ibiza_import_report order by action,name;
`);
console.log(JSON.stringify({concepts:manifest.length,physicalRecords:manifest.reduce((n,e)=>n+(e.components ? e.components.reduce((s,c)=>s+c[1],0) : e.quantity),0),output}));
