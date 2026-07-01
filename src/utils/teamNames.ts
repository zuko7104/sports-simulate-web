/**
 * Returns a shortened version of a team display name for use in compact mobile layouts.
 * Examples:
 *   "Kansas State"      → "Kansas St."
 *   "Iowa State"        → "Iowa St."
 *   "West Virginia"     → "W. Virginia"
 *   "North Carolina"    → "N. Carolina"
 *   "Mississippi State" → "Mississippi St."
 *   "Alabama"           → "Alabama"
 */
export function shortTeamName(displayName: string): string {
  if (!displayName) return '';
  return displayName
    .replace(/\bNorth\b/, 'N.')
    .replace(/\bSouth\b/, 'S.')
    .replace(/\bWest\b/, 'W.')
    .replace(/\bEast\b/, 'E.')
    .replace(/\bState\b/, 'St.')
    .replace(/\bUniversity\b/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
