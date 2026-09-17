import { z } from 'zod';

export const stages = [
  ['new_lead', 'Nuevo lead'], ['contacted', 'Contactado'], ['qualified', 'Cualificado'],
  ['proposal_needed', 'Preparar propuesta'], ['proposal_sent', 'Propuesta enviada'],
  ['follow_up', 'Seguimiento'], ['negotiation', 'Negociación'], ['verbal_yes', 'Sí verbal'],
  ['won', 'Ganado'], ['lost', 'Perdido'],
] as const;
export const sources = ['Instagram', 'Website', 'WhatsApp', 'Email', 'Referral', 'Agency', 'Existing client', 'Google', 'LinkedIn', 'Other'] as const;
export const lostReasons = ['Precio elevado', 'Sin disponibilidad', 'Cliente cancela', 'Competidor', 'Conflicto de fecha', 'Sin respuesta', 'Evento cancelado', 'Otro'];
export type Stage = typeof stages[number][0];
const text = z.string().trim().max(2000).default('');
const optionalId = z.union([z.uuid(), z.literal('')]).default('');
const date = z.union([z.iso.date(), z.literal('')]).default('');
export const crmSchema = z.object({
  title: z.string().trim().min(1, 'Escribe un nombre.').max(200),
  client_id: optionalId, contact_id: optionalId, owner_id: optionalId,
  company_name: text, contact_name: text, email: z.union([z.email(), z.literal('')]).default(''), phone: text, whatsapp: text,
  event_type: text, event_date: date, city: text, country: text, venue: text,
  estimated_value_cents: z.number().int().min(0).max(100000000000).default(0),
  probability_percent: z.number().min(0).max(100).default(10),
  source: z.enum(sources).default('Other'), stage: z.enum(stages.map(s => s[0])).default('new_lead'),
  expected_close_date: date, next_action: z.string().trim().max(500).default(''), next_action_date: date,
  next_action_owner_id: optionalId, notes: z.string().trim().max(10000).default(''), lost_reason: text,
});
export type CrmFields = z.infer<typeof crmSchema>;
export type CrmRecord = CrmFields & { id: string; created_at: string; last_activity_at: string | null; lead_id?: string | null; event_id?: string | null };
export type CrmActivity = { id: string; entity_id: string; entity_type: 'leads' | 'opportunities'; body: string; kind: string; created_at: string };
export type CrmData = { leads: CrmRecord[]; opportunities: CrmRecord[]; activities: CrmActivity[]; clients: {id:string;company_name:string}[]; members: {id:string;name:string}[]; events: {id:string;event_name:string}[] };
export const emptyCrm = ():CrmData => ({leads:[],opportunities:[],activities:[],clients:[],members:[],events:[]});
export const blankCrm = ():CrmFields => crmSchema.parse({title:'Nueva consulta'});
export function crmAlerts(record: CrmRecord, now = new Date()) {
  if (record.stage === 'won' || record.stage === 'lost') return { days: 0, level: 'none', missing: false, overdue: false };
  const days = Math.max(0, Math.floor((now.getTime() - new Date(record.last_activity_at || record.created_at).getTime()) / 86400000));
  const today = new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Madrid'}).format(now);
  return {days, level: days>=14?'red':days>=7?'orange':days>=3?'yellow':'none', missing: !record.next_action || !record.next_action_date || !record.next_action_owner_id, overdue: !!record.next_action_date && record.next_action_date<today};
}
export function crmForecast(records: CrmRecord[]) {
  const open = records.filter(r=>r.stage!=='won'&&r.stage!=='lost');
  return { total: open.reduce((s,r)=>s+r.estimated_value_cents,0), weighted: open.reduce((s,r)=>s+Math.round(r.estimated_value_cents*r.probability_percent/100),0) };
}

export function crmWindowForecast(records: CrmRecord[], now = new Date()) {
  const today = new Intl.DateTimeFormat('sv-SE', {timeZone:'Europe/Madrid'}).format(now);
  const start = Date.parse(today + 'T00:00:00Z');
  const open = records.filter(r => r.stage !== 'won' && r.stage !== 'lost');
  const within = (days:number) => open.filter(r => {
    if (!r.expected_close_date) return false;
    const distance = (Date.parse(r.expected_close_date + 'T00:00:00Z') - start) / 86400000;
    return distance >= 0 && distance <= days;
  });
  return {days30:crmForecast(within(30)).weighted, days90:crmForecast(within(90)).weighted,
    withoutDate:open.filter(r=>!r.expected_close_date).length};
}
