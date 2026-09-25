'use client';
import {EventShowKit} from '@/components/event-show-kit';
import {FinanceOverview} from './finance-workspace';
import {InvoiceRelated} from './invoices-workspace';
import {CreatableEventSelect} from './creatable-event-select';
import {ChatGPTContextButton} from '@/components/chatgpt-context-button';
import {responseJson} from '@/lib/response-json';
import {useEffect,useState} from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import './client-board.css';
import './event-board.css';
import {FinanceSummary} from './finance-summary';
import {eventMoney,euros,type MoneyEvent} from '@/lib/event-money';
import {importedVenues} from '@/app/imported-venues';
type Event=MoneyEvent & {billing_type:'invoice'|'cash';invoice_number:string|null;id:string;event_code:string;event_name:string;event_date:string|null;client_id:string|null;city:string|null;venue:string|null;status:string;internal_notes:string|null;wardrobe_notes:string|null;requested_entertainment:string|null;board_position:number;deleted_at:string|null};
type Data={groups:{id:string;name:string}[];places:{kind:string;name:string}[];events:Event[];clients:{id:string;company_name:string}[];talent:{id:string;real_name:string;deleted_at?:string|null}[];shows:{id:string;name:string}[];assignments:{event_id:string;talent_id:string;agreed_cost_cents?:number|null;status?:string|null}[];showLinks:{event_id:string;show_id:string}[];suppliers?:{id:string;name:string}[];expenses?:{id:string;event_id:string|null;supplier_id?:string|null;supplier_name?:string;talent_id?:string|null;total_cents?:number|null;status?:string;concept?:string}[];payments?:{id:string;event_id:string;talent_id:string;status:string;amount_cents:number}[];inventoryConcepts?:{id:string;name:string;total_units:number;category:string;active?:boolean;unit_kind?:string}[];inventoryItems?:{id:string;concept_id:string;item_code:string;status:string;name?:string|null}[];inventoryAllocations?:{id:string;event_id:string;concept_id:string;inventory_item_id?:string|null;quantity:number;status:string;rental_revenue?:number|null}[];canEdit:boolean};
const labels:Record<string,string>={lead:'Contacto',proposal:'Propuesta',confirmed:'Confirmado',production:'Pendiente / En preparación',completed:'Completado',cancelled:'Cancelado'};
const todayInSpain=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const groupOf=(e:Event,today:string)=>e.status==='cancelled'?'Cancelados':e.status==='completed'||(e.event_date&&e.event_date<today)?'Completados':'En preparación';
const groups=['En preparación','Completados','Cancelados'];
const groupStatus:Record<string,string>={'Confirmado':'confirmed','En preparación':'production','Completado':'completed','Cancelado':'cancelled'};
const empty:Data={groups:[],places:[],events:[],clients:[],talent:[],shows:[],assignments:[],showLinks:[],suppliers:[],expenses:[],payments:[],inventoryConcepts:[],inventoryItems:[],inventoryAllocations:[],canEdit:false};

function Edit({value,type='text',disabled,label,save}:{value:string|null;type?:string;disabled:boolean;label:string;save:(v:string)=>void}){return <input key={value||''} type={type} aria-label={label} defaultValue={value||''} disabled={disabled} onBlur={e=>{if(e.target.value!==(value||''))save(e.target.value)}} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();if(e.key==='Escape'){e.stopPropagation();e.currentTarget.value=value||'';e.currentTarget.blur()}}}/>}
function calcEventCompleteness(e:Event,data:Data){
 const hasClient=Boolean(e.client_id),hasDate=Boolean(e.event_date),hasVenueOrCity=Boolean(e.venue||e.city),hasStatus=Boolean(e.status),hasShows=data.showLinks.some(a=>a.event_id===e.id)||Boolean(e.requested_entertainment),hasArtists=data.assignments.some(a=>a.event_id===e.id)||Boolean(e.internal_notes?.includes('[Sin artistas o alquiler]')),hasPrice=(e.income_cents??0)>0,hasCosts=(e.expenses_cents??0)>0||(e.other_expenses_cents??0)>0,hasInvoice=e.billing_type==='cash'||Boolean(e.invoice_number),hasPaid=e.client_paid===true;
 const checks=[{label:'Cliente',ok:hasClient,weight:15},{label:'Fecha',ok:hasDate,weight:15},{label:'Venue/Ciudad',ok:hasVenueOrCity,weight:10},{label:'Estado',ok:hasStatus,weight:5},{label:'Shows',ok:hasShows,weight:10},{label:'Artistas',ok:hasArtists,weight:10},{label:'Precio',ok:hasPrice,weight:10},{label:'Costes',ok:hasCosts,weight:10},{label:'Factura',ok:hasInvoice,weight:10},{label:'Cobro',ok:hasPaid,weight:5}];
 const score=checks.reduce((acc,c)=>acc+(c.ok?c.weight:0),0);
 const missing=checks.filter(c=>!c.ok).map(c=>c.label);
 return {score,missing,checks};
}

export function EventBoard({query='',onBack}:{query?:string;onBack:()=>void}){
 const [data,setData]=useState(empty),[error,setError]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[notice,setNotice]=useState('');
 const [search,setSearch]=useState(query),[view,setView]=useState('table'),[status,setStatus]=useState(''),[sort,setSort]=useState('date'),[hidden,setHidden]=useState<string[]>([]),[closed,setClosed]=useState<string[]>([]),[selected,setSelected]=useState<string[]>([]),[drag,setDrag]=useState<string|null>(null),[drawer,setDrawer]=useState<string|null>(null),[create,setCreate]=useState(false);
 const [today,setToday]=useState(todayInSpain);
 useEffect(()=>{const timer=setInterval(()=>setToday(todayInSpain()),60000);return()=>clearInterval(timer)},[]);
 const [month,setMonth]=useState(()=>new Date().toISOString().slice(0,7));
 async function load(){try{const r=await fetch('/api/event-board',{cache:'no-store'}),d=await responseJson(r);if(!r.ok)throw Error(d.error);setData(d);setError('');return true}catch(e){setError(String(e instanceof Error?e.message:e));return false}finally{setLoading(false)}}
 useEffect(()=>{void load();const fn=()=>void load();window.addEventListener('focus',fn);const timer=setInterval(()=>{if(document.visibilityState==='visible')void load()},15000);return()=>{clearInterval(timer);window.removeEventListener('focus',fn)}},[]);
 useEffect(()=>setSearch(query),[query]);
  useEffect(()=>{
   const checkUrl=()=>{
    if(loading)return;
    const url=new URL(window.location.href),id=url.searchParams.get('event');
    if(!id)return;
    if(data.events.some(e=>e.id===id)){
     setDrawer(id);
     url.searchParams.delete('event');
     window.history.replaceState(null,'',url);
    }
   };
   checkUrl();
   window.addEventListener('popstate',checkUrl);
   window.addEventListener('hashchange',checkUrl);
   return()=>{
    window.removeEventListener('popstate',checkUrl);
    window.removeEventListener('hashchange',checkUrl);
   };
  },[loading,data.events]);
 async function save(body:unknown){if(busy)return false;setBusy(true);setNotice('');try{const r=await fetch('/api/event-board',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),d=await responseJson(r);if(!r.ok)throw Error(d.error);if((d as any).requiresConfirmation){return d;}const ok=await load();if(ok)setNotice('Guardado en el espacio compartido');return ok}catch(e){setError(String(e instanceof Error?e.message:e));return false}finally{setBusy(false)}}
 const update=async(ids:string[],patch:Record<string,unknown>)=>{
  const ok=await save({action:'update',ids,patch});
  if(ok&&typeof patch.status==='string'){
   setStatus('');setSort('date');
   const destination=patch.status==='completed'?'Completados':patch.status==='cancelled'?'Cancelados':'Pendientes / En preparación';
   setClosed(c=>c.filter(g=>g!==destination));
   setNotice('Estado guardado. Los bloques se mantienen ordenados por fecha.');
  }
  return ok;
 };

 const removeArtistWithCheck = async (eventId: string, talentId: string, force = false) => {
  const res = await save({ action: 'relation', event_id: eventId, kind: 'talent', target: talentId, remove: true, forceRemove: force });
  if (res && (res as any).requiresConfirmation) {
   if (window.confirm((res as any).warning || 'Este artista tiene pagos. ¿Quitar manteniendo el histórico?')) {
    await save({ action: 'relation', event_id: eventId, kind: 'talent', target: talentId, remove: true, forceRemove: true });
   }
  }
 };

 const clientName=(id:string|null)=>data.clients.find(c=>c.id===id)?.company_name||'';
 const names=(e:Event,kind:'talent'|'shows')=>kind==='talent'?data.assignments.filter(a=>a.event_id===e.id).map(a=>data.talent.find(t=>t.id===a.talent_id)?.real_name).filter(Boolean).join(', '):data.showLinks.filter(a=>a.event_id===e.id).map(a=>data.shows.find(t=>t.id===a.show_id)?.name).filter(Boolean).join(', ');
 const blank=(e:Event)=>e.event_name==='Evento'&&!e.event_date&&!e.client_id&&!e.venue&&!e.internal_notes&&!e.requested_entertainment;
 const rows=data.events.filter(e=>Boolean(e.deleted_at)===(view==='archive')&&!blank(e)&&(!status||e.status===status)&&[e.event_name,clientName(e.client_id),e.city,e.venue,names(e,'talent'),names(e,'shows')].join(' ').toLowerCase().includes(search.toLowerCase())).sort((a,b)=>sort==='manual'?a.board_position-b.board_position:sort==='name'?a.event_name.localeCompare(b.event_name):(b.event_date||'').localeCompare(a.event_date||''));
 const current=data.events.find(e=>e.id===drawer),disabled=busy||!data.canEdit;
 const financeColumns=['INGRESO TOTAL','GASTOS','OTROS GASTOS','COSTE TOTAL','BENEFICIO BRUTO','MARGEN %','Nº FACTURA','PAGADO'];
 const columns=['SALUD','Fecha del evento','CLIENTES','SHOWS','ARTISTS & PROVIDERS','Localización / Venue',...financeColumns,'Ciudad','Estado'];
 const amountInput=(e:Event,key:'income_cents'|'expenses_cents'|'other_expenses_cents',label:string)=><input key={String(e[key])} type="number" min="0" max="1000000000" step="0.01" aria-label={label+' de '+e.event_name} defaultValue={e[key]===null?'':(e[key]??0)/100} disabled={disabled} onBlur={v=>{if(!v.target.validity.valid){v.target.reportValidity();return;}const cents=v.target.value===''?null:Math.round(Number(v.target.value)*100);if(cents!==e[key])void update([e.id],{[key]:cents})}}/>;
 const financeCell=(e:Event,c:string)=>{const m=eventMoney(e);switch(c){case 'INGRESO TOTAL':return amountInput(e,'income_cents',c);case 'GASTOS':return amountInput(e,'expenses_cents',c);case 'OTROS GASTOS':return amountInput(e,'other_expenses_cents',c);case 'COSTE TOTAL':return euros(m.cost);case 'BENEFICIO BRUTO':return euros(m.profit);case 'MARGEN %':return m.margin===null?'—':m.margin.toFixed(1)+' %';case 'PAGADO':return <button title="Cobro del cliente" className={'fin-paid '+(e.client_paid===true?'yes':e.client_paid===null?'unknown':'')} disabled={disabled} onClick={()=>void update([e.id],{client_paid:e.client_paid!==true})}>{e.client_paid===true?'Pagado':e.client_paid===false?'No pagado':'Sin confirmar'}</button>;case 'Nº FACTURA':return <span className="eb-billing-cell"><select title="Tipo de cobro" className={'eb-billing-type '+(e.billing_type==='cash'?'cash':'')} disabled={disabled} value={e.billing_type||'invoice'} onChange={ev=>{const next=ev.target.value as 'invoice'|'cash';if(next==='cash'&&e.invoice_number&&e.invoice_number.trim()){if(!window.confirm('Este evento tiene nº de factura «'+e.invoice_number+'». ¿Cambiar a Cash? El número se conservará como referencia.'))return;}void update([e.id],{billing_type:next})}}><option value="invoice">Factura</option><option value="cash">Cash</option></select>{e.billing_type==='cash'?<span className="eb-cash-badge">💵 CASH</span>:<Edit label={'Factura de '+e.event_name} value={e.invoice_number} disabled={disabled} save={v=>void update([e.id],{invoice_number:v})}/>}</span>;}};
 const relationPicker=(e:Event,kind:'talent'|'shows')=>{const options=kind==='talent'?data.talent.map(t=>({id:t.id,name:t.real_name})):data.shows;const linked=kind==='talent'?data.assignments.filter(a=>a.event_id===e.id).map(a=>a.talent_id):data.showLinks.filter(a=>a.event_id===e.id).map(a=>a.show_id);const isNoArtists=kind==='talent'&&e.internal_notes?.includes('[Sin artistas o alquiler]');return <div className="eb-relations">{isNoArtists&&<span style={{background:'#fde68a'}}>🚫 Sin artistas o alquiler<button disabled={disabled} aria-label="Quitar sin artistas" onClick={()=>void update([e.id],{internal_notes:e.internal_notes?.replace('[Sin artistas o alquiler]','').trim()})}>×</button></span>}{options.filter(o=>linked.includes(o.id)).map(o=><span key={o.id}>{o.name}<button disabled={disabled} aria-label={'Desvincular '+o.name} onClick={()=>kind==='talent'?void removeArtistWithCheck(e.id,o.id):void save({action:'relation',event_id:e.id,kind,target:o.id,remove:true})}>×</button></span>)}<div style={{width:'100%',display:'flex',flexDirection:'column',gap:'8px'}}><CreatableEventSelect kind={kind} label={kind==='talent'?'+ Añadir artista':'+ Añadir show'} value="" disabled={disabled} options={[...(kind==='talent'&&!isNoArtists?[{value:'no-artists',label:'🚫 Sin artistas o alquiler'}]:[]),...options.filter(o=>!linked.includes(o.id)&&(kind!=='talent'||!data.talent.find(t=>t.id===o.id)?.deleted_at)).map(o=>({value:o.id,label:o.name}))]} onCreated={load} onChange={target=>{if(target==='no-artists'){void update([e.id],{internal_notes:((e.internal_notes||'')+' [Sin artistas o alquiler]').trim()})}else if(target){void save({action:'relation',event_id:e.id,kind,target,remove:false})}}}/></div></div>};
 const cityNames=Array.from(new Set([...data.places.filter(p=>p.kind==='city').map(p=>p.name),...data.events.map(e=>e.city).filter((v):v is string=>Boolean(v))])).sort((a,b)=>a.localeCompare(b,'es'));

 const venueNames=Array.from(new Map([...data.places.filter(p=>p.kind==='venue').map(p=>p.name),...importedVenues.map(v=>v.name),...data.events.map(e=>e.venue).filter((v):v is string=>Boolean(v))].map(v=>[v.trim().toLocaleLowerCase('es'),v])).values()).sort((a,b)=>a.localeCompare(b,'es'));
 const optionSelect=(kind:'client'|'city'|'venue',e?:Event)=><CreatableEventSelect kind={kind} name={kind} label={kind==='client'?'Sin cliente':kind==='city'?'Sin ciudad':'Sin localización'} value={e?(kind==='client'?e.client_id:e[kind])||'':undefined} disabled={disabled} groups={data.groups} options={kind==='client'?data.clients.map(c=>({value:c.id,label:c.company_name})):(kind==='city'?cityNames:venueNames).map(v=>({value:v,label:v}))} onCreated={load} onChange={e?v=>{void update([e.id],{[kind==='client'?'client_id':kind]:v||(kind==='client'?null:'')})}:undefined}/>;
 const citySelect=(e:Event)=>optionSelect('city',e);
 const venueSelect=(e:Event)=>optionSelect('venue',e);
 const clientSelect=(e:Event)=>optionSelect('client',e);

 const renderArtistTable=(e:Event)=>{
  const assigned = data.assignments.filter(a=>a.event_id===e.id);
  const totalCents = assigned.reduce((sum,a)=>sum+Number(a.agreed_cost_cents||0),0);
  return (
   <div className="eb-artists-table-wrap" style={{marginTop:'14px',background:'#f0f7ff',padding:'14px',borderRadius:'10px',border:'1px solid #bfdbfe',boxShadow:'0 1px 3px rgba(0,0,0,0.05)'}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'10px',flexWrap:'wrap',gap:'8px'}}>
     <strong style={{fontSize:'14px',color:'#1e3a8a',display:'flex',alignItems:'center',gap:'6px'}}>
      <span style={{fontSize:'16px'}}>💰</span> SUELDOS Y CACHÉS DE ARTISTAS ({assigned.length})
     </strong>
     <span style={{fontSize:'13px',fontWeight:700,background:'#dbeafe',color:'#1e40af',padding:'4px 10px',borderRadius:'12px',border:'1px solid #93c5fd'}}>
      Total Cachés: {(totalCents/100).toLocaleString('es-ES', {minimumFractionDigits: 2, maximumFractionDigits: 2})} €
     </span>
    </div>
    {assigned.length===0?(
     <div style={{background:'#ffffff',border:'1px dashed #93c5fd',borderRadius:'8px',padding:'16px',textAlign:'center',margin:'6px 0'}}>
      <p style={{fontSize:'13px',fontWeight:600,color:'#1e40af',margin:'0 0 4px'}}>
       💶 Asigna artistas y define sus sueldos
      </p>
      <p style={{fontSize:'12px',color:'#4b5563',margin:0,lineHeight:'1.4'}}>
       Usa el buscador <strong>"+ Añadir artista"</strong> de arriba para vincular integrantes a este evento. Al añadirlos, aparecerá inmediatamente la casilla para indicar el sueldo o caché en euros (€) de cada uno.
      </p>
     </div>
    ):(
     <table className="eb-artists-table" style={{width:'100%',borderCollapse:'collapse',fontSize:'13px',background:'#ffffff',borderRadius:'6px',overflow:'hidden'}}>
      <thead>
       <tr style={{borderBottom:'2px solid #e5e7eb',textAlign:'left',color:'#4b5563',background:'#f8fafc'}}>
        <th style={{padding:'8px 10px'}}>Artista / Integrante</th>
        <th style={{padding:'8px 10px'}}>Sueldo / Fee (€)</th>
        <th style={{padding:'8px 10px'}}>Estado de Pago</th>
        <th style={{padding:'8px 10px',textAlign:'right'}}>Acción</th>
       </tr>
      </thead>
      <tbody>
       {assigned.map(a=>{
        const t = data.talent.find(x=>x.id===a.talent_id);
        const fee = a.agreed_cost_cents != null ? (a.agreed_cost_cents/100) : '';
        const pay = (data.payments || []).find(p => p.event_id === e.id && p.talent_id === a.talent_id);
        const st = pay?.status || 'pending';

        const saveFee = (valStr: string) => {
         const raw = valStr.replace(',', '.');
         const val = raw === '' ? null : Math.round(Number(raw) * 100);
         if (Number.isNaN(val)) return;
         if (val !== (a.agreed_cost_cents ?? null)) {
          void save({ action: 'artistFee', event_id: e.id, talent_id: a.talent_id, fee_cents: val });
         }
        };

        return (
         <tr key={a.talent_id} style={{borderBottom:'1px solid #f1f5f9'}}>
          <td style={{padding:'8px 10px'}}>
           <b style={{color:'#0f172a'}}>{t?.real_name || 'Artista'}</b>
          </td>
           <td style={{padding:'8px 10px'}}>
            <form style={{display:'inline-flex',alignItems:'center',gap:'6px'}} onSubmit={evt=>{
              evt.preventDefault();
              const formData = new FormData(evt.currentTarget);
              saveFee(String(formData.get('fee') ?? ''));
            }}>
             <input
              name="fee"
              key={`${a.talent_id}-${a.agreed_cost_cents ?? 'none'}`}
              type="number" min="0" step="0.01" placeholder="Ej: 250.00"
              defaultValue={fee} disabled={disabled}
              aria-label={`Sueldo en euros para ${t?.real_name || 'artista'}`}
              style={{width:'110px',padding:'6px 8px',border:'1px solid #cbd5e1',borderRadius:'6px',fontSize:'13px',fontWeight:600,color:'#0f172a',background:'#ffffff'}}
              onBlur={evt => saveFee(evt.target.value)}
              onKeyDown={evt => {
               if (evt.key === 'Enter') {
                evt.preventDefault();
                saveFee(evt.currentTarget.value);
                evt.currentTarget.blur();
               }
              }}
             />
             <span style={{fontWeight:600,color:'#64748b'}}>€</span>
             <button type="submit" className="secondary-button" style={{padding:'6px 10px', fontSize:'12px', marginLeft: '4px'}} disabled={disabled}>Guardar</button>
            </form>
           </td>
          <td style={{padding:'8px 10px'}}>
           <select
            value={st} disabled={disabled}
            style={{padding:'6px 8px',border:'1px solid #cbd5e1',borderRadius:'6px',fontSize:'12px',fontWeight:500,color:st==='paid'?'#15803d':'#b45309',background:st==='paid'?'#f0fdf4':'#fffbeb'}}
            onChange={evt=>{
             const currentFee = a.agreed_cost_cents == null ? null : Number(a.agreed_cost_cents);
             void save({action:'artistFee',event_id:e.id,talent_id:a.talent_id,fee_cents:currentFee,status:evt.target.value});
            }}
           >
            <option value="pending">⏳ Pendiente</option>
            <option value="paid">✓ Pagado</option>
           </select>
          </td>
          <td style={{padding:'8px 10px',textAlign:'right'}}>
           <button
            disabled={disabled} style={{border:0,background:'none',color:'#ef4444',cursor:'pointer',fontSize:'12px',fontWeight:500}}
            onClick={()=>void removeArtistWithCheck(e.id,a.talent_id)}
           >
            Quitar
           </button>
          </td>
         </tr>
        );
       })}
      </tbody>
     </table>
    )}
   </div>
  );
 };

 const renderProviderTable=(e:Event)=>{
  const eventExpenses = (data.expenses||[]).filter(x=>x.event_id===e.id);
  const totalCents = eventExpenses.reduce((sum,x)=>sum+Number(x.total_cents||0),0);
  return (
   <div className="eb-providers-table-wrap" style={{marginTop:'12px',background:'#f9fafb',padding:'12px',borderRadius:'8px',border:'1px solid #e5e7eb'}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'8px'}}>
     <strong style={{fontSize:'13px',color:'#374151'}}>Proveedores y Otros Gastos ({eventExpenses.length})</strong>
     <span style={{fontSize:'13px',fontWeight:700,color:'#d97706'}}>Coste proveedores: {(totalCents/100).toLocaleString('es-ES')} €</span>
    </div>
    {eventExpenses.length>0&&(
     <table style={{width:'100%',borderCollapse:'collapse',fontSize:'13px',marginBottom:'8px'}}>
      <thead>
       <tr style={{borderBottom:'1px solid #e5e7eb',textAlign:'left',color:'#6b7280'}}>
        <th style={{padding:'6px 8px'}}>Proveedor / Descripción</th>
        <th style={{padding:'6px 8px'}}>Importe €</th>
        <th style={{padding:'6px 8px'}}>Control</th>
        <th style={{padding:'6px 8px',textAlign:'right'}}>Acción</th>
       </tr>
      </thead>
      <tbody>
       {eventExpenses.map(x=>{
        const supp = data.suppliers?.find(s=>s.id===x.supplier_id);
        const name = supp?.name || x.supplier_name || x.concept || 'Proveedor';
        const amt = x.total_cents===null ? '' : (x.total_cents||0)/100;
        return (
         <tr key={x.id} style={{borderBottom:'1px solid #f3f4f6'}}>
          <td style={{padding:'6px 8px'}}><b>{name}</b></td>
          <td style={{padding:'6px 8px'}}>
           <input
            type="number" min="0" step="0.01" placeholder="0.00"
            defaultValue={amt} disabled={disabled}
            style={{width:'90px',padding:'4px 6px',border:'1px solid #d1d5db',borderRadius:'4px'}}
            onBlur={evt=>{
             const val = evt.target.value===''?null:Math.round(Number(evt.target.value)*100);
             if(val!==x.total_cents){
              void save({action:'providerExpense',event_id:e.id,expense_id:x.id,amount_cents:val});
             }
            }}
           /> €
          </td>
          <td style={{padding:'6px 8px'}}>
           <a href={'/?expense='+x.id+'#facturas'}>Abrir gasto</a>
          </td>
          <td style={{padding:'6px 8px',textAlign:'right'}}>
           <button
            disabled={disabled} style={{border:0,background:'none',color:'#ef4444',cursor:'pointer',fontSize:'12px'}}
            onClick={()=>void save({action:'providerExpense',event_id:e.id,expense_id:x.id,remove:true})}
           >
            Quitar
           </button>
          </td>
         </tr>
        );
       })}
      </tbody>
     </table>
    )}
    <button
     disabled={disabled}
     style={{padding:'6px 10px',borderRadius:'4px',border:'1px dashed #d1d5db',background:'#fff',cursor:'pointer',fontSize:'12px'}}
     onClick={()=>{
      const name = window.prompt('Nombre del proveedor o servicio (ej: Fedriani, Transporte, Técnico)');
      if(!name?.trim()) return;
      const amountStr = window.prompt('Importe € (opcional)');
      const amountCents = amountStr?.trim() ? Math.round(Number(amountStr)*100) : null;
      if(amountCents!==null&&!Number.isFinite(amountCents)){window.alert('Indica un importe válido.');return;}
      void save({action:'providerExpense',event_id:e.id,supplier_name:name.trim(),amount_cents:amountCents});
     }}
    >
     + Añadir gasto de proveedor
    </button>
   </div>
  );
 };

 const renderMaterialTable=(e:Event)=>{
  const allocations = (data.inventoryAllocations || []).filter(a=>a.event_id===e.id);
  const concepts = data.inventoryConcepts || [];
  const items = data.inventoryItems || [];

  // Conflict check for event date
  const conflicts: string[] = [];
  allocations.filter(a => ['RESERVED','OUT'].includes(a.status)).forEach(alloc => {
   const concept = concepts.find(c => c.id === alloc.concept_id);
   if (!concept) return;
   const availCount = items.filter(i => i.concept_id === alloc.concept_id && ['AVAILABLE', 'RESERVED'].includes(i.status)).length;
   let totalNeeded = alloc.quantity;
   if (e.event_date) {
    const sameDateEvents = data.events.filter(x => x.event_date === e.event_date && !x.deleted_at).map(x => x.id);
    const dateAllocations = (data.inventoryAllocations || []).filter(a => a.concept_id === alloc.concept_id && sameDateEvents.includes(a.event_id) && ['RESERVED','OUT'].includes(a.status));
    totalNeeded = dateAllocations.reduce((sum, a) => sum + (a.quantity || 1), 0);
   }
   if (totalNeeded > availCount) {
    conflicts.push(`⚠ ALERTA DE CONFLICTO: ${concept.name} (${availCount} disponibles / ${totalNeeded} necesarias${e.event_date ? ' para el ' + e.event_date : ''})`);
   }
  });

  return (
   <div style={{marginTop:'14px',background:'#fcf5ff',padding:'14px',borderRadius:'10px',border:'1px solid #e9d5ff',boxShadow:'0 1px 3px rgba(0,0,0,0.05)'}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'10px',flexWrap:'wrap',gap:'8px'}}>
     <strong style={{fontSize:'14px',color:'#6b21a8',display:'flex',alignItems:'center',gap:'6px'}}>
      <span style={{fontSize:'16px'}}>📦</span> MATERIAL / VESTUARIO Y PROPS ({allocations.length})
     </strong>
    </div>

    {conflicts.map((msg, idx) => (
     <div key={idx} style={{background:'#fef2f2',border:'1px solid #fca5a5',color:'#991b1b',borderRadius:'6px',padding:'8px 10px',fontSize:'12px',fontWeight:700,marginBottom:'10px'}}>
      {msg}
     </div>
    ))}

    {allocations.length === 0 ? (
     <div style={{background:'#ffffff',border:'1px dashed #c084fc',borderRadius:'8px',padding:'12px',textAlign:'center',margin:'6px 0'}}>
      <p style={{fontSize: '12px', color: '#6b21a8', margin: 0}}>
       No hay vestuario ni material asignado a este evento aún. Usa el botón inferior para asignar piezas de inventario.
      </p>
     </div>
    ) : (
     <table style={{width:'100%',borderCollapse:'collapse',fontSize:'12px',background:'#ffffff',borderRadius:'6px',overflow:'hidden',marginBottom:'10px'}}>
      <thead>
       <tr style={{borderBottom:'1px solid #e5e7eb',textAlign:'left',color:'#6b7280',background:'#faf5ff'}}>
        <th style={{padding:'6px 8px'}}>Concepto</th>
        <th style={{padding:'6px 8px'}}>Cantidad</th>
        <th style={{padding:'6px 8px'}}>Estado Material</th>
        <th style={{padding:'6px 8px'}}>Alquiler Explicit (€)</th>
        <th style={{padding:'6px 8px',textAlign:'right'}}>Acción</th>
       </tr>
      </thead>
      <tbody>
       {allocations.map(a => {
        const concept = concepts.find(c => c.id === a.concept_id);
        return (
         <tr key={a.id} style={{borderBottom:'1px solid #f3f4f6'}}>
          <td style={{padding:'6px 8px'}}><b>{concept?.name || 'Material'}</b><br/>{items.find(i=>i.id===a.inventory_item_id)?.name || items.find(i=>i.id===a.inventory_item_id)?.item_code}</td>
          <td style={{padding:'6px 8px'}}>{a.quantity} un.</td>
          <td style={{padding:'6px 8px'}}>
           <select aria-label="Estado del material" value={a.status} disabled={disabled || ['RETURNED','CANCELLED'].includes(a.status)} onChange={async evt=>{
            setBusy(true);
            try {
             const res=await fetch('/api/inventory',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'allocateToEvent',allocation:{...a,status:evt.target.value}})});
             const d=await responseJson(res);if(!res.ok)throw Error(d.error || 'No se pudo cambiar el estado');
             await load();
            } catch(err){setError(err instanceof Error?err.message:'Error de material');}finally{setBusy(false);}
           }}><option value="RESERVED">Reservado</option><option value="OUT">En evento / fuera</option><option value="RETURNED">Devuelto</option><option value="CANCELLED">Cancelado</option></select>
          </td>
          <td style={{padding:'6px 8px'}}>{a.rental_revenue == null ? 'Pendiente' : `${a.rental_revenue / 100} €`}</td>
          <td style={{padding:'6px 8px',textAlign:'right'}}>
           <button disabled={disabled || ['RETURNED','CANCELLED'].includes(a.status)} style={{border:0,background:'none',color:'#ef4444',cursor:'pointer',fontSize:'12px'}} onClick={async()=>{
            setBusy(true);
            try {
             const r=await fetch('/api/inventory', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({action:'deleteAllocation', id:a.id})});
             const d=await responseJson(r);if(!r.ok)throw Error(d.error || 'No se pudo cancelar');
             await load();
            }catch(err){setError(err instanceof Error?err.message:'Error al cancelar');}finally{setBusy(false);}
           }}>Cancelar reserva</button>
          </td>
         </tr>
        );
       })}
      </tbody>
     </table>
    )}

    <form style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'end'}} onSubmit={async evt=>{
     evt.preventDefault(); if(busy)return;
     const form=evt.currentTarget, fields=new FormData(form);
     setBusy(true);
     try {
      const revenue=String(fields.get('rental_revenue') || '').trim();
      const res=await fetch('/api/inventory',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
       action:'allocateToEvent',allocation:{event_id:e.id,concept_id:fields.get('concept_id'),quantity:Number(fields.get('quantity')),
       rental_revenue:revenue ? Math.round(Number(revenue.replace(',','.'))*100) : null}
      })});
      const d=await responseJson(res);if(!res.ok)throw Error(d.error || 'No se pudo reservar');
      await load();form.reset();
     }catch(err){setError(err instanceof Error?err.message:'Error al reservar');}finally{setBusy(false);}
    }}>
     <label>Artículo<select name="concept_id" required disabled={disabled}><option value="">Seleccionar material…</option>{concepts.filter(c=>c.active!==false).map(c=><option key={c.id} value={c.id}>{c.name} · {items.filter(i=>i.concept_id===c.id && i.status==='AVAILABLE').length} {c.unit_kind==='set'?'sets':'piezas'} disponibles</option>)}</select></label>
     <label>Cantidad<input name="quantity" type="number" min="1" step="1" defaultValue="1" required style={{width:75}} disabled={disabled}/></label>
     <label>Alquiler total asignado (€)<input name="rental_revenue" type="number" min="0" step="0.01" placeholder="Pendiente" disabled={disabled}/></label>
     <button className="cb-primary" disabled={disabled || ['completed','cancelled'].includes(e.status)}>Reservar material</button>
     <small>Se reservan piezas concretas hasta su devolución. Al completar el evento se liberan, salvo incidencias. Este importe no registra un cobro.</small>
    </form>
   </div>
  );
 };

 return <section className="cb-board eb-board"><header className="cb-title"><div><p>PERFORMANCE LAB / PRODUCCIÓN</p><h1>EVENTOS</h1><span>{rows.length} eventos · espacio compartido</span></div><button onClick={onBack}>Volver a Mi día</button></header><FinanceSummary events={data.events}/><div className="cb-tabs">{[['table','Tabla principal'],['calendar','Calendario de Eventos'],['archive','Archivados']].map(([key,title])=><button key={key} className={view===key?'active':''} onClick={()=>{setView(key);setSelected([])}}>{title}</button>)}</div><div className="cb-toolbar"><button className="cb-primary" disabled={disabled} onClick={()=>setCreate(true)}>+ Agregar evento</button><label className="cb-search"><input aria-label="Buscar eventos" placeholder="Buscar / filtrar tablero" value={search} onChange={e=>setSearch(e.target.value)}/></label><select aria-label="Filtrar estado" value={status} onChange={e=>setStatus(e.target.value)}><option value="">Todos los estados</option>{Object.entries(labels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select><select aria-label="Ordenar eventos" value={sort} onChange={e=>setSort(e.target.value)}><option value="date">Más recientes primero</option><option value="name">Nombre A–Z</option></select><details className="cb-columns"><summary>Columnas</summary><div>{columns.map(c=><label key={c}><input type="checkbox" checked={!hidden.includes(c)} onChange={()=>setHidden(h=>h.includes(c)?h.filter(x=>x!==c):[...h,c])}/>{c}</label>)}</div></details><button disabled={busy} onClick={()=>void load()}>Actualizar</button></div><p className="cb-feedback" aria-live="polite">{busy?'Guardando…':notice||'Hoy y próximos eventos en preparación; fechas anteriores a hoy en completados. Cancelados al final. Más recientes primero.'}</p>{error&&<p role="alert" className="cb-error">{error}</p>}
 {selected.length>0&&<div className="cb-bulk"><b>{selected.length} seleccionados</b><select aria-label="Cambiar estado de eventos seleccionados" disabled={disabled} value="" onChange={async e=>{if(await update(selected,{status:e.target.value}))setSelected([])}}><option value="">Cambiar estado…</option>{Object.entries(labels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select><button disabled={disabled} onClick={async()=>{if(await save({action:'duplicate',ids:selected})){setSelected([]);setNotice('Evento duplicado correctamente.')}}}>Duplicar</button><button disabled={disabled} onClick={async()=>{if(await update(selected,{deleted_at:view==='archive'?null:new Date().toISOString()}))setSelected([])}}>{view==='archive'?'Restaurar':'Archivar'}</button><button onClick={()=>setSelected([])}>Cancelar</button></div>}
 {loading ? (
  <p>Cargando tus eventos…</p>
 ) : view === 'calendar' ? (
  <>
   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
    <label className="eb-month" style={{ margin: 0 }}>
     Mes <input aria-label="Mes del calendario" type="month" value={month} onChange={e => setMonth(e.target.value)} />
    </label>
    <div className="eb-calendar-legend">
     <div className="eb-calendar-legend-item" style={{ background: '#f0fdf4', borderColor: '#bbf7d0', color: '#15803d' }}>
      🟢 Cobrado / Pagado
     </div>
     <div className="eb-calendar-legend-item" style={{ background: '#fef2f2', borderColor: '#fecaca', color: '#b91c1c' }}>
      🔴 Pendiente de cobro
     </div>
     <div className="eb-calendar-legend-item" style={{ background: '#eff6ff', borderColor: '#bfdbfe', color: '#1d4ed8' }}>
      🔵 Sin confirmar
     </div>
    </div>
   </div>
   <div className="eb-calendar">
    {Array.from({ length: new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate() }, (_, i) => {
     const day = month + '-' + String(i + 1).padStart(2, '0');
     return (
      <section key={day}>
       <b>{new Date(day + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' })}</b>
       {rows.filter(e => e.event_date === day).map(e => {
        const paidClass = e.client_paid === true ? 'eb-paid-yes' : e.client_paid === false ? 'eb-paid-no' : 'eb-paid-unknown';
        const paidLabel = e.client_paid === true ? '🟢 Pagado' : e.client_paid === false ? '🔴 Pendiente' : '🔵 Sin confirmar';
        return (
         <button key={e.id} className={paidClass} onClick={() => setDrawer(e.id)}>
          <strong>{e.event_name}</strong>
          <small>{clientName(e.client_id)} · {labels[e.status]}</small>
          <span className="eb-paid-badge">{paidLabel}</span>
         </button>
        );
       })}
      </section>
     );
    })}
   </div>
   <p>{rows.filter(e => !e.event_date).length} eventos sin fecha: disponibles en la tabla principal.</p>
  </>
 ) : (
  groups.map((g, gi) => {
   const members = rows.filter(e => groupOf(e, today) === g);
   const colorMap = ['#fdab3d', '#00a86b', '#8793a5'];
   return (
    <section className="cb-group" key={g} style={{ ['--group-color' as any]: colorMap[gi] }}>
     <header>
      <button className="cb-group-name" aria-expanded={!closed.includes(g)} onClick={() => setClosed(c => c.includes(g) ? c.filter(x => x !== g) : [...c, g])}>
       <h2>{closed.includes(g) ? '›' : '⌄'} {g}</h2>
       <span>{members.length}</span>
      </button>
     </header>
     {!closed.includes(g) && (
      <div className="cb-table-scroll">
       <table>
        <thead>
         <tr>
          <th>
           <input type="checkbox" aria-label={'Seleccionar ' + g} disabled={disabled || !members.length} checked={members.length > 0 && members.every(e => selected.includes(e.id))} onChange={v => setSelected(s => v.target.checked ? [...new Set([...s, ...members.map(e => e.id)])] : s.filter(id => !members.some(e => e.id === id)))} />
          </th>
          <th>EVENTO</th>
          {columns.filter(c => !hidden.includes(c)).map(c => <th key={c}>{c}</th>)}
         </tr>
        </thead>
        <tbody>
         {members.map((e, i) => {
          const comp = calcEventCompleteness(e, data);
          return (
           <tr key={e.id} draggable={false} onDragStart={() => setDrag(e.id)} onDragEnd={() => setDrag(null)} onDrop={v => { if (sort === 'manual' && drag && drag !== e.id) { v.preventDefault(); v.stopPropagation(); void update([drag], { status: groupStatus[g], board_position: ((members[i - 1]?.board_position ?? e.board_position - 2000) + e.board_position) / 2 }); setDrag(null); } }}>
            <td>
             <input aria-label={'Seleccionar ' + e.event_name} type="checkbox" disabled={disabled} checked={selected.includes(e.id)} onChange={v => setSelected(s => v.target.checked ? [...s, e.id] : s.filter(x => x !== e.id))} />
            </td>
            <td className="cb-name-cell">
             <button onClick={() => setDrawer(e.id)}>{e.event_name}</button>
            </td>
            {!hidden.includes("SALUD") && (
             <td>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 6px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, background: comp.score >= 80 ? 'rgba(0,168,107,0.15)' : comp.score >= 50 ? 'rgba(253,171,61,0.15)' : 'rgba(235,87,87,0.15)', color: comp.score >= 80 ? '#00a86b' : comp.score >= 50 ? '#d97706' : '#eb5757' }} title={comp.missing.length ? 'Pendiente: ' + comp.missing.join(', ') : 'Completado'}>
               {comp.score}%
              </span>
             </td>
            )}
            {!hidden.includes("Fecha del evento") && <td><Edit type="date" label={'Fecha de ' + e.event_name} value={e.event_date} disabled={disabled} save={v => void update([e.id], { event_date: v || null })} /></td>}
            {!hidden.includes("CLIENTES") && <td>{clientSelect(e)}</td>}
            {!hidden.includes("SHOWS") && <td><button className="eb-link" onClick={() => setDrawer(e.id)}>{names(e, 'shows') || e.requested_entertainment || '+ Vincular shows'}</button></td>}
            {!hidden.includes("ARTISTS & PROVIDERS") && <td><button className="eb-link" onClick={() => setDrawer(e.id)}>{e.internal_notes?.includes('[Sin artistas o alquiler]') ? '🚫 Sin artistas / Alquiler' : (names(e, 'talent') || '+ Vincular artistas y sueldos')}</button></td>}
            {!hidden.includes("Localización / Venue") && <td>{venueSelect(e)}</td>}
            {financeColumns.filter(c => !hidden.includes(c)).map(c => <td key={c}>{financeCell(e, c)}</td>)}
            {!hidden.includes("Ciudad") && <td>{citySelect(e)}</td>}
            {!hidden.includes("Estado") && (
             <td>
              <select aria-label={'Estado de ' + e.event_name} disabled={disabled} value={e.status} onChange={v => void update([e.id], { status: v.target.value })}>
               {Object.entries(labels).map(([k, v]) => <option value={k} key={k}>{v}</option>)}
              </select>
             </td>
            )}
           </tr>
          );
         })}
        </tbody>
       </table>
       {!members.length && <p className="cb-empty">No hay eventos en este grupo.</p>}
      </div>
     )}
    </section>
   );
  })
 )}
 <Dialog.Root open={!!current} onOpenChange={v=>{if(!v)setDrawer(null)}}><Dialog.Portal><Dialog.Overlay className="cb-overlay"/><Dialog.Content className="cb-drawer"><Dialog.Title>{current?.event_name}</Dialog.Title><Dialog.Description>Evento conectado con tus bases de datos.</Dialog.Description><Dialog.Close className="cb-close">Cerrar</Dialog.Close>{error&&<p role="alert" className="cb-error">{error}</p>}<p aria-live="polite">{busy?'Guardando…':notice}</p>{current&&(()=> { const comp=calcEventCompleteness(current,data); return <><div style={{background:comp.score>=80?'rgba(0,168,107,0.1)':comp.score>=50?'rgba(253,171,61,0.1)':'rgba(235,87,87,0.1)',border:`1px solid ${comp.score>=80?'#00a86b':comp.score>=50?'#d97706':'#eb5757'}`,borderRadius:'8px',padding:'10px 14px',margin:'12px 0'}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><strong>Salud / Completitud: {comp.score}%</strong></div>{comp.missing.length>0?<p style={{fontSize:'12px',marginTop:'4px',margin:0,opacity:0.9}}>⚠ Campos requeridos pendientes: <strong>{comp.missing.join(', ')}</strong></p>:<p style={{fontSize:'12px',marginTop:'4px',margin:0,color:'#00a86b'}}>✓ Toda la información requerida está completa</p>}</div><InvoiceRelated eventId={current.id}/><FinanceOverview eventId={current.id}/><ChatGPTContextButton entityType="event" entityId={current.id} disabled={busy}/><label>Nombre<Edit value={current.event_name} label="Nombre del evento" disabled={disabled} save={v=>void update([current.id],{event_name:v})}/></label><label>Fecha del evento<Edit type="date" value={current.event_date} label="Fecha del evento" disabled={disabled} save={v=>void update([current.id],{event_date:v||null})}/></label><label>CLIENTES{clientSelect(current)}</label><label>Localización / Venue{venueSelect(current)}</label><label>Ciudad{citySelect(current)}</label><h3 style={{fontSize:'16px',fontWeight:700,color:'#1e293b',marginTop:'24px',display:'flex',alignItems:'center',gap:'6px'}}>🎭 ARTISTAS, PROVEEDORES Y SUELDOS</h3>{relationPicker(current,'talent')}{renderArtistTable(current)}{renderProviderTable(current)}{renderMaterialTable(current)}<h3>SHOWS</h3>{relationPicker(current,'shows')}<EventShowKit key={current.id} eventId={current.id}/><h3>Presupuesto y cobro</h3>{financeColumns.map(c=><label key={c}>{c}{financeCell(current,c)}</label>)}<label>Vestuario<Edit value={current.wardrobe_notes} label="Vestuario" disabled={disabled} save={v=>void update([current.id],{wardrobe_notes:v})}/></label><label>Notas de producción<textarea key={current.internal_notes||''} aria-label="Notas de producción" defaultValue={current.internal_notes||''} disabled={disabled} onBlur={e=>{if(e.target.value!==(current.internal_notes||''))void update([current.id],{internal_notes:e.target.value})}}/></label><p>Referencia: {current.event_code}</p></>; })()}</Dialog.Content></Dialog.Portal></Dialog.Root>
 <Dialog.Root open={create} onOpenChange={setCreate}><Dialog.Portal><Dialog.Overlay className="cb-overlay"/><Dialog.Content className="cb-modal"><Dialog.Title>Agregar evento</Dialog.Title><Dialog.Description>Crea un evento propio y conecta después artistas y shows.</Dialog.Description><Dialog.Close className="cb-close">Cerrar</Dialog.Close>{error&&<p role="alert" className="cb-error">{error}</p>}<form onSubmit={async e=>{e.preventDefault();const f=new FormData(e.currentTarget);if(await save({action:'create',patch:{event_name:f.get('name'),event_date:f.get('date')||null,client_id:f.get('client')||null,venue:f.get('venue')||'',city:f.get('city')||'',status:'production'}}))setCreate(false)}}><label>Nombre<input name="name" required maxLength={500}/></label><label>Fecha<input type="date" name="date"/></label><label>Cliente{optionSelect('client')}</label><label>Localización / Venue{optionSelect('venue')}</label><label>Ciudad{optionSelect('city')}</label><button className="cb-primary" disabled={disabled}>Guardar evento</button></form></Dialog.Content></Dialog.Portal></Dialog.Root>
 </section>;
}
