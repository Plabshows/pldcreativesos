import {NextResponse} from 'next/server';
import {z} from 'zod';
import {requireOrganization} from '@/lib/server/auth';
import {syncEventExpensesTotal} from '@/lib/server/event-costs';

const schema = z.object({
 event_id: z.string().uuid(),
 talent_id: z.string().uuid(),
 amount: z.number().int().min(0).max(100000000).nullable().optional(),
 status: z.enum(['pending', 'paid']).optional(),
 paid_on: z.string().nullable().optional()
});

export async function GET() {
 const a = await requireOrganization();
 if ('error' in a) return a.error;
 const org = a.membership.organization_id;

 const [payments, assignments, events, talent] = await Promise.all([
  a.supabase.from('payments').select('id, event_id, talent_id, amount_cents, status, paid_on, created_at').eq('organization_id', org).eq('direction', 'outbound').eq('kind', 'artist').range(0, 999),
  a.supabase.from('event_talent').select('event_id, talent_id, agreed_cost_cents').eq('organization_id', org).range(0, 999),
  a.supabase.from('events').select('id, event_name, event_date, venue, city, billing_type, client_id, status').eq('organization_id', org).is('deleted_at', null).range(0, 999),
  a.supabase.from('talent').select('id, real_name, city, email, phone, notes, skills, aliases, tax_id, iban').eq('organization_id', org).is('deleted_at', null).order('real_name')
 ]);

 if (payments.error || assignments.error || events.error || talent.error) {
  return NextResponse.json({ error: 'No se pudieron cargar los datos de pagos.' }, { status: 500 });
 }

 return NextResponse.json({
  payments: payments.data || [],
  assignments: assignments.data || [],
  events: events.data || [],
  talent: talent.data || [],
  canEdit: ['admin', 'producer'].includes(a.membership.role)
 });
}

export async function POST(req: Request) {
 const a = await requireOrganization();
 if ('error' in a) return a.error;
 if (!['admin', 'producer'].includes(a.membership.role)) {
  return NextResponse.json({ error: 'No tienes permiso para editar pagos.' }, { status: 403 });
 }

 const parsed = schema.safeParse(await req.json().catch(() => null));
 if (!parsed.success) {
  return NextResponse.json({ error: 'Revisa el importe y el estado de pago.' }, { status: 400 });
 }

 const b = parsed.data, org = a.membership.organization_id;
 const { event_id, talent_id, amount, status, paid_on } = b;

 if (amount !== null && amount !== undefined) {
  await a.supabase.from('event_talent')
   .update({ agreed_cost_cents: amount })
   .eq('organization_id', org)
   .eq('event_id', event_id)
   .eq('talent_id', talent_id);
 }

 const existingPayments = await a.supabase.from('payments')
  .select('id, status, amount_cents')
  .eq('organization_id', org)
  .eq('event_id', event_id)
  .eq('talent_id', talent_id)
  .eq('kind', 'artist');

 const newStatus = status || 'pending';
 const newAmount = amount !== null && amount !== undefined ? amount : (existingPayments.data?.[0]?.amount_cents || 0);

 if (existingPayments.data && existingPayments.data.length > 0) {
  const updatePayload: Record<string, unknown> = {
   amount_cents: newAmount
  };
  if (status) {
   updatePayload.status = status;
   updatePayload.paid_on = status === 'paid' ? (paid_on || new Date().toISOString()) : null;
  }

  const upRes = await a.supabase.from('payments')
   .update(updatePayload)
   .eq('organization_id', org)
   .eq('event_id', event_id)
   .eq('talent_id', talent_id)
   .eq('kind', 'artist');

  if (upRes.error) {
   console.error('[artist-pay update error]', upRes.error);
   return NextResponse.json({ error: 'No se pudo actualizar el pago: ' + upRes.error.message }, { status: 400 });
  }
 } else {
  const insRes = await a.supabase.from('payments').insert({
   organization_id: org,
   event_id: event_id,
   talent_id: talent_id,
   kind: 'artist',
   direction: 'outbound',
   amount_cents: newAmount,
   status: newStatus,
   paid_on: newStatus === 'paid' ? (paid_on || new Date().toISOString()) : null
  });

  if (insRes.error) {
   console.error('[artist-pay insert error]', insRes.error);
   return NextResponse.json({ error: 'No se pudo registrar el pago: ' + insRes.error.message }, { status: 400 });
  }
 }

 await syncEventExpensesTotal(a.supabase, org, event_id);
 return NextResponse.json({ ok: true });
}

