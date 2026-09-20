import {describe,it,expect,vi} from 'vitest';
import type {SupabaseClient} from '@supabase/supabase-js';
import {syncEventExpensesTotal} from '../lib/server/event-costs';

function database(readError:unknown=null, fee:number|null=10000){
  const update=vi.fn();
  const from=(table:string)=>{
    const q={select:()=>q,eq:()=>q,is:()=>q,neq:()=>q,update:(value:unknown)=>{update(value);return q;},then:(resolve:(r:unknown)=>unknown)=>Promise.resolve(table==='events'?{error:null}:table==='event_talent'?{data:[{agreed_cost_cents:fee}],error:null}:{data:readError?null:[{total_cents:2500}],error:readError}).then(resolve)};return q;
  };return {db:{from} as unknown as SupabaseClient,update};
}
describe('Event costs preserve financial uncertainty',()=>{
  it('does not overwrite the event if a source read fails',async()=>{const {db,update}=database(Error('unavailable'));await expect(syncEventExpensesTotal(db,'org','event')).rejects.toThrow('unavailable');expect(update).not.toHaveBeenCalled();});
  it('keeps an unknown fee unknown instead of assigning zero',async()=>{const {db,update}=database(null,null);await syncEventExpensesTotal(db,'org','event');expect(update).toHaveBeenCalledWith(expect.objectContaining({expenses_cents:null}));});
  it('adds known costs in cents',async()=>{const {db,update}=database();await syncEventExpensesTotal(db,'org','event');expect(update).toHaveBeenCalledWith(expect.objectContaining({expenses_cents:12500}));});
});
