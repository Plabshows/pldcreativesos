'use client';
import {useEffect,useId,useRef,useState} from 'react';
import {contextActions,type ContextRequest,type ContextResult} from '@/lib/chatgpt/contracts';
import {copyChatGPTContext} from '@/lib/chatgpt/clipboard';
import {responseJson} from '@/lib/response-json';
import './chatgpt-context.css';
export function ChatGPTContextButton({entityType,entityId,disabled=false}:{entityType:ContextRequest['entityType'];entityId:string;disabled?:boolean}){
 const dialog=useRef<HTMLDialogElement>(null),textarea=useRef<HTMLTextAreaElement>(null),request=useRef<AbortController|null>(null),sequence=useRef(0);
 useEffect(()=>()=>{request.current?.abort();sequence.current++;},[]);
 const titleId=useId(),[action,setAction]=useState<ContextRequest['action']>(entityType==='lead'?'analyse-lead':entityType==='proposal'?'review-budget':'free'),[question,setQuestion]=useState(''),[personal,setPersonal]=useState(false),[prompt,setPrompt]=useState(''),[preview,setPreview]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[meta,setMeta]=useState<ContextResult|null>(null);
 const invalidate=()=>{request.current?.abort();sequence.current++;setPrompt('');setMeta(null);setNotice('');setError('');setBusy(false);};
 async function generate(initial=false){
  request.current?.abort();const controller=new AbortController();request.current=controller;const seq=++sequence.current;setBusy(true);setError('');setNotice('');setPrompt('');
  try{const r=await fetch('/api/chatgpt-context',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({entityType,entityId,action,customQuestion:initial?'':question,includePersonalData:initial?false:personal}),signal:controller.signal}),d=await responseJson(r);if(!r.ok)throw Error(d.error);if(seq===sequence.current){setPrompt(d.prompt);setMeta(d);}}
  catch(e){if(!controller.signal.aborted&&seq===sequence.current)setError(e instanceof Error?e.message:'No se pudo generar el contexto.');}
  finally{if(seq===sequence.current)setBusy(false);}
 }
 function open(){setQuestion('');setPersonal(false);setPreview(false);dialog.current?.showModal();void generate(true);}
 function close(){invalidate();dialog.current?.close();setPersonal(false);setQuestion('');}
 async function copy(openChat:boolean){
  setError('');setNotice('');try{await copyChatGPTContext(prompt,text=>navigator.clipboard.writeText(text),openChat?()=>{window.open('https://chatgpt.com/','_blank','noopener,noreferrer');}:undefined);if(openChat){setNotice('Contexto copiado ✓ Pégalo en ChatGPT.');}else setNotice('Prompt copiado ✓');}
  catch{setPreview(true);setError('El navegador no permitió copiar. Usa «Copiar prompt» o selecciona el texto y pulsa Ctrl+C / ⌘C.');setTimeout(()=>{textarea.current?.focus();textarea.current?.select();},0);}
 }
 return <><button className="gpt-context-trigger" type="button" disabled={disabled} title={disabled?'Guarda los cambios antes de preparar el contexto.':undefined} onClick={open}>🤖 {entityType==='lead'?'Analizar con ChatGPT':entityType==='client'?'Consultar cliente':entityType==='event'?'Consultar en ChatGPT':'Abrir en ChatGPT'}</button>
 <dialog ref={dialog} className="gpt-context-dialog" aria-labelledby={titleId} onCancel={e=>{e.preventDefault();e.stopPropagation();close();}}><header><div><p>PERFORMANCE LAB + CHATGPT</p><h2 id={titleId}>Trabajar con ChatGPT</h2></div><button type="button" aria-label="Cerrar contexto" onClick={close}>✕</button></header>
 <p>Se consultan los datos guardados en el OS. Revisa el texto antes de copiarlo; puede incluir precios, costes y notas internas.</p>
 <label>¿Qué quieres hacer?<select value={action} onChange={e=>{invalidate();setAction(e.target.value as ContextRequest['action']);}}>{contextActions.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
 <label>¿Qué quieres preguntarle a ChatGPT?<textarea rows={3} maxLength={4000} placeholder="Opcional: ¿qué alternativa puedo ofrecer si el presupuesto es demasiado alto?" value={question} onChange={e=>{invalidate();setQuestion(e.target.value);}}/></label>
 <label className="gpt-personal"><input type="checkbox" checked={personal} onChange={e=>{invalidate();setPersonal(e.target.checked);}}/> Incluir datos personales del cliente</label>
 <small>Desactivado: se omiten los campos de contacto y datos fiscales, y se filtran contactos y posibles direcciones en el texto. Revisa siempre las notas libres.</small>
 <div className="gpt-actions"><button type="button" disabled={busy} onClick={()=>void generate()}>{busy?'Recopilando relaciones…':prompt?'Volver a generar contexto':'Generar contexto'}</button><button type="button" disabled={!prompt} onClick={()=>setPreview(v=>!v)}>{preview?'Ocultar contexto':'Ver contexto'}</button></div>
 {meta&&<p className="gpt-meta">{Object.entries(meta.counts).filter(([,v])=>v>0).map(([k,v])=>`${v} ${k}`).join(' · ')}. Consulta: {new Date(meta.capturedAt).toLocaleTimeString('es-ES')}.</p>}
 {preview&&<label>Texto exacto que se copiará · puedes editarlo<textarea ref={textarea} className="gpt-preview" value={prompt} onChange={e=>setPrompt(e.target.value)}/><small>Cambiar la acción, la pregunta o la privacidad requiere generar de nuevo el contexto.</small></label>}
 {error&&<p className="gpt-error" role="alert">{error}</p>}{notice&&<p className="gpt-notice" role="status">{notice} <a href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer">Abrir ChatGPT</a></p>}
 <footer><button type="button" className="gpt-primary" disabled={busy||!prompt.trim()} onClick={()=>void copy(true)}>Copiar y abrir ChatGPT</button><button type="button" disabled={busy||!prompt.trim()} onClick={()=>void copy(false)}>Copiar prompt</button></footer>
 <small>No se envía el contexto automáticamente. Pégalo tú en ChatGPT; las respuestas no modifican el OS.</small>
 </dialog></>;
}
