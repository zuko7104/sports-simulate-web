import { useState } from 'react';
import { BrowserRouter, Routes, Route, Link, useParams, useLocation, Navigate } from 'react-router-dom';
import { ConferenceDashboard } from './pages/ConferenceDashboard';
import { WhatIfExplorer } from './pages/WhatIfExplorer';
import { TiebreakersPage } from './pages/TiebreakersPage';
import { HistoryPage } from './pages/HistoryPage';
import { TeamDetailPage } from './pages/TeamDetailPage';
import { ConferenceLanding } from './pages/ConferenceLanding';
import './index.css';

function Navigation() {
  const { conference } = useParams<{ conference?: string }>();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  // Extract conference from URL path segments like /:conference, /:conference/what-if, etc.
  const pathConference = location.pathname.split('/')[1];
  const activeConference = conference || (['B12', 'SEC', 'B10', 'ACC'].includes(pathConference) ? pathConference : null);

  const navLinks = activeConference
    ? [
        { to: `/${activeConference}`, label: 'Dashboard' },
        { to: `/${activeConference}/what-if`, label: 'What-If' },
        { to: `/${activeConference}/tiebreakers`, label: 'Tiebreakers' },
        { to: `/${activeConference}/history`, label: 'History' },
      ]
    : [];

  return (
    <nav className="bg-gray-800 text-white">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="text-xl font-bold" onClick={() => setMenuOpen(false)}>
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

function AppLayout() {
  return (
    <div className="min-h-screen bg-gray-100">
      <Navigation />
      <main>
        <Routes>
          <Route path="/" element={<ConferenceLanding />} />
          <Route path="/:conference" element={<ConferenceDashboard />} />
          <Route path="/:conference/what-if" element={<WhatIfExplorer />} />
          <Route path="/:conference/tiebreakers" element={<TiebreakersPage />} />
          <Route path="/:conference/history" element={<HistoryPage />} />
          <Route path="/:conference/teams/:teamId" element={<TeamDetailPage />} />
          {/* Legacy routes redirect */}
          <Route path="/what-if" element={<Navigate to="/B12/what-if" replace />} />
          <Route path="/tiebreakers" element={<Navigate to="/B12/tiebreakers" replace />} />
          <Route path="/history" element={<Navigate to="/B12/history" replace />} />
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
