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

export const KNOWN_CONFERENCES = ['B12', 'SEC', 'B10', 'ACC'];

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
  return `${sportYearPath(sport, year)}/${conference}`;
}

export function conferenceSubPath(
  conference: string,
  sub: 'what-if' | 'tiebreakers' | 'history',
  sport: string = DEFAULT_SPORT,
  year: string = CURRENT_SEASON,
): string {
  return `${conferencePath(conference, sport, year)}/${sub}`;
}

export function teamPath(
  conference: string,
  teamName: string,
  sport: string = DEFAULT_SPORT,
  year: string = CURRENT_SEASON,
): string {
  return `${conferencePath(conference, sport, year)}/team/${encodeURIComponent(teamName)}`;
}
