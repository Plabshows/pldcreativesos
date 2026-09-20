import {it,expect} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
it('rolls back all budget writes when the final event update fails and preserves paid evidence',async()=>{
 const db=new PGlite();const org='11111111-1111-4111-8111-111111111111',event='22222222-2222-4222-8222-222222222222',talent='33333333-3333-4333-8333-333333333333';
 try{
 await db.exec(`create role authenticated;create schema auth;create function auth.uid() returns uuid language sql as 'select ''${talent}''::uuid';create function has_org_role(uuid,text[]) returns boolean language sql as 'select true';
 create table events(id uuid primary key,organization_id uuid,deleted_at timestamptz,expenses_cents bigint check(expenses_cents<500),updated_at timestamptz);
 create table event_talent(organization_id uuid,event_id uuid,talent_id uuid,agreed_cost_cents bigint);
 create table payments(id uuid default gen_random_uuid(),organization_id uuid,event_id uuid,talent_id uuid,kind text,direction text,amount_cents bigint,status text);
 create table expenses(organization_id uuid,event_id uuid,talent_id uuid,status text,total_cents bigint);
 insert into events values('${event}','${org}',null,100,now());insert into event_talent values('${org}','${event}','${talent}',100);`);
 await db.exec(readFileSync('supabase/migrations/202609200001_atomic_artist_fee.sql','utf8'));
 const run=(fee:number|null)=>db.query('select set_artist_budget($1,$2,$3,$4)',[org,event,talent,fee]);
 await expect(run(600)).rejects.toThrow();
 expect((await db.query<{agreed_cost_cents:number}>('select agreed_cost_cents from event_talent')).rows[0].agreed_cost_cents).toBe(100);
 expect((await db.query('select * from payments')).rows).toHaveLength(0);
 await run(200);await run(250);
 expect((await db.query('select * from payments')).rows).toHaveLength(1);
 await db.exec("update payments set status='paid'");
 await expect(run(300)).rejects.toThrow('historial financiero');
 expect((await db.query<{amount_cents:number}>('select amount_cents from payments')).rows[0].amount_cents).toBe(250);
 await expect(run(null)).rejects.toThrow('importe válido');
 await db.exec('create or replace function has_org_role(uuid,text[]) returns boolean language sql as $$select false$$');
 await expect(run(100)).rejects.toThrow('permiso');
 }finally{await db.close();}
},15000);
