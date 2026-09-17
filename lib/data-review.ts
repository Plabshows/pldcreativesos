import {identityMatch,resolveIdentity,type Identity} from './identity';
export type ReviewRow={id:string;kind:string;confidence:string;title:string;detail:string;entity?:'talent'|'suppliers';primary?:string;duplicate?:string;href?:string};
type Row=Record<string,any>;
export function dataReview(data:Record<string,Row[]>){
 const rows:ReviewRow[]=[],artists=data.talent.filter(p=>!p.merged_into),suppliers=data.suppliers.filter(p=>!p.merged_into);
 for(const [entity,people] of [['talent',artists],['suppliers',suppliers]] as const){for(let i=0;i<people.length;i++)for(let j=i+1;j<people.length;j++){
  const a=people[i],b=people[j];if(a.deleted_at&&b.deleted_at)continue;
  const m=identityMatch(a as Identity,b as Identity);if(m.confidence==='low')continue;
  const primary=a.deleted_at?b:a,duplicate=a.deleted_at?a:b;
  rows.push({id:`${entity}:${a.id}:${b.id}`,kind:'duplicate',confidence:m.confidence,title:`Posible ${entity==='talent'?'artista':'proveedor'} duplicado: ${a.real_name||a.name} / ${b.real_name||b.name}`,detail:m.reasons.join(' · '),entity,primary:primary.id,duplicate:duplicate.id});
 }}
 for(const e of data.events.filter(e=>!e.deleted_at)){
  const names=(String(e.internal_notes||'').match(/^Artistas:\s*(.*)$/m)?.[1]||'').split(',').map(n=>n.trim()).filter(Boolean);
  for(const n of names){const m=resolveIdentity(artists as Identity[],n);if(!m.exact||!data.event_talent.some(a=>a.event_id===e.id&&a.talent_id===m.exact!.id))rows.push({id:`event-name:${e.id}:${n}`,kind:'event_artist',confidence:'medium',title:`Artista de evento sin relación: ${n}`,detail:e.event_name+' · '+(m.candidates.length?'Hay posibles fichas: revisar identidad':'No hay ficha identificada'),href:`/?event=${e.id}#eventos`});}
 }
 for(const e of data.expenses.filter(e=>e.status!=='cancelled')){
  if(String(e.notes||'').includes('[Revisión de relación]'))rows.push({id:'expense-relation:'+e.id,kind:'invoice_relation',confidence:'medium',title:`Relación de factura por confirmar: ${e.number}`,detail:String(e.notes).split('\n').filter(n=>n.startsWith('[Revisión de relación]')).join(' · '),href:`/?expense=${e.id}#facturas`});
  if(e.number&&!e.event_id&&!data.expense_artists.some(l=>l.expense_id===e.id))rows.push({id:'expense-event:'+e.id,kind:'invoice_event',confidence:'medium',title:`Factura sin evento: ${e.number}`,detail:e.supplier_name+' · '+e.concept,href:`/?expense=${e.id}#facturas`});
  if(e.number&&!e.talent_id&&!data.expense_artists.some(l=>l.expense_id===e.id))rows.push({id:'expense-artist:'+e.id,kind:'invoice_artist',confidence:'medium',title:`Factura sin artista / reparto: ${e.number}`,detail:e.supplier_name+' · '+e.concept,href:`/?expense=${e.id}#facturas`});
 }
 for(const invoice of data.invoices||[])if(!invoice.event_id&&invoice.status!=='cancelled')rows.push({id:'issued-event:'+invoice.id,kind:'invoice_event',confidence:'medium',title:'Factura emitida sin evento: '+invoice.number,detail:invoice.concept,href:`/?invoice=${invoice.id}#facturas`});
 for(const b of data.bank_movements){
  const hasArtist=b.talent_id||data.expense_payments.some(p=>p.bank_movement_id===b.id&&(data.expenses.some(e=>e.id===p.expense_id&&e.talent_id)||data.expense_artists.some(l=>l.expense_id===p.expense_id)));
  if(!hasArtist)rows.push({id:'bank-artist:'+b.id,kind:'payment_artist',confidence:'medium',title:`Pago sin artista identificado: ${b.original_reference||'Sin referencia'}`,detail:b.original_concept,href:`/?finance=bank&movement=${b.id}#facturas`});
  if(!data.expense_payments.some(p=>p.bank_movement_id===b.id))rows.push({id:'bank-invoice:'+b.id,kind:'payment_invoice',confidence:'medium',title:`Pago sin gasto / factura asignada: ${b.original_reference||'Sin referencia'}`,detail:b.original_concept,href:`/?finance=bank&movement=${b.id}#facturas`});
  for(const issue of b.issues||[])if(['duplicate','difference','identity_review','multiple_invoices','multiple_events'].includes(issue))rows.push({id:`bank-issue:${b.id}:${issue}`,kind:issue==='duplicate'?'payment_duplicate':issue,confidence:'medium',title:`${issue==='duplicate'?'Posible pago duplicado':issue==='difference'?'Diferencia de importe':'Relación por confirmar'}: ${b.original_reference}`,detail:b.resolution_note||b.original_concept,href:`/?finance=bank&movement=${b.id}#facturas`});
 }
 for(const p of artists.filter(a=>!a.deleted_at)){
  const notes=(p.identity_sources||[]).filter((s:Row)=>s.issues?.length).map((s:Row)=>s.issues.join(' · '));
  if(notes.length)rows.push({id:'identity-source:'+p.id,kind:'identity_conflict',confidence:'medium',title:'Datos de identidad por confirmar: '+p.real_name,detail:notes.join(' · '),href:`/?talent=${p.id}#pagos`});
 }
 return rows;
}
