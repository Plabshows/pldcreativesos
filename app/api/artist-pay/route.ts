import {NextResponse} from 'next/server';
import {z} from 'zod';
import {requireOrganization} from '@/lib/server/auth';
import {getExpenses,getExpensePayments} from '@/lib/server/expenses';
import {expenseBalance,type Expense,type ExpensePayment} from '@/lib/expenses';
const schema=z.object({event_id:z.string().uuid(),talent_id:z.string().uuid(),amount:z.number().int().min(0).max(100000000),paid:z.boolean()});
export async function GET(){
 const a=await requireOrganization();if('error'in a)return a.error;
 const r=await a.supabase.from('payments').select('id,event_id,talent_id,amount_cents,status').eq('organization_id',a.membership.organization_id).eq('direction','outbound').eq('kind','artist').range(0,999);
 if(r.error)return NextResponse.json({error:'No se pudieron cargar los pagos.'},{status:500});
 try{const [expenses,ep]=await Promise.all([getExpenses(a.supabase,a.membership.organization_id),getExpensePayments(a.supabase,a.membership.organization_id)]);
 const linked=expenses.filter(e=>e.talent_id&&e.event_id&&e.status!=='cancelled');
 const payments=[...r.data.filter(p=>!linked.some(e=>e.talent_id===p.talent_id&&e.event_id===p.event_id)),...linked.filter(e=>e.currency==='EUR'&&e.total_cents!==null).flatMap(e=>{const b=expenseBalance(e as unknown as Expense,ep as unknown as ExpensePayment[]);return [{id:e.id,event_id:e.event_id,talent_id:e.talent_id,amount_cents:b.paid,status:'paid'},{id:e.id+'-pending',event_id:e.event_id,talent_id:e.talent_id,amount_cents:b.pending,status:b.pending===0?'paid':'pending'}]})];
 return NextResponse.json({payments,expenses:linked.map(e=>({id:e.id,talent_id:e.talent_id,event_id:e.event_id,currency:e.currency}))});
 }catch{return NextResponse.json({error:'No se pudieron cargar los gastos vinculados.'},{status:500})}
}
export async function POST(req:Request){
 const a=await requireOrganization();if('error'in a)return a.error;
 if(!['admin','producer'].includes(a.membership.role))return NextResponse.json({error:'No tienes permiso para editar pagos.'},{status:403});
 const parsed=schema.safeParse(await req.json().catch(()=>null));if(!parsed.success)return NextResponse.json({error:'Revisa el importe.'},{status:400});
 const b=parsed.data,org=a.membership.organization_id;
 const linked=await a.supabase.from('expenses').select('id').eq('organization_id',org).eq('talent_id',b.talent_id).eq('event_id',b.event_id).neq('status','cancelled').maybeSingle();
 if(linked.error)return NextResponse.json({error:'No se pudo comprobar el gasto.'},{status:500});
 if(linked.data)return NextResponse.json({error:'Este trabajo se gestiona en Facturación & Gastos para conservar pagos parciales y seguimiento.',expense_id:linked.data.id},{status:409});
 const assignment=await a.supabase.from('event_talent').select('event_id').eq('organization_id',org).eq('event_id',b.event_id).eq('talent_id',b.talent_id).maybeSingle();
 if(assignment.error||!assignment.data)return NextResponse.json({error:'Este artista no está asignado al evento.'},{status:400});
 const existing=await a.supabase.from('payments').select('id').eq('organization_id',org).eq('event_id',b.event_id).eq('talent_id',b.talent_id).eq('kind','artist').eq('direction','outbound');
 if(existing.error||existing.data.length>1)return NextResponse.json({error:'Hay varios pagos para este trabajo. Revisa sus pagos antes de modificar el total.'},{status:409});
 const patch={amount_cents:b.amount,status:b.paid?'paid':'pending',paid_on:b.paid?new Date().toISOString().slice(0,10):null};
 const r=existing.data.length?await a.supabase.from('payments').update(patch).eq('organization_id',org).eq('id',existing.data[0].id):await a.supabase.from('payments').insert({...patch,organization_id:org,event_id:b.event_id,talent_id:b.talent_id,kind:'artist',direction:'outbound'});
 if(r.error)return NextResponse.json({error:'No se pudo guardar el sueldo.'},{status:400});

 await a.supabase.from('event_talent').update({
  agreed_cost_cents: b.amount
 }).eq('organization_id', org).eq('event_id', b.event_id).eq('talent_id', b.talent_id);

 return NextResponse.json({ok:true});
}
