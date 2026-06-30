/**
 * Utility to determine if a game is a conference game.
 * Handles special cases like cancelled conference games.
 */

/**
 * Check if a game between a team and an opponent counts as a conference game.
 *
 * In 2025, Kansas St and Arizona had their conference game cancelled due to
 * the LA fires, so that matchup should not count as a conference game.
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

  // In 2025, Kansas St vs Arizona was cancelled and doesn't count
  if (season === '2025') {
    const pair = new Set([teamName, opponent]);
    if (pair.has('Kansas St') && pair.has('Arizona')) {
      return false;
    }
  }

  return true;
}
