import { useEffect, useState } from 'react';
import { dataUrl } from '../utils/dataUrl';
import type { TiebreakerData } from '../types';

/**
 * Whether the given conference/date has any tiebreaker scenarios to show.
 * Fetches its own minimal data (Navigation lives outside the routed page
 * tree, so it can't reuse a page's already-loaded state), mirroring the
 * `useIsWithinFlowchartWindow` pattern.
 */
export function useHasTiebreakerData(
  sport: string,
  season: string,
  conference: string | null,
  referenceDate?: string,
): boolean {
  const [hasData, setHasData] = useState(false);

  useEffect(() => {
    if (!conference) return;
    let cancelled = false;

    async function load() {
      try {
        let datePath = referenceDate;
        if (!datePath) {
          const datesRes = await fetch(dataUrl(`${sport}/${season}/dates.json`));
          if (!datesRes.ok) return;
          const datesData = await datesRes.json();
          datePath = datesData.latest_date;
        }
        if (!datePath) return;

        const res = await fetch(dataUrl(`${sport}/${season}/${datePath}/${conference}_tiebreakers.json`));
        if (!res.ok) {
          if (!cancelled) setHasData(false);
          return;
        }
        const contentType = res.headers.get('content-type');
        if (!contentType?.includes('application/json')) {
          if (!cancelled) setHasData(false);
          return;
        }
        const data: TiebreakerData = await res.json();
        if (!cancelled) setHasData((data?.scenarios?.length ?? 0) > 0);
      } catch {
        if (!cancelled) setHasData(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [sport, season, conference, referenceDate]);

  return Boolean(conference) && hasData;
}
