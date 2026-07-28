import { useMemo, useRef, useState } from 'react';
import { TeamLogoFor } from './TeamLogo';
import { RankingBadge } from './RankingBadge';
import { ConferenceLogo } from './ConferenceLogo';
import { CCGFlowchartTree } from './CCGFlowchartTree';
import { ZoomPane, type ZoomPaneHandle } from './ZoomPane';
import { getViewerTimeZoneLabel } from '../utils/dateUtils';
import { orderGames } from '../utils/ccgOutcomeCollapse';
import { buildFlowchartTree, layoutFlowchartTree } from '../utils/ccgFlowchartTree';
import { inlineImagesForExport, resolveEffectiveBackground, downloadElementAsPng } from '../utils/exportImages';
import type { SeasonTeams, EveryOutcome, Schedules, ConferenceMetadata } from '../types';
import type { ResolvedRanking } from '../utils/rankings';

interface CCGFlowchartProps {
  teams: SeasonTeams;
  everyOutcome: EveryOutcome;
  schedules: Schedules | null;
  selectedWinners: Record<string, string>;
  onSelectWinner: (game: string, winner: string) => void;
  onClear: () => void;
  conference: string;
  conferenceMeta?: ConferenceMetadata | null;
  currentDate?: string | null;
  rankings?: Record<string, ResolvedRanking> | null;
}

export function CCGFlowchart({
  teams,
  everyOutcome,
  schedules,
  selectedWinners,
  onSelectWinner,
  onClear,
  conference,
  conferenceMeta,
  currentDate,
  rankings,
}: CCGFlowchartProps) {
  const orderedGames = useMemo(() => orderGames(everyOutcome), [everyOutcome]);

  const tree = useMemo(
    () => buildFlowchartTree(everyOutcome, schedules, orderedGames, selectedWinners),
    [everyOutcome, schedules, orderedGames, selectedWinners]
  );
  const layout = useMemo(() => layoutFlowchartTree(tree), [tree]);

  const timeZoneLabel = useMemo(() => getViewerTimeZoneLabel(), []);
  const pickedGameKeys = Object.keys(selectedWinners);
  const [showNames, setShowNames] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const zoomPaneRef = useRef<ZoomPaneHandle>(null);

  function renderSelectedWinners() {
    if (pickedGameKeys.length === 0) return null;
    return (
      <div className="mb-4 text-center">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Selected Winners</h3>
        <div className="flex flex-wrap justify-center gap-2">
          {pickedGameKeys.map((gameKey) => {
            const winner = selectedWinners[gameKey];
            const [team1, team2] = gameKey.split('_vs_');
            const opponent = winner === team1 ? team2 : team1;
            return (
              <button
                key={gameKey}
                onClick={() => onSelectWinner(gameKey, winner)}
                className="flex items-center gap-1.5 rounded-full border border-green-500 bg-green-50 dark:bg-green-500/10 px-2.5 py-1 hover:opacity-75 transition-opacity"
                title="Click to undo this pick"
              >
                <TeamLogoFor team={winner} teams={teams} size="xs" />
                <span className="text-xs font-medium inline-flex items-center gap-1">
                  {teams.teams[winner]?.display_name ?? winner}
                  <RankingBadge team={winner} rankings={rankings} />
                  {' over '}
                  {teams.teams[opponent]?.display_name ?? opponent}
                  <RankingBadge team={opponent} rankings={rankings} />
                </span>
                <span className="text-xs text-gray-400">✕</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  async function handleDownload() {
    const content = zoomPaneRef.current?.getContentElement();
    if (!content || downloading) return;
    setDownloading(true);
    // Capture at natural (untransformed) size regardless of the pane's
    // current pan/zoom, so the export always shows the entire flowchart -
    // not just whatever's currently scrolled/zoomed into view.
    const previousTransform = content.style.transform;
    try {
      content.style.transform = 'none';
      const restoreImages = await inlineImagesForExport(content);
      try {
        // Capture against the card's actual solid background rather than a
        // transparent canvas: several boxes in the tree use translucent
        // (opacity-modified) fills for their dark-theme tinting, which only
        // look right alpha-composited over this same background - a
        // transparent export would still contain the right pixels, but they
        // read as washed-out/faded wherever the image is later viewed
        // against anything lighter. background-color isn't inherited, so
        // this walks up to the nearest ancestor that actually sets one.
        const backgroundColor = resolveEffectiveBackground(content);
        const slug = (conferenceMeta?.abbreviation ?? conference).toLowerCase().replace(/\s+/g, '-');
        await downloadElementAsPng(content, `${slug}-ccg-flowchart.png`, { backgroundColor });
      } finally {
        restoreImages();
      }
    } finally {
      content.style.transform = previousTransform;
      setDownloading(false);
    }
  }

  return (
    <div className="card">
      <div className="flex justify-end items-center gap-4 mb-4 flex-wrap">
        <label className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showNames}
            onChange={(e) => setShowNames(e.target.checked)}
            className="rounded border-gray-300 dark:border-gray-600"
          />
          Show team names
        </label>
        <button
          onClick={() => zoomPaneRef.current?.reset()}
          className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
        >
          Reset Zoom
        </button>
        {pickedGameKeys.length > 0 && (
          <button
            onClick={onClear}
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
          >
            Clear All
          </button>
        )}
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="text-sm px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {downloading ? 'Preparing…' : 'Download PNG'}
        </button>
      </div>

      <ZoomPane ref={zoomPaneRef}>
        {/* The tree is often narrower than the header (a short/simple
            flowchart with few games); without this wrapper the header -
            being the widest child - determines the content box's width,
            and the narrower tree just sits at its left edge instead of
            centered underneath it. items-center centers every child within
            whichever one ends up widest. */}
        <div className="flex flex-col items-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="text-xl font-bold text-gray-900 dark:text-gray-100">SportsSimulate.com</span>
            <ConferenceLogo conference={conference} meta={conferenceMeta} size="md" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">CCG Flowchart</h2>
          </div>
          {renderSelectedWinners()}
          <CCGFlowchartTree teams={teams} layout={layout} onSelectWinner={onSelectWinner} showNames={showNames} />
          {(currentDate || timeZoneLabel) && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-4">
              {currentDate && `Updated as of ${currentDate}. `}
              View the interactive version on SportsSimulate.com.
              {timeZoneLabel && ` All times in ${timeZoneLabel}.`}
            </p>
          )}
        </div>
      </ZoomPane>
    </div>
  );
}
