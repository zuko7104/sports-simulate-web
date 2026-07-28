import { useState, useMemo } from 'react';
import { TeamLogoFor } from './TeamLogo';
import { RankingBadge } from './RankingBadge';
import type { TimelineData, SeasonTeams } from '../types';
import { dateToWeekLabel, regularSeasonCutoffDate, type DatesConfig } from '../utils/dateUtils';
import type { ResolvedRanking } from '../utils/rankings';

interface ProbabilityTimelineProps {
  timeline: TimelineData;
  teams: SeasonTeams;
  highlightTeam?: string;
  datesConfig?: DatesConfig | null;
  rankings?: Record<string, ResolvedRanking> | null;
}

const CHART_WIDTH = 800;
const CHART_HEIGHT = 400;
const MARGIN = { top: 20, right: 20, bottom: 40, left: 40 };
const PLOT_WIDTH = CHART_WIDTH - MARGIN.left - MARGIN.right;
const PLOT_HEIGHT = CHART_HEIGHT - MARGIN.top - MARGIN.bottom;

// A larger, invisible copy of each visible stroke/point, purely to make the
// hover hit-target bigger than what's actually drawn — the visible lines/dots
// stay thin, but the mouse doesn't need pixel-perfect precision to hit them.
const HIT_STROKE_WIDTH = 16;
const HIT_POINT_RADIUS = 9;

export function ProbabilityTimeline({ timeline, teams, highlightTeam, datesConfig, rankings }: ProbabilityTimelineProps) {
  // Exclude the postseason-inclusive final snapshot of a completed season
  // (see regularSeasonCutoffDate) — it isn't a real week of the season, so
  // plotting it as one would show a misleading trailing point/segment.
  const cutoffDate = useMemo(
    () => (datesConfig ? regularSeasonCutoffDate(datesConfig) : null),
    [datesConfig],
  );
  const dates = useMemo(
    () => (cutoffDate ? timeline.dates.filter((d) => d <= cutoffDate) : timeline.dates),
    [timeline.dates, cutoffDate],
  );
  const plottedDateSet = useMemo(() => new Set(dates), [dates]);
  const teamEntries = useMemo(() => {
    const result: TimelineData['teams'] = {};
    for (const [team, entries] of Object.entries(timeline.teams)) {
      result[team] = entries.filter((e) => plottedDateSet.has(e.date));
    }
    return result;
  }, [timeline.teams, plottedDateSet]);
  const teamNames = Object.keys(teamEntries);

  // Sort teams by their latest CCG probability
  const sortedTeams = useMemo(() => {
    return [...teamNames].sort((a, b) => {
      const aEntries = teamEntries[a];
      const bEntries = teamEntries[b];
      const aLast = aEntries[aEntries.length - 1]?.ccg_probability ?? 0;
      const bLast = bEntries[bEntries.length - 1]?.ccg_probability ?? 0;
      return bLast - aLast;
    });
  }, [teamNames, teamEntries]);

  // Only show teams with meaningful probability at some point
  const visibleTeams = useMemo(() => {
    return sortedTeams.filter(team => {
      const entries = teamEntries[team];
      return entries.some(e => e.ccg_probability > 0.01);
    });
  }, [sortedTeams, teamEntries]);

  const [hoveredTeam, setHoveredTeam] = useState<string | null>(null);
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(highlightTeam ?? null);

  // The team currently highlighted: whatever is hovered takes priority,
  // otherwise fall back to the clicked/selected team so it stays
  // highlighted after the mouse moves away.
  const activeTeam = hoveredTeam ?? selectedTeam;

  function toggleSelectedTeam(team: string) {
    setSelectedTeam((prev) => (prev === team ? null : team));
  }

  // Scale functions
  const xScale = (dateStr: string) => {
    const idx = dates.indexOf(dateStr);
    return MARGIN.left + (idx / Math.max(dates.length - 1, 1)) * PLOT_WIDTH;
  };

  const yScale = (prob: number) => {
    return MARGIN.top + PLOT_HEIGHT - prob * PLOT_HEIGHT;
  };

  // Build path for each team
  const teamPaths = useMemo(() => {
    const paths: Record<string, string> = {};
    for (const team of visibleTeams) {
      const entries = teamEntries[team];
      const points = entries.map(e => `${xScale(e.date)},${yScale(e.ccg_probability)}`);
      if (points.length > 0) {
        paths[team] = `M ${points.join(' L ')}`;
      }
    }
    return paths;
  }, [visibleTeams, teamEntries, dates]);

  // Y-axis grid lines
  const yTicks = [0, 0.2, 0.4, 0.6, 0.8, 1.0];

  // X-axis: show every Nth date to avoid crowding
  const xTickInterval = Math.max(1, Math.floor(dates.length / 8));
  const xTicks = dates.filter((_, i) => i % xTickInterval === 0 || i === dates.length - 1);

  return (
    <div>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          className="w-full aspect-[2/1] block"
          preserveAspectRatio="none"
        >
          {/* Grid lines */}
          {yTicks.map(tick => (
            <g key={tick}>
              <line
                x1={MARGIN.left} y1={yScale(tick)}
                x2={MARGIN.left + PLOT_WIDTH} y2={yScale(tick)}
                stroke="#e5e7eb" strokeWidth={1}
              />
              <text
                x={MARGIN.left - 8} y={yScale(tick) + 4}
                textAnchor="end" fontSize={11} fill="#6b7280"
              >
                {(tick * 100).toFixed(0)}%
              </text>
            </g>
          ))}

          {/* X-axis labels */}
          {xTicks.map(date => (
            <text
              key={date}
              x={xScale(date)} y={CHART_HEIGHT - 8}
              textAnchor="middle" fontSize={10} fill="#6b7280"
            >
              {dateToWeekLabel(date, datesConfig?.week1_start, dates)}
            </text>
          ))}

          {/* Team lines */}
          {visibleTeams.map(team => {
            const color = teams.teams[team]?.primary_color ?? '#888';
            const isHighlighted = activeTeam === team;
            const isFaded = activeTeam !== null && !isHighlighted;
            return (
              <g key={team}>
                {/* Invisible wide copy of the line purely to make it easy to
                    hover — the visible stroke below stays thin. */}
                <path
                  d={teamPaths[team]}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={HIT_STROKE_WIDTH}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setHoveredTeam(team)}
                  onMouseLeave={() => setHoveredTeam(null)}
                  onClick={() => toggleSelectedTeam(team)}
                />
                <path
                  d={teamPaths[team]}
                  fill="none"
                  stroke={color}
                  strokeWidth={isHighlighted ? 3 : 1.5}
                  opacity={isFaded ? 0.15 : 1}
                  style={{ transition: 'opacity 0.15s, stroke-width 0.15s', pointerEvents: 'none' }}
                />
              </g>
            );
          })}

          {/* Data points for the active (hovered or selected) team */}
          {activeTeam && teamEntries[activeTeam]?.map(entry => (
            <g key={entry.date}>
              {/* Invisible larger hit target so hovering a specific point
                  doesn't require pixel-perfect precision on the small dot. */}
              <circle
                cx={xScale(entry.date)}
                cy={yScale(entry.ccg_probability)}
                r={HIT_POINT_RADIUS}
                fill="transparent"
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHoveredDate(entry.date)}
                onMouseLeave={() => setHoveredDate(null)}
              />
              <circle
                cx={xScale(entry.date)}
                cy={yScale(entry.ccg_probability)}
                r={hoveredDate === entry.date ? 5 : 3}
                fill={teams.teams[activeTeam]?.primary_color ?? '#888'}
                style={{ transition: 'r 0.1s', pointerEvents: 'none' }}
              />
            </g>
          ))}

          {/* Tooltip */}
          {activeTeam && hoveredDate && (() => {
            const entry = teamEntries[activeTeam]?.find(e => e.date === hoveredDate);
            if (!entry) return null;
            const x = xScale(entry.date);
            const y = yScale(entry.ccg_probability);
            return (
              <g>
                <rect
                  x={x + 8} y={y - 22} width={120} height={28}
                  fill="white" stroke="#d1d5db" rx={4}
                />
                <text x={x + 14} y={y - 4} fontSize={11} fill="#374151">
                  {dateToWeekLabel(entry.date, datesConfig?.week1_start, dates)}: {(entry.ccg_probability * 100).toFixed(1)}%
                </text>
              </g>
            );
          })()}
        </svg>
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-2">
        {visibleTeams.map(team => {
          const meta = teams.teams[team];
          const latestProb = teamEntries[team]?.[teamEntries[team].length - 1]?.ccg_probability ?? 0;
          return (
            <button
              key={team}
              onMouseEnter={() => setHoveredTeam(team)}
              onMouseLeave={() => setHoveredTeam(null)}
              onClick={() => toggleSelectedTeam(team)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-opacity ${
                activeTeam === team ? 'ring-2 ring-gray-400 dark:ring-gray-500' : ''
              } ${activeTeam && activeTeam !== team ? 'opacity-30' : ''}`}
            >
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: meta?.primary_color ?? '#888' }}
              />
              <TeamLogoFor team={team} teams={teams} size="xs" />
              <span className="font-medium">{meta?.display_name ?? team}</span>
              <RankingBadge team={team} rankings={rankings} />
              <span className="text-gray-500 dark:text-gray-400 font-mono">{(latestProb * 100).toFixed(0)}%</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
