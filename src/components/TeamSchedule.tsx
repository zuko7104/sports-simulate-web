import { Link } from 'react-router-dom';
import type { GameResult, SeasonTeams } from '../types';
import { TeamLogo } from './TeamLogo';

interface TeamScheduleProps {
  games: GameResult[];
  teams: SeasonTeams;
  sport: string;
  season: string;
  conference?: string;
  historicalDate?: string;
}

export function TeamSchedule({ games, teams, conference, historicalDate }: TeamScheduleProps) {
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
          <tr className="border-b border-gray-200">
            <th className="text-left py-2 px-2 text-xs font-medium text-gray-500 uppercase">
              Date
            </th>
            <th className="text-left py-2 px-2 text-xs font-medium text-gray-500 uppercase">
              Opponent
            </th>
            <th className="text-center py-2 px-2 text-xs font-medium text-gray-500 uppercase">
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
                className={`border-b border-gray-100 ${
                  isCompleted ? '' : 'bg-gray-50'
                }`}
              >
                <td className="py-2 px-2 text-sm text-gray-600 whitespace-nowrap">
                  {formatDate(game.date)}
                </td>
                <td className="py-2 px-2">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 text-xs w-4">
                      {game.neutral ? 'vs' : game.is_home ? 'vs' : '@'}
                    </span>
                    <TeamLogo team={game.opponent} size="sm" />
                    <Link
                      to={`/${conference ?? teams.teams[game.opponent]?.conference ?? 'B12'}/teams/${encodeURIComponent(game.opponent)}${dateSuffix}`}
                      className="text-sm hover:text-blue-600 hover:underline"
                    >
                      {opponentMeta?.display_name ?? game.opponent}
                    </Link>
                    {game.neutral && (
                      <span className="text-xs text-gray-400">(N)</span>
                    )}
                  </div>
                </td>
                <td className="py-2 px-2 text-center">
                  {isCompleted ? (
                    <div className="flex items-center justify-center gap-2">
                      <span
                        className={`inline-block w-6 text-center text-sm font-semibold ${
                          game.won ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {game.won ? 'W' : 'L'}
                      </span>
                      <span className="text-sm text-gray-600 font-mono">
                        {game.score}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-1">
                      <span className="text-xs text-gray-400">Win prob:</span>
                      <span
                        className={`text-sm font-mono ${
                          (game.win_probability ?? 0.5) >= 0.5
                            ? 'text-green-600'
                            : 'text-gray-500'
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
