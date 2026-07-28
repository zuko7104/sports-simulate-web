import type { ResolvedRanking } from '../utils/rankings';

interface RankingBadgeProps {
  team: string;
  rankings: Record<string, ResolvedRanking> | null | undefined;
  className?: string;
}

/**
 * Small muted ranking number shown next to a team's name. Renders nothing
 * for unranked teams or when no ranking data is available. Shows a stale
 * (muted yellow) color when the ranking is carried over from the previous
 * week because the current week's poll hasn't been released yet.
 */
export function RankingBadge({ team, rankings, className = '' }: RankingBadgeProps) {
  const info = rankings?.[team];
  if (!info) return null;

  const colorClass = info.stale
    ? 'text-yellow-600 dark:text-yellow-500'
    : 'text-gray-500 dark:text-gray-400';

  return (
    <span
      className={`text-xs font-medium whitespace-nowrap ${colorClass} ${className}`}
      title={`${info.type} Ranking as of Week ${info.week}`}
    >
      #{info.rank}
    </span>
  );
}
