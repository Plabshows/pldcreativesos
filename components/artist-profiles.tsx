'use client';

import { DataReview } from './data-review';
import { ArtistBankPayments, SupplierProfile } from './bank-workspace';
import { payeeSummary } from '@/lib/payee-summary';
import type { BankData } from '@/lib/bank';
import { invoiceMoney } from '@/lib/invoices';
import { responseJson } from '@/lib/response-json';
import { findPotentialDuplicateTalent } from '@/lib/talent-search';
import { useEffect, useState } from 'react';

type Artist = {
  id: string;
  real_name: string;
  city?: string | null;
  skills?: string[] | null;
  aliases?: string[] | null;
  email?: string | null;
  phone?: string | null;
  tax_id?: string | null;
  iban?: string | null;
  billing_supplier_id?: string | null;
  billing_confidence?: string;
  deleted_at?: string | null;
};

type Event = {
  id: string;
  event_name: string;
  event_date: string | null;
  client_id: string | null;
  venue: string | null;
  city?: string | null;
  status?: string;
};

type Assignment = {
  event_id: string;
  talent_id: string;
  agreed_cost_cents: number | null;
};

type Payment = {
  id: string;
  event_id: string;
  talent_id: string;
  amount_cents: number;
  status: string;
  paid_on?: string | null;
  created_at?: string;
};

type Data = {
  talent: Artist[];
  events: Event[];
  assignments: Assignment[];
  payments: Payment[];
  clients?: { id: string; company_name: string }[];
  canEdit: boolean;
};

const normalize = (s: string) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const formatDate = (s: string | null) => s ? new Date(s + 'T12:00:00').toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid', day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Sin fecha';
const formatTimestamp = (s: string | null | undefined) => s ? new Date(s).toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

export function ArtistProfiles({ query = '', onBack }: { query?: string; onBack: () => void }) {
  const [data, setData] = useState<Data | null>(null);
  const [bank, setBank] = useState<BankData>();
  const [selected, setSelected] = useState<string | null>(null);
  const [supplier, setSupplier] = useState<string | null>(null);
  const [search, setSearch] = useState(query);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [artistFilter, setArtistFilter] = useState<string>('all');
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [periodFilter, setPeriodFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'payments' | 'roster'>('payments');
  const [error, setError] = useState<string>('');
  const [notice, setNotice] = useState<string>('');
  const [busy, setBusy] = useState<boolean>(false);

  async function load() {
    try {
      const responses = await Promise.all([
        fetch('/api/event-board', { cache: 'no-store' }),
        fetch('/api/artist-pay', { cache: 'no-store' }),
        fetch('/api/bank', { cache: 'no-store' })
      ]);
      const [boardData, payData, bankData] = await Promise.all(responses.map(responseJson));
      const failIdx = responses.findIndex(r => !r.ok);
      if (failIdx >= 0) throw Error([boardData, payData, bankData][failIdx].error || 'No se pudieron cargar los pagos');

      setData({
        talent: boardData.talent || [],
        events: boardData.events || [],
        assignments: boardData.assignments || [],
        payments: payData.payments || boardData.payments || [],
        clients: boardData.clients || [],
        canEdit: Boolean(boardData.canEdit)
      });
      setBank(bankData);
      setError('');
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    }
  }

  useEffect(() => {
    void load();
    const refresh = () => void load();
    window.addEventListener('focus', refresh);
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, 15000);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', refresh);
    };
  }, []);

  useEffect(() => {
    const u = new URL(window.location.href);
    const id = u.searchParams.get('talent');
    if (id && data?.talent.some(a => a.id === id)) {
      setSelected(id);
      u.searchParams.delete('talent');
      window.history.replaceState(null, '', u);
    }
  }, [data]);

  const updatePayment = async (eventId: string, talentId: string, amountCents: number | null, nextStatus?: 'pending' | 'paid') => {
    setBusy(true);
    setNotice('Guardando en Supabase…');
    try {
      const res = await fetch('/api/artist-pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: eventId,
          talent_id: talentId,
          amount: amountCents,
          status: nextStatus
        })
      });
      const d = await responseJson(res);
      if (!res.ok) throw Error(d.error || 'No se pudo guardar');
      setNotice(nextStatus ? '✓ Pago actualizado' : '✓ Sueldo actualizado');
      await load();
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al guardar';
      setError(msg);
      setNotice('⚠ No se pudo guardar');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const currentArtist = data?.talent.find(a => a.id === selected);

  // Unified payment rows calculation
  const allPaymentRows = (data?.assignments || []).map(a => {
    const talent = data?.talent.find(t => t.id === a.talent_id);
    const event = data?.events.find(e => e.id === a.event_id);
    const pay = (data?.payments || []).find(p => p.event_id === a.event_id && p.talent_id === a.talent_id);
    const feeCents = a.agreed_cost_cents != null ? Number(a.agreed_cost_cents) : (pay?.amount_cents != null ? Number(pay.amount_cents) : null);
    const status = pay?.status || 'pending';
    const paidOn = pay?.paid_on;

    return {
      assignment: a,
      talent,
      event,
      pay,
      feeCents,
      status,
      paidOn
    };
  }).filter(row => Boolean(row.talent && row.event));

  // Filtered rows for Global Payments Table
  const filteredPaymentRows = allPaymentRows.filter(row => {
    if (!row.talent || !row.event) return false;
    if (statusFilter !== 'all' && row.status !== statusFilter) return false;
    if (artistFilter !== 'all' && row.talent.id !== artistFilter) return false;
    if (cityFilter !== 'all' && (row.event.city || row.event.venue || '').toLowerCase() !== cityFilter.toLowerCase()) return false;
    
    if (search.trim()) {
      const q = normalize(search);
      const text = normalize(`${row.talent.real_name} ${row.event.event_name} ${row.event.city || ''} ${row.event.venue || ''}`);
      if (!text.includes(q)) return false;
    }
    return true;
  }).sort((a, b) => (b.event?.event_date || '').localeCompare(a.event?.event_date || ''));

  // Global Totals
  const globalTotalCents = filteredPaymentRows.reduce((sum, r) => sum + (r.feeCents || 0), 0);
  const globalPaidCents = filteredPaymentRows.reduce((sum, r) => sum + (r.status === 'paid' ? (r.feeCents || 0) : 0), 0);
  const globalPendingCents = Math.max(0, globalTotalCents - globalPaidCents);

  // Current Artist Specific Calculations
  const artistRows = allPaymentRows.filter(r => r.talent?.id === selected);
  const currentYear = new Date().getFullYear().toString();
  const filteredArtistRows = artistRows.filter(r => {
    if (!r.event?.event_date) return periodFilter === 'all';
    if (periodFilter === 'current') return r.event.event_date.startsWith(currentYear);
    return true;
  });

  const artistWorkedCents = filteredArtistRows.reduce((sum, r) => sum + (r.feeCents || 0), 0);
  const artistPaidCents = filteredArtistRows.reduce((sum, r) => sum + (r.status === 'paid' ? (r.feeCents || 0) : 0), 0);
  const artistPendingCents = Math.max(0, artistWorkedCents - artistPaidCents);

  const citiesList = Array.from(new Set(allPaymentRows.map(r => r.event?.city).filter((c): c is string => Boolean(c)))).sort();
  const duplicateCandidates = data ? findPotentialDuplicateTalent(data.talent) : [];

  return (
    <section className="data-module bank-workspace" style={{ maxWidth: '1400px', margin: '0 auto', padding: '16px' }}>
      {/* Module Header */}
      <div className="module-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
        <div>
          <p className="eyebrow" style={{ fontSize: '12px', fontWeight: 700, color: '#0284c7', margin: 0, letterSpacing: '0.05em' }}>PERFORMANCE LAB OS · GESTIÓN DE COBROS Y SUELDOS</p>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', margin: '4px 0' }}>
            {currentArtist ? `Ficha Financiera: ${currentArtist.real_name}` : 'PAGOS Y SUELDOS DE ARTISTAS'}
          </h1>
          <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
            {currentArtist ? 'Histórico completo de trabajos, fees acordados y estado de pagos.' : 'Única fuente de verdad de sueldos y estados de pago para toda la agencia.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {selected && (
            <button className="secondary-button" style={{ padding: '8px 14px', borderRadius: '6px', fontSize: '13px', fontWeight: 600 }} onClick={() => setSelected(null)}>
              ← Volver a Pagos Globales
            </button>
          )}
          <button className="primary-button" style={{ padding: '8px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, background: '#0284c7', color: '#fff', border: 0 }} onClick={onBack}>
            Volver a Mi día
          </button>
        </div>
      </div>

      <DataReview reloadParent={() => void load()} />

      {/* Notice / Feedback Banner */}
      {notice && (
        <div style={{ padding: '8px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, marginBottom: '12px', background: notice.includes('⚠') ? '#fef2f2' : '#f0fdf4', color: notice.includes('⚠') ? '#991b1b' : '#166534', border: `1px solid ${notice.includes('⚠') ? '#fca5a5' : '#86efac'}` }} role="status">
          {notice}
        </div>
      )}
      {error && <p role="alert" style={{ color: '#ef4444', fontWeight: 600 }}>{error} <button onClick={() => void load()}>Reintentar</button></p>}

      {/* DUPLICATE TALENT AUDIT WARNING */}
      {duplicateCandidates.length > 0 && !selected && (
        <details style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px' }}>
          <summary style={{ fontWeight: 700, color: '#92400e', cursor: 'pointer' }}>
            ⚠️ Auditoría de Identidad: {duplicateCandidates.length} posibles duplicados de artistas detectados
          </summary>
          <div style={{ marginTop: '8px', color: '#78350f', lineHeight: '1.5' }}>
            <p style={{ margin: '0 0 6px' }}>Los siguientes artistas tienen nombres o variantes similares. Todas las operaciones de pagos actuales usan su <code>artist_id</code> exacto para evitar mezcla de fondos:</p>
            {duplicateCandidates.map(g => (
              <div key={g.key} style={{ background: '#ffffff', padding: '6px 10px', borderRadius: '6px', border: '1px solid #fde68a', marginBottom: '4px' }}>
                <strong>Coincidencia "{g.key}":</strong> {g.items.map(i => `${i.real_name} (ID: ${i.id.slice(0, 8)}...)`).join(' · ')}
              </div>
            ))}
          </div>
        </details>
      )}

      {!data && !error ? (
        <p>Cargando información de pagos…</p>
      ) : selected && currentArtist ? (
        /* ================= SINGLE ARTIST PROFILE VIEW ================= */
        <div>
          {/* Artist Metadata Summary Card */}
          <div style={{ background: '#ffffff', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px', marginBottom: '12px' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', margin: 0 }}>{currentArtist.real_name}</h2>
                <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0' }}>
                  {currentArtist.city || 'Sin ciudad'} · {currentArtist.phone || 'Sin teléfono'} · {currentArtist.email || 'Sin email'}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <a href={`/?artist=${currentArtist.id}#talento`} style={{ fontSize: '12px', fontWeight: 600, color: '#0284c7', background: '#e0f2fe', padding: '6px 12px', borderRadius: '6px', textDecoration: 'none' }}>
                  ⚙️ Editar Ficha de Talento
                </a>
              </div>
            </div>

            <div style={{ fontSize: '12px', color: '#475569', display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
              <span><strong>DNI / NIF / Documento:</strong> {currentArtist.tax_id || 'Por confirmar'}</span>
              <span><strong>IBAN / Banco:</strong> {currentArtist.iban || 'Sin indicar'}</span>
              <span><strong>Empresa de facturación:</strong> {bank?.suppliers.find(s => s.id === currentArtist.billing_supplier_id)?.name || 'Directo / Persona física'}</span>
            </div>
          </div>

          {/* Economic Summary Header Cards */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b', margin: 0 }}>
              RESUMEN ECONÓMICO Y DE TRABAJOS
            </h3>
            <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}>
              Período:
              <select value={periodFilter} onChange={e => setPeriodFilter(e.target.value)} style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', fontWeight: 600, background: '#fff' }}>
                <option value="all">Todo el histórico</option>
                <option value="current">Este año ({currentYear})</option>
              </select>
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '20px' }}>
            <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <small style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>TRABAJADO TOTAL</small>
              <strong style={{ display: 'block', fontSize: '20px', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
                {(artistWorkedCents / 100).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
              </strong>
              <span style={{ fontSize: '11px', color: '#64748b' }}>{filteredArtistRows.length} eventos asignados</span>
            </div>

            <div style={{ background: '#f0fdf4', padding: '14px', borderRadius: '10px', border: '1px solid #bbf7d0' }}>
              <small style={{ fontSize: '11px', fontWeight: 700, color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.05em' }}>PAGADO</small>
              <strong style={{ display: 'block', fontSize: '20px', fontWeight: 800, color: '#166534', marginTop: '4px' }}>
                {(artistPaidCents / 100).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
              </strong>
              <span style={{ fontSize: '11px', color: '#15803d' }}>{filteredArtistRows.filter(r => r.status === 'paid').length} trabajos saldados</span>
            </div>

            <div style={{ background: '#fffbeb', padding: '14px', borderRadius: '10px', border: '1px solid #fde68a' }}>
              <small style={{ fontSize: '11px', fontWeight: 700, color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.05em' }}>PENDIENTE DE PAGO</small>
              <strong style={{ display: 'block', fontSize: '20px', fontWeight: 800, color: '#92400e', marginTop: '4px' }}>
                {(artistPendingCents / 100).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
              </strong>
              <span style={{ fontSize: '11px', color: '#b45309' }}>{filteredArtistRows.filter(r => r.status !== 'paid').length} trabajos pendientes</span>
            </div>
          </div>

          {/* Work History Table */}
          <div style={{ background: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', background: '#fafafa', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: '14px', color: '#0f172a' }}>HISTORIAL DE EVENTOS Y PAGOS ({filteredArtistRows.length})</strong>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                    <th style={{ padding: '10px 12px' }}>FECHA</th>
                    <th style={{ padding: '10px 12px' }}>EVENTO</th>
                    <th style={{ padding: '10px 12px' }}>LOCALIZACIÓN / VENUE</th>
                    <th style={{ padding: '10px 12px' }}>FEE / SUELDO (€)</th>
                    <th style={{ padding: '10px 12px' }}>ESTADO DE PAGO</th>
                    <th style={{ padding: '10px 12px' }}>FECHA PAGO</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredArtistRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                        No hay eventos registrados para este artista con el filtro seleccionado.
                      </td>
                    </tr>
                  ) : (
                    filteredArtistRows.map(r => {
                      const feeVal = r.feeCents != null ? (r.feeCents / 100) : '';

                      const saveRowFee = async (valStr: string) => {
                        const raw = valStr.replace(',', '.');
                        const cents = raw === '' ? null : Math.round(Number(raw) * 100);
                        if (Number.isNaN(cents)) return;
                        if (cents !== r.feeCents) {
                          await updatePayment(r.event!.id, currentArtist.id, cents, r.status as any);
                        }
                      };

                      return (
                        <tr key={r.event!.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', fontWeight: 600, color: '#334155' }}>
                            {formatDate(r.event!.event_date)}
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <a href={`/?event=${r.event!.id}#eventos`} style={{ fontWeight: 700, color: '#0284c7', textDecoration: 'none' }}>
                              {r.event!.event_name}
                            </a>
                          </td>
                          <td style={{ padding: '10px 12px', color: '#64748b' }}>
                            {[r.event!.venue, r.event!.city].filter(Boolean).join(' · ') || '—'}
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <form style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }} onSubmit={evt => {
                              evt.preventDefault();
                              const formData = new FormData(evt.currentTarget);
                              void saveRowFee(String(formData.get('fee') || ''));
                            }}>
                              <input
                                name="fee"
                                key={`${r.event!.id}-${r.feeCents ?? 'none'}`}
                                type="number" min="0" step="0.01" placeholder="Ej: 250.00"
                                defaultValue={feeVal} disabled={busy || !data?.canEdit}
                                aria-label={`Sueldo para ${r.event!.event_name}`}
                                style={{ width: '100px', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', fontWeight: 600 }}
                                onBlur={evt => void saveRowFee(evt.target.value)}
                                onKeyDown={evt => {
                                  if (evt.key === 'Enter') {
                                    evt.preventDefault();
                                    void saveRowFee(evt.currentTarget.value);
                                    evt.currentTarget.blur();
                                  }
                                }}
                              />
                              <span style={{ fontWeight: 600, color: '#64748b' }}>€</span>
                            </form>
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <select
                              key={`${r.event!.id}-${r.status}`}
                              value={r.status} disabled={busy || !data?.canEdit}
                              aria-label={`Estado de pago de ${r.event!.event_name}`}
                              style={{
                                padding: '6px 10px',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                color: r.status === 'paid' ? '#15803d' : '#b45309',
                                background: r.status === 'paid' ? '#f0fdf4' : '#fffbeb',
                                border: `1px solid ${r.status === 'paid' ? '#86efac' : '#fcd34d'}`
                              }}
                              onChange={async evt => {
                                const nextStatus = evt.target.value as 'pending' | 'paid';
                                await updatePayment(r.event!.id, currentArtist.id, r.feeCents, nextStatus);
                              }}
                            >
                              <option value="pending">🕒 PENDIENTE</option>
                              <option value="paid">✅ PAGADO</option>
                            </select>
                          </td>
                          <td style={{ padding: '10px 12px', fontSize: '12px', color: r.paidOn ? '#15803d' : '#94a3b8' }}>
                            {r.paidOn ? formatTimestamp(r.paidOn) : '—'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ marginTop: '20px' }}>
            <ArtistBankPayments talentId={currentArtist.id} sharedData={bank} />
          </div>
        </div>
      ) : (
        /* ================= GLOBAL PAYMENTS DASHBOARD VIEW ================= */
        <div>
          {/* Navigation & Mode Toggle Bar */}
          <div className="crm-toolbar" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '16px' }}>
            <button
              className={viewMode === 'payments' ? 'primary-button' : 'secondary-button'}
              aria-pressed={viewMode === 'payments'}
              style={{ padding: '8px 14px', borderRadius: '6px', fontWeight: 700 }}
              onClick={() => setViewMode('payments')}
            >
              💳 Tabla Global de Pagos ({filteredPaymentRows.length})
            </button>
            <button
              className={viewMode === 'roster' ? 'primary-button' : 'secondary-button'}
              aria-pressed={viewMode === 'roster'}
              style={{ padding: '8px 14px', borderRadius: '6px', fontWeight: 700 }}
              onClick={() => setViewMode('roster')}
            >
              👤 Directorio de Fichas de Artistas ({data?.talent.length || 0})
            </button>

            <input
              type="search"
              aria-label="Buscar en pagos"
              placeholder="Buscar por artista, evento, ciudad…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ flex: 1, minWidth: '200px', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            />

            <select aria-label="Filtrar por estado" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
              <option value="all">Todos los estados</option>
              <option value="pending">🕒 Solo Pendientes</option>
              <option value="paid">✅ Solo Pagados</option>
            </select>

            <select aria-label="Filtrar por artista" value={artistFilter} onChange={e => setArtistFilter(e.target.value)} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
              <option value="all">Todos los artistas</option>
              {(data?.talent || []).map(t => (
                <option key={t.id} value={t.id}>{t.real_name}</option>
              ))}
            </select>

            <select aria-label="Filtrar por ciudad" value={cityFilter} onChange={e => setCityFilter(e.target.value)} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
              <option value="all">Todas las ciudades</option>
              {citiesList.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {viewMode === 'payments' ? (
            <div>
              {/* Global KPI Summary Bar */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                <div style={{ background: '#ffffff', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                  <small style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>TOTAL CACHÉS Y SUELDOS</small>
                  <strong style={{ display: 'block', fontSize: '22px', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
                    {(globalTotalCents / 100).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                  </strong>
                </div>

                <div style={{ background: '#f0fdf4', padding: '14px', borderRadius: '10px', border: '1px solid #bbf7d0' }}>
                  <small style={{ fontSize: '11px', fontWeight: 700, color: '#15803d', textTransform: 'uppercase' }}>PAGADO A ARTISTAS</small>
                  <strong style={{ display: 'block', fontSize: '22px', fontWeight: 800, color: '#166534', marginTop: '4px' }}>
                    {(globalPaidCents / 100).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                  </strong>
                </div>

                <div style={{ background: '#fffbeb', padding: '14px', borderRadius: '10px', border: '1px solid #fde68a' }}>
                  <small style={{ fontSize: '11px', fontWeight: 700, color: '#b45309', textTransform: 'uppercase' }}>PENDIENTE DE PAGO</small>
                  <strong style={{ display: 'block', fontSize: '22px', fontWeight: 800, color: '#92400e', marginTop: '4px' }}>
                    {(globalPendingCents / 100).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                  </strong>
                </div>
              </div>

              {/* Global Payments Table */}
              <div style={{ background: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                        <th style={{ padding: '10px 12px' }}>ARTISTA</th>
                        <th style={{ padding: '10px 12px' }}>EVENTO</th>
                        <th style={{ padding: '10px 12px' }}>FECHA EVENTO</th>
                        <th style={{ padding: '10px 12px' }}>CIUDAD / VENUE</th>
                        <th style={{ padding: '10px 12px' }}>FEE / SUELDO (€)</th>
                        <th style={{ padding: '10px 12px' }}>ESTADO DE PAGO</th>
                        <th style={{ padding: '10px 12px' }}>FECHA DE PAGO</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right' }}>ACCIONES</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPaymentRows.length === 0 ? (
                        <tr>
                          <td colSpan={8} style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                            No hay registros de pagos que coincidan con los filtros seleccionados.
                          </td>
                        </tr>
                      ) : (
                        filteredPaymentRows.map(r => {
                          const feeVal = r.feeCents != null ? (r.feeCents / 100) : '';

                          const saveGlobalFee = async (valStr: string) => {
                            const raw = valStr.replace(',', '.');
                            const cents = raw === '' ? null : Math.round(Number(raw) * 100);
                            if (Number.isNaN(cents)) return;
                            if (cents !== r.feeCents) {
                              await updatePayment(r.event!.id, r.talent!.id, cents, r.status as any);
                            }
                          };

                          return (
                            <tr key={`${r.event!.id}-${r.talent!.id}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '10px 12px' }}>
                                <button
                                  style={{ border: 0, background: 'none', padding: 0, fontWeight: 700, color: '#0f172a', cursor: 'pointer', textAlign: 'left' }}
                                  onClick={() => setSelected(r.talent!.id)}
                                >
                                  {r.talent!.real_name}
                                </button>
                              </td>
                              <td style={{ padding: '10px 12px' }}>
                                <a href={`/?event=${r.event!.id}#eventos`} style={{ fontWeight: 600, color: '#0284c7', textDecoration: 'none' }}>
                                  {r.event!.event_name}
                                </a>
                              </td>
                              <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: '#475569' }}>
                                {formatDate(r.event!.event_date)}
                              </td>
                              <td style={{ padding: '10px 12px', color: '#64748b' }}>
                                {[r.event!.venue, r.event!.city].filter(Boolean).join(' · ') || '—'}
                              </td>
                              <td style={{ padding: '10px 12px' }}>
                                <form style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }} onSubmit={evt => {
                                  evt.preventDefault();
                                  const formData = new FormData(evt.currentTarget);
                                  void saveGlobalFee(String(formData.get('fee') || ''));
                                }}>
                                  <input
                                    name="fee"
                                    key={`${r.event!.id}-${r.talent!.id}-${r.feeCents ?? 'none'}`}
                                    type="number" min="0" step="0.01" placeholder="Ej: 250.00"
                                    defaultValue={feeVal} disabled={busy || !data?.canEdit}
                                    aria-label={`Sueldo para ${r.talent!.real_name} en ${r.event!.event_name}`}
                                    style={{ width: '100px', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', fontWeight: 600 }}
                                    onBlur={evt => void saveGlobalFee(evt.target.value)}
                                    onKeyDown={evt => {
                                      if (evt.key === 'Enter') {
                                        evt.preventDefault();
                                        void saveGlobalFee(evt.currentTarget.value);
                                        evt.currentTarget.blur();
                                      }
                                    }}
                                  />
                                  <span style={{ fontWeight: 600, color: '#64748b' }}>€</span>
                                </form>
                              </td>
                              <td style={{ padding: '10px 12px' }}>
                                <select
                                  key={`${r.event!.id}-${r.talent!.id}-${r.status}`}
                                  value={r.status} disabled={busy || !data?.canEdit}
                                  aria-label={`Estado de pago para ${r.talent!.real_name}`}
                                  style={{
                                    padding: '6px 10px',
                                    borderRadius: '6px',
                                    fontSize: '12px',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    color: r.status === 'paid' ? '#15803d' : '#b45309',
                                    background: r.status === 'paid' ? '#f0fdf4' : '#fffbeb',
                                    border: `1px solid ${r.status === 'paid' ? '#86efac' : '#fcd34d'}`
                                  }}
                                  onChange={async evt => {
                                    const nextStatus = evt.target.value as 'pending' | 'paid';
                                    await updatePayment(r.event!.id, r.talent!.id, r.feeCents, nextStatus);
                                  }}
                                >
                                  <option value="pending">🕒 PENDIENTE</option>
                                  <option value="paid">✅ PAGADO</option>
                                </select>
                              </td>
                              <td style={{ padding: '10px 12px', fontSize: '12px', color: r.paidOn ? '#15803d' : '#94a3b8' }}>
                                {r.paidOn ? formatTimestamp(r.paidOn) : '—'}
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                                <button
                                  style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                                  onClick={() => setSelected(r.talent!.id)}
                                >
                                  Ver Ficha
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            /* Roster / Directory View */
            <div style={{ background: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                      <th style={{ padding: '10px 12px' }}>NOMBRE DEL ARTISTA</th>
                      <th style={{ padding: '10px 12px' }}>CIUDAD / DETALLES</th>
                      <th style={{ padding: '10px 12px' }}>EVENTOS ASIGNADOS</th>
                      <th style={{ padding: '10px 12px' }}>ACCIONES</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.talent || []).filter(t => !search || normalize(t.real_name + (t.city || '')).includes(normalize(search))).map(t => {
                      const count = (data?.assignments || []).filter(a => a.talent_id === t.id).length;
                      return (
                        <tr key={t.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '10px 12px', fontWeight: 700, color: '#0f172a' }}>{t.real_name}</td>
                          <td style={{ padding: '10px 12px', color: '#64748b' }}>{[t.city, t.email, t.phone].filter(Boolean).join(' · ') || '—'}</td>
                          <td style={{ padding: '10px 12px', fontWeight: 600 }}>{count} eventos</td>
                          <td style={{ padding: '10px 12px' }}>
                            <button
                              style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #0284c7', background: '#e0f2fe', color: '#0369a1', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                              onClick={() => setSelected(t.id)}
                            >
                              Abrir Ficha Financiera
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {supplier && bank && (
        <SupplierProfile
          key={supplier}
          supplier={bank.suppliers.find(s => s.id === supplier)}
          data={bank}
          close={() => setSupplier(null)}
          reload={load}
          openBank={id => { window.location.href = `/?finance=bank&movement=${id}#facturas`; }}
        />
      )}
    </section>
  );
}
