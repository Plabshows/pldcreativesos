import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOrganization } from '@/lib/server/auth';

const fields = z.object({
 company_name: z.string().trim().min(1).max(200).optional(),
 contact_name: z.string().max(500).optional(), phone: z.string().max(200).optional(),
 email: z.string().max(500).optional(), client_type: z.string().max(120).optional(),
 city: z.string().max(200).optional(), company: z.string().max(500).optional(),
 fiscal_data: z.string().max(10000).optional(), notes: z.string().max(10000).optional(),
 group_id: z.string().uuid().optional(), position: z.number().finite().optional(),
 deleted_at: z.string().datetime().nullable().optional(),
}).strict();
const action = z.discriminatedUnion('action', [
 z.object({ action: z.literal('update'), ids: z.array(z.string().uuid()).min(1).max(1000), patch: fields }),
 z.object({ action: z.literal('create'), patch: fields.extend({company_name:z.string().trim().min(1).max(200),group_id:z.string().uuid()}) }),
 z.object({ action: z.literal('group'), id:z.string().uuid().optional(), name:z.string().trim().min(1).max(120), position:z.number().finite(),color:z.string().regex(/^#[0-9a-f]{6}$/i) }),
 z.object({ action:z.literal('linkEvent'), event_id:z.string().uuid(), client_id:z.string().uuid() }),
]);

export async function GET() {
 const auth=await requireOrganization(); if('error' in auth)return auth.error;
 const org=auth.membership.organization_id;
 const results=await Promise.all([
  auth.supabase.from('clients').select('*').eq('organization_id',org).order('position').order('id').range(0,999),
  auth.supabase.from('client_groups').select('*').eq('organization_id',org).order('position'),
  auth.supabase.from('events').select('id,event_name,event_date,client_id,status,venue').eq('organization_id',org).is('deleted_at',null).order('event_date',{ascending:false}).range(0,999),
 ]);
 if(results.some(r=>r.error))return NextResponse.json({error:'No se pudo cargar el tablero compartido. Vuelve a intentarlo.'},{status:500});
 return NextResponse.json({clients:results[0].data,groups:results[1].data,events:results[2].data,canEdit:['admin','producer','sales'].includes(auth.membership.role),canLinkEvents:['admin','producer'].includes(auth.membership.role)});
}

export async function POST(request:Request) {
 const auth=await requireOrganization();if('error' in auth)return auth.error;
 if(!['admin','producer','sales'].includes(auth.membership.role))return NextResponse.json({error:'Tu perfil no permite editar clientes.'},{status:403});
 const parsed=action.safeParse(await request.json().catch(()=>null));
 if(!parsed.success)return NextResponse.json({error:'Revisa los campos: '+parsed.error.issues.map(i=>i.path.join('.')+' '+i.message).join(', ')},{status:400});
 const body=parsed.data,org=auth.membership.organization_id;
 let result;
 if(body.action==='update'||body.action==='create') {
  if(body.patch.group_id){const group=await auth.supabase.from('client_groups').select('id').eq('organization_id',org).eq('id',body.patch.group_id).maybeSingle();if(!group.data)return NextResponse.json({error:'Grupo no disponible.'},{status:400});}
  result=body.action==='create'
   ? await auth.supabase.from('clients').insert({...body.patch,organization_id:org,client_code:'CL-'+crypto.randomUUID(),country:''}).select('id')
   : await auth.supabase.from('clients').update({...body.patch,updated_at:new Date().toISOString()}).eq('organization_id',org).in('id',body.ids).select('id');
 } else if(body.action==='group') {
  const patch={name:body.name,position:body.position,color:body.color};
  result=body.id?await auth.supabase.from('client_groups').update(patch).eq('id',body.id).eq('organization_id',org).select('id'):await auth.supabase.from('client_groups').insert({...patch,organization_id:org}).select('id');
 } else {
  if(!['admin','producer'].includes(auth.membership.role))return NextResponse.json({error:'Solo producción y administración pueden asignar eventos.'},{status:403});
  const client=await auth.supabase.from('clients').select('id').eq('organization_id',org).eq('id',body.client_id).is('deleted_at',null).maybeSingle();
  if(!client.data)return NextResponse.json({error:'Cliente no disponible.'},{status:400});
  result=await auth.supabase.from('events').update({client_id:body.client_id}).eq('id',body.event_id).eq('organization_id',org).is('client_id',null).select('id');
 }
 if(result.error)return NextResponse.json({error:result.error.code==='23505'?'Ya existe un grupo con ese nombre.':'No se pudo guardar el cambio. Tus datos anteriores se mantienen.'},{status:400});
 if(!result.data?.length)return NextResponse.json({error:'El registro ha cambiado o ya no está disponible. Actualiza el tablero.'},{status:409});
 return NextResponse.json({ok:true});
}
