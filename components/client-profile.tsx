'use client';
import {buildClientInsights,invoiceSettlement,daysBetween,type InsightsData} from '@/lib/client-insights';
import {invoiceBalance,invoiceMoney,invoiceStatuses} from '@/lib/invoices';
export const clientMetricColumns=[['score','Client Score'],['level','Nivel'],['importance','Importancia'],['jobs','Trabajos'],['revenue','Ventas'],['pending','Pendiente'],['averageDays','Pago medio'],['ease','Facilidad'],['last','Último evento'],['next','Próximo evento'],['profit','Beneficio'],['margin','Margen'],['invoiced','Facturado'],['paid','Cobrado']] as const;
export type ClientInsight=ReturnType<typeof buildClientInsights>[string];
export type ClientProfileFields={strategic_importance:number|null;ease_of_work:number|null;tax_id:string;billing_address:string;postal_code:string;province:string;country:string;billing_email:string;accounts_phone:string;accounts_contact:string;preferred_currency:string;payment_terms:string;po_required:boolean|null;po_process:string;billing_portal:string;billing_notes:string;bank_details?:string|null};
export function metricText(key:string,m:ClientInsight|undefined,currency:string){if(!m)return '—';const v=m[key as keyof ClientInsight];if(v===null||v===undefined||v==='')return key==='score'||key==='level'?'Sin datos':'—';if(['revenue','pending','profit','invoiced','paid','ticket','cost'].includes(key))return invoiceMoney(Number(v),currency);if(['averageDays','averageLate'].includes(key))return Number(v).toFixed(1)+' días';if(key==='margin')return Number(v).toFixed(1)+' %';return String(v)}
const date=(v:string|null)=>v?new Date(v.slice(0,10)+'T12:00:00').toLocaleDateString('es-ES'):'—';
export function ClientProfile({client,data,metrics,currency,disabled,save}:{client:ClientProfileFields&{id:string;company_name:string;company:string|null;city:string|null;fiscal_data:string|null;notes:string|null;contact_name?:string|null;phone?:string|null;email?:string|null;client_type?:string|null;bank_details?:string|null};data:InsightsData|undefined;metrics:ClientInsight|undefined;currency:string;disabled:boolean;save:(patch:Record<string,unknown>)=>Promise<unknown>}){
 const edit=(key:string,label:string,type='text')=><label key={key}>{label}<input key={String((client as unknown as Record<string,unknown>)[key])} type={type} defaultValue={String((client as unknown as Record<string,unknown>)[key]??'')} disabled={disabled} onBlur={e=>{const old=String((client as unknown as Record<string,unknown>)[key]??'');if(e.target.value!==old&&e.target.validity.valid)void save({[key]:e.target.value})}}/></label>;
 const invoices=data?.invoices.filter(i=>i.client_id===client.id&&i.currency===currency)||[],events=data?.events.filter(e=>e.client_id===client.id&&!e.deleted_at)||[];
 const hasVerificationFlag = (client.notes || '').includes('[NEEDS VERIFICATION]') || (client.tax_id || '').includes('NEEDS VERIFICATION') || (client.fiscal_data || '').includes('NEEDS VERIFICATION');

 return <section>
  <h3>Resumen del cliente · {currency}</h3>
  {hasVerificationFlag && (
   <div className="cb-error" style={{background:'#fffbe6',borderColor:'#ffe58f',color:'#d48806',padding:'12px',borderRadius:'8px',marginBottom:'14px'}}>
    <strong>⚠️ REQUERE VERIFICACIÓN DE TAX ID / CIF</strong>
    <p style={{margin:'4px 0 0',fontSize:'13px'}}>{client.notes || 'Comprobar validez fiscal del documento asignado.'}</p>
   </div>
  )}
  <div className="inv-summary">{[['score','Client Score'],['level','Nivel'],['jobs','Trabajos'],['revenue','Ventas por Trabajos'],['invoiced','Total Facturado'],['profit','Beneficio estimado'],['margin','Margen'],['paid','Cobrado'],['pending','Pendiente'],['ticket','Ticket medio'],['averageDays','Pago medio'],['last','Último evento'],['next','Próximo evento']].map(([key,label])=><div key={key}><small>{label}</small><strong>{metricText(key,metrics,currency)}</strong></div>)}</div>

  {metrics && (
   <div style={{background:'#f8fafc',border:'1px solid #cbd5e1',borderRadius:'10px',padding:'14px',margin:'14px 0'}}>
    <h4 style={{margin:'0 0 10px',fontSize:'14px',fontWeight:700,color:'#0f172a',display:'flex',alignItems:'center',gap:'8px'}}>
     ⚖️ COMPARACIÓN: TRABAJOS VS FACTURACIÓN
    </h4>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))',gap:'12px'}}>
     <div>
      <small style={{display:'block',color:'#64748b',fontSize:'12px',fontWeight:500}}>Importe de Trabajos / Eventos</small>
      <strong style={{fontSize:'16px',color:'#0f172a'}}>{metrics.eventsRevenue===null?'Por confirmar':invoiceMoney(metrics.eventsRevenue, currency)}</strong>
     </div>
     <div>
      <small style={{display:'block',color:'#64748b',fontSize:'12px',fontWeight:500}}>Importe Total Facturado</small>
      <strong style={{fontSize:'16px',color:'#2563eb'}}>{invoiceMoney(metrics.invoiced || 0, currency)}</strong>
     </div>
     <div>
      <small style={{display:'block',color:'#64748b',fontSize:'12px',fontWeight:500}}>Diferencia de Reconciliación</small>
      <strong style={{fontSize:'16px',color: metrics.reconciliationDiff === null ? '#64748b' : metrics.reconciliationDiff === 0 ? '#16a34a' : metrics.reconciliationDiff > 0 ? '#d97706' : '#2563eb'}}>
       {metrics.reconciliationDiff === null
        ? 'Por confirmar'
        : metrics.reconciliationDiff === 0
        ? '✓ Coincidencia exacta' 
        : metrics.reconciliationDiff > 0 
          ? `+${invoiceMoney(metrics.reconciliationDiff, currency)} por facturar` 
          : `${invoiceMoney(metrics.reconciliationDiff, currency)} mayor en facturas`}
      </strong>
     </div>
     <div>
      <small style={{display:'block',color:'#64748b',fontSize:'12px',fontWeight:500}}>Estado de Coincidencia</small>
      <span style={{
       display:'inline-block',marginTop:'3px',padding:'4px 10px',borderRadius:'12px',fontSize:'12px',fontWeight:600,
       background: metrics.reconciliationDiff === null ? '#f1f5f9' : metrics.reconciliationDiff === 0 ? '#dcfce7' : metrics.reconciliationDiff > 0 ? '#fef3c7' : '#e0f2fe',
       color: metrics.reconciliationDiff === null ? '#475569' : metrics.reconciliationDiff === 0 ? '#15803d' : metrics.reconciliationDiff > 0 ? '#b45309' : '#0369a1'
      }}>
       {metrics.reconciliationDiff === null ? '⚪ Datos de eventos pendientes' : metrics.reconciliationDiff === 0 ? '🟢 Cuentas cuadradas' : metrics.reconciliationDiff > 0 ? '🟡 Trabajos pendientes de facturar' : '🔵 Facturación superior a trabajos'}
      </span>
     </div>
    </div>
   </div>
  )}

  {metrics&&<><p>Cliente desde {date(metrics.first)} · Primera factura {invoices.length?date(invoices.map(i=>i.issue_date).sort()[0]):'—'} · Último pago {date(metrics.lastPayment)}</p>{metrics.overdueCount>0&&<p className="cb-error">{metrics.overdueCount} facturas vencidas · {invoiceMoney(metrics.overdue,currency)}</p>}{metrics.paymentScore===null?<p>Payment Score: datos insuficientes ({metrics.paymentSamples}/3 facturas pagadas o vencidas).</p>:<p>Payment Score: {metrics.paymentScore.toFixed(0)}/100 · Retraso medio {metrics.averageLate?.toFixed(1)} días.</p>}{metrics.profit===null&&<p>Beneficio y margen pendientes: faltan gastos confirmados o su asignación a eventos.</p>}<details><summary>Cómo se calcula la puntuación</summary><p>25% valor económico · 20% trabajos · 20% comportamiento de pago · 20% importancia · 15% facilidad. Las ventas representan el importe real de los trabajos contratados (o facturas si no hay eventos). Las facturas no se suman de forma duplicada sobre los trabajos.</p><p>Valor económico: {metrics.economic}/100 · Trabajos: {metrics.jobsScore}/100 · Importancia: {client.strategic_importance?client.strategic_importance*20:'Sin valorar'} · Facilidad: {client.ease_of_work?client.ease_of_work*20:'Sin valorar'}</p></details></>}

  <h3>🏢 Información de la Empresa</h3>
  <div className="crm-form-grid">
   {edit('company_name','Nombre comercial')}
   {edit('company','Razón social / Legal name')}
   {edit('tax_id','CIF / NIF / NIE / VAT / EIN')}
   {edit('client_type','Tipo de cliente')}
  </div>

  <h3>📍 Dirección Fiscal</h3>
  <div className="crm-form-grid">
   {edit('billing_address','Dirección fiscal')}
   {edit('postal_code','Código postal')}
   {edit('city','Ciudad')}
   {edit('province','Provincia / Estado')}
   {edit('country','País')}
  </div>

  <h3>📇 Información de Contacto y Datos Bancarios</h3>
  <div className="crm-form-grid">
   {edit('contact_name','Persona de contacto')}
   {edit('phone','Teléfono principal')}
   {edit('email','Email principal','email')}
   {edit('bank_details','Datos bancarios (IBAN / BIC / Cuenta)')}
   {edit('accounts_contact','Persona de administración')}
   {edit('accounts_phone','Teléfono de administración')}
   {edit('billing_email','Email de facturación','email')}
  </div>

  <h3>Valoración Interna</h3>
  <div className="crm-form-grid">{(['strategic_importance','ease_of_work'] as const).map(key=><label key={key} title={key==='strategic_importance'?'1 poco importante; 2 ocasional; 3 buen cliente; 4 importante; 5 estratégico':'1 muy complicado; 2 complicado; 3 normal; 4 fácil; 5 excelente'}>{key==='strategic_importance'?'Importancia estratégica':'Facilidad de trabajo'}<select disabled={disabled} value={client[key]??''} onChange={e=>void save({[key]:e.target.value?Number(e.target.value):null})}><option value="">Sin valorar</option>{[1,2,3,4,5].map(n=><option key={n} value={n}>{'★'.repeat(n)} · {n}</option>)}</select></label>)}</div>

  <label>Notas e información interna (Aliases, Marcas, Venues)<textarea key={client.notes} defaultValue={client.notes||''} disabled={disabled} rows={4} onBlur={e=>{if(e.target.value!==(client.notes||''))void save({notes:e.target.value})}}/></label>

  <details><summary>Condiciones de Facturación Adicionales</summary><div className="crm-form-grid"><label>Moneda habitual<input key={client.preferred_currency} maxLength={3} pattern="[A-Z]{3}" defaultValue={client.preferred_currency} disabled={disabled} onBlur={e=>{if(e.target.validity.valid&&e.target.value!==client.preferred_currency)void save({preferred_currency:e.target.value})}}/></label><label>Condiciones de pago<input key={client.payment_terms} defaultValue={client.payment_terms} list="client-payment-terms" disabled={disabled} onBlur={e=>{if(e.target.value!==client.payment_terms)void save({payment_terms:e.target.value})}}/><datalist id="client-payment-terms">{['Inmediato','7 días','15 días','30 días','45 días','60 días'].map(t=><option key={t}>{t}</option>)}</datalist></label><label>¿Necesita PO?<select value={client.po_required===null?'':String(client.po_required)} disabled={disabled} onChange={e=>void save({po_required:e.target.value===''?null:e.target.value==='true'})}><option value="">Sin confirmar</option><option value="true">Sí</option><option value="false">No</option></select></label>{edit('po_process','Número / procedimiento PO')}{edit('billing_portal','Portal de facturación','url')}{edit('billing_notes','Notas de facturación')}{edit('fiscal_data','Datos fiscales adicionales originales')}</div></details>

  <h3>Historial de trabajos</h3><div className="data-table-wrap"><table className="data-table"><thead><tr>{['Fecha','Evento','Venue','Shows','Venta','Gastos','Beneficio','Estado','Facturas / cobro'].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{events.sort((a,b)=>(b.event_date||'').localeCompare(a.event_date||'')).map(e=>{const m=metrics?.eventFinancials.find(f=>f.id===e.id);return <tr key={e.id}><td>{date(e.event_date)}</td><td><a href={`/?event=${e.id}#eventos`}>{e.event_name}</a></td><td>{e.venue}</td><td>{data?.showLinks.filter(l=>l.event_id===e.id).map(l=>data.shows.find(s=>s.id===l.show_id)?.name).filter(Boolean).join(', ')}</td><td>{m?.revenue!=null?invoiceMoney(m.revenue,currency):'—'}</td><td>{m?.cost!=null?invoiceMoney(m.cost,currency):'—'}</td><td>{m?.profit!=null?invoiceMoney(m.profit,currency):'—'}</td><td>{e.status}</td><td>{invoices.filter(i=>i.event_id===e.id).map(i=><p key={i.id}><a href={`/?invoice=${i.id}#facturas`}>{i.number}</a> · {invoiceStatuses[invoiceBalance(i,data!.payments).status]}</p>)}</td></tr>})}</tbody></table></div>
  <h3>Historial de facturas</h3><div className="data-table-wrap"><table className="data-table"><thead><tr>{['Nº','Fecha','Evento','Total','Vencimiento','Pagada el','Estado','Días en pagar','Pendiente'].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{invoices.map(i=>{const b=invoiceBalance(i,data!.payments),settled=invoiceSettlement(i,data!.payments);return <tr key={i.id}><td><a href={`/?invoice=${i.id}#facturas`}>{i.number}</a></td><td>{date(i.issue_date)}</td><td>{events.find(e=>e.id===i.event_id)?.event_name||'—'}</td><td>{invoiceMoney(i.total_cents,currency)}</td><td>{date(i.due_date)}</td><td>{date(settled)}</td><td>{invoiceStatuses[b.status]}</td><td>{settled&&i.issue_date?Math.max(0,daysBetween(i.issue_date,settled)):'—'}</td><td>{invoiceMoney(b.pending,currency)}</td></tr>})}</tbody></table></div></section>
}
