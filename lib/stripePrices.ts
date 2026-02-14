/**
 * Stripe Price ID mapping. Add these to .env.local:
 *
 * Business plans (recurring yearly):
 *   STRIPE_PRICE_STARTER, STRIPE_PRICE_GROWTH, STRIPE_PRICE_PREMIUM
 * Casual Seller Pack (recurring monthly/40-day):
 *   STRIPE_PRICE_CASUAL_PACK
 * Promotion banners (one-time, tier_duration):
 *   STRIPE_PRICE_PROMO_BASIC_14, STRIPE_PRICE_PROMO_BASIC_30, ...
 */

export const STRIPE_PRICES = {
  starter: process.env.STRIPE_PRICE_STARTER || '',
  growth: process.env.STRIPE_PRICE_GROWTH || '',
  premium: process.env.STRIPE_PRICE_PREMIUM || '',
  casualPack: process.env.STRIPE_PRICE_CASUAL_PACK || '',

  promotion: {
    basic: {
      14: process.env.STRIPE_PRICE_PROMO_BASIC_14 || '',
      30: process.env.STRIPE_PRICE_PROMO_BASIC_30 || '',
      90: process.env.STRIPE_PRICE_PROMO_BASIC_90 || '',
      180: process.env.STRIPE_PRICE_PROMO_BASIC_180 || '',
      365: process.env.STRIPE_PRICE_PROMO_BASIC_365 || '',
    },
    targeted: {
      14: process.env.STRIPE_PRICE_PROMO_TARGETED_14 || '',
      30: process.env.STRIPE_PRICE_PROMO_TARGETED_30 || '',
      90: process.env.STRIPE_PRICE_PROMO_TARGETED_90 || '',
      180: process.env.STRIPE_PRICE_PROMO_TARGETED_180 || '',
      365: process.env.STRIPE_PRICE_PROMO_TARGETED_365 || '',
    },
    premium: {
      14: process.env.STRIPE_PRICE_PROMO_PREMIUM_14 || '',
      30: process.env.STRIPE_PRICE_PROMO_PREMIUM_30 || '',
      90: process.env.STRIPE_PRICE_PROMO_PREMIUM_90 || '',
      180: process.env.STRIPE_PRICE_PROMO_PREMIUM_180 || '',
      365: process.env.STRIPE_PRICE_PROMO_PREMIUM_365 || '',
    },
  },
} as const;

export function getPromoPriceId(tier: 'basic' | 'targeted' | 'premium', durationDays: number): string {
  const d = [14, 30, 90, 180, 365].includes(durationDays) ? durationDays : 30;
  return STRIPE_PRICES.promotion[tier]?.[d as 14 | 30 | 90 | 180 | 365] || '';
}
