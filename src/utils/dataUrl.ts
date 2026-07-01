/**
 * Resolves a logical data path to a URL.
 *
 * In production, data is served from a Cloudflare R2 public bucket with CORS
 * configured to allow requests from the GitHub Pages origin. This avoids the
 * CORS restrictions on GitHub Release assets.
 *
 * publish_data.py syncs web/public/data/ to the R2 bucket via rclone
 * (excluding every_outcome.json which is too large).
 *
 * The R2_BASE_URL Vite env var is set at build time by sports-simulate-web's
 * GitHub Actions workflow. Falls back to same-origin /data/ for local dev.
 *
 * Set in sports-simulate-web/.github/workflows/pages.yml:
 *   env:
 *     VITE_R2_BASE_URL: https://pub-xxxx.r2.dev  # sports-simulate-data bucket
 */

const R2_BASE =
  (import.meta.env.VITE_R2_BASE_URL as string | undefined)?.replace(/\/$/, '') ??
  `${import.meta.env.BASE_URL}data`;

export function dataUrl(logicalPath: string): string {
  return `${R2_BASE}/${logicalPath}`;
}
