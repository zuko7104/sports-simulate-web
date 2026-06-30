import { useState } from 'react';
import type { TeamProbabilities, GameResult } from '../types';
import { isConferenceGame } from '../utils/conferenceGame';

type ViewMode = 'conference' | 'overall';

interface RecordProbabilitiesProps {
  probabilities: TeamProbabilities;
  teamColor?: string;
  currentWins: number;
  currentLosses: number;
  currentConfWins: number;
  currentConfLosses: number;
  remainingGames: GameResult[];
  conferenceTeams: string[];
  teamName: string;
  season: string;
}

export function RecordProbabilities({
  probabilities,
  teamColor = '#3b82f6',
  currentWins,
  currentLosses,
  currentConfWins,
  currentConfLosses,
  remainingGames,
  conferenceTeams,
  teamName,
  season,
}: RecordProbabilitiesProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('conference');

  const conferenceTeamSet = new Set(conferenceTeams);

  // Count remaining games (total and conference)
  const remainingTotal = remainingGames.length;
  const remainingConf = remainingGames.filter((g) =>
    isConferenceGame(teamName, g.opponent, conferenceTeamSet, season)
  ).length;

  // Generate all possible final records based on remaining games
  const generateAllRecords = (
    currentW: number,
    currentL: number,
    remaining: number
  ) => {
    const records: { record: string; wins: number; losses: number }[] = [];
    for (let additionalWins = 0; additionalWins <= remaining; additionalWins++) {
      const additionalLosses = remaining - additionalWins;
      const finalWins = currentW + additionalWins;
      const finalLosses = currentL + additionalLosses;
      records.push({
        record: `${finalWins}-${finalLosses}`,
        wins: finalWins,
        losses: finalLosses,
      });
    }
    // Sort by wins descending
    return records.sort((a, b) => b.wins - a.wins);
  };

  // Get all possible records for the current view mode
  const allPossibleRecords =
    viewMode === 'conference'
      ? generateAllRecords(currentConfWins, currentConfLosses, remainingConf)
      : generateAllRecords(currentWins, currentLosses, remainingTotal);

  // Get probability data for lookup
  const recordProbs =
    viewMode === 'conference'
      ? probabilities.conference_record_probabilities
      : probabilities.record_probabilities;

  // Use the appropriate CCG lookup based on view mode
  const ccgByRecord =
    viewMode === 'conference'
      ? probabilities.ccg_probability_by_conference_record
      : probabilities.ccg_probability_by_record;

  return (
    <div className="space-y-4">
      {/* View Toggle */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit">
        <button
          onClick={() => setViewMode('conference')}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            viewMode === 'conference'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Conference
        </button>
        <button
          onClick={() => setViewMode('overall')}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            viewMode === 'overall'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Overall
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">
                {viewMode === 'conference' ? 'Conf Record' : 'Record'}
              </th>
              <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">
                Probability
              </th>
              <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">
                CCG if this record
              </th>
            </tr>
          </thead>
          <tbody>
            {allPossibleRecords.map(({ record }) => {
              // Look up probability from data, default to 0 if not present
              const probability = recordProbs?.[record] ?? 0;
              const ccgProb = ccgByRecord?.[record] ?? 0;

              return (
                <tr key={record} className="border-b border-gray-100">
                  <td className="py-2 px-3">
                    <span className="font-mono text-sm font-semibold">
                      {record}
                    </span>
                  </td>
                  <td className="py-2 px-3 w-48">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${probability * 100}%`,
                            backgroundColor: teamColor,
                          }}
                        />
                      </div>
                      <span className="text-sm font-mono text-gray-600 w-14 text-right">
                        {probability > 0
                          ? `${(probability * 100).toFixed(1)}%`
                          : '0%'}
                      </span>
                    </div>
                  </td>
                  <td className="py-2 px-3">
                    <span
                      className={`text-sm font-mono ${
                        ccgProb >= 0.5
                          ? 'text-green-600 font-semibold'
                          : ccgProb >= 0.2
                          ? 'text-yellow-600'
                          : ccgProb > 0
                          ? 'text-gray-500'
                          : 'text-gray-400'
                      }`}
                    >
                      {ccgProb > 0 ? `${(ccgProb * 100).toFixed(1)}%` : '0%'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-gray-500 mt-2">
        <p>
          <strong>
            {viewMode === 'conference' ? 'Conf Record' : 'Record'}:
          </strong>{' '}
          Probability of finishing with each{' '}
          {viewMode === 'conference' ? 'conference' : 'overall'} record.
        </p>
        <p>
          <strong>CCG if this record:</strong> If the team finishes with this
          {viewMode === 'conference' ? ' conference' : ' overall'} record, their probability of making the championship game.
        </p>
      </div>
    </div>
  );
}
