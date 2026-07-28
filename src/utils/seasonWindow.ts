import type { Schedules, SeasonTeams } from '../types';
import { isConferenceGame } from './conferenceGame';

/**
 * The last date a conference game is scheduled for a given conference —
 * i.e. the end of the regular-season conference slate. Used to decide when
 * the CCG flowchart/Ways to Lock feature is actually relevant (its what-if
 * data window doesn't carry a "days until season ends" concept on its own).
 */
export function getConferenceFinalGameDate(
  schedules: Schedules,
  conference: string,
  teams: SeasonTeams,
  season: string
): string | null {
  const conferenceTeamNames = teams.conferences[conference]?.teams ?? [];
  const conferenceTeamSet = new Set(conferenceTeamNames);

  let latest: string | null = null;
  for (const teamName of conferenceTeamNames) {
    const schedule = schedules.teams[teamName];
    if (!schedule) continue;
    for (const game of schedule.games) {
      if (!isConferenceGame(teamName, game.opponent, conferenceTeamSet, season)) continue;
      if (latest === null || game.date > latest) latest = game.date;
    }
  }
  return latest;
}

/**
 * Whether `today` falls within the final `weeks` weeks (default 1) leading
 * up to (and including) `finalDate`.
 */
export function isWithinFinalWeeks(finalDate: string | null, today: string, weeks = 1): boolean {
  if (!finalDate) return false;
  const final = new Date(finalDate + 'T12:00:00');
  const current = new Date(today + 'T12:00:00');
  const windowStart = new Date(final);
  windowStart.setDate(windowStart.getDate() - weeks * 7);
  return current >= windowStart && current <= final;
}
