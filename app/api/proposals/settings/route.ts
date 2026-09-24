import { NextResponse } from 'next/server';
import { requireOrganization } from '@/lib/server/auth';
import { defaultPricingSettings, pricingSettingsSchema } from '@/lib/pricing-settings';

export async function GET() {
  const a = await requireOrganization();
  if ('error' in a) return a.error;

  try {
    const res = await a.supabase
      .from('pricing_settings')
      .select('settings')
      .eq('organization_id', a.membership.organization_id)
      .maybeSingle();

    if (res.error) throw res.error;

    const currentSettings = res.data?.settings ? pricingSettingsSchema.parse(res.data.settings) : defaultPricingSettings;
    return NextResponse.json({ settings: currentSettings, canEdit: ['admin', 'producer'].includes(a.membership.role) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return NextResponse.json({ settings: defaultPricingSettings, canEdit: ['admin', 'producer'].includes(a.membership.role) });
  }
}

export async function POST(req: Request) {
  const a = await requireOrganization();
  if ('error' in a) return a.error;

  if (!['admin', 'producer'].includes(a.membership.role)) {
    return NextResponse.json({ error: 'No tienes permiso para modificar la configuración de tarifas.' }, { status: 403 });
  }

  const json = await req.json().catch(() => null);
  const parsed = pricingSettingsSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const orgId = a.membership.organization_id;

  const res = await a.supabase
    .from('pricing_settings')
    .upsert({
      organization_id: orgId,
      settings: parsed.data,
      updated_at: new Date().toISOString(),
    })
    .select('settings');

  if (res.error) {
    return NextResponse.json({ error: 'No se pudo guardar la configuración.' }, { status: 400 });
  }

  return NextResponse.json({ ok: true, settings: parsed.data });
}
