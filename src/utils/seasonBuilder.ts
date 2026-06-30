/**
 * Build a ConferenceState from schedule data + user-selected game outcomes.
 *
 * This converts the schedules.json data into the types needed by the
 * client-side tiebreaker resolver.
 */

import type { Schedules, ConferenceState, TeamRecord, SeasonTeams } from '../types';
import { isConferenceGame } from './conferenceGame';

/**
 * Identifies remaining conference games from the schedule data.
 * Returns an array of { gameKey, awayTeam, homeTeam, date, awayWinProb } objects.
 */
export interface RemainingGame {
  gameKey: string;
  awayTeam: string;
  homeTeam: string;
  date: string;
  awayWinProb: number;
  neutral: boolean;
}

export function getRemainingConferenceGames(
  schedules: Schedules,
  conference: string,
  teams: SeasonTeams,
  season: string = '2025',
): RemainingGame[] {
  const confTeams = new Set(teams.conferences[conference]?.teams ?? []);
  const seen = new Set<string>();
  const games: RemainingGame[] = [];

  for (const teamName of confTeams) {
    const teamSchedule = schedules.teams[teamName];
    if (!teamSchedule) continue;
    for (const game of teamSchedule.games) {
      if (game.is_complete) continue;
      if (!isConferenceGame(teamName, game.opponent, confTeams, season)) continue;
      const sortedPair = [teamName, game.opponent].sort().join('_vs_');
      if (seen.has(sortedPair)) continue;
      seen.add(sortedPair);

      // Determine away/home
      const awayTeam = game.is_home ? game.opponent : teamName;
      const homeTeam = game.is_home ? teamName : game.opponent;

      // Get away team's win probability
      const awayWinProb = game.is_home
        ? 1 - (game.win_probability ?? 0.5)
        : (game.win_probability ?? 0.5);

      games.push({
        gameKey: `${awayTeam}_vs_${homeTeam}`,
        awayTeam,
        homeTeam,
        date: game.date,
        awayWinProb,
        neutral: game.neutral,
      });
    }
  }

  games.sort((a, b) => a.date.localeCompare(b.date) || a.awayTeam.localeCompare(b.awayTeam));
  return games;
}

/**
 * Build a ConferenceState with all games resolved using the provided
 * game outcome selections. Completed games come from schedule data;
 * remaining games use the user's selections.
 *
 * @param selectedWinners - Record<gameKey, winnerName> for ALL remaining conference games
 */
export function buildConferenceState(
  schedules: Schedules,
  conference: string,
  teams: SeasonTeams,
  selectedWinners: Record<string, string>,
  season: string = '2025',
): ConferenceState {
  const confTeamNames = new Set(teams.conferences[conference]?.teams ?? []);

  const teamRecords = new Map<string, TeamRecord>();

  // Initialize team records
  for (const teamName of confTeamNames) {
    teamRecords.set(teamName, { name: teamName, conference, games: [] });
  }

  // Track which games we've already added (to avoid duplicates)
  const addedGames = new Set<string>();

  for (const teamName of confTeamNames) {
    const teamSchedule = schedules.teams[teamName];
    if (!teamSchedule) continue;
    const record = teamRecords.get(teamName)!;

    for (const game of teamSchedule.games) {
      // Only include conference games
      if (!isConferenceGame(teamName, game.opponent, confTeamNames, season)) continue;

      const pairKey = [teamName, game.opponent].sort().join('|');
      if (addedGames.has(pairKey)) continue;

      if (game.is_complete) {
        // Completed game — use actual result
        addedGames.add(pairKey);
        record.games.push({
          opponent: game.opponent,
          won: game.won ?? false,
          pointsFor: game.points_for,
          pointsAgainst: game.points_against,
          neutral: game.neutral,
          isConference: true,
        });
        // Also add to opponent's record
        const oppRecord = teamRecords.get(game.opponent);
        if (oppRecord) {
          oppRecord.games.push({
            opponent: teamName,
            won: !(game.won ?? false),
            pointsFor: game.points_against,
            pointsAgainst: game.points_for,
            neutral: game.neutral,
            isConference: true,
          });
        }
      } else {
        // Future game — look up in selectedWinners
        const awayTeam = game.is_home ? game.opponent : teamName;
        const homeTeam = game.is_home ? teamName : game.opponent;
        const gameKey = `${awayTeam}_vs_${homeTeam}`;

        const winner = selectedWinners[gameKey];
        if (winner == null) continue; // Unresolved — skip

        addedGames.add(pairKey);
        const teamWon = winner === teamName;
        record.games.push({
          opponent: game.opponent,
          won: teamWon,
          neutral: game.neutral,
          isConference: true,
        });
        const oppRecord = teamRecords.get(game.opponent);
        if (oppRecord) {
          oppRecord.games.push({
            opponent: teamName,
            won: !teamWon,
            neutral: game.neutral,
            isConference: true,
          });
        }
      }
    }
  }

  return {
    name: conference,
    teamNames: confTeamNames,
    teams: teamRecords,
  };
}

/**
 * Calculate the probability of the user's selected combination occurring.
 */
export function selectionProbability(
  remainingGames: RemainingGame[],
  selectedWinners: Record<string, string>,
): number {
  let prob = 1;
  for (const game of remainingGames) {
    const winner = selectedWinners[game.gameKey];
    if (winner == null) continue;
    if (winner === game.awayTeam) {
      prob *= game.awayWinProb;
    } else {
      prob *= 1 - game.awayWinProb;
    }
  }
  return prob;
}

/**
 * Auto-fill all unselected games with the higher-probability team.
 */
export function fillWithFavorites(
  remainingGames: RemainingGame[],
  selectedWinners: Record<string, string>,
): Record<string, string> {
  const result = { ...selectedWinners };
  for (const game of remainingGames) {
    if (result[game.gameKey] != null) continue;
    result[game.gameKey] = game.awayWinProb >= 0.5 ? game.awayTeam : game.homeTeam;
  }
  return result;
}
