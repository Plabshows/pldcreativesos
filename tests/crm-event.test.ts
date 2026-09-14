import {describe,it,expect,vi} from 'vitest';
import type {SupabaseClient} from '@supabase/supabase-js';
vi.mock('@/lib/crm',async()=>import('../lib/crm'));
import {createCrmEvent} from '../lib/server/crm-event';
import {blankCrm} from '../lib/crm';

const id='11111111-1111-4111-8111-111111111111';
const opportunity={...blankCrm(),id,stage:'won',client_id:'22222222-2222-4222-8222-222222222222',event_date:'2026-10-01',title:'Trabajo real',estimated_value_cents:90000};
function database({failLink=false,missingClient=false}:{failLink?:boolean;missingClient?:boolean}={}){
  let event:Record<string,unknown>|null=null, linked:string|null=null, inserts=0;
  const db={from(table:string){
    let action='read',values:Record<string,unknown>={};
    const query={select:()=>query,eq:()=>query,is:()=>query,
      insert:(v:Record<string,unknown>)=>{action='insert';values=v;return query;},
      update:(v:Record<string,unknown>)=>{action='update';values=v;return query;},
      maybeSingle:()=>query,
      then(resolve:(value:unknown)=>unknown){
        if(table==='clients')return Promise.resolve(resolve({data:missingClient?null:{id:opportunity.client_id},error:null}));
        if(table==='events'&&action==='insert'){
          if(event)return Promise.resolve(resolve({data:null,error:{code:'23505'}}));
          event={...values,deleted_at:null};inserts++;return Promise.resolve(resolve({data:null,error:null}));
        }
        if(table==='events')return Promise.resolve(resolve({data:event,error:null}));
        if(action==='update'){
          if(failLink){failLink=false;return Promise.resolve(resolve({data:null,error:{code:'network'}}));}
          linked=String(values.event_id);return Promise.resolve(resolve({data:[{event_id:linked}],error:null}));
        }
        return Promise.resolve(resolve({data:{event_id:linked},error:null}));
      }
    };return query;
  }} as unknown as SupabaseClient;
  return {db,get event(){return event;},get inserts(){return inserts;}};
}
describe('CRM → existing Events',()=>{
  it('copies the agreed fields and never invents artists or costs',async()=>{
    const state=database();expect(await createCrmEvent(state.db,'org',opportunity,'owner')).toBe(id);
    expect(state.event).toMatchObject({event_name:'Trabajo real',client_id:opportunity.client_id,event_date:'2026-10-01',income_cents:90000,status:'production'});
    expect(state.event).not.toHaveProperty('expenses_cents');
  });
  it('recovers an interrupted link without duplicating or overwriting the event',async()=>{
    const state=database({failLink:true});await expect(createCrmEvent(state.db,'org',opportunity,'owner')).rejects.toThrow('sin duplicarlo');
    expect(await createCrmEvent(state.db,'org',{...opportunity,title:'Edited after failure'},'owner')).toBe(id);
    expect(state.inserts).toBe(1);expect(state.event?.event_name).toBe('Trabajo real');
  });
  it('rejects open deals, missing dates, and unavailable clients before writing',async()=>{
    const state=database();
    await expect(createCrmEvent(state.db,'org',{...opportunity,stage:'negotiation'},'owner')).rejects.toThrow('Ganado');
    await expect(createCrmEvent(state.db,'org',{...opportunity,event_date:''},'owner')).rejects.toThrow('fecha');
    const missing=database({missingClient:true});await expect(createCrmEvent(missing.db,'org',opportunity,'owner')).rejects.toThrow('cliente');
    expect(state.inserts+missing.inserts).toBe(0);
  });
  it('returns an already linked event without creating anything',async()=>{
    const state=database();expect(await createCrmEvent(state.db,'org',{...opportunity,event_id:'existing'},'owner')).toBe('existing');expect(state.inserts).toBe(0);
  });
});
