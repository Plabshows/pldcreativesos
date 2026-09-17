import { NextResponse } from 'next/server';
import { clientCreateSchema, errorMessage } from '@/lib/validation';
import { requireOrganization } from '@/lib/server/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await requireOrganization(); if ('error' in auth) return auth.error;
  const query = new URL(request.url).searchParams.get('q')?.trim();
  let builder = auth.supabase.from('clients').select('id,client_code,company_name,client_type,city,status,next_follow_up,last_contact').is('deleted_at', null).order('company_name').limit(100);
  if (query) builder = builder.ilike('company_name', `%${query.replace(/[%_]/g, '')}%`);
  const { data, error } = await builder;
  if (error) return NextResponse.json({ error: 'No se pudieron cargar los clientes.' }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const auth = await requireOrganization(); if ('error' in auth) return auth.error;
  const parsed = clientCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: errorMessage(parsed.error) }, { status: 400 });
  const code = `CL-${Date.now().toString(36).toUpperCase()}`;
  const { data, error } = await auth.supabase.from('clients').insert({ organization_id: auth.membership.organization_id, client_code: code, company_name: parsed.data.companyName, client_type: parsed.data.clientType, city: parsed.data.city, country: parsed.data.country, lead_source: parsed.data.leadSource, notes: parsed.data.notes, next_follow_up: parsed.data.nextFollowUp, account_owner: auth.userId }).select('id,client_code,company_name,client_type,city,status,next_follow_up').single();
  if (error) return NextResponse.json({ error: 'No se pudo guardar el cliente.' }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
