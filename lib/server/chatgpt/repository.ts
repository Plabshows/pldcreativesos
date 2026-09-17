import type {SupabaseClient} from '@supabase/supabase-js';
import type {ContextRow} from '@/lib/chatgpt/contracts';
export type ContextTable='clients'|'leads'|'opportunities'|'proposals'|'events'|'event_shows'|'event_talent'|'shows'|'talent'|'payments'|'crm_activities'|'tasks';
const soft=new Set<ContextTable>(['clients','leads','opportunities','proposals','events','talent','tasks']);
export interface ContextRepository {find(table:ContextTable,key:string,ids:string[]):Promise<ContextRow[]>;}
export function contextRepository(db:SupabaseClient,organizationId:string):ContextRepository{
 return {async find(table,key,ids){
  const unique=[...new Set(ids.filter(Boolean))];if(!unique.length)return [];
  const result:ContextRow[]=[];
  for(let i=0;i<unique.length;i+=100){
   for(let offset=0;;offset+=500){
    let q=db.from(table).select('*').eq('organization_id',organizationId).in(key,unique.slice(i,i+100));
    if(soft.has(table))q=q.is('deleted_at',null);
    q=table==='event_talent'?q.order('event_id').order('talent_id'):table==='event_shows'?q.order('event_id').order('show_id'):q.order('id');
    const r=await q.range(offset,offset+499);if(r.error)throw new Error('No se pudieron leer las relaciones del registro.');result.push(...r.data);if(r.data.length<500)break;
   }
  }return result;
 }};
}
