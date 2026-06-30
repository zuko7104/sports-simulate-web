/**
 * Convert a date string to a season week number.
 * week1Start is the first day (e.g. Saturday) of Week 1.
 * Weeks are 7 days long: Week 1 = [week1Start, week1Start+6], etc.
 */
export function dateToWeekNumber(dateStr: string, week1Start: string): number {
  const date = new Date(dateStr + 'T12:00:00');
  const start = new Date(week1Start + 'T12:00:00');
  const diffDays = Math.floor((date.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  return 1 + Math.floor(diffDays / 7);
}

export interface DatesConfig {
  dates: string[];
  latest_date: string;
  week1_start?: string;
  week_advance_day?: string;
}

/**
 * Convert a date string to a display label like "Week 12" or "Week 12 (11/16)".
 * If multiple dates in the provided list fall within the same week, append the
 * short date to disambiguate. If week1Start is not available, fall back to the
 * short date format.
 */
export function dateToWeekLabel(
  dateStr: string,
  week1Start: string | undefined,
  allDates?: string[],
): string {
  if (!week1Start) {
    return formatShortDate(dateStr);
  }

  const weekNum = dateToWeekNumber(dateStr, week1Start);

  // Check if other dates in the list share the same week
  if (allDates && allDates.length > 1) {
    const sameWeekDates = allDates.filter(
      d => d !== dateStr && dateToWeekNumber(d, week1Start) === weekNum
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
