// Builds an actual decision tree for the CCG flowchart: each internal node
// is one still-undecided game that affects the CCG matchup, with two edges
// (one per possible winner) leading to whatever comes next along that path
// — another game node, or a leaf once nothing further can change the
// result.
//
// A node is a leaf once the matchup distribution is locked (or
// `orderedGames` is exhausted). Otherwise we scan the remaining games (in
// `orderedGames` order) for the first one whose outcome actually moves the
// resulting matchup distribution — i.e. compare the distribution forcing
// team1 vs. forcing team2, not just whether the same *set* of matchups
// stays reachable either way. The latter (what the "Ways to Lock" table's
// row-collapsing is built on) is the wrong condition for a decision tree:
// two branches can reach the same set of possible matchups while splitting
// the probability between them very differently, which would wrongly end
// the tree on a still-uncertain leaf.
//
// This recomputes the same probability-weighted matchup aggregation as
// `useWhatIf.ts`'s `aggregateProbabilities`, but threads the shrinking set
// of still-matching scenarios down through the recursion (each branch just
// partitions its parent's set by one more game) instead of re-filtering the
// full scenario list from scratch at every node/candidate — with a few
// thousand scenarios and a dozen-plus remaining games, re-scanning
// everything that often is slow enough to hang the tab.

import { gameKeyFor } from './ccgOutcomeCollapse';
import type { EveryOutcome, Schedules, WhatIfScenario } from '../types';

export const LOCKED_CONFIDENCE_THRESHOLD = 0.999;

const MATCHUP_PROBABILITY_EPSILON = 1e-6;

export interface FlowchartMatchup {
  teams: [string, string];
  probability: number;
}

function matchupKey(teams: [string, string]): string {
  return [...teams].sort().join('_vs_');
}

/** Do two matchup-probability distributions agree (within float epsilon)? */
function matchupsEqual(a: FlowchartMatchup[], b: FlowchartMatchup[]): boolean {
  const toMap = (list: FlowchartMatchup[]) => {
    const map = new Map<string, number>();
    for (const m of list) map.set(matchupKey(m.teams), m.probability);
    return map;
  };
  const mapA = toMap(a);
  const mapB = toMap(b);
  for (const key of new Set([...mapA.keys(), ...mapB.keys()])) {
    if (Math.abs((mapA.get(key) ?? 0) - (mapB.get(key) ?? 0)) > MATCHUP_PROBABILITY_EPSILON) return false;
  }
  return true;
}

/**
 * Probability-weighted average of `top_ccg_matchups` across `scenarios`,
 * matching `useWhatIf.ts`'s `aggregateProbabilities` semantics: games
 * already in `selections` are certain (weight factor 1, since `scenarios`
 * is assumed pre-filtered to match them); every other remaining game
 * contributes its actual win probability to the scenario's weight.
 */
function weightedMatchups(
  scenarios: WhatIfScenario[],
  gameProbabilities: Record<string, number>,
  orderedGames: [string, string][],
  selections: Record<string, string>
): FlowchartMatchup[] {
  if (scenarios.length === 0) return [];

  const weights = scenarios.map((scenario) => {
    let weight = 1;
    for (const game of orderedGames) {
      const key = gameKeyFor(game);
      if (key in selections) continue;
      const [team1] = game;
      const team1WinProb = gameProbabilities[key] ?? 0.5;
      weight *= scenario.game_outcomes[key] === team1 ? team1WinProb : 1 - team1WinProb;
    }
    return weight;
  });
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  const normalized = totalWeight > 0 ? weights.map((w) => w / totalWeight) : weights.map(() => 1 / scenarios.length);

  const sums = new Map<string, number>();
  for (let i = 0; i < scenarios.length; i++) {
    for (const m of scenarios[i].top_ccg_matchups) {
      const key = matchupKey(m.teams);
      sums.set(key, (sums.get(key) ?? 0) + m.probability * normalized[i]);
    }
  }
  return [...sums.entries()]
    .map(([key, probability]) => ({ teams: key.split('_vs_') as [string, string], probability }))
    .sort((a, b) => b.probability - a.probability);
}

/**
 * `remaining_games`/game keys throughout `EveryOutcome` order the two teams
 * alphabetically, not by home/away — so a raw pair can't be trusted to put
 * the away team first. This resolves the true away/home order from
 * schedule data (falling back to the alphabetical order for neutral-site
 * games, or if the schedule lookup fails for any reason).
 */
function resolveAwayHome(schedules: Schedules | null, team1: string, team2: string): [string, string] {
  const game = schedules?.teams[team1]?.games.find((g) => g.opponent === team2);
  if (game && !game.neutral) {
    return game.is_home ? [team2, team1] : [team1, team2];
  }
  return [team1, team2];
}

export interface FlowchartGameNode {
  type: 'game';
  gameKey: string;
  /** [awayTeam, homeTeam] */
  game: [string, string];
  date: string | null;
  kickoff: string | null;
  awayWinProb: number;
  team1Branch: FlowchartNode;
  team2Branch: FlowchartNode;
}

export interface FlowchartLeafNode {
  type: 'leaf';
  topMatchups: FlowchartMatchup[];
}

export type FlowchartNode = FlowchartGameNode | FlowchartLeafNode;

export function buildFlowchartTree(
  everyOutcome: EveryOutcome,
  schedules: Schedules | null,
  orderedGames: [string, string][],
  rootSelections: Record<string, string>
): FlowchartNode {
  const dates = everyOutcome.game_dates ?? {};
  const kickoffs = everyOutcome.game_kickoffs ?? {};
  const gameProbs = everyOutcome.game_probabilities ?? {};
  const allScenarios = Object.values(everyOutcome.scenarios);

  function build(
    selections: Record<string, string>,
    matching: WhatIfScenario[],
    remaining: [string, string][]
  ): FlowchartNode {
    const topMatchups = weightedMatchups(matching, gameProbs, orderedGames, selections);
    const top = topMatchups[0];

    if (!top || top.probability >= LOCKED_CONFIDENCE_THRESHOLD || remaining.length === 0) {
      return { type: 'leaf', topMatchups };
    }

    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i];
      const key = gameKeyFor(candidate);
      const [rawTeam1, rawTeam2] = candidate;

      const matchingTeam1: WhatIfScenario[] = [];
      const matchingTeam2: WhatIfScenario[] = [];
      for (const scenario of matching) {
        (scenario.game_outcomes[key] === rawTeam1 ? matchingTeam1 : matchingTeam2).push(scenario);
      }

      const selectionsTeam1 = { ...selections, [key]: rawTeam1 };
      const selectionsTeam2 = { ...selections, [key]: rawTeam2 };
      const matchupsTeam1 = weightedMatchups(matchingTeam1, gameProbs, orderedGames, selectionsTeam1);
      const matchupsTeam2 = weightedMatchups(matchingTeam2, gameProbs, orderedGames, selectionsTeam2);
      if (matchupsEqual(matchupsTeam1, matchupsTeam2)) continue;

      const nextRemaining = remaining.filter((_, ri) => ri !== i);
      const [awayTeam, homeTeam] = resolveAwayHome(schedules, rawTeam1, rawTeam2);
      const rawWinProb = gameProbs[key] ?? 0.5; // probability rawTeam1 (alphabetically first) wins
      const awayWinProb = awayTeam === rawTeam1 ? rawWinProb : 1 - rawWinProb;
      const awayMatching = awayTeam === rawTeam1 ? matchingTeam1 : matchingTeam2;
      const homeMatching = homeTeam === rawTeam1 ? matchingTeam1 : matchingTeam2;
      const awaySelections = awayTeam === rawTeam1 ? selectionsTeam1 : selectionsTeam2;
      const homeSelections = homeTeam === rawTeam1 ? selectionsTeam1 : selectionsTeam2;

      return {
        type: 'game',
        gameKey: key,
        game: [awayTeam, homeTeam],
        date: dates[key] ?? null,
        kickoff: kickoffs[key] ?? null,
        awayWinProb,
        team1Branch: build(awaySelections, awayMatching, nextRemaining),
        team2Branch: build(homeSelections, homeMatching, nextRemaining),
      };
    }

    // No remaining game individually moves the distribution any further —
    // whatever's left is irreducible (e.g. a genuine tiebreaker coin flip).
    return { type: 'leaf', topMatchups };
  }

  const rootMatching = allScenarios.filter((s) =>
    Object.entries(rootSelections).every(([key, winner]) => s.game_outcomes[key] === winner)
  );
  const rootRemaining = orderedGames.filter((game) => !(gameKeyFor(game) in rootSelections));
  return build(rootSelections, rootMatching, rootRemaining);
}

export interface PositionedNode {
  node: FlowchartNode;
  x: number;
  y: number;
  team1Branch?: PositionedNode;
  team2Branch?: PositionedNode;
}

function countLeaves(node: FlowchartNode): number {
  if (node.type !== 'game') return 1;
  return countLeaves(node.team1Branch) + countLeaves(node.team2Branch);
}

function maxDepth(node: FlowchartNode): number {
  if (node.type !== 'game') return 0;
  return 1 + Math.max(maxDepth(node.team1Branch), maxDepth(node.team2Branch));
}

function place(node: FlowchartNode, xStart: number, xEnd: number, depth: number): PositionedNode {
  const x = (xStart + xEnd) / 2;
  if (node.type !== 'game') {
    return { node, x, y: depth };
  }
  const leftLeaves = countLeaves(node.team1Branch);
  const totalLeaves = leftLeaves + countLeaves(node.team2Branch);
  const splitX = xStart + (xEnd - xStart) * (leftLeaves / totalLeaves);
  return {
    node,
    x,
    y: depth,
    team1Branch: place(node.team1Branch, xStart, splitX, depth + 1),
    team2Branch: place(node.team2Branch, splitX, xEnd, depth + 1),
  };
}

export interface TreeLayout {
  root: PositionedNode;
  totalLeaves: number;
  maxDepth: number;
}

/**
 * Lays out the tree in a unit coordinate system: x in [0, totalLeaves],
 * y in [0, maxDepth] (one row per decision level). Callers scale these to
 * pixels.
 */
export function layoutFlowchartTree(root: FlowchartNode): TreeLayout {
  const totalLeaves = countLeaves(root);
  return {
    root: place(root, 0, totalLeaves, 0),
    totalLeaves,
    maxDepth: maxDepth(root),
  };
}
