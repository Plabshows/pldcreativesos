import { z } from 'zod';

export const pricingSettingsSchema = z.object({
  version: z.string().default('1.0'),
  currency: z.string().default('EUR'),
  vat_margin_basis: z.enum(['exclude_vat']).default('exclude_vat'),
  margin: z.object({
    target: z.number().min(0).max(1).default(0.40),
    good: z.number().min(0).max(1).default(0.35),
    minimum: z.number().min(0).max(1).default(0.30),
    international_target_range: z.tuple([z.number(), z.number()]).default([0.40, 0.45]),
    below_minimum_requires_approval: z.boolean().default(true),
  }).default(() => ({
    target: 0.40,
    good: 0.35,
    minimum: 0.30,
    international_target_range: [0.40, 0.45] as [number, number],
    below_minimum_requires_approval: true,
  })),
  cooperative: z.object({
    fee_percent_of_net: z.number().min(0).max(1).default(0.05),
    registration_fee_per_artist_day: z.number().min(0).default(26),
    second_registration_threshold_net_daily: z.number().min(0).default(300),
    registration_fee_at_or_above_threshold: z.number().min(0).default(52),
    same_artist_same_day_aggregate: z.boolean().default(true),
  }).default(() => ({
    fee_percent_of_net: 0.05,
    registration_fee_per_artist_day: 26,
    second_registration_threshold_net_daily: 300,
    registration_fee_at_or_above_threshold: 52,
    same_artist_same_day_aggregate: true,
  })),
  profit_floor: z.object({
    own_costume_performer_contribution_eur: z.number().min(0).default(70),
    recurring_rounding_exception: z.object({
      sale_per_performer: z.number().default(200),
      net_artist_max: z.number().default(100),
      accept_approx_contribution: z.number().default(69),
    }).default(() => ({
      sale_per_performer: 200,
      net_artist_max: 100,
      accept_approx_contribution: 69,
    })),
  }).default(() => ({
    own_costume_performer_contribution_eur: 70,
    recurring_rounding_exception: {
      sale_per_performer: 200,
      net_artist_max: 100,
      accept_approx_contribution: 69,
    },
  })),
  rates: z.object({
    recurring_performer_sale: z.number().default(200),
    occasional_local_sale: z.number().default(225),
    private_wedding_base_sale: z.number().default(250),
    club_typical_sale: z.number().default(250),
    club_possible_sale: z.number().default(220),
    costume_change_sale: z.number().default(50),
    waiting_extra_per_hour: z.number().default(50),
    travel_day_net: z.number().default(80),
    three_day_trip_compensation_total: z.number().default(150),
    rehearsal_2_3h_net: z.number().default(80),
  }).default(() => ({
    recurring_performer_sale: 200,
    occasional_local_sale: 225,
    private_wedding_base_sale: 250,
    club_typical_sale: 250,
    club_possible_sale: 220,
    costume_change_sale: 50,
    waiting_extra_per_hour: 50,
    travel_day_net: 80,
    three_day_trip_compensation_total: 150,
    rehearsal_2_3h_net: 80,
  })),
  net_artist_reference: z.object({
    city_simple: z.number().default(100),
    city_better_paid: z.number().default(120),
    recurring_image_range: z.tuple([z.number(), z.number()]).default([70, 100]),
    ibiza_club_range: z.tuple([z.number(), z.number()]).default([120, 150]),
    ibiza_private_range: z.tuple([z.number(), z.number()]).default([140, 150]),
    ibiza_wedding_range: z.tuple([z.number(), z.number()]).default([140, 150]),
    corporate_range: z.tuple([z.number(), z.number()]).default([140, 150]),
    breakdancer: z.number().default(120),
    roller_recurring_valencia: z.number().default(100),
    roller_occasional_range: z.tuple([z.number(), z.number()]).default([120, 150]),
    fire_provider_range: z.tuple([z.number(), z.number()]).default([250, 300]),
    coordinator_range: z.tuple([z.number(), z.number()]).default([100, 120]),
    international_performer_min: z.number().default(250),
  }).default(() => ({
    city_simple: 100,
    city_better_paid: 120,
    recurring_image_range: [70, 100] as [number, number],
    ibiza_club_range: [120, 150] as [number, number],
    ibiza_private_range: [140, 150] as [number, number],
    ibiza_wedding_range: [140, 150] as [number, number],
    corporate_range: [140, 150] as [number, number],
    breakdancer: 120,
    roller_recurring_valencia: 100,
    roller_occasional_range: [120, 150] as [number, number],
    fire_provider_range: [250, 300] as [number, number],
    coordinator_range: [100, 120] as [number, number],
    international_performer_min: 250,
  })),
  rental_only: z.object({
    simple_range: z.tuple([z.number(), z.number()]).default([40, 50]),
    character_range: z.tuple([z.number(), z.number()]).default([80, 100]),
    premium: z.number().default(100),
    oversize_min: z.number().default(100),
    multi_or_weekly_possible_range: z.tuple([z.number(), z.number()]).default([60, 80]),
  }).default(() => ({
    simple_range: [40, 50] as [number, number],
    character_range: [80, 100] as [number, number],
    premium: 100,
    oversize_min: 100,
    multi_or_weekly_possible_range: [60, 80] as [number, number],
  })),
  production_fee: z.object({
    simple: z.number().default(0.0),
    medium: z.number().default(0.10),
    complex: z.number().default(0.15),
    very_complex: z.number().default(0.20),
  }).default(() => ({
    simple: 0.0,
    medium: 0.10,
    complex: 0.15,
    very_complex: 0.20,
  })),
  discounts: z.object({
    normal_max: z.number().default(0.05),
    extended_max_if_margin_still_ok: z.number().default(0.10),
    never_below_margin_minimum_automatically: z.boolean().default(true),
  }).default(() => ({
    normal_max: 0.05,
    extended_max_if_margin_still_ok: 0.10,
    never_below_margin_minimum_automatically: true,
  })),
  coordinator: z.object({
    performers_1_3: z.string().default('normally_no'),
    performers_4_6: z.string().default('recommended_yes'),
    performers_7_plus: z.string().default('mandatory_by_default'),
  }).default(() => ({
    performers_1_3: 'normally_no',
    performers_4_6: 'recommended_yes',
    performers_7_plus: 'mandatory_by_default',
  })),
  travel: z.object({
    hotel_min_stars: z.number().default(3),
    shared_room_allowed: z.boolean().default(true),
    local_transport: z.string().default('actual_cost_client'),
    shipping: z.string().default('actual_round_trip_cost'),
    meals_preference: z.string().default('provided_by_client'),
    per_diem_reference_2026: z.object({
      spain_overnight: z.number().default(53.34),
      international_overnight: z.number().default(91.35),
      spain_no_overnight: z.number().default(26.67),
      international_no_overnight: z.number().default(48.08),
    }).default(() => ({
      spain_overnight: 53.34,
      international_overnight: 91.35,
      spain_no_overnight: 26.67,
      international_no_overnight: 48.08,
    })),
  }).default(() => ({
    hotel_min_stars: 3,
    shared_room_allowed: true,
    local_transport: 'actual_cost_client',
    shipping: 'actual_round_trip_cost',
    meals_preference: 'provided_by_client',
    per_diem_reference_2026: {
      spain_overnight: 53.34,
      international_overnight: 91.35,
      spain_no_overnight: 26.67,
      international_no_overnight: 48.08,
    },
  })),
  payment_terms_default: z.object({
    private_wedding_new_client: z.string().default('50% reserva, 50% antes del evento; saldo recomendado 7 días antes'),
    corporate: z.string().default('50/50 salvo condiciones históricas aprobadas'),
    international: z.string().default('100% antes del evento o 50/50 con saldo antes de viajar'),
  }).default(() => ({
    private_wedding_new_client: '50% reserva, 50% antes del evento; saldo recomendado 7 días antes',
    corporate: '50/50 salvo condiciones históricas aprobadas',
    international: '100% antes del evento o 50/50 con saldo antes de viajar',
  })),
  cancellation: z.object({
    status: z.string().default('not_finalized'),
    instruction: z.string().default('Términos sujetos a confirmación de reserva.'),
  }).default(() => ({
    status: 'not_finalized',
    instruction: 'Términos sujetos a confirmación de reserva.',
  })),
});

export type PricingSettings = z.infer<typeof pricingSettingsSchema>;

export const defaultPricingSettings: PricingSettings = pricingSettingsSchema.parse({});

