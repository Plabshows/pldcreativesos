'use client';
import {invoiceMoney,type CollectionEvidence} from '@/lib/invoices';
const issues:Record<string,string>={invoice_total_conflict:'Importe distinto al PDF',invoice_number_conflict:'Numeración por revisar',missing_invoice:'Sin factura identificada',invalid_collection_date:'Fecha de cobro inválida',client_review:'Cliente por confirmar'};
export function CollectionEvidenceList({rows,onlyReview=false}:{rows:CollectionEvidence[];onlyReview?:boolean}){
 const visible=onlyReview?rows.filter(r=>r.status==='review'):rows;
 if(!visible.length)return null;
 return <details className="bank-incident" open={onlyReview}><summary>{onlyReview?`${visible.length} registros del Excel por revisar`:'Origen de los cobros · Seguimiento Facturas'}</summary>
 {onlyReview&&<p>Estos registros conservan la información original y no se suman como facturas o cobros adicionales hasta resolver su relación.</p>}
 {visible.map(r=><article key={r.id}><h4>{r.invoice_number?'Referencia '+r.invoice_number:'Depósito sin número de factura'} · {r.source_data.client||r.source_data.concept||'Cliente por identificar'}</h4><p>{r.expected_cents===null?'Importe de factura desconocido':`Importe en Excel: ${invoiceMoney(r.expected_cents,'EUR')}`} · {r.declared_received_cents===null?'Cobro desconocido':`Cobro declarado: ${invoiceMoney(r.declared_received_cents,'EUR')}`}</p><p>{r.source_file} · {r.source_sheet} · fila {r.source_row}</p>{r.source_data.collection_date&&<p>Fecha de cobro en Excel: {r.source_data.collection_date}</p>}{r.source_data.notes&&<p>Notas originales: {r.source_data.notes}</p>}{r.issues.length>0&&<p className="bank-warning">{r.issues.map(i=>issues[i]||i).join(' · ')}</p>}{r.note&&<p>{r.note}</p>}{[...new Set([r.invoice_id,...r.candidate_invoice_ids].filter(Boolean))].map(id=><a key={id} href={`/?invoice=${id}#facturas`}>{r.status==='linked'?'Abrir factura relacionada':'Revisar factura existente'}</a>)}</article>)}
 {!onlyReview&&<p>Los cobros proceden del registro del Excel. No equivalen a una conciliación con un extracto bancario de ingresos.</p>}
 </details>;
}
