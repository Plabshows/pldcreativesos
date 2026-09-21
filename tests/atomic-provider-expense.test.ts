import {it,expect} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';

it('creates supplier, provider expense and event total atomically, and locks paid expenses',async()=>{
 const db=new PGlite();
 const org='11111111-1111-4111-8111-111111111111',event='22222222-2222-4222-8222-222222222222',user='33333333-3333-4333-8333-333333333333';
 try{
  await db.exec(`create role authenticated;create role anon;create schema auth;create function auth.uid() returns uuid language sql as 'select ''${user}''::uuid';create function has_org_role(uuid,text[]) returns boolean language sql as 'select true';
   create table events(id uuid primary key,organization_id uuid,deleted_at timestamptz,event_date date,expenses_cents bigint check(expenses_cents<500),updated_at timestamptz);
   create table event_talent(organization_id uuid,event_id uuid,talent_id uuid,agreed_cost_cents bigint);
   create table suppliers(id uuid primary key default gen_random_uuid(),organization_id uuid,name text,normalized_name text,deleted_at timestamptz,merged_into uuid);
   create table expense_categories(id uuid primary key default gen_random_uuid(),organization_id uuid,name text);
   create table expenses(id uuid primary key default gen_random_uuid(),organization_id uuid,event_id uuid,talent_id uuid,supplier_id uuid,supplier_name text,category_id uuid,expense_date date,concept text,total_cents bigint,estimated_cents bigint,currency text,status text,created_by uuid);
   create table expense_payments(id uuid primary key default gen_random_uuid(),organization_id uuid,expense_id uuid,amount_cents bigint);
   insert into events values('${event}','${org}',null,'2026-09-20',100,now());
   insert into expense_categories(organization_id,name) values('${org}','Otros');`);
  const migration=readFileSync('supabase/migrations/202609210003_provider_total_includes_artists.sql','utf8')
   .replace('create extension if not exists unaccent;','')
   .replaceAll('unaccent(provider_name)','provider_name');
  await db.exec(migration);
  const run=(id:string|null,amount:number|null,remove=false)=>db.query('select set_event_provider_expense($1,$2,$3,$4,$5,$6,$7)',[org,event,id,null,'Técnico',amount,remove]);
  await expect(run(null,600)).rejects.toThrow();
  expect((await db.query('select * from suppliers')).rows).toHaveLength(0);
  expect((await db.query('select * from expenses')).rows).toHaveLength(0);
  await run(null,200);
  const expense=(await db.query<{id:string}>('select id from expenses')).rows[0].id;
  expect((await db.query<{expenses_cents:number}>('select expenses_cents from events')).rows[0].expenses_cents).toBe(200);
  await db.query('insert into event_talent values($1,$2,$3,100)',[org,event,user]);
  await run(expense,250);
  expect((await db.query<{expenses_cents:number}>('select expenses_cents from events')).rows[0].expenses_cents).toBe(350);
  await run(expense,250,true);
  expect((await db.query<{expenses_cents:number}>('select expenses_cents from events')).rows[0].expenses_cents).toBe(100);
  await db.query("update expenses set status='pending' where id=$1",[expense]);
  await db.query('update event_talent set agreed_cost_cents=null');
  await run(expense,200);
  expect((await db.query<{expenses_cents:number|null}>('select expenses_cents from events')).rows[0].expenses_cents).toBeNull();
  await db.query('insert into expense_payments(organization_id,expense_id,amount_cents) values($1,$2,$3)',[org,expense,100]);
  await expect(run(expense,300)).rejects.toThrow('ya tiene pagos');
  await expect(run(expense,200,true)).rejects.toThrow('ya tiene pagos');
 }finally{await db.close();}
},15000);
