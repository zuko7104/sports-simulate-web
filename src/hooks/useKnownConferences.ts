import { useEffect, useState } from 'react';
import { dataUrl } from '../utils/dataUrl';
import { DEFAULT_SPORT, CURRENT_SEASON } from '../utils/routes';

/**
 * Fetches the set of valid conference/group codes for a sport/season from
 * teams.json, so URL validation (legacy redirects, nav "active conference"
 * detection) doesn't need a hardcoded conference list. Covers both
 * simulated conferences (B12, SEC, ...) and "basic" (no-simulation) groups
 * (FCS conferences, the 2025 Pac-12, independents).
 *
 * Returns a Map of conference code -> has_simulation (defaulting true when
 * absent, for backwards compatibility with older teams.json files) so
 * callers can both validate codes (`.has(code)`, same as a Set) and gate
 * simulation-only UI (`.get(code)`).
 *
 * Returns null while loading/unavailable, in which case callers should
 * treat validation as "unknown" rather than failing closed.
 */
export function useKnownConferences(
  sport: string = DEFAULT_SPORT,
  season: string = CURRENT_SEASON,
): Map<string, boolean> | null {
  const [conferences, setConferences] = useState<Map<string, boolean> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(dataUrl(`${sport}/${season}/teams.json`));
        if (!res.ok) return;
        const contentType = res.headers.get('content-type');
        if (!contentType?.includes('application/json')) return;
        const data = await res.json();
        if (!cancelled && data?.conferences) {
          setConferences(
            new Map(
              Object.entries(data.conferences).map(([code, meta]) => [
                code,
                (meta as { has_simulation?: boolean })?.has_simulation !== false,
              ]),
            ),
          );
        }
      } catch {
        // Network error or offline - leave as null, callers should
        // degrade gracefully rather than treat this as "no conferences".
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [sport, season]);

  return conferences;
}
