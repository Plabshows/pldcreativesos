import { describe, it, expect } from 'vitest';
import { calculateOptionPricing, calculateLineCost, calculateCoopRegistrationFee } from '../lib/pricing-engine';
import { defaultPricingSettings } from '../lib/pricing-settings';
import { newProposal, newLine, newOption } from '../lib/proposals';
import { generateWhatsAppMessage, generateEmailMessage } from '../lib/proposal-outputs';

describe('Performance Lab Pricing Engine - Strict Prompt Rules & Tests', () => {
  it('calculates cooperative cost with 5% fee and 26 € registration correctly', () => {
    const line100 = { ...newLine(), quantity: 1, hiring_type: 'cooperative' as const, net_fee_performer_cents: 10000 };
    const bd100 = calculateLineCost(line100, defaultPricingSettings);
    expect(bd100.artistNetCents).toBe(10000);
    expect(bd100.coopFeeCents).toBe(500); // 5%
    expect(bd100.registrationFeeCents).toBe(2600); // 26 €
    expect(bd100.totalRealCostCents).toBe(13100); // 131 €

    const line120 = { ...newLine(), quantity: 1, hiring_type: 'cooperative' as const, net_fee_performer_cents: 12000 };
    const bd120 = calculateLineCost(line120, defaultPricingSettings);
    expect(bd120.totalRealCostCents).toBe(15200); // 152 €

    const line150 = { ...newLine(), quantity: 1, hiring_type: 'cooperative' as const, net_fee_performer_cents: 15000 };
    const bd150 = calculateLineCost(line150, defaultPricingSettings);
    expect(bd150.totalRealCostCents).toBe(18350); // 183.50 €

    const line250 = { ...newLine(), quantity: 1, hiring_type: 'cooperative' as const, net_fee_performer_cents: 25000 };
    const bd250 = calculateLineCost(line250, defaultPricingSettings);
    expect(bd250.totalRealCostCents).toBe(28850); // 288.50 €
  });

  it('applies second registration fee when net daily reaches 300 € threshold', () => {
    expect(calculateCoopRegistrationFee(29900, defaultPricingSettings)).toBe(2600);
    expect(calculateCoopRegistrationFee(30000, defaultPricingSettings)).toBe(5200);
  });

  // TEST 1 from Prompt
  it('TEST 1: 2 performers @ 100 € net each, recurring event -> Cost 262 €, Sale 400 €, Profit 138 €, Margin 34.5%', () => {
    const line = { ...newLine(), quantity: 2, hiring_type: 'cooperative' as const, net_fee_performer_cents: 10000, unit_price_cents: 20000 };
    const option = { ...newOption(), lines: [line] };
    const pricing = calculateOptionPricing(option, defaultPricingSettings, 'none', 0, 'other', false);

    expect(pricing.totalRealCostCents).toBe(26200); // 262 €
    expect(pricing.finalSalePriceCents).toBe(40000); // 400 €
    expect(pricing.grossProfitCents).toBe(13800); // 138 €
    expect(pricing.grossMarginPercent).toBeCloseTo(34.5, 1);
    expect(pricing.badgeColor).toBe('yellow');
  });

  // TEST 2 from Prompt
  it('TEST 2: 2 performers @ 120 € net each, occasional event -> Cost 304 €, Sale 450 €, Profit 146 €, Margin 32.4%', () => {
    const line = { ...newLine(), quantity: 2, hiring_type: 'cooperative' as const, net_fee_performer_cents: 12000, unit_price_cents: 22500 };
    const option = { ...newOption(), lines: [line] };
    const pricing = calculateOptionPricing(option, defaultPricingSettings, 'none', 0, 'other', false);

    expect(pricing.totalRealCostCents).toBe(30400); // 304 €
    expect(pricing.finalSalePriceCents).toBe(45000); // 450 €
    expect(pricing.grossProfitCents).toBe(14600); // 146 €
    expect(pricing.grossMarginPercent).toBeCloseTo(32.4, 1);
    expect(pricing.badgeColor).toBe('yellow');
  });

  // TEST 3 from Prompt
  it('TEST 3: 1 performer @ 150 € net -> Cost 183.50 €, Sale 275 €, Profit 91.50 €, Margin 33.3%; never auto-recommends 250 €', () => {
    const line = { ...newLine(), quantity: 1, hiring_type: 'cooperative' as const, net_fee_performer_cents: 15000 };
    const option = { ...newOption(), lines: [line] };
    const pricing = calculateOptionPricing(option, defaultPricingSettings, 'none', 0, 'private', false);

    expect(pricing.totalRealCostCents).toBe(18350); // 183.50 €
    expect(pricing.recommendedSalePriceCents).toBeGreaterThanOrEqual(27500); // 275 € min reference
    expect(pricing.recommendedSalePriceCents).not.toBe(25000);

    // If sold at 275 €
    const lineSold = { ...line, unit_price_cents: 27500 };
    const optionSold = { ...newOption(), lines: [lineSold] };
    const pricingSold = calculateOptionPricing(optionSold, defaultPricingSettings, 'none', 0, 'private', false);

    expect(pricingSold.grossProfitCents).toBe(9150); // 91.50 €
    expect(pricingSold.grossMarginPercent).toBeCloseTo(33.27, 1);
    expect(pricingSold.badgeColor).toBe('yellow');
  });

  // TEST 4 from Prompt
  it('TEST 4: International 1 performer @ 250 € net -> Cost before travel 288.50 €, Target 40% margin ~481 € -> Recommended ~500 € + travel', () => {
    const line = { ...newLine(), quantity: 1, hiring_type: 'cooperative' as const, net_fee_performer_cents: 25000 };
    const option = { ...newOption(), lines: [line] };
    const pricing = calculateOptionPricing(option, defaultPricingSettings, 'none', 0, 'international', true);

    expect(pricing.totalRealCostCents).toBe(28850); // 288.50 €
    expect(pricing.priceMargin40Cents).toBe(48083); // ~481 €
    expect(pricing.recommendedSalePriceCents).toBeGreaterThanOrEqual(48083);
  });

  // TEST 5 from Prompt
  it('TEST 5: Manual sale price below 30% margin (Cost 1000 €, Sale 1250 €, Margin 20%) -> Shows RED WARNING without blocking', () => {
    const line = { ...newLine(), quantity: 1, internal_cost_cents: 100000, unit_price_cents: 125000, hiring_type: 'provider' as const };
    const option = { ...newOption(), lines: [line] };
    const pricing = calculateOptionPricing(option, defaultPricingSettings, 'none', 0, 'other', false);

    expect(pricing.totalRealCostCents).toBe(100000);
    expect(pricing.finalSalePriceCents).toBe(125000);
    expect(pricing.grossMarginPercent).toBe(20);
    expect(pricing.badgeColor).toBe('red');
    expect(pricing.warnings.some(w => w.code === 'below_margin_min')).toBe(true);
  });

  it('generates WhatsApp and Email outputs without leaking internal net fees or margins', () => {
    const prop = newProposal();
    prop.title = 'Test Event';
    prop.client_name = 'Acme Corp';
    prop.contact_name = 'Olivia';
    prop.options[0].lines[0].label = '2 TV Head Characters';
    prop.options[0].lines[0].sets = '3 x 15 min sets';
    prop.options[0].lines[0].unit_price_cents = 27500;
    prop.options[0].lines[0].quantity = 2;
    prop.options[0].lines[0].net_fee_performer_cents = 12000;
    prop.internal_notes = 'SECRET_COST_INFO';

    const wa = generateWhatsAppMessage(prop, defaultPricingSettings);
    expect(wa).toContain('Olivia');
    expect(wa).toContain('2 × 2 TV Head Characters');
    expect(wa).toContain('550,00');
    expect(wa).not.toContain('SECRET_COST_INFO');
    expect(wa).not.toContain('120');

    const email = generateEmailMessage(prop, defaultPricingSettings);
    expect(email).toContain('Acme Corp');
    expect(email).not.toContain('SECRET_COST_INFO');
  });
});
