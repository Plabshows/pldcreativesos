import {invoiceBalance,invoiceToday,type Invoice,type InvoicePayment} from './invoices';
import type {Expense} from './expenses';
export type InsightClient={id:string;company_name:string;strategic_importance:number|null;ease_of_work:number|null;deleted_at:string|null};
export type InsightEvent={id:string;client_id:string|null;event_name:string;event_date:string|null;venue:string|null;status:string;deleted_at:string|null;income_cents:number|null;expenses_cents:number|null;other_expenses_cents:number|null};
export type InsightsData={clients:InsightClient[];events:InsightEvent[];invoices:Invoice[];payments:InvoicePayment[];expenses:Expense[];shows:{id:string;name:string}[];showLinks:{event_id:string;show_id:string}[]};
export function daysBetween(start:string,end:string){return Math.round((Date.parse(end.slice(0,10))-Date.parse(start.slice(0,10)))/86400000)}
export function paymentPoints(late:number){return late<=0?100:late<=7?90:late<=15?75:late<=30?50:late<=60?25:0}
export function invoiceSettlement(i:Invoice,payments:InvoicePayment[]){let sum=0;for(const p of payments.filter(p=>p.invoice_id===i.id&&p.currency===i.currency).sort((a,b)=>a.payment_date.localeCompare(b.payment_date)||a.created_at.localeCompare(b.created_at))){sum+=p.amount_cents;if(sum>=i.total_cents)return p.payment_date}return null}
export function clientMetrics(client:InsightClient,d:InsightsData,currency='EUR',today=invoiceToday()){
 const allEvents=d.events.filter(e=>e.client_id===client.id&&!e.deleted_at),jobs=allEvents.filter(e=>['confirmed','production','completed'].includes(e.status));
 const invoices=d.invoices.filter(i=>i.client_id===client.id&&i.currency===currency&&!['draft','cancelled'].includes(i.status));
 const eventFinancials=jobs.map(e=>{const inv=invoices.filter(i=>i.event_id===e.id),revenue=currency==='EUR'?e.income_cents??(inv.length?inv.reduce((s,i)=>s+i.total_cents,0):0):inv.length?inv.reduce((s,i)=>s+i.total_cents,0):0;const expenses=d.expenses.filter(x=>x.event_id===e.id&&x.status!=='cancelled'&&!x.covered_by_expense_id&&x.currency===currency);const cost=expenses.length?(expenses.some(x=>x.total_cents===null)?null:expenses.reduce((s,x)=>s+x.total_cents!,0)):currency==='EUR'&&e.expenses_cents!==null&&e.other_expenses_cents!==null?e.expenses_cents+e.other_expenses_cents:null;return {id:e.id,revenue,cost,profit:cost!==null&&revenue!==null?revenue-cost:null}});
 const eventsRevenue=eventFinancials.reduce((s,e)=>s+(e.revenue||0),0);
 const invoiced=invoices.reduce((s,i)=>s+i.total_cents,0);
 const revenue=jobs.length>0?eventsRevenue:invoiced;
 const reconciliationDiff=eventsRevenue-invoiced;
 let paid=0,pending=0,overdue=0,overdueCount=0;const paymentDays:number[]=[],lateDays:number[]=[],points:number[]=[];
 for(const i of invoices){const b=invoiceBalance(i,d.payments,today);paid+=b.received;pending+=b.pending;if(b.status==='overdue'){overdue+=b.pending;overdueCount++}const settled=invoiceSettlement(i,d.payments);if(settled&&i.issue_date){paymentDays.push(Math.max(0,daysBetween(i.issue_date,settled)));if(i.due_date){const late=Math.max(0,daysBetween(i.due_date,settled));lateDays.push(late);points.push(paymentPoints(late))}}else if(b.status==='overdue'&&i.due_date){const late=daysBetween(i.due_date,today);points.push(paymentPoints(late));lateDays.push(late)}}
 const avg=(n:number[])=>n.length?n.reduce((s,v)=>s+v,0)/n.length:null;
 const expensesComplete=jobs.length>0&&eventFinancials.every(e=>e.cost!==null&&e.revenue!==null),cost=expensesComplete?eventFinancials.reduce((s,e)=>s+e.cost!,0):null,profit=cost===null?null:revenue-cost;
 const dates=jobs.map(e=>e.event_date).filter((v):v is string=>!!v).sort();
 return {jobs:jobs.length,revenue,eventsRevenue,invoiced,reconciliationDiff,paid,pending,overdue,overdueCount,invoiceCount:invoices.length,cost,profit,margin:profit!==null&&revenue>0?profit/revenue*100:null,ticket:jobs.length?eventsRevenue/jobs.length:null,first:dates[0]||null,last:dates.filter(x=>x<=today).at(-1)||null,next:dates.find(x=>x>today)||null,averageDays:avg(paymentDays),averageLate:avg(lateDays),paymentScore:points.length>=3?avg(points):null,paymentSamples:points.length,lastInvoice:invoices.map(i=>i.issue_date).filter((v):v is string=>!!v).sort().at(-1)||null,lastPayment:d.payments.filter(p=>invoices.some(i=>i.id===p.invoice_id)).map(p=>p.payment_date).sort().at(-1)||null,missingRevenue:eventFinancials.filter(e=>e.revenue===null).length,eventFinancials};
}
export type ClientMetrics=ReturnType<typeof clientMetrics>;
export function percentile(value:number,values:number[]){if(value<=0||!values.length)return 0;if(values.length===1)return 100;const lower=values.filter(v=>v<value).length,equal=values.filter(v=>v===value).length;return Math.round((lower+(equal-1)/2)/(values.length-1)*100)}
export function buildClientInsights(d:InsightsData,currency='EUR'){
 const metrics=Object.fromEntries(d.clients.map(c=>[c.id,clientMetrics(c,d,currency)]));const cohort=d.clients.filter(c=>!c.deleted_at&&metrics[c.id].jobs>0).map(c=>metrics[c.id]);
 return Object.fromEntries(d.clients.map(c=>{const m=metrics[c.id],economic=percentile(m.revenue,cohort.map(m=>m.revenue)),jobsScore=percentile(m.jobs,cohort.map(m=>m.jobs));const score=m.paymentScore===null||c.strategic_importance===null||c.ease_of_work===null||!m.jobs?null:Math.round(.25*economic+.20*jobsScore+.20*m.paymentScore+.20*c.strategic_importance*20+.15*c.ease_of_work*20);return [c.id,{...m,economic,jobsScore,score,level:score===null?'':score>=85?'A':score>=70?'B':score>=55?'C':score>=40?'D':'E'}]}));
}
