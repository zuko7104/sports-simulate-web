import { useEffect, useRef, useState } from 'react';
import type { SeasonDates } from '../hooks/useAvailableSeasons';
import {
  type DatesConfig,
  snapshotWeekNumber,
  snapshotWeekDateRange,
  formatDateRange,
  formatShortDate,
  regularSeasonCutoffDate,
} from '../utils/dateUtils';

interface WeekSelectorProps {
  seasons: SeasonDates[];
  year: string;
  /** undefined means "the latest available date for `year`". */
  selectedDate: string | undefined;
  isHistorical: boolean;
  onChange: (date: string | undefined, year: string) => void;
}

// Each row is a data snapshot (from dates.json), not a game - so its week
// number/range come from snapshotWeekNumber, not dateToWeekNumber. See that
// function's doc comment for why they differ. The one exception is the
// postseason-inclusive final snapshot of a completed season (CCG + bowls
// already decided) - it doesn't belong to any single week, so it's labeled
// "End of {year}" instead of whatever week number it'd otherwise land on.
function weekLabelFor(date: string, config: DatesConfig | undefined, year: string): { title: string; subtitle: string | null } {
  if (!config) {
    return { title: formatShortDate(date), subtitle: null };
  }

  const cutoff = regularSeasonCutoffDate(config);
  if (date === config.latest_date && cutoff !== config.latest_date) {
    return { title: `End of ${year}`, subtitle: null };
  }

  if (!config.week1_start) {
    return { title: formatShortDate(date), subtitle: null };
  }
  const weekNum = snapshotWeekNumber(date, config.week1_start);
  const { start, end } = snapshotWeekDateRange(weekNum, config.week1_start);
  return { title: `Week ${weekNum}`, subtitle: formatDateRange(start, end) };
}

export function WeekSelector({ seasons, year, selectedDate, isHistorical, onChange }: WeekSelectorProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const activeSeason = seasons.find((s) => s.year === year);
  const effectiveDate = selectedDate ?? activeSeason?.config.latest_date;
  const current = effectiveDate ? weekLabelFor(effectiveDate, activeSeason?.config, year) : null;

  function handleSelect(season: SeasonDates, date: string) {
    const isLatest = date === season.config.latest_date;
    onChange(isLatest ? undefined : date, season.year);
    setOpen(false);
  }

  if (seasons.length === 0 || !current) return null;

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm transition-colors ${
          isHistorical
            ? 'border-amber-400 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
            : 'border-gray-600 text-gray-200 hover:bg-gray-700'
        }`}
        title={isHistorical ? 'Viewing historical data' : undefined}
      >
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span className="font-medium">{current.title}</span>
        {current.subtitle && <span className="text-xs opacity-75">{current.subtitle}</span>}
        <svg className="w-4 h-4 shrink-0 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 left-0 sm:left-auto sm:right-0 w-64 max-w-[90vw] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden">
          <div className="max-h-96 overflow-y-auto p-1.5" role="listbox">
            {seasons.map((season, idx) => (
              <div key={season.year} className={idx > 0 ? 'mt-2 pt-2 border-t border-gray-100 dark:border-gray-700' : ''}>
                {seasons.length > 1 && (
                  <div className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 sticky top-0 bg-white dark:bg-gray-800">
                    {season.year}
                  </div>
                )}
                {season.config.dates
                  .slice()
                  .reverse()
                  .map((date) => {
                    const label = weekLabelFor(date, season.config, season.year);
                    const isSelected = season.year === year && date === effectiveDate;
                    return (
                      <button
                        key={date}
                        onClick={() => handleSelect(season, date)}
                        className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 text-left text-sm rounded-md transition-colors ${
                          isSelected
                            ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                            : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200'
                        }`}
                      >
                        <span className="font-medium">{label.title}</span>
                        {label.subtitle && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">{label.subtitle}</span>
                        )}
                      </button>
                    );
                  })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
