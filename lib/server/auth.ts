import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function requireOrganization() {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (claimsError || !userId) return { error: NextResponse.json({ error: 'Necesitas iniciar sesión.' }, { status: 401 }) } as const;
  const { data: membership, error } = await supabase.from('organization_members').select('organization_id, role').eq('user_id', userId).limit(1).maybeSingle();
  if (error || !membership) return { error: NextResponse.json({ error: 'Tu usuario todavía no pertenece a una organización.' }, { status: 403 }) } as const;
  return { supabase, userId, membership } as const;
}
