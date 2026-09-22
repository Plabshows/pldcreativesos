import {requireOrganization} from '@/lib/server/auth';
import {packingForEvent} from '@/lib/show-kit';
import {z} from 'zod';
export async function GET(req:Request){
 const a=await requireOrganization();if('error'in a)return a.error;if(!['admin','producer','wardrobe'].includes(a.membership.role))return Response.json({error:'Sin permiso.'},{status:403});
 const id=new URL(req.url).searchParams.get('event'),org=a.membership.organization_id;
 const ev=await a.supabase.from('events').select('id,event_name,event_date,venue').eq('id',id).eq('organization_id',org).is('deleted_at',null).maybeSingle();if(!ev.data)return Response.json({error:'Evento no disponible.'},{status:404});
 const links=await a.supabase.from('event_shows').select('show_id,quantity').eq('event_id',id).eq('organization_id',org);
 if(links.error)return Response.json({error:'No se pudieron leer los shows.'},{status:503});
 const kits=await a.supabase.from('show_kit_sections').select('show_id,document').eq('section','warehouse').eq('organization_id',org).in('show_id',(links.data||[]).map(l=>l.show_id));
 const checks=await a.supabase.from('event_kit_checklists').select('checked,version').eq('organization_id',org).eq('event_id',id).maybeSingle();
 const catalogue=await a.supabase.rpc('show_kit_catalogue');
 if(kits.error||checks.error||catalogue.error)return Response.json({error:'No se pudo cargar la preparación.'},{status:503});
 const assignments=await a.supabase.from('event_talent').select('talent_id').eq('event_id',id).eq('organization_id',org).neq('status','cancelled');
 const talents=await a.supabase.from('talent').select('id,real_name').eq('organization_id',org).in('id',(assignments.data||[]).map(t=>t.talent_id));
 return Response.json({canShare:['admin','producer'].includes(a.membership.role),talents:talents.data||[],event:ev.data,links:links.data,shows:catalogue.data.filter((s:{organization_id:string})=>s.organization_id===org),items:packingForEvent(links.data||[],kits.data||[]),checks:kits.data?.flatMap(k=>(k.document.fields.checks||'').split('\n').filter(Boolean).map((label:string)=>({show_id:k.show_id,label}))),missing:links.data?.filter(l=>!kits.data?.some(k=>k.show_id===l.show_id&&k.document.items.length)),checked:checks.data?.checked||{},version:checks.data?.version||null},{headers:{'Cache-Control':'no-store'}});
}
export async function POST(req:Request){
 const a=await requireOrganization();if('error'in a)return a.error;if(!['admin','producer','wardrobe'].includes(a.membership.role))return Response.json({error:'Sin permiso.'},{status:403});
 const p=z.object({event_id:z.uuid(),version:z.number().int().positive().nullable(),checked:z.record(z.string().max(500),z.boolean())}).safeParse(await req.json().catch(()=>null));if(!p.success)return Response.json({error:'Checklist no válida.'},{status:400});
 const b=p.data,org=a.membership.organization_id;const r=b.version?await a.supabase.from('event_kit_checklists').update({checked:b.checked,version:b.version+1,updated_at:new Date().toISOString()}).eq('organization_id',org).eq('event_id',b.event_id).eq('version',b.version).select('version'):await a.supabase.from('event_kit_checklists').insert({organization_id:org,event_id:b.event_id,checked:b.checked}).select('version');
 return r.error||!r.data?.length?Response.json({error:'No se guardó. Recarga la lista por posibles cambios de otro miembro.'},{status:409}):Response.json({version:r.data[0].version});
}
