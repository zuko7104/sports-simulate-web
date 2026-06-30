import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { formatProbability } from '../utils/formatProbability';
import { TeamLogo } from './TeamLogo';
import type { ConferenceProbabilities, SeasonTeams, Schedules } from '../types';
import { isConferenceGame } from '../utils/conferenceGame';

interface TeamProbabilityTableProps {
  probabilities: ConferenceProbabilities;
  teams: SeasonTeams;
  schedules: Schedules;
  conference?: string;
  sport?: string;
  season?: string;
  historicalDate?: string;
}

export function TeamProbabilityTable({ probabilities, teams, schedules, conference: conferenceProp, season = '2025', historicalDate }: TeamProbabilityTableProps) {
  const dateSuffix = historicalDate ? `?date=${historicalDate}` : '';
  const conference = conferenceProp ?? probabilities.conference;
  const conferenceTeams = teams.conferences[conference]?.teams ?? [];
  const conferenceTeamSet = useMemo(() => new Set(conferenceTeams), [conferenceTeams]);

  // Calculate standings with conference and overall records
  const standings = useMemo(() => {
    const sorted = conferenceTeams
      .map((teamName) => {
        const schedule = schedules.teams[teamName];
        const teamProbs = probabilities.teams[teamName];
        if (!schedule) return null;

        const confWins = schedule.games.filter(
          (g) => g.is_complete && g.won && isConferenceGame(teamName, g.opponent, conferenceTeamSet, season)
        ).length;
        const confLosses = schedule.games.filter(
          (g) => g.is_complete && !g.won && isConferenceGame(teamName, g.opponent, conferenceTeamSet, season)
        ).length;
        const overallWins = schedule.wins;
        const overallLosses = schedule.losses;
        const winPct = confWins + confLosses > 0 ? confWins / (confWins + confLosses) : 0;
        const ccgProb = teamProbs?.ccg_probability ?? 0;

        return {
          teamName,
          confWins,
          confLosses,
          overallWins,
          overallLosses,
          winPct,
          ccgProb,
          rank: 0, // Will be assigned after sorting
        };
      })
      .filter((t): t is NonNullable<typeof t> => t !== null)
      .sort((a, b) => {
        // Sort by win percentage (descending), then by conf wins (descending), then by ccg prob
        if (b.winPct !== a.winPct) return b.winPct - a.winPct;
        if (b.confWins !== a.confWins) return b.confWins - a.confWins;
        return b.ccgProb - a.ccgProb;
      });

    // Assign ranks with ties (teams with same win percentage get same rank)
    let currentRank = 1;
    for (let i = 0; i < sorted.length; i++) {
      if (i > 0 && sorted[i].winPct < sorted[i - 1].winPct) {
        currentRank = i + 1;
      }
      sorted[i].rank = currentRank;
    }

    return sorted;
  }, [conferenceTeams, schedules, probabilities, conferenceTeamSet, season]);

  return (
    <div className="card">
      <h2 className="card-header">Conference Standings</h2>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-center py-2 px-2 w-8">#</th>
              <th className="text-left py-2 px-3">Team</th>
              <th className="text-center py-2 px-3">Conf</th>
              <th className="text-center py-2 px-3">Overall</th>
              <th className="text-right py-2 px-2 w-12">CCG Odds</th>
              <th className="text-left py-2 px-2 w-24"></th>
            </tr>
          </thead>
          <tbody>
            {standings.map((team) => {
              const teamMeta = teams.teams[team.teamName];
              const percentage = formatProbability(team.ccgProb);

              return (
                <tr key={team.teamName} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="text-center py-2 px-2 text-gray-500 font-mono">
                    {standings.filter(t => t.rank === team.rank).length > 1 ? `T${team.rank}` : team.rank}
                  </td>
                  <td className="py-2 px-3">
                    <Link
                      to={`/${conference ?? probabilities.conference}/teams/${encodeURIComponent(team.teamName)}${dateSuffix}`}
                      className="flex items-center gap-2 hover:text-blue-600"
                    >
                      <TeamLogo team={team.teamName} size="sm" />
                      <span className="font-medium hover:underline">
                        {teamMeta?.display_name ?? team.teamName}
                      </span>
                    </Link>
                  </td>
                  <td className="text-center py-2 px-3 font-mono">
                    {team.confWins}-{team.confLosses}
                  </td>
                  <td className="text-center py-2 px-3 font-mono text-gray-600">
                    {team.overallWins}-{team.overallLosses}
                  </td>
                  <td className="text-right py-2 px-2 font-mono text-sm">
                    {team.ccgProb > 0 ? percentage : '-'}
                  </td>
                  <td className="py-2 px-2">
                    <div className="w-full bg-gray-200 rounded h-4 overflow-hidden">
                      <div
                        className="h-full rounded transition-all duration-300"
                        style={{
                          width: `${team.ccgProb * 100}%`,
                          backgroundColor: teamMeta?.primary_color ?? '#666',
                        }}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-gray-500 mt-3">
        Based on {probabilities.iterations.toLocaleString()} simulations •
        Data from {probabilities.simulation_date}
      </p>
    </div>
  );
}
