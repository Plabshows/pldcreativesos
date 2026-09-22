'use client';
import {useEffect,useState} from 'react';
import {responseJson} from '@/lib/response-json';
type Link={id:string;token:string;audience:string;created_at:string;expires_at:string;revoked_at:string|null};
export function ShowShareLinks({showId,refresh}:{showId:string;refresh?:string}){
 const [links,setLinks]=useState<Link[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState('');
 async function load(){try{const r=await fetch('/api/show-kit/share?show='+showId,{cache:'no-store'}),d=await responseJson(r);if(!r.ok)throw Error(d.error);setLinks(d.links);setError('');}catch(e){setError(e instanceof Error?e.message:'Error de conexión');}}
 useEffect(()=>{void load();},[showId,refresh]);
 async function revoke(id:string){setBusy(id);try{const r=await fetch('/api/show-kit/share',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({revoke:id})});if(!r.ok)throw Error('No se pudo revocar.');await load();}catch(e){setError(String(e));}finally{setBusy('');}}
 return <section><h3>Enlaces compartidos</h3><p>Conservan la versión compartida. Para enviar cambios, crea un enlace nuevo.</p>{error&&<p role="alert">{error}</p>}<button onClick={()=>void load()}>Actualizar enlaces</button>{!links.length&&<p>Aún no hay enlaces.</p>}{links.map(l=>{const active=!l.revoked_at&&Date.parse(l.expires_at)>Date.now();return <div className="sk-kit-item" key={l.id}><strong>{l.audience==='artist'?'Artista':'Cliente'} · {l.revoked_at?'Revocado':active?'Activo':'Caducado'}</strong><p>Creado: {new Date(l.created_at).toLocaleString('es-ES')} · Caduca: {new Date(l.expires_at).toLocaleString('es-ES')}</p>{active&&<div className="sk-actions"><a href={'/brief/'+l.token} target="_blank" rel="noreferrer">Abrir</a><button onClick={async()=>{try{await navigator.clipboard.writeText(location.origin+'/brief/'+l.token);}catch{setError('No se pudo copiar; abre el enlace y copia su dirección.');}}}>Copiar enlace</button><button disabled={!!busy} onClick={()=>void revoke(l.id)}>Revocar</button></div>}</div>;})}</section>;
}
