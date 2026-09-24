import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

export async function requireOrganization() {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (claimsError || !userId) return { error: NextResponse.json({ error: 'Necesitas iniciar sesión.' }, { status: 401 }) } as const;

  const activeOrganizationId = (await cookies()).get('plab_org')?.value;
  const { data: memberships, error } = await supabase
    .from('organization_members')
    .select('organization_id, role, organizations(id, name, slug)')
    .eq('user_id', userId);

  if (error || !memberships || memberships.length === 0) {
    return { error: NextResponse.json({ error: 'Tu usuario todavía no pertenece a una organización.' }, { status: 403 }) } as const;
  }

  let membership = memberships.find(m => m.organization_id === activeOrganizationId);
  if (!membership) {
    membership = memberships.find(m => (m.organizations as unknown as { name?: string } | null)?.name === 'Performance Lab') || memberships[0];
  }

  return { supabase, userId, membership: { organization_id: membership.organization_id, role: membership.role } } as const;
}
