begin;
create table public.financial_documents (
 id uuid primary key, organization_id uuid not null references public.organizations(id),
 filename text not null, storage_path text not null unique, mime_type text not null,
 size_bytes integer not null check(size_bytes between 1 and 20971520), sha256 text not null check(length(sha256)=64),
 source text not null default 'Subida manual', status text not null default 'pending' check(status in ('pending','linked')),
 invoice_id uuid references public.invoices(id), expense_id uuid references public.expenses(id),
 notes text not null default '', created_by uuid not null references public.users(id), created_at timestamptz not null default now(),
 unique(organization_id,sha256), check(num_nonnulls(invoice_id,expense_id)<=1),
 check((status='linked')=(num_nonnulls(invoice_id,expense_id)=1))
);
alter table public.financial_documents enable row level security;
create policy document_read on public.financial_documents for select to authenticated using(public.has_org_role(organization_id,array['admin','producer','sales']));
create policy document_insert on public.financial_documents for insert to authenticated with check(created_by=auth.uid() and public.has_org_role(organization_id,array['admin','producer','sales']));
create policy document_update on public.financial_documents for update to authenticated using(public.has_org_role(organization_id,array['admin','producer','sales'])) with check(public.has_org_role(organization_id,array['admin','producer','sales']));
create trigger document_tenant before insert or update on public.financial_documents for each row execute function public.enforce_tenant_references();
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values ('financial-originals','financial-originals',false,20971520,array['application/pdf','image/jpeg','image/png','image/heic','image/heif']);
create policy financial_original_read on storage.objects for select to authenticated using(bucket_id='financial-originals' and exists(select 1 from public.organization_members m where m.user_id=auth.uid() and m.organization_id::text=(storage.foldername(name))[1] and m.role in ('admin','producer','sales')));
create policy financial_original_insert on storage.objects for insert to authenticated with check(bucket_id='financial-originals' and exists(select 1 from public.organization_members m where m.user_id=auth.uid() and m.organization_id::text=(storage.foldername(name))[1] and m.role in ('admin','producer','sales')));
create policy financial_original_cleanup on storage.objects for delete to authenticated using(bucket_id='financial-originals' and owner_id=auth.uid()::text and not exists(select 1 from public.financial_documents d where d.storage_path=name));
notify pgrst,'reload schema';
commit;
