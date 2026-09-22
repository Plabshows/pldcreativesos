import {it, expect} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

it('imports Ibiza idempotently without losing stock; reserves, returns and protects incident pieces', async () => {
  const db = new PGlite();
  const org='191c90ad-5337-405e-9d1a-abae2ad8c70e';
  const event='22222222-2222-4222-8222-222222222222';
  try {
    await db.exec(`create role anon; create role authenticated;
      create function has_org_role(uuid,text[]) returns boolean language sql as 'select true';
      create table organizations(id uuid primary key,name text);
      insert into organizations values('${org}','Performance Lab');
      create table events(id uuid primary key,organization_id uuid,event_name text,event_date date,deleted_at timestamptz,status text);
      insert into events values('${event}','${org}','Test',current_date,null,'confirmed');`);
    await db.exec(readFileSync('supabase/migrations/202609210001_inventory_system.sql','utf8').replace('create extension if not exists unaccent;',''));
    await db.exec(readFileSync('supabase/migrations/202609220001_inventory_ibiza.sql','utf8'));
    const file=join(tmpdir(),'plab-ibiza-test.sql');
    execFileSync(process.execPath,['tools/prepare-ibiza-import.mjs',file]);
    const sql=readFileSync(file,'utf8');
    await db.exec(sql);
    expect((await db.query<{n:number}>('select count(*)::int n from inventory_items')).rows[0].n).toBe(156);
    await db.exec('drop table ibiza_import_report');
    await db.exec(sql);
    expect((await db.query<{n:number}>('select count(*)::int n from inventory_items')).rows[0].n).toBe(156);
    const star=(await db.query<{id:string;total_units:number}>("select id,total_units from inventory_concepts where name='Star Wars'")).rows[0];
    expect(star.total_units).toBe(9);
    expect((await db.query<{n:number}>("select count(*)::int n from inventory_items where condition<>'UNCHECKED' or production_cost is not null")).rows[0].n).toBe(0);
    const payload={concept_id:star.id,event_id:event,quantity:2};
    const result=await db.query<{data:{id:string;inventory_item_id:string}[]}>('select save_inventory_allocation($1,$2::jsonb) data',[org,JSON.stringify(payload)]);
    const allocations=result.rows[0].data;
    expect(allocations).toHaveLength(2);
    expect((await db.query<{n:number}>("select count(*)::int n from inventory_items where status='RESERVED'")).rows[0].n).toBe(2);
    await expect(db.query('select save_inventory_allocation($1,$2::jsonb)',[org,JSON.stringify({...payload,quantity:8})])).rejects.toThrow('suficientes');
    await db.query('insert into inventory_repairs(organization_id,inventory_item_id,problem,incident_type) values($1,$2,$3,$4)',[org,allocations[0].inventory_item_id,'Limpieza','cleaning']);
    await db.query("update events set status='completed' where id=$1",[event]);
    expect((await db.query<{status:string}>('select status from inventory_items where id=$1',[allocations[0].inventory_item_id])).rows[0].status).toBe('CLEANING');
    expect((await db.query<{status:string}>('select status from inventory_items where id=$1',[allocations[1].inventory_item_id])).rows[0].status).toBe('AVAILABLE');
    expect((await db.query<{n:number}>("select count(*)::int n from inventory_event_allocations where status='RETURNED'")).rows[0].n).toBe(2);
    await expect(db.query('select save_inventory_allocation($1,$2::jsonb)',[org,JSON.stringify(payload)])).rejects.toThrow('activo');
  } finally { await db.close(); }
},30000);
