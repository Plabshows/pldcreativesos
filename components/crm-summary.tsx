'use client';

import {useEffect, useState} from 'react';
import {crmAlerts, crmForecast, crmWindowForecast, stages, type CrmData} from '@/lib/crm';
import {responseJson} from '@/lib/response-json';
import './crm-workspace.css';

const money=(c:number)=>new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(c/100);
export function CrmSummary() {
  const [data,setData]=useState<CrmData|null>(null),[error,setError]=useState('');
  const [refresh,setRefresh]=useState(0);
  useEffect(()=>{
    let active=true;
    async function load(){
      try{const response=await fetch('/api/crm',{cache:'no-store'});const result=await responseJson(response);if(!response.ok)throw new Error(result.error);if(active){setData(result);setError('');}}
      catch(e){if(active)setError(e instanceof Error?e.message:'No se pudo cargar el resumen comercial.');}
    }
    void load();const focus=()=>void load();window.addEventListener('focus',focus);
    const timer=setInterval(()=>{if(document.visibilityState==='visible')void load();},60000);
    return()=>{active=false;clearInterval(timer);window.removeEventListener('focus',focus);};
  },[refresh]);
  if(error)return <section className="panel crm-summary"><h2>Seguimiento comercial</h2><p role="alert">{error}</p><button onClick={()=>setRefresh(r=>r+1)}>Reintentar</button></section>;
  if(!data)return <section className="panel crm-summary"><p>Cargando seguimiento comercial…</p></section>;
  const forecast=crmForecast(data.opportunities),windows=crmWindowForecast(data.opportunities);
  const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Madrid'}).format(new Date());
  const rows=[...data.leads.filter(r=>!data.opportunities.some(o=>o.lead_id===r.id)).map(r=>({...r,entity:'lead'})),...data.opportunities.map(r=>({...r,entity:'opportunity'}))];
  const attention=rows.filter(r=>{const a=crmAlerts(r);return a.missing||a.overdue||a.level!=='none'||(!['won','lost'].includes(r.stage)&&r.next_action_date===today);}).sort((a,b)=>{
    const aa=crmAlerts(a),bb=crmAlerts(b);
    return Number(bb.overdue)-Number(aa.overdue)||(a.next_action_date||'9999').localeCompare(b.next_action_date||'9999')||bb.days-aa.days;
  });
  const won=data.opportunities.filter(r=>r.stage==='won'&&!r.event_id);
  return <section className="panel crm-summary">
    <div className="panel-head"><div><h2>Seguimiento comercial</h2><p>{attention.length} consultas y oportunidades necesitan atención.</p></div><a className="text-button" href="/#pipeline">Abrir Pipeline →</a></div>
    <div className="crm-stats"><div><span>Pipeline abierto</span><b>{money(forecast.total)}</b></div><div><span>Ponderado</span><b>{money(forecast.weighted)}</b></div><div><span>Cierres en 30 días</span><b>{money(windows.days30)}</b></div><div><span>Cierres en 90 días</span><b>{money(windows.days90)}</b></div></div>
    <p className="crm-summary-note">Previsiones según fecha de cierre y probabilidad; no son ingresos confirmados. {windows.withoutDate>0&&`${windows.withoutDate} oportunidades sin fecha de cierre.`}</p>
    {won.length>0&&<div className="crm-action-box"><b>{won.length} trabajos ganados pendientes de vincular a Eventos</b><ul>{won.map(r=><li key={r.id}><a href={`/?opportunity=${r.id}#pipeline`}>{r.title} → Crear o enlazar evento</a></li>)}</ul></div>}
    {attention.length?<div className="crm-summary-list">{attention.slice(0,8).map(r=>{const a=crmAlerts(r);return <a key={`${r.entity}-${r.id}`} className="crm-summary-row" href={`/?${r.entity}=${r.id}#${r.entity==='lead'?'leads':'pipeline'}`}>
      <div><strong>{r.title}</strong><small>{data.clients.find(c=>c.id===r.client_id)?.company_name||r.company_name||'Cliente por definir'} · {r.entity==='lead'?'Lead':'Oportunidad'}</small></div>
      <div><span>{r.next_action||'Definir próxima acción'}</span><small>{r.next_action_date?new Date(r.next_action_date+'T12:00:00').toLocaleDateString('es-ES'):'Sin fecha'} · {data.members.find(m=>m.id===r.next_action_owner_id)?.name||'Sin responsable'}</small></div>
      <div className="crm-badges">{a.overdue?<span className="red">Vencido</span>:r.next_action_date===today?<span className="yellow">Hoy</span>:a.level!=='none'?<span className={a.level}>{a.days} días sin actividad</span>:<span className="yellow">Completar seguimiento</span>}</div>
    </a>;})}</div>:<p className="crm-empty">{rows.length?'No hay seguimientos pendientes.':'Todavía no hay consultas comerciales. Crea un lead para comenzar.'}</p>}
    {attention.length>8&&<p>Mostrando 8 de {attention.length}. Abre Leads o Pipeline y activa «Necesita seguimiento» para ver el resto.</p>}
    <div className="crm-summary-stages">{stages.map(([stage,label])=>{const count=data.opportunities.filter(r=>r.stage===stage).length;return count>0?<span key={stage}>{label} <b>{count}</b></span>:null;})}</div>
  </section>;
}
