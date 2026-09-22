import {expect,it} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {canReadSection,cleanDocument,clientSheet,emptyDocument,packingForEvent} from '../lib/show-kit';
it('isolates audiences and calculates quantities without exposing internal fields',()=>{
 expect(canReadSection('sales','artist')).toBe(false);expect(canReadSection('wardrobe','sales')).toBe(false);expect(canReadSection('artist','sales')).toBe(false);
 const doc={...emptyDocument(),fields:{pricing:'SECRET',duration:'15 min'}};
 expect(JSON.stringify(clientSheet(doc))).not.toContain('SECRET');expect(cleanDocument('tech',doc).fields).toEqual({duration:'15 min'});
 const item={id:'x',name:'Battery',quantity:2,image:'',size:'',location:'A3',box:'04',notes:'',required:true,condition:'',asset_id:'',concept_id:''};
 expect(packingForEvent([{show_id:'s',quantity:3}],[{show_id:'s',document:{...emptyDocument(),items:[item]}}])[0].quantity).toBe(6);
});
it('enforces section RLS, organization boundaries, versions and expiring/revocable shares',async()=>{
 const db=new PGlite();const org='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',show='33333333-3333-4333-8333-333333333333';
 try{
 await db.exec(`create role authenticated;create role anon;create table organizations(id uuid primary key);create table shows(id uuid primary key,organization_id uuid,name text,category text,description text,public_url text,active boolean);create table events(id uuid primary key,organization_id uuid);create function has_org_role(o uuid, roles text[]) returns boolean language sql as $$select o::text=current_setting('test.org',true) and current_setting('test.role',true)=any(roles)$$;insert into organizations values('${org}'),('${other}');insert into shows values('${show}','${org}','TV HEAD',null,null,null,true);grant select on shows,events to authenticated;`);
 await db.exec(readFileSync('supabase/migrations/202609220004_show_kits.sql','utf8'));
 await db.exec(`set role authenticated;set test.org='${org}';set test.role='admin';insert into show_kit_sections(show_id,organization_id,section,document) values('${show}','${org}','artist','{"fields":{"safety":"Careful"}}'),('${show}','${org}','sales','{"fields":{"pricing":"secret"}}');`);
 await expect(db.exec(`insert into show_kit_sections(show_id,organization_id,section) values('${show}','${other}','tech')`)).rejects.toThrow();
 await db.exec("set test.role='sales'");expect((await db.query('select section from show_kit_sections')).rows).toEqual([{section:'sales'}]);
 await expect(db.exec(`update show_kit_sections set section='artist' where section='sales'`)).rejects.toThrow();
 await db.exec(`update show_kit_sections set document='{}' where section='sales' and version=1`);expect((await db.query<{version:number}>("select version from show_kit_sections")).rows[0].version).toBe(2);
 await db.exec("set test.role='wardrobe'");expect((await db.query('select * from show_kit_sections')).rows).toHaveLength(0);
 await db.exec(`insert into show_kit_sections(show_id,organization_id,section) values('${show}','${org}','warehouse')`);
 await db.exec("set test.role='admin'");
 const share=(await db.query<{id:string;token:string}>(`insert into show_kit_shares(organization_id,show_id,audience,document) values('${org}','${show}','artist','{"name":"TV HEAD","sections":[]}') returning id,token`)).rows[0];
 await db.exec('set role anon');await expect(db.query('select * from show_kit_shares')).rejects.toThrow();
 expect((await db.query<{doc:unknown}>(`select read_show_kit_share('${share.token}') doc`)).rows[0].doc).toEqual({name:'TV HEAD',sections:[]});
 await db.exec(`set role authenticated;update show_kit_shares set revoked_at=now() where id='${share.id}';set role anon`);expect((await db.query<{doc:unknown}>(`select read_show_kit_share('${share.token}') doc`)).rows[0].doc).toBeNull();
 await db.exec(`set role authenticated;update show_kit_shares set revoked_at=null,expires_at=now()-interval '1 day' where id='${share.id}';set role anon`);expect((await db.query<{doc:unknown}>(`select read_show_kit_share('${share.token}') doc`)).rows[0].doc).toBeNull();
 await db.exec(`set role authenticated;set test.org='${other}'`);expect((await db.query('select * from show_kit_sections')).rows).toHaveLength(0);
 }finally{await db.close();}
},20000);
