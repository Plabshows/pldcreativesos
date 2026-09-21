type AllocationAmount = {status: string; rental_revenue: number | null};
type RepairAmount = {actual_cost: number | null; estimated_cost: number | null};

/** Assigned amounts are not receipts; absent evidence must not produce a profit. */
export function inventoryFinance(allocations: AllocationAmount[], repairs: RepairAmount[], productionCost: number | null) {
  const active = allocations.filter(a => a.status !== 'CANCELLED');
  const revenue = active.reduce((sum, a) => sum + (a.rental_revenue ?? 0), 0);
  const actualRepairCost = repairs.reduce((sum, r) => sum + (r.actual_cost ?? 0), 0);
  const estimatedRepairCost = repairs.filter(r => r.actual_cost === null).reduce((sum, r) => sum + (r.estimated_cost ?? 0), 0);
  const incomplete = productionCost === null || !active.length || active.some(a => a.rental_revenue === null) || repairs.some(r => r.actual_cost === null);
  const balance = incomplete ? null : revenue - actualRepairCost - productionCost!;
  return {revenue, actualRepairCost, estimatedRepairCost, incomplete, balance};
}
