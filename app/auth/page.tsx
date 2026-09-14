'use client';

import { FormEvent, useState } from 'react';
import { ArrowLeft, LoaderCircle, LockKeyhole } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { importedClients, importedArtists } from '@/app/imported-data-fixed';
import { importedEvents } from '@/app/imported-events';
import { catalogueItems } from '@/app/catalogue-full';

const chunks = <T,>(items: T[], size = 100) => Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, index * size + size));
const dateForDb = (value: unknown) => { const raw = String(value || ''); const spanish = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/); return spanish ? `${spanish[3]}-${spanish[2]}-${spanish[1]}` : /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0, 10) : null; };
const normalise = (value: string) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

export default function AuthPage() {
  const [email, setEmail] = useState('plabcreativesos@gmail.com');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setLoading(true); setError('');
    let stage = 'Acceso';
    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      stage = 'Preparación del espacio';
      // Solo el correo fundador debe ejecutar el bootstrap; los colaboradores
      // ya vinculados entran directamente en la organización existente.
      const isFounder = normalise(email) === 'plabcreativesos@gmail.com';
      const { data: organizationId, error: bootstrapError } = isFounder
        ? await supabase.rpc('bootstrap_performance_lab')
        : { data: null, error: null };
      if (bootstrapError && !bootstrapError.message.includes('ya existe')) throw bootstrapError;
      const { data: membership } = organizationId ? { data: organizationId } : await supabase.from('organization_members').select('organization_id').limit(1).single();
      if (!membership) throw new Error('No se pudo encontrar el espacio de trabajo.');
      const orgId = typeof membership === 'string' ? membership : membership.organization_id;
      if (!orgId) throw new Error('No se pudo identificar la organización.');
      stage = 'Importación de clientes';
      const { count: clientCount, error: clientCountError } = await supabase.from('clients').select('id', { count: 'exact', head: true });
      if (clientCountError) throw clientCountError;
      if (!clientCount) {
        const clientRows = importedClients.map((client, index) => ({ organization_id: orgId, client_code: 'LEG-CL-' + String(index + 1).padStart(3, '0'), company_name: client.name, client_type: client.type || 'Other', city: client.city || null, country: 'España', notes: client.contact ? 'Contacto importado: ' + client.contact + (client.email ? ' · ' + client.email : '') + (client.phone ? ' · ' + client.phone : '') : null }));
        for (const group of chunks(clientRows)) { const { error } = await supabase.from('clients').insert(group); if (error) throw error; }
      }
      const { data: clientRows, error: clientError } = await supabase.from('clients').select('id,company_name'); if (clientError) throw clientError;
      const clientIds = new Map((clientRows || []).map((client) => [normalise(client.company_name), client.id]));
      stage = 'Importación de artistas';
      const { count: talentCount, error: talentCountError } = await supabase.from('talent').select('id', { count: 'exact', head: true });
      if (talentCountError) throw talentCountError;
      if (!talentCount) {
        const talentRows = importedArtists.map((artist, index) => ({ organization_id: orgId, talent_code: 'LEG-TL-' + String(index + 1).padStart(3, '0'), real_name: artist.name, phone: artist.phone || null, email: artist.email || null, city: artist.city || null, base_city: artist.city || null, notes: [artist.category, artist.subcategory, artist.notes].filter(Boolean).join(' · ') || null }));
        for (const group of chunks(talentRows)) { const { error } = await supabase.from('talent').insert(group); if (error) throw error; }
      }
      stage = 'Importación de shows';
      const { count: showCount, error: showsTableError } = await supabase.from('shows').select('id', { count: 'exact', head: true });
      if (showsTableError) throw showsTableError;
      if (!showsTableError && !showCount) {
        const uniqueShows = Array.from(new Map(catalogueItems.map((show) => [normalise(show.name), show])).values());
        const showRows = uniqueShows.map((show, index) => ({ organization_id: orgId, show_code: 'CAT-' + String(index + 1).padStart(3, '0'), name: show.name, category: show.jobTitle || null, description: show.description || null, public_url: show.url || null }));
        for (const group of chunks(showRows)) { const { error } = await supabase.from('shows').insert(group); if (error) throw error; }
      }
      stage = 'Importación de eventos';
      const { count: eventCount, error: eventCountError } = await supabase.from('events').select('id', { count: 'exact', head: true });
      if (eventCountError) throw eventCountError;
      if (!eventCount) {
        const eventRows = importedEvents.map((event, index) => { const status = String(event.status || ''); return { organization_id: orgId, event_code: 'LEG-' + String(event.id || 'ROW') + '-' + String(index + 1), event_name: String(event.detail || event.show || 'Evento'), client_id: clientIds.get(normalise(String(event.client || ''))) || null, event_date: dateForDb(event.date), event_type: event.clientType || null, requested_entertainment: event.show || null, internal_notes: [event.artists ? 'Artistas: ' + event.artists : '', event.notes || '', event.invoice ? 'Factura: ' + event.invoice : ''].filter(Boolean).join('\n') || null, status: status === 'Realizado' ? 'completed' : status === 'Confirmado' ? 'confirmed' : status === 'Cancelado' ? 'cancelled' : 'production', health: status === 'Cancelado' ? 'red' : status === 'Confirmado' ? 'orange' : 'green' }; });
        for (const group of chunks(eventRows)) { const { error } = await supabase.from('events').insert(group); if (error) throw error; }
      }
      if (!showsTableError) {
        stage = 'Conexión de eventos y shows';
        const [{ data: storedShows, error: showsError }, { data: storedEvents, error: eventsError }] = await Promise.all([
          supabase.from('shows').select('id,name'),
          supabase.from('events').select('id,requested_entertainment'),
        ]);
        if (showsError || eventsError) throw showsError || eventsError;
        const showIds = new Map((storedShows || []).map((show) => [normalise(show.name), show.id]));
        const links = (storedEvents || []).flatMap((event) => String(event.requested_entertainment || '').split(',').map((name) => name.trim()).filter(Boolean).map((name) => ({ organization_id: orgId, event_id: event.id, show_id: showIds.get(normalise(name)) })).filter((link): link is { organization_id: string; event_id: string; show_id: string } => Boolean(link.show_id)));
        if (links.length) for (const group of chunks(links)) { const { error } = await supabase.from('event_shows').upsert(group, { onConflict: 'event_id,show_id', ignoreDuplicates: true }); if (error) throw error; }
      }
      window.location.assign('/');
    } catch (cause) {
      const message = cause && typeof cause === 'object' && 'message' in cause ? String(cause.message) : 'No se pudo completar la operación.';
      setError(`${stage}: ${message}`);
    }
    finally { setLoading(false); }
  };
  return <main className="auth-page"><form className="auth-card" onSubmit={submit}><a href="/" className="back-link"><ArrowLeft size={14} /> Volver</a><div className="auth-icon"><LockKeyhole size={22} /></div><p className="eyebrow">ESPACIO COMPARTIDO</p><h1>Conectar Performance Lab OS</h1><p>Inicia sesión para guardar clientes, artistas, eventos, pagos y asignaciones en Supabase para todo el equipo.</p><label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label>Contraseña<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>{error && <p className="auth-error">{error}</p>}<button className="primary-button auth-submit" disabled={loading}>{loading ? <LoaderCircle className="spin" size={16} /> : 'Conectar y activar equipo'}</button></form></main>;
}
