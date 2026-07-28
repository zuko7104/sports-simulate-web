import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { TeamLogoFor } from './TeamLogo';
import { TeamName } from './TeamName';
import { RankingBadge } from './RankingBadge';
import type { WeekImpact, SeasonTeams, EveryOutcome } from '../types';
import { teamPath } from '../utils/routes';
import { gameSortKey } from '../utils/dateUtils';
import { orderGames, collapseClinchOutcomes, gameKeyFor } from '../utils/ccgOutcomeCollapse';
import type { ResolvedRanking } from '../utils/rankings';

interface WeekImpactTableProps {
  weekImpact: WeekImpact;
  teams: SeasonTeams;
  selectedTeam?: string;
  showTeamSelector?: boolean;
  conference?: string;
  sport?: string;
  season?: string;
  historicalDate?: string;
  /** Powers "Ways to Clinch CCG Spot This Week" — omit to hide that section. */
  everyOutcome?: EveryOutcome | null;
  rankings?: Record<string, ResolvedRanking> | null;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatImpact(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${(value * 100).toFixed(1)}%`;
}

function impactColor(value: number): string {
  if (value > 0.05) return 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-500/15';
  if (value > 0.01) return 'text-green-600 dark:text-green-400';
  if (value < -0.05) return 'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950';
  if (value < -0.01) return 'text-red-600 dark:text-red-400';
  return 'text-gray-500 dark:text-gray-400';
}

export function WeekImpactTable({ weekImpact, teams, selectedTeam, showTeamSelector = false, conference, sport, season, historicalDate, everyOutcome, rankings }: WeekImpactTableProps) {
  const teamNames = Object.keys(weekImpact.teams).sort(
    (a, b) => (weekImpact.teams[b].current_ccg_probability) - (weekImpact.teams[a].current_ccg_probability)
  );

  const [selectorTeam, setSelectorTeam] = useState<string>(selectedTeam ?? teamNames[0] ?? '');
  const [hoveredTeam, setHoveredTeam] = useState<string | null>(null);
  const activeTeam = selectedTeam ?? selectorTeam;

  const orderedGames = useMemo(() => (everyOutcome ? orderGames(everyOutcome) : []), [everyOutcome]);

  // The Ways to Lock table's underlying data source, filtered to just
  // `activeTeam` clinching a spot (not a specific matchup) — replaces a
  // separate (and inconsistent) backend computation that only considered
  // this week's games in isolation. Rows are already collapsed to the
  // simplest set of deciding games; every row is at/above ~100% confidence
  // by construction (see collapseClinchOutcomes). A heavily-favored team can
  // have thousands of long-shot combinations that technically clinch it -
  // filtered out here the same way Ways to Lock hides its own unlikely tail,
  // since this compact card (unlike that full page) has no room for a
  // "show more" toggle.
  const CLINCH_ROW_PROBABILITY_FLOOR = 0.001;
  const clinchRows = useMemo(() => {
    if (!everyOutcome || !activeTeam) return [];
    return collapseClinchOutcomes(everyOutcome, orderedGames, activeTeam)
      .filter((row) => row.probability >= CLINCH_ROW_PROBABILITY_FLOOR);
  }, [everyOutcome, orderedGames, activeTeam]);

  const teamImpact = weekImpact.teams[activeTeam];
  if (!teamImpact) return null;

  const sortedGameImpacts = (() => {
    if (!everyOutcome) return teamImpact.game_impacts;
    const dates = everyOutcome.game_dates ?? {};
    const kickoffs = everyOutcome.game_kickoffs ?? {};
    return [...teamImpact.game_impacts].sort((a, b) => {
      const keyA = gameKeyFor([a.away_team, a.home_team]);
      const keyB = gameKeyFor([b.away_team, b.home_team]);
      const sortA = gameSortKey(dates[keyA] ?? '9999-99-99', kickoffs[keyA], a.away_team);
      const sortB = gameSortKey(dates[keyB] ?? '9999-99-99', kickoffs[keyB], b.away_team);
      return sortA.localeCompare(sortB);
    });
  })();

  const hasClinching = clinchRows.length > 0;

  const content = (
    <div>
      {showTeamSelector && (
        <>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            This Week's Impact on CCG Odds
          </h3>
          <div className="flex flex-wrap gap-2 mb-4">
            {teamNames.map((team) => {
              const meta = teams.teams[team];
              const impact = weekImpact.teams[team];
              if (!impact || impact.current_ccg_probability < 0.001) return null;
              return (
                <button
                  key={team}
                  onClick={() => setSelectorTeam(team)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    activeTeam === team
                      ? 'bg-gray-800 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  <TeamLogoFor team={team} teams={teams} size="xs" />
                  {meta?.display_name ?? team}
                  <RankingBadge team={team} rankings={rankings} />
                </button>
              );
            })}
          </div>
          <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-center">
            <span className="text-sm text-gray-600 dark:text-gray-400">Current CCG Probability: </span>
            <span className="text-lg font-bold font-mono">
              {formatPercent(teamImpact.current_ccg_probability)}
            </span>
          </div>
        </>
      )}

      {/* Per-game impact table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-1 px-1 sm:py-2 sm:px-2">Game</th>
              <th className="text-center py-1 px-1 sm:py-2 sm:px-2">
                <div className="flex flex-col items-center gap-0.5">
                  <TeamLogoFor team={activeTeam} teams={teams} size="xs" />
                  <span>CCG Odds</span>
                  <span className="font-normal text-gray-500 dark:text-gray-400">
                    <span className="hidden sm:inline">If Away Wins</span>
                    <span className="sm:hidden">Away</span>
                  </span>
                </div>
              </th>
              <th className="text-center py-1 px-1 sm:py-2 sm:px-2">
                <div className="flex flex-col items-center gap-0.5">
                  <TeamLogoFor team={activeTeam} teams={teams} size="xs" />
                  <span>CCG Odds</span>
                  <span className="font-normal text-gray-500 dark:text-gray-400">
                    <span className="hidden sm:inline">If Home Wins</span>
                    <span className="sm:hidden">Home</span>
                  </span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedGameImpacts.map((game, i) => {
              const isHighlighted = hoveredTeam === game.away_team || hoveredTeam === game.home_team;
              return (
              <tr key={i} className={`border-b border-gray-100 dark:border-gray-800 transition-colors ${isHighlighted ? 'bg-yellow-100 dark:bg-yellow-500/20' : ''}`}>
                <td className="py-1 px-1 sm:py-2 sm:px-2">
                  <div className="flex items-center gap-1">
                    <TeamLogoFor team={game.away_team} teams={teams} size="xs" />
                    <Link
                      to={`${teamPath(teams.teams[game.away_team]?.conference ?? conference ?? 'B12', game.away_team, sport, season)}${historicalDate ? `?date=${historicalDate}` : ''}`}
                      className="text-xs sm:text-sm hover:text-blue-600 dark:hover:text-blue-400 hover:underline whitespace-nowrap"
                    >
                      <TeamName team={game.away_team} teams={teams} rankings={rankings} />
                    </Link>
                    <span className="text-xs text-gray-400 dark:text-gray-500">@</span>
                    <TeamLogoFor team={game.home_team} teams={teams} size="xs" />
                    <Link
                      to={`${teamPath(teams.teams[game.home_team]?.conference ?? conference ?? 'B12', game.home_team, sport, season)}${historicalDate ? `?date=${historicalDate}` : ''}`}
                      className="text-xs sm:text-sm hover:text-blue-600 dark:hover:text-blue-400 hover:underline whitespace-nowrap"
                    >
                      <TeamName team={game.home_team} teams={teams} rankings={rankings} />
                    </Link>
                  </div>
                </td>
                <td className={`text-center py-1 px-1 sm:py-2 sm:px-2 font-mono text-xs ${impactColor(game.impact_if_away_wins)}`}>
                  {formatPercent(game.ccg_prob_if_away_wins)}
                  <br />
                  <span className="text-xs">
                    ({formatImpact(game.impact_if_away_wins)})
                  </span>
                </td>
                <td className={`text-center py-1 px-1 sm:py-2 sm:px-2 font-mono text-xs ${impactColor(game.impact_if_home_wins)}`}>
                  {formatPercent(game.ccg_prob_if_home_wins)}
                  <br />
                  <span className="text-xs">
                    ({formatImpact(game.impact_if_home_wins)})
                  </span>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Best outcomes */}
      {(teamImpact.best_outcome || teamImpact.best_realistic_outcome) && (
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {teamImpact.best_outcome && (
            <div className="p-3 bg-green-50 dark:bg-green-500/10 rounded-lg border border-green-200 dark:border-green-900">
              <h4 className="text-xs font-semibold text-green-800 dark:text-green-300 mb-1 flex items-center gap-1">
                Best Winner Combination for <TeamLogoFor team={activeTeam} teams={teams} size="xs" />
              </h4>
              <div className="flex flex-wrap gap-1 mb-1">
                {teamImpact.best_outcome.winners.map((w) => (
                  <span
                    key={w}
                    className="flex items-center gap-1 text-xs bg-white dark:bg-gray-800 px-1.5 py-0.5 rounded cursor-default"
                    onMouseEnter={() => setHoveredTeam(w)}
                    onMouseLeave={() => setHoveredTeam(null)}
                  >
                    <TeamLogoFor team={w} teams={teams} size="xs" />
                    {teams.teams[w]?.display_name ?? w}
                    <RankingBadge team={w} rankings={rankings} />
                  </span>
                ))}
              </div>
              <p className="text-xs text-green-700 dark:text-green-400">
                CCG: <strong>{formatPercent(teamImpact.best_outcome.ccg_probability)}</strong>
                {' '}• Scenario: {formatPercent(teamImpact.best_outcome.probability)}
              </p>
            </div>
          )}
          {teamImpact.best_realistic_outcome && (
            <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
              <h4 className="text-xs font-semibold text-blue-800 dark:text-blue-300 mb-1 flex items-center gap-1">
                Most Realistic Good Winner Combination for <TeamLogoFor team={activeTeam} teams={teams} size="xs" />
              </h4>
              <div className="flex flex-wrap gap-1 mb-1">
                {teamImpact.best_realistic_outcome.winners.map((w) => (
                  <span
                    key={w}
                    className="flex items-center gap-1 text-xs bg-white dark:bg-gray-800 px-1.5 py-0.5 rounded cursor-default"
                    onMouseEnter={() => setHoveredTeam(w)}
                    onMouseLeave={() => setHoveredTeam(null)}
                  >
                    <TeamLogoFor team={w} teams={teams} size="xs" />
                    {teams.teams[w]?.display_name ?? w}
                    <RankingBadge team={w} rankings={rankings} />
                  </span>
                ))}
              </div>
              <p className="text-xs text-blue-700 dark:text-blue-300">
                CCG: <strong>{formatPercent(teamImpact.best_realistic_outcome.ccg_probability)}</strong>
                {' '}• Scenario: {formatPercent(teamImpact.best_realistic_outcome.probability)}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Clinching scenarios */}
      {hasClinching && (
        <div className="mt-4">
          <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">
            Ways to Clinch CCG Spot This Week
          </h4>
          <div className="space-y-2">
            {clinchRows.slice(0, 10).map((row, i) => {
              const winners = row.gameOutcomes.filter((w): w is string => w !== null);
              return (
                <div key={i} className="flex items-center justify-between p-2 bg-yellow-50 dark:bg-yellow-950 rounded border border-yellow-200 dark:border-yellow-800">
                  <div className="flex flex-wrap gap-1">
                    {winners.length === 0 ? (
                      <span className="text-xs italic text-yellow-800 dark:text-yellow-400">Already locked in</span>
                    ) : (
                      winners.map((w, wi) => (
                        <span
                          key={`${w}-${wi}`}
                          className="flex items-center gap-1 text-xs bg-white dark:bg-gray-800 px-1.5 py-0.5 rounded cursor-default"
                          onMouseEnter={() => setHoveredTeam(w)}
                          onMouseLeave={() => setHoveredTeam(null)}
                        >
                          <TeamLogoFor team={w} teams={teams} size="xs" />
                          {teams.teams[w]?.display_name ?? w}
                        </span>
                      ))
                    )}
                  </div>
                  <span className="text-xs font-mono text-yellow-800 dark:text-yellow-400 ml-2">
                    {formatPercent(row.probability)}
                  </span>
                </div>
              );
            })}
            {clinchRows.length > 10 && (
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                +{clinchRows.length - 10} more clinching scenarios
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );

  if (showTeamSelector) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        {content}
      </div>
    );
  }

  return content;
}
