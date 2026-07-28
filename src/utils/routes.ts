/**
 * Centralized route path builders for the app's URL structure:
 *
 *   /<sport>/<year>/<conference>/team/<teamName>
 *
 * e.g. /cfb/2025/B12/team/BYU
 *
 * DEFAULT_SPORT and CURRENT_SEASON are used as fallbacks by components that
 * don't have sport/year available from the URL (e.g. leaf components that
 * only know about a conference and a team name).
 */

export const DEFAULT_SPORT = 'cfb';
export const CURRENT_SEASON = '2025';

// Valid conference/group codes are no longer a static list - they're
// derived dynamically from teams.json's `conferences` dict (which includes
// both simulated conferences and "basic" no-simulation groups like FCS
// conferences, the Pac-12, and independents). See useKnownConferences.ts.

export const SPORT_DISPLAY_NAMES: Record<string, string> = {
  cfb: 'CFB',
};

export function sportDisplayName(sport: string): string {
  return SPORT_DISPLAY_NAMES[sport] ?? sport.toUpperCase();
}

export function sportYearPath(
  sport: string = DEFAULT_SPORT,
  year: string = CURRENT_SEASON,
): string {
  return `/${sport}/${year}`;
}

export function conferencePath(
  conference: string,
  sport: string = DEFAULT_SPORT,
  year: string = CURRENT_SEASON,
): string {
  return `${sportYearPath(sport, year)}/${encodeURIComponent(conference)}`;
}

export function conferenceSubPath(
  conference: string,
  sub: 'what-if' | 'tiebreakers' | 'flowchart',
  sport: string = DEFAULT_SPORT,
  year: string = CURRENT_SEASON,
): string {
  return `${conferencePath(conference, sport, year)}/${sub}`;
}

/**
 * Path to navigate to when switching to `conference` from a simulation-only
 * sub-page (What-If, Tiebreakers, Flowchart). If the destination
 * conference has no simulation, those sub-pages have nothing to show, so
 * this falls back to the conference's overview page instead - mirroring the
 * same has_simulation gating the top nav uses to hide those tabs.
 */
export function conferenceSwitchPath(
  conference: string,
  sub: 'what-if' | 'tiebreakers' | 'flowchart',
  hasSimulation: boolean,
  sport: string = DEFAULT_SPORT,
  year: string = CURRENT_SEASON,
): string {
  return hasSimulation
    ? conferenceSubPath(conference, sub, sport, year)
    : conferencePath(conference, sport, year);
}

export function teamPath(
  conference: string,
  teamName: string,
  sport: string = DEFAULT_SPORT,
  year: string = CURRENT_SEASON,
): string {
  return `${conferencePath(conference, sport, year)}/team/${encodeURIComponent(teamName)}`;
}
