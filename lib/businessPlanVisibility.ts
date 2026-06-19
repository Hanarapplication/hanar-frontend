/** Self-service plan picker: Free + Premium only. Starter/Growth remain in DB for legacy accounts. */
export const PUBLIC_SELECTABLE_BUSINESS_PLANS = ['free', 'premium'] as const;

export type PublicSelectableBusinessPlan = (typeof PUBLIC_SELECTABLE_BUSINESS_PLANS)[number];

export function isPublicSelectableBusinessPlan(plan: string | null | undefined): boolean {
  const v = (plan ?? '').trim().toLowerCase();
  return (PUBLIC_SELECTABLE_BUSINESS_PLANS as readonly string[]).includes(v);
}

export function filterPublicSelectableBusinessPlans<T extends { plan: string }>(plans: T[]): T[] {
  return plans.filter((p) => isPublicSelectableBusinessPlan(p.plan));
}
