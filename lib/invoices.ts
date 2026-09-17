import {z} from 'zod';
export const invoiceStatuses:Record<string,string>={draft:'Borrador',sent:'Enviada',pending:'Pendiente',unverified:'Cobro por verificar',partial:'Parcial',paid:'Pagada',overdue:'Vencida',cancelled:'Cancelada'};
export const followupKinds:Record<string,string>={email:'Email enviado',whatsapp:'WhatsApp enviado',call:'Llamada',reply:'Cliente respondió',promise:'Promesa de pago',reminder:'Recordatorio',other:'Otro'};
const cents=z.number().int().min(0).max(100000000000);
const optionalId=z.string().uuid().nullable();
export const invoiceFields=z.object({number:z.string().trim().min(1).max(200),client_id:z.string().uuid(),event_id:optionalId,proposal_id:optionalId,issue_date:z.string().date().nullable(),due_date:z.string().date().nullable(),concept:z.string().max(10000),base_cents:cents.nullable(),tax_cents:cents.nullable(),retention_cents:cents.nullable().default(null),total_cents:cents.positive(),currency:z.string().regex(/^[A-Z]{3}$/),status:z.enum(['draft','sent','pending','unverified','paid','cancelled']),document_url:z.union([z.literal(''),z.string().url().refine(v=>/^https?:\/\//i.test(v),'Usa un enlace http o https')]),notes:z.string().max(10000)}).strict().refine(v=>!v.due_date||!v.issue_date||v.due_date>=v.issue_date,'El vencimiento debe ser posterior o igual a la emisión');
export type InvoiceFields=z.infer<typeof invoiceFields>;
export type Invoice=InvoiceFields & {id:string;version:number;created_at:string;original_document_id?:string};
export type InvoicePayment={id:string;invoice_id:string;payment_date:string;amount_cents:number;currency:string;method:string;reference:string;note:string;created_at:string};
export type InvoiceFollowup={id:string;invoice_id:string;followup_date:string;kind:string;note:string;next_action:string;next_action_date:string|null;created_at:string};
export type CollectionEvidence={id:string;source_file:string;source_sheet:string;source_row:number;source_data:{client?:string|null;issue_date?:string|null;collection_date?:string|null;concept?:string|null;notes?:string|null};invoice_number:string;expected_cents:number|null;declared_received_cents:number|null;invoice_id:string|null;candidate_invoice_ids:string[];status:string;issues:string[];note:string;created_at:string};
export type InvoiceData={collectionSources?:CollectionEvidence[];invoices:Invoice[];payments:InvoicePayment[];followups:InvoiceFollowup[];history:{id:string;invoice_id:string;body:string;created_at:string}[];clients:{id:string;company_name:string}[];events:{id:string;event_name:string;event_date?:string|null;venue?:string|null;client_id:string|null}[];proposals:{id:string;title:string;client_id:string|null}[];canEdit:boolean};
export const invoiceToday=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Madrid'}).format(new Date());
export function invoiceBalance(i:Invoice,p:InvoicePayment[],today=invoiceToday()){
 const received=p.filter(p=>p.invoice_id===i.id&&p.currency===i.currency).reduce((sum,p)=>sum+p.amount_cents,0),pending=i.total_cents-received;
 const status=i.status==='cancelled'?'cancelled':i.status==='draft'?'draft':pending<=0?'paid':i.status==='unverified'?'unverified':i.due_date&&i.due_date<today?'overdue':received>0?'partial':i.status;
 return {received,pending,status};
}
export function latestFollowup(i:Invoice,f:InvoiceFollowup[]){return f.filter(f=>f.invoice_id===i.id).sort((a,b)=>b.followup_date.localeCompare(a.followup_date)||b.created_at.localeCompare(a.created_at))[0]}
export function invoiceTotals(invoices:Invoice[],payments:InvoicePayment[]){
 return invoices.filter(i=>!['draft','cancelled'].includes(i.status)).reduce((t,i)=>{
  const b=invoiceBalance(i,payments);
  t.total+=i.total_cents;
  t.received+=b.received;
  t.pending+=b.pending;
  if(b.status==='unverified'){
   t.unverifiedAmount+=b.pending;
  }else{
   t.confirmedPending+=b.pending;
   if(b.status==='overdue')t.overdue+=b.pending;
  }
  t.maxExposure=t.confirmedPending+t.unverifiedAmount;
  if(b.pending>0)t.count++;
  return t;
 },{total:0,received:0,pending:0,confirmedPending:0,unverifiedAmount:0,maxExposure:0,overdue:0,count:0});
}
export const invoiceMoney=(n:number,currency:string)=>new Intl.NumberFormat('es-ES',{style:'currency',currency}).format(n/100);

