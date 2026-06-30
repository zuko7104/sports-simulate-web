import { useMemo } from 'react';
import type { EveryOutcome, GameResult, TeamProbabilities } from '../types';
import { isConferenceGame } from '../utils/conferenceGame';

interface FutureOutcomesProps {
  teamName: string;
  probabilities: TeamProbabilities;
  currentWins: number;
  currentLosses: number;
  currentConfWins: number;
  currentConfLosses: number;
  remainingGames: GameResult[];
  everyOutcome: EveryOutcome | null;
  conferenceTeams: string[];
  teamColor?: string;
  season: string;
}

interface OutcomeRow {
  label: string;
  numLosses: number;
  finalRecord: string;
  confRecord: string;
  likelihood: number;
  ccgProb: number;
  isWinOut: boolean;
  isLoseOut: boolean;
  isAggregate: boolean;
}

/**
 * Find the game key in everyOutcome that involves this team and opponent.
 */
function findGameKey(
  teamName: string,
  opponent: string,
  everyOutcome: EveryOutcome
): string | null {
  const key1 = `${teamName}_vs_${opponent}`;
  const key2 = `${opponent}_vs_${teamName}`;

  if (key1 in everyOutcome.game_probabilities) return key1;
  if (key2 in everyOutcome.game_probabilities) return key2;

  return null;
}

/**
 * Generate all combinations of losses from a list of opponents.
 */
function generateLossCombinations(opponents: string[]): string[][] {
  const result: string[][] = [];
  const n = opponents.length;

  for (let mask = 0; mask < (1 << n); mask++) {
    const losses: string[] = [];
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) {
        losses.push(opponents[i]);
      }
    }
    result.push(losses);
  }

  result.sort((a, b) => {
    if (a.length !== b.length) return a.length - b.length;
    return a.join(',').localeCompare(b.join(','));
  });

  return result;
}

/**
 * Calculate the CCG probability for a specific set of losses.
 * The likelihood is calculated separately from just the team's game probabilities.
 */
function calculateCCGProbForOutcome(
  teamName: string,
  lossOpponents: Set<string>,
  remainingGames: GameResult[],
  everyOutcome: EveryOutcome
): number {
  let totalWeight = 0;
  let weightedCCGProb = 0;

  const gameKeyMap = new Map<string, string>();
  for (const game of remainingGames) {
    const gameKey = findGameKey(teamName, game.opponent, everyOutcome);
    if (gameKey) {
      gameKeyMap.set(game.opponent, gameKey);
    }
  }

  for (const [scenarioKey, scenario] of Object.entries(everyOutcome.scenarios)) {
    let matches = true;
    for (const game of remainingGames) {
      const gameKey = gameKeyMap.get(game.opponent);
      if (!gameKey) continue;

      const gameOutcome = scenario.game_outcomes[gameKey];
      if (!gameOutcome) continue;

      const teamWonGame = gameOutcome === teamName;
      const shouldLose = lossOpponents.has(game.opponent);

      if (teamWonGame === shouldLose) {
        matches = false;
        break;
      }
    }

    if (!matches) continue;

    const winners = scenarioKey.split(',');
    let scenarioProb = 1;
    everyOutcome.remaining_games.forEach(([awayTeam, homeTeam]) => {
      const gKey = `${awayTeam}_vs_${homeTeam}`;
      const awayWinProb = everyOutcome.game_probabilities[gKey] ?? 0.5;
      const awayWon = winners.includes(awayTeam);
      scenarioProb *= awayWon ? awayWinProb : (1 - awayWinProb);
    });

    totalWeight += scenarioProb;
    weightedCCGProb += scenarioProb * (scenario.ccg_probabilities[teamName] ?? 0);
  }

  return totalWeight > 0 ? weightedCCGProb / totalWeight : 0;
}

/**
 * Calculate the likelihood of a specific outcome based only on this team's game probabilities.
 */
function calculateOutcomeLikelihood(
  lossOpponents: Set<string>,
  remainingGames: GameResult[]
): number {
  let likelihood = 1;
  for (const game of remainingGames) {
    const winProb = game.win_probability ?? 0.5;
    const shouldLose = lossOpponents.has(game.opponent);
    likelihood *= shouldLose ? (1 - winProb) : winProb;
  }
  return likelihood;
}

export function FutureOutcomes({
  teamName,
  probabilities,
  currentWins,
  currentLosses,
  currentConfWins,
  currentConfLosses,
  remainingGames,
  everyOutcome,
  conferenceTeams,
  teamColor = '#3b82f6',
  season,
}: FutureOutcomesProps) {
  const remainingCount = remainingGames.length;
  const conferenceTeamSet = useMemo(() => new Set(conferenceTeams), [conferenceTeams]);

  // Calculate all outcome combinations
  const outcomeRows = useMemo(() => {
    if (!everyOutcome || remainingCount === 0) return [];

    const opponents = remainingGames.map((g) => g.opponent);
    const combinations = generateLossCombinations(opponents);

    // Specific outcome rows
    const specificRows: OutcomeRow[] = combinations.map((lossOpponents) => {
      const lossSet = new Set(lossOpponents);
      const numLosses = lossOpponents.length;
      const numWins = remainingCount - numLosses;

      // Calculate conference record changes
      const confLossesInScenario = lossOpponents.filter((opp) =>
        isConferenceGame(teamName, opp, conferenceTeamSet, season)
      ).length;
      const confGamesRemaining = remainingGames.filter((g) =>
        isConferenceGame(teamName, g.opponent, conferenceTeamSet, season)
      ).length;
      const confWinsInScenario = confGamesRemaining - confLossesInScenario;

      let label: string;
      if (numLosses === 0) {
        label = 'Win out';
      } else if (numLosses === remainingCount) {
        label = 'Lose out';
      } else if (numLosses === 1) {
        label = `Lose only to ${lossOpponents[0]}`;
      } else {
        label = `Lose only to ${lossOpponents.join(', ')}`;
      }

      // Calculate likelihood from this team's game probabilities only
      const likelihood = calculateOutcomeLikelihood(lossSet, remainingGames);

      // Calculate CCG probability weighted by other teams' game outcomes
      const ccgProb = calculateCCGProbForOutcome(
        teamName,
        lossSet,
        remainingGames,
        everyOutcome
      );

      const totalWins = currentWins + numWins;
      const totalLosses = currentLosses + numLosses;
      const finalConfWins = currentConfWins + confWinsInScenario;
      const finalConfLosses = currentConfLosses + confLossesInScenario;

      return {
        label,
        numLosses,
        finalRecord: `${totalWins}-${totalLosses}`,
        confRecord: `${finalConfWins}-${finalConfLosses}`,
        likelihood,
        ccgProb,
        isWinOut: numLosses === 0,
        isLoseOut: numLosses === remainingCount,
        isAggregate: false,
      };
    });

    // Create aggregate rows for each unique final record
    const recordGroups = new Map<string, OutcomeRow[]>();
    for (const row of specificRows) {
      const key = row.finalRecord;
      if (!recordGroups.has(key)) {
        recordGroups.set(key, []);
      }
      recordGroups.get(key)!.push(row);
    }

    // Build aggregate rows (only if there's more than one specific row for that record)
    const aggregateRows: OutcomeRow[] = [];
    for (const [record, rows] of recordGroups.entries()) {
      if (rows.length > 1) {
        const totalLikelihood = rows.reduce((sum, r) => sum + r.likelihood, 0);

        // Use the pre-computed CCG probability from simulation data for accuracy
        const precomputedCCG = probabilities.ccg_probability_by_record?.[record] ?? 0;

        // For conference record, show the range if different
        const confRecords = [...new Set(rows.map((r) => r.confRecord))];
        const confRecordLabel =
          confRecords.length === 1 ? confRecords[0] : confRecords.join(' or ');

        const numLosses = rows[0].numLosses;
        aggregateRows.push({
          label: `Any ${record} finish`,
          numLosses,
          finalRecord: record,
          confRecord: confRecordLabel,
          likelihood: totalLikelihood,
          ccgProb: precomputedCCG,
          isWinOut: false,
          isLoseOut: false,
          isAggregate: true,
        });
      }
    }

    // Combine and sort: aggregate row first, then specific rows, grouped by numLosses
    const allRows: OutcomeRow[] = [];
    for (let losses = 0; losses <= remainingCount; losses++) {
      const aggregateForLosses = aggregateRows.filter((r) => r.numLosses === losses);
      const specificForLosses = specificRows.filter((r) => r.numLosses === losses);

      // Add aggregate row first if it exists
      allRows.push(...aggregateForLosses);
      // Then add specific rows
      allRows.push(...specificForLosses);
    }

    return allRows;
  }, [
    teamName,
    probabilities,
    remainingGames,
    everyOutcome,
    currentWins,
    currentLosses,
    currentConfWins,
    currentConfLosses,
    remainingCount,
    conferenceTeamSet,
    season,
  ]);

  if (remainingCount === 0) {
    return null;
  }

  const hasAnyCCGChance = outcomeRows.some((o) => o.ccgProb > 0);

  let lastNumLosses = -1;

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        {hasAnyCCGChance
          ? 'Championship probability for each combination of remaining game outcomes'
          : 'Final record probabilities for each combination of remaining game outcomes'}
      </p>

      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">
                Scenario
              </th>
              <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">
                Record
              </th>
              <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">
                Conf
              </th>
              <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">
                Likelihood
              </th>
              {hasAnyCCGChance && (
                <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">
                  CCG Prob
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {outcomeRows.map((row, idx) => {
              const showDivider = row.numLosses !== lastNumLosses && idx > 0;
              lastNumLosses = row.numLosses;

              return (
                <tr
                  key={`${row.label}-${idx}`}
                  className={`border-b ${showDivider ? 'border-gray-300' : 'border-gray-100'} ${
                    row.isAggregate ? 'bg-gray-50' : ''
                  }`}
                >
                  <td className="py-2 px-3">
                    <span
                      className={`text-sm ${
                        row.isAggregate
                          ? 'font-semibold text-gray-800'
                          : row.isWinOut
                          ? 'font-medium text-green-600'
                          : row.isLoseOut
                          ? 'font-medium text-red-600'
                          : 'text-gray-700'
                      }`}
                    >
                      {row.isAggregate ? '▸ ' : ''}
                      {row.label}
                    </span>
                  </td>
                  <td className="py-2 px-3">
                    <span className="font-mono text-sm font-semibold">
                      {row.finalRecord}
                    </span>
                  </td>
                  <td className="py-2 px-3">
                    <span className="font-mono text-sm text-gray-600">
                      {row.confRecord}
                    </span>
                  </td>
                  <td className="py-2 px-3 w-32">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${row.likelihood * 100}%`,
                            backgroundColor: row.isAggregate ? '#6b7280' : '#9ca3af',
                          }}
                        />
                      </div>
                      <span className="text-xs font-mono text-gray-500 w-12 text-right">
                        {(row.likelihood * 100).toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  {hasAnyCCGChance && (
                    <td className="py-2 px-3 w-40">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${row.ccgProb * 100}%`,
                              backgroundColor: row.ccgProb > 0 ? teamColor : '#d1d5db',
                            }}
                          />
                        </div>
                        <span
                          className={`text-sm font-mono w-14 text-right ${
                            row.ccgProb >= 0.5
                              ? 'text-green-600 font-semibold'
                              : row.ccgProb > 0
                              ? 'text-gray-700'
                              : 'text-gray-400'
                          }`}
                        >
                          {row.ccgProb > 0 ? `${(row.ccgProb * 100).toFixed(1)}%` : '—'}
                        </span>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-gray-500 space-y-1">
        <p>
          <strong>▸ Aggregate rows:</strong> Combined probability for any path to that record.
        </p>
        <p>
          <strong>Likelihood:</strong> Probability of this outcome based on game win probabilities.
        </p>
        {hasAnyCCGChance && (
          <p>
            <strong>CCG Prob:</strong> If this outcome occurs, the probability of making the championship.
          </p>
        )}
      </div>
    </div>
  );
}
