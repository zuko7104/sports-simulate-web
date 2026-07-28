import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { usePageTitle } from '../hooks/usePageTitle';
import { AdSlot } from '../components/AdSlot';
import { ConferenceLogo } from '../components/ConferenceLogo';
import { dataUrl } from '../utils/dataUrl';
import { DEFAULT_SPORT, CURRENT_SEASON, conferencePath, sportDisplayName } from '../utils/routes';
import { expandTeamAliases } from '../utils/teamAliases';
import { GROUP_ORDER, GROUP_LABELS, conferenceGroup } from '../utils/conferenceGroups';
import type { ConferenceMetadata, SeasonTeams } from '../types';

interface LandingConference extends ConferenceMetadata {
  id: string;
}

const FALLBACK_CONFERENCES: LandingConference[] = [
  { id: 'B12', display_name: 'Big 12', color: '#004B87' },
  { id: 'SEC', display_name: 'SEC', color: '#00205B' },
  { id: 'B10', display_name: 'Big Ten', color: '#0B1560' },
  { id: 'ACC', display_name: 'ACC', color: '#013CA6' },
].map((c) => ({ ...c, abbreviation: c.id, logo_light: null, logo_dark: null, teams: [] }));

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

  const conferences: LandingConference[] = teams?.conferences
    ? Object.entries(teams.conferences).map(([id, meta]) => ({ id, ...meta }))
    : FALLBACK_CONFERENCES;

  const groupedConferences = useMemo(() => {
    const groups = new Map<string, typeof conferences>();
    for (const conf of conferences) {
      const group = conferenceGroup(conf.id);
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group)!.push(conf);
    }
    for (const list of groups.values()) {
      list.sort((a, b) => a.display_name.localeCompare(b.display_name));
    }
    return GROUP_ORDER.filter((g) => groups.has(g)).map((g) => ({
      group: g,
      label: GROUP_LABELS[g],
      conferences: groups.get(g)!,
    }));
  }, [conferences]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <header className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-3">
          College Football Conference Simulations
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400">
          Simulated probabilities for conference championship game appearances
        </p>
      </header>

      <AdSlot slotId="landing-top" className="mb-10" />

      <div className="space-y-10">
        {groupedConferences.map(({ group, label, conferences: groupConferences }) => (
          <section key={group}>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-4">
              {label}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {groupConferences.map((conf) => (
                <Link
                  key={conf.id}
                  to={conferencePath(conf.id, sport, year)}
                  className="flex flex-col items-center gap-3 p-8 rounded-xl shadow-md hover:shadow-lg transition-shadow text-white text-center"
                  style={{ backgroundColor: conf.color }}
                >
                  <ConferenceLogo
                    conference={conf.id}
                    meta={conf}
                    size="xl"
                    forceVariant="dark"
                    className="bg-white/20 rounded-xl p-3"
                  />
                  <h2 className="text-2xl font-bold">{conf.display_name}</h2>
                  <p className="mt-2 text-sm opacity-80">View standings & probabilities</p>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
