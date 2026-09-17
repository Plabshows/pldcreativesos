begin;
create function public.import_bank_csv(org uuid,movements jsonb) returns jsonb language plpgsql security invoker set search_path=public as $$
declare m jsonb;created integer:=0;skipped integer:=0;inserted uuid;duplicate boolean;begin
 if not public.has_org_role(org,array['admin','producer']) then raise exception 'No puedes importar pagos';end if;
 if jsonb_typeof(movements)<>'array' or jsonb_array_length(movements)>1000 then raise exception 'Formato de importación incorrecto';end if;
 -- Serialize imports for this organization, including overlapping CSVs.
 perform pg_advisory_xact_lock(hashtextextended(org::text,0));
 for m in select value from jsonb_array_elements(movements) loop
  if exists(select 1 from bank_movements where organization_id=org and (source_key=m->>'source_key' or (fingerprint=m->>'fingerprint' and occurrence=(m->>'occurrence')::integer))) then skipped:=skipped+1;continue;end if;
  select exists(select 1 from bank_movements where organization_id=org and original_reference=m->>'original_reference' and original_reference<>'' and amount_cents=(m->>'amount_cents')::bigint) into duplicate;
  if duplicate then
   update public.bank_movements set status='review',issues=case when 'duplicate'=any(issues) then issues else array_append(issues,'duplicate') end
    where organization_id=org and original_reference=m->>'original_reference' and amount_cents=(m->>'amount_cents')::bigint and resolution_note='';
  end if;
  insert into public.bank_movements(organization_id,source_key,fingerprint,occurrence,source_file,source_hash,source_sheet,source_row,payment_date,amount_cents,currency,original_reference,original_concept,source_data,status,issues,created_by)
   values(org,m->>'source_key',m->>'fingerprint',(m->>'occurrence')::integer,m->>'source_file',m->>'source_hash','CSV',(m->>'source_row')::integer,(m->>'payment_date')::date,(m->>'amount_cents')::bigint,'EUR',m->>'original_reference',m->>'original_concept',m->'source_data',case when duplicate then 'review' else 'unmatched' end,case when duplicate then array['duplicate'] else '{}'::text[] end,auth.uid()) returning id into inserted;
  created:=created+1;
 end loop;
 return jsonb_build_object('imported',created,'skipped',skipped);
end $$;
revoke all on function public.import_bank_csv(uuid,jsonb) from public,anon;
grant execute on function public.import_bank_csv(uuid,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
