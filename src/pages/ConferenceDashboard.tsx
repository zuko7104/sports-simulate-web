import { useEffect } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useConferenceData } from '../hooks/useConferenceData';
import { TeamProbabilityTable } from '../components/TeamProbabilityTable';
import { CCGMatchupList } from '../components/CCGMatchupList';
import { ConferenceSelector } from '../components/ConferenceSelector';
import { CCGOddsByRecord } from '../components/CCGOddsByRecord';
import { RecordDistributionTable } from '../components/RecordDistributionTable';
import { WeekImpactTable } from '../components/WeekImpactTable';
import { dateToWeekLabel } from '../utils/dateUtils';

// Default conferences to show (will be replaced by data from index.json when available)
const DEFAULT_CONFERENCES = ['B12', 'SEC', 'B10', 'ACC'];

export function ConferenceDashboard() {
  const { conference: selectedConference = 'B12' } = useParams<{ conference: string }>();
  const [searchParams] = useSearchParams();
  const historicalDate = searchParams.get('date') ?? undefined;
  const navigate = useNavigate();
  const selectedSport = 'cfb';
  const selectedSeason = '2025';

  const { teams, schedules, probabilities, matchups, weekImpact, loading, error, currentDate, latestDate, datesConfig, loadConference } = useConferenceData();

  useEffect(() => {
    loadConference(selectedSport, selectedSeason, selectedConference, historicalDate);
  }, [selectedConference, selectedSport, selectedSeason, historicalDate, loadConference]);

  const conferences = teams?.conferences
    ? Object.keys(teams.conferences)
    : DEFAULT_CONFERENCES;

  const handleConferenceChange = (conf: string) => {
    navigate(`/${conf}`);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {teams?.conferences[selectedConference]?.display_name ?? selectedConference} Championship Probabilities
        </h1>
        <p className="text-gray-600">
          Simulated probabilities for conference championship game appearances
          {currentDate && <span className="ml-2 text-sm">• Data from {currentDate}</span>}
        </p>
      </header>

      <div className="mb-6">
        <ConferenceSelector
          conferences={conferences}
          selected={selectedConference}
          onChange={handleConferenceChange}
          conferenceNames={teams?.conferences}
        />
      </div>

      {historicalDate && latestDate && historicalDate !== latestDate && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between">
          <span className="text-amber-800 text-sm">
            📅 Viewing historical data from <strong>{dateToWeekLabel(historicalDate, datesConfig?.week1_start, datesConfig?.dates)}</strong>
          </span>
          <Link
            to={`/${selectedConference}`}
            className="text-sm text-amber-700 hover:text-amber-900 underline"
          >
            Back to latest
          </Link>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading data...</span>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          <strong>Error:</strong> {error}
          <p className="text-sm mt-1">
            Make sure you've run a simulation with --export-json first.
          </p>
        </div>
      )}

      {!loading && !error && probabilities && teams && matchups && schedules && (
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
            />
            <CCGMatchupList matchups={matchups} teams={teams} conference={selectedConference} />
          </div>

          {weekImpact && (
            <div className="mt-6">
              <WeekImpactTable weekImpact={weekImpact} teams={teams} showTeamSelector conference={selectedConference} historicalDate={historicalDate} />
            </div>
          )}

          <div className="mt-6">
            <CCGOddsByRecord probabilities={probabilities} teams={teams} conference={selectedConference} historicalDate={historicalDate} />
          </div>

          <div className="mt-6">
            <RecordDistributionTable probabilities={probabilities} teams={teams} schedules={schedules} conference={selectedConference} historicalDate={historicalDate} />
          </div>
        </>
      )}
    </div>
  );
}
