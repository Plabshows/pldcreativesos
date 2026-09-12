export type HealthRequirement = { isCritical: boolean; isResolved: boolean };

export function calculateEventHealth(requirements: HealthRequirement[], hasDate: boolean, hasVenue: boolean) {
  const unresolvedCritical = requirements.some((item) => item.isCritical && !item.isResolved);
  const unresolved = requirements.some((item) => !item.isResolved);
  if (unresolvedCritical || !hasDate || !hasVenue) return 'red' as const;
  if (unresolved) return 'orange' as const;
  return 'green' as const;
}
