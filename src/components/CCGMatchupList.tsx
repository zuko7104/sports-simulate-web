import { TeamLogo } from './TeamLogo';
import type { CCGMatchups, SeasonTeams } from '../types';
import { formatProbability } from '../utils/formatProbability';

interface CCGMatchupListProps {
  matchups: CCGMatchups;
  teams: SeasonTeams;
  conference?: string;
  limit?: number;
}

export function CCGMatchupList({ matchups, teams, limit = 15 }: CCGMatchupListProps) {
  const topMatchups = matchups.matchups.slice(0, limit);
  const maxProb = topMatchups.length > 0 ? topMatchups[0].probability : 1;

  return (
    <div className="card">
      <h2 className="card-header">Most Likely CCG Matchups</h2>
      <div className="space-y-1.5">
        {topMatchups.map((matchup, idx) => {
          const teamA = teams.teams[matchup.team_a];
          const teamB = teams.teams[matchup.team_b];
          const percentage = formatProbability(matchup.probability);
          const barWidth = (matchup.probability / maxProb) * 100;

          // Use team A's color for the bar gradient
          const colorA = teamA?.primary_color ?? '#6b7280';
          const colorB = teamB?.primary_color ?? '#6b7280';

          return (
            <div
              key={`${matchup.team_a}-${matchup.team_b}`}
              className="relative rounded-lg overflow-hidden"
            >
              {/* Bar background */}
              <div
                className="absolute inset-y-0 left-0 rounded-lg opacity-15"
                style={{
                  width: `${barWidth}%`,
                  background: `linear-gradient(90deg, ${colorA}, ${colorB})`,
                }}
              />
              {/* Content */}
              <div className="relative flex items-center gap-3 p-2.5 hover:bg-gray-50/50">
                <span className="text-gray-400 w-6 text-right text-sm font-mono">{idx + 1}</span>

                <span className="font-mono w-14 text-sm font-semibold tabular-nums">
                  {percentage}
                </span>

                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <TeamLogo team={matchup.team_a} size="sm" />
                  <span className="font-medium text-sm truncate">
                    {teamA?.display_name ?? matchup.team_a}
                  </span>
                </div>

                <span className="text-gray-400 text-xs font-medium">vs</span>

                <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                  <span className="font-medium text-sm truncate text-right">
                    {teamB?.display_name ?? matchup.team_b}
                  </span>
                  <TeamLogo team={matchup.team_b} size="sm" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
