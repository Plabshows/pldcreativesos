import type {SupabaseClient} from '@supabase/supabase-js';

// Never turn a failed read into a zero cost and overwrite the existing total.
export async function syncEventExpensesTotal(db:SupabaseClient, org:string, eventId:string){
  const [talent,expenses]=await Promise.all([
    db.from('event_talent').select('agreed_cost_cents').eq('organization_id',org).eq('event_id',eventId),
    db.from('expenses').select('total_cents').eq('organization_id',org).eq('event_id',eventId).is('talent_id',null).neq('status','cancelled'),
  ]);
  if(talent.error)throw talent.error;
  if(expenses.error)throw expenses.error;
  if(!talent.data||!expenses.data)throw Error('No se pudieron verificar los costes.');
  const values=[...talent.data.map(row=>row.agreed_cost_cents),...expenses.data.map(row=>row.total_cents)];
  const total=values.some(value=>value===null)?null:values.reduce((sum,value)=>sum+Number(value),0);
  const result=await db.from('events').update({expenses_cents:total,updated_at:new Date().toISOString()}).eq('organization_id',org).eq('id',eventId);
  if(result.error)throw result.error;
}
