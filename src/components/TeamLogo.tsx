import { useTheme } from '../contexts/theme';
import type { SeasonTeams } from '../types';

interface TeamLogoProps {
  team: string;
  /** Logo URLs from teams.json metadata (SeasonTeams['teams'][team]). When
   * omitted, falls back to the legacy local-asset path derivation. */
  logoLight?: string | null;
  logoDark?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const PLACEHOLDER = `${import.meta.env.BASE_URL}assets/cfb/logos/placeholder.png`;

export function TeamLogo({ team, logoLight, logoDark, size = 'md', className = '' }: TeamLogoProps) {
  const { theme } = useTheme();
  const sizeClass = {
    xs: 'w-4 h-4',
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  }[size];

  const legacyPath = `${import.meta.env.BASE_URL}assets/cfb/logos/${team.toLowerCase().replace(/ /g, '_')}.png`;
  const preferred = theme === 'dark' ? (logoDark ?? logoLight) : (logoLight ?? logoDark);
  const fallback = theme === 'dark' ? (logoLight ?? logoDark) : (logoDark ?? logoLight);
  const src = preferred ?? legacyPath;

  return (
    <img
      src={src}
      alt={team}
      className={`${sizeClass} object-contain ${className}`}
      onError={(e) => {
        const img = e.target as HTMLImageElement;
        // Fallback chain: preferred theme URL -> other theme URL -> legacy
        // local asset -> generic placeholder.
        if (fallback && img.src !== fallback) {
          img.src = fallback;
        } else if (img.src !== legacyPath) {
          img.src = legacyPath;
        } else {
          img.src = PLACEHOLDER;
        }
      }}
    />
  );
}

interface TeamLogoForProps {
  team: string;
  teams: SeasonTeams | null | undefined;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

/** Convenience wrapper that looks up a team's logo URLs from SeasonTeams
 * metadata, so callers that already have `teams` loaded don't need to
 * repeat the lookup at every call site. */
export function TeamLogoFor({ team, teams, size, className }: TeamLogoForProps) {
  const meta = teams?.teams[team];
  return (
    <TeamLogo
      team={team}
      logoLight={meta?.logo_light}
      logoDark={meta?.logo_dark}
      size={size}
      className={className}
    />
  );
}
