import { useEffect, useMemo, useRef, useState } from 'react';
import { TeamLogoFor } from './TeamLogo';
import { RankingBadge } from './RankingBadge';
import { ConferenceLogo } from './ConferenceLogo';
import { dateToWeekNumber, formatKickoff, formatShortDate, getViewerTimeZoneLabel } from '../utils/dateUtils';
import { orderGames, collapseOutcomes, relevantGames, gameKeyFor } from '../utils/ccgOutcomeCollapse';
import { inlineImagesForExport, resolveEffectiveBackground, downloadElementAsPng } from '../utils/exportImages';
import type { SeasonTeams, EveryOutcome, ConferenceMetadata } from '../types';
import type { ResolvedRanking } from '../utils/rankings';

interface CCGWaysToLockTableProps {
  teams: SeasonTeams;
  everyOutcome: EveryOutcome;
  week1Start?: string;
  conference: string;
  conferenceMeta?: ConferenceMetadata | null;
  rankings?: Record<string, ResolvedRanking> | null;
}

const UNLIKELY_THRESHOLD = 0.01;
const LOCKED_CONFIDENCE_THRESHOLD = 0.999;
// Above this many rows, default to hiding the unlikely tail so the table
// doesn't open in an overwhelming wall of long-shot outcomes.
const MANY_ROWS_THRESHOLD = 20;

export function CCGWaysToLockTable({ teams, everyOutcome, week1Start, conference, conferenceMeta, rankings }: CCGWaysToLockTableProps) {
  const orderedGames = useMemo(() => orderGames(everyOutcome), [everyOutcome]);
  const rows = useMemo(() => collapseOutcomes(everyOutcome, orderedGames), [everyOutcome, orderedGames]);
  const relevant = useMemo(() => relevantGames(orderedGames, rows), [orderedGames, rows]);

  const [showUnlikely, setShowUnlikely] = useState(() => rows.length <= MANY_ROWS_THRESHOLD);
  // Re-derive the default whenever new data loads (conference/date switch),
  // rather than carrying over whatever the user had toggled for the last dataset.
  useEffect(() => {
    setShowUnlikely(rows.length <= MANY_ROWS_THRESHOLD);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [everyOutcome]);

  const [downloading, setDownloading] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const dates = useMemo(() => everyOutcome.game_dates ?? {}, [everyOutcome]);
  const kickoffs = useMemo(() => everyOutcome.game_kickoffs ?? {}, [everyOutcome]);
  const timeZoneLabel = useMemo(() => getViewerTimeZoneLabel(), []);

  const relevantIndices = useMemo(() => {
    const relevantKeys = new Set(relevant.map(gameKeyFor));
    return orderedGames
      .map((game, i) => (relevantKeys.has(gameKeyFor(game)) ? i : -1))
      .filter((i) => i !== -1);
  }, [orderedGames, relevant]);

  // Week-boundary indices (within `relevant`) where the week number changes,
  // for a visual divider between weeks — shared visual seam with the flowchart.
  const boundaryIndices = useMemo(() => {
    if (!week1Start) return new Set<number>();
    const boundaries = new Set<number>();
    let lastWeek: number | null = null;
    relevant.forEach((game, i) => {
      const date = dates[gameKeyFor(game)];
      if (!date) return;
      const week = dateToWeekNumber(date, week1Start);
      if (lastWeek !== null && week !== lastWeek) boundaries.add(i);
      lastWeek = week;
    });
    return boundaries;
  }, [relevant, dates, week1Start]);

  const likelyRows = useMemo(() => rows.filter((row) => row.probability >= UNLIKELY_THRESHOLD), [rows]);
  const unlikelyCount = rows.length - likelyRows.length;
  const displayedRows = showUnlikely ? rows : likelyRows;

  async function handleDownload() {
    const content = contentRef.current;
    if (!content || downloading) return;
    setDownloading(true);
    try {
      const restoreImages = await inlineImagesForExport(content);
      try {
        const backgroundColor = resolveEffectiveBackground(content);
        const slug = (conferenceMeta?.abbreviation ?? conference).toLowerCase().replace(/\s+/g, '-');
        await downloadElementAsPng(content, `${slug}-ways-to-lock-ccg.png`, { backgroundColor });
      } finally {
        restoreImages();
      }
    } finally {
      setDownloading(false);
    }
  }

  if (relevant.length === 0) {
    return (
      <div className="card">
        <p className="text-gray-500 dark:text-gray-400 text-sm">No games currently affect the CCG matchup.</p>
      </div>
    );
  }

  const borderClass = (i: number) => (boundaryIndices.has(i) ? 'border-l-2 border-gray-400 dark:border-gray-500' : '');

  return (
    <div className="card">
      <div className="flex justify-end mb-4">
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="text-sm px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {downloading ? 'Preparing…' : 'Download PNG'}
        </button>
      </div>

      <div ref={contentRef}>
        <div className="flex items-center justify-center gap-2 mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">SportsSimulate.com Ways to Lock the</h2>
          <ConferenceLogo conference={conference} meta={conferenceMeta} size="md" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">CCG</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-base border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-300 dark:border-gray-600">
                {relevant.map((game, i) => {
                  const [team1, team2] = game;
                  const date = dates[gameKeyFor(game)];
                  const kickoff = kickoffs[gameKeyFor(game)];
                  const kickoffLabel = formatKickoff(kickoff);
                  return (
                    <th key={gameKeyFor(game)} className={`px-4 py-3 text-center font-medium ${borderClass(i)}`}>
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-sm whitespace-nowrap">
                          {teams.teams[team1]?.abbreviation ?? team1} @ {teams.teams[team2]?.abbreviation ?? team2}
                        </span>
                        {date && (
                          <span className="text-xs font-normal text-gray-400 dark:text-gray-500 whitespace-nowrap">
                            {formatShortDate(date)}
                            {kickoffLabel && ` · ${kickoffLabel}`}
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
                <th className="px-4 py-3 text-center font-medium border-l-2 border-gray-400 dark:border-gray-500">
                  Probability
                </th>
                <th className="px-4 py-3 text-center font-medium" colSpan={2}>
                  CCG Matchup
                </th>
              </tr>
            </thead>
            <tbody>
              {displayedRows.map((row, rowIdx) => {
                const uncertain = row.matchupConfidence < LOCKED_CONFIDENCE_THRESHOLD;
                return (
                  <tr key={rowIdx} className="border-b border-gray-100 dark:border-gray-800">
                    {relevantIndices.map((gameIdx, i) => {
                      const winner = row.gameOutcomes[gameIdx];
                      return (
                        <td key={gameIdx} className={`px-4 py-3 text-center ${borderClass(i)}`}>
                          {winner ? (
                            <div className="flex flex-col items-center gap-1">
                              <TeamLogoFor team={winner} teams={teams} size="sm" />
                              <span className="text-xs">{teams.teams[winner]?.abbreviation ?? winner}</span>
                              <RankingBadge team={winner} rankings={rankings} />
                            </div>
                          ) : (
                            <span className="text-gray-400 dark:text-gray-500 text-sm italic">Any</span>
                          )}
                        </td>
                      );
                    })}
                    <td
                      className="px-4 py-3 text-center font-mono border-l-2 border-gray-400 dark:border-gray-500"
                      title={uncertain ? `${(row.matchupConfidence * 100).toFixed(1)}% confidence within this row` : undefined}
                    >
                      {(row.probability * 100).toFixed(1)}%
                      {uncertain && <span className="text-amber-500 ml-0.5">~</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <TeamLogoFor team={row.ccgMatchup[0]} teams={teams} size="md" />
                        <span className="text-xs">{teams.teams[row.ccgMatchup[0]]?.display_name ?? row.ccgMatchup[0]}</span>
                        <RankingBadge team={row.ccgMatchup[0]} rankings={rankings} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <TeamLogoFor team={row.ccgMatchup[1]} teams={teams} size="md" />
                        <span className="text-xs">{teams.teams[row.ccgMatchup[1]]?.display_name ?? row.ccgMatchup[1]}</span>
                        <RankingBadge team={row.ccgMatchup[1]} rankings={rankings} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
          Rows aren't mutually exclusive — the same actual outcome can satisfy more than one row's stated conditions,
          so probabilities don't sum to 100%.
          {timeZoneLabel && ` All times in ${timeZoneLabel}.`}
        </p>
      </div>

      {!showUnlikely && unlikelyCount > 0 && (
        <button
          onClick={() => setShowUnlikely(true)}
          className="mt-3 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
        >
          Show {unlikelyCount} more unlikely outcome{unlikelyCount !== 1 ? 's' : ''}
        </button>
      )}
      {showUnlikely && unlikelyCount > 0 && (
        <button
          onClick={() => setShowUnlikely(false)}
          className="mt-3 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
        >
          Hide unlikely outcomes
        </button>
      )}
    </div>
  );
}
