/**
 * Format a probability (0–1) as a percentage string with one decimal place.
 * - Exact 0 → '-'
 * - > 0 but < 0.001 → '< 0.1%'
 * - Exact 1 → '100%'
 * - Would round to 100% but isn't → '99.9%'
 * - Otherwise → e.g. '34.7%'
 */
export function formatProbability(prob: number): string {
  if (prob <= 0) return '-';
  if (prob < 0.001) return '< 0.1%';
  if (prob >= 1) return '100%';
  if (prob >= 0.9995) return '99.9%';
  return `${(prob * 100).toFixed(1)}%`;
}
