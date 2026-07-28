import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useConferenceData } from '../hooks/useConferenceData';
import { TeamLogoFor } from '../components/TeamLogo';
import { TeamName } from '../components/TeamName';
import { ConferenceLogo } from '../components/ConferenceLogo';
import { ConferenceSelector } from '../components/ConferenceSelector';
import { AdSlot } from '../components/AdSlot';
import { usePageTitle } from '../hooks/usePageTitle';
import { DEFAULT_SPORT, CURRENT_SEASON, conferenceSwitchPath, teamPath } from '../utils/routes';
import type { TiebreakerScenario } from '../types';

const DEFAULT_CONFERENCES = ['B12', 'SEC', 'B10', 'ACC', 'AAC', 'MWC', 'CUSA', 'MAC', 'SBC'];

// A matchup at/above this confidence is treated as fully decided - matches
// the threshold used elsewhere for "locked" CCG outcomes (e.g. the
// flowchart, Ways to Lock).
const LOCKED_CONFIDENCE_THRESHOLD = 0.999;

const MAX_SCENARIOS_BEFORE_COLLAPSE = 50;

// Each conference's own tiebreaker procedure - keyed by conference code
// (not display name) so it can be looked up directly from the current
// conference. Conferences without an entry here simply don't get a "How
// Tiebreakers Work" card.
const TIEBREAKER_PROCEDURES: Record<string, string> = {
  B12: 'Head-to-head record → Record against the highest-placed common opponent → Next-highest, etc. → Strength of schedule → Total wins',
  SEC: 'Head-to-head → Common conference opponents → Combined record against next-highest teams → Strength of schedule → Scoring margin',
  B10: 'Head-to-head → Common conference opponents → Record against highest-placed opponent → Next-highest, etc.',
  ACC: 'Head-to-head → Common conference opponents → Record against next-best common opponent → Strength of schedule',
  AAC: 'Head-to-head → CFP rank / computer rankings → Common conference opponents → Overall winning percentage',
  MWC: 'Head-to-head → CFP rank / computer rankings → Overall winning percentage → Next-highest team → Common conference opponents',
  CUSA: 'Head-to-head → CFP rank → Computer rankings composite → Academic Progress Rate',
  MAC: 'Head-to-head → Common conference opponents → Next-highest opponent → Strength of schedule → Team Rating Score',
  SBC: 'Divisional (East vs. West): each division champion is decided by head-to-head → next-highest team → non-divisional common opponents → strength of schedule, then the two champions meet in the CCG',
};

function formatPercent(value: number): string {
  if (value < 0.001) return '<0.1%';
  return `${(value * 100).toFixed(1)}%`;
}

function ProbabilityBar({ value }: { value: number }) {
  const widthPct = Math.max(1, Math.min(100, value * 100));
  return (
    <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2 mt-1">
      <div
        className="bg-blue-500 h-2 rounded-full transition-all"
        style={{ width: `${widthPct}%` }}
      />
    </div>
  );
}

/** A scenario's CCG matchup is only "certain" when exactly one matchup was
 * surfaced and it's at/above the locked threshold - anything else (multiple
 * candidate matchups, or a single one below the threshold, or none at all)
 * means the tiebreaker's outcome genuinely isn't 100% determined by the tie
 * alone (e.g. it depends on point differentials or other games not yet
 * played). The simulation already surfaces this: `ccg_matchups` is built
 * from how the *actual simulated seasons* falling into this tie resolved,
 * so a fragmented/uncertain tiebreaker naturally produces more than one
 * entry (or a sub-100% top entry) instead of always collapsing to one.
 */
function isScenarioUncertain(scenario: TiebreakerScenario): boolean {
  if (scenario.ccg_matchups.length !== 1) return true;
  return scenario.ccg_matchups[0].probability < LOCKED_CONFIDENCE_THRESHOLD;
}

export function TiebreakersPage() {
  const {
    sport = DEFAULT_SPORT,
    year = CURRENT_SEASON,
    conference = 'B12',
  } = useParams<{ sport: string; year: string; conference: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const historicalDate = searchParams.get('date') ?? undefined;
  const { teams, tiebreakers, rankings, loading, error, loadConference } = useConferenceData();
  const [filterTeam, setFilterTeam] = useState<string>('');
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    loadConference(sport, year, conference, historicalDate);
  }, [conference, sport, year, historicalDate, loadConference]);

  // Reset filter/expansion when conference changes
  useEffect(() => {
    setFilterTeam('');
    setShowAll(false);
  }, [conference]);

  const conferences = teams?.conferences
    ? Object.keys(teams.conferences)
    : DEFAULT_CONFERENCES;

  const conferenceName = teams?.conferences?.[conference]?.display_name ?? conference;
  usePageTitle(`${conferenceName} Tiebreakers`);

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

  const displayedScenarios = showAll ? filteredScenarios : filteredScenarios.slice(0, MAX_SCENARIOS_BEFORE_COLLAPSE);

  // All teams in tiebreaker scenarios for filter dropdown
  const tiebreakerTeams = new Set<string>();
  tiebreakers?.scenarios.forEach(s => {
    Object.values(s.teams_by_losses).flat().forEach(t => tiebreakerTeams.add(t));
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-1">
          {conferenceName} Tiebreaker Scenarios
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Scenarios where tiebreakers determine conference championship game participants
        </p>
      </header>

      <div className="mb-6">
        <ConferenceSelector
          conferences={conferences}
          selected={conference}
          onChange={(conf) => {
            const dateSuffix = historicalDate ? `?date=${historicalDate}` : '';
            const hasSimulation = teams?.conferences[conf]?.has_simulation !== false;
            navigate(`${conferenceSwitchPath(conf, 'tiebreakers', hasSimulation, sport, year)}${dateSuffix}`);
          }}
          conferenceNames={teams?.conferences}
        />
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600 dark:text-gray-400">Loading data...</span>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-300">
          <strong>Error:</strong> {error}
        </div>
      )}

      {!loading && !error && (!tiebreakers || tiebreakers.scenarios.length === 0) && (
        <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6 text-center">
          <h3 className="text-lg font-semibold text-yellow-800 dark:text-yellow-300 mb-2">No Tiebreaker Data</h3>
          <p className="text-yellow-700 dark:text-yellow-300">
            {tiebreakers
              ? 'No tiebreaker scenarios are available for this week — the standings may already be fully decided by record, or this matchup hasn\'t been computed yet.'
              : 'Tiebreaker scenario data is not yet available for this conference and week.'}
          </p>
        </div>
      )}

      {!loading && !error && tiebreakers && tiebreakers.scenarios.length > 0 && (
        <>
          {/* Filters */}
          <div className="mb-5 flex flex-wrap gap-4 items-center justify-between">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Filter by team:</label>
              <select
                value={filterTeam}
                onChange={(e) => setFilterTeam(e.target.value)}
                className="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All teams</option>
                {[...tiebreakerTeams].sort().map(team => (
                  <option key={team} value={team}>
                    {teams?.teams[team]?.display_name ?? team}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {showAll ? filteredScenarios.length : displayedScenarios.length} of {filteredScenarios.length} scenarios
            </p>
          </div>

          <AdSlot slotId="tiebreakers-top" className="mb-6" />

          {/* Scenario table */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Scenario
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    CCG Matchup
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-32">
                    Probability
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {displayedScenarios.map((scenario, idx) => {
                  const lossGroups = Object.entries(scenario.teams_by_losses)
                    .filter(([, teams]) => teams.length > 0)
                    .sort(([a], [b]) => parseInt(a) - parseInt(b));

                  const uncertain = isScenarioUncertain(scenario);

                  return (
                    <tr
                      key={idx}
                      className={`transition-colors ${
                        uncertain
                          ? 'bg-amber-50/60 dark:bg-amber-950/30 hover:bg-amber-100/60 dark:hover:bg-amber-900/40'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                    >
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
                                  'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                                }`}>
                                  {wins}-{losses}
                                </span>
                                <div className="flex flex-wrap gap-1.5">
                                  {teamList.map(team => (
                                    <Link
                                      key={team}
                                      to={`${teamPath(conference, team, sport, year)}${historicalDate ? `?date=${historicalDate}` : ''}`}
                                      className="inline-flex items-center gap-1 text-sm px-2 py-0.5 rounded-md bg-gray-50 dark:bg-gray-800 hover:bg-blue-50 hover:text-blue-700 transition-colors border border-gray-200 dark:border-gray-700"
                                    >
                                      <TeamLogoFor team={team} teams={teams} size="xs" />
                                      <TeamName team={team} teams={teams} rankings={rankings} />
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
                        {uncertain && (
                          <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 mb-1.5">
                            CCG participants not 100% certain
                          </p>
                        )}
                        {scenario.ccg_matchups.length > 0 ? (
                          <div className="space-y-2">
                            {scenario.ccg_matchups.slice(0, 3).map((matchup, i) => (
                              <div key={i} className="flex items-center gap-2 text-sm">
                                <div className="flex flex-col gap-0.5">
                                  <span className="inline-flex items-center gap-1">
                                    <TeamLogoFor team={matchup.team_a} teams={teams} size="xs" />
                                    <TeamName team={matchup.team_a} teams={teams} rankings={rankings} className="font-medium" />
                                  </span>
                                  <span className="inline-flex items-center gap-1">
                                    <TeamLogoFor team={matchup.team_b} teams={teams} size="xs" />
                                    <TeamName team={matchup.team_b} teams={teams} rankings={rankings} className="font-medium" />
                                  </span>
                                </div>
                                {uncertain && (
                                  <span className="text-xs text-gray-400 dark:text-gray-500">
                                    {formatPercent(matchup.probability)}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 dark:text-gray-500 italic">Uncertain</span>
                        )}
                      </td>

                      {/* Probability */}
                      <td className="px-4 py-3 text-right">
                        <span className="text-base font-bold font-mono text-gray-900 dark:text-gray-100">
                          {formatPercent(scenario.probability)}
                        </span>
                        <ProbabilityBar value={scenario.probability / (displayedScenarios[0]?.probability || 1)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>

          {!showAll && filteredScenarios.length > MAX_SCENARIOS_BEFORE_COLLAPSE && (
            <div className="text-center mt-3">
              <button
                onClick={() => setShowAll(true)}
                className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline"
              >
                Show all {filteredScenarios.length} scenarios
              </button>
            </div>
          )}
        </>
      )}

      {/* How tiebreakers work */}
      {TIEBREAKER_PROCEDURES[conference] && (
        <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
            How <ConferenceLogo conference={conference} meta={teams?.conferences?.[conference]} size="sm" /> Tiebreakers Work
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {TIEBREAKER_PROCEDURES[conference]}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
            Some tiebreaker steps involve factors like point differential that cannot
            be predicted before games are played, leading to uncertain outcomes.
          </p>
        </div>
      )}
    </div>
  );
}
