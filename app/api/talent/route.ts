import {NextResponse} from 'next/server';
import {z} from 'zod';
import {requireOrganization} from '@/lib/server/auth';
const fields=z.object({aliases:z.array(z.string().min(1).max(200)).max(100).optional(),tax_id:z.string().max(200).optional(),iban:z.string().max(200).optional(),billing_supplier_id:z.uuid().nullable().optional(),billing_confidence:z.enum(['confirmed','review']).optional(),skills:z.array(z.string().min(1).max(100)).max(100).nullable().optional(),real_name:z.string().trim().min(1).max(200),city:z.string().max(200).nullable(),email:z.string().max(500).nullable(),phone:z.string().max(200).nullable(),notes:z.string().max(10000).nullable()}).strict();
const requestSchema=z.object({id:z.uuid(),original:fields,fields}).strict();
export async function POST(req:Request){
 const auth=await requireOrganization();if('error' in auth)return auth.error;
 if(!['admin','producer'].includes(auth.membership.role))return NextResponse.json({error:'No tienes permiso para eliminar artistas.'},{status:403});
 const p=z.object({id:z.uuid(),action:z.enum(['remove','restore'])}).strict().safeParse(await req.json().catch(()=>null));
 if(!p.success)return NextResponse.json({error:'Selecciona un artista.'},{status:400});
 let q=auth.supabase.from('talent').update({deleted_at:p.data.action==='remove'?new Date().toISOString():null}).eq('organization_id',auth.membership.organization_id).eq('id',p.data.id);
 q=p.data.action==='remove'?q.is('deleted_at',null):q.not('deleted_at','is',null);
 const {data,error}=await q.select('id').maybeSingle();
 if(error)return NextResponse.json({error:'No se pudo guardar el cambio.'},{status:400});
 if(!data)return NextResponse.json({error:'La ficha ha cambiado. Actualiza el directorio.'},{status:409});
 return NextResponse.json({ok:true});
}
export async function PATCH(req:Request){
 const auth=await requireOrganization();if('error' in auth)return auth.error;
 if(!['admin','producer'].includes(auth.membership.role))return NextResponse.json({error:'Tu perfil no permite editar talento.'},{status:403});
 const p=requestSchema.safeParse(await req.json().catch(()=>null));if(!p.success)return NextResponse.json({error:'Revisa los campos. El nombre es obligatorio.'},{status:400});
 let query=auth.supabase.from('talent').update(p.data.fields).eq('organization_id',auth.membership.organization_id).eq('id',p.data.id).is('deleted_at',null);
 for(const [key,value] of Object.entries(p.data.original)){
  if(value===undefined)continue;
  query=value===null?query.is(key,null):Array.isArray(value)?query.filter(key,'eq','{'+value.map(v=>'"'+v.replace(/\\/g,'\\\\').replace(/"/g,'\\"')+'"').join(',')+'}'):query.eq(key,value);
 }
 const {data,error}=await query.select('id,real_name,city,email,phone,notes,skills,aliases,tax_id,iban,billing_supplier_id,billing_confidence,identity_sources,merged_into').maybeSingle();
 if(error)return NextResponse.json({error:'No se pudo guardar la ficha.'},{status:400});
 if(!data)return NextResponse.json({error:'Otra persona ha modificado esta ficha. Cierra y vuelve a abrirla para revisar los datos actuales.'},{status:409});
 return NextResponse.json({artist:data});
}
