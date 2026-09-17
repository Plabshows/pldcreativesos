import {NextResponse} from 'next/server';import {z} from 'zod';
import {requireOrganization} from '@/lib/server/auth';import {rows,workspaceReferences} from '@/lib/server/workspace-data';import {workTaskSchema,newTask} from '@/lib/work-tasks';
export async function GET(){const a=await requireOrganization();if('error'in a)return a.error;try{const [data,refs,proposals]=await Promise.all([rows(a.supabase,a.membership.organization_id,'tasks'),workspaceReferences(a.supabase,a.membership.organization_id),rows(a.supabase,a.membership.organization_id,'proposals','id,title',true)]);return NextResponse.json({data:data.map(t=>({...t,...Object.fromEntries(Object.keys(newTask()).map(k=>[k,t[k]??'']))})),refs:{...refs,proposals},userId:a.userId,canEdit:['admin','producer','sales'].includes(a.membership.role)});}catch{return NextResponse.json({error:'No se pudieron cargar las tareas. Reintenta la conexión.'},{status:503});}}
const requestSchema=z.object({id:z.uuid(),version:z.number().int().positive().optional(),fields:workTaskSchema.optional(),action:z.enum(['save','archive','restore']).default('save')});
export async function POST(req:Request){
 const a=await requireOrganization();if('error'in a)return a.error;if(!['admin','producer','sales'].includes(a.membership.role))return NextResponse.json({error:'Tu rol no permite modificar tareas.'},{status:403});
 const p=requestSchema.safeParse(await req.json().catch(()=>null));if(!p.success)return NextResponse.json({error:p.error.issues[0].message},{status:400});const b=p.data;
 if(b.action==='save'&&!b.fields)return NextResponse.json({error:'Faltan los datos.'},{status:400});
 const values=b.fields?Object.fromEntries(Object.entries(b.fields).map(([k,v])=>[k,(k.endsWith('_id')||k==='deadline')&&!v?null:v])):{};
 if(b.fields){
  let completedAt:string|null=null;
  if(b.fields.status==='done'){
   if(b.version){const current=await a.supabase.from('tasks').select('completed_at').eq('id',b.id).eq('organization_id',a.membership.organization_id).maybeSingle();if(current.error)return NextResponse.json({error:'No se pudo comprobar la tarea.'},{status:500});completedAt=current.data?.completed_at||null;}
   completedAt=completedAt||new Date().toISOString();
  }
  values.completed_at=completedAt;
 }
 const patch=b.action==='archive'?{deleted_at:new Date().toISOString()}:b.action==='restore'?{deleted_at:null}:values;
 const r=b.version?await a.supabase.from('tasks').update({...patch,version:b.version+1}).eq('id',b.id).eq('organization_id',a.membership.organization_id).eq('version',b.version).select('id'):b.action==='save'?await a.supabase.from('tasks').insert({...values,id:b.id,organization_id:a.membership.organization_id}).select('id'):null;
 if(!r)return NextResponse.json({error:'Actualiza la tarea.'},{status:400});if(r.error)return NextResponse.json({error:'No se pudo guardar. Revisa los campos y las relaciones del equipo.'},{status:400});if(!r.data?.length)return NextResponse.json({error:'Otra persona ha cambiado esta tarea. Actualiza antes de guardarla.'},{status:409});return NextResponse.json({ok:true});
}
