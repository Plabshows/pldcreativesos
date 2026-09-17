import {it,expect} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
it.each(['legacy','repaired'])('applies CRM to %s schema with atomic history and no duplicate deals',async(schema)=>{
 const db=new PGlite();
 try{
 await db.exec(`create role authenticated; create schema auth; create function auth.uid() returns uuid language sql as 'select null::uuid';
 create table organizations(id uuid primary key);create table users(id uuid primary key);create table clients(id uuid primary key);create table events(id uuid primary key);
 ${schema==='legacy'?`create table client_contacts(id uuid primary key,organization_id uuid references organizations(id));
 create table leads(id uuid primary key default gen_random_uuid(),organization_id uuid references organizations(id),title text not null,stage text default 'new_lead',next_action_at timestamptz,owner_id uuid,last_activity_at timestamptz,updated_at timestamptz);`:''}
 create function has_org_role(uuid,text[]) returns boolean language sql as 'select true';
 create function enforce_tenant_references() returns trigger language plpgsql as 'begin return new; end';
 create function set_updated_at() returns trigger language plpgsql as 'begin new.updated_at=now(); return new; end';`);
 await db.exec(readFileSync('supabase/migrations/202609130008_crm_essentials.sql','utf8'));
 const org='11111111-1111-4111-8111-111111111111';
 await db.query('insert into organizations values($1)',[org]);
 const result=await db.query<{id:string}>("insert into leads(organization_id,title) values($1,'Test') returning id",[org]);const lead=result.rows[0].id;
 await db.query("insert into opportunities(organization_id,lead_id,title) values($1,$2,'Test')",[org,lead]);
 await expect(db.query("insert into opportunities(organization_id,lead_id,title) values($1,$2,'Duplicate')",[org,lead])).rejects.toThrow();
 await db.query("update opportunities set stage='won'");
 expect((await db.query('select * from crm_activities')).rows).toHaveLength(3);
 expect((await db.query('select * from opportunities where last_activity_at is not null')).rows).toHaveLength(1);
 expect((await db.query('select * from events')).rows).toHaveLength(0);
 }finally{await db.close();}
},15000);
