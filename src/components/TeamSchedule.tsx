import { Link } from 'react-router-dom';
import type { GameResult, SeasonTeams } from '../types';
import { TeamLogoFor } from './TeamLogo';
import { TeamName } from './TeamName';
import { teamPath } from '../utils/routes';

interface TeamScheduleProps {
  games: GameResult[];
  teams: SeasonTeams;
  sport: string;
  season: string;
  conference?: string;
  historicalDate?: string;
}

export function TeamSchedule({ games, teams, sport, season, conference, historicalDate }: TeamScheduleProps) {
  const dateSuffix = historicalDate ? `?date=${historicalDate}` : '';
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T12:00:00');
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            <th className="text-left py-2 px-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
              Date
            </th>
            <th className="text-left py-2 px-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
              Opponent
            </th>
            <th className="text-center py-2 px-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
              Result
            </th>
          </tr>
        </thead>
        <tbody>
          {games.map((game, idx) => {
            const opponentMeta = teams.teams[game.opponent];
            const isCompleted = game.is_complete;

            return (
              <tr
                key={idx}
                className={`border-b border-gray-100 dark:border-gray-800 ${
                  isCompleted ? '' : 'bg-gray-50 dark:bg-gray-800'
                }`}
              >
                <td className="py-2 px-2 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                  {formatDate(game.date)}
                </td>
                <td className="py-2 px-2">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 dark:text-gray-500 text-xs w-4">
                      {game.neutral ? 'vs' : game.is_home ? 'vs' : '@'}
                    </span>
                    <TeamLogoFor team={game.opponent} teams={teams} size="sm" />
                    <Link
                      to={`${teamPath(opponentMeta?.conference ?? conference ?? 'B12', game.opponent, sport, season)}${dateSuffix}`}
                      className="text-sm hover:text-blue-600 dark:hover:text-blue-400 hover:underline"
                    >
                      <TeamName team={game.opponent} teams={teams} />
                    </Link>
                    {game.neutral && (
                      <span className="text-xs text-gray-400 dark:text-gray-500">(N)</span>
                    )}
                  </div>
                </td>
                <td className="py-2 px-2 text-center">
                  {isCompleted ? (
                    <div className="flex items-center justify-center gap-2">
                      <span
                        className={`inline-block w-6 text-center text-sm font-semibold ${
                          game.won ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {game.won ? 'W' : 'L'}
                      </span>
                      <span className="text-sm text-gray-600 dark:text-gray-400 font-mono">
                        {game.score}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-1">
                      <span className="text-xs text-gray-400 dark:text-gray-500">Win prob:</span>
                      <span
                        className={`text-sm font-mono ${
                          (game.win_probability ?? 0.5) >= 0.5
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-gray-500 dark:text-gray-400'
                        }`}
                      >
                        {Math.round((game.win_probability ?? 0.5) * 100)}%
                      </span>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
