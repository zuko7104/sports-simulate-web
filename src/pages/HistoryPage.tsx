import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useConferenceData } from '../hooks/useConferenceData';
import { ProbabilityTimeline } from '../components/ProbabilityTimeline';
import { ConferenceSelector } from '../components/ConferenceSelector';
import { dateToWeekLabel, type DatesConfig } from '../utils/dateUtils';

const DEFAULT_CONFERENCES = ['B12', 'SEC', 'B10', 'ACC'];

export function HistoryPage() {
  const navigate = useNavigate();
  const { conference = 'B12' } = useParams<{ conference: string }>();
  const sport = 'cfb';

  const [datesData, setDatesData] = useState<DatesConfig | null>(null);
  const [selectedSeason] = useState<string>('2025');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { teams, timeline, loadConference } = useConferenceData();

  useEffect(() => {
    loadConference(sport, selectedSeason, conference);
  }, [sport, selectedSeason, conference, loadConference]);

  useEffect(() => {
    async function loadDates() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/data/${sport}/${selectedSeason}/dates.json`);
        if (!res.ok) {
          throw new Error('No historical data available');
        }
        const contentType = res.headers.get('content-type');
        if (!contentType?.includes('application/json')) {
          throw new Error('No historical data available');
        }
        const data: DatesConfig = await res.json();
        setDatesData(data);

        // Default to most recent date
        if (data.dates?.length > 0) {
          setSelectedDate(data.dates[data.dates.length - 1]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    loadDates();
  }, [sport, selectedSeason]);

  const handleViewData = () => {
    if (selectedDate) {
      navigate(`/${conference}?date=${selectedDate}`);
    }
  };

  const handleConferenceChange = (conf: string) => {
    navigate(`/${conf}/history`);
  };

  const conferences = teams?.conferences
    ? Object.keys(teams.conferences)
    : DEFAULT_CONFERENCES;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Historical Data Browser
        </h1>
        <p className="text-gray-600">
          View championship probabilities from past weeks and seasons
        </p>
      </header>

      <div className="mb-6">
        <ConferenceSelector
          conferences={conferences}
          selected={conference}
          onChange={handleConferenceChange}
          conferenceNames={teams?.conferences}
        />
      </div>

      {/* Probability Timeline Chart */}
      {timeline && teams && (
        <div className="mb-6">
          <ProbabilityTimeline timeline={timeline} teams={teams} datesConfig={datesData} />
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading history...</span>
        </div>
      )}

      {error && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-700">
          <strong>Note:</strong> {error}
          <p className="text-sm mt-1">
            Historical data will be available after running simulations over multiple weeks.
          </p>
        </div>
      )}

      {!loading && !error && datesData && datesData.dates.length > 0 && (
        <div className="space-y-6">
          {/* Date Selector */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Select Week
            </h2>
            <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 gap-2">
              {datesData.dates.map((date) => (
                <button
                  key={date}
                  onClick={() => setSelectedDate(date)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedDate === date
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {dateToWeekLabel(date, datesData.week1_start, datesData.dates)}
                </button>
              ))}
            </div>
          </div>

          {/* View Button */}
          <div className="flex justify-center">
            <button
              onClick={handleViewData}
              disabled={!selectedDate}
              className={`px-8 py-3 rounded-lg font-semibold text-lg transition-colors ${
                selectedDate
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              View Probabilities for {selectedDate ? dateToWeekLabel(selectedDate, datesData.week1_start, datesData.dates) : 'Selected Week'}
            </button>
          </div>

          {/* Timeline Preview */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Season Timeline
            </h2>
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200"></div>
              <div className="space-y-4 pl-8">
                {datesData.dates.slice(-10).reverse().map((date) => (
                  <div
                    key={date}
                    className={`relative flex items-center ${
                      selectedDate === date ? 'font-semibold' : ''
                    }`}
                  >
                    <div
                      className={`absolute -left-6 w-3 h-3 rounded-full ${
                        selectedDate === date
                          ? 'bg-blue-600'
                          : 'bg-gray-400'
                      }`}
                    ></div>
                    <button
                      onClick={() => setSelectedDate(date)}
                      className="text-sm text-gray-700 hover:text-blue-600"
                    >
                      {dateToWeekLabel(date, datesData.week1_start, datesData.dates)}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {!loading && !error && (!datesData || datesData.dates.length === 0) && (
        <div className="text-center py-12">
          <p className="text-gray-500">No historical data available yet.</p>
          <p className="text-sm text-gray-400 mt-2">
            Run simulations weekly to build up historical data.
          </p>
        </div>
      )}
    </div>
  );
}
