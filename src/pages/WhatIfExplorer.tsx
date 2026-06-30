import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useConferenceData } from '../hooks/useConferenceData';
import { useWhatIf } from '../hooks/useWhatIf';
import { WhatIfPicker } from '../components/WhatIfPicker';
import { FullSeasonPicker } from '../components/FullSeasonPicker';
import { ConferenceSelector } from '../components/ConferenceSelector';
import { getRemainingConferenceGames, buildConferenceState, fillWithFavorites, selectionProbability as calcSelectionProb } from '../utils/seasonBuilder';
import { resolveChampionship } from '../utils/tiebreakers';
import { dateToWeekNumber } from '../utils/dateUtils';

const DEFAULT_CONFERENCES = ['B12', 'SEC', 'B10', 'ACC'];

type Mode = 'next-weeks' | 'full-season';

export function WhatIfExplorer() {
  const { conference: selectedConference = 'B12' } = useParams<{ conference: string }>();
  const navigate = useNavigate();
  const selectedSport = 'cfb';
  const selectedSeason = '2025';
  const [mode, setMode] = useState<Mode>('next-weeks');
  const [selectedWinners, setSelectedWinners] = useState<Record<string, string>>({});
  const [fullSeasonWinners, setFullSeasonWinners] = useState<Record<string, string>>({});

  const { teams, schedules, everyOutcome, loading, error, currentDate, datesConfig, loadConference, probabilities: dashboardProbabilities, matchups: dashboardMatchups } = useConferenceData();
  const { setWinner, clearSelections, probabilities, gameInfos, selectionProbability } = useWhatIf(
    everyOutcome,
    selectedWinners,
    setSelectedWinners
  );

  // Count distinct weeks in the what-if game data
  const whatIfWeekCount = useMemo(() => {
    if (!gameInfos.length || !datesConfig?.week1_start) return 2;
    const weeks = new Set<number>();
    for (const g of gameInfos) {
      if (g.date) {
        weeks.add(dateToWeekNumber(g.date, datesConfig.week1_start));
      }
    }
    return weeks.size || 2;
  }, [gameInfos, datesConfig]);


  useEffect(() => {
    loadConference(selectedSport, selectedSeason, selectedConference);
    setSelectedWinners({});
    setFullSeasonWinners({});
  }, [selectedConference, selectedSport, selectedSeason, loadConference]);

  const conferences = teams?.conferences
    ? Object.keys(teams.conferences)
    : DEFAULT_CONFERENCES;

  const handleConferenceChange = (conf: string) => {
    navigate(`/${conf}/what-if`);
  };

  // Full-season mode data
  const remainingGames = useMemo(() => {
    if (!schedules || !teams) return [];
    return getRemainingConferenceGames(schedules, selectedConference, teams, selectedSeason);
  }, [schedules, teams, selectedConference, selectedSeason]);

  const allGamesSelected = remainingGames.length > 0 &&
    remainingGames.every((g) => fullSeasonWinners[g.gameKey] != null);

  const conferenceState = useMemo(() => {
    if (!allGamesSelected || !schedules || !teams) return null;
    return buildConferenceState(schedules, selectedConference, teams, fullSeasonWinners, selectedSeason);
  }, [allGamesSelected, schedules, teams, selectedConference, fullSeasonWinners, selectedSeason]);

  const tiebreakerResult = useMemo(() => {
    if (!conferenceState) return null;
    return resolveChampionship(conferenceState);
  }, [conferenceState]);

  const fullSeasonProb = useMemo(() => {
    return calcSelectionProb(remainingGames, fullSeasonWinners);
  }, [remainingGames, fullSeasonWinners]);

  const handleFullSeasonSetWinner = (game: string, winner: string) => {
    setFullSeasonWinners((prev) => {
      if (prev[game] === winner) {
        const { [game]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [game]: winner };
    });
  };

  const handleFillFavorites = () => {
    setFullSeasonWinners((prev) => fillWithFavorites(remainingGames, prev));
  };

  const handleFillWhatIfFavorites = () => {
    setSelectedWinners((prev) => {
      const result = { ...prev };
      for (const game of gameInfos) {
        if (result[game.gameKey] != null) continue;
        result[game.gameKey] = game.team1WinProb >= 0.5 ? game.teams[0] : game.teams[1];
      }
      return result;
    });
  };

  const handleClearFullSeason = () => {
    setFullSeasonWinners({});
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          What-If Explorer
        </h1>
        <p className="text-gray-600">
          Choose winners for upcoming games to see how it affects championship probabilities
          {currentDate && <span className="ml-2 text-sm">• Data from {currentDate}</span>}
        </p>
      </header>

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <ConferenceSelector
          conferences={conferences}
          selected={selectedConference}
          onChange={handleConferenceChange}
          conferenceNames={teams?.conferences}
        />

        {/* Mode toggle */}
        <div className="flex rounded-lg border border-gray-300 overflow-hidden ml-auto">
          <button
            onClick={() => setMode('next-weeks')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              mode === 'next-weeks'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Next {whatIfWeekCount} Weeks
          </button>
          <button
            onClick={() => setMode('full-season')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              mode === 'full-season'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Full Season
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading data...</span>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          <strong>Error:</strong> {error}
        </div>
      )}

      {!loading && !error && mode === 'next-weeks' && (
        <>
          {!everyOutcome ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-700">
              <strong>Note:</strong> What-If data not available for Next {whatIfWeekCount} Weeks.
              Run simulation with <code>--export-json</code> flag to generate it.
            </div>
          ) : teams && (
            <WhatIfPicker
              teams={teams}
              conference={selectedConference}
              selectedWinners={selectedWinners}
              onSelectWinner={setWinner}
              onClear={clearSelections}
              onFillFavorites={handleFillWhatIfFavorites}
              probabilities={probabilities}
              dashboardProbabilities={dashboardProbabilities}
              dashboardMatchups={dashboardMatchups}
              gameInfos={gameInfos}
              selectionProbability={selectionProbability}
              week1Start={datesConfig?.week1_start}
            />
          )}
        </>
      )}

      {!loading && !error && mode === 'full-season' && teams && schedules && (
        <FullSeasonPicker
          teams={teams}
          conference={selectedConference}
          conferenceState={conferenceState}
          remainingGames={remainingGames}
          selectedWinners={fullSeasonWinners}
          onSelectWinner={handleFullSeasonSetWinner}
          onClear={handleClearFullSeason}
          onFillFavorites={handleFillFavorites}
          selectionProbability={fullSeasonProb}
          tiebreakerResult={tiebreakerResult}
          allGamesSelected={allGamesSelected}
          week1Start={datesConfig?.week1_start}
        />
      )}
    </div>
  );
}
