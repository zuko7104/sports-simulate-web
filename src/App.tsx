import { useState } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, useParams, useSearchParams, Navigate } from 'react-router-dom';
import { ConferenceDashboard } from './pages/ConferenceDashboard';
import { WhatIfExplorer } from './pages/WhatIfExplorer';
import { TiebreakersPage } from './pages/TiebreakersPage';
import { HistoryPage } from './pages/HistoryPage';
import { TeamDetailPage } from './pages/TeamDetailPage';
import { ConferenceLanding } from './pages/ConferenceLanding';
import {
  DEFAULT_SPORT,
  KNOWN_CONFERENCES,
  sportYearPath,
  conferencePath,
  conferenceSubPath,
  teamPath,
} from './utils/routes';
import './index.css';

function Navigation() {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  // Parse /:sport/:year/:conference/... directly from the path so this works
  // regardless of which nested route rendered (Navigation lives outside the
  // inner <Routes>, so useParams here won't see route-specific params).
  const [, sport, year, maybeConference] = location.pathname.split('/');
  const activeConference =
    sport === DEFAULT_SPORT && year && maybeConference && KNOWN_CONFERENCES.includes(maybeConference)
      ? maybeConference
      : null;

  const navLinks = activeConference
    ? [
        { to: conferencePath(activeConference, sport, year), label: 'Dashboard' },
        { to: conferenceSubPath(activeConference, 'what-if', sport, year), label: 'What-If' },
        { to: conferenceSubPath(activeConference, 'tiebreakers', sport, year), label: 'Tiebreakers' },
        { to: conferenceSubPath(activeConference, 'history', sport, year), label: 'History' },
      ]
    : [];

  return (
    <nav className="bg-gray-800 text-white">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link to={sportYearPath()} className="text-xl font-bold" onClick={() => setMenuOpen(false)}>
            🏈 CFB Probabilities
          </Link>
          {activeConference && (
            <>
              {/* Desktop nav */}
              <div className="hidden sm:flex space-x-4">
                {navLinks.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-700 ${
                      location.pathname === link.to ? 'bg-gray-700' : ''
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
              {/* Mobile hamburger button */}
              <button
                className="sm:hidden p-2 rounded-md hover:bg-gray-700 focus:outline-none"
                onClick={() => setMenuOpen((o) => !o)}
                aria-label="Toggle navigation menu"
                aria-expanded={menuOpen}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {menuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </>
          )}
        </div>
      </div>
      {/* Mobile dropdown menu */}
      {menuOpen && activeConference && (
        <div className="sm:hidden border-t border-gray-700 px-4 pb-3">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              onClick={() => setMenuOpen(false)}
              className={`block px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-700 mt-1 ${
                location.pathname === link.to ? 'bg-gray-700' : ''
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
  if (!legacyConference || !KNOWN_CONFERENCES.includes(legacyConference)) {
    return <Navigate to={sportYearPath()} replace />;
  }
  const qs = search.toString();
  return <Navigate to={`${conferencePath(legacyConference)}${qs ? `?${qs}` : ''}`} replace />;
}

function LegacyConferenceSubRedirect({ sub }: { sub: 'what-if' | 'tiebreakers' | 'history' }) {
  const { legacyConference } = useParams<{ legacyConference: string }>();
  if (!legacyConference || !KNOWN_CONFERENCES.includes(legacyConference)) {
    return <Navigate to={sportYearPath()} replace />;
  }
  return <Navigate to={conferenceSubPath(legacyConference, sub)} replace />;
}

function LegacyTeamRedirect() {
  const { legacyConference, teamId } = useParams<{ legacyConference: string; teamId: string }>();
  const [search] = useSearchParams();
  if (!legacyConference || !teamId || !KNOWN_CONFERENCES.includes(legacyConference)) {
    return <Navigate to={sportYearPath()} replace />;
  }
  const qs = search.toString();
  return <Navigate to={`${teamPath(legacyConference, decodeURIComponent(teamId))}${qs ? `?${qs}` : ''}`} replace />;
}

function AppLayout() {
  return (
    <div className="min-h-screen bg-gray-100">
      <Navigation />
      <main>
        <Routes>
          <Route path="/" element={<Navigate to={sportYearPath()} replace />} />
          <Route path="/:sport/:year" element={<ConferenceLanding />} />
          <Route path="/:sport/:year/:conference" element={<ConferenceDashboard />} />
          <Route path="/:sport/:year/:conference/what-if" element={<WhatIfExplorer />} />
          <Route path="/:sport/:year/:conference/tiebreakers" element={<TiebreakersPage />} />
          <Route path="/:sport/:year/:conference/history" element={<HistoryPage />} />
          <Route path="/:sport/:year/:conference/team/:teamId" element={<TeamDetailPage />} />

          {/* Legacy routes (pre URL-restructure) redirect to the new /:sport/:year/... scheme */}
          <Route path="/what-if" element={<Navigate to={conferenceSubPath('B12', 'what-if')} replace />} />
          <Route path="/tiebreakers" element={<Navigate to={conferenceSubPath('B12', 'tiebreakers')} replace />} />
          <Route path="/history" element={<Navigate to={conferenceSubPath('B12', 'history')} replace />} />
          <Route path="/:legacyConference" element={<LegacyConferenceRedirect />} />
          <Route path="/:legacyConference/what-if" element={<LegacyConferenceSubRedirect sub="what-if" />} />
          <Route path="/:legacyConference/tiebreakers" element={<LegacyConferenceSubRedirect sub="tiebreakers" />} />
          <Route path="/:legacyConference/history" element={<LegacyConferenceSubRedirect sub="history" />} />
          <Route path="/:legacyConference/teams/:teamId" element={<LegacyTeamRedirect />} />
        </Routes>
      </main>
      <footer className="bg-gray-800 text-gray-400 py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm">
          <p>College Football Championship Probability Simulator</p>
          <p className="mt-1">
            Data updated weekly • Simulations based on remaining schedules
          </p>
        </div>
      </footer>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/*" element={<AppLayout />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
