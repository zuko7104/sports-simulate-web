/**
 * Resolves a logical data path to a GitHub Releases URL on sports-simulate-web.
 *
 * All simulation data is stored as release assets (no data files in the repo).
 * Slashes in the logical path are replaced with underscores to produce a flat
 * asset name, and the season determines the release tag.
 *
 * Examples:
 *   dataUrl('cfb/2025/dates.json')
 *     → …/data-2025/cfb_2025_dates.json
 *
 *   dataUrl('cfb/2025/2025-11-16/B12_probabilities.json')
 *     → …/data-2025/cfb_2025_2025-11-16_B12_probabilities.json
 *
 *   dataUrl('cfb/2025/B12_timeline.json')
 *     → …/data-2025/cfb_2025_B12_timeline.json
 *
 *   dataUrl('index.json')
 *     → …/data-meta/index.json
 *
 * Upload convention (run by the weekly simulation job):
 *   gh release upload data-2025 cfb_2025_2025-11-16_B12_probabilities.json \
 *     --clobber --repo zuko7104/sports-simulate-web
 */

const RELEASES_BASE =
  'https://github.com/zuko7104/sports-simulate-web/releases/download';

export function dataUrl(logicalPath: string): string {
  const parts = logicalPath.split('/');

  if (parts.length < 2) {
    // Top-level files (e.g. index.json) go in the data-meta release.
    return `${RELEASES_BASE}/data-meta/${logicalPath}`;
  }

  // parts[1] is the season, e.g. '2025' from 'cfb/2025/...'
  const season = parts[1];
  const assetName = parts.join('_'); // 'cfb_2025_dates.json'
  return `${RELEASES_BASE}/data-${season}/${assetName}`;
}
