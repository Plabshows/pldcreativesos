export type ProposalLine = {
  quantity: number;
  unitCostCents: number;
  unitPriceCents: number;
  travelCents?: number;
  accommodationCents?: number;
  productionCents?: number;
  creativeFeeCents?: number;
  extrasCents?: number;
};

export function calculateProposalLine(line: ProposalLine) {
  const quantity = Math.max(0, line.quantity);
  const internal = Math.round(quantity * line.unitCostCents);
  const client = Math.round(quantity * line.unitPriceCents) + (line.travelCents ?? 0) + (line.accommodationCents ?? 0) + (line.productionCents ?? 0) + (line.creativeFeeCents ?? 0) + (line.extrasCents ?? 0);
  return { internalCents: internal, clientCents: client, profitCents: client - internal, marginPercent: client === 0 ? 0 : Math.round(((client - internal) / client) * 10000) / 100 };
}

export function calculateGrossMargin(input: { revenueCents: number; directCostCents: number }) {
  const profitCents = input.revenueCents - input.directCostCents;
  return { profitCents, marginPercent: input.revenueCents === 0 ? 0 : Math.round((profitCents / input.revenueCents) * 10000) / 100 };
}
