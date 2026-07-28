import type { WeekRankings } from '../types';
import { dataUrl } from './dataUrl';
import { snapshotWeekNumber } from './dateUtils';

export interface ResolvedRanking {
  rank: number;
  /** Which poll the shown ranking came from. */
  type: 'AP Poll' | 'CFP';
  /** The week the shown ranking actually came from - may be one week
   * behind the viewed week (see `stale`). */
  week: number;
  /** True when this ranking was pulled from the previous week because the
   * viewed week doesn't have one yet. */
  stale: boolean;
}

async function fetchWeekRankings(
  sport: string,
  season: string,
  weekNum: number,
): Promise<WeekRankings | null> {
  try {
    const res = await fetch(dataUrl(`${sport}/${season}/rankings/week_${weekNum}.json`));
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type');
    if (!contentType?.includes('application/json')) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Resolve each team's displayed ranking for the given viewed date, per the
 * priority order: current-week CFP, then previous-week CFP (stale), then
 * current-week AP, then previous-week AP (stale), else no ranking shown.
 *
 * "Current" week means the week being viewed, not necessarily the latest
 * available week - browsing a historical date resolves rankings relative
 * to that date's own week.
 */
export async function resolveRankings(
  sport: string,
  season: string,
  viewedDate: string,
  week1Start: string | undefined,
): Promise<Record<string, ResolvedRanking>> {
  if (!week1Start) return {};

  const weekNum = snapshotWeekNumber(viewedDate, week1Start);

  const [current, previous] = await Promise.all([
    fetchWeekRankings(sport, season, weekNum),
    weekNum > 1 ? fetchWeekRankings(sport, season, weekNum - 1) : Promise.resolve(null),
  ]);

  const chosen: { poll: import('../types').PollSnapshot; type: 'AP Poll' | 'CFP'; week: number; stale: boolean } | null =
    current?.cfp
      ? { poll: current.cfp, type: 'CFP', week: weekNum, stale: false }
      : previous?.cfp
      ? { poll: previous.cfp, type: 'CFP', week: weekNum - 1, stale: true }
      : current?.ap
      ? { poll: current.ap, type: 'AP Poll', week: weekNum, stale: false }
      : previous?.ap
      ? { poll: previous.ap, type: 'AP Poll', week: weekNum - 1, stale: true }
      : null;

  if (!chosen) return {};

  const result: Record<string, ResolvedRanking> = {};
  for (const row of chosen.poll.ranks) {
    result[row.team] = { rank: row.rank, type: chosen.type, week: chosen.week, stale: chosen.stale };
  }
  return result;
}
