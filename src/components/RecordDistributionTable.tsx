import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { TeamLogoFor } from './TeamLogo';
import { TeamName } from './TeamName';
import type { ConferenceProbabilities, SeasonTeams, Schedules } from '../types';
import { formatProbability } from '../utils/formatProbability';
import { teamPath } from '../utils/routes';
import type { ResolvedRanking } from '../utils/rankings';

interface RecordDistributionTableProps {
  probabilities: ConferenceProbabilities;
  teams: SeasonTeams;
  schedules: Schedules | null;
  conference?: string;
  sport?: string;
  season?: string;
  historicalDate?: string;
  rankings?: Record<string, ResolvedRanking> | null;
}

type RecordType = 'conference' | 'overall';

function probBgColor(prob: number): string {
  if (prob <= 0) return 'transparent';
  const alpha = Math.min(prob * 1.5, 1);
  return `rgba(59, 130, 246, ${alpha})`; // blue with opacity
}

function probTextClass(prob: number, impossible: boolean): string {
  if (impossible) return 'text-gray-300 dark:text-gray-600';
  if (prob <= 0) return 'text-gray-400 dark:text-gray-500';
  if (prob >= 0.4) return 'text-white dark:text-gray-100';
  return 'text-gray-800 dark:text-gray-100';
}

export function RecordDistributionTable({ probabilities, teams, schedules, conference: conferenceProp, sport, season, historicalDate, rankings }: RecordDistributionTableProps) {
  const [recordType, setRecordType] = useState<RecordType>('conference');
  const conference = conferenceProp ?? probabilities.conference;
  const dateSuffix = historicalDate ? `?date=${historicalDate}` : '';
  const conferenceTeams = teams.conferences[conference]?.teams ?? [];
  const conferenceTeamSet = useMemo(() => new Set(conferenceTeams), [conferenceTeams]);

  // Compute current records and possible final record ranges per team
  const teamRecords = useMemo(() => {
    const result: Record<string, {
      overallWins: number; overallLosses: number;
      confWins: number; confLosses: number;
      remainingTotal: number; remainingConf: number;
    }> = {};
    if (!schedules) return result;
    for (const teamName of conferenceTeams) {
      const sched = schedules.teams[teamName];
      if (!sched) continue;
      let confWins = 0, confLosses = 0, remainingConf = 0;
      let remainingTotal = 0;
      for (const game of sched.games) {
        const isConf = game.is_conference ?? conferenceTeamSet.has(game.opponent);
        if (game.is_complete) {
          if (isConf) {
            if (game.won) confWins++; else confLosses++;
          }
        } else {
          remainingTotal++;
          if (isConf) remainingConf++;
        }
      }
      result[teamName] = {
        overallWins: sched.wins, overallLosses: sched.losses,
        confWins, confLosses,
        remainingTotal, remainingConf,
      };
    }
    return result;
  }, [schedules, conferenceTeams, conferenceTeamSet]);

  function isImpossible(teamName: string, record: string): boolean {
    const tr = teamRecords[teamName];
    if (!tr) return false;
    const [wins, losses] = record.split('-').map(Number);
    if (recordType === 'conference') {
      if (losses < tr.confLosses) return true;
      if (wins > tr.confWins + tr.remainingConf) return true;
      if (wins < tr.confWins) return true;
      if (losses > tr.confLosses + tr.remainingConf) return true;
    } else {
      if (losses < tr.overallLosses) return true;
      if (wins > tr.overallWins + tr.remainingTotal) return true;
      if (wins < tr.overallWins) return true;
      if (losses > tr.overallLosses + tr.remainingTotal) return true;
    }
    return false;
  }

  const { teamData, allRecords } = useMemo(() => {
    const recordSet = new Set<string>();
    const data: { teamName: string; records: Record<string, number> }[] = [];

    for (const teamName of conferenceTeams) {
      const teamProbs = probabilities.teams[teamName];
      if (!teamProbs) continue;

      const records = recordType === 'conference'
        ? teamProbs.conference_record_probabilities
        : teamProbs.record_probabilities;

      if (!records) continue;

      for (const record of Object.keys(records)) {
        recordSet.add(record);
      }

      data.push({ teamName, records });
    }

    // Sort records by wins descending
    const sorted = Array.from(recordSet).sort((a, b) => {
      const aWins = parseInt(a.split('-')[0]);
      const bWins = parseInt(b.split('-')[0]);
      return bWins - aWins;
    });

    // Sort teams by average wins descending
    data.sort((a, b) => {
      const meanWins = (d: typeof data[0]) => sorted.reduce((sum, record) => {
        const wins = parseInt(record.split('-')[0]);
        return sum + wins * (d.records[record] ?? 0);
      }, 0);
      return meanWins(b) - meanWins(a);
    });

    return { teamData: data, allRecords: sorted };
  }, [conferenceTeams, probabilities, recordType]);

  if (teamData.length === 0) return null;

  return (
    <div className="card">
      <div className="flex flex-wrap items-start sm:items-center justify-between gap-2 mb-4">
        <div>
          <h2 className="card-header mb-0">Final Record Distribution</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Probability of each team finishing with a given {recordType} record
          </p>
        </div>
        <div className="flex rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600">
          <button
            onClick={() => setRecordType('conference')}
            className={`px-3 py-1 text-sm font-medium ${
              recordType === 'conference'
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            Conference
          </button>
          <button
            onClick={() => setRecordType('overall')}
            className={`px-3 py-1 text-sm font-medium ${
              recordType === 'overall'
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            Overall
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-2 px-2 sticky left-0 bg-white dark:bg-gray-800">Team</th>
              {allRecords.map((record) => (
                <th key={record} className="text-center py-2 px-2 font-mono whitespace-nowrap">
                  {record}
                </th>
              ))}
              <th className="text-center py-2 px-2 whitespace-nowrap">Avg Wins</th>
            </tr>
          </thead>
          <tbody>
            {teamData.map(({ teamName, records }) => {
              const tr = teamRecords[teamName];
              const currentRecord = tr
                ? recordType === 'conference'
                  ? `${tr.confWins}-${tr.confLosses}`
                  : `${tr.overallWins}-${tr.overallLosses}`
                : null;
              const meanWins = allRecords.reduce((sum, record) => {
                const wins = parseInt(record.split('-')[0]);
                const prob = records[record] ?? 0;
                return sum + wins * prob;
              }, 0);
              return (
              <tr key={teamName} className="border-b border-gray-100 dark:border-gray-800">
                <td className="py-1.5 px-2 sticky left-0 bg-white dark:bg-gray-800 min-w-[120px] sm:min-w-0">
                  <Link
                    to={`${teamPath(conference, teamName, sport, season)}${dateSuffix}`}
                    className="flex items-center gap-1.5 min-w-0 hover:text-blue-600 dark:hover:text-blue-400"
                  >
                    <TeamLogoFor team={teamName} teams={teams} size="xs" className="shrink-0" />
                    <TeamName team={teamName} teams={teams} rankings={rankings} className="font-medium text-xs truncate min-w-0 hover:underline" />
                    {currentRecord && (
                      <span className="sm:inline text-xs text-gray-400 dark:text-gray-500 font-mono whitespace-nowrap">
                        ({currentRecord})
                      </span>
                    )}
                  </Link>
                </td>
                {allRecords.map((record) => {
                  const prob = records[record] ?? 0;
                  const impossible = isImpossible(teamName, record);
                  return (
                    <td
                      key={record}
                      className={`text-center py-1.5 px-2 font-mono text-xs whitespace-nowrap ${probTextClass(prob, impossible)}`}
                      style={{
                        backgroundColor: impossible ? 'transparent' : probBgColor(prob),
                      }}
                    >
                      {impossible ? '-' : prob <= 0 ? '0.0%' : formatProbability(prob)}
                    </td>
                  );
                })}
                <td className="text-center py-1.5 px-2 font-mono text-xs font-semibold">
                  {meanWins.toFixed(1)}
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
