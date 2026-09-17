import { describe, expect, it } from 'vitest';
import { calculateEventHealth } from '../lib/domain/health';
import { calculateGrossMargin, calculateProposalLine } from '../lib/domain/finance';
import { calculateTalentCompleteness } from '../lib/domain/completeness';

describe('Performance Lab OS domain rules', () => {
  it('marks unresolved critical production requirements as red', () => {
    expect(calculateEventHealth([{ isCritical: true, isResolved: false }], true, true)).toBe('red');
    expect(calculateEventHealth([{ isCritical: false, isResolved: false }], true, true)).toBe('orange');
    expect(calculateEventHealth([{ isCritical: true, isResolved: true }], true, true)).toBe('green');
  });

  it('keeps internal cost separate from client price', () => {
    const result = calculateProposalLine({ quantity: 2, unitCostCents: 15000, unitPriceCents: 28000, travelCents: 5000 });
    expect(result.internalCents).toBe(30000);
    expect(result.clientCents).toBe(61000);
    expect(result.profitCents).toBe(31000);
  });

  it('calculates a gross margin without floating point surprises', () => {
    expect(calculateGrossMargin({ revenueCents: 10000, directCostCents: 2750 })).toEqual({ profitCents: 7250, marginPercent: 72.5 });
  });

  it('reports the fields missing from a talent profile', () => {
    const result = calculateTalentCompleteness({ realName: 'Ana', city: 'Valencia', disciplines: ['Dancer'], passportValid: true });
    expect(result.percent).toBe(44);
    expect(result.missing).toContain('showreel');
    expect(result.missing).toContain('shoeSize');
  });
});
