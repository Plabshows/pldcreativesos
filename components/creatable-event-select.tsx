'use client';
import {useState} from 'react';
import {responseJson} from '@/lib/response-json';
export function CreatableEventSelect({kind,label,name,value,onChange,options,groups=[],disabled,onCreated}:{kind:'client'|'city'|'venue'|'talent'|'shows';label:string;name?:string;value?:string;onChange?:(value:string)=>void;options:{value:string;label:string}[];groups?:{id:string;name:string}[];disabled:boolean;onCreated:()=>Promise<unknown>}){
 const [local,setLocal]=useState(''),[adding,setAdding]=useState(false),[draft,setDraft]=useState(''),[group,setGroup]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [created,setCreated]=useState<{value:string;label:string}[]>([]);
 const choose=(v:string)=>{setLocal(v);onChange?.(v)};
 const all=[...options,...created.filter(c=>!options.some(o=>o.value===c.value))];
 async function add(){
  if(!draft.trim()||busy)return;setBusy(true);setError('');
  try{const r=await fetch('/api/event-options',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind,name:draft,...(kind==='client'?{group_id:group}:{})})}),d=await responseJson(r);if(!r.ok)throw Error(d.error);
   setCreated(c=>[...c,{value:d.value,label:d.name}]);await onCreated();choose(d.value);setAdding(false);setDraft('');
  }catch(e){setError(e instanceof Error?e.message:'No se pudo guardar.')}finally{setBusy(false)}
 }
 return <div><select name={name} aria-label={label} value={value??local} disabled={disabled||busy} onChange={e=>{if(e.target.value==='__new__'){setAdding(true);setError('')}else choose(e.target.value)}}><option value="">{label}</option><option value="__new__">＋ Agregar nuevo…</option>{all.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select>{adding&&<div className="eb-quick-create" role="group" aria-label={'Crear '+label}><strong>Agregar {kind==='client'?'cliente':kind==='city'?'ciudad':kind==='venue'?'venue':kind==='talent'?'artista / proveedor':'show'}</strong><input aria-label="Nombre del nuevo registro" placeholder="Nombre" maxLength={200} value={draft} disabled={busy} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();void add()}if(e.key==='Escape'){e.preventDefault();e.stopPropagation();setAdding(false)}}}/>{kind==='client'&&<select aria-label="Tablero del cliente" value={group} disabled={busy} onChange={e=>setGroup(e.target.value)}><option value="">Selecciona su tablero…</option>{groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select>}<small>Se guardará en la base de datos compartida.</small>{error&&<p role="alert">{error}</p>}<button type="button" disabled={disabled||busy||!draft.trim()||(kind==='client'&&!group)} onClick={()=>void add()}>{busy?'Guardando…':'Crear y seleccionar'}</button><button type="button" disabled={busy} onClick={()=>setAdding(false)}>Cancelar</button></div>}</div>
}
