import { NextResponse } from 'next/server';
import { requireOrganization } from '@/lib/server/auth';
import { crmSchema, blankCrm } from '@/lib/crm';
import { z } from 'zod';
import { createCrmEvent } from '@/lib/server/crm-event';

export const dynamic = 'force-dynamic';
function failure(error: {code?:string;message:string}) {
  const missing=['42P01','42703','PGRST204','PGRST205'].includes(error.code||'');
  return NextResponse.json({error:missing?'La ampliación CRM está pendiente de activar en Supabase. Puedes probarla en la vista local.':error.code==='23505'?'Este lead ya tiene una oportunidad. Actualiza la lista.':'No se pudo guardar o cargar el CRM. Revisa tus permisos y vuelve a intentarlo.',setupRequired:missing},{status:missing?503:400});
}
export async function GET() {
  const auth=await requireOrganization();if('error' in auth)return auth.error;
  const db=auth.supabase,org=auth.membership.organization_id;
  async function all(table:string,columns='*',soft=false) {
    const rows:Record<string,unknown>[]=[];
    for(let offset=0;;offset+=500){let query=db.from(table).select(columns).eq('organization_id',org).order('id').range(offset,offset+499);if(soft)query=query.is('deleted_at',null);const {data,error}=await query;if(error)throw error;rows.push(...data as unknown as Record<string,unknown>[]);if(data.length<500)return rows;}
  }
  try{
    const [leads,opportunities,activities,clients,events,memberResult]=await Promise.all([
      all('leads','*',true),all('opportunities','*',true),all('crm_activities'),all('clients','id,company_name',true),all('events','id,event_name',true),
      db.from('organization_members').select('user_id,users(full_name,email)').eq('organization_id',org),
    ]);
    if(memberResult.error)throw memberResult.error;
    const normalise=(r:Record<string,unknown>)=>({...r,...Object.fromEntries(Object.entries(blankCrm()).map(([key,fallback])=>[key,(key==='stage'?(r.crm_stage??r.stage):r[key])??fallback]))});
    return NextResponse.json({leads:leads.map(normalise),opportunities:opportunities.map(normalise),activities:activities.map(r=>({...r,entity_id:r.opportunity_id||r.lead_id,entity_type:r.opportunity_id?'opportunities':'leads'})),clients,events,members:memberResult.data.map(r=>{const user=r.users as unknown as {full_name:string;email:string};return {id:r.user_id,name:user?.full_name||user?.email||`Miembro ${r.user_id.slice(0,8)}`};})});
  }catch(error){return failure(error as {code?:string;message:string});}
}
const requestSchema=z.object({entity:z.enum(['leads','opportunities']),id:z.uuid().optional(),action:z.enum(['save','activity','promote','link','create_event','remove','restore']).default('save'),fields:crmSchema.optional(),body:z.string().trim().min(1).max(10000).optional(),event_id:z.uuid().optional()});
export async function POST(request:Request) {
  const auth=await requireOrganization();if('error' in auth)return auth.error;
  if(!['admin','producer','sales'].includes(auth.membership.role))return NextResponse.json({error:'Tu rol no permite modificar el CRM.'},{status:403});
  const parsed=requestSchema.safeParse(await request.json().catch(()=>null));if(!parsed.success)return NextResponse.json({error:parsed.error.issues[0].message},{status:400});
  const input=parsed.data,db=auth.supabase,org=auth.membership.organization_id;
  if(input.action==='remove'||input.action==='restore'){
    if(input.entity!=='leads'||!input.id)return NextResponse.json({error:'Selecciona un lead.'},{status:400});
    let change=db.from('leads').update({deleted_at:input.action==='remove'?new Date().toISOString():null}).eq('organization_id',org).eq('id',input.id);
    change=input.action==='remove'?change.is('deleted_at',null):change.not('deleted_at','is',null);
    const {data,error}=await change.select('id');
    if(error)return failure(error);
    if(!data?.length)return NextResponse.json({error:'El lead ya ha cambiado. Actualiza la lista.'},{status:409});
    return NextResponse.json({ok:true});
  }
  let existing:Record<string,unknown>|null=null;
  if(input.id){const {data,error}=await db.from(input.entity).select('*').eq('organization_id',org).eq('id',input.id).is('deleted_at',null).maybeSingle();if(error)return failure(error);if(!data)return NextResponse.json({error:'No se encontró el registro.'},{status:404});existing=data;}
  if(input.action==='create_event'){
    if(!existing||input.entity!=='opportunities')return NextResponse.json({error:'Selecciona una oportunidad.'},{status:400});
    if(!['admin','producer'].includes(auth.membership.role))return NextResponse.json({error:'Un administrador o productor debe crear el evento.'},{status:403});
    try{return NextResponse.json({ok:true,event_id:await createCrmEvent(db,org,existing,auth.userId)});}
    catch(error){return NextResponse.json({error:error instanceof Error?error.message:'No se pudo crear el evento.'},{status:400});}
  }else if(input.action==='activity'){
    if(!existing||!input.body)return NextResponse.json({error:'Selecciona un registro y escribe la actividad.'},{status:400});
    const {error}=await db.from('crm_activities').insert({organization_id:org,actor_id:auth.userId,[input.entity==='leads'?'lead_id':'opportunity_id']:input.id,kind:'note',body:input.body});if(error)return failure(error);
  }else if(input.action==='link'){
    if(!existing||input.entity!=='opportunities'||existing.stage!=='won'||!input.event_id)return NextResponse.json({error:'Solo puedes enlazar una oportunidad ganada con un evento.'},{status:400});
    if(existing.event_id)return NextResponse.json({error:'Esta oportunidad ya tiene un evento vinculado.'},{status:409});
    const event=await db.from('events').select('id').eq('id',input.event_id).eq('organization_id',org).is('deleted_at',null).maybeSingle();
    if(event.error)return failure(event.error);if(!event.data)return NextResponse.json({error:'Evento no disponible en este espacio.'},{status:400});
    const {data,error}=await db.from('opportunities').update({event_id:input.event_id}).eq('id',input.id!).eq('organization_id',org).eq('stage','won').is('event_id',null).select('id');if(error)return failure(error);
    if(!data?.length)return NextResponse.json({error:'La oportunidad ha cambiado. Actualiza la ficha.'},{status:409});
  }else if(input.action==='promote'){
    if(!existing||input.entity!=='leads')return NextResponse.json({error:'Selecciona un lead.'},{status:400});
    const values=crmSchema.safeParse(Object.fromEntries(Object.keys(crmSchema.shape).map(key=>[key,key==='stage'?existing!.crm_stage:(existing![key]??undefined)])));
    if(!values.success)return NextResponse.json({error:'Completa la ficha del lead antes de crear la oportunidad.'},{status:400});
    const fields=toDatabase(values.data);
    const {error}=await db.from('opportunities').insert({...fields,organization_id:org,lead_id:input.id});if(error)return failure(error);
  }else{
    if(!input.fields)return NextResponse.json({error:'Faltan los datos.'},{status:400});
    const fields=toDatabase(input.fields);
    if(input.entity==='leads'){fields.crm_stage=fields.stage;delete fields.stage;}
    const query=input.id?db.from(input.entity).update(fields).eq('organization_id',org).eq('id',input.id):db.from(input.entity).insert({...fields,organization_id:org});
    const {error}=await query;if(error)return failure(error);
  }
  return NextResponse.json({ok:true});
}
function toDatabase(fields:z.infer<typeof crmSchema>):Record<string,unknown>{
  return Object.fromEntries(Object.entries(fields).map(([key,value])=>[key,(key.endsWith('_id')||key.endsWith('_date'))&&value===''?null:value]));
}
