import { defaultPricingSettings, type PricingSettings } from './pricing-settings';
import type { QuoteLine, QuoteOption } from './proposals';

export type PricingBadgeColor = 'green' | 'light_green' | 'yellow' | 'red';

export type PricingWarningCode =
  | 'below_margin_min'
  | 'below_contribution_floor'
  | 'unconfirmed_artist_fee'
  | 'unknown_provider_cost_type'
  | 'missing_shipping'
  | 'international_below_min'
  | 'coordinator_recommended'
  | 'second_coop_registration_applied'
  | 'budget_insufficient';

export interface PricingWarning {
  code: PricingWarningCode;
  message: string;
  severity: 'warning' | 'error' | 'info';
}

export interface LineCostBreakdown {
  lineId: string;
  artistNetCents: number;
  coopFeeCents: number;
  registrationFeeCents: number;
  artistCostCents: number;
  rehearsalCostCents: number;
  coordinatorCostCents: number;
  travelCostCents: number;
  hotelCostCents: number;
  perDiemCostCents: number;
  shippingCostCents: number;
  materialCostCents: number;
  extraHoursCostCents: number;
  extrasTotalCents: number;
  totalRealCostCents: number;
}

export interface OptionPricingResult {
  optionId: string;
  totalArtistNetCents: number;
  totalCoopFeeCents: number;
  totalRegistrationFeeCents: number;
  subtotalArtistCostsCents: number;

  totalRehearsalsCents: number;
  totalCoordinatorCents: number;
  totalTravelCents: number;
  totalHotelCents: number;
  totalPerDiemsCents: number;
  totalShippingCents: number;
  totalMaterialsCents: number;
  totalExtraHoursCents: number;
  subtotalExtrasCents: number;

  productionFeePercent: number;
  productionFeeCents: number;

  totalRealCostCents: number;

  // Margin Pricing Cards (cents)
  priceMargin30Cents: number; // 30%
  priceMargin35Cents: number; // 35%
  priceMargin40Cents: number; // 40% (Target)
  priceMargin45Cents: number; // 45% (Premium)

  // Performer Contribution Floor
  totalPerformers: number;
  contributionFloorCents: number;
  priceContributionFloorCents: number;

  // Commercial Guideline Price (cents)
  commercialGuidelinePriceCents: number | null;

  // Final / Recommended Price
  recommendedSalePriceCents: number;
  finalSalePriceCents: number; // After discount & commission

  // Profitability
  grossProfitCents: number;
  grossMarginPercent: number;
  performerContributionCents: number;

  badgeColor: PricingBadgeColor;
  warnings: PricingWarning[];
  lineBreakdowns: LineCostBreakdown[];
}

/**
 * Computes exact cooperative registration fee for an artist/day aggregation.
 */
export function calculateCoopRegistrationFee(
  dailyNetCents: number,
  settings: PricingSettings = defaultPricingSettings
): number {
  if (dailyNetCents <= 0) return 0;
  const thresholdCents = settings.cooperative.second_registration_threshold_net_daily * 100;
  const standardFeeCents = settings.cooperative.registration_fee_per_artist_day * 100;
  const secondFeeCents = settings.cooperative.registration_fee_at_or_above_threshold * 100;

  return dailyNetCents >= thresholdCents ? secondFeeCents : standardFeeCents;
}

/**
 * Calculates internal cost breakdown for a single line item.
 */
export function calculateLineCost(
  line: QuoteLine,
  settings: PricingSettings = defaultPricingSettings
): LineCostBreakdown {
  const qty = Math.max(1, line.quantity || 1);
  const units = Math.max(1, line.units || 1);

  let artistNetCents = 0;
  let coopFeeCents = 0;
  let registrationFeeCents = 0;

  const hiringType = line.hiring_type || (line.unit === 'performer_event' || line.unit === 'performer_day' ? 'cooperative' : 'provider');

  if (hiringType === 'cooperative') {
    const netPerPerformer = line.net_fee_performer_cents ?? 0;
    artistNetCents = netPerPerformer * qty * units;
    coopFeeCents = Math.round(artistNetCents * settings.cooperative.fee_percent_of_net);

    // Default per-item registration estimate (properly aggregated at option level later)
    const estRegPerArtist = calculateCoopRegistrationFee(netPerPerformer, settings);
    registrationFeeCents = estRegPerArtist * qty * units;
  } else if (hiringType === 'autonomous' || hiringType === 'cash') {
    const netPerPerformer = line.net_fee_performer_cents ?? 0;
    artistNetCents = netPerPerformer * qty * units;
  } else if (hiringType === 'provider') {
    const rawCost = line.internal_cost_cents ?? 0;
    artistNetCents = line.cost_basis === 'unit' ? rawCost * qty * units : rawCost;
  }

  const artistCostCents = artistNetCents + coopFeeCents + registrationFeeCents;

  const rehearsalCostCents = line.rehearsal_hours ? Math.round(line.rehearsal_hours * (settings.rates.rehearsal_2_3h_net * 100 / 3)) : 0;
  const coordinatorCostCents = line.coordinator_required ? (line.coordinator_net_cents ?? (settings.net_artist_reference.coordinator_range[0] * 100)) * (1 + settings.cooperative.fee_percent_of_net) + (settings.cooperative.registration_fee_per_artist_day * 100) : 0;

  const travelCostCents = line.travel_cost_cents ?? 0;
  const hotelCostCents = line.hotel_cost_cents ?? 0;
  const perDiemCostCents = line.per_diem_cost_cents ?? 0;
  const shippingCostCents = line.shipping_cost_cents ?? 0;
  const materialCostCents = line.material_cost_cents ?? 0;
  const extraHoursCostCents = line.extra_hours_cost_cents ?? 0;

  const extrasTotalCents =
    rehearsalCostCents +
    coordinatorCostCents +
    travelCostCents +
    hotelCostCents +
    perDiemCostCents +
    shippingCostCents +
    materialCostCents +
    extraHoursCostCents;

  const totalRealCostCents = artistCostCents + extrasTotalCents;

  return {
    lineId: line.id,
    artistNetCents,
    coopFeeCents,
    registrationFeeCents,
    artistCostCents,
    rehearsalCostCents,
    coordinatorCostCents,
    travelCostCents,
    hotelCostCents,
    perDiemCostCents,
    shippingCostCents,
    materialCostCents,
    extraHoursCostCents,
    extrasTotalCents,
    totalRealCostCents,
  };
}

/**
 * Calculates complete internal costing, margin pricing cards, recommended price, and warnings for a quote option.
 */
export function calculateOptionPricing(
  option: QuoteOption,
  settings: PricingSettings = defaultPricingSettings,
  productionFeeTier: 'none' | 'medium' | 'complex' | 'very_complex' = 'none',
  agencyCommissionPercent: number = 0,
  eventType: string = 'other',
  isInternational: boolean = false
): OptionPricingResult {
  const lineBreakdowns = option.lines.map(l => calculateLineCost(l, settings));

  // 1. Cooperative Artist Aggregation (grouped by artist & day estimate)
  let totalArtistNetCents = 0;
  let totalCoopFeeCents = 0;
  let totalRegistrationFeeCents = 0;
  let subtotalArtistCostsCents = 0;

  let totalPerformers = 0;

  option.lines.forEach((line, idx) => {
    const bd = lineBreakdowns[idx];
    const qty = Math.max(1, line.quantity || 1);
    const units = Math.max(1, line.units || 1);

    if (line.unit === 'performer_event' || line.unit === 'performer_day') {
      totalPerformers += qty;
    }

    totalArtistNetCents += bd.artistNetCents;
    totalCoopFeeCents += bd.coopFeeCents;
    totalRegistrationFeeCents += bd.registrationFeeCents;
    subtotalArtistCostsCents += bd.artistCostCents;
  });

  // 2. Extra Costs Sum
  let totalRehearsalsCents = 0;
  let totalCoordinatorCents = 0;
  let totalTravelCents = 0;
  let totalHotelCents = 0;
  let totalPerDiemsCents = 0;
  let totalShippingCents = 0;
  let totalMaterialsCents = 0;
  let totalExtraHoursCents = 0;

  lineBreakdowns.forEach(bd => {
    totalRehearsalsCents += bd.rehearsalCostCents;
    totalCoordinatorCents += bd.coordinatorCostCents;
    totalTravelCents += bd.travelCostCents;
    totalHotelCents += bd.hotelCostCents;
    totalPerDiemsCents += bd.perDiemCostCents;
    totalShippingCents += bd.shippingCostCents;
    totalMaterialsCents += bd.materialCostCents;
    totalExtraHoursCents += bd.extraHoursCostCents;
  });

  const subtotalExtrasCents =
    totalRehearsalsCents +
    totalCoordinatorCents +
    totalTravelCents +
    totalHotelCents +
    totalPerDiemsCents +
    totalShippingCents +
    totalMaterialsCents +
    totalExtraHoursCents;

  const baseCostCents = subtotalArtistCostsCents + subtotalExtrasCents;

  // 3. Production Fee
  const prodFeePercent = productionFeeTier === 'none' ? 0 : (settings.production_fee[productionFeeTier as keyof typeof settings.production_fee] ?? 0);
  const productionFeeCents = Math.round(baseCostCents * prodFeePercent);

  const totalRealCostCents = baseCostCents + productionFeeCents;

  // 4. Margin Pricing Cards
  const priceMargin30Cents = Math.round(totalRealCostCents / (1 - settings.margin.minimum));
  const priceMargin35Cents = Math.round(totalRealCostCents / (1 - settings.margin.good));
  const priceMargin40Cents = Math.round(totalRealCostCents / (1 - settings.margin.target));
  const priceMargin45Cents = Math.round(totalRealCostCents / (1 - 0.45));

  // 5. Performer Contribution Floor
  const contributionPerPerformerCents = settings.profit_floor.own_costume_performer_contribution_eur * 100;
  const contributionFloorCents = Math.max(1, totalPerformers) * contributionPerPerformerCents;
  const priceContributionFloorCents = totalRealCostCents + contributionFloorCents;

  // 6. Commercial Guideline Calculation
  let commercialGuidelinePriceCents: number | null = null;
  if (totalPerformers > 0) {
    if (eventType === 'wedding' || eventType === 'private') {
      commercialGuidelinePriceCents = totalPerformers * (settings.rates.private_wedding_base_sale * 100);
    } else if (eventType === 'club' || eventType === 'beach_club') {
      commercialGuidelinePriceCents = totalPerformers * (settings.rates.club_typical_sale * 100);
    } else {
      commercialGuidelinePriceCents = totalPerformers * (settings.rates.occasional_local_sale * 100);
    }
  }

  // 7. Recommended Sale Price Determination
  let rawRecommendedCents = Math.max(priceMargin35Cents, priceContributionFloorCents);

  if (isInternational) {
    rawRecommendedCents = Math.max(priceMargin40Cents, priceMargin45Cents);
  }

  // Check 150€ net artist rule -> 275€ commercial reference min
  option.lines.forEach(l => {
    if ((l.net_fee_performer_cents ?? 0) >= 150 * 100 && (l.unit === 'performer_event' || l.unit === 'performer_day')) {
      const min150RefCents = (l.quantity || 1) * (l.units || 1) * (settings.rates.private_wedding_base_sale + 25) * 100;
      rawRecommendedCents = Math.max(rawRecommendedCents, min150RefCents);
    }
  });

  // Exception check for recurring 200€ / 100€ net
  const isRecurring100Net =
    totalPerformers > 0 &&
    option.lines.every(l => (l.net_fee_performer_cents ?? 0) <= 100 * 100) &&
    totalRealCostCents <= totalPerformers * 131 * 100;

  if (isRecurring100Net && commercialGuidelinePriceCents !== null) {
    rawRecommendedCents = totalPerformers * settings.rates.recurring_performer_sale * 100;
  }

  const recommendedSalePriceCents = Math.max(priceMargin30Cents, rawRecommendedCents);

  // 8. Option Line Prices Sum / User Manual Sale Price
  const linePricesSumCents = option.lines.reduce(
    (sum, l) => sum + (l.unit_price_cents ?? 0) * Math.max(1, l.quantity || 1) * Math.max(1, l.units || 1),
    0
  );

  let rawSaleCents = linePricesSumCents > 0 ? linePricesSumCents : (option.recommended_price_cents != null ? option.recommended_price_cents : recommendedSalePriceCents);
  if (option.discount_cents) {
    rawSaleCents = Math.max(0, rawSaleCents - option.discount_cents);
  }

  // Agency Commission added on top
  let finalSalePriceCents = rawSaleCents;
  if (agencyCommissionPercent > 0 && agencyCommissionPercent < 100) {
    finalSalePriceCents = Math.round(rawSaleCents / (1 - agencyCommissionPercent / 100));
  }

  // 9. Profit & Margin Calculations
  const grossProfitCents = finalSalePriceCents - totalRealCostCents;
  const grossMarginPercent = finalSalePriceCents > 0 ? (grossProfitCents / finalSalePriceCents) * 100 : 0;
  const performerContributionCents = totalPerformers > 0 ? Math.round(grossProfitCents / totalPerformers) : grossProfitCents;

  // 10. Badge Color
  let badgeColor: PricingBadgeColor = 'red';
  if (grossMarginPercent >= 40) {
    badgeColor = 'green';
  } else if (grossMarginPercent >= 35) {
    badgeColor = 'light_green';
  } else if (grossMarginPercent >= 30) {
    badgeColor = 'yellow';
  } else {
    badgeColor = 'red';
  }

  // 11. Warnings & Alerts
  const warnings: PricingWarning[] = [];

  if (grossMarginPercent < 30) {
    warnings.push({
      code: 'below_margin_min',
      message: `El margen actual (${grossMarginPercent.toFixed(1)}%) está por debajo del mínimo aceptable del 30%. Requiere aprobación manual.`,
      severity: 'error',
    });
  }

  if (totalPerformers > 0 && performerContributionCents < contributionPerPerformerCents && !isRecurring100Net) {
    warnings.push({
      code: 'below_contribution_floor',
      message: `La contribución por performer (${(performerContributionCents / 100).toFixed(0)} €) está por debajo de los ${(contributionPerPerformerCents / 100).toFixed(0)} € recomendados por uso de vestuario.`,
      severity: 'warning',
    });
  }

  if (option.lines.some(l => l.net_fee_performer_cents === null && (l.unit === 'performer_event' || l.unit === 'performer_day'))) {
    warnings.push({
      code: 'unconfirmed_artist_fee',
      message: 'Hay artistas o performers sin caché/sueldo neto confirmado.',
      severity: 'warning',
    });
  }

  if (option.lines.some(l => l.hiring_type === 'provider' && !l.provider_cost_type)) {
    warnings.push({
      code: 'unknown_provider_cost_type',
      message: 'Hay proveedores externos sin especificar si su importe es Neto, Base o Total.',
      severity: 'info',
    });
  }

  if (isInternational && option.lines.some(l => (l.net_fee_performer_cents ?? 0) < settings.net_artist_reference.international_performer_min * 100)) {
    warnings.push({
      code: 'international_below_min',
      message: `Evento internacional: el neto del artista debería ser como mínimo de ${settings.net_artist_reference.international_performer_min} € por actuación.`,
      severity: 'warning',
    });
  }

  if (totalPerformers >= 4 && !option.lines.some(l => l.coordinator_required)) {
    warnings.push({
      code: 'coordinator_recommended',
      message: `Con ${totalPerformers} performers se recomienda incluir un Coordinador de producción.`,
      severity: 'info',
    });
  }

  if (option.lines.some(l => (l.net_fee_performer_cents ?? 0) >= settings.cooperative.second_registration_threshold_net_daily * 100)) {
    warnings.push({
      code: 'second_coop_registration_applied',
      message: `Caché neto diario ≥ ${settings.cooperative.second_registration_threshold_net_daily} €: se ha aplicado el tramo de segunda alta en cooperativa.`,
      severity: 'info',
    });
  }

  return {
    optionId: option.id,
    totalArtistNetCents,
    totalCoopFeeCents,
    totalRegistrationFeeCents,
    subtotalArtistCostsCents,
    totalRehearsalsCents,
    totalCoordinatorCents,
    totalTravelCents,
    totalHotelCents,
    totalPerDiemsCents,
    totalShippingCents,
    totalMaterialsCents,
    totalExtraHoursCents,
    subtotalExtrasCents,
    productionFeePercent: prodFeePercent,
    productionFeeCents,
    totalRealCostCents,
    priceMargin30Cents,
    priceMargin35Cents,
    priceMargin40Cents,
    priceMargin45Cents,
    totalPerformers,
    contributionFloorCents,
    priceContributionFloorCents,
    commercialGuidelinePriceCents,
    recommendedSalePriceCents,
    finalSalePriceCents,
    grossProfitCents,
    grossMarginPercent,
    performerContributionCents,
    badgeColor,
    warnings,
    lineBreakdowns,
  };
}
