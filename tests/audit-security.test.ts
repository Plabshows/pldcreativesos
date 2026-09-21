import {it, expect} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';

it('blocks anonymous finance access and enforces org references under real SQL roles', async () => {
  const db = new PGlite();
  const org = '11111111-1111-4111-8111-111111111111';
  const other = '22222222-2222-4222-8222-222222222222';
  const user = '33333333-3333-4333-8333-333333333333';
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create table organizations(id uuid primary key); create table users(id uuid primary key);
      create table organization_members(organization_id uuid,user_id uuid,role text);
      create function has_org_role(uuid,text[]) returns boolean language sql security definer as $$
        select exists(select 1 from organization_members where organization_id=$1 and user_id=auth.uid() and role=any($2))$$;
      create table events(id uuid primary key,organization_id uuid references organizations(id));
      create table clients(id uuid primary key,organization_id uuid references organizations(id));
      create table invoices(id uuid primary key,organization_id uuid references organizations(id));
      insert into organizations values('${org}'),('${other}');
      insert into users values('${user}');
      insert into organization_members values('${org}','${user}','admin');
      insert into events values('${org}','${org}'),('${other}','${other}');
      insert into invoices values('${org}','${org}'),('${other}','${other}');`);
    await db.exec(readFileSync('supabase/migrations/202609170001_economic_audit_schema.sql','utf8'));
    await db.exec(readFileSync('supabase/migrations/202609210001_inventory_system.sql','utf8').replace('create extension if not exists unaccent;',''));
    const guard = readFileSync('supabase/migrations/202609110002_secure_crm.sql','utf8')
      .match(/create or replace function public\.enforce_tenant_references\(\)[\s\S]*?end; \$\$;/)![0];
    await db.exec(guard);
    await db.exec(`grant usage on schema public,auth to authenticated,anon;
      grant all on all tables in schema public to authenticated,anon;
      insert into financial_audit_log(organization_id,entity_type,entity_id,field_name,reason)
      values('${org}','events','${org}','income','verified'),('${other}','events','${other}','income','verified');`);
    await db.exec(readFileSync('supabase/migrations/202609210002_financial_inventory_guards.sql','utf8'));
    await db.exec(`alter table events enable row level security; alter table clients enable row level security;
      create policy events_all on events for all using(has_org_role(organization_id,array['admin','producer','sales','wardrobe']));
      create policy clients_all on clients for all using(has_org_role(organization_id,array['admin','producer','sales','wardrobe']));`);
    await db.exec(readFileSync('supabase/migrations/202609210004_core_write_role_guards.sql','utf8'));
    await db.exec('set role anon');
    await expect(db.query('select * from financial_audit_log')).rejects.toThrow(/permission denied/);
    await expect(db.query('select * from invoice_event_allocations')).rejects.toThrow(/permission denied/);
    await db.exec(`reset role; select set_config('request.jwt.claim.sub','${user}',false); set role authenticated;`);
    expect((await db.query('select * from financial_audit_log')).rows).toHaveLength(1);
    // Admin can edit but cannot physically delete an event via direct REST/SQL.
    expect((await db.query('update events set organization_id=$1 where id=$1 returning id',[org])).rows).toHaveLength(1);
    expect((await db.query('delete from events where id=$1 returning id',[org])).rows).toHaveLength(0);
    await expect(db.query(`update financial_audit_log set reason='changed'`)).rejects.toThrow(/permission denied/);
    await db.query('insert into invoice_event_allocations(organization_id,invoice_id,event_id) values($1,$1,$1)',[org]);
    await expect(db.query('insert into invoice_event_allocations(organization_id,invoice_id,event_id) values($1,$2,$1)',[org,other])).rejects.toThrow(/organización/);
    const ownConcept = (await db.query<{id:string}>('select id from inventory_concepts where organization_id=$1 limit 1',[org])).rows[0].id;
    await db.exec('reset role');
    const otherConcept = (await db.query<{id:string}>('select id from inventory_concepts where organization_id=$1 limit 1',[other])).rows[0].id;
    await db.exec('set role authenticated');
    await expect(db.query('insert into inventory_items(organization_id,concept_id,item_code) values($1,$2,$3)',[org,otherConcept,'BAD'])).rejects.toThrow(/organización/);
    const item = (await db.query<{id:string}>('insert into inventory_items(organization_id,concept_id,item_code) values($1,$2,$3) returning id',[org,ownConcept,'GOOD'])).rows[0].id;
    await expect(db.query('insert into inventory_event_allocations(organization_id,event_id,concept_id,inventory_item_id,quantity) values($1,$1,$2,$3,2)',[org,ownConcept,item])).rejects.toThrow(/cantidad 1/);
    await db.query('insert into inventory_event_allocations(organization_id,event_id,concept_id,inventory_item_id,quantity) values($1,$1,$2,$3,1)',[org,ownConcept,item]);
    // Even someone who belongs to both orgs must not move a business row across them.
    await db.exec(`reset role; insert into organization_members values('${other}','${user}','admin'); set role authenticated;`);
    await expect(db.query('update inventory_items set organization_id=$1 where id=$2',[other,item])).rejects.toThrow(/cambiar la organización/);
    await db.exec('reset role');
    expect((await db.query('select * from financial_audit_log')).rows).toHaveLength(2);
    await db.exec(`update organization_members set role='wardrobe' where organization_id='${org}'; set role authenticated;`);
    expect((await db.query('update events set organization_id=$1 where id=$1 returning id',[org])).rows).toHaveLength(0);
    await expect(db.query('insert into clients(id,organization_id) values($1,$1)',[org])).rejects.toThrow(/row-level security/);
    await db.exec(`reset role; update organization_members set role='sales' where organization_id='${org}'; set role authenticated;`);
    await db.query('insert into clients(id,organization_id) values($1,$1)',[org]);
    expect((await db.query('delete from clients where id=$1 returning id',[org])).rows).toHaveLength(0);
    expect((await db.query('update events set organization_id=$1 where id=$1 returning id',[org])).rows).toHaveLength(0);
  } finally { await db.close(); }
},15000);
