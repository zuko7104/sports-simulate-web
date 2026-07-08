import { useTheme } from '../contexts/theme';
import type { ConferenceMetadata } from '../types';

interface ConferenceLogoProps {
  conference: string;
  meta?: ConferenceMetadata | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Renders a conference's logo. CFBD does not currently provide conference
 * logo images, so `logo_light`/`logo_dark` are null for now — in that case
 * this falls back to a colored badge showing the conference abbreviation,
 * ready to be swapped for a real logo once one is sourced.
 */
export function ConferenceLogo({ conference, meta, size = 'md', className = '' }: ConferenceLogoProps) {
  const { theme } = useTheme();
  const sizeClass = {
    xs: 'w-4 h-4 text-[8px]',
    sm: 'w-6 h-6 text-[10px]',
    md: 'w-8 h-8 text-xs',
    lg: 'w-12 h-12 text-sm',
  }[size];

  const logo = theme === 'dark' ? (meta?.logo_dark ?? meta?.logo_light) : (meta?.logo_light ?? meta?.logo_dark);

  if (logo) {
    return (
      <img
        src={logo}
        alt={meta?.display_name ?? conference}
        className={`${sizeClass} object-contain ${className}`}
      />
    );
  }

  return (
    <span
      className={`${sizeClass} inline-flex items-center justify-center rounded-full font-bold text-white shrink-0 ${className}`}
      style={{ backgroundColor: meta?.color ?? '#555555' }}
      title={meta?.display_name ?? conference}
    >
      {meta?.abbreviation ?? conference}
    </span>
  );
}
