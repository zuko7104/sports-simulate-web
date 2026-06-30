import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { TeamLogo } from './TeamLogo';
import { dateToWeekNumber } from '../utils/dateUtils';
import type { SeasonTeams, ConferenceProbabilities, CCGMatchups } from '../types';

interface GameInfo {
  gameKey: string;
  teams: [string, string];
  team1WinProb: number;
  date: string | null;
}

interface AggregatedProbabilities {
  ccg_probabilities: Record<string, number>;
  top_ccg_matchups: { teams: [string, string]; probability: number }[];
  matchingScenarios: number;
  totalScenarios: number;
}

interface WhatIfPickerProps {
  teams: SeasonTeams;
  conference: string;
  selectedWinners: Record<string, string>;
  onSelectWinner: (game: string, winner: string) => void;
  onClear: () => void;
  onFillFavorites: () => void;
  probabilities: AggregatedProbabilities | null;
  dashboardProbabilities?: ConferenceProbabilities | null;
  dashboardMatchups?: CCGMatchups | null;
  gameInfos: GameInfo[];
  selectionProbability: number;
  week1Start?: string;
}

interface WeekGroup {
  weekLabel: string;
  dateGroups: DateGroup[];
}

interface DateGroup {
  dateLabel: string;
  games: GameInfo[];
}

function formatDateLabel(date: Date): string {
  const options: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' };
  return date.toLocaleDateString('en-US', options);
}

function getWeekNumber(date: Date): number {
  // Get the week number (Sunday-Saturday weeks)
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
  return Math.ceil((days + startOfYear.getDay() + 1) / 7);
}

function groupGamesByWeek(gameInfos: GameInfo[], week1Start?: string): WeekGroup[] {
  // First, sort all games by date, then by away team (team1) alphabetically
  const sortedGames = [...gameInfos].sort((a, b) => {
    // Sort by date first
    const dateA = a.date ?? '9999-99-99';
    const dateB = b.date ?? '9999-99-99';
    if (dateA !== dateB) {
      return dateA.localeCompare(dateB);
    }
    // Then by away team (team1) alphabetically
    return a.teams[0].localeCompare(b.teams[0]);
  });

  // Group games by week, then by date within each week
  const weekMap = new Map<number, Map<string, GameInfo[]>>();

  for (const game of sortedGames) {
    let weekNum: number;
    let dateKey: string;

    if (!game.date) {
      weekNum = -1;
      dateKey = 'TBD';
    } else {
      const date = new Date(game.date + 'T12:00:00');
      weekNum = week1Start
        ? dateToWeekNumber(game.date, week1Start)
        : getWeekNumber(date);
      dateKey = game.date;
    }

    if (!weekMap.has(weekNum)) {
      weekMap.set(weekNum, new Map());
    }
    const dateMap = weekMap.get(weekNum)!;
    if (!dateMap.has(dateKey)) {
      dateMap.set(dateKey, []);
    }
    dateMap.get(dateKey)!.push(game);
  }

  // Sort weeks and build result
  const sortedWeeks = Array.from(weekMap.keys()).sort((a, b) => a - b);

  return sortedWeeks.map((weekNum) => {
    const dateMap = weekMap.get(weekNum)!;
    const sortedDates = Array.from(dateMap.keys()).sort();

    const dateGroups: DateGroup[] = sortedDates.map((dateKey) => {
      let dateLabel: string;
      if (dateKey === 'TBD') {
        dateLabel = 'TBD';
      } else {
        const date = new Date(dateKey + 'T12:00:00');
        dateLabel = formatDateLabel(date);
      }
      return {
        dateLabel,
        games: dateMap.get(dateKey)!,
      };
    });

    const weekLabel = weekNum === -1 ? 'TBD' : `Week ${weekNum}`;

    return { weekLabel, dateGroups };
  });
}

export function WhatIfPicker({
  teams,
  conference,
  selectedWinners,
  onSelectWinner,
  onClear,
  onFillFavorites,
  probabilities,
  dashboardProbabilities,
  dashboardMatchups,
  gameInfos,
  selectionProbability,
  week1Start,
}: WhatIfPickerProps) {
  const selectedCount = Object.keys(selectedWinners).length;

  // When no games are selected, use the dashboard's pre-computed data
  const effectiveProbabilities = useMemo<AggregatedProbabilities | null>(() => {
    if (selectedCount > 0 || !dashboardProbabilities) return probabilities;
    const ccg_probabilities: Record<string, number> = {};
    for (const [teamName, teamProbs] of Object.entries(dashboardProbabilities.teams)) {
      ccg_probabilities[teamName] = teamProbs.ccg_probability;
    }
    const top_ccg_matchups = (dashboardMatchups?.matchups ?? []).map((m) => ({
      teams: [m.team_a, m.team_b] as [string, string],
      probability: m.probability,
    }));
    return {
      ccg_probabilities,
      top_ccg_matchups,
      matchingScenarios: probabilities?.totalScenarios ?? 0,
      totalScenarios: probabilities?.totalScenarios ?? 0,
    };
  }, [selectedCount, dashboardProbabilities, dashboardMatchups, probabilities]);

  // Group games by week
  const weekGroups = useMemo(() => groupGamesByWeek(gameInfos, week1Start), [gameInfos, week1Start]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left Column: Game Picker */}
      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <h2 className="card-header mb-0 border-0 pb-0">Pick Game Winners</h2>
          <div className="flex gap-2">
            <button
              onClick={onFillFavorites}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Fill Favorites
            </button>
            {selectedCount > 0 && (
              <button
                onClick={onClear}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Clear All
              </button>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {weekGroups.map((week) => (
            <div key={week.weekLabel}>
              <h3 className="text-sm font-semibold text-gray-700 mb-2 border-b border-gray-200 pb-1">
                {week.weekLabel}
              </h3>
              <div className="space-y-3">
                {week.dateGroups.map((dateGroup) => (
                  <div key={dateGroup.dateLabel}>
                    <h4 className="text-xs text-gray-500 mb-1.5 ml-1">
                      {dateGroup.dateLabel}
                    </h4>
                    <div className="space-y-2">
                      {dateGroup.games.map((game) => {
                        const [team1, team2] = game.teams;
                        const selected = selectedWinners[game.gameKey];
                        const team1Meta = teams.teams[team1];
                        const team2Meta = teams.teams[team2];
                        const team1Pct = Math.round(game.team1WinProb * 100);
                        const team2Pct = 100 - team1Pct;

                        return (
                          <div key={game.gameKey} className="flex items-center gap-2">
                            <button
                              onClick={() => onSelectWinner(game.gameKey, team1)}
                              className={`flex-1 flex items-center justify-between gap-2 py-2 px-3 rounded-lg border-2 transition-all ${
                                selected === team1
                                  ? 'border-green-500 bg-green-50'
                                  : 'border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <TeamLogo team={team1} size="sm" />
                                <span className={selected === team1 ? 'font-semibold' : ''}>
                                  {team1Meta?.display_name ?? team1}
                                </span>
                              </div>
                              <span className={`text-xs font-mono ${team1Pct >= 50 ? 'text-green-600' : 'text-gray-400'}`}>
                                {team1Pct}%
                              </span>
                            </button>

                            <span className="text-gray-400 text-sm">@</span>

                            <button
                              onClick={() => onSelectWinner(game.gameKey, team2)}
                              className={`flex-1 flex items-center justify-between gap-2 py-2 px-3 rounded-lg border-2 transition-all ${
                                selected === team2
                                  ? 'border-green-500 bg-green-50'
                                  : 'border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <TeamLogo team={team2} size="sm" />
                                <span className={selected === team2 ? 'font-semibold' : ''}>
                                  {team2Meta?.display_name ?? team2}
                                </span>
                              </div>
                              <span className={`text-xs font-mono ${team2Pct >= 50 ? 'text-green-600' : 'text-gray-400'}`}>
                                {team2Pct}%
                              </span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {selectedCount > 0 && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-700">
              <strong>{selectedCount}</strong> of {gameInfos.length} games selected
            </p>
            <p className="text-sm text-blue-600 mt-1">
              Probability of this combination:{' '}
              <strong className="font-mono">{selectionProbability > 0 && selectionProbability < 0.001 ? '<0.1' : (selectionProbability * 100).toFixed(1)}%</strong>
            </p>
          </div>
        )}
      </div>

      {/* Right Column: Probabilities */}
      <div className="space-y-6">
        {/* CCG Probabilities */}
        <div className="card">
          <h2 className="card-header">
            CCG Probabilities
            {selectedCount > 0 && (
              <span className="text-sm font-normal text-gray-500 ml-2">
                (with selected outcomes)
              </span>
            )}
          </h2>

          {effectiveProbabilities ? (
            <div className="space-y-2">
              {(() => {
                // Build entries for all conference teams
                const confTeams = teams.conferences[conference]?.teams ?? [];
                const entries: [string, number][] = confTeams.map((t) => [
                  t,
                  effectiveProbabilities.ccg_probabilities[t] ?? 0,
                ]);
                return entries
                  .sort(([, a], [, b]) => b - a)
                  .map(([teamName, prob]) => {
                    const teamMeta = teams.teams[teamName];
                    const percentage = prob > 0 && prob < 0.001 ? '<0.1' : (prob * 100).toFixed(1);

                    return (
                      <div key={teamName} className="flex items-center gap-3">
                        <TeamLogo team={teamName} size="sm" />
                        <Link to={`/${conference}/teams/${encodeURIComponent(teamName)}`} className="font-medium flex-1 hover:underline">
                          {teamMeta?.display_name ?? teamName}
                        </Link>
                        <span className="font-mono text-sm w-16 text-right">{percentage}%</span>
                        <div className="w-24 bg-gray-200 rounded h-3 overflow-hidden">
                          <div
                            className="h-full rounded"
                            style={{
                              width: `${prob * 100}%`,
                              backgroundColor: teamMeta?.primary_color ?? '#666',
                            }}
                          />
                        </div>
                      </div>
                    );
                  });
              })()}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No CCG probabilities available</p>
          )}
        </div>

        {/* Top CCG Matchups */}
        <div className="card">
          <h2 className="card-header">
            Top CCG Matchups
          </h2>

          {effectiveProbabilities && effectiveProbabilities.top_ccg_matchups.length > 0 ? (
            (() => {
              const filtered = effectiveProbabilities.top_ccg_matchups.filter((m) => m.probability >= 0.005);
              const excludedCount = effectiveProbabilities.top_ccg_matchups.length - filtered.length;
              return (
                <>
                  <table className="w-full text-sm">
                    <tbody>
                      {filtered.map((matchup, idx) => (
                        <tr key={idx} className="border-b border-gray-100">
                          <td className="py-1.5 pr-2 text-gray-400 w-6 text-right">{idx + 1}.</td>
                          <td className="py-1.5 pr-1 w-6"><TeamLogo team={matchup.teams[0]} size="sm" /></td>
                          <td className="py-1.5 pr-2">
                            <Link to={`/${conference}/teams/${encodeURIComponent(matchup.teams[0])}`} className="hover:underline">{teams.teams[matchup.teams[0]]?.display_name ?? matchup.teams[0]}</Link>
                          </td>
                          <td className="py-1.5 px-2 text-gray-400 text-center">vs</td>
                          <td className="py-1.5 pr-1 w-6"><TeamLogo team={matchup.teams[1]} size="sm" /></td>
                          <td className="py-1.5 pr-2">
                            <Link to={`/${conference}/teams/${encodeURIComponent(matchup.teams[1])}`} className="hover:underline">{teams.teams[matchup.teams[1]]?.display_name ?? matchup.teams[1]}</Link>
                          </td>
                          <td className="py-1.5 font-mono text-right">
                            {(matchup.probability * 100).toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {excludedCount > 0 && (
                    <p className="text-xs text-gray-500 mt-2">
                      {excludedCount} additional matchup{excludedCount !== 1 ? 's' : ''} below 0.5% not shown
                    </p>
                  )}
                </>
              );
            })()
          ) : (
            <p className="text-gray-500 text-sm">No matchup data available</p>
          )}
        </div>
      </div>
    </div>
  );
}
