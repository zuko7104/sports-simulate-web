/**
 * Utility to determine if a game is a conference game.
 * Handles special cases like pre-existing non-conference series between
 * conference members.
 */

// Pre-existing bilateral non-conference series between two Big 12 members,
// honored across realignment for contractual reasons rather than absorbed
// into the conference schedule. These games are real and played, but don't
// count as conference games. Keyed by season since these are typically
// short-lived scheduling leftovers (mirrors the Python-side
// `_EXEMPT_NON_CONFERENCE_PAIRS` in sports/season.py).
export const EXEMPT_NON_CONFERENCE_PAIRS: Record<string, [string, string][]> = {
  '2024': [['Baylor', 'Utah']],
  '2025': [['Kansas St', 'Arizona']],
};

/**
 * Check if a game between a team and an opponent counts as a conference game.
 */
export function isConferenceGame(
  teamName: string,
  opponent: string,
  conferenceTeamSet: Set<string>,
  season: string
): boolean {
  // First check if opponent is even in the conference
  if (!conferenceTeamSet.has(opponent)) {
    return false;
  }

  const exemptPairs = EXEMPT_NON_CONFERENCE_PAIRS[season] ?? [];
  const pair = new Set([teamName, opponent]);
  for (const [a, b] of exemptPairs) {
    if (pair.has(a) && pair.has(b)) {
      return false;
    }
  }

  return true;
}
