import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { TeamLogo } from './TeamLogo';
import { dateToWeekNumber } from '../utils/dateUtils';
import type { SeasonTeams, TiebreakerResult, ConferenceState } from '../types';
import type { RemainingGame } from '../utils/seasonBuilder';

interface FullSeasonPickerProps {
  teams: SeasonTeams;
  conference: string;
  conferenceState: ConferenceState | null;
  remainingGames: RemainingGame[];
  selectedWinners: Record<string, string>;
  onSelectWinner: (game: string, winner: string) => void;
  onClear: () => void;
  onFillFavorites: () => void;
  selectionProbability: number;
  tiebreakerResult: TiebreakerResult | null;
  allGamesSelected: boolean;
  week1Start?: string;
}

interface WeekGroup {
  weekLabel: string;
  dateGroups: DateGroup[];
}

interface DateGroup {
  dateLabel: string;
  games: RemainingGame[];
}

function formatDateLabel(date: Date): string {
  const options: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' };
  return date.toLocaleDateString('en-US', options);
}

function getWeekNumber(date: Date): number {
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
  return Math.ceil((days + startOfYear.getDay() + 1) / 7);
}

function groupGamesByWeek(games: RemainingGame[], week1Start?: string): WeekGroup[] {
  const weekMap = new Map<number, Map<string, RemainingGame[]>>();

  for (const game of games) {
    const weekNum = week1Start
      ? dateToWeekNumber(game.date, week1Start)
      : getWeekNumber(new Date(game.date + 'T12:00:00'));
    if (!weekMap.has(weekNum)) weekMap.set(weekNum, new Map());
    const dateMap = weekMap.get(weekNum)!;
    if (!dateMap.has(game.date)) dateMap.set(game.date, []);
    dateMap.get(game.date)!.push(game);
  }

  return Array.from(weekMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([weekNum, dateMap]) => ({
      weekLabel: `Week ${weekNum}`,
      dateGroups: Array.from(dateMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([dateKey, games]) => ({
          dateLabel: formatDateLabel(new Date(dateKey + 'T12:00:00')),
          games,
        })),
    }));
}

export function FullSeasonPicker({
  teams,
  conference,
  conferenceState,
  remainingGames,
  selectedWinners,
  onSelectWinner,
  onClear,
  onFillFavorites,
  selectionProbability,
  tiebreakerResult,
  allGamesSelected,
  week1Start,
}: FullSeasonPickerProps) {
  const selectedCount = Object.keys(selectedWinners).length;
  const totalGames = remainingGames.length;
  const weekGroups = useMemo(() => groupGamesByWeek(remainingGames, week1Start), [remainingGames, week1Start]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left Column: Game Picker */}
      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <h2 className="card-header mb-0 border-0 pb-0">
            Pick All Conference Game Winners
          </h2>
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
                        const selected = selectedWinners[game.gameKey];
                        const team1Meta = teams.teams[game.awayTeam];
                        const team2Meta = teams.teams[game.homeTeam];
                        const team1Pct = Math.round(game.awayWinProb * 100);
                        const team2Pct = 100 - team1Pct;

                        return (
                          <div key={game.gameKey} className="flex items-center gap-2">
                            <button
                              onClick={() => onSelectWinner(game.gameKey, game.awayTeam)}
                              className={`flex-1 flex items-center justify-between gap-2 py-2 px-3 rounded-lg border-2 transition-all ${
                                selected === game.awayTeam
                                  ? 'border-green-500 bg-green-50'
                                  : 'border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <TeamLogo team={game.awayTeam} size="sm" />
                                <span className={selected === game.awayTeam ? 'font-semibold' : ''}>
                                  {team1Meta?.display_name ?? game.awayTeam}
                                </span>
                              </div>
                              <span className={`text-xs font-mono ${team1Pct >= 50 ? 'text-green-600' : 'text-gray-400'}`}>
                                {team1Pct}%
                              </span>
                            </button>

                            <span className="text-gray-400 text-sm">@</span>

                            <button
                              onClick={() => onSelectWinner(game.gameKey, game.homeTeam)}
                              className={`flex-1 flex items-center justify-between gap-2 py-2 px-3 rounded-lg border-2 transition-all ${
                                selected === game.homeTeam
                                  ? 'border-green-500 bg-green-50'
                                  : 'border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <TeamLogo team={game.homeTeam} size="sm" />
                                <span className={selected === game.homeTeam ? 'font-semibold' : ''}>
                                  {team2Meta?.display_name ?? game.homeTeam}
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

        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-700">
            <strong>{selectedCount}</strong> of {totalGames} games selected
            {!allGamesSelected && (
              <span className="text-blue-500"> — select all games to see CCG result</span>
            )}
          </p>
          {selectedCount > 0 && (
            <p className="text-sm text-blue-600 mt-1">
              Probability of this combination:{' '}
              <strong className="font-mono">{selectionProbability > 0 && selectionProbability < 0.001 ? '<0.1' : (selectionProbability * 100).toFixed(1)}%</strong>
            </p>
          )}
        </div>
      </div>

      {/* Right Column: CCG Result */}
      <div className="space-y-6">
        {!allGamesSelected ? (
          <div className="card">
            <h2 className="card-header">Conference Championship</h2>
            <div className="text-gray-500 text-sm py-8 text-center">
              <p>Select winners for all {totalGames} remaining conference games to see the championship matchup.</p>
              <p className="mt-2">
                Or click <button onClick={onFillFavorites} className="text-blue-600 hover:text-blue-800 underline">Fill Favorites</button> to auto-pick likely winners.
              </p>
            </div>
          </div>
        ) : tiebreakerResult ? (
          <>
            {/* CCG Matchup */}
            <div className="card">
              <h2 className="card-header">Conference Championship Game</h2>
              {tiebreakerResult.ccgParticipants ? (
                <div className="flex items-center justify-center gap-6 py-6">
                  <div className="flex flex-col items-center gap-2">
                    <TeamLogo team={tiebreakerResult.ccgParticipants[0]} size="lg" />
                    <Link to={`/${conference}/teams/${encodeURIComponent(tiebreakerResult.ccgParticipants[0])}`} className="font-bold text-lg hover:underline">
                      {teams.teams[tiebreakerResult.ccgParticipants[0]]?.display_name ?? tiebreakerResult.ccgParticipants[0]}
                    </Link>
                    <span className="text-xs text-gray-500">#1 Seed</span>
                  </div>
                  <span className="text-gray-400 text-2xl font-light">vs</span>
                  <div className="flex flex-col items-center gap-2">
                    <TeamLogo team={tiebreakerResult.ccgParticipants[1]} size="lg" />
                    <Link to={`/${conference}/teams/${encodeURIComponent(tiebreakerResult.ccgParticipants[1])}`} className="font-bold text-lg hover:underline">
                      {teams.teams[tiebreakerResult.ccgParticipants[1]]?.display_name ?? tiebreakerResult.ccgParticipants[1]}
                    </Link>
                    <span className="text-xs text-gray-500">#2 Seed</span>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500 text-sm text-center py-4">Unable to determine CCG participants.</p>
              )}
              {tiebreakerResult.usedRandomDraw && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-2">
                  <p className="text-sm text-amber-700">
                    <strong>Note:</strong> A coin flip was needed to break a tie. The actual result may differ.
                  </p>
                </div>
              )}
            </div>

            {/* Conference Standings */}
            <div className="card">
              <h2 className="card-header">Conference Standings</h2>
              <div className="space-y-1">
                {(() => {
                  let rankCounter = 1;
                  return tiebreakerResult.standings.map((tier, tierIdx) => {
                    const rank = rankCounter;
                    const isTied = tier.length > 1;
                    rankCounter += tier.length;
                    return (
                  <div key={tierIdx}>
                    {tier.map((teamName) => {
                      const teamMeta = teams.teams[teamName];
                      const isCCG = tiebreakerResult.ccgParticipants?.includes(teamName);
                      // Compute conference record from conferenceState
                      let confRecord = '';
                      if (conferenceState) {
                        const teamRec = conferenceState.teams.get(teamName);
                        if (teamRec) {
                          const confGames = teamRec.games.filter((g) => g.isConference);
                          const confWins = confGames.filter((g) => g.won).length;
                          const confLosses = confGames.filter((g) => !g.won).length;
                          confRecord = `(${confWins}-${confLosses})`;
                        }
                      }
                      return (
                        <div
                          key={teamName}
                          className={`flex items-center gap-3 py-2 px-3 rounded ${
                            isCCG ? 'bg-green-50' : ''
                          }`}
                        >
                          <span className="text-gray-400 text-sm w-6 text-right">
                            {isTied ? `T${rank}` : rank}.
                          </span>
                          <TeamLogo team={teamName} size="sm" />
                          <Link to={`/${conference}/teams/${encodeURIComponent(teamName)}`} className={`flex-1 hover:underline ${isCCG ? 'font-semibold' : ''}`}>
                            {teamMeta?.display_name ?? teamName}
                          </Link>
                          {confRecord && (
                            <span className="text-sm text-gray-500 font-mono">{confRecord}</span>
                          )}
                          {isCCG && (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                              CCG
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                    );
                  });
                })()}
              </div>
            </div>

            {/* Seeding Explanation */}
            {tiebreakerResult.seedingLog && tiebreakerResult.seedingLog.length > 0 && (
              <div className="card">
                <h2 className="card-header">How Seeds Were Determined</h2>
                <div className="space-y-4">
                  {tiebreakerResult.seedingLog.map((log) => (
                    <div key={log.seed}>
                      <h3 className="text-sm font-semibold text-gray-800 mb-1 flex items-center gap-2">
                        <TeamLogo team={log.teamName} size="sm" />
                        #{log.seed} Seed: {teams.teams[log.teamName]?.display_name ?? log.teamName}
                      </h3>
                      {log.method === 'outright' ? (
                        <p className="text-sm text-gray-600 ml-7">
                          Won the #{log.seed} seed outright — no tiebreaker needed.
                        </p>
                      ) : (
                        <div className="ml-7 space-y-2">
                          {log.steps.map((step, idx) => (
                            <div
                              key={idx}
                              className={`text-sm border-l-2 pl-3 py-1 ${
                                step.resolved ? 'border-green-400' : 'border-gray-300'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span className={`font-medium ${step.resolved ? 'text-green-700' : 'text-gray-500'}`}>
                                  Step {idx + 1}: {step.stepName}
                                </span>
                                {!step.resolved && (
                                  <span className="text-xs text-gray-400">— Still tied</span>
                                )}
                                {step.resolved && (
                                  <span className="text-xs text-green-600">— Resolved</span>
                                )}
                              </div>
                              <div className="text-xs text-gray-500 mt-0.5">
                                Teams: {step.teamsEntering.map((t) => teams.teams[t]?.display_name ?? t).join(', ')}
                              </div>
                              {Object.keys(step.details).length > 0 && (
                                <div className="mt-1 space-y-0.5">
                                  {step.teamsEntering.map((t) => {
                                    const isAdvancing = step.advancingTeams?.includes(t);
                                    const isEliminated = step.eliminatedTeams?.includes(t);
                                    return (
                                      <div
                                        key={t}
                                        className={`text-xs flex items-center gap-1.5 ${
                                          isAdvancing ? 'text-green-700 font-medium' : isEliminated ? 'text-red-500' : 'text-gray-600'
                                        }`}
                                      >
                                        <TeamLogo team={t} size="xs" />
                                        <span>{teams.teams[t]?.display_name ?? t}:</span>
                                        <span className="font-mono">{step.details[t] ?? '—'}</span>
                                        {isAdvancing && <span className="text-green-600">✓</span>}
                                        {isEliminated && <span className="text-red-400">✗</span>}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
