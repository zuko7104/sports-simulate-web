import { dateToWeekNumber, gameSortKey } from './dateUtils';

export interface WeekGroup<T> {
  weekLabel: string;
  dateGroups: DateGroup<T>[];
}

export interface DateGroup<T> {
  dateLabel: string;
  games: T[];
}

function formatDateLabel(date: Date): string {
  const options: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' };
  return date.toLocaleDateString('en-US', options);
}

function getWeekNumber(date: Date): number {
  // Get the week number (Sunday-Saturday weeks)
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
  return Math.ceil((days + startOfYear.getDay() + 1) / 7);
}

/**
 * Groups games by season week (then by date within the week), sorted
 * chronologically (date, then kickoff time when known, then alphabetically
 * by the first team as a stable tiebreak). Shared by any UI that needs a
 * "week 1 divider, week 2 divider, ..." picker list — currently
 * `WhatIfPicker` and `CCGFlowchart`.
 */
export function groupGamesByWeek<T extends { date: string | null; teams: [string, string]; kickoff?: string | null }>(
  games: T[],
  week1Start?: string
): WeekGroup<T>[] {
  const sortedGames = [...games].sort((a, b) => {
    const keyA = gameSortKey(a.date ?? '9999-99-99', a.kickoff, a.teams[0]);
    const keyB = gameSortKey(b.date ?? '9999-99-99', b.kickoff, b.teams[0]);
    return keyA.localeCompare(keyB);
  });

  const weekMap = new Map<number, Map<string, T[]>>();

  for (const game of sortedGames) {
    let weekNum: number;
    let dateKey: string;

    if (!game.date) {
      weekNum = -1;
      dateKey = 'TBD';
    } else {
      const date = new Date(game.date + 'T12:00:00');
      weekNum = week1Start
        ? dateToWeekNumber(game.date, week1Start)
        : getWeekNumber(date);
      dateKey = game.date;
    }

    if (!weekMap.has(weekNum)) {
      weekMap.set(weekNum, new Map());
    }
    const dateMap = weekMap.get(weekNum)!;
    if (!dateMap.has(dateKey)) {
      dateMap.set(dateKey, []);
    }
    dateMap.get(dateKey)!.push(game);
  }

  const sortedWeeks = Array.from(weekMap.keys()).sort((a, b) => a - b);

  return sortedWeeks.map((weekNum) => {
    const dateMap = weekMap.get(weekNum)!;
    const sortedDates = Array.from(dateMap.keys()).sort();

    const dateGroups: DateGroup<T>[] = sortedDates.map((dateKey) => {
      let dateLabel: string;
      if (dateKey === 'TBD') {
        dateLabel = 'TBD';
      } else {
        const date = new Date(dateKey + 'T12:00:00');
        dateLabel = formatDateLabel(date);
      }
      return {
        dateLabel,
        games: dateMap.get(dateKey)!,
      };
    });

    const weekLabel = weekNum === -1 ? 'TBD' : `Week ${weekNum}`;

    return { weekLabel, dateGroups };
  });
}
