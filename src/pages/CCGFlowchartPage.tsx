import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useConferenceData } from '../hooks/useConferenceData';
import { useWhatIf } from '../hooks/useWhatIf';
import { usePageTitle } from '../hooks/usePageTitle';
import { AdSlot } from '../components/AdSlot';
import { CCGFlowchart } from '../components/CCGFlowchart';
import { CCGWaysToLockTable } from '../components/CCGWaysToLockTable';
import { ConferenceSelector } from '../components/ConferenceSelector';
import { getConferenceFinalGameDate, isWithinFinalWeeks } from '../utils/seasonWindow';
import { DEFAULT_SPORT, CURRENT_SEASON, conferenceSwitchPath } from '../utils/routes';

const DEFAULT_CONFERENCES = ['B12', 'SEC', 'B10', 'ACC'];

type Mode = 'flowchart' | 'ways-to-lock';

export function CCGFlowchartPage() {
  const {
    sport: selectedSport = DEFAULT_SPORT,
    year: selectedSeason = CURRENT_SEASON,
    conference: selectedConference = 'B12',
  } = useParams<{ sport: string; year: string; conference: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const historicalDate = searchParams.get('date') ?? undefined;
  const [mode, setMode] = useState<Mode>('flowchart');
  const [selectedWinners, setSelectedWinners] = useState<Record<string, string>>({});

  const {
    teams,
    schedules,
    everyOutcome,
    rankings,
    loading,
    error,
    currentDate,
    datesConfig,
    loadConference,
  } = useConferenceData();
  const { setWinner, clearSelections } = useWhatIf(everyOutcome, selectedWinners, setSelectedWinners);

  useEffect(() => {
    loadConference(selectedSport, selectedSeason, selectedConference, historicalDate);
  }, [selectedConference, selectedSport, selectedSeason, historicalDate, loadConference]);

  // Reset picks when switching conference/season/date, without calling
  // setState directly inside the data-fetching effect above (see React's
  // "Resetting all state when a prop changes" pattern).
  const resetKey = `${selectedSport}|${selectedSeason}|${selectedConference}|${historicalDate ?? ''}`;
  const [lastResetKey, setLastResetKey] = useState(resetKey);
  if (resetKey !== lastResetKey) {
    setLastResetKey(resetKey);
    setSelectedWinners({});
  }

  const conferences = teams?.conferences ? Object.keys(teams.conferences) : DEFAULT_CONFERENCES;
  const conferenceDisplayName = teams?.conferences[selectedConference]?.display_name ?? selectedConference;
  usePageTitle(`${conferenceDisplayName} CCG Flowchart`);

  const handleConferenceChange = (conf: string) => {
    const dateSuffix = historicalDate ? `?date=${historicalDate}` : '';
    const hasSimulation = teams?.conferences[conf]?.has_simulation !== false;
    navigate(`${conferenceSwitchPath(conf, 'flowchart', hasSimulation, selectedSport, selectedSeason)}${dateSuffix}`);
  };

  const withinWindow = useMemo(() => {
    if (!schedules || !teams || !currentDate) return null; // unknown while loading
    const finalDate = getConferenceFinalGameDate(schedules, selectedConference, teams, selectedSeason);
    return isWithinFinalWeeks(finalDate, currentDate);
  }, [schedules, teams, selectedConference, selectedSeason, currentDate]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">CCG Flowchart</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Follow the games that still decide the championship game matchup
          {currentDate && <span className="ml-2 text-sm">• Data from {currentDate}</span>}
        </p>
      </header>

      {withinWindow === false && (
        <div className="mb-6 p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg text-amber-800 dark:text-amber-300 text-sm">
          This is most useful in the final week of the regular season, once most of the CCG picture has
          crystallized. Outside that window the game list below may include games that don't meaningfully affect
          seeding yet.
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <ConferenceSelector
          conferences={conferences}
          selected={selectedConference}
          onChange={handleConferenceChange}
          conferenceNames={teams?.conferences}
        />

        <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden ml-auto">
          <button
            onClick={() => setMode('flowchart')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              mode === 'flowchart'
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            Flowchart
          </button>
          <button
            onClick={() => setMode('ways-to-lock')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              mode === 'ways-to-lock'
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            Ways to Lock
          </button>
        </div>
      </div>

      <AdSlot slotId="flowchart-top" className="mb-6" />

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

      {!loading && !error && !everyOutcome && (
        <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 text-yellow-700 dark:text-yellow-300">
          <strong>Note:</strong> What-if data isn't available for this conference/date.
          Run simulation with <code>--export-json</code> to generate it.
        </div>
      )}

      {!loading && !error && everyOutcome && teams && (
        <>
          {mode === 'flowchart' ? (
            <CCGFlowchart
              teams={teams}
              everyOutcome={everyOutcome}
              schedules={schedules}
              selectedWinners={selectedWinners}
              onSelectWinner={setWinner}
              onClear={clearSelections}
              conference={selectedConference}
              conferenceMeta={teams.conferences[selectedConference]}
              currentDate={currentDate}
              rankings={rankings}
            />
          ) : (
            <CCGWaysToLockTable
              teams={teams}
              everyOutcome={everyOutcome}
              week1Start={datesConfig?.week1_start}
              conference={selectedConference}
              conferenceMeta={teams.conferences[selectedConference]}
              rankings={rankings}
            />
          )}
        </>
      )}
    </div>
  );
}
