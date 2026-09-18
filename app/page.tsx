'use client';

import {useEffect, useMemo, useState} from 'react';
import {CalendarDays, Check, ChevronDown, CircleDollarSign, FileText, LayoutDashboard, Menu, Plus, Search, Settings, Sparkles, Target, UserRound, Users, Zap} from 'lucide-react';
import {createClient} from '@/lib/supabase/client';
import {responseJson} from '@/lib/response-json';
import {FinanceWorkspace} from '@/components/finance-workspace';
import {TaskInbox} from '@/components/task-inbox';
import {TasksWorkspace} from '@/components/tasks-workspace';
import {ProposalsWorkspace} from '@/components/proposals-workspace';
import {CrmSummary} from '@/components/crm-summary';
import {CrmWorkspace} from '@/components/crm-workspace';
import {TalentDirectory} from '@/components/talent-directory';
import {ArtistProfiles} from '@/components/artist-profiles';
import {EventBoard} from '@/components/event-board';
import {FinanceSummary} from '@/components/finance-summary';
import {ClientBoard} from '@/components/client-board';

type Section='Leads'|'Mi día'|'Clientes'|'Pipeline'|'Eventos'|'Talento'|'Shows'|'Equipo'|'Tareas'|'Propuestas'|'Pagos'|'Facturas';
type EventCard={id:string;title:string;client:string;date:string;city:string;venue:string;status:string;artists:number};
type Show={name:string;jobTitle:string;description:string};
const nav:[Section, typeof LayoutDashboard][]=[['Mi día',LayoutDashboard],['Clientes',Users],['Leads',Target],['Pipeline',Target],['Eventos',CalendarDays],['Talento',Sparkles],['Shows',Sparkles],['Equipo',UserRound],['Pagos',CircleDollarSign],['Tareas',Check],['Propuestas',FileText],['Facturas',CircleDollarSign]];

export default function Home(){
  const [access,setAccess]=useState<'checking'|'allowed'|'denied'>('checking');
  const [active,setActiveState]=useState<Section>('Mi día');
  const [query,setQuery]=useState('');
  const [menuOpen,setMenuOpen]=useState(false);
  const [events,setEvents]=useState<EventCard[]>([]);
  const [shows,setShows]=useState<Show[]>([]);
  const [tasks,setTasks]=useState<{id:string;text:string;done:boolean}[]>([]);
  const [quick,setQuick]=useState(false);
  const setActive=(section:Section)=>{setActiveState(section);history.replaceState(null,'',`/#${encodeURIComponent(section.toLowerCase())}`);};

  useEffect(()=>{let mounted=true;void (async()=>{try{const supabase=createClient();const {data:claims,error:claimsError}=await supabase.auth.getClaims();const userId=claims?.claims?.sub;if(claimsError||!userId)throw Error('no-session');const {data:member,error}=await supabase.from('organization_members').select('organization_id').eq('user_id',userId).limit(1).maybeSingle();if(error||!member)throw Error('no-membership');if(mounted)setAccess('allowed');}catch{if(mounted)setAccess('denied');}})();return()=>{mounted=false;};},[]);
  useEffect(()=>{const restore=()=>{try{setActiveState(nav.find(([name])=>name.toLowerCase()===decodeURIComponent(location.hash.slice(1)).toLowerCase())?.[0]||'Mi día');}catch{setActiveState('Mi día');}};restore();addEventListener('hashchange',restore);return()=>removeEventListener('hashchange',restore);},[]);
  useEffect(()=>{if(access!=='allowed')return;let mounted=true;void fetch('/api/event-board',{cache:'no-store'}).then(async r=>r.ok?responseJson(r):null).then(data=>{if(!mounted||!data)return;const clients=new Map<string,string>((data.clients||[]).map((c:{id:string;company_name:string})=>[c.id,c.company_name]));const assigned=new Map<string,number>();(data.assignments||[]).forEach((a:{event_id:string})=>assigned.set(a.event_id,(assigned.get(a.event_id)||0)+1));setEvents((data.events||[]).map((e:Record<string,unknown>)=>({id:String(e.id),title:String(e.event_name||''),client:clients.get(String(e.client_id))||'Sin cliente',date:String(e.event_date||''),city:String(e.city||''),venue:String(e.venue||''),status:String(e.status||'Sin estado'),artists:assigned.get(String(e.id))||0})).filter((e:EventCard)=>e.title&&e.date));setShows((data.shows||[]).map((s:{name:string;category?:string;description?:string})=>({name:s.name,jobTitle:s.category||'Sin categoría',description:s.description||''})));}).catch(()=>undefined);return()=>{mounted=false;};},[access]);
  useEffect(()=>{if(access!=='allowed')return;let mounted=true;void fetch('/api/work-tasks',{cache:'no-store'}).then(async r=>{const d=await responseJson(r);if(!r.ok)throw Error(d.error);return d;}).then(d=>{if(mounted)setTasks(d.data.filter((t:{deleted_at:string|null;status:string})=>!t.deleted_at&&t.status!=='cancelled').map((t:{id:string;title:string;status:string})=>({id:t.id,text:t.title,done:t.status==='done'})));}).catch(()=>undefined);return()=>{mounted=false;};},[access,active]);
  const visibleEvents=useMemo(()=>events.filter(e=>`${e.title} ${e.client} ${e.city} ${e.venue}`.toLowerCase().includes(query.toLowerCase())).slice(0,6),[events,query]);
  if(access!=='allowed')return <AccessGate checking={access==='checking'}/>;
  const addArtist=async()=>{const name=prompt('Nombre del artista o bailarín');if(!name?.trim())return;const category=prompt('Talento o disciplina')||'';const r=await fetch('/api/event-board',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'createTalent',real_name:name.trim(),category:category.trim()})});if(r.ok)setActive('Talento');};
  const addShow=async()=>{const name=prompt('Nombre del show o personaje');if(!name?.trim())return;const category=prompt('Categoría')||'Sin categoría',description=prompt('Descripción breve')||'';const r=await fetch('/api/event-board',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'createShow',name:name.trim(),category,description})});if(r.ok){setShows(current=>[...current,{name:name.trim(),jobTitle:category,description}]);setActive('Shows');}};
  const content=active==='Facturas'?<FinanceWorkspace query={query}/>:active==='Tareas'?<TasksWorkspace query={query}/>:active==='Propuestas'?<ProposalsWorkspace query={query}/>:active==='Leads'?<CrmWorkspace mode="leads" query={query}/>:active==='Pipeline'?<CrmWorkspace mode="opportunities" query={query}/>:active==='Clientes'?<ClientBoard query={query} onBack={()=>setActive('Mi día')}/>:active==='Talento'?<TalentDirectory query={query} onAdd={addArtist} onPayments={()=>setActive('Pagos')} onBack={()=>setActive('Mi día')}/>:active==='Pagos'?<ArtistProfiles query={query} onBack={()=>setActive('Mi día')}/>:active==='Eventos'?<EventBoard query={query} onBack={()=>setActive('Mi día')}/>:active==='Shows'?<ShowsModule shows={shows} query={query} onBack={()=>setActive('Mi día')} onAdd={addShow}/>:active==='Equipo'?<TeamModule onBack={()=>setActive('Mi día')}/>:null;
  return <main className="app-shell"><aside className={`sidebar ${menuOpen?'open':''}`}><div className="brand"><img src="/logo.png" alt="Performance Lab" className="brand-logo-img" style={{width:36,height:36,objectFit:'contain'}}/><div><strong>PERFORMANCE</strong><span>LAB OS</span></div></div><div className="workspace-switcher"><img src="/logo.png" alt="Performance Lab" style={{width:28,height:28,objectFit:'contain'}}/><div><b>Performance Lab</b><small>Espacio de trabajo</small></div><ChevronDown size={15}/></div><nav className="main-nav"><p className="nav-label">Espacio de trabajo</p>{nav.map(([label,Icon])=><button key={label} className={`nav-item ${active===label?'active':''}`} onClick={()=>{setActive(label);setMenuOpen(false);}}><Icon size={18}/><span>{label==='Facturas'?'Facturación & Gastos':label}</span>{label==='Tareas'&&<em>{tasks.filter(t=>!t.done).length}</em>}</button>)}</nav><div className="sidebar-bottom"><a className="nav-item" href="/auth"><Settings size={18}/><span>Conectar equipo</span></a></div></aside><section className="content-area"><header className="topbar"><button className="mobile-menu" aria-label="Abrir menú" onClick={()=>setMenuOpen(v=>!v)}><Menu size={22}/></button><div className="crumb"><span>Performance Lab</span><b>/</b><strong>{active}</strong></div><div className="top-actions"><div className="search-wrap"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar en tu espacio..." aria-label="Buscar"/></div><button className="primary-button" onClick={()=>setQuick(true)}><Plus size={16}/> Añadir</button><TaskInbox/></div></header><div className="page-content">{active==='Mi día'?<Dashboard events={visibleEvents} tasks={tasks} onEvents={()=>setActive('Eventos')}/>:content}</div></section>{quick&&<div className="modal-backdrop" onMouseDown={()=>setQuick(false)}><div className="quick-modal" onMouseDown={e=>e.stopPropagation()}><div className="modal-head"><div><p className="eyebrow">ACCIÓN RÁPIDA</p><h2>¿Qué quieres añadir?</h2></div><button className="close-button" onClick={()=>setQuick(false)}>×</button></div><div className="quick-modal-grid"><button onClick={()=>{setActive('Clientes');setQuick(false);}}><Users size={19}/><b>Cliente</b><span>Guardar una nueva relación comercial</span></button><button onClick={()=>{void addArtist();setQuick(false);}}><Sparkles size={19}/><b>Artista</b><span>Crear una ficha de talento</span></button><button onClick={()=>{setActive('Eventos');setQuick(false);}}><CalendarDays size={19}/><b>Evento</b><span>Abrir el panel de producción</span></button><button onClick={()=>{void addShow();setQuick(false);}}><Zap size={19}/><b>Show</b><span>Crear un show o personaje interno</span></button></div></div></div>}</main>;

}

function AccessGate({checking}:{checking:boolean}){return <main className="auth-page"><section className="auth-card"><div className="auth-icon"><Settings size={22}/></div><p className="eyebrow">ESPACIO PRIVADO</p><h1>Performance Lab OS</h1><p>{checking?'Comprobando tu acceso al espacio de trabajo…':'Este espacio contiene información interna. Inicia sesión con una cuenta del equipo para ver cualquier dato.'}</p>{!checking&&<a className="primary-button auth-submit" href="/auth">Iniciar sesión</a>}</section></main>}
function Dashboard({events,tasks,onEvents}:{events:EventCard[];tasks:{id:string;text:string;done:boolean}[];onEvents:()=>void}){return <><TaskInbox panel/><FinanceSummary/><div className="welcome-row"><div><p className="eyebrow">ESPACIO DE TRABAJO</p><h1>Buenos días <span>✦</span></h1><p className="subhead">Aquí tienes lo que necesita tu atención hoy.</p></div></div><div className="two-col"><section className="panel events-panel"><div className="panel-head"><div><h2>Últimos eventos</h2><p>Eventos reales enlazados, ordenados por fecha.</p></div><button className="text-button" onClick={onEvents}>Ver todos</button></div><div className="event-list">{events.map(event=><article className="event-row" key={event.id} role="button" tabIndex={0} onClick={onEvents}><div className="event-main"><div className="event-title-row"><h3>{event.title}</h3><span className={`status-pill ${event.status}`}>{event.status}</span></div><p>{event.client} · {event.date} · {event.city||'Sin ciudad'}</p><div className="event-meta"><span>⌖ {event.venue||'Venue pendiente'}</span><span className="artist-count"><Users size={13}/>{event.artists} artistas</span></div></div></article>)}{!events.length&&<p>No hay eventos registrados.</p>}</div></section><section className="panel tasks-panel"><div className="panel-head"><div><h2>Tareas del equipo</h2><p>{tasks.filter(t=>!t.done).length} abiertas</p></div></div><div className="task-list">{tasks.filter(t=>!t.done).slice(0,6).map(t=><div className="task-row" key={t.id}><span><b>{t.text}</b></span></div>)}{!tasks.some(t=>!t.done)&&<p>No hay tareas abiertas.</p>}</div></section></div><CrmSummary/></>}
function TeamModule({onBack}:{onBack:()=>void}){
 const members = [
  { name: 'Sara', role: 'Administradora / Dirección', email: 'admin@performancelab.es', color: 'purple', status: 'Activo' }
 ];
 return <div className="data-module">
  <div className="module-head">
   <div>
    <p className="eyebrow">ACCESOS DEL EQUIPO</p>
    <h1>Equipo</h1>
    <p>Integrantes del equipo de Performance Lab y sus roles asignados.</p>
   </div>
   <button className="primary-button" onClick={onBack}>Volver a Mi día</button>
  </div>
  <div className="team-grid">
   {members.map(member => (
    <article className="team-card" key={member.name}>
     <div className={`avatar ${member.color}`}>
      {member.name.slice(0, 1).toUpperCase()}
     </div>
     <div>
      <h3>{member.name}</h3>
      <p>{member.role}</p>
      <small>{member.email}</small>
     </div>
     <span className="status-pill confirmado">{member.status}</span>
    </article>
   ))}
  </div>
  <section className="team-invite">
   <div>
    <b>Gestionar accesos del equipo</b>
    <p>Las cuentas verificadas en Supabase con roles asignados (Admin, Productor, Ventas) tienen acceso a este espacio de trabajo.</p>
   </div>
   <a className="secondary-button" href="/auth">Abrir acceso del equipo</a>
  </section>
 </div>
}
function ShowsModule({shows,query,onBack,onAdd}:{shows:Show[];query:string;onBack:()=>void;onAdd:()=>void}){const [search,setSearch]=useState(query);useEffect(()=>setSearch(query),[query]);const items=shows.filter(show=>`${show.name} ${show.jobTitle} ${show.description}`.toLowerCase().includes(search.toLowerCase()));return <div className="data-module"><div className="module-head"><div><p className="eyebrow">CATÁLOGO INTERNO</p><h1>Shows y personajes</h1><p>{items.length} propuestas disponibles.</p></div><div className="module-actions"><button className="secondary-button" onClick={onAdd}>Nuevo show</button><button className="primary-button" onClick={onBack}>Volver a Mi día</button></div></div><label className="cb-search"><Search size={18}/><input type="search" placeholder="Buscar shows…" value={search} onChange={e=>setSearch(e.target.value)}/></label><div className="catalogue-grid">{items.map(item=><article className="catalogue-card" key={`${item.name}-${item.jobTitle}`}><div className="catalogue-tag">{item.jobTitle}</div><h3>{item.name}</h3><p>{item.description||'Sin descripción todavía.'}</p></article>)}</div></div>}
