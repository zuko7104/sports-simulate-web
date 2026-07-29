import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { TeamLogoFor } from './TeamLogo';
import { TeamName } from './TeamName';
import { ConferenceLogo } from './ConferenceLogo';
import { DownloadPngButton } from './DownloadPngButton';
import { CardExportFooter } from './CardExportFooter';
import { useExportableCard } from '../hooks/useExportableCard';
import { teamPath } from '../utils/routes';
import { isConferenceGame } from '../utils/conferenceGame';
import type { ResolvedRanking } from '../utils/rankings';
import type { SeasonTeams, Schedules } from '../types';

interface BasicConferenceStandingsProps {
  teams: SeasonTeams;
  schedules: Schedules;
  conference: string;
  sport?: string;
  season?: string;
  historicalDate?: string;
  dataDate?: string | null;
  rankings?: Record<string, ResolvedRanking> | null;
}

/**
 * Standings-only view for "basic" (no-simulation) conference groups: FCS
 * conferences, the 2025 Pac-12, and independents. These groups have no
 * championship-game simulation, so this renders just win-loss records
 * (overall and conference) sorted by conference win percentage, instead of
 * the full probability/matchup tables used for simulated conferences.
 */
export function BasicConferenceStandings({ teams, schedules, conference, sport, season = '2025', historicalDate, dataDate, rankings }: BasicConferenceStandingsProps) {
  const conferenceMeta = teams.conferences[conference];
  const dateSuffix = historicalDate ? `?date=${historicalDate}` : '';
  const conferenceTeams = teams.conferences[conference]?.teams ?? [];
  const conferenceTeamSet = useMemo(() => new Set(conferenceTeams), [conferenceTeams]);

  const standings = useMemo(() => {
    const sorted = conferenceTeams
      .map((teamName) => {
        const schedule = schedules.teams[teamName];
        if (!schedule) return null;

        const confWins = schedule.games.filter(
          (g) => g.is_complete && g.won && isConferenceGame(teamName, g.opponent, conferenceTeamSet, season)
        ).length;
        const confLosses = schedule.games.filter(
          (g) => g.is_complete && !g.won && isConferenceGame(teamName, g.opponent, conferenceTeamSet, season)
        ).length;
        const winPct = confWins + confLosses > 0 ? confWins / (confWins + confLosses) : 0;

        return {
          teamName,
          confWins,
          confLosses,
          overallWins: schedule.wins,
          overallLosses: schedule.losses,
          winPct,
          rank: 0,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .sort((a, b) => b.winPct - a.winPct || b.overallWins - a.overallWins);

    // Assign ranks, with ties sharing the same rank (e.g. two teams tied
    // for 1st both show "T1", and the next team is ranked 3rd).
    let currentRank = 1;
    for (let i = 0; i < sorted.length; i++) {
      if (i > 0 && sorted[i].winPct < sorted[i - 1].winPct) {
        currentRank = i + 1;
      }
      sorted[i].rank = currentRank;
    }

    return sorted;
  }, [conferenceTeams, conferenceTeamSet, schedules, season]);

  const slug = (conferenceMeta?.abbreviation ?? conference).toLowerCase().replace(/\s+/g, '-');
  const { contentRef, hideOnExport, brandRef, downloading, handleDownload } = useExportableCard(`${slug}-standings.png`);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden" ref={contentRef}>
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <ConferenceLogo conference={conference} meta={conferenceMeta} size="sm" />
            Standings
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No championship simulation is run for this group — showing current records only.
          </p>
        </div>
        <div ref={hideOnExport}>
          <DownloadPngButton downloading={downloading} onClick={handleDownload} />
        </div>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-gray-50 dark:bg-gray-900/50 text-left text-gray-600 dark:text-gray-400">
          <tr>
            <th className="px-4 py-2 text-right w-12">#</th>
            <th className="px-4 py-2">Team</th>
            <th className="px-4 py-2 text-right">Conf</th>
            <th className="px-4 py-2 text-right">Overall</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
          {standings.map((row) => {
            const isTied = standings.filter((r) => r.rank === row.rank).length > 1;
            return (
              <tr key={row.teamName} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-4 py-2 text-right text-gray-500 dark:text-gray-400 font-mono">
                  {isTied ? `T${row.rank}` : row.rank}
                </td>
                <td className="px-4 py-2">
                  <Link
                    to={`${teamPath(conference, row.teamName, sport, season)}${dateSuffix}`}
                    className="flex items-center gap-2 text-gray-900 dark:text-gray-100 hover:underline"
                  >
                    <TeamLogoFor team={row.teamName} teams={teams} size="sm" />
                    <TeamName team={row.teamName} teams={teams} rankings={rankings} />
                  </Link>
                </td>
                <td className="px-4 py-2 text-right text-gray-700 dark:text-gray-300">
                  {row.confWins}-{row.confLosses}
                </td>
                <td className="px-4 py-2 text-right text-gray-700 dark:text-gray-300">
                  {row.overallWins}-{row.overallLosses}
                </td>
              </tr>
            );
          })}
          {standings.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-6 text-center text-gray-500 dark:text-gray-400">
                No teams found for this group.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {dataDate && (
        <div className="px-4 pb-3">
          <CardExportFooter ref={brandRef} dataDate={dataDate} />
        </div>
      )}
    </div>
  );
}
