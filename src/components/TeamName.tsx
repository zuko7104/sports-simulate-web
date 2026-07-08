import type { SeasonTeams } from '../types';

interface TeamNameProps {
  team: string;
  teams: SeasonTeams | null | undefined;
  className?: string;
}

/**
 * Displays a team's full name by default, switching to its CFBD abbreviation
 * (e.g. "TTU") on narrow viewports where space is constrained.
 */
export function TeamName({ team, teams, className = '' }: TeamNameProps) {
  const meta = teams?.teams[team];
  const full = meta?.display_name ?? team;
  const abbreviation = meta?.abbreviation ?? team;

  return (
    <span className={className}>
      <span className="hidden sm:inline">{full}</span>
      <span className="sm:hidden">{abbreviation}</span>
    </span>
  );
}
