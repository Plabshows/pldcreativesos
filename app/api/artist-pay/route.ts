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
 if(b.paid)return NextResponse.json({error:'Registra el pago en Facturación & Gastos con fecha e importe.'},{status:409});
 const result=await a.supabase.rpc('set_artist_budget',{target_org:org,target_event:b.event_id,target_talent:b.talent_id,fee:b.amount});
 if(result.error)return NextResponse.json({error:result.error.code==='P0001'?result.error.message:'No se pudo guardar el sueldo completo. Comprueba la actualización de Supabase.'},{status:409});
 return NextResponse.json({ok:true});
}
