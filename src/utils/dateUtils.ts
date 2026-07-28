/**
 * Convert a date string to the season week number it's played in.
 * week1Start is the first day (e.g. Saturday) of Week 1.
 * Weeks are 7 days long: Week 1 = [week1Start, week1Start+6], etc.
 *
 * This is about the calendar week a specific *game* falls in - e.g. a
 * team's season-opener is "Week 1" regardless of which day of that week it
 * kicks off. For labeling a data *snapshot* date (from dates.json /
 * TimelineData) with the week it represents, use snapshotWeekNumber
 * instead - it means something different (see its doc comment).
 */
export function dateToWeekNumber(dateStr: string, week1Start: string): number {
  const date = new Date(dateStr + 'T12:00:00');
  const start = new Date(week1Start + 'T12:00:00');
  const diffDays = Math.floor((date.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  return 1 + Math.floor(diffDays / 7);
}

/**
 * Convert a *snapshot* date (from dates.json / TimelineData - an "as of"
 * date the data pipeline captured, not an individual game's date) to the
 * week it represents under a "look-ahead" framing: Week N means "week
 * (N-1) is complete, week N's games haven't been played yet".
 *
 * dates.json's week1_start is anchored 6 days before week 1's own last
 * game (see backfill_season.py's seed_dates_json), so dateToWeekNumber
 * already correctly labels an individual game's week under that anchor.
 * But a snapshot is taken on the Sunday that begins the next week (CFB
 * games are overwhelmingly Thu-Sat, so Sunday reliably falls after the
 * previous week's slate and before the next one's) - exactly one week
 * later - hence the +1 here.
 */
export function snapshotWeekNumber(dateStr: string, week1Start: string): number {
  return dateToWeekNumber(dateStr, week1Start) + 1;
}

export interface DatesConfig {
  dates: string[];
  latest_date: string;
  week1_start?: string;
  week_advance_day?: string;
}

// A gap this large between the two most recent snapshot dates only happens
// once, for the single postseason-inclusive snapshot taken after a
// completed season's CCG and bowls are over - regular-season snapshots are
// always taken on a ~weekly cadence. Comfortably above a one-week bye.
const FINAL_SNAPSHOT_GAP_DAYS = 21;

/**
 * The last date that's still part of the regular season, per `datesConfig`.
 * For an in-progress season this is just `latest_date` (nothing postseason
 * has been captured yet). For a completed season, the final snapshot is
 * taken well after the regular season, CCG, and bowls are all over, so it's
 * detected by the large gap to the snapshot before it, and the regular
 * season is considered to end at that prior snapshot instead.
 */
export function regularSeasonCutoffDate(datesConfig: DatesConfig): string {
  const { dates, latest_date } = datesConfig;
  if (dates.length < 2) return latest_date;
  const last = dates[dates.length - 1];
  const secondLast = dates[dates.length - 2];
  const gapDays = (new Date(last + 'T12:00:00').getTime() - new Date(secondLast + 'T12:00:00').getTime()) / (24 * 60 * 60 * 1000);
  return gapDays > FINAL_SNAPSHOT_GAP_DAYS ? secondLast : latest_date;
}

/**
 * Convert a *snapshot* date to a display label like "Week 12" or
 * "Week 12 (11/16)" (see snapshotWeekNumber). If multiple dates in the
 * provided list fall within the same week, append the short date to
 * disambiguate. If week1Start is not available, fall back to the short
 * date format.
 */
export function dateToWeekLabel(
  dateStr: string,
  week1Start: string | undefined,
  allDates?: string[],
): string {
  if (!week1Start) {
    return formatShortDate(dateStr);
  }

  const weekNum = snapshotWeekNumber(dateStr, week1Start);

  // Check if other dates in the list share the same week
  if (allDates && allDates.length > 1) {
    const sameWeekDates = allDates.filter(
      d => d !== dateStr && snapshotWeekNumber(d, week1Start) === weekNum
    );
    if (sameWeekDates.length > 0) {
      return `Week ${weekNum} (${formatShortDate(dateStr)})`;
    }
  }

  return `Week ${weekNum}`;
}

/**
 * Format a date string as "M/D" (e.g. "11/16").
 */
export function formatShortDate(dateStr: string): string {
  const [, month, day] = dateStr.split('-');
  return `${parseInt(month)}/${parseInt(day)}`;
}

/**
 * Format a date string as "M/DD" (e.g. "11/16", "9/02").
 */
export function formatCompactDate(dateStr: string): string {
  const [, month, day] = dateStr.split('-');
  return `${parseInt(month)}/${day}`;
}

/**
 * Add (or subtract, with a negative value) a number of days to a date string.
 */
export function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr + 'T12:00:00');
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * The 7-day [start, end] range covered by a given (game-date) week number -
 * the exact inverse of dateToWeekNumber. For the range behind a
 * snapshotWeekNumber instead, use snapshotWeekDateRange.
 */
export function weekDateRange(weekNum: number, week1Start: string): { start: string; end: string } {
  const start = addDays(week1Start, (weekNum - 1) * 7);
  return { start, end: addDays(start, 6) };
}

/**
 * The 7-day [start, end] range covered by a given snapshotWeekNumber - the
 * exact inverse of snapshotWeekNumber.
 */
export function snapshotWeekDateRange(weekNum: number, week1Start: string): { start: string; end: string } {
  return weekDateRange(weekNum - 1, week1Start);
}

/**
 * Format a [start, end] date range as e.g. "9/2 - 9/8", or "9/29 - 10/5" when
 * the range spans a month boundary.
 */
export function formatDateRange(start: string, end: string): string {
  return `${formatShortDate(start)} - ${formatShortDate(end)}`;
}

/**
 * Format an ISO kickoff datetime for display, in the viewer's own browser
 * timezone. Returns an empty string when the kickoff time isn't known (e.g.
 * the source has no time-of-day data, or the game hasn't had a time
 * announced yet) so callers can fall back to date-only display.
 */
export function formatKickoff(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/**
 * Short label for the viewer's browser timezone (e.g. "EDT", "PST"), for
 * footnotes like "All times shown in EDT". Falls back to an empty string if
 * the environment can't produce one.
 */
export function getViewerTimeZoneLabel(): string {
  try {
    const parts = new Intl.DateTimeFormat(undefined, { timeZoneName: 'short' }).formatToParts(new Date());
    return parts.find((p) => p.type === 'timeZoneName')?.value ?? '';
  } catch {
    return '';
  }
}

/**
 * Sort key for ordering games chronologically: date first, then kickoff
 * time (when known), then a stable alphabetical fallback so games with no
 * time data (or tied times) still sort deterministically.
 */
export function gameSortKey(date: string, kickoff: string | null | undefined, tiebreak: string): string {
  const timePart = kickoff ?? `${date}T99:99:99`;
  return `${date}|${timePart}|${tiebreak}`;
}
