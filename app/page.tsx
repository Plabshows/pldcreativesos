'use client';
import { EventBoard } from '@/components/event-board';
import { FinanceSummary } from '@/components/finance-summary';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity, ArrowUpRight, Bell, CalendarDays, Check, ChevronDown, CircleDollarSign,
  Clock3, FileText, Filter, LayoutDashboard, Menu, Plus, Search, Settings,
  Sparkles, Target, UserRound, Users, X, Zap,
} from 'lucide-react';
import { importedArtists, importedClients } from './imported-data-fixed';
import { importedEvents } from './imported-events';
import { importedExpenses } from './imported-expenses';
import { catalogueItems } from './catalogue-full';
import { ClientBoard } from '@/components/client-board';

type Section = 'Mi día' | 'Clientes' | 'Pipeline' | 'Eventos' | 'Talento' | 'Shows' | 'Equipo' | 'Tareas' | 'Propuestas';
type EventHealth = 'green' | 'orange' | 'red';

const nav: { label: Section; icon: typeof LayoutDashboard }[] = [
  { label: 'Mi día', icon: LayoutDashboard },
  { label: 'Clientes', icon: Users },
  { label: 'Pipeline', icon: Target },
  { label: 'Eventos', icon: CalendarDays },
  { label: 'Talento', icon: Sparkles },
  { label: 'Shows', icon: Sparkles },
  { label: 'Equipo', icon: UserRound },
  { label: 'Tareas', icon: Check },
  { label: 'Propuestas', icon: FileText },
];

const events: { id: string; title: string; client: string; date: string; time: string; city: string; venue: string; status: string; health: EventHealth; artists: number; issue: string }[] = importedEvents.map((event) => ({ id: String(event.id), title: String(event.show || event.detail || 'Evento'), client: String(event.client || 'Sin cliente'), date: String(event.date || ''), time: '', city: '', venue: '', status: String(event.status || 'Sin estado'), health: String(event.status) === 'Cancelado' ? 'red' : String(event.status) === 'Confirmado' ? 'orange' : 'green', artists: event.artists ? String(event.artists).split(',').filter(Boolean).length : 0, issue: '' }));

const pipeline: { label: string; color: string; count: number; value: string; cards: string[] }[] = [];

const initialTasks: { text: string; meta: string; priority: string; done: boolean }[] = [];

type TeamMember = { id: string; name: string; email: string; role: string; color: string };
type ClientRecord = { name: string; contact: string; phone: string; email: string; type: string; city: string };
type ArtistRecord = { name: string; category: string; subcategory: string; city: string; phone: string; email: string; fee: string; notes: string };
type ShowRecord = { name: string; jobTitle: string; description: string; url?: string };
type EventMeta = { paid?: boolean; artists?: string[]; talent?: string; wardrobe?: string; notes?: string; city?: string; venue?: string };
type ExpenseRecord = { id?: string | null; date?: string | null; eventId?: string | null; eventName?: string | null; artist?: string | null; amount?: number | null; paymentStatus?: string | null };
const initialTeam: TeamMember[] = [
  { id: 'manuel', name: 'Manuel', email: 'plabcreativesos@gmail.com', role: 'Administrador', color: 'coral' },
];

function HealthDot({ health }: { health: EventHealth }) {
  return <span className={`health-dot ${health}`} aria-label={health === 'green' ? 'Todo listo' : health === 'orange' ? 'Pendiente' : 'Problema'} />;
}

export default function Home() {
  const [active, setActiveState] = useState<Section>('Mi día');
  const setActive = (section: Section) => {
    setActiveState(section);
    const hash = encodeURIComponent(section.toLowerCase());
    if (window.location.hash !== '#' + hash) window.history.pushState(null, '', '#' + hash);
  };
  useEffect(() => {
    const restoreSection = () => {
      let value = '';
      try { value = decodeURIComponent(window.location.hash.slice(1)).toLowerCase(); } catch {}
      const section = nav.find(item => item.label.toLowerCase() === value)?.label || 'Mi día';
      setActiveState(section);
    };
    restoreSection();
    window.addEventListener('popstate', restoreSection);
    window.addEventListener('hashchange', restoreSection);
    return () => {
      window.removeEventListener('popstate', restoreSection);
      window.removeEventListener('hashchange', restoreSection);
    };
  }, []);
  const [tasks, setTasks] = useState(initialTasks);
  const [query, setQuery] = useState('');
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [clients, setClients] = useState<ClientRecord[]>(() => [...importedClients]);
  const [artists, setArtists] = useState<ArtistRecord[]>(() => [...importedArtists]);
  const [eventMeta, setEventMeta] = useState<Record<string, EventMeta>>({});
  const [customShows, setCustomShows] = useState<ShowRecord[]>([]);
  const [team] = useState(initialTeam);

  useEffect(() => {
    const savedClients = window.localStorage.getItem('plab-clients');
    const savedArtists = window.localStorage.getItem('plab-artists');
    const savedEventMeta = window.localStorage.getItem('plab-event-meta');
    const savedShows = window.localStorage.getItem('plab-custom-shows');
    if (savedClients) setClients(JSON.parse(savedClients));
    if (savedArtists) setArtists(JSON.parse(savedArtists));
    if (savedEventMeta) setEventMeta(JSON.parse(savedEventMeta));
    if (savedShows) setCustomShows(JSON.parse(savedShows));
  }, []);
  useEffect(() => { window.localStorage.setItem('plab-clients', JSON.stringify(clients)); }, [clients]);
  useEffect(() => { window.localStorage.setItem('plab-artists', JSON.stringify(artists)); }, [artists]);
  useEffect(() => { window.localStorage.setItem('plab-event-meta', JSON.stringify(eventMeta)); }, [eventMeta]);
  useEffect(() => { window.localStorage.setItem('plab-custom-shows', JSON.stringify(customShows)); }, [customShows]);

  const addClient = () => { setActive('Clientes'); setQuery(''); };
  const addArtist = () => {
    const name = window.prompt('Nombre del artista o bailarín');
    if (!name?.trim()) return;
    setArtists((current) => [...current, { name: name.trim(), category: '', subcategory: '', city: '', phone: '', email: '', fee: '', notes: '' }]);
    setActive('Talento');
  };
  const addShow = () => {
    const name = window.prompt('Nombre del show o personaje');
    if (!name?.trim()) return;
    const category = window.prompt('Categoría (por ejemplo: Acrobacia, Baile, Personaje)') || 'Sin categoría';
    const description = window.prompt('Descripción breve') || '';
    setCustomShows((current) => [...current, { name: name.trim(), jobTitle: category.trim(), description: description.trim() }]);
    setActive('Shows');
  };
  const chooseAdd = (action: () => void) => { setAddMenuOpen(false); action(); };

  const filteredEvents = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matches = !needle ? events : events.filter((event) => `${event.title} ${event.client} ${event.city}`.toLowerCase().includes(needle));
    return matches.slice(-6).reverse();
  }, [query]);

  const completed = tasks.filter((task) => task.done).length;

  return (
    <main className="app-shell">
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="brand"><div className="brand-mark">PL</div><div><strong>PERFORMANCE</strong><span>LAB OS</span></div></div>
        <div className="workspace-switcher"><div className="avatar">M</div><div><b>Performance Lab</b><small>Espacio de trabajo</small></div><ChevronDown size={15} /></div>
        <nav className="main-nav" aria-label="Navegación principal">
          <p className="nav-label">Espacio de trabajo</p>
          {nav.map(({ label, icon: Icon }) => <button key={label} className={`nav-item ${active === label ? 'active' : ''}`} onClick={() => { setActive(label); setMenuOpen(false); }}><Icon size={18} strokeWidth={active === label ? 2.4 : 1.8} /><span>{label}</span>{label === 'Tareas' && <em>{tasks.filter((t) => !t.done).length}</em>}</button>)}
          <p className="nav-label second">Recursos</p>
          <button className="nav-item muted" onClick={() => setActive('Propuestas')}><Zap size={18} /><span>Conceptos</span><small>Próximamente</small></button>
          <button className="nav-item muted" onClick={() => setActive('Propuestas')}><CircleDollarSign size={18} /><span>Pagos</span><small>Próximamente</small></button>
        </nav>
        <div className="sidebar-bottom"><a className="nav-item" href="/auth"><Settings size={18} /><span>Conectar equipo</span></a><div className="user-card"><div className="avatar coral">M</div><div><b>Manuel</b><small>Administrador</small></div><button aria-label="Más opciones"><ChevronDown size={14} /></button></div></div>
      </aside>

      <section className="content-area">
        <header className="topbar"><button className="mobile-menu" aria-label="Abrir menú" onClick={() => setMenuOpen(!menuOpen)}><Menu size={22} /></button><div className="crumb"><span>Performance Lab</span><b>/</b><strong>{active}</strong></div><div className="top-actions"><div className="search-wrap"><Search size={17} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar en tu espacio..." aria-label="Buscar" /><kbd>⌘ K</kbd></div><div className="add-menu"><button className="primary-button add-menu-trigger" aria-expanded={addMenuOpen} onClick={() => setAddMenuOpen((open) => !open)}><Plus size={16} /> Añadir <ChevronDown size={14} /></button>{addMenuOpen && <div className="add-menu-panel"><button onClick={() => chooseAdd(addClient)}><Users size={17} /><span><b>Cliente</b><small>Crear una ficha comercial</small></span></button><button onClick={() => chooseAdd(addArtist)}><Sparkles size={17} /><span><b>Artista o bailarín</b><small>Añadir talento a la base</small></span></button><button onClick={() => chooseAdd(() => setActive('Eventos'))}><CalendarDays size={17} /><span><b>Evento</b><small>Abrir el panel de producción</small></span></button><button onClick={() => chooseAdd(addShow)}><Zap size={17} /><span><b>Show o personaje</b><small>Crear una propuesta interna</small></span></button><button onClick={() => chooseAdd(() => setActive('Tareas'))}><Check size={17} /><span><b>Tarea</b><small>Organizar trabajo del equipo</small></span></button></div>}</div><button className="icon-button" aria-label="Notificaciones"><Bell size={18} /><i /></button><div className="top-avatar">M</div></div></header>

        <div className="page-content">
          {active === 'Mi día' ? <>
            <FinanceSummary />
            <div className="welcome-row"><div><p className="eyebrow">MARTES, 9 DE SEPTIEMBRE DE 2026</p><h1>Buenos días, Manuel <span>✦</span></h1><p className="subhead">Aquí tienes lo que necesita tu atención hoy.</p></div><button className="primary-button" onClick={() => setShowQuickAdd(true)}><Plus size={17} /> Añadir rápido</button></div>


            <div className="two-col"><section className="panel events-panel" id="events"><div className="panel-head"><div><h2>Próximos eventos</h2><p>La producción de las próximas semanas.</p></div><button className="text-button" onClick={() => setActive('Eventos')}>Ver todos <ArrowUpRight size={14} /></button></div><div className="event-list">{filteredEvents.map((event, index) => <article className="event-row" key={`${event.id}-${index}`}><div className="event-date"><b>{event.date.split(' ')[0]}</b><span>{event.date.split(' ')[1]}</span></div><div className="event-main"><div className="event-title-row"><h3>{event.title}</h3><span className={`status-pill ${event.status.toLowerCase()}`}>{event.status}</span></div><p>{event.client} <span>·</span> {event.time} · {event.city}</p><div className="event-meta"><span><span className="mini-pin">⌖</span>{event.venue}</span><span className="artist-count"><Users size={13} />{event.artists || '—'} artistas</span></div></div><div className="health"><HealthDot health={event.health} /><span>{event.issue}</span></div><button className="row-more" aria-label={`Abrir ${event.title}`}>•••</button></article>)}</div></section>

              <section className="panel tasks-panel"><div className="panel-head"><div><h2>Tareas prioritarias</h2><p>{completed === tasks.length ? 'Todo completado. Buen trabajo.' : `${tasks.length - completed} pendientes para hoy.`}</p></div><button className="round-add" aria-label="Añadir tarea" onClick={() => setShowQuickAdd(true)}><Plus size={16} /></button></div><div className="task-progress"><span><b>{completed}</b> de {tasks.length} completadas</span><div><i style={{ width: `${(completed / tasks.length) * 100}%` }} /></div></div><div className="task-list">{tasks.map((task, index) => <label className={`task-row ${task.done ? 'done' : ''}`} key={task.text}><button className="task-check" aria-label={task.done ? 'Marcar pendiente' : 'Completar tarea'} onClick={() => setTasks(tasks.map((item, i) => i === index ? { ...item, done: !item.done } : item))}>{task.done && <Check size={13} />}</button><span><b>{task.text}</b><small>{task.meta}</small></span><em className={task.priority.toLowerCase()}>{task.priority}</em></label>)}</div><button className="panel-footer-button" onClick={() => setActive('Tareas')}>Abrir lista de tareas <ArrowUpRight size={14} /></button></section></div>

            <section className="panel pipeline-panel" id="pipeline"><div className="panel-head"><div><h2>Pipeline comercial</h2><p>Una vista rápida de tus oportunidades activas.</p></div><button className="text-button" onClick={() => setActive('Pipeline')}>Abrir pipeline <ArrowUpRight size={14} /></button></div><div className="pipeline-board">{pipeline.map((stage) => <div className="pipeline-stage" key={stage.label}><div className="stage-head"><span><i style={{ background: stage.color }} />{stage.label}</span><b>{stage.count}</b></div><div className="stage-value">{stage.value}</div>{stage.cards.map((card) => <button className="deal-card" key={card} onClick={() => setActive('Clientes')}><span className="deal-dot" style={{ background: stage.color }} />{card}<ArrowUpRight size={13} /></button>)}</div>)}</div></section>

            <div className="bottom-grid"><section className="insight-card"><div className="insight-orb"><Sparkles size={19} /></div><div><p className="eyebrow">LAB INSIGHT</p><h3>Dashboard listo para tus datos</h3><p>Los datos de ejemplo se han retirado. Añade clientes, artistas y eventos para activar los indicadores.</p><button onClick={() => setActive('Talento')}>Abrir artistas <ArrowUpRight size={14} /></button></div></section><section className="quick-card"><div className="quick-title"><h2>Acciones rápidas</h2><span>Atajos</span></div><div className="quick-actions"><button onClick={() => setShowQuickAdd(true)}><Plus size={16} /><span>Nuevo cliente</span><kbd>N C</kbd></button><button onClick={() => setActive('Eventos')}><CalendarDays size={16} /><span>Crear evento</span><kbd>N E</kbd></button><button onClick={() => setActive('Propuestas')}><FileText size={16} /><span>Nueva propuesta</span><kbd>N P</kbd></button></div></section></div>
          </> : active === 'Clientes' ? <ClientBoard query={query} onBack={() => setActive('Mi día')} /> : active === 'Talento' ? <TalentModule query={query} artists={artists} meta={eventMeta} onAdd={(artist) => setArtists((current) => [...current, artist])} onBack={() => setActive('Mi día')} /> : active === 'Eventos' ? <EventBoard query={query} onBack={() => setActive('Mi día')} /> : active === 'Shows' ? <ShowsModule query={query} customShows={customShows} onAdd={addShow} onBack={() => setActive('Mi día')} /> : active === 'Equipo' ? <TeamModule team={team} onBack={() => setActive('Mi día')} /> : <ModulePlaceholder section={active} onBack={() => setActive('Mi día')} />}
        </div>
      </section>
      {showQuickAdd && <div className="modal-backdrop" onMouseDown={() => setShowQuickAdd(false)}><div className="quick-modal" onMouseDown={(e) => e.stopPropagation()}><div className="modal-head"><div><p className="eyebrow">ACCIÓN RÁPIDA</p><h2>¿Qué quieres añadir?</h2></div><button className="close-button" onClick={() => setShowQuickAdd(false)} aria-label="Cerrar"><X size={18} /></button></div><div className="quick-modal-grid"><button onClick={() => { addClient(); setShowQuickAdd(false); }}><Users size={19} /><b>Cliente</b><span>Guardar una nueva relación comercial</span></button><button onClick={() => { addArtist(); setShowQuickAdd(false); }}><Sparkles size={19} /><b>Artista</b><span>Crear una ficha de talento</span></button><button onClick={() => { setActive('Eventos'); setShowQuickAdd(false); }}><CalendarDays size={19} /><b>Evento</b><span>Abrir el panel de producción</span></button><button onClick={() => { addShow(); setShowQuickAdd(false); }}><Zap size={19} /><b>Show</b><span>Crear un show o personaje interno</span></button></div></div></div>}
    </main>
  );
}

function ClientsModule({ query, clients, onAdd, onBack }: { query: string; clients: readonly ClientRecord[]; onAdd: (client: ClientRecord) => void; onBack: () => void }) {
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const needle = query.trim().toLowerCase();
  const filtered = clients.filter((client) => !needle || (client.name + ' ' + client.contact + ' ' + client.email + ' ' + client.city + ' ' + client.type).toLowerCase().includes(needle));
  const clientEvents = selectedClient ? importedEvents.filter((event) => String(event.client || '').toLowerCase() === selectedClient.toLowerCase()) : [];
  const total = clientEvents.reduce((sum, event) => sum + (typeof event.income === 'number' ? event.income : 0), 0);
  const pending = clientEvents.filter((event) => String(event.collected || '').toLowerCase() !== 'sí').reduce((sum, event) => sum + (typeof event.income === 'number' ? event.income : 0), 0);
  const add = () => { const name = window.prompt('Nombre del nuevo cliente'); if (name?.trim()) onAdd({ name: name.trim(), contact: '', phone: '', email: '', type: 'Otro', city: '' }); };
  return <div className="data-module"><div className="module-head"><div><p className="eyebrow">BASE DE DATOS COMERCIAL</p><h1>Clientes</h1><p>Fichas comerciales conectadas a todos sus eventos y facturación.</p></div><div className="module-actions"><button className="secondary-button" onClick={add}><Plus size={15} /> Nuevo cliente</button><button className="primary-button" onClick={onBack}>Volver a Mi día</button></div></div><div className="data-toolbar"><span>{clients.length} clientes</span><span>Importados desde IBIZA_2026_PRO</span></div><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Cliente</th><th>Contacto</th><th>Tipo</th><th>Ciudad</th><th>Eventos</th><th>Facturación</th><th>Ficha</th></tr></thead><tbody>{filtered.map((client) => { const linked = importedEvents.filter((event) => String(event.client || '').toLowerCase() === client.name.toLowerCase()); const revenue = linked.reduce((sum, event) => sum + (typeof event.income === 'number' ? event.income : 0), 0); return <tr key={client.name + '-' + client.email}><td><b>{client.name}</b><small>{client.email || client.phone || ''}</small></td><td>{client.contact || '—'}</td><td>{client.type || '—'}</td><td>{client.city || '—'}</td><td>{linked.length}</td><td>{revenue.toLocaleString('es-ES')} €</td><td><button className="text-button" onClick={() => setSelectedClient(client.name)}>Abrir ficha</button></td></tr>; })}</tbody></table></div>{selectedClient && <section className="profile-panel"><div className="panel-head"><div><p className="eyebrow">FICHA DE CLIENTE</p><h2>{selectedClient}</h2><p>{clientEvents.length} trabajos registrados.</p></div><button className="text-button" onClick={() => setSelectedClient(null)}>Cerrar</button></div><div className="profile-metrics"><div><span>Facturación total</span><b>{total.toLocaleString('es-ES')} €</b></div><div><span>Pendiente de cobro</span><b>{pending.toLocaleString('es-ES')} €</b></div><div><span>Eventos realizados</span><b>{clientEvents.filter((event) => event.status === 'Realizado').length}</b></div></div><div className="history-list">{clientEvents.map((event, index) => <div className="history-row" key={String(event.id) + '-' + index}><b>{event.date || 'Sin fecha'}</b><span>{event.show || event.detail || 'Evento'}</span><span>{event.artists || 'Sin artistas'}</span><em>{event.status || 'Sin estado'}</em></div>)}</div></section>}</div>;
}
function TalentModule({ query, artists, meta, onAdd, onBack }: { query: string; artists: readonly ArtistRecord[]; meta: Record<string, EventMeta>; onAdd: (artist: ArtistRecord) => void; onBack: () => void }) {
  const [selectedArtist, setSelectedArtist] = useState<string | null>(null);
  const needle = query.trim().toLowerCase();
  const filtered = artists.filter((artist) => !needle || (artist.name + ' ' + artist.category + ' ' + artist.subcategory + ' ' + artist.city + ' ' + artist.email).toLowerCase().includes(needle));
  const normalize = (value: string) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(' ')[0];
  const artistEvents = selectedArtist ? importedEvents.filter((event, index) => { const key = String(event.id) + '-' + String(event.date) + '-' + index; const assigned = meta[key]?.artists || String(event.artists || '').split(','); return assigned.join(' ').toLowerCase().includes(selectedArtist.toLowerCase()) || assigned.join(' ').toLowerCase().includes(normalize(selectedArtist)); }) : [];
  const artistPayments: ExpenseRecord[] = selectedArtist ? (importedExpenses as unknown as ExpenseRecord[]).filter((expense) => normalize(String(expense.artist || '')).includes(normalize(selectedArtist)) || normalize(selectedArtist).includes(normalize(String(expense.artist || '')))) : [];
  const paid = artistPayments.filter((payment) => String(payment.paymentStatus || '').toLowerCase() === 'pagado').reduce((sum, payment) => sum + (typeof payment.amount === 'number' ? payment.amount : 0), 0);
  const pending = artistPayments.filter((payment) => String(payment.paymentStatus || '').toLowerCase() !== 'pagado').reduce((sum, payment) => sum + (typeof payment.amount === 'number' ? payment.amount : 0), 0);
  const add = () => { const name = window.prompt('Nombre del artista'); if (name?.trim()) onAdd({ name: name.trim(), category: '', subcategory: '', city: 'Ibiza', phone: '', email: '', fee: '', notes: '' }); };
  return <div className="data-module"><div className="module-head"><div><p className="eyebrow">TALENTO Y PRODUCCIÓN</p><h1>Artistas y bailarines</h1><p>Fichas de talento conectadas a trabajos, pagos, especialidades y vestuario.</p></div><div className="module-actions"><button className="secondary-button" onClick={add}><Plus size={15} /> Nuevo artista</button><button className="primary-button" onClick={onBack}>Volver a Mi día</button></div></div><div className="artist-stats"><div><b>{artists.length}</b><span>perfiles</span></div><div><b>{artists.filter((artist) => artist.city.toLowerCase().includes('ibiza')).length}</b><span>con base en Ibiza</span></div><div><b>{artists.filter((artist) => artist.email).length}</b><span>con email</span></div></div><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Artista</th><th>Talento</th><th>Especialidad</th><th>Base</th><th>Contacto</th><th>Trabajos</th><th>Ficha</th></tr></thead><tbody>{filtered.map((artist) => { const works = importedEvents.filter((event, index) => { const key = String(event.id) + '-' + String(event.date) + '-' + index; const assigned = meta[key]?.artists || String(event.artists || '').split(','); return assigned.join(' ').toLowerCase().includes(artist.name.toLowerCase()) || assigned.join(' ').toLowerCase().includes(normalize(artist.name)); }); return <tr key={artist.name + '-' + artist.email}><td><b>{artist.name}</b><small>{artist.email || artist.phone || ''}</small></td><td>{artist.category || '—'}</td><td>{artist.subcategory || '—'}</td><td>{artist.city || '—'}</td><td>{artist.phone || '—'}</td><td>{works.length}</td><td><button className="text-button" onClick={() => setSelectedArtist(artist.name)}>Abrir ficha</button></td></tr>; })}</tbody></table></div>{selectedArtist && <section className="profile-panel artist-profile"><div className="panel-head"><div><p className="eyebrow">FICHA DE TALENTO</p><h2>{selectedArtist}</h2><p>{artistEvents.length} trabajos y {artistPayments.length} pagos asociados.</p></div><button className="text-button" onClick={() => setSelectedArtist(null)}>Cerrar</button></div><div className="profile-metrics"><div><span>Trabajos</span><b>{artistEvents.length}</b></div><div><span>Pagado</span><b>{paid.toLocaleString('es-ES')} €</b></div><div><span>Pendiente</span><b>{pending.toLocaleString('es-ES')} €</b></div></div><h3 className="profile-section-title">Historial de trabajos</h3><div className="history-list">{artistEvents.map((event, index) => <div className="history-row" key={String(event.id) + '-' + index}><b>{event.date || 'Sin fecha'}</b><span>{event.client || 'Sin cliente'}</span><span>{event.show || event.detail || 'Evento'}</span><em>{event.status || 'Sin estado'}</em></div>)}</div><h3 className="profile-section-title">Pagos</h3><div className="history-list">{artistPayments.map((payment, index) => <div className="history-row" key={String(payment.id) + '-' + index}><b>{payment.date || 'Sin fecha'}</b><span>{payment.eventName || payment.eventId || 'Evento'}</span><span>{typeof payment.amount === 'number' ? payment.amount.toLocaleString('es-ES') + ' €' : '—'}</span><em>{payment.paymentStatus || 'Pendiente'}</em></div>)}</div></section>}</div>;
}
function TeamModule({ team, onBack }: { team: TeamMember[]; onBack: () => void }) { return <div className="data-module"><div className="module-head"><div><p className="eyebrow">ACCESOS DEL EQUIPO</p><h1>Equipo</h1><p>Cada persona tendrá su propio perfil, rol y permisos dentro del espacio.</p></div><button className="primary-button" onClick={onBack}>Volver a Mi día</button></div><div className="team-grid">{team.map((member) => <article className="team-card" key={member.id}><div className={`avatar ${member.color}`}>{member.name.slice(0, 1).toUpperCase()}</div><div><h3>{member.name}</h3><p>{member.role}</p><small>{member.email || 'Invitación pendiente'}</small></div><span className="status-pill confirmado">Activo</span></article>)}</div><div className="team-invite"><div><b>Invitar a otra persona</b><p>El siguiente paso será enviar una invitación y asignar permisos de administración, producción, ventas o vestuario.</p></div><button className="secondary-button" onClick={() => window.alert('La invitación por email se activará al conectar el inicio de sesión de Supabase.')}>Invitar miembro</button></div></div>;
}

function EventsModule({ query, artists, meta, onMetaChange, onBack }: { query: string; artists: readonly ArtistRecord[]; meta: Record<string, EventMeta>; onMetaChange: (next: Record<string, EventMeta>) => void; onBack: () => void }) {
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const needle = query.trim().toLowerCase();
  const statuses = ['Todos', 'Confirmado', 'Propuesta', 'Realizado', 'Facturado', 'Cancelado', 'Sin estado'];
  const eventKey = (event: typeof importedEvents[number], index: number) => String(event.id) + '-' + String(event.date) + '-' + index;
  const dateValue = (value: unknown) => { const raw = String(value || ''); const iso = raw.match(/^\d{4}-\d{2}-\d{2}/); if (iso) return new Date(raw.slice(0, 10) + 'T00:00:00').getTime(); const es = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/); return es ? new Date(es[3] + '-' + es[2] + '-' + es[1] + 'T00:00:00').getTime() : 0; };
  const rows = importedEvents.map((event, index) => ({ event, index, key: eventKey(event, index) })).filter(({ event }) => { const status = String(event.status || 'Sin estado'); return (statusFilter === 'Todos' || status === statusFilter) && (!needle || Object.values(event).join(' ').toLowerCase().includes(needle)); }).sort((a, b) => dateValue(a.event.date) - dateValue(b.event.date));
  const groups = [{ label: 'Confirmado', items: rows.filter(({ event }) => !['Realizado', 'Facturado', 'Cancelado'].includes(String(event.status || 'Sin estado'))) }, { label: 'Completado', items: rows.filter(({ event }) => ['Realizado', 'Facturado'].includes(String(event.status || 'Sin estado'))) }, { label: 'Cancelado', items: rows.filter(({ event }) => String(event.status || '') === 'Cancelado') }].filter((group) => group.items.length);
  const selected = (rows.find((row) => row.key === selectedKey) || importedEvents.map((event, index) => ({ event, index, key: eventKey(event, index) })).find((row) => row.key === selectedKey)) as { event: typeof importedEvents[number]; index: number; key: string };
  const update = (key: string, patch: EventMeta) => onMetaChange({ ...meta, [key]: { ...meta[key], ...patch } });
  const artistsFor = (event: typeof importedEvents[number], key: string) => meta[key]?.artists || String(event.artists || '').split(',').map((item) => item.trim()).filter(Boolean);
  const money = (value: unknown) => typeof value === 'number' ? value.toLocaleString('es-ES') + ' €' : '—';
  const addArtist = (key: string, event: typeof importedEvents[number]) => { const name = window.prompt('Nombre del artista a asignar'); if (!name?.trim()) return; update(key, { artists: [...artistsFor(event, key), name.trim()] }); };
  if (false) {
  return <div className="data-module events-board"><div className="module-head"><div><p className="eyebrow">PANEL OPERATIVO</p><h1>Eventos</h1><p>Producción, artistas, talento, vestuario y pagos en una misma ficha.</p></div><button className="primary-button" onClick={onBack}>Volver a Mi día</button></div><div className="events-toolbar"><div className="events-filters">{statuses.map((status) => <button key={status} className={'filter-chip ' + (statusFilter === status ? 'active' : '')} onClick={() => setStatusFilter(status)}>{status}</button>)}</div><span className="board-count">{rows.length} eventos</span></div><div className="events-board-head"><span>Evento</span><span>Cliente</span><span>Producción</span><span>Ingresos</span><span>Coste</span><span>Cobro</span><span>Estado</span></div>{groups.map((group) => <section className="event-group" key={group.label}><div className="event-group-title"><b>{group.label}</b><span>{group.items.length}</span></div><div className="event-board-list">{group.items.map(({ event, index, key }) => <article className="event-board-row" key={key}><button className="event-cell event-primary event-open-cell" onClick={() => setSelectedKey(key)}><span className="event-board-date">{event.date || 'Sin fecha'}</span><b>{event.id}</b><strong>{event.detail || event.show || 'Evento sin detalle'}</strong></button><div className="event-cell"><b>{event.client || 'Sin cliente'}</b><small>{event.clientType || '—'}</small></div><div className="event-cell"><span>{meta[key]?.talent || event.show || '—'}</span><small>{artistsFor(event, key).join(', ') || 'Sin artistas asignados'}</small></div><div className="event-cell money">{money(event.income)}</div><div className="event-cell money">{money(event.totalCost)}</div><div className="event-cell"><button className={'payment-toggle ' + (meta[key]?.paid || String(event.collected || '').toLowerCase() === 'sí' ? 'paid' : '')} onClick={() => update(key, { paid: !(meta[key]?.paid || String(event.collected || '').toLowerCase() === 'sí') })}>{meta[key]?.paid || String(event.collected || '').toLowerCase() === 'sí' ? 'Pagado' : 'Pendiente'}</button><small>{event.invoice || ''}</small></div><div className="event-cell"><span className={'status-pill ' + String(event.status || 'sin-estado').toLowerCase().replace(' ', '-')}>{event.status || 'Sin estado'}</span></div></article>)}</div></section>)}{selected && <section className="event-detail"><div className="panel-head"><div><p className="eyebrow">FICHA DE EVENTO</p><h2>{selected.event.detail || selected.event.show || selected.event.id}</h2><p>{selected.event.date || 'Sin fecha'} · {selected.event.client || 'Sin cliente'}</p></div><button className="text-button" onClick={() => setSelectedKey(null)}>Cerrar</button></div><div className="detail-grid"><div><span>Artistas asignados</span><div className="assignment-chips">{artistsFor(selected.event, selected.key).map((artist) => <b key={artist}>{artist}</b>)}<button onClick={() => addArtist(selected.key, selected.event)}>+ Añadir</button></div></div><div><span>Talento / performance</span><button className="detail-edit" onClick={() => { const value = window.prompt('Tipo de performance', meta[selected.key]?.talent || String(selected.event.show || '')); if (value !== null) update(selected.key, { talent: value }); }}>{meta[selected.key]?.talent || selected.event.show || 'Definir performance'}</button></div><div><span>Vestuario</span><button className="detail-edit" onClick={() => { const value = window.prompt('Vestuario y necesidades', meta[selected.key]?.wardrobe || ''); if (value !== null) update(selected.key, { wardrobe: value }); }}>{meta[selected.key]?.wardrobe || 'Añadir vestuario'}</button></div><div><span>Notas de producción</span><button className="detail-edit" onClick={() => { const value = window.prompt('Notas de producción', meta[selected.key]?.notes || String(selected.event.notes || '')); if (value !== null) update(selected.key, { notes: value }); }}>{meta[selected.key]?.notes || selected.event.notes || 'Añadir notas'}</button></div></div><div className="detail-finance"><div><span>Ingreso</span><b>{money(selected.event.income)}</b></div><div><span>Coste</span><b>{money(selected.event.totalCost)}</b></div><div><span>Beneficio</span><b>{money(selected.event.profit)}</b></div><button className={'payment-toggle ' + (meta[selected.key]?.paid || String(selected.event.collected || '').toLowerCase() === 'sí' ? 'paid' : '')} onClick={() => update(selected.key, { paid: !(meta[selected.key]?.paid || String(selected.event.collected || '').toLowerCase() === 'sí') })}>{meta[selected.key]?.paid || String(selected.event.collected || '').toLowerCase() === 'sí' ? 'Cobrado / pagado' : 'Marcar como pagado'}</button></div></section>}<p className="source-note">Los cambios de producción y pagos se guardan en este dispositivo. Los registros del Excel se mantienen intactos.</p></div>;
  }
  return <div className="data-module events-board monday-events"><div className="module-head"><div><p className="eyebrow">PANEL OPERATIVO</p><h1>Eventos</h1><p>Cliente, artistas, shows y logística conectados en una misma tabla.</p></div><button className="primary-button" onClick={onBack}>Volver a Mi día</button></div><div className="events-toolbar"><div className="events-filters">{statuses.map((status) => <button key={status} className={'filter-chip ' + (statusFilter === status ? 'active' : '')} onClick={() => setStatusFilter(status)}>{status}</button>)}</div><span className="board-count">{rows.length} eventos</span></div><div className="monday-board-head"><span>Evento</span><span>Fecha del evento</span><span>Clientes</span><span>Artistas y proveedores</span><span>Shows</span><span>Ciudad</span><span>Localización / venue</span></div>{groups.map((group) => <section className="event-group monday-group" key={group.label}><div className="event-group-title"><b>{group.label}</b><span>{group.items.length}</span></div><div className="event-board-list">{group.items.map(({ event, key }) => <article className="monday-event-row" key={key}><button className="event-cell event-primary event-open-cell" onClick={() => setSelectedKey(key)}><b>{event.id}</b><strong>{event.detail || event.show || 'Evento sin detalle'}</strong></button><div className="event-cell"><span className="event-board-date">{event.date || 'Sin fecha'}</span></div><div className="event-cell"><b>{event.client || 'Sin cliente'}</b><small>{event.clientType || '—'}</small></div><div className="event-cell"><span>{artistsFor(event, key).join(', ') || 'Sin artistas asignados'}</span></div><div className="event-cell"><span>{meta[key]?.talent || event.show || '—'}</span></div><button className="event-cell location-cell" onClick={() => { const value = window.prompt('Ciudad del evento', meta[key]?.city || ''); if (value !== null) update(key, { city: value }); }}><span>{meta[key]?.city || 'Añadir ciudad'}</span></button><button className="event-cell location-cell" onClick={() => { const value = window.prompt('Venue o localización', meta[key]?.venue || ''); if (value !== null) update(key, { venue: value }); }}><span>{meta[key]?.venue || 'Añadir venue'}</span></button></article>)}</div></section>)}{selected && <section className="event-detail"><div className="panel-head"><div><p className="eyebrow">FICHA DE EVENTO</p><h2>{selected.event.detail || selected.event.show || selected.event.id}</h2><p>{selected.event.date || 'Sin fecha'} · {selected.event.client || 'Sin cliente'}</p></div><button className="text-button" onClick={() => setSelectedKey(null)}>Cerrar</button></div><div className="detail-grid"><div><span>Artistas asignados</span><div className="assignment-chips">{artistsFor(selected.event, selected.key).map((artist) => <b key={artist}>{artist}</b>)}<button onClick={() => addArtist(selected.key, selected.event)}>+ Añadir</button></div></div><div><span>Show / performance</span><button className="detail-edit" onClick={() => { const value = window.prompt('Show o tipo de performance', meta[selected.key]?.talent || String(selected.event.show || '')); if (value !== null) update(selected.key, { talent: value }); }}>{meta[selected.key]?.talent || selected.event.show || 'Definir show'}</button></div><div><span>Vestuario</span><button className="detail-edit" onClick={() => { const value = window.prompt('Vestuario y necesidades', meta[selected.key]?.wardrobe || ''); if (value !== null) update(selected.key, { wardrobe: value }); }}>{meta[selected.key]?.wardrobe || 'Añadir vestuario'}</button></div><div><span>Notas de producción</span><button className="detail-edit" onClick={() => { const value = window.prompt('Notas de producción', meta[selected.key]?.notes || String(selected.event.notes || '')); if (value !== null) update(selected.key, { notes: value }); }}>{meta[selected.key]?.notes || selected.event.notes || 'Añadir notas'}</button></div></div><div className="detail-finance"><div><span>Ingreso</span><b>{money(selected.event.income)}</b></div><div><span>Coste</span><b>{money(selected.event.totalCost)}</b></div><div><span>Beneficio</span><b>{money(selected.event.profit)}</b></div><button className={'payment-toggle ' + (meta[selected.key]?.paid || String(selected.event.collected || '').toLowerCase() === 'sí' ? 'paid' : '')} onClick={() => update(selected.key, { paid: !(meta[selected.key]?.paid || String(selected.event.collected || '').toLowerCase() === 'sí') })}>{meta[selected.key]?.paid || String(selected.event.collected || '').toLowerCase() === 'sí' ? 'Cobrado / pagado' : 'Marcar como pagado'}</button></div></section>}<p className="source-note">Los cambios de producción, localización y pagos se guardan en este dispositivo. Los registros del Excel se mantienen intactos.</p></div>;
}
function ShowsModule({ query, customShows, onAdd, onBack }: { query: string; customShows: readonly ShowRecord[]; onAdd: () => void; onBack: () => void }) {
  const [category, setCategory] = useState('Todas');
  const needle = query.trim().toLowerCase();
  const allShows = [...customShows, ...catalogueItems];
  const categories = ['Todas', ...Array.from(new Set(allShows.map((item) => item.jobTitle))).sort()];
  const items = allShows.filter((item) => (category === 'Todas' || item.jobTitle === category) && (!needle || `${item.name} ${item.jobTitle} ${item.description}`.toLowerCase().includes(needle)));
  return <div className="data-module"><div className="module-head"><div><p className="eyebrow">CATÁLOGO DE PERFORMANCE LAB</p><h1>Shows y personajes</h1><p>{items.length} propuestas listas para asociarlas a eventos y propuestas.</p></div><div className="module-actions"><button className="secondary-button" onClick={onAdd}><Plus size={15} /> Nuevo show</button><button className="primary-button" onClick={onBack}>Volver a Mi día</button></div></div><div className="catalogue-filters" aria-label="Filtrar por categoría">{categories.map((item) => <button key={item} className={`filter-chip ${category === item ? 'active' : ''}`} onClick={() => setCategory(item)}>{item}</button>)}</div><div className="catalogue-grid">{items.map((item) => <article className="catalogue-card" key={item.name}><div className="catalogue-tag">{item.jobTitle}</div><h3>{item.name}</h3><span>{customShows.some((show) => show.name === item.name) ? 'Catálogo interno' : 'Performance Lab'}</span><p>{item.description || 'Sin descripción todavía.'}</p>{item.url ? <button className="text-button" onClick={() => window.open(item.url, '_blank', 'noopener,noreferrer')}>Ver ficha oficial <ArrowUpRight size={14} /></button> : <span className="catalogue-internal">Añadido por el equipo</span>}</article>)}</div><p className="source-note">Catálogo basado en el sitio público de Performance Lab y en los shows añadidos por el equipo.</p></div>;
}

function ModulePlaceholder({ section, onBack }: { section: Exclude<Section, 'Mi día'>; onBack: () => void }) {
  const content: Record<Exclude<Section, 'Mi día'>, { title: string; text: string; icon: typeof Users; color: string }> = {
    Clientes: { title: 'Clientes', text: 'Tu base de relaciones comerciales estará aquí.', icon: Users, color: 'purple' },
    Pipeline: { title: 'Pipeline comercial', text: 'Gestiona tus oportunidades desde el primer contacto hasta el cierre.', icon: Target, color: 'mint' },
    Eventos: { title: 'Eventos', text: 'El calendario de producciones y sus fichas operativas.', icon: CalendarDays, color: 'amber' },
    Talento: { title: 'Talento', text: 'Perfiles, disciplinas, tarifas y disponibilidad.', icon: Sparkles, color: 'purple' },
    Equipo: { title: 'Equipo', text: 'Perfiles, roles y permisos de las personas que trabajan contigo.', icon: UserRound, color: 'mint' },
    Shows: { title: 'Shows y personajes', text: 'Catálogo de propuestas escénicas, personajes y servicios.', icon: Sparkles, color: 'purple' },
    Tareas: { title: 'Tareas', text: 'El trabajo pendiente de todo el equipo, en un solo lugar.', icon: Check, color: 'mint' },
    Propuestas: { title: 'Propuestas', text: 'Crea opciones claras con costes internos separados.', icon: FileText, color: 'amber' },
  };
  const item = content[section]; const Icon = item.icon;
  return <div className="empty-module"><div className={`empty-icon ${item.color}`}><Icon size={27} /></div><p className="eyebrow">MÓDULO EN CONSTRUCCIÓN</p><h1>{item.title}</h1><p>{item.text}</p><span className="coming-pill"><Clock3 size={14} /> Siguiente bloque de la fase 1</span><button className="primary-button" onClick={onBack}>Volver a Mi día</button></div>;
}
