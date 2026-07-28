import { useState } from 'react';
import { useTheme } from '../contexts/theme';
import type { ConferenceMetadata } from '../types';

interface ConferenceLogoProps {
  conference: string;
  meta?: ConferenceMetadata | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  /** Force a specific logo variant regardless of the active theme (e.g. a
   * page that always shows conference logos against a dark/colored tile,
   * where the dark-mode variant reads better either way). Defaults to
   * following the active theme. */
  forceVariant?: 'light' | 'dark';
}

/**
 * Renders a conference's logo. CFBD does not currently provide conference
 * logo images, so `logo_light`/`logo_dark` are null for now — in that case
 * this falls back to a colored badge showing the conference abbreviation,
 * ready to be swapped for a real logo once one is sourced.
 */
export function ConferenceLogo({ conference, meta, size = 'md', className = '', forceVariant }: ConferenceLogoProps) {
  const { theme } = useTheme();
  const sizeClass = {
    xs: 'w-4 h-4 text-[8px]',
    sm: 'w-6 h-6 text-[10px]',
    md: 'w-8 h-8 text-xs',
    lg: 'w-12 h-12 text-sm',
    xl: 'w-20 h-20 text-lg',
  }[size];

  const dark = forceVariant ? forceVariant === 'dark' : theme === 'dark';
  const preferred = dark ? (meta?.logo_dark ?? meta?.logo_light) : (meta?.logo_light ?? meta?.logo_dark);
  const fallback = dark ? (meta?.logo_light ?? meta?.logo_dark) : (meta?.logo_dark ?? meta?.logo_light);

  // Conference logos are hosted on a mix of third-party sites (some already
  // known to be unreliable - see the CORS-mirror comment in exportImages.ts)
  // - unlike TeamLogo, this had no error fallback at all, so a failed load
  // just showed a permanent broken-image icon. Mirrors TeamLogo's fallback
  // chain: preferred URL -> other theme's URL -> the colored abbreviation
  // badge below.
  const [src, setSrc] = useState(preferred);
  const [trackedPreferred, setTrackedPreferred] = useState(preferred);
  if (trackedPreferred !== preferred) {
    setTrackedPreferred(preferred);
    setSrc(preferred);
  }

  if (src) {
    return (
      <img
        src={src}
        alt={meta?.display_name ?? conference}
        className={`${sizeClass} object-contain ${className}`}
        onError={() => setSrc(fallback && fallback !== src ? fallback : null)}
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
