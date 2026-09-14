'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {Bell} from 'lucide-react';
import {responseJson} from '@/lib/response-json';
import {taskOverdue,taskPriorities} from '@/lib/work-tasks';import type {InboxTask} from '@/lib/task-inbox';
import './task-inbox.css';
function useInbox(){
 const [data,setData]=useState<{tasks:InboxTask[];unread:number}|null>(null),[error,setError]=useState('');
 const load=useCallback(async()=>{try{const r=await fetch('/api/task-inbox',{cache:'no-store'}),d=await responseJson(r);if(!r.ok)throw Error(d.error);setData(d);setError('');}catch(e){setError(e instanceof Error?e.message:'No se pudo cargar tu buzón.');}},[]);
 useEffect(()=>{void load();const onFocus=()=>void load();window.addEventListener('focus',onFocus);window.addEventListener('plab-inbox-changed',onFocus);const timer=setInterval(()=>{if(document.visibilityState==='visible')void load();},30000);return()=>{clearInterval(timer);window.removeEventListener('focus',onFocus);window.removeEventListener('plab-inbox-changed',onFocus);};},[load]);
 return {data,error,setError,load};
}
export function TaskInbox({panel=false}:{panel?:boolean}){
 const {data,error,setError,load}=useInbox(),[busy,setBusy]=useState<string|null>(null);const dialog=useRef<HTMLDialogElement>(null);
 async function seen(t:InboxTask){setBusy(t.id);try{const r=await fetch('/api/task-inbox',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({taskId:t.id,version:t.version})}),d=await responseJson(r);if(!r.ok)throw Error(d.error);window.dispatchEvent(new Event('plab-inbox-changed'));}catch(e){setError(e instanceof Error?e.message:'No se pudo marcar como vista.');}finally{setBusy(null);}}
 const contents=<><div className="inbox-heading"><div><p>ASIGNADAS A TI</p><h2>Mis tareas</h2></div><span>{data?.tasks.length??'…'} abiertas · {data?.unread??'…'} nuevas o actualizadas</span></div><p className="inbox-note">Este buzón muestra tus pendientes. Marcar como vista no completa la tarea.</p>{error&&<p role="alert" className="inbox-error">{error} <button onClick={()=>void load()}>Reintentar</button></p>}{!data&&!error&&<p>Cargando tus tareas…</p>}{data&&!data.tasks.length&&<p>No tienes tareas pendientes asignadas.</p>}
 {data?.tasks.slice(0,panel?5:undefined).map(t=><article key={t.id} className={'inbox-row '+(t.unread?'inbox-unread':'')}><div><a href={`/?task=${t.id}#tareas`}>{t.title}</a><small>{t.deadline?new Date(t.deadline).toLocaleString('es-ES',{dateStyle:'short',timeStyle:'short'}):'Sin fecha límite'} · {taskPriorities.find(p=>p[0]===t.priority)?.[1]}</small></div><div>{taskOverdue(t)&&<span className="inbox-late">Vencida</span>}{t.unread&&<span className="inbox-new">Nueva / actualizada</span>}</div>{t.unread&&<button type="button" disabled={busy===t.id} onClick={()=>void seen(t)}>Marcar vista</button>}</article>)}<a className="inbox-all" href="/?mine=1#tareas">Ver todas mis tareas →</a></>;
 if(panel)return <section className="task-inbox-panel">{contents}</section>;
 return <><button type="button" className="icon-button task-inbox-bell" aria-label={`Mis tareas: ${data?.unread??0} nuevas o actualizadas${error?', no se pudo actualizar':''}`} onClick={()=>{dialog.current?.showModal();void load();}}><Bell size={18}/>{!!data?.unread&&<b>{data.unread}</b>}{error&&<b>!</b>}</button><dialog ref={dialog} className="task-inbox-dialog"><button className="inbox-close" type="button" onClick={()=>dialog.current?.close()} aria-label="Cerrar mis tareas">✕</button>{contents}</dialog></>;
}
