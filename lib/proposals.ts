import { z } from 'zod';

const txt = z.string().trim().max(10000).default('');
const id = z.union([z.uuid(), z.literal('')]).default('');
const date = z.union([z.iso.date(), z.literal('')]).default('');
const cents = z.number().int().min(0).max(100000000);

export const proposalStatuses = [
  ['draft', 'Borrador'],
  ['ready', 'Lista'],
  ['sent', 'Enviada'],
  ['viewed', 'Vista'],
  ['follow_up', 'Seguimiento'],
  ['accepted', 'Aceptada'],
  ['declined', 'Rechazada'],
  ['expired', 'Caducada'],
] as const;

export const quoteUnits = [
  ['performer_event', 'Artista / evento'],
  ['performer_day', 'Artista / día'],
  ['package', 'Equipo / paquete'],
  ['item', 'Unidad'],
] as const;

export const hiringTypes = [
  ['cooperative', 'Cooperativa (Neto + 5% + Alta)'],
  ['autonomous', 'Autónomo (Factura)'],
  ['cash', 'Cash (Efectivo)'],
  ['provider', 'Proveedor externo'],
] as const;

export const conceptTypes = [
  ['character', 'Personaje propio (Costumes / Characters)'],
  ['dancer', 'Bailarín / Performer'],
  ['image_performer', 'Imagen / Hostess'],
  ['roller', 'Roller (Patines)'],
  ['fire', 'Fuego / Pyro'],
  ['musician', 'Músico / Dj / Sax / Percusión'],
  ['circus', 'Circo / Acrobacia / Contorsión'],
  ['magic', 'Mago / Ilusionismo'],
  ['live_art', 'Live Art / VR / Bodypaint'],
  ['custom', 'Personalización / Custom Branding'],
  ['external_provider', 'Proveedor externo'],
  ['other', 'Otro servicio'],
] as const;

export const eventTypes = [
  ['club', 'Club'],
  ['beach_club', 'Beach Club'],
  ['villa', 'Villa'],
  ['private', 'Fiesta Privada'],
  ['wedding', 'Boda'],
  ['corporate', 'Corporativo'],
  ['festival', 'Festival'],
  ['international', 'Internacional'],
  ['other', 'Otro'],
] as const;

export const quoteLineSchema = z.object({
  id: z.uuid(),
  show_ids: z.array(z.uuid()).max(30).default([]),
  label: z.string().trim().min(1, 'Escribe el nombre de cada partida.').max(250),
  description: txt,
  quantity: z.number().int().min(1).max(1000),
  units: z.number().int().min(1).max(365),
  unit: z.enum(quoteUnits.map(u => u[0])),
  sets: txt,
  duration: txt,
  format: txt,
  wardrobe: txt,
  unit_price_cents: cents.nullable(),
  internal_cost_cents: cents.nullable(),
  cost_basis: z.enum(['total', 'unit']).default('total'),
  reference: z.boolean().default(false),

  // Extended pricing engine fields
  concept_type: z.enum(conceptTypes.map(c => c[0])).default('character'),
  hiring_type: z.enum(hiringTypes.map(h => h[0])).default('cooperative'),
  net_fee_performer_cents: cents.nullable().default(null),
  provider_cost_type: z.enum(['net', 'base', 'total']).optional().default('base'),
  provider_vat_percent: z.number().min(0).max(100).nullable().default(null),
  provider_withholding_percent: z.number().min(0).max(100).nullable().default(null),
  extra_costume_changes: z.number().int().min(0).default(0),
  rehearsal_hours: z.number().min(0).default(0),
  coordinator_required: z.boolean().default(false),
  coordinator_net_cents: cents.nullable().default(null),
  travel_cost_cents: cents.default(0),
  hotel_cost_cents: cents.default(0),
  per_diem_cost_cents: cents.default(0),
  shipping_cost_cents: cents.default(0),
  material_cost_cents: cents.default(0),
  extra_hours_cost_cents: cents.default(0),
}).refine(l => !['performer_event', 'package'].includes(l.unit) || l.units === 1, {
  message: 'Las tarifas por evento o paquete no se multiplican por días o pases.',
});

export const quoteOptionSchema = z.object({
  id: z.uuid(),
  title: z.string().trim().min(1).max(150),
  discount_cents: cents.default(0),
  recommended_price_cents: cents.nullable().default(null),
  lines: z.array(quoteLineSchema).min(1, 'Añade al menos una partida.').max(60),
}).refine(o => o.discount_cents <= o.lines.reduce((s, l) => s + (l.unit_price_cents ?? 0) * l.quantity * l.units, 0), {
  message: 'El descuento no puede superar el subtotal conocido.',
});

export const proposalVersionSchema = z.object({
  version: z.number().int().positive(),
  timestamp: z.string(),
  user_name: txt,
  notes: txt,
  final_sale_cents: cents,
  real_cost_cents: cents,
  margin_percent: z.number(),
  snapshot: z.record(z.string(), z.unknown()),
});

export const proposalSchema = z.object({
  title: z.string().trim().min(1, 'Escribe un nombre para la propuesta.').max(200),
  client_id: id,
  opportunity_id: id,
  owner_id: id,
  client_name: txt,
  contact_name: txt,
  contact_email: txt,
  contact_phone: txt,
  language: z.enum(['es', 'en']).default('es'),
  event_date: date,
  city: txt,
  venue: txt,
  country: z.string().trim().default('España'),
  event_type: z.enum(eventTypes.map(e => e[0])).default('other'),
  client_budget_cents: cents.nullable().default(null),
  brief: txt,
  conditions: txt,
  cancellation_terms: txt,
  internal_notes: txt,
  valid_until: date,
  tax_percent: z.number().min(0).max(100).nullable().default(21),
  agency_commission_percent: z.number().min(0).max(50).default(0),
  production_fee_tier: z.enum(['none', 'medium', 'complex', 'very_complex']).default('none'),
  status: z.enum(proposalStatuses.map(s => s[0])).default('draft'),
  selected_option_id: id,
  options: z.array(quoteOptionSchema).min(1).max(10),
  versions: z.array(proposalVersionSchema).default([]),
}).superRefine((q, ctx) => {
  const ids = q.options.map(o => o.id);
  if (new Set(ids).size !== ids.length) ctx.addIssue({ code: 'custom', message: 'Hay opciones duplicadas.' });
  const lines = q.options.flatMap(o => o.lines.map(l => l.id));
  if (new Set(lines).size !== lines.length) ctx.addIssue({ code: 'custom', message: 'Hay partidas duplicadas.' });
  if (q.selected_option_id && !ids.includes(q.selected_option_id)) ctx.addIssue({ code: 'custom', message: 'La opción elegida no existe.' });
  if (q.status === 'accepted' && (!q.selected_option_id || q.options.find(o => o.id === q.selected_option_id)?.lines.some(l => l.unit_price_cents === null))) {
    ctx.addIssue({ code: 'custom', message: 'Para aceptar, elige una opción y completa sus precios de venta.' });
  }
});

export type QuoteLine = z.infer<typeof quoteLineSchema>;
export type QuoteOption = z.infer<typeof quoteOptionSchema>;
export type ProposalVersion = z.infer<typeof proposalVersionSchema>;
export type ProposalFields = z.infer<typeof proposalSchema>;
export type Proposal = ProposalFields & { id: string; proposal_code: string; event_id: string | null; version: number; updated_at: string; deleted_at: string | null };

export const newLine = (): QuoteLine => ({
  id: crypto.randomUUID(),
  label: '',
  show_ids: [],
  description: '',
  quantity: 1,
  units: 1,
  unit: 'performer_event',
  sets: '',
  duration: '',
  format: '',
  wardrobe: '',
  unit_price_cents: null,
  internal_cost_cents: null,
  cost_basis: 'total',
  reference: false,
  concept_type: 'character',
  hiring_type: 'cooperative',
  net_fee_performer_cents: null,
  provider_cost_type: 'base',
  provider_vat_percent: null,
  provider_withholding_percent: null,
  extra_costume_changes: 0,
  rehearsal_hours: 0,
  coordinator_required: false,
  coordinator_net_cents: null,
  travel_cost_cents: 0,
  hotel_cost_cents: 0,
  per_diem_cost_cents: 0,
  shipping_cost_cents: 0,
  material_cost_cents: 0,
  extra_hours_cost_cents: 0,
});

export const newOption = (): QuoteOption => ({
  id: crypto.randomUUID(),
  title: 'Propuesta principal',
  discount_cents: 0,
  recommended_price_cents: null,
  lines: [newLine()],
});

export const newProposal = (): ProposalFields => ({
  title: '',
  client_id: '',
  opportunity_id: '',
  owner_id: '',
  client_name: '',
  contact_name: '',
  contact_email: '',
  contact_phone: '',
  language: 'es',
  event_date: '',
  city: '',
  venue: '',
  country: 'España',
  event_type: 'other',
  client_budget_cents: null,
  brief: '',
  conditions: '',
  cancellation_terms: 'Cancellation terms subject to booking confirmation',
  internal_notes: '',
  valid_until: '',
  tax_percent: 21,
  agency_commission_percent: 0,
  production_fee_tier: 'none',
  status: 'draft',
  selected_option_id: '',
  options: [newOption()],
  versions: [],
});

export function optionMoney(o: QuoteOption, tax: number | null) {
  const subtotal = o.lines.reduce((s, l) => s + (l.unit_price_cents ?? 0) * l.quantity * l.units, 0);
  const net = subtotal - o.discount_cents;
  const complete = o.lines.every(l => l.unit_price_cents !== null);
  const cost = o.lines.reduce((s, l) => s + (l.internal_cost_cents ?? 0) * (l.cost_basis === 'unit' ? l.quantity * l.units : 1), 0);
  const costsComplete = o.lines.every(l => l.internal_cost_cents !== null);
  const vat = tax === null ? null : Math.round((net * tax) / 100);
  return {
    subtotal,
    net,
    complete,
    cost,
    costsComplete,
    vat,
    total: complete && vat !== null ? net + vat : null,
    profit: complete && costsComplete ? net - cost : null,
    margin: complete && costsComplete && net > 0 ? ((net - cost) / net) * 100 : null,
  };
}

export const money = (c: number, language = 'es') =>
  new Intl.NumberFormat(language === 'en' ? 'en-IE' : 'es-ES', { style: 'currency', currency: 'EUR' }).format(c / 100);

/** Explicit public projection: never copy internal notes, costs or profitability. */
export function proposalText(q: ProposalFields, code = '') {
  const en = q.language === 'en';
  const f = (n: number) => money(n, q.language);
  const date = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString(en ? 'en-GB' : 'es-ES');
  const parts = [
    `PERFORMANCE LAB${code ? ' · ' + code : ''}`,
    q.title,
    q.client_name ? `${en ? 'For' : 'Para'}: ${q.client_name}` : '',
    q.contact_name ? `${en ? 'Contact' : 'Contacto'}: ${q.contact_name}` : '',
    [q.event_date ? date(q.event_date) : '', q.venue, q.city].filter(Boolean).join(' · '),
    q.brief,
  ];
  for (const o of q.options) {
    const m = optionMoney(o, q.tax_percent);
    parts.push('', `${q.options.length > 1 ? (en ? 'Alternative' : 'Alternativa') + ': ' : ''}${o.title}${q.status === 'accepted' && q.selected_option_id === o.id ? (en ? ' · Selected option' : ' · Opción elegida') : ''}`);
    for (const l of o.lines) {
      const unit = en ? { performer_event: 'performer / event', performer_day: 'performer / day', package: 'team / package', item: 'unit' }[l.unit] : quoteUnits.find(u => u[0] === l.unit)![1];
      parts.push(
        `${l.label} — ${l.quantity} ${unit}${l.units > 1 ? ' × ' + l.units + (en ? ' days / units' : ' días / unidades') : ''}`,
        l.description,
        [l.format, l.sets ? `${en ? 'Sets' : 'Pases'}: ${l.sets}` : '', l.duration ? `${en ? 'Duration' : 'Duración'}: ${l.duration}` : '', l.wardrobe ? `${en ? 'Costumes' : 'Vestuario'}: ${l.wardrobe}` : ''].filter(Boolean).join(' · '),
        l.unit_price_cents === null
          ? en ? 'Price to be confirmed' : 'Precio pendiente de confirmar'
          : `${f(l.unit_price_cents)} × ${l.quantity * l.units} = ${f(l.unit_price_cents * l.quantity * l.units)}${l.reference ? (en ? ' (indicative price)' : ' (precio orientativo)') : ''}`
      );
    }
    if (o.discount_cents) parts.push(`${en ? 'Discount' : 'Descuento'}: −${f(o.discount_cents)}`);
    if (!m.complete) parts.push(`${en ? 'Known subtotal' : 'Subtotal conocido'}: ${f(m.net)}`, en ? 'Final total pending missing prices.' : 'Total pendiente de completar precios.');
    else if (q.tax_percent === null) parts.push(`${en ? 'Total before tax' : 'Total antes de impuestos'}: ${f(m.net)}`, en ? 'Taxes to be confirmed.' : 'Impuestos pendientes de confirmar.');
    else parts.push(`${en ? 'Subtotal' : 'Base'}: ${f(m.net)}`, `${en ? 'VAT' : 'IVA'} (${q.tax_percent}%): ${f(m.vat!)}`, `TOTAL: ${f(m.total!)}`);
  }
  if (q.options.length > 1) parts.push('', en ? 'These are separate alternatives; their totals are not added together.' : 'Las opciones son alternativas independientes; sus importes no se suman.');
  parts.push('', q.conditions, q.valid_until ? `${en ? 'Valid until' : 'Válida hasta'}: ${date(q.valid_until)}` : '', en ? 'Availability subject to confirmation. This quotation does not reserve performers.' : 'Disponibilidad pendiente de confirmación. Este presupuesto no reserva artistas.');
  return parts.filter((p, i) => p || parts[i - 1]).join('\n');
}

export const priceReferences = [
  { label: 'Bodas / privados · 300 € por artista', cents: 30000, unit: 'performer_event', scope: 'Referencia habitual: 2–3 pases de unos 15 minutos. Concretar el número. Impuestos por confirmar.' },
  { label: 'Club · alrededor de 200 € por artista', cents: 20000, unit: 'performer_event', scope: 'Referencia habitual. Duración, pases e impuestos por confirmar.' },
  { label: 'Beach club · alrededor de 180 € por artista', cents: 18000, unit: 'performer_event', scope: 'Referencia habitual. Duración, pases e impuestos por confirmar.' },
  { label: 'Fuera de Ibiza · 400 € por artista/día', cents: 40000, unit: 'performer_day', scope: 'Referencia habitual; viaje, alojamiento y dietas aparte, por confirmar.' },
  { label: 'LED / fuego · referencia 400 € por artista', cents: 40000, unit: 'performer_event', scope: 'Referencia habitual. Revisar formato y posible mínimo de 2 o 3 artistas; no aplicado automáticamente.' },
  { label: 'Acrobacia / contorsión · referencia 450 €', cents: 45000, unit: 'performer_event', scope: 'Referencia habitual: 2 actuaciones de unos 5 minutos. Impuestos por confirmar.' },
  { label: 'Percusión · 1 hora · 650 € antes de IVA', cents: 65000, unit: 'package', scope: 'Referencia de venta de 1 hora; IVA no incluido, indicar el porcentaje aplicable.' },
  { label: 'Percusión · 2 horas · 950 € antes de IVA', cents: 95000, unit: 'package', scope: 'Alternativa de 2 horas; IVA no incluido, indicar el porcentaje aplicable.' },
] as const;
