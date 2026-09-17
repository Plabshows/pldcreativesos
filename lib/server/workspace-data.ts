import type {SupabaseClient} from '@supabase/supabase-js';
export async function rows(db:SupabaseClient,org:string,table:string,columns='*',soft=false){
 const result:Record<string,unknown>[]=[];
 for(let offset=0;;offset+=500){let q=db.from(table).select(columns).eq('organization_id',org).order('id').range(offset,offset+499);if(soft)q=q.is('deleted_at',null);const r=await q;if(r.error)throw r.error;result.push(...r.data as unknown as Record<string,unknown>[]);if(r.data.length<500)return result;}
}
export async function workspaceReferences(db:SupabaseClient,org:string){
 const [clients,events,talent,shows,leads,opportunities,members]=await Promise.all([
  rows(db,org,'clients','id,company_name',true),rows(db,org,'events','id,event_name',true),rows(db,org,'talent','id,real_name',true),rows(db,org,'shows','id,name,category,description,active'),rows(db,org,'leads','id,title',true),rows(db,org,'opportunities','id,title,client_id,event_date,city,venue',true),db.from('organization_members').select('user_id,users(full_name,email)').eq('organization_id',org)
 ]);
 if(members.error)throw members.error;
 return {clients,events,talent,shows:shows.filter(s=>s.active),leads,opportunities,members:members.data.map(m=>{const u=m.users as unknown as {full_name:string;email:string};return{id:m.user_id,name:u?.full_name||u?.email||'Miembro'};})};
}
export type WorkspaceReferences={clients:{id:string;company_name:string}[];events:{id:string;event_name:string}[];talent:{id:string;real_name:string}[];shows:{id:string;name:string;category:string|null;description:string|null}[];leads:{id:string;title:string}[];opportunities:{id:string;title:string;client_id:string|null;event_date:string|null;city:string|null;venue:string|null}[];members:{id:string;name:string}[]};
