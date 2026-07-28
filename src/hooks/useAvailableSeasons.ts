import { useEffect, useState } from 'react';
import { dataUrl } from '../utils/dataUrl';
import type { DatesConfig } from '../utils/dateUtils';
import { CURRENT_SEASON } from '../utils/routes';

// How many seasons before the current one to probe for data. Combined with
// `year` (the season actually being viewed, which may be further back than
// this window), this keeps the year list self-maintaining across seasons
// without a hardcoded year list to update every year.
const LOOKBACK_YEARS = 5;

export interface SeasonDates {
  year: string;
  config: DatesConfig;
}

/**
 * Fetches dates.json for every season that plausibly has data: the season
 * currently being viewed, plus a lookback window from the current season.
 * Fetches its own data (Navigation lives outside the routed page tree, so it
 * can't reuse a page's already-loaded state), mirroring the
 * `useIsWithinFlowchartWindow`/`useHasTiebreakerData` pattern.
 *
 * Returned seasons are ordered with the viewed `year` first, then the rest
 * in reverse chronological order - matching how the week/year dropdown
 * should list them.
 */
export function useAvailableSeasons(sport: string, year: string): SeasonDates[] {
  const [seasons, setSeasons] = useState<SeasonDates[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const base = parseInt(CURRENT_SEASON, 10);
      const viewed = parseInt(year, 10);
      const candidateYears = new Set<string>();
      for (let i = 0; i <= LOOKBACK_YEARS; i++) candidateYears.add(String(base - i));
      if (!Number.isNaN(viewed)) candidateYears.add(String(viewed));

      const results = await Promise.all(
        Array.from(candidateYears).map(async (y): Promise<SeasonDates | null> => {
          try {
            const res = await fetch(dataUrl(`${sport}/${y}/dates.json`));
            if (!res.ok) return null;
            const contentType = res.headers.get('content-type');
            if (!contentType?.includes('application/json')) return null;
            const config: DatesConfig = await res.json();
            return { year: y, config };
          } catch {
            return null;
          }
        }),
      );

      if (cancelled) return;

      const found = results.filter((r): r is SeasonDates => r !== null);
      found.sort((a, b) => {
        if (a.year === year) return -1;
        if (b.year === year) return 1;
        return Number(b.year) - Number(a.year);
      });
      setSeasons(found);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [sport, year]);

  return seasons;
}
