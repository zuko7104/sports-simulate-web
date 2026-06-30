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

  // Extract conference from URL path segments like /:conference, /:conference/what-if, etc.
  const pathConference = location.pathname.split('/')[1];
  const activeConference = conference || (['B12', 'SEC', 'B10', 'ACC'].includes(pathConference) ? pathConference : null);

  return (
    <nav className="bg-gray-800 text-white">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="text-xl font-bold">
            🏈 CFB Probabilities
          </Link>
          {activeConference && (
            <div className="flex space-x-4">
              <Link
                to={`/${activeConference}`}
                className={`px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-700 ${
                  location.pathname === `/${activeConference}` ? 'bg-gray-700' : ''
                }`}
              >
                Dashboard
              </Link>
              <Link
                to={`/${activeConference}/what-if`}
                className={`px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-700 ${
                  location.pathname === `/${activeConference}/what-if` ? 'bg-gray-700' : ''
                }`}
              >
                What-If
              </Link>
              <Link
                to={`/${activeConference}/tiebreakers`}
                className={`px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-700 ${
                  location.pathname === `/${activeConference}/tiebreakers` ? 'bg-gray-700' : ''
                }`}
              >
                Tiebreakers
              </Link>
              <Link
                to={`/${activeConference}/history`}
                className={`px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-700 ${
                  location.pathname === `/${activeConference}/history` ? 'bg-gray-700' : ''
                }`}
              >
                History
              </Link>
            </div>
          )}
        </div>
      </div>
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
    <BrowserRouter>
      <Routes>
        <Route path="/*" element={<AppLayout />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
