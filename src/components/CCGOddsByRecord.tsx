import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { TeamLogoFor } from './TeamLogo';
import { TeamName } from './TeamName';
import type { ConferenceProbabilities, SeasonTeams } from '../types';
import { formatProbability } from '../utils/formatProbability';
import { teamPath } from '../utils/routes';

interface CCGOddsByRecordProps {
  probabilities: ConferenceProbabilities;
  teams: SeasonTeams;
  conference?: string;
  sport?: string;
  season?: string;
  historicalDate?: string;
}

function probBgColor(prob: number): string {
  if (prob <= 0) return 'transparent';
  const alpha = Math.min(prob * 1.5, 1);
  return `rgba(59, 130, 246, ${alpha})`;
}

function probTextClass(prob: number): string {
  if (prob <= 0) return 'text-gray-400 dark:text-gray-500';
  if (prob >= 0.4) return 'text-white dark:text-gray-100';
  return 'text-gray-800 dark:text-gray-100';
}

export function CCGOddsByRecord({ probabilities, teams, conference: conferenceProp, sport, season, historicalDate }: CCGOddsByRecordProps) {
  const conference = conferenceProp ?? probabilities.conference;
  const dateSuffix = historicalDate ? `?date=${historicalDate}` : '';
  const conferenceTeams = teams.conferences[conference]?.teams ?? [];

  // Collect all conference records across all teams, sorted by wins descending
  const { teamData, allRecords } = useMemo(() => {
    const recordSet = new Set<string>();
    const data: { teamName: string; records: Record<string, number>; ccgProb: number }[] = [];

    for (const teamName of conferenceTeams) {
      const teamProbs = probabilities.teams[teamName];
      if (!teamProbs?.ccg_probability_by_conference_record) continue;

      const records = teamProbs.ccg_probability_by_conference_record;
      for (const record of Object.keys(records)) {
        recordSet.add(record);
      }

      data.push({ teamName, records, ccgProb: teamProbs.ccg_probability ?? 0 });
    }

    // Sort records by wins descending (e.g., "9-0", "8-1", "7-2", ...)
    const sorted = Array.from(recordSet).sort((a, b) => {
      const aWins = parseInt(a.split('-')[0]);
      const bWins = parseInt(b.split('-')[0]);
      return bWins - aWins;
    });

    // Filter out columns where all teams have zero probability
    const nonEmpty = sorted.filter(record =>
      data.some(({ records }) => (records[record] ?? 0) > 0)
    );

    // Sort teams by CCG probability descending
    data.sort((a, b) => b.ccgProb - a.ccgProb);

    return { teamData: data, allRecords: nonEmpty };
  }, [conferenceTeams, probabilities]);

  if (teamData.length === 0 || allRecords.length === 0) return null;

  return (
    <div className="card">
      <h2 className="card-header">CCG Odds by Conference Record</h2>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Probability of making the conference championship game given a final conference record
      </p>
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
              <th className="text-center py-2 px-2 whitespace-nowrap">Overall</th>
            </tr>
          </thead>
          <tbody>
            {teamData.map(({ teamName, records, ccgProb }) => (
              <tr key={teamName} className="border-b border-gray-100 dark:border-gray-800">
                <td className="py-1.5 px-2 sticky left-0 bg-white dark:bg-gray-800">
                  <Link
                    to={`${teamPath(conference, teamName, sport, season)}${dateSuffix}`}
                    className="flex items-center gap-1.5 hover:text-blue-600 dark:hover:text-blue-400"
                  >
                    <TeamLogoFor team={teamName} teams={teams} size="xs" />
                    <TeamName team={teamName} teams={teams} className="font-medium text-xs whitespace-nowrap hover:underline" />
                  </Link>
                </td>
                {allRecords.map((record) => {
                  const prob = records[record] ?? 0;
                  return (
                    <td
                      key={record}
                      className={`text-center py-1.5 px-2 font-mono text-xs whitespace-nowrap ${probTextClass(prob)}`}
                      style={{
                        backgroundColor: probBgColor(prob),
                      }}
                    >
                      {formatProbability(prob)}
                    </td>
                  );
                })}
                <td
                  className={`text-center py-1.5 px-2 font-mono text-xs font-semibold whitespace-nowrap ${probTextClass(ccgProb)}`}
                  style={{
                    backgroundColor: probBgColor(ccgProb),
                  }}
                >
                  {formatProbability(ccgProb)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
