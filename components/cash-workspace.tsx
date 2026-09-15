'use client';
import {useEffect,useState} from 'react';
import {responseJson} from '@/lib/response-json';
import {euros} from '@/lib/event-money';
import './crm-workspace.css';

type CashEvent={id:string;event_name:string;event_date:string|null;client_id:string|null;income_cents:number|null;client_paid:boolean|null;billing_type:string;venue:string|null;internal_notes:string|null};
type Client={id:string;company_name:string};
type CashData={events:CashEvent[];clients:Client[]};
const empty:CashData={events:[],clients:[]};
const day=(d:string|null)=>d?new Date(d.slice(0,10)+'T12:00:00').toLocaleDateString('es-ES'):'Sin fecha';

export function CashWorkspace({query=''}:{query?:string}){
 const [data,setData]=useState(empty),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 const [search,setSearch]=useState(query),[period,setPeriod]=useState(''),[client,setClient]=useState(''),[status,setStatus]=useState('');
 async function load(){try{const r=await fetch('/api/event-board',{cache:'no-store'}),d=await responseJson(r);if(!r.ok)throw Error(d.error);setData({events:d.events.filter((e:any)=>e.billing_type==='cash'&&!e.deleted_at&&e.status!=='cancelled'),clients:d.clients});setError('')}catch(e){setError(e instanceof Error?e.message:'No se pudo cargar.')}finally{setLoading(false)}}
 useEffect(()=>{void load();window.addEventListener('focus',load);return()=>window.removeEventListener('focus',load)},[]);
 useEffect(()=>setSearch(query),[query]);

 const clientName=(id:string|null)=>data.clients.find(c=>c.id===id)?.company_name||'—';
 const months=[...new Set(data.events.map(e=>e.event_date?.slice(0,7)).filter((x):x is string=>Boolean(x)))].sort().reverse();

 const rows=data.events.filter(e=>
  (!period||e.event_date?.startsWith(period))&&
  (!client||e.client_id===client)&&
  (!status||(status==='paid'?e.client_paid===true:e.client_paid!==true))&&
  (!search||[e.event_name,clientName(e.client_id),e.venue].join(' ').toLowerCase().includes(search.toLowerCase()))
 ).sort((a,b)=>(b.event_date||'').localeCompare(a.event_date||''));

 const totalCash=rows.reduce((s,e)=>s+(e.income_cents??0),0);
 const paidCash=rows.filter(e=>e.client_paid===true).reduce((s,e)=>s+(e.income_cents??0),0);
 const pendingCash=totalCash-paidCash;

 return <section className="data-module"><header className="module-head"><div><p className="eyebrow">CONTROL DE COBROS</p><h1>Cash / Efectivo</h1><p>Ingresos en efectivo vinculados a eventos. Los importes reflejan el precio del evento.</p></div></header>{error&&<p role="alert">{error}</p>}
 <div className="inv-summary">{[['Total Cash',euros(totalCash)],['Cobrado',euros(paidCash)],['Pendiente',euros(pendingCash)],['Eventos',rows.length]].map(([k,v])=><div key={k}><small>{k}</small><strong>{v}</strong></div>)}</div>
 <p>{period?'Período: '+months.find(m=>m===period)||period:'Todos los períodos'}. Solo eventos activos marcados como Cash.</p>
 <div className="crm-toolbar">
  <input aria-label="Buscar en cash" placeholder="Buscar evento, cliente…" value={search} onChange={e=>setSearch(e.target.value)}/>
  <select aria-label="Período" value={period} onChange={e=>setPeriod(e.target.value)}><option value="">Todos los períodos</option>{months.map(m=><option key={m} value={m}>{new Date(m+'-01T12:00:00').toLocaleDateString('es-ES',{month:'long',year:'numeric'})}</option>)}</select>
  <select aria-label="Cliente" value={client} onChange={e=>setClient(e.target.value)}><option value="">Todos los clientes</option>{data.clients.map(c=><option key={c.id} value={c.id}>{c.company_name}</option>)}</select>
  <select aria-label="Estado de pago" value={status} onChange={e=>setStatus(e.target.value)}><option value="">Todos los estados</option><option value="paid">Cobrado</option><option value="pending">Pendiente</option></select>
  <button onClick={()=>void load()}>Actualizar</button>
 </div>
 {loading?<p>Cargando Cash…</p>:<div className="data-table-wrap"><table className="data-table"><thead><tr>{['Fecha','Evento','Cliente','Importe','Estado','Venue','Notas'].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map(e=><tr key={e.id}>
  <td>{day(e.event_date)}</td>
  <td><a href={`/?event=${e.id}#eventos`}>{e.event_name}</a></td>
  <td>{clientName(e.client_id)}</td>
  <td><strong>{e.income_cents!==null?euros(e.income_cents):'Sin indicar'}</strong></td>
  <td><span className={'inv-status '+(e.client_paid===true?'paid':'pending')}>{e.client_paid===true?'Cobrado':'Pendiente'}</span></td>
  <td>{e.venue||'—'}</td>
  <td>{e.internal_notes?.slice(0,60)||'—'}</td>
 </tr>)}</tbody></table>{!rows.length&&<p>No hay eventos cash con estos filtros.</p>}</div>}
 </section>;
}
