import {NextResponse} from 'next/server';import {z} from 'zod';
import {requireOrganization} from '@/lib/server/auth';import {newTask} from '@/lib/work-tasks';import {orderInbox,type InboxTask} from '@/lib/task-inbox';
export async function GET(){
 const a=await requireOrganization();if('error'in a)return a.error;const org=a.membership.organization_id;
 const tasks:Record<string,unknown>[]=[];for(let start=0;;start+=500){const r=await a.supabase.from('tasks').select('*').eq('organization_id',org).eq('owner_id',a.userId).is('deleted_at',null).in('status',['todo','in_progress']).order('id').range(start,start+499);if(r.error)return NextResponse.json({error:'No se pudo cargar tu buzón.'},{status:503});tasks.push(...r.data);if(r.data.length<500)break;}
 const receipts:Record<string,unknown>[]=[];for(let start=0;;start+=500){const r=await a.supabase.from('task_inbox_receipts').select('task_id,seen_version').eq('organization_id',org).eq('user_id',a.userId).order('task_id').range(start,start+499);if(r.error)return NextResponse.json({error:'No se pudieron consultar las novedades del buzón.'},{status:503});receipts.push(...r.data);if(r.data.length<500)break;}
 const data=tasks.map(t=>({...Object.fromEntries(Object.keys(newTask()).map(k=>[k,t[k]??''])),id:t.id,version:t.version,unread:!receipts.some(r=>r.task_id===t.id&&Number(r.seen_version)>=Number(t.version))})) as InboxTask[];
 return NextResponse.json({tasks:orderInbox(data),unread:data.filter(t=>t.unread).length},{headers:{'Cache-Control':'no-store'}});
}
export async function POST(req:Request){
 const a=await requireOrganization();if('error'in a)return a.error;const p=z.object({taskId:z.uuid(),version:z.number().int().positive()}).strict().safeParse(await req.json().catch(()=>null));if(!p.success)return NextResponse.json({error:'Tarea no válida.'},{status:400});
 const r=await a.supabase.from('tasks').select('id,version').eq('organization_id',a.membership.organization_id).eq('owner_id',a.userId).eq('id',p.data.taskId).eq('version',p.data.version).is('deleted_at',null).maybeSingle();if(r.error)return NextResponse.json({error:'No se pudo comprobar la tarea.'},{status:503});if(!r.data)return NextResponse.json({error:'La tarea ha cambiado o ya no está asignada a ti. Actualiza el buzón.'},{status:409});
 const saved=await a.supabase.from('task_inbox_receipts').upsert({organization_id:a.membership.organization_id,task_id:r.data.id,user_id:a.userId,seen_version:r.data.version,seen_at:new Date().toISOString()},{onConflict:'task_id,user_id'});return saved.error?NextResponse.json({error:'No se pudo marcar como vista.'},{status:400}):NextResponse.json({ok:true});
}
