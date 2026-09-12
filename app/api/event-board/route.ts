import {NextResponse} from 'next/server';
import {z} from 'zod';
import {requireOrganization} from '@/lib/server/auth';
const fields=z.object({income_cents:z.number().int().min(0).max(100000000000).nullable().optional(),expenses_cents:z.number().int().min(0).max(100000000000).nullable().optional(),other_expenses_cents:z.number().int().min(0).max(100000000000).nullable().optional(),client_paid:z.boolean().nullable().optional(),invoice_number:z.string().max(500).optional(),event_name:z.string().trim().min(1).max(500).optional(),event_date:z.string().date().nullable().optional(),client_id:z.string().uuid().nullable().optional(),city:z.string().max(200).optional(),venue:z.string().max(500).optional(),internal_notes:z.string().max(20000).optional(),wardrobe_notes:z.string().max(10000).optional(),status:z.enum(['lead','proposal','confirmed','production','completed','cancelled']).optional(),board_position:z.number().finite().optional(),deleted_at:z.string().datetime().nullable().optional()}).strict();
const schema=z.discriminatedUnion('action',[
 z.object({action:z.literal('update'),ids:z.array(z.string().uuid()).min(1).max(1000),patch:fields}),
 z.object({action:z.literal('create'),patch:fields.extend({event_name:z.string().trim().min(1).max(500)})}),
 z.object({action:z.literal('relation'),event_id:z.string().uuid(),kind:z.enum(['talent','shows']),target:z.string().uuid(),remove:z.boolean()})
]);
export async function GET(){
 const a=await requireOrganization();if('error'in a)return a.error;const org=a.membership.organization_id;
 const queries=[a.supabase.from('events').select('*').eq('organization_id',org).order('event_date',{ascending:false,nullsFirst:false}).range(0,999),a.supabase.from('clients').select('id,company_name,group_id').eq('organization_id',org).is('deleted_at',null).order('company_name').range(0,999),a.supabase.from('talent').select('id,real_name').eq('organization_id',org).is('deleted_at',null).order('real_name').range(0,999),a.supabase.from('shows').select('id,name').eq('organization_id',org).eq('active',true).order('name').range(0,999),a.supabase.from('event_talent').select('*').eq('organization_id',org).range(0,999),a.supabase.from('event_shows').select('*').eq('organization_id',org).range(0,999)];
 const r=await Promise.all(queries);if(r.some(x=>x.error))return NextResponse.json({error:'No se pudo cargar el tablero de eventos.'},{status:500});
 return NextResponse.json({events:r[0].data,clients:r[1].data,talent:r[2].data,shows:r[3].data,assignments:r[4].data,showLinks:r[5].data,canEdit:['admin','producer'].includes(a.membership.role)});
}
export async function POST(req:Request){
 const a=await requireOrganization();if('error'in a)return a.error;if(!['admin','producer'].includes(a.membership.role))return NextResponse.json({error:'Tu perfil no permite editar eventos.'},{status:403});
 const p=schema.safeParse(await req.json().catch(()=>null));if(!p.success)return NextResponse.json({error:'Revisa los campos y la fecha.'},{status:400});const b=p.data,org=a.membership.organization_id;let r;
 if(b.action==='relation'){
  const ev=await a.supabase.from('events').select('id').eq('organization_id',org).eq('id',b.event_id).is('deleted_at',null).maybeSingle();
  const target=await a.supabase.from(b.kind).select('id').eq('organization_id',org).eq('id',b.target).maybeSingle();
  if(!ev.data||!target.data)return NextResponse.json({error:'Evento o registro no disponible.'},{status:400});
  const table=b.kind==='talent'?'event_talent':'event_shows',key=b.kind==='talent'?'talent_id':'show_id';
  r=b.remove?await a.supabase.from(table).delete().eq('organization_id',org).eq('event_id',b.event_id).eq(key,b.target):await a.supabase.from(table).upsert({organization_id:org,event_id:b.event_id,[key]:b.target},{onConflict:'event_id,'+key,ignoreDuplicates:true});
 }else{
  if(b.patch.client_id){const c=await a.supabase.from('clients').select('id').eq('id',b.patch.client_id).eq('organization_id',org).is('deleted_at',null).maybeSingle();if(!c.data)return NextResponse.json({error:'Cliente no disponible.'},{status:400});}
  r=b.action==='create'?await a.supabase.from('events').insert({...b.patch,organization_id:org,event_code:'EV-'+crypto.randomUUID(),owner_id:a.userId}).select('id'):await a.supabase.from('events').update({...b.patch,updated_at:new Date().toISOString()}).eq('organization_id',org).in('id',b.ids).select('id');
  if(!r.error&&!r.data?.length)return NextResponse.json({error:'Evento no disponible. Actualiza el tablero.'},{status:409});
 }
 return r.error?NextResponse.json({error:'No se pudo guardar. El cambio no se ha aplicado.'},{status:400}):NextResponse.json({ok:true});
}
