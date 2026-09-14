import {NextResponse} from 'next/server';
import {z} from 'zod';
import {artistBeforeCreate} from '@/lib/server/identity';
import {requireOrganization} from '@/lib/server/auth';
const schema=z.object({kind:z.enum(['client','city','venue','talent','shows']),name:z.string().trim().min(1).max(200),group_id:z.string().uuid().optional()}).strict();
export async function POST(req:Request){
 const a=await requireOrganization();if('error'in a)return a.error;
 if(!['admin','producer'].includes(a.membership.role))return NextResponse.json({error:'No puedes crear registros.'},{status:403});
 const parsed=schema.safeParse(await req.json().catch(()=>null));if(!parsed.success)return NextResponse.json({error:'Escribe un nombre válido.'},{status:400});
 const {kind,group_id}=parsed.data,name=parsed.data.name.replace(/\s+/g,' '),org=a.membership.organization_id;
 if(kind==='talent'){const match=await artistBeforeCreate(a.supabase,org,name);if(match.exact)return NextResponse.json({value:match.exact.id,name:match.exact.real_name});if(match.candidates.length)return NextResponse.json({error:'Posible coincidencia: '+match.candidates.map(p=>p.real_name).join(', ')+'. Selecciona su ficha o revisa los datos antes de crear otra.',candidates:match.candidates.map(p=>({id:p.id,name:p.real_name}))},{status:409});}
 if(kind==='city'||kind==='venue'){
  const found=await a.supabase.from('event_places').select('id,name').eq('organization_id',org).eq('kind',kind).eq('name_key',name.toLowerCase()).maybeSingle();
  if(found.error)return NextResponse.json({error:'No se pudo consultar el catálogo.'},{status:500});
  if(found.data)return NextResponse.json({value:found.data.name,name:found.data.name});
  const created=await a.supabase.from('event_places').insert({organization_id:org,kind,name}).select('id,name').single();
  if(created.error?.code==='23505'){
   const retry=await a.supabase.from('event_places').select('name').eq('organization_id',org).eq('kind',kind).eq('name_key',name.toLowerCase()).single();
   if(retry.data)return NextResponse.json({value:retry.data.name,name:retry.data.name});
  }
  if(created.error)return NextResponse.json({error:'No se pudo guardar el lugar.'},{status:400});
  return NextResponse.json({value:created.data.name,name:created.data.name});
 }
 if(kind==='client'){
  if(!group_id)return NextResponse.json({error:'Selecciona el tablero del cliente.'},{status:400});
  const g=await a.supabase.from('client_groups').select('id').eq('id',group_id).eq('organization_id',org).maybeSingle();
  if(!g.data)return NextResponse.json({error:'Tablero no disponible.'},{status:400});
 }
 const table=kind==='client'?'clients':kind,field=kind==='client'?'company_name':kind==='talent'?'real_name':'name';
 let query=a.supabase.from(table).select(`id,${field}`).eq('organization_id',org).ilike(field,name.replace(/[\\%_]/g,'\\$&'));
 query=kind==='shows'?query.eq('active',true):query.is('deleted_at',null);
 if(kind==='client')query=query.eq('group_id',group_id!);
 const existing=await query.limit(1);
 if(existing.error)return NextResponse.json({error:'No se pudo comprobar el registro.'},{status:500});
 if(existing.data?.length)return NextResponse.json({value:(existing.data[0] as unknown as {id:string}).id,name});
 const patch=kind==='client'?{company_name:name,group_id,client_code:'CL-'+crypto.randomUUID(),country:''}:kind==='talent'?{real_name:name,talent_code:'TL-'+crypto.randomUUID()}:{name,show_code:'SH-'+crypto.randomUUID(),active:true};
 const r=await a.supabase.from(table).insert({...patch,organization_id:org}).select('id').single();
 return r.error?NextResponse.json({error:'No se pudo crear el registro.'},{status:400}):NextResponse.json({value:r.data.id,name});
}
