import { useState, useEffect, useCallback } from 'react';
import type {
  DataIndex,
  SeasonTeams,
  ConferenceProbabilities,
  CCGMatchups,
  EveryOutcome,
  Schedules,
  WeekImpact,
  TiebreakerData,
  LossScenarioData,
  TimelineData,
} from '../types';
import type { DatesConfig } from '../utils/dateUtils';
import { loadManifest, resolveUrl } from '../utils/dataUrl';

interface UseConferenceDataResult {
  index: DataIndex | null;
  teams: SeasonTeams | null;
  schedules: Schedules | null;
  probabilities: ConferenceProbabilities | null;
  matchups: CCGMatchups | null;
  everyOutcome: EveryOutcome | null;
  weekImpact: WeekImpact | null;
  tiebreakers: TiebreakerData | null;
  lossScenarios: LossScenarioData | null;
  timeline: TimelineData | null;
  loading: boolean;
  error: string | null;
  currentDate: string | null;
  latestDate: string | null;
  datesConfig: DatesConfig | null;
  availableDates: string[];
  loadConference: (sport: string, season: string, conference: string, date?: string) => Promise<void>;
}

export function useConferenceData(): UseConferenceDataResult {
  const [index, setIndex] = useState<DataIndex | null>(null);
  const [teams, setTeams] = useState<SeasonTeams | null>(null);
  const [schedules, setSchedules] = useState<Schedules | null>(null);
  const [probabilities, setProbabilities] = useState<ConferenceProbabilities | null>(null);
  const [matchups, setMatchups] = useState<CCGMatchups | null>(null);
  const [everyOutcome, setEveryOutcome] = useState<EveryOutcome | null>(null);
  const [weekImpact, setWeekImpact] = useState<WeekImpact | null>(null);
  const [tiebreakers, setTiebreakers] = useState<TiebreakerData | null>(null);
  const [lossScenarios, setLossScenarios] = useState<LossScenarioData | null>(null);
  const [timeline, setTimeline] = useState<TimelineData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState<string | null>(null);
  const [latestDate, setLatestDate] = useState<string | null>(null);
  const [datesConfig, setDatesConfig] = useState<DatesConfig | null>(null);
  const [availableDates, setAvailableDates] = useState<string[]>([]);

  // Load the master index on mount (optional - may not exist)
  useEffect(() => {
    async function loadIndex() {
      try {
        const res = await fetch(resolveUrl(await loadManifest(), 'index.json'));
        if (!res.ok) {
          // Index doesn't exist yet, that's okay
          return;
        }
        // Check content-type to avoid parsing HTML as JSON
        const contentType = res.headers.get('content-type');
        if (!contentType?.includes('application/json')) {
          // Got HTML instead of JSON (404 page), just skip
          return;
        }
        const data = await res.json();
        setIndex(data);
      } catch (err) {
        // Index might not exist yet, that's okay - silently ignore
      }
    }
    loadIndex();
  }, []);

  const loadConference = useCallback(async (
    sport: string,
    season: string,
    conference: string,
    date?: string
  ) => {
    setLoading(true);
    setError(null);

    try {
      const manifest = await loadManifest();
      const r = (path: string) => resolveUrl(manifest, path);

      // If no date provided, fetch the latest date from dates.json
      let datePath = date;
      if (!datePath) {
        const datesRes = await fetch(r(`${sport}/${season}/dates.json`));
        if (datesRes.ok) {
          const contentType = datesRes.headers.get('content-type');
          if (contentType?.includes('application/json')) {
            const datesData: DatesConfig = await datesRes.json();
            datePath = datesData.latest_date;
            setAvailableDates(datesData.dates || []);
            setLatestDate(datesData.latest_date);
            setDatesConfig(datesData);
          }
        }
      } else {
        // Even when a specific date is requested, fetch dates.json to get metadata
        const datesRes = await fetch(r(`${sport}/${season}/dates.json`));
        if (datesRes.ok) {
          const contentType = datesRes.headers.get('content-type');
          if (contentType?.includes('application/json')) {
            const datesData: DatesConfig = await datesRes.json();
            setAvailableDates(datesData.dates || []);
            setLatestDate(datesData.latest_date);
            setDatesConfig(datesData);
          }
        }
      }

      if (!datePath) {
        throw new Error('No data available. Run a simulation with --export-json first.');
      }

      setCurrentDate(datePath);

      // Load all data in parallel
      // teams.json and schedules.json are at date level, other files are conference-specific
      const [teamsRes, schedulesRes, probsRes, matchupsRes, everyOutcomeRes] = await Promise.all([
        fetch(r(`${sport}/${season}/teams.json`)),
        fetch(r(`${sport}/${season}/${datePath}/schedules.json`)),
        fetch(r(`${sport}/${season}/${datePath}/${conference}_probabilities.json`)),
        fetch(r(`${sport}/${season}/${datePath}/${conference}_ccg_matchups.json`)),
        fetch(r(`${sport}/${season}/${datePath}/${conference}_every_outcome.json`)).catch(() => null),
      ]);

      // Also fetch optional data files in parallel
      const [weekImpactRes, tiebreakersRes, lossScenariosRes, timelineRes] = await Promise.all([
        fetch(r(`${sport}/${season}/${datePath}/${conference}_week_impact.json`)).catch(() => null),
        fetch(r(`${sport}/${season}/${datePath}/${conference}_tiebreakers.json`)).catch(() => null),
        fetch(r(`${sport}/${season}/${datePath}/${conference}_loss_scenarios.json`)).catch(() => null),
        fetch(r(`${sport}/${season}/${conference}_timeline.json`)).catch(() => null),
      ]);

      if (!teamsRes.ok) throw new Error('Failed to load teams');
      if (!schedulesRes.ok) throw new Error('Failed to load schedules');
      if (!probsRes.ok) throw new Error('Failed to load probabilities');
      if (!matchupsRes.ok) throw new Error('Failed to load matchups');

      const [teamsData, schedulesData, probsData, matchupsData] = await Promise.all([
        teamsRes.json(),
        schedulesRes.json(),
        probsRes.json(),
        matchupsRes.json(),
      ]);

      setTeams(teamsData);
      setSchedules(schedulesData);
      setProbabilities(probsData);
      setMatchups(matchupsData);

      // Every outcome is optional (only exists after running --all-outcomes)
      if (everyOutcomeRes?.ok) {
        // Check content-type to avoid parsing HTML as JSON
        const contentType = everyOutcomeRes.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          const everyOutcomeData = await everyOutcomeRes.json();
          setEveryOutcome(everyOutcomeData);
        } else {
          setEveryOutcome(null);
        }
      } else {
        setEveryOutcome(null);
      }

      // Week impact is optional
      if (weekImpactRes?.ok) {
        const ct = weekImpactRes.headers.get('content-type');
        if (ct?.includes('application/json')) {
          setWeekImpact(await weekImpactRes.json());
        } else {
          setWeekImpact(null);
        }
      } else {
        setWeekImpact(null);
      }

      // Tiebreakers are optional
      if (tiebreakersRes?.ok) {
        const ct = tiebreakersRes.headers.get('content-type');
        if (ct?.includes('application/json')) {
          setTiebreakers(await tiebreakersRes.json());
        } else {
          setTiebreakers(null);
        }
      } else {
        setTiebreakers(null);
      }

      // Loss scenarios are optional
      if (lossScenariosRes?.ok) {
        const ct = lossScenariosRes.headers.get('content-type');
        if (ct?.includes('application/json')) {
          setLossScenarios(await lossScenariosRes.json());
        } else {
          setLossScenarios(null);
        }
      } else {
        setLossScenarios(null);
      }

      // Timeline is optional
      if (timelineRes?.ok) {
        const ct = timelineRes.headers.get('content-type');
        if (ct?.includes('application/json')) {
          setTimeline(await timelineRes.json());
        } else {
          setTimeline(null);
        }
      } else {
        setTimeline(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    index,
    teams,
    schedules,
    probabilities,
    matchups,
    everyOutcome,
    weekImpact,
    tiebreakers,
    lossScenarios,
    timeline,
    loading,
    error,
    currentDate,
    latestDate,
    datesConfig,
    availableDates,
    loadConference,
  };
}
