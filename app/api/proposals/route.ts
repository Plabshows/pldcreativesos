import { commercialShow } from '@/lib/show-commercial';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOrganization } from '@/lib/server/auth';
import { proposalSchema } from '@/lib/proposals';
import { rows, workspaceReferences } from '@/lib/server/workspace-data';
import { defaultPricingSettings, pricingSettingsSchema } from '@/lib/pricing-settings';

const requestSchema = z.object({
  id: z.uuid(),
  version: z.number().int().positive().optional(),
  action: z.enum(['save', 'archive', 'restore', 'create_event']).default('save'),
  fields: proposalSchema.optional(),
  version_note: z.string().optional(),
});

export async function GET() {
  const a = await requireOrganization();
  if ('error' in a) return a.error;
  try {
    const [data, refs, settingsRes] = await Promise.all([
      rows(a.supabase, a.membership.organization_id, 'proposals'),
      workspaceReferences(a.supabase, a.membership.organization_id),
      a.supabase.from('pricing_settings').select('settings').eq('organization_id', a.membership.organization_id).maybeSingle(),
    ]);

    const settings = settingsRes?.data?.settings ? pricingSettingsSchema.parse(settingsRes.data.settings) : defaultPricingSettings;

    const sales: { show_id: string; document: { fields?: Record<string, string> } }[] = [];
    for (let offset = 0; ; offset += 500) {
      const result = await a.supabase
        .from('show_kit_sections')
        .select('show_id,document')
        .eq('organization_id', a.membership.organization_id)
        .eq('section', 'sales')
        .order('show_id')
        .range(offset, offset + 499);
      if (result.error) throw result.error;
      sales.push(...result.data);
      if (result.data.length < 500) break;
    }

    refs.shows = refs.shows.map(show => commercialShow(show as typeof show & { name: string }, sales.find(s => s.show_id === show.id)?.document?.fields || {}));

    return NextResponse.json({
      data: data.map(r => ({
        ...(r.document as object),
        id: r.id,
        proposal_code: r.proposal_code,
        event_id: r.event_id,
        version: r.version,
        updated_at: r.updated_at,
        deleted_at: r.deleted_at,
        status: r.status,
      })),
      refs,
      settings,
      canEdit: ['admin', 'producer', 'sales'].includes(a.membership.role),
    });
  } catch {
    return NextResponse.json({ error: 'No se pudieron cargar las propuestas y su catálogo. Reintenta la conexión.' }, { status: 503 });
  }
}

export async function POST(req: Request) {
  const a = await requireOrganization();
  if ('error' in a) return a.error;
  if (!['admin', 'producer', 'sales'].includes(a.membership.role))
    return NextResponse.json({ error: 'Tu rol no permite editar propuestas.' }, { status: 403 });

  const parsed = requestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const b = parsed.data,
    db = a.supabase,
    org = a.membership.organization_id;

  if (b.action === 'create_event') {
    const r = await db.rpc('proposal_create_event', { proposal_uuid: b.id });
    return r.error ? NextResponse.json({ error: r.error.message }, { status: 400 }) : NextResponse.json({ ok: true, event_id: r.data });
  }

  if (b.action === 'save' && !b.fields) return NextResponse.json({ error: 'Faltan los datos.' }, { status: 400 });

  if (b.fields?.opportunity_id) {
    const op = await db
      .from('opportunities')
      .select('client_id')
      .eq('id', b.fields.opportunity_id)
      .eq('organization_id', org)
      .is('deleted_at', null)
      .maybeSingle();
    if (op.error || !op.data || (op.data.client_id && op.data.client_id !== b.fields.client_id))
      return NextResponse.json({ error: 'Selecciona el mismo cliente que en la oportunidad.' }, { status: 400 });
  }

  // Version snapshot logic
  let updatedFields = b.fields;
  if (b.fields && b.version) {
    const currentDoc = b.fields;
    const versionEntry = {
      version: b.version,
      timestamp: new Date().toISOString(),
      user_name: a.userId.slice(0, 8),
      notes: b.version_note || 'Actualización de propuesta',
      final_sale_cents: 0,
      real_cost_cents: 0,
      margin_percent: 0,
      snapshot: JSON.parse(JSON.stringify(currentDoc)),
    };
    updatedFields = {
      ...currentDoc,
      versions: [versionEntry, ...(currentDoc.versions || [])].slice(0, 25),
    };
  }

  const fields = updatedFields
    ? {
        title: updatedFields.title,
        client_id: updatedFields.client_id || null,
        opportunity_id: updatedFields.opportunity_id || null,
        owner_id: updatedFields.owner_id || null,
        status: updatedFields.status,
        document: updatedFields,
      }
    : {};

  const patch = b.action === 'archive' ? { deleted_at: new Date().toISOString() } : b.action === 'restore' ? { deleted_at: null } : fields;

  const r = b.version
    ? await db.from('proposals').update({ ...patch, version: b.version + 1 }).eq('id', b.id).eq('organization_id', org).eq('version', b.version).select('id,version')
    : b.action === 'save'
    ? await db
        .from('proposals')
        .insert({
          ...fields,
          id: b.id,
          organization_id: org,
          proposal_code: 'PL-' + b.id.slice(0, 8).toUpperCase(),
          created_by: a.userId,
        })
        .select('id,version')
    : null;

  if (!r) return NextResponse.json({ error: 'Actualiza antes de modificar esta propuesta.' }, { status: 400 });
  if (r.error)
    return NextResponse.json(
      { error: r.error.code === '23505' ? 'Ya existe esta propuesta. Actualiza la lista.' : 'No se pudo guardar. Comprueba las relaciones con el equipo y el catálogo.' },
      { status: 400 }
    );
  if (!r.data?.length)
    return NextResponse.json({ error: 'Otra persona ha actualizado esta propuesta. Cierra la ficha y vuelve a abrirla para ver sus cambios.' }, { status: 409 });

  return NextResponse.json({ ok: true, ...r.data[0] });
}
