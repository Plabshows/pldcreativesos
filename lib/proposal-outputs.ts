import { money, type ProposalFields } from './proposals';
import { calculateOptionPricing } from './pricing-engine';
import { defaultPricingSettings, type PricingSettings } from './pricing-settings';

/**
 * Generates clean WhatsApp response text for client (in Spanish or English).
 * STRICTLY conceals internal artist fees, cooperative fees, margins, and internal notes.
 */
export function generateWhatsAppMessage(
  proposal: ProposalFields,
  settings: PricingSettings = defaultPricingSettings,
  optionId?: string
): string {
  const isEn = proposal.language === 'en';
  const selectedOption =
    proposal.options.find(o => o.id === (optionId || proposal.selected_option_id)) ||
    proposal.options[0];

  if (!selectedOption) return '';

  const optPricing = calculateOptionPricing(
    selectedOption,
    settings,
    proposal.production_fee_tier as any,
    proposal.agency_commission_percent || 0,
    proposal.event_type || 'other',
    proposal.country !== 'España' && Boolean(proposal.country)
  );

  const finalSaleCents = optPricing.finalSalePriceCents;
  const tax = proposal.tax_percent ?? 21;

  const linesSummary = selectedOption.lines
    .map(l => {
      const qtyStr = l.quantity > 1 ? `${l.quantity} × ` : '';
      const unitStr = l.units > 1 ? ` (${l.units} ${isEn ? 'days/units' : 'días/pases'})` : '';
      const setStr = l.sets ? ` • ${l.sets}` : '';
      return `• ${qtyStr}${l.label}${unitStr}${setStr}`;
    })
    .join('\n');

  if (isEn) {
    const contactName = proposal.contact_name ? ` ${proposal.contact_name}` : '';
    return `Hi${contactName} 😊

For your event${proposal.venue ? ` at ${proposal.venue}` : ''}${proposal.event_date ? ` on ${proposal.event_date}` : ''}, here is our performance proposal:

${linesSummary}
• Professional performers & Performance Lab costumes included

Total: ${money(finalSaleCents, 'en')} + VAT (${tax}%)

Let me know if you would like us to reserve the date or adjust any details!`;
  } else {
    const contactName = proposal.contact_name ? ` ${proposal.contact_name}` : '';
    return `Hola${contactName} 😊

Para el evento${proposal.venue ? ` en ${proposal.venue}` : ''}${proposal.event_date ? ` del ${proposal.event_date}` : ''}, te paso nuestra propuesta:

${linesSummary}
• Performers profesionales y vestuario de Performance Lab incluidos

Importe: ${money(finalSaleCents, 'es')} + IVA (${tax}%)

¡Dime si quieres que reservemos la fecha o ajustemos cualquier detalle!`;
  }
}

/**
 * Generates clean Email message text for client.
 */
export function generateEmailMessage(
  proposal: ProposalFields,
  settings: PricingSettings = defaultPricingSettings,
  optionId?: string
): string {
  const isEn = proposal.language === 'en';
  const selectedOption =
    proposal.options.find(o => o.id === (optionId || proposal.selected_option_id)) ||
    proposal.options[0];

  if (!selectedOption) return '';

  const optPricing = calculateOptionPricing(
    selectedOption,
    settings,
    proposal.production_fee_tier as any,
    proposal.agency_commission_percent || 0,
    proposal.event_type || 'other',
    proposal.country !== 'España' && Boolean(proposal.country)
  );

  const finalSaleCents = optPricing.finalSalePriceCents;
  const tax = proposal.tax_percent ?? 21;
  const vatCents = Math.round((finalSaleCents * tax) / 100);
  const totalWithVatCents = finalSaleCents + vatCents;

  const linesSummary = selectedOption.lines
    .map(l => {
      const qtyStr = `${l.quantity} × `;
      const setStr = l.sets ? ` (${l.sets})` : '';
      const desc = l.description ? `\n   ${l.description}` : '';
      return `• ${qtyStr}${l.label}${setStr}${desc}`;
    })
    .join('\n\n');

  if (isEn) {
    const greetingName = proposal.contact_name
      ? `${proposal.contact_name}${proposal.client_name ? ` (${proposal.client_name})` : ''}`
      : proposal.client_name || 'Client';
    return `Subject: Entertainment Proposal - Performance Lab - ${proposal.title}

Dear ${greetingName},

Thank you for contacting Performance Lab. We are pleased to present our entertainment proposal for ${proposal.title}${proposal.event_date ? ` (${proposal.event_date})` : ''}.

PROPOSED ENTERTAINMENT:
${linesSummary}

INVESTMENT SUMMARY:
• Subtotal (excl. VAT): ${money(finalSaleCents, 'en')}
• VAT (${tax}%): ${money(vatCents, 'en')}
• Total: ${money(totalWithVatCents, 'en')}

Included:
- High-level professional performers
- Signature Performance Lab wardrobe and styling
- Full production management & coordination

Terms & Validity:
- Payment schedule: 50% upon booking confirmation, 50% prior to performance.
- Proposal valid until: ${proposal.valid_until || '7 days from issue'}.

Please feel free to reach out if you have any questions or would like to proceed with reservation.

Best regards,

Performance Lab Team
www.performancelab.es`;
  } else {
    const greetingName = proposal.contact_name
      ? `${proposal.contact_name}${proposal.client_name ? ` (${proposal.client_name})` : ''}`
      : proposal.client_name || 'Cliente';
    return `Asunto: Propuesta de Espectáculos - Performance Lab - ${proposal.title}

Estimado/a ${greetingName},

Muchas gracias por contactar con Performance Lab. Nos complace presentar la propuesta artística para ${proposal.title}${proposal.event_date ? ` (${proposal.event_date})` : ''}.

PROPUESTA DE ENTRETENIMIENTO:
${linesSummary}

RESUMEN ECONÓMICO:
• Base imponible (sin IVA): ${money(finalSaleCents, 'es')}
• IVA (${tax}%): ${money(vatCents, 'es')}
• Total con IVA: ${money(totalWithVatCents, 'es')}

Incluye:
- Performers profesionales de primer nivel
- Vestuarios y caracterización propios de Performance Lab
- Gestión y coordinación de producción

Condiciones y validez:
- Forma de pago: 50% para reserva de fecha, 50% antes de la actuación.
- Propuesta válida hasta: ${proposal.valid_until || '7 días desde emisión'}.

Quedamos a tu entera disposición para resolver cualquier duda o formalizar la reserva.

Un cordial saludo,

Equipo Performance Lab
www.performancelab.es`;
  }
}
