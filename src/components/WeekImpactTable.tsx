import { useState } from 'react';
import { Link } from 'react-router-dom';
import { TeamLogo } from './TeamLogo';
import type { WeekImpact, SeasonTeams } from '../types';

interface WeekImpactTableProps {
  weekImpact: WeekImpact;
  teams: SeasonTeams;
  selectedTeam?: string;
  showTeamSelector?: boolean;
  conference?: string;
  historicalDate?: string;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatImpact(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${(value * 100).toFixed(1)}%`;
}

function impactColor(value: number): string {
  if (value > 0.05) return 'text-green-700 bg-green-50';
  if (value > 0.01) return 'text-green-600';
  if (value < -0.05) return 'text-red-700 bg-red-50';
  if (value < -0.01) return 'text-red-600';
  return 'text-gray-500';
}

export function WeekImpactTable({ weekImpact, teams, selectedTeam, showTeamSelector = false, conference, historicalDate }: WeekImpactTableProps) {
  const teamNames = Object.keys(weekImpact.teams).sort(
    (a, b) => (weekImpact.teams[b].current_ccg_probability) - (weekImpact.teams[a].current_ccg_probability)
  );

  const [selectorTeam, setSelectorTeam] = useState<string>(selectedTeam ?? teamNames[0] ?? '');
  const [hoveredTeam, setHoveredTeam] = useState<string | null>(null);
  const activeTeam = selectedTeam ?? selectorTeam;

  const teamImpact = weekImpact.teams[activeTeam];
  if (!teamImpact) return null;

  const hasClinching = teamImpact.clinching_scenarios.length > 0;

  const content = (
    <div>
      {showTeamSelector && (
        <>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
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
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <TeamLogo team={team} size="xs" />
                  {meta?.display_name ?? team}
                </button>
              );
            })}
          </div>
          <div className="mb-4 p-3 bg-gray-50 rounded-lg text-center">
            <span className="text-sm text-gray-600">Current CCG Probability: </span>
            <span className="text-lg font-bold font-mono">
              {formatPercent(teamImpact.current_ccg_probability)}
            </span>
          </div>
        </>
      )}

      {/* Per-game impact table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 px-2">Game</th>
              <th className="text-center py-2 px-2">
                <div className="flex flex-col items-center gap-0.5">
                  <TeamLogo team={activeTeam} size="xs" />
                  <span>CCG Odds</span>
                  <span className="font-normal text-gray-500">If Away Wins</span>
                </div>
              </th>
              <th className="text-center py-2 px-2">
                <div className="flex flex-col items-center gap-0.5">
                  <TeamLogo team={activeTeam} size="xs" />
                  <span>CCG Odds</span>
                  <span className="font-normal text-gray-500">If Home Wins</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {teamImpact.game_impacts.map((game, i) => {
              const isHighlighted = hoveredTeam === game.away_team || hoveredTeam === game.home_team;
              return (
              <tr key={i} className={`border-b border-gray-100 transition-colors ${isHighlighted ? 'bg-yellow-100' : ''}`}>
                <td className="py-2 px-2">
                  <div className="flex items-center gap-1.5">
                    <TeamLogo team={game.away_team} size="xs" />
                    <Link
                      to={`/${conference ?? teams.teams[game.away_team]?.conference ?? 'B12'}/teams/${encodeURIComponent(game.away_team)}${historicalDate ? `?date=${historicalDate}` : ''}`}
                      className="text-sm hover:text-blue-600 hover:underline"
                    >
                      {teams.teams[game.away_team]?.display_name ?? game.away_team}
                    </Link>
                    <span className="text-xs text-gray-400">@</span>
                    <TeamLogo team={game.home_team} size="xs" />
                    <Link
                      to={`/${conference ?? teams.teams[game.home_team]?.conference ?? 'B12'}/teams/${encodeURIComponent(game.home_team)}${historicalDate ? `?date=${historicalDate}` : ''}`}
                      className="text-sm hover:text-blue-600 hover:underline"
                    >
                      {teams.teams[game.home_team]?.display_name ?? game.home_team}
                    </Link>
                  </div>
                </td>
                <td className={`text-center py-2 px-2 font-mono text-xs ${impactColor(game.impact_if_away_wins)}`}>
                  {formatPercent(game.ccg_prob_if_away_wins)}
                  <br />
                  <span className="text-xs">
                    ({formatImpact(game.impact_if_away_wins)})
                  </span>
                </td>
                <td className={`text-center py-2 px-2 font-mono text-xs ${impactColor(game.impact_if_home_wins)}`}>
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
            <div className="p-3 bg-green-50 rounded-lg border border-green-200">
              <h4 className="text-xs font-semibold text-green-800 mb-1 flex items-center gap-1">
                Best Winner Combination for <TeamLogo team={activeTeam} size="xs" />
              </h4>
              <div className="flex flex-wrap gap-1 mb-1">
                {teamImpact.best_outcome.winners.map((w) => (
                  <span
                    key={w}
                    className="flex items-center gap-1 text-xs bg-white px-1.5 py-0.5 rounded cursor-default"
                    onMouseEnter={() => setHoveredTeam(w)}
                    onMouseLeave={() => setHoveredTeam(null)}
                  >
                    <TeamLogo team={w} size="xs" />
                    {teams.teams[w]?.display_name ?? w}
                  </span>
                ))}
              </div>
              <p className="text-xs text-green-700">
                CCG: <strong>{formatPercent(teamImpact.best_outcome.ccg_probability)}</strong>
                {' '}• Scenario: {formatPercent(teamImpact.best_outcome.probability)}
              </p>
            </div>
          )}
          {teamImpact.best_realistic_outcome && (
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="text-xs font-semibold text-blue-800 mb-1 flex items-center gap-1">
                Best and Most Realistic Winner Combination for <TeamLogo team={activeTeam} size="xs" />
              </h4>
              <div className="flex flex-wrap gap-1 mb-1">
                {teamImpact.best_realistic_outcome.winners.map((w) => (
                  <span
                    key={w}
                    className="flex items-center gap-1 text-xs bg-white px-1.5 py-0.5 rounded cursor-default"
                    onMouseEnter={() => setHoveredTeam(w)}
                    onMouseLeave={() => setHoveredTeam(null)}
                  >
                    <TeamLogo team={w} size="xs" />
                    {teams.teams[w]?.display_name ?? w}
                  </span>
                ))}
              </div>
              <p className="text-xs text-blue-700">
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
          <h4 className="text-sm font-semibold text-gray-800 mb-2">
            Ways to Clinch CCG Spot This Week
          </h4>
          <div className="space-y-2">
            {teamImpact.clinching_scenarios.slice(0, 10).map((scenario, i) => (
              <div key={i} className="flex items-center justify-between p-2 bg-yellow-50 rounded border border-yellow-200">
                <div className="flex flex-wrap gap-1">
                  {scenario.winners.map((w) => (
                    <span
                      key={w}
                      className="flex items-center gap-1 text-xs bg-white px-1.5 py-0.5 rounded cursor-default"
                      onMouseEnter={() => setHoveredTeam(w)}
                      onMouseLeave={() => setHoveredTeam(null)}
                    >
                      <TeamLogo team={w} size="xs" />
                      {teams.teams[w]?.display_name ?? w}
                    </span>
                  ))}
                </div>
                <span className="text-xs font-mono text-yellow-800 ml-2">
                  {formatPercent(scenario.probability)}
                </span>
              </div>
            ))}
            {teamImpact.clinching_scenarios.length > 10 && (
              <p className="text-xs text-gray-500 text-center">
                +{teamImpact.clinching_scenarios.length - 10} more clinching scenarios
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );

  if (showTeamSelector) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        {content}
      </div>
    );
  }

  return content;
}
