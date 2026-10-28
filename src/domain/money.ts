/**
 * Money utilities — all domain values are integers (minor units / sen).
 * Conversion from the raw JSON only happens at the boundary (data ingestion).
 */

/**
 * Convert a decimal MYR amount (e.g. 13.90) to integer sen (1390).
 * Uses rounding to avoid floating-point drift.
 */
export function toMinorUnits(myr: number): number {
  return Math.round(myr * 100)
}

/**
 * Convert integer sen back to decimal MYR for display.
 */
export function fromMinorUnits(sen: number): number {
  return sen / 100
}

/**
 * Format an integer sen value as a human-readable MYR string.
 * e.g. 1390 → "MYR 13.90"
 */
export function formatMYR(sen: number): string {
  return new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency: 'MYR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(fromMinorUnits(sen))
}
