import { useMemo } from 'react';
import type { EveryOutcome } from '../types';

interface AggregatedProbabilities {
  ccg_probabilities: Record<string, number>;
  top_ccg_matchups: { teams: [string, string]; probability: number }[];
  matchingScenarios: number;
  totalScenarios: number;
}

interface GameInfo {
  gameKey: string;
  teams: [string, string];
  team1WinProb: number;
  date: string | null;
}

interface UseWhatIfResult {
  selectedWinners: Record<string, string>;
  setWinner: (game: string, winner: string) => void;
  clearSelections: () => void;
  probabilities: AggregatedProbabilities | null;
  remainingGames: [string, string][];
  gameInfos: GameInfo[];
  selectionProbability: number;  // Probability of the selected combination occurring
}

/**
 * Calculates the probability of a scenario occurring based on game probabilities.
 * For games already selected by the user, we use probability 1 (certain).
 * For unselected games, we use the actual game probabilities.
 */
function calculateScenarioWeight(
  scenario: { game_outcomes: Record<string, string> },
  gameProbabilities: Record<string, number>,
  selectedWinners: Record<string, string>,
  remainingGames: [string, string][]
): number {
  let weight = 1;

  for (const [team1, team2] of remainingGames) {
    const gameKey = `${team1}_vs_${team2}`;
    const winner = scenario.game_outcomes[gameKey];

    // Skip games the user has already selected (those are certain)
    if (gameKey in selectedWinners) {
      continue;
    }

    // Get the probability of team1 winning (from game_probabilities)
    const team1WinProb = gameProbabilities[gameKey] ?? 0.5;

    // Multiply by the probability of this outcome
    if (winner === team1) {
      weight *= team1WinProb;
    } else {
      weight *= 1 - team1WinProb;
    }
  }

  return weight;
}

/**
 * Aggregates probabilities across all scenarios that match the selected winners.
 * Scenarios are weighted by their probability of occurring based on game win probabilities.
 */
function aggregateProbabilities(
  everyOutcome: EveryOutcome,
  selectedWinners: Record<string, string>
): AggregatedProbabilities {
  const scenarios = Object.values(everyOutcome.scenarios);
  const totalScenarios = scenarios.length;
  const gameProbabilities = everyOutcome.game_probabilities ?? {};
  const remainingGames = everyOutcome.remaining_games;

  // Filter to only scenarios that match our selections
  const matchingScenarios = scenarios.filter((scenario) => {
    return Object.entries(selectedWinners).every(([gameKey, winner]) => {
      return scenario.game_outcomes[gameKey] === winner;
    });
  });

  if (matchingScenarios.length === 0) {
    return {
      ccg_probabilities: {},
      top_ccg_matchups: [],
      matchingScenarios: 0,
      totalScenarios,
    };
  }

  // Calculate weights for each matching scenario
  const scenarioWeights = matchingScenarios.map((scenario) =>
    calculateScenarioWeight(scenario, gameProbabilities, selectedWinners, remainingGames)
  );

  // Normalize weights to sum to 1
  const totalWeight = scenarioWeights.reduce((sum, w) => sum + w, 0);
  const normalizedWeights = totalWeight > 0
    ? scenarioWeights.map((w) => w / totalWeight)
    : scenarioWeights.map(() => 1 / matchingScenarios.length);

  // Aggregate CCG probabilities (weighted average across matching scenarios)
  const ccgProbSums: Record<string, number> = {};
  const matchupProbSums: Record<string, number> = {};

  for (let i = 0; i < matchingScenarios.length; i++) {
    const scenario = matchingScenarios[i];
    const weight = normalizedWeights[i];

    // Weighted sum of CCG probabilities
    for (const [team, prob] of Object.entries(scenario.ccg_probabilities)) {
      ccgProbSums[team] = (ccgProbSums[team] ?? 0) + prob * weight;
    }

    // Weighted sum of matchup probabilities
    for (const matchup of scenario.top_ccg_matchups) {
      const key = [...matchup.teams].sort().join('_vs_');
      matchupProbSums[key] = (matchupProbSums[key] ?? 0) + matchup.probability * weight;
    }
  }

  // Build matchup list and sort by probability
  const matchupEntries = Object.entries(matchupProbSums)
    .map(([key, prob]) => ({
      teams: key.split('_vs_') as [string, string],
      probability: prob,
    }))
    .sort((a, b) => b.probability - a.probability);

  return {
    ccg_probabilities: ccgProbSums,
    top_ccg_matchups: matchupEntries,
    matchingScenarios: matchingScenarios.length,
    totalScenarios,
  };
}

export function useWhatIf(
  everyOutcome: EveryOutcome | null,
  selectedWinners: Record<string, string>,
  setSelectedWinners: React.Dispatch<React.SetStateAction<Record<string, string>>>
): UseWhatIfResult {
  const remainingGames = everyOutcome?.remaining_games ?? [];

  const setWinner = (game: string, winner: string) => {
    setSelectedWinners(prev => {
      if (prev[game] === winner) {
        // Deselect if clicking the same winner
        const { [game]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [game]: winner };
    });
  };

  const clearSelections = () => {
    setSelectedWinners({});
  };

  // Calculate aggregated probabilities for current selections
  const probabilities = useMemo(() => {
    if (!everyOutcome) {
      return null;
    }

    // If no selections, aggregate all scenarios (baseline)
    return aggregateProbabilities(everyOutcome, selectedWinners);
  }, [everyOutcome, selectedWinners]);

  // Build game info with probabilities and dates
  const gameInfos = useMemo((): GameInfo[] => {
    if (!everyOutcome) return [];

    const gameProbabilities = everyOutcome.game_probabilities ?? {};
    const gameDates = everyOutcome.game_dates ?? {};

    return remainingGames.map(([team1, team2]) => {
      const gameKey = `${team1}_vs_${team2}`;
      return {
        gameKey,
        teams: [team1, team2] as [string, string],
        team1WinProb: gameProbabilities[gameKey] ?? 0.5,
        date: gameDates[gameKey] ?? null,
      };
    });
  }, [everyOutcome, remainingGames]);

  // Calculate probability of the selected combination
  const selectionProbability = useMemo(() => {
    if (!everyOutcome || Object.keys(selectedWinners).length === 0) {
      return 1; // No selection = 100% (all outcomes possible)
    }

    const gameProbabilities = everyOutcome.game_probabilities ?? {};
    let prob = 1;

    for (const [gameKey, winner] of Object.entries(selectedWinners)) {
      const teams = gameKey.split('_vs_');
      if (teams.length !== 2) continue;

      const team1 = teams[0];
      const team1WinProb = gameProbabilities[gameKey] ?? 0.5;

      if (winner === team1) {
        prob *= team1WinProb;
      } else {
        prob *= 1 - team1WinProb;
      }
    }

    return prob;
  }, [everyOutcome, selectedWinners]);

  return {
    selectedWinners,
    setWinner,
    clearSelections,
    probabilities,
    remainingGames,
    gameInfos,
    selectionProbability,
  };
}
