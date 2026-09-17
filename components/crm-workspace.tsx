'use client';
import {ChatGPTContextButton} from '@/components/chatgpt-context-button';

import { useCallback, useEffect, useRef, useState } from 'react';
import { crmAlerts, crmForecast, crmWindowForecast, crmSchema, blankCrm, emptyCrm, stages, sources, lostReasons, type CrmData, type CrmFields, type CrmRecord, type Stage } from '@/lib/crm';
import { responseJson } from '@/lib/response-json';
import './crm-workspace.css';

type Entity='leads'|'opportunities';
const money=(c:number)=>new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(c/100);
const day=(s:string|null|undefined)=>s?new Date(s.length===10?s+'T12:00:00':s).toLocaleDateString('es-ES'):'Sin fecha';
const storageKey='plab-crm-local-preview-v1';
const previewOwner='00000000-0000-4000-8000-000000000001';
export function CrmWorkspace({mode,query='',localPreview=false}:{mode:Entity;query?:string;localPreview?:boolean}) {
  const [data,setData]=useState<CrmData>(emptyCrm),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [search,setSearch]=useState(''),[onlyAttention,setOnlyAttention]=useState(false),[owner,setOwner]=useState('');
  const [editing,setEditing]=useState<{id?:string;fields:CrmFields}|null>(null),[note,setNote]=useState(''),[dragging,setDragging]=useState<string|null>(null),[target,setTarget]=useState(''),[message,setMessage]=useState('');
  const dialog=useRef<HTMLDialogElement>(null);
  const [removed,setRemoved]=useState<CrmRecord|null>(null);
  async function removeLead(record:CrmRecord,restore=false){
    if(busy)return;
    setBusy(true);setError('');
    try{
      if(isPreview){
        const next={...data,leads:restore?[record,...data.leads]:data.leads.filter(r=>r.id!==record.id)};
        window.localStorage.setItem(storageKey,JSON.stringify(next));setData(next);
      }else{
        const response=await fetch('/api/crm',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({entity:'leads',action:restore?'restore':'remove',id:record.id})});
        const result=await responseJson(response);if(!response.ok)throw Error(result.error);await load();
      }
      setRemoved(restore?null:record);setEditing(null);setMessage(restore?'Lead restaurado.':'Lead eliminado de la lista. Su historial se conserva.');
    }catch(e){setError(e instanceof Error?e.message:'No se pudo eliminar el lead.');}finally{setBusy(false);}
  }
  const isPreview=localPreview&&process.env.NODE_ENV==='development';
  const load=useCallback(async()=>{
    setError('');
    try{
      if(isPreview){const stored=window.localStorage.getItem(storageKey);const result=stored?JSON.parse(stored):emptyCrm();if(!Array.isArray(result.leads)||!Array.isArray(result.opportunities))throw new Error('No se pudo leer la prueba local.');setData({...result,members:[{id:previewOwner,name:'Yo · prueba local'}]});}
      else{const response=await fetch('/api/crm',{cache:'no-store'});const result=await responseJson(response);if(!response.ok)throw new Error(result.error);setData(result);}
    }catch(e){setError(e instanceof Error?e.message:'No se pudo cargar el CRM.');}finally{setLoading(false);}
  },[isPreview]);
  useEffect(()=>{void load();},[load]);
  useEffect(()=>{if(editing)dialog.current?.showModal();else dialog.current?.close();},[editing]);
  useEffect(()=>{setEditing(null);},[mode]);
  async function mutate(action:'save'|'activity'|'promote'|'link'|'create_event',record?:{id?:string;fields?:CrmFields},extra?:{body?:string;event_id?:string}) {
    setBusy(true);setError('');setMessage('');
    try{
      if(isPreview){
        const next:CrmData=JSON.parse(JSON.stringify(data));const now=new Date().toISOString();const id=record?.id||crypto.randomUUID();const current=next[mode].find(r=>r.id===id);
        const activity=(entity:Entity,entityId:string,body:string,kind:string)=>{next.activities.unshift({id:crypto.randomUUID(),entity_id:entityId,entity_type:entity,body,kind,created_at:now});const row=next[entity].find(r=>r.id===entityId);if(row)row.last_activity_at=now;};
        if(action==='save'){
          const fields=crmSchema.parse(record?.fields);const saved={...current,...fields,id,created_at:current?.created_at||now,last_activity_at:current?.last_activity_at||null};
          next[mode]=current?next[mode].map(r=>r.id===id?saved:r):[saved,...next[mode]];
          if(!current||current.stage!==saved.stage)activity(mode,id,current?`${stages.find(s=>s[0]===current.stage)?.[1]} → ${stages.find(s=>s[0]===saved.stage)?.[1]}`:'Registro creado',current?'status':'created');
        }else if(action==='activity'&&current&&extra?.body){activity(mode,id,extra.body,'note');}
        else if(action==='promote'&&current){if(next.opportunities.some(r=>r.lead_id===id))throw new Error('Este lead ya tiene una oportunidad.');const newId=crypto.randomUUID();next.opportunities.unshift({...current,id:newId,lead_id:id,created_at:now,last_activity_at:now});activity('opportunities',newId,'Oportunidad creada desde el lead','created');}
        else if(action==='link'||action==='create_event'){throw new Error('Abre el Pipeline compartido para trabajar con eventos reales.');}
        window.localStorage.setItem(storageKey,JSON.stringify(next));setData(next);
      }else{
        const response=await fetch('/api/crm',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({entity:mode,action,...record,...extra})});const result=await responseJson(response);if(!response.ok)throw new Error(result.error);await load();
      }
      setMessage(isPreview?'Guardado en esta prueba local.':'Guardado en el equipo.');return true;
    }catch(e){setError(e instanceof Error?e.message:'No se pudo guardar.');return false;}finally{setBusy(false);}
  }
  function open(record?:CrmRecord){setError('');setNote('');setTarget('');setEditing({id:record?.id,fields:record?Object.fromEntries(Object.keys(crmSchema.shape).map(k=>[k,(record as unknown as Record<string,unknown>)[k]??(blankCrm() as unknown as Record<string,unknown>)[k]])) as CrmFields:{...blankCrm(),title:'',owner_id:isPreview?previewOwner:'',next_action_owner_id:isPreview?previewOwner:''}});}
  useEffect(()=>{
    if(loading)return;
    const id=new URLSearchParams(window.location.search).get(mode==='leads'?'lead':'opportunity');
    const record=id?data[mode].find(r=>r.id===id):undefined;
    if(record){open(record);const url=new URL(window.location.href);url.searchParams.delete(mode==='leads'?'lead':'opportunity');window.history.replaceState(null,'',url);}
  },[loading,data,mode]);
  function field<K extends keyof CrmFields>(key:K,value:CrmFields[K]){setEditing(e=>e?{...e,fields:{...e.fields,[key]:value}}:null);}
  async function move(record:CrmRecord,stage:Stage){if(record.stage===stage)return;if(stage==='lost'){open({...record,stage});return;}await mutate('save',{id:record.id,fields:{...record,stage}});}
  const term=(query+' '+search).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const filtered=data[mode].filter(r=>{
    const text=[r.title,r.company_name,r.contact_name,r.city,r.venue,r.next_action,data.clients.find(c=>c.id===r.client_id)?.company_name].join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    const a=crmAlerts(r);return term.split(/\s+/).every(t=>text.includes(t))&&(!owner||r.owner_id===owner)&&(!onlyAttention||(a.missing||a.overdue||a.level!=='none'));
  }).sort((a,b)=>b.created_at.localeCompare(a.created_at));
  const forecast=crmForecast(data.opportunities),windows=crmWindowForecast(data.opportunities),selected=data[mode].find(r=>r.id===editing?.id);
  const hasUnsavedChanges=!!(selected&&editing&&Object.keys(crmSchema.shape).some(k=>editing.fields[k as keyof CrmFields]!==selected[k as keyof CrmRecord]));
  const selectField=(key:keyof CrmFields,label:string,options:{value:string;label:string}[])=> <label>{label}<select value={String(editing?.fields[key]||'')} onChange={e=>field(key,e.target.value as never)}><option value="">Sin especificar</option>{options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></label>;
  const inputField=(key:keyof CrmFields,label:string,type='text')=><label>{label}<input type={type} value={String(editing?.fields[key]||'')} required={key==='title'} maxLength={key==='title'?200:2000} onChange={e=>field(key,e.target.value as never)}/></label>;
  function card(record:CrmRecord){const alerts=crmAlerts(record);return <article key={record.id} className="crm-card" draggable={!busy} onDragStart={e=>{e.dataTransfer.setData('text/plain',record.id);setDragging(record.id);}} onDragEnd={()=>setDragging(null)}>
    <button className="crm-card-open" onClick={()=>open(record)}><span className="crm-company">{data.clients.find(c=>c.id===record.client_id)?.company_name||record.company_name||'Cliente por definir'}</span><h3>{record.title}</h3><span>{day(record.event_date)} · {[record.venue,record.city].filter(Boolean).join(', ')||'Lugar por definir'}</span><strong>{money(record.estimated_value_cents)}</strong></button>
    <div className="crm-next"><b>Próxima acción</b><span>{record.next_action||'Sin próxima acción'}</span><small>{day(record.next_action_date)} · {data.members.find(m=>m.id===record.next_action_owner_id)?.name||'Sin responsable'}</small></div>
    <small>Última actividad: {day(record.last_activity_at||record.created_at)}</small>
    <div className="crm-badges">{alerts.level!=='none'&&<span className={alerts.level}>{alerts.days} días sin actividad</span>}{alerts.missing&&<span className="yellow">Completar próxima acción</span>}{alerts.overdue&&<span className="red">Seguimiento vencido</span>}</div>
    <label className="crm-stage-label">Estado<select aria-label={`Estado de ${record.title}`} value={record.stage} disabled={busy} onChange={e=>void move(record,e.target.value as Stage)}>{stages.map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label>
  </article>;}
  return <section className="crm-workspace">
    <header className="crm-heading"><div><p className="eyebrow">CRM · RELACIONES COMERCIALES</p><h1>{mode==='leads'?'Leads':'Pipeline comercial'}</h1><p>{mode==='leads'?'Cada consulta, su contexto y el siguiente paso.':'De la primera conversación al trabajo ganado.'}</p></div><button className="primary-button" disabled={loading||(!isPreview&&!!error&&!data.members.length)} onClick={()=>open()}>+ {mode==='leads'?'Nuevo lead':'Nueva oportunidad'}</button></header>
    {isPreview&&<p className="crm-local">Prueba local · Los cambios se guardan solo en este navegador. No se envían a Supabase ni a Netlify.</p>}
    {!isPreview&&!loading&&!error&&<p className="crm-local">Espacio compartido · Clientes y equipo conectados a Supabase. Los cambios se guardan para todo el equipo.</p>}
    {error&&!editing&&<div className="crm-error" role="alert">{error} <button onClick={()=>void load()}>Reintentar</button>{!isPreview&&process.env.NODE_ENV==='development'&&<a href="/crm-preview">Abrir prueba local</a>}</div>}
    {message&&<p role="status">{message}</p>}
    {removed&&mode==='leads'&&<p>Has eliminado «{removed.title}». <button disabled={busy} onClick={()=>void removeLead(removed,true)}>Deshacer eliminación</button></p>}
    <div className="crm-stats"><div><span>Leads</span><b>{data.leads.length}</b></div><div><span>Oportunidades abiertas</span><b>{data.opportunities.filter(r=>!['won','lost'].includes(r.stage)).length}</b></div><div><span>Valor del pipeline</span><b>{money(forecast.total)}</b></div><div><span>Ponderado por probabilidad</span><b>{money(forecast.weighted)}</b></div></div>
    <p>Previsión ponderada de cierre: <b>{money(windows.days30)}</b> en 30 días · <b>{money(windows.days90)}</b> en 90 días. {windows.withoutDate>0&&`${windows.withoutDate} oportunidades sin fecha de cierre quedan fuera de estas previsiones.`}</p><div className="crm-toolbar"><input aria-label="Buscar en CRM" placeholder="Buscar cliente, consulta, ciudad…" value={search} onChange={e=>setSearch(e.target.value)}/><select aria-label="Filtrar por responsable" value={owner} onChange={e=>setOwner(e.target.value)}><option value="">Todo el equipo</option>{data.members.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select><label><input type="checkbox" checked={onlyAttention} onChange={e=>setOnlyAttention(e.target.checked)}/> Necesita seguimiento</label><button onClick={()=>void load()} disabled={busy}>Actualizar</button></div>
    {loading?<p>Cargando CRM…</p>:mode==='leads'?<div className="crm-leads">{filtered.map(card)}{!filtered.length&&<p className="crm-empty">{data.leads.length?'No hay coincidencias con estos filtros.':'Todavía no hay consultas. Añade tu primer lead real para comenzar.'}</p>}</div>:<div className="crm-kanban">{stages.map(([stage,label])=>{const rows=filtered.filter(r=>r.stage===stage);return <section key={stage} className={`crm-column ${dragging?'crm-drop-ready':''}`} onDragOver={e=>{if(dragging)e.preventDefault();}} onDrop={e=>{e.preventDefault();const r=data.opportunities.find(r=>r.id===e.dataTransfer.getData('text/plain'));setDragging(null);if(r)void move(r,stage);}}><header><h2>{label} <span>{rows.length}</span></h2><small>{money(rows.reduce((s,r)=>s+r.estimated_value_cents,0))}</small></header>{rows.map(card)}{!rows.length&&<p className="crm-drop-empty">{dragging?'Soltar aquí':'Sin oportunidades'}</p>}</section>;})}</div>}
    <dialog ref={dialog} className="crm-dialog" onCancel={e=>{if(busy)e.preventDefault();else setEditing(null);}} onClose={()=>{if(!busy)setEditing(null);}}>{editing&&<><header><div><p className="eyebrow">{mode==='leads'?'CONSULTA COMERCIAL':'OPORTUNIDAD'}</p><h2>{editing.id?editing.fields.title:'Nuevo registro'}</h2></div><button type="button" aria-label="Cerrar ficha" disabled={busy} onClick={()=>setEditing(null)}>✕</button></header>
      {selected&&!isPreview&&<ChatGPTContextButton entityType={mode==='leads'?'lead':'opportunity'} entityId={selected.id} disabled={busy||hasUnsavedChanges}/>}
      {error&&<p className="crm-error" role="alert">{error}</p>}
      {selected&&mode==='leads'&&<div className="crm-action-box"><button type="button" disabled={busy} onClick={()=>void removeLead(selected)}>Eliminar lead</button><p>Se quitará de Leads. Sus oportunidades, clientes e historial se conservan. Podrás deshacer la eliminación desde la lista.</p></div>}
      <form onSubmit={async e=>{e.preventDefault();if(await mutate('save',editing))setEditing(null);}}><fieldset disabled={busy}><div className="crm-form-grid">
        {inputField('title','Nombre de la consulta / oportunidad')}{selectField('client_id','Cliente existente',data.clients.map(c=>({value:c.id,label:c.company_name})))}
        {inputField('company_name','Empresa / cliente nuevo')}{inputField('contact_name','Persona de contacto')}{inputField('email','Email','email')}{inputField('phone','Teléfono','tel')}{inputField('whatsapp','WhatsApp','tel')}
        {inputField('event_type','Tipo de evento')}{inputField('event_date','Posible fecha del evento','date')}{inputField('city','Ciudad')}{inputField('country','País')}{inputField('venue','Venue')}
        {selectField('source','Origen',sources.map(s=>({value:s,label:s})))}{selectField('owner_id','Responsable',data.members.map(m=>({value:m.id,label:m.name})))}
        <label>Valor estimado (€)<input type="number" min="0" max="1000000000" step="0.01" value={editing.fields.estimated_value_cents/100} onChange={e=>field('estimated_value_cents',Math.round(Number(e.target.value)*100))}/></label>
        <label>Probabilidad (%)<input type="number" min="0" max="100" step="1" value={editing.fields.probability_percent} onChange={e=>field('probability_percent',Number(e.target.value))}/></label>
        {inputField('expected_close_date','Fecha prevista de cierre','date')}
        <label>Estado<select value={editing.fields.stage} onChange={e=>field('stage',e.target.value as Stage)}>{stages.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
        {editing.fields.stage==='lost'&&selectField('lost_reason','Motivo de pérdida (opcional)',lostReasons.map(s=>({value:s,label:s})))}
      </div><div className="crm-action-box"><h3>Próxima acción</h3><p>Qué harás, cuándo y quién se encarga.</p><div className="crm-form-grid">{inputField('next_action','Acción (llamar, enviar propuesta, seguimiento…)')}{inputField('next_action_date','Fecha de la acción','date')}{selectField('next_action_owner_id','Responsable de la acción',data.members.map(m=>({value:m.id,label:m.name})))}</div></div>
      <label className="crm-notes">Notas<textarea rows={4} maxLength={10000} value={editing.fields.notes} onChange={e=>field('notes',e.target.value)}/></label><footer><button className="primary-button" type="submit">{busy?'Guardando…':'Guardar'}</button><button type="button" onClick={()=>setEditing(null)}>Cancelar</button></footer></fieldset></form>
      {selected&&<section className="crm-history"><h3>Actividad</h3><form onSubmit={async e=>{e.preventDefault();if(await mutate('activity',{id:selected.id},{body:note}))setNote('');}}><label>Registrar llamada, respuesta, WhatsApp o nota<textarea value={note} required maxLength={10000} onChange={e=>setNote(e.target.value)}/></label><button disabled={busy||!note.trim()}>Registrar actividad</button></form><ol>{data.activities.filter(a=>(a.entity_type===mode&&a.entity_id===selected.id)||(mode==='opportunities'&&a.entity_type==='leads'&&a.entity_id===selected.lead_id)).sort((a,b)=>b.created_at.localeCompare(a.created_at)).map(a=><li key={a.id}><small>{day(a.created_at)} · {a.entity_type==='leads'?'Lead':'Oportunidad'}</small><p>{a.body}</p></li>)}</ol></section>}
      {selected&&mode==='leads'&&<div className="crm-action-box">{data.opportunities.some(o=>o.lead_id===selected.id)?<p>Esta consulta ya tiene una oportunidad en el Pipeline.</p>:<><p>Crea una oportunidad con la información guardada de esta consulta.</p><button disabled={busy} onClick={()=>void mutate('promote',{id:selected.id})}>Crear oportunidad desde este lead</button></>}</div>}
      {selected&&mode==='opportunities'&&!isPreview&&<div className="crm-action-box"><a href={`/?quoteOpportunity=${selected.id}#propuestas`}>Crear propuesta con shows para esta oportunidad</a></div>}
      {selected&&mode==='opportunities'&&selected.stage==='won'&&<div className="crm-action-box"><h3>Continuar en Eventos</h3>{selected.event_id?<a className="primary-button" href={`/?event=${encodeURIComponent(selected.event_id)}#eventos`}>Abrir ficha del evento</a>:<>
        <p>Crea el evento con los datos guardados: cliente, fecha, venue, ciudad, notas e importe estimado como ingreso. Podrás ajustar el importe en Eventos.</p>
        {hasUnsavedChanges&&<p>Guarda los cambios de esta ficha antes de crear o enlazar el evento.</p>}
        <button className="primary-button" disabled={busy||isPreview||!selected.client_id||!selected.event_date||hasUnsavedChanges} onClick={()=>void mutate('create_event',{id:selected.id})}>Crear evento con estos datos</button>
        {(!selected.client_id||!selected.event_date)&&<p>Para crear el evento, selecciona un cliente existente, indica la fecha y guarda la ficha.</p>}
        <p>¿El evento ya está creado? Vincúlalo aquí.</p><select aria-label="Evento existente" value={target} onChange={e=>setTarget(e.target.value)}><option value="">Selecciona un evento</option>{data.events.map(e=><option key={e.id} value={e.id}>{e.event_name}</option>)}</select><button disabled={busy||!target||isPreview} onClick={()=>void mutate('link',{id:selected.id},{event_id:target})}>Enlazar evento existente</button></>}</div>}
    </>}</dialog>
  </section>;
}
