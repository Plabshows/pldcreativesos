import {describe,it,expect} from 'vitest';
import {clientMetrics,buildClientInsights,paymentPoints,invoiceSettlement,type InsightsData} from '../lib/client-insights';
import type {Invoice,InvoicePayment} from '../lib/invoices';
const client={id:'c',company_name:'Client',strategic_importance:5,ease_of_work:5,deleted_at:null};
const event={id:'e',client_id:'c',event_name:'Event',event_date:'2026-09-01',venue:null,status:'completed',deleted_at:null,income_cents:10000,expenses_cents:3000,other_expenses_cents:1000};
const inv={id:'i',client_id:'c',event_id:'e',status:'sent',issue_date:'2026-09-01',due_date:'2026-09-10',total_cents:10000,currency:'EUR'} as Invoice;
const data:InsightsData={clients:[client],events:[event],invoices:[inv],payments:[],expenses:[],shows:[],showLinks:[]};
describe('client metrics',()=>{
 it('does not double count event sale and linked invoice',()=>{const m=clientMetrics(client,data,'EUR','2026-09-14');expect(m.revenue).toBe(10000);expect(m.invoiced).toBe(10000);expect(m.profit).toBe(6000);expect(m.overdue).toBe(10000)});
 it('keeps currencies and unknown income separate',()=>{expect(clientMetrics(client,data,'USD').revenue).toBe(0);expect(clientMetrics(client,{...data,invoices:[],events:[{...event,income_cents:null}]}).profit).toBeNull()});
 it('does not rate clients as bad payers without evidence',()=>{expect(buildClientInsights(data).c.score).toBeNull();expect(clientMetrics(client,data).paymentSamples).toBe(1)});
 it('uses the full settlement date after partial payments',()=>{const payments=[{invoice_id:'i',amount_cents:4000,currency:'EUR',payment_date:'2026-09-03',created_at:'a'},{invoice_id:'i',amount_cents:6000,currency:'EUR',payment_date:'2026-09-12',created_at:'b'}] as InvoicePayment[];expect(invoiceSettlement(inv,payments.slice(0,1))).toBeNull();expect(invoiceSettlement(inv,payments)).toBe('2026-09-12');const m=clientMetrics(client,{...data,payments});expect(m.averageDays).toBe(11);expect(m.pending).toBe(0);expect(m.averageLate).toBe(2)});
 it('follows late payment bands and weighted score',()=>{expect([0,7,15,30,60,61].map(paymentPoints)).toEqual([100,90,75,50,25,0]);const invoices=[0,1,2].map(n=>({...inv,id:String(n)}));const payments=invoices.map(i=>({invoice_id:i.id,amount_cents:10000,currency:'EUR',payment_date:'2026-09-10',created_at:'a'} as InvoicePayment));expect(buildClientInsights({...data,invoices,payments}).c.score).toBe(100)});
});
