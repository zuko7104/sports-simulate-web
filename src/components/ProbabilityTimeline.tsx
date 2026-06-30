import { useState, useMemo } from 'react';
import { TeamLogo } from './TeamLogo';
import type { TimelineData, SeasonTeams } from '../types';
import { dateToWeekLabel, type DatesConfig } from '../utils/dateUtils';

interface ProbabilityTimelineProps {
  timeline: TimelineData;
  teams: SeasonTeams;
  highlightTeam?: string;
  datesConfig?: DatesConfig | null;
}

const CHART_WIDTH = 800;
const CHART_HEIGHT = 400;
const MARGIN = { top: 20, right: 120, bottom: 40, left: 50 };
const PLOT_WIDTH = CHART_WIDTH - MARGIN.left - MARGIN.right;
const PLOT_HEIGHT = CHART_HEIGHT - MARGIN.top - MARGIN.bottom;

export function ProbabilityTimeline({ timeline, teams, highlightTeam, datesConfig }: ProbabilityTimelineProps) {
  const dates = timeline.dates;
  const teamNames = Object.keys(timeline.teams);

  // Sort teams by their latest CCG probability
  const sortedTeams = useMemo(() => {
    return [...teamNames].sort((a, b) => {
      const aEntries = timeline.teams[a];
      const bEntries = timeline.teams[b];
      const aLast = aEntries[aEntries.length - 1]?.ccg_probability ?? 0;
      const bLast = bEntries[bEntries.length - 1]?.ccg_probability ?? 0;
      return bLast - aLast;
    });
  }, [teamNames, timeline.teams]);

  // Only show teams with meaningful probability at some point
  const visibleTeams = useMemo(() => {
    return sortedTeams.filter(team => {
      const entries = timeline.teams[team];
      return entries.some(e => e.ccg_probability > 0.01);
    });
  }, [sortedTeams, timeline.teams]);

  const [hoveredTeam, setHoveredTeam] = useState<string | null>(highlightTeam ?? null);
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

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
      const entries = timeline.teams[team];
      const points = entries.map(e => `${xScale(e.date)},${yScale(e.ccg_probability)}`);
      if (points.length > 0) {
        paths[team] = `M ${points.join(' L ')}`;
      }
    }
    return paths;
  }, [visibleTeams, timeline.teams, dates]);

  // Y-axis grid lines
  const yTicks = [0, 0.2, 0.4, 0.6, 0.8, 1.0];

  // X-axis: show every Nth date to avoid crowding
  const xTickInterval = Math.max(1, Math.floor(dates.length / 8));
  const xTicks = dates.filter((_, i) => i % xTickInterval === 0 || i === dates.length - 1);

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        CCG Probability Over Time
      </h3>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          className="w-full"
          style={{ minWidth: 600 }}
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
            const isHighlighted = hoveredTeam === team;
            const isFaded = hoveredTeam !== null && !isHighlighted;
            return (
              <path
                key={team}
                d={teamPaths[team]}
                fill="none"
                stroke={color}
                strokeWidth={isHighlighted ? 3 : 1.5}
                opacity={isFaded ? 0.15 : 1}
                style={{ transition: 'opacity 0.15s, stroke-width 0.15s' }}
                onMouseEnter={() => setHoveredTeam(team)}
                onMouseLeave={() => setHoveredTeam(null)}
              />
            );
          })}

          {/* Data points for hovered team */}
          {hoveredTeam && timeline.teams[hoveredTeam]?.map(entry => (
            <circle
              key={entry.date}
              cx={xScale(entry.date)}
              cy={yScale(entry.ccg_probability)}
              r={3}
              fill={teams.teams[hoveredTeam]?.primary_color ?? '#888'}
              onMouseEnter={() => setHoveredDate(entry.date)}
              onMouseLeave={() => setHoveredDate(null)}
            />
          ))}

          {/* Tooltip */}
          {hoveredTeam && hoveredDate && (() => {
            const entry = timeline.teams[hoveredTeam]?.find(e => e.date === hoveredDate);
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
        {visibleTeams.slice(0, 12).map(team => {
          const meta = teams.teams[team];
          const latestProb = timeline.teams[team]?.[timeline.teams[team].length - 1]?.ccg_probability ?? 0;
          return (
            <button
              key={team}
              onMouseEnter={() => setHoveredTeam(team)}
              onMouseLeave={() => setHoveredTeam(null)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-opacity ${
                hoveredTeam === team ? 'ring-2 ring-gray-400' : ''
              } ${hoveredTeam && hoveredTeam !== team ? 'opacity-30' : ''}`}
            >
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: meta?.primary_color ?? '#888' }}
              />
              <TeamLogo team={team} size="xs" />
              <span className="font-medium">{meta?.display_name ?? team}</span>
              <span className="text-gray-500 font-mono">{(latestProb * 100).toFixed(0)}%</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
