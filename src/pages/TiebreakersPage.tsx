import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useConferenceData } from '../hooks/useConferenceData';
import { TeamLogo } from '../components/TeamLogo';
import { ConferenceSelector } from '../components/ConferenceSelector';

const DEFAULT_CONFERENCES = ['B12', 'SEC', 'B10', 'ACC'];

function formatPercent(value: number): string {
  if (value < 0.001) return '<0.1%';
  return `${(value * 100).toFixed(1)}%`;
}

function ProbabilityBar({ value }: { value: number }) {
  const widthPct = Math.max(1, Math.min(100, value * 100));
  return (
    <div className="w-full bg-gray-100 rounded-full h-2 mt-1">
      <div
        className="bg-blue-500 h-2 rounded-full transition-all"
        style={{ width: `${widthPct}%` }}
      />
    </div>
  );
}

export function TiebreakersPage() {
  const { conference = 'B12' } = useParams<{ conference: string }>();
  const navigate = useNavigate();
  const { teams, tiebreakers, loading, error, loadConference } = useConferenceData();
  const [filterTeam, setFilterTeam] = useState<string>('');

  useEffect(() => {
    loadConference('cfb', '2025', conference);
  }, [conference, loadConference]);

  // Reset filter when conference changes
  useEffect(() => {
    setFilterTeam('');
  }, [conference]);

  const conferences = teams?.conferences
    ? Object.keys(teams.conferences)
    : DEFAULT_CONFERENCES;

  const conferenceName = teams?.conferences?.[conference]?.display_name ?? conference;

  // Determine conference games count from data
  const confGames = conference === 'ACC' ? 8 : 9;

  // Filter scenarios
  const filteredScenarios = tiebreakers?.scenarios.filter(scenario => {
    if (filterTeam) {
      const allTeams = Object.values(scenario.teams_by_losses).flat();
      if (!allTeams.includes(filterTeam)) return false;
    }
    return true;
  }) ?? [];

  // All teams in tiebreaker scenarios for filter dropdown
  const tiebreakerTeams = new Set<string>();
  tiebreakers?.scenarios.forEach(s => {
    Object.values(s.teams_by_losses).flat().forEach(t => tiebreakerTeams.add(t));
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-1">
          {conferenceName} Tiebreaker Scenarios
        </h1>
        <p className="text-gray-600">
          Scenarios where tiebreakers determine conference championship game participants
        </p>
      </header>

      <div className="mb-6">
        <ConferenceSelector
          conferences={conferences}
          selected={conference}
          onChange={(conf) => navigate(`/${conf}/tiebreakers`)}
          conferenceNames={teams?.conferences}
        />
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading data...</span>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          <strong>Error:</strong> {error}
        </div>
      )}

      {!loading && !error && !tiebreakers && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <h3 className="text-lg font-semibold text-yellow-800 mb-2">No Tiebreaker Data</h3>
          <p className="text-yellow-700">
            Tiebreaker scenario data is not yet available for this conference.
          </p>
        </div>
      )}

      {!loading && !error && tiebreakers && tiebreakers.scenarios.length > 0 && (
        <>
          {/* Info banner */}
          <div className="mb-5 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
            ⚠️ Some tiebreaker outcomes depend on factors like point differentials that cannot be predicted before games are played.
          </div>

          {/* Filters */}
          <div className="mb-5 flex flex-wrap gap-4 items-center justify-between">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Filter by team:</label>
              <select
                value={filterTeam}
                onChange={(e) => setFilterTeam(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All teams</option>
                {[...tiebreakerTeams].sort().map(team => (
                  <option key={team} value={team}>
                    {teams?.teams[team]?.display_name ?? team}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-sm text-gray-500">
              {filteredScenarios.length} of {tiebreakers.scenarios.length} scenarios
              {filteredScenarios.length > 50 && ' (showing top 50)'}
            </p>
          </div>

          {/* Scenario table */}
          <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Scenario
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Likely CCG Matchup
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-32">
                    Probability
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredScenarios.slice(0, 50).map((scenario, idx) => {
                  const lossGroups = Object.entries(scenario.teams_by_losses)
                    .filter(([, teams]) => teams.length > 0)
                    .sort(([a], [b]) => parseInt(a) - parseInt(b));

                  return (
                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                      {/* Scenario: loss groups */}
                      <td className="px-4 py-3">
                        <div className="space-y-1.5">
                          {lossGroups.map(([losses, teamList]) => {
                            const wins = confGames - parseInt(losses);
                            return (
                              <div key={losses} className="flex items-center gap-2 flex-wrap">
                                <span className={`inline-flex items-center text-xs font-bold px-2 py-0.5 rounded ${
                                  losses === '0' ? 'bg-green-100 text-green-800' :
                                  losses === '1' ? 'bg-blue-100 text-blue-800' :
                                  'bg-gray-100 text-gray-600'
                                }`}>
                                  {wins}-{losses}
                                </span>
                                <div className="flex flex-wrap gap-1.5">
                                  {teamList.map(team => (
                                    <Link
                                      key={team}
                                      to={`/${conference}/teams/${encodeURIComponent(team)}`}
                                      className="inline-flex items-center gap-1 text-sm px-2 py-0.5 rounded-md bg-gray-50 hover:bg-blue-50 hover:text-blue-700 transition-colors border border-gray-200"
                                    >
                                      <TeamLogo team={team} size="xs" />
                                      <span>{teams?.teams[team]?.display_name ?? team}</span>
                                    </Link>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </td>

                      {/* CCG matchups */}
                      <td className="px-4 py-3">
                        {scenario.ccg_matchups.length > 0 ? (
                          <div className="space-y-1">
                            {scenario.ccg_matchups.slice(0, 3).map((matchup, i) => (
                              <div key={i} className="flex items-center gap-1.5 text-sm">
                                <span className="inline-flex items-center gap-1">
                                  <TeamLogo team={matchup.team_a} size="xs" />
                                  <span className="font-medium">{teams?.teams[matchup.team_a]?.display_name ?? matchup.team_a}</span>
                                </span>
                                <span className="text-gray-400 text-xs">vs</span>
                                <span className="inline-flex items-center gap-1">
                                  <TeamLogo team={matchup.team_b} size="xs" />
                                  <span className="font-medium">{teams?.teams[matchup.team_b]?.display_name ?? matchup.team_b}</span>
                                </span>
                                <span className="text-xs text-gray-400 ml-1">
                                  {formatPercent(matchup.probability)}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 italic">Uncertain</span>
                        )}
                      </td>

                      {/* Probability */}
                      <td className="px-4 py-3 text-right">
                        <span className="text-base font-bold font-mono text-gray-900">
                          {formatPercent(scenario.probability)}
                        </span>
                        <ProbabilityBar value={scenario.probability / (filteredScenarios[0]?.probability || 1)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredScenarios.length > 50 && (
            <p className="text-center text-gray-500 text-sm mt-3">
              Showing top 50 of {filteredScenarios.length} scenarios
            </p>
          )}
        </>
      )}

      {/* How tiebreakers work */}
      <div className="mt-8 bg-white rounded-lg shadow border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">
          How Tiebreakers Work
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="p-3 bg-gray-50 rounded-lg">
            <h4 className="font-semibold text-gray-800 mb-1">Big 12</h4>
            <p className="text-sm text-gray-600">
              Head-to-head record → Record against the highest-placed
              common opponent → Next-highest, etc. → Strength of schedule → Total wins
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <h4 className="font-semibold text-gray-800 mb-1">SEC</h4>
            <p className="text-sm text-gray-600">
              Head-to-head → Common conference opponents → Combined record
              against next-highest teams → Strength of schedule → Scoring margin
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <h4 className="font-semibold text-gray-800 mb-1">Big Ten</h4>
            <p className="text-sm text-gray-600">
              Head-to-head → Common conference opponents → Record against
              highest-placed opponent → Next-highest, etc.
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <h4 className="font-semibold text-gray-800 mb-1">ACC</h4>
            <p className="text-sm text-gray-600">
              Head-to-head → Common conference opponents → Record against
              next-best common opponent → Strength of schedule
            </p>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-3">
          Some tiebreaker steps involve factors like point differential that cannot
          be predicted before games are played, leading to uncertain outcomes.
        </p>
      </div>
    </div>
  );
}
