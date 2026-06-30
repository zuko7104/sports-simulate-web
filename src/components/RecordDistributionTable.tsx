import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { TeamLogo } from './TeamLogo';
import type { ConferenceProbabilities, SeasonTeams, Schedules } from '../types';
import { formatProbability } from '../utils/formatProbability';

interface RecordDistributionTableProps {
  probabilities: ConferenceProbabilities;
  teams: SeasonTeams;
  schedules: Schedules | null;
  conference?: string;
  historicalDate?: string;
}

type RecordType = 'conference' | 'overall';

function probBgColor(prob: number): string {
  if (prob <= 0) return 'transparent';
  const alpha = Math.min(prob * 1.5, 1);
  return `rgba(59, 130, 246, ${alpha})`; // blue with opacity
}

function probTextColor(prob: number): string {
  if (prob <= 0) return '#9ca3af';
  if (prob >= 0.4) return '#ffffff';
  return '#1f2937';
}

export function RecordDistributionTable({ probabilities, teams, schedules, conference: conferenceProp, historicalDate }: RecordDistributionTableProps) {
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
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="card-header mb-0">Final Record Distribution</h2>
          <p className="text-sm text-gray-600 mt-1">
            Probability of each team finishing with a given {recordType} record
          </p>
        </div>
        <div className="flex rounded-lg overflow-hidden border border-gray-300">
          <button
            onClick={() => setRecordType('conference')}
            className={`px-3 py-1 text-sm font-medium ${
              recordType === 'conference'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            Conference
          </button>
          <button
            onClick={() => setRecordType('overall')}
            className={`px-3 py-1 text-sm font-medium ${
              recordType === 'overall'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            Overall
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 px-2 sticky left-0 bg-white">Team</th>
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
              <tr key={teamName} className="border-b border-gray-100">
                <td className="py-1.5 px-2 sticky left-0 bg-white">
                  <Link
                    to={`/${conference}/teams/${encodeURIComponent(teamName)}${dateSuffix}`}
                    className="flex items-center gap-1.5 hover:text-blue-600"
                  >
                    <TeamLogo team={teamName} size="xs" />
                    <span className="font-medium text-xs whitespace-nowrap hover:underline">
                      {teams.teams[teamName]?.display_name ?? teamName}
                    </span>
                    {currentRecord && (
                      <span className="text-xs text-gray-400 font-mono whitespace-nowrap">
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
                      className="text-center py-1.5 px-2 font-mono text-xs"
                      style={{
                        backgroundColor: impossible ? '#f3f4f6' : probBgColor(prob),
                        color: impossible ? '#d1d5db' : probTextColor(prob),
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
