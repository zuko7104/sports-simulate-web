/**
 * Client-side conference championship tiebreaker resolution.
 *
 * Ported from src/sports/tiebreakers/tiebreakers_2024.py
 * Rules are for the 2025 season.
 */

import type { TeamRecord, ConferenceState, TiebreakerResult, TiebreakerLogStep, SeedingLog } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Group items into tiers by a numeric key, sorted descending (best first). */
function sortedWithTies<T>(items: T[], key: (item: T) => number): T[][] {
  const buckets = new Map<number, T[]>();
  for (const item of items) {
    const k = key(item);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k)!.push(item);
  }
  return Array.from(buckets.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([, v]) => v);
}

function teamNames(teams: TeamRecord[]): Set<string> {
  return new Set(teams.map((t) => t.name));
}

// ---------------------------------------------------------------------------
// Record helpers operating on TeamRecord
// ---------------------------------------------------------------------------

function filteredRecord(team: TeamRecord, opponents: Set<string>): { wins: number; losses: number; ties: number } {
  // 2025 exemption: Kansas St ↔ Arizona don't count against each other
  let adjusted = opponents;
  if (team.name === 'Kansas St' && opponents.has('Arizona')) {
    adjusted = new Set(opponents);
    adjusted.delete('Arizona');
  } else if (team.name === 'Arizona' && opponents.has('Kansas St')) {
    adjusted = new Set(opponents);
    adjusted.delete('Kansas St');
  }

  let wins = 0, losses = 0, ties = 0;
  for (const g of team.games) {
    if (!adjusted.has(g.opponent)) continue;
    if (g.won) wins++;
    else losses++;
  }
  return { wins, losses, ties };
}

function filteredWinPct(team: TeamRecord, opponents: Set<string>): number {
  const { wins, losses, ties } = filteredRecord(team, opponents);
  const total = wins + losses + ties;
  return total > 0 ? wins / total : 1.0;
}

function hasPlayed(team: TeamRecord, opponents: Set<string>): boolean {
  // 2025: Kansas St and Arizona haven't played each other
  if (team.name === 'Kansas St' && opponents.has('Arizona')) return false;
  if (team.name === 'Arizona' && opponents.has('Kansas St')) return false;
  const played = new Set(team.games.map((g) => g.opponent));
  for (const opp of opponents) {
    if (!played.has(opp)) return false;
  }
  return true;
}

function playedOpponents(team: TeamRecord): Set<string> {
  return new Set(team.games.map((g) => g.opponent));
}

function allCommonOpponents(allTeamNames: Set<string>, teams: TeamRecord[]): Set<string> {
  let common = new Set(allTeamNames);
  for (const team of teams) {
    const played = playedOpponents(team);
    common = new Set([...common].filter((n) => played.has(n)));
  }
  // 2025 exemption
  const names = new Set(teams.map((t) => t.name));
  if (names.has('Arizona') || names.has('Kansas St')) {
    common.delete('Arizona');
    common.delete('Kansas St');
  }
  return common;
}

function averageOffensivePoints(team: TeamRecord, opponents: Set<string>): number {
  let total = 0, count = 0;
  for (const g of team.games) {
    if (!opponents.has(g.opponent) || g.pointsFor == null) continue;
    total += g.pointsFor;
    count++;
  }
  return count > 0 ? total / count : 0;
}

function averageDefensivePoints(team: TeamRecord, opponents: Set<string>): number {
  let total = 0, count = 0;
  for (const g of team.games) {
    if (!opponents.has(g.opponent) || g.pointsAgainst == null) continue;
    total += g.pointsAgainst;
    count++;
  }
  return count > 0 ? total / count : 0;
}

// ---------------------------------------------------------------------------
// Tiebreaker functions
//
// Each returns tiers (array of arrays) — best tier first.
// If all teams remain tied, returns a single-element array containing all.
// ---------------------------------------------------------------------------

type TiebreakerFn = (
  allTeamNames: Set<string>,
  allTeams: Map<string, TeamRecord>,
  tiedTeams: TeamRecord[],
  standings: TeamRecord[][],
) => TeamRecord[][];

function headToHead(
  _allTeamNames: Set<string>,
  _allTeams: Map<string, TeamRecord>,
  tiedTeams: TeamRecord[],
  _standings: TeamRecord[][],
  options: { eliminateOverallLoser?: boolean } = {},
): TeamRecord[][] {
  const names = teamNames(tiedTeams);
  // Check if one team beat all others
  for (const team of tiedTeams) {
    const othersSet = new Set(names);
    othersSet.delete(team.name);
    if (hasPlayed(team, othersSet)) {
      const { wins } = filteredRecord(team, othersSet);
      if (wins === othersSet.size) {
        return [[team], tiedTeams.filter((t) => t.name !== team.name)];
      }
    }
  }
  // Check if all have played each other
  const allPlayed = tiedTeams.every((team) => {
    const othersSet = new Set(names);
    othersSet.delete(team.name);
    return hasPlayed(team, othersSet);
  });
  if (!allPlayed) {
    if (options.eliminateOverallLoser) {
      // Eliminate the team with the worst H2H record
      for (const team of tiedTeams) {
        const othersSet = new Set(names);
        othersSet.delete(team.name);
        const { losses } = filteredRecord(team, othersSet);
        if (losses === othersSet.size) {
          return [tiedTeams.filter((t) => t.name !== team.name), [team]];
        }
      }
    }
    return [tiedTeams];
  }
  return sortedWithTies(tiedTeams, (team) => filteredWinPct(team, names));
}

function againstAllCommonOpponents(
  allTeamNames: Set<string>,
  _allTeams: Map<string, TeamRecord>,
  tiedTeams: TeamRecord[],
  _standings: TeamRecord[][],
): TeamRecord[][] {
  const common = allCommonOpponents(allTeamNames, tiedTeams);
  return sortedWithTies(tiedTeams, (team) => filteredWinPct(team, common));
}

function againstHighestCommonOpponent(
  allTeamNames: Set<string>,
  _allTeams: Map<string, TeamRecord>,
  tiedTeams: TeamRecord[],
  standings: TeamRecord[][],
  options: {
    tierTiebreaker?: (teams: TeamRecord[]) => TeamRecord[][];
    abortAfterAnyChange?: boolean;
  } = {},
): TeamRecord[][] {
  const { tierTiebreaker, abortAfterAnyChange = true } = options;
  const allCommon = allCommonOpponents(allTeamNames, tiedTeams);
  let currentTied = tiedTeams;
  const untied: TeamRecord[][] = [];

  for (const tier of standings) {
    let tierCommon = [tier.filter((t) => allCommon.has(t.name))];
    if (tierCommon[0].length > 1 && tierTiebreaker) {
      tierCommon = tierTiebreaker(tierCommon[0]);
    }
    for (const commonGroup of tierCommon) {
      const commonNames = teamNames(commonGroup);
      const result = sortedWithTies(currentTied, (team) => filteredWinPct(team, commonNames));
      if (result.length > 1) {
        if (abortAfterAnyChange) return result;
        if (result[0].length < 3) {
          return [...result, ...untied];
        }
        currentTied = result[0];
        untied.push(...result.slice(1));
        // Recompute common opponents for reduced tied set
        // (simplified: we don't recompute allCommon here because we iterate tiers anyway)
      }
    }
  }
  return [currentTied, ...untied];
}

function strengthOfConferenceSchedule(
  allTeamNames: Set<string>,
  allTeams: Map<string, TeamRecord>,
  tiedTeams: TeamRecord[],
  _standings: TeamRecord[][],
): TeamRecord[][] {
  function confSOS(team: TeamRecord): number {
    let confOpponents = new Set([...playedOpponents(team)].filter((n) => allTeamNames.has(n)));
    // 2025 exemption
    if (team.name === 'Kansas St') confOpponents.delete('Arizona');
    else if (team.name === 'Arizona') confOpponents.delete('Kansas St');

    let wins = 0, played = 0;
    for (const oppName of confOpponents) {
      const opp = allTeams.get(oppName);
      if (!opp) continue;
      const { wins: w, losses: l, ties: t } = filteredRecord(opp, allTeamNames);
      wins += w;
      played += w + l + t;
    }
    return played > 0 ? wins / played : 0;
  }
  return sortedWithTies(tiedTeams, confSOS);
}

function totalWinsIn12GameSeason(
  _allTeamNames: Set<string>,
  _allTeams: Map<string, TeamRecord>,
  tiedTeams: TeamRecord[],
  _standings: TeamRecord[][],
): TeamRecord[][] {
  function winsIn12(team: TeamRecord): number {
    let wins = 0;
    for (const g of team.games) {
      // Exclude neutral-site games against Hawaii
      if (!g.neutral && g.opponent === 'Hawaii') continue;
      if (g.won) wins++;
    }
    return wins;
  }
  return sortedWithTies(tiedTeams, winsIn12);
}

function cappedRelativeScoringMargin(
  allTeamNames: Set<string>,
  allTeams: Map<string, TeamRecord>,
  tiedTeams: TeamRecord[],
  _standings: TeamRecord[][],
): TeamRecord[][] {
  function meanRelativeMargin(team: TeamRecord): number {
    let totalMargin = 0, numGames = 0;
    for (const g of team.games) {
      if (!allTeamNames.has(g.opponent) || g.pointsFor == null || g.pointsAgainst == null) continue;
      const opp = allTeams.get(g.opponent);
      if (!opp) continue;
      const oppDefPts = averageDefensivePoints(opp, allTeamNames) || 1;
      const oppOffPts = averageOffensivePoints(opp, allTeamNames) || 1;
      const relOff = g.pointsFor / oppDefPts;
      const relDef = g.pointsAgainst / oppOffPts;
      totalMargin += Math.min(relOff, 2.0) - relDef;
      numGames++;
    }
    return numGames > 0 ? totalMargin / numGames : 0;
  }
  return sortedWithTies(tiedTeams, meanRelativeMargin);
}

let _usedRandomDraw = false;

function randomDraw(
  _allTeamNames: Set<string>,
  _allTeams: Map<string, TeamRecord>,
  tiedTeams: TeamRecord[],
  _standings: TeamRecord[][],
): TeamRecord[][] {
  _usedRandomDraw = true;
  const idx = Math.floor(Math.random() * tiedTeams.length);
  const winner = tiedTeams[idx];
  return [[winner], tiedTeams.filter((t) => t.name !== winner.name)];
}

// ---------------------------------------------------------------------------
// Tiebreaker logging helpers
// ---------------------------------------------------------------------------

const TIEBREAKER_NAMES: Record<string, string> = {
  headToHead: 'Head-to-Head',
  againstAllCommonOpponents: 'Record vs. All Common Opponents',
  againstHighestCommonOpponent: 'Record vs. Highest Common Opponent',
  strengthOfConferenceSchedule: 'Strength of Conference Schedule',
  totalWinsIn12GameSeason: 'Total Wins in 12-Game Season',
  cappedRelativeScoringMargin: 'Capped Relative Scoring Margin',
  randomDraw: 'Random Draw / Coin Flip',
};

function formatPct(n: number): string {
  return (n * 100).toFixed(1) + '%';
}

function formatRecord(r: { wins: number; losses: number; ties: number }): string {
  return `${r.wins}-${r.losses}`;
}

/** Generate per-team detail strings for a given tiebreaker step */
function generateDetails(
  tbName: string,
  allTeamNames: Set<string>,
  allTeams: Map<string, TeamRecord>,
  tiedTeams: TeamRecord[],
  standings: TeamRecord[][],
): Record<string, string> {
  const details: Record<string, string> = {};
  const names = teamNames(tiedTeams);

  switch (tbName) {
    case 'headToHead': {
      for (const team of tiedTeams) {
        const othersSet = new Set(names);
        othersSet.delete(team.name);
        const rec = filteredRecord(team, othersSet);
        details[team.name] = formatRecord(rec) + ' vs. tied teams';
      }
      break;
    }
    case 'againstAllCommonOpponents': {
      const common = allCommonOpponents(allTeamNames, tiedTeams);
      const commonNames = Array.from(common).sort();
      for (const team of tiedTeams) {
        const rec = filteredRecord(team, common);
        const pct = filteredWinPct(team, common);
        details[team.name] = `${formatRecord(rec)} (${formatPct(pct)}) vs. ${commonNames.join(', ')}`;
      }
      break;
    }
    case 'againstHighestCommonOpponent': {
      const common = allCommonOpponents(allTeamNames, tiedTeams);
      // Find which common opponent tier is decisive
      for (const tier of standings) {
        const tierCommon = tier.filter((t) => common.has(t.name));
        if (tierCommon.length === 0) continue;
        const tierNames = teamNames(tierCommon);
        const result = sortedWithTies(tiedTeams, (team) => filteredWinPct(team, tierNames));
        if (result.length > 1) {
          const oppList = tierCommon.map(t => t.name).sort().join(', ');
          for (const team of tiedTeams) {
            const rec = filteredRecord(team, tierNames);
            details[team.name] = `${formatRecord(rec)} vs. ${oppList}`;
          }
          break;
        }
      }
      if (Object.keys(details).length === 0) {
        for (const team of tiedTeams) {
          details[team.name] = 'No separation found';
        }
      }
      break;
    }
    case 'strengthOfConferenceSchedule': {
      for (const team of tiedTeams) {
        let confOpponents = new Set([...playedOpponents(team)].filter((n) => allTeamNames.has(n)));
        if (team.name === 'Kansas St') confOpponents.delete('Arizona');
        else if (team.name === 'Arizona') confOpponents.delete('Kansas St');
        let wins = 0, played = 0;
        for (const oppName of confOpponents) {
          const opp = allTeams.get(oppName);
          if (!opp) continue;
          const { wins: w, losses: l, ties: t } = filteredRecord(opp, allTeamNames);
          wins += w;
          played += w + l + t;
        }
        const pct = played > 0 ? wins / played : 0;
        details[team.name] = `${wins}-${played - wins} (${formatPct(pct)}) opponents' conf. record`;
      }
      break;
    }
    case 'totalWinsIn12GameSeason': {
      for (const team of tiedTeams) {
        let wins = 0;
        for (const g of team.games) {
          if (!g.neutral && g.opponent === 'Hawaii') continue;
          if (g.won) wins++;
        }
        details[team.name] = `${wins} wins`;
      }
      break;
    }
    case 'cappedRelativeScoringMargin': {
      for (const team of tiedTeams) {
        let totalMargin = 0, numGames = 0;
        for (const g of team.games) {
          if (!allTeamNames.has(g.opponent) || g.pointsFor == null || g.pointsAgainst == null) continue;
          const opp = allTeams.get(g.opponent);
          if (!opp) continue;
          const oppDefPts = averageDefensivePoints(opp, allTeamNames) || 1;
          const oppOffPts = averageOffensivePoints(opp, allTeamNames) || 1;
          const relOff = g.pointsFor / oppDefPts;
          const relDef = g.pointsAgainst / oppOffPts;
          totalMargin += Math.min(relOff, 2.0) - relDef;
          numGames++;
        }
        const avg = numGames > 0 ? totalMargin / numGames : 0;
        details[team.name] = avg >= 0 ? `+${avg.toFixed(3)}` : avg.toFixed(3);
      }
      break;
    }
    case 'randomDraw': {
      for (const team of tiedTeams) {
        details[team.name] = 'Coin flip';
      }
      break;
    }
    default:
      break;
  }
  return details;
}

interface NamedTiebreaker {
  name: string;
  fn: TiebreakerFn;
}

/** Run tiebreakers with logging, returning the winner and the log steps */
function runTiebreakersWithLog(
  seed: number,
  namedTBs: NamedTiebreaker[],
  allTeamNames: Set<string>,
  allTeams: Map<string, TeamRecord>,
  tiedTeams: TeamRecord[],
  standings: TeamRecord[][],
): { result: TeamRecord[][]; steps: TiebreakerLogStep[] } {
  const steps: TiebreakerLogStep[] = [];
  let currentTied = tiedTeams;

  for (const { name, fn } of namedTBs) {
    const enteringNames = currentTied.map((t) => t.name);
    const details = generateDetails(name, allTeamNames, allTeams, currentTied, standings);
    const result = fn(allTeamNames, allTeams, currentTied, standings);
    const resolved = result.length > 1;

    const step: TiebreakerLogStep = {
      seed,
      stepName: TIEBREAKER_NAMES[name] ?? name,
      teamsEntering: enteringNames,
      details,
      resolved,
    };

    if (resolved) {
      step.advancingTeams = result[0].map((t) => t.name);
      if (result.length > 1) {
        step.eliminatedTeams = result.slice(1).flat().map((t) => t.name);
      }
      steps.push(step);
      return { result, steps };
    }

    steps.push(step);
  }

  return { result: [currentTied], steps };
}

// ---------------------------------------------------------------------------
// Conference-specific championship seeders
// ---------------------------------------------------------------------------

type Seeder = (state: ConferenceState) => TiebreakerResult;

function buildStandings(state: ConferenceState): TeamRecord[][] {
  const teams = Array.from(state.teams.values());
  return sortedWithTies(teams, (team) => filteredWinPct(team, state.teamNames));
}

function makeLoggedTwoTeamTiebreaker(
  namedTBs: NamedTiebreaker[],
  allTeamNames: Set<string>,
  allTeams: Map<string, TeamRecord>,
  standings: TeamRecord[][],
) {
  return (tiedTeams: TeamRecord[], seed: number): { winner: TeamRecord; loser: TeamRecord; steps: TiebreakerLogStep[] } => {
    const { result, steps } = runTiebreakersWithLog(seed, namedTBs, allTeamNames, allTeams, tiedTeams, standings);
    if (result.length > 1) {
      return { winner: result[0][0], loser: result[1][0], steps };
    }
    return { winner: tiedTeams[0], loser: tiedTeams[1], steps };
  };
}

function makeLoggedMultiTeamTiebreaker(
  namedTBs: NamedTiebreaker[],
  allTeamNames: Set<string>,
  allTeams: Map<string, TeamRecord>,
  standings: TeamRecord[][],
) {
  return (tiedTeams: TeamRecord[], seed: number): { advancers: TeamRecord[]; steps: TiebreakerLogStep[] } => {
    const { result, steps } = runTiebreakersWithLog(seed, namedTBs, allTeamNames, allTeams, tiedTeams, standings);
    if (result.length > 1) {
      return { advancers: result[0], steps };
    }
    return { advancers: tiedTeams, steps };
  };
}

function big12ChampionshipSeeder(state: ConferenceState): TiebreakerResult {
  _usedRandomDraw = false;
  const allTeamNames = state.teamNames;
  const allTeams = state.teams;
  const standings = buildStandings(state);

  const tiebreakers: TiebreakerFn[] = [
    (atn, at, tt, s) => headToHead(atn, at, tt, s),
    againstAllCommonOpponents,
    (atn, at, tt, s) => againstHighestCommonOpponent(atn, at, tt, s),
    strengthOfConferenceSchedule,
    totalWinsIn12GameSeason,
    randomDraw,
  ];

  const namedTBs: NamedTiebreaker[] = [
    { name: 'headToHead', fn: (atn, at, tt, s) => headToHead(atn, at, tt, s) },
    { name: 'againstAllCommonOpponents', fn: againstAllCommonOpponents },
    { name: 'againstHighestCommonOpponent', fn: (atn, at, tt, s) => againstHighestCommonOpponent(atn, at, tt, s) },
    { name: 'strengthOfConferenceSchedule', fn: strengthOfConferenceSchedule },
    { name: 'totalWinsIn12GameSeason', fn: totalWinsIn12GameSeason },
    { name: 'randomDraw', fn: randomDraw },
  ];

  const loggedTwoTeamTB = makeLoggedTwoTeamTiebreaker(namedTBs, allTeamNames, allTeams, standings);
  const loggedMultiTB = makeLoggedMultiTeamTiebreaker(namedTBs, allTeamNames, allTeams, standings);

  function multiTeamTiebreaker(tiedTeams: TeamRecord[]): TeamRecord | TeamRecord[] {
    let currentTied = tiedTeams;
    for (const tb of tiebreakers) {
      const result = tb(allTeamNames, allTeams, currentTied, standings);
      if (result.length > 1) {
        if (result[0].length === 1) return result[0][0];
        if (result[0].length === 2) return result[0];
        currentTied = result[0];
      }
    }
    return currentTied;
  }

  let seed1: TeamRecord | null = null;
  let seed2: TeamRecord | null = null;
  const seedingLog: SeedingLog[] = [];

  if (standings[0].length === 1) {
    seed1 = standings[0][0];
    seedingLog.push({ seed: 1, teamName: seed1.name, method: 'outright', steps: [] });
    if (standings.length > 1) {
      if (standings[1].length === 1) {
        seed2 = standings[1][0];
        seedingLog.push({ seed: 2, teamName: seed2.name, method: 'outright', steps: [] });
      } else if (standings[1].length === 2) {
        const { winner, steps } = loggedTwoTeamTB(standings[1], 2);
        seed2 = winner;
        seedingLog.push({ seed: 2, teamName: seed2.name, method: 'tiebreaker', steps });
      } else {
        const result = multiTeamTiebreaker(standings[1]);
        if (Array.isArray(result)) {
          const { steps: multiSteps } = loggedMultiTB(standings[1], 2);
          const { winner: final, steps: twoSteps } = loggedTwoTeamTB(result, 2);
          seed2 = final;
          seedingLog.push({ seed: 2, teamName: seed2.name, method: 'tiebreaker', steps: [...multiSteps, ...twoSteps] });
        } else {
          const { steps } = loggedMultiTB(standings[1], 2);
          seed2 = result;
          seedingLog.push({ seed: 2, teamName: seed2.name, method: 'tiebreaker', steps });
        }
      }
    }
  } else if (standings[0].length === 2) {
    const { winner, loser, steps } = loggedTwoTeamTB(standings[0], 1);
    seed1 = winner;
    seed2 = loser;
    seedingLog.push({ seed: 1, teamName: seed1.name, method: 'tiebreaker', steps });
    seedingLog.push({ seed: 2, teamName: seed2.name, method: 'tiebreaker', steps: [...steps] });
  } else {
    const result = multiTeamTiebreaker(standings[0]);
    let seed1Steps: TiebreakerLogStep[] = [];
    if (Array.isArray(result)) {
      const { steps: multiSteps } = loggedMultiTB(standings[0], 1);
      const { winner, steps: twoSteps } = loggedTwoTeamTB(result, 1);
      seed1 = winner;
      seed1Steps = [...multiSteps, ...twoSteps];
    } else {
      const { steps } = loggedMultiTB(standings[0], 1);
      seed1 = result;
      seed1Steps = steps;
    }
    seedingLog.push({ seed: 1, teamName: seed1.name, method: 'tiebreaker', steps: seed1Steps });

    const remaining = standings[0].filter((t) => t.name !== seed1!.name);
    if (remaining.length === 2) {
      const { winner, steps } = loggedTwoTeamTB(remaining, 2);
      seed2 = winner;
      seedingLog.push({ seed: 2, teamName: seed2.name, method: 'tiebreaker', steps });
    } else if (remaining.length === 1) {
      seed2 = remaining[0];
      seedingLog.push({ seed: 2, teamName: seed2.name, method: 'outright', steps: [] });
    } else {
      const result2 = multiTeamTiebreaker(remaining);
      if (Array.isArray(result2)) {
        const { steps: multiSteps } = loggedMultiTB(remaining, 2);
        const { winner, steps: twoSteps } = loggedTwoTeamTB(result2, 2);
        seed2 = winner;
        seedingLog.push({ seed: 2, teamName: seed2.name, method: 'tiebreaker', steps: [...multiSteps, ...twoSteps] });
      } else {
        const { steps } = loggedMultiTB(remaining, 2);
        seed2 = result2;
        seedingLog.push({ seed: 2, teamName: seed2.name, method: 'tiebreaker', steps });
      }
    }
  }

  return {
    ccgParticipants: seed1 && seed2 ? [seed1.name, seed2.name] : null,
    usedRandomDraw: _usedRandomDraw,
    standings: standings.map((tier) => tier.map((t) => t.name)),
    seedingLog,
  };
}

function secChampionshipSeeder(state: ConferenceState): TiebreakerResult {
  _usedRandomDraw = false;
  const allTeamNames = state.teamNames;
  const allTeams = state.teams;
  const standings = buildStandings(state);

  const namedTBs: NamedTiebreaker[] = [
    { name: 'headToHead', fn: (atn, at, tt, s) => headToHead(atn, at, tt, s, { eliminateOverallLoser: true }) },
    { name: 'againstAllCommonOpponents', fn: againstAllCommonOpponents },
    { name: 'againstHighestCommonOpponent', fn: (atn, at, tt, s) => againstHighestCommonOpponent(atn, at, tt, s, { tierTiebreaker: (tt2) => headToHead(atn, at, tt2, s, { eliminateOverallLoser: true }), abortAfterAnyChange: true }) },
    { name: 'strengthOfConferenceSchedule', fn: strengthOfConferenceSchedule },
    { name: 'cappedRelativeScoringMargin', fn: cappedRelativeScoringMargin },
    { name: 'randomDraw', fn: randomDraw },
  ];

  const loggedTwoTeamTB = makeLoggedTwoTeamTiebreaker(namedTBs, allTeamNames, allTeams, standings);
  const loggedMultiTB = makeLoggedMultiTeamTiebreaker(namedTBs, allTeamNames, allTeams, standings);

  let seed1: TeamRecord | null = null;
  let seed2: TeamRecord | null = null;
  let tier1 = standings[0];
  let tier2 = standings.length > 1 ? standings[1] : [];
  const seedingLog: SeedingLog[] = [];
  let seed1Steps: TiebreakerLogStep[] = [];
  let seed2Steps: TiebreakerLogStep[] = [];

  while (seed1 === null) {
    if (tier1.length === 1) {
      seed1 = tier1[0];
    } else if (tier1.length === 2) {
      const { winner, loser, steps } = loggedTwoTeamTB(tier1, 1);
      seed1 = winner;
      seed2 = loser;
      seed1Steps = steps;
      seed2Steps = [...steps];
    } else {
      const { advancers, steps } = loggedMultiTB(tier1, 1);
      seed1Steps.push(...steps);
      if (advancers.length === 1) {
        seed1 = advancers[0];
        tier2 = tier1.filter((t) => t.name !== seed1!.name);
      } else {
        tier1 = advancers;
      }
    }
  }
  seedingLog.push({ seed: 1, teamName: seed1.name, method: tier1.length === 1 && seed1Steps.length === 0 ? 'outright' : 'tiebreaker', steps: seed1Steps });

  while (seed2 === null) {
    if (tier2.length === 1) {
      seed2 = tier2[0];
    } else if (tier2.length === 2) {
      const { winner, steps } = loggedTwoTeamTB(tier2, 2);
      seed2 = winner;
      seed2Steps.push(...steps);
    } else if (tier2.length > 2) {
      const { advancers: adv, steps } = loggedMultiTB(tier2, 2);
      seed2Steps.push(...steps);
      tier2 = adv;
    } else {
      break;
    }
  }
  if (seed2) {
    seedingLog.push({ seed: 2, teamName: seed2.name, method: seed2Steps.length === 0 ? 'outright' : 'tiebreaker', steps: seed2Steps });
  }

  return {
    ccgParticipants: seed1 && seed2 ? [seed1.name, seed2.name] : null,
    usedRandomDraw: _usedRandomDraw,
    standings: standings.map((tier) => tier.map((t) => t.name)),
    seedingLog,
  };
}

function b10ChampionshipSeeder(state: ConferenceState): TiebreakerResult {
  _usedRandomDraw = false;
  const allTeamNames = state.teamNames;
  const allTeams = state.teams;
  const standings = buildStandings(state);

  const tiebreakers: TiebreakerFn[] = [
    (atn, at, tt, s) => headToHead(atn, at, tt, s),
    againstAllCommonOpponents,
    (atn, at, tt, s) => againstHighestCommonOpponent(atn, at, tt, s),
    strengthOfConferenceSchedule,
    randomDraw,
  ];

  const namedTBs: NamedTiebreaker[] = [
    { name: 'headToHead', fn: (atn, at, tt, s) => headToHead(atn, at, tt, s) },
    { name: 'againstAllCommonOpponents', fn: againstAllCommonOpponents },
    { name: 'againstHighestCommonOpponent', fn: (atn, at, tt, s) => againstHighestCommonOpponent(atn, at, tt, s) },
    { name: 'strengthOfConferenceSchedule', fn: strengthOfConferenceSchedule },
    { name: 'randomDraw', fn: randomDraw },
  ];

  const loggedTwoTeamTB = makeLoggedTwoTeamTiebreaker(namedTBs, allTeamNames, allTeams, standings);
  const loggedMultiTB = makeLoggedMultiTeamTiebreaker(namedTBs, allTeamNames, allTeams, standings);

  function multiTeamTiebreaker(tiedTeams: TeamRecord[]): TeamRecord | [TeamRecord, TeamRecord[]] | TeamRecord[] {
    for (const tb of tiebreakers) {
      const result = tb(allTeamNames, allTeams, tiedTeams, standings);
      if (result.length > 1) {
        if (result[0].length === 1) return [result[0][0], result[1]] as [TeamRecord, TeamRecord[]];
        if (result[0].length === 2) return result[0];
        tiedTeams = result[0];
      }
    }
    return tiedTeams;
  }

  let seed1: TeamRecord | null = null;
  let seed2: TeamRecord | null = null;
  let tier1 = standings[0];
  let tier2 = standings.length > 1 ? standings[1] : [];
  const seedingLog: SeedingLog[] = [];
  let seed1Steps: TiebreakerLogStep[] = [];
  let seed2Steps: TiebreakerLogStep[] = [];

  while (seed1 === null) {
    if (tier1.length === 1) {
      seed1 = tier1[0];
    } else if (tier1.length === 2) {
      const { winner, loser, steps } = loggedTwoTeamTB(tier1, 1);
      seed1 = winner;
      seed2 = loser;
      seed1Steps = steps;
      seed2Steps = [...steps];
    } else {
      const result = multiTeamTiebreaker(tier1);
      const { steps } = loggedMultiTB(tier1, 1);
      seed1Steps.push(...steps);
      if (Array.isArray(result) && result.length === 2 && !Array.isArray(result[0]) && Array.isArray(result[1])) {
        seed1 = result[0] as TeamRecord;
        tier2 = result[1] as TeamRecord[];
      } else if (Array.isArray(result)) {
        tier1 = result as TeamRecord[];
      } else {
        seed1 = result;
      }
    }
  }
  seedingLog.push({ seed: 1, teamName: seed1.name, method: seed1Steps.length === 0 ? 'outright' : 'tiebreaker', steps: seed1Steps });

  while (seed2 === null) {
    if (tier2.length === 1) {
      seed2 = tier2[0];
    } else if (tier2.length === 2) {
      const { winner, steps } = loggedTwoTeamTB(tier2, 2);
      seed2 = winner;
      seed2Steps.push(...steps);
    } else if (tier2.length > 2) {
      const result = multiTeamTiebreaker(tier2);
      const { steps } = loggedMultiTB(tier2, 2);
      seed2Steps.push(...steps);
      if (Array.isArray(result) && result.length === 2 && !Array.isArray(result[0]) && Array.isArray(result[1])) {
        seed2 = result[0] as TeamRecord;
      } else if (Array.isArray(result)) {
        tier2 = result as TeamRecord[];
      } else {
        seed2 = result;
      }
    } else {
      break;
    }
  }
  if (seed2) {
    seedingLog.push({ seed: 2, teamName: seed2.name, method: seed2Steps.length === 0 ? 'outright' : 'tiebreaker', steps: seed2Steps });
  }

  return {
    ccgParticipants: seed1 && seed2 ? [seed1.name, seed2.name] : null,
    usedRandomDraw: _usedRandomDraw,
    standings: standings.map((tier) => tier.map((t) => t.name)),
    seedingLog,
  };
}

function accChampionshipSeeder(state: ConferenceState): TiebreakerResult {
  _usedRandomDraw = false;
  const allTeamNames = state.teamNames;
  const allTeams = state.teams;
  const standings = buildStandings(state);

  const tiebreakers: TiebreakerFn[] = [
    (atn, at, tt, s) => headToHead(atn, at, tt, s, { eliminateOverallLoser: true }),
    againstAllCommonOpponents,
    (atn, at, tt, s) =>
      againstHighestCommonOpponent(atn, at, tt, s, {
        tierTiebreaker: (tt2) => headToHead(atn, at, tt2, s, { eliminateOverallLoser: true }),
        abortAfterAnyChange: true,
      }),
    strengthOfConferenceSchedule,
    randomDraw,
  ];

  const namedTBs: NamedTiebreaker[] = [
    { name: 'headToHead', fn: (atn, at, tt, s) => headToHead(atn, at, tt, s, { eliminateOverallLoser: true }) },
    { name: 'againstAllCommonOpponents', fn: againstAllCommonOpponents },
    { name: 'againstHighestCommonOpponent', fn: (atn, at, tt, s) => againstHighestCommonOpponent(atn, at, tt, s, { tierTiebreaker: (tt2) => headToHead(atn, at, tt2, s, { eliminateOverallLoser: true }), abortAfterAnyChange: true }) },
    { name: 'strengthOfConferenceSchedule', fn: strengthOfConferenceSchedule },
    { name: 'randomDraw', fn: randomDraw },
  ];

  const loggedTwoTeamTB = makeLoggedTwoTeamTiebreaker(namedTBs, allTeamNames, allTeams, standings);
  const loggedMultiTB = makeLoggedMultiTeamTiebreaker(namedTBs, allTeamNames, allTeams, standings);

  function multiTeamTiebreaker(tiedTeams: TeamRecord[]): TeamRecord[] {
    for (const tb of tiebreakers) {
      const result = tb(allTeamNames, allTeams, tiedTeams, standings);
      if (result.length > 1) return result[0];
    }
    return tiedTeams;
  }

  let seed1: TeamRecord | null = null;
  let seed2: TeamRecord | null = null;
  let tier1 = standings[0];
  let tier2 = standings.length > 1 ? standings[1] : [];
  const seedingLog: SeedingLog[] = [];
  let seed1Steps: TiebreakerLogStep[] = [];
  let seed2Steps: TiebreakerLogStep[] = [];

  while (seed1 === null) {
    if (tier1.length === 1) {
      seed1 = tier1[0];
    } else if (tier1.length === 2) {
      const { winner, loser, steps } = loggedTwoTeamTB(tier1, 1);
      seed1 = winner;
      seed2 = loser;
      seed1Steps = steps;
      seed2Steps = [...steps];
    } else {
      const candidates = multiTeamTiebreaker(tier1);
      const { steps } = loggedMultiTB(tier1, 1);
      seed1Steps.push(...steps);
      if (candidates.length === 1) {
        seed1 = candidates[0];
        tier2 = tier1.filter((t) => t.name !== seed1!.name);
      } else {
        tier1 = candidates;
      }
    }
  }
  seedingLog.push({ seed: 1, teamName: seed1.name, method: seed1Steps.length === 0 ? 'outright' : 'tiebreaker', steps: seed1Steps });

  while (seed2 === null) {
    if (tier2.length === 1) {
      seed2 = tier2[0];
    } else if (tier2.length === 2) {
      const { winner, steps } = loggedTwoTeamTB(tier2, 2);
      seed2 = winner;
      seed2Steps.push(...steps);
    } else if (tier2.length > 2) {
      const { steps } = loggedMultiTB(tier2, 2);
      seed2Steps.push(...steps);
      tier2 = multiTeamTiebreaker(tier2);
    } else {
      break;
    }
  }
  if (seed2) {
    seedingLog.push({ seed: 2, teamName: seed2.name, method: seed2Steps.length === 0 ? 'outright' : 'tiebreaker', steps: seed2Steps });
  }

  return {
    ccgParticipants: seed1 && seed2 ? [seed1.name, seed2.name] : null,
    usedRandomDraw: _usedRandomDraw,
    standings: standings.map((tier) => tier.map((t) => t.name)),
    seedingLog,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const conferenceSeeders: Record<string, Seeder> = {
  B12: big12ChampionshipSeeder,
  SEC: secChampionshipSeeder,
  B10: b10ChampionshipSeeder,
  ACC: accChampionshipSeeder,
};

/**
 * Resolve the conference championship game participants given a fully-resolved
 * conference state (all games have outcomes).
 */
export function resolveChampionship(state: ConferenceState): TiebreakerResult {
  const seeder = conferenceSeeders[state.name];
  if (!seeder) {
    return { ccgParticipants: null, usedRandomDraw: false, standings: [] };
  }
  return seeder(state);
}

export { buildStandings };
