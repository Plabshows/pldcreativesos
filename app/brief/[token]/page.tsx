import {createClient} from '@/lib/supabase/server';
import {fieldLabels,type Section,type KitDocument} from '@/lib/show-kit';
import {notFound} from 'next/navigation';
export const dynamic='force-dynamic';
export const metadata={title:'Performance Lab · Ficha compartida',robots:{index:false,follow:false}};
export default async function Brief({params}:{params:Promise<{token:string}>}){
 const {token}=await params;if(!/^[0-9a-f-]{36}$/i.test(token))notFound();
 const db=await createClient(),r=await db.rpc('read_show_kit_share',{share_token:token});if(r.error||!r.data)notFound();
 const doc=r.data as {name:string;audience:string;event?:{event_name:string;event_date:string;venue:string;city:string;artist:string};sections:{section:Section;document:KitDocument}[]};
 return <main style={{maxWidth:760,margin:'auto',padding:24,fontFamily:'sans-serif'}}><p>PERFORMANCE LAB</p><h1>{doc.name}</h1><p>{doc.audience==='artist'?'Instrucciones para el artista':'Material para cliente'}</p>{doc.event&&<section><h2>{doc.event.event_name}</h2><p>{doc.event.artist}</p><p>{doc.event.event_date} · {doc.event.venue} · {doc.event.city}</p></section>}{doc.sections.map(s=><section key={s.section}>{Object.entries(s.document.fields).map(([key,value])=>value&&<div key={key}><h3>{fieldLabels[s.section]?.[key]||key}</h3><p style={{whiteSpace:'pre-wrap'}}>{value}</p></div>)}{s.document.assets.map(a=><article key={a.id}>{a.kind==='image'&&/^https?:/.test(a.url)&&<img src={a.url} alt={a.label} style={{width:'100%',borderRadius:12}}/>}{/^https?:/.test(a.url)&&<a href={a.url} target="_blank" rel="noreferrer">{a.label||'Ver material'}</a>}</article>)}</section>)}<footer>Ficha compartida · enlace temporal. Consulta con producción cualquier dato pendiente.</footer></main>;
}
