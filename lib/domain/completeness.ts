export const talentCompletenessFields = ['realName','city','phone','email','disciplines','shoeSize','travelRate','showreel','passportValid'] as const;
export type TalentCompletenessInput = Partial<Record<(typeof talentCompletenessFields)[number], unknown>>;

export function calculateTalentCompleteness(talent: TalentCompletenessInput) {
  const completed = talentCompletenessFields.filter((key) => {
    const value = talent[key];
    return Array.isArray(value) ? value.length > 0 : value !== undefined && value !== null && value !== '' && value !== false;
  });
  const missing = talentCompletenessFields.filter((key) => !completed.includes(key));
  return { percent: Math.round((completed.length / talentCompletenessFields.length) * 100), missing };
}
