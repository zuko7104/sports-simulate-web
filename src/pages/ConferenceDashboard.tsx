import { useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useConferenceData } from '../hooks/useConferenceData';
import { usePageTitle } from '../hooks/usePageTitle';
import { useExportableCard } from '../hooks/useExportableCard';
import { AdSlot } from '../components/AdSlot';
import { TeamProbabilityTable } from '../components/TeamProbabilityTable';
import { CCGMatchupList } from '../components/CCGMatchupList';
import { ConferenceSelector } from '../components/ConferenceSelector';
import { ConferenceLogo } from '../components/ConferenceLogo';
import { DownloadPngButton } from '../components/DownloadPngButton';
import { CardExportFooter } from '../components/CardExportFooter';
import { CCGOddsByRecord } from '../components/CCGOddsByRecord';
import { RecordDistributionTable } from '../components/RecordDistributionTable';
import { WeekImpactTable } from '../components/WeekImpactTable';
import { BasicConferenceStandings } from '../components/BasicConferenceStandings';
import { ProbabilityTimeline } from '../components/ProbabilityTimeline';
import { snapshotWeekNumber } from '../utils/dateUtils';
import { DEFAULT_SPORT, CURRENT_SEASON, conferencePath } from '../utils/routes';

// Default conferences to show (will be replaced by data from index.json when available)
const DEFAULT_CONFERENCES = ['B12', 'SEC', 'B10', 'ACC'];

export function ConferenceDashboard() {
  const {
    sport: selectedSport = DEFAULT_SPORT,
    year: selectedSeason = CURRENT_SEASON,
    conference: selectedConference = 'B12',
  } = useParams<{ sport: string; year: string; conference: string }>();
  const [searchParams] = useSearchParams();
  const historicalDate = searchParams.get('date') ?? undefined;
  const navigate = useNavigate();

  const { teams, schedules, probabilities, matchups, everyOutcome, weekImpact, timeline, rankings, loading, error, currentDate, datesConfig, loadConference } = useConferenceData();

  useEffect(() => {
    loadConference(selectedSport, selectedSeason, selectedConference, historicalDate);
  }, [selectedConference, selectedSport, selectedSeason, historicalDate, loadConference]);

  // The conference selector lists every conference/group - simulated (P4/G6)
  // conferences plus basic (no-simulation) groups (FCS conferences, Pac-12,
  // independents) - grouped into sections so it stays browsable.
  const conferences = teams?.conferences ? Object.keys(teams.conferences) : DEFAULT_CONFERENCES;

  const conferenceDisplayName = teams?.conferences[selectedConference]?.display_name ?? selectedConference;
  const conferenceMeta = teams?.conferences[selectedConference];
  const hasSimulation = conferenceMeta?.has_simulation ?? true;
  usePageTitle(conferenceDisplayName);

  const handleConferenceChange = (conf: string) => {
    const dateSuffix = historicalDate ? `?date=${historicalDate}` : '';
    navigate(`${conferencePath(conf, selectedSport, selectedSeason)}${dateSuffix}`);
  };

  // The timeline chart has nothing meaningful to show in week 1 (only a
  // single preseason snapshot exists), so it's hidden entirely until later.
  const currentWeekNum = useMemo(() => {
    if (!currentDate || !datesConfig?.week1_start) return null;
    return snapshotWeekNumber(currentDate, datesConfig.week1_start);
  }, [currentDate, datesConfig]);
  const showTimeline = !!timeline && (currentWeekNum === null || currentWeekNum > 1);

  const slug = (conferenceMeta?.abbreviation ?? selectedConference).toLowerCase().replace(/\s+/g, '-');
  const {
    contentRef: timelineContentRef,
    hideOnExport: timelineHideOnExport,
    brandRef: timelineBrandRef,
    downloading: timelineDownloading,
    handleDownload: timelineHandleDownload,
  } = useExportableCard(`${slug}-ccg-probability-over-time.png`);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <header className="mb-8 flex items-center gap-4">
        <ConferenceLogo conference={selectedConference} meta={conferenceMeta} size="lg" />
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            {conferenceDisplayName} {hasSimulation ? 'Championship Probabilities' : 'Standings'}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {hasSimulation
              ? 'Simulated probabilities for conference championship game appearances'
              : 'No championship simulation is run for this group'}
            {currentDate && <span className="ml-2 text-sm">• Data from {currentDate}</span>}
          </p>
        </div>
      </header>

      <div className="mb-6">
        <ConferenceSelector
          conferences={conferences}
          selected={selectedConference}
          onChange={handleConferenceChange}
          conferenceNames={teams?.conferences}
        />
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600 dark:text-gray-400">Loading data...</span>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-300">
          <strong>Error:</strong> {error}
          <p className="text-sm mt-1">
            Make sure you've run a simulation with --export-json first.
          </p>
        </div>
      )}

      {!loading && !error && teams && schedules && !hasSimulation && (
        <BasicConferenceStandings
          teams={teams}
          schedules={schedules}
          conference={selectedConference}
          sport={selectedSport}
          season={selectedSeason}
          historicalDate={historicalDate}
          dataDate={currentDate}
          rankings={rankings}
        />
      )}

      {!loading && !error && hasSimulation && probabilities && teams && matchups && schedules && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TeamProbabilityTable
              probabilities={probabilities}
              teams={teams}
              schedules={schedules}
              conference={selectedConference}
              sport={selectedSport}
              season={selectedSeason}
              historicalDate={historicalDate}
              rankings={rankings}
            />
            <CCGMatchupList matchups={matchups} teams={teams} conference={selectedConference} sport={selectedSport} season={selectedSeason} historicalDate={historicalDate} dataDate={currentDate} rankings={rankings} />
          </div>

          <AdSlot slotId="dashboard-top" className="mt-6" />

          {showTimeline && (
            <div className="mt-6 card" ref={timelineContentRef}>
              <div ref={timelineHideOnExport} className="flex justify-end mb-1">
                <DownloadPngButton downloading={timelineDownloading} onClick={timelineHandleDownload} />
              </div>
              <h2 className="card-header flex items-center gap-2">
                <ConferenceLogo conference={selectedConference} meta={conferenceMeta} size="sm" />
                CCG Probability Over Time
              </h2>
              <ProbabilityTimeline timeline={timeline} teams={teams} datesConfig={datesConfig} currentDate={currentDate} rankings={rankings} />
              <CardExportFooter ref={timelineBrandRef} dataDate={currentDate} />
            </div>
          )}

          {weekImpact && (
            <div className="mt-6">
              <WeekImpactTable weekImpact={weekImpact} teams={teams} showTeamSelector conference={selectedConference} sport={selectedSport} season={selectedSeason} historicalDate={historicalDate} everyOutcome={everyOutcome} dataDate={currentDate} rankings={rankings} />
            </div>
          )}

          <AdSlot slotId="dashboard-mid" className="mt-6" />

          <div className="mt-6">
            <CCGOddsByRecord probabilities={probabilities} teams={teams} conference={selectedConference} historicalDate={historicalDate} rankings={rankings} />
          </div>

          <div className="mt-6">
            <RecordDistributionTable probabilities={probabilities} teams={teams} schedules={schedules} conference={selectedConference} historicalDate={historicalDate} rankings={rankings} />
          </div>
        </>
      )}
    </div>
  );
}
