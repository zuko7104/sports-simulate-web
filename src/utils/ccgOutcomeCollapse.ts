// TypeScript port of the outcome-collapsing algorithm in
// `figures.py::table_ccg_outcomes()`. Given the same combinatorial what-if
// scenario set already exported as `EveryOutcome`, this groups full
// (every-game-decided) scenarios by their dominant CCG matchup, then
// collapses outcome branches together wherever a game's winner doesn't
// change which matchup results — producing a compact set of rows, each
// describing "these specific game outcomes (with the rest irrelevant) lead
// to this CCG matchup, with this probability and confidence."
//
// This is the shared foundation for both the CCG flowchart (interactive,
// narrows as the user picks winners) and the "Ways to Lock" table (static,
// shows every collapsed row at once).

import { gameSortKey } from './dateUtils';
import type { EveryOutcome, WhatIfScenario } from '../types';

export interface OutcomeRow {
  /** Aligned to `orderedGames`; null means this game's outcome doesn't affect this row. */
  gameOutcomes: (string | null)[];
  /** Combined probability of all full-resolution branches this row represents. */
  probability: number;
  /** The two CCG participants for this row (alphabetically ordered). */
  ccgMatchup: [string, string];
  /**
   * How certain `ccgMatchup` is *within* this row (0-1). Even when every
   * in-window game is decided, residual uncertainty from out-of-window
   * games/tiebreakers can keep this below 1.
   */
  matchupConfidence: number;
}

export function gameKeyFor([team1, team2]: [string, string]): string {
  return `${team1}_vs_${team2}`;
}

/** The game key order used everywhere else in this module: date, then kickoff, then team name. */
export function orderGames(everyOutcome: EveryOutcome): [string, string][] {
  const dates = everyOutcome.game_dates ?? {};
  const kickoffs = everyOutcome.game_kickoffs ?? {};
  return [...everyOutcome.remaining_games].sort((a, b) => {
    const keyA = gameKeyFor(a);
    const keyB = gameKeyFor(b);
    const sortA = gameSortKey(dates[keyA] ?? '9999-99-99', kickoffs[keyA], a[0]);
    const sortB = gameSortKey(dates[keyB] ?? '9999-99-99', kickoffs[keyB], b[0]);
    return sortA.localeCompare(sortB);
  });
}

function scenarioProbability(
  gameOutcomes: Record<string, string>,
  orderedGames: [string, string][],
  gameProbabilities: Record<string, number>
): number {
  let prob = 1;
  for (const game of orderedGames) {
    const [team1] = game;
    const key = gameKeyFor(game);
    const winner = gameOutcomes[key];
    const team1WinProb = gameProbabilities[key] ?? 0.5;
    prob *= winner === team1 ? team1WinProb : 1 - team1WinProb;
  }
  return prob;
}

type BinaryOutcome = (0 | 1 | null)[];

function outcomeKey(outcome: BinaryOutcome): string {
  return outcome.map((v) => (v === null ? 'n' : String(v))).join(',');
}

function parseOutcomeKey(key: string): BinaryOutcome {
  return key.split(',').map((v) => (v === 'n' ? null : (Number(v) as 0 | 1)));
}

interface FullScenario {
  outcomeKey: string;
  probability: number;
  /** Confidence in whatever this group represents (a matchup for
   * `collapseOutcomes`, "this team clinches" for `collapseClinchOutcomes`) —
   * kept generic so both can share the collapsing logic below. */
  confidence: number;
}

interface CollapsedGroupRow {
  gameOutcomes: (string | null)[];
  probability: number;
  confidence: number;
}

/**
 * Iteratively collapse a group of full (every remaining game decided)
 * scenarios that all share whatever property defines the group (e.g. "same
 * CCG matchup", or "this team clinches a CCG spot either way"): a game's
 * outcome becomes a wildcard (null) wherever flipping it (holding everything
 * else fixed) stays within the same group — same approach as
 * `figures.py::table_ccg_outcomes()`'s Python original. Tracks which
 * original full scenarios each collapsed key subsumes so probability/
 * confidence can be recombined at the end.
 */
function collapseScenarioGroup(
  scenarios: Map<string, FullScenario>,
  orderedGames: [string, string][],
): CollapsedGroupRow[] {
  const numGames = orderedGames.length;
  let currentKeys = new Set(scenarios.keys());
  let currentAssoc = new Map<string, Set<string>>();
  for (const key of currentKeys) currentAssoc.set(key, new Set([key]));

  const terminal = new Map<string, Set<string>>();

  for (let round = 0; round < numGames; round++) {
    const nextAssoc = new Map<string, Set<string>>();

    for (const key of currentKeys) {
      const outcome = parseOutcomeKey(key);
      let found = false;
      for (let gameIndex = 0; gameIndex < numGames; gameIndex++) {
        if (outcome[gameIndex] === null) continue;
        const flipped = [...outcome];
        flipped[gameIndex] = flipped[gameIndex] === 0 ? 1 : 0;
        const flippedKey = outcomeKey(flipped);
        if (!currentKeys.has(flippedKey)) continue;

        found = true;
        const collapsed = [...outcome];
        collapsed[gameIndex] = null;
        const collapsedKey = outcomeKey(collapsed);
        if (!nextAssoc.has(collapsedKey)) nextAssoc.set(collapsedKey, new Set());
        for (const orig of currentAssoc.get(key)!) nextAssoc.get(collapsedKey)!.add(orig);
      }
      if (!found) {
        terminal.set(key, currentAssoc.get(key)!);
      }
    }

    currentKeys = new Set(nextAssoc.keys());
    currentAssoc = nextAssoc;
  }
  for (const [key, assoc] of currentAssoc) {
    terminal.set(key, assoc);
  }

  const rows: CollapsedGroupRow[] = [];
  for (const [key, assoc] of terminal) {
    const pattern = parseOutcomeKey(key);
    let totalProb = 0;
    let confidenceSum = 0;
    for (const origKey of assoc) {
      const s = scenarios.get(origKey)!;
      totalProb += s.probability;
      confidenceSum += s.probability * s.confidence;
    }
    const gameOutcomes = pattern.map((v, i) => (v === null ? null : orderedGames[i][v]));
    rows.push({
      gameOutcomes,
      probability: totalProb,
      confidence: totalProb > 0 ? confidenceSum / totalProb : 0,
    });
  }
  return rows;
}

/**
 * Builds the collapsed outcome rows for every CCG matchup found across the
 * full combinatorial scenario set. Nothing is filtered out here (not even
 * unlikely rows) — callers decide what to show.
 */
export function collapseOutcomes(everyOutcome: EveryOutcome, orderedGames: [string, string][]): OutcomeRow[] {
  const gameProbabilities = everyOutcome.game_probabilities ?? {};

  // Group full (every game decided) scenarios by their dominant CCG matchup.
  const groups = new Map<string, { matchup: [string, string]; scenarios: Map<string, FullScenario> }>();

  for (const scenario of Object.values(everyOutcome.scenarios)) {
    const topMatchup = scenario.top_ccg_matchups[0];
    if (!topMatchup) continue; // no simulated seasons matched this branch

    const binary: (0 | 1)[] = [];
    let complete = true;
    for (const game of orderedGames) {
      const [team1, team2] = game;
      const key = gameKeyFor(game);
      const winner = scenario.game_outcomes[key];
      if (winner !== team1 && winner !== team2) {
        complete = false;
        break;
      }
      binary.push(winner === team1 ? 0 : 1);
    }
    if (!complete) continue;

    const matchup = [...topMatchup.teams].sort() as [string, string];
    const matchupKey = matchup.join('_vs_');
    if (!groups.has(matchupKey)) {
      groups.set(matchupKey, { matchup, scenarios: new Map() });
    }
    const key = outcomeKey(binary);
    groups.get(matchupKey)!.scenarios.set(key, {
      outcomeKey: key,
      probability: scenarioProbability(scenario.game_outcomes, orderedGames, gameProbabilities),
      confidence: topMatchup.probability,
    });
  }

  const rows: OutcomeRow[] = [];
  for (const { matchup, scenarios } of groups.values()) {
    for (const row of collapseScenarioGroup(scenarios, orderedGames)) {
      rows.push({
        gameOutcomes: row.gameOutcomes,
        probability: row.probability,
        ccgMatchup: matchup,
        matchupConfidence: row.confidence,
      });
    }
  }

  return rows.sort((a, b) => b.probability - a.probability);
}

/** Same confidence bar used elsewhere (e.g. the flowchart) for "this is
 * effectively certain, modulo float/simulation noise". */
const CLINCH_CONFIDENCE_THRESHOLD = 0.999;

export interface ClinchRow {
  /** Aligned to `orderedGames`; null means this game's outcome doesn't affect this row. */
  gameOutcomes: (string | null)[];
  /** Combined probability of all full-resolution branches this row represents. */
  probability: number;
  /** How certain `team` actually clinches within this row (0-1) — should sit
   * at/above `CLINCH_CONFIDENCE_THRESHOLD` for every row here, but is kept as
   * a probability-weighted average (not hardcoded to 1) since it's a genuine
   * aggregate over the underlying full scenarios. */
  confidence: number;
}

/**
 * Ways `team` can already be guaranteed a CCG spot from this point on,
 * regardless of which specific opponent it ends up facing — the team-scoped
 * analogue of `collapseOutcomes`. Unlike `collapseOutcomes` (which groups by
 * exact matchup, so every remaining game affecting the matchup pair stays
 * "live" until it's decided), this groups every full scenario where `team`
 * makes the CCG into one bucket first, so a game only shows up in a row here
 * if its outcome actually affects whether `team` clinches — not merely which
 * opponent it draws.
 */
export function collapseClinchOutcomes(
  everyOutcome: EveryOutcome,
  orderedGames: [string, string][],
  team: string,
): ClinchRow[] {
  const gameProbabilities = everyOutcome.game_probabilities ?? {};
  const allScenarios = Object.values(everyOutcome.scenarios);
  const rows: ClinchRow[] = [];

  // Deliberately NOT built the same way as collapseOutcomes/collapseScenarioGroup:
  // grouping "every scenario where `team` clinches" into one bucket (rather
  // than one bucket per exact matchup, as collapseOutcomes does) can easily
  // put the large majority of all ~2^N full scenarios in a single group once
  // a team is heavily favored. Feeding a group that large into
  // the iterative pairwise-collapse used for matchup rows blows up
  // combinatorially (each full scenario can pair with up to N neighbors,
  // each producing a distinct partially-wildcarded key, so the *intermediate*
  // key count can grow well past the input size before it shrinks back down)
  // - confirmed hanging the tab on real data. A top-down decision tree with
  // "all clinch" / "none clinch" pruning gets the same minimal rows in time
  // proportional to the actual (small) number of games that matter, since a
  // branch collapses the instant every remaining game becomes irrelevant to
  // it, instead of exploring every combination of irrelevant games first.
  function recurse(selections: (string | null)[], matching: WhatIfScenario[], remainingIndex: number) {
    if (matching.length === 0) return;

    let allClinch = true;
    let noneClinch = true;
    for (const s of matching) {
      const clinched = (s.ccg_probabilities[team] ?? 0) >= CLINCH_CONFIDENCE_THRESHOLD;
      if (clinched) noneClinch = false;
      else allClinch = false;
      if (!allClinch && !noneClinch) break;
    }

    if (noneClinch) return; // dead branch - team doesn't clinch anywhere under here
    if (allClinch || remainingIndex >= orderedGames.length) {
      if (!allClinch) return; // ran out of games without fully resolving - not a clinch
      let totalProb = 0;
      let confidenceSum = 0;
      for (const s of matching) {
        const p = scenarioProbability(s.game_outcomes, orderedGames, gameProbabilities);
        totalProb += p;
        confidenceSum += p * (s.ccg_probabilities[team] ?? 0);
      }
      rows.push({
        gameOutcomes: [...selections],
        probability: totalProb,
        confidence: totalProb > 0 ? confidenceSum / totalProb : 0,
      });
      return;
    }

    const [team1, team2] = orderedGames[remainingIndex];
    const matchingTeam1: WhatIfScenario[] = [];
    const matchingTeam2: WhatIfScenario[] = [];
    const key = gameKeyFor(orderedGames[remainingIndex]);
    for (const s of matching) {
      (s.game_outcomes[key] === team1 ? matchingTeam1 : matchingTeam2).push(s);
    }

    const selectionsTeam1 = [...selections];
    selectionsTeam1[remainingIndex] = team1;
    recurse(selectionsTeam1, matchingTeam1, remainingIndex + 1);

    const selectionsTeam2 = [...selections];
    selectionsTeam2[remainingIndex] = team2;
    recurse(selectionsTeam2, matchingTeam2, remainingIndex + 1);
  }

  recurse(new Array(orderedGames.length).fill(null), allScenarios, 0);
  return rows.sort((a, b) => b.probability - a.probability);
}

/**
 * Games that affect CCG seeding at all: a game is relevant only if at
 * least one row has a non-null (i.e. non-wildcarded) entry for it.
 */
export function relevantGames(
  orderedGames: [string, string][],
  rows: { gameOutcomes: (string | null)[] }[],
): [string, string][] {
  return orderedGames.filter((_, i) => rows.some((row) => row.gameOutcomes[i] !== null));
}


/**
 * Non-null once every remaining filtered row agrees on the CCG matchup —
 * i.e. it's fully determined by the picks made so far. `confidence` is the
 * probability-weighted average of those rows' `matchupConfidence`, and can
 * be below 1 even when the matchup is "locked" (see `OutcomeRow.matchupConfidence`).
 */
export function lockedMatchup(filteredRows: OutcomeRow[]): { matchup: [string, string]; confidence: number } | null {
  if (filteredRows.length === 0) return null;

  const matchupKey = (m: [string, string]) => [...m].sort().join('_vs_');
  const firstKey = matchupKey(filteredRows[0].ccgMatchup);
  if (!filteredRows.every((row) => matchupKey(row.ccgMatchup) === firstKey)) return null;

  const totalProb = filteredRows.reduce((sum, row) => sum + row.probability, 0);
  const confidence =
    totalProb > 0
      ? filteredRows.reduce((sum, row) => sum + row.probability * row.matchupConfidence, 0) / totalProb
      : 0;

  return { matchup: filteredRows[0].ccgMatchup, confidence };
}
