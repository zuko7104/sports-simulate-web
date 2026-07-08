import { TeamLogoFor } from './TeamLogo';
import { TeamName } from './TeamName';
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
              <div className="relative flex items-center gap-1.5 sm:gap-3 p-1.5 sm:p-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <span className="text-gray-400 dark:text-gray-500 w-5 sm:w-6 text-right text-sm font-mono">{idx + 1}</span>

                <span className="font-mono w-12 sm:w-14 text-sm font-semibold tabular-nums">
                  {percentage}
                </span>

                <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
                  <TeamLogoFor team={matchup.team_a} teams={teams} size="sm" />
                  <TeamName team={matchup.team_a} teams={teams} className="font-medium text-sm truncate" />
                </div>

                <span className="text-gray-400 dark:text-gray-500 text-xs font-medium">vs</span>

                <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0 justify-end">
                  <TeamName team={matchup.team_b} teams={teams} className="font-medium text-sm truncate text-right" />
                  <TeamLogoFor team={matchup.team_b} teams={teams} size="sm" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
