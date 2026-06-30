import { useEffect, useState } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { TeamLogo } from '../components/TeamLogo';
import { TeamSchedule } from '../components/TeamSchedule';
import { RecordProbabilities } from '../components/RecordProbabilities';
import { LossScenarios } from '../components/LossScenarios';
import { WeekImpactTable } from '../components/WeekImpactTable';
import { ProbabilityTimeline } from '../components/ProbabilityTimeline';
import { isConferenceGame } from '../utils/conferenceGame';
import { type DatesConfig } from '../utils/dateUtils';
import type {
  SeasonTeams,
  ConferenceProbabilities,
  Schedules,
  CCGMatchups,
  EveryOutcome,
  LossScenarioData,
  WeekImpact,
  TimelineData,
} from '../types';

/**
 * Calculate relative luminance of a hex color.
 * Returns a value between 0 (black) and 1 (white).
 */
function getLuminance(hex: string): number {
  // Remove # if present
  const color = hex.replace('#', '');
  const r = parseInt(color.substring(0, 2), 16) / 255;
  const g = parseInt(color.substring(2, 4), 16) / 255;
  const b = parseInt(color.substring(4, 6), 16) / 255;

  // Apply gamma correction
  const toLinear = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

  const rLin = toLinear(r);
  const gLin = toLinear(g);
  const bLin = toLinear(b);

  // Calculate luminance
  return 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin;
}

/**
 * Determine if text should be dark or light based on background color.
 */
function shouldUseDarkText(bgColor: string): boolean {
  try {
    const luminance = getLuminance(bgColor);
    return luminance > 0.4; // Use dark text for lighter backgrounds
  } catch {
    return false; // Default to light text if parsing fails
  }
}

export function TeamDetailPage() {
  const { conference: urlConference, teamId } = useParams<{
    conference: string;
    teamId: string;
  }>();
  const [searchParams] = useSearchParams();
  const historicalDate = searchParams.get('date') ?? undefined;

  const sport = 'cfb';
  const season = '2025';
  const teamName = decodeURIComponent(teamId ?? '');

  const [teams, setTeams] = useState<SeasonTeams | null>(null);
  const [schedules, setSchedules] = useState<Schedules | null>(null);
  const [probabilities, setProbabilities] = useState<ConferenceProbabilities | null>(null);
  const [matchups, setMatchups] = useState<CCGMatchups | null>(null);
  const [_everyOutcome, setEveryOutcome] = useState<EveryOutcome | null>(null);
  const [lossScenarioData, setLossScenarioData] = useState<LossScenarioData | null>(null);
  const [weekImpactData, setWeekImpactData] = useState<WeekImpact | null>(null);
  const [timeline, setTimeline] = useState<TimelineData | null>(null);
  const [datesConfig, setDatesConfig] = useState<DatesConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState<string | null>(null);
  const [latestDate, setLatestDate] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      if (!teamName) return;

      setLoading(true);
      setError(null);

      try {
        // Load teams.json to get team metadata
        const teamsRes = await fetch(`/data/${sport}/${season}/teams.json`);
        if (!teamsRes.ok) throw new Error('Failed to load team data');
        const teamsData: SeasonTeams = await teamsRes.json();
        setTeams(teamsData);

        // Get the team's conference
        const teamMeta = teamsData.teams[teamName];
        if (!teamMeta) {
          throw new Error(`Team "${teamName}" not found`);
        }
        const conference = teamMeta.conference;

        // Load dates.json to get latest date
        const datesRes = await fetch(`/data/${sport}/${season}/dates.json`);
        if (!datesRes.ok) throw new Error('Failed to load dates');
        const datesData: DatesConfig = await datesRes.json();
        setDatesConfig(datesData);
        setLatestDate(datesData.latest_date);
        const latestDate = historicalDate ?? datesData.latest_date;
        setCurrentDate(latestDate);

        // Load schedules.json
        const schedulesRes = await fetch(
          `/data/${sport}/${season}/${latestDate}/schedules.json`
        );
        if (!schedulesRes.ok) throw new Error('Failed to load schedule data');
        const schedulesData: Schedules = await schedulesRes.json();
        setSchedules(schedulesData);

        // Load conference probabilities
        const probsRes = await fetch(
          `/data/${sport}/${season}/${latestDate}/${conference}_probabilities.json`
        );
        if (!probsRes.ok) throw new Error('Failed to load probability data');
        const probsData: ConferenceProbabilities = await probsRes.json();
        setProbabilities(probsData);

        // Load CCG matchups
        const matchupsRes = await fetch(
          `/data/${sport}/${season}/${latestDate}/${conference}_ccg_matchups.json`
        );
        if (matchupsRes.ok) {
          const matchupsData: CCGMatchups = await matchupsRes.json();
          setMatchups(matchupsData);
        }

        // Load every outcome data (for per-game CCG probabilities)
        const everyOutcomeRes = await fetch(
          `/data/${sport}/${season}/${latestDate}/${conference}_every_outcome.json`
        );
        if (everyOutcomeRes.ok) {
          const everyOutcomeData: EveryOutcome = await everyOutcomeRes.json();
          setEveryOutcome(everyOutcomeData);
        }

        // Load loss scenarios
        const lossScenariosRes = await fetch(
          `/data/${sport}/${season}/${latestDate}/${conference}_loss_scenarios.json`
        );
        if (lossScenariosRes.ok) {
          const ct = lossScenariosRes.headers.get('content-type');
          if (ct?.includes('application/json')) {
            setLossScenarioData(await lossScenariosRes.json());
          }
        }

        // Load week impact
        const weekImpactRes = await fetch(
          `/data/${sport}/${season}/${latestDate}/${conference}_week_impact.json`
        );
        if (weekImpactRes.ok) {
          const ct = weekImpactRes.headers.get('content-type');
          if (ct?.includes('application/json')) {
            setWeekImpactData(await weekImpactRes.json());
          }
        }

        // Load probability timeline (season-level, not date-specific)
        const timelineRes = await fetch(
          `/data/${sport}/${season}/${conference}_timeline.json`
        );
        if (timelineRes.ok) {
          const ct = timelineRes.headers.get('content-type');
          if (ct?.includes('application/json')) {
            setTimeline(await timelineRes.json());
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [sport, season, teamName, historicalDate]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading team data...</span>
        </div>
      </div>
    );
  }

  if (error || !teams || !schedules) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          <strong>Error:</strong> {error ?? 'Failed to load data'}
        </div>
        <Link to={`/${urlConference ?? 'B12'}`} className="text-blue-600 hover:underline mt-4 inline-block">
          ← Back to Dashboard
        </Link>
      </div>
    );
  }

  const teamMeta = teams.teams[teamName];
  const teamSchedule = schedules.teams[teamName];
  const teamProbs = probabilities?.teams[teamName];
  const conference = teamMeta?.conference;
  const conferenceMeta = conference ? teams.conferences[conference] : null;
  const dateSuffix = historicalDate ? `?date=${historicalDate}` : '';

  if (!teamMeta || !teamSchedule) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-700">
          Team "{teamName}" not found in data.
        </div>
        <Link to={`/${urlConference ?? 'B12'}`} className="text-blue-600 hover:underline mt-4 inline-block">
          ← Back to Dashboard
        </Link>
      </div>
    );
  }

  // Calculate CCG matchup probabilities involving this team
  const rawTeamMatchups = matchups?.matchups
    .filter((m) => m.team_a === teamName || m.team_b === teamName)
    .map((m) => ({
      opponent: m.team_a === teamName ? m.team_b : m.team_a,
      probability: m.probability,
    }))
    .sort((a, b) => b.probability - a.probability)
    .slice(0, 5);

  // Normalize probabilities so they add up to 100%
  const totalProb = rawTeamMatchups?.reduce((sum, m) => sum + m.probability, 0) ?? 0;
  const teamMatchups = rawTeamMatchups?.map((m) => ({
    ...m,
    normalizedProbability: totalProb > 0 ? m.probability / totalProb : 0,
  }));

  // Calculate remaining games from schedule
  const remainingGamesList = teamSchedule.games.filter(g => !g.is_complete);
  const currentWins = teamSchedule.games.filter(g => g.is_complete && g.won).length;
  const currentLosses = teamSchedule.games.filter(g => g.is_complete && !g.won).length;

  // Get conference teams for determining conference games
  const conferenceTeams = conferenceMeta?.teams ?? [];
  const conferenceTeamSet = new Set(conferenceTeams);

  // Calculate current conference record
  const currentConfWins = teamSchedule.games.filter(
    g => g.is_complete && g.won && isConferenceGame(teamName, g.opponent, conferenceTeamSet, season)
  ).length;
  const currentConfLosses = teamSchedule.games.filter(
    g => g.is_complete && !g.won && isConferenceGame(teamName, g.opponent, conferenceTeamSet, season)
  ).length;

  // Calculate conference standings position
  const conferenceStandings = (() => {
    const sorted = conferenceTeams
      .map((team) => {
        const schedule = schedules.teams[team];
        if (!schedule) return null;
        const confTeamSet = new Set(conferenceTeams);
        const confWins = schedule.games.filter(
          (g) => g.is_complete && g.won && isConferenceGame(team, g.opponent, confTeamSet, season)
        ).length;
        const confLosses = schedule.games.filter(
          (g) => g.is_complete && !g.won && isConferenceGame(team, g.opponent, confTeamSet, season)
        ).length;
        const winPct = confWins + confLosses > 0 ? confWins / (confWins + confLosses) : 0;
        return { team, confWins, confLosses, winPct, rank: 0 };
      })
      .filter((t): t is NonNullable<typeof t> => t !== null)
      .sort((a, b) => {
        // Sort by win percentage (descending), then by wins (descending)
        if (b.winPct !== a.winPct) return b.winPct - a.winPct;
        return b.confWins - a.confWins;
      });

    // Assign ranks with ties
    let currentRank = 1;
    for (let i = 0; i < sorted.length; i++) {
      if (i > 0 && sorted[i].winPct < sorted[i - 1].winPct) {
        currentRank = i + 1;
      }
      sorted[i].rank = currentRank;
    }

    return sorted;
  })();

  const teamStanding = conferenceStandings.find((t) => t.team === teamName);
  const standingsPosition = teamStanding?.rank ?? 0;
  const isTied = standingsPosition > 0 && conferenceStandings.filter(t => t.rank === standingsPosition).length > 1;

  // Format ordinal suffix (1st, 2nd, 3rd, etc.)
  const getOrdinalSuffix = (n: number): string => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="text-sm mb-6">
        <Link to={`/${urlConference ?? 'B12'}${dateSuffix}`} className="text-blue-600 hover:underline">
          {conferenceMeta?.display_name ?? urlConference ?? 'Conference'}
        </Link>
        <span className="mx-2 text-gray-400">/</span>
        <span className="text-gray-600">{teamMeta.display_name}</span>
      </nav>

      {/* Team Header */}
      <header className="flex items-center gap-6 mb-8">
        <TeamLogo team={teamName} size="lg" className="w-20 h-20" />
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {teamMeta.display_name}
          </h1>
          <p className="text-lg text-gray-600 mt-2">
            <span className="font-mono font-semibold">{teamSchedule.wins}-{teamSchedule.losses}</span>
            {standingsPosition > 0 && (
              <>
                {' '}{isTied ? 'T' : ''}{getOrdinalSuffix(standingsPosition)}{' '}
                <span className="font-mono">({currentConfWins}-{currentConfLosses})</span>
                {' '}in {conferenceMeta?.display_name ?? conference}
              </>
            )}
          </p>
          {currentDate && (
            <p className="text-sm text-gray-500 mt-1">
              Data from {currentDate}
              {latestDate && currentDate !== latestDate && (
                <>{' · '}<Link to={`/${urlConference}/teams/${encodeURIComponent(teamName)}`} className="text-blue-600 hover:underline">View latest</Link></>
              )}
            </p>
          )}
        </div>
      </header>

      {/* CCG Probability Banner */}
      {teamProbs && (() => {
        const bgColor = teamMeta.primary_color || '#1e40af';
        const useDarkText = shouldUseDarkText(bgColor);
        const textColor = useDarkText ? 'text-gray-900' : 'text-white';
        const textShadow = useDarkText ? 'none' : '0 1px 2px rgba(0,0,0,0.3)';

        return (
          <div className={`rounded-lg p-6 mb-8 ${textColor} relative overflow-hidden`}>
            {/* Background (unfilled portion) */}
            <div
              className="absolute inset-0"
              style={{
                backgroundColor: bgColor,
                opacity: 0.3,
              }}
            />
            {/* Filled portion based on probability */}
            <div
              className="absolute inset-y-0 left-0 transition-all duration-500"
              style={{
                width: `${teamProbs.ccg_probability * 100}%`,
                backgroundColor: bgColor,
              }}
            />
            {/* Content */}
            <div className="relative flex items-center justify-between" style={{ textShadow }}>
              <div>
                <h2 className="text-lg font-medium opacity-90">
                  Probability to Make the Conference Championship Game
                </h2>
                <p className="text-4xl font-bold mt-1">
                  {(teamProbs.ccg_probability * 100).toFixed(1)}%
                </p>
              </div>
              <div className="text-right opacity-75">
                <p className="text-sm">Based on {probabilities?.iterations?.toLocaleString()} simulations</p>
              </div>
            </div>
          </div>
        );
      })()}

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Schedule */}
        <div className="card">
          <h2 className="card-header">Schedule & Results</h2>
          <TeamSchedule
            games={teamSchedule.games}
            teams={teams}
            sport={sport}
            season={season}
            conference={conference ?? urlConference}
            historicalDate={historicalDate}
          />
        </div>

        {/* Record Probabilities */}
        {teamProbs && (
          <div className="card">
            <h2 className="card-header">Record Probabilities</h2>
            <RecordProbabilities
              probabilities={teamProbs}
              teamColor={teamMeta.primary_color}
              currentWins={currentWins}
              currentLosses={currentLosses}
              currentConfWins={currentConfWins}
              currentConfLosses={currentConfLosses}
              remainingGames={remainingGamesList}
              conferenceTeams={conferenceTeams}
              teamName={teamName}
              season={season}
            />
          </div>
        )}
      </div>

      {/* CCG Matchup Probabilities */}
      {teamMatchups && teamMatchups.length > 0 && (
        <div className="card mt-8">
          <h2 className="card-header">
            Most Likely CCG Opponents
          </h2>
          <div className="space-y-2 mt-4">
            {teamMatchups.map(({ opponent, normalizedProbability }) => {
              const oppMeta = teams.teams[opponent];
              const barWidth = normalizedProbability * 100;
              return (
                <div
                  key={opponent}
                  className="flex items-center gap-2"
                >
                  <div className="w-32 shrink-0 flex items-center gap-1.5 justify-end">
                    <Link
                      to={`/${conference ?? urlConference}/teams/${encodeURIComponent(opponent)}${dateSuffix}`}
                      className="text-sm hover:text-blue-600 hover:underline truncate"
                    >
                      {oppMeta?.display_name ?? opponent}
                    </Link>
                    <TeamLogo team={opponent} size="xs" />
                  </div>
                  <div className="flex-1 h-6 bg-gray-100 rounded overflow-hidden relative">
                    <div
                      className="h-full rounded transition-all duration-300"
                      style={{
                        width: `${barWidth}%`,
                        backgroundColor: oppMeta?.primary_color || '#3b82f6',
                        opacity: 0.7,
                      }}
                    />
                    <span className="absolute inset-y-0 flex items-center pl-2 text-xs font-mono font-semibold text-white"
                      style={{ textShadow: '0 0 3px rgba(0,0,0,0.7), 0 0 6px rgba(0,0,0,0.4)' }}
                    >
                      {barWidth.toFixed(1)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Week Impact for this team */}
      {weekImpactData && weekImpactData.teams[teamName] && (
        <div className="card mt-8">
          <h2 className="card-header">This Week's Impact</h2>
          <WeekImpactTable
            weekImpact={weekImpactData}
            teams={teams}
            selectedTeam={teamName}
            conference={conference ?? urlConference}
            historicalDate={historicalDate}
          />
        </div>
      )}

      {/* Loss Scenarios */}
      {lossScenarioData?.teams[teamName]?.scenarios && lossScenarioData.teams[teamName].scenarios.length > 0 && (
        <div className="card mt-8">
          <h2 className="card-header">Loss Combination Scenarios</h2>
          <LossScenarios
            teamName={teamName}
            scenarios={lossScenarioData.teams[teamName].scenarios}
            teams={teams}
            teamColor={teamMeta.primary_color}
            conference={conference ?? urlConference}
            currentLossOpponents={teamSchedule.games.filter(g => g.is_complete && !g.won).map(g => g.opponent)}
          />
        </div>
      )}

      {/* Probability over time */}
      {timeline && (
        <div className="card mt-8">
          <h2 className="card-header">CCG Probability Over Time</h2>
          <ProbabilityTimeline
            timeline={timeline}
            teams={teams}
            highlightTeam={teamName}
            datesConfig={datesConfig}
          />
        </div>
      )}
    </div>
  );
}
