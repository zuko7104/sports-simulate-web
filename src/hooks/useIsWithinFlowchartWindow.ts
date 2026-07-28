import { useEffect, useState } from 'react';
import { dataUrl } from '../utils/dataUrl';
import { getConferenceFinalGameDate, isWithinFinalWeeks } from '../utils/seasonWindow';
import type { SeasonTeams, Schedules } from '../types';

/**
 * Whether the CCG flowchart/Ways to Lock feature is currently relevant for
 * a conference — i.e. whether `referenceDate` (or, if omitted, the latest
 * available date) falls within the final week of that conference's
 * regular-season slate. Fetches its own minimal teams.json/schedules.json
 * (Navigation lives outside the routed page tree, so it can't reuse a
 * page's already-loaded `useConferenceData` state), mirroring the existing
 * `useKnownConferences` pattern.
 */
export function useIsWithinFlowchartWindow(
  sport: string,
  season: string,
  conference: string | null,
  referenceDate?: string,
): boolean {
  const [isWithin, setIsWithin] = useState(false);

  useEffect(() => {
    if (!conference) return;
    const conf: string = conference;
    let cancelled = false;

    async function load() {
      try {
        const teamsRes = await fetch(dataUrl(`${sport}/${season}/teams.json`));
        if (!teamsRes.ok) return;
        const teams: SeasonTeams = await teamsRes.json();

        let datePath = referenceDate;
        if (!datePath) {
          const datesRes = await fetch(dataUrl(`${sport}/${season}/dates.json`));
          if (!datesRes.ok) return;
          const datesData = await datesRes.json();
          datePath = datesData.latest_date;
        }
        if (!datePath) return;

        const schedulesRes = await fetch(dataUrl(`${sport}/${season}/${datePath}/schedules.json`));
        if (!schedulesRes.ok) return;
        const schedules: Schedules = await schedulesRes.json();

        const finalDate = getConferenceFinalGameDate(schedules, conf, teams, season);
        if (!cancelled) setIsWithin(isWithinFinalWeeks(finalDate, datePath));
      } catch {
        // Network error or offline - leave gated off rather than guess.
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [sport, season, conference, referenceDate]);

  return Boolean(conference) && isWithin;
}
