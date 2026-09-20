'use client';
import {useEffect, useState, type FormEvent} from 'react';
import {responseJson} from '@/lib/response-json';

export function WorkspacePicker(){
  const [spaces,setSpaces]=useState<{id:string;name:string}[]>([]);
  const [active,setActive]=useState('');
  const [open,setOpen]=useState(false);
  const [name,setName]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  useEffect(()=>{let live=true;fetch('/api/workspaces',{cache:'no-store'}).then(async r=>{const data=await responseJson(r);if(!r.ok)throw Error(data.error);if(live){setSpaces(data.workspaces);setActive(data.activeId);}}).catch(e=>{if(live)setError(e.message);});return()=>{live=false;};},[]);
  async function send(method:'POST'|'PUT',body:object){setBusy(true);setError('');try{const r=await fetch('/api/workspaces',{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await responseJson(r);if(!r.ok)throw Error(data.error);window.location.assign('/');}catch(e){setError(e instanceof Error?e.message:'No se pudo cambiar el espacio.');setBusy(false);}}
  function create(e:FormEvent){e.preventDefault();void send('POST',{name:name.trim()});}
  return <section style={{marginBottom:20}}><label>Espacio de trabajo<select aria-label="Espacio de trabajo activo" value={active} disabled={busy} onChange={e=>void send('PUT',{workspaceId:e.target.value})} style={{width:'100%',padding:10,marginTop:6}}>{!active&&<option value="">Selecciona un espacio</option>}{spaces.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><button className="text-button" onClick={()=>setOpen(!open)}>+ Crear otro espacio</button>{open&&<form onSubmit={create}><label>Nombre del espacio<input value={name} onChange={e=>setName(e.target.value)} minLength={2} maxLength={80} required disabled={busy}/></label><p>Se creará vacío. Tú serás su administrador.</p><button className="primary-button" disabled={busy}>{busy?'Guardando…':'Crear espacio'}</button></form>}{error&&<p role="alert">{error}</p>}</section>;
}
