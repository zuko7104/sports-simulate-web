import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { TeamLogoFor } from './TeamLogo';
import { RankingBadge } from './RankingBadge';
import { groupGamesByWeek } from '../utils/groupGamesByWeek';
import type { SeasonTeams, ConferenceProbabilities, CCGMatchups } from '../types';
import type { ResolvedRanking } from '../utils/rankings';
import { teamPath } from '../utils/routes';

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
  sport?: string;
  season?: string;
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
  rankings?: Record<string, ResolvedRanking> | null;
}

export function WhatIfPicker({
  teams,
  conference,
  sport,
  season,
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
  rankings,
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
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
            >
              Fill Favorites
            </button>
            {selectedCount > 0 && (
              <button
                onClick={onClear}
                className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              >
                Clear All
              </button>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {weekGroups.map((week) => (
            <div key={week.weekLabel}>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 border-b border-gray-200 dark:border-gray-700 pb-1">
                {week.weekLabel}
              </h3>
              <div className="space-y-3">
                {week.dateGroups.map((dateGroup) => (
                  <div key={dateGroup.dateLabel}>
                    <h4 className="text-xs text-gray-500 dark:text-gray-400 mb-1.5 ml-1">
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
                                  ? 'border-green-500 bg-green-50 dark:bg-green-500/10'
                                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-500'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <TeamLogoFor team={team1} teams={teams} size="sm" />
                                <span className={selected === team1 ? 'font-semibold' : ''}>
                                  {team1Meta?.display_name ?? team1}
                                </span>
                                <RankingBadge team={team1} rankings={rankings} />
                              </div>
                              <span className={`text-xs font-mono ${team1Pct >= 50 ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}`}>
                                {team1Pct}%
                              </span>
                            </button>

                            <span className="text-gray-400 dark:text-gray-500 text-sm">@</span>

                            <button
                              onClick={() => onSelectWinner(game.gameKey, team2)}
                              className={`flex-1 flex items-center justify-between gap-2 py-2 px-3 rounded-lg border-2 transition-all ${
                                selected === team2
                                  ? 'border-green-500 bg-green-50 dark:bg-green-500/10'
                                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-500'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <TeamLogoFor team={team2} teams={teams} size="sm" />
                                <span className={selected === team2 ? 'font-semibold' : ''}>
                                  {team2Meta?.display_name ?? team2}
                                </span>
                                <RankingBadge team={team2} rankings={rankings} />
                              </div>
                              <span className={`text-xs font-mono ${team2Pct >= 50 ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}`}>
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
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              <strong>{selectedCount}</strong> of {gameInfos.length} games selected
            </p>
            <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
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
              <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-2">
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
                        <TeamLogoFor team={teamName} teams={teams} size="sm" />
                        <Link to={teamPath(conference, teamName, sport, season)} className="font-medium flex-1 hover:underline">
                          {teamMeta?.display_name ?? teamName}
                        </Link>
                        <RankingBadge team={teamName} rankings={rankings} />
                        <span className="font-mono text-sm w-16 text-right">{percentage}%</span>
                        <div className="w-24 bg-gray-200 dark:bg-gray-700 rounded h-3 overflow-hidden">
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
            <p className="text-gray-500 dark:text-gray-400 text-sm">No CCG probabilities available</p>
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
                        <tr key={idx} className="border-b border-gray-100 dark:border-gray-800">
                          <td className="py-1.5 pr-2 text-gray-400 dark:text-gray-500 w-6 text-right">{idx + 1}.</td>
                          <td className="py-1.5 pr-1 w-6"><TeamLogoFor team={matchup.teams[0]} teams={teams} size="sm" /></td>
                          <td className="py-1.5 pr-2">
                            <Link to={teamPath(conference, matchup.teams[0], sport, season)} className="hover:underline">{teams.teams[matchup.teams[0]]?.display_name ?? matchup.teams[0]}</Link>
                            <RankingBadge team={matchup.teams[0]} rankings={rankings} className="ml-1" />
                          </td>
                          <td className="py-1.5 px-2 text-gray-400 dark:text-gray-500 text-center">vs</td>
                          <td className="py-1.5 pr-1 w-6"><TeamLogoFor team={matchup.teams[1]} teams={teams} size="sm" /></td>
                          <td className="py-1.5 pr-2">
                            <Link to={teamPath(conference, matchup.teams[1], sport, season)} className="hover:underline">{teams.teams[matchup.teams[1]]?.display_name ?? matchup.teams[1]}</Link>
                            <RankingBadge team={matchup.teams[1]} rankings={rankings} className="ml-1" />
                          </td>
                          <td className="py-1.5 font-mono text-right">
                            {(matchup.probability * 100).toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {excludedCount > 0 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      {excludedCount} additional matchup{excludedCount !== 1 ? 's' : ''} below 0.5% not shown
                    </p>
                  )}
                </>
              );
            })()
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-sm">No matchup data available</p>
          )}
        </div>
      </div>
    </div>
  );
}
