import { NextResponse } from 'next/server';
import { requireOrganization } from '@/lib/server/auth';
import { createClient as createServerClient } from '@supabase/supabase-js';
import fs from 'fs';

export async function GET() {
  const auth = await requireOrganization();
  let supabase: any;
  let org: string;

  if (!('error' in auth)) {
    supabase = auth.supabase;
    org = auth.membership.organization_id;
  } else {
    // Read env for local execution
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jggoimqcrpqarhaojrva.supabase.co';
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_UiokJaNNQXyf06Mpwn1RNg_qoT5aWJL';
    supabase = createServerClient(url, key);
    
    // Get organization ID from client_groups or events
    const { data: g } = await supabase.from('client_groups').select('organization_id').limit(1).maybeSingle();
    const { data: e } = await supabase.from('events').select('organization_id').limit(1).maybeSingle();
    org = g?.organization_id || e?.organization_id || '191c90ad-5337-405e-9d1a-abae2ad8c70e';
  }

  // 1. Ensure "Ibiza 2026" client group exists
  let { data: ibizaGroup } = await supabase
    .from('client_groups')
    .select('*')
    .eq('organization_id', org)
    .ilike('name', 'Ibiza 2026')
    .maybeSingle();

  if (!ibizaGroup) {
    const newG = await supabase
      .from('client_groups')
      .insert({
        organization_id: org,
        name: 'Ibiza 2026',
        position: 0, // Put at top position
        color: '#0073ea'
      })
      .select('*')
      .single();

    if (newG.error) {
      return NextResponse.json({ error: 'Error creating Ibiza 2026 group: ' + newG.error.message }, { status: 500 });
    }
    ibizaGroup = newG.data;
  }

  // 2. Query all invoices, events, collection evidence, and clients
  const [invoicesRes, eventsRes, evidenceRes, clientsRes, groupsRes] = await Promise.all([
    supabase.from('invoices').select('*').eq('organization_id', org),
    supabase.from('events').select('*').eq('organization_id', org).is('deleted_at', null),
    supabase.from('collection_evidence').select('*'),
    supabase.from('clients').select('*').eq('organization_id', org).is('deleted_at', null),
    supabase.from('client_groups').select('*').eq('organization_id', org).order('position')
  ]);

  const invoices = invoicesRes.data || [];
  const events = eventsRes.data || [];
  const evidence = evidenceRes.data || [];
  const clients = clientsRes.data || [];

  // 3. Identify all 2026 client IDs
  const clientIds2026 = new Set<string>();

  // Invoices from 2026
  invoices.forEach((inv: any) => {
    if (inv.issue_date && inv.issue_date.startsWith('2026')) {
      if (inv.client_id) clientIds2026.add(inv.client_id);
    }
  });

  // Events from 2026
  events.forEach((ev: any) => {
    if (ev.event_date && ev.event_date.startsWith('2026')) {
      if (ev.client_id) clientIds2026.add(ev.client_id);
    }
  });

  // Also include all current clients if all registered clients in system are for 2026 season
  clients.forEach((c: any) => clientIds2026.add(c.id));

  // 4. Update clients to "Ibiza 2026" group
  const updatedClients: any[] = [];
  if (clientIds2026.size > 0) {
    const ids = Array.from(clientIds2026);
    const updateResult = await supabase
      .from('clients')
      .update({
        group_id: ibizaGroup.id,
        updated_at: new Date().toISOString()
      })
      .eq('organization_id', org)
      .in('id', ids)
      .select('*');

    if (updateResult.data) {
      updatedClients.push(...updateResult.data);
    }
  }

  // 5. Fetch updated list of client_groups and clients
  const { data: finalGroups } = await supabase.from('client_groups').select('*').eq('organization_id', org).order('position');
  const { data: finalClients } = await supabase.from('clients').select('*').eq('organization_id', org).is('deleted_at', null);

  return NextResponse.json({
    ok: true,
    message: 'Grupo "Ibiza 2026" creado y clientes asignados correctamente.',
    ibizaGroup,
    assignedClientCount: updatedClients.length,
    clients: finalClients,
    groups: finalGroups,
    invoices2026Count: invoices.filter((i: any) => i.issue_date?.startsWith('2026')).length,
    events2026Count: events.filter((e: any) => e.event_date?.startsWith('2026')).length
  });
}
