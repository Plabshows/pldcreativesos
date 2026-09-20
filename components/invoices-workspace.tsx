'use client';

import { useEffect, useRef, useState } from 'react';
import {
  invoiceBalance,
  invoiceMoney,
  invoiceToday,
  invoiceTotals,
  invoiceStatuses,
  followupKinds,
  latestFollowup,
  type Invoice,
  type InvoiceFields,
  type InvoiceData
} from '@/lib/invoices';
import { responseJson } from '@/lib/response-json';
import { CollectionEvidenceList } from './collection-evidence';
import './crm-workspace.css';
import './invoices.css';

const empty: InvoiceData = {
  invoices: [],
  payments: [],
  followups: [],
  history: [],
  clients: [],
  events: [],
  proposals: [],
  canEdit: false
};

const day = (date: string | null) =>
  date ? new Date(date.slice(0, 10) + 'T12:00:00').toLocaleDateString('es-ES') : 'Por confirmar';

function Summary({ data, rows, currency }: { data: InvoiceData; rows: Invoice[]; currency: string }) {
  const t = invoiceTotals(rows, data.payments);
  return (
    <div className="inv-summary">
      {[
        ['Pendiente confirmado', invoiceMoney(t.confirmedPending, currency)],
        ['Cobros por verificar', invoiceMoney(t.unverifiedAmount, currency)],
        ['Exposición máxima', invoiceMoney(t.maxExposure, currency)],
        ['Total facturado', invoiceMoney(t.total, currency)],
        ['Cobrado', invoiceMoney(t.received, currency)],
        ['Vencido', invoiceMoney(t.overdue, currency)],
        ['Facturas pendientes', t.count]
      ].map(([label, value]) => (
        <div key={String(label)}>
          <small>{label}</small>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}

export function InvoiceRelated({ clientId, eventId }: { clientId?: string; eventId?: string }) {
  const [data, setData] = useState<InvoiceData>(empty);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    fetch('/api/invoices')
      .then(async r => {
        const d = await responseJson(r);
        if (!r.ok) throw Error(d.error);
        if (active) setData(d);
      })
      .catch(() => {
        if (active) setError('No se pudo cargar la facturación.');
      });
    return () => {
      active = false;
    };
  }, [clientId, eventId]);

  const rows = data.invoices.filter(
    i => (!clientId || i.client_id === clientId) && (!eventId || i.event_id === eventId)
  );

  return (
    <section className="inv-related">
      <h3>{clientId ? 'Facturas' : 'Facturación'}</h3>
      {error && <p role="alert">{error}</p>}
      {[...new Set(rows.map(i => i.currency))].map(c => (
        <Summary key={c} data={data} rows={rows.filter(i => i.currency === c)} currency={c} />
      ))}
      {rows.map(i => {
        const b = invoiceBalance(i, data.payments);
        return (
          <p key={i.id}>
            <a href={`/?invoice=${i.id}#facturas`}>{i.number}</a> · {invoiceMoney(i.total_cents, i.currency)} ·{' '}
            {invoiceStatuses[b.status]} · Pendiente {invoiceMoney(b.pending, i.currency)}
          </p>
        );
      })}
      {!rows.length && !error && <p>Sin facturas registradas.</p>}
      <a href="/#facturas">Abrir Facturas</a>
    </section>
  );
}

export function InvoicesWorkspace({
  query = '',
  initialPending = false,
  initialFollowups = false
}: {
  query?: string;
  initialPending?: boolean;
  initialFollowups?: boolean;
}) {
  const [data, setData] = useState<InvoiceData>(empty);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Invoice | null | undefined>();
  const [currency, setCurrency] = useState('EUR');
  const [search, setSearch] = useState(query);
  const [status, setStatus] = useState(initialPending ? 'outstanding' : '');
  const [client, setClient] = useState('');
  const [event, setEvent] = useState('');
  const [year, setYear] = useState('');
  const [month, setMonth] = useState('');
  const [sort, setSort] = useState('due');
  const [dueActions, setDueActions] = useState(initialFollowups);
  const [today, setToday] = useState(invoiceToday());
  const [markingId, setMarkingId] = useState<string | null>(null);

  async function load() {
    try {
      const r = await fetch('/api/invoices', { cache: 'no-store' });
      const d = await responseJson(r);
      if (!r.ok) throw Error(d.error);
      setData(d);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar.');
    } finally {
      setLoading(false);
    }
  }

  async function handleMarkPaid(id: string) {
    const invoice = data.invoices.find(invoice => invoice.id === id);
    if (invoice) setEditing(invoice);
  }

  useEffect(() => {
    void load();
    const tick = () => {
      setToday(invoiceToday());
      void load();
    };
    window.addEventListener('focus', tick);
    const timer = setInterval(tick, 60000);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', tick);
    };
  }, []);

  useEffect(() => setSearch(query), [query]);

  useEffect(() => {
    const u = new URL(window.location.href);
    const id = u.searchParams.get('invoice');
    const i = data.invoices.find(inv => inv.id === id);
    if (i) {
      setEditing(i);
      u.searchParams.delete('invoice');
      window.history.replaceState(null, '', u);
    }
  }, [data]);

  const clientName = (i: Invoice) => data.clients.find(c => c.id === i.client_id)?.company_name || '—';
  const eventName = (i: Invoice) => data.events.find(e => e.id === i.event_id)?.event_name || '—';

  const base = data.invoices.filter(
    i =>
      (!currency || i.currency === currency) &&
      (!client || i.client_id === client) &&
      (!event || i.event_id === event) &&
      (!year || i.issue_date?.startsWith(year)) &&
      (!month || i.issue_date?.slice(5, 7) === month)
  );

  const rows = base
    .filter(i => {
      const b = invoiceBalance(i, data.payments, today);
      const f = latestFollowup(i, data.followups);
      const text = [i.number, clientName(i), eventName(i), i.concept]
        .join(' ')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
      return (
        search
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .split(/\s+/)
          .every(w => text.includes(w)) &&
        (!status ||
          (status === 'outstanding'
            ? b.pending > 0 && !['draft', 'cancelled'].includes(b.status)
            : status === 'partial'
            ? b.received > 0 && b.pending > 0 && b.status !== 'cancelled'
            : b.status === status)) &&
        (!dueActions ||
          (b.pending > 0 &&
            !['draft', 'cancelled'].includes(b.status) &&
            f?.next_action_date &&
            f.next_action_date <= today))
      );
    })
    .sort((a, b) =>
      sort === 'amount'
        ? b.total_cents - a.total_cents
        : sort === 'client'
        ? clientName(a).localeCompare(clientName(b))
        : sort === 'old'
        ? (a.issue_date || '9999').localeCompare(b.issue_date || '9999')
        : sort === 'new'
        ? (b.issue_date || '').localeCompare(a.issue_date || '')
        : (a.due_date || '9999').localeCompare(b.due_date || '9999')
    );

  return (
    <section className="data-module">
      <header className="module-head">
        <div>
          <p className="eyebrow">CONTROL DE COBROS</p>
          <h1>Facturas</h1>
          <p>Facturas emitidas, pagos recibidos y próximos seguimientos.</p>
        </div>
        <button className="primary-button" disabled={!data.canEdit} onClick={() => setEditing(null)}>
          + Añadir factura
        </button>
      </header>
      {error && <p role="alert">{error}</p>}
      <div className="crm-toolbar">
        <label>
          Moneda
          <select value={currency} onChange={e => setCurrency(e.target.value)}>
            {[...new Set(['EUR', 'GBP', 'AED', 'USD', ...data.invoices.map(i => i.currency)])].map(c => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <button onClick={() => void load()}>Actualizar</button>
      </div>
      <Summary data={data} rows={base} currency={currency} />
      <p>Resumen según cliente, evento, período y moneda. Excluye borradores y canceladas.</p>

      <div className="crm-toolbar">
        <input
          aria-label="Buscar facturas"
          placeholder="Nº factura, cliente, evento, concepto…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select aria-label="Estado de facturas" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">Todas</option>
          <option value="outstanding">Pendientes de cobro</option>
          {Object.entries(invoiceStatuses).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select aria-label="Cliente" value={client} onChange={e => setClient(e.target.value)}>
          <option value="">Todos los clientes</option>
          {data.clients.map(c => (
            <option key={c.id} value={c.id}>
              {c.company_name}
            </option>
          ))}
        </select>
        <select aria-label="Evento" value={event} onChange={e => setEvent(e.target.value)}>
          <option value="">Todos los eventos</option>
          {data.events.map(e => (
            <option key={e.id} value={e.id}>
              {e.event_date || 'Sin fecha'} · {e.event_name}
              {e.venue ? ' · ' + e.venue : ''}
            </option>
          ))}
        </select>
        <select aria-label="Año" value={year} onChange={e => setYear(e.target.value)}>
          <option value="">Todos los años</option>
          {[...new Set(data.invoices.flatMap(i => (i.issue_date ? [i.issue_date.slice(0, 4)] : [])))]
            .sort()
            .map(y => (
              <option key={y}>{y}</option>
            ))}
        </select>
        <select aria-label="Mes" value={month} onChange={e => setMonth(e.target.value)}>
          <option value="">Todos los meses</option>
          {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map(m => (
            <option key={m}>{m}</option>
          ))}
        </select>
        <select aria-label="Orden" value={sort} onChange={e => setSort(e.target.value)}>
          {[
            ['due', 'Vencimiento'],
            ['amount', 'Importe'],
            ['client', 'Cliente'],
            ['old', 'Más antiguas'],
            ['new', 'Más recientes']
          ].map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <label>
          <input type="checkbox" checked={dueActions} onChange={e => setDueActions(e.target.checked)} />
          Seguimientos pendientes
        </label>
      </div>

      {loading ? (
        <p>Cargando facturas…</p>
      ) : (
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                {[
                  'Nº Factura',
                  'Cliente',
                  'Evento',
                  'Emisión',
                  'Vencimiento',
                  'Importe',
                  'Cobrado',
                  'Pendiente',
                  'Estado',
                  'Último seguimiento',
                  'Próxima acción'
                ].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(i => {
                const b = invoiceBalance(i, data.payments, today);
                const f = latestFollowup(i, data.followups);
                return (
                  <tr key={i.id}>
                    <td>
                      <button className="text-button" onClick={() => setEditing(i)}>
                        {i.number}
                      </button>
                    </td>
                    <td>{clientName(i)}</td>
                    <td>{eventName(i)}</td>
                    <td>{day(i.issue_date)}</td>
                    <td>{day(i.due_date)}</td>
                    <td>{invoiceMoney(i.total_cents, i.currency)}</td>
                    <td>{invoiceMoney(b.received, i.currency)}</td>
                    <td>{invoiceMoney(b.pending, i.currency)}</td>
                    <td>
                      <div className="status-cell">
                        <span className={'inv-status ' + b.status}>{invoiceStatuses[b.status]}</span>
                        {b.pending > 0 && !['draft', 'cancelled'].includes(b.status) && data.canEdit && (
                          <button
                            className="quick-pay-button"
                            disabled={markingId === i.id}
                            onClick={() => void handleMarkPaid(i.id)}
                            title="Marcar rápidamente como pagada hoy"
                          >
                            Registrar cobro
                          </button>
                        )}
                      </div>
                    </td>
                    <td>{f ? `${day(f.followup_date)} · ${followupKinds[f.kind]}` : '—'}</td>
                    <td>
                      {f?.next_action || '—'} {f?.next_action_date && day(f.next_action_date)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!rows.length && <p>No hay facturas con estos filtros.</p>}
        </div>
      )}

      {editing !== undefined && (
        <InvoiceEditor
          key={editing?.id || 'new'}
          invoice={editing}
          data={data}
          onClose={() => setEditing(undefined)}
          onChanged={load}
        />
      )}
    </section>
  );
}

function InvoiceEditor({
  invoice,
  data,
  onClose,
  onChanged
}: {
  invoice: Invoice | null;
  data: InvoiceData;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [id] = useState(invoice?.id || crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(!!invoice);

  const [fields, setFields] = useState<InvoiceFields>(
    invoice
      ? (Object.fromEntries(
          Object.entries(invoice).filter(([k]) =>
            [
              'number',
              'client_id',
              'event_id',
              'proposal_id',
              'issue_date',
              'due_date',
              'concept',
              'base_cents',
              'tax_cents',
              'retention_cents',
              'total_cents',
              'currency',
              'status',
              'document_url',
              'notes'
            ].includes(k)
          )
        ) as InvoiceFields)
      : {
          number: '',
          client_id: '',
          event_id: null,
          proposal_id: null,
          issue_date: invoiceToday(),
          due_date: invoiceToday(),
          concept: '',
          base_cents: null,
          tax_cents: null,
          retention_cents: null,
          total_cents: 0,
          currency: 'EUR',
          status: 'draft',
          document_url: '',
          notes: ''
        }
  );

  const dialog = useRef<HTMLDialogElement>(null);
  const paymentId = useRef(crypto.randomUUID());
  const followupId = useRef(crypto.randomUUID());

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  const current = data.invoices.find(i => i.id === id) || invoice;
  const balance = current ? invoiceBalance(current, data.payments) : null;

  async function send(body: unknown) {
    if (busy) return false;
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const d = await responseJson(r);
      if (!r.ok) throw Error(d.error);
      await onChanged();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  const field = (key: keyof InvoiceFields, value: unknown) =>
    setFields(f => ({ ...f, [key]: value }));

  const input = (key: keyof InvoiceFields, label: string, type = 'text') => (
    <label>
      {label}
      <input
        type={type}
        required={['number', 'currency'].includes(key)}
        value={String(fields[key] ?? '')}
        onChange={e =>
          field(key, e.target.value || (['issue_date', 'due_date'].includes(key) ? null : ''))
        }
      />
    </label>
  );

  const timeline = [
    ...data.history
      .filter(h => h.invoice_id === id)
      .map(h => ({ id: h.id, date: h.created_at, text: h.body })),
    ...data.followups
      .filter(f => f.invoice_id === id)
      .map(f => ({
        id: f.id,
        date: f.followup_date + 'T' + f.created_at.split('T')[1],
        text:
          followupKinds[f.kind] +
          ': ' +
          f.note +
          (f.next_action ? ' · Próxima acción: ' + f.next_action + ' ' + day(f.next_action_date || '') : '')
      })),
    ...data.payments
      .filter(p => p.invoice_id === id)
      .map(p => ({
        id: p.id,
        date: p.payment_date + 'T' + p.created_at.split('T')[1],
        text:
          'Pago recibido: ' +
          invoiceMoney(p.amount_cents, p.currency) +
          ' · ' +
          [p.method, p.reference, p.note].filter(Boolean).join(' · ')
      }))
  ].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <dialog
      ref={dialog}
      className="crm-dialog"
      onCancel={e => {
        if (busy) e.preventDefault();
        else onClose();
      }}
    >
      <header>
        <h2>{saved ? current?.number : 'Añadir factura'}</h2>
        <button disabled={busy} onClick={onClose}>
          Cerrar
        </button>
      </header>
      {error && <p role="alert">{error}</p>}
      {balance && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', margin: '12px 0' }}>
          <p className={'inv-status ' + balance.status} style={{ margin: 0 }}>
            {invoiceStatuses[balance.status]} · Cobrado {invoiceMoney(balance.received, fields.currency)} · Pendiente{' '}
            {invoiceMoney(balance.pending, fields.currency)}
          </p>
          {balance.pending > 0 && !['draft', 'cancelled'].includes(fields.status) && data.canEdit && (
            <button
              type="button"
              className="quick-pay-button"
              disabled={busy}
              onClick={() => dialog.current?.querySelector<HTMLInputElement>('input[name="amount"]')?.focus()}
            >
              Registrar cobro
            </button>
          )}
        </div>
      )}
      <form
        onSubmit={async e => {
          e.preventDefault();
          if (await send({ action: 'save', id, version: invoice?.version, fields })) {
            setSaved(true);
            onClose();
          }
        }}
      >
        <fieldset disabled={busy || !data.canEdit}>
          <div className="crm-form-grid">
            {input('number', 'Nº factura')}
            <label>
              Cliente
              <select
                required
                value={fields.client_id}
                onChange={e =>
                  setFields(f => ({ ...f, client_id: e.target.value, event_id: null, proposal_id: null }))
                }
              >
                <option value="">Seleccionar cliente…</option>
                {data.clients.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.company_name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Evento (opcional)
              <select
                value={fields.event_id || ''}
                onChange={e => field('event_id', e.target.value || null)}
              >
                <option value="">Sin evento</option>
                {data.events
                  .filter(e => !e.client_id || e.client_id === fields.client_id)
                  .map(e => (
                    <option key={e.id} value={e.id}>
                      {e.event_date || 'Sin fecha'} · {e.event_name}
                      {e.venue ? ' · ' + e.venue : ''}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Propuesta (opcional)
              <select
                value={fields.proposal_id || ''}
                onChange={e => field('proposal_id', e.target.value || null)}
              >
                <option value="">Sin propuesta</option>
                {data.proposals
                  .filter(p => !p.client_id || p.client_id === fields.client_id)
                  .map(p => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
              </select>
            </label>
            {input('issue_date', 'Fecha de emisión', 'date')}
            {input('due_date', 'Vencimiento', 'date')}
            {(['base_cents', 'tax_cents', 'retention_cents', 'total_cents'] as const).map(k => (
              <label key={k}>
                {
                  {
                    base_cents: 'Base imponible (opcional)',
                    tax_cents: 'Importe IVA (opcional)',
                    retention_cents: 'Retención / IRPF (importe)',
                    total_cents: 'Total factura'
                  }[k]
                }
                <input
                  type="number"
                  min={k === 'total_cents' ? '0.01' : '0'}
                  step="0.01"
                  required={k === 'total_cents'}
                  value={fields[k] === null ? '' : String(Number(fields[k]) / 100)}
                  onChange={e =>
                    field(k, e.target.value === '' ? null : Math.round(Number(e.target.value) * 100))
                  }
                />
              </label>
            ))}
            <label>
              Moneda (código de 3 letras)
              <input
                list="inv-currencies"
                required
                pattern="[A-Z]{3}"
                maxLength={3}
                value={fields.currency}
                onChange={e => field('currency', e.target.value.toUpperCase())}
              />
              <datalist id="inv-currencies">
                {['EUR', 'GBP', 'AED', 'USD'].map(c => (
                  <option key={c}>{c}</option>
                ))}
              </datalist>
            </label>
            <label>
              Estado de emisión
              <select value={fields.status} onChange={e => field('status', e.target.value)}>
                {['draft', 'sent', 'pending', 'unverified', 'cancelled'].map(s => (
                  <option key={s} value={s}>
                    {invoiceStatuses[s]}
                  </option>
                ))}
              </select>
            </label>
            {input('document_url', 'Enlace al documento', 'url')}
          </div>
          <label>
            Concepto / descripción
            <textarea value={fields.concept} onChange={e => field('concept', e.target.value)} />
          </label>
          <label>
            Notas
            <textarea value={fields.notes} onChange={e => field('notes', e.target.value)} />
          </label>
          <button className="primary-button">Guardar factura</button>
        </fieldset>
      </form>
      {current?.original_document_id && (
        <a
          href={'/api/financial-documents?id=' + current.original_document_id}
          target="_blank"
          rel="noreferrer"
        >
          Descargar factura original
        </a>
      )}
      {current?.document_url && (
        <a href={current.document_url} target="_blank" rel="noreferrer">
          Abrir documento
        </a>
      )}
      {saved && current && (
        <>
          <CollectionEvidenceList
            rows={(data.collectionSources || []).filter(
              r => r.invoice_id === id || r.candidate_invoice_ids.includes(id)
            )}
          />
          <h3>Pagos recibidos</h3>
          {data.payments
            .filter(p => p.invoice_id === id)
            .map(p => (
              <p key={p.id}>
                {day(p.payment_date)} — {invoiceMoney(p.amount_cents, p.currency)} · {p.method} · {p.reference}{' '}
                · {p.note}
              </p>
            ))}
          <form
            onSubmit={async e => {
              e.preventDefault();
              const form = e.currentTarget;
              const f = new FormData(form);
              if (
                await send({
                  action: 'payment',
                  id: paymentId.current,
                  invoice_id: id,
                  payment_date: f.get('date'),
                  amount_cents: Math.round(Number(f.get('amount')) * 100),
                  currency: current.currency,
                  method: f.get('method'),
                  reference: f.get('reference'),
                  note: f.get('note')
                })
              ) {
                paymentId.current = crypto.randomUUID();
                form.reset();
              }
            }}
          >
            <fieldset
              disabled={
                busy ||
                !data.canEdit ||
                ['draft', 'cancelled'].includes(current.status) ||
                !balance?.pending
              }
            >
              <div className="crm-form-grid">
                <label>
                  Fecha del pago
                  <input type="date" name="date" required defaultValue={invoiceToday()} />
                </label>
                <label>
                  Importe ({current.currency})
                  <input
                    name="amount"
                    type="number"
                    min="0.01"
                    max={(balance?.pending || 0) / 100}
                    step="0.01"
                    required
                  />
                </label>
                <label>
                  Método
                  <input name="method" required placeholder="Transferencia, efectivo…" />
                </label>
                <label>
                  Referencia bancaria
                  <input name="reference" />
                </label>
              </div>
              <label>
                Nota
                <input name="note" />
              </label>
              <button>+ Registrar pago</button>
            </fieldset>
          </form>
          <h3>Seguimiento</h3>
          <form
            onSubmit={async e => {
              e.preventDefault();
              const form = e.currentTarget;
              const f = new FormData(form);
              if (
                await send({
                  action: 'followup',
                  id: followupId.current,
                  invoice_id: id,
                  followup_date: f.get('date'),
                  kind: f.get('kind'),
                  note: f.get('note'),
                  next_action: f.get('next'),
                  next_action_date: f.get('next_date') || null
                })
              ) {
                followupId.current = crypto.randomUUID();
                form.reset();
              }
            }}
          >
            <fieldset disabled={busy || !data.canEdit}>
              <div className="crm-form-grid">
                <label>
                  Fecha
                  <input name="date" type="date" required defaultValue={invoiceToday()} />
                </label>
                <label>
                  Tipo
                  <select name="kind">
                    {Object.entries(followupKinds).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                Nota
                <textarea name="note" required />
              </label>
              <div className="crm-form-grid">
                <label>
                  Próxima acción
                  <input name="next" />
                </label>
                <label>
                  Fecha de próxima acción
                  <input name="next_date" type="date" />
                </label>
              </div>
              <button>+ Añadir seguimiento</button>
            </fieldset>
          </form>
          <h3>Historial</h3>
          <ol className="inv-timeline">
            {timeline.map(t => (
              <li key={t.id}>
                <small>{day(t.date)}</small>
                <p>{t.text}</p>
              </li>
            ))}
          </ol>
          {balance?.status === 'paid' && (
            <p className="inv-status paid">Pagada automáticamente: saldo pendiente cero.</p>
          )}
        </>
      )}
    </dialog>
  );
}
