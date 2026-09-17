import type { SupabaseClient } from '@supabase/supabase-js';
import { crmSchema } from '@/lib/crm';

/** Stable ID lets a retry finish the link without inserting another event. */
export async function createCrmEvent(db: SupabaseClient, org: string, opportunity: Record<string, unknown>, userId: string) {
  const id = String(opportunity.id);
  if (opportunity.stage !== 'won') throw new Error('Marca y guarda la oportunidad como Ganado antes de crear el evento.');
  if (opportunity.event_id) return String(opportunity.event_id);
  const fields = crmSchema.parse(Object.fromEntries(Object.keys(crmSchema.shape).map(key => [key, opportunity[key] ?? undefined])));
  if (!fields.client_id || !fields.event_date) throw new Error('Selecciona un cliente existente y la fecha del evento; guarda la ficha antes de continuar.');
  const client = await db.from('clients').select('id').eq('organization_id', org).eq('id', fields.client_id).is('deleted_at', null).maybeSingle();
  if (client.error || !client.data) throw new Error('El cliente no está disponible en este espacio.');
  const eventCode = `EV-CRM-${id}`;
  const found = await db.from('events').select('id,event_code,deleted_at').eq('organization_id', org).eq('id', id).maybeSingle();
  if (found.error) throw new Error('No se pudo comprobar si el evento ya existe.');
  if (found.data && (found.data.event_code !== eventCode || found.data.deleted_at)) throw new Error('El evento asociado está archivado o no corresponde a esta oportunidad. Revisa Eventos.');
  if (!found.data) {
    const inserted = await db.from('events').insert({
      id, organization_id: org, event_code: eventCode, event_name: fields.title,
      client_id: fields.client_id, event_date: fields.event_date, venue: fields.venue,
      city: fields.city, country: fields.country || null, event_type: fields.event_type,
      internal_notes: fields.notes || null, income_cents: fields.estimated_value_cents,
      status: 'production', owner_id: userId,
    });
    if (inserted.error && inserted.error.code !== '23505') throw new Error('No se pudo crear el evento. Revisa los permisos y vuelve a intentarlo.');
    if (inserted.error) {
      const retry = await db.from('events').select('event_code,deleted_at').eq('organization_id', org).eq('id', id).maybeSingle();
      if (retry.error || retry.data?.event_code !== eventCode || retry.data.deleted_at) throw new Error('No se pudo recuperar el evento. Actualiza y reintenta.');
    }
  }
  const linked = await db.from('opportunities').update({event_id: id}).eq('organization_id', org).eq('id', id).eq('stage', 'won').is('event_id', null).is('deleted_at', null).select('event_id');
  if (linked.error) throw new Error('El evento está creado, pero falta enlazarlo. Pulsa de nuevo Crear evento: se recuperará el mismo, sin duplicarlo.');
  if (!linked.data?.length) {
    const current = await db.from('opportunities').select('event_id').eq('organization_id', org).eq('id', id).maybeSingle();
    if (current.error || current.data?.event_id !== id) throw new Error('La oportunidad ha cambiado mientras se creaba el evento. Actualiza y revisa su enlace en Eventos.');
  }
  return id;
}
