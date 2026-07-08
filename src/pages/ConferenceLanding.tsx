import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { usePageTitle } from '../hooks/usePageTitle';
import { ConferenceLogo } from '../components/ConferenceLogo';
import { dataUrl } from '../utils/dataUrl';
import { DEFAULT_SPORT, CURRENT_SEASON, conferencePath, sportDisplayName } from '../utils/routes';
import { expandTeamAliases } from '../utils/teamAliases';
import type { SeasonTeams } from '../types';

const FALLBACK_CONFERENCES = [
  { id: 'B12', display_name: 'Big 12', color: '#004B87' },
  { id: 'SEC', display_name: 'SEC', color: '#00205B' },
  { id: 'B10', display_name: 'Big Ten', color: '#0B1560' },
  { id: 'ACC', display_name: 'ACC', color: '#013CA6' },
];

export function ConferenceLanding() {
  const { sport = DEFAULT_SPORT, year = CURRENT_SEASON } = useParams<{ sport: string; year: string }>();
  usePageTitle(`${sportDisplayName(sport)} ${year}`);
  const [teams, setTeams] = useState<SeasonTeams | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadTeams() {
      try {
        const res = await fetch(dataUrl(`${sport}/${year}/teams.json`));
        if (!res.ok) return;
        const contentType = res.headers.get('content-type');
        if (!contentType?.includes('application/json')) return;
        const data = await res.json();
        if (!cancelled) setTeams(expandTeamAliases(data));
      } catch {
        // teams.json may not exist yet; fall back to defaults below
      }
    }
    loadTeams();
    return () => {
      cancelled = true;
    };
  }, [sport, year]);

  const conferences = teams?.conferences
    ? Object.entries(teams.conferences).map(([id, meta]) => ({ id, ...meta }))
    : FALLBACK_CONFERENCES.map((c) => ({ ...c, abbreviation: c.id, logo_light: null, logo_dark: null, teams: [] }));

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <header className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-3">
          College Football Conference Simulations
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400">
          Simulated probabilities for conference championship game appearances
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {conferences.map((conf) => (
          <Link
            key={conf.id}
            to={conferencePath(conf.id, sport, year)}
            className="flex flex-col items-center gap-3 p-8 rounded-xl shadow-md hover:shadow-lg transition-shadow text-white text-center"
            style={{ backgroundColor: conf.color }}
          >
            <ConferenceLogo conference={conf.id} meta={conf} size="lg" className="bg-white/10 rounded-full p-2" />
            <h2 className="text-2xl font-bold">{conf.display_name}</h2>
            <p className="mt-2 text-sm opacity-80">View standings & probabilities</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
