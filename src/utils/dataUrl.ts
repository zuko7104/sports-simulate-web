/**
 * Resolves logical data paths to their actual CDN URLs via a manifest.
 *
 * publish_data.py uploads data files to GitHub Releases on sports-simulate-web,
 * then follows each browser_download_url redirect to get the final
 * objects.githubusercontent.com URL (which has Access-Control-Allow-Origin: *).
 * It writes those resolved URLs to web/public/data-manifest.json, which is
 * committed and served from the same origin as the app (CORS-free).
 *
 * On first data fetch, the app loads data-manifest.json (same-origin, small),
 * then resolves all subsequent requests through the CDN URLs in the manifest.
 * If the manifest is missing or a path isn't listed, falls back to a relative
 * URL under BASE_URL (works during local development).
 */

const MANIFEST_URL = `${import.meta.env.BASE_URL}data-manifest.json`;

let _manifest: Record<string, string> | null = null;
let _loading: Promise<Record<string, string>> | null = null;

export async function loadManifest(): Promise<Record<string, string>> {
  if (_manifest) return _manifest;
  if (!_loading) {
    _loading = fetch(MANIFEST_URL)
      .then(r => {
        if (!r.ok) return {} as Record<string, string>;
        const ct = r.headers.get('content-type');
        if (!ct?.includes('application/json')) return {} as Record<string, string>;
        return r.json() as Promise<Record<string, string>>;
      })
      .then(data => { _manifest = data; return data; })
      .catch(() => { _manifest = {}; return _manifest!; });
  }
  return _loading;
}

/**
 * Resolve a logical data path (e.g. 'cfb/2025/dates.json') to a URL.
 * Uses the pre-loaded manifest; falls back to a relative path for local dev.
 */
export function resolveUrl(manifest: Record<string, string>, logicalPath: string): string {
  return manifest[logicalPath] ?? `${import.meta.env.BASE_URL}data/${logicalPath}`;
}
}
