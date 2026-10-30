// Types shared by Pricing.astro, to test that the component builder follows relative type imports

export const PLANS = ['starter', 'team', 'enterprise'] as const

export type Plan = (typeof PLANS)[number]

export type Currency = 'GBP' | 'USD' | 'EUR'
