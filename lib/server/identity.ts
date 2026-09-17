import type {SupabaseClient} from '@supabase/supabase-js';
import {invoiceRows} from './invoices';
import {resolveIdentity,type Identity} from '@/lib/identity';
export async function artistBeforeCreate(db:SupabaseClient,org:string,name:string){
 const people=await invoiceRows(db,org,'talent');
 return resolveIdentity(people as unknown as Identity[],name);
}
