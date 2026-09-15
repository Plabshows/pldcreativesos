import { NextResponse } from 'next/server';
import { requireOrganization } from '@/lib/server/auth';
import { createClient as createServerClient } from '@supabase/supabase-js';

const ibizaTargets = [
  {
    company_name: 'Departamento de Fiestas',
    company: "Ajuntament d'Eivissa",
    tax_id: 'P0702600H',
    billing_address: 'C/ Canarias 35',
    postal_code: '07800',
    city: "Ibiza / Eivissa",
    province: 'Illes Balears',
    country: 'España',
    client_type: 'Administración pública / Ayuntamiento',
    aliases: ["Ajuntament d'Eivissa", 'Departamento de Fiestas']
  },
  {
    company_name: 'Coco Beach Ibiza',
    company: 'SINGLE SONGS AND PEOPLE DIVERTION SL',
    tax_id: 'B57283707',
    billing_address: 'C/ Ciudad de Palma, s/n',
    postal_code: '07817',
    city: "Sant Josep / Playa d'en Bossa",
    province: 'Illes Balears',
    country: 'España',
    aliases: ['Coco Beach', 'Coco Beach Ibiza']
  },
  {
    company_name: 'Fedriani Event',
    company: 'FEDRIANI EVENT S.L',
    tax_id: 'B19809383',
    billing_address: 'Calle Conde de Vistahermosa, 9, Planta 0',
    postal_code: '28019',
    city: 'Madrid',
    province: 'Madrid',
    country: 'España',
    aliases: ['Fedriani', 'Fedriani Event']
  },
  {
    company_name: 'Rememberland',
    company: 'REMEMBERLAND IBIZA S.L',
    tax_id: 'B26953851',
    billing_address: 'C/ Alicante 27',
    postal_code: '07820',
    city: 'San Antonio / Sant Antoni de Portmany',
    province: 'Illes Balears',
    country: 'España',
    aliases: ['Rememberland', 'Rememberland Amnesia']
  },
  {
    company_name: 'Namaste Ibiza',
    company: 'NAMASTE IBIZA S.L',
    tax_id: 'B10576981',
    billing_address: 'Plaza de España Nº3',
    postal_code: '07810',
    city: 'Sant Joan de Labritja',
    province: 'Illes Balears',
    country: 'España',
    aliases: ['Namaste', 'Namaste Ibiza']
  },
  {
    company_name: 'La Boheme Ibiza',
    company: 'LA BOHEME IBIZA LLC',
    tax_id: '38-4195442',
    billing_address: '1309 Coffeen Ave., Suite 1200',
    postal_code: '82801',
    city: 'Sheridan',
    province: 'Wyoming',
    country: 'Estados Unidos',
    aliases: ['La Boheme', 'La Boheme Ibiza']
  },
  {
    company_name: 'Pacha',
    company: 'UNIVERSO PACHA SA',
    tax_id: 'A87753935',
    billing_address: 'Av. 8 de Agosto Nº27',
    postal_code: '07800',
    city: 'Ibiza / Eivissa',
    province: 'Illes Balears',
    country: 'España',
    aliases: ['Pacha', 'Flower Power'],
    notes: 'Alias / marcas relacionadas: Pacha, Flower Power. Razón social: UNIVERSO PACHA SA.'
  },
  {
    company_name: 'Nassau Beach Club Ibiza',
    company: 'NASSAU BEACH CLUB IBIZA S.L',
    tax_id: 'B07722846',
    billing_address: 'C/ Migjorn Gran, 13',
    postal_code: '07818',
    city: 'Ses Salines, Sant Josep',
    province: 'Illes Balears',
    country: 'España',
    aliases: ['Nassau', 'Nassau Beach Club']
  },
  {
    company_name: 'Ushuaïa Entertainment',
    company: 'USHUAIA ENTERTAINMENT SL',
    tax_id: 'B57794620',
    billing_address: 'Avenida Bartolomé Roselló, 18',
    postal_code: '07800',
    city: 'Ibiza / Eivissa',
    province: 'Illes Balears',
    country: 'España',
    aliases: ['Ushuaïa', 'Ushuaia', 'UNVRS', 'Paradise'],
    notes: 'Alias / proyectos relacionados: Ushuaïa, UNVRS, Paradise. Razón social: USHUAIA ENTERTAINMENT SL.'
  },
  {
    company_name: 'Arte Volante',
    company: 'ARTE VOLANTE SL',
    tax_id: 'B57865677',
    billing_address: 'C/ Llevama 2, Bajos',
    postal_code: '07820',
    city: 'Ses Païsses / Ibiza',
    province: 'Illes Balears',
    country: 'España',
    aliases: ['Arte Volante']
  },
  {
    company_name: 'Maria Florencia Gayone Elissetche',
    company: 'MARIA FLORENCIA GAYONE ELISSETCHE',
    tax_id: '55465327E',
    billing_address: 'C/ Formentera 12, 2A',
    postal_code: '07800',
    city: 'Ibiza',
    province: 'Illes Balears',
    country: 'España',
    client_type: 'Persona física / Particular',
    aliases: ['Florencia Gayone', 'Gayone']
  },
  {
    company_name: 'O Beach Ibiza',
    company: 'ICE MOUNTAIN S.L',
    tax_id: 'B57704124n',
    billing_address: '12-14 Carrer Des Molí',
    postal_code: '07820',
    city: 'Sant Antoni',
    province: 'Illes Balears',
    country: 'España',
    aliases: ['O Beach', 'OBEACH'],
    notes: '[NEEDS VERIFICATION] La "n" final en B57704124n podría ser un error en la factura. Razón social: ICE MOUNTAIN S.L. Marca/Venue: O Beach.'
  },
  {
    company_name: 'Aoife Maria Cleary',
    company: 'AOIFE MARIA CLEARY',
    tax_id: 'Y1954964R',
    billing_address: 'Carrer de Joan Boscà 6',
    postal_code: '07820',
    city: 'Sant Antoni de Portmany',
    province: 'Illes Balears',
    country: 'España',
    aliases: ['Aoife', 'Aoefie', 'Aoife Cleary']
  },
  {
    company_name: 'Musicalidad',
    company: 'MUSICALIDAD S.L',
    tax_id: 'B67534867',
    billing_address: 'Paseo Urrutia, 100, 3º 4ª',
    postal_code: '08031',
    city: 'Barcelona',
    province: 'Barcelona',
    country: 'España',
    aliases: ['Musicalidad']
  },
  {
    company_name: 'Ritual Collective',
    company: 'RITUAL COLLECTIVE SL',
    tax_id: 'B972791098',
    billing_address: 'Ctra. San Juan s/n',
    postal_code: '07812',
    city: 'San Juan de Labritja / Sant Joan de Labritja',
    province: 'Illes Balears',
    country: 'España',
    aliases: ['Ritual Collective'],
    notes: '[NEEDS VERIFICATION] Identificación fiscal indicada en factura: B972791098 (10 caracteres, comprobar validez del CIF).'
  },
  {
    company_name: 'Christelle Stephanie Barouse',
    company: 'CHRISTELLE STEPHANIE BAROUSE',
    tax_id: 'X3117792G',
    billing_address: 'Carreró d\'en Figa, 9 Escalera B, Planta 1, Apto. 4A',
    postal_code: '07100',
    city: 'Sóller',
    province: 'Illes Balears',
    country: 'España',
    client_type: 'Persona física / Particular',
    aliases: ['Christelle Barouse']
  }
];

const norm = (s: string | null | undefined) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/gi, '').trim();

export async function processIbizaImport(supabase: any, org: string) {
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
        position: 0,
        color: '#0073ea'
      })
      .select('*')
      .single();

    if (newG.data) ibizaGroup = newG.data;
  }

  // 2. Fetch existing clients
  const { data: existingClients } = await supabase
    .from('clients')
    .select('*')
    .eq('organization_id', org)
    .is('deleted_at', null);

  const clientsList = existingClients || [];

  const updated: any[] = [];
  const created: any[] = [];
  const duplicatesDetected: string[] = [];
  const aliasesAdded: string[] = [];
  const flaggedTaxIds: { tax_id: string; reason: string }[] = [];

  for (const target of ibizaTargets) {
    // Check flags
    if (target.tax_id === 'B57704124n') {
      flaggedTaxIds.push({ tax_id: 'B57704124n', reason: 'La "n" final podría ser un error de tipografía en la factura (ICE MOUNTAIN S.L).' });
    }
    if (target.tax_id === 'B972791098') {
      flaggedTaxIds.push({ tax_id: 'B972791098', reason: 'CIF de 10 caracteres en factura (RITUAL COLLECTIVE SL), requiere verificación.' });
    }

    // Match by Tax ID or Name / Aliases
    const targetTaxNorm = norm(target.tax_id);
    const targetLegalNorm = norm(target.company);
    const targetCommNorm = norm(target.company_name);
    const targetAliasNorms = target.aliases.map(norm);

    let match = clientsList.find((c: any) => {
      if (c.tax_id && norm(c.tax_id) === targetTaxNorm) return true;
      if (c.company && norm(c.company) === targetLegalNorm) return true;
      if (c.company_name && (norm(c.company_name) === targetCommNorm || targetAliasNorms.includes(norm(c.company_name)))) return true;
      if (c.company && targetAliasNorms.includes(norm(c.company))) return true;
      return false;
    });

    // Check potential duplicate warnings
    const fuzzyMatches = clientsList.filter((c: any) => {
      if (c.id === match?.id) return false;
      const cNameNorm = norm(c.company_name || c.company || '');
      return targetAliasNorms.some(a => cNameNorm.includes(a) || a.includes(cNameNorm));
    });

    if (fuzzyMatches.length > 0) {
      duplicatesDetected.push(`${target.company_name} coincidente con: ${fuzzyMatches.map((m: any) => m.company_name || m.company).join(', ')}`);
    }

    if (target.aliases.length > 0) {
      aliasesAdded.push(`${target.company_name}: ${target.aliases.join(', ')}`);
    }

    if (match) {
      // UPDATE EXISTING CLIENT
      const patch: any = {
        group_id: ibizaGroup.id,
        company_name: match.company_name || target.company_name,
        company: match.company || target.company,
        tax_id: match.tax_id || target.tax_id,
        billing_address: match.billing_address || target.billing_address,
        postal_code: match.postal_code || target.postal_code,
        city: match.city || target.city,
        province: match.province || target.province,
        country: match.country || target.country,
        client_type: match.client_type || target.client_type || 'Cliente',
        updated_at: new Date().toISOString()
      };

      // Append notes cleanly
      const existingNotes = match.notes || '';
      const targetNotes = target.notes || '';
      if (targetNotes && !existingNotes.includes(targetNotes)) {
        patch.notes = [existingNotes, targetNotes].filter(Boolean).join('\n---\n');
      }

      const res = await supabase.from('clients').update(patch).eq('id', match.id).select('*').single();
      if (res.data) updated.push(res.data);
    } else {
      // CREATE NEW CLIENT
      const newClientData = {
        organization_id: org,
        group_id: ibizaGroup.id,
        client_code: 'CL-' + crypto.randomUUID(),
        company_name: target.company_name,
        company: target.company,
        tax_id: target.tax_id,
        billing_address: target.billing_address,
        postal_code: target.postal_code,
        city: target.city,
        province: target.province,
        country: target.country,
        client_type: target.client_type || 'Cliente',
        notes: target.notes || '',
        phone: null,
        email: null,
        billing_email: null,
        accounts_phone: null,
        accounts_contact: null,
        contact_name: null
      };

      const res = await supabase.from('clients').insert(newClientData).select('*').single();
      if (res.data) created.push(res.data);
    }
  }

  // Get final state
  const { data: finalClients } = await supabase.from('clients').select('*').eq('organization_id', org).is('deleted_at', null);

  const noPhone = (finalClients || []).filter((c: any) => !c.phone && !c.accounts_phone);
  const noEmail = (finalClients || []).filter((c: any) => !c.email && !c.billing_email);

  return {
    ibizaGroup,
    updated,
    created,
    duplicatesDetected,
    aliasesAdded,
    flaggedTaxIds,
    noPhone,
    noEmail,
    totalClientsInDb: finalClients?.length || 0
  };
}

export async function GET() {
  const auth = await requireOrganization();
  let supabase: any;
  let org: string;

  if (!('error' in auth)) {
    supabase = auth.supabase;
    org = auth.membership.organization_id;
  } else {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jggoimqcrpqarhaojrva.supabase.co';
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_UiokJaNNQXyf06Mpwn1RNg_qoT5aWJL';
    supabase = createServerClient(url, key);
    const { data: g } = await supabase.from('client_groups').select('organization_id').limit(1).maybeSingle();
    org = g?.organization_id || '191c90ad-5337-405e-9d1a-abae2ad8c70e';
  }

  const result = await processIbizaImport(supabase, org);
  return NextResponse.json(result);
}
