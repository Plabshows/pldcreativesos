import { NextResponse } from 'next/server';
import { eventCreateSchema, errorMessage } from '@/lib/validation';
import { requireOrganization } from '@/lib/server/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireOrganization(); if ('error' in auth) return auth.error;
  const { data, error } = await auth.supabase.from('events').select('id,event_code,event_name,event_date,start_time,end_time,venue,city,event_type,status,health,client:clients(company_name)').eq('organization_id', auth.membership.organization_id).is('deleted_at', null).order('event_date', { ascending: true }).limit(100);
  if (error) return NextResponse.json({ error: 'No se pudieron cargar los eventos.' }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const auth = await requireOrganization(); if ('error' in auth) return auth.error;
  const parsed = eventCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: errorMessage(parsed.error) }, { status: 400 });
  const code = `EV-${Date.now().toString(36).toUpperCase()}`;
  const { data, error } = await auth.supabase.from('events').insert({ organization_id: auth.membership.organization_id, event_code: code, event_name: parsed.data.eventName, client_id: parsed.data.clientId, event_date: parsed.data.eventDate, start_time: parsed.data.startTime, end_time: parsed.data.endTime, venue: parsed.data.venue, city: parsed.data.city, event_type: parsed.data.eventType, brief: parsed.data.brief, owner_id: auth.userId }).select('id,event_code,event_name,event_date,venue,city,status,health').single();
  if (error) return NextResponse.json({ error: 'No se pudo guardar el evento.' }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
