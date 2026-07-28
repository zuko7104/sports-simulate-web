import { useState } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, useNavigate, useParams, useSearchParams, Navigate } from 'react-router-dom';
import { ConferenceDashboard } from './pages/ConferenceDashboard';
import { WhatIfExplorer } from './pages/WhatIfExplorer';
import { TiebreakersPage } from './pages/TiebreakersPage';
import { TeamDetailPage } from './pages/TeamDetailPage';
import { ConferenceLanding } from './pages/ConferenceLanding';
import { CCGFlowchartPage } from './pages/CCGFlowchartPage';
import { AboutPage } from './pages/AboutPage';
import { PrivacyPolicyPage } from './pages/PrivacyPolicyPage';
import { ThemeProvider } from './contexts/ThemeContext';
import { ThemeToggle } from './components/ThemeToggle';
import { WeekSelector } from './components/WeekSelector';
import { useKnownConferences } from './hooks/useKnownConferences';
import { useIsWithinFlowchartWindow } from './hooks/useIsWithinFlowchartWindow';
import { useHasTiebreakerData } from './hooks/useHasTiebreakerData';
import { useAvailableSeasons } from './hooks/useAvailableSeasons';
import {
  DEFAULT_SPORT,
  CURRENT_SEASON,
  sportYearPath,
  conferencePath,
  conferenceSubPath,
  teamPath,
} from './utils/routes';
import './index.css';

function Navigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  // Parse /:sport/:year/:conference/... directly from the path so this works
  // regardless of which nested route rendered (Navigation lives outside the
  // inner <Routes>, so useParams here won't see route-specific params).
  // location.pathname keeps segments percent-encoded (e.g. "FBS%20Independents"),
  // but conference codes are matched/used decoded everywhere else (teams.json
  // keys, conferencePath's own encodeURIComponent call) - so this must decode
  // before comparing, or any conference code containing a space/special
  // character never matches and silently hides the whole nav (tabs, week
  // selector, mobile menu).
  const [, sport, year, rawMaybeConference] = location.pathname.split('/');
  const maybeConference = rawMaybeConference ? decodeURIComponent(rawMaybeConference) : rawMaybeConference;
  const knownConferences = useKnownConferences(sport, year);
  const activeConference =
    sport === DEFAULT_SPORT && year && maybeConference && knownConferences?.has(maybeConference)
      ? maybeConference
      : null;
  // "Basic" (no-simulation) groups - FCS conferences, the 2025 Pac-12,
  // independents - only get a standings page, so the What-If/Tiebreakers/
  // History tabs (which all depend on simulation output) are hidden for them.
  const activeHasSimulation = activeConference ? knownConferences?.get(activeConference) ?? true : false;

  // Preserve the historical `date` query param (if any) when navigating
  // between a conference's sub-pages, so switching between What-If /
  // Tiebreakers / History / Conference Overview doesn't silently jump back
  // to the latest week.
  const historicalDate = new URLSearchParams(location.search).get('date');
  const dateSuffix = historicalDate ? `?date=${historicalDate}` : '';

  const seasons = useAvailableSeasons(sport ?? DEFAULT_SPORT, year ?? CURRENT_SEASON);
  const activeSeason = seasons.find((s) => s.year === (year ?? CURRENT_SEASON));
  const isHistoricalWeek =
    Boolean(activeConference) &&
    ((year ?? CURRENT_SEASON) !== CURRENT_SEASON ||
      (historicalDate != null && historicalDate !== activeSeason?.config.latest_date));

  function handleWeekChange(date: string | undefined, newYear: string) {
    if (!activeConference) return;
    const search = date ? `?date=${date}` : '';
    if (newYear !== year) {
      navigate(`${conferencePath(activeConference, sport, newYear)}${search}`);
    } else {
      navigate(`${location.pathname}${search}`);
    }
  }

  // The CCG Flowchart/Ways to Lock tab is only relevant in the final week
  // of a conference's regular-season slate.
  const showFlowchartLink = useIsWithinFlowchartWindow(
    sport ?? DEFAULT_SPORT,
    year ?? CURRENT_SEASON,
    activeHasSimulation ? activeConference : null,
    historicalDate ?? undefined,
  );

  // Tiebreakers tab is only relevant once there's actual tiebreaker scenario
  // data for this conference/date - e.g. once the standings are fully
  // decided by record, there's nothing left to show.
  const hasTiebreakerData = useHasTiebreakerData(
    sport ?? DEFAULT_SPORT,
    year ?? CURRENT_SEASON,
    activeHasSimulation ? activeConference : null,
    historicalDate ?? undefined,
  );

  const navLinks = activeConference
    ? [
        { path: conferencePath(activeConference, sport, year), label: 'Conference Overview' },
        ...(activeHasSimulation
          ? [
              { path: conferenceSubPath(activeConference, 'what-if', sport, year), label: 'What-If' },
              ...(showFlowchartLink
                ? [{ path: conferenceSubPath(activeConference, 'flowchart', sport, year), label: 'Flowchart' }]
                : []),
              ...(hasTiebreakerData
                ? [{ path: conferenceSubPath(activeConference, 'tiebreakers', sport, year), label: 'Tiebreakers' }]
                : []),
            ]
          : []),
      ].map((link) => ({ ...link, to: `${link.path}${dateSuffix}` }))
    : [];

  return (
    <nav className="bg-gray-800 text-white">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link
            to={sportYearPath()}
            className="flex items-center gap-2 text-xl font-bold"
            onClick={() => setMenuOpen(false)}
          >
            <img src="/logo.png" alt="SportsSimulate logo" className="w-8 h-8" />
            SportsSimulate
          </Link>
          <div className="flex items-center gap-2">
            {activeConference && (
              <>
                {/* Desktop nav */}
                <div className="hidden sm:flex space-x-4">
                  {navLinks.map((link) => (
                    <Link
                      key={link.path}
                      to={link.to}
                      className={`px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-700 ${
                        location.pathname === link.path ? 'bg-gray-700' : ''
                      }`}
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              </>
            )}
            {activeConference && (
              <div className="hidden sm:block">
                <WeekSelector
                  seasons={seasons}
                  year={year ?? CURRENT_SEASON}
                  selectedDate={historicalDate ?? undefined}
                  isHistorical={isHistoricalWeek}
                  onChange={handleWeekChange}
                />
              </div>
            )}
            <ThemeToggle />
            {activeConference && (
              <button
                className="relative sm:hidden p-2 rounded-md hover:bg-gray-700 focus:outline-none"
                onClick={() => setMenuOpen((o) => !o)}
                aria-label={isHistoricalWeek ? 'Toggle navigation menu (viewing a past week)' : 'Toggle navigation menu'}
                aria-expanded={menuOpen}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {menuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
                {isHistoricalWeek && !menuOpen && (
                  <span
                    className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-gray-800"
                    title="Viewing a past week"
                  />
                )}
              </button>
            )}
          </div>
        </div>
      </div>
      {/* Mobile dropdown menu */}
      {menuOpen && activeConference && (
        <div className="sm:hidden border-t border-gray-700 px-4 pb-3">
          <div className="pt-3 pb-1">
            <WeekSelector
              seasons={seasons}
              year={year ?? CURRENT_SEASON}
              selectedDate={historicalDate ?? undefined}
              isHistorical={isHistoricalWeek}
              onChange={handleWeekChange}
            />
          </div>
          {navLinks.map((link) => (
            <Link
              key={link.path}
              to={link.to}
              onClick={() => setMenuOpen(false)}
              className={`block px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-700 mt-1 ${
                location.pathname === link.path ? 'bg-gray-700' : ''
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}

function LegacyConferenceRedirect() {
  const { legacyConference } = useParams<{ legacyConference: string }>();
  const [search] = useSearchParams();
  const knownConferences = useKnownConferences();
  if (knownConferences === null) return null; // still loading
  if (!legacyConference || !knownConferences.has(legacyConference)) {
    return <Navigate to={sportYearPath()} replace />;
  }
  const qs = search.toString();
  return <Navigate to={`${conferencePath(legacyConference)}${qs ? `?${qs}` : ''}`} replace />;
}

function LegacyConferenceSubRedirect({ sub }: { sub: 'what-if' | 'tiebreakers' }) {
  const { legacyConference } = useParams<{ legacyConference: string }>();
  const knownConferences = useKnownConferences();
  if (knownConferences === null) return null; // still loading
  if (!legacyConference || !knownConferences.has(legacyConference)) {
    return <Navigate to={sportYearPath()} replace />;
  }
  return <Navigate to={conferenceSubPath(legacyConference, sub)} replace />;
}

function LegacyTeamRedirect() {
  const { legacyConference, teamId } = useParams<{ legacyConference: string; teamId: string }>();
  const [search] = useSearchParams();
  const knownConferences = useKnownConferences();
  if (knownConferences === null) return null; // still loading
  if (!legacyConference || !teamId || !knownConferences.has(legacyConference)) {
    return <Navigate to={sportYearPath()} replace />;
  }
  const qs = search.toString();
  return <Navigate to={`${teamPath(legacyConference, decodeURIComponent(teamId))}${qs ? `?${qs}` : ''}`} replace />;
}

function AppLayout() {
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <Navigation />
      <main>
        <Routes>
          <Route path="/" element={<Navigate to={sportYearPath()} replace />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/privacy" element={<PrivacyPolicyPage />} />
          <Route path="/:sport/:year" element={<ConferenceLanding />} />
          <Route path="/:sport/:year/:conference" element={<ConferenceDashboard />} />
          <Route path="/:sport/:year/:conference/what-if" element={<WhatIfExplorer />} />
          <Route path="/:sport/:year/:conference/flowchart" element={<CCGFlowchartPage />} />
          <Route path="/:sport/:year/:conference/tiebreakers" element={<TiebreakersPage />} />
          <Route path="/:sport/:year/:conference/team/:teamId" element={<TeamDetailPage />} />

          {/* Legacy routes (pre URL-restructure) redirect to the new /:sport/:year/... scheme */}
          <Route path="/what-if" element={<Navigate to={conferenceSubPath('B12', 'what-if')} replace />} />
          <Route path="/tiebreakers" element={<Navigate to={conferenceSubPath('B12', 'tiebreakers')} replace />} />
          <Route path="/:legacyConference" element={<LegacyConferenceRedirect />} />
          <Route path="/:legacyConference/what-if" element={<LegacyConferenceSubRedirect sub="what-if" />} />
          <Route path="/:legacyConference/tiebreakers" element={<LegacyConferenceSubRedirect sub="tiebreakers" />} />
          <Route path="/:legacyConference/teams/:teamId" element={<LegacyTeamRedirect />} />
        </Routes>
      </main>
      <footer className="bg-gray-800 dark:bg-gray-950 text-gray-400 dark:text-gray-500 py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm">
          <p>College Football Season Results Simulator</p>
          <p className="mt-1">
            Data updated weekly • Simulations based on remaining schedules
          </p>
          <p className="mt-3 space-x-4">
            <Link to="/about" className="hover:text-gray-200 hover:underline">
              How it works
            </Link>
            <Link to="/privacy" className="hover:text-gray-200 hover:underline">
              Privacy Policy
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Routes>
          <Route path="/*" element={<AppLayout />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
