import {it,expect} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
it('links imported receipts to the existing invoice ledger and rejects wrong sources, repeated receipts and overpayment',async()=>{
 const db=new PGlite();try{
 const org='11111111-1111-4111-8111-111111111111',user='22222222-2222-4222-8222-222222222222',client='33333333-3333-4333-8333-333333333333';
 await db.exec(`create role authenticated;create schema auth;create function auth.uid() returns uuid language sql as 'select ''${user}''::uuid';
 create table organizations(id uuid primary key);create table users(id uuid primary key);create table clients(id uuid primary key,organization_id uuid);
 create table events(id uuid primary key,organization_id uuid,client_id uuid);create table proposals(id uuid primary key,organization_id uuid,client_id uuid);
 create function has_org_role(uuid,text[]) returns boolean language sql as 'select true';create function enforce_tenant_references() returns trigger language plpgsql as 'begin return new;end';
 insert into organizations values('${org}');insert into users values('${user}');insert into clients values('${client}','${org}');`);
 await db.exec(readFileSync('supabase/migrations/202609140013_invoices.sql','utf8'));
 await db.exec(readFileSync('supabase/migrations/202609140023_invoice_collection_sources.sql','utf8'));
 const invoice=async(number:string)=>(await db.query<{id:string}>("insert into invoices(organization_id,client_id,number,issue_date,due_date,total_cents,currency,status,created_by) values($1,$2,$3,'2026-07-01','2026-08-01',2000,'EUR','pending',$4) returning id",[org,client,number,user])).rows[0].id;
 const first=await invoice('001'),second=await invoice('002');
 const source=(await db.query<{id:string}>("insert into invoice_import_rows(organization_id,source_key,source_file,source_hash,source_sheet,source_row,source_data,invoice_id,status,created_by) values($1,'row1','file.xlsx','hash','Seguimiento',3,'{}',$2,'linked',$3) returning id",[org,first,user])).rows[0].id;
 const pay=(id:string,key:string,amount:number)=>db.query("insert into invoice_payments(organization_id,invoice_id,payment_date,amount_cents,currency,created_by,source_import_id,source_key) values($1,$2,'2026-07-02',$3,'EUR',$4,$5,$6)",[org,id,amount,user,source,key]);
 await expect(pay(second,'wrong',100)).rejects.toThrow(/origen/);
 await pay(first,'receipt1',1000);await expect(pay(first,'receipt1',1000)).rejects.toThrow(/unique/);
 expect((await db.query('select * from invoice_payments')).rows).toHaveLength(1);
 await expect(pay(first,'too-much',1001)).rejects.toThrow(/saldo/);
 await pay(first,'receipt2',1000);
 expect((await db.query<{total:number}>('select sum(amount_cents)::int as total from invoice_payments where invoice_id=$1',[first])).rows[0].total).toBe(2000);
 await expect(db.exec(`set role authenticated;insert into invoice_import_rows(organization_id,source_key,source_file,source_hash,source_sheet,source_row,source_data,status,created_by) values('${org}','fake','x','h','s',1,'{}','review','${user}')`)).rejects.toThrow(/permission/);
 }finally{await db.close()}
});
