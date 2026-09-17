import { NextResponse } from 'next/server';
import { taskCreateSchema, errorMessage } from '@/lib/validation';
import { requireOrganization } from '@/lib/server/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireOrganization(); if ('error' in auth) return auth.error;
  const { data, error } = await auth.supabase.from('tasks').select('id,title,description,deadline,priority,status,event_id,client_id').is('deleted_at', null).neq('status', 'cancelled').order('deadline', { ascending: true, nullsFirst: false }).limit(100);
  if (error) return NextResponse.json({ error: 'No se pudieron cargar las tareas.' }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const auth = await requireOrganization(); if ('error' in auth) return auth.error;
  const parsed = taskCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: errorMessage(parsed.error) }, { status: 400 });
  const { data, error } = await auth.supabase.from('tasks').insert({ organization_id: auth.membership.organization_id, title: parsed.data.title, description: parsed.data.description, event_id: parsed.data.eventId, client_id: parsed.data.clientId, deadline: parsed.data.deadline, priority: parsed.data.priority, owner_id: auth.userId }).select('id,title,description,deadline,priority,status,event_id,client_id').single();
  if (error) return NextResponse.json({ error: 'No se pudo guardar la tarea.' }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
