'use client';

import { ChatGPTContextButton } from '@/components/chatgpt-context-button';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  newProposal,
  newOption,
  newLine,
  proposalSchema,
  proposalStatuses,
  quoteUnits,
  conceptTypes,
  hiringTypes,
  eventTypes,
  optionMoney,
  money,
  proposalText,
  priceReferences,
  type Proposal,
  type ProposalFields,
  type QuoteLine,
  type QuoteOption,
} from '@/lib/proposals';
import { calculateOptionPricing, type OptionPricingResult } from '@/lib/pricing-engine';
import { defaultPricingSettings, type PricingSettings } from '@/lib/pricing-settings';
import { generateWhatsAppMessage, generateEmailMessage } from '@/lib/proposal-outputs';
import { PricingSettingsDialog } from './pricing-settings-dialog';
import type { WorkspaceReferences } from '@/lib/server/workspace-data';
import { responseJson } from '@/lib/response-json';
import './sales-workspace.css';

type Data = { data: Proposal[]; refs: WorkspaceReferences; settings?: PricingSettings; canEdit: boolean };

export function ProposalsWorkspace({ query = '' }: { query?: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [archived, setArchived] = useState(false);
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useState<'details' | 'budget' | 'pricing' | 'preview' | 'history'>('details');
  const [showSearch, setShowSearch] = useState('');
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [whatsappLang, setWhatsappLang] = useState<'es' | 'en'>('es');
  const [outputNotice, setOutputNotice] = useState('');
  const [customMarginInput, setCustomMarginInput] = useState<string>('40');
  const [customPriceInput, setCustomPriceInput] = useState<string>('');

  const [editing, setEditing] = useState<{
    id: string;
    version?: number;
    code?: string;
    event_id?: string | null;
    fields: ProposalFields;
  } | null>(null);

  const dialog = useRef<HTMLDialogElement>(null);
  const snapshot = useRef('');

  const settings = data?.settings || defaultPricingSettings;

  const close = () => {
    if (busy) return;
    if (editing && JSON.stringify(editing.fields) !== snapshot.current && !window.confirm('Hay cambios sin guardar. ¿Quieres descartarlos?')) return;
    setEditing(null);
  };

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/proposals', { cache: 'no-store' });
      const d = await responseJson(r);
      if (!r.ok) throw Error(d.error);
      setData(d);
      setError('');
      return d as Data;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar las propuestas.');
      return null;
    }
  }, []);

  useEffect(() => {
    void load();
    window.addEventListener('focus', load);
    return () => window.removeEventListener('focus', load);
  }, [load]);

  useEffect(() => {
    if (editing) dialog.current?.showModal();
    else dialog.current?.close();
  }, [editing]);

  function open(p?: Proposal, duplicate = false) {
    setError('');
    setNotice('');
    setTab('details');
    const fields = p
      ? {
          ...p,
          title: duplicate ? p.title + ' · copia' : p.title,
          status: duplicate ? 'draft' : p.status,
          selected_option_id: duplicate ? '' : p.selected_option_id,
        }
      : newProposal();

    setEditing({
      id: duplicate || !p ? crypto.randomUUID() : p.id,
      version: duplicate ? undefined : p?.version,
      code: duplicate ? undefined : p?.proposal_code,
      event_id: duplicate ? null : p?.event_id,
      fields,
    });
    snapshot.current = JSON.stringify(fields);
  }

  useEffect(() => {
    if (!data) return;
    const url = new URL(window.location.href);
    const id = url.searchParams.get('proposal');
    if (id) {
      const p = data.data.find(p => p.id === id);
      if (p) open(p);
      url.searchParams.delete('proposal');
      window.history.replaceState(null, '', url);
    }
    const showId = url.searchParams.get('quoteShow');
    if (showId) {
      const show = data.refs.shows.find(s => s.id === showId);
      if (show) {
        const fields = newProposal();
        const option = newOption();
        const line = newLine();
        line.show_ids = [show.id];
        line.label = show.name;
        line.description = show.description || '';
        option.lines = [line];
        fields.options = [option];
        fields.title = show.name;
        setEditing({ id: crypto.randomUUID(), fields });
      }
      url.searchParams.delete('quoteShow');
      window.history.replaceState(null, '', url);
    }
    const opId = url.searchParams.get('quoteOpportunity');
    if (opId) {
      const op = data.refs.opportunities.find(o => o.id === opId);
      if (op) {
        setEditing({
          id: crypto.randomUUID(),
          fields: {
            ...newProposal(),
            title: op.title,
            opportunity_id: op.id,
            client_id: op.client_id || '',
            client_name: data.refs.clients.find(c => c.id === op.client_id)?.company_name || '',
            event_date: op.event_date || '',
            city: op.city || '',
            venue: op.venue || '',
          },
        });
      }
      url.searchParams.delete('quoteOpportunity');
      window.history.replaceState(null, '', url);
    }
  }, [data]);

  const field = <K extends keyof ProposalFields>(key: K, value: ProposalFields[K]) =>
    setEditing(e => (e ? { ...e, fields: { ...e.fields, [key]: value } } : null));

  function lineField(optionId: string, lineId: string, patch: Partial<QuoteLine>) {
    setEditing(e =>
      e
        ? {
            ...e,
            fields: {
              ...e.fields,
              options: e.fields.options.map(o => (o.id === optionId ? { ...o, lines: o.lines.map(l => (l.id === lineId ? { ...l, ...patch } : l)) } : o)),
            },
          }
        : null
    );
  }

  async function mutate(body: Record<string, unknown>) {
    if (busy) return null;
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/api/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await responseJson(r);
      if (!r.ok) throw Error(d.error);
      const latest = await load();
      return { ...d, record: latest?.data.find(p => p.id === body.id) };
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!editing) return false;
    const p = proposalSchema.safeParse(editing.fields);
    if (!p.success) {
      setError(p.error.issues[0].message);
      return false;
    }
    const d = await mutate({ id: editing.id, version: editing.version, fields: p.data });
    if (d) {
      snapshot.current = JSON.stringify(p.data);
      setEditing(e => (e ? { ...e, version: d.version, code: e.code || 'PL-' + e.id.slice(0, 8).toUpperCase(), fields: p.data } : null));
      setNotice('Propuesta guardada correctamente.');
      return true;
    }
    return false;
  }

  const validate = () => {
    const p = proposalSchema.safeParse(editing?.fields);
    if (!p.success) {
      setError(p.error.issues[0].message);
      return null;
    }
    return p.data;
  };

  async function pdf() {
    const q = validate();
    if (!q) return;
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/api/proposals/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: q, code: editing?.code || '' }),
      });
      if (!r.ok) {
        const d = await responseJson(r);
        throw Error(d.error);
      }
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = (editing?.code || 'Performance-Lab-propuesta') + '.pdf';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice('PDF descargado correctamente.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo generar el PDF.');
    } finally {
      setBusy(false);
    }
  }

  async function copyWhatsApp() {
    const q = validate();
    if (!q) return;
    const text = generateWhatsAppMessage(q, settings);
    try {
      await navigator.clipboard.writeText(text);
      setOutputNotice('¡Texto copiado para WhatsApp! Puedes pegarlo directamente.');
    } catch {
      setTab('preview');
      setOutputNotice('Copia el texto del área de vista previa.');
    }
  }

  async function copyEmail() {
    const q = validate();
    if (!q) return;
    const text = generateEmailMessage(q, settings);
    try {
      await navigator.clipboard.writeText(text);
      setOutputNotice('¡Correo electrónico copiado!');
    } catch {
      setTab('preview');
      setOutputNotice('Copia el texto del área de correo.');
    }
  }

  const input = (key: 'title' | 'client_name' | 'contact_name' | 'contact_email' | 'contact_phone' | 'event_date' | 'city' | 'venue' | 'valid_until', label: string, type = 'text') => (
    <label>
      {label}
      <input type={type} required={key === 'title'} value={editing?.fields[key] || ''} onChange={e => field(key, e.target.value)} />
    </label>
  );

  const list = (data?.data || [])
    .filter(p => (archived ? !!p.deleted_at : !p.deleted_at))
    .filter(p => (!status || p.status === status) && (query + ' ' + search).toLowerCase().trim().split(/\s+/).every(s => (p.title + ' ' + p.client_name + ' ' + p.proposal_code).toLowerCase().includes(s)));

  const q = editing?.fields;

  // Active option pricing engine evaluation
  const activeOption = q?.options.find(o => o.id === q.selected_option_id) || q?.options[0];
  const activePricing: OptionPricingResult | null = activeOption
    ? calculateOptionPricing(activeOption, settings, q?.production_fee_tier, q?.agency_commission_percent || 0, q?.event_type, q?.country !== 'España')
    : null;

  const applyTargetSalePrice = (targetPriceCents: number) => {
    if (!q || !activeOption) return;
    const targetPrice = Math.max(0, targetPriceCents);

    const updatedOptions = q.options.map(o => {
      if (o.id !== activeOption.id) return o;
      const linesCount = o.lines.length;
      let updatedLines = o.lines;

      if (linesCount === 1) {
        const line = o.lines[0];
        const qty = Math.max(1, (line.quantity || 1) * (line.units || 1));
        const unitPrice = Math.round(targetPrice / qty);
        updatedLines = [{ ...line, unit_price_cents: unitPrice, reference: false }];
      } else if (linesCount > 1) {
        const totalQty = o.lines.reduce((s, l) => s + Math.max(1, (l.quantity || 1) * (l.units || 1)), 0);
        updatedLines = o.lines.map(l => {
          const qty = Math.max(1, (l.quantity || 1) * (l.units || 1));
          const lineShare = Math.round((targetPrice * qty) / totalQty);
          const unitPrice = Math.round(lineShare / qty);
          return { ...l, unit_price_cents: unitPrice, reference: false };
        });
      }

      return {
        ...o,
        recommended_price_cents: targetPrice,
        lines: updatedLines,
      };
    });

    field('options', updatedOptions);
  };

  const applyMarginPercentage = (marginPercent: number) => {
    if (!activePricing) return;
    const marginDecimal = marginPercent / 100;
    if (marginDecimal >= 1) return;
    const targetPriceCents = Math.round(activePricing.totalRealCostCents / (1 - marginDecimal));
    applyTargetSalePrice(targetPriceCents);
  };

  return (
    <section className="sw-workspace">
      <header className="sw-heading">
        <div>
          <p className="eyebrow">PERFORMANCE LAB · MOTOR DE PRICING Y PROPUESTAS</p>
          <h1>Presupuestos Inteligentes y Rentables</h1>
          <p>Convierte consultas comerciales en costes reales, márgenes garantizados y propuestas listas para el cliente.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="secondary-button" onClick={() => setShowSettingsModal(true)}>
            ⚙ Configuración de Tarifas & Margen
          </button>
          <button className="primary-button" disabled={!data?.canEdit} onClick={() => open()}>
            + Nueva propuesta
          </button>
        </div>
      </header>

      <div className="sw-stats">
        {[
          ['draft', 'Borradores'],
          ['sent', 'Enviadas'],
          ['follow_up', 'Seguimiento'],
          ['accepted', 'Aceptadas'],
        ].map(([v, l]) => (
          <div key={v}>
            <span>{l}</span>
            <b>{data?.data.filter(p => !p.deleted_at && p.status === v).length || 0}</b>
          </div>
        ))}
      </div>

      {error && !editing && (
        <p className="sw-error" role="alert">
          {error} <button onClick={() => void load()}>Reintentar</button>
        </p>
      )}

      <div className="sw-toolbar">
        <input aria-label="Buscar propuestas" placeholder="Cliente, nombre o referencia…" value={search} onChange={e => setSearch(e.target.value)} />
        <select aria-label="Filtrar por estado" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">Todos los estados</option>
          {proposalStatuses.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <label>
          <input type="checkbox" checked={archived} onChange={e => setArchived(e.target.checked)} /> Archivadas
        </label>
        <button onClick={() => void load()}>Actualizar</button>
      </div>

      <div className="sw-proposal-grid">
        {list.map(p => {
          const mainOpt = p.options.find(o => o.id === p.selected_option_id) || p.options[0];
          const pricing = mainOpt ? calculateOptionPricing(mainOpt, settings, p.production_fee_tier, p.agency_commission_percent || 0, p.event_type, p.country !== 'España') : null;
          return (
            <article key={p.id} className="sw-proposal-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className={'sw-pill ' + p.status}>{proposalStatuses.find(s => s[0] === p.status)?.[1]}</span>
                {pricing && (
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: '12px',
                      background: pricing.badgeColor === 'green' ? '#d1fae5' : pricing.badgeColor === 'light_green' ? '#ecfdf5' : pricing.badgeColor === 'yellow' ? '#fef3c7' : '#fee2e2',
                      color: pricing.badgeColor === 'green' ? '#047857' : pricing.badgeColor === 'light_green' ? '#065f46' : pricing.badgeColor === 'yellow' ? '#b45309' : '#b91c1c',
                    }}
                  >
                    Margen: {pricing.grossMarginPercent.toFixed(1)}%
                  </span>
                )}
              </div>
              <small>{p.proposal_code}</small>
              <button className="sw-card-title" onClick={() => open(p)}>
                {p.title}
              </button>
              <p>
                {p.client_name || 'Cliente por definir'} · {p.event_date || 'Fecha por definir'}
              </p>
              <p>
                {p.options.length} {p.options.length === 1 ? 'opción' : 'opciones'} · {p.city || 'Ciudad por definir'}
              </p>
              {pricing && (
                <div style={{ marginTop: '8px', fontSize: '12px', fontWeight: 600, color: '#1e293b' }}>
                  Venta: {money(pricing.finalSalePriceCents)} | Beneficio: {money(pricing.grossProfitCents)}
                </div>
              )}
              <div className="sw-card-actions" style={{ marginTop: '12px' }}>
                <button onClick={() => open(p)}>Abrir propuesta</button>
                <button disabled={!data?.canEdit} onClick={() => open(p, true)}>
                  Duplicar
                </button>
                <button disabled={busy || !data?.canEdit} onClick={() => void mutate({ id: p.id, version: p.version, action: p.deleted_at ? 'restore' : 'archive' })}>
                  {p.deleted_at ? 'Restaurar' : 'Archivar'}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {data && !list.length && (
        <div className="sw-empty">
          <h2>Tu próxima propuesta empieza aquí.</h2>
          <p>Selecciona un cliente, añade los shows y obtén automáticamente los costes reales, márgenes e información lista para WhatsApp o PDF.</p>
        </div>
      )}

      {/* Editor Modal */}
      <dialog className="sw-dialog sw-quote-dialog" ref={dialog} onCancel={e => { e.preventDefault(); close(); }}>
        {editing && q && (
          <>
            <header>
              <div>
                <p className="eyebrow">
                  {editing.code || 'NUEVA PROPUESTA'} · {editing.version ? `VERSIÓN ${editing.version}` : 'SIN GUARDAR'}
                </p>
                <h2>{q.title || 'Diseñar una propuesta'}</h2>
              </div>
              <button disabled={busy} onClick={close} aria-label="Cerrar propuesta">
                ✕
              </button>
            </header>

            {editing.version && <ChatGPTContextButton entityType="proposal" entityId={editing.id} disabled={busy || JSON.stringify(editing.fields) !== snapshot.current} />}

            <nav className="sw-tabs">
              {[
                ['details', '1. Cliente y Evento'],
                ['budget', '2. Conceptos y Opciones'],
                ['pricing', '3. Costes y Motor de Precios'],
                ['preview', '4. Vista Cliente y Exportar'],
                ['history', '5. Historial de Versiones'],
              ].map(([v, l]) => (
                <button type="button" className={tab === v ? 'active' : ''} key={v} onClick={() => setTab(v as any)}>
                  {l}
                </button>
              ))}
            </nav>

            {error && <p className="sw-error" role="alert">{error}</p>}
            {notice && <p className="sw-notice" role="status">{notice}</p>}

            <fieldset disabled={busy || !data?.canEdit}>
              {/* TAB 1: CLIENTE Y EVENTO */}
              {tab === 'details' && (
                <>
                  <div className="sw-form-grid">
                    {input('title', 'Nombre de la propuesta')}
                    <label>
                      Cliente de la base de datos
                      <select
                        value={q.client_id}
                        onChange={e => {
                          const c = data?.refs.clients.find(c => c.id === e.target.value);
                          setEditing(v =>
                            v
                              ? {
                                  ...v,
                                  fields: {
                                    ...v.fields,
                                    client_id: e.target.value,
                                    client_name: c?.company_name || v.fields.client_name,
                                  },
                                }
                              : null
                          );
                        }}
                      >
                        <option value="">Consulta nueva / sin cliente vinculado</option>
                        {data?.refs.clients.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.company_name}
                          </option>
                        ))}
                      </select>
                    </label>
                    {input('client_name', 'Empresa / Cliente comercial')}
                    {input('contact_name', 'Persona de contacto')}
                    {input('contact_email', 'Email de contacto', 'email')}
                    {input('contact_phone', 'Teléfono / WhatsApp', 'tel')}
                    {input('event_date', 'Fecha del evento', 'date')}
                    {input('city', 'Ciudad')}
                    {input('venue', 'Venue / Localización')}
                    <label>
                      País
                      <input value={q.country || 'España'} onChange={e => field('country', e.target.value)} />
                    </label>
                    <label>
                      Tipo de evento
                      <select value={q.event_type || 'other'} onChange={e => field('event_type', e.target.value as any)}>
                        {eventTypes.map(([v, l]) => (
                          <option key={v} value={v}>
                            {l}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Presupuesto del Cliente (€) · Opcional
                      <input
                        type="number"
                        min="0"
                        placeholder="Ej: 1500"
                        value={q.client_budget_cents == null ? '' : q.client_budget_cents / 100}
                        onChange={e => field('client_budget_cents', e.target.value === '' ? null : Math.round(Number(e.target.value) * 100))}
                      />
                    </label>
                    <label>
                      Idioma de salida
                      <select value={q.language} onChange={e => field('language', e.target.value as 'es' | 'en')}>
                        <option value="es">Español</option>
                        <option value="en">English</option>
                      </select>
                    </label>
                    <label>
                      Comisión de Agencia (%)
                      <input
                        type="number"
                        min="0"
                        max="50"
                        step="1"
                        value={q.agency_commission_percent || 0}
                        onChange={e => field('agency_commission_percent', Number(e.target.value))}
                      />
                    </label>
                    <label>
                      Production / Management Fee
                      <select value={q.production_fee_tier || 'none'} onChange={e => field('production_fee_tier', e.target.value as any)}>
                        <option value="none">Sin Production Fee (0%)</option>
                        <option value="medium">Medio (+10%)</option>
                        <option value="complex">Complejo (+15%)</option>
                        <option value="very_complex">Muy Complejo / Gran Logística (+20%)</option>
                      </select>
                    </label>
                  </div>
                  <label>
                    Concepto creativo y brief del cliente
                    <textarea rows={3} placeholder="Qué busca el cliente, momento del evento, ambiente o personaje solicitado…" value={q.brief} onChange={e => field('brief', e.target.value)} />
                  </label>
                  <div className="sw-form-grid">
                    {input('valid_until', 'Validez de la propuesta', 'date')}
                    <label>
                      IVA aplicable (%)
                      <input type="number" min={0} max={100} step="0.01" value={q.tax_percent ?? ''} onChange={e => field('tax_percent', e.target.value === '' ? null : Number(e.target.value))} />
                    </label>
                  </div>
                  <label>
                    Condiciones comerciales y logística para el cliente
                    <textarea rows={3} placeholder="Condiciones de pago, viajes, alojamiento o requisitos técnicos expresados para el cliente…" value={q.conditions} onChange={e => field('conditions', e.target.value)} />
                  </label>
                  <label className="sw-internal">
                    Notas internas privadas (Solo para el equipo de Performance Lab)
                    <textarea rows={3} value={q.internal_notes} onChange={e => field('internal_notes', e.target.value)} />
                  </label>
                </>
              )}

              {/* TAB 2: CONCEPTOS Y OPCIONES */}
              {tab === 'budget' && (
                <>
                  <div className="sw-help">
                    Añade las opciones comerciales (Opción A: Pedido cliente, Opción B: Recomendación, Opción C: Premium). Cada partida incluye los performers, su fee neto, tipo de contratación y extras.
                  </div>
                  {q.options.map((o, oi) => (
                    <section className="sw-option" key={o.id}>
                      <div className="sw-option-head">
                        <label>
                          Opción {oi + 1}
                          <input value={o.title} onChange={e => field('options', q.options.map(x => (x.id === o.id ? { ...x, title: e.target.value } : x)))} />
                        </label>
                        <button
                          disabled={q.options.length === 1}
                          onClick={() => {
                            field('options', q.options.filter(x => x.id !== o.id));
                            if (q.selected_option_id === o.id) field('selected_option_id', '');
                          }}
                        >
                          Eliminar opción
                        </button>
                      </div>

                      {o.lines.map((l, li) => (
                        <div className="sw-line" key={l.id} style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', marginBottom: '14px' }}>
                          <div className="sw-line-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <b style={{ color: '#1e293b' }}>Partida {li + 1}</b>
                            <button
                              style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px' }}
                              onClick={() => field('options', q.options.map(x => (x.id === o.id ? { ...x, lines: x.lines.filter(y => y.id !== l.id) } : x)))}
                            >
                              ✕ Quitar partida
                            </button>
                          </div>

                          <div className="sw-form-grid">
                            <label>
                              Tipo de servicio
                              <select value={l.concept_type || 'character'} onChange={e => lineField(o.id, l.id, { concept_type: e.target.value as any })}>
                                {conceptTypes.map(([v, n]) => (
                                  <option key={v} value={v}>
                                    {n}
                                  </option>
                                ))}
                              </select>
                            </label>

                            <label>
                              Catálogo de Shows / Personajes
                              <select
                                value=""
                                onChange={e => {
                                  const show = data?.refs.shows.find(s => s.id === e.target.value);
                                  if (show && !l.show_ids.includes(show.id)) {
                                    lineField(o.id, l.id, {
                                      show_ids: [...l.show_ids, show.id],
                                      label: l.label ? l.label + ' + ' + show.name : show.name,
                                      description: [l.description, show.description].filter(Boolean).join('\n\n'),
                                    });
                                  }
                                }}
                              >
                                <option value="">Seleccionar del catálogo de shows</option>
                                {data?.refs.shows.map(s => (
                                  <option key={s.id} value={s.id}>
                                    {s.name}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>

                          {l.show_ids.length > 0 && (
                            <div className="sw-chips" style={{ marginBottom: '10px' }}>
                              {l.show_ids.map(id => (
                                <button key={id} onClick={() => lineField(o.id, l.id, { show_ids: l.show_ids.filter(s => s !== id) })}>
                                  {data?.refs.shows.find(s => s.id === id)?.name || 'Show'} ×
                                </button>
                              ))}
                            </div>
                          )}

                          <label>
                            Nombre del concepto comercial (para el cliente)
                            <input value={l.label} onChange={e => lineField(o.id, l.id, { label: e.target.value })} />
                          </label>

                          <label>
                            Descripción comercial
                            <textarea rows={2} value={l.description} onChange={e => lineField(o.id, l.id, { description: e.target.value })} />
                          </label>

                          <div className="sw-form-grid sw-four" style={{ marginTop: '12px' }}>
                            <label>
                              Nº Performers / Cantidad
                              <input type="number" min={1} max={1000} value={l.quantity} onChange={e => lineField(o.id, l.id, { quantity: Number(e.target.value) })} />
                            </label>

                            <label>
                              Tipo de contratación
                              <select value={l.hiring_type || 'cooperative'} onChange={e => lineField(o.id, l.id, { hiring_type: e.target.value as any })}>
                                {hiringTypes.map(([v, n]) => (
                                  <option key={v} value={v}>
                                    {n}
                                  </option>
                                ))}
                              </select>
                            </label>

                            <label>
                              Caché Neto Artista (€ / persona)
                              <input
                                type="number"
                                min={0}
                                placeholder="Ej: 120"
                                value={l.net_fee_performer_cents == null ? '' : l.net_fee_performer_cents / 100}
                                onChange={e => lineField(o.id, l.id, { net_fee_performer_cents: e.target.value === '' ? null : Math.round(Number(e.target.value) * 100) })}
                              />
                            </label>

                            <label>
                              Precio Venta Unidad (€)
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                placeholder="Recomendado auto"
                                value={l.unit_price_cents == null ? '' : l.unit_price_cents / 100}
                                onChange={e => lineField(o.id, l.id, { unit_price_cents: e.target.value === '' ? null : Math.round(Number(e.target.value) * 100), reference: false })}
                              />
                            </label>
                          </div>

                          <div className="sw-form-grid sw-four" style={{ marginTop: '10px' }}>
                            <label>
                              Pases incluidos
                              <input value={l.sets} onChange={e => lineField(o.id, l.id, { sets: e.target.value })} placeholder="Ej: 3 × 15 min" />
                            </label>
                            <label>
                              Duración / Presencia
                              <input value={l.duration} onChange={e => lineField(o.id, l.id, { duration: e.target.value })} placeholder="Ej: 3 horas onsite" />
                            </label>
                            <label>
                              Vestuario asignado
                              <input value={l.wardrobe} onChange={e => lineField(o.id, l.id, { wardrobe: e.target.value })} placeholder="Ej: TV Head Golden" />
                            </label>
                            <label>
                              Cambios de vestuario extras
                              <input type="number" min={0} value={l.extra_costume_changes || 0} onChange={e => lineField(o.id, l.id, { extra_costume_changes: Number(e.target.value) })} />
                            </label>
                          </div>

                          {/* Detail Cost Breakdown Drawer */}
                          <details style={{ marginTop: '12px', background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                            <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#334155' }}>💰 Desglose de Gastos Extras y Logística de esta partida</summary>
                            <div className="sw-form-grid" style={{ marginTop: '10px' }}>
                              <label>
                                Viaje / Transporte (€)
                                <input
                                  type="number"
                                  min={0}
                                  value={l.travel_cost_cents ? l.travel_cost_cents / 100 : ''}
                                  onChange={e => lineField(o.id, l.id, { travel_cost_cents: Math.round(Number(e.target.value) * 100) })}
                                />
                              </label>
                              <label>
                                Hotel / Alojamiento (€)
                                <input
                                  type="number"
                                  min={0}
                                  value={l.hotel_cost_cents ? l.hotel_cost_cents / 100 : ''}
                                  onChange={e => lineField(o.id, l.id, { hotel_cost_cents: Math.round(Number(e.target.value) * 100) })}
                                />
                              </label>
                              <label>
                                Dietas / Manutención (€)
                                <input
                                  type="number"
                                  min={0}
                                  value={l.per_diem_cost_cents ? l.per_diem_cost_cents / 100 : ''}
                                  onChange={e => lineField(o.id, l.id, { per_diem_cost_cents: Math.round(Number(e.target.value) * 100) })}
                                />
                              </label>
                              <label>
                                Envío de Vestuario / Shipping (€)
                                <input
                                  type="number"
                                  min={0}
                                  value={l.shipping_cost_cents ? l.shipping_cost_cents / 100 : ''}
                                  onChange={e => lineField(o.id, l.id, { shipping_cost_cents: Math.round(Number(e.target.value) * 100) })}
                                />
                              </label>
                              <label>
                                Horas de Ensayo
                                <input type="number" min={0} value={l.rehearsal_hours || 0} onChange={e => lineField(o.id, l.id, { rehearsal_hours: Number(e.target.value) })} />
                              </label>
                              <label>
                                ¿Requiere Coordinador?
                                <select
                                  value={l.coordinator_required ? 'yes' : 'no'}
                                  onChange={e => lineField(o.id, l.id, { coordinator_required: e.target.value === 'yes' })}
                                >
                                  <option value="no">No</option>
                                  <option value="yes">Sí</option>
                                </select>
                              </label>
                            </div>
                          </details>
                        </div>
                      ))}

                      <button onClick={() => field('options', q.options.map(x => (x.id === o.id ? { ...x, lines: [...x.lines, newLine()] } : x)))}>
                        + Añadir concepto o partida
                      </button>
                    </section>
                  ))}

                  <button onClick={() => field('options', [...q.options, { ...newOption(), title: 'Alternativa ' + (q.options.length + 1) }])}>
                    + Añadir alternativa independiente (Opción B / C)
                  </button>
                </>
              )}

              {/* TAB 3: COSTES INTERNOS Y MOTOR DE PRECIOS */}
              {tab === 'pricing' && activePricing && (
                <div style={{ padding: '8px 0' }}>
                  {/* Warnings Banner */}
                  {activePricing.warnings.length > 0 && (
                    <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {activePricing.warnings.map((w, idx) => (
                        <div
                          key={idx}
                          style={{
                            padding: '10px 14px',
                            borderRadius: '8px',
                            fontSize: '13px',
                            fontWeight: 600,
                            background: w.severity === 'error' ? '#fef2f2' : w.severity === 'warning' ? '#fffbebf' : '#f0f9ff',
                            border: `1px solid ${w.severity === 'error' ? '#fca5a5' : w.severity === 'warning' ? '#fcd34d' : '#bae6fd'}`,
                            color: w.severity === 'error' ? '#991b1b' : w.severity === 'warning' ? '#92400e' : '#0369a1',
                          }}
                        >
                          {w.message}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Internal Cost Breakdown */}
                  <section style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '18px', marginBottom: '20px' }}>
                    <h3 style={{ margin: '0 0 14px', fontSize: '15px', color: '#0f172a' }}>🔒 DESGLOSE DE COSTES REALES (SOLO PERFORMANCE LAB)</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', fontSize: '12px' }}>
                      <div>
                        <span style={{ color: '#64748b', display: 'block' }}>Neto Artistas</span>
                        <strong style={{ fontSize: '16px' }}>{money(activePricing.totalArtistNetCents)}</strong>
                      </div>
                      <div>
                        <span style={{ color: '#64748b', display: 'block' }}>5% Cooperativa</span>
                        <strong style={{ fontSize: '16px' }}>{money(activePricing.totalCoopFeeCents)}</strong>
                      </div>
                      <div>
                        <span style={{ color: '#64748b', display: 'block' }}>Altas Cooperativa</span>
                        <strong style={{ fontSize: '16px' }}>{money(activePricing.totalRegistrationFeeCents)}</strong>
                      </div>
                      <div>
                        <span style={{ color: '#64748b', display: 'block' }}>Gastos y Logística</span>
                        <strong style={{ fontSize: '16px' }}>{money(activePricing.subtotalExtrasCents)}</strong>
                      </div>
                      <div>
                        <span style={{ color: '#64748b', display: 'block' }}>Production Fee</span>
                        <strong style={{ fontSize: '16px' }}>{money(activePricing.productionFeeCents)}</strong>
                      </div>
                      <div style={{ background: '#e2e8f0', padding: '8px 12px', borderRadius: '8px' }}>
                        <span style={{ color: '#334155', display: 'block', fontWeight: 600 }}>COSTE REAL TOTAL</span>
                        <strong style={{ fontSize: '18px', color: '#0f172a' }}>{money(activePricing.totalRealCostCents)}</strong>
                      </div>
                    </div>
                  </section>

                  {/* Pricing Cards */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                    <h3 style={{ fontSize: '15px', margin: 0, color: '#0f172a' }}>💳 SELECCIONAR MARGEN / TARJETA DE PRECIO</h3>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>Haz clic en cualquier tarjeta para fijar ese precio automáticamente</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                    {/* CARD 30% */}
                    <button
                      type="button"
                      onClick={() => applyMarginPercentage(30)}
                      style={{
                        background: Math.abs(activePricing.grossMarginPercent - 30) < 0.8 ? '#fef3c7' : '#ffffff',
                        border: Math.abs(activePricing.grossMarginPercent - 30) < 0.8 ? '2px solid #d97706' : '1px solid #cbd5e1',
                        padding: '14px',
                        borderRadius: '10px',
                        textAlign: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: Math.abs(activePricing.grossMarginPercent - 30) < 0.8 ? '0 0 0 3px rgba(217, 119, 6, 0.2)' : '0 1px 3px rgba(0,0,0,0.05)',
                      }}
                    >
                      <span style={{ fontSize: '11px', color: '#b45309', fontWeight: 700, display: 'block' }}>MÍNIMO (30%)</span>
                      <strong style={{ fontSize: '18px', color: '#92400e', display: 'block', margin: '4px 0' }}>{money(activePricing.priceMargin30Cents)}</strong>
                      <span style={{ fontSize: '10px', background: Math.abs(activePricing.grossMarginPercent - 30) < 0.8 ? '#d97706' : '#f1f5f9', color: Math.abs(activePricing.grossMarginPercent - 30) < 0.8 ? '#ffffff' : '#475569', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>
                        {Math.abs(activePricing.grossMarginPercent - 30) < 0.8 ? '✓ SELECCIONADO' : 'APLICAR 30%'}
                      </span>
                    </button>

                    {/* CARD 35% */}
                    <button
                      type="button"
                      onClick={() => applyMarginPercentage(35)}
                      style={{
                        background: Math.abs(activePricing.grossMarginPercent - 35) < 0.8 ? '#eff6ff' : '#ffffff',
                        border: Math.abs(activePricing.grossMarginPercent - 35) < 0.8 ? '2px solid #2563eb' : '1px solid #93c5fd',
                        padding: '14px',
                        borderRadius: '10px',
                        textAlign: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: Math.abs(activePricing.grossMarginPercent - 35) < 0.8 ? '0 0 0 3px rgba(37, 99, 235, 0.2)' : '0 1px 3px rgba(0,0,0,0.05)',
                      }}
                    >
                      <span style={{ fontSize: '11px', color: '#1d4ed8', fontWeight: 700, display: 'block' }}>BUENO (35%)</span>
                      <strong style={{ fontSize: '18px', color: '#1e40af', display: 'block', margin: '4px 0' }}>{money(activePricing.priceMargin35Cents)}</strong>
                      <span style={{ fontSize: '10px', background: Math.abs(activePricing.grossMarginPercent - 35) < 0.8 ? '#2563eb' : '#dbeafe', color: Math.abs(activePricing.grossMarginPercent - 35) < 0.8 ? '#ffffff' : '#1e40af', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>
                        {Math.abs(activePricing.grossMarginPercent - 35) < 0.8 ? '✓ SELECCIONADO' : 'APLICAR 35%'}
                      </span>
                    </button>

                    {/* CARD 40% */}
                    <button
                      type="button"
                      onClick={() => applyMarginPercentage(40)}
                      style={{
                        background: Math.abs(activePricing.grossMarginPercent - 40) < 0.8 ? '#dcfce7' : '#f0fdf4',
                        border: Math.abs(activePricing.grossMarginPercent - 40) < 0.8 ? '2px solid #16a34a' : '2px solid #22c55e',
                        padding: '14px',
                        borderRadius: '10px',
                        textAlign: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: Math.abs(activePricing.grossMarginPercent - 40) < 0.8 ? '0 0 0 3px rgba(22, 163, 74, 0.25)' : '0 1px 3px rgba(0,0,0,0.05)',
                      }}
                    >
                      <span style={{ fontSize: '11px', color: '#15803d', fontWeight: 800, display: 'block' }}>🎯 OBJETIVO (40%)</span>
                      <strong style={{ fontSize: '20px', color: '#166534', display: 'block', margin: '4px 0' }}>{money(activePricing.priceMargin40Cents)}</strong>
                      <span style={{ fontSize: '10px', background: '#16a34a', color: '#ffffff', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>
                        {Math.abs(activePricing.grossMarginPercent - 40) < 0.8 ? '✓ SELECCIONADO' : 'APLICAR 40%'}
                      </span>
                    </button>

                    {/* CARD 45% */}
                    <button
                      type="button"
                      onClick={() => applyMarginPercentage(45)}
                      style={{
                        background: Math.abs(activePricing.grossMarginPercent - 45) < 0.8 ? '#faf5ff' : '#ffffff',
                        border: Math.abs(activePricing.grossMarginPercent - 45) < 0.8 ? '2px solid #9333ea' : '1px solid #cbd5e1',
                        padding: '14px',
                        borderRadius: '10px',
                        textAlign: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: Math.abs(activePricing.grossMarginPercent - 45) < 0.8 ? '0 0 0 3px rgba(147, 51, 234, 0.2)' : '0 1px 3px rgba(0,0,0,0.05)',
                      }}
                    >
                      <span style={{ fontSize: '11px', color: '#7e22ce', fontWeight: 700, display: 'block' }}>PREMIUM (45%)</span>
                      <strong style={{ fontSize: '18px', color: '#6b21a8', display: 'block', margin: '4px 0' }}>{money(activePricing.priceMargin45Cents)}</strong>
                      <span style={{ fontSize: '10px', background: Math.abs(activePricing.grossMarginPercent - 45) < 0.8 ? '#9333ea' : '#f1f5f9', color: Math.abs(activePricing.grossMarginPercent - 45) < 0.8 ? '#ffffff' : '#475569', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>
                        {Math.abs(activePricing.grossMarginPercent - 45) < 0.8 ? '✓ SELECCIONADO' : 'APLICAR 45%'}
                      </span>
                    </button>
                  </div>

                  {/* Custom Margin & Direct Price Override Control Bar */}
                  <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '14px', marginBottom: '20px', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>Elegir otro % de Margen:</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <input
                          type="number"
                          min={1}
                          max={99}
                          step="1"
                          value={customMarginInput}
                          onChange={e => setCustomMarginInput(e.target.value)}
                          style={{ width: '60px', padding: '6px 8px', borderRadius: '6px', border: '1px solid #94a3b8', fontWeight: 700, textAlign: 'center', fontSize: '13px' }}
                        />
                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#475569' }}>%</span>
                      </div>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => {
                          const val = Number(customMarginInput);
                          if (val > 0 && val < 100) applyMarginPercentage(val);
                        }}
                        style={{ padding: '6px 12px', fontSize: '12px' }}
                      >
                        Aplicar %
                      </button>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>Escribir Precio Manual (€):</span>
                      <input
                        type="number"
                        min={0}
                        step="1"
                        placeholder={(activePricing.finalSalePriceCents / 100).toFixed(2)}
                        value={customPriceInput}
                        onChange={e => setCustomPriceInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            const val = Number(customPriceInput);
                            if (!isNaN(val) && val >= 0) applyTargetSalePrice(Math.round(val * 100));
                          }
                        }}
                        style={{ width: '100px', padding: '6px 8px', borderRadius: '6px', border: '1px solid #94a3b8', fontWeight: 700, textAlign: 'right', fontSize: '13px' }}
                      />
                      <button
                        type="button"
                        className="primary-button"
                        onClick={() => {
                          const val = Number(customPriceInput);
                          if (!isNaN(val) && val >= 0) applyTargetSalePrice(Math.round(val * 100));
                        }}
                        style={{ padding: '6px 12px', fontSize: '12px' }}
                      >
                        Fijar Precio
                      </button>
                    </div>
                  </div>

                  {/* Profitability Result & Manual Price Override */}
                  <section
                    style={{
                      background: activePricing.badgeColor === 'green' ? '#f0fdf4' : activePricing.badgeColor === 'light_green' ? '#ecfdf5' : activePricing.badgeColor === 'yellow' ? '#fffbeb' : '#fef2f2',
                      border: `1px solid ${activePricing.badgeColor === 'green' ? '#86efac' : activePricing.badgeColor === 'light_green' ? '#a7f3d0' : activePricing.badgeColor === 'yellow' ? '#fde68a' : '#fca5a5'}`,
                      borderRadius: '12px',
                      padding: '18px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                      <div>
                        <span style={{ fontSize: '12px', color: '#475569', fontWeight: 600 }}>PRECIO FINAL CLIENTE (SIN IVA)</span>
                        <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>{money(activePricing.finalSalePriceCents)}</div>
                      </div>

                      <div>
                        <span style={{ fontSize: '12px', color: '#475569', fontWeight: 600 }}>BENEFICIO BRUTO (€)</span>
                        <div style={{ fontSize: '24px', fontWeight: 800, color: activePricing.grossProfitCents >= 0 ? '#15803d' : '#b91c1c' }}>
                          {money(activePricing.grossProfitCents)}
                        </div>
                      </div>

                      <div>
                        <span style={{ fontSize: '12px', color: '#475569', fontWeight: 600 }}>MARGEN (%)</span>
                        <div style={{ fontSize: '24px', fontWeight: 800, color: activePricing.grossMarginPercent >= 30 ? '#15803d' : '#b91c1c' }}>
                          {activePricing.grossMarginPercent.toFixed(1)}%
                        </div>
                      </div>

                      <div>
                        <span style={{ fontSize: '12px', color: '#475569', fontWeight: 600 }}>CONTRIBUCIÓN / PERFORMER</span>
                        <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>
                          {(activePricing.performerContributionCents / 100).toFixed(0)} €
                        </div>
                      </div>
                    </div>
                  </section>
                </div>
              )}

              {/* TAB 4: VISTA CLIENTE Y EXPORTAR */}
              {tab === 'preview' && (
                <>
                  <div className="sw-help">
                    Genera de forma limpia la salida para WhatsApp, Correo electrónico o PDF. NUNCA se muestran netos, cooperativas ni márgenes internos al cliente.
                  </div>

                  {outputNotice && <p className="sw-notice">{outputNotice}</p>}

                  <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
                    <button type="button" className="secondary-button" onClick={() => void copyWhatsApp()}>
                      📱 Copiar WhatsApp ({q.language.toUpperCase()})
                    </button>
                    <button type="button" className="secondary-button" onClick={() => void copyEmail()}>
                      ✉ Copiar Email
                    </button>
                    <button type="button" className="primary-button" onClick={() => void pdf()}>
                      📄 Descargar PDF Brandeado
                    </button>
                  </div>

                  <textarea className="sw-public-preview" readOnly value={generateWhatsAppMessage(q, settings)} aria-label="Texto de salida comercial" rows={12} />
                </>
              )}

              {/* TAB 5: HISTORIAL DE VERSIONES */}
              {tab === 'history' && (
                <div>
                  <h3 style={{ fontSize: '15px', margin: '0 0 12px' }}>📜 Historial de Cambios y Versiones</h3>
                  {q.versions && q.versions.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {q.versions.map((v, idx) => (
                        <div key={idx} style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: '14px', borderRadius: '8px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <strong>Versión {v.version}</strong>
                            <small>{new Date(v.timestamp).toLocaleString('es-ES')}</small>
                          </div>
                          <p style={{ margin: 0, fontSize: '13px', color: '#475569' }}>{v.notes}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ color: '#94a3b8' }}>No hay versiones guardadas anteriores todavía. Cada vez que guardes cambios, se guardará un snapshot histórico.</p>
                  )}
                </div>
              )}
            </fieldset>

            <footer className="sw-sticky">
              <button className="primary-button" onClick={() => void save()}>
                {busy ? 'Guardando…' : 'Guardar propuesta'}
              </button>
              <button onClick={() => void pdf()}>Descargar PDF</button>
              <button onClick={() => void copyWhatsApp()}>Copiar WhatsApp</button>
            </footer>

            {editing.event_id ? (
              <a className="primary-button" href={`/?event=${editing.event_id}#eventos`}>
                Abrir evento vinculado
              </a>
            ) : (
              q.status === 'accepted' && (
                <div className="sw-help" style={{ marginTop: '16px' }}>
                  <p>Guarda la propuesta y crea automáticamente el evento en la base de datos de Producción con la opción elegida, cliente, fecha y shows.</p>
                  <button
                    onClick={async () => {
                      if (!(await save())) return;
                      const d = await mutate({ id: editing.id, action: 'create_event' });
                      if (d) {
                        setEditing(e => (e ? { ...e, event_id: d.event_id, version: d.record?.version ?? e.version } : null));
                        setNotice('Evento creado e integrado en Producción.');
                      }
                    }}
                  >
                    Crear y vincular Evento
                  </button>
                </div>
              )
            )}
          </>
        )}
      </dialog>

      {/* Pricing Engine Settings Modal */}
      {showSettingsModal && (
        <PricingSettingsDialog
          settings={settings}
          canEdit={data?.canEdit || false}
          onClose={() => setShowSettingsModal(false)}
          onSave={updated => {
            if (data) setData({ ...data, settings: updated });
          }}
        />
      )}
    </section>
  );
}
